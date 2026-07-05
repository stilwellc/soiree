/* ============================================================================
   TRUTH PASS — Soirée, The Concierge Ledger (build brief §4)
   Classic script, no modules. Sets window.TruthPass = { verify(rawEvents, now) }.
   Pure functions only: no DOM, no fetch, no globals mutated beyond the export.

   verify(rawEvents, now) -> {
     events:  verifiedEvent[],                       // all kept events, shelf order
     shelves: { tonight, earlierToday, tomorrow, thisWeek, horizon, onView },
     counts:  { tonight, tomorrow, thisWeek, horizon, onView },
     sources: string[],                              // distinct, first-appearance order
     soldOutCount: number
   }

   verifiedEvent = { ...rawEvent,
     cleanName, displayTime, displayDate, dateChip, neighborhood, mapsUrl,
     isFree, soldOut, earlierToday, cleanDescription (string|null),
     startAt (Date|null), endAt (Date|null)
   }
   plus documented extras renderers may use:
     isExhibition, finalDays, opensAt (Date|null), note (string|null, e.g.
     "Extended through July 17, 2026"), credit (string|null, "Curated by" name),
     cleanAddress (string|null), cleanTags (string[]), startMinutes (number|null)

   Hard rules honored here: `category` and `spots` are never interpreted or
   derived from — they ride along raw and must never be rendered (brief §4.9).
   ========================================================================== */
