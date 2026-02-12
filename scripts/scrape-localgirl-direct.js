const puppeteer = require('puppeteer');
const { Pool } = require('pg');
const { parseDateText } = require('../api/lib/dateParser.js');
const { createNormalizedEvent } = require('../api/lib/normalize.js');
require('dotenv').config({ path: '.env.local' });

// Ensure we have DB connection string
if (!process.env.POSTGRES_URL) {
    console.error('Error: POSTGRES_URL environment variable is required.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

function categorizeEvent(title, description, location) {
    const text = (title + ' ' + (description || '')).toLowerCase();
    if (text.includes('music') || text.includes('concert') || text.includes('jazz') || text.includes('band')) return 'music';
    if (text.includes('art') || text.includes('gallery') || text.includes('exhibit')) return 'art';
    if (text.includes('food') || text.includes('dinner') || text.includes('brunch') || text.includes('drink') || text.includes('wine') || text.includes('beer') || text.includes('cocktail') || text.includes('restaurant') || text.includes('cafe') || text.includes('bake') || text.includes('cook')) return 'culinary';
    if (text.includes('yoga') || text.includes('fitness') || text.includes('wellness') || text.includes('beauty') || text.includes('spa')) return 'lifestyle';
    if (text.includes('fashion') || text.includes('boutique') || text.includes('style')) return 'fashion';
    return 'community';
}

function getEventImage(title, category) {
    const categoryImages = {
        music: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&h=800&fit=crop',
        art: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=1200&h=800&fit=crop',
        culinary: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&h=800&fit=crop',
        lifestyle: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1200&h=800&fit=crop',
        fashion: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&h=800&fit=crop',
        community: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&h=800&fit=crop',
    };
    return categoryImages[category] || categoryImages.community;
}

async function scrapeTheLocalGirl() {
    console.log('🌐 Starting The Local Girl scraper (Puppeteer)...');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log('Loading The Local Girl calendar...');
        await page.goto('https://thelocalgirl.com/calendar/hoboken/', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for the event list to be present
        await page.waitForSelector('ol.eventsList__list', { timeout: 15000 }).catch(() => {
            console.log('Warning: ol.eventsList__list not found, will try to extract anyway');
        });

        console.log('Extracting events from listing page...');

        // Extract events using the date-header structure directly in the browser context
        const events = await page.evaluate(() => {
            const results = [];
            const list = document.querySelector('ol.eventsList__list');
            if (!list) return results;

            let currentDateStr = 'Upcoming';

            Array.from(list.children).forEach(el => {
                const cls = el.className || '';

                if (cls.includes('eventsList__list__dateHeader')) {
                    const btn = el.querySelector('button[data-date]');
                    if (btn) {
                        const dataDate = btn.getAttribute('data-date') || '';
                        const isoMatch = dataDate.match(/(\d{4}-\d{2}-\d{2})/);
                        if (isoMatch) {
                            const d = new Date(isoMatch[1] + 'T12:00:00Z');
                            currentDateStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                        }
                    }
                    return;
                }

                if (!cls.includes('eventsList__list__item')) return;
                if (results.length >= 120) return;

                const link = el.querySelector('h2 a');
                if (!link) return;
                const name = link.textContent.trim();
                const href = link.href;
                if (!name || !href) return;

                // Categories
                const categories = [];
                el.querySelectorAll('.eventsList__list__item__categories a').forEach(a => {
                    const t = a.textContent.trim();
                    if (t && t !== 'The Hoboken Girl Calendar' && !categories.includes(t)) categories.push(t);
                });

                // Location
                let location = 'Hoboken/Jersey City';
                let address = '';
                const locEl = el.querySelector('.eventlocation');
                if (locEl) {
                    address = locEl.textContent.trim();
                    if (address.includes('Jersey City')) location = 'Jersey City';
                    else if (address.includes('Hoboken')) location = 'Hoboken';
                }

                // Image (data-src for lazy-loaded)
                const imgEl = el.querySelector('.eventsList__list__item__image');
                const image = (imgEl && (imgEl.getAttribute('data-src') || imgEl.getAttribute('src'))) || '';

                results.push({ name, href, categories, location, address, image, dateStr: currentDateStr });
            });

            return results;
        });

        console.log(`Found ${events.length} events on listing page`);

        // Build normalized event objects
        const normalizedEvents = [];
        for (const e of events) {
            const category = categorizeEvent(e.name, e.categories.join(' '), e.location);
            const { start_date, end_date } = parseDateText(e.dateStr, 'See details');

            const event = createNormalizedEvent({
                name: e.name,
                category,
                date: e.dateStr,
                time: 'See details',
                start_date,
                end_date,
                location: e.location,
                address: e.address || e.location,
                price: 'See details',
                spots: Math.floor(Math.random() * 100) + 20,
                image: e.image || getEventImage(e.name, category),
                description: `Event in ${e.location}: ${e.name}`,
                highlights: e.categories.length ? e.categories.slice(0, 4) : ['Local event', 'Community', e.location],
                url: e.href,
                source: 'The Local Girl'
            });

            if (event) {
                normalizedEvents.push(event);
                console.log(`  ✓ ${e.name.substring(0, 40)} → ${start_date || 'no date'}`);
            }
        }

        console.log(`\nScraped ${normalizedEvents.length} events from The Local Girl`);
        return normalizedEvents;

    } finally {
        await browser.close();
    }
}

async function run() {
    try {
        const events = await scrapeTheLocalGirl();
        console.log(`Found ${events.length} events.`);

        if (events.length > 0) {
            console.log('Managing events in database...');

            // Insert or update events
            let inserted = 0;
            let updated = 0;
            for (const event of events) {
                const { rows } = await pool.query('SELECT id FROM events WHERE url = $1', [event.url]);
                if (rows.length === 0) {
                    await pool.query(
                        `INSERT INTO events
              (name, category, date, time, start_date, end_date, location, address, price, spots, image, description, highlights, url, source)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                        [
                            event.name, event.category, event.date, event.time, event.start_date, event.end_date,
                            event.location, event.address, event.price, event.spots, event.image,
                            event.description, JSON.stringify(event.highlights), event.url, event.source
                        ]
                    );
                    inserted++;
                } else {
                    await pool.query(
                        `UPDATE events
                         SET name = $1, category = $2, date = $3, time = $4,
                             start_date = $5, end_date = $6, scraped_at = CURRENT_TIMESTAMP
                         WHERE url = $7`,
                        [event.name, event.category, event.date, event.time,
                        event.start_date, event.end_date, event.url]
                    );
                    updated++;
                }
            }
            console.log(`\nInserted: ${inserted} new events`);
            console.log(`Updated: ${updated} existing events`);
        }

    } catch (err) {
        console.error('Script failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
