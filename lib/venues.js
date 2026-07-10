/**
 * lib/venues.js — the Soirée VENUE registry.
 *
 * Each source is ONE config row. A `method` names how to extract; the shared
 * extractor in lib/methods.js reads the row. See scratchpad/VENUE_CONTRACT.md
 * for the full row schema and the list of methods.
 *
 * This file is APPENDABLE: a downstream merge process appends ~45 more venue
 * rows below the "=== APPENDED VENUES BELOW ===" marker. Keep that contract:
 *   - one row per line-block (object literal), trailing comma after each,
 *   - never remove the marker, append new rows immediately before the closing `];`.
 *
 * Groups: main | galleries | museums | film | literary | perfparks | nj | puppeteer
 * (Each group == one GitHub Actions curl step and must run <60s.)
 */

const VENUES = [
  // ── Whitney Museum ── listing-jsonld: /events + /exhibitions detail pages
  // each carry a clean schema.org Event / ExhibitionEvent block with startDate.
  {
    name: 'Whitney Museum',
    method: 'listing-jsonld',
    url: ['https://whitney.org/events', 'https://whitney.org/exhibitions'],
    base: 'https://whitney.org',
    linkSel: 'a[href^="/events/"], a[href^="/exhibitions/"]',
    group: 'museums',
    location: 'Whitney Museum',
    address: '99 Gansevoort St, New York, NY 10014',
    category: 'art',
    price: 'free',
    maxDetails: 20,
  },

  // ── New Museum ── graphql: admin.newmuseum.org exposes events + exhibitions
  // with startDate/endDate. uri is a path → prepend www.newmuseum.org (base).
  {
    name: 'New Museum',
    method: 'graphql',
    url: 'https://admin.newmuseum.org/graphql',
    base: 'https://www.newmuseum.org',
    queries: [
      { query: '{ events(first:25){nodes{title uri startDate endDate}} }', root: 'events' },
      { query: '{ exhibitions(first:15){nodes{title uri startDate endDate}} }', root: 'exhibitions' },
    ],
    group: 'museums',
    location: 'New Museum',
    address: '235 Bowery, New York, NY 10002',
    category: 'art',
    price: 'See details',
  },

  // ── Guggenheim ── PUPPETEER. The WP REST feed (wp/v2/event, wp/v2/exhibition)
  // returns titles+links but NO usable dates for CURRENT items (the event_date
  // taxonomy is empty for them and the React detail pages carry the date only in
  // JS-rendered content — verified live 2026-07). So the honest working path is
  // the existing rendered scraper via CONFIGS.guggenheim, filtered to dated rows.
  {
    name: 'Guggenheim',
    method: 'puppeteer',
    configKey: 'guggenheim',
    group: 'puppeteer',
    location: 'Guggenheim Museum',
    address: '1071 5th Ave, New York, NY 10128',
    category: 'art',
    price: 'free',
  },

  // ── Bryant Park ── listing-jsonld shape but detail pages have no JSON-LD;
  // the dated slug (/calendar/event/<slug>/YYYY-MM-DD) is the date source, so we
  // use html + dateFromSlug. All free.
  {
    name: 'Bryant Park',
    method: 'html',
    url: 'https://bryantpark.org/calendar',
    base: 'https://bryantpark.org',
    itemSel: 'li.calendarEventCard',
    titleSel: 'h2.cardTitle',
    dateFromSlug: /\/calendar\/event\/[^/]+\/(\d{4})-(\d{2})-(\d{2})/,
    group: 'perfparks',
    location: 'Bryant Park',
    address: 'Bryant Park, New York, NY 10018',
    category: 'community',
    price: 'free',
    limit: 30,
  },

  // ── NYC Parks ── html: free summer concerts category page. Anchors are
  // /events/YYYY/MM/DD/<slug> — date from slug (normalized to ISO before parse).
  {
    name: 'NYC Parks',
    method: 'html',
    url: 'https://www.nycgovparks.org/events/free_summer_concerts',
    base: 'https://www.nycgovparks.org',
    linkSel: 'a[href^="/events/20"]',
    dateFromSlug: /\/events\/(\d{4})\/(\d{2})\/(\d{2})\//,
    group: 'perfparks',
    location: 'NYC Parks',
    address: 'New York, NY',
    category: 'music',
    price: 'free',
    limit: 30,
  },

  // ── The Local Girl ── html (dateHeader mode): the Hoboken/JC calendar groups
  // events under date-header rows carrying data-date; the item rows have no date
  // of their own. There is no Tribe REST (verified 404), so we walk the list in
  // order tracking the current date from each header — the same technique the
  // bespoke scrapeTheLocalGirl (still wired into `main`) uses. (NJ group.)
  {
    name: 'The Local Girl',
    method: 'html',
    url: 'https://thelocalgirl.com/calendar/hoboken/',
    base: 'https://thelocalgirl.com',
    dateHeaderList: 'ol.eventsList__list',
    dateHeaderClass: 'eventsList__list__dateHeader',
    itemClass: 'eventsList__list__item',
    titleSel: 'h2 a',
    locationFilter: /Hoboken|Jersey City|Newark|Montclair|NJ/i,
    group: 'nj',
    location: 'Jersey City',
    address: 'Jersey City, NJ',
    category: 'community',
    price: 'See details',
    limit: 30,
  },

  // ── SummerStage (City Parks Foundation) ── jsonld: cityparksfoundation.org
  // emits schema.org Event[] with startDate and offers.price ('0' = free).
  {
    name: 'SummerStage',
    method: 'jsonld',
    url: 'https://cityparksfoundation.org/events/',
    base: 'https://cityparksfoundation.org',
    group: 'perfparks',
    location: 'SummerStage (City Parks Foundation)',
    address: 'Central Park, New York, NY',
    category: 'music',
    price: 'free',
    limit: 30,
  },

  // === APPENDED VENUES BELOW ===
  // Downstream merge appends additional venue rows here (before the closing `];`).
  // Keep one object literal per row, each ending with a trailing comma.

];

module.exports = { VENUES };
