#!/usr/bin/env node
/**
 * Builds the per-event OG share cards as STATIC PNGs on the GitHub Actions
 * runner (standing rule: ALL batch work — scraping, OG rendering, IG posting
 * — runs on Actions, never in serving functions; satori+resvg is far too
 * CPU-heavy for Cloudflare Pages Functions' 10ms cap).
 *
 * Mirrors api/og.js exactly: same card fields, same renderer
 * (lib/og-card.renderOgCard), for the same verified-future window the
 * sitemap/event pages serve (api/sitemap.js: start_date >= CURRENT_DATE - 1
 * day). Output:
 *   og-events/<id>.png    — per-event card (what /api/og?id=<id> renders)
 *   og-events/default.png — the sitewide default card (the no-id variant)
 * The daily-scrape workflow copies og-events/ into dist/ before deploying to
 * Cloudflare Pages.
 *
 * Idempotent: an event is skipped when its PNG is newer than the row's
 * scraped_at/created_at (cheap mtime check; a fresh runner just re-renders).
 *
 * Env: POSTGRES_URL (required for event cards; without it the script still
 * renders the default card and exits 0 so staging runs never fail the day).
 * Usage: node scripts/build-og-events.js   (run from the repo root — the
 * renderer resolves fonts via process.cwd(), same as on Vercel)
 */
'use strict';

const { Pool } = require('pg');
const { mkdir, stat, writeFile } = require('fs/promises');
const { join } = require('path');
const { renderOgCard } = require('../lib/og-card');
const { cleanForMeta, prettyDate, truncate } = require('../lib/seo');

const OUT_DIR = join(__dirname, '..', 'og-events');

// Same default card as api/og.js (the no-event variant).
const DEFAULT_CARD = {
  title: 'The evening, verified.',
  italicTitle: true,
  meta: 'Curated evenings · NYC · Hoboken · Jersey City',
  sub: 'We print what we can verify, and nothing else.',
};

// Replicated verbatim from api/og.js (not exported there).
function eventCard(ev) {
  const title = truncate(cleanForMeta(ev.name) || 'An evening occasion', 120);

  const metaBits = [];
  const date = prettyDate(ev.start_date);
  if (date) metaBits.push(date);
  const time = cleanForMeta(ev.time);
  if (time && time.length <= 22 && /\d/.test(time)) metaBits.push(time);

  const subBits = [];
  const venue = cleanForMeta(ev.location);
  if (venue) subBits.push(truncate(venue, 60));
  if (String(ev.price || '').trim().toLowerCase() === 'free') subBits.push('Free — as published');

  return {
    title,
    meta: metaBits.join(' · ') || null,
    sub: subBits.join(' · ') || null,
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // Sitewide default card — a single render, always refreshed.
  await writeFile(join(OUT_DIR, 'default.png'), await renderOgCard(DEFAULT_CARD));

  if (!process.env.POSTGRES_URL) {
    console.warn('build-og-events: POSTGRES_URL not set — rendered default card only');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  // Canonical set: same window api/sitemap.js (and the feed) serves.
  const { rows } = await pool.query(`
    SELECT id, name, start_date, time, location, price,
           COALESCE(scraped_at, created_at, NOW()) AS lastmod
    FROM events
    WHERE start_date IS NOT NULL
      AND start_date >= (CURRENT_DATE - INTERVAL '1 day')
    ORDER BY start_date ASC, id ASC
  `);

  let rendered = 0;
  let skipped = 0;
  let failed = 0;

  for (const ev of rows) {
    const file = join(OUT_DIR, `${ev.id}.png`);

    // Cheap idempotence: skip when the PNG postdates the row's last scrape.
    try {
      const st = await stat(file);
      if (st.mtimeMs > new Date(ev.lastmod).getTime()) {
        skipped++;
        continue;
      }
    } catch (_) {
      // no file yet — render it
    }

    try {
      await writeFile(file, await renderOgCard(eventCard(ev)));
      rendered++;
    } catch (err) {
      failed++;
      console.error(`  event ${ev.id}: render failed — ${err.message}`);
    }
  }

  await pool.end();
  console.log(
    `build-og-events: ${rendered} rendered, ${skipped} skipped, ${failed} failed ` +
    `(${rows.length} events + default card)`
  );

  // Only a total wipeout is a real failure — partial output still deploys.
  if (rows.length > 0 && rendered === 0 && skipped === 0) process.exit(1);
}

main().then(() => process.exit(process.exitCode || 0)).catch((err) => {
  console.error('build-og-events failed:', err);
  process.exit(1);
});
