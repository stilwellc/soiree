# Soiree Event Scraper - Session Summary

## Date: February 7, 2026

### Objectives Completed ✅

1. **Added "The Local Girl" Data Source**
   - Created direct scraping script (`scripts/scrape-localgirl-direct.js`)
   - Bypassed Vercel IP blocking by running scraper in GitHub Actions
   - Successfully scraping 102+ Hoboken/Jersey City events

2. **Fixed Critical Timezone Bugs**
   - **Root Cause:** `new Date().toISOString()` returns UTC time, not local time
   - **Impact:** "Today" filter showed wrong day (Feb 8 UTC vs Feb 7 EST)
   - **Solution:** Created centralized date utilities using local timezone

3. **Unified Database Configuration**
   - Consolidated all environments to use `shiny-hill-98324130` database
   - Updated: `.env.local`, Vercel env vars, GitHub Secrets

4. **Enabled Hoboken/Jersey City Region**
   - Added region filtering logic to frontend
   - Events now properly separated by location (NYC vs Hoboken/JC)

5. **Removed Technical Debt**
   - Centralized date handling with `utils/dateHelpers.js`
   - Refactored duplicate code in `matchesTimeFilter` and `formatBadgeDate`
   - Added comprehensive workflow documentation

---

## Architecture Overview

### Data Flow
```
GitHub Actions (Daily)
  ├─> Scrape via Vercel API (/api/scrape)
  │   ├─> NYC For Free
  │   ├─> MoMA
  │   ├─> Guggenheim
  │   └─> Other sources
  │
  └─> Direct Scraping Scripts
      └─> The Local Girl (bypasses Vercel IP block)

All scrapers write to:
  PostgreSQL (Neon - shiny-hill-98324130)

Frontend fetches from:
  Vercel API (/api/events)
    └─> Filters by: start_date >= (CURRENT_DATE - 1 day)
        (Accounts for EST/UTC timezone difference)
```

### Key Files

**Scrapers:**
- `api/scrape.js` - Main scraper (runs on Vercel)
- `scripts/scrape-localgirl-direct.js` - Direct scraper for The Local Girl

**API:**
- `api/events.js` - Returns events with timezone-adjusted date filter
- `api/lib/dateParser.js` - Parses various date formats
- `api/lib/normalize.js` - Normalizes event data

**Frontend:**
- `app.js` - Main application logic
- `utils/dateHelpers.js` - Centralized date utilities

**Workflows:**
- `.github/workflows/daily-scrape.yml` - Daily scraper automation
- `.agent/workflows/add-data-source.md` - Guide for adding new sources

---

## Critical Fixes Applied

### 1. Timezone Handling (MOST IMPORTANT)

**Problem:**
```javascript
// WRONG - Uses UTC time
const today = new Date().toISOString().split('T')[0];
// Returns "2026-02-08" when it's Feb 7 in EST
```

**Solution:**
```javascript
// CORRECT - Uses local timezone
function getTodayLocal() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
// Returns "2026-02-07" when it's Feb 7 in EST
```

**Impact:**
- "Today" filter now shows correct events
- Date badges display correct day
- "This Week" filter works properly

### 2. API Date Filter

**Updated Query:**
```sql
-- Old (showed no events after midnight UTC)
WHERE start_date >= CURRENT_DATE

-- New (accounts for timezone difference)
WHERE start_date >= (CURRENT_DATE - INTERVAL '1 day')
```

### 3. Region Filtering

**Added Logic:**
```javascript
if (currentRegion === 'hoboken-jc') {
  matchesRegion = location.includes('hoboken') || location.includes('jersey city');
} else if (currentRegion === 'nyc') {
  matchesRegion = !location.includes('hoboken') && !location.includes('jersey city');
}
```

---

## Database Schema

```sql
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  date VARCHAR(100),
  time VARCHAR(100),
  location VARCHAR(255) NOT NULL,
  address VARCHAR(500),
  price VARCHAR(50) DEFAULT 'free',
  spots INTEGER DEFAULT 0,
  image TEXT,
  description TEXT,
  highlights JSONB,
  url VARCHAR(500),
  start_date DATE,           -- Parsed date (no timezone)
  end_date DATE,             -- For multi-day events
  scraped_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  source VARCHAR(100)        -- e.g., "The Local Girl", "NYC For Free"
);
```

