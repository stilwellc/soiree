#!/usr/bin/env node
/**
 * Runs the daily scrape ON the GitHub Actions runner (standing rule: ALL
 * scraping goes through Actions — Vercel functions serve pages, they don't
 * do batch work; the July 2026 fair-use block came from exactly that).
 *
 * Reuses api/scrape.js verbatim by invoking the serverless handler with a
 * mocked req/res per group — no scraper logic is duplicated, and there's no
 * 60s function cap out here, so groups run sequentially with headroom.
 *
 * Env: POSTGRES_URL (required), SCRAPE_SECRET (optional — defaults match the
 * handler). Usage: node scripts/run-scrape.js [group ...]  (default: all)
 */

const handler = require('../api/scrape.js');

const ALL_GROUPS = ['main', 'galleries', 'museums', 'film', 'literary', 'perfparks', 'nj', 'puppeteer'];
const SECRET = process.env.SCRAPE_SECRET || 'soiree-scrape-secret-2024';

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

async function runGroup(group) {
  const req = {
    method: 'POST',
    query: { group },
    headers: { authorization: `Bearer ${SECRET}` },
  };
  const res = mockRes();
  const started = Date.now();
  await handler(req, res);
  await res.finished;
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  const ok = res.statusCode === 200;
  const summary = res.body && (res.body.message || res.body.error || JSON.stringify(res.body).slice(0, 120));
  console.log(`[${group}] ${ok ? 'OK' : `FAILED (${res.statusCode})`} in ${secs}s — ${summary}`);
  return ok;
}

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error('POSTGRES_URL is not set');
    process.exit(1);
  }
  const groups = process.argv.slice(2).length ? process.argv.slice(2) : ALL_GROUPS;
  let okCount = 0;
  for (const g of groups) {
    try {
      if (await runGroup(g)) okCount++;
    } catch (e) {
      console.error(`[${g}] threw:`, e.message);
    }
  }
  console.log(`\n${okCount}/${groups.length} groups succeeded`);
  // one flaky group shouldn't fail the day (scraping is additive upsert —
  // partial success still refreshes data); zero successes is a real failure.
  process.exit(okCount > 0 ? 0 : 1);
}

main().then(() => process.exit(process.exitCode || 0)).catch(e => { console.error(e); process.exit(1); });
