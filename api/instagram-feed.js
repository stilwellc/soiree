const axios = require('axios');
const { Pool } = require('pg');
const { refreshTokenIfNeeded } = require('../lib/instagram');

const IG_API = 'https://graph.instagram.com';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async function handler(req, res) {
  try {
    // Auto-refreshing token from the database (falls back to env on first run)
    const { token } = await refreshTokenIfNeeded(pool);
    const igUserId = (process.env.INSTAGRAM_USER_ID || '').trim();

    if (!token || !igUserId) {
      throw new Error('Missing Instagram credentials');
    }

    const { data } = await axios.get(`${IG_API}/${igUserId}/media`, {
      params: {
        fields: 'id,media_type,media_url,thumbnail_url,permalink',
        limit: 6,
        access_token: token,
      },
    });

    const posts = (data.data || []).map(p => ({
      id: p.id,
      media_url: p.media_type === 'VIDEO' ? p.thumbnail_url : p.media_url,
      permalink: p.permalink,
    }));

    // Only cache successful responses — a cached failure blanks the
    // feed for every visitor for an hour.
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');
    return res.status(200).json({ posts });
  } catch (error) {
    console.error('Instagram feed error:', error.response?.data || error.message);
    // Fail soft: 200 with an empty list so the frontend hides the band
    // instead of erroring, and never CDN-cache the failure.
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ posts: [] });
  }
};
