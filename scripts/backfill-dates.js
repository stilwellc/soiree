#!/usr/bin/env node

/**
 * Backfill missing start_date values for events in the database
 * This script parses the 'date' field and updates start_date/end_date
 */

const { Pool } = require('pg');
const { parseDateText } = require('../api/lib/dateParser.js');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

async function backfillDates() {
    try {
        // Get all events missing start_date
        const result = await pool.query(`
      SELECT id, name, date, time, source
      FROM events
      WHERE start_date IS NULL
      ORDER BY source, name
    `);

        console.log(`Found ${result.rows.length} events missing start_date\n`);

        let updated = 0;
        let failed = 0;

        for (const event of result.rows) {
            try {
                let start_date = null;
                let end_date = null;

                // Try to parse the date
                const parsed = parseDateText(event.date, event.time);

                if (parsed && parsed.start_date) {
                    start_date = parsed.start_date;
                    end_date = parsed.end_date || parsed.start_date;
                } else if (event.date && event.date.toLowerCase() === 'upcoming') {
                    // For "Upcoming" events, set to 7 days from now
                    const futureDate = new Date();
                    futureDate.setDate(futureDate.getDate() + 7);
                    start_date = futureDate.toISOString().split('T')[0];
                    end_date = start_date;
                }

                if (start_date) {
                    await pool.query(
                        'UPDATE events SET start_date = $1, end_date = $2 WHERE id = $3',
                        [start_date, end_date, event.id]
                    );
                    updated++;
                    console.log(`✓ Updated: ${event.source} - ${event.name.substring(0, 50)}... → ${start_date}`);
                } else {
                    failed++;
                    console.log(`✗ Failed: ${event.source} - ${event.name.substring(0, 50)}... (date: "${event.date}")`);
                }
            } catch (err) {
                failed++;
                console.error(`✗ Error updating ${event.id}:`, err.message);
            }
        }

        console.log(`\n=== Summary ===`);
        console.log(`Updated: ${updated}`);
        console.log(`Failed: ${failed}`);
        console.log(`Total: ${result.rows.length}`);

    } catch (error) {
        console.error('Script failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

backfillDates();
