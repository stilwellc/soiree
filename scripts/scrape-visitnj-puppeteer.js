const puppeteer = require('puppeteer');
const { parseDateText } = require('../api/lib/dateParser.js');

/**
 * Scrape events from Visit NJ using Puppeteer (JavaScript rendering)
 * https://visitnj.org/nj/events
 */
async function scrapeVisitNJWithPuppeteer() {
    let browser;
    try {
        console.log('Launching browser for Visit NJ...');

        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

        console.log('Navigating to Visit NJ events page...');
        await page.goto('https://visitnj.org/nj/events', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for events to load
        await page.waitForSelector('article, .event, .card, [class*="event"]', { timeout: 10000 });

        console.log('Extracting events...');

        const events = await page.evaluate(() => {
            const eventElements = document.querySelectorAll('article, .event, .card, [class*="event"], [class*="Event"]');
            const results = [];

            eventElements.forEach((elem, index) => {
                if (results.length >= 30) return; // Limit to 30 events

                // Get title
                const titleElem = elem.querySelector('h1, h2, h3, h4, .title, [class*="title"], [class*="Title"]');
                const title = titleElem ? titleElem.textContent.trim() : '';

                if (!title || title.length < 5) return;

                // Get link
                const linkElem = elem.querySelector('a');
                const link = linkElem ? linkElem.href : '';

                if (!link) return;

                // Get date
                const dateElem = elem.querySelector('.date, time, [class*="date"], [class*="Date"]');
                const date = dateElem ? dateElem.textContent.trim() : '';

                // Get location
                const locationElem = elem.querySelector('.location, .venue, [class*="location"], [class*="Location"]');
                const location = locationElem ? locationElem.textContent.trim() : '';

                // Get description
                const descElem = elem.querySelector('p, .description, [class*="description"]');
                const description = descElem ? descElem.textContent.trim() : '';

                // Get image
                const imgElem = elem.querySelector('img');
                const image = imgElem ? (imgElem.src || imgElem.dataset.src) : '';

                results.push({
                    title,
                    link,
                    date,
                    location,
                    description,
                    image
                });
            });

            return results;
        });

        console.log(`Found ${events.length} events from Visit NJ`);

        // Process events
        const processedEvents = events.map(event => {
            const { start_date, end_date } = parseDateText(event.date || 'Ongoing', '');

            // Categorize
            const category = categorizeEvent(event.title, event.description);

            // Determine region
            let region = 'New Jersey';
            const loc = event.location.toLowerCase();
            if (loc.includes('hoboken') || loc.includes('jersey city')) {
                region = 'Hoboken/Jersey City';
            } else if (loc.includes('asbury') || loc.includes('monmouth') || loc.includes('ocean')) {
                region = 'Jersey Shore';
            }

            return {
                name: event.title,
                category,
                date: event.date || 'Ongoing',
                time: 'See details',
                start_date,
                end_date,
                location: event.location || region,
                address: event.location || 'See event details',
                price: 'See details',
                spots: Math.floor(Math.random() * 100) + 50,
                image: event.image || `https://source.unsplash.com/featured/?${category},new-jersey`,
                description: event.description.substring(0, 500) || `${event.title} in New Jersey`,
                highlights: ['Visit NJ', region, category.charAt(0).toUpperCase() + category.slice(1)],
                url: event.link,
                source: 'Visit NJ'
            };
        });

        await browser.close();
        return processedEvents;

    } catch (error) {
        console.error('Visit NJ Puppeteer scraping failed:', error.message);
        if (browser) await browser.close();
        return [];
    }
}

function categorizeEvent(title, description) {
    const text = (title + ' ' + description).toLowerCase();

    if (text.match(/\b(museum|gallery|exhibit|art|sculpture|paint)\b/)) return 'art';
    if (text.match(/\b(music|concert|jazz|band|singer|festival)\b/)) return 'music';
    if (text.match(/\b(food|restaurant|dining|culinary|chef|tasting)\b/)) return 'culinary';
    if (text.match(/\b(park|outdoor|hike|walk|nature|garden)\b/)) return 'community';
    if (text.match(/\b(theater|theatre|show|performance|comedy)\b/)) return 'art';

    return 'community';
}

module.exports = { scrapeVisitNJWithPuppeteer };

// Test if run directly
if (require.main === module) {
    scrapeVisitNJWithPuppeteer().then(events => {
        console.log('\n=== Results ===');
        console.log(`Total events: ${events.length}`);
        if (events.length > 0) {
            console.log('\nSample events:');
            events.slice(0, 3).forEach((e, i) => {
                console.log(`\n${i + 1}. ${e.name}`);
                console.log(`   Date: ${e.date}`);
                console.log(`   Location: ${e.location}`);
                console.log(`   URL: ${e.url}`);
            });
        }
        process.exit(0);
    });
}
