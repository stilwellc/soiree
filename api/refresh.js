const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST to refresh database.' });
  }

  try {
    console.log('Starting database refresh...');

    // Step 1: Clear all events
    await pool.query('DELETE FROM events');
    console.log('✅ All events cleared');

    // Step 2: Call the scraper
    const baseUrl = req.headers.host?.includes('localhost')
      ? 'http://localhost:3000'
      : `https://${req.headers.host}`;
    const scrapeUrl = `${baseUrl}/api/scrape`;
    console.log(`Triggering scraper at: ${scrapeUrl}`);

    const scrapeResponse = await axios.get(scrapeUrl);
    const scrapeData = scrapeResponse.data;

    return res.status(200).json({
      success: true,
      message: 'Database refreshed successfully',
      cleared: true,
      scrapeResult: scrapeData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Refresh Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
