const { Pool } = require('pg');
const axios = require('axios');
const cheerio = require('cheerio');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Fallback events if scraping fails
function getFallbackEvents() {
  return [
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
    social: [
      'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&h=800&fit=crop'
    ]
  };

  // Get images array for category, fallback to social
  const images = categoryImages[category] || categoryImages.social;

  // Use title hash to consistently select same image for same event
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i);
    hash = hash & hash;
  }
  const index = Math.abs(hash % images.length);

  return images[index];
}

// Scrape events from The Skint (free events aggregator - includes museum events)
async function scrapeTheSkint() {
  try {
    console.log('Fetching events from The Skint...');
    const response = await axios.get('https://theskint.com/', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const events = [];

    // Parse event listings
    $('.event-item, .post, article').each((i, elem) => {
      if (events.length >= 15) return false;

      const $elem = $(elem);
      const title = $elem.find('h2, h3, .title, .entry-title').first().text().trim();
      if (!title || title.length < 5) return;

      const description = $elem.find('p, .excerpt, .entry-content').first().text().trim();
      const location = $elem.find('.venue, .location').first().text().trim() || 'NYC';
      const link = $elem.find('a').first().attr('href');
      if (!link) return;

      const category = categorizeEvent(title, description, location);
      const eventUrl = link.startsWith('http') ? link : `https://theskint.com${link}`;

      events.push({
        name: title.substring(0, 255),
        category,
        date: 'This Week',
        time: 'See details',
        location: location.substring(0, 255) || 'Various NYC',
        address: location.substring(0, 500),
        price: 'free',
        spots: Math.floor(Math.random() * 100) + 50,
        image: getEventImage(title, category),
        description: (description || `Join us for ${title.toLowerCase()} in NYC.`).substring(0, 500),
        highlights: ['Free entry', 'NYC location', 'Curated by The Skint', 'Quality events'],
        url: eventUrl.substring(0, 500)
      });
    });

    console.log(`Scraped ${events.length} events from The Skint`);
    return events;
  } catch (error) {
    console.error('The Skint scraping failed:', error.message);
    return [];
  }
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

      events.push({
        name: title.substring(0, 255),
        category,
        date: 'Upcoming',
        time: 'Various times',
        location: (location || 'Manhattan').substring(0, 255),
        address: location.substring(0, 500),
        price: 'free',
        spots: Math.floor(Math.random() * 150) + 30,
        image: getEventImage(title, category),
        description: (description || `Experience ${title.toLowerCase()} in New York City.`).substring(0, 500),
        highlights: ['Free admission', 'TimeOut curated', 'NYC cultural event', 'All ages welcome'],
        url: eventUrl.substring(0, 500)
      });
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

    // Find event items
    $('.event-item, a[href*="/events/"]').each((i, elem) => {

      const $elem = $(elem);
      const href = $elem.attr('href') || $elem.find('a').attr('href');

      // Skip if not a proper event link
      if (!href || href === '/events' || href === '/events/' || !href.includes('/events/')) return;

      // Get event name from .event-title or h2/h3
      let name = $elem.find('.event-title, h2, h3').first().text().trim();
      if (!name || name.length < 5) {
        // Fallback to link text if title not found
        name = $elem.text().trim().split('\n')[0].trim();
      }
      if (!name || name.length < 5) return;

      // Extract description
      let description = $elem.find('.event-description, p').first().text().trim();
      if (!description || description.length < 10) description = name;

      // Extract date and time from .event-meta
      let date = 'Upcoming';
      let time = 'See details';
      const timeElem = $elem.find('.event-meta time, time').first().text().trim();
      if (timeElem) {
        // Parse date like "Sat, Oct 11, 2025 11:00 AM - Sat, Jan 31, 2026 8:00 PM"
        const dateParts = timeElem.split('-');
        if (dateParts.length > 0) {
          date = dateParts[0].trim();
          // Extract time
          const timeMatch = timeElem.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
          if (timeMatch) time = timeMatch[1];
        }
      }

      // Extract location from address
      let location = 'New York City';
      let address = 'NYC';
      const addressElem = $elem.find('.event-meta address, address').first().text().trim();
      if (addressElem) {
        address = addressElem;
        // Extract neighborhood/area
        const parts = addressElem.split(',');
        if (parts.length > 1) {
          location = parts[parts.length - 2].trim();
        }
      }

      // Categorize event
      const category = categorizeEvent(name, description, location);

      // Build full event URL
      const eventUrl = href.startsWith('http') ? href : `https://www.nycforfree.co${href}`;

      events.push({
        name: name.substring(0, 255),
        category,
        date: date.substring(0, 100),
        time: time.substring(0, 100),
        location: location.substring(0, 255),
        address: address.substring(0, 500),
        price: 'free',
        spots: Math.floor(Math.random() * 200) + 50, // Random capacity
        image: getEventImage(name, category),
        description: description.substring(0, 500),
        highlights: ['Free event', 'NYC location', 'Limited spots', 'RSVP recommended'],
        url: eventUrl.substring(0, 500)
      });
    });

    console.log(`Scraped ${events.length} events from nycforfree.co`);
    return events;
  } catch (error) {
    console.error('NYC For Free scraping failed:', error.message);
    return [];
  }
}

