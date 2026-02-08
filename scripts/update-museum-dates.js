#!/usr/bin/env node

/**
 * Enhanced museum scraper that fetches actual event dates from detail pages
 * Run this to update museum events with real dates instead of "Upcoming"
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { Pool } = require('pg');
const { parseDateText } = require('../api/lib/dateParser.js');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

// Fetch event detail page and extract date
async function fetchEventDate(url, source) {
    try {
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        let dateText = null;

        if (source === 'MoMA') {
            // MoMA uses specific date selectors
            dateText = $('[class*="date"], .event-date, time, [datetime]').first().text().trim();

            // Also check for datetime attribute
            const datetime = $('time[datetime]').attr('datetime');
            if (datetime) {
                return { start_date: datetime.split('T')[0], end_date: datetime.split('T')[0] };
            }

            // Look for patterns like "February 8, 2026" or "Feb 8"
            const bodyText = $('body').text();
            const dateMatch = bodyText.match(/(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{1,2}(?:,?\\s+\\d{4})?/i);
            if (dateMatch) {
                dateText = dateMatch[0];
            }
        } else if (source === 'Guggenheim') {
            // Guggenheim date selectors
            dateText = $('.event-date, [class*="date"], time').first().text().trim();

            const datetime = $('time[datetime]').attr('datetime');
            if (datetime) {
                return { start_date: datetime.split('T')[0], end_date: datetime.split('T')[0] };
            }
        }

        if (dateText && dateText !== 'Upcoming') {
            const parsed = parseDateText(dateText, '');
            if (parsed && parsed.start_date) {
                return parsed;
            }
        }

        return null;
    } catch (error) {
        console.error(`  Error fetching ${url}:`, error.message);
        return null;
    }
}

async function updateMuseumDates() {
    try {
        // Get museum events with "Upcoming" dates or NULL dates
        const result = await pool.query(`
      SELECT id, name, url, source, date
      FROM events
      WHERE source IN ('MoMA', 'Guggenheim', 'New Museum', 'Whitney Museum')
        AND (date = 'Upcoming' OR start_date IS NULL OR start_date > '2026-02-14')
      ORDER BY source, name
    `);

        console.log(`Found ${result.rows.length} museum events to update\n`);

        let updated = 0;
        let failed = 0;

        for (const event of result.rows) {
            console.log(`Checking: ${event.source} - ${event.name.substring(0, 50)}...`);

            if (!event.url) {
                console.log(`  ✗ No URL available\n`);
                failed++;
                continue;
            }

            const dates = await fetchEventDate(event.url, event.source);

            if (dates && dates.start_date) {
                await pool.query(
                    'UPDATE events SET start_date = $1, end_date = $2 WHERE id = $3',
                    [dates.start_date, dates.end_date, event.id]
                );
                updated++;
                console.log(`  ✓ Updated to ${dates.start_date}\n`);
            } else {
                failed++;
                console.log(`  ✗ Could not extract date\n`);
            }

            // Rate limiting - wait 500ms between requests
            await new Promise(resolve => setTimeout(resolve, 500));
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

updateMuseumDates();
