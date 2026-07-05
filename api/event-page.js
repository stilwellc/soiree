// /e/:id-slug — server-rendered head for one event (crawlers + link unfurls).
// Rewritten from vercel.json: { "source": "/e/(.*)", "destination": "/api/event-page?slug=$1" }
//
// Reads index.html from disk, strips the base <title>/description/OG/Twitter
// tags, and injects per-event <title>, meta description, canonical, OG/Twitter
// tags, schema.org/Event JSON-LD, and window.__DEEP_EVENT_ID__ so the SPA
// opens the matching detail sheet on load. Any failure -> plain index.html.
//
// Event fields are SCRAPED CONTENT: everything is escaped for its context
// (escapeHtml for HTML/attributes, jsonLdSafe for the JSON-LD script block).
'use strict';

const { Pool } = require('pg');
const { readFile } = require('fs/promises');
const { join } = require('path');
const {
  SITE_ORIGIN, slugify, escapeHtml, jsonLdSafe,
  ymd, prettyDate, cleanForMeta, truncate,
} = require('../lib/seo');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

// "7:00 PM" / "7 pm" only — ranges and prose stay date-only in JSON-LD
// (hedge in the venue's favor; never assert a start time we didn't parse).
function parseSimpleTime(raw) {
  const m = String(raw || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return `${String(h).padStart(2, '0')}:${m[2] || '00'}:00`;
}

function isSoldOut(ev) {
  return /sold\s*out/i.test(String(ev.date || '')) ||
         /^\s*sold\s*out\.?\s*$/i.test(String(ev.description || ''));
}

function detectLocality(address) {
  const a = String(address || '');
  if (/hoboken/i.test(a)) return { addressLocality: 'Hoboken', addressRegion: 'NJ' };
  if (/jersey\s*city/i.test(a)) return { addressLocality: 'Jersey City', addressRegion: 'NJ' };
  if (/brooklyn/i.test(a)) return { addressLocality: 'Brooklyn', addressRegion: 'NY' };
  if (/queens/i.test(a)) return { addressLocality: 'Queens', addressRegion: 'NY' };
  return { addressLocality: 'New York', addressRegion: 'NY' };
}

function buildJsonLd(ev, canonical, ogImage) {
  const name = cleanForMeta(ev.name) || 'Soirée event';
  const startYmd = ymd(ev.start_date);
  const endYmd = ymd(ev.end_date);
  const time = parseSimpleTime(cleanForMeta(ev.time));

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    url: canonical,
    image: [/^https?:\/\//i.test(String(ev.image || '')) ? ev.image : ogImage],
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
  };

  if (startYmd) ld.startDate = time ? `${startYmd}T${time}` : startYmd;
  if (endYmd && endYmd !== startYmd) ld.endDate = endYmd;

  const address = cleanForMeta(String(ev.address || '').replace(/\(map\)/gi, ' '));
  const place = { '@type': 'Place', name: cleanForMeta(ev.location) || 'See listing' };
  if (address) {
    place.address = Object.assign(
      { '@type': 'PostalAddress', streetAddress: address },
      detectLocality(address)
    );
  }
  ld.location = place;

  // Offers only when the source explicitly published Free — unknown prices
  // are omitted entirely (never a guessed value).
  if (String(ev.price || '').trim().toLowerCase() === 'free') {
    ld.offers = {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      url: canonical,
      availability: isSoldOut(ev)
        ? 'https://schema.org/SoldOut'
        : 'https://schema.org/InStock',
    };
  }

  const desc = cleanForMeta(ev.description);
  if (desc && desc.length >= 40 && !/^event in /i.test(desc)) {
    ld.description = truncate(desc, 300);
  }

  return ld;
}

// Remove the base head tags this function replaces, then inject our block
// immediately after <head> so crawlers meet the event tags first. <base>
// keeps index.html's relative asset URLs working under the /e/* path.
function injectHead(html, headBlock) {
  let out = html;
  out = out.replace(/<title>[\s\S]*?<\/title>\s*/i, '');
  out = out.replace(/[ \t]*<meta[^>]+(?:name|property)=["'](?:description|og:[^"']*|twitter:[^"']*)["'][^>]*>\r?\n?/gi, '');
  out = out.replace(/[ \t]*<link[^>]+rel=["']canonical["'][^>]*>\r?\n?/gi, '');
  if (!/<base\b/i.test(out)) headBlock = '<base href="/">\n' + headBlock;
  return out.replace(/<head([^>]*)>/i, (m, attrs) => `<head${attrs}>\n${headBlock}`);
}

module.exports = async function handler(req, res) {
  let baseHtml;
  try {
    baseHtml = await readFile(join(process.cwd(), 'index.html'), 'utf8');
  } catch (fsErr) {
    console.error('event-page: cannot read index.html', fsErr);
    res.statusCode = 302;
    res.setHeader('Location', '/');
    return res.end();
  }

  try {
    const slug = String((req.query && req.query.slug) || '');
    const idMatch = slug.match(/^(\d+)/);
    if (!idMatch) throw new Error(`unparseable slug: ${slug.slice(0, 40)}`);
    const id = parseInt(idMatch[1], 10);

    const { rows } = await pool.query('SELECT * FROM events WHERE id = $1 LIMIT 1', [id]);
    if (!rows.length) throw new Error(`event ${id} not found`);
    const ev = rows[0];

    const name = truncate(cleanForMeta(ev.name) || 'An evening occasion', 110);
    const date = prettyDate(ev.start_date);
    const venue = truncate(cleanForMeta(ev.location), 60);
    const canonical = `${SITE_ORIGIN}/e/${id}-${slugify(ev.name)}`;
    const ogImage = `${SITE_ORIGIN}/api/og?id=${id}`;

    const title = [name, date, 'Soirée'].filter(Boolean).join(' — ');
    const descBits = [];
    if (date) descBits.push(date);
    const timeStr = cleanForMeta(ev.time);
    if (timeStr && timeStr.length <= 22 && /\d/.test(timeStr)) descBits.push(timeStr);
    if (venue) descBits.push(`at ${venue}`);
    if (String(ev.price || '').trim().toLowerCase() === 'free') descBits.push('Free — as published');
    const ownDesc = cleanForMeta(ev.description);
    const description = truncate(
      (ownDesc && ownDesc.length >= 40 && !/^event in /i.test(ownDesc))
        ? ownDesc
        : `${name} — ${descBits.join(' · ')}. On the Soirée ledger: verified evenings in NYC, Hoboken & Jersey City.`,
      160
    );

    const jsonLd = buildJsonLd(ev, canonical, ogImage);

    const e = escapeHtml;
    const headBlock = [
      `<title>${e(title)}</title>`,
      `<meta name="description" content="${e(description)}">`,
      `<link rel="canonical" href="${e(canonical)}">`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:site_name" content="Soirée">`,
      `<meta property="og:title" content="${e(title)}">`,
      `<meta property="og:description" content="${e(description)}">`,
      `<meta property="og:url" content="${e(canonical)}">`,
      `<meta property="og:image" content="${e(ogImage)}">`,
      `<meta property="og:image:width" content="1200">`,
      `<meta property="og:image:height" content="630">`,
      `<meta property="og:image:type" content="image/png">`,
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${e(title)}">`,
      `<meta name="twitter:description" content="${e(description)}">`,
      `<meta name="twitter:image" content="${e(ogImage)}">`,
      `<script type="application/ld+json">${jsonLdSafe(jsonLd)}</script>`,
      `<script>window.__DEEP_EVENT_ID__=${id};</script>`,
      '',
    ].join('\n');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(injectHead(baseHtml, headBlock));
  } catch (error) {
    console.error('event-page: falling back to plain index.html —', error.message);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(200).send(baseHtml);
  }
};
