import { Pool } from '@neondatabase/serverless';

// One pool PER REQUEST, closed via ctx.waitUntil — the Neon docs pattern for
// Workers. A module-level memoized pool looked like the Vercel original but
// its WebSocket dies between requests in a reused isolate ("Network
// connection lost", intermittent 500s — observed on the first staged deploy).
// Setup cost is ~10-20ms; correctness beats the micro-optimization.
export function getPool(env) {
  return new Pool({ connectionString: env.POSTGRES_URL });
}

/** Call once the response is built: releases the pool without delaying it. */
export function finishPool(ctx, pool) {
  try { ctx.waitUntil(pool.end()); } catch { /* best-effort */ }
}
