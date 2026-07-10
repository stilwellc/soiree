const { Pool } = require('pg');
const { readSourceHealth } = require('../lib/source-health');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const { sources, summary } = await readSourceHealth(pool);
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    return res.status(200).json({ success: true, summary, sources });
  } catch (error) {
    console.error('source-health error:', error.message);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ success: false, summary: { total: 0, ok: 0, low: 0, down: 0, learning: 0 }, sources: [] });
  }
};
