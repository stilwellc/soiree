const axios = require('axios');

// Instagram Login tokens (IGA...) use graph.instagram.com
const GRAPH_API = 'https://graph.instagram.com';

/**
 * Instagram API helpers for the Content Publishing API.
 * Uses Instagram Login tokens (IGA...) with graph.instagram.com endpoints.
 * Handles carousel posting and long-lived token refresh.
 */

/**
 * Create a media container for a single image (carousel child).
 */
async function createMediaContainer(igUserId, imageUrl, accessToken, { isCarouselItem = false, caption = null } = {}) {
  const formData = new URLSearchParams();
  formData.append('image_url', imageUrl);
  formData.append('access_token', accessToken);
  if (isCarouselItem) formData.append('is_carousel_item', 'true');
  if (caption && !isCarouselItem) formData.append('caption', caption);

  try {
    const { data } = await axios.post(`${GRAPH_API}/${igUserId}/media`, formData.toString());
    return data.id;
  } catch (err) {
    const detail = err.response?.data?.error || err.response?.data || err.message;
    throw new Error(`createMediaContainer failed: ${JSON.stringify(detail)}`);
  }
}

/**
 * Create a carousel container from child container IDs.
 */
async function createCarouselContainer(igUserId, childIds, caption, accessToken) {
  const formData = new URLSearchParams();
  formData.append('media_type', 'CAROUSEL');
  formData.append('children', childIds.join(','));
  formData.append('caption', caption);
  formData.append('access_token', accessToken);

  try {
    const { data } = await axios.post(`${GRAPH_API}/${igUserId}/media`, formData.toString());
    return data.id;
  } catch (err) {
    const detail = err.response?.data?.error || err.response?.data || err.message;
    throw new Error(`createCarouselContainer failed: ${JSON.stringify(detail)}`);
  }
}

/**
 * Poll a container until it reaches FINISHED status (or errors out).
 * Images typically finish within seconds.
 */
async function waitForContainer(containerId, accessToken, { maxAttempts = 10, delayMs = 3000 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const { data } = await axios.get(`${GRAPH_API}/${containerId}`, {
      params: {
        fields: 'status_code',
        access_token: accessToken,
      },
    });

    if (data.status_code === 'FINISHED') return true;
    if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
      throw new Error(`Container ${containerId} failed with status: ${data.status_code}`);
    }

    // IN_PROGRESS — wait and retry
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw new Error(`Container ${containerId} did not finish within ${maxAttempts * delayMs / 1000}s`);
}

/**
 * Publish a media container (single post or carousel).
 */
async function publishMedia(igUserId, containerId, accessToken) {
  try {
    const { data } = await axios.post(
      `${GRAPH_API}/${igUserId}/media_publish?creation_id=${containerId}&access_token=${accessToken}`
    );
    return data.id;
  } catch (err) {
    const detail = err.response?.data?.error || err.response?.data || err.message;
    throw new Error(`publishMedia failed: ${JSON.stringify(detail)}`);
  }
}

/**
 * Post a carousel of images to Instagram.
 * Full flow: create children → wait → create carousel → wait → publish.
 *
 * @param {string} igUserId - Instagram Business Account ID
 * @param {string[]} imageUrls - Array of public image URLs (max 10)
 * @param {string} caption - Post caption
 * @param {string} accessToken - Long-lived access token
 * @returns {Promise<string>} Published media ID
 */
async function postCarousel(igUserId, imageUrls, caption, accessToken) {
  console.log(`Creating ${imageUrls.length} carousel child containers... userId=${igUserId}`);

  // Step 1: Create child containers
  const childIds = await Promise.all(
    imageUrls.map(async (url) => {
      const id = await createMediaContainer(igUserId, url, accessToken, { isCarouselItem: true });
      console.log(`  Child container: ${id}`);
      return id;
    })
  );

  // Step 2: Create carousel container
  console.log('Creating carousel container...');
  const carouselId = await createCarouselContainer(igUserId, childIds, caption, accessToken);
  console.log('Carousel container ID:', carouselId);

  // Step 3: Wait briefly then publish (containers finish near-instantly for images)
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log('Publishing...');
  const mediaId = await publishMedia(igUserId, carouselId, accessToken);
  console.log('Published! Media ID:', mediaId);

  return mediaId;
}

/**
 * Refresh a long-lived Instagram Login token if it's within 7 days of expiry.
 * Uses the Instagram Login refresh endpoint (ig_refresh_token grant type).
 * Returns { token, expiresAt } with either the refreshed or existing token.
 */
async function refreshTokenIfNeeded(pool) {
  // Ensure table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS instagram_tokens (
      id SERIAL PRIMARY KEY,
      access_token TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Get current stored token
  const { rows } = await pool.query('SELECT * FROM instagram_tokens ORDER BY id DESC LIMIT 1');

  let token, expiresAt;

  if (rows.length > 0) {
    token = rows[0].access_token;
    expiresAt = new Date(rows[0].expires_at);
  } else {
    // First run — seed from env var
    token = process.env.INSTAGRAM_ACCESS_TOKEN;
    if (!token) throw new Error('No INSTAGRAM_ACCESS_TOKEN in env or database');
    // Assume it was just created — set expiry to 59 days from now
    expiresAt = new Date(Date.now() + 59 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO instagram_tokens (access_token, expires_at) VALUES ($1, $2)',
      [token, expiresAt]
    );
  }

  // Check if token needs refresh (within 7 days of expiry)
  const daysUntilExpiry = (expiresAt - Date.now()) / (1000 * 60 * 60 * 24);
  console.log(`Token expires in ${Math.round(daysUntilExpiry)} days`);

  if (daysUntilExpiry < 7) {
    console.log('Refreshing Instagram access token...');
    try {
      const { data } = await axios.get(`${GRAPH_API}/refresh_access_token`, {
        params: {
          grant_type: 'ig_refresh_token',
          access_token: token,
        },
      });

      token = data.access_token;
      expiresAt = new Date(Date.now() + data.expires_in * 1000);

      await pool.query(
        'INSERT INTO instagram_tokens (access_token, expires_at) VALUES ($1, $2)',
        [token, expiresAt]
      );
      console.log('Token refreshed successfully, new expiry:', expiresAt.toISOString());
    } catch (err) {
      console.error('Token refresh failed:', err.response?.data || err.message);
      // Continue with existing token — it may still work
    }
  }

  return { token, expiresAt };
}

module.exports = { postCarousel, refreshTokenIfNeeded };
