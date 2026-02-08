# Event Date Extraction - Status and Options

## Current Situation

### Museum Events (MoMA, Guggenheim, etc.)
- **Problem**: Museums block detail page scraping (403 errors)
- **Current state**: Events have placeholder date of Feb 15, 2026
- **Why**: Museums use aggressive anti-scraping measures

### The Local Girl Events  
- **Problem**: Some events show "Upcoming" instead of actual dates
- **Current state**: 68 events have placeholder dates
- **Why**: Date extraction from list page is incomplete

## Options for Getting Real Dates

### Option 1: Manual Curation (Recommended for Museums)
**Pros:**
- Most reliable
- Can add recurring event schedules
- Museums often have predictable schedules

**Cons:**
- Requires manual work
- Needs periodic updates

**Implementation:**
Create a `data/museum-schedules.json` file with known recurring events:
```json
{
  "MoMA": {
    "Member Early Hour": {
      "schedule": "daily",
      "time": "9:30-10:30 AM"
    },
    "Family Art Adventures": {
      "schedule": "saturdays",
      "time": "10:15 AM"
    }
  }
}
```

### Option 2: Use Official APIs/Feeds
**Pros:**
- Most accurate
- Officially supported

**Cons:**
- Museums may not have public APIs
- May require API keys/authentication

**Status:**
- MoMA: No public API found
- Guggenheim: Investigating
- Whitney: Investigating

### Option 3: Enhanced Scraping with Delays
**Pros:**
- Automated
- Can get real dates

**Cons:**
- Slow (need delays to avoid blocks)
- May still get blocked
- Fragile (breaks when sites change)

**Implementation:**
- Add 2-5 second delays between requests
- Rotate user agents
- Use residential proxies (costs money)

### Option 4: Accept Approximate Dates
**Pros:**
- Simple
- No maintenance

**Cons:**
- Less accurate
- Users see "Upcoming" or approximate dates

**Current approach:** Using this for now

## Recommendation

**For Museums:**
Use Option 1 (Manual Curation) for popular recurring events, Option 4 for one-time events.

**For The Local Girl:**
Enhance the scraper to fetch detail pages (they don't block us).

## Next Steps

1. ✅ Created backfill script for placeholder dates
2. ⏳ Enhance Local Girl scraper to fetch detail pages
3. ⏳ Create museum schedules JSON for recurring events
4. ⏳ Update scrapers to use schedules

Would you like me to:
A) Enhance The Local Girl scraper to get real dates from detail pages?
B) Create a manual schedule file for popular museum events?
C) Both?
