// Cloudflare Pages Function port of api/source-health.js.
// Same JSON shape, same caching semantics as the Vercel original:
// success -> 200 + s-maxage=120/swr=300; failure -> 200 (fail soft) + no-store.
import { getPool, finishPool } from '../_lib/db.js';
import { readSourceHealth } from '../_lib/source-health.js';

function json(body, cacheControl) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': cacheControl,
    },
  });
}

async function handle(ctx, pool) {
  try {
    const { sources, summary } = await readSourceHealth(pool);
    return json({ success: true, summary, sources }, 's-maxage=120, stale-while-revalidate=300');
  } catch (error) {
    console.error('source-health error:', error.message);
    return json(
      { success: false, summary: { total: 0, ok: 0, low: 0, down: 0, learning: 0 }, sources: [] },
      'no-store'
    );
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