(function (root) {
  'use strict';

  var DAY_MS = 86400000;
  var MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  var MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* Gallery venues whose feeds arrive as exhibitions even when event_type is null. */
  var GALLERIES = ['gagosian', 'david zwirner', 'sean kelly', 'matthew marks', 'blade study', 'pace', 'hauser & wirth', 'hauser', 'lisson', 'lisson gallery'];

  /* Filler tags with no verifiable meaning (brief §4.9). */
  var GENERIC_TAGS = ['community gathering', 'local event', 'cultural experience', 'visual arts', 'community', 'brands + locations', 'free', 'free admission', 'amnh', 'art'];

  /* Long all-caps tokens that are real acronyms, not shouting — never re-cased.
     (Short tokens like NYC, RNA, DJ are protected by length instead.) */
  var ACRONYMS = ['FIFA', 'AMNH', 'NASA', 'NYPL', 'NYPD', 'MOMA', 'LGBTQ', 'UNESCO', 'USA'];

  /* Stock-photo hosts: a generic unsplash frame rendered as an event's own
     photograph is a falsehood — strip to the brand placeholder (brief §3.1,
     "never a stock photo"). */
  var STOCK_IMG = /(^|\/\/)([a-z0-9-]+\.)*unsplash\.com/i;

  /* Neighborhood by zip — the only address fact we trust outright. */
  var ZIP_HOODS = {
    '07030': 'Hoboken',
    '07302': 'Downtown JC', '07310': 'Downtown JC', '07311': 'Downtown JC',
    '07306': 'Journal Square', '07307': 'The Heights',
    '07304': 'Bergen-Lafayette', '07305': 'Bergen-Lafayette',
    '10001': 'Chelsea', '10011': 'Chelsea',
    '10018': 'Hudson Yards',
    '10014': 'West Village', '10012': 'SoHo', '10013': 'Tribeca',
    '10002': 'Lower East Side', '10003': 'East Village', '10009': 'East Village',
    '10019': 'Midtown', '10022': 'Midtown', '10036': 'Midtown',
    '10023': 'Upper West Side', '10024': 'Upper West Side', '10025': 'Upper West Side', '10069': 'Upper West Side',
    '10021': 'Upper East Side', '10028': 'Upper East Side', '10065': 'Upper East Side', '10075': 'Upper East Side', '10128': 'Upper East Side',
    '10026': 'Harlem', '10027': 'Harlem', '10030': 'Harlem', '10031': 'Harlem', '10037': 'Harlem', '10039': 'Harlem',
    '10004': 'Financial District', '10005': 'Financial District', '10006': 'Financial District', '10007': 'Financial District', '10038': 'Financial District',
    '11201': 'Brooklyn Heights', '11211': 'Williamsburg', '11215': 'Park Slope', '11238': 'Prospect Heights'
  };

  /* ---------- small pure helpers ---------- */

  function collapse(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function normKey(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }

  /* ET-safe: an ISO stamp is a CALENDAR date. Slice y-m-d and build a local
     Date — never `new Date(iso)`, whose UTC midnight lands on the previous
     evening in New York (the off-by-one that shifted every event a day). */
  function parseIsoLocal(iso) {
    if (!iso) return null;
    var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }

  function midnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  /* "7 pm" / "9:15–10 am" / "3–10 pm" / "5–7:30 pm" -> START minutes since midnight.
     "See details" / unparseable -> null (renders TBA, sorts last). */
  function parseStartMinutes(t) {
    if (!t || /see details|tba/i.test(t)) return null;
    var m = String(t).match(/(\d{1,2})(?::(\d{2}))?/);
    if (!m) return null;
    var mer = String(t).match(/\b(a\.?m\.?|p\.?m\.?)/i);
    var h = +m[1], min = m[2] ? +m[2] : 0;
    if (h > 23 || min > 59) return null;
    if (mer && /^p/i.test(mer[1]) && h < 12) h += 12;
    if (mer && /^a/i.test(mer[1]) && h === 12) h = 0;
    return h * 60 + min;
  }

  function fmtMinutes(mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    var mer = h >= 12 ? 'PM' : 'AM';
    var hh = h % 12; if (hh === 0) hh = 12;
    return hh + ':' + (m < 10 ? '0' : '') + m + ' ' + mer;
  }

  /* "AUG 20" — off-year closings carry a year marker: "JAN 9 ’27" */
  function chipDate(d, nowYear) {
    var s = MONTHS[d.getMonth()] + ' ' + d.getDate();
    if (d.getFullYear() !== nowYear) s += ' ’' + String(d.getFullYear()).slice(2);
    return s;
  }

  /* "July 17" (+", 2027" when off-year) */
  function monthDay(d, nowYear) {
    var s = MONTHS_FULL[d.getMonth()] + ' ' + d.getDate();
    if (d.getFullYear() !== nowYear) s += ', ' + d.getFullYear();
    return s;
  }

  /* "Saturday, July 11" (+", 2027" when off-year) */
  function fullDate(d, nowYear) {
    return DAYS_FULL[d.getDay()] + ', ' + monthDay(d, nowYear);
  }

  /* ---------- field-level passes ---------- */

  /* Address hygiene (brief §4.12): collapse whitespace, strip "(map)", kill newlines. */
  function cleanAddress(addr) {
    var a = collapse(String(addr == null ? '' : addr).replace(/\(\s*map\s*\)/gi, ' '));
    return a || null;
  }

  function deriveNeighborhood(addr, location) {
    var a = addr || '';
    var loc = collapse(location);
    /* 1. zip is the strongest signal — take the LAST 5-digit group (street
       numbers come first). */
    var zips = a.match(/\b\d{5}\b/g);
    if (zips) {
      var hood = ZIP_HOODS[zips[zips.length - 1]];
      if (hood) return hood;
    }
    /* 2. street / venue heuristics */
    var blob = a + ' ' + loc;
    if (/central park west/i.test(blob) || /american museum of natural history/i.test(blob)) return 'Upper West Side';
    if (/whitney museum/i.test(blob)) return 'Meatpacking District';
    if (/\bharlem\b/i.test(blob)) return 'Harlem';
    if (/palisade av/i.test(a) && /jersey city/i.test(blob)) return 'The Heights';
    /* 3. city fallback */
    if (/hoboken/i.test(blob)) return 'Hoboken';
    if (/jersey city/i.test(blob)) return 'Jersey City';
    if (/new york|nyc|manhattan/i.test(blob)) return 'New York';
    return loc || null;
  }

  function buildMapsUrl(addr, name, location) {
    var q = addr;
    /* an address like "NYC" or empty locates nothing — fall back to name+locale */
    if (!q || q.length <= 4 || /^nyc,?$/i.test(q)) {
      q = collapse(name) + ' ' + collapse(location || 'New York');
    }
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(collapse(q));
  }

  /* cleanName (brief §4.8): case-boundary concatenation splits, lift
     "Extended through …" into a note, split "Curated by …" into a credit,
     title-case ALL-CAPS words. Splitting is scoped to exhibitions — that is
     where the scraper concatenates; event names like "RNA FREE Summer Music
     Series" must survive untouched. */
  function cleanNameParts(rawName, isExhibition) {
    var name = collapse(rawName);
    var note = null, credit = null;

    /* sold-out marker sometimes rides raw strings — never render it */
    name = collapse(name.replace(/\s*\|\s*sold\s*out\s*/gi, ' '));

    var ext = name.match(/^Extended through ([A-Za-z]+ \d{1,2},? \d{4})\s*/);
    if (ext) { note = 'Extended through ' + ext[1]; name = name.slice(ext[0].length); }

    if (isExhibition) {
      /* "JORDAN BELSONThe Cosmic View" -> "JORDAN BELSON · The Cosmic View" */
      name = name
        .replace(/([A-Z]{2})([A-Z][a-z])/g, '$1 · $2')
        .replace(/([a-z0-9,.])([A-Z])/g, '$1 · $2');
      var cur = name.match(/\s*·\s*Curated by (.+)$/);
      if (cur) { credit = collapse(cur[1]); name = name.replace(cur[0], ''); }
    }
    /* title-case shouting (brief §4.8, all shelves): "BELSON" -> "Belson",
       "FREE" -> "Free". Gallery feeds arrive fully capitalized, so exhibitions
       de-shout from 3 letters up; event names keep 3-letter tokens (NYC, RNA)
       and listed acronyms (FIFA) intact. */
    var minShout = isExhibition ? 3 : 4;
    name = name.split(' ').map(function (w) {
      return (w.length >= minShout && /^[A-Z]+$/.test(w) && ACRONYMS.indexOf(w) < 0)
        ? w.charAt(0) + w.slice(1).toLowerCase() : w;
    }).join(' ');
    return { name: collapse(name), note: note, credit: credit };
  }

  /* Description suppression (brief §4.7):
     - "Event in {X}: …" scraper templates -> null
     - Squarespace CSS junk (#block-…{}, @media, .sqs-) -> truncate at first token
     - "{Title} … at {Venue}." echoes (incl. echoes stuffed with stray
       addresses) -> null
     - fewer than 40 clean chars left -> null. Nothing is ever invented. */
  function cleanDescriptionPass(rawDesc, rawName, location, source) {
    var d = collapse(rawDesc);
    if (!d) return null;
    if (/^event in [^:]+:/i.test(d)) return null;
    if (/^sold\s*out\.?$/i.test(d)) return null; /* a state, not a description */

    var junk = d.search(/#block-|\{|@media|\.sqs-/);
    if (junk >= 0) d = collapse(d.slice(0, junk));

    var nd = normKey(d);
    var candidates = [rawName, location, source];
    for (var i = 0; i < candidates.length; i++) {
      var v = normKey(candidates[i]);
      if (!v) continue;
      /* echo: starts with the title and ends "at {venue}." — whatever sits
         between is scraper scaffolding (dates, stray gallery addresses) */
      if (nd.indexOf(normKey(rawName)) === 0 && new RegExp('at' + v.replace(/[^a-z0-9]/g, '') + '$').test(nd)) return null;
    }
    /* near-pure echo without the "at venue" tail */
    var residue = nd.replace(normKey(rawName), '').replace(normKey(location), '').replace(normKey(source), '')
      .replace(/^(extendedthrough|through|at)+/, '').replace(/\d+/g, '');
    if (residue.length < 14) return null;

    if (d.length < 40) return null;
    return d;
  }

  /* isFree (brief §4.5): the price field, or the source's EXPLICIT Free tag.
     Never the name ("RNA FREE Summer Music Series"), never highlight prose. */
  function deriveFree(price, highlights) {
    if (/^\s*free\s*$/i.test(price || '')) return true;
    if (Array.isArray(highlights)) {
      for (var i = 0; i < highlights.length; i++) {
        if (/^\s*free(\s+admission)?\s*$/i.test(String(highlights[i]))) return true;
      }
    }
    return false;
  }

  function filterTags(highlights, location) {
    if (!Array.isArray(highlights)) return [];
    var loc = normKey(location);
    return highlights.filter(function (h) {
      var l = collapse(h).toLowerCase();
      if (!l) return false;
      if (GENERIC_TAGS.indexOf(l) >= 0) return false;
      if (/^via /i.test(l)) return false;
      if (normKey(l) === loc) return false;
      if (GALLERIES.indexOf(l) >= 0) return false;
      return true;
    }).map(collapse);
  }

  /* ---------- the pass ---------- */

  function verify(rawEvents, now) {
    now = (now instanceof Date && !isNaN(now)) ? now : new Date();
    var today = midnight(now);
    var nowMinutes = now.getHours() * 60 + now.getMinutes();
    var nowYear = today.getFullYear();
    function dayDiff(d) { return Math.round((midnight(d) - today) / DAY_MS); }

    var seen = {};      /* normalized name|date|venue */
    var seenStem = {};  /* title stem|date|street — catches renamed duplicates
                           (Tirai – The Curtain / Tirai – A Solo … at 345 Marin) */
    var kept = [];

    (Array.isArray(rawEvents) ? rawEvents : []).forEach(function (raw) {
      if (!raw || typeof raw !== 'object') return;

      var startD = parseIsoLocal(raw.start_date);
      var endD = parseIsoLocal(raw.end_date) || startD;
      if (!startD && !endD) return;               /* undated: unverifiable, never printed */
      if (!startD) startD = endD;

      var location = collapse(raw.location);
      var isExhibition = raw.event_type === 'exhibition' ||
        GALLERIES.indexOf(location.toLowerCase()) >= 0;

      /* --- swapped-date healing (brief §4.2): scraper year corruption puts
         start after end. Discard the start, trust the closing date, render
         "Through {end}". Never invent an opening date. --- */
      var healedSwap = false;
      if (startD && endD && startD > endD) { startD = null; healedSwap = true; }

      var thruD = null, opensD = null;
      if (isExhibition) {
        /* single-date gallery listings are CLOSING dates (brief §4.3) */
        thruD = endD;
        if (startD && endD && startD.getTime() === endD.getTime()) startD = null;
        if (startD && startD > today && startD < endD) opensD = startD;
        if (dayDiff(thruD) < 0) return;           /* exhibition already closed */
      } else {
        if (dayDiff(endD) < 0) return;            /* event over — never rendered live */
      }

      /* --- sold-out parsing (brief §4.6): "| Sold Out" in date strings AND
         literal "Sold out." descriptions. Markers are stripped from every
         rendered string. --- */
      var soldOut = /\|\s*sold\s*out/i.test(String(raw.date || '')) ||
        /\bsold\s*out\b\s*$/i.test(String(raw.date || '')) ||
        /^\s*sold\s*out\.?\s*$/i.test(collapse(raw.description)) ||
        /\|\s*sold\s*out/i.test(String(raw.name || ''));

      var parts = cleanNameParts(raw.name, isExhibition);
      var addr = cleanAddress(raw.address);
      var startMinutes = isExhibition ? null : parseStartMinutes(raw.time);

      /* --- dedupe (brief §4.4): normalized name + date + venue --- */
      var dateKey = String(raw.start_date || raw.end_date || '').slice(0, 10);
      var key = normKey(raw.name) + '|' + dateKey + '|' + normKey(location);
      if (seen[key]) return;
      seen[key] = 1;
      /* second net: same title stem, same date, same street address —
         the same occasion filed twice under two subtitles */
      var stem = normKey(String(parts.name).split(/[–—:|]|\s-\s/)[0]);
      var streetKey = normKey((addr || '').split(',')[0]).replace(/(boulevard|blvd|street|st|avenue|ave|road|rd|drive|dr)$/, '');
      if (stem.length >= 4 && streetKey) {
        var stemKey = stem + '|' + dateKey + '|' + streetKey;
        if (seenStem[stemKey]) return;
        seenStem[stemKey] = 1;
      }

      /* --- earlierToday (brief §4.1): same-day start more than 2.5h past —
         kept, flagged, demoted; never hidden, never counted as live. --- */
      var earlierToday = !isExhibition && startD !== null && dayDiff(startD) === 0 &&
        dayDiff(endD) === 0 && startMinutes !== null && (startMinutes + 150) < nowMinutes;

      /* --- rendered strings --- */
      var displayTime = startMinutes !== null ? fmtMinutes(startMinutes) : 'TBA';
      var dateChip, displayDate;
      if (isExhibition) {
        dateChip = opensD ? 'OPENS ' + chipDate(opensD, nowYear) : 'THRU ' + chipDate(thruD, nowYear);
        displayDate = opensD
          ? 'Opens ' + monthDay(opensD, nowYear) + ' · through ' + monthDay(thruD, nowYear)
          : 'Through ' + monthDay(thruD, nowYear);
      } else {
        dateChip = displayTime;
        if (!startD) displayDate = 'Through ' + monthDay(endD, nowYear);
        else if (endD && endD > startD) displayDate = fullDate(startD, nowYear) + ' · through ' + monthDay(endD, nowYear);
        else displayDate = fullDate(startD, nowYear);
      }

      /* startAt carries the parsed start time when known */
      var startAt = null;
      if (startD) {
        startAt = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate());
        if (startMinutes !== null) startAt.setMinutes(startMinutes);
      }

      var ev = {};
      for (var k in raw) { if (Object.prototype.hasOwnProperty.call(raw, k)) ev[k] = raw[k]; }
      /* stock photography never prints as event art — placeholder instead */
      if (STOCK_IMG.test(String(ev.image || ''))) ev.image = null;
      ev.cleanName = parts.name;
      ev.note = parts.note;
      ev.credit = parts.credit;
      ev.displayTime = displayTime;
      ev.displayDate = displayDate;
      ev.dateChip = dateChip;
      ev.neighborhood = deriveNeighborhood(addr, location);
      ev.mapsUrl = buildMapsUrl(addr, parts.name, location);
      ev.isFree = deriveFree(raw.price, raw.highlights);
      ev.soldOut = soldOut;
      ev.earlierToday = earlierToday;
      ev.cleanDescription = cleanDescriptionPass(raw.description, raw.name, location, raw.source);
      ev.startAt = startAt;
      ev.endAt = endD || null;
      ev.isExhibition = isExhibition;
      ev.opensAt = opensD;
      ev.finalDays = !!(isExhibition && !opensD && dayDiff(thruD) <= 14);
      ev.cleanAddress = addr;
      ev.cleanTags = filterTags(raw.highlights, location);
      ev.startMinutes = startMinutes;
      ev._healedSwap = healedSwap;
      kept.push(ev);
    });

    /* ---------- shelving ---------- */
    var shelves = { tonight: [], earlierToday: [], tomorrow: [], thisWeek: [], horizon: [], onView: [] };
    kept.forEach(function (ev) {
      if (ev.isExhibition) { shelves.onView.push(ev); return; }
      var ref = ev.startAt ? midnight(ev.startAt) : ev.endAt;
      var dd = dayDiff(ref), de = dayDiff(ev.endAt || ref);
      if (ev.earlierToday) shelves.earlierToday.push(ev);
      else if (dd <= 0 && de >= 0) shelves.tonight.push(ev);      /* incl. in-progress multi-day */
      else if (dd === 1) shelves.tomorrow.push(ev);
      else if (dd <= 7) shelves.thisWeek.push(ev);
      else shelves.horizon.push(ev);
    });

    /* time-known first within a day, TBA last, sold-out demoted to shelf end */
    function byTime(a, b) {
      if (a.soldOut !== b.soldOut) return a.soldOut ? 1 : -1;
      if (a.startMinutes === null && b.startMinutes === null) return a.cleanName.localeCompare(b.cleanName);
      if (a.startMinutes === null) return 1;
      if (b.startMinutes === null) return -1;
      return a.startMinutes - b.startMinutes;
    }
    function byDayTime(a, b) {
      /* sold-out rows demote to the END of the shelf (brief §4.6), not merely
         to the end of their own day */
      if (a.soldOut !== b.soldOut) return a.soldOut ? 1 : -1;
      var da = a.startAt ? midnight(a.startAt) : a.endAt;
      var db = b.startAt ? midnight(b.startAt) : b.endAt;
      return (da - db) || byTime(a, b);
    }
    shelves.tonight.sort(byTime);
    shelves.earlierToday.sort(byTime);
    shelves.tomorrow.sort(byTime);
    shelves.thisWeek.sort(byDayTime);
    shelves.horizon.sort(byDayTime);
    shelves.onView.sort(function (a, b) {
      if (a.soldOut !== b.soldOut) return a.soldOut ? 1 : -1;
      return (a.endAt - b.endAt) || a.cleanName.localeCompare(b.cleanName);
    });

    /* one source of truth (brief §4.13): every count is a shelf length */
    var counts = {
      tonight: shelves.tonight.length,
      tomorrow: shelves.tomorrow.length,
      thisWeek: shelves.thisWeek.length,
      horizon: shelves.horizon.length,
      onView: shelves.onView.length
    };

    var events = shelves.tonight.concat(shelves.earlierToday, shelves.tomorrow, shelves.thisWeek, shelves.horizon, shelves.onView);

    var sources = [], seenSrc = {};
    events.forEach(function (e) {
      var s = collapse(e.source);
      if (s && !seenSrc[s]) { seenSrc[s] = 1; sources.push(s); }
    });

    var soldOutCount = events.reduce(function (n, e) { return n + (e.soldOut ? 1 : 0); }, 0);

    return { events: events, shelves: shelves, counts: counts, sources: sources, soldOutCount: soldOutCount };
  }

  root.TruthPass = { verify: verify };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