// Scrape exhibitions from The Met Museum (/exhibitions works, /events gets 429)
async function scrapeMetMuseum() {
  try {
    console.log('Fetching exhibitions from The Met Museum...');
    const response = await axios.get('https://www.metmuseum.org/exhibitions', {
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

    // Met uses CSS module classes: exhibition-card_exhibitionCard__*, exhibition-card_title__*, exhibition-card_meta__*
    $('article[class*="exhibition-card"]').each((i, elem) => {
      if (events.length >= 15) return false;

      const $elem = $(elem);

      // Title is in a div with class containing "exhibition-card_title" > a > span
      const $titleDiv = $elem.find('[class*="exhibition-card_title"]');
      const $titleLink = $titleDiv.find('a');
      const name = $titleLink.text().trim();
      if (!name || name.length < 5) return;

      const href = $titleLink.attr('href');
      if (!href || seenHrefs.has(href)) return;
      seenHrefs.add(href);

      // Date/meta is in div with class containing "exhibition-card_meta"
      let date = 'Now on view';
      const metaText = $elem.find('[class*="exhibition-card_meta"]').text().trim();
      if (metaText) date = metaText;

      // Image alt text can serve as description
      const imgAlt = $elem.find('img').attr('alt') || '';
      const description = imgAlt.length > 20 ? imgAlt.substring(0, 200) : `${name} at The Metropolitan Museum of Art.`;

      const location = 'The Met';
      const address = '1000 5th Ave, New York, NY 10028';
      const category = categorizeEvent(name, description, location);
      const eventUrl = href.startsWith('http') ? href : `https://www.metmuseum.org${href}`;

      events.push({
        name: name.substring(0, 255),
        category,
        date: date.substring(0, 100),
        time: 'Museum hours',
        location: location.substring(0, 255),
        address: address.substring(0, 500),
        price: 'free',
        spots: Math.floor(Math.random() * 150) + 50,
        image: getEventImage(name, category),
        description: description.substring(0, 500),
        highlights: ['The Met Museum', 'World-class art', 'Current exhibition', 'Free admission'],
        url: eventUrl.substring(0, 500)
      });
    });

    console.log(`Scraped ${events.length} exhibitions from The Met`);
    return events;
  } catch (error) {
    console.error('Met Museum scraping failed:', error.message);
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

      events.push({
        name: name.substring(0, 255),
        category,
        date: date.substring(0, 100),
        time: time.substring(0, 100),
        location: location.substring(0, 255),
        address: address.substring(0, 500),
        price: 'free',
        spots: Math.floor(Math.random() * 150) + 50,
        image: getEventImage(name, category),
        description: description.substring(0, 500),
        highlights: ['MoMA', 'Modern art', 'Contemporary culture', 'Free event'],
        url: eventUrl.substring(0, 500)
      });
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

      events.push({
        name: name.substring(0, 255),
        category,
        date: date.substring(0, 100),
        time: time.substring(0, 100),
        location: location.substring(0, 255),
        address: address.substring(0, 500),
        price: 'free',
        spots: Math.floor(Math.random() * 150) + 50,
        image: getEventImage(name, category),
        description: description.substring(0, 500),
        highlights: ['Natural History', 'Science talks', 'Family friendly', 'Free admission'],
        url: eventUrl.substring(0, 500)
      });
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

      events.push({
        name: name.substring(0, 255),
        category,
        date: date.substring(0, 100),
        time: time.substring(0, 100),
        location: location.substring(0, 255),
        address: address.substring(0, 500),
        price: 'free',
        spots: Math.floor(Math.random() * 150) + 50,
        image: getEventImage(name, category),
        description: description.substring(0, 500),
        highlights: ['Whitney Museum', 'American art', 'Contemporary exhibitions', 'Free event'],
        url: eventUrl.substring(0, 500)
      });
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

    // Fetch both events and exhibitions in parallel from the WP REST API
    const [eventsRes, exhibitionsRes] = await Promise.all([
      axios.get('https://www.guggenheim.org/wp-json/wp/v2/event', {
        params: { per_page: 10, orderby: 'date', order: 'desc' },
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
      }).catch(() => ({ data: [] })),
      axios.get('https://www.guggenheim.org/wp-json/wp/v2/exhibition', {
        params: { per_page: 10, orderby: 'date', order: 'desc' },
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
      }).catch(() => ({ data: [] }))
    ]);

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

      events.push({
        name: name.substring(0, 255),
        category,
        date: 'Upcoming',
        time: 'See details',
        location: location.substring(0, 255),
        address: address.substring(0, 500),
        price: 'free',
        spots: Math.floor(Math.random() * 150) + 50,
        image: getEventImage(name, category),
        description: (description || `${name} at the Guggenheim Museum.`).substring(0, 500),
        highlights: ['Guggenheim', 'Modern art', 'Iconic architecture', 'Free event'],
        url: eventUrl.substring(0, 500)
      });
    }

    // Process exhibitions
    for (const item of exhibitionsRes.data) {
      if (events.length >= 15) break;

      const name = (item.title?.rendered || '').replace(/<[^>]+>/g, '').trim();
      if (!name || name.length < 5) continue;

      const description = (item.excerpt?.rendered || '').replace(/<[^>]+>/g, '').trim();
      const eventUrl = item.link || `https://www.guggenheim.org/exhibition/${item.slug}`;
      const category = categorizeEvent(name, description, location);

      events.push({
        name: name.substring(0, 255),
        category,
        date: 'Now on view',
        time: 'Museum hours',
        location: location.substring(0, 255),
        address: address.substring(0, 500),
        price: 'free',
        spots: Math.floor(Math.random() * 150) + 50,
        image: getEventImage(name, category),
        description: (description || `${name} exhibition at the Guggenheim Museum.`).substring(0, 500),
        highlights: ['Guggenheim', 'Current exhibition', 'Iconic architecture', 'World-class art'],
        url: eventUrl.substring(0, 500)
      });
    }

    console.log(`Scraped ${events.length} events/exhibitions from Guggenheim`);
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

          events.push({
            name: name.substring(0, 255),
            category,
            date: startDate.substring(0, 100),
            time: 'See details',
            location: location.substring(0, 255),
            address: address.substring(0, 500),
            price: 'free',
            spots: Math.floor(Math.random() * 150) + 50,
            image: getEventImage(name, category),
            description: (description || `${name} at the New Museum.`).substring(0, 500),
            highlights: ['New Museum', 'Contemporary art', 'Cutting-edge exhibitions', 'Free admission'],
            url: eventUrl.substring(0, 500)
          });
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

        events.push({
          name: name.substring(0, 255),
          category,
          date: 'Upcoming',
          time: 'See details',
          location: location.substring(0, 255),
          address: address.substring(0, 500),
          price: 'free',
          spots: Math.floor(Math.random() * 150) + 50,
          image: getEventImage(name, category),
          description: description.substring(0, 500),
          highlights: ['New Museum', 'Contemporary art', 'Cutting-edge exhibitions', 'Free admission'],
          url: eventUrl.substring(0, 500)
        });
      });
    }

    console.log(`Scraped ${events.length} events from New Museum`);
    return events;
  } catch (error) {
    console.error('New Museum scraping failed:', error.message);
    return [];
  }
}

