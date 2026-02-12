const axios = require('axios');
const cheerio = require('cheerio');
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

// --- Helper Functions (copied from api/scrape.js to ensure independence) ---

function categorizeEvent(title, description, location) {
    const text = (title + ' ' + (description || '')).toLowerCase();
    const loc = (location || '').toLowerCase();

    // Reuse logic from main scraper... for brevity in this script, just basic categorization
    if (text.includes('music') || text.includes('concert')) return 'music';
    if (text.includes('art') || text.includes('gallery')) return 'art';
    if (text.includes('food') || text.includes('dinner')) return 'culinary';
    return 'community';
}

function getEventImage(title, category) {
    return `https://source.unsplash.com/featured/?${category},event`;
}

// --- The Scraper Logic ---

async function scrapeTheLocalGirl() {
    try {
        console.log('Fetching events from The Local Girl (Standalone)...');
        const response = await axios.get('https://thelocalgirl.com/calendar/hoboken/', {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0'
            }
        });

        const $ = cheerio.load(response.data);
        const events = [];

        // The listing page groups events under date headers in an ordered list:
        //   ol.eventsList__list
        //     li.eventsList__list__dateHeader  (contains button with data-date="2026-02-12, 23:00 UTC")
        //     li.eventsList__list__item        (event under that date)
        //     li.eventsList__list__item
        //     li.eventsList__list__dateHeader  (next date)
        //     ...
        // We read the children in order, tracking the current date from each header.

        let currentDateStr = 'Upcoming';
        let currentISODate = null;

        $('ol.eventsList__list').children().each((i, el) => {
            const cls = $(el).attr('class') || '';

            if (cls.includes('eventsList__list__dateHeader')) {
                // Extract date from the toggle button's data-date attribute
                // Format: "2026-02-12, 23:00 UTC"
                const dataDate = $(el).find('button[data-date]').attr('data-date') || '';
                if (dataDate) {
                    const isoMatch = dataDate.match(/(\d{4}-\d{2}-\d{2})/);
                    if (isoMatch) {
                        currentISODate = isoMatch[1];
                        // Format as readable date string
                        const d = new Date(currentISODate + 'T12:00:00Z');
                        currentDateStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                    }
                }
                return; // skip to next child
            }

            if (!cls.includes('eventsList__list__item')) return;
            if (events.length >= 120) return;

            const $item = $(el);
            const $link = $item.find('h2 a').first();
            const name = $link.text().trim();
            const href = $link.attr('href');

            if (!name || !href) return;

            // Extract categories
            const categories = [];
            $item.find('.eventsList__list__item__categories a').each((_, catLink) => {
                const catText = $(catLink).text().trim();
                if (catText && catText !== 'The Hoboken Girl Calendar' && !categories.includes(catText)) {
                    categories.push(catText);
                }
            });

            // Extract location from address field
            let location = 'Hoboken/Jersey City';
            let address = '';
            const locationText = $item.find('.eventlocation').text().trim();
            if (locationText) {
                address = locationText;
                if (locationText.includes('Jersey City')) location = 'Jersey City';
                else if (locationText.includes('Hoboken')) location = 'Hoboken';
            }

            // Extract image (use data-src for lazy-loaded images)
            let image = $item.find('.eventsList__list__item__image').attr('data-src')
                || $item.find('.eventsList__list__item__image').attr('src')
                || '';

            const category = categorizeEvent(name, categories.join(' '), location);

            // Use date from section header
            const { start_date, end_date } = parseDateText(currentDateStr, 'See details');

            const event = createNormalizedEvent({
                name,
                category,
                date: currentDateStr,
                time: 'See details',
                start_date,
                end_date,
                location,
                address: address || location,
                price: 'See details',
                spots: Math.floor(Math.random() * 100) + 20,
                image: image || getEventImage(name, category),
                description: `Event in ${location}: ${name}`,
                highlights: categories.length ? categories.slice(0, 4) : ['Local event', 'Community', location],
                url: href,
                source: 'The Local Girl'
            });

            if (event) {
                events.push(event);
                console.log(`  ✓ ${name.substring(0, 40)} → ${start_date || 'no date'}`);
            }
        });

        console.log(`\nScraped ${events.length} events from The Local Girl (dates from listing page)`);
        return events;

    } catch (error) {
        console.error('The Local Girl scraping failed:', error.message);
        return [];
    }
}

async function run() {
    try {
        const events = await scrapeTheLocalGirl();
        console.log(`Found ${events.length} events.`);

        if (events.length > 0) {
            console.log('Managing events in database...');

            // Get existing placeholder events from The Local Girl
            const { rows: placeholderEvents } = await pool.query(`
                SELECT url, name 
                FROM events 
                WHERE source = 'The Local Girl' AND start_date = '2026-02-15'
            `);

            // Track which placeholder events are still found
            const foundUrls = new Set(events.map(e => e.url));

            // Mark missing placeholder events as past
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            let markedPast = 0;
            for (const oldEvent of placeholderEvents) {
                if (!foundUrls.has(oldEvent.url)) {
                    await pool.query(
                        `UPDATE events SET start_date = $1, end_date = $1 WHERE url = $2`,
                        [yesterdayStr, oldEvent.url]
                    );
                    markedPast++;
                    console.log(`  Marked as past: ${oldEvent.name.substring(0, 50)}...`);
                }
            }

            // Insert or update events
            let inserted = 0;
            let updated = 0;
            for (const event of events) {
                const { rows } = await pool.query('SELECT id FROM events WHERE url = $1', [event.url]);
                if (rows.length === 0) {
                    // Insert new event
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
                    // Update existing event (in case date was extracted this time)
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
            console.log(`Marked as past: ${markedPast} events`);
        }

    } catch (err) {
        console.error('Script failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
