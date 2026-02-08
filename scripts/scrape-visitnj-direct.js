#!/usr/bin/env node
/**
 * Direct Visit NJ Scraper for GitHub Actions
 * 
 * This script runs independently in GitHub Actions to bypass Vercel's
 * serverless function limitations (no Puppeteer support).
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const { scrapeWithPuppeteer, CONFIGS } = require('./scrape-puppeteer.js');

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    console.log('🌐 Starting Visit NJ Direct Scraper...\n');

    try {
        // Scrape Visit NJ using Puppeteer
        const events = await scrapeWithPuppeteer(CONFIGS.visitNJ);

        if (events.length === 0) {
            console.log('⚠️  No events found from Visit NJ');
            return;
        }

        console.log(`\n✅ Scraped ${events.length} events from Visit NJ`);
        console.log('💾 Inserting into database...\n');

        // Insert events into database
        let inserted = 0;
        let updated = 0;

        for (const event of events) {
            try {
                // Use UPSERT to avoid duplicates (based on URL)
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
            console.log(`   📍 ${e.location}`);
            console.log(`   🔗 ${e.url}`);
        });

    } catch (error) {
        console.error('❌ Visit NJ scraping failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Add unique constraint on URL if it doesn't exist
async function ensureUrlConstraint() {
    try {
        await pool.query(`
      ALTER TABLE events 
      ADD CONSTRAINT events_url_unique UNIQUE (url)
    `);
        console.log('✅ Added unique constraint on URL column');
    } catch (err) {
        // Constraint might already exist, that's fine
        if (!err.message.includes('already exists')) {
            console.warn('⚠️  Could not add URL constraint:', err.message);
        }
    }
}

// Run the scraper
ensureUrlConstraint()
    .then(() => main())
    .then(() => {
        console.log('\n✅ Visit NJ scraper completed successfully!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n❌ Fatal error:', err);
        process.exit(1);
    });
