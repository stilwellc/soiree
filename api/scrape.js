const { Pool } = require('pg');
const axios = require('axios');
const cheerio = require('cheerio');
const { parseDateText } = require('./lib/dateParser.js');
const { createNormalizedEvent } = require('./lib/normalize.js');
const { scrapeWithPuppeteer, CONFIGS } = require('../scripts/scrape-puppeteer.js');

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
      highlights: ["Guided tour", "Instagram spots", "Meet artists", "2-hour experience"],
      url: "https://www.nycforfree.co/events"
    },
    {
      name: "Free Jazz in Central Park",
      category: "music",
      date: "Friday Evening",
      time: "7:00 PM - 9:00 PM",
      location: "Central Park",
      address: "Rumsey Playfield, Central Park",
      price: "free",
      spots: 200,
      image: getEventImage("Free Jazz in Central Park", "music"),
      description: "Evening of smooth jazz under the stars.",
      highlights: ["Live quartet", "Outdoor setting", "Bring picnic", "Family friendly"],
      url: "https://www.nycforfree.co/events"
    },
    {
      name: "DUMBO Food Market",
      category: "culinary",
      date: "Sunday",
      time: "11:00 AM - 6:00 PM",
      location: "DUMBO, Brooklyn",
      address: "Pearl Plaza, Brooklyn, NY",
      price: "free",
      spots: 300,
      image: getEventImage("DUMBO Food Market", "culinary"),
      description: "Sample artisanal foods from local vendors.",
      highlights: ["50+ vendors", "Cooking demos", "Free samples", "Waterfront"],
      url: "https://www.nycforfree.co/events"
    }
  ];

  // Add parsed dates to each fallback event
  return events.map(event => {
    const { start_date, end_date } = parseDateText(event.date, event.time);
    return { ...event, start_date, end_date };
  });
}

