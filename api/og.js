// /api/og — brand social card as a real PNG (satori + resvg via lib/og-card).
// ?id=<event id> renders a per-event card (title / date · time / venue);
// no id (or any failure looking the event up) renders the sitewide default.
// Replaces the legacy inline SVG that pointed at a retired domain.
'use strict';

const { Pool } = require('pg');
const { renderOgCard } = require('../lib/og-card');
const { cleanForMeta, prettyDate, truncate } = require('../lib/seo');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const DEFAULT_CARD = {
  title: 'The evening, verified.',
  italicTitle: true,
  meta: 'Curated evenings · NYC · Hoboken · Jersey City',
  sub: 'We print what we can verify, and nothing else.',
};

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

// Last-ditch fallback if satori/resvg or font loading blows up: a valid,
// self-contained brand SVG (no external refs) so the tag never 404s.
const FALLBACK_SVG = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
<rect width="1200" height="630" fill="#171009"/>
<rect x="26" y="26" width="1148" height="578" fill="none" stroke="rgba(201,169,106,0.25)" stroke-width="1"/>
<text x="600" y="300" text-anchor="middle" fill="#e6c98d" font-size="88" font-family="Georgia, serif">soir&#233;e</text>
<text x="600" y="370" text-anchor="middle" fill="#8d7c63" font-size="20" letter-spacing="6" font-family="Helvetica, Arial, sans-serif">THE CONCIERGE LEDGER &#183; NEW YORK</text>
</svg>`;

module.exports = async function handler(req, res) {
  try {
    let card = null;

    const rawId = req.query && req.query.id;
    const id = parseInt(rawId, 10);
    if (Number.isInteger(id) && id > 0 && String(id) === String(rawId).trim()) {
      try {
        const { rows } = await pool.query('SELECT * FROM events WHERE id = $1 LIMIT 1', [id]);
        if (rows.length) card = eventCard(rows[0]);
      } catch (dbErr) {
        console.error('og: db lookup failed, using default card', dbErr.message);
      }
    }

    const png = await renderOgCard(card || DEFAULT_CARD);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', card
      ? 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
      : 'public, max-age=86400, s-maxage=86400');
    return res.status(200).send(png);
  } catch (error) {
    console.error('og: render failed, serving fallback SVG', error);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(FALLBACK_SVG);
  }
};
