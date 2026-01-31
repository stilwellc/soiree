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

  // Music & Entertainment - check first for performance-related
  if (text.match(/music|concert|jazz|dj|band|singer|performance|show|festival|stage|live music|soundtrack|album|vinyl/)) {
    return 'music';
  }

  // Food & Culinary
  if (text.match(/food|culinary|market|tasting|restaurant|cook|dining|kitchen|chef|menu|wine|bar|coffee|cafe|bakery|brunch|dinner|lunch|breakfast|cocktail|beer|eat|flavor|recipe|gourmet|pizza|burger|chicken|sushi|ramen|bbq|brewery|pub|tavern|bistro|eatery|slice|taco|sandwich/)) {
    return 'culinary';
  }

  // Art & Culture
  if (text.match(/art|gallery|exhibit|museum|paint|sculpture|street art|artist|creative|design|photo|mural|craft|pottery|drawing|illustration|installation|visual/)) {
    return 'art';
  }

  // Social & Community (wellness, fitness, shopping, workshops)
  return 'social';
}

// Generate images with app color palette but category-specific patterns
function getEventImage(title, category) {
  // Consistent color palette: brown, cream, white, wine/gold tones
  const cream = '#FAF8F3';
  const gold = '#D4AF37';
  const brown = '#8B7355';
  const darkBrown = '#6B5642';
  const wine = '#722F37';
  const lightCream = '#FFFAF5';

  // Create different patterns for each category
  let svg;

  if (category === 'music') {
    // Music: Sound waves and rhythmic patterns
    svg = `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${cream}" />
          <stop offset="100%" style="stop-color:${lightCream}" />
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#bg)" />
      <path d="M 0,400 Q 150,300 300,400 T 600,400 T 900,400 T 1200,400" stroke="${gold}" stroke-width="3" fill="none" opacity="0.6"/>
      <path d="M 0,450 Q 150,350 300,450 T 600,450 T 900,450 T 1200,450" stroke="${brown}" stroke-width="2" fill="none" opacity="0.4"/>
      <circle cx="300" cy="400" r="8" fill="${gold}" opacity="0.7"/>
      <circle cx="600" cy="400" r="8" fill="${brown}" opacity="0.7"/>
      <circle cx="900" cy="400" r="8" fill="${wine}" opacity="0.6"/>
    </svg>`;
  } else if (category === 'culinary') {
    // Food: Organic circular shapes, plates, flowing forms
    svg = `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bg">
          <stop offset="0%" style="stop-color:${lightCream}" />
          <stop offset="100%" style="stop-color:${cream}" />
        </radialGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#bg)" />
      <circle cx="600" cy="400" r="200" fill="none" stroke="${gold}" stroke-width="2" opacity="0.4"/>
      <circle cx="600" cy="400" r="150" fill="none" stroke="${brown}" stroke-width="2" opacity="0.3"/>
      <circle cx="450" cy="300" r="60" fill="${gold}" opacity="0.2"/>
      <circle cx="750" cy="500" r="80" fill="${brown}" opacity="0.15"/>
      <circle cx="700" cy="280" r="50" fill="${wine}" opacity="0.2"/>
      <path d="M 400,400 Q 500,300 600,400 T 800,400" stroke="${darkBrown}" stroke-width="2" fill="none" opacity="0.3"/>
    </svg>`;
  } else if (category === 'art') {
    // Art: Abstract geometric shapes, creative composition
    svg = `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${cream}" />
          <stop offset="100%" style="stop-color:${lightCream}" />
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#bg)" />
      <rect x="200" y="200" width="250" height="250" fill="${gold}" opacity="0.2" transform="rotate(15 325 325)"/>
      <rect x="600" y="300" width="200" height="200" fill="${brown}" opacity="0.25" transform="rotate(-10 700 400)"/>
      <circle cx="400" cy="550" r="100" fill="${wine}" opacity="0.2"/>
      <polygon points="850,250 950,350 800,400" fill="${darkBrown}" opacity="0.2"/>
      <line x1="300" y1="150" x2="500" y2="200" stroke="${gold}" stroke-width="3" opacity="0.5"/>
    </svg>`;
  } else {
    // Social: Connected circles, community, flowing connections
    svg = `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bg" cx="50%" cy="50%">
          <stop offset="0%" style="stop-color:${lightCream}" />
          <stop offset="100%" style="stop-color:${cream}" />
        </radialGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#bg)" />
      <circle cx="400" cy="400" r="80" fill="${gold}" opacity="0.25"/>
      <circle cx="600" cy="300" r="90" fill="${brown}" opacity="0.2"/>
      <circle cx="700" cy="500" r="70" fill="${wine}" opacity="0.25"/>
      <circle cx="500" cy="550" r="60" fill="${darkBrown}" opacity="0.2"/>
      <line x1="400" y1="400" x2="600" y2="300" stroke="${gold}" stroke-width="2" opacity="0.3"/>
      <line x1="600" y1="300" x2="700" y2="500" stroke="${brown}" stroke-width="2" opacity="0.3"/>
      <line x1="400" y1="400" x2="500" y2="550" stroke="${wine}" stroke-width="2" opacity="0.3"/>
    </svg>`;
  }

  // Encode SVG as data URL
  const encoded = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${encoded}`;
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

    // Clear old events
    await pool.query(`DELETE FROM events WHERE scraped_at < NOW() - INTERVAL '7 days'`);

    // Get events
    const events = await scrapeEvents();

    // Insert events
    let inserted = 0;
    for (const event of events) {
      await pool.query(
        `INSERT INTO events (name, category, date, time, location, address, price, spots, image, description, highlights, url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [event.name, event.category, event.date, event.time, event.location,
         event.address, event.price, event.spots, event.image, event.description,
         JSON.stringify(event.highlights), event.url]
      );
      inserted++;
    }

    const result = await pool.query('SELECT COUNT(*) as count FROM events');

    return res.status(200).json({
      success: true,
      message: 'Scraping completed',
      scraped: events.length,
      inserted: inserted,
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
