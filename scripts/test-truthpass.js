#!/usr/bin/env node
/* ============================================================================
   test-truthpass.js — zero-dependency test harness for js/truthpass.js
   Run: node scripts/test-truthpass.js [path-to-real-payload.json]
   Loads the classic script via vm with a window shim, drives it with fixture
   events exercising every brief-§4 rule (including live-payload pathologies),
   then optionally re-runs against a real /api/events payload for sanity.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ---------- load the classic script ---------- */
const MODULE_PATH = path.join(__dirname, '..', 'js', 'truthpass.js');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(MODULE_PATH, 'utf8'), sandbox, { filename: MODULE_PATH });
const TruthPass = sandbox.window.TruthPass;
if (!TruthPass || typeof TruthPass.verify !== 'function') {
  console.error('FATAL: window.TruthPass.verify not exported');
  process.exit(1);
}

/* ---------- tiny assert harness ---------- */
let passed = 0, failed = 0;
function ok(cond, label, detail) {
  if (cond) { passed++; console.log('  ok  ' + label); }
  else { failed++; console.log('  FAIL ' + label + (detail !== undefined ? '  ← got: ' + JSON.stringify(detail) : '')); }
}
function eq(a, b, label) { ok(a === b, label + ' [' + JSON.stringify(b) + ']', a); }

/* Frozen clock: Sunday, July 5, 2026 at 6:30 PM local (matches the app's world). */
const NOW = new Date(2026, 6, 5, 18, 30, 0);

/* ---------- fixtures: every rule + every live-payload pathology ---------- */
function ev(over) {
  return Object.assign({
    id: Math.floor(Math.random() * 1e9), category: 'music', spots: 42,
    name: 'Fixture Event', date: 'July 6, 2026', time: 'See details',
    location: 'Hoboken', address: '92 River Street, Hoboken, NJ 07030',
    price: 'See details', highlights: [], url: 'https://x.test/e', image: null,
    description: null, start_date: '2026-07-06T00:00:00.000Z',
    end_date: '2026-07-06T00:00:00.000Z', source: 'The Local Girl', event_type: null, deals: null
  }, over);
}

