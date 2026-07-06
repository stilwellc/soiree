const { Pool } = require('pg');
const axios = require('axios');
const cheerio = require('cheerio');
const { parseDateText } = require('../lib/dateParser.js');
const { createNormalizedEvent, generateHighlights } = require('../lib/normalize.js');
const { scrapeWithPuppeteer, CONFIGS } = require('../scripts/scrape-puppeteer.js');
const { enrichEvents } = require('../lib/enrich.js');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Fallback events if scraping fails
function getFallbackEvents() {
  const events = [
    {
      name: "Brooklyn Street Art Walk",
      category: "art",
      date: "This Weekend",
      time: "2:00 PM - 5:00 PM",
      location: "Bushwick, Brooklyn",
      address: "Troutman St & Wyckoff Ave, Brooklyn, NY",
      price: "free",
      spots: 75,
      image: getEventImage("Brooklyn Street Art Walk", "art"),
      description: "Explore Bushwick's vibrant street art scene with a local guide.",
      highlights: generateHighlights("Brooklyn Street Art Walk", "Explore Bushwick's vibrant street art scene with a local guide.", "art", "Bushwick, Brooklyn", "Fallback"),
      url: "https://www.nycforfree.co/events"
    },
    {
      name: "Free Jazz in Central Park",
      category: "community",
      date: "Friday Evening",
      time: "7:00 PM - 9:00 PM",
      location: "Central Park",
      address: "Rumsey Playfield, Central Park",
      price: "free",
      spots: 200,
      image: getEventImage("Free Jazz in Central Park", "community"),
      description: "Evening of smooth jazz under the stars.",
      highlights: generateHighlights("Free Jazz in Central Park", "Evening of smooth jazz under the stars.", "community", "Central Park", "Fallback"),
      url: "https://www.nycforfree.co/events"
    },
    {
      name: "DUMBO Food Market",
      category: "community",
      date: "Sunday",
      time: "11:00 AM - 6:00 PM",
      location: "DUMBO, Brooklyn",
      address: "Pearl Plaza, Brooklyn, NY",
      price: "free",
      spots: 300,
      image: getEventImage("DUMBO Food Market", "community"),
      description: "Sample artisanal foods from local vendors.",
      highlights: generateHighlights("DUMBO Food Market", "Sample artisanal foods from local vendors.", "community", "DUMBO, Brooklyn", "Fallback"),
      url: "https://www.nycforfree.co/events"
    }
  ];

  // Add parsed dates to each fallback event
  return events.map(event => {
    const { start_date, end_date } = parseDateText(event.date, event.time);
    return { ...event, start_date, end_date };
  });
}

// Clean and sanitize scraped event descriptions
// Removes marketing junk, repeated sentences, HTML artifacts, and truncates gracefully
function cleanDescription(text) {
  if (!text || typeof text !== 'string') return '';

  let desc = text;

  // Strip HTML tags that leaked through
  desc = desc.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  desc = desc.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

  // Remove URLs
  desc = desc.replace(/https?:\/\/\S+/g, '');

  // Remove common scraping junk phrases
  const junkPatterns = [
    /read more\.?\.?\.?/gi,
    /click here\.?/gi,
    /learn more\.?/gi,
    /sign up (now|today|here)\.?/gi,
    /register (now|today|here)\.?/gi,
    /book (now|today|here|your)\.?/gi,
    /rsvp (now|today|here)\.?/gi,
    /buy tickets?\.?/gi,
    /get tickets?\.?/gi,
    /subscribe to our\.*/gi,
    /follow us on\.*/gi,
    /share this event\.?/gi,
    /add to calendar\.?/gi,
    /\bvia\s+\w+\s*$/gi,
    /photo\s*(credit|by|courtesy)[^.]*\.?/gi,
    /image\s*(credit|by|courtesy)[^.]*\.?/gi,
    /\(photo[^)]*\)/gi,
    /all rights reserved\.?/gi,
    /©.*/gi,
  ];

  for (const pattern of junkPatterns) {
    desc = desc.replace(pattern, '');
  }

  // Collapse whitespace
  desc = desc.replace(/\s+/g, ' ').trim();

  // Remove duplicate sentences (common when paragraphs get joined)
  const sentences = desc.split(/(?<=[.!?])\s+/);
  const seen = new Set();
  const unique = [];
  for (const s of sentences) {
    const normalized = s.toLowerCase().trim();
    if (normalized.length < 5) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(s);
  }
  desc = unique.join(' ');

  // Truncate to ~500 chars at a sentence boundary for clean display
  if (desc.length > 500) {
    const truncated = desc.substring(0, 500);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastExcl = truncated.lastIndexOf('!');
    const lastQ = truncated.lastIndexOf('?');
    const breakPoint = Math.max(lastPeriod, lastExcl, lastQ);
    if (breakPoint > 200) {
      desc = desc.substring(0, breakPoint + 1);
    } else {
      desc = truncated.trim();
    }
  }

  return desc.trim();
}

// Category mapping based on title, description, and location
function categorizeEvent(title, description, location) {
  const text = (title + ' ' + (description || '')).toLowerCase();
  const loc = (location || '').toLowerCase();

  // --- Location-based hints (museums, galleries = art) ---
  const museumLocations = ['moma', 'met', 'metropolitan', 'whitney', 'guggenheim',
    'new museum', 'museum', 'gallery', 'brooklyn museum', 'amnh'];
  if (museumLocations.some(m => loc.includes(m))) {
    return 'art';
  }

  // --- Perks & Pop-Ups (freebies, brand activations, pop-ups, sample sales) ---
  if (text.match(/free\s+(sample|gift|coffee|latte|drink|treat|tote|shirt|t-shirt|merch|product|item|goodie|makeup|lipstick|skincare|fragrance|ice cream|donut|doughnut|pizza|slice|cookie|cupcake|smoothie|juice|chai|matcha|espresso|bagel|croissant|muffin|chocolate|beer|wine|cocktail|seltzer|swag)/i) ||
    text.match(/\b(complimentary|giveaway|swag|goodie bag|gift bag|gift with purchase|free gifts?|free tasting)\b/i) ||
    text.match(/while supplies last/i) ||
    text.match(/first\s+\d+\s+(guests?|people|visitors?|customers?)/i)) {
    return 'perks';
  }

  // --- Perks: brand pop-ups, beauty/wellness activations, sample sales, shopping ---
  if (text.match(/pop-up|popup|sample sale|launch celebration|grand opening|experience|charm bar/i) ||
    text.match(/\b(beauty|skincare|spa|k-beauty|cosmetic|makeup|fragrance|self-care)\b/) ||
    text.match(/\b(fashion|runway|designer|couture|clothing|apparel|boutique|wardrobe|lookbook|catwalk|textile)\b/)) {
    return 'perks';
  }

  // --- Art (galleries, exhibits, film, theater, photography, design) ---
  if (text.match(/directed by|director's cut|screening|^\d{4}\.\s|film series|\bfilms?\b.*\b\d{4}\b/)) {
    return 'art';
  }
  if (text.match(/\b(art|gallery|exhibit|exhibition|paint|sculpture|artist|mural|craft|pottery|drawing|illustration|installation|visual|theater|theatre|cinema|film|movie|photography|graffiti|contemporary|abstract|coloring|screening|animation|collection|calligraphy|prints|portrait|studio tour|open studio|architecture tour)\b/) || text.match(/street art|ice sculpture/)) {
    return 'art';
  }

  // --- Culture & Community (music, food, family, sports, workshops, parades, everything else) ---
  return 'community';
}

// Generate professional Unsplash images based on category
function getEventImage(title, category) {
  // Use Unsplash Source API with category-specific search terms
  // This provides high-quality, professionally curated images

  const categoryImages = {
    art: [
      'https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1576093430427-778a0e33696e?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200&h=800&fit=crop'
    ],
    perks: [
      'https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=1200&h=800&fit=crop'
    ],
    community: [
      'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&h=800&fit=crop'
    ]
  };

  // Get images array for category, fallback to community
  const images = categoryImages[category] || categoryImages.community;

  // Use title hash to consistently select same image for same event
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i);
    hash = hash & hash;
  }
  const index = Math.abs(hash % images.length);

  return images[index];
}