// Category mapping based on title, description, and location
function categorizeEvent(title, description, location) {
  const text = (title + ' ' + (description || '')).toLowerCase();
  const loc = (location || '').toLowerCase();

  // --- Location-based hints (museums = art) ---
  const museumLocations = ['moma', 'met', 'metropolitan', 'whitney', 'guggenheim',
    'new museum', 'museum', 'gallery', 'brooklyn museum', 'amnh'];
  if (museumLocations.some(m => loc.includes(m))) {
    // Even at a museum, food events stay food
    if (text.match(/\b(cook|chef|tasting|dinner|brunch|food)\b/)) return 'culinary';
    return 'art';
  }

  // --- Perks (events offering complimentary items: samples, gifts, tastings) ---
  if (text.match(/free\s+(sample|gift|coffee|latte|drink|treat|tote|shirt|t-shirt|merch|product|item|goodie|makeup|lipstick|skincare|fragrance|ice cream|donut|doughnut|pizza|slice|cookie|cupcake|smoothie|juice|chai|matcha|espresso|bagel|croissant|muffin|chocolate|beer|wine|cocktail|seltzer|swag)/i) ||
    text.match(/\b(complimentary|giveaway|swag|goodie bag|gift bag|gift with purchase|free gifts?|free tasting)\b/i) ||
    text.match(/while supplies last/i) ||
    text.match(/first\s+\d+\s+(guests?|people|visitors?|customers?)/i)) {
    return 'perks';
  }

  // --- Film / screening detection (directed by, director's cut, year patterns) ---
  if (text.match(/directed by|director's cut|screening|^\d{4}\.\s|film series|\bfilms?\b.*\b\d{4}\b/)) {
    return 'art';
  }

  // --- Art & Culture ---
  if (text.match(/\b(art|gallery|exhibit|exhibition|paint|sculpture|artist|mural|craft|pottery|drawing|illustration|installation|visual|theater|theatre|cinema|film|movie|photography|graffiti|contemporary|abstract|coloring|screening|animation|collection|calligraphy|prints|portrait|studio tour|open studio|architecture tour)\b/) || text.match(/street art|ice sculpture/)) {
    return 'art';
  }

  // --- Music & Nightlife ---
  if (text.match(/\b(music|concert|jazz|dj|band|singer|live|festival|stage|soundtrack|album|vinyl|orchestra|choir|acoustic|symphony|karaoke|rap|rock|indie|electronic|classical|ballet|choreograph|ep release|nightlife|party|rave)\b/) || text.match(/live music|hip hop|release party/)) {
    return 'music';
  }

  // --- Food & Drink ---
  if (text.match(/\b(food|culinary|market|tasting|restaurant|cook|dining|kitchen|chef|menu|wine|coffee|cafe|bakery|brunch|dinner|lunch|breakfast|cocktail|beer|eat|eating|flavor|recipe|gourmet|pizza|burger|chicken|sushi|ramen|bbq|brewery|pub|tavern|bistro|eatery|slice|taco|sandwich|foodie|cuisine|pastry|dessert|appetizer|treat|snack|chocolate|muffin|sundae|smoothie|gnocchi|hot chocolate|ice cream|cookie|doughnut|donut)\b/) || text.match(/grand opening.*(express|grill|kitchen|cafe|deli|restaurant|bar|eatery|bistro|bakery)/i)) {
    return 'culinary';
  }

  // --- Fashion ---
  if (text.match(/\b(fashion|runway|designer|couture|clothing|apparel|boutique|wardrobe|outfit|lookbook|vogue|catwalk|textile)\b/)) {
    return 'fashion';
  }

  // --- Lifestyle (beauty, wellness, fitness, brand pop-ups, shopping) ---
  if (text.match(/\b(yoga|fitness|workout|meditation|wellness|beauty|skincare|spa|k-beauty|cosmetic|makeup|fragrance|self-care|pilates|barre|cycling|running|marathon|gym)\b/) || text.match(/pop-up|popup|launch celebration|grand opening|experience|charm bar|scavenger hunt/)) {
    return 'lifestyle';
  }

  // --- Community (family, kids, sports, volunteering, parades, celebrations) ---
  if (text.match(/\b(family|kids|children|volunteer|parade|camp|fair|story time|storytime|tweens|teens|workshop|seminar|lecture|networking|meetup|discussion|panel|book club|reading|world cup|soccer|basketball|baseball|sports bar|fan village)\b/) || text.match(/valentine|galentine|lunar new year|australia day|wikipedia day/)) {
    return 'community';
  }

  // --- Default: try to infer from title patterns ---
  // Brand names with event-like suffixes
  if (text.match(/\b(celebration|anniversary|birthday|bash|launch)\b/)) return 'community';

  return 'community';
}

// Generate professional Unsplash images based on category
function getEventImage(title, category) {
  // Use Unsplash Source API with category-specific search terms
  // This provides high-quality, professionally curated images

  const categoryImages = {
    music: [
      'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&h=800&fit=crop'
    ],
    culinary: [
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=1200&h=800&fit=crop'
    ],
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
    lifestyle: [
      'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1540555700478-4be289fbec6f?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=800&fit=crop'
    ],
    community: [
      'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=1200&h=800&fit=crop',
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
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html'
      }
    });
    const $ = cheerio.load(response.data);

    // --- Extract Description ---
    const descSelectors = [
      '.eventitem-column-content p',
      '.sqs-block-content p',
      '.entry-content p',
      'article p',
      '.event-description p',
      '.post-content p',
      '.event-content p'
    ];

    let description = '';
    for (const sel of descSelectors) {
      $(sel).each((_, el) => {
        description += ' ' + $(el).text().trim();
      });
      if (description.trim().length > 50) break;
    }
    description = description.trim().substring(0, 1000);

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
        '.event-date',
        '.event-time',
        '.date',
        'time',
        '.event-meta',
        '.eventitem-meta-date',
        '.eventitem-meta-time',
        '[class*="date"]',
        '[class*="time"]'
      ];

      for (const sel of dateSelectors) {
        const text = $(sel).first().text().trim();
        if (text && text.length > 3 && text.length < 200) {
          // Check if this looks like a date
          if (text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|\d{1,2}\/\d{1,2})/i)) {
            dateText = text;
            break;
          }
        }
      }
    }

    return {
      description,
      dateText,
      timeText
    };
  } catch {
    return {
      description: '',
      dateText: '',
      timeText: ''
    };
  }
}