const fixtures = [
  /* 1 — past filter: July 4 was yesterday; must vanish */
  ev({ id: 1, name: 'July 4 Fireworks (yesterday)', start_date: '2026-07-04T00:00:00.000Z', end_date: '2026-07-04T00:00:00.000Z' }),
  /* 2 — ET/UTC trap: ISO UTC midnight of TODAY. new Date(iso) in ET reads July 4 → wrongly dropped. Must be kept as tonight. */
  ev({ id: 2, name: 'UTC Midnight Trap Tonight', time: '9:00 pm', start_date: '2026-07-05T00:00:00.000Z', end_date: '2026-07-05T00:00:00.000Z' }),
  /* 3 — earlierToday: 7:00 AM start is >2.5h past at 6:30 PM */
  ev({ id: 3, name: 'Fleet Week 2026', time: '7:00 AM', price: 'free', address: 'NYC', location: 'New York City',
      start_date: '2026-07-05T00:00:00.000Z', end_date: '2026-07-05T00:00:00.000Z',
      description: "Celebrate the 250th birthday of America with the Intrepid Museum's annual Fleet Week, this year July 5-8, 2026! #block-cec9310c16e365c7980c { } #block-cec9310c1" }),
  /* 4 — tonight, 7 pm (not past at 6:30 PM) */
  ev({ id: 4, name: 'Tonight Seven PM', time: '7 pm', start_date: '2026-07-05T00:00:00.000Z', end_date: '2026-07-05T00:00:00.000Z' }),
  /* 5 — tonight, TBA time: kept live, sorts after known times */
  ev({ id: 5, name: 'Tonight TBA', time: 'See details', start_date: '2026-07-05T00:00:00.000Z', end_date: '2026-07-05T00:00:00.000Z' }),
  /* 6 — tomorrow */
  ev({ id: 6, name: 'Tomorrow Market', time: '3–10 pm', start_date: '2026-07-06T00:00:00.000Z', end_date: '2026-07-06T00:00:00.000Z' }),
  /* 7 — this week (odd range format "9:15–10 am") */
  ev({ id: 7, name: 'Member Storytime', time: '9:15–10 am', address: 'Central Park West at 79th Street, New York, NY',
      location: 'American Museum of Natural History', source: 'American Museum of Natural History',
      start_date: '2026-07-08T00:00:00.000Z', end_date: '2026-07-08T00:00:00.000Z' }),
  /* 8 — horizon pair on the same day: sold-out must demote below a later non-sold row */
  ev({ id: 8, name: 'A Night at the Museum: The Overnight Experience July 24', date: 'Friday, July 24, 2026 | Sold Out', time: '6 pm',
      description: 'Sold out.', address: 'Central Park West at 79th Street, New York, NY', location: 'American Museum of Natural History',
      source: 'American Museum of Natural History', start_date: '2026-07-24T00:00:00.000Z', end_date: '2026-07-24T00:00:00.000Z' }),
  ev({ id: 9, name: 'Late Show Same Night', time: '9 pm', start_date: '2026-07-24T00:00:00.000Z', end_date: '2026-07-24T00:00:00.000Z' }),
  /* 10 — swapped-date healing + Extended-through lift + curator split + echo desc (real Gagosian row) */
  ev({ id: 10, name: 'Extended through July 17, 2026Giuseppe PenoneThe Reflection of BronzeCurated by Adam D. Weinberg',
      date: 'April 22–July 17, 2026555 West 24th Street, New York', price: 'free', event_type: 'exhibition',
      location: 'Gagosian', source: 'Gagosian', address: '555 W 24th St, New York, NY 10011',
      description: 'Extended through July 17, 2026Giuseppe PenoneThe Reflection of BronzeCurated by Adam D. Weinberg at Gagosian.',
      start_date: '2027-04-22T00:00:00.000Z', end_date: '2026-07-17T00:00:00.000Z' }),
  /* 11 — case-boundary concatenation + echo-with-stray-LA-address desc (real Matthew Marks row) */
  ev({ id: 11, name: 'JORDAN BELSONThe Cosmic View', date: 'August 15, 2026', price: 'free', event_type: 'exhibition',
      location: 'Matthew Marks', source: 'Matthew Marks', address: '522 W 22nd St, New York, NY 10011',
      description: 'JORDAN BELSONThe Cosmic View through 1062 North Orange Grove7818 Santa Monica Boulevard at Matthew Marks.',
      start_date: '2026-08-15T00:00:00.000Z', end_date: '2026-08-15T00:00:00.000Z' }),
  /* 12 — true future range → OPENS */
  ev({ id: 12, name: 'Au 108 rue Vieille du Temple', price: 'free', event_type: 'exhibition', location: 'David Zwirner',
      source: 'David Zwirner', address: '519 W 19th St, New York, NY 10011', description: 'Au 108 rue Vieille du Temple at David Zwirner.',
      start_date: '2026-09-18T00:00:00.000Z', end_date: '2026-10-10T00:00:00.000Z' }),
  /* 13 — off-year closing → year marker */
  ev({ id: 13, name: 'Pap Souleye Fall Exhibition', price: 'free', event_type: 'exhibition', location: 'Blade Study',
      source: 'Blade Study', address: 'New York, NY', description: 'Pap Souleye Fall at Blade Study.',
      start_date: '2027-01-09T00:00:00.000Z', end_date: '2027-01-09T00:00:00.000Z' }),
  /* 14 — swapped healing on a still-open show (Sean Kelly) */
  ev({ id: 14, name: 'The Audacity of Scale', price: 'free', event_type: 'exhibition', location: 'Sean Kelly',
      source: 'Sean Kelly', address: '475 10th Ave, New York, NY 10018', description: 'The Audacity of Scale at Sean Kelly.',
      start_date: '2027-06-13T00:00:00.000Z', end_date: '2026-08-20T00:00:00.000Z' }),
  /* 15/16 — the duplicate Tirai rows (renamed, Blvd vs Boulevard) — one must survive */
  ev({ id: 15, name: 'Tirai – A Solo Bharatanatyam Showcase', address: '345 Marin Blvd, Jersey City,  New Jersey  07302,  US',
      location: 'Jersey City', highlights: ['Entertainment', 'Free', 'Live Music'],
      description: 'Event in Jersey City: Tirai – A Solo Bharatanatyam Showcase' }),
  ev({ id: 16, name: 'Tirai – The Curtain', address: '345 Marin Boulevard, Jersey City, NJ 07302',
      location: 'Jersey City', description: 'Event in Jersey City: Tirai – The Curtain' }),
  /* 17/18 — exact dupe (same name+date+venue) — one must survive */
  ev({ id: 17, name: 'Handmade Market', address: '319 Grove St Jersey City, NJ 07302', location: 'Jersey City' }),
  ev({ id: 18, name: 'Handmade Market', address: '319 Grove St Jersey City, NJ 07302', location: 'Jersey City' }),
  /* 19 — $45 prix fixe: must NOT be free; template description → null */
  ev({ id: 19, name: 'Halifax Offers $45 Prix Fix for World Cup Viewing Party', price: 'See details',
      description: 'Event in Hoboken: Halifax Offers $45 Prix Fix for World Cup Viewing Party' }),
  /* 20 — FREE in the name only: must NOT be free, name must NOT be re-cased */
  ev({ id: 20, name: 'RNA FREE Summer Music Series', price: 'See details', highlights: ['Entertainment'],
      address: '498 Palisade Ave, Jersey City,  New Jersey', location: 'Jersey City' }),
  /* 21 — explicit source Free tag → free */
  ev({ id: 21, name: 'Free Tagged Concert', price: 'See details', highlights: ['Live Music', 'Free'] }),
  /* 22 — CSS junk truncation leaving a real sentence (>=40 chars survives) */
  ev({ id: 22, name: 'Harlem Summer Nights', time: '5:00 PM', price: 'free', location: '12th Avenue\n     New York',
      address: '12th Avenue\n     New York, NY\n     United States\n   \n   (map)',
      description: 'Food, music, and summer nights in Harlem. #block-dd4467f0661e5875bf66 { } #block-dd4467f0661e5875bf66 .sqs-html-content { }',
      start_date: '2026-07-10T00:00:00.000Z', end_date: '2026-07-10T00:00:00.000Z' }),
  /* 23 — junk truncation leaving <40 clean chars → null */
  ev({ id: 23, name: 'Junky Short Desc', description: 'Nice night out. #block-abc { } @media (max-width: 600px) { }' }),
  /* 24 — address "NYC" → maps fallback to name+location */
  ev({ id: 24, name: 'Manhattanhenge July 2026', time: '8:00 PM', price: 'free', address: 'NYC', location: 'New York City',
      start_date: '2026-07-11T00:00:00.000Z', end_date: '2026-07-11T00:00:00.000Z',
      description: 'Manhattanhenge is when the setting sun is exactly aligned with the street grid of Manhattan. Between May 28-July 12, the "Manhattanhenge Effect" occurs. #block-x { }' }),
  /* 25 — venue-only address (Whitney) → neighborhood heuristic + (map) stripping */
  ev({ id: 25, name: 'West Side Fest at the Whitney', time: '5:00 PM', price: 'free',
      address: 'Whitney Museum of American Art\n      \n      (map)', location: 'New York City',
      start_date: '2026-07-10T00:00:00.000Z', end_date: '2026-07-10T00:00:00.000Z',
      description: 'Join the Whitney Museum at their neighboring cultural institutions on July 10–12, 2026 for West Side Fest, a free, multi-site celebration.' }),
  /* 26 — long acronym survives de-shouting; unsplash stock art stripped to placeholder;
      later horizon date than the sold-out July 24 pair (shelf-end demotion check) */
  ev({ id: 26, name: 'The View at Lokal will Host FIFA World Cup Viewing Party', time: '2 pm',
      image: 'https://images.unsplash.com/photo-1511578314322-379afb476865',
      start_date: '2026-08-01T00:00:00.000Z', end_date: '2026-08-01T00:00:00.000Z' }),
];