// Fetch detail page data (description and dates) from an individual event URL
// Used to enrich listing-page data with full descriptions and accurate dates
async function fetchDetailPageData(url) {
  try {
    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    const $ = cheerio.load(response.data);

    // Remove nav, footer, sidebar, cookie banners, scripts, styles — keep only content
    $('nav, footer, header, aside, script, style, noscript, [class*="cookie"], [class*="banner"], [class*="newsletter"], [class*="popup"], [class*="modal"], [id*="cookie"], [id*="banner"]').remove();

    // --- Extract Description ---
    // Ordered from most specific to most generic
    const descSelectors = [
      // Squarespace event pages
      '.eventitem-column-content',
      '.sqs-block-content',
      // WordPress / common CMS
      '.entry-content',
      '.post-content',
      '.page-content',
      '.content-area',
      // Generic event selectors
      '[class*="event-description"]',
      '[class*="event-content"]',
      '[class*="event-body"]',
      '[class*="event-detail"]',
      '[class*="description"]',
      // Museum / gallery sites
      '.exhibition-description',
      '.program-description',
      '[class*="about"]',
      // Article / main content fallback
      'article',
      'main',
      '[role="main"]',
    ];

    let description = '';
    for (const sel of descSelectors) {
      const el = $(sel).first();
      if (!el.length) continue;
      // Grab all paragraph text within the container
      const paras = [];
      el.find('p').each((_, p) => {
        const t = $(p).text().trim();
        if (t.length > 20) paras.push(t);
      });
      if (paras.length > 0) {
        description = paras.join(' ');
      } else {
        // No <p> tags — grab raw text
        description = el.text().replace(/\s+/g, ' ').trim();
      }
      if (description.length > 80) break;
    }

    // Final cleanup: collapse whitespace, strip leading/trailing junk
    description = description
      .replace(/\s+/g, ' ')
      .replace(/^[\s\W]+/, '')
      .trim()
      .substring(0, 1500);

    // --- Extract Date Information ---
    let dateText = '';
    let timeText = '';

    // Try structured data (time elements with datetime attribute)
    const timeElem = $('time[datetime]').first();
    if (timeElem.length) {
      const datetime = timeElem.attr('datetime');
      if (datetime) {
        const dateObj = new Date(datetime);
        if (!isNaN(dateObj.getTime())) {
          const options = { month: 'short', day: 'numeric', year: 'numeric' };
          dateText = dateObj.toLocaleDateString('en-US', options);
          const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
          timeText = dateObj.toLocaleTimeString('en-US', timeOptions);
        }
      }
    }

    // Fallback: Try common date selectors
    if (!dateText) {
      const dateSelectors = [
        '.event-date', '.event-time', '.date', 'time',
        '.event-meta', '.eventitem-meta-date', '.eventitem-meta-time',
        '[class*="date"]', '[class*="time"]'
      ];

      for (const sel of dateSelectors) {
        const text = $(sel).first().text().trim();
        if (text && text.length > 3 && text.length < 200) {
          if (text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|\d{1,2}\/\d{1,2})/i)) {
            dateText = text;
            break;
          }
        }
      }
    }

    return { description, dateText, timeText };
  } catch {
    return { description: '', dateText: '', timeText: '' };
  }
}

// Enrich events array by fetching detail pages in parallel batches
// Extracts richer descriptions and accurate dates, then re-categorizes and regenerates highlights
async function enrichWithDetailPages(events, batchSize = 8) {
  console.log(`Enriching ${events.length} events with detail page data...`);
  let enrichedDesc = 0;
  let enrichedDates = 0;

  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(async (event) => {
        const detail = await fetchDetailPageData(event.url);

        // Update description if we got meaningfully better content
        if (detail.description && detail.description.length > 80) {
          // Prefer the detail page description if it's substantially longer
          const combined = detail.description.length > event.description.length
            ? detail.description
            : (event.description + ' ' + detail.description).substring(0, 1500);
          event.description = combined.substring(0, 1500);

          // Re-categorize with richer text
          const newCategory = categorizeEvent(event.name, event.description, event.location);
          if (newCategory !== event.category) {
            event.category = newCategory;
            event.image = getEventImage(event.name, newCategory);
          }

          // Regenerate highlights now that we have better description text
          event.highlights = generateHighlights(event.name, event.description, event.category, event.location, event.source);

          enrichedDesc++;
        }

        // Update dates if we got better date info
        if (detail.dateText) {
          const isGenericDate = event.date && (
            event.date.toLowerCase() === 'upcoming' ||
            event.date.toLowerCase() === 'today' ||
            event.date.toLowerCase() === 'this week' ||
            event.date.toLowerCase() === 'this weekend' ||
            event.date.toLowerCase() === 'ongoing' ||
            !event.start_date
          );

          if (isGenericDate) {
            event.date = detail.dateText;
            if (detail.timeText) event.time = detail.timeText;
            const { start_date, end_date } = parseDateText(detail.dateText, detail.timeText);
            if (start_date) {
              event.start_date = start_date;
              event.end_date = end_date;
              enrichedDates++;
            }
          }
        }
      })
    );
  }

  console.log(`  Enriched ${enrichedDesc}/${events.length} descriptions, ${enrichedDates}/${events.length} dates`);
  return events;
}



