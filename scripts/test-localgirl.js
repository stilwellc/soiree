const axios = require('axios');
const cheerio = require('cheerio');
const { parseDateText } = require('../api/lib/dateParser.js');
const { createNormalizedEvent } = require('../api/lib/normalize.js');

// --- Helper Functions from api/scrape.js ---

function categorizeEvent(title, description, location) {
    const text = (title + ' ' + (description || '')).toLowerCase();
    const loc = (location || '').toLowerCase();

    // Location based
    const museumLocations = ['moma', 'met', 'metropolitan', 'whitney', 'guggenheim', 'new museum', 'museum', 'gallery', 'brooklyn museum', 'amnh'];
    if (museumLocations.some(m => loc.includes(m))) {
        if (text.match(/\b(cook|chef|tasting|dinner|brunch|food)\b/)) return 'culinary';
        return 'art';
    }

    // Perks
    if (text.match(/free\s+(sample|gift|coffee|latte|drink|treat|tote|shirt|t-shirt|merch|product|item|goodie|makeup|lipstick|skincare|fragrance|ice cream|donut|doughnut|pizza|slice|cookie|cupcake|smoothie|juice|chai|matcha|espresso|bagel|croissant|muffin|chocolate|beer|wine|cocktail|seltzer|swag)/i) ||
        text.match(/\b(complimentary|giveaway|swag|goodie bag|gift bag|gift with purchase|free gifts?|free tasting)\b/i) ||
        text.match(/while supplies last/i) ||
        text.match(/first\s+\d+\s+(guests?|people|visitors?|customers?)/i)) {
        return 'perks';
    }

    // Film
    if (text.match(/directed by|director's cut|screening|^\d{4}\.\s|film series|\bfilms?\b.*\b\d{4}\b/)) {
        return 'art';
    }

    // Art & Culture
    if (text.match(/\b(art|gallery|exhibit|exhibition|paint|sculpture|artist|mural|craft|pottery|drawing|illustration|installation|visual|theater|theatre|cinema|film|movie|photography|graffiti|contemporary|abstract|coloring|screening|animation|collection|calligraphy|prints|portrait|studio tour|open studio|architecture tour)\b/) || text.match(/street art|ice sculpture/)) {
        return 'art';
    }

    // Music
    if (text.match(/\b(music|concert|jazz|dj|band|singer|live|festival|stage|soundtrack|album|vinyl|orchestra|choir|acoustic|symphony|karaoke|rap|rock|indie|electronic|classical|ballet|choreograph|ep release|nightlife|party|rave)\b/) || text.match(/live music|hip hop|release party/)) {
        return 'music';
    }

    // Food
    if (text.match(/\b(food|culinary|market|tasting|restaurant|cook|dining|kitchen|chef|menu|wine|coffee|cafe|bakery|brunch|dinner|lunch|breakfast|cocktail|beer|eat|eating|flavor|recipe|gourmet|pizza|burger|chicken|sushi|ramen|bbq|brewery|pub|tavern|bistro|eatery|slice|taco|sandwich|foodie|cuisine|pastry|dessert|appetizer|treat|snack|chocolate|muffin|sundae|smoothie|gnocchi|hot chocolate|ice cream|cookie|doughnut|donut)\b/) || text.match(/grand opening.*(express|grill|kitchen|cafe|deli|restaurant|bar|eatery|bistro|bakery)/i)) {
        return 'culinary';
    }

    // Fashion
    if (text.match(/\b(fashion|runway|designer|couture|clothing|apparel|boutique|wardrobe|outfit|lookbook|vogue|catwalk|textile)\b/)) {
        return 'fashion';
    }

    // Lifestyle
    if (text.match(/\b(yoga|fitness|workout|meditation|wellness|beauty|skincare|spa|k-beauty|cosmetic|makeup|fragrance|self-care|pilates|barre|cycling|running|marathon|gym)\b/) || text.match(/pop-up|popup|launch celebration|grand opening|experience|charm bar|scavenger hunt/)) {
        return 'lifestyle';
    }

    // Community
    if (text.match(/\b(family|kids|children|volunteer|parade|camp|fair|story time|storytime|tweens|teens|workshop|seminar|lecture|networking|meetup|discussion|panel|book club|reading|world cup|soccer|basketball|baseball|sports bar|fan village)\b/) || text.match(/valentine|galentine|lunar new year|australia day|wikipedia day/)) {
        return 'community';
    }

    // Default
    if (text.match(/\b(celebration|anniversary|birthday|bash|launch)\b/)) return 'community';

    return 'community';
}

function getEventImage(title, category) {
    // Mock image generation for test script
    return `https://source.unsplash.com/featured/?${category},event`;
}

// --- The Scraper Logic ---

async function scrapeTheLocalGirl() {
    try {
        console.log('Fetching events from The Local Girl...');
        const response = await axios.get('https://thelocalgirl.com/calendar/hoboken/', {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const events = [];

        // Collect basic info first
        const basicEvents = [];
        $('h2').each((i, elem) => {
            if (basicEvents.length >= 15) return false;

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
        const eventsWithDates = [];

        // Process in parallel
        await Promise.allSettled(basicEvents.map(async (event) => {
            try {
                const detailRes = await axios.get(event.url, {
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });
                const $detail = cheerio.load(detailRes.data);

                // Metadata often appears in the first paragraph after the H1 title
                const dateText = $detail('h1').next('p').text().trim();

                // Also try to find time if possible, but date is priority
                // Sometimes dateText includes time, e.g. "February 7, 2026 @ 7:00 pm - 10:00 pm"

                if (dateText && dateText.length < 50) {
                    // Check if it looks like a date
                    if (dateText.match(/([A-Z][a-z]+ \d{1,2}, \d{4})/)) {
                        event.date = dateText;

                        // If there's a time part
                        if (dateText.includes('@')) {
                            const parts = dateText.split('@');
                            event.date = parts[0].trim();
                            event.time = parts[1].trim();
                        }

                        // Re-parse with new date
                        const { start_date, end_date } = parseDateText(event.date, event.time);
                        event.start_date = start_date;
                        event.end_date = end_date;
                    }
                }
                eventsWithDates.push(event);
            } catch (e) {
                console.log(`Failed to fetch details for ${event.url}: ${e.message}`);
                // Push event anyway to keep it even if date fetch failed
                eventsWithDates.push(event);
            }
        }));

        return eventsWithDates;

    } catch (error) {
        console.error('The Local Girl scraping failed:', error.message);
        return [];
    }
}

// --- Run Verification ---

(async () => {
    console.log("Starting scrape test...");
    const events = await scrapeTheLocalGirl();
    console.log(`\nSuccessfully scraped ${events.length} events.`);
    if (events.length > 0) {
        console.log("Sample Event:");
        console.log(JSON.stringify(events[0], null, 2));
    } else {
        console.log("No events found. Check selectors.");
    }
})();
