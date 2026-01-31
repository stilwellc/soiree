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

// Category mapping based on keywords
function categorizeEvent(title, description) {
  const text = (title + ' ' + description).toLowerCase();

  // Fashion - check first for fashion-specific events
  if (text.match(/fashion|runway|designer|couture|style|clothing|apparel|boutique|wardrobe|outfit|lookbook|vogue|trend|model|catwalk|textile/)) {
    return 'fashion';
  }

  // Music & Entertainment - includes dance
  if (text.match(/music|concert|jazz|dj|band|singer|performance|show|festival|stage|live music|soundtrack|album|vinyl|orchestra|choir|acoustic|symphony|karaoke|rap|hip hop|rock|indie|electronic|classical|dance|dancing|ballet|choreograph/)) {
    return 'music';
  }

  // Food & Culinary - exclude Crayola and non-food brands
  if (text.match(/food|culinary|market|tasting|restaurant|cook|dining|kitchen|chef|menu|wine|bar|coffee|cafe|bakery|brunch|dinner|lunch|breakfast|cocktail|beer|eat|flavor|recipe|gourmet|pizza|burger|chicken|sushi|ramen|bbq|brewery|pub|tavern|bistro|eatery|slice|taco|sandwich|foodie|cuisine|pastry|dessert|appetizer/) && !text.match(/crayola/)) {
    return 'culinary';
  }

  // Art & Culture - includes museums, creative activities, visual media
  if (text.match(/art|gallery|exhibit|museum|paint|sculpture|street art|artist|creative|design|photo|mural|craft|pottery|drawing|illustration|installation|visual|theater|theatre|cinema|film|movie|photography|graffiti|contemporary|abstract|crayola|coloring|memoir|screening/)) {
    return 'art';
  }

  // Social & Community - wellness, fitness, networking, workshops, brand experiences, pop-ups
  if (text.match(/yoga|fitness|workout|meditation|wellness|health|community|networking|workshop|seminar|talk|lecture|meetup|class|training|discussion|panel|debate|book club|reading|literary|pop-up|popup|experience|grand opening|opening|scavenger|arcade|simulator/)) {
    return 'social';
  }

  // Default to social for general events and brand activations
  return 'social';
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

// Scrape events from nycforfree.co
async function scrapeEvents() {
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
      if (events.length >= 20) return false; // Limit to 20 events

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
      const category = categorizeEvent(name, description);

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

    if (events.length === 0) {
      console.log('No events found, using fallback events');
      return getFallbackEvents();
    }

    return events;
  } catch (error) {
    console.error('Scraping failed:', error.message);
    console.log('Using fallback events');
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

    // Clear old events (older than 7 days)
    await pool.query(`DELETE FROM events WHERE scraped_at < NOW() - INTERVAL '7 days'`);

    // Get events
    const events = await scrapeEvents();

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
