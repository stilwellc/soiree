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

        // Collect basic info first
        const basicEvents = [];
        $('h2').each((i, elem) => {

            const $title = $(elem).find('a').first();
            const name = $title.text().trim();
            const href = $title.attr('href');

            if (!name || !href) return;

            let $next = $(elem).next();
            let description = '';
            let image = '';
            let categories = [];
            let location = 'Hoboken/Jersey City';
            let address = '';

            for (let j = 0; j < 10; j++) {
                if ($next.length === 0 || $next.is('h2')) break;

                const $img = $next.find('img');
                if ($img.length && !image) {
                    image = $img.attr('src');
                }

                $next.find('a[href*="/category/"]').each((_, catLink) => {
                    const catText = $(catLink).text().trim();
                    if (catText && catText !== 'The Hoboken Girl Calendar' && !categories.includes(catText)) {
                        categories.push(catText);
                    }
                });

                $next.find('a[href*="maps.google.com"], a[href*="maps.apple.com"]').each((_, mapLink) => {
                    const href = $(mapLink).attr('href');
                    try {
                        const url = new URL(href);
                        const query = url.searchParams.get('q') || url.searchParams.get('query');
                        if (query && !address) {
                            address = query;
                        }
                    } catch (e) { }
                });

                $next = $next.next();
            }

            if (address) {
                if (address.includes('Jersey City')) location = 'Jersey City';
                else if (address.includes('Hoboken')) location = 'Hoboken';
            }

            const category = categorizeEvent(name, categories.join(' '), location);

            const dateStr = 'Upcoming';
            const timeStr = 'See details';
            const { start_date, end_date } = parseDateText(dateStr, timeStr);

            const event = createNormalizedEvent({
                name,
                category,
                date: dateStr,
                time: timeStr,
                start_date,
                end_date,
                location,
                address: address || location,
                price: 'See details',
                spots: Math.floor(Math.random() * 100) + 20,
                image: image || getEventImage(name, category),
                description: description || `Event in ${location}: ${name}`,
                highlights: categories.length ? categories.slice(0, 4) : ['Local event', 'Community', location],
                url: href,
                source: 'The Local Girl'
            });

            if (event) basicEvents.push(event);
        });

        // Fetch details for each event to get the real date
        console.log(`Fetching details for ${basicEvents.length} events...`);

        await Promise.allSettled(basicEvents.map(async (event) => {
            try {
                const detailRes = await axios.get(event.url, {
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Connection': 'keep-alive'
                    }
                });
                const $detail = cheerio.load(detailRes.data);

                const dateText = $detail('h1').next('p').text().trim();

                if (dateText && dateText.length < 50) {
                    if (dateText.match(/([A-Z][a-z]+ \d{1,2}, \d{4})/)) {
                        event.date = dateText;
                        if (dateText.includes('@')) {
                            const parts = dateText.split('@');
                            event.date = parts[0].trim();
                            event.time = parts[1].trim();
                        }
                        const { start_date, end_date } = parseDateText(event.date, event.time);
                        event.start_date = start_date;
                        event.end_date = end_date;
                    }
                }
                events.push(event);
            } catch (e) {
                console.log(`Failed to fetch details for ${event.url}: ${e.message}`);
                events.push(event);
            }
        }));

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
            console.log('Inserting/Updating events in database...');
            let inserted = 0;
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
                }
            }
            console.log(`Inserted ${inserted} new events from The Local Girl.`);
        }

    } catch (err) {
        console.error('Script failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