// Scrape events from TimeOut NY (includes museum events and exhibitions)
async function scrapeTimeOut() {
  try {
    console.log('Fetching events from TimeOut NY...');
    const response = await axios.get('https://www.timeout.com/newyork/things-to-do/free-things-to-do-in-nyc', {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const $ = cheerio.load(response.data);
    const events = [];
    const seenUrls = new Set();

    // Parse event cards - Time Out uses article elements
    $('article, .card, ._card, .listingCard, [class*="Card"]').each((i, elem) => {
      if (events.length >= 20) return false;

      const $elem = $(elem);

      // Get title from various possible selectors
      let title = $elem.find('h1, h2, h3, .card-title, [class*="title"], [class*="Title"]').first().text().trim();
      if (!title || title.length < 5) return;

      // Get link
      const $link = $elem.find('a').first();
      let link = $link.attr('href');
      if (!link) return;

      // Make absolute URL
      if (link.startsWith('/')) {
        link = `https://www.timeout.com${link}`;
      }

      if (seenUrls.has(link)) return;
      seenUrls.add(link);

      // Get description
      const description = $elem.find('p, .card-description, [class*="description"], [class*="Description"]').first().text().trim();

      // Get location if available
      const location = $elem.find('.venue, .location, .neighborhood, [class*="location"]').first().text().trim() || 'New York City';

      const category = categorizeEvent(title, description, location);
      const eventUrl = link.startsWith('http') ? link : `https://www.timeout.com${link}`;

      // Most Time Out free events are ongoing/recurring
      const dateStr = 'Ongoing';
      const timeStr = 'See details';
      const { start_date, end_date } = parseDateText(dateStr, timeStr);

      const event = createNormalizedEvent({
        name: title,
        category,
        date: dateStr,
        time: timeStr,
        start_date,
        end_date,
        location,
        address: location !== 'New York City' ? location : 'Various locations - see event details',
        price: 'free',
        spots: Math.floor(Math.random() * 150) + 30,
        image: getEventImage(title, category),
        description: description || `${title} - Free event in NYC`,
        highlights: generateHighlights(title, description, category, location, 'TimeOut NY'),
        url: eventUrl,
        source: 'TimeOut NY'
      });

      if (event) events.push(event);
    });

    console.log(`Scraped ${events.length} events from TimeOut NY`);
    return events;
  } catch (error) {
    console.error('TimeOut NY scraping failed:', error.message);
    return [];
  }
}

// Scrape events from nycforfree.co
async function scrapeNYCForFree() {
  try {
    console.log('Fetching events from nycforfree.co...');
    const response = await axios.get('https://www.nycforfree.co/events', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const events = [];

    // Find event items (Squarespace uses .eventlist-event)
    $('.eventlist-event').each((i, elem) => {
      if (events.length >= 50) return false; // Increased to capture more events

      const $elem = $(elem);

      // Get event name from .eventlist-title
      const name = $elem.find('.eventlist-title').text().trim();
      if (!name || name.length < 5) return;

      // Get event URL
      const href = $elem.find('a[href*="/events/"]').first().attr('href');
      if (!href || href === '/events' || href === '/events/') return;

      // Extract description from excerpt
      let description = $elem.find('.eventlist-description').text().trim();
      if (!description || description.length < 10) description = name;

      // Extract date and time from listing page
      let date = 'Upcoming';
      let time = 'See details';

      // Squarespace has <time class="event-date" datetime="YYYY-MM-DD">
      const timeElem = $elem.find('time.event-date[datetime]').first();
      if (timeElem.length) {
        const datetime = timeElem.attr('datetime');
        if (datetime) {
          // datetime is just a date like "2025-11-14", not full ISO datetime
          date = datetime; // Will be parsed by our ISO date parser

          // Get time from .event-time-localized or .eventlist-meta-time
          const timeText = $elem.find('.event-time-localized, .eventlist-meta-time').first().text().trim();
          if (timeText && timeText.length < 20) {
            time = timeText;
          }
        }
      }

      // If no datetime found, try text extraction as fallback
      if (date === 'Upcoming') {
        const dateText = $elem.find('.eventlist-meta-date .event-date').first().text().trim();
        if (dateText) {
          date = dateText;
          const timeMatch = $elem.find('.eventlist-meta-time').first().text().trim();
          if (timeMatch) time = timeMatch;
        }
      }

      // Extract location from Squarespace event meta
      let location = 'New York City';
      let address = 'NYC';
      const locationElem = $elem.find('.eventlist-meta-address, .event-location').first().text().trim();
      if (locationElem) {
        address = locationElem;
        // Extract neighborhood/area from address
        const parts = locationElem.split(',');
        if (parts.length > 1) {
          location = parts[parts.length - 2].trim();
        }
      }

      // Categorize event
      const category = categorizeEvent(name, description, location);

      // Build event URL
      const eventUrl = href.startsWith('http') ? href : `https://www.nycforfree.co${href}`;

      // Parse structured dates
      const { start_date, end_date } = parseDateText(date, time);

      const event = createNormalizedEvent({
        name,
        category,
        date,
        time,
        start_date,
        end_date,
        location,
        address,
        price: 'free',
        spots: Math.floor(Math.random() * 200) + 50,
        image: getEventImage(name, category),
        description,
        highlights: generateHighlights(name, description, category, location, 'NYC For Free'),
        url: eventUrl,
        source: 'NYC For Free'
      });

      if (event) events.push(event);
    });

    // Sample evenly across categories (max 12 per category for balance)
    const byCat = {};
    for (const e of events) {
      if (!byCat[e.category]) byCat[e.category] = [];
      byCat[e.category].push(e);
    }
    const sampled = [];
    for (const cat in byCat) {
      sampled.push(...byCat[cat].slice(0, 12));
    }

    console.log(`Scraped ${events.length} events from nycforfree.co, sampled ${sampled.length} (max 12 per category)`);
    return sampled;
  } catch (error) {
    console.error('NYC For Free scraping failed:', error.message);
    return [];
  }
}

// Scrape events from MoMA (trailing slash required on /calendar/)
async function scrapeMoMA() {
  try {
    console.log('Fetching events from MoMA...');
    const response = await axios.get('https://www.moma.org/calendar/', {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const $ = cheerio.load(response.data);
    const events = [];
    const seenHrefs = new Set();

    // MoMA calendar page has event links like /calendar/events/{id}
    // Events are in <li> elements with <a> links containing title and time info
    $('a[href*="/calendar/events/"]').each((i, elem) => {
      if (events.length >= 15) return false;

      const $link = $(elem);
      const href = $link.attr('href');
      if (!href || seenHrefs.has(href)) return;
      seenHrefs.add(href);

      // Get event name from balance-text span or first meaningful text
      let name = $link.find('.balance-text, [class*="balance-text"]').first().text().trim();
      if (!name) name = $link.find('p').first().text().trim();
      if (!name || name.length < 5) return;

      // Get the full text content for time extraction
      const fullText = $link.text().trim();

      // Extract time from the text (patterns like "9:30 a.m." or "7:00 p.m.")
      let time = 'See details';
      const timeMatch = fullText.match(/(\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.|AM|PM|–|&ndash;)[^A-Z]*)(?=\s*[A-Z]|$)/i);
      if (timeMatch) {
        time = timeMatch[1].replace(/&ndash;/g, '–').replace(/&nbsp;/g, ' ').trim();
      }

      // Look for date from preceding h2 header
      let date = 'Upcoming';
      const $li = $link.closest('li');
      if ($li.length) {
        // Walk up to find the date heading
        const $section = $li.closest('ul').prev('h2');
        if ($section.length) {
          date = $section.text().replace(/&nbsp;/g, ' ').trim();
        }
      }

      const description = `${name} at MoMA.`;
      const location = 'MoMA';
      const address = '11 W 53rd St, New York, NY 10019';
      const category = categorizeEvent(name, description, location);
      const eventUrl = href.startsWith('http') ? href : `https://www.moma.org${href}`;

      // Parse structured dates
      const { start_date, end_date } = parseDateText(date, time);

      const event = createNormalizedEvent({
        name,
        category,
        date,
        time,
        start_date,
        end_date,
        location,
        address,
        price: 'free',
        spots: Math.floor(Math.random() * 150) + 50,
        image: getEventImage(name, category),
        description,
        highlights: generateHighlights(name, description, category, location, 'MoMA'),
        url: eventUrl,
        source: 'MoMA'
      });

      if (event) events.push(event);
    });

    console.log(`Scraped ${events.length} events from MoMA`);
    return events;
  } catch (error) {
    console.error('MoMA scraping failed:', error.message);
    return [];
  }
}

// Scrape events from American Museum of Natural History
// NOTE: AMNH aggressively blocks scrapers (403 on all endpoints).
// This scraper uses full browser headers but may still fail.
async function scrapeAMNH() {
  try {
    console.log('Fetching events from AMNH...');
    const response = await axios.get('https://www.amnh.org/calendar', {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      }
    });

    const $ = cheerio.load(response.data);
    const events = [];

    // Primary: use the same anchor selector as the Puppeteer script
    $('a.amnh-calendar-new-event').each((i, elem) => {
      if (events.length >= 15) return false;

      const $a = $(elem);
      const href = $a.attr('href');
      if (!href) return;

      const name = $a.find('h3').first().text().trim();
      if (!name || name.length < 5) return;

      const pTags = $a.find('p');
      let description = pTags.first().text().trim();
      if (!description || description.length < 10) description = name;

      let date = 'Upcoming';
      let time = 'See details';
      const dateTimeText = pTags.eq(1).text().trim();
      if (dateTimeText) {
        const dateMatch = dateTimeText.match(/([A-Za-z]+ \d{1,2}(?:,?\s*\d{4})?)/);
        if (dateMatch) date = dateMatch[1];
        const timeMatch = dateTimeText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
        if (timeMatch) time = timeMatch[1];
      }

      const location = 'AMNH';
      const address = '200 Central Park West, New York, NY 10024';
      const category = categorizeEvent(name, description, location);
      const eventUrl = href.startsWith('http') ? href : `https://www.amnh.org${href}`;
      const { start_date, end_date } = parseDateText(date, time);

      const event = createNormalizedEvent({
        name, category, date, time, start_date, end_date,
        location, address,
        price: 'free',
        spots: Math.floor(Math.random() * 150) + 50,
        image: getEventImage(name, category),
        description,
        highlights: generateHighlights(name, description, category, location, 'AMNH'),
        url: eventUrl,
        source: 'AMNH'
      });
      if (event) events.push(event);
    });

    // Fallback: broader selectors if no results from primary
    if (events.length === 0) {
      $('[class*="event-card"], [class*="calendar-item"], article').each((i, elem) => {
        if (events.length >= 15) return false;
        const $elem = $(elem);
        const name = $elem.find('h2, h3, h4').first().text().trim();
        if (!name || name.length < 5) return;
        const href = $elem.find('a').first().attr('href') || $elem.closest('a').attr('href');
        if (!href) return;
        const description = $elem.find('p').first().text().trim() || name;
        const location = 'AMNH';
        const address = '200 Central Park West, New York, NY 10024';
        const category = categorizeEvent(name, description, location);
        const eventUrl = href.startsWith('http') ? href : `https://www.amnh.org${href}`;
        const { start_date, end_date } = parseDateText('Upcoming', 'See details');
        const event = createNormalizedEvent({
          name, category, date: 'Upcoming', time: 'See details',
          start_date, end_date, location, address,
          price: 'free', spots: Math.floor(Math.random() * 100) + 30,
          image: getEventImage(name, category), description,
          highlights: generateHighlights(name, description, category, location, 'AMNH'),
          url: eventUrl, source: 'AMNH'
        });
        if (event) events.push(event);
      });
    }

    console.log(`Scraped ${events.length} events from AMNH`);
    return events;
  } catch (error) {
    console.error('AMNH scraping failed:', error.message);
    return [];
  }
}

// Scrape events from Whitney Museum
async function scrapeWhitney() {
  try {
    console.log('Fetching events from Whitney Museum...');
    const response = await axios.get('https://whitney.org/events', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const events = [];

    const seen = new Set();

    // Strategy 1: links containing /exhibitions/ or /events/ or /programs/
    $('a[href*="/exhibitions/"], a[href*="/events/"], a[href*="/programs/"]').each((i, elem) => {
      if (events.length >= 15) return false;
      const $a = $(elem);
      const href = $a.attr('href');
      if (!href || seen.has(href)) return;
      seen.add(href);

      let name = $a.find('h1,h2,h3,h4').first().text().trim();
      if (!name) name = $a.find('[class*="title"]').first().text().trim();
      if (!name) name = ($a.attr('aria-label') || $a.text()).trim().replace(/\s+/g, ' ').slice(0, 100);
      if (!name || name.length < 5) return;

      const description = $a.find('p, [class*="desc"]').first().text().trim() || name;
      const dateText = $a.find('time, [class*="date"]').first().text().trim();
      let date = 'Upcoming', time = 'See details';
      if (dateText) {
        const dm = dateText.match(/([A-Za-z]+ \d{1,2}(?:,?\s*\d{4})?)/);
        if (dm) date = dm[1];
        const tm = dateText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
        if (tm) time = tm[1];
      }

      const location = 'Whitney Museum';
      const address = '99 Gansevoort St, New York, NY 10014';
      const category = categorizeEvent(name, description, location);
      const eventUrl = href.startsWith('http') ? href : `https://whitney.org${href}`;
      const { start_date, end_date } = parseDateText(date, time);

      const event = createNormalizedEvent({
        name, category, date, time, start_date, end_date,
        location, address,
        price: 'free',
        spots: Math.floor(Math.random() * 150) + 50,
        image: getEventImage(name, category),
        description,
        highlights: generateHighlights(name, description, category, location, 'Whitney Museum'),
        url: eventUrl,
        source: 'Whitney Museum'
      });
      if (event) events.push(event);
    });

    // Strategy 2: article/li containers with an anchor and heading
    if (events.length === 0) {
      $('article, li, .card, [class*="listing"]').each((i, elem) => {
        if (events.length >= 15) return false;
        const $elem = $(elem);
        const name = $elem.find('h2,h3,h4').first().text().trim();
        if (!name || name.length < 5) return;
        const href = $elem.find('a').first().attr('href');
        if (!href || seen.has(href)) return;
        seen.add(href);
        const description = $elem.find('p').first().text().trim() || name;
        const location = 'Whitney Museum';
        const address = '99 Gansevoort St, New York, NY 10014';
        const category = categorizeEvent(name, description, location);
        const eventUrl = href.startsWith('http') ? href : `https://whitney.org${href}`;
        const { start_date, end_date } = parseDateText('Upcoming', 'See details');
        const event = createNormalizedEvent({
          name, category, date: 'Upcoming', time: 'See details',
          start_date, end_date, location, address,
          price: 'free', spots: Math.floor(Math.random() * 100) + 30,
          image: getEventImage(name, category), description,
          highlights: generateHighlights(name, description, category, location, 'Whitney Museum'),
          url: eventUrl, source: 'Whitney Museum'
        });
        if (event) events.push(event);
      });
    }

    console.log(`Scraped ${events.length} events from Whitney`);
    return events;
  } catch (error) {
    console.error('Whitney Museum scraping failed:', error.message);
    return [];
  }
}

// Scrape events and exhibitions from Guggenheim via Puppeteer (JS-rendered calendar)
async function scrapeGuggenheim() {
  try {
    console.log('Fetching events from Guggenheim (Puppeteer)...');
    const events = await scrapeWithPuppeteer(CONFIGS.guggenheim);
    // Only keep events that have a parseable date
    const dated = events.filter(e => e.start_date !== null);
    console.log(`Scraped ${dated.length} dated events from Guggenheim (${events.length} total)`);
    return dated;
  } catch (error) {
    console.error('Guggenheim scraping failed:', error.message);
    return [];
  }
}

// Scrape events from New Museum via Puppeteer (Next.js site, client-side rendered)
async function scrapeNewMuseum() {
  try {
    console.log('Fetching events from New Museum (Puppeteer)...');
    const events = await scrapeWithPuppeteer(CONFIGS.newMuseum);
    // Only keep events that have a parseable date
    const dated = events.filter(e => e.start_date !== null);
    console.log(`Scraped ${dated.length} dated events from New Museum (${events.length} total)`);
    return dated;
  } catch (error) {
    console.error('New Museum scraping failed:', error.message);
    return [];
  }
}

// Scrape events from The Local Girl (Hoboken/JC)
// The listing page groups events under date header list items. We read them
// in order, tracking the current date from each header's data-date attribute,
// which avoids fetching individual detail pages (unreliable from CI/server IPs).
async function scrapeTheLocalGirl() {
  try {
    console.log('Fetching events from The Local Girl...');
    const response = await axios.get('https://thelocalgirl.com/calendar/hoboken/', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const $ = cheerio.load(response.data);
    const events = [];
    let currentDateStr = 'Upcoming';

    $('ol.eventsList__list').children().each((i, elem) => {
      const cls = $(elem).attr('class') || '';

      if (cls.includes('eventsList__list__dateHeader')) {
        // Extract ISO date from toggle button's data-date (e.g. "2026-02-12, 23:00 UTC")
        const dataDate = $(elem).find('button[data-date]').attr('data-date') || '';
        const isoMatch = dataDate.match(/(\d{4}-\d{2}-\d{2})/);
        if (isoMatch) {
          const d = new Date(isoMatch[1] + 'T12:00:00Z');
          currentDateStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        }
        return;
      }

      if (!cls.includes('eventsList__list__item')) return;
      if (events.length >= 30) return false;

      const $elem = $(elem);
      const $link = $elem.find('h2 a').first();
      const name = $link.text().trim();
      const href = $link.attr('href');
      if (!name || !href) return;

      // Extract categories
      const categories = [];
      $elem.find('.eventsList__list__item__categories a').each((_, catLink) => {
        const catText = $(catLink).text().trim();
        if (catText && catText !== 'The Hoboken Girl Calendar' && !categories.includes(catText)) {
          categories.push(catText);
        }
      });

      // Extract location from address element
      let location = 'Hoboken/Jersey City';
      let address = location;
      const locationText = $elem.find('.eventlocation').text().trim();
      if (locationText) {
        address = locationText;
        if (locationText.includes('Jersey City')) location = 'Jersey City';
        else if (locationText.includes('Hoboken')) location = 'Hoboken';
      }

      // Extract image (prefer data-src for lazy-loaded images)
      const image = $elem.find('.eventsList__list__item__image').attr('data-src')
        || $elem.find('.eventsList__list__item__image').attr('src')
        || getEventImage(name, 'community');

      const category = categorizeEvent(name, categories.join(' '), location);
      const { start_date, end_date } = parseDateText(currentDateStr, 'See details');

      const event = createNormalizedEvent({
        name,
        category,
        date: currentDateStr,
        time: 'See details',
        start_date,
        end_date,
        location,
        address,
        price: 'See details',
        spots: Math.floor(Math.random() * 100) + 20,
        image,
        description: `Event in ${location}: ${name}`,
        highlights: generateHighlights(name, `Event in ${location}: ${name}. ${categories.join(', ')}`, category, location, 'The Local Girl'),
        url: href,
        source: 'The Local Girl'
      });

      if (event) events.push(event);
    });

    // Sample evenly across categories (max 5 per category for balance)
    const byCat = {};
    for (const e of events) {
      if (!byCat[e.category]) byCat[e.category] = [];
      byCat[e.category].push(e);
    }
    const sampled = [];
    for (const cat in byCat) {
      sampled.push(...byCat[cat].slice(0, 5));
    }

    console.log(`Scraped ${events.length} events from The Local Girl, sampled ${sampled.length} (max 5 per category)`);
    return sampled;

  } catch (error) {
    console.error('The Local Girl scraping failed:', error.message);
    return [];
  }
}

// Scrape Thrillist for perks and culinary events (happy hours, deals, new openings)
async function scrapeThrillist() {
  try {
    console.log('Fetching events from Thrillist...');
    const events = [];

    // Try NYC food/drink guides
    const urls = [
      'https://www.thrillist.com/eat/new-york',
      'https://www.thrillist.com/drink/new-york'
    ];

    for (const url of urls) {
      try {
        const response = await axios.get(url, {
          timeout: 8000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        });

        const $ = cheerio.load(response.data);

        // Look for happy hour / deal articles
        $('a[href*="happy-hour"], a[href*="deals"], a[href*="specials"], a[href*="cheap"]').slice(0, 3).each((_, el) => {
          const $a = $(el);
          const title = $a.text().trim() || $a.find('h2, h3, h4').first().text().trim();
          const href = $a.attr('href');

          if (!title || !href || title.length < 10) return;

          const fullUrl = href.startsWith('http') ? href : `https://www.thrillist.com${href}`;
          const category = url.includes('/drink/') ? 'perks' : 'culinary';

          events.push(createNormalizedEvent({
            name: title,
            category,
            date: 'Ongoing',
            time: 'See details',
            start_date: new Date(),
            end_date: null,
            location: 'New York',
            address: 'Various locations',
            price: 'Varies',
            spots: 50,
            image: getEventImage(title, category),
            description: `${category === 'perks' ? 'Drink deals and happy hours' : 'Food specials'} around NYC`,
            highlights: generateHighlights(title, `${category === 'perks' ? 'Drink deals and happy hours' : 'Food specials'} around NYC`, category, 'New York', 'Thrillist'),
            url: fullUrl,
            source: 'Thrillist'
          }));
        });
      } catch (err) {
        console.log(`Thrillist ${url} failed:`, err.message);
      }
    }

    console.log(`Scraped ${events.length} events from Thrillist`);
    return events.slice(0, 8); // Limit to 8 total

  } catch (error) {
    console.error('Thrillist scraping failed:', error.message);
    return [];
  }
}

// Main orchestrator - scrapes all sources and merges results
// ─── Chelsea / NYC Gallery Scrapers ─────────────────────────────────────────

const GALLERY_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};

// Extract exhibition start AND end dates from a date range string like "Jan 16 – Feb 28, 2026"
// Also handles British "DD Month" format like "11 February – 11 April 2026".
// Attaches the year from the range end if the start doesn't include one.
function galleryDateRange(rangeText) {
  if (!rangeText) return { start_date: null, end_date: null };

  // Handle numeric dot format: "03.05–04.11.2026" (MM.DD–MM.DD.YYYY)
  const dotMatch = rangeText.match(/^(\d{2})\.(\d{2})[–—\-](\d{2})\.(\d{2})\.(\d{4})$/);
  if (dotMatch) {
    const [, sm, sd, em, ed, year] = dotMatch;
    const start = new Date(Date.UTC(parseInt(year), parseInt(sm) - 1, parseInt(sd)));
    const end = new Date(Date.UTC(parseInt(year), parseInt(em) - 1, parseInt(ed)));
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      return {
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0]
      };
    }
  }

  const yearMatch = rangeText.match(/\b(20\d{2})\b/);
  const parts = rangeText.split(/\s*[–—\-]\s*/);
  const startPart = parts[0].trim();
  const endPart = parts.length > 1 ? parts[parts.length - 1].trim() : null;

  // Normalize British "DD Month" → "Month DD" for parseDateText
  const normalizeBritish = (str) => str.replace(
    /^(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i,
    '$2 $1'
  );

  // Parse start date (attach year from range if missing)
  const startWithYear = yearMatch && !startPart.match(/\d{4}/) ? `${startPart}, ${yearMatch[1]}` : startPart;
  const startNormalized = normalizeBritish(startWithYear);
  const { start_date } = parseDateText(startNormalized, '');

  // Parse end date if we have a range
  let end_date = start_date;
  if (endPart) {
    const endWithYear = yearMatch && !endPart.match(/\d{4}/) ? `${endPart}, ${yearMatch[1]}` : endPart;
    const endNormalized = normalizeBritish(endWithYear);
    const parsed = parseDateText(endNormalized, '');
    if (parsed.start_date) end_date = parsed.start_date;
  }

  return { start_date: start_date || null, end_date: end_date || start_date || null };
}

// Returns array of 0-1 events per exhibition
function galleryEvents(name, dateRaw, start_date, end_date, url, locationName, address, sourceName) {
  const trimmedName = name.trim().substring(0, 255);

  // Skip non-descriptive names (e.g. "Extended through")
  if (/^extended\s+through$/i.test(trimmedName)) return [];
  const img = getEventImage(name, 'art');
  const spots = Math.floor(Math.random() * 80) + 20;

  // Single event per exhibition — use full date range when available
  const event = createNormalizedEvent({
    name: trimmedName,
    category: 'art',
    date: dateRaw,
    time: 'See details',
    start_date,
    end_date: end_date || start_date,
    location: locationName,
    address,
    price: 'free',
    spots,
    image: img,
    description: `${trimmedName} at ${sourceName}.`,
    highlights: generateHighlights(name, `${trimmedName} at ${sourceName}.`, 'art', locationName, sourceName),
    url,
    source: sourceName,
    event_type: 'exhibition'
  });

  return event ? [event] : [];
}

// Gagosian: <a href="/exhibitions/YEAR/slug"> — text = ArtistName + Title + DateRange
async function scrapeGagosian() {
  try {
    const res = await axios.get('https://gagosian.com/exhibitions/', { timeout: 12000, headers: GALLERY_HEADERS });
    const $ = cheerio.load(res.data);
    const events = [], seen = new Set();
    $('a[href*="/exhibitions/20"]').each((_, el) => {
      if (events.length >= 2) return false;
      const href = $(el).attr('href');
      if (!href || seen.has(href)) return;
      seen.add(href);
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      // Date range is at the end: "Month Day–Month Day" or "Month Day, Year"
      const dateMatch = text.match(/((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:[–—,\s\w]*)?)$/i);
      if (!dateMatch) return;
      const dateRaw = dateMatch[1].trim();
      const { start_date, end_date } = galleryDateRange(dateRaw);
      if (!start_date) return;
      const name = text.slice(0, text.length - dateMatch[0].length).trim();
      if (!name || name.length < 5) return;
      const evts = galleryEvents(name, dateRaw, start_date, end_date, `https://gagosian.com${href}`, 'Gagosian', '555 W 24th St, New York, NY 10011', 'Gagosian');
      events.push(...evts);
    });
    return events;
  } catch (e) { console.error('Gagosian failed:', e.message); return []; }
}

// Pace Gallery: li[class*="index-grid__list-item"] → h3 artist + p[class*="text-date"] date
// Filter to New York location only
async function scrapePaceGallery() {
  try {
    const res = await axios.get('https://www.pacegallery.com/exhibitions/', { timeout: 12000, headers: GALLERY_HEADERS });
    const $ = cheerio.load(res.data);
    const events = [], seen = new Set();
    $('li[class*="index-grid__list-item"]').each((_, el) => {
      if (events.length >= 2) return false;
      const $e = $(el);
      const href = $e.find('a').first().attr('href');
      if (!href) return;
      const url = href.startsWith('http') ? href : `https://www.pacegallery.com${href}`;
      if (seen.has(url)) return;
      seen.add(url);
      const locationText = $e.find('[class*="text-location"]').first().text().trim();
      if (locationText && !/new york/i.test(locationText)) return;
      const artist = $e.find('[class*="text-title"]').first().text().trim();
      const subtitle = $e.find('[class*="text-subtitle"]').first().text().trim();
      const dateRaw = $e.find('[class*="text-date"]').first().text().trim();
      if (!artist || !dateRaw) return;
      const { start_date, end_date } = galleryDateRange(dateRaw);
      if (!start_date) return;
      const name = subtitle ? `${artist}: ${subtitle}` : artist;
      const evts = galleryEvents(name, dateRaw, start_date, end_date, url, 'Pace Gallery', '540 W 25th St, New York, NY 10001', 'Pace Gallery');
      events.push(...evts);
    });
    return events;
  } catch (e) { console.error('Pace Gallery failed:', e.message); return []; }
}

// David Zwirner: JSON-LD ExhibitionEvent schema embedded in page — cleanest data
async function scrapeDavidZwirner() {
  try {
    const res = await axios.get('https://www.davidzwirner.com/exhibitions', { timeout: 12000, headers: GALLERY_HEADERS });
    const $ = cheerio.load(res.data);
    const events = [], seen = new Set();
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const raw = JSON.parse($(el).html() || '{}');
        const items = Array.isArray(raw) ? raw : (raw['@graph'] ? raw['@graph'] : [raw]);
        for (const item of items) {
          if (events.length >= 2) break;
          if (item['@type'] !== 'ExhibitionEvent') continue;
          const name = (item.name || '').trim();
          if (!name || name.length < 5) continue;
          const url = (item.url || '').trim();
          if (!url || seen.has(url)) continue;
          seen.add(url);
          if (item.location?.name && !/new york/i.test(item.location.name)) continue;
          const { start_date } = parseDateText(item.startDate || '', '');
          if (!start_date) continue;
          const endParsed = parseDateText(item.endDate || '', '');
          const end_date = endParsed.start_date || start_date;
          const dateRaw = item.startDate || '';
          const evts = galleryEvents(name, dateRaw, start_date, end_date, url, 'David Zwirner', '519 W 19th St, New York, NY 10011', 'David Zwirner');
          events.push(...evts);
        }
      } catch (_) { }
    });
    return events;
  } catch (e) { console.error('David Zwirner failed:', e.message); return []; }
}

