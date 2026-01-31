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

// Generate contextual image URL based on event title
function getEventImage(title, category) {
  const titleLower = title.toLowerCase();

  // Curated Unsplash photo URLs that are guaranteed to work
  const curatedImages = {
    // Food & Drink
    'chicken': 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&q=80', // Fried chicken
    'pizza': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80', // Pizza
    'sushi': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80', // Sushi
    'ramen': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&q=80', // Ramen
    'coffee': 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80', // Coffee shop
    'wine': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80', // Wine glasses
    'beer': 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=800&q=80', // Craft beer
    'cocktail': 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&q=80', // Cocktails
    'bakery': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80', // Bakery
    'market': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80', // Food market

    // Wellness & Fitness
    'yoga': 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80', // Yoga
    'wellness': 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80', // Wellness
    'fitness': 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80', // Fitness
    'meditation': 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80', // Meditation

    // Art & Culture
    'gallery': 'https://images.unsplash.com/photo-1531243269054-5ebf6f34081e?w=800&q=80', // Art gallery
    'museum': 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=800&q=80', // Museum
    'exhibit': 'https://images.unsplash.com/photo-1577083552431-6e5fd01c54ca?w=800&q=80', // Exhibition
    'photography': 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=800&q=80', // Photography
    'painting': 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&q=80', // Painting
    'street art': 'https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=800&q=80', // Street art

    // Music & Performance
    'jazz': 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800&q=80', // Jazz
    'concert': 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80', // Concert
    'music': 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&q=80', // Live music
    'dj': 'https://images.unsplash.com/photo-1571266028243-d220c8f11e59?w=800&q=80', // DJ
    'dance': 'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=800&q=80', // Dancing

    // Fashion & Shopping
    'fashion': 'https://images.unsplash.com/photo-1558769132-cb1aea592f0b?w=800&q=80', // Fashion
    'eyeglasses': 'https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=800&q=80', // Eyeglasses
    'warby parker': 'https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=800&q=80', // Eyeglasses
    'clothing': 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80', // Clothing store

    // Brands & specific events
    'crayola': 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=800&q=80', // Art supplies
    'daily harvest': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800&q=80', // Smoothie bowl
    'corepower': 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80', // Yoga studio
    'rockefeller': 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&q=80', // NYC landmark
    'celebrity': 'https://images.unsplash.com/photo-1485628390555-1a7bd503f9fe?w=800&q=80', // Glamour
    'paris hilton': 'https://images.unsplash.com/photo-1485628390555-1a7bd503f9fe?w=800&q=80' // Glamour
  };

  // Find matching curated image
  for (const [keyword, imageUrl] of Object.entries(curatedImages)) {
    if (titleLower.includes(keyword)) {
      return imageUrl;
    }
  }

  // Default category-based images
  const categoryImages = {
    'art': 'https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=800&q=80',
    'music': 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&q=80',
    'culinary': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80',
    'social': 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&q=80'
  };

  return categoryImages[category] || categoryImages.social;
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
