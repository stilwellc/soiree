const { Pool } = require('pg');
const axios = require('axios');
const cheerio = require('cheerio');
const { parseDateText } = require('./lib/dateParser.js');
const { createNormalizedEvent } = require('./lib/normalize.js');

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
    const response = await axios.get('https://www.timeout.com/newyork/things-to-do/free-things-to-do-in-new-york', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const events = [];

    // Parse event cards
    $('.card, ._card, .listingCard, [class*="Card"]').each((i, elem) => {
      if (events.length >= 15) return false;

      const $elem = $(elem);
      const title = $elem.find('h3, h2, .card-title, [class*="title"]').first().text().trim();
      if (!title || title.length < 5) return;

      const description = $elem.find('p, .card-description, [class*="description"]').first().text().trim();
      const location = $elem.find('.venue, .location, .neighborhood').first().text().trim();
      const link = $elem.find('a').first().attr('href');
      if (!link) return;

      const category = categorizeEvent(title, description, location);
      const eventUrl = link.startsWith('http') ? link : `https://www.timeout.com${link}`;

      const dateStr = 'Upcoming';
      const timeStr = 'Various times';
      const { start_date, end_date } = parseDateText(dateStr, timeStr);

      const event = createNormalizedEvent({
        name: title,
        category,
        date: dateStr,
        time: timeStr,
        start_date,
        end_date,
        location,
        address: location,
        price: 'free',
        spots: Math.floor(Math.random() * 150) + 30,
        image: getEventImage(title, category),
        description: description || `Experience ${title.toLowerCase()} in New York City.`,
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

    $('[class*="event"], article, .card').each((i, elem) => {
      if (events.length >= 15) return false;

      const $elem = $(elem);

      let name = $elem.find('h1, h2, h3, h4, [class*="title"]').first().text().trim();
      if (!name || name.length < 5) return;

      let href = $elem.find('a').first().attr('href') || $elem.attr('href');
      if (!href) return;

      let description = $elem.find('p, [class*="description"]').first().text().trim();
      if (!description || description.length < 10) description = name;

      let date = 'Upcoming';
      let time = 'See details';
      const dateText = $elem.find('time, [class*="date"]').first().text().trim();
      if (dateText) {
        const dateMatch = dateText.match(/([A-Za-z]+\s+\d{1,2})/);
        if (dateMatch) date = dateMatch[1];
        const timeMatch = dateText.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
        if (timeMatch) time = timeMatch[1];
      }

      const location = 'AMNH';
      const address = '200 Central Park West, New York, NY 10024';
      const category = categorizeEvent(name, description, location);
      const eventUrl = href.startsWith('http') ? href : `https://www.amnh.org${href}`;

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
        highlights: ['Natural History', 'Science talks', 'Family friendly', 'Free admission'],
        url: eventUrl,
        source: 'AMNH'
      });

      if (event) events.push(event);
    });

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

    // Find event list items
    $('.events-list li, #today-events-list li').each((i, elem) => {
      if (events.length >= 15) return false;

      const $elem = $(elem);

      // Find the event link and title
      const $link = $elem.find('.events-today__events a').first();
      if (!$link.length) return;

      const href = $link.attr('href');
      if (!href) return;

      // Get title from h3
      const name = $link.find('h3').first().text().trim();
      if (!name || name.length < 5) return;

      // Get description/location from p tag
      let description = $link.find('p').first().text().trim();
      if (!description || description.length < 10) description = name;

      // Get time from events-today__time
      let time = $elem.find('.events-today__time').first().text().trim();
      if (!time) time = 'See details';

      // Get date - Whitney shows "Today" or actual dates
      let date = 'Today';

      const location = 'Whitney Museum';
      const address = '99 Gansevoort St, New York, NY 10014';
      const category = categorizeEvent(name, description, location);
      const eventUrl = href.startsWith('http') ? href : `https://whitney.org${href}`;

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
        highlights: ['Whitney Museum', 'American art', 'Contemporary exhibitions', 'Free event'],
        url: eventUrl,
        source: 'Whitney Museum'
      });

      if (event) events.push(event);
    });

    console.log(`Scraped ${events.length} events from Whitney`);
    return events;
  } catch (error) {
    console.error('Whitney Museum scraping failed:', error.message);
    return [];
  }
}

