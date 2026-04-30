const { list } = require('@vercel/blob');
const https = require('https');

/**
 * Image proxy — serves Vercel Blob images through the app domain.
 * Instagram blocks vercel-storage.com, so we proxy through soiree-gules.vercel.app.
 * Usage: /api/img?path=instagram/some-image.png
 */
module.exports = async function handler(req, res) {
  const { path } = req.query;
  if (!path) return res.status(400).json({ error: 'Missing path parameter' });

  // Build the Blob URL
  const blobUrl = `https://agrytkqwch00wvxr.public.blob.vercel-storage.com/${path}`;

  // Fetch from Blob and pipe to response
  https.get(blobUrl, (proxyRes) => {
    if (proxyRes.statusCode !== 200) {
      return res.status(404).json({ error: 'Image not found' });
    }
    res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    proxyRes.pipe(res);
  }).on('error', () => {
    res.status(500).json({ error: 'Failed to fetch image' });
  });
};
