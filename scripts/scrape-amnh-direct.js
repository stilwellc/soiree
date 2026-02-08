#!/usr/bin/env node
/**
 * Direct AMNH Scraper for GitHub Actions
 * 
 * Scrapes American Museum of Natural History events with proper date parsing
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const puppeteer = require('puppeteer');
const { parseDateText } = require('../api/lib/dateParser.js');

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

function categorizeEvent(title, description) {
    const text = (title + ' ' + (description || '')).toLowerCase();

    if (text.includes('exhibition') || text.includes('gallery')) return 'art';
    if (text.includes('lecture') || text.includes('talk') || text.includes('debate')) return 'community';
    if (text.includes('planetarium') || text.includes('space show')) return 'art';
    if (text.includes('member') || text.includes('family')) return 'community';

    return 'art';
}

async function scrapeAMNH() {
    console.log('🏛️  Starting AMNH Scraper...\n');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

        console.log('Loading AMNH calendar...');
        await page.goto('https://www.amnh.org/calendar', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Scroll to load more events
        await page.evaluate(() => {
            window.scrollBy(0, 2000);
        });
        await new Promise(r => setTimeout(r, 2000));

        console.log('Extracting events...');

        const events = await page.evaluate(() => {
            const results = [];
            const eventCards = document.querySelectorAll('a.amnh-calendar-new-event');

            eventCards.forEach((card) => {
                try {
                    const h3 = card.querySelector('h3');
                    if (!h3) return;

                    const title = h3.textContent.trim();
                    const link = card.href;

                    // Get all p tags after h3
                    const pTags = Array.from(card.querySelectorAll('p'));

                    let description = '';
                    let dateTimeText = '';

                    // First p is usually description, second is date/time
                    if (pTags.length >= 1) {
                        description = pTags[0].textContent.trim();
                    }
                    if (pTags.length >= 2) {
                        dateTimeText = pTags[1].textContent.trim();
                    }

                    // Get image from background-image style
                    const imageSpan = card.querySelector('span');
                    let image = '';
                    if (imageSpan) {
                        const bgImage = window.getComputedStyle(imageSpan).backgroundImage;
                        const match = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
                        if (match) {
                            image = match[1];
                        }
                    }

                    // Get category label
                    const categorySpan = card.querySelector('span[class*="category"]');
                    const category = categorySpan ? categorySpan.textContent.trim() : '';

                    results.push({
                        title,
                        link,
                        description,
                        dateTimeText,
                        image,
                        categoryLabel: category
                    });
                } catch (e) {
                    console.error('Error parsing event:', e.message);
                }
            });

            return results;
        });

        console.log(`Found ${events.length} events from AMNH\n`);

        // Process events
        const processedEvents = events.map(event => {
            // Parse date/time text
            // Format: "Tuesday, March 17, 2026\n7 pm" or "Thursday, February 19, 2026\n7-10 pm"
            let dateStr = '';
            let timeStr = '';

            if (event.dateTimeText) {
                const parts = event.dateTimeText.split('\n');
                if (parts.length >= 1) {
                    dateStr = parts[0].trim();
                }
                if (parts.length >= 2) {
                    timeStr = parts[1].trim();
                }
            }

            const { start_date, end_date } = parseDateText(dateStr, timeStr);
            const category = categorizeEvent(event.title, event.description);

            return {
                name: event.title,
                category,
                date: dateStr || 'See details',
                time: timeStr || 'See details',
                start_date,
                end_date,
                location: 'American Museum of Natural History',
                address: 'Central Park West at 79th Street, New York, NY',
                price: 'See details',
                spots: Math.floor(Math.random() * 100) + 50,
                image: event.image || 'https://source.unsplash.com/featured/?museum,science',
                description: event.description.substring(0, 500) || event.title,
                highlights: ['AMNH', category.charAt(0).toUpperCase() + category.slice(1), event.categoryLabel].filter(Boolean),
                url: event.link,
                source: 'American Museum of Natural History'
            };
        });

        await browser.close();

        // Filter out events without dates
        const validEvents = processedEvents.filter(e => e.start_date && e.end_date);
        console.log(`✅ ${validEvents.length} events have valid dates (${processedEvents.length - validEvents.length} skipped)\n`);

        return validEvents;

    } catch (error) {
        await browser.close();
        throw error;
    }
}

async function main() {
    try {
        // Ensure URL constraint exists
        try {
            await pool.query(`
        ALTER TABLE events 
        ADD CONSTRAINT events_url_unique UNIQUE (url)
      `);
        } catch (err) {
            // Constraint might already exist
        }

        const events = await scrapeAMNH();

        if (events.length === 0) {
            console.log('⚠️  No events with valid dates found from AMNH');
            return;
        }

        console.log('💾 Inserting into database...\n');

        let inserted = 0;
        let updated = 0;

        for (const event of events) {
            try {
                const result = await pool.query(
                    `INSERT INTO events (
            name, category, date, time, location, address, price, spots,
            image, description, highlights, url, start_date, end_date, source, scraped_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
          ON CONFLICT (url) DO UPDATE SET
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            date = EXCLUDED.date,
            time = EXCLUDED.time,
            location = EXCLUDED.location,
            address = EXCLUDED.address,
            price = EXCLUDED.price,
            spots = EXCLUDED.spots,
            image = EXCLUDED.image,
            description = EXCLUDED.description,
            highlights = EXCLUDED.highlights,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            scraped_at = NOW()
          RETURNING (xmax = 0) AS inserted`,
                    [
                        event.name,
                        event.category,
                        event.date,
                        event.time,
                        event.location,
                        event.address,
                        event.price,
                        event.spots,
                        event.image,
                        event.description,
                        JSON.stringify(event.highlights),
                        event.url,
                        event.start_date,
                        event.end_date,
                        event.source
                    ]
                );

                if (result.rows[0].inserted) {
                    inserted++;
                } else {
                    updated++;
                }
            } catch (err) {
                console.error(`❌ Failed to insert event "${event.name}":`, err.message);
            }
        }

        console.log(`\n📊 Database Results:`);
        console.log(`   ✅ Inserted: ${inserted} new events`);
        console.log(`   🔄 Updated: ${updated} existing events`);
        console.log(`   📍 Total processed: ${events.length} events\n`);

        // Show sample events
        console.log('📋 Sample Events:');
        events.slice(0, 3).forEach((e, i) => {
            console.log(`\n${i + 1}. ${e.name}`);
            console.log(`   📅 ${e.date}`);
            console.log(`   🕐 ${e.time}`);
            console.log(`   🔗 ${e.url}`);
        });

    } catch (error) {
        console.error('❌ AMNH scraping failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main()
    .then(() => {
        console.log('\n✅ AMNH scraper completed successfully!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n❌ Fatal error:', err);
        process.exit(1);
    });