// Scrape events and exhibitions from Guggenheim via WordPress REST API
async function scrapeGuggenheim() {
  try {
    console.log('Fetching events from Guggenheim (WP REST API)...');
    const events = [];

    // Fetch events only (skip permanent exhibitions)
    const eventsRes = await axios.get('https://www.guggenheim.org/wp-json/wp/v2/event', {
      params: { per_page: 15, orderby: 'date', order: 'desc' },
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    }).catch(() => ({ data: [] }));

    const location = 'Guggenheim';
    const address = '1071 5th Ave, New York, NY 10128';

    // Process events
    for (const item of eventsRes.data) {
      if (events.length >= 15) break;

      const name = (item.title?.rendered || '').replace(/<[^>]+>/g, '').trim();
      if (!name || name.length < 5) continue;

      const description = (item.excerpt?.rendered || '').replace(/<[^>]+>/g, '').trim();
      const eventUrl = item.link || `https://www.guggenheim.org/event/${item.slug}`;
      const category = categorizeEvent(name, description, location);

      const dateStr = 'Upcoming';
      const timeStr = 'See details';
      const { start_date, end_date } = parseDateText(dateStr, timeStr);

      const event = createNormalizedEvent({
        name,
        category,
        date: dateStr,
        time: timeStr,
        start_date,
        end_date,
        location,
        address,
        price: 'free',
        spots: Math.floor(Math.random() * 150) + 50,
        image: getEventImage(name, category),
        description: description || `${name} at the Guggenheim Museum.`,
        highlights: ['Guggenheim', 'Modern art', 'Iconic architecture', 'Free event'],
        url: eventUrl,
        source: 'Guggenheim'
      });

      if (event) events.push(event);
    }

    console.log(`Scraped ${events.length} events from Guggenheim`);
    return events;
  } catch (error) {
    console.error('Guggenheim scraping failed:', error.message);
    return [];
  }
}

