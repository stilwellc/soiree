// Cloudflare Pages Function port of api/subscribe.js.
// Same SQL, same JSON shape, same CORS semantics as the Vercel original.
// crypto.randomBytes(32).toString('hex') is replaced with the Web Crypto
// equivalent (32 random bytes -> 64 hex chars).
import { getPool, finishPool } from '../_lib/db.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

function randomHexToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function handle(ctx, pool) {
  const { request, env } = ctx;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  try {

    // Create subscribers table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        region VARCHAR(50) NOT NULL DEFAULT 'nyc',
        categories JSONB DEFAULT '[]'::jsonb,
        unsubscribe_token VARCHAR(64) UNIQUE NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // POST — subscribe or update preferences
    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { email, region, categories } = body || {};

      if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        return json({ success: false, error: 'Valid email is required' }, 400);
      }

      const cleanEmail = email.toLowerCase().trim();
      const cleanRegion = region || 'nyc';
      const cleanCategories = Array.isArray(categories) ? categories : [];
      const token = randomHexToken();

      // Upsert: insert or update if email already exists
      const result = await pool.query(`
        INSERT INTO subscribers (email, region, categories, unsubscribe_token)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO UPDATE SET
          region = EXCLUDED.region,
          categories = EXCLUDED.categories,
          active = true,
          updated_at = NOW()
        RETURNING id, email, region, categories
      `, [cleanEmail, cleanRegion, JSON.stringify(cleanCategories), token]);

      return json({
        success: true,
        message: 'Subscribed successfully',
        subscriber: result.rows[0],
      });
    }

    // DELETE — unsubscribe via token
    if (request.method === 'DELETE') {
      const token = new URL(request.url).searchParams.get('token');

      if (!token) {
        return json({ success: false, error: 'Unsubscribe token is required' }, 400);
      }

      const result = await pool.query(`
        UPDATE subscribers SET active = false, updated_at = NOW()
        WHERE unsubscribe_token = $1
        RETURNING email
      `, [token]);

      if (result.rows.length === 0) {
        return json({ success: false, error: 'Subscription not found' }, 404);
      }

      return json({
        success: true,
        message: `${result.rows[0].email} has been unsubscribed`,
      });
    }

    // GET — count of active subscribers (public)
    if (request.method === 'GET') {
      const result = await pool.query(`
        SELECT COUNT(*) as count FROM subscribers WHERE active = true
      `);

      return json({
        success: true,
        count: parseInt(result.rows[0].count),
      });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (error) {
    console.error('Subscribe API Error:', error);
    return json({
      success: false,
      error: error.message,
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