console.log('== TruthPass fixture suite (NOW = ' + NOW.toString() + ') ==\n');
const R = TruthPass.verify(fixtures, NOW);
const byId = {}; R.events.forEach(e => { byId[e.id] = e; });
const inShelf = (shelf, id) => R.shelves[shelf].some(e => e.id === id);

console.log('-- rule 1: past filter + ET-safe parsing --');
ok(!byId[1], 'July-4-yesterday event dropped');
ok(!!byId[2] && inShelf('tonight', 2), 'UTC-midnight-of-today event kept as tonight (no ET off-by-one)');

console.log('-- rule 1b: earlierToday --');
ok(byId[3] && byId[3].earlierToday === true, 'same-day 7:00 AM start flagged earlierToday');
ok(inShelf('earlierToday', 3) && !inShelf('tonight', 3), 'earlierToday shelved separately, off the tonight shelf');
ok(byId[4] && byId[4].earlierToday === false && inShelf('tonight', 4), '7 pm tonight stays live');
eq(R.counts.tonight, R.shelves.tonight.length, 'counts.tonight excludes earlierToday');

console.log('-- rule 2: swapped-date healing --');
ok(byId[10] && byId[10].startAt === null, 'swapped start (2027) discarded');
eq(byId[10] && byId[10].dateChip, 'THRU JUL 17', 'healed row renders THRU end date');
eq(byId[14] && byId[14].dateChip, 'THRU AUG 20', 'Sean Kelly swapped year healed');
ok(byId[14] && byId[14].opensAt === null, 'no invented opening date');