---

## Current Event Counts

**Total Events in Database:** ~183
- NYC For Free: 50
- The Local Girl: 102
- MoMA: 15
- Guggenheim: 15
- New Museum: 1
- Whitney Museum: 1

**Future Events (visible on site):** ~33
- NYC For Free: 18
- The Local Girl: 14
- New Museum: 1

---

## Environment Variables

### Required in All Environments

**Vercel:**
```
POSTGRES_URL=postgresql://neondb_owner:npg_gdycBt43Hhnz@ep-rough-band-aio9golj-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require
SCRAPE_SECRET=soiree-scrape-secret-2024
```

**GitHub Secrets:**
```
POSTGRES_URL=postgresql://neondb_owner:npg_gdycBt43Hhnz@ep-rough-band-aio9golj-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require
SCRAPE_SECRET=soiree-scrape-secret-2024
```

**Local (.env.local):**
```
POSTGRES_URL="postgresql://neondb_owner:npg_gdycBt43Hhnz@ep-rough-band-aio9golj-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
SCRAPE_SECRET="soiree-scrape-secret-2024"
```

---

## Best Practices Established

### 1. Date Handling
- ✅ Always use `getTodayLocal()` for current date
- ✅ Always use `extractDateFromISO()` to parse API dates
- ✅ Never use `toISOString()` for local date comparisons
- ✅ Use `formatDateLocal(date)` for Date object → string conversion

### 2. Adding New Data Sources
- ✅ Follow `.agent/workflows/add-data-source.md`
- ✅ Test locally before deploying
- ✅ Use direct scripts if Vercel IP is blocked
- ✅ Ensure `start_date` is properly parsed

### 3. Region Filtering
- ✅ Check location AND address fields
- ✅ Use case-insensitive matching
- ✅ Apply filter in both `renderEvents` and `updateFilterCounts`

---

## Known Limitations

1. **Timezone Assumption:** Code assumes EST/EDT timezone. May need adjustment for other timezones.
2. **Date Parsing:** Some event sources have inconsistent date formats. Parser may fail on edge cases.
3. **IP Blocking:** Some websites block Vercel IPs. Requires direct scraping via GitHub Actions.

---

## Future Improvements

1. **Add More Data Sources:**
   - Follow the workflow in `.agent/workflows/add-data-source.md`
   - Consider: Brooklyn Vegan, Eventbrite, Meetup

2. **Improve Date Parsing:**
   - Handle more date formats
   - Extract time information more reliably

3. **Add User Features:**
   - Save favorites to database (currently localStorage only)
   - Email notifications for new events
   - Calendar export (iCal format)

4. **Performance:**
   - Add caching layer (Redis)
   - Implement pagination for large result sets

---

## Testing Checklist

- [x] NYC region shows NYC events only
- [x] Hoboken/JC region shows Hoboken events only
- [x] "Today" filter shows events for current day (local timezone)
- [x] "This Week" filter shows events through Sunday
- [x] Date badges display "Today", "Tomorrow", or formatted date
- [x] Filter counts match displayed events
- [x] API returns events with start_date >= yesterday (accounts for timezone)
- [x] Daily scraper runs successfully in GitHub Actions

---

## Deployment

**Live Site:** https://soiree-one.vercel.app

**Deployment Process:**
1. Push to `main` branch
2. Vercel auto-deploys (~2 minutes)
3. Hard refresh browser to see changes (Cmd+Shift+R)

**Manual Scraper Trigger:**
1. Go to: https://github.com/stilwellc/soiree/actions/workflows/daily-scrape.yml
2. Click "Run workflow"
3. Wait ~5 minutes for completion

---

## Contact & Maintenance

**Repository:** https://github.com/stilwellc/soiree

**Key Commands:**
```bash
# Run scraper locally
node scripts/scrape-localgirl-direct.js

# Verify database
node scripts/verify-db-sources.js

# Test API locally
vercel dev
```

**Troubleshooting:**
- If events disappear: Check `POSTGRES_URL` in Vercel env vars
- If "Today" shows wrong events: Check timezone handling in `app.js`
- If scraper fails: Check GitHub Actions logs for errors
