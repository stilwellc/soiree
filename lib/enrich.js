const axios = require('axios');

/**
 * Detail-page enrichment — one level deeper than the listing scrape.
 *
 * After the daily scrape, events from sources whose detail pages publish
 * structured data get their missing facts filled in: real start times,
 * prices, descriptions, addresses. Only PUBLISHED data is written — an
 * event with no published time keeps its TBA; nothing is guessed.
 *
 * Runs once a day inside the scrape function; sequential-ish with a
 * small concurrency cap out of politeness to the source sites.
 */

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// Domains whose detail pages we know how to read.
const ENRICHABLE = ['nycforfree.co', 'thelocalgirl.com'];

function enrichableUrl(url) {
  try {
    const host = new URL(url).hostname;
    return ENRICHABLE.some(d => host === d || host.endsWith('.' + d));
  } catch {
    return false;
  }
}

function extractJsonLd(html) {
  const nodes = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1]);
      const arr = Array.isArray(parsed) ? parsed : parsed['@graph'] ? parsed['@graph'] : [parsed];
      nodes.push(...arr);
    } catch {
      /* malformed block — skip */
    }
  }
  return nodes;
}

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#8217;/g, '’')
    .replace(/&#8216;/g, '‘').replace(/&#822[01];/g, '"').replace(/&#8211;/g, '–')
    .replace(/&hellip;|&#8230;/g, '…').replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]{2,8};|&#\d{2,5};/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatTime(d) {
  let h = d.getHours();
  const mins = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return mins ? `${h}:${String(mins).padStart(2, '0')} ${ampm}` : `${h}:00 ${ampm}`;
}

/** Parse one detail page's HTML into the facts it actually publishes. */
function parseDetailPage(html) {
  const out = {};
  const nodes = extractJsonLd(html);

  // 1) A real schema.org Event (NYC For Free / Squarespace) — the jackpot.
  const ev = nodes.find(n => {
    const t = Array.isArray(n['@type']) ? n['@type'].join(',') : String(n['@type'] || '');
    return /Event/i.test(t);
  });
  if (ev) {
    if (ev.startDate && /T\d{2}:\d{2}/.test(ev.startDate)) {
      const start = new Date(ev.startDate);
      if (!isNaN(start) && !(start.getHours() === 0 && start.getMinutes() === 0)) {
        out.time = formatTime(start);
        out.startIso = ev.startDate;
      }
    }
    if (ev.endDate) out.endIso = ev.endDate;
    const offers = Array.isArray(ev.offers) ? ev.offers[0] : ev.offers;
    if (offers && offers.price !== undefined && offers.price !== '') {
      const p = parseFloat(offers.price);
      if (!isNaN(p)) out.price = p === 0 ? 'free' : `$${p % 1 ? p.toFixed(2) : p}`;
    }
    if (ev.description) out.description = decodeEntities(ev.description);
    const loc = ev.location || {};
    const addr = loc.address;
    if (addr) {
      const line = typeof addr === 'string'
        ? addr
        : [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode]
            .filter(Boolean).join(', ');
      if (line && line.length > 8) out.address = line;
    }
  }

  // 2) BlogPosting description (The Local Girl) — real copy beats templates.
  if (!out.description) {
    const post = nodes.find(n => /BlogPosting|Article/i.test(String(n['@type'] || '')));
    if (post && post.description) out.description = decodeEntities(post.description);
  }
  // 2b) og:description as a last resort.
  if (!out.description) {
    const og = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{40,})["']/i);
    if (og) out.description = decodeEntities(og[1]);
  }

  // 3) Visible "July 10 @ 7:00 pm" pattern (The Events Calendar prints this).
  if (!out.time) {
    const t = html.match(/@\s*(\d{1,2}:\d{2}\s*[ap]m)/i) || html.match(/>(\d{1,2}:\d{2}\s*[ap]m)\s*(?:-|–|<)/i);
    if (t) out.time = t[1].toUpperCase().replace(/\s+/g, ' ').trim();
  }

  // Truth guard: a description under 40 clean chars is not a description.
  if (out.description && out.description.length < 40) delete out.description;
  return out;
}

/**
 * Enrich rows in the events table. `pool` is a pg pool; `log` optional.
 * Returns { attempted, enriched, fieldsWritten }.
 */
async function enrichEvents(pool, log = console.log) {
  const { rows } = await pool.query(`
    SELECT id, name, url, time, price, description, start_date
    FROM events
    WHERE url IS NOT NULL
      AND (end_date >= CURRENT_DATE OR start_date >= CURRENT_DATE)
      AND (
        time ILIKE '%see details%' OR time IS NULL OR time = ''
        OR price ILIKE '%see details%' OR price IS NULL
        OR description ILIKE 'Event in %'
      )
  `);
  const targets = rows.filter(r => enrichableUrl(r.url));
  log(`Enrichment: ${targets.length} candidates of ${rows.length} gap rows`);

  let enriched = 0, fieldsWritten = 0;
  const CONCURRENCY = 4;
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async row => {
      try {
        const { data: html } = await axios.get(row.url, {
          headers: { 'User-Agent': UA }, timeout: 15000, maxRedirects: 4,
          validateStatus: s => s === 200,
        });
        const facts = parseDetailPage(html);

        const sets = [];
        const vals = [];
        let n = 1;
        const missingTime = !row.time || /see details/i.test(row.time);
        const missingPrice = !row.price || /see details/i.test(row.price);
        const templateDesc = !row.description || /^Event in /i.test(row.description);

        if (facts.time && missingTime) { sets.push(`time = $${n++}`); vals.push(facts.time); }
        if (facts.price && missingPrice) { sets.push(`price = $${n++}`); vals.push(facts.price); }
        if (facts.description && templateDesc) {
          sets.push(`description = $${n++}`);
          vals.push(facts.description.slice(0, 2000));
        }
        if (facts.address) { sets.push(`address = COALESCE(NULLIF(address, ''), $${n++})`); vals.push(facts.address); }
        // A timed startDate upgrades a midnight placeholder — feeds tonight-first logic.
        if (facts.startIso && facts.time && missingTime) {
          sets.push(`start_date = $${n++}`);
          vals.push(new Date(facts.startIso));
        }

        if (sets.length) {
          vals.push(row.id);
          await pool.query(`UPDATE events SET ${sets.join(', ')} WHERE id = $${n}`, vals);
          enriched++;
          fieldsWritten += sets.length;
        }
      } catch (err) {
        log(`Enrichment skip (${row.id} ${row.name?.slice(0, 30)}): ${err.message}`);
      }
    }));
  }
  log(`Enrichment: wrote ${fieldsWritten} fields across ${enriched} events`);
  return { attempted: targets.length, enriched, fieldsWritten };
}

module.exports = { enrichEvents, parseDetailPage, enrichableUrl };
