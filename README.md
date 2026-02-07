# Soirée - Curated Pop-Up Events

A full-stack web application for discovering curated pop-up events in New York City. Automated daily web scraping feeds a PostgreSQL database, served through Vercel serverless functions to a zero-dependency vanilla JavaScript frontend.

**Live URL**: https://soiree-one.vercel.app

---

## Architecture Guide (for AI Tools & Contributors)

This section is a complete reference for understanding the codebase, database, deployment, and data flow. If you're an AI tool or new contributor, read this first.

### How the System Works (End to End)

1. **Daily at 6 AM UTC**, a Vercel cron job (and backup GitHub Action at 6 AM EST) triggers `POST /api/scrape`
2. The scraper clears the existing events table and fetches fresh data from **8 NYC event sources** in parallel using `Promise.all`
3. Scraped HTML is parsed with **cheerio**, events are categorized via regex rules, and dates are normalized
4. Detail pages are fetched in batches of 10 (via `Promise.allSettled`) for richer descriptions
5. Deduplicated events are inserted into **PostgreSQL** (Neon) with `ON CONFLICT (url) DO NOTHING`
6. The frontend calls `GET /api/events` on load, which returns only future events (`start_date >= CURRENT_DATE`)
7. All filtering (category, time, search) happens client-side in `app.js`

### Project Structure

```
soiree/
├── api/                          # Vercel serverless functions (Node.js)
│   ├── lib/
│   │   └── dateParser.js         # Date parsing: relative, absolute, ranges
│   ├── scrape.js                 # POST /api/scrape - Main scraping engine (~1200 lines)
│   ├── events.js                 # GET /api/events - Fetch events from DB
│   ├── stats.js                  # GET/POST /api/stats - Page view analytics
│   ├── refresh.js                # POST /api/refresh - Clear all events
│   ├── og.js                     # GET /api/og - Open Graph SVG image
│   └── test.js                   # GET /api/test - Health check
├── .github/workflows/
│   └── daily-scrape.yml          # GitHub Actions backup cron (6 AM EST)
├── index.html                    # HTML structure, nav, modal, meta tags
├── app.js                        # All frontend logic (~1224 lines)
├── styles.css                    # All styling & animations (~1759 lines)
├── schema.sql                    # Database schema (reference only)
├── vercel.json                   # Cron config + function timeout
├── package.json                  # 3 runtime deps: axios, cheerio, pg
├── .env.example                  # Required environment variables
├── DEPLOYMENT.md                 # Deployment instructions
└── SETUP-HOBBY.md                # Free tier setup guide
```

### Database (PostgreSQL via Neon)

The database is a single `events` table. The connection uses the `pg` library with `POSTGRES_URL` from the environment.

**Schema** (also auto-created by `events.js` and `scrape.js` on first request):

```sql
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,       -- art, music, culinary, fashion, lifestyle, community, perks
  date VARCHAR(100) NOT NULL,          -- Display string: "Feb 24", "This Weekend"
  time VARCHAR(100) NOT NULL,          -- Display string: "7:00 PM - 9:00 PM"
  location VARCHAR(255) NOT NULL,      -- Venue/neighborhood name
  address VARCHAR(500),                -- Full street address
  price VARCHAR(50) DEFAULT 'free',
  spots INTEGER DEFAULT 0,
  image TEXT,                          -- Unsplash URL (selected by category + title hash)
  description TEXT,
  highlights JSONB,                    -- Array of highlight strings
  url VARCHAR(500),                    -- Source event URL (UNIQUE constraint)
  start_date DATE,                     -- Parsed start date (used for filtering)
  end_date DATE,                       -- Parsed end date
  scraped_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes**: `idx_events_category`, `idx_events_date`, `idx_events_start_date`

**Key behaviors**:
- `events.js` auto-creates the table and adds missing columns on every request (safe migrations)
- `scrape.js` drops all rows (`DELETE FROM events`) before each scrape run (fresh data daily)
- Only future events are returned: `WHERE start_date >= CURRENT_DATE ORDER BY start_date ASC`
- Duplicate prevention: unique index on `url`, plus `ON CONFLICT (url) DO NOTHING`

### Vercel Deployment

**vercel.json**:
```json
{
  "functions": {
    "api/scrape.js": { "maxDuration": 60 }
  },
  "crons": [
    { "path": "/api/scrape", "schedule": "0 6 * * *" }
  ]
}
```

**Environment variables** (set in Vercel dashboard):
- `POSTGRES_URL` - Neon PostgreSQL connection string
- `SCRAPE_SECRET` - Bearer token for `/api/scrape` authorization

**How deployment works**:
- Push to `main` triggers auto-deploy on Vercel
- Static files (`index.html`, `app.js`, `styles.css`) are served as-is
- Files in `api/` become serverless functions at `/api/<filename>`
- The cron runs daily; GitHub Actions (`daily-scrape.yml`) is a backup that calls the same endpoints

### API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/events` | GET | None | Fetch future events. Optional `?category=music` filter |
| `/api/scrape` | POST | Bearer token | Run full scrape of all 8 sources |
| `/api/stats` | GET | None | Get page view count and event totals |
| `/api/stats` | POST | None | Increment page view counter |
| `/api/refresh` | POST | None | Delete all events from the database |
| `/api/og` | GET | None | Generate Open Graph SVG image |
| `/api/test` | GET | None | Health check, returns `{ message: "API is working!" }` |

