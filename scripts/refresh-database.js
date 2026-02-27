/**
 * Refresh Database Script
 * Clears all events and triggers a fresh scrape
 */

import { sql } from '@vercel/postgres';

async function refreshDatabase() {
  try {
    console.log('🗑️  Clearing all events from database...');

    // Clear all events
    await sql`DELETE FROM events`;
    console.log('✅ Database cleared successfully');

    // Get count to verify
    const { rows } = await sql`SELECT COUNT(*) as count FROM events`;
    console.log(`📊 Current event count: ${rows[0].count}`);

    console.log('\n🌐 Database is ready for fresh scraping');
    console.log('📝 Run the scraper by visiting: http://localhost:3000/api/scrape');
    console.log('   or deploy and visit: https://your-domain.vercel.app/api/scrape');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error refreshing database:', error);
    process.exit(1);
  }
}

refreshDatabase();
