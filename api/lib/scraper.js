import * as cheerio from 'cheerio';

// Categorize events based on keywords
function categorizeEvent(title, description) {
  const text = `${title} ${description}`.toLowerCase();

  if (text.match(/art|gallery|exhibition|museum|sculpture|painting|photography/)) {
    return 'art';
  } else if (text.match(/music|concert|jazz|dj|band|acoustic|electronic/)) {
    return 'music';
  } else if (text.match(/food|culinary|chef|dinner|tasting|restaurant|cocktail|wine/)) {
    return 'culinary';
  } else if (text.match(/fashion|style|runway|designer|clothing/)) {
    return 'fashion';
  }

  return 'art'; // Default category
}

// Generate placeholder image based on category
function getPlaceholderImage(category) {
  const images = {
    art: 'https://images.unsplash.com/photo-1531243269054-5ebf6f34081e?w=800&q=80',
    music: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800&q=80',
    culinary: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
    fashion: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80'
  };
  return images[category] || images.art;
}

// Scrape NYC events from The Skint (free events in NYC)
async function scrapeTheSkint() {
  try {
    const response = await fetch('https://theskint.com/');
    const html = await response.text();
    const $ = cheerio.load(html);
    const events = [];

    // Parse event listings
    $('.event-item, .post').slice(0, 10).each((i, elem) => {
      const $elem = $(elem);
      const title = $elem.find('h2, h3, .title').first().text().trim();
      const description = $elem.find('p, .excerpt').first().text().trim();
      const location = $elem.find('.venue, .location').first().text().trim() || 'NYC';
      const link = $elem.find('a').first().attr('href');

      if (title) {
        const category = categorizeEvent(title, description);
        events.push({
          name: title,
          category,
          date: 'This Week',
          time: 'See details',
          location: location || 'Various NYC',
          address: location,
          price: 'free',
          spots: Math.floor(Math.random() * 100) + 50,
          image: getPlaceholderImage(category),
          description: description || `Join us for ${title.toLowerCase()} in NYC.`,
          highlights: [
            'Free entry',
            'NYC location',
            'Limited spots available',
            'RSVP recommended'
          ],
          source_url: link || 'https://theskint.com'
        });
      }
    });

    return events;
  } catch (error) {
    console.error('Error scraping The Skint:', error);
    return [];
  }
}

// Scrape Time Out New York
async function scrapeTimeOut() {
  try {
    const response = await fetch('https://www.timeout.com/newyork/things-to-do/free-things-to-do-in-new-york');
    const html = await response.text();
    const $ = cheerio.load(html);
    const events = [];

    $('.card, ._card, .listingCard').slice(0, 10).each((i, elem) => {
      const $elem = $(elem);
      const title = $elem.find('h3, h2, .card-title').first().text().trim();
      const description = $elem.find('p, .card-description').first().text().trim();
      const location = $elem.find('.venue, .location, .neighborhood').first().text().trim();
      const image = $elem.find('img').first().attr('src');
      const link = $elem.find('a').first().attr('href');

      if (title) {
        const category = categorizeEvent(title, description);
        events.push({
          name: title,
          category,
          date: 'Upcoming',
          time: 'Various times',
          location: location || 'Manhattan',
          address: location,
          price: 'free',
          spots: Math.floor(Math.random() * 150) + 30,
          image: image || getPlaceholderImage(category),
          description: description || `Experience ${title.toLowerCase()} in New York City.`,
          highlights: [
            'Free admission',
            'World-class experience',
            'NYC cultural event',
            'All ages welcome'
          ],
          source_url: link ? `https://www.timeout.com${link}` : 'https://www.timeout.com/newyork'
        });
      }
    });

    return events;
  } catch (error) {
    console.error('Error scraping Time Out:', error);
    return [];
  }
}

// Generate fallback events if scraping fails
function generateFallbackEvents() {
  const fallbackEvents = [
    {
      name: "Brooklyn Street Art Walk",
      category: "art",
      date: "This Weekend",
      time: "2:00 PM - 5:00 PM",
      location: "Bushwick, Brooklyn",
      address: "Troutman St & Wyckoff Ave, Brooklyn, NY",
      price: "free",
      spots: 75,
      image: "https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=800&q=80",
      description: "Explore Bushwick's vibrant street art scene with a local guide. Discover hidden murals and learn about the artists behind them.",
      highlights: [
        "Guided walking tour",
        "Instagram-worthy spots",
        "Meet local artists",
        "2-hour experience"
      ],
      source_url: "https://theskint.com"
    },
    {
      name: "Free Jazz in the Park",
      category: "music",
      date: "Friday Evening",
      time: "7:00 PM - 9:00 PM",
      location: "Central Park",
      address: "Rumsey Playfield, Central Park",
      price: "free",
      spots: 200,
      image: "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800&q=80",
      description: "Enjoy an evening of smooth jazz under the stars. Bring a blanket and experience world-class musicians in an iconic setting.",
      highlights: [
        "Live jazz quartet",
        "Beautiful outdoor setting",
        "Bring your own picnic",
        "Family friendly"
      ],
      source_url: "https://www.timeout.com/newyork"
    },
    {
      name: "Dumbo Food Market",
      category: "culinary",
      date: "Sunday",
      time: "11:00 AM - 6:00 PM",
      location: "DUMBO, Brooklyn",
      address: "Pearl Plaza, Brooklyn, NY",
      price: "free",
      spots: 300,
      image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80",
      description: "Sample artisanal foods from local vendors. From farm-fresh produce to gourmet treats, discover Brooklyn's culinary scene.",
      highlights: [
        "50+ food vendors",
        "Live cooking demos",
        "Free samples available",
        "Waterfront location"
      ],
      source_url: "https://theskint.com"
    }
  ];

  return fallbackEvents;
}

// Main scraping function
export async function scrapeAllEvents() {
  console.log('Starting event scraping...');

  try {
    const [skintEvents, timeoutEvents] = await Promise.all([
      scrapeTheSkint(),
      scrapeTimeOut()
    ]);

    let allEvents = [...skintEvents, ...timeoutEvents];

    // If scraping didn't return enough events, add fallbacks
    if (allEvents.length < 5) {
      console.log('Using fallback events');
      allEvents = [...allEvents, ...generateFallbackEvents()];
    }

    // Deduplicate by name
    const uniqueEvents = [];
    const seen = new Set();

    for (const event of allEvents) {
      if (!seen.has(event.name)) {
        seen.add(event.name);
        uniqueEvents.push(event);
      }
    }

    console.log(`Scraped ${uniqueEvents.length} unique events`);
    return uniqueEvents.slice(0, 15); // Return max 15 events
  } catch (error) {
    console.error('Scraping error:', error);
    return generateFallbackEvents();
  }
}

// Test scraper (can be called directly)
export async function testScraper() {
  const events = await scrapeAllEvents();
  console.log('Test results:', JSON.stringify(events, null, 2));
  return events;
}