**Events response shape**:
```json
{
  "success": true,
  "count": 42,
  "events": [{
    "id": 1,
    "name": "Brooklyn Street Art Walk",
    "category": "art",
    "date": "Feb 24",
    "time": "2:00 PM - 5:00 PM",
    "location": "Bushwick, Brooklyn",
    "address": "Troutman St & Wyckoff Ave, Brooklyn, NY",
    "price": "free",
    "spots": 75,
    "image": "https://images.unsplash.com/...",
    "description": "Explore Bushwick's vibrant street art scene...",
    "highlights": ["Guided tour", "Instagram spots"],
    "url": "https://source-site.com/event",
    "start_date": "2026-02-24",
    "end_date": "2026-02-24",
    "scraped_at": "2026-02-07T06:00:00Z",
    "created_at": "2026-02-07T06:00:00Z"
  }]
}
```

### Scraping Engine (`api/scrape.js`)

This is the largest file (~1200 lines). It contains 8 individual scraper functions that all run in parallel via `Promise.all`:

| Function | Source | Method |
|----------|--------|--------|
| `scrapeTheSkint()` | theskint.com | Parse daily email-style HTML listings |
| `scrapeTimeOut()` | timeout.com/newyork | Parse event listing pages |
| `scrapeNYCForFree()` | nycforfree.co | Parse Squarespace event blocks |
| `scrapeMoMA()` | moma.org/calendar | Parse museum calendar HTML |
| `scrapeWhitney()` | whitney.org/events | Parse museum event listings |
| `scrapeGuggenheim()` | guggenheim.org | Fetch via WordPress REST API (JSON) |
| `scrapeAMNH()` | amnh.org/calendar | Parse natural history museum calendar |
| `scrapeNewMuseum()` | newmuseum.org/calendar | Parse contemporary art museum calendar |

**After scraping, the orchestrator** (`scrapeAllEvents()`):
1. Merges all results into one array
2. Deduplicates by URL
3. Filters out permanent exhibitions
4. Fetches detail pages in batches of 10 for richer descriptions
5. Re-categorizes with full description text
6. Assigns Unsplash images by category (deterministic via title hash)
7. Inserts into PostgreSQL

**Categorization** (`categorizeEvent()`): Uses regex matching on title + description to assign one of 7 categories: `art`, `music`, `culinary`, `fashion`, `lifestyle`, `community`, `perks`. Museum locations default to `art`. Falls back to `community`.

**Date parsing** (`api/lib/dateParser.js`): Handles relative dates ("Today", "Tomorrow"), day names ("Friday"), full dates ("January 15, 2026"), numeric ("1/24"), and ranges ("Jan 24-26"). Returns `{ start_date, end_date }` as Date objects.

**Fallback**: If all scrapers fail, 3 hardcoded fallback events are returned so the app always has content.

### Frontend (`app.js`)

The entire frontend is vanilla JavaScript with no build step. Key state and functions:

**App state** (module-level variables):
- `currentFilter` - Active category filter (`'all'` or a category slug)
- `searchQuery` - Current search input text
- `currentTimeFilter` - `'all'`, `'today'`, or `'week'`
- `favorites` - Array of event IDs (persisted in `localStorage` under key `soireeFavorites`)
- `currentRegion` - Selected region slug
- `detectedRegion` - Auto-detected via browser geolocation

