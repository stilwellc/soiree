// /sitemap.xml — home + per-event /e/ URLs for the same verified-future set
// the feed serves (mirrors api/events.js: start_date >= CURRENT_DATE - 1 day,
// timezone-hedged for ET). lastmod comes from scraped_at/created_at.
//
// Cloudflare Pages Function port of api/sitemap.js. The filename
// sitemap.xml.js routes this function at /sitemap.xml (Pages Functions map
// the file path minus the trailing .js to the URL, dots included), replacing
// the Vercel rewrite { "source": "/sitemap.xml", "destination": "/api/sitemap" }.
'use strict';

import { Pool } from '@neondatabase/serverless';
import seo from '../lib/seo.js';

const { SITE_ORIGIN, slugify, escapeXml, ymd } = seo;

function urlEntry(loc, lastmod) {
  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>` : null,
    '  </url>',
  ].filter(Boolean).join('\n');
}

export async function onRequest(ctx) {
  const today = ymd(new Date());
  const entries = [urlEntry(`${SITE_ORIGIN}/`, today)];

  let pool;
  try {
    pool = new Pool({ connectionString: ctx.env.POSTGRES_URL });
    const { rows } = await pool.query(`
      SELECT id, name, start_date,
             COALESCE(scraped_at, created_at, NOW()) AS lastmod
      FROM events
      WHERE start_date IS NOT NULL
        AND start_date >= (CURRENT_DATE - INTERVAL '1 day')
      ORDER BY start_date ASC, id ASC
    `);

    for (const ev of rows) {
      entries.push(urlEntry(
        `${SITE_ORIGIN}/e/${ev.id}-${slugify(ev.name)}`,
        ymd(ev.lastmod) || today
      ));
    }
  } catch (error) {
    // Degrade to a home-only sitemap rather than a crawl-blocking 500.
    console.error('sitemap: event query failed, serving home-only sitemap', error.message);
  } finally {
    if (pool) ctx.waitUntil(pool.end().catch(() => {}));
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries.join('\n'),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
