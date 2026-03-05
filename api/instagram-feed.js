const axios = require('axios');

const IG_API = 'https://graph.instagram.com';

module.exports = async function handler(req, res) {
  // Cache for 1 hour (CDN) + 5 min stale-while-revalidate
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');

  try {
    const token = (process.env.INSTAGRAM_ACCESS_TOKEN || '').trim();
    const igUserId = (process.env.INSTAGRAM_USER_ID || '').trim();

    if (!token || !igUserId) {
      return res.status(500).json({ error: 'Missing Instagram credentials' });
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

    return res.status(200).json({ posts });
  } catch (error) {
    console.error('Instagram feed error:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Failed to fetch Instagram feed' });
  }
};
