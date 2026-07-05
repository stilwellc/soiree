// Shared SEO helpers — slugs and context-correct escaping.
// Event names/descriptions are SCRAPED CONTENT: always escape for the
// context they land in (HTML text, HTML attribute, JSON-LD string, XML).
'use strict';

const SITE_ORIGIN = 'https://soiree.today';

function slugify(name) {
  const s = String(name == null ? '' : name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics: soirée -> soiree
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/, '');
  return s || 'event';
}

// Safe for HTML text nodes AND double/single-quoted attribute values.
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// XML 1.0 — same five entities (&#39; is valid XML for apostrophe).
const escapeXml = escapeHtml;

// Serialize an object for embedding inside <script type="application/ld+json">.
// JSON.stringify handles quote/backslash escaping for the JSON string context;
// we additionally escape <, > and & so scraped strings can never close the
// script element (</script>) or smuggle markup/comments into the HTML parser.
function jsonLdSafe(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

// Format a pg DATE (Date object at local midnight) or 'YYYY-MM-DD' string
// as calendar-date components WITHOUT UTC round-trips (the ET off-by-one bug).
function toCalendarDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return { y: value.getFullYear(), m: value.getMonth() + 1, d: value.getDate() };
  }
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { y: +m[1], m: +m[2], d: +m[3] };
}

function ymd(value) {
  const c = toCalendarDate(value);
  if (!c) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${c.y}-${pad(c.m)}-${pad(c.d)}`;
}

function prettyDate(value) {
  const c = toCalendarDate(value);
  if (!c) return null;
  const dt = new Date(c.y, c.m - 1, c.d); // local, calendar-safe
  return dt.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

// Strip scraper artifacts for display in meta tags. Not the full truth-pass —
// just enough to keep tags honest: sold-out markers, squarespace junk, whitespace.
function cleanForMeta(text) {
  if (!text) return '';
  let s = String(text)
    .replace(/\s*\|\s*sold\s*out\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Truncate at first CSS-junk token
  const junk = s.search(/#block-|@media|\{[^}]*\}/);
  if (junk !== -1) s = s.slice(0, junk).trim();
  return s;
}

function truncate(s, max) {
  if (!s) return s;
  if (s.length <= max) return s;
  return s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

module.exports = {
  SITE_ORIGIN,
  slugify,
  escapeHtml,
  escapeXml,
  jsonLdSafe,
  toCalendarDate,
  ymd,
  prettyDate,
  cleanForMeta,
  truncate,
};