// Scrape events from New Museum (Next.js site with __NEXT_DATA__)
// NOTE: Event data may be loaded client-side. This scraper extracts
// whatever is available from the SSR __NEXT_DATA__ JSON payload.
async function scrapeNewMuseum() {
  try {
    console.log('Fetching events from New Museum...');
    const response = await axios.get('https://www.newmuseum.org/calendar', {
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const $ = cheerio.load(response.data);
    const events = [];

    // Try to extract event data from __NEXT_DATA__ JSON
    const nextDataScript = $('#__NEXT_DATA__').html();
    if (nextDataScript) {
      try {
        const nextData = JSON.parse(nextDataScript);
        const templateData = nextData?.props?.pageProps?.__TEMPLATE_QUERY_DATA__ || {};
        const eventNodes = templateData?.events?.nodes || [];

        for (const node of eventNodes) {
          if (events.length >= 15) break;

          const name = (node.title || '').trim();
          if (!name || name.length < 5) continue;

          const uri = node.uri || node.slug || '';
          const description = (node.excerpt || node.content || '').replace(/<[^>]+>/g, '').trim();
          const startDate = node.startDate || 'Upcoming';

          const location = 'New Museum';
          const address = '235 Bowery, New York, NY 10002';
          const category = categorizeEvent(name, description, location);
          const eventUrl = uri.startsWith('http') ? uri : `https://www.newmuseum.org${uri}`;

          // Parse structured dates
          const { start_date, end_date } = parseDateText(startDate, 'See details');

          const event = createNormalizedEvent({
            name,
            category,
            date: startDate,
            time: 'See details',
            start_date,
            end_date,
            location,
            address,
            price: 'free',
            spots: Math.floor(Math.random() * 150) + 50,
            image: getEventImage(name, category),
            description: description || `${name} at the New Museum.`,
            highlights: ['New Museum', 'Contemporary art', 'Cutting-edge exhibitions', 'Free admission'],
            url: eventUrl,
            source: 'New Museum'
          });

          if (event) events.push(event);
        }
      } catch (parseError) {
        console.log('Could not parse New Museum __NEXT_DATA__:', parseError.message);
      }
    }

    // Fallback: try standard HTML selectors
    if (events.length === 0) {
      $('[class*="event"], article, .card').each((i, elem) => {
        if (events.length >= 15) return false;

        const $elem = $(elem);
        let name = $elem.find('h1, h2, h3, h4, [class*="title"]').first().text().trim();
        if (!name || name.length < 5) return;

        let href = $elem.find('a').first().attr('href') || $elem.attr('href');
        if (!href) return;

        let description = $elem.find('p, [class*="description"]').first().text().trim();
        if (!description || description.length < 10) description = name;

        const location = 'New Museum';
        const address = '235 Bowery, New York, NY 10002';
        const category = categorizeEvent(name, description, location);
        const eventUrl = href.startsWith('http') ? href : `https://www.newmuseum.org${href}`;

        const dateStr = 'Upcoming';
        const timeStr = 'See details';
        const { start_date, end_date } = parseDateText(dateStr, timeStr);

        const event = createNormalizedEvent({
          name,
          category,
          date: dateStr,
          time: timeStr,
          start_date,
          end_date,
          location,
          address,
          price: 'free',
          spots: Math.floor(Math.random() * 150) + 50,
          image: getEventImage(name, category),
          description,
          highlights: ['New Museum', 'Contemporary art', 'Cutting-edge exhibitions', 'Free admission'],
          url: eventUrl,
          source: 'New Museum'
        });

        if (event) events.push(event);
      });
    }

    console.log(`Scraped ${events.length} events from New Museum`);
    return events;
  } catch (error) {
    console.error('New Museum scraping failed:', error.message);
    return [];
  }
}

// Scrape events from The Local Girl (Hoboken/JC)
async function scrapeTheLocalGirl() {
  try {
    console.log('Fetching events from The Local Girl...');
    const response = await axios.get('https://thelocalgirl.com/calendar/hoboken/', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const events = [];

    const h2Count = $('h2').length;
    console.log(`[TheLocalGirl] Found ${h2Count} H2 elements`);

    // The Local Girl uses a standard layout, events are distinct blocks
    // Based on HTML analysis, we look for event items. 
    // Since the structure can be tricky, we'll look for the repeating pattern of headers or article/div classes.
    // The previous chunks showed <h2> with links as event titles.

    // Find containers that look like event listings
    // Structure seems to be: 
    // <h2><a href="...">Title</a></h2>
    // ... metadata ...
    // <img ... src="...">

    $('h2').each((i, elem) => {
      if (events.length >= 15) return false;

      const $title = $(elem).find('a').first();
      const name = $title.text().trim();
      const href = $title.attr('href');

      if (!name || !href) return;

      // Locate the container or sibling elements for other details
      // The chunks suggest a flat structure where <h2> appears before other details
      // We might need to look at the next few siblings
      let $next = $(elem).next();
      let description = '';
      let image = '';
      let categories = [];
      let location = 'Hoboken/Jersey City';
      let address = '';

      // Try to find image and categories in following siblings
      // We scan up to 10 next siblings to find relevant info
      for (let j = 0; j < 10; j++) {
        if ($next.length === 0 || $next.is('h2')) break;

        // Check for image
        const $img = $next.find('img');
        if ($img.length && !image) {
          image = $img.attr('src');
        }

        // Check for categories links
        $next.find('a[href*="/category/"]').each((_, catLink) => {
          const catText = $(catLink).text().trim();
          if (catText && catText !== 'The Hoboken Girl Calendar' && !categories.includes(catText)) {
            categories.push(catText);
          }
        });

        // Check for maps link to get address
        $next.find('a[href*="maps.google.com"], a[href*="maps.apple.com"]').each((_, mapLink) => {
          const href = $(mapLink).attr('href');
          // Extract query param from map link which usually contains address
          try {
            const url = new URL(href);
            const query = url.searchParams.get('q') || url.searchParams.get('query');
            if (query && !address) {
              address = query;
            }
          } catch (e) { }
        });

        $next = $next.next();
      }

      if (address.includes('Jersey City')) location = 'Jersey City';
      else if (address.includes('Hoboken')) location = 'Hoboken';
    }

      console.log(`[TheLocalGirl] Processing potential event: ${name} (${href})`);

    const category = categorizeEvent(name, categories.join(' '), location);

    // Since listing page doesn't show dates clearly in the text chunks, we set 'Upcoming'
    // Ideally we would fetch the detail page, but for now we fallback to generic
    const dateStr = 'Upcoming';
    const timeStr = 'See details';
    const { start_date, end_date } = parseDateText(dateStr, timeStr);

    const event = createNormalizedEvent({
      name,
      category,
      date: dateStr,
      time: timeStr,
      start_date,
      end_date,
      location,
      address: address || location,
      price: 'See details', // Price isn't obvious on listing
      spots: Math.floor(Math.random() * 100) + 20,
      image: image || getEventImage(name, category),
      description: description || `Event in ${location}: ${name}`,
      highlights: categories.length ? categories.slice(0, 4) : ['Local event', 'Community', location],
      url: href,
      source: 'The Local Girl'
    });

    if (event) events.push(event);
  });

  console.log(`Scraped ${events.length} events from The Local Girl, fetching dates...`);

  // Fetch details for each event to get the real date
  await Promise.allSettled(events.map(async (event) => {
    try {
      const detailRes = await axios.get(event.url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const $detail = cheerio.load(detailRes.data);

      // Metadata often appears in the first paragraph after the H1 title
      const dateText = $detail('h1').next('p').text().trim();

      // Also try to find time if possible, but date is priority
      // Sometimes dateText includes time, e.g. "February 7, 2026 @ 7:00 pm - 10:00 pm"

      if (dateText && dateText.length < 50) {
        // Check if it looks like a date
        if (dateText.match(/([A-Z][a-z]+ \d{1,2}, \d{4})/)) {
          event.date = dateText;
          if (dateText.includes('@')) {
            const parts = dateText.split('@');
            event.date = parts[0].trim();
            event.time = parts[1].trim();
          }
          // Re-parse with new date
          const { start_date, end_date } = parseDateText(event.date, event.time);
          event.start_date = start_date;
          event.end_date = end_date;
        }
      }
    } catch (e) {
      console.log(`Failed to fetch details for ${event.url} in LocalGirl scraper: ${e.message}`);
    }
  }));

  return events;

} catch (error) {
  console.error('The Local Girl scraping failed:', error.message);
  return [];
}
}

// Main orchestrator - scrapes all sources and merges results
async function scrapeAllEvents() {
  try {
    console.log('Starting multi-source scraping...');

    // Run all scrapers in parallel
    const [
      timeoutEvents,
      nycFreeEvents,
      whitneyEvents,
      momaEvents,
      guggenheimEvents,
      amnhEvents,
      newMuseumEvents,
      localGirlEvents
    ] = await Promise.all([
      scrapeTimeOut(),
      scrapeNYCForFree(),
      scrapeWhitney(),
      scrapeMoMA(),
      scrapeGuggenheim(),
      scrapeAMNH(),
      scrapeNewMuseum(),
      scrapeTheLocalGirl()
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
      ...localGirlEvents
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

    // Clear ALL events to ensure fresh categorizations
    // This guarantees events always have the latest category logic
    await pool.query(`DELETE FROM events`);

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

    // Insert events with conflict handling (skip duplicates)
    let inserted = 0;
    let skipped = 0;
    for (const event of uniqueEvents) {
      try {
        await pool.query(
          `INSERT INTO events (name, category, date, time, location, address, price, spots, image, description, highlights, url, start_date, end_date, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (url) DO NOTHING`,
          [event.name, event.category, event.date, event.time, event.location,
          event.address, event.price, event.spots, event.image, event.description,
          JSON.stringify(event.highlights), event.url, event.start_date, event.end_date, event.source]
        );
        inserted++;
      } catch (error) {
        console.log(`Skipped duplicate: ${event.name}`);
        skipped++;
      }
    }

    const result = await pool.query('SELECT COUNT(*) as count FROM events');

    return res.status(200).json({
      success: true,
      message: 'Scraping completed - duplicates removed',
      scraped: events.length,
      unique: uniqueEvents.length,
      inserted: inserted,
      skipped: skipped,
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
