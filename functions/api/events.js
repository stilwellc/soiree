// Cloudflare Pages Function port of api/events.js.
// Same SQL, same JSON shape, same CORS semantics as the Vercel original.
import { getPool, finishPool } from '../_lib/db.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

// Run the schema DDL (CREATE TABLE + ALTERs) at most once per isolate instead
// of on every read. `schemaReady` holds the in-flight/resolved promise so
// concurrent requests share a single initialization.
let schemaReady = null;

function ensureSchema(pool) {
  if (!schemaReady) {
    schemaReady = (async () => {
      // Initialize table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS events (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(50) NOT NULL,
          date VARCHAR(100) NOT NULL,
          time VARCHAR(100) NOT NULL,
          location VARCHAR(255) NOT NULL,
          address VARCHAR(500),
          price VARCHAR(50) DEFAULT 'free',
          spots INTEGER DEFAULT 0,
          image TEXT,
          description TEXT,
          highlights JSONB,
          url VARCHAR(500),
          start_date DATE,
          end_date DATE,
          scraped_at TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW(),
          source VARCHAR(100)
        )
      `);

      // Add url column if it doesn't exist (for existing tables)
      await pool.query(`
        ALTER TABLE events
        ADD COLUMN IF NOT EXISTS url VARCHAR(500)
      `);

      // Add date columns if they don't exist (for existing tables)
      await pool.query(`
        ALTER TABLE events
        ADD COLUMN IF NOT EXISTS start_date DATE,
        ADD COLUMN IF NOT EXISTS end_date DATE,
        ADD COLUMN IF NOT EXISTS source VARCHAR(100)
      `);

      // Add event_type column for art exhibition openings vs viewing windows
      await pool.query(`
        ALTER TABLE events
        ADD COLUMN IF NOT EXISTS event_type VARCHAR(50)
      `);

      // Add deals column for daily food/drink specials
      await pool.query(`
        ALTER TABLE events
        ADD COLUMN IF NOT EXISTS deals JSONB
      `);
    })().catch((err) => {
      // Reset so a later request can retry if initialization failed.
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

async function handle(ctx, pool) {
  const { request, env } = ctx;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {

    // Ensure schema exists (runs once per isolate, not on every read)
    await ensureSchema(pool);

    // Get category filter
    const category = new URL(request.url).searchParams.get('category');

    // Fetch events (only show future events with dates)
    // Use CURRENT_DATE - 1 to account for timezone differences (EST is UTC-5)
    // This ensures events happening "today" in EST are still shown even after midnight UTC
    // Sort: Real dates first (chronologically), then placeholder dates (Feb 15) at bottom
    let result;
    if (category && category !== 'all') {
      result = await pool.query(
        `SELECT * FROM events
         WHERE category = $1 AND start_date IS NOT NULL AND COALESCE(end_date, start_date) >= (CURRENT_DATE - INTERVAL '1 day')
         ORDER BY
           CASE WHEN start_date = '2026-02-15' THEN 1 ELSE 0 END,
           start_date ASC,
           created_at DESC`,
        [category]
      );
    } else {
      result = await pool.query(
        `SELECT * FROM events
         WHERE start_date IS NOT NULL AND COALESCE(end_date, start_date) >= (CURRENT_DATE - INTERVAL '1 day')
         ORDER BY
           CASE WHEN start_date = '2026-02-15' THEN 1 ELSE 0 END,
           start_date ASC,
           created_at DESC`
      );
    }

    return json({
      success: true,
      count: result.rows.length,
      events: result.rows,
    });
  } catch (error) {
    // Log the real error server-side only; never leak SQL/schema detail to clients.
    console.error('API Error:', error);
    return json({
      success: false,
      error: 'Failed to load events',
      events: [],
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
