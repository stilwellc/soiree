const puppeteer = require('puppeteer');
const { parseDateText } = require('../api/lib/dateParser.js');

/**
 * Generic Puppeteer scraper for JavaScript-heavy event sites
 * Can be used for Visit NJ, Monmouth County, etc.
 */
async function scrapeWithPuppeteer(config) {
    let browser;
    try {
        console.log(`Launching browser for ${config.name}...`);

        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

        console.log(`Navigating to ${config.url}...`);
        await page.goto(config.url, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait a bit for dynamic content
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log('Extracting events...');

        const events = await page.evaluate((selectors) => {
            const results = [];

            // Try multiple selectors
            let eventElements = [];
            for (const selector of selectors.container) {
                eventElements = document.querySelectorAll(selector);
                if (eventElements.length > 0) {
                    console.log(`Found ${eventElements.length} elements with selector: ${selector}`);
                    break;
                }
            }

            if (eventElements.length === 0) {
                // Fallback: find all links that might be events
                const allLinks = document.querySelectorAll('a');
                const eventLinks = [];
                allLinks.forEach(link => {
                    const text = link.textContent.trim();
                    const href = link.href;
                    if (text.length > 10 && text.length < 200 && href && !href.includes('#')) {
                        eventLinks.push(link);
                    }
                });
                eventElements = eventLinks.slice(0, 30);
            }

            eventElements.forEach((elem, index) => {
                if (results.length >= 30) return;

                // Get title - try multiple selectors
                let title = '';
                for (const sel of selectors.title) {
                    const titleElem = elem.querySelector ? elem.querySelector(sel) : elem;
                    if (titleElem && titleElem.textContent) {
                        title = titleElem.textContent.trim();
                        if (title.length > 5) break;
                    }
                }

                if (!title || title.length < 5) {
                    title = elem.textContent ? elem.textContent.trim().substring(0, 100) : '';
                }

                if (!title || title.length < 5) return;

                // Get link
                const linkElem = elem.querySelector ? elem.querySelector('a') : elem;
                const link = linkElem && linkElem.href ? linkElem.href : (elem.href || '');

                if (!link || link.includes('#')) return;

                // Get date
                let date = '';
                for (const sel of selectors.date) {
                    const dateElem = elem.querySelector ? elem.querySelector(sel) : null;
                    if (dateElem) {
                        date = dateElem.textContent.trim();
                        if (date) break;
                    }
                }

                // Get location
                let location = '';
                for (const sel of selectors.location) {
                    const locElem = elem.querySelector ? elem.querySelector(sel) : null;
                    if (locElem) {
                        location = locElem.textContent.trim();
                        if (location) break;
                    }
                }

                // Get description
                let description = '';
                const descElem = elem.querySelector ? elem.querySelector('p') : null;
                if (descElem) {
                    description = descElem.textContent.trim();
                }

                // Get image
                let image = '';
                const imgElem = elem.querySelector ? elem.querySelector('img') : null;
                if (imgElem) {
                    image = imgElem.src || imgElem.dataset.src || '';
                }

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
        }, config.selectors);

        console.log(`Found ${events.length} events from ${config.name}`);

        // Process events
        const processedEvents = events.map(event => {
            const { start_date, end_date } = parseDateText(event.date || 'Ongoing', '');
            const category = categorizeEvent(event.title, event.description);

            return {
                name: event.title,
                category,
                date: event.date || 'Ongoing',
                time: 'See details',
                start_date,
                end_date,
                location: event.location || config.defaultLocation,
                address: event.location || 'See event details',
                price: 'See details',
                spots: Math.floor(Math.random() * 100) + 50,
                image: event.image || `https://source.unsplash.com/featured/?${category},event`,
                description: event.description.substring(0, 500) || `${event.title}`,
                highlights: [config.name, category.charAt(0).toUpperCase() + category.slice(1)],
                url: event.link,
                source: config.name
            };
        });

        await browser.close();
        return processedEvents;

    } catch (error) {
        console.error(`${config.name} Puppeteer scraping failed:`, error.message);
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

// Preset configurations for different sites
const CONFIGS = {
    visitNJ: {
        name: 'Visit NJ',
        url: 'https://visitnj.org/nj/events',
        defaultLocation: 'New Jersey',
        selectors: {
            container: ['article', '.event', '.card', '[class*="event"]', '[class*="Event"]', 'a[href*="/event"]'],
            title: ['h1', 'h2', 'h3', 'h4', '.title', '[class*="title"]', '[class*="Title"]'],
            date: ['.date', 'time', '[class*="date"]', '[class*="Date"]'],
            location: ['.location', '.venue', '[class*="location"]', '[class*="Location"]']
        }
    },
    monmouthCounty: {
        name: 'Monmouth County',
        url: 'https://tourism.visitmonmouth.com/events/',
        defaultLocation: 'Monmouth County, NJ',
        selectors: {
            container: ['article', '.event', '.listing', '[class*="event"]', 'a[href*="/event"]'],
            title: ['h1', 'h2', 'h3', '.title', '[class*="title"]'],
            date: ['.date', 'time', '[class*="date"]'],
            location: ['.location', '.venue', '[class*="location"]']
        }
    }
};

module.exports = { scrapeWithPuppeteer, CONFIGS };

// Test if run directly
if (require.main === module) {
    const configName = process.argv[2] || 'visitNJ';
    const config = CONFIGS[configName];

    if (!config) {
        console.error(`Unknown config: ${configName}`);
        console.log(`Available: ${Object.keys(CONFIGS).join(', ')}`);
        process.exit(1);
    }

    scrapeWithPuppeteer(config).then(events => {
        console.log('\n=== Results ===');
        console.log(`Total events: ${events.length}`);
        if (events.length > 0) {
            console.log('\nSample events:');
            events.slice(0, 5).forEach((e, i) => {
                console.log(`\n${i + 1}. ${e.name}`);
                console.log(`   Date: ${e.date}`);
                console.log(`   Location: ${e.location}`);
                console.log(`   URL: ${e.url}`);
            });
        }
        process.exit(0);
    });
}
