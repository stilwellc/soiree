/**
 * lib/methods.js — shared METHOD EXTRACTORS for the Soirée venue registry.
 *
 * Each extractor takes ONE config row (see lib/venues.js) and returns an array
 * of normalized event objects produced by the injected `createNormalizedEvent`.
 * Every extractor guarantees a real `start_date` (rows without one are dropped)
 * and a unique `url` (the DB dedupe key).
 *
 * scrape.js owns the reusable primitives (createNormalizedEvent, categorizeEvent,
 * parseDateText, galleryDateRange, galleryEvents, getEventImage, generateHighlights,
 * GALLERY_HEADERS, scrapeWithPuppeteer, CONFIGS). Rather than re-implement or
 * re-export them, scrape.js injects them once via createMethods(deps); this keeps
 * normalization + DB insert untouched and avoids a require cycle.
 */

const axios = require('axios');
const cheerio = require('cheerio');

// ── Per-host politeness: rate-limit + 429/Retry-After backoff ────────────────
// A single shared wrapper used by every axios-based method. Serializes requests
// per host with a minimum gap, and retries on 429/503 honoring Retry-After.
const HOST_MIN_GAP_MS = 900;          // min gap between requests to the same host
const MAX_RETRIES = 3;
const _hostQueues = new Map();        // host -> Promise chain (serializes per host)

function _hostOf(url) {
  try { return new URL(url).host; } catch { return 'unknown'; }
}
function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Schedule fn() on the per-host serial queue so same-host requests never overlap
// and are spaced by at least HOST_MIN_GAP_MS.
function _schedule(host, fn) {
  const prev = _hostQueues.get(host) || Promise.resolve();
  const next = prev.then(async () => {
    await _sleep(HOST_MIN_GAP_MS);
    return fn();
  });
  // keep the chain alive but swallow errors so one failure doesn't poison the host queue
  _hostQueues.set(host, next.catch(() => {}));
  return next;
}

/**
 * politeGet — GALLERY_HEADERS-backed GET with per-host rate limiting and
 * exponential backoff on 429/503 (respects Retry-After). Returns axios response.
 */
function makePoliteGet(GALLERY_HEADERS) {
  return async function politeGet(url, opts = {}) {
    const host = _hostOf(url);
    const { headers: optHeaders, timeout: optTimeout, ...restOpts } = opts;
    const headers = { ...GALLERY_HEADERS, ...(optHeaders || {}) };
    // a null/undefined override deletes that default header (some WAFs 403 the
    // gzip/br + keep-alive fingerprint; a row can strip those keys).
    for (const k of Object.keys(headers)) if (headers[k] == null) delete headers[k];
    const timeout = optTimeout || 12000;
    const config = { ...restOpts, timeout, headers };

    return _schedule(host, async () => {
      let attempt = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          return await axios.get(url, config);
        } catch (err) {
          const status = err.response?.status;
          // 429/503 are transient rate-limits worth retrying; 403 is a hard
          // WAF/block — retrying the identical request never succeeds and just
          // burns the group's 60s budget, so fail fast on it.
          if ((status === 429 || status === 503) && attempt < MAX_RETRIES) {
            const ra = parseInt(err.response?.headers?.['retry-after'], 10);
            const waitMs = (Number.isFinite(ra) ? ra * 1000 : 0) || (1000 * Math.pow(2, attempt));
            console.log(`  [politeGet] ${status} on ${host} — backing off ${waitMs}ms (attempt ${attempt + 1})`);
            await _sleep(Math.min(waitMs, 15000));
            attempt++;
            continue;
          }
          throw err;
        }
      }
    });
  };
}

function makePolitePost(GALLERY_HEADERS) {
  return async function politePost(url, body, opts = {}) {
    const host = _hostOf(url);
    const headers = { ...GALLERY_HEADERS, 'Content-Type': 'application/json', ...(opts.headers || {}) };
    const timeout = opts.timeout || 15000;
    return _schedule(host, async () => {
      let attempt = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          return await axios.post(url, body, { timeout, headers });
        } catch (err) {
          const status = err.response?.status;
          // 429/503 are transient rate-limits worth retrying; 403 is a hard
          // WAF/block — retrying the identical request never succeeds and just
          // burns the group's 60s budget, so fail fast on it.
          if ((status === 429 || status === 503) && attempt < MAX_RETRIES) {
            const ra = parseInt(err.response?.headers?.['retry-after'], 10);
            const waitMs = (Number.isFinite(ra) ? ra * 1000 : 0) || (1000 * Math.pow(2, attempt));
            await _sleep(Math.min(waitMs, 15000));
            attempt++;
            continue;
          }
          throw err;
        }
      }
    });
  };
}

// ── small shared text helpers ────────────────────────────────────────────────
function decodeEntities(s) {
  if (!s) return '';
  return String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/&#8217;|&#x2019;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&ldquo;/g, "“").replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#8211;|&ndash;/g, '–').replace(/&#8212;|&mdash;/g, '—')
    .replace(/&#8230;|&hellip;/g, '…')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\s+/g, ' ').trim();
}

function absUrl(href, base) {
  if (!href) return '';
  if (/^https?:\/\//i.test(href)) return href;
  try { return new URL(href, base).toString(); } catch { return ''; }
}

// Collect a flat list of schema.org objects from any JSON-LD payload
function collectLdNodes(json) {
  const out = [];
  const push = (x) => { if (x && typeof x === 'object') out.push(x); };
  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node !== 'object') return;
    push(node);
    if (node['@graph']) walk(node['@graph']);
    if (node.itemListElement) walk(node.itemListElement);
    if (node.item) walk(node.item);
  };
  walk(json);
  return out;
}