// Lehmann Maupin: div.entry → h1 (exhibition title) + h3 (date range)
async function scrapeLehmannMaupin() {
  try {
    const res = await axios.get('https://www.lehmannmaupin.com/exhibitions', { timeout: 12000, headers: GALLERY_HEADERS });
    const $ = cheerio.load(res.data);
    const events = [], seen = new Set();
    $('div.entry, div[class*="entry"]').each((_, el) => {
      if (events.length >= 2) return false;
      const $e = $(el);
      const href = $e.find('a').first().attr('href');
      if (!href) return;
      const url = href.startsWith('http') ? href : `https://www.lehmannmaupin.com${href}`;
      if (seen.has(url)) return;
      seen.add(url);
      const title = $e.find('h1').first().text().trim();
      const artists = $e.find('h2').not('[class*="subtitle"]').first().text().trim();
      const dateRaw = $e.find('h3').first().text().trim();
      const name = title || artists;
      if (!name || name.length < 5 || !dateRaw) return;
      const { start_date, end_date } = galleryDateRange(dateRaw);
      if (!start_date) return;
      const evts = galleryEvents(name, dateRaw, start_date, end_date, url, 'Lehmann Maupin', '501 W 26th St, New York, NY 10001', 'Lehmann Maupin');
      events.push(...evts);
    });
    return events;
  } catch (e) { console.error('Lehmann Maupin failed:', e.message); return []; }
}

