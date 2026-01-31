import { scrapeAllEvents } from './lib/scraper.js';
import { insertEvent, clearOldEvents, initDB, getEventCount } from './lib/db.js';

export const config = {
  maxDuration: 60, // 60 seconds max for scraping
};

export default async function handler(request) {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  // Handle OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  // Verify authorization (simple secret token)
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.SCRAPE_SECRET || 'soiree-scrape-secret-2024';

  if (request.method === 'POST' && authHeader !== `Bearer ${expectedToken}`) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers }
    );
  }

  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers }
    );
  }

  try {
    console.log('Starting scrape job...');

    // Initialize database
    await initDB();

    // Clear old events (>7 days)
    await clearOldEvents();

    // Scrape new events
    const scrapedEvents = await scrapeAllEvents();
    console.log(`Scraped ${scrapedEvents.length} events`);

    // Insert new events
    const inserted = [];
    const errors = [];

    for (const event of scrapedEvents) {
      try {
        const result = await insertEvent(event);
        inserted.push(result);
      } catch (err) {
        console.error(`Error inserting event "${event.name}":`, err);
        errors.push({ event: event.name, error: err.message });
      }
    }

    const totalEvents = await getEventCount();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Scraping completed',
        scraped: scrapedEvents.length,
        inserted: inserted.length,
        errors: errors.length,
        totalEvents: totalEvents,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Scrape Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers }
    );
  }
}
