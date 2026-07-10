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

// Some hosts (Drupal/WAF sites: Montclair, Socrates, Fergus, Cooper Hewitt…)
// 403 the default gzip/br + keep-alive + Upgrade-Insecure-Requests fingerprint.
// A leaner header set passes cleanly. null strips a default header (see politeGet).
const LEAN_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Encoding': 'identity',
  'Accept-Language': null,
  'Connection': null,
  'Upgrade-Insecure-Requests': null,
};

// A few hosts (Socrates, Fergus McCaffrey) block the repeated Mac-Chrome UA but
// accept a Firefox fingerprint. Same lean, different UA.
const FF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Encoding': 'identity',
  'Accept-Language': null,
  'Connection': null,
  'Upgrade-Insecure-Requests': null,
};

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
  // order tracking the current date from each header. This registry row is now the
  // sole owner (the old bespoke scrapeTheLocalGirl was deleted). Currently in the
  // 'backlog' group — Cloudflare blocks Vercel's IP, so it needs puppeteer to run.
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
    group: 'backlog', // Cloudflare-blocks Vercel's IP → 0 on prod; needs puppeteer
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

  // ══════════════════════════ MUSEUMS ══════════════════════════

  // Rubin — wp-rest enumerate exhibitions (plural cpt), date only on detail page
  // (free-text range). detailDate + body DATE_RANGE_RE → galleryDateRange. Mixes
  // traveling/partner shows + long-past ones; truthpass drops ended/past by end_date.
  {
    name: 'Rubin Museum',
    method: 'wp-rest',
    url: 'https://rubinmuseum.org/wp-json/wp/v2/exhibitions?per_page=50',
    base: 'https://rubinmuseum.org',
    detailDate: true,
    maxDetails: 20,
    group: 'museums',
    location: 'Rubin Museum',
    address: '150 W 17th St, New York, NY 10011',
    category: 'art',
    event_type: 'exhibition',
    price: 'free',
  },

  // Noguchi — wp-rest enumerate exhibition (singular cpt); detail body carries a
  // clean 'Month D, YYYY – Month D, YYYY' range. detailDate + DATE_RANGE_RE.
  {
    name: 'The Noguchi Museum',
    method: 'wp-rest',
    url: 'https://www.noguchi.org/wp-json/wp/v2/exhibition?per_page=50',
    base: 'https://www.noguchi.org',
    detailDate: true,
    maxDetails: 20,
    group: 'museums',
    location: 'The Noguchi Museum',
    address: '9-01 33rd Rd, Long Island City, NY 11106',
    category: 'art',
    event_type: 'exhibition',
    price: 'free',
  },

  // Cooper Hewitt — ch_events cpt; date is a Unix ts in meta._ch_exhibition_on_view_date.
  // No detail fetch needed. Rich upcoming program calendar.
  {
    name: 'Cooper Hewitt',
    method: 'wp-rest',
    url: 'https://www.cooperhewitt.org/wp-json/wp/v2/ch_events?per_page=50',
    base: 'https://www.cooperhewitt.org',
    metaDate: '_ch_exhibition_on_view_date',
    metaEndDate: '_ch_exhibition_to_date',
    headers: { ...LEAN_HEADERS, 'Accept': 'application/json' },
    group: 'museums',
    location: 'Cooper Hewitt',
    address: '2 E 91st St, New York, NY 10128',
    category: 'art',
    event_type: 'program',
    price: 'See details',
    limit: 40,
  },

  // The Jewish Museum — 8 exhibition detail links on listing; no dates on listing,
  // so fetchDetail reads the date range/through-date from the detail body + h1 title.
  {
    name: 'The Jewish Museum',
    method: 'html',
    url: 'https://thejewishmuseum.org/exhibitions/',
    base: 'https://thejewishmuseum.org',
    linkSel: 'a[href*="/exhibitions/"]',
    linkRe: /\/exhibitions\/[a-z0-9-]+\/?$/i,
    fetchDetail: true,
    detailTitleSel: 'h1',
    maxDetails: 12,
    group: 'museums',
    location: 'The Jewish Museum',
    address: '1109 5th Ave, New York, NY 10128',
    category: 'art',
    event_type: 'exhibition',
    price: 'free',
  },

  // MAD — .views-row with two sibling headings: [0]=title, date lives in the row
  // text ('Through Aug 16, 2026'). dateRangeText picks the through-date via THROUGH_RE.
  {
    name: 'Museum of Arts and Design',
    method: 'html',
    url: 'https://madmuseum.org/exhibitions',
    base: 'https://madmuseum.org',
    itemSel: '.views-row',
    titleSel: 'h1,h2,h3,h4,h5',
    linkSel: 'a[href*="/exhibition/"]',
    dateRangeText: true,
    group: 'museums',
    location: 'Museum of Arts and Design',
    address: '2 Columbus Cir, New York, NY 10019',
    category: 'art',
    event_type: 'exhibition',
    price: 'free',
  },

  // MCNY — article cards; title from heading, link to /exhibition/. Cards sometimes
  // lack an inline date → fetchDetail reads 'Through <date>' from the detail body.
  {
    name: 'Museum of the City of New York',
    method: 'html',
    url: 'https://www.mcny.org/exhibitions',
    base: 'https://www.mcny.org',
    itemSel: 'article',
    titleSel: 'h1,h2,h3,h4',
    linkSel: 'a[href*="/exhibition/"]',
    linkRe: /\/exhibition\/[a-z0-9-]+$/i,
    dateRangeText: true,
    fetchDetail: true,
    detailTitleSel: 'h1',
    maxDetails: 20,
    group: 'museums',
    location: 'Museum of the City of New York',
    address: '1220 5th Ave, New York, NY 10029',
    category: 'art',
    event_type: 'exhibition',
    price: 'free',
  },

  // Japan Society — events cpt; date is yearless in yoast og_description ('July 23 at 5:30 PM').
  // yoastDate infers year from post date, rolls to next year if already past.
  {
    name: 'Japan Society',
    method: 'wp-rest',
    url: 'https://japansociety.org/wp-json/wp/v2/events?per_page=50',
    base: 'https://japansociety.org',
    yoastDate: true,
    group: 'museums',
    location: 'Japan Society',
    address: '333 E 47th St, New York, NY 10017',
    category: 'art',
    event_type: 'program',
    price: 'See details',
    limit: 30,
  },

  // ══════════════════════════ FILM ══════════════════════════

  // Film Forum — only the dated 'Upcoming Events' special screenings are reliably
  // dated: their /events/event/<slug>-<month>-<day> slug carries the date. Repertory
  // now_playing LD has empty startDates. linkRe keeps only the date-suffixed slugs.
  {
    name: 'Film Forum',
    method: 'html',
    url: 'https://filmforum.org/now_playing',
    base: 'https://filmforum.org',
    linkSel: 'a[href*="/events/event/"]',
    linkRe: /-(?:january|february|march|april|may|june|july|august|september|october|november|december)-\d{1,2}\/?$/i,
    dateFromSlug: /-(january|february|march|april|may|june|july|august|september|october|november|december)-(\d{1,2})\/?$/i,
    group: 'film',
    location: 'Film Forum',
    address: '209 W Houston St, New York, NY 10014',
    category: 'art',
    event_type: 'screening',
    price: 'See details',
    limit: 30,
  },

  // Anthology — ?view=list; each .film-showing item's date is the nearest preceding
  // h3 day-header ('Friday, July 3'). Title in .film-title; dedupe on #showing-<id>.
  {
    name: 'Anthology Film Archives',
    method: 'html',
    url: 'https://www.anthologyfilmarchives.org/film_screenings/calendar?view=list',
    base: 'https://www.anthologyfilmarchives.org',
    itemSel: '.film-showing',
    titleSel: '.film-title',
    linkSel: 'a[href*="showing-"]',
    keepHash: true,
    precedingHeaderSel: 'h3',
    group: 'film',
    location: 'Anthology Film Archives',
    address: '32 Second Ave, New York, NY 10003',
    category: 'art',
    event_type: 'screening',
    price: 'See details',
    limit: 40,
  },

  // IFC Center — coming-soon lists /films/<slug>; each detail page has clean h1 +
  // '.daily-schedule h3' first upcoming day ('Fri Jul 10'). fetchDetail resolves both.
  {
    name: 'IFC Center',
    method: 'html',
    url: 'https://www.ifccenter.com/coming-soon/',
    base: 'https://www.ifccenter.com',
    linkSel: 'a[href*="/films/"]',
    linkRe: /\/films\/[^/]+\/?$/,
    fetchDetail: true,
    detailTitleSel: 'h1',
    detailDateSel: '.daily-schedule h3',
    maxDetails: 18,
    group: 'film',
    location: 'IFC Center',
    address: '323 Sixth Ave, New York, NY 10014',
    category: 'art',
    event_type: 'screening',
    price: 'See details',
  },

  // Metrograph — homepage /film/?vista_film_id=<id>; detail h1 + '.showtimes h6'
  // first day ('Fri Jul 10'). fetchDetail resolves title + date.
  {
    name: 'Metrograph',
    method: 'html',
    url: 'https://metrograph.com/',
    base: 'https://metrograph.com',
    linkSel: 'a[href*="vista_film_id"]',
    fetchDetail: true,
    detailTitleSel: 'h1',
    detailDateSel: '.showtimes h6',
    maxDetails: 18,
    group: 'film',
    location: 'Metrograph',
    address: '7 Ludlow St, New York, NY 10002',
    category: 'art',
    event_type: 'screening',
    price: 'See details',
  },

  // Quad Cinema — homepage /film/<slug>; h1 is an SVG so title from <title> tag,
  // date from 'p.date' first day ('Fri July 10'). fetchDetail with title fallback.
  {
    name: 'Quad Cinema',
    method: 'html',
    url: 'https://quadcinema.com/',
    base: 'https://quadcinema.com',
    linkSel: 'a[href*="/film/"]',
    linkRe: /\/film\/[^/]+\/?$/,
    fetchDetail: true,
    detailTitleSel: 'title',
    detailDateSel: 'p.date',
    maxDetails: 15,
    group: 'film',
    location: 'Quad Cinema',
    address: '34 W 13th St, New York, NY 10011',
    category: 'art',
    event_type: 'screening',
    price: 'See details',
  },

  // ══════════════════════════ LITERARY ══════════════════════════

  // Rizzoli — listing links to Eventbrite; each EB detail carries a single Event
  // JSON-LD with startDate. listing-jsonld follows the EB links.
  {
    name: 'Rizzoli Bookstore',
    method: 'listing-jsonld',
    url: 'https://www.rizzolibookstore.com/upcoming-events',
    base: 'https://www.rizzolibookstore.com',
    linkSel: 'a[href*="eventbrite.com/e/"]',
    maxDetails: 20,
    group: 'literary',
    location: 'Rizzoli Bookstore',
    address: '1133 Broadway, New York, NY 10010',
    category: 'community',
    event_type: 'reading',
    price: 'See details',
  },

  // The Center for Fiction — /event/<slug> (singular) detail links; date is inline
  // 'Month D, YYYY' on the card, title only on detail h1 → fetchDetail for both.
  {
    name: 'The Center for Fiction',
    method: 'html',
    url: 'https://centerforfiction.org/events/',
    base: 'https://centerforfiction.org',
    linkSel: 'a[href*="/event/"]',
    linkRe: /\/event\/[a-z0-9-]+\/?$/i,
    dateRangeText: true,
    fetchDetail: true,
    detailTitleSel: 'h1',
    maxDetails: 15,
    group: 'literary',
    location: 'The Center for Fiction',
    address: '15 Lafayette Ave, Brooklyn, NY 11217',
    category: 'community',
    event_type: 'reading',
    price: 'See details',
  },

  // ══════════════════════════ PERFPARKS ══════════════════════════

  {
    name: "St. Ann's Warehouse",
    method: 'tribe',
    url: 'https://stannswarehouse.org/wp-json/tribe/events/v1/events?per_page=50',
    base: 'https://stannswarehouse.org',
    group: 'perfparks',
    location: "St. Ann's Warehouse",
    address: '45 Water St, Brooklyn, NY 11201',
    category: 'art',
    event_type: 'performance',
    price: 'See details',
  },

  {
    name: 'Green-Wood Cemetery',
    method: 'tribe',
    url: 'https://www.green-wood.com/wp-json/tribe/events/v1/events?per_page=50',
    base: 'https://www.green-wood.com',
    group: 'perfparks',
    location: 'Green-Wood Cemetery',
    address: '500 25th St, Brooklyn, NY 11232',
    category: 'community',
    event_type: 'tour',
    price: 'See details',
  },

  {
    name: 'Little Island',
    method: 'tribe',
    url: 'https://littleisland.org/wp-json/tribe/events/v1/events?per_page=50',
    base: 'https://littleisland.org',
    group: 'perfparks',
    location: 'Little Island',
    address: 'Pier 55 at Hudson River Park, W 13th St, New York, NY 10014',
    category: 'art',
    event_type: 'performance',
    price: 'See details',
  },

  // Bargemusic — homepage LD-JSON Event[] with startDate. Detail urls use www host.
  {
    name: 'Bargemusic',
    method: 'jsonld',
    url: 'https://bargemusic.org/',
    base: 'https://www.bargemusic.org',
    group: 'perfparks',
    location: 'Bargemusic',
    address: 'Fulton Ferry Landing, Brooklyn, NY 11201',
    category: 'music',
    event_type: 'concert',
    price: 'See details',
    limit: 30,
  },

  // Roulette — /calendar/ SSR .event cards; date in .event-time ('Sunday, September
  // 13, 2026. 8:00 pm'). Tribe REST disabled, so html on listing.
  {
    name: 'Roulette Intermedium',
    method: 'html',
    url: 'https://roulette.org/calendar/',
    base: 'https://roulette.org',
    itemSel: '.event',
    titleSel: '.event-title a',
    linkSel: '.event-title a',
    dateSel: '.event-time',
    group: 'perfparks',
    location: 'Roulette Intermedium',
    address: '509 Atlantic Ave, Brooklyn, NY 11217',
    category: 'music',
    event_type: 'concert',
    price: 'See details',
  },

  // Brooklyn Bridge Park — wp/v2/events cpt; date in acf.date ('YYYYMMDD') + start_time.
  // Skip non-Scheduled. Free community programming.
  {
    name: 'Brooklyn Bridge Park',
    method: 'wp-rest',
    url: 'https://brooklynbridgepark.org/wp-json/wp/v2/events?per_page=50&_embed',
    base: 'https://brooklynbridgepark.org',
    acfDate: 'date',
    statusField: 'status',
    statusOk: 'Scheduled',
    group: 'perfparks',
    location: 'Brooklyn Bridge Park',
    address: '334 Furman St, Brooklyn, NY 11201',
    category: 'community',
    event_type: 'program',
    price: 'free',
    limit: 40,
  },

  // National Sawdust — Webflow /performances; .category-title-date holds the date,
  // but the listing title is not clean → fetchDetail reads <title> for the name.
  {
    name: 'National Sawdust',
    method: 'html',
    url: 'https://www.nationalsawdust.org/performances',
    base: 'https://www.nationalsawdust.org',
    itemSel: 'div.collection-item-_cms_350px',
    linkSel: 'a[href^="/event/"]',
    dateSel: '.category-title-date',
    fetchDetail: true,
    detailTitleSel: 'title',
    maxDetails: 20,
    limit: 20,
    group: 'perfparks',
    location: 'National Sawdust',
    address: '80 N 6th St, Brooklyn, NY 11249',
    category: 'music',
    event_type: 'concert',
    price: 'See details',
  },

  // NYBG — two-stage: listing /event/ links → each detail Event JSON-LD startDate.
  // Recurring info pages (no Event LD) are correctly dropped.
  {
    name: 'New York Botanical Garden',
    method: 'listing-jsonld',
    url: 'https://www.nybg.org/things-to-do/calendar/',
    base: 'https://www.nybg.org',
    linkSel: 'a[href*="/event/"]',
    maxDetails: 25,
    group: 'perfparks',
    location: 'New York Botanical Garden',
    address: '2900 Southern Blvd, Bronx, NY 10458',
    category: 'community',
    event_type: 'garden program',
    price: 'free',
  },

  // Brooklyn Botanic Garden — #event-calendar-regular li with inline date range
  // ('July 8–August 14, 2026') → galleryDateRange via dateRangeText.
  {
    name: 'Brooklyn Botanic Garden',
    method: 'html',
    url: 'https://www.bbg.org/calendar',
    base: 'https://www.bbg.org',
    itemSel: '#event-calendar-regular li',
    titleSel: 'h3',
    linkSel: 'a[href*="/visit/event/"]',
    dateRangeText: true,
    group: 'perfparks',
    location: 'Brooklyn Botanic Garden',
    address: '990 Washington Ave, Brooklyn, NY 11225',
    category: 'community',
    event_type: 'garden program',
    price: 'free',
    limit: 40,
  },

  // Wave Hill — h3.event__title items; date text 'Fri, Jul 10, 2026 | 5:30PM' inline.
  {
    name: 'Wave Hill',
    method: 'html',
    url: 'https://www.wavehill.org/events/',
    base: 'https://www.wavehill.org',
    itemSel: '.event',
    titleSel: 'h3.event__title',
    linkSel: 'a[href*="/calendar/"]',
    dateRangeText: true,
    group: 'perfparks',
    location: 'Wave Hill',
    address: 'W 249th St & Independence Ave, Bronx, NY 10471',
    category: 'community',
    event_type: 'garden program',
    price: 'free',
  },

  // Socrates Sculpture Park — /programs/all/ .card with .spacing-afterdate ('Jul 11, 2026').
  {
    name: 'Socrates Sculpture Park',
    method: 'html',
    url: 'https://socratessculpturepark.org/programs/all/',
    base: 'https://socratessculpturepark.org',
    itemSel: '.card',
    titleSel: 'h1,h2,h3,h4',
    linkSel: 'a[href*="/programevent/"]',
    dateSel: '.spacing-afterdate',
    headers: FF_HEADERS,
    group: 'perfparks',
    location: 'Socrates Sculpture Park',
    address: '32-01 Vernon Blvd, Long Island City, NY 11106',
    category: 'community',
    event_type: 'park program',
    price: 'free',
    limit: 40,
  },

  // Snug Harbor — wp/v2/event cpt; REST meta empty, so detailDate reads the detail
  // page's schema.org Event JSON-LD startDate.
  {
    name: 'Snug Harbor Cultural Center & Botanical Garden',
    method: 'wp-rest',
    url: 'https://snug-harbor.org/wp-json/wp/v2/event?per_page=50&_embed',
    base: 'https://snug-harbor.org',
    detailDate: true,
    detailJsonld: true,
    maxDetails: 20,
    group: 'perfparks',
    location: 'Snug Harbor Cultural Center & Botanical Garden',
    address: '1000 Richmond Terrace, Staten Island, NY 10301',
    category: 'community',
    event_type: 'cultural program',
    price: 'free',
  },

  // ══════════════════════════ GALLERIES ══════════════════════════
  // All NYC design/art galleries. Anchor/container text carries the inline date
  // range → dateRangeText + galleryDateRange; date + address stripped from title.

  {
    name: 'Friedman Benda',
    method: 'html',
    url: 'https://www.friedmanbenda.com/exhibitions/',
    base: 'https://www.friedmanbenda.com',
    itemSel: 'li.ms-image',
    titleSel: 'h1.entry-title',
    linkSel: 'a[href*="/exhibitions/"]',
    dateRangeText: true,
    group: 'galleries',
    location: 'Friedman Benda',
    address: '515 W 26th St, New York, NY 10001',
    category: 'art',
    event_type: 'exhibition',
    price: 'free',
  },

  {
    name: 'R & Company',
    method: 'html',
    url: 'https://www.r-and-company.com/exhibitions/',
    base: 'https://r-and-company.com',
    linkSel: 'a[href*="/exhibition/"]',
    linkRe: /\/exhibition\/[^/]+\/?$/,
    dateRangeText: true,
    group: 'galleries',
    location: 'R & Company',
    address: '64 White St, New York, NY 10013',
    category: 'art',
    event_type: 'exhibition',
    price: 'free',
  },

  {
    name: 'Andrew Kreps',
    method: 'html',
    url: 'https://www.andrewkreps.com/exhibitions',
    base: 'https://www.andrewkreps.com',
    linkSel: 'a[href*="/exhibitions/"]',
    linkRe: /\/exhibitions\/[^/]+$/,
    excludeLink: /\/exhibitions\/past/,
    dateRangeText: true,
    group: 'galleries',
    limit: 18,
    location: 'Andrew Kreps',
    address: '22 Cortlandt Alley & 394 Broadway, New York, NY 10013',
    category: 'art',
    event_type: 'exhibition',
    price: 'free',
  },

  {
    name: 'Paula Cooper Gallery',
    method: 'html',
    url: 'https://www.paulacoopergallery.com/exhibitions',
    base: 'https://www.paulacoopergallery.com',
    linkSel: 'a[href*="/exhibitions/"]',
    linkRe: /\/exhibitions\/[^/]+$/,
    excludeLink: /\/exhibitions\/past/,
    dateRangeText: true,
    group: 'galleries',
    limit: 18,
    location: 'Paula Cooper Gallery',
    address: '524 W 26th St, New York, NY 10001',
    category: 'art',
    event_type: 'exhibition',
    price: 'free',
  },

  {
    name: 'Luhring Augustine',
    method: 'html',
    url: 'https://www.luhringaugustine.com/exhibitions',
    base: 'https://www.luhringaugustine.com',
    linkSel: 'a[href*="/exhibitions/"]',
    linkRe: /\/exhibitions\/[^/]+$/,
    excludeLink: /\/exhibitions\/past/,
    dateRangeText: true,
    fetchDetail: true,
    detailTitleSel: 'h1',
    maxDetails: 12,
    group: 'galleries',
    location: 'Luhring Augustine',
    address: '531 W 24th St, New York, NY 10011',
    category: 'art',
    event_type: 'exhibition',
    price: 'free',
  },

  {
    name: 'kurimanzutto New York',
    method: 'html',
    url: 'https://www.kurimanzutto.com/exhibitions',
    base: 'https://www.kurimanzutto.com',
    linkSel: 'a[href*="/exhibitions/"]',
    linkRe: /\/exhibitions\/[^/]+$/,
    excludeLink: /\/exhibitions\/past/,
    dateRangeText: true,
    locationFilter: /new york|hudson/i,
    group: 'galleries',
    limit: 18,
    location: 'kurimanzutto New York',
    address: '516 W 20th St, New York, NY 10011',
    category: 'art',
    event_type: 'exhibition',
    price: 'free',
  },

  {
    name: '303 Gallery',
    method: 'html',
    url: 'https://www.303gallery.com/gallery-exhibitions/upcoming',
    base: 'https://www.303gallery.com',
    linkSel: 'a[href*="/gallery-exhibitions/"]',
    linkRe: /\/gallery-exhibitions\/[^/]+$/,
    excludeLink: /\/gallery-exhibitions\/(past|upcoming|public)/,
    dateRangeText: true,
    fetchDetail: true,
    detailTitleSel: 'h1',
    maxDetails: 12,
    group: 'galleries',
    location: '303 Gallery',
    address: '555 W 21st St, New York, NY 10011',
    category: 'art',
    event_type: 'exhibition',
    price: 'free',
  },

  {
    name: 'Fergus McCaffrey',
    method: 'html',
    url: 'https://www.fergusmccaffrey.com/exhibitions',
    base: 'https://fergusmccaffrey.com',
    linkSel: 'a[href*="/exhibition/"]',
    linkRe: /\/exhibition\/[^/]+\/?$/,
    dateRangeText: true,
    headers: FF_HEADERS,
    group: 'galleries',
    location: 'Fergus McCaffrey',
    address: '514 W 26th St, New York, NY 10001',
    category: 'art',
    event_type: 'exhibition',
    price: 'free',
  },

  {
    name: 'Bruce Silverstein Gallery',
    method: 'html',
    url: 'https://brucesilverstein.com/exhibitions/',
    base: 'https://brucesilverstein.com',
    linkSel: 'a[href*="/overview/"]',
    fetchDetail: true,
    detailTitleSel: 'h1',
    maxDetails: 14,
    group: 'galleries',
    location: 'Bruce Silverstein Gallery',
    address: '529 W 20th St, 3rd Fl, New York, NY 10011',
    category: 'art',
    event_type: 'exhibition',
    price: 'free',
  },

  {
    name: 'Bortolami',
    method: 'html',
    url: 'https://www.bortolamigallery.com/exhibitions/',
    base: 'https://www.bortolamigallery.com',
    linkSel: 'a[href*="/exhibitions/"]',
    linkRe: /\/exhibitions\/[^/]+$/,
    excludeLink: /\/exhibitions\/past/,
    dateRangeText: true,
    group: 'galleries',
    limit: 18,
    location: 'Bortolami',
    address: '39 Walker St, New York, NY 10013',
    category: 'art',
    event_type: 'exhibition',
    price: 'free',
  },

  {
    name: 'Chapter NY',
    method: 'html',
    url: 'https://www.chapter-ny.com/exhibitions/current',
    base: 'https://www.chapter-ny.com',
    linkSel: 'a[href*="/exhibitions/"]',
    linkRe: /\/exhibitions\/[a-z0-9-]+\/?$/i,
    excludeLink: /\/exhibitions\/(current|upcoming|past)/,
    fetchDetail: true,
    maxDetails: 10,
    headers: LEAN_HEADERS,
    group: 'galleries',
    location: 'Chapter NY',
    address: '60 Walker St, New York, NY 10013',
    category: 'art',
    event_type: 'exhibition',
    price: 'free',
  },

  // Center for Architecture (AIANY) — .event[data-date-raw] carries a machine date
  // (YYYYMMDD); dateAttr reads it. Link + title in h2.EventNameL a.
  {
    name: 'Center for Architecture',
    method: 'html',
    url: 'https://calendar.aiany.org/',
    base: 'https://calendar.aiany.org',
    itemSel: '.event[data-date-raw]',
    titleSel: 'h2.EventNameL a',
    linkSel: 'h2.EventNameL a',
    dateAttr: 'data-date-raw',
    group: 'galleries',
    location: 'Center for Architecture',
    address: '536 LaGuardia Pl, New York, NY 10012',
    category: 'art',
    event_type: 'exhibition',
    price: 'See details',
    limit: 40,
  },

  // ══════════════════════════ NEW JERSEY ══════════════════════════

  {
    name: 'Hoboken Historical Museum',
    method: 'tribe',
    url: 'https://hobokenmuseum.org/wp-json/tribe/events/v1/events?per_page=50',
    base: 'https://hobokenmuseum.org',
    group: 'nj',
    location: 'Hoboken Historical Museum',
    address: '1301 Hudson St, Hoboken, NJ 07030',
    category: 'community',
    event_type: 'program',
    price: 'See details',
  },

  {
    name: 'Barrow Mansion',
    method: 'tribe',
    url: 'https://barrowmansion.org/wp-json/tribe/events/v1/events?per_page=50',
    base: 'https://barrowmansion.org',
    group: 'nj',
    location: 'Barrow Mansion',
    address: '83 Wayne St, Jersey City, NJ 07302',
    category: 'community',
    event_type: 'program',
    price: 'See details',
  },

  // SMUSH — Squarespace event collection; events live in the `upcoming` array.
  {
    name: 'SMUSH Gallery',
    method: 'squarespace',
    url: 'https://www.smushgallery.com/calendar?format=json',
    base: 'https://www.smushgallery.com',
    group: 'nj',
    location: 'SMUSH Gallery',
    address: '340 Summit Ave, Jersey City, NJ 07306',
    category: 'art',
    event_type: 'exhibition',
    price: 'See details',
  },

  // Art House Productions — Shopify; date lives in product title after the pipe.
  {
    name: 'Art House Productions',
    method: 'shopify',
    url: 'https://arthouseproductions.org/collections/upcomingevents/products.json?limit=50',
    base: 'https://arthouseproductions.org',
    group: 'backlog', // Cloudflare-blocks Vercel's IP → 0 on prod; needs puppeteer

    location: 'Art House Productions',
    address: '345 Marin Blvd, Jersey City, NJ 07302',
    category: 'art',
    event_type: 'performance',
    price: 'See details',
  },

  // NJPAC — .content-listing-card[data-performances] JSON array; first entry is
  // 'YYYY-MM-DD HH:mm'. dateAttr + dateAttrJson reads it.
  {
    name: 'NJPAC',
    method: 'html',
    url: 'https://www.njpac.org/events/',
    base: 'https://www.njpac.org',
    itemSel: '.content-listing-card[data-performances]',
    titleSel: 'h3, .content-listing-card__title',
    linkSel: 'a.content-listing-card__image-link',
    dateAttr: 'data-performances',
    dateAttrJson: true,
    group: 'nj',
    location: 'New Jersey Performing Arts Center',
    address: '1 Center St, Newark, NJ 07102',
    category: 'music',
    event_type: 'performance',
    price: 'See details',
    limit: 40,
  },

  // Montclair Art Museum — Drupal .views-row with time[datetime] ISO date.
  {
    name: 'Montclair Art Museum',
    method: 'html',
    url: 'https://www.montclairartmuseum.org/events',
    base: 'https://www.montclairartmuseum.org',
    itemSel: '.views-row',
    titleSel: 'h3 a',
    linkSel: 'a[href^="/events/"]',
    dateSel: 'time[datetime]',
    headers: LEAN_HEADERS,
    group: 'backlog', // 403 Cloudflare on Vercel's IP → 0 on prod; needs puppeteer
    location: 'Montclair Art Museum',
    address: '3 South Mountain Ave, Montclair, NJ 07042',
    category: 'art',
    event_type: 'program',
    price: 'See details',
  },

];

module.exports = { VENUES };