// Enrich events array by fetching detail pages in parallel batches
// Extracts richer descriptions and accurate dates, then re-categorizes
async function enrichWithDetailPages(events, batchSize = 10) {
  console.log(`Enriching ${events.length} events with detail page data...`);
  let enrichedDesc = 0;
  let enrichedDates = 0;

  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(async (event) => {
        const detail = await fetchDetailPageData(event.url);

        // Update description if we got better content
        if (detail.description && detail.description.length > 30) {
          // Combine original + detail description for categorization
          const fullDesc = (event.description + ' ' + detail.description).substring(0, 1000);
          event.description = fullDesc.substring(0, 500);
          // Re-categorize with richer text
          const newCategory = categorizeEvent(event.name, fullDesc, event.location);
          if (newCategory !== event.category) {
            event.category = newCategory;
            event.image = getEventImage(event.name, newCategory);
          }
          enrichedDesc++;
        }

        // Update dates if we got better date info
        if (detail.dateText) {
          // Only update if current dates are generic placeholders
          const isGenericDate = event.date && (
            event.date.toLowerCase() === 'upcoming' ||
            event.date.toLowerCase() === 'today' ||
            event.date.toLowerCase() === 'this week' ||
            event.date.toLowerCase() === 'this weekend' ||
            !event.start_date
          );

          if (isGenericDate) {
            event.date = detail.dateText;
            if (detail.timeText) {
              event.time = detail.timeText;
            }
            // Re-parse dates with better info
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
        highlights: ['Free admission', 'TimeOut curated', 'NYC cultural event', 'All ages welcome'],
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
        highlights: ['Free event', 'NYC location', 'Limited spots', 'RSVP recommended'],
        url: eventUrl,
        source: 'NYC For Free'
      });

      if (event) events.push(event);
    });

    console.log(`Scraped ${events.length} events from nycforfree.co`);
    return events;
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
        highlights: ['MoMA', 'Modern art', 'Contemporary culture', 'Free event'],
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
        highlights: ['Natural History', 'Science', 'Family friendly'],
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
          highlights: ['Natural History', 'Science', 'Family friendly'],
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
        highlights: ['Whitney Museum', 'American art', 'Contemporary'],
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
          highlights: ['Whitney Museum', 'American art', 'Contemporary'],
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
        highlights: categories.length ? categories.slice(0, 4) : ['Local event', 'Community', location],
        url: href,
        source: 'The Local Girl'
      });

      if (event) events.push(event);
    });

    console.log(`Scraped ${events.length} events from The Local Girl`);
    return events;

  } catch (error) {
    console.error('The Local Girl scraping failed:', error.message);
    return [];
  }
}

// Main orchestrator - scrapes all sources and merges results
// ─── Chelsea / NYC Gallery Scrapers ─────────────────────────────────────────

const GALLERY_CONFIGS = [
  { name: 'Gagosian',         url: 'https://gagosian.com/exhibitions/',                    location: 'Gagosian',              address: '555 W 24th St, New York, NY 10011',  puppeteerKey: 'gagosian' },
  { name: 'Pace Gallery',     url: 'https://www.pacegallery.com/exhibitions/',              location: 'Pace Gallery',          address: '540 W 25th St, New York, NY 10001',  puppeteerKey: null },
  { name: 'Hauser & Wirth',   url: 'https://www.hauserwirth.com/hauser-wirth-exhibitions/', location: 'Hauser & Wirth',        address: '542 W 22nd St, New York, NY 10011',  puppeteerKey: 'hauserWirth' },
  { name: 'David Zwirner',    url: 'https://www.davidzwirner.com/exhibitions',              location: 'David Zwirner',         address: '519 W 19th St, New York, NY 10011',  puppeteerKey: 'davidZwirner' },
  { name: 'Gladstone Gallery',url: 'https://gladstonegallery.com/exhibitions/',             location: 'Gladstone Gallery',     address: '130 W 21st St, New York, NY 10011',  puppeteerKey: null },
  { name: 'Lehmann Maupin',   url: 'https://www.lehmannmaupin.com/exhibitions',             location: 'Lehmann Maupin',        address: '501 W 26th St, New York, NY 10001',  puppeteerKey: 'lehmannMaupin' },
  { name: 'Marian Goodman',   url: 'https://www.mariangoodman.com/exhibitions',             location: 'Marian Goodman Gallery',address: '24 W 57th St, New York, NY 10019',   puppeteerKey: 'marianGoodman' },
  { name: 'Lisson Gallery',   url: 'https://www.lissongallery.com/exhibitions',             location: 'Lisson Gallery',        address: '504 W 24th St, New York, NY 10011',  puppeteerKey: 'lissonGallery' }
];