**Key functions**:
- `init()` - Entry point. Detects region, fetches events, sets up listeners
- `fetchEvents()` - Calls `GET /api/events`, stores result, calls `renderEvents()`
- `renderEvents()` - Filters by category + time + search, generates card HTML, inserts into DOM
- `openModal(eventId)` - Shows full event detail in overlay modal
- `toggleFavorite(eventId)` - Adds/removes from localStorage array
- `detectUserRegion()` - Uses `navigator.geolocation` + Haversine distance to find nearest region
- `trackPageView()` - Calls `POST /api/stats` on page load

**Region system**: 4 regions defined (NYC, Hoboken/JC, Jersey Shore, Philadelphia). Only NYC has scraped events; others show a "Coming Soon" message. Region preference is saved in `localStorage`.

**Time filtering logic**:
- "Today": `start_date <= today && end_date >= today`
- "This Week": `start_date <= endOfWeek && end_date >= today`
- "All": `start_date >= today` (handled server-side)

**Search**: Case-insensitive substring match across `name`, `location`, and `description` fields.

### Styling (`styles.css`)

CSS custom properties define the theme:
- Gold accent: `#D4AF37`
- Dark background: `#0A0A0A`
- Cream text: `#FAF8F3`

Layout uses CSS Grid for the event card grid. Animations use `transform` and `opacity` for GPU acceleration. Mobile-first responsive design with breakpoints at standard sizes.

### Dependencies

Only 3 runtime dependencies (in `package.json`):
- `axios` ^1.6.5 - HTTP requests for scraping
- `cheerio` ^1.0.0-rc.12 - HTML parsing (jQuery-like API)
- `pg` ^8.11.3 - PostgreSQL client

Dev dependency: `vercel` ^33.0.1

### Common Tasks

**Add a new scraper source**: Create a new `async function scrapeNewSource()` in `api/scrape.js` following the pattern of existing scrapers. Add it to the `Promise.all` array in `scrapeAllEvents()`. Each scraper should return an array of event objects matching the schema.

**Add a new category**: Add regex rules in `categorizeEvent()`, add image URLs in the `categoryImages` object in `getEventImage()`, and add the category button in `index.html`'s filter section.

**Add a new region**: Add region config in `app.js` (search for the regions array), add a `<div>` in `index.html`'s region selector dropdown.

