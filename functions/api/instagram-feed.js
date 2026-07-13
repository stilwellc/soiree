// Cloudflare Pages Function port of api/instagram-feed.js.
// lib/instagram.js uses axios (Node HTTP), so the token self-refresh is
// inlined here as a fetch-based equivalent of refreshTokenIfNeeded():
// one GET to the IG graph API + a DB insert, with the same fallback rules.
// Same JSON shape and caching semantics as the Vercel original:
// success -> 200 {posts} + s-maxage=3600/swr=300; failure -> 200 {posts: []} + no-store.
import { getPool, finishPool } from '../_lib/db.js';

const IG_API = 'https://graph.instagram.com';

async function fetchJson(url) {
  const resp = await fetch(url);
  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const err = new Error(`Instagram API ${resp.status}`);
    err.detail = data;
    throw err;
  }
  return data;
}

/**
 * Refresh a long-lived Instagram Login token if it's within 7 days of expiry.
 * Uses the Instagram Login refresh endpoint (ig_refresh_token grant type).
 * Returns { token, expiresAt } with either the refreshed or existing token.
 * (Fetch-based port of lib/instagram.js refreshTokenIfNeeded.)
 */
async function refreshTokenIfNeeded(pool, env) {
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
    token = env.INSTAGRAM_ACCESS_TOKEN;
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
      const refreshUrl = new URL(`${IG_API}/refresh_access_token`);
      refreshUrl.searchParams.set('grant_type', 'ig_refresh_token');
      refreshUrl.searchParams.set('access_token', token);
      const data = await fetchJson(refreshUrl);

      token = data.access_token;
      expiresAt = new Date(Date.now() + data.expires_in * 1000);

      await pool.query(
        'INSERT INTO instagram_tokens (access_token, expires_at) VALUES ($1, $2)',
        [token, expiresAt]
      );
      console.log('Token refreshed successfully, new expiry:', expiresAt.toISOString());
    } catch (err) {
      console.error('Token refresh failed:', err.detail || err.message);
      // Continue with existing token — it may still work
    }
  }

  return { token, expiresAt };
}

async function handle(ctx, pool) {
  const { env } = ctx;

  try {

    // Auto-refreshing token from the database (falls back to env on first run)
    const { token } = await refreshTokenIfNeeded(pool, env);
    const igUserId = (env.INSTAGRAM_USER_ID || '').trim();

    if (!token || !igUserId) {
      throw new Error('Missing Instagram credentials');
    }

    const mediaUrl = new URL(`${IG_API}/${igUserId}/media`);
    mediaUrl.searchParams.set('fields', 'id,media_type,media_url,thumbnail_url,permalink');
    mediaUrl.searchParams.set('limit', '6');
    mediaUrl.searchParams.set('access_token', token);
    const data = await fetchJson(mediaUrl);

    const posts = (data.data || []).map(p => ({
      id: p.id,
      media_url: p.media_type === 'VIDEO' ? p.thumbnail_url : p.media_url,
      permalink: p.permalink,
    }));

    // Only cache successful responses — a cached failure blanks the
    // feed for every visitor for an hour.
    return new Response(JSON.stringify({ posts }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Instagram feed error:', error.detail || error.message);
    // Fail soft: 200 with an empty list so the frontend hides the band
    // instead of erroring, and never CDN-cache the failure.
    return new Response(JSON.stringify({ posts: [] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }
}

// Per-request pool lifecycle (see _lib/db.js): create, handle, release.
export async function onRequest(ctx) {
  const pool = getPool(ctx.env);
  try {
    return await handle(ctx, pool);
  } finally {
    finishPool(ctx, pool);
  }
}
