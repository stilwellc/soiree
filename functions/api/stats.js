// Cloudflare Pages Function port of api/stats.js.
// Same SQL, same JSON shape, same CORS semantics as the Vercel original.
// Any non-OPTIONS method runs the read path; POST additionally increments
// page_views first (faithful to the original, which never 405s).
import { getPool, finishPool } from '../_lib/db.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

async function handle(ctx, pool) {
  const { request, env } = ctx;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  try {

    // Create stats table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stats (
        id SERIAL PRIMARY KEY,
        page_views INTEGER DEFAULT 0,
        total_events_scraped INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add total_events_scraped column to existing tables
    await pool.query(`
      ALTER TABLE stats ADD COLUMN IF NOT EXISTS total_events_scraped INTEGER DEFAULT 0
    `);

    // Activity log table for tracking scrape + instagram post events
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        type VARCHAR(20) NOT NULL,
        event_count INTEGER DEFAULT 0,
        detail TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Initialize stats if not exists
    await pool.query(`
      INSERT INTO stats (id, page_views)
      SELECT 1, 0
      WHERE NOT EXISTS (SELECT 1 FROM stats WHERE id = 1)
    `);

    if (request.method === 'POST') {
      // Increment page view count
      await pool.query(`
        UPDATE stats
        SET page_views = page_views + 1, updated_at = NOW()
        WHERE id = 1
      `);
    }

    // Get current stats
    const statsResult = await pool.query('SELECT page_views, total_events_scraped FROM stats WHERE id = 1');
    const pageViews = statsResult.rows[0]?.page_views || 0;
    const totalEventsScraped = statsResult.rows[0]?.total_events_scraped || 0;

    // Get active event count (currently in DB)
    const eventsResult = await pool.query('SELECT COUNT(*) as count FROM events');
    const eventCount = parseInt(eventsResult.rows[0]?.count || 0);

    // Get unique event count (distinct events, not duplicates)
    const uniqueEventsResult = await pool.query(`
      SELECT COUNT(DISTINCT name) as count FROM events
    `);
    const uniqueEventCount = parseInt(uniqueEventsResult.rows[0]?.count || 0);

    // Activity timeline (last 30 days)
    const { rows: timeline } = await pool.query(`
      SELECT DATE(created_at) as date, type, SUM(event_count)::int as count
      FROM activity_log
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at), type
      ORDER BY date ASC
    `);

    return json({
      success: true,
      stats: {
        pageViews,
        totalEvents: eventCount,
        uniqueEvents: uniqueEventCount,
        totalEventsScraped,
      },
      timeline,
    });
  } catch (error) {
    console.error('Stats API Error:', error);
    return json({
      success: false,
      error: error.message,
      stats: {
        pageViews: 0,
        totalEvents: 0,
        uniqueEvents: 0,
      },
    }, 500);
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