console.log('-- rule 3: exhibition dating --');
eq(byId[11] && byId[11].dateChip, 'THRU AUG 15', 'single gallery date read as closing date');
ok(byId[10] && byId[10].finalDays === true, 'FINAL DAYS within 14 days of close');
ok(byId[14] && byId[14].finalDays === false, 'no FINAL DAYS at 46 days out');
eq(byId[12] && byId[12].dateChip, 'OPENS SEP 18', 'true future range renders OPENS');
eq(byId[13] && byId[13].dateChip, 'THRU JAN 9 ’27', 'off-year closing carries year marker');
ok([10, 11, 12, 13, 14].every(id => inShelf('onView', id)), 'exhibitions all shelve to onView');

console.log('-- rule 4: dedupe --');
ok((byId[15] ? 1 : 0) + (byId[16] ? 1 : 0) === 1, 'duplicate Tirai rows (renamed, Blvd/Boulevard) collapse to one');
ok((byId[17] ? 1 : 0) + (byId[18] ? 1 : 0) === 1, 'exact name+date+venue dupe collapses to one');

console.log('-- rule 5: free derivation --');
ok(byId[19] && byId[19].isFree === false, '$45 prix fixe is NOT free');
ok(byId[20] && byId[20].isFree === false, '"RNA FREE Summer Music Series" name never implies free');
eq(byId[20] && byId[20].cleanName, 'RNA Free Summer Music Series', 'shouting "FREE" de-shouted, 3-letter "RNA" kept (brief §4.8)');
eq(byId[26] && byId[26].cleanName, 'The View at Lokal will Host FIFA World Cup Viewing Party', 'listed acronym FIFA survives de-shouting');
ok(byId[21] && byId[21].isFree === true, 'explicit source Free tag → free');
ok(byId[24] && byId[24].isFree === true, 'price === "free" → free');

