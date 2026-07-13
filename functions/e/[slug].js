// /e/:id-slug — server-rendered head for one event (crawlers + link unfurls).
// Cloudflare Pages Function port of api/event-page.js (Vercel rewrite was
// { "source": "/e/(.*)", "destination": "/api/event-page?slug=$1" }; here the
// slug arrives as ctx.params.slug).
//
// Fetches index.html from the deployment's own static assets (ASSETS binding —
// a Pages Function cannot read files from disk), strips the base <title>/
// description/OG/Twitter tags, and injects per-event <title>, meta description,
// canonical, OG/Twitter tags, schema.org/Event JSON-LD, and
// window.__DEEP_EVENT_ID__ so the SPA opens the matching detail sheet on load.
// Any failure -> plain index.html.
//
// Event fields are SCRAPED CONTENT: everything is escaped for its context
// (escapeHtml for HTML/attributes, jsonLdSafe for the JSON-LD script block).
'use strict';

import { Pool } from '@neondatabase/serverless';
import seo from '../../lib/seo.js';

const {
  SITE_ORIGIN, slugify, escapeHtml, jsonLdSafe,
  ymd, prettyDate, cleanForMeta, truncate,
} = seo;

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

  if (startYmd) {
    // Timed events carry an Eastern-time offset so rich results show the
    // correct local time. Approximate US DST by month: Mar–Nov -> EDT
    // (-04:00), else EST (-05:00). (startYmd is YYYY-MM-DD.)
    const mo = parseInt(startYmd.slice(5, 7), 10);
    const etOffset = mo >= 3 && mo <= 11 ? '-04:00' : '-05:00';
    ld.startDate = time ? `${startYmd}T${time}${etOffset}` : startYmd;
  }
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

// Read the SPA's index.html from the deployment's own static assets.
// Pages "pretty URL" handling may 3xx /index.html -> /; follow one hop and
// fall back to fetching / directly, which serves the same document.
async function fetchIndexHtml(ctx) {
  const origin = new URL(ctx.request.url).origin;
  for (const path of ['/index.html', '/']) {
    let resp = await ctx.env.ASSETS.fetch(new Request(new URL(path, origin)));
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get('Location');
      if (loc) resp = await ctx.env.ASSETS.fetch(new Request(new URL(loc, origin)));
    }
    if (resp.ok) return await resp.text();
  }
  throw new Error('ASSETS fetch for index.html failed');
}

export async function onRequest(ctx) {
  let baseHtml;
  try {
    baseHtml = await fetchIndexHtml(ctx);
  } catch (fsErr) {
    console.error('event-page: cannot read index.html', fsErr);
    return new Response(null, { status: 302, headers: { Location: '/' } });
  }

  let pool;
  try {
    const slug = (() => {
      const raw = String((ctx.params && ctx.params.slug) || '');
      try { return decodeURIComponent(raw); } catch { return raw; }
    })();
    const idMatch = slug.match(/^(\d+)/);
    if (!idMatch) throw new Error(`unparseable slug: ${slug.slice(0, 40)}`);
    const id = parseInt(idMatch[1], 10);

    pool = new Pool({ connectionString: ctx.env.POSTGRES_URL });
    const { rows } = await pool.query('SELECT * FROM events WHERE id = $1 LIMIT 1', [id]);
    if (!rows.length) throw new Error(`event ${id} not found`);
    const ev = rows[0];

    const name = truncate(cleanForMeta(ev.name) || 'An evening occasion', 110);
    const date = prettyDate(ev.start_date);
    const venue = truncate(cleanForMeta(ev.location), 60);
    const canonical = `${SITE_ORIGIN}/e/${id}-${slugify(ev.name)}`;
    // OG cards are pre-rendered by the daily Actions scrape to /og-events/
    // (satori is too CPU-heavy for a Pages Function). Origin comes from the
    // live request so staging previews and the real domain both resolve.
    const ogImage = `${new URL(ctx.request.url).origin}/og-events/${id}.png`;

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

    return new Response(injectHead(baseHtml, headBlock), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('event-page: falling back to plain index.html —', error.message);
    return new Response(baseHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300',
      },
    });
  } finally {
    if (pool) ctx.waitUntil(pool.end().catch(() => {}));
  }
}