**Modify the database schema**: Edit the `CREATE TABLE` statement in both `api/events.js` and `api/scrape.js` (both create the table if it doesn't exist). Add `ALTER TABLE ADD COLUMN IF NOT EXISTS` statements for safe migration on existing tables.

### Gotchas & Pitfalls

These are the things most likely to trip you up. Read carefully before making changes.

**1. The schema lives in 3 places (and they differ)**
- `api/events.js` - inline `CREATE TABLE IF NOT EXISTS` (the one that runs on every GET request)
- `api/scrape.js` - its own inline `CREATE TABLE IF NOT EXISTS` (runs on every scrape)
- `schema.sql` - reference file only, **never executed automatically**

These have drifted apart. For example, `schema.sql` has `updated_at` and `source_url` columns but not `url`. `events.js` has `url` but not `updated_at` or `source_url`. If you add a column, you must update **both** `events.js` and `scrape.js` at minimum, and add `ALTER TABLE ADD COLUMN IF NOT EXISTS` statements for safe migration on existing databases.

**2. There is a second table (`stats`) defined only in `stats.js`**
- The `stats` table (`id`, `page_views`, `updated_at`) is created inline in `api/stats.js`
- It is not in `schema.sql` or any other file
- It uses a single-row pattern (always `WHERE id = 1`)

**3. The scraper is destructive by design**
- Every scrape run does `DELETE FROM events` first, then inserts fresh data
- If the scrape fails partway through, the database will have fewer events than before (or none)
- The 3 hardcoded fallback events only activate if **all 8 scrapers return zero results**

**4. Scrapers are fragile - they depend on HTML structure**
- Each scraper uses CSS selectors specific to the source site's current DOM
- If a source site redesigns, that scraper will silently return 0 events (it won't error)
- Always check Vercel function logs after changes to verify scrapers still return data

**5. Each serverless function creates its own database pool**
- There is no shared connection module. Every file (`events.js`, `scrape.js`, `stats.js`, `refresh.js`) creates `new Pool({ connectionString: process.env.POSTGRES_URL })`
- This is fine for Vercel serverless (each invocation is isolated) but means connection config is duplicated

**6. CORS is wide open**
- All API endpoints set `Access-Control-Allow-Origin: *`
- This is intentional (public read-only API) but be aware if adding write endpoints

**7. `/api/refresh` has no authentication**
- Anyone can `POST /api/refresh` and wipe the entire events table
- Only `/api/scrape` requires a Bearer token

**8. The scraper has a 60-second timeout**
- Configured in `vercel.json` for the scrape function
- If adding more sources or heavier processing, it can time out silently
- Vercel free tier limits functions to 10 seconds; the 60-second limit requires a paid plan

**9. Date parsing is timezone-sensitive**
- `dateParser.js` creates `Date` objects using the server's timezone (UTC on Vercel)
- Relative dates like "Today" and "Tomorrow" resolve based on UTC, not Eastern Time
- The frontend compares `start_date` using the browser's local timezone

### Notes on Remaining Legacy Files

| File | Status | Notes |
|------|--------|-------|
| `schema.sql` | Reference only | Not executed by any code. Useful for understanding intent but columns are out of sync with the inline schemas in `events.js` and `scrape.js`. |

### Testing

There is **no automated test suite**. Verification is manual:

- **Health check**: `GET /api/test` returns `{ message: "API is working!" }`
- **Scraper test**: `POST /api/scrape` with Bearer token, check response for `inserted` count > 0
- **Events test**: `GET /api/events` should return `count` > 0 with valid event objects
- **Frontend test**: Open the app in a browser, verify cards render, search works, favorites persist
- **Scraper logs**: Check Vercel function logs for individual scraper output and error counts

### Do's and Don'ts

**Do:**
- Keep the frontend as vanilla JS with zero npm dependencies - this is a core design choice
- Return an empty array (not throw) when a scraper fails - individual scraper failures should be silent
- Use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS` for schema changes - the DB must self-heal
- Test scraper changes against the live source sites - HTML structure changes frequently
- Keep each scraper function self-contained with its own try/catch returning `[]` on failure
- Match the event object shape exactly when adding new scrapers (see the schema section above)

**Don't:**
- Don't treat `schema.sql` as the source of truth - the real schemas are inline in `events.js` and `scrape.js`
- Don't add authentication to read endpoints (`/api/events`, `/api/stats`) - the API is intentionally public
- Don't make the scrape incremental (upsert instead of delete-all) without careful thought - the current delete-and-reinsert pattern ensures stale events are removed
- Don't add a frontend build step (webpack, vite, etc.) - the app ships raw files
- Don't add new npm dependencies to the frontend - everything client-side is vanilla JS
- Don't increase the scrape batch size beyond 10 without testing - source sites may rate-limit
- Don't assume `schema.sql` columns match the actual database - always check the inline `CREATE TABLE` in the API files

---

## Local Development

### Prerequisites
- Node.js 18+
- Vercel account with linked Postgres database (Neon free tier works)

### Setup

```bash
git clone https://github.com/stilwellc/soiree.git
cd soiree
npm install
npx vercel link
npx vercel env pull
npx vercel dev
```

Visit `http://localhost:3000`

### Testing the Scraper

```bash
# In a separate terminal while dev server is running:
curl -X POST http://localhost:3000/api/scrape \
  -H "Authorization: Bearer soiree-scrape-secret-2024"
```

## API Endpoints (Quick Reference)

```bash
# Get all events
curl https://soiree-one.vercel.app/api/events

# Get events by category
curl https://soiree-one.vercel.app/api/events?category=music

# Trigger scrape (requires auth)
curl -X POST https://soiree-one.vercel.app/api/scrape \
  -H "Authorization: Bearer YOUR_SECRET"

# Health check
curl https://soiree-one.vercel.app/api/test
```

## Data Flow

```
 Cron (6AM UTC)                    User Browser
      |                                 |
      v                                 v
 POST /api/scrape              GET /api/events
      |                                 |
      v                                 v
 8 scrapers (parallel)         PostgreSQL query
      |                        (future events only)
      v                                 |
 Parse HTML (cheerio)                   v
 Categorize (regex)            JSON response
 Parse dates                           |
 Fetch detail pages                    v
 Assign images                 app.js renders cards
      |                        (filter/search/favorites
      v                         all happen client-side)
 INSERT into PostgreSQL
```

## Credits

- Design and Development: Built with Claude Code
- Images: Unsplash
- Fonts: Google Fonts (Cormorant Garamond, Jost)

---

Made with ✨ in New York City