// Lisson Gallery: each exhibition has two <a> tags (image + text). Use a.link-discreet to
// skip the image-only anchor so we don't exhaust `seen` before reaching the text link.
// Text format: "Artist Name  DD Month – DD Month YYYY  Location"
async function scrapeLissonGallery() {
  try {
    const res = await axios.get('https://www.lissongallery.com/exhibitions', { timeout: 12000, headers: GALLERY_HEADERS });
    const $ = cheerio.load(res.data);
    const events = [], seen = new Set();
    $('a.link-discreet[href*="/exhibitions/"]').each((_, el) => {
      if (events.length >= 2) return false;
      const href = $(el).attr('href');
      if (!href || seen.has(href)) return;
      seen.add(href);
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text.length < 10) return;
      // Only take New York exhibitions
      if (!/new york/i.test(text)) return;
      const dateMatch = text.match(/(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec))\b/i);
      if (!dateMatch) return;
      const yearMatch = text.match(/\b(20\d{2})\b/);
      // Try to extract full date range (e.g., "11 February – 11 April 2026")
      const rangeMatch = text.match(/(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s*[–—\-]\s*\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{4})?)/i);
      const dateRaw = rangeMatch ? rangeMatch[1] : (yearMatch ? `${dateMatch[1]}, ${yearMatch[1]}` : dateMatch[1]);
      const { start_date, end_date } = galleryDateRange(dateRaw);
      if (!start_date) return;
      const nameRaw = text.slice(0, text.indexOf(dateMatch[0])).replace(/[:–—\-]+$/, '').trim();
      if (!nameRaw || nameRaw.length < 5) return;
      const evts = galleryEvents(nameRaw, dateRaw, start_date, end_date, `https://www.lissongallery.com${href}`, 'Lisson Gallery', '504 W 24th St, New York, NY 10011', 'Lisson Gallery');
      events.push(...evts);
    });
    return events;
  } catch (e) { console.error('Lisson Gallery failed:', e.message); return []; }
}

// Marian Goodman: div.area → a (link+location) + h2 span.heading_title (artist)
//                 + div.subheading (show title) + div.bottom (date range "DD Month – DD Month YYYY")
// Fetches /exhibitions/new-york/ directly to stay NYC-only.
async function scrapeMarianGoodman() {
  try {
    const res = await axios.get('https://www.mariangoodman.com/exhibitions/new-york/', { timeout: 12000, headers: GALLERY_HEADERS });
    const $ = cheerio.load(res.data);
    const events = [], seen = new Set();
    $('div.area').each((_, el) => {
      if (events.length >= 2) return false;
      const $e = $(el);
      const href = $e.find('a').first().attr('href');
      if (!href) return;
      const url = href.startsWith('http') ? href : `https://www.mariangoodman.com${href}`;
      if (seen.has(url)) return;
      seen.add(url);
      const artist = $e.find('span.heading_title').first().text().trim();
      const subtitle = $e.find('div.subheading').first().text().trim();
      const dateRaw = $e.find('div.bottom').first().text().trim();
      const name = artist && subtitle ? `${artist}: ${subtitle}` : (artist || subtitle);
      if (!name || name.length < 5 || !dateRaw) return;
      const { start_date, end_date } = galleryDateRange(dateRaw);
      if (!start_date) return;
      const evts = galleryEvents(name, dateRaw, start_date, end_date, url, 'Marian Goodman', '24 W 57th St, New York, NY 10019', 'Marian Goodman');
      events.push(...evts);
    });
    return events;
  } catch (e) { console.error('Marian Goodman failed:', e.message); return []; }
}

