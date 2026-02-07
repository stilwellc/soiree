---
description: How to add a new event data source to the scraper
---

# Adding a New Event Data Source

Follow these steps to add a new event scraping source to the Soiree application.

## Step 1: Determine Scraping Strategy

First, test if the target website can be scraped:

1. **Check if accessible from Vercel:**
   - Try fetching the URL from `api/scrape.js` 
   - If you get a 403/blocking error, you'll need the "Direct Script" approach (Step 3)

2. **Inspect the HTML structure:**
   - Create a test script in `scripts/inspect-[source-name].js`
   - Use `axios` + `cheerio` to fetch and parse
   - Identify selectors for: title, date, time, location, description, image, URL

## Step 2: Add Scraper Function to api/scrape.js

Add a new scraper function following this pattern:

```javascript
async function scrape[SourceName]() {
  try {
    console.log('Fetching events from [Source Name]...');
    const response = await axios.get('https://example.com/events', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive'
      }
    });

    const $ = cheerio.load(response.data);
    const events = [];

    // Parse events from HTML
    $('.event-item').each((i, elem) => {
      const name = $(elem).find('.title').text().trim();
      const dateText = $(elem).find('.date').text().trim();
      const location = $(elem).find('.location').text().trim();
      const url = $(elem).find('a').attr('href');
      
      // Parse date using parseDateText helper
      const { start_date, end_date } = parseDateText(dateText, '');
      
      // Determine category
      const category = categorizeEvent(name, '', location);
      
      // Create normalized event
      const event = createNormalizedEvent({
        name,
        category,
        date: dateText,
        time: 'See details',
        start_date,
        end_date,
        location,
        address: location,
        price: 'See details',
        spots: Math.floor(Math.random() * 100) + 20,
        image: getEventImage(name, category),
        description: `Event in ${location}: ${name}`,
        highlights: ['Local event'],
        url,
        source: '[Source Name]'
      });
      
      if (event) events.push(event);
    });

    console.log(`Scraped ${events.length} events from [Source Name]`);
    return events;
  } catch (error) {
    console.error('[Source Name] scraping failed:', error.message);
    return [];
  }
}
```

## Step 3: Add to scrapeAllEvents Function

In `api/scrape.js`, add your scraper to the `scrapeAllEvents` function:

```javascript
async function scrapeAllEvents() {
  console.log('Starting multi-source scraping...');
  
  const [
    timeoutEvents,
    nycFreeEvents,
    // ... other scrapers ...
    sourceNameEvents  // Add your new scraper here
  ] = await Promise.allSettled([
    scrapeTimeOutNY(),
    scrapeNYCForFree(),
    // ... other scrapers ...
    scrape[SourceName]()  // Add your function call
  ]);

  const merged = [
    ...(timeoutEvents.value || []),
    ...(nycFreeEvents.value || []),
    // ... other results ...
    ...(sourceNameEvents.value || [])  // Add to merged array
  ];
  
  // ... rest of function
}
```

## Step 4: If Vercel Blocks the Source (403 Error)

If the website blocks Vercel's IP, create a direct scraping script:

1. **Create `scripts/scrape-[source-name]-direct.js`:**

```javascript
const axios = require('axios');
const cheerio = require('cheerio');
const { Pool } = require('pg');
const { parseDateText } = require('../api/lib/dateParser.js');
const { createNormalizedEvent } = require('../api/lib/normalize.js');
require('dotenv').config({ path: '.env.local' });

// Ensure we have DB connection
if (!process.env.POSTGRES_URL) {
  console.error('Error: POSTGRES_URL environment variable is required.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Copy helper functions from api/scrape.js
function categorizeEvent(title, description, location) {
  const text = (title + ' ' + (description || '')).toLowerCase();
  if (text.includes('music') || text.includes('concert')) return 'music';
  if (text.includes('art') || text.includes('gallery')) return 'art';
  if (text.includes('food') || text.includes('dinner')) return 'culinary';
  return 'community';
}

function getEventImage(title, category) {
  return `https://source.unsplash.com/featured/?${category},event`;
}

