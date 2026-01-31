import { getAllEvents, getEventsByCategory, initDB } from './lib/db.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers }
    );
  }

  try {
    // Initialize database if needed
    await initDB();

    // Parse query parameters
    const url = new URL(request.url);
    const category = url.searchParams.get('category');

    // Fetch events
    let events;
    if (category && category !== 'all') {
      events = await getEventsByCategory(category);
    } else {
      events = await getAllEvents();
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: events.length,
        events: events
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        events: []
      }),
      { status: 500, headers }
    );
  }
}
