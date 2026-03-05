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
function getEventRegion(event) {
  const loc = (event.location || '').toLowerCase();
  const addr = (event.address || '').toLowerCase();
  if (loc.includes('hoboken') || loc.includes('jersey city') ||
      addr.includes('hoboken') || addr.includes('jersey city')) return 'hoboken-jc';
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