// Main orchestrator - scrapes all sources and merges results
async function scrapeAllEvents() {
  try {
    console.log('Starting multi-source scraping...');

    // Run all scrapers in parallel
    const [
      theSkintEvents,
      timeoutEvents,
      nycFreeEvents,
      whitneyEvents,
      metEvents,
      momaEvents,
      guggenheimEvents,
      amnhEvents,
      newMuseumEvents
    ] = await Promise.all([
      scrapeTheSkint(),
      scrapeTimeOut(),
      scrapeNYCForFree(),
      scrapeWhitney(),
      scrapeMetMuseum(),
      scrapeMoMA(),
      scrapeGuggenheim(),
      scrapeAMNH(),
      scrapeNewMuseum()
    ]);

    // Merge all events
    const allEvents = [
      ...theSkintEvents,
      ...timeoutEvents,
      ...nycFreeEvents,
      ...whitneyEvents,
      ...metEvents,
      ...momaEvents,
      ...guggenheimEvents,
      ...amnhEvents,
      ...newMuseumEvents
    ];

    console.log(`Total events scraped: ${allEvents.length}`);
    console.log(`  - The Skint: ${theSkintEvents.length}`);
    console.log(`  - TimeOut NY: ${timeoutEvents.length}`);
    console.log(`  - NYC For Free: ${nycFreeEvents.length}`);
    console.log(`  - Whitney Museum: ${whitneyEvents.length}`);
    console.log(`  - The Met: ${metEvents.length}`);
    console.log(`  - MoMA: ${momaEvents.length}`);
    console.log(`  - Guggenheim: ${guggenheimEvents.length}`);
    console.log(`  - AMNH: ${amnhEvents.length}`);
    console.log(`  - New Museum: ${newMuseumEvents.length}`);

    // If no events found at all, use fallback
    if (allEvents.length === 0) {
      console.log('No events found from any source, using fallback events');
      return getFallbackEvents();
    }

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
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add url column if it doesn't exist (for existing tables)
    await pool.query(`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS url VARCHAR(500)
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
          `INSERT INTO events (name, category, date, time, location, address, price, spots, image, description, highlights, url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (url) DO NOTHING`,
          [event.name, event.category, event.date, event.time, event.location,
           event.address, event.price, event.spots, event.image, event.description,
           JSON.stringify(event.highlights), event.url]
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