// Gladstone Gallery: already working via generic approach — keep as dedicated function
async function scrapeGladstoneGallery() {
  try {
    const res = await axios.get('https://gladstonegallery.com/exhibitions/', { timeout: 12000, headers: GALLERY_HEADERS });
    const $ = cheerio.load(res.data);
    const events = [], seen = new Set();
    const containerSelectors = ['article', '[class*="exhibition"]', '[class*="exhibit"]', '[class*="listing"]', '[class*="grid-item"]', '[class*="card"]', 'li[class*="item"]'];
    let $items = $();
    for (const sel of containerSelectors) {
      $items = $(sel).filter((_, el) => $(el).find('a').length > 0);
      if ($items.length > 3) break;
    }
    $items.each((_, el) => {
      if (events.length >= 2) return false;
      const $e = $(el);
      const title = $e.find('h1,h2,h3,h4,[class*="title"]').first().text().trim().replace(/\s+/g, ' ');
      if (!title || title.length < 10) return;
      const href = $e.find('a').first().attr('href');
      if (!href) return;
      const url = href.startsWith('http') ? href : `https://gladstonegallery.com${href}`;
      if (seen.has(url)) return;
      seen.add(url);
      const $dateEl = $e.find('time,[class*="date"],[datetime]').first();
      const rawDate = ($dateEl.attr('datetime') || $dateEl.text()).trim();
      if (!rawDate) return;
      const startMatch = rawDate.match(/^([A-Za-z]+\s+\d{1,2}(?:,?\s*\d{4})?)/);
      const dateStr = startMatch ? startMatch[1] : (rawDate.match(/^\d{4}-\d{2}-\d{2}/) ? rawDate.slice(0, 10) : '');
      if (!dateStr) return;
      const { start_date } = parseDateText(dateStr, '');
      if (!start_date) return;
      // Parse end date from full raw date string
      const { end_date: gladEnd } = galleryDateRange(rawDate);
      const evts = galleryEvents(title, dateStr, start_date, gladEnd || start_date, url, 'Gladstone Gallery', '130 W 21st St, New York, NY 10011', 'Gladstone Gallery');
      events.push(...evts);
    });
    return events;
  } catch (e) { console.error('Gladstone Gallery failed:', e.message); return []; }
}

// ── Generic gallery scraper ──────────────────────────────────────────────────
// Works for the majority of gallery sites that list exhibitions as linked items
// with titles and date ranges. Config-driven: just add a new entry to GENERIC_GALLERIES.

const GENERIC_GALLERIES = [
  { name: 'Hauser & Wirth', url: 'https://www.hauserwirth.com/exhibitions/', address: '32 E 69th St, New York, NY 10021', locationFilter: /new york/i },
  { name: 'Perrotin', url: 'https://www.perrotin.com/exhibitions', address: '130 Orchard St, New York, NY 10002', locationFilter: /new york/i },
  { name: 'Matthew Marks', url: 'https://matthewmarks.com/exhibitions', address: '522 W 22nd St, New York, NY 10011' },
  { name: 'Marianne Boesky', url: 'https://marianneboeskygallery.com/exhibitions', address: '507 W 24th St, New York, NY 10011' },
  { name: 'Jack Shainman', url: 'https://jackshainman.com/exhibitions', address: '513 W 20th St, New York, NY 10011', fetchDetailDates: true },
  { name: 'Sprüth Magers', url: 'https://www.spruethmagers.com/exhibitions', address: '22 E 80th St, New York, NY 10075', locationFilter: /new york/i },
  { name: 'Petzel', url: 'https://petzel.com/exhibitions', address: '456 W 18th St, New York, NY 10011' },
  { name: 'Sean Kelly', url: 'https://skny.com/exhibitions', address: '475 10th Ave, New York, NY 10018' },
  { name: 'Karma', url: 'https://karmakarma.org/exhibitions', address: '188 E 2nd St, New York, NY 10009' },
  { name: 'James Fuentes', url: 'https://jamesfuentes.com/exhibitions', address: '55 Delancey St, New York, NY 10002' },
  { name: 'Canada Gallery', url: 'https://canadanewyork.com/exhibitions', address: '60 Lispenard St, New York, NY 10013' },
  { name: 'Blade Study', url: 'https://bladestudy.com/exhibitions', address: 'New York, NY' },
  { name: 'Salon 94', url: 'https://salon94.com/exhibitions', address: '3 E 89th St, New York, NY 10128' },
  { name: 'Kasmin', url: 'https://www.kasmingallery.com/exhibitions', address: '509 W 27th St, New York, NY 10001' },
  { name: 'Tanya Bonakdar', url: 'https://www.tanyabonakdargallery.com/exhibitions', address: '521 W 21st St, New York, NY 10011' },
  { name: 'Anton Kern', url: 'https://www.antonkerngallery.com/exhibitions', address: '16 E 55th St, New York, NY 10022' },
  { name: 'Sikkema Jenkins', url: 'https://www.smjny.com/current-exhibitions', address: '256 W 22nd St, New York, NY 10011', linkSelector: 'a[href^="/ex20"]', fetchDetailDates: true },
  { name: 'P.P.O.W', url: 'https://www.ppowgallery.com/exhibitions', address: '392 Broadway, New York, NY 10013' },
  { name: 'Tilton Gallery', url: 'https://www.jacktiltongallery.com/exhibitions', address: '8 E 76th St, New York, NY 10021' },
  { name: 'Almine Rech', url: 'https://www.alminerech.com/exhibitions', address: '39 E 78th St, New York, NY 10075', locationFilter: /new york/i },
  { name: 'Nahmad Contemporary', url: 'https://www.nahmadcontemporary.com/exhibitions', address: '980 Madison Ave, New York, NY 10075' },
  { name: 'Skarstedt', url: 'https://www.skarstedt.com/exhibitions', address: '20 E 79th St, New York, NY 10075', locationFilter: /new york/i },
  { name: 'Casey Kaplan', url: 'https://caseykaplangallery.com/exhibitions', address: '121 W 27th St, New York, NY 10001', linkSelector: 'a[href*="exhibitions="]' },
];