const EVENT_TYPE_RE = /(Event|Exhibition|Screening|Festival|Concert|Theater|VisualArtsEvent|DanceEvent|MusicEvent|ComedyEvent)/i;

// Human date-range matcher shared by html/wp-rest detail modes. Handles:
//   "May 8 - July 24, 2026" | "May 6, 2026 – September 13, 2026" | "6 February - 12 July 2026"
//   "10 Jun – 7 Aug 2026" | single "Through August 9, 2026" | "Opens September 10, 2026"
const MONTHS_RE = 'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';
const DATE_RANGE_RE = new RegExp(
  '(?:' +
    // Month D[th][, YYYY] [– Month D, YYYY]
    `(?:${MONTHS_RE})[\\s.]+\\d{1,2}(?:st|nd|rd|th)?(?:\\s*,?\\s*\\d{4})?` +
    `(?:\\s*[–—\\-]\\s*(?:(?:${MONTHS_RE})[\\s.]+)?\\d{1,2}(?:st|nd|rd|th)?(?:\\s*,?\\s*\\d{4})?)?` +
  ')|(?:' +
    // D Month [– D Month] YYYY   (British / day-first)
    `\\d{1,2}[\\s.]+(?:${MONTHS_RE})` +
    `(?:\\s*[–—\\-]\\s*\\d{1,2}[\\s.]+(?:${MONTHS_RE}))?(?:\\s+\\d{4})?` +
  ')', 'i'
);
// Single "Through/On View/Opens <Month D, YYYY>" for one-sided listings.
const THROUGH_RE = new RegExp(`(?:Through|On View|Opens)[^.|]{0,45}(?:${MONTHS_RE})[\\s.]+\\d{1,2},?\\s*\\d{4}`, 'i');

/**
 * createMethods(deps) — returns { METHODS, politeGet } bound to scrape.js's
 * shared primitives. deps must provide:
 *   createNormalizedEvent, categorizeEvent, parseDateText, galleryDateRange,
 *   galleryEvents, getEventImage, generateHighlights, GALLERY_HEADERS,
 *   scrapeWithPuppeteer, CONFIGS
 */