// Main scraper function (copy from Step 2)
async function scrape[SourceName]() {
  // ... same as Step 2 ...
}

// Database insertion
async function run() {
  try {
    const events = await scrape[SourceName]();
    console.log(`Found ${events.length} events.`);

    if (events.length > 0) {
      console.log('Inserting/Updating events in database...');
      let inserted = 0;
      
      for (const event of events) {
        const { rows } = await pool.query(
          'SELECT id FROM events WHERE url = $1',
          [event.url]
        );
        
        if (rows.length === 0) {
          await pool.query(
            `INSERT INTO events 
            (name, category, date, time, start_date, end_date, location, address, 
             price, spots, image, description, highlights, url, source)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
              event.name, event.category, event.date, event.time, 
              event.start_date, event.end_date, event.location, event.address,
              event.price, event.spots, event.image, event.description,
              JSON.stringify(event.highlights), event.url, event.source
            ]
          );
          inserted++;
        }
      }
      
      console.log(`Inserted ${inserted} new events from [Source Name].`);
    }
  } catch (err) {
    console.error('Script failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
```

2. **Add to GitHub Actions workflow** (`.github/workflows/daily-scrape.yml`):

```yaml
      - name: Scrape [Source Name] (Direct)
        env:
          POSTGRES_URL: ${{ secrets.POSTGRES_URL }}
        run: |
          echo "🌐 Scraping [Source Name] (Direct Node Script)..."
          npm install axios cheerio pg dotenv
          node scripts/scrape-[source-name]-direct.js
```

## Step 5: Update Frontend Region Filtering (if needed)

If the new source is for a specific region (not NYC), update `app.js`:

1. **Ensure region is enabled** in `renderEvents()`:
   ```javascript
   if (currentRegion && currentRegion !== 'nyc' && currentRegion !== 'hoboken-jc') {
   ```

2. **Add location matching logic**:
   ```javascript
   if (currentRegion === 'your-region') {
     const loc = event.location.toLowerCase();
     matchesRegion = loc.includes('your city');
   }
   ```

## Step 6: Test Locally

1. **Test the scraper:**
   ```bash
   node scripts/scrape-[source-name]-direct.js
   ```

2. **Verify database:**
   ```bash
   node scripts/verify-db-sources.js
   ```

3. **Check the API:**
   ```bash
   curl http://localhost:3000/api/events | jq '.events[] | select(.source == "[Source Name]")'
   ```

## Step 7: Deploy

1. **Commit and push:**
   ```bash
   git add .
   git commit -m "feat: Add [Source Name] data source"
   git push origin main
   ```

2. **Verify environment variables:**
   - Ensure `POSTGRES_URL` is set correctly in Vercel
   - Ensure `POSTGRES_URL` is set in GitHub Secrets (if using direct script)

3. **Test the GitHub Action:**
   - Go to Actions tab
   - Run "Daily Event Scraper" manually
   - Check logs for success

## Common Issues

### 403 Forbidden Error
- **Solution:** Use the Direct Script approach (Step 4)
- Add comprehensive browser headers (User-Agent, Accept, etc.)

### Events Not Appearing on Frontend
- **Check:** Are `start_date` values valid and in the future?
- **Check:** Does the location match the region filter in `app.js`?
- **Check:** Is Vercel using the correct `POSTGRES_URL`?

### Date Parsing Issues
- Use `parseDateText()` helper from `api/lib/dateParser.js`
- For complex dates, fetch detail pages to get accurate date info
- Ensure dates are stored as proper DATE types in PostgreSQL

### Duplicate Events
- The scraper checks for existing URLs before inserting
- Make sure each event has a unique, stable URL

## Checklist

- [ ] Scraper function added to `api/scrape.js` OR direct script created
- [ ] Added to `scrapeAllEvents()` function (if not using direct script)
- [ ] Direct script added to GitHub Actions workflow (if needed)
- [ ] Frontend region filtering updated (if needed)
- [ ] Tested locally and verified in database
- [ ] Environment variables configured in Vercel and GitHub
- [ ] Deployed and tested in production
