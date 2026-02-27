#!/usr/bin/env node
/**
 * Direct Museum Scrapers for GitHub Actions
 * 
 * Scrapes MoMA, Guggenheim, and AMNH using Puppeteer
 * Runs in GitHub Actions to bypass Vercel's serverless limitations
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const { scrapeWithPuppeteer, CONFIGS } = require('./scrape-puppeteer.js');

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

async function scrapeAndInsert(config) {
    console.log(`\n🏛️  Scraping ${config.name}...`);

    try {
        const events = await scrapeWithPuppeteer(config);

        if (events.length === 0) {
            console.log(`⚠️  No events found from ${config.name}`);
            return { inserted: 0, updated: 0, total: 0 };
        }

        console.log(`✅ Scraped ${events.length} events from ${config.name}`);

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

        console.log(`   ✅ Inserted: ${inserted} | 🔄 Updated: ${updated}`);
        return { inserted, updated, total: events.length };

    } catch (error) {
        console.error(`❌ ${config.name} scraping failed:`, error.message);
        return { inserted: 0, updated: 0, total: 0 };
    }
}

async function main() {
    console.log('🏛️  Starting Museum Scrapers (MoMA, Guggenheim, AMNH)...\n');

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

        // Scrape all museums
        const results = await Promise.all([
            scrapeAndInsert(CONFIGS.moma),
            scrapeAndInsert(CONFIGS.guggenheim),
            scrapeAndInsert(CONFIGS.amnh)
        ]);

        const totals = results.reduce((acc, r) => ({
            inserted: acc.inserted + r.inserted,
            updated: acc.updated + r.updated,
            total: acc.total + r.total
        }), { inserted: 0, updated: 0, total: 0 });

        console.log(`\n📊 Final Results:`);
        console.log(`   ✅ Total Inserted: ${totals.inserted}`);
        console.log(`   🔄 Total Updated: ${totals.updated}`);
        console.log(`   📍 Total Processed: ${totals.total}`);

    } catch (error) {
        console.error('❌ Museum scraping failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main()
    .then(() => {
        console.log('\n✅ Museum scrapers completed successfully!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n❌ Fatal error:', err);
        process.exit(1);
    });
