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
      highlights: ["Guided tour", "Instagram spots", "Meet artists", "2-hour experience"]
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
      highlights: ["Live quartet", "Outdoor setting", "Bring picnic", "Family friendly"]
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
      highlights: ["50+ vendors", "Cooking demos", "Free samples", "Waterfront"]
    }
  ];
}

// Category mapping based on keywords
function categorizeEvent(title, description) {
  const text = (title + ' ' + description).toLowerCase();

  if (text.match(/music|concert|jazz|dj|band|singer|performance|show/)) return 'music';
  if (text.match(/food|culinary|market|tasting|restaurant|cook|dining/)) return 'culinary';
  if (text.match(/art|gallery|exhibit|museum|paint|sculpture|street art/)) return 'art';

  return 'social'; // default category
}

// Generate contextual image URL based on event title
function getEventImage(title, category) {
  // Use event title as seed for consistent but unique images
  const seed = encodeURIComponent(title.toLowerCase().replace(/\s+/g, '-'));

  // Category-specific color palettes for geometric patterns
  const colorSchemes = {
    art: 'b6e3f4,c0fdff,e0c3fc,f694c1', // Purple-pink-blue
    music: 'ff6b6b,4ecdc4,45b7d1,fdcb6e', // Vibrant multi-color
    culinary: 'ffeaa7,fab1a0,ff7675,fd79a8', // Warm oranges-pinks
    social: '74b9ff,a29bfe,fd79a8,6c5ce7'  // Cool blues-purples
  };

  const colors = colorSchemes[category] || colorSchemes.social;

  // Use DiceBear's shapes API for minimal, colorful, geometric patterns
  // This generates unique SVG patterns based on the seed (event title)
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${seed}&backgroundColor=${colors.split(',')[0]}&size=800`;
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
        highlights: ['Free event', 'NYC location', 'Limited spots', 'RSVP recommended']
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
        scraped_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Clear old events
    await pool.query(`DELETE FROM events WHERE scraped_at < NOW() - INTERVAL '7 days'`);

    // Get events
    const events = await scrapeEvents();

    // Insert events
    let inserted = 0;
    for (const event of events) {
      await pool.query(
        `INSERT INTO events (name, category, date, time, location, address, price, spots, image, description, highlights)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [event.name, event.category, event.date, event.time, event.location,
         event.address, event.price, event.spots, event.image, event.description,
         JSON.stringify(event.highlights)]
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
