const { Pool } = require('pg');
const { put } = require('@vercel/blob');
const { readFile } = require('fs/promises');
const { join } = require('path');
const { generateSocialCard } = require('../lib/social-image');
const { postCarousel, refreshTokenIfNeeded } = require('../lib/instagram');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Category config: DB category value → display name + card order
const CATEGORIES = [
  { dbCategory: 'art', displayName: 'Art & Culture' },
  { dbCategory: 'perks', displayName: 'Perks & Pop-Ups' },
  { dbCategory: 'culinary', displayName: 'Food & Drink' },
];

// Region classification (mirrors client-side getEventRegion in app.js)
// Catches Hoboken, Jersey City, and broader NJ events (e.g. from The Local Girl)
function getEventRegion(event) {
  const loc = (event.location || '').toLowerCase();
  const addr = (event.address || '').toLowerCase();
  const combined = loc + ' ' + addr;
  if (combined.includes('hoboken') || combined.includes('jersey city') ||
      combined.includes(', nj')) return 'hoboken-jc';
  return 'nyc';
}

// City classification within the hoboken-jc region
function getCity(event) {
  const loc = (event.location || '').toLowerCase();
  const addr = (event.address || '').toLowerCase();
  if (loc.includes('hoboken') || addr.includes('hoboken')) return 'hoboken';
  return 'jersey-city';
}

const CITIES = [
  { id: 'jersey-city', displayName: 'Jersey City' },
  { id: 'hoboken', displayName: 'Hoboken' },
];

// Two separate carousel posts — one per region
// coverImage: static PNG prepended as first carousel slide
const REGIONS = [
  { id: 'hoboken-jc', label: 'JC / Hoboken', slug: 'jc-hoboken', coverImage: 'jc-hoboken-cover.png' },
  { id: 'nyc', label: 'NYC', slug: 'nyc', coverImage: 'nyc-cover.png' },
];

// Per-region base hashtags (10 each)
const REGION_HASHTAGS = {
  'hoboken-jc': '#JerseyCity #Hoboken #JCMakeItYours #HobokenNJ #JerseyCityNJ #JCNJ #HudsonCounty #Soiree #SoireeToday #FreeJC',
  'nyc': '#NYC #NewYorkCity #NYCEvents #ThingsToDoNYC #NYCLife #NewYork #WeekendNYC #Soiree #SoireeToday #FreeNYC',
};

// Per-region category hashtags (5 each × 3 categories = 15)
const CATEGORY_HASHTAGS = {
  'hoboken-jc': {
    'Art & Culture': '#JCArt #HobokenArt #HudsonCountyArts #JCArtWalk #NJArt',
    'Perks & Pop-Ups': '#JCPopUp #HobokenDeals #JerseyDeals #HobokenPopUp #JCDeals',
    'Food & Drink': '#JCEats #HobokenFood #JCFoodie #HobokenEats #HobokenFoodie',
  },
  'nyc': {
    'Art & Culture': '#NYCArt #ArtGallery #NYCCulture #ArtExhibition #ArtLovers',
    'Perks & Pop-Ups': '#NYCPerks #PopUpNYC #SampleSale #NYCDeals #PopUpShop',
    'Food & Drink': '#NYCFood #NYCFoodie #NYCEats #NYCDining #FoodieNYC',
  },
};

function formatDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatEventDetail(event) {
  let detail = '';
  if (event.start_date) {
    const dt = event.start_date instanceof Date ? event.start_date : new Date(event.start_date);
    if (!isNaN(dt.getTime())) {
      detail = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  }
  if (event.location) detail += (detail ? ' \u00b7 ' : '') + event.location;
  return detail;
}

// ── Weekend Roundup helpers ──────────────────────────────────────

const WEEKEND_HASHTAGS = '#NYC #NewYorkCity #WeekendNYC #ThingsToDoNYC #JerseyCity #Hoboken #WeekendVibes #FreeThingsToDo #NYCEvents #NYCWeekend #Soiree #SoireeToday #FreeNYC #FreeJC #WeekendRoundUp';

const DAY_EMOJIS = {
  'New York · Friday': '\ud83c\udf1f',
  'New York · Saturday': '\u2728',
  'New York · Sunday': '\u2615',
  'Hoboken & JC · Friday': '\ud83c\udfd9\ufe0f',
  'Hoboken & JC · Saturday': '\ud83c\udf09',
  'Hoboken & JC · Sunday': '\u2600\ufe0f',
};

function buildWeekendCaption(slides, weekendLabel, totalEvents) {
  const MAX_EVENTS_PER_SECTION = 5;
  const sections = [];

  for (const { displayName, events } of slides) {
    if (events.length === 0) continue;
    const emoji = DAY_EMOJIS[displayName] || '';
    const shown = events.slice(0, MAX_EVENTS_PER_SECTION);
    const lines = shown.map(e => {
      let detail = '';
      if (e.location) detail = e.location;
      return `\u2022 ${e.name}${detail ? ' \u2014 ' + detail : ''}`;
    }).join('\n');
    const more = events.length > MAX_EVENTS_PER_SECTION
      ? `\n  + ${events.length - MAX_EVENTS_PER_SECTION} more on soiree.today`
      : '';
    sections.push(`${emoji} ${displayName}\n${lines}${more}`);
  }

  if (sections.length === 0) return null;

  let caption = [
    `Weekend Round Up \u2014 ${totalEvents} free events this weekend (${weekendLabel})`,
    '',
    sections.join('\n\n'),
    '',
    'Full lineup at soiree.today',
    '',
    WEEKEND_HASHTAGS,
  ].join('\n').trim();

  // Trim if over 2200 chars — drop hashtags first, then truncate sections
  if (caption.length > 2200) {
    caption = [
      `Weekend Round Up \u2014 ${totalEvents} free events this weekend (${weekendLabel})`,
      '',
      sections.join('\n\n'),
      '',
      'Full lineup at soiree.today',
    ].join('\n').trim();
  }

  return caption;
}

async function handleWeekendRoundup(req, res, isDryRun) {
  // Calculate Fri/Sat/Sun dates for this weekend
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 5=Fri, 6=Sat

  // Find this coming Friday (or today if already Fri/Sat/Sun)
  let friday;
  if (dayOfWeek === 5) friday = new Date(today);
  else if (dayOfWeek === 6) { friday = new Date(today); friday.setDate(today.getDate() - 1); }
  else if (dayOfWeek === 0) { friday = new Date(today); friday.setDate(today.getDate() - 2); }
  else { friday = new Date(today); friday.setDate(today.getDate() + (5 - dayOfWeek)); }

  const saturday = new Date(friday); saturday.setDate(friday.getDate() + 1);
  const sunday = new Date(friday); sunday.setDate(friday.getDate() + 2);

  const friStr = formatDateLocal(friday);
  const satStr = formatDateLocal(saturday);
  const sunStr = formatDateLocal(sunday);

  const weekendLabel = friday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    + ' \u2013 ' + sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  console.log(`Weekend Roundup: ${weekendLabel} (${friStr} to ${sunStr})`);

  // Fetch Fri-Sun events
  const { rows: allEvents } = await pool.query(
    `SELECT * FROM events
     WHERE start_date >= $1 AND start_date <= $2
     ORDER BY start_date ASC, created_at DESC`,
    [friStr, sunStr]
  );

  console.log(`Found ${allEvents.length} weekend events`);

  if (allEvents.length === 0) {
    return res.status(200).json({ success: true, skipped: true, reason: 'No weekend events' });
  }

  const token = (process.env.INSTAGRAM_ACCESS_TOKEN || '').trim();
  const igUserId = (process.env.INSTAGRAM_USER_ID || '').trim();
  if (!isDryRun) {
    if (!token) throw new Error('Missing INSTAGRAM_ACCESS_TOKEN env var');
    if (!igUserId) throw new Error('Missing INSTAGRAM_USER_ID env var');
  }

  const dateSlug = friStr.replace(/-/g, '');
  const runId = Date.now();

  // Split events by region
  const nycEvents = allEvents.filter(e => getEventRegion(e) === 'nyc');
  const hjcEvents = allEvents.filter(e => getEventRegion(e) === 'hoboken-jc');

  // Helper to filter by day
  const byDay = (events, dayStr) => events.filter(e => {
    const d = e.start_date instanceof Date ? e.start_date : new Date(e.start_date);
    return formatDateLocal(d) === dayStr;
  });

  // Split by day
  const nycFri = byDay(nycEvents, friStr);
  const nycSat = byDay(nycEvents, satStr);
  const nycSun = byDay(nycEvents, sunStr);
  const hjcFri = byDay(hjcEvents, friStr);
  const hjcSat = byDay(hjcEvents, satStr);
  const hjcSun = byDay(hjcEvents, sunStr);

  const totalEvents = allEvents.length;

  // Slides: NYC Fri/Sat/Sun, then Hoboken & JC Fri/Sat/Sun
  const slides = [
    { displayName: 'New York · Friday', events: nycFri },
    { displayName: 'New York · Saturday', events: nycSat },
    { displayName: 'New York · Sunday', events: nycSun },
    { displayName: 'Hoboken & JC · Friday', events: hjcFri },
    { displayName: 'Hoboken & JC · Saturday', events: hjcSat },
    { displayName: 'Hoboken & JC · Sunday', events: hjcSun },
  ];

  console.log(`Slides: ${slides.map(s => `${s.displayName}=${s.events.length}`).join(', ')}`);

  // Generate card images for each slide
  console.log('Generating weekend card images...');
  const cards = await Promise.all(
    slides.map(({ displayName, events }) =>
      generateSocialCard(displayName, events, weekendLabel, totalEvents, { metaField: 'location' })
    )
  );

  // Upload images
  console.log('Uploading weekend images to Vercel Blob...');
  const imageUrls = [];

  // Slide 1: cover image
  const coverBuffer = await readFile(join(process.cwd(), 'assets', 'images', 'weekend-roundup-cover.png'));
  const coverBlob = await put(
    'instagram/weekend-roundup-cover.png',
    coverBuffer,
    { access: 'public', contentType: 'image/png', addRandomSuffix: false, allowOverwrite: true }
  );
  console.log(`  Cover: ${coverBlob.url}`);
  imageUrls.push(coverBlob.url);

  // Slides 2-6: generated cards
  for (let i = 0; i < cards.length; i++) {
    const slug = slides[i].displayName.toLowerCase().replace(/[^a-z]/g, '-');
    const blob = await put(
      `instagram/${dateSlug}-weekend-${slug}-${runId}.png`,
      cards[i],
      { access: 'public', contentType: 'image/png', addRandomSuffix: false }
    );
    console.log(`  ${slides[i].displayName}: ${blob.url}`);
    imageUrls.push(blob.url);
  }

  // Build caption
  const caption = buildWeekendCaption(slides, weekendLabel, totalEvents);
  console.log(`Weekend caption length: ${caption.length} / 2200 chars`);

  if (isDryRun) {
    return res.status(200).json({
      success: true,
      dryRun: true,
      mode: 'weekend',
      weekendLabel,
      totalEvents,
      slides: slides.map(s => ({ name: s.displayName, count: s.events.length })),
      imageUrls,
      caption,
      captionLength: caption.length,
    });
  }

  // Post carousel
  console.log('Posting weekend roundup carousel to Instagram...');
  const mediaId = await postCarousel(igUserId, imageUrls, caption, token);
  console.log(`Weekend roundup published! Media ID: ${mediaId}`);

  // Log activity
  await pool.query(
    `INSERT INTO activity_log (type, event_count, detail) VALUES ('instagram', $1, $2)`,
    [totalEvents, 'Weekend Roundup']
  ).catch(() => {});

  return res.status(200).json({
    success: true,
    mode: 'weekend',
    mediaId,
    weekendLabel,
    totalEvents,
    imageUrls,
  });
}

// ── Weekly post helpers ─────────────────────────────────────────

function buildCaption(categoryEvents, weekLabel, regionId, regionLabel) {
  const sections = [];

  const sectionEmojis = {
    'Art & Culture': '\ud83c\udfa8',
    'Perks & Pop-Ups': '\ud83c\udf81',
    'Food & Drink': '\ud83c\udf7d\ufe0f',
    'Jersey City': '\ud83c\udfd9\ufe0f',
    'Hoboken': '\ud83c\udf09',
  };

  const MAX_EVENTS_PER_SECTION = 6;

  for (const { displayName, events } of categoryEvents) {
    if (events.length === 0) continue;
    const emoji = sectionEmojis[displayName] || '';
    const shown = events.slice(0, MAX_EVENTS_PER_SECTION);
    const lines = shown.map(e => `\u2022 ${e.name} \u2014 ${formatEventDetail(e)}`).join('\n');
    const more = events.length > MAX_EVENTS_PER_SECTION
      ? `\n  + ${events.length - MAX_EVENTS_PER_SECTION} more on soiree.today`
      : '';
    sections.push(`${emoji} ${displayName}\n${lines}${more}`);
  }

  if (sections.length === 0) return null;

  const totalEvents = categoryEvents.reduce((sum, c) => sum + c.events.length, 0);

  const baseHashtags = REGION_HASHTAGS[regionId] || REGION_HASHTAGS['nyc'];
  const catTags = categoryEvents
    .filter(c => c.events.length > 0)
    .map(c => (CATEGORY_HASHTAGS[regionId] || {})[c.displayName] || '')
    .join(' ');

  let caption = [
    `This week in ${regionLabel} \u2014 ${totalEvents} curated free events (${weekLabel})`,
    '',
    sections.join('\n\n'),
    '',
    'Discover the full lineup at soiree.today',
    '',
    baseHashtags,
    catTags,
  ].join('\n').trim();

  // Instagram caption limit is 2200 characters — drop category hashtags if needed
  if (caption.length > 2200) {
    caption = [
      `This week in ${regionLabel} \u2014 ${totalEvents} curated free events (${weekLabel})`,
      '',
      sections.join('\n\n'),
      '',
      'Discover the full lineup at soiree.today',
      '',
      baseHashtags,
    ].join('\n').trim();
  }

  return caption;
}

module.exports = async function handler(req, res) {
  // Protect endpoint — only allow cron or authorized requests
  const authHeader = req.headers['authorization'];
  const cronHeader = req.headers['x-vercel-cron'];
  const isDryRun = req.query.dry_run === 'true';

  if (!cronHeader && authHeader !== `Bearer ${process.env.SCRAPE_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Route to weekend roundup if mode=weekend
  if (req.query.mode === 'weekend') {
    try {
      return await handleWeekendRoundup(req, res, isDryRun);
    } catch (error) {
      console.error('Weekend roundup error:', error);
      const detail = error.response?.data?.error || error.response?.data || null;
      return res.status(500).json({ success: false, error: error.message, detail });
    }
  }

  try {
    // 1. Calculate this week's date range
    const today = new Date();
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + 7);
    const todayStr = formatDateLocal(today);
    const endOfWeekStr = formatDateLocal(endOfWeek);

    const weekLabel = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      + ' \u2013 ' + endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    console.log(`Generating Instagram posts for week: ${weekLabel}`);

    // 2. Fetch this week's events from DB
    const { rows: allEvents } = await pool.query(
      `SELECT * FROM events
       WHERE start_date >= $1 AND start_date <= $2
       ORDER BY start_date ASC, created_at DESC`,
      [todayStr, endOfWeekStr]
    );

    console.log(`Found ${allEvents.length} events this week`);

    if (allEvents.length === 0) {
      console.log('No events found for this week — skipping post');
      return res.status(200).json({ success: true, skipped: true, reason: 'No events this week' });
    }

    // 3. Get token + user ID (needed for posting)
    const token = (process.env.INSTAGRAM_ACCESS_TOKEN || '').trim();
    const igUserId = (process.env.INSTAGRAM_USER_ID || '').trim();
    if (!isDryRun) {
      if (!token) throw new Error('Missing INSTAGRAM_ACCESS_TOKEN env var');
      if (!igUserId) throw new Error('Missing INSTAGRAM_USER_ID env var');
    }

    const dateSlug = todayStr.replace(/-/g, '');
    const runId = Date.now();
    const results = [];

    // 4. Process each region
    for (const region of REGIONS) {
      const regionEvents = allEvents.filter(e => getEventRegion(e) === region.id);
      console.log(`\n--- ${region.label}: ${regionEvents.length} events ---`);

      if (regionEvents.length === 0) {
        console.log(`No events for ${region.label} — skipping`);
        results.push({ region: region.label, skipped: true, reason: 'No events' });
        continue;
      }

      const totalRegionEvents = regionEvents.length;

      // JC/Hoboken: split by city instead of category
      // NYC: split by category as before
      let cardGroups; // Array of { displayName, events }
      if (region.id === 'hoboken-jc') {
        cardGroups = CITIES.map(({ id, displayName }) => ({
          displayName,
          events: regionEvents.filter(e => getCity(e) === id),
        }));
      } else {
        cardGroups = CATEGORIES.map(({ dbCategory, displayName }) => ({
          displayName,
          events: regionEvents.filter(e => e.category === dbCategory),
        }));
      }

      // Generate card images
      console.log(`Generating ${region.label} card images...`);
      const cards = await Promise.all(
        cardGroups.map(({ displayName, events }) =>
          generateSocialCard(displayName, events, weekLabel, totalRegionEvents)
        )
      );

      // Upload to Vercel Blob
      console.log(`Uploading ${region.label} images to Vercel Blob...`);
      const imageUrls = [];

      // Prepend static cover image if region has one
      if (region.coverImage) {
        const coverBuffer = await readFile(join(process.cwd(), 'assets', 'images', region.coverImage));
        const coverBlob = await put(
          `instagram/${region.slug}-cover.png`,
          coverBuffer,
          { access: 'public', contentType: 'image/png', addRandomSuffix: false, allowOverwrite: true }
        );
        console.log(`  Cover: ${coverBlob.url}`);
        imageUrls.push(coverBlob.url);
      }

      // Upload generated cards
      for (let i = 0; i < cards.length; i++) {
        const slug = cardGroups[i].displayName.toLowerCase().replace(/[^a-z]/g, '-');
        const blob = await put(
          `instagram/${dateSlug}-${region.slug}-${slug}-${runId}.png`,
          cards[i],
          { access: 'public', contentType: 'image/png', addRandomSuffix: false }
        );
        console.log(`  ${cardGroups[i].displayName}: ${blob.url}`);
        imageUrls.push(blob.url);
      }

      // Build caption
      const caption = buildCaption(cardGroups, weekLabel, region.id, region.label);
      console.log(`${region.label} caption length: ${caption.length} chars`);

      if (isDryRun) {
        results.push({
          region: region.label,
          totalEvents: totalRegionEvents,
          categories: cardGroups.map(c => ({ name: c.displayName, count: c.events.length })),
          imageUrls,
          caption,
        });
        continue;
      }

      // Post carousel to Instagram
      console.log(`Posting ${region.label} carousel to Instagram...`);
      const mediaId = await postCarousel(igUserId, imageUrls, caption, token);
      console.log(`${region.label} published! Media ID: ${mediaId}`);

      // Log instagram post activity
      await pool.query(
        `INSERT INTO activity_log (type, event_count, detail) VALUES ('instagram', $1, $2)`,
        [totalRegionEvents, region.label]
      ).catch(() => {});

      results.push({
        region: region.label,
        mediaId,
        totalEvents: totalRegionEvents,
        imageUrls,
      });

      // Brief pause between posts to avoid rate limiting
      if (REGIONS.indexOf(region) < REGIONS.length - 1) {
        console.log('Waiting 10s before next post...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    return res.status(200).json({
      success: true,
      dryRun: isDryRun,
      weekLabel,
      totalEvents: allEvents.length,
      posts: results,
    });

  } catch (error) {
    console.error('Instagram post error:', error);
    const detail = error.response?.data?.error || error.response?.data || null;
    return res.status(500).json({
      success: false,
      error: error.message,
      detail,
    });
  }
};
