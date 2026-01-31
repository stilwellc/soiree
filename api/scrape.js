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

// Generate production-quality gradient images for events
function getEventImage(title, category) {
  const titleLower = title.toLowerCase();

  // Premium color palettes inspired by Notion, Apple, and Airbnb
  const visualThemes = {
    // Food & Drink - warm, appetizing gradients
    'chicken': { colors: ['#FF8C42', '#FFD166', '#F4A261', '#FF6B35'] },
    'pizza': { colors: ['#E63946', '#F77F00', '#FCBF49', '#FF4500'] },
    'sushi': { colors: ['#06FFA5', '#FF6B9D', '#C9F0FF', '#00D9FF'] },
    'ramen': { colors: ['#FFB627', '#FF6B35', '#F7931E', '#FFA07A'] },
    'coffee': { colors: ['#6F4E37', '#A67B5B', '#C8AD7F', '#8B4513'] },
    'wine': { colors: ['#722F37', '#C73E1D', '#B91372', '#8B0000'] },
    'beer': { colors: ['#F2A900', '#E67E22', '#D4AC0D', '#FFB627'] },
    'cocktail': { colors: ['#E91E63', '#00BCD4', '#FFD700', '#FF1493'] },
    'bakery': { colors: ['#FFDAB9', '#FFB6C1', '#FFF4E6', '#FFE4E1'] },
    'market': { colors: ['#FF6347', '#32CD32', '#FFD700', '#FF8C00'] },
    'taco': { colors: ['#FF6B35', '#F7B801', '#6A994E', '#FFD166'] },
    'sandwich': { colors: ['#DDA15E', '#BC6C25', '#FEFAE0', '#C9ADA7'] },
    'brunch': { colors: ['#FFE5B4', '#FFDAB9', '#FFB347', '#FFA07A'] },
    'breakfast': { colors: ['#FFE4B5', '#FFDAB9', '#FFB347', '#F4A460'] },

    // Wellness & Fitness - calm, energizing gradients
    'yoga': { colors: ['#9B59B6', '#E8DAEF', '#D7BDE2', '#C39BD3'] },
    'wellness': { colors: ['#81C784', '#A5D6A7', '#C8E6C9', '#66BB6A'] },
    'fitness': { colors: ['#FF5722', '#FF7043', '#FF8A65', '#E64A19'] },
    'meditation': { colors: ['#6A5ACD', '#B0C4DE', '#E6E6FA', '#9370DB'] },

    // Art & Culture - creative, vibrant gradients
    'gallery': { colors: ['#E91E63', '#9C27B0', '#673AB7', '#D81B60'] },
    'museum': { colors: ['#5E35B1', '#7E57C2', '#B39DDB', '#9575CD'] },
    'exhibit': { colors: ['#FF6F00', '#FF8F00', '#FFA000', '#F57C00'] },
    'street art': { colors: ['#FF1744', '#00E5FF', '#FFEA00', '#FF6E40'] },
    'photography': { colors: ['#37474F', '#607D8B', '#90A4AE', '#546E7A'] },
    'painting': { colors: ['#FF4081', '#7C4DFF', '#18FFFF', '#E040FB'] },
    'crayola': { colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'] },

    // Music & Performance - energetic, rhythmic gradients
    'jazz': { colors: ['#1A237E', '#3F51B5', '#5C6BC0', '#283593'] },
    'concert': { colors: ['#C2185B', '#E91E63', '#F06292', '#AD1457'] },
    'music': { colors: ['#6A1B9A', '#8E24AA', '#AB47BC', '#7B1FA2'] },
    'dj': { colors: ['#00BCD4', '#00ACC1', '#0097A7', '#00838F'] },
    'dance': { colors: ['#D32F2F', '#F44336', '#E57373', '#C62828'] },

    // Fashion & Shopping - stylish, modern gradients
    'fashion': { colors: ['#212121', '#757575', '#BDBDBD', '#424242'] },
    'warby parker': { colors: ['#4A90E2', '#7B68EE', '#00CED1', '#5F9EA0'] },
    'eyeglasses': { colors: ['#4A90E2', '#7B68EE', '#00CED1', '#4682B4'] },
    'clothing': { colors: ['#FF6B9D', '#C44569', '#F8B500', '#FF1493'] },
    'shopping': { colors: ['#FF6B9D', '#9B59B6', '#3498DB', '#E74C3C'] },

    // Brands & Events
    'daily harvest': { colors: ['#27AE60', '#52BE80', '#7DCEA0', '#2ECC71'] },
    'corepower': { colors: ['#9B59B6', '#BB8FCE', '#D7BDE2', '#8E44AD'] },
    'rockefeller': { colors: ['#1565C0', '#1976D2', '#1E88E5', '#0D47A1'] },
    'paris hilton': { colors: ['#FF69B4', '#FFB6C1', '#FFC0CB', '#FF1493'] },
    'celebrity': { colors: ['#FFD700', '#FFA500', '#FF8C00', '#DAA520'] }
  };

  // Find matching theme
  let theme = null;
  for (const [keyword, themeData] of Object.entries(visualThemes)) {
    if (titleLower.includes(keyword)) {
      theme = themeData;
      break;
    }
  }

  // Default category themes if no specific match
  if (!theme) {
    const categoryThemes = {
      'art': { colors: ['#E91E63', '#9C27B0', '#673AB7', '#D81B60'] },
      'music': { colors: ['#6A1B9A', '#8E24AA', '#AB47BC', '#7B1FA2'] },
      'culinary': { colors: ['#FF6347', '#FF8C42', '#FFD166', '#F4A261'] },
      'social': { colors: ['#42A5F5', '#66BB6A', '#FFA726', '#5C6BC0'] }
    };
    theme = categoryThemes[category] || categoryThemes.social;
  }

  // Use a simple hash of the title to create variation in gradient positions
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i);
    hash = hash & hash;
  }
  const seed = Math.abs(hash % 100);

  // Create sophisticated mesh gradient SVG (Notion/Apple/Airbnb style)
  const c = theme.colors;

  // Calculate gradient positions based on seed for variation
  const cx1 = 20 + (seed % 30);
  const cy1 = 20 + ((seed * 2) % 30);
  const cx2 = 50 + (seed % 25);
  const cy2 = 50 + ((seed * 3) % 25);
  const cx3 = 70 + (seed % 20);
  const cy3 = 70 + ((seed * 4) % 20);

  // Premium mesh gradient SVG with blur and opacity for depth
  const svg = `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="g1" cx="${cx1}%" cy="${cy1}%">
        <stop offset="0%" style="stop-color:${c[0]};stop-opacity:0.9" />
        <stop offset="100%" style="stop-color:${c[1]};stop-opacity:0.6" />
      </radialGradient>
      <radialGradient id="g2" cx="${cx2}%" cy="${cy2}%">
        <stop offset="0%" style="stop-color:${c[1]};stop-opacity:0.8" />
        <stop offset="100%" style="stop-color:${c[2] || c[0]};stop-opacity:0.5" />
      </radialGradient>
      <radialGradient id="g3" cx="${cx3}%" cy="${cy3}%">
        <stop offset="0%" style="stop-color:${c[2] || c[0]};stop-opacity:0.7" />
        <stop offset="100%" style="stop-color:${c[3] || c[1]};stop-opacity:0.4" />
      </radialGradient>
      <filter id="blur">
        <feGaussianBlur stdDeviation="60" />
      </filter>
    </defs>
    <rect width="1200" height="800" fill="${c[0]}" />
    <rect width="1200" height="800" fill="url(#g1)" filter="url(#blur)" opacity="0.9" />
    <rect width="1200" height="800" fill="url(#g2)" filter="url(#blur)" opacity="0.8" />
    <rect width="1200" height="800" fill="url(#g3)" filter="url(#blur)" opacity="0.7" />
  </svg>`;

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
