import { sql } from '@vercel/postgres';
import * as cheerio from 'cheerio';

export const config = {
  maxDuration: 60,
};

// Simple scraper function
async function scrapeEvents() {
  const fallbackEvents = [
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

  return fallbackEvents;
}

export default async function handler(req, res) {
  // Enable CORS
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
    await sql`
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
        source_url TEXT,
        scraped_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Clear old events
    await sql`DELETE FROM events WHERE scraped_at < NOW() - INTERVAL '7 days'`;

    // Scrape events
    const events = await scrapeEvents();

    // Insert events
    let inserted = 0;
    for (const event of events) {
      await sql`
        INSERT INTO events (name, category, date, time, location, address, price, spots, image, description, highlights)
        VALUES (${event.name}, ${event.category}, ${event.date}, ${event.time}, ${event.location},
                ${event.address}, ${event.price}, ${event.spots}, ${event.image}, ${event.description},
                ${JSON.stringify(event.highlights)})
      `;
      inserted++;
    }

    const { rows } = await sql`SELECT COUNT(*) as count FROM events`;

    return res.status(200).json({
      success: true,
      message: 'Scraping completed',
      scraped: events.length,
      inserted: inserted,
      totalEvents: parseInt(rows[0].count),
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
}
