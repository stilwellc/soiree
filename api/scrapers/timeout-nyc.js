const axios = require('axios');
const cheerio = require('cheerio');
const { parseDateText } = require('../api/lib/dateParser.js');

/**
 * Scrape free events from Time Out New York
 * https://www.timeout.com/newyork/things-to-do/free-things-to-do-in-nyc
 */
async function scrapeTimeOutNYC() {
    try {
        console.log('Fetching events from Time Out New York...');
        const response = await axios.get('https://www.timeout.com/newyork/things-to-do/free-things-to-do-in-nyc', {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        const $ = cheerio.load(response.data);
        const events = [];
        const seenUrls = new Set();

        // Time Out uses article cards for events
        $('article, .card, [class*="Card"]').each((i, elem) => {
            if (events.length >= 20) return false; // Limit to 20 events

            const $card = $(elem);

            // Get title
            let name = $card.find('h1, h2, h3, [class*="title"], [class*="Title"]').first().text().trim();
            if (!name || name.length < 5) return;

            // Get link
            const $link = $card.find('a').first();
            let href = $link.attr('href');
            if (!href) return;

            // Make absolute URL
            if (href.startsWith('/')) {
                href = `https://www.timeout.com${href}`;
            }

            if (seenUrls.has(href)) return;
            seenUrls.add(href);

            // Get description/snippet
            let description = $card.find('p, [class*="description"], [class*="Description"]').first().text().trim();
            if (!description) {
                description = `${name} - Free event in NYC`;
            }

            // Get image
            let image = $card.find('img').first().attr('src') || $card.find('img').first().attr('data-src');
            if (image && image.startsWith('//')) {
                image = 'https:' + image;
            }

            // Most Time Out free events are ongoing/recurring
            const dateStr = 'Ongoing';
            const timeStr = 'See details';
            const { start_date, end_date } = parseDateText(dateStr, timeStr);

            // Categorize based on title/description
            const category = categorizeEvent(name, description);

            events.push({
                name,
                category,
                date: dateStr,
                time: timeStr,
                start_date,
                end_date,
                location: 'New York City',
                address: 'Various locations - see event details',
                price: 'free',
                spots: Math.floor(Math.random() * 100) + 50,
                image: image || `https://source.unsplash.com/featured/?${category},nyc`,
                description: description.substring(0, 500),
                highlights: ['Free event', 'NYC', category.charAt(0).toUpperCase() + category.slice(1)],
                url: href,
                source: 'Time Out New York'
            });
        });

        console.log(`Scraped ${events.length} events from Time Out New York`);
        return events;
    } catch (error) {
        console.error('Time Out New York scraping failed:', error.message);
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

module.exports = { scrapeTimeOutNYC };
