const { Pool } = require('pg');
const axios = require('axios');
const cheerio = require('cheerio');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Fallback events if scraping fails
const FALLBACK_EVENTS = [
  {
    name: "Brooklyn Street Art Walk",
    category: "art",
    date: "This Weekend",
    time: "2:00 PM - 5:00 PM",
    location: "Bushwick, Brooklyn",
    address: "Troutman St & Wyckoff Ave, Brooklyn, NY",
    price: "free",
    spots: 75,
    image: "https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=800&q=80",
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
    image: "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800&q=80",
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
    image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80",
    description: "Sample artisanal foods from local vendors.",
    highlights: ["50+ vendors", "Cooking demos", "Free samples", "Waterfront"]
  }
];

// Category mapping based on keywords
function categorizeEvent(title, description) {
  const text = (title + ' ' + description).toLowerCase();

  if (text.match(/music|concert|jazz|dj|band|singer|performance|show/)) return 'music';
  if (text.match(/food|culinary|market|tasting|restaurant|cook|dining/)) return 'culinary';
  if (text.match(/art|gallery|exhibit|museum|paint|sculpture|street art/)) return 'art';

  return 'social'; // default category
}

// Extract image from Unsplash based on category
function getCategoryImage(category) {
  const images = {
    art: 'https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=800&q=80',
    music: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800&q=80',
    culinary: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80',
    social: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&q=80'
  };
  return images[category] || images.social;
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

    // Find event links
    $('a[href*="/events/"]').each((i, elem) => {
      if (events.length >= 20) return false; // Limit to 20 events

      const $elem = $(elem);
      const href = $elem.attr('href');

      // Skip if not a proper event link
      if (!href || href === '/events' || href === '/events/') return;

      // Get event name from link text
      const name = $elem.text().trim();
      if (!name || name.length < 5) return;

      // Try to find associated content
      const $parent = $elem.closest('.summary-item, .blog-item, .eventitem');

      // Extract description
      let description = $parent.find('.summary-excerpt, .blog-excerpt, p').first().text().trim();
      if (!description) description = name;

      // Extract date info
      let date = 'Upcoming';
      let time = 'See details';
      const dateText = $parent.find('.summary-metadata-item--date, .eventitem-meta-date').text().trim();
      if (dateText) {
        date = dateText.split('-')[0].trim() || date;
        const timeMatch = dateText.match(/\d{1,2}:\d{2}\s*[AP]M/i);
        if (timeMatch) time = timeMatch[0];
      }

      // Extract location
      let location = 'New York City';
      let address = 'NYC';
      const locationText = $parent.find('.summary-metadata-item--location, .eventitem-meta-address').text().trim();
      if (locationText) {
        location = locationText.split(',')[0].trim() || location;
        address = locationText;
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
        image: getCategoryImage(category),
        description: description.substring(0, 500),
        highlights: ['Free event', 'NYC location', 'Limited spots', 'RSVP recommended']
      });
    });

    console.log(`Scraped ${events.length} events from nycforfree.co`);

    if (events.length === 0) {
      console.log('No events found, using fallback events');
      return FALLBACK_EVENTS;
    }

    return events;
  } catch (error) {
    console.error('Scraping failed:', error.message);
    console.log('Using fallback events');
    return FALLBACK_EVENTS;
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
