import { sql } from '@vercel/postgres';

export async function initDB() {
  try {
    // Create events table
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
        start_date DATE,
        end_date DATE,
        scraped_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_events_category ON events(category)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_events_date ON events(date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date)`;

    console.log('Database initialized successfully');
    return { success: true };
  } catch (error) {
    console.error('Database initialization error:', error);
    return { success: false, error: error.message };
  }
}

export async function getAllEvents() {
  try {
    const { rows } = await sql`
      SELECT * FROM events
      ORDER BY created_at DESC
    `;
    return rows;
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
}

export async function getEventsByCategory(category) {
  try {
    const { rows } = await sql`
      SELECT * FROM events
      WHERE category = ${category}
      ORDER BY created_at DESC
    `;
    return rows;
  } catch (error) {
    console.error('Error fetching events by category:', error);
    return [];
  }
}

export async function insertEvent(event) {
  try {
    const { rows } = await sql`
      INSERT INTO events (
        name, category, date, time, location, address,
        price, spots, image, description, highlights, source_url,
        start_date, end_date
      )
      VALUES (
        ${event.name}, ${event.category}, ${event.date}, ${event.time},
        ${event.location}, ${event.address || null}, ${event.price || 'free'},
        ${event.spots || 0}, ${event.image || null}, ${event.description || null},
        ${JSON.stringify(event.highlights || [])}, ${event.source_url || null},
        ${event.start_date || null}, ${event.end_date || event.start_date || null}
      )
      RETURNING *
    `;
    return rows[0];
  } catch (error) {
    console.error('Error inserting event:', error);
    throw error;
  }
}

export async function clearOldEvents() {
  try {
    // Clear events older than 7 days
    await sql`
      DELETE FROM events
      WHERE scraped_at < NOW() - INTERVAL '7 days'
    `;
    console.log('Old events cleared');
  } catch (error) {
    console.error('Error clearing old events:', error);
  }
}

export async function clearAllEvents() {
  try {
    await sql`DELETE FROM events`;
    console.log('All events cleared');
    return { success: true };
  } catch (error) {
    console.error('Error clearing all events:', error);
    return { success: false, error: error.message };
  }
}

export async function getEventCount() {
  try {
    const { rows } = await sql`SELECT COUNT(*) as count FROM events`;
    return parseInt(rows[0].count);
  } catch (error) {
    console.error('Error getting event count:', error);
    return 0;
  }
}
