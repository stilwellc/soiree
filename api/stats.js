const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Create stats table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stats (
        id SERIAL PRIMARY KEY,
        page_views INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Initialize stats if not exists
    await pool.query(`
      INSERT INTO stats (id, page_views)
      SELECT 1, 0
      WHERE NOT EXISTS (SELECT 1 FROM stats WHERE id = 1)
    `);

    if (req.method === 'POST') {
      // Increment page view count
      await pool.query(`
        UPDATE stats
        SET page_views = page_views + 1, updated_at = NOW()
        WHERE id = 1
      `);
    }

    // Get current stats
    const statsResult = await pool.query('SELECT page_views FROM stats WHERE id = 1');
    const pageViews = statsResult.rows[0]?.page_views || 0;

    // Get total event count
    const eventsResult = await pool.query('SELECT COUNT(*) as count FROM events');
    const eventCount = parseInt(eventsResult.rows[0]?.count || 0);

    // Get unique event count (distinct events, not duplicates)
    const uniqueEventsResult = await pool.query(`
      SELECT COUNT(DISTINCT name) as count FROM events
    `);
    const uniqueEventCount = parseInt(uniqueEventsResult.rows[0]?.count || 0);

    return res.status(200).json({
      success: true,
      stats: {
        pageViews,
        totalEvents: eventCount,
        uniqueEvents: uniqueEventCount
      }
    });
  } catch (error) {
    console.error('Stats API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stats: {
        pageViews: 0,
        totalEvents: 0,
        uniqueEvents: 0
      }
    });
  }
};