console.log('-- rule 6: sold-out parsing --');
ok(byId[8] && byId[8].soldOut === true, '"| Sold Out" date suffix detected');
ok(byId[8] && !/sold\s*out/i.test(byId[8].displayDate), 'marker stripped from rendered date');
eq(byId[8] && byId[8].displayDate, 'Friday, July 24', 'displayDate clean and correct');
ok(byId[8] && byId[8].cleanDescription === null, '"Sold out." description suppressed');
eq(R.soldOutCount, 1, 'soldOutCount');
(() => {
  const day = R.shelves.horizon.filter(e => e.id === 8 || e.id === 9).map(e => e.id);
  ok(day.length === 2 && day[0] === 9 && day[1] === 8, 'sold-out row demoted below later non-sold row same night', day);
  const h = R.shelves.horizon.map(e => e.id);
  ok(h.indexOf(8) > h.indexOf(26), 'sold-out row demoted to shelf END, below later live dates', h);
})();

console.log('-- stock imagery --');
ok(byId[26] && byId[26].image === null, 'unsplash stock image stripped to placeholder');

console.log('-- rule 7: description suppression --');
ok(byId[19] && byId[19].cleanDescription === null, '"Event in {X}: …" template → null');
ok(byId[3] && byId[3].cleanDescription === "Celebrate the 250th birthday of America with the Intrepid Museum's annual Fleet Week, this year July 5-8, 2026!", '#block- junk truncated, real copy survives');
eq(byId[22] && byId[22].cleanDescription, 'Food, music, and summer nights in Harlem.', 'junk truncation keeps clean 41-char sentence');
ok(byId[23] && byId[23].cleanDescription === null, '<40 clean chars after junk → null');
ok(byId[10] && byId[10].cleanDescription === null, '"{Title} at {Venue}." echo → null');
ok(byId[11] && byId[11].cleanDescription === null, 'echo stuffed with stray LA addresses → null');
ok(byId[24] && byId[24].cleanDescription !== null && !/#block/.test(byId[24].cleanDescription), 'legit long description survives with junk stripped');

console.log('-- rule 8: cleanName --');
eq(byId[11] && byId[11].cleanName, 'Jordan Belson · The Cosmic View', 'case-boundary concatenation split + de-shouted');
eq(byId[10] && byId[10].cleanName, 'Giuseppe Penone · The Reflection of Bronze', 'Extended-through + curator lifted out of name');
eq(byId[10] && byId[10].note, 'Extended through July 17, 2026', '"Extended through…" lifted into note');
eq(byId[10] && byId[10].credit, 'Adam D. Weinberg', '"Curated by…" split into credit');

console.log('-- neighborhood derivation --');
eq(byId[4] && byId[4].neighborhood, 'Hoboken', '07030 → Hoboken');
eq(byId[15 in byId ? 15 : 16].neighborhood, 'Downtown JC', '07302 → Downtown JC');
eq(byId[11] && byId[11].neighborhood, 'Chelsea', '10011 → Chelsea');
eq(byId[7] && byId[7].neighborhood, 'Upper West Side', 'Central Park West → Upper West Side');
eq(byId[25] && byId[25].neighborhood, 'Meatpacking District', 'Whitney venue address → Meatpacking District');
eq(byId[14] && byId[14].neighborhood, 'Hudson Yards', '10018 → Hudson Yards');

console.log('-- mapsUrl --');
ok(byId[11] && byId[11].mapsUrl.indexOf('https://www.google.com/maps/search/?api=1&query=522%20W%2022nd%20St') === 0, 'maps URL built from address');
ok(byId[24] && decodeURIComponent(byId[24].mapsUrl).indexOf('Manhattanhenge July 2026 New York City') > 0, '"NYC" address falls back to name+location');
ok(byId[25] && byId[25].mapsUrl.indexOf('(map)') < 0 && byId[25].mapsUrl.indexOf('%0A') < 0, '"(map)" and newlines stripped before encoding');

console.log('-- displayTime / dateChip / sorting --');
eq(byId[7] && byId[7].displayTime, '9:15 AM', '"9:15–10 am" → start 9:15 AM');
eq(byId[6] && byId[6].displayTime, '3:00 PM', '"3–10 pm" → start 3:00 PM');
eq(byId[5] && byId[5].displayTime, 'TBA', '"See details" → TBA');
eq(byId[4] && byId[4].dateChip, '7:00 PM', 'dateChip mirrors displayTime for dated events');
(() => {
  const t = R.shelves.tonight.map(e => e.id);
  ok(t.indexOf(5) === t.length - 1, 'TBA sorts last within tonight', t);
})();

console.log('-- output integrity --');
eq(R.events.length, Object.keys(byId).length, 'no duplicate ids in events');
const shelfSum = Object.keys(R.shelves).reduce((n, k) => n + R.shelves[k].length, 0);
eq(R.events.length, shelfSum, 'events[] === union of shelves (one source of truth)');
ok(R.counts.tonight === R.shelves.tonight.length && R.counts.tomorrow === R.shelves.tomorrow.length &&
   R.counts.thisWeek === R.shelves.thisWeek.length && R.counts.horizon === R.shelves.horizon.length &&
   R.counts.onView === R.shelves.onView.length, 'counts derived from shelves');
ok(Array.isArray(R.sources) && R.sources.indexOf('The Local Girl') >= 0 && new Set(R.sources).size === R.sources.length, 'sources distinct');
const isDate = v => Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v); /* realm-safe: vm context has its own Date */
ok(R.events.every(e => (e.startAt === null || isDate(e.startAt)) && (e.endAt === null || isDate(e.endAt))), 'startAt/endAt are Date|null');
ok(R.events.every(e => typeof e.cleanName === 'string' && typeof e.displayTime === 'string' &&
   typeof e.displayDate === 'string' && typeof e.dateChip === 'string' &&
   typeof e.isFree === 'boolean' && typeof e.soldOut === 'boolean' && typeof e.earlierToday === 'boolean' &&
   typeof e.mapsUrl === 'string' && (e.cleanDescription === null || typeof e.cleanDescription === 'string')), 'contract field types hold for every event');