function createMethods(deps) {
  const {
    createNormalizedEvent, categorizeEvent, parseDateText, galleryDateRange,
    galleryEvents, getEventImage, generateHighlights, GALLERY_HEADERS,
    scrapeWithPuppeteer, CONFIGS,
  } = deps;
  // Optional: normalize oversized CDN image URLs (Squarespace/Whitney/Unsplash).
  // Falls back to identity if the host didn't inject one.
  const normalizeImageUrl = deps.normalizeImageUrl || ((u) => u);

  const politeGet = makePoliteGet(GALLERY_HEADERS);
  const politePost = makePolitePost(GALLERY_HEADERS);

  // Resolve common config fields with sensible defaults.
  function meta(cfg) {
    const base = cfg.base || new URL(cfg.url).origin;
    const location = cfg.location || cfg.name;
    const address = cfg.address || location;
    const source = cfg.name;
    // museums/galleries/parks default to free entry; ticketed venues → See details
    const defaultPrice = /^(museums|galleries|perfparks)$/.test(cfg.group || '') ? 'free' : 'See details';
    const price = cfg.price || defaultPrice;
    return { base, location, address, source, price };
  }

  // Build one normalized event from resolved parts (shared tail for most methods)
  function build(cfg, { name, description, dateText, start_date, end_date, url, category, event_type, image, time }) {
    const m = meta(cfg);
    const cleanName = decodeEntities(name);
    if (!cleanName || cleanName.length < 5) return null;
    const desc = decodeEntities(description) || `${cleanName} at ${m.source}.`;
    const cat = cfg.category || category || categorizeEvent(cleanName, desc, m.location);
    return createNormalizedEvent({
      name: cleanName,
      category: cat,
      date: dateText || 'Upcoming',
      time: time || 'See details',
      start_date,
      end_date: end_date || start_date,
      location: m.location,
      address: m.address,
      price: m.price,
      spots: Math.floor(Math.random() * 120) + 30,
      image: normalizeImageUrl(image) || getEventImage(cleanName, cat),
      description: desc,
      highlights: generateHighlights(cleanName, desc, cat, m.location, m.source),
      url,
      source: m.source,
      event_type: event_type || cfg.event_type || null,
    });
  }

  // Project a display time out of an ISO datetime that carries a time component
  // (e.g. "2026-07-15T19:30:00-04:00" → "7:30 PM"). Date-only ISO ("2026-07-15")
  // or midnight (all-day) returns '' so the 'See details' default stands.
  function timeFromIso(iso) {
    if (!iso || typeof iso !== 'string') return '';
    if (!/T\d{2}:\d{2}/.test(iso)) return '';        // date-only → no time
    const m = iso.match(/T(\d{2}):(\d{2})/);
    if (!m) return '';
    let h = parseInt(m[1], 10);
    const min = m[2];
    if (h === 0 && min === '00') return '';           // midnight → treat as all-day
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return `${h}:${min} ${ampm}`;
  }

  // Parse a schema.org Event-ish LD node into a normalized event
  function eventFromLd(cfg, item) {
    const m = meta(cfg);
    const type = Array.isArray(item['@type']) ? item['@type'].join(' ') : (item['@type'] || '');
    if (!EVENT_TYPE_RE.test(type)) return null;
    const name = (item.name || '').toString().trim();
    if (!name) return null;
    const url = absUrl((item.url || item['@id'] || '').toString().trim(), m.base);
    if (!url) return null;
    // location filter (NY-only multi-city)
    if (cfg.locationFilter) {
      const locName = item.location?.name || item.location?.address?.addressLocality || '';
      const locStr = typeof item.location === 'string' ? item.location : locName;
      if (locStr && !cfg.locationFilter.test(locStr)) return null;
    }
    const isExhibition = /Exhibition/i.test(type);
    let start_date, end_date, dateText;
    if (isExhibition && (item.startDate || item.endDate)) {
      const s = parseDateText(item.startDate || '', '');
      const e = parseDateText(item.endDate || '', '');
      start_date = s.start_date;
      end_date = e.start_date || start_date;
      dateText = item.startDate || '';
    } else {
      const s = parseDateText(item.startDate || '', '');
      start_date = s.start_date;
      const e = parseDateText(item.endDate || '', '');
      end_date = e.start_date || start_date;
      dateText = item.startDate || '';
    }
    if (!start_date) return null;
    // offers price → free/See details
    let price = null;
    const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
    if (offer && (offer.price === '0' || offer.price === 0 || /free/i.test(offer.name || ''))) price = 'free';
    // Project the time out of the ISO startDate for timed events (concerts,
    // screenings); exhibitions span months so a start time is meaningless there.
    const time = isExhibition ? '' : timeFromIso(item.startDate || '');
    const built = build(cfg, {
      name,
      description: item.description || '',
      dateText,
      start_date,
      end_date,
      url,
      time,
      event_type: isExhibition ? 'exhibition' : null,
      image: (typeof item.image === 'string' ? item.image : item.image?.url) || null,
    });
    if (built && price) built.price = price;
    return built;
  }

  // Pull all JSON-LD nodes out of an HTML doc
  function ldNodesFromHtml($) {
    const nodes = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      let raw = $(el).contents().text() || $(el).html() || '';
      if (!raw.trim()) return;
      try { nodes.push(...collectLdNodes(JSON.parse(raw))); }
      catch {
        // some sites emit multiple concatenated objects or trailing commas; try a lenient split
        try { nodes.push(...collectLdNodes(JSON.parse(raw.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')))); } catch {}
      }
    });
    return nodes;
  }

  // ── METHOD: jsonld ─────────────────────────────────────────────────────────
  // GET url, parse inline schema.org Event arrays (incl. ItemList + @graph).
  async function jsonld(cfg) {
    try {
      const res = await politeGet(cfg.url, { timeout: cfg.timeout || 12000, headers: cfg.headers });
      const $ = cheerio.load(res.data);
      const nodes = ldNodesFromHtml($);
      const events = [];
      const seen = new Set();
      for (const node of nodes) {
        const ev = eventFromLd(cfg, node);
        if (ev && !seen.has(ev.url)) { seen.add(ev.url); events.push(ev); }
        if (events.length >= (cfg.limit || 40)) break;
      }
      return events;
    } catch (e) {
      console.error(`[jsonld] ${cfg.name} failed:`, e.message);
      return [];
    }
  }

  // ── METHOD: listing-jsonld ───────────────────────────────────────────────
  // GET listing → collect linkSel anchors → fetch each detail → read its Event LD.
  async function listingJsonld(cfg) {
    try {
      const m = meta(cfg);
      const listUrls = Array.isArray(cfg.url) ? cfg.url : [cfg.url];
      const detailUrls = new Set();
      for (const lu of listUrls) {
        try {
          const res = await politeGet(lu, { timeout: cfg.timeout || 12000, headers: cfg.headers });
          const $ = cheerio.load(res.data);
          const sel = cfg.linkSel || 'a[href^="/events/"]';
          $(sel).each((_, el) => {
            const href = $(el).attr('href');
            const u = absUrl(href, m.base);
            if (!u) return;
            if (cfg.excludeLink && cfg.excludeLink.test(u)) return;
            detailUrls.add(u.split('#')[0]);
          });
        } catch (e) {
          console.error(`[listing-jsonld] ${cfg.name} listing ${lu} failed:`, e.message);
        }
      }
      const capped = [...detailUrls].slice(0, cfg.maxDetails || 30);
      const results = await Promise.allSettled(capped.map(async (u) => {
        const dres = await politeGet(u, { timeout: 10000, headers: cfg.headers });
        const $$ = cheerio.load(dres.data);
        const nodes = ldNodesFromHtml($$);
        for (const node of nodes) {
          // force the detail URL as the canonical url (LD @id may differ)
          const ev = eventFromLd({ ...cfg }, { ...node, url: node.url || u });
          if (ev) { ev.url = u; return ev; }
        }
        return null;
      }));
      const events = [];
      const seen = new Set();
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value && !seen.has(r.value.url)) {
          seen.add(r.value.url); events.push(r.value);
        }
      }
      return events;
    } catch (e) {
      console.error(`[listing-jsonld] ${cfg.name} failed:`, e.message);
      return [];
    }
  }

  // A yearless "Fri Jul 10" / "July 3" gets the current year appended so
  // parseDateText resolves it exactly instead of rolling today→next-year. Near
  // year-end (Nov/Dec listing Jan dates) bump to next year.
  function withYear(raw) {
    if (!raw) return raw;
    if (/\b(19|20)\d{2}\b/.test(raw)) return raw;              // already has a year
    if (!new RegExp(MONTHS_RE, 'i').test(raw)) return raw;      // not a month-name date
    const now = new Date();
    let year = now.getUTCFullYear();
    const monthM = raw.match(new RegExp(MONTHS_RE, 'i'));
    if (monthM) {
      const mi = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
        .indexOf(monthM[0].slice(0, 3).toLowerCase());
      if (mi >= 0 && now.getUTCMonth() >= 9 && mi <= 2) year += 1; // Oct+ listing early-year dates
    }
    return `${raw.trim()}, ${year}`;
  }

  // Pull a date range out of free text: prefer a Month-D..Month-D range, then a
  // "Through/Opens <date>" single, then a bare range. Returns {start_date,end_date,dateText}.
  function dateFromText(text) {
    if (!text) return { start_date: null, end_date: null, dateText: '' };
    // strip ordinal suffixes (20th → 20) so galleryDateRange/parseDateText read the day
    const clean = text.replace(/(\d{1,2})(?:st|nd|rd|th)\b/gi, '$1').replace(/\s+/g, ' ').trim();
    let mm = clean.match(DATE_RANGE_RE);
    if (mm) {
      const r = galleryDateRange(mm[0].trim());
      if (r.start_date) return { start_date: r.start_date, end_date: r.end_date, dateText: mm[0].trim() };
    }
    const tm = clean.match(THROUGH_RE);
    if (tm) {
      const p = parseDateText(tm[0], '');
      if (p.start_date) return { start_date: p.start_date, end_date: p.end_date, dateText: tm[0].trim() };
    }
    return { start_date: null, end_date: null, dateText: '' };
  }

  // ── METHOD: html ──────────────────────────────────────────────────────────
  // GET url, iterate itemSel (or linkSel anchors), pull title/date, resolve href.
  // dateFromSlug: regex capturing YYYY, MM, DD from href to build the date.
  // dateRangeText: read a Month-D..Month-D range out of the item/anchor text.
  // precedingHeaderSel: date lives on the nearest preceding header (e.g. h3 day rows).
  // dateAttr / dateAttrJson: date sits in a data-* attribute (optionally JSON, take [0]).
  // fetchDetail: fetch each detail page to resolve title (detailTitleSel) and/or the
  //   date (detailJsonld reads Event startDate; otherwise DATE_RANGE_RE on the body).
  async function html(cfg) {
    try {
      const m = meta(cfg);
      const res = await politeGet(cfg.url, { timeout: cfg.timeout || 12000, headers: cfg.headers });
      const $ = cheerio.load(res.data);
      const events = [];
      const seen = new Set();
      const cap = cfg.limit || 40;
      // collected {url, title, container-text} for an optional detail-fetch pass
      const pending = [];

      // dateHeader mode: items are grouped under date-header rows (e.g. The Local
      // Girl calendar). Walk the list children in order, tracking the current date
      // from each header's data-date attribute, and emit each item under it.
      if (cfg.dateHeaderList) {
        let currentIso = null;
        $(cfg.dateHeaderList).children().each((_, el) => {
          if (events.length >= cap) return false;
          const $c = $(el);
          const cls = $c.attr('class') || '';
          if (cfg.dateHeaderClass && cls.includes(cfg.dateHeaderClass)) {
            const dd = $c.find('[data-date]').attr('data-date') || $c.find('time[datetime]').attr('datetime') || '';
            const isoM = dd.match(/(\d{4}-\d{2}-\d{2})/);
            if (isoM) currentIso = isoM[1];
            return;
          }
          if (cfg.itemClass && !cls.includes(cfg.itemClass)) return;
          if (!currentIso) return;
          const $a = $c.find(cfg.titleSel ? `${cfg.titleSel} a, ${cfg.titleSel}` : 'a').first();
          const href = $a.attr('href');
          const url = absUrl(href, m.base);
          if (!url || seen.has(url)) return;
          const title = ($c.find(cfg.titleSel || 'h2 a').first().text() || $a.text()).trim();
          if (!title || title.length < 5) return;
          if (cfg.locationFilter && !cfg.locationFilter.test($c.text())) return;
          const parsed = parseDateText(currentIso, '');
          if (!parsed.start_date) return;
          seen.add(url);
          const ev = build(cfg, { name: title, description: '', dateText: currentIso, start_date: parsed.start_date, end_date: parsed.end_date, url });
          if (ev) events.push(ev);
        });
        return events;
      }

      const iterSel = cfg.itemSel || cfg.linkSel;
      if (!iterSel) return [];

      // precedingHeaderSel: a flat list where each item's date is the nearest
      // header BEFORE it in document order.
      const headerList = cfg.precedingHeaderSel ? true : null;

      $(iterSel).each((_, el) => {
        if (events.length >= cap && !cfg.fetchDetail) return false;
        if (pending.length >= cap) return false;
        const $el = $(el);
        // find the anchor + href. Prefer, in order: an anchor inside titleSel,
        // an anchor matching the slug-date pattern, then the first anchor.
        let $a;
        if ($el.is('a')) $a = $el;
        else {
          if (cfg.titleSel) $a = $el.find(cfg.titleSel).find('a').first();
          if ((!$a || !$a.length) && cfg.linkSel) $a = $el.find(cfg.linkSel).first();
          if ((!$a || !$a.length) && cfg.dateFromSlug) {
            $a = $el.find('a').filter((_, a) => cfg.dateFromSlug.test($(a).attr('href') || '')).first();
          }
          if (!$a || !$a.length) $a = $el.find('a').first();
        }
        let href = $a.attr('href');
        if (!href && $el.is('a')) href = $el.attr('href');
        const url = (absUrl(href, m.base) || '').split('#')[0] + (cfg.keepHash && href && href.includes('#') ? '#' + href.split('#')[1] : '');
        if (!url || seen.has(url)) return;
        if (cfg.linkRe && !cfg.linkRe.test(href || '')) return;
        if (cfg.excludeLink && cfg.excludeLink.test(url)) return;

        // title
        let title = '';
        if (cfg.titleSel) title = $el.find(cfg.titleSel).first().text().trim();
        if (!title && !$el.is('a')) title = ($el.find('h1,h2,h3,h4').first().text().trim());
        if (!title) title = ($a.attr('aria-label') || $a.text() || '').replace(/\s+/g, ' ').trim();
        if (cfg.stripTitleRe && title) title = title.replace(cfg.stripTitleRe, '').trim();
        // when fetching detail for the title we tolerate a weak/empty listing title
        if ((!title || title.length < 5) && !cfg.detailTitleSel) return;

        // location filter against container text
        if (cfg.locationFilter && !cfg.locationFilter.test($el.text())) return;

        // date resolution
        let start_date = null, end_date = null, dateText = '';
        if (cfg.dateFromSlug) {
          const mm = (href || url).match(cfg.dateFromSlug);
          if (mm) {
            // Two shapes: [YYYY,MM,DD] numeric slug, or [MonthName, DD] slug.
            let raw;
            if (/^\d{4}$/.test(mm[1])) raw = `${mm[1]}-${mm[2]}-${mm[3]}`;
            else raw = withYear(`${mm[1]} ${mm[2]}`);
            const parsed = parseDateText(raw, '');
            start_date = parsed.start_date; end_date = parsed.end_date; dateText = raw;
          }
        }
        if (!start_date && cfg.dateAttr) {
          let raw = ($el.attr(cfg.dateAttr) || $el.find(`[${cfg.dateAttr}]`).first().attr(cfg.dateAttr) || '').trim();
          if (raw && cfg.dateAttrJson) {
            try { const arr = JSON.parse(raw); raw = Array.isArray(arr) ? String(arr[0] || '') : String(arr); } catch {}
          }
          if (raw) {
            const iso = /^\d{8}$/.test(raw) ? `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}` : withYear(raw);
            const p = parseDateText(iso, '');
            start_date = p.start_date; end_date = p.end_date; dateText = raw;
          }
        }
        if (!start_date && cfg.dateSel) {
          const $d = $el.find(cfg.dateSel).first();
          const raw = ($d.attr('datetime') || $d.text() || '').trim();
          if (raw) {
            if (cfg.dateRange) {
              const r = galleryDateRange(raw);
              start_date = r.start_date; end_date = r.end_date;
            } else {
              const p = parseDateText(withYear(raw), '');
              start_date = p.start_date; end_date = p.end_date;
            }
            dateText = raw;
          }
        }
        if (!start_date && headerList) {
          // nearest preceding header in document order (index-based scan)
          let hdr = null;
          const allEls = $(`${cfg.precedingHeaderSel}, ${iterSel}`).toArray();
          const myIdx = allEls.indexOf($el.get(0));
          for (let j = myIdx - 1; j >= 0; j--) {
            if ($(allEls[j]).is(cfg.precedingHeaderSel)) { hdr = $(allEls[j]).text().trim(); break; }
          }
          if (hdr) {
            const timeM = $el.text().match(/\d{1,2}:\d{2}\s*[AP]M/i);
            const p = parseDateText(withYear(hdr), timeM ? timeM[0] : '');
            start_date = p.start_date; end_date = p.end_date; dateText = hdr;
          }
        }
        if (!start_date && (cfg.dateRangeText || cfg.dateRange)) {
          const r = dateFromText($el.text());
          start_date = r.start_date; end_date = r.end_date; dateText = r.dateText;
        }

        // A listing "title" that is really just a date/time string is not a title.
        const titleIsDate = title && (DATE_RANGE_RE.test(title) || /^\s*(?:mon|tue|wed|thu|fri|sat|sun)/i.test(title)) && title.replace(DATE_RANGE_RE, '').replace(/[\d\s,:apm.–—-]/gi, '').length < 3;
        const weakTitle = !title || title.length < 5 || titleIsDate;
        // If we still lack a date (or a real title) and detail-fetch is enabled, defer.
        if ((!start_date || (cfg.detailTitleSel && weakTitle)) && cfg.fetchDetail) {
          seen.add(url);
          pending.push({ url, title, start_date, end_date, dateText });
          return;
        }
        if (!start_date) return;

        // For anchor-as-card galleries the date range (and address) live inside the
        // title text — strip the matched range + trailing city/address noise.
        if (cfg.dateRangeText && title) {
          if (dateText) title = title.replace(dateText, ' ');
          title = title
            .replace(DATE_RANGE_RE, ' ')
            .replace(/\d{2,5}\s+(?:[A-Z][\w'.]*\s+)*?(?:Street|Avenue|Boulevard|Alley|Broadway|St|Ave|Blvd|Rd)\b[^|]*$/i, ' ')
            .replace(/\|\s*(?:new york|mexico city|hudson[, ]*new york)[^|]*/i, ' ')
            // anchor text jams lines together with no separator — re-insert spaces
            // at word→number and lower→Upper boundaries (e.g. "Liz GlynnAmerican")
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/([A-Za-z])(\d)/g, '$1 $2')
            .replace(/\s+/g, ' ').replace(/[\s,;.\-–—]+$/, '').trim();
          // if a subtitle got glued on, keep the leading clause up to a sensible length
          if (title.length > 90) title = title.slice(0, 90).replace(/\s+\S*$/, '').trim();
        }
        if (!title || title.length < 5) return;

        seen.add(url);
        const ev = build(cfg, { name: title, description: '', dateText, start_date, end_date, url });
        if (ev) events.push(ev);
      });

      // ── optional detail-fetch pass: resolve title/date from each detail page ──
      if (cfg.fetchDetail && pending.length) {
        const capped = pending.slice(0, cfg.maxDetails || 25);
        const dres = await Promise.allSettled(capped.map(async (p) => {
          const r = await politeGet(p.url, { timeout: 10000, headers: cfg.headers });
          const $$ = cheerio.load(r.data);
          let title = p.title;
          if (cfg.detailTitleSel) {
            let t = $$(cfg.detailTitleSel).first().text().replace(/\s+/g, ' ').trim();
            if (!t) t = $$('title').text().trim();
            // page-<title> tags carry a "| Site" / "– Site" suffix — drop it
            if (cfg.detailTitleSel === 'title' || /\s[|–—]\s/.test(t)) t = t.split(/\s[|–—]\s|\s-\s/)[0].trim();
            if (t && t.length >= 3) title = t;
          }
          let { start_date, end_date, dateText } = p;
          // detailDateSel: date sits in a specific element ('Fri Jul 10' style)
          if (!start_date && cfg.detailDateSel) {
            const raw = $$(cfg.detailDateSel).first().text().replace(/\s+/g, ' ').trim();
            if (raw) { const q = parseDateText(withYear(raw), ''); if (q.start_date) { start_date = q.start_date; end_date = q.end_date; dateText = raw; } }
          }
          if (!start_date && cfg.detailJsonld) {
            const nodes = ldNodesFromHtml($$);
            for (const node of nodes) {
              const type = Array.isArray(node['@type']) ? node['@type'].join(' ') : (node['@type'] || '');
              if (EVENT_TYPE_RE.test(type) && node.startDate) {
                const s = parseDateText(node.startDate, '');
                if (s.start_date) { start_date = s.start_date; const e = parseDateText(node.endDate || '', ''); end_date = e.start_date || s.start_date; dateText = node.startDate; break; }
              }
            }
          }
          if (!start_date && !cfg.detailDateSel) {
            const body = $$('body').text().replace(/\s+/g, ' ');
            const r2 = dateFromText(body);
            start_date = r2.start_date; end_date = r2.end_date; dateText = r2.dateText;
          }
          if (!start_date || !title || title.length < 5) return null;
          return build(cfg, { name: title, description: '', dateText, start_date, end_date, url: p.url });
        }));
        for (const r of dres) {
          if (r.status === 'fulfilled' && r.value && events.length < cap) events.push(r.value);
        }
      }
      return events;
    } catch (e) {
      console.error(`[html] ${cfg.name} failed:`, e.message);
      return [];
    }
  }

  // ── METHOD: tribe ─────────────────────────────────────────────────────────
  // GET /wp-json/tribe/events/v1/events → events[] {title,start_date,url,venue}
  async function tribe(cfg) {
    try {
      const m = meta(cfg);
      const url = cfg.url.includes('/wp-json/')
        ? cfg.url
        : cfg.url.replace(/\/$/, '') + '/wp-json/tribe/events/v1/events?per_page=50';
      const res = await politeGet(url, { timeout: cfg.timeout || 12000, headers: cfg.headers });
      const list = res.data?.events || [];
      const events = [];
      const seen = new Set();
      for (const it of list) {
        if (events.length >= (cfg.limit || 40)) break;
        const link = (it.url || it.website || '').trim();
        if (!link || seen.has(link)) continue;
        const startRaw = it.start_date || it.start_date_details?.year && `${it.start_date_details.year}-${it.start_date_details.month}-${it.start_date_details.day}`;
        const { start_date } = parseDateText(startRaw || '', '');
        if (!start_date) continue;
        const { start_date: end_date } = parseDateText(it.end_date || startRaw || '', '');
        if (cfg.locationFilter) {
          const vn = it.venue?.venue || it.venue?.city || '';
          if (vn && !cfg.locationFilter.test(vn)) continue;
        }
        seen.add(link);
        const ev = build(cfg, {
          name: it.title || '',
          description: it.excerpt || it.description || '',
          dateText: startRaw,
          start_date, end_date,
          url: link,
          image: it.image?.url || null,
        });
        if (ev) events.push(ev);
      }
      return events;
    } catch (e) {
      console.error(`[tribe] ${cfg.name} failed:`, e.message);
      return [];
    }
  }

  // ── METHOD: wp-rest ───────────────────────────────────────────────────────
  // GET /wp-json/wp/v2/<cpt>?per_page=50&_embed → map title.rendered/link, then
  // resolve a date from (in priority order):
  //   metaDate      — meta key holding a Unix ts (seconds), *1000 → ISO (+metaEndDate)
  //   acfDate       — acf key holding "YYYYMMDD" or ISO (+acfTime like "10:00 am")
  //   event_date/event_month ISO-named taxonomy terms (via _embed)
  //   yoastDate:true— parse the FIRST "Month D[ at ..]" from yoast og_description,
  //                   inferring the YEAR from the post's `date` (yearless feeds)
  //   detailDate:true — fetch each `link`; read Event JSON-LD startDate (detailJsonld)
  //                   or DATE_RANGE_RE on the detail body (museum exhibitions)
  // statusField/statusOk: skip items whose acf[statusField] !== statusOk.
  async function wpRest(cfg) {
    try {
      const m = meta(cfg);
      const url = cfg.url.includes('/wp-json/')
        ? cfg.url
        : `${m.base}/wp-json/wp/v2/${cfg.cpt}?per_page=50&_embed`;
      const res = await politeGet(url, { timeout: cfg.timeout || 15000, headers: cfg.headers });
      const list = Array.isArray(res.data) ? res.data : [];
      const events = [];
      const seen = new Set();
      const detailPending = [];
      const evType = cfg.event_type || (/exhibition/i.test(cfg.cpt || '') ? 'exhibition' : null);

      for (const it of list) {
        if (events.length + detailPending.length >= (cfg.limit || 30)) break;
        const link = (it.link || '').trim();
        if (!link || seen.has(link)) continue;
        const title = it.title?.rendered || it.title || '';
        if (cfg.statusField && it.acf && it.acf[cfg.statusField] && cfg.statusOk && it.acf[cfg.statusField] !== cfg.statusOk) continue;

        let dateStr = '', start_date = null, end_date = null;

        // 1) meta Unix timestamp (seconds)
        if (cfg.metaDate && it.meta && it.meta[cfg.metaDate]) {
          const ts = parseInt(it.meta[cfg.metaDate], 10);
          if (Number.isFinite(ts) && ts > 0) {
            start_date = new Date(ts * 1000).toISOString().split('T')[0];
            dateStr = start_date;
            const ets = cfg.metaEndDate && it.meta[cfg.metaEndDate] ? parseInt(it.meta[cfg.metaEndDate], 10) : null;
            end_date = (Number.isFinite(ets) && ets > 0) ? new Date(ets * 1000).toISOString().split('T')[0] : start_date;
          }
        }
        // 2) ACF field ("YYYYMMDD" or ISO); optional time
        if (!start_date && cfg.acfDate && it.acf && it.acf[cfg.acfDate]) {
          let raw = String(it.acf[cfg.acfDate]);
          if (/^\d{8}$/.test(raw)) raw = `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
          const p = parseDateText(raw, '');
          start_date = p.start_date; end_date = p.end_date; dateStr = raw;
        }
        // 3) ISO-named date taxonomy terms
        if (!start_date) {
          const terms = (it._embedded?.['wp:term'] || []).flat();
          const dateTerm = terms.find(t => /event_date/.test(t.taxonomy) && /^\d{4}-\d{2}-\d{2}/.test(t.name));
          const monthTerm = terms.find(t => /event_month/.test(t.taxonomy) && /^\d{4}-\d{2}/.test(t.name));
          if (dateTerm) dateStr = dateTerm.name;
          else if (monthTerm) dateStr = monthTerm.name + '-01';
          if (dateStr) { const p = parseDateText(dateStr, ''); start_date = p.start_date; end_date = p.end_date; }
        }
        // 4) yoast og_description yearless first-date
        if (!start_date && cfg.yoastDate) {
          const og = it.yoast_head_json?.og_description || '';
          const mm = og.match(new RegExp(`(${MONTHS_RE})\\s+(\\d{1,2})`, 'i'));
          if (mm) {
            const postYear = (it.date || '').slice(0, 4) || String(new Date().getFullYear());
            const p = parseDateText(`${mm[1]} ${mm[2]}, ${postYear}`, '');
            // if that date already passed, roll to next year
            if (p.start_date && p.start_date < new Date().toISOString().split('T')[0]) {
              const p2 = parseDateText(`${mm[1]} ${mm[2]}, ${parseInt(postYear) + 1}`, '');
              start_date = p2.start_date || p.start_date;
            } else start_date = p.start_date;
            end_date = start_date; dateStr = `${mm[1]} ${mm[2]}`;
          }
        }

        // 5) detail-fetch (defer)
        if (!start_date && cfg.detailDate) {
          seen.add(link);
          detailPending.push({ link, title });
          continue;
        }
        if (!start_date) continue;   // require a real date

        seen.add(link);
        const ev = build(cfg, {
          name: title,
          description: (it.excerpt?.rendered || '').replace(/<[^>]+>/g, ' '),
          dateText: dateStr,
          start_date, end_date,
          url: link,
          event_type: evType,
        });
        if (ev) events.push(ev);
      }

      // detail-fetch pass for museum exhibitions (date on detail page only)
      if (cfg.detailDate && detailPending.length) {
        const capped = detailPending.slice(0, cfg.maxDetails || 25);
        const dres = await Promise.allSettled(capped.map(async (p) => {
          const r = await politeGet(p.link, { timeout: 10000, headers: cfg.headers });
          const $$ = cheerio.load(r.data);
          let start_date = null, end_date = null, dateText = '';
          if (cfg.detailJsonld) {
            const nodes = ldNodesFromHtml($$);
            for (const node of nodes) {
              const type = Array.isArray(node['@type']) ? node['@type'].join(' ') : (node['@type'] || '');
              if (EVENT_TYPE_RE.test(type) && node.startDate) {
                const s = parseDateText(node.startDate, '');
                if (s.start_date) { start_date = s.start_date; const e = parseDateText(node.endDate || '', ''); end_date = e.start_date || s.start_date; dateText = node.startDate; break; }
              }
            }
          }
          if (!start_date) {
            const body = decodeEntities($$('body').html() || $$('body').text() || '');
            const mm = body.match(DATE_RANGE_RE) || body.match(THROUGH_RE);
            if (mm) { const gr = galleryDateRange(mm[0].trim()); start_date = gr.start_date; end_date = gr.end_date; dateText = mm[0].trim(); }
          }
          if (!start_date) return null;
          return build(cfg, {
            name: p.title, description: '', dateText, start_date, end_date,
            url: p.link, event_type: evType,
          });
        }));
        for (const r of dres) {
          if (r.status === 'fulfilled' && r.value && events.length < (cfg.limit || 30)) events.push(r.value);
        }
      }
      return events;
    } catch (e) {
      console.error(`[wp-rest] ${cfg.name} failed:`, e.message);
      return [];
    }
  }

  // ── METHOD: squarespace ───────────────────────────────────────────────────
  // GET <collection-url>?format=json → items[] {startDate(ms), title, fullUrl}
  async function squarespace(cfg) {
    try {
      const m = meta(cfg);
      const url = cfg.url.includes('format=json') ? cfg.url : cfg.url + (cfg.url.includes('?') ? '&' : '?') + 'format=json';
      const res = await politeGet(url, { timeout: cfg.timeout || 12000, headers: cfg.headers });
      // Event collections split into upcoming[]/past[]; article/page collections use items[].
      const items = (res.data?.upcoming?.length ? res.data.upcoming : res.data?.items) || [];
      const events = [];
      const seen = new Set();
      for (const it of items) {
        if (events.length >= (cfg.limit || 40)) break;
        const link = absUrl(it.fullUrl || '', m.base);
        if (!link || seen.has(link)) continue;
        const ms = it.startDate || it.structuredContent?.startDate;
        if (!ms) continue;
        const iso = new Date(ms).toISOString().split('T')[0];
        const p = parseDateText(iso, '');
        if (!p.start_date) continue;
        const endMs = it.endDate || it.structuredContent?.endDate;
        const end_date = endMs ? new Date(endMs).toISOString().split('T')[0] : p.start_date;
        seen.add(link);
        const ev = build(cfg, {
          name: it.title || '',
          description: (it.excerpt || it.body || '').replace(/<[^>]+>/g, ' '),
          dateText: iso, start_date: p.start_date, end_date,
          url: link,
          image: it.assetUrl || null,
        });
        if (ev) events.push(ev);
      }
      return events;
    } catch (e) {
      console.error(`[squarespace] ${cfg.name} failed:`, e.message);
      return [];
    }
  }

  // ── METHOD: shopify ───────────────────────────────────────────────────────
  // GET /collections/<c>/products.json → products[]; date parsed from title/handle.
  async function shopify(cfg) {
    try {
      const m = meta(cfg);
      const url = cfg.url.includes('products.json') ? cfg.url : cfg.url.replace(/\/$/, '') + '/products.json';
      const res = await politeGet(url, { timeout: cfg.timeout || 12000, headers: cfg.headers });
      const products = res.data?.products || [];
      const events = [];
      const seen = new Set();
      const handleBase = cfg.productBase || (m.base + '/products/');
      for (const p of products) {
        if (events.length >= (cfg.limit || 40)) break;
        const title = p.title || '';
        const link = handleBase + (p.handle || '');
        if (seen.has(link)) continue;
        // date usually embedded in the title or handle
        const src = `${title} ${p.handle || ''}`;
        const parsed = parseDateText(title, '');
        let start_date = parsed.start_date;
        if (!start_date) {
          const mm = src.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
          if (mm) start_date = parseDateText(`${mm[1]}-${String(mm[2]).padStart(2, '0')}-${String(mm[3]).padStart(2, '0')}`, '').start_date;
        }
        if (!start_date) continue;
        seen.add(link);
        const ev = build(cfg, {
          name: title,
          description: (p.body_html || '').replace(/<[^>]+>/g, ' '),
          dateText: title, start_date, end_date: start_date,
          url: link,
          image: p.images?.[0]?.src || null,
        });
        if (ev) events.push(ev);
      }
      return events;
    } catch (e) {
      console.error(`[shopify] ${cfg.name} failed:`, e.message);
      return [];
    }
  }

  // ── METHOD: graphql ───────────────────────────────────────────────────────
  // POST a small query → nodes with title/uri/startDate/endDate. cfg.queries is
  // an array of { query, root } where root names the field holding {nodes}.
  async function graphql(cfg) {
    try {
      const m = meta(cfg);
      const queries = cfg.queries || [{ query: cfg.query, root: cfg.root }];
      const events = [];
      const seen = new Set();
      for (const q of queries) {
        let data;
        try {
          const res = await politePost(cfg.url, { query: q.query }, { timeout: cfg.timeout || 15000 });
          data = res.data?.data;
        } catch (e) {
          console.error(`[graphql] ${cfg.name} query(${q.root}) failed:`, e.message);
          continue;
        }
        const nodes = data?.[q.root]?.nodes || [];
        const isExh = /exhibition/i.test(q.root);
        for (const n of nodes) {
          if (events.length >= (cfg.limit || 40)) break;
          const link = absUrl(n.uri || n.url || '', m.base);
          if (!link || seen.has(link)) continue;
          const p = parseDateText(n.startDate || '', '');
          if (!p.start_date) continue;
          const e = parseDateText(n.endDate || '', '');
          seen.add(link);
          const ev = build(cfg, {
            name: n.title || '',
            description: '',
            dateText: n.startDate || '',
            start_date: p.start_date,
            end_date: e.start_date || p.start_date,
            url: link,
            event_type: isExh ? 'exhibition' : null,
          });
          if (ev) events.push(ev);
        }
      }
      return events;
    } catch (e) {
      console.error(`[graphql] ${cfg.name} failed:`, e.message);
      return [];
    }
  }

  // ── METHOD: puppeteer ─────────────────────────────────────────────────────
  // Delegate to the existing renderer via CONFIGS[configKey]; keep only dated.
  async function puppeteer(cfg) {
    try {
      const conf = CONFIGS[cfg.configKey];
      if (!conf) { console.error(`[puppeteer] ${cfg.name}: no CONFIGS['${cfg.configKey}']`); return []; }
      const evs = await scrapeWithPuppeteer(conf);
      return (evs || []).filter(e => e && e.start_date);
    } catch (e) {
      console.error(`[puppeteer] ${cfg.name} failed:`, e.message);
      return [];
    }
  }

  const METHODS = {
    jsonld,
    'listing-jsonld': listingJsonld,
    html,
    tribe,
    'wp-rest': wpRest,
    squarespace,
    shopify,
    graphql,
    puppeteer,
  };

  return { METHODS, politeGet, politePost, decodeEntities };
}

module.exports = { createMethods, decodeEntities, collectLdNodes };