// Shared Cheerio scraper for gallery exhibition pages.
// Only emits events where a single specific date can be found
// (opening reception preferred; exhibition start date as fallback).
async function scrapeGallery(config) {
  try {
    const response = await axios.get(config.url, {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const $ = cheerio.load(response.data);
    const events = [];
    const seen = new Set();
    const origin = new URL(config.url).origin;

    // Try multiple container selectors common on gallery sites
    const containerSelectors = [
      'article', '[class*="exhibition"]', '[class*="exhibit"]',
      '[class*="listing"]', '[class*="grid-item"]', '[class*="card"]',
      'li[class*="item"]'
    ];
    let $items = $();
    for (const sel of containerSelectors) {
      $items = $(sel).filter((_, el) => $(el).find('a').length > 0);
      if ($items.length > 3) break;
    }

    $items.each((i, elem) => {
      if (events.length >= 10) return false;
      const $elem = $(elem);

      // Title
      let title = $elem.find('h1,h2,h3,h4,[class*="title"],[class*="name"]').first().text().trim().replace(/\s+/g, ' ');
      if (!title || title.length < 10) return;
      // Skip navigation / location labels (city names, section headers)
      if (/^(tokyo|berlin|seoul|london|paris|los angeles|new york|geneva|hong kong|exhibitions|upcoming|current|past|artists|home|about|contact|visit|news)$/i.test(title.trim())) return;

      // Link
      const href = $elem.find('a').first().attr('href');
      if (!href) return;
      const eventUrl = href.startsWith('http') ? href : `${origin}${href.startsWith('/') ? '' : '/'}${href}`;
      if (seen.has(eventUrl)) return;
      seen.add(eventUrl);

      const fullText = $elem.text().replace(/\s+/g, ' ');

      // 1. Look for opening reception date (most specific)
      let dateStr = '';
      const openingMatch = fullText.match(/opening\s+(?:reception\s+)?(?:on\s+)?(?:date\s*:?\s*)?([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i) ||
                           fullText.match(/reception[:\s]+([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i);
      if (openingMatch) {
        dateStr = openingMatch[1];
      } else {
        // 2. Look for a date element and take just the start date
        const $dateEl = $elem.find('time,[class*="date"],[datetime],[class*="when"]').first();
        const rawDate = ($dateEl.attr('datetime') || $dateEl.text()).trim();
        if (rawDate) {
          // Strip range suffix — "January 15 – March 20, 2026" → "January 15, 2026"
          // Try to capture "Month Day, Year" at the start
          const startMatch = rawDate.match(/^([A-Za-z]+\s+\d{1,2}(?:,?\s*\d{4})?)/);
          if (startMatch) dateStr = startMatch[1];
          // Or ISO date
          else if (rawDate.match(/^\d{4}-\d{2}-\d{2}/)) dateStr = rawDate.slice(0, 10);
        }
      }

      if (!dateStr) return; // no date → skip (single-day events only)

      const { start_date } = parseDateText(dateStr, '');
      if (!start_date) return;

      const description = $elem.find('p,[class*="desc"],[class*="artist"]').first().text().trim() || title;

      const event = createNormalizedEvent({
        name: title.substring(0, 255),
        category: 'art',
        date: dateStr,
        time: 'See details',
        start_date,
        end_date: start_date, // single-day event
        location: config.location,
        address: config.address,
        price: 'free',
        spots: Math.floor(Math.random() * 80) + 20,
        image: getEventImage(title, 'art'),
        description: description.substring(0, 500) || `${title} at ${config.name}.`,
        highlights: [config.name, 'Gallery opening', 'Contemporary art', 'Chelsea'],
        url: eventUrl,
        source: config.name
      });

      if (event) events.push(event);
    });

    // Puppeteer fallback for JS-rendered gallery sites
    if (events.length === 0 && config.puppeteerKey && CONFIGS[config.puppeteerKey]) {
      console.log(`  ${config.name}: Cheerio got 0, falling back to Puppeteer...`);
      const puppeteerEvents = await scrapeWithPuppeteer(CONFIGS[config.puppeteerKey]);
      // Filter: must have a parseable date
      return puppeteerEvents.filter(e => e.start_date !== null);
    }

    return events;
  } catch (error) {
    console.error(`${config.name} scraping failed:`, error.message);
    return [];
  }
}

// Run all gallery scrapers sequentially to avoid hammering concurrent requests
async function scrapeGalleries() {
  const allEvents = [];
  for (const config of GALLERY_CONFIGS) {
    const events = await scrapeGallery(config);
    console.log(`  - ${config.name}: ${events.length} events`);
    allEvents.push(...events);
  }
  console.log(`Gallery total: ${allEvents.length} events`);
  return allEvents;
}

// ─────────────────────────────────────────────────────────────────────────────

async function scrapeAllEvents() {
  try {
    console.log('Starting multi-source scraping...');

    // Run all scrapers in parallel (galleries run sequentially inside scrapeGalleries)
    const [
      timeoutEvents,
      nycFreeEvents,
      whitneyEvents,
      momaEvents,
      guggenheimEvents,
      amnhEvents,
      newMuseumEvents,
      localGirlEvents,
      galleryEvents
    ] = await Promise.all([
      scrapeTimeOut(),
      scrapeNYCForFree(),
      scrapeWhitney(),
      scrapeMoMA(),
      scrapeGuggenheim(),
      scrapeAMNH(),
      scrapeNewMuseum(),
      scrapeTheLocalGirl(),
      scrapeGalleries()
    ]);

    // Merge all events
    const merged = [
      ...timeoutEvents,
      ...nycFreeEvents,
      ...whitneyEvents,
      ...momaEvents,
      ...guggenheimEvents,
      ...amnhEvents,
      ...newMuseumEvents,
      ...localGirlEvents,
      ...galleryEvents
    ];

    // Filter out permanent/long-running exhibitions
    const allEvents = merged.filter(e => {
      const d = (e.date || '').toLowerCase();
      const t = (e.time || '').toLowerCase();
      // Skip "Now on view" + "Museum hours" (permanent exhibitions)
      if (d.includes('now on view') && t.includes('museum hours')) return false;
      // Skip "On view through..." or "Through [year 2+ years out]"
      if (d.match(/^on view/i)) return false;
      // Skip "Through [date]" with "Museum hours" (long-running exhibition)
      if (d.match(/^through\s/i) && t.includes('museum hours')) return false;
      return true;
    });

    console.log(`Total events scraped: ${merged.length}, after filtering: ${allEvents.length}`);

    console.log(`  - TimeOut NY: ${timeoutEvents.length}`);
    console.log(`  - NYC For Free: ${nycFreeEvents.length}`);
    console.log(`  - Whitney Museum: ${whitneyEvents.length}`);
    console.log(`  - MoMA: ${momaEvents.length}`);
    console.log(`  - Guggenheim: ${guggenheimEvents.length}`);
    console.log(`  - AMNH: ${amnhEvents.length}`);
    console.log(`  - New Museum: ${newMuseumEvents.length}`);
    console.log(`  - The Local Girl: ${localGirlEvents.length}`);
    console.log(`  - Galleries (8): ${galleryEvents.length}`);

    // If no events found at all, use fallback
    if (allEvents.length === 0) {
      console.log('No events found from any source, using fallback events');
      return getFallbackEvents();
    }

    // TODO: Re-enable detail page enrichment when we have better selectors
    // Most museum sites don't expose dates in easily-scrapable format
    // console.log('Enriching events with detail page data...');
    // await enrichWithDetailPages(allEvents, 15);

    return allEvents;
  } catch (error) {
    console.error('Multi-source scraping failed:', error.message);
    return getFallbackEvents();
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify authorization
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.SCRAPE_SECRET || 'soiree-scrape-secret-2024';

  if (authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
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

    // Add unique constraint on URL to prevent duplicates
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS events_url_unique ON events(url)
    `);

    // Get events from all sources
    const events = await scrapeAllEvents();

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
          `INSERT INTO events (name, category, date, time, location, address, price, spots, image, description, highlights, url, start_date, end_date, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
             scraped_at = CURRENT_TIMESTAMP
           RETURNING (xmax = 0) AS inserted`,
          [event.name, event.category, event.date, event.time, event.location,
          event.address, event.price, event.spots, event.image, event.description,
          JSON.stringify(event.highlights), event.url, event.start_date, event.end_date, event.source]
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

    const result = await pool.query('SELECT COUNT(*) as count FROM events');

    return res.status(200).json({
      success: true,
      message: 'Scraping completed - smart event management',
      scraped: events.length,
      unique: uniqueEvents.length,
      inserted: inserted,
      updated: updated,
      markedPast: markedPast,
      totalEvents: parseInt(result.rows[0].count),
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