// Date-range regex that matches most gallery date formats in page text
// Matches: "January 24 – February 28, 2026", "11 February – 11 April 2026", "03.05–04.11.2026"
const DATE_RANGE_RE = /(?:(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[\s.]+\d{1,2}(?:\s*,?\s*\d{4})?(?:\s*[–—\-]\s*(?:(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[\s.]+)?\d{1,2}(?:\s*,?\s*\d{4})?)?)|\d{1,2}[\s.]+(?:January|February|March|April|May|June|July|August|September|October|November|December)(?:\s*[–—\-]\s*\d{1,2}[\s.]+(?:January|February|March|April|May|June|July|August|September|October|November|December))?(?:\s+\d{4})?|\d{2}\.\d{2}[–—\-]\d{2}\.\d{2}\.\d{4}/i;

async function scrapeGenericGallery(config) {
  try {
    const res = await axios.get(config.url, { timeout: 10000, headers: GALLERY_HEADERS });
    const $ = cheerio.load(res.data);
    const events = [], seen = new Set();
    const baseUrl = new URL(config.url).origin;

    // Strategy 1: Look for JSON-LD ExhibitionEvent data (cleanest)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const raw = JSON.parse($(el).html() || '{}');
        const items = Array.isArray(raw) ? raw : (raw['@graph'] ? raw['@graph'] : [raw]);
        for (const item of items) {
          if (events.length >= 2) break;
          if (!item['@type'] || !/(Exhibition|Event|VisualArts)/i.test(item['@type'])) continue;
          const name = (item.name || '').trim();
          if (!name || name.length < 5) continue;
          const url = (item.url || '').trim();
          if (!url || seen.has(url)) continue;
          seen.add(url);
          if (config.locationFilter && item.location?.name && !config.locationFilter.test(item.location.name)) continue;
          const { start_date } = parseDateText(item.startDate || '', '');
          if (!start_date) continue;
          const endParsed = parseDateText(item.endDate || '', '');
          const end_date = endParsed.start_date || start_date;
          const evts = galleryEvents(name, item.startDate || '', start_date, end_date, url, config.name, config.address, config.name);
          events.push(...evts);
        }
      } catch (_) {}
    });
    if (events.length > 0) return events;

    // Strategy 2: Find exhibition containers via common selectors
    const containerSelectors = [
      'a[href*="/exhibition"]',
      'article', '[class*="exhibition"]', '[class*="exhibit"]',
      '[class*="listing"]', '[class*="grid-item"]', '[class*="card"]',
      'li[class*="item"]', '[class*="entry"]', '[class*="project"]',
      '[class*="show"]'
    ];
    if (config.linkSelector) containerSelectors.unshift(config.linkSelector);

    // Try direct link approach first (most reliable)
    // Use custom linkSelector if provided, otherwise default to exhibition links
    let $links;
    if (config.linkSelector) {
      $links = $(config.linkSelector).filter((_, el) => {
        const href = $(el).attr('href') || '';
        return href.length > 3 && href !== config.url.replace(baseUrl, '');
      });
    } else {
      $links = $('a[href*="/exhibition"]').filter((_, el) => {
        const href = $(el).attr('href') || '';
        // Skip nav/category/archive links, only want specific exhibition pages
        if (href.includes('/past')) return false;
        return href.split('/').length > 3 || /\/exhibition[s]?\/[^/]+/.test(href);
      });
    }

    if ($links.length >= 2) {
      $links.each((_, el) => {
        if (events.length >= 2) return false;
        const $a = $(el);
        const href = $a.attr('href');
        if (!href) return;
        const url = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
        if (seen.has(url)) return;
        // Skip image-only links (no text) — wait for the text link to the same URL
        const linkText = $a.text().trim();
        if (!linkText && $a.find('img').length > 0) return;
        seen.add(url);

        // Get text content — could be the link itself or a parent container
        let $container = $a.closest('article, [class*="exhibition"], [class*="listing"], [class*="entry"], [class*="card"], li');
        // Fallback: walk up to nearest div/section that contains the link and siblings (date, artist)
        if (!$container.length) $container = $a.closest('h1,h2,h3,h4').parent();
        if (!$container.length) $container = $a.parent();
        const containerText = ($container.length ? $container : $a).text().replace(/\s+/g, ' ').trim();
        if (!containerText || containerText.length < 10) return;

        // Check location filter against full text
        if (config.locationFilter && !config.locationFilter.test(containerText)) return;

        // Extract date from container
        const $ctx = $container.length ? $container : $a;
        const $dateEl = $ctx.find('time,[class*="date"],[datetime]').first();
        let rawDate = ($dateEl.attr('datetime') || $dateEl.text() || '').trim();

        // If no date element, try regex match on container text
        if (!rawDate) {
          // Prefer date range with year (most specific) to avoid false matches from titles
          const rangeWithYear = containerText.match(/(?:(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[\s.]+\d{1,2}(?:\s*,?\s*\d{4})?\s*[–—\-]\s*(?:(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[\s.]+)?\d{1,2}(?:\s*,?\s*\d{4}))/i);
          if (rangeWithYear) {
            rawDate = rangeWithYear[0].trim();
          } else {
            const dateMatch = containerText.match(DATE_RANGE_RE);
            if (dateMatch) rawDate = dateMatch[0].trim();
          }
        }

        // Extract title — prefer heading elements inside link/container, then link text
        const $titleEl = $ctx.find('h1,h2,h3,h4,[class*="title"],[class*="name"],[class*="artist"]').first();
        let title = ($titleEl.length ? $titleEl.text() : '').trim().replace(/\s+/g, ' ');
        if (!title || title.length < 5) {
          title = $a.text().trim().replace(/\s+/g, ' ');
        }

        // If still no title, use the container text minus the date
        if (!title || title.length < 5) {
          title = containerText;
          if (rawDate) title = title.replace(rawDate, '').trim();
        }

        if (!title || title.length < 5) return;
        // Strip date patterns from titles (e.g., when date is embedded in link text)
        if (rawDate) title = title.replace(rawDate, '').trim();
        title = title.replace(/^\d{2}\.\d{2}[–—\-]\d{2}\.\d{2}\.\d{4}\s*/g, '').trim();
        // Strip trailing street addresses and city names (from links wrapping entire cards)
        title = title.replace(/\d{3,5}\s+[A-Z][\w\s]+(?:Street|Avenue|Boulevard|Road|Drive|Lane|Way|Place|Court|St|Ave|Blvd|Rd|Ln|Pl)\b.*$/i, '').trim();
        title = title.replace(/(?:New York|NYC|Los Angeles|London|Paris|Hong Kong|Berlin|Seoul|Tokyo)\b.*$/i, '').trim();
        title = title.replace(/[\s,;.—–\-]+$/, '').trim();
        // Truncate overly long titles (got the whole container text)
        if (title.length > 120) title = title.substring(0, 120).trim();

        const { start_date, end_date } = galleryDateRange(rawDate || '');
        if (!start_date) return;

        const evts = galleryEvents(title, rawDate, start_date, end_date, url, config.name, config.address, config.name);
        events.push(...evts);
      });
      if (events.length > 0) return events;
    }

    // Strategy 3: Container-based approach (like Gladstone)
    let $items = $();
    for (const sel of containerSelectors) {
      $items = $(sel).filter((_, el) => $(el).find('a').length > 0);
      if ($items.length >= 2) break;
    }

    $items.each((_, el) => {
      if (events.length >= 2) return false;
      const $e = $(el);
      const title = $e.find('h1,h2,h3,h4,[class*="title"],[class*="name"],[class*="artist"]').first().text().trim().replace(/\s+/g, ' ');
      if (!title || title.length < 5) return;
      const href = $e.find('a').first().attr('href');
      if (!href) return;
      const url = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
      if (seen.has(url)) return;
      seen.add(url);

      if (config.locationFilter) {
        const elText = $e.text();
        if (!config.locationFilter.test(elText)) return;
      }

      const $dateEl = $e.find('time,[class*="date"],[datetime]').first();
      let rawDate = ($dateEl.attr('datetime') || $dateEl.text() || '').trim();
      if (!rawDate) {
        const fullText = $e.text().replace(/\s+/g, ' ').trim();
        const dateMatch = fullText.match(DATE_RANGE_RE);
        if (dateMatch) rawDate = dateMatch[0].trim();
      }

      const { start_date, end_date } = galleryDateRange(rawDate || '');
      if (!start_date) return;

      const evts = galleryEvents(title, rawDate, start_date, end_date, url, config.name, config.address, config.name);
      events.push(...evts);
    });

    // If no events found and fetchDetailDates is enabled, collect exhibition links
    // and fetch their detail pages to extract dates (for galleries that don't show dates on listing)
    if (events.length === 0 && config.fetchDetailDates) {
      const detailLinks = [];
      const detailSeen = new Set();
      const currentYear = new Date().getFullYear();
      const detailSelector = config.linkSelector || 'a[href*="/exhibition"]';
      $(detailSelector).each((_, el) => {
        const href = $(el).attr('href') || '';
        if (href === '/exhibitions' || href === '/exhibitions/' || href.includes('/past')) return;
        // Skip links whose URL embeds a year before the current year (e.g. /ex20230428...)
        const yearInHref = href.match(/\/ex(\d{4})/);
        if (yearInHref && parseInt(yearInHref[1]) < currentYear) return;
        const url = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
        if (detailSeen.has(url)) return;
        detailSeen.add(url);
        const title = $(el).text().replace(/\s+/g, ' ').trim();
        if (title && title.length >= 5) detailLinks.push({ url, title });
      });

      const detailResults = await Promise.allSettled(
        detailLinks.slice(0, 5).map(async ({ url, title }) => {
          const detailRes = await axios.get(url, { timeout: 8000, headers: GALLERY_HEADERS });
          const detail$ = cheerio.load(detailRes.data);
          const bodyText = detail$('body').text().replace(/\s+/g, ' ');
          const dateMatch = bodyText.match(DATE_RANGE_RE);
          if (!dateMatch) return null;
          const rawDate = dateMatch[0].trim();
          const { start_date, end_date } = galleryDateRange(rawDate);
          if (!start_date) return null;
          return galleryEvents(title, rawDate, start_date, end_date, url, config.name, config.address, config.name);
        })
      );
      for (const r of detailResults) {
        if (r.status === 'fulfilled' && r.value) events.push(...r.value);
      }
    }

    return events;
  } catch (e) {
    console.error(`${config.name} failed:`, e.message);
    return [];
  }
}

// Run all gallery scrapers in parallel; returns { events, counts }
async function scrapeGalleries() {
  console.log('Scraping galleries...');
  const allEvents = [];
  const counts = {};

  // Build unified task list: dedicated scrapers + generic configs
  const dedicatedTasks = [
    { name: 'Gagosian', fn: scrapeGagosian },
    { name: 'Pace Gallery', fn: scrapePaceGallery },
    { name: 'David Zwirner', fn: scrapeDavidZwirner },
    { name: 'Lehmann Maupin', fn: scrapeLehmannMaupin },
    { name: 'Lisson Gallery', fn: scrapeLissonGallery },
    { name: 'Marian Goodman', fn: scrapeMarianGoodman },
    { name: 'Gladstone Gallery', fn: scrapeGladstoneGallery },
  ];
  const genericTasks = GENERIC_GALLERIES.map(c => ({ name: c.name, fn: () => scrapeGenericGallery(c) }));
  const allTasks = [...dedicatedTasks, ...genericTasks];

  // Run all galleries in parallel (each has its own 15s timeout so this is safe)
  const results = await Promise.allSettled(allTasks.map(t => t.fn()));
  for (let i = 0; i < allTasks.length; i++) {
    const events = results[i].status === 'fulfilled' ? results[i].value : [];
    console.log(`  - ${allTasks[i].name}: ${events.length} events`);
    counts[allTasks[i].name] = events.length;
    allEvents.push(...events);
  }

  console.log(`Gallery total: ${allEvents.length} events`);
  return { events: allEvents, counts };
}

// ─────────────────────────────────────────────────────────────────────────────

// Scrape by group: 'main' = listing sites + enrichment, 'galleries' = all 30 galleries
// Splitting into groups keeps each invocation under Vercel's 60s timeout.
async function scrapeByGroup(group) {
  try {
    if (group === 'galleries') {
      console.log('Starting gallery scraping...');
      const galleriesResult = await scrapeGalleries();
      const events = galleriesResult.events;
      const counts = galleriesResult.counts;

      // Filter permanent exhibitions
      const filtered = events.filter(e => {
        const d = (e.date || '').toLowerCase();
        if (d.match(/^on view/i)) return false;
        return true;
      });

      // Clean descriptions
      for (const event of filtered) {
        event.description = cleanDescription(event.description);
      }

      filtered._galleryCounts = counts;
      console.log(`Gallery total: ${filtered.length} events`, counts);
      return filtered;
    }

    // Default: 'main' group — listing sites + museums + enrichment
    console.log('Starting main source scraping...');
    const [
      timeoutEvents,
      nycFreeEvents,
      whitneyEvents,
      momaEvents,
      guggenheimEvents,
      amnhEvents,
      newMuseumEvents,
      localGirlEvents,
      thrillistEvents
    ] = await Promise.all([
      scrapeTimeOut(),
      scrapeNYCForFree(),
      scrapeWhitney(),
      scrapeMoMA(),
      scrapeGuggenheim(),
      scrapeAMNH(),
      scrapeNewMuseum(),
      scrapeTheLocalGirl(),
      scrapeThrillist()
    ]);

    const merged = [
      ...timeoutEvents,
      ...nycFreeEvents,
      ...whitneyEvents,
      ...momaEvents,
      ...guggenheimEvents,
      ...amnhEvents,
      ...newMuseumEvents,
      ...thrillistEvents,
      ...localGirlEvents
    ];

    // Filter out permanent/long-running exhibitions
    const allEvents = merged.filter(e => {
      const d = (e.date || '').toLowerCase();
      const t = (e.time || '').toLowerCase();
      if (d.includes('now on view') && t.includes('museum hours')) return false;
      if (d.match(/^on view/i)) return false;
      if (d.match(/^through\s/i) && t.includes('museum hours')) return false;
      return true;
    });

    console.log(`Main sources: ${merged.length} scraped, ${allEvents.length} after filtering`);
    console.log(`  - TimeOut NY: ${timeoutEvents.length}`);
    console.log(`  - NYC For Free: ${nycFreeEvents.length}`);
    console.log(`  - Whitney Museum: ${whitneyEvents.length}`);
    console.log(`  - MoMA: ${momaEvents.length}`);
    console.log(`  - Guggenheim: ${guggenheimEvents.length}`);
    console.log(`  - AMNH: ${amnhEvents.length}`);
    console.log(`  - New Museum: ${newMuseumEvents.length}`);
    console.log(`  - The Local Girl: ${localGirlEvents.length}`);

    if (allEvents.length === 0) {
      console.log('No events found from any source, using fallback events');
      return getFallbackEvents();
    }

    // Enrich with detail page descriptions
    console.log('Enriching events with detail page descriptions...');
    await enrichWithDetailPages(allEvents, 8);

    // Clean descriptions
    for (const event of allEvents) {
      event.description = cleanDescription(event.description);
    }

    return allEvents;
  } catch (error) {
    console.error(`Scraping group '${group}' failed:`, error.message);
    return group === 'main' ? getFallbackEvents() : [];
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify authorization: Vercel cron sends GET with x-vercel-cron header;
  // manual runs use POST with the bearer secret.
  const authHeader = req.headers.authorization;
  const isVercelCron = !!req.headers['x-vercel-cron'];
  const expectedToken = process.env.SCRAPE_SECRET || 'soiree-scrape-secret-2024';

  if (!isVercelCron && authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!isVercelCron && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        date VARCHAR(100) NOT NULL,
        time VARCHAR(100) NOT NULL,
        location VARCHAR(255) NOT NULL,
        address VARCHAR(500),
        price VARCHAR(50) DEFAULT 'free',
        spots INTEGER DEFAULT 0,
        image TEXT,
        description TEXT,
        highlights JSONB,
        url VARCHAR(500),
        scraped_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        source VARCHAR(100)
      )
    `);

    // Add url column if it doesn't exist (for existing tables)
    await pool.query(`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS source VARCHAR(100)
    `);

    // Add event_type column for art exhibition openings vs viewing windows
    await pool.query(`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS event_type VARCHAR(50)
    `);

    // Clean existing duplicates before creating unique index
    // First, remove events with NULL or empty URLs (old fallback data)
    await pool.query(`
      DELETE FROM events WHERE url IS NULL OR url = ''
    `);


    // Then keep only the most recent event for each URL
    await pool.query(`
      DELETE FROM events a USING events b
      WHERE a.id < b.id AND a.url = b.url
    `);

    // Remove #exhibition fragment duplicates — keep base URL version
    await pool.query(`
      DELETE FROM events WHERE url LIKE '%#exhibition'
        AND REPLACE(url, '#exhibition', '') IN (SELECT url FROM events)
    `);

    // Remove junk events with non-descriptive names
    await pool.query(`
      DELETE FROM events WHERE LOWER(TRIM(name)) = 'extended through'
    `);

    // Add unique constraint on URL to prevent duplicates
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS events_url_unique ON events(url)
    `);

    // Get events — split by group to stay under Vercel 60s timeout
    // ?group=main (default) = listing sites + museums + enrichment
    // ?group=galleries = all 30 gallery scrapers
    const group = (req.query.group || 'main').toLowerCase();
    console.log(`Scraping group: ${group}`);
    const events = await scrapeByGroup(group);

    // Remove duplicates from scraped events (same URL)
    const uniqueEvents = [];
    const seenUrls = new Set();
    for (const event of events) {
      if (!seenUrls.has(event.url)) {
        seenUrls.add(event.url);
        uniqueEvents.push(event);
      }
    }

    // Get all existing placeholder events (Feb 15, 2026)
    const placeholderEvents = await pool.query(`
      SELECT url, name, source 
      FROM events 
      WHERE start_date = '2026-02-15'
    `);

    // Track which placeholder events are still found
    const foundPlaceholderUrls = new Set();
    uniqueEvents.forEach(event => {
      if (event.start_date === '2026-02-15') {
        foundPlaceholderUrls.add(event.url);
      }
    });

    // Mark missing placeholder events as past (set date to yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let markedPast = 0;
    for (const oldEvent of placeholderEvents.rows) {
      if (!foundPlaceholderUrls.has(oldEvent.url)) {
        // Event no longer found on source website - mark as past
        await pool.query(
          `UPDATE events 
           SET start_date = $1, end_date = $1 
           WHERE url = $2`,
          [yesterdayStr, oldEvent.url]
        );
        markedPast++;
        console.log(`Marked as past: ${oldEvent.name} (${oldEvent.source})`);
      }
    }

    // Insert or update events
    let inserted = 0;
    let updated = 0;
    for (const event of uniqueEvents) {
      try {
        const result = await pool.query(
          `INSERT INTO events (name, category, date, time, location, address, price, spots, image, description, highlights, url, start_date, end_date, source, event_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           ON CONFLICT (url) DO UPDATE SET
             name = EXCLUDED.name,
             category = EXCLUDED.category,
             date = EXCLUDED.date,
             time = EXCLUDED.time,
             location = EXCLUDED.location,
             address = EXCLUDED.address,
             price = EXCLUDED.price,
             image = EXCLUDED.image,
             description = EXCLUDED.description,
             highlights = EXCLUDED.highlights,
             start_date = EXCLUDED.start_date,
             end_date = EXCLUDED.end_date,
             event_type = EXCLUDED.event_type,
             scraped_at = CURRENT_TIMESTAMP
           RETURNING (xmax = 0) AS inserted`,
          [event.name, event.category, event.date, event.time, event.location,
          event.address, event.price, event.spots, event.image, event.description,
          JSON.stringify(event.highlights), event.url, event.start_date, event.end_date, event.source, event.event_type || null]
        );

        if (result.rows[0].inserted) {
          inserted++;
        } else {
          updated++;
        }
      } catch (error) {
        console.log(`Error with event: ${event.name} - ${error.message}`);
      }
    }

    // Bump the cumulative total by the number of newly inserted events
    if (inserted > 0) {
      await pool.query(`
        UPDATE stats SET total_events_scraped = total_events_scraped + $1, updated_at = NOW()
        WHERE id = 1
      `, [inserted]);
    }

    // Log scrape activity
    await pool.query(
      `INSERT INTO activity_log (type, event_count) VALUES ('scrape', $1)`,
      [events.length]
    ).catch(() => {}); // don't fail scrape if log table doesn't exist yet

    // Detail-page enrichment: fill missing times/prices/descriptions from
    // the facts each source actually publishes one page deeper. Never
    // fails the scrape — enrichment is a bonus, not a dependency.
    let enrichment = { attempted: 0, enriched: 0, fieldsWritten: 0 };
    try {
      enrichment = await enrichEvents(pool);
    } catch (err) {
      console.error('Enrichment error (non-fatal):', err.message);
    }

    const result = await pool.query('SELECT COUNT(*) as count FROM events');

    return res.status(200).json({
      success: true,
      message: 'Scraping completed - smart event management',
      scraped: events.length,
      unique: uniqueEvents.length,
      inserted: inserted,
      updated: updated,
      markedPast: markedPast,
      enrichment: enrichment,
      totalEvents: parseInt(result.rows[0].count),
      galleryCounts: events._galleryCounts || {},
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Scrape Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
