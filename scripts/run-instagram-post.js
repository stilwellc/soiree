#!/usr/bin/env node
/**
 * Runs the weekly Instagram post ON the GitHub Actions runner (standing rule:
 * ALL batch work — scraping, OG rendering, IG posting — runs on Actions, not
 * in serving functions; this replaces the Vercel cron in vercel.json, which
 * stays in place until cutover).
 *
 * Reuses api/instagram-post.js verbatim by invoking the serverless handler
 * with a mocked req/res — the same harness pattern as scripts/run-scrape.js.
 * Exact posting logic, category balancing, captions, freeimage.host
 * re-upload, token refresh (lib/instagram.refreshTokenIfNeeded) and DB
 * bookkeeping (instagram_tokens + activity_log) are all preserved; nothing
 * is duplicated.
 *
 * Env (everything api/instagram-post.js and its libs read):
 *   POSTGRES_URL            — required (events query + token/activity tables)
 *   INSTAGRAM_USER_ID       — required for live posts (IG Business account id)
 *   INSTAGRAM_ACCESS_TOKEN  — first-run seed only; thereafter the refreshed
 *                             token lives in the instagram_tokens table
 *   BLOB_READ_WRITE_TOKEN   — @vercel/blob archive uploads
 *   (SCRAPE_SECRET is NOT needed here — the harness authorizes the handler
 *   via the x-vercel-cron header, exactly like Vercel's scheduler does.)
 *
 * Usage: node scripts/run-instagram-post.js [--mode=weekend] [--dry-run]
 *   (run from the repo root — cover images/fonts resolve via process.cwd())
 */
'use strict';

const handler = require('../api/instagram-post.js');

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(obj) { this.body = obj; this.done(); return this; },
    end() { this.done(); return this; },
  };
  res.finished = new Promise(resolve => { res.done = resolve; });
  return res;
}

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error('POSTGRES_URL is not set');
    process.exit(1);
  }

  const query = {};
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run' || arg === 'dry-run' || arg === 'dry_run') query.dry_run = 'true';
    else if (arg === '--mode=weekend' || arg === 'weekend') query.mode = 'weekend';
    else if (arg === '--mode=weekly' || arg === 'weekly') { /* default mode */ }
    else console.warn(`Ignoring unknown argument: ${arg}`);
  }

  console.log(`Instagram post run — mode=${query.mode || 'weekly'}${query.dry_run ? ' (dry run)' : ''}`);

  const req = {
    method: 'POST',
    query,
    // The handler trusts Vercel's cron header; on the runner we assert the
    // same trusted-scheduler role (mirrors run-scrape.js's Bearer shortcut).
    headers: { 'x-vercel-cron': '1' },
  };
  const res = mockRes();
  await handler(req, res);
  await res.finished;

  console.log(JSON.stringify(res.body, null, 2));

  const ok = res.statusCode === 200 && !(res.body && res.body.success === false);
  // Explicit exit — the handler's pg pool would otherwise hold the process open.
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('run-instagram-post failed:', err);
  process.exit(1);
});