console.log('\n' + passed + ' passed, ' + failed + ' failed');

/* ---------- real payload sanity run ---------- */
const payloadPath = process.argv[2];
if (payloadPath) {
  const raw = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
  const RR = TruthPass.verify(raw.events || raw, new Date());
  console.log('\n== real payload (' + (raw.events || raw).length + ' raw events, now = ' + new Date().toString() + ') ==');
  console.log('shelf counts:', JSON.stringify({
    tonight: RR.shelves.tonight.length, earlierToday: RR.shelves.earlierToday.length,
    tomorrow: RR.counts.tomorrow, thisWeek: RR.counts.thisWeek,
    horizon: RR.counts.horizon, onView: RR.counts.onView
  }));
  console.log('total verified:', RR.events.length, '| soldOut:', RR.soldOutCount, '| sources:', RR.sources.join(', '));
  console.log('\nsample verified events:');
  const picks = [RR.shelves.tonight[0], RR.shelves.earlierToday[0], RR.shelves.tomorrow[0], RR.shelves.horizon.find(e => e.soldOut), RR.shelves.onView[0]].filter(Boolean).slice(0, 5);
  picks.forEach(e => console.log(JSON.stringify({
    id: e.id, cleanName: e.cleanName, dateChip: e.dateChip, displayDate: e.displayDate,
    displayTime: e.displayTime, neighborhood: e.neighborhood, isFree: e.isFree, soldOut: e.soldOut,
    earlierToday: e.earlierToday, note: e.note, credit: e.credit,
    cleanDescription: e.cleanDescription && e.cleanDescription.slice(0, 70)
  })));
}

process.exit(failed ? 1 : 0);
