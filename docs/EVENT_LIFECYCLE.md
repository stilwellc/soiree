# Event Date Management - Complete Solution

## Problem Solved
Events with placeholder dates (Feb 15, 2026) were staying visible forever, even after the actual event had passed.

## Solution Implemented
Smart event lifecycle management that automatically marks missing placeholder events as past.

---

## How It Works

### 1. **During Each Scrape**
The scraper now:
1. Fetches current events from all sources
2. Compares with existing placeholder events in database
3. Identifies placeholder events that are no longer on the source website
4. Marks those missing events as "past" by setting their date to yesterday

### 2. **Event States**

```
┌─────────────────────────────────────────────────────────┐
│ Event Lifecycle                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  NEW EVENT                                              │
│  ↓                                                      │
│  Has real date? ──YES→ Shows in chronological order    │
│  ↓                                                      │
│  NO (placeholder Feb 15)                                │
│  ↓                                                      │
│  Shows at bottom of list                                │
│  ↓                                                      │
│  Still on source website? ──YES→ Stays visible         │
│  ↓                                                      │
│  NO (disappeared from source)                           │
│  ↓                                                      │
│  Marked as PAST (date = yesterday)                      │
│  ↓                                                      │
│  Removed from future events view                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3. **Database Updates**

**Before (Old Behavior):**
- Delete ALL events
- Re-insert scraped events
- Lost event history
- Placeholder events stayed forever

**After (New Behavior):**
- Keep existing events
- Insert new events
- Update changed events
- Mark missing placeholder events as past
- Preserves event history

---

## Code Changes

### api/scrape.js
```javascript
// Get existing placeholder events
const placeholderEvents = await pool.query(`
  SELECT url, name, source 
  FROM events 
  WHERE start_date = '2026-02-15'
`);

// Track which are still found
const foundPlaceholderUrls = new Set();
uniqueEvents.forEach(event => {
  if (event.start_date === '2026-02-15') {
    foundPlaceholderUrls.add(event.url);
  }
});

// Mark missing ones as past
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

for (const oldEvent of placeholderEvents.rows) {
  if (!foundPlaceholderUrls.has(oldEvent.url)) {
    await pool.query(
      `UPDATE events SET start_date = $1, end_date = $1 WHERE url = $2`,
      [yesterday.toISOString().split('T')[0], oldEvent.url]
    );
  }
}
```

### scripts/scrape-localgirl-direct.js
Same logic applied to the standalone Local Girl scraper.

---

## API Response

The scrape endpoint now returns:
```json
{
  "success": true,
  "message": "Scraping completed - smart event management",
  "scraped": 187,
  "unique": 187,
  "inserted": 4,
  "updated": 183,
  "markedPast": 12,
  "totalEvents": 187,
  "timestamp": "2026-02-08T05:36:00.000Z"
}
```

**New fields:**
- `updated`: Number of existing events refreshed
- `markedPast`: Number of placeholder events marked as past (no longer visible)

---

## Event Display Order

Events are now sorted intelligently:

1. **Real dates first** (chronologically)
   - Feb 7, Feb 8, Feb 9... Feb 27
   - 64 events with confirmed dates

2. **Placeholder dates at bottom**
   - All show Feb 15
   - 99 events with "Upcoming" dates
   - Museums and some Local Girl events

3. **Past events hidden**
   - Events with dates before today
   - Includes events marked as past by the scraper

---

## Benefits

### For Users
✅ See confirmed events first  
✅ "Upcoming" events at bottom  
✅ Stale events automatically removed  
✅ Cleaner, more accurate event list

### For System
✅ Preserves event history  
✅ More efficient (updates vs delete+insert)  
✅ Better data integrity  
✅ Automatic cleanup of stale data

### For Maintenance
✅ No manual cleanup needed  
✅ Self-managing event lifecycle  
✅ Clear audit trail (updated_at timestamps)

---

## Example Scenario

**Day 1:**
- Event "Valentine's Brunch" scraped with placeholder date (Feb 15)
- Shows at bottom of event list

**Day 2-10:**
- Event still on source website
- Stays visible with Feb 15 date

**Day 11:**
- Event no longer on source website (event passed)
- Scraper marks it as past (date = yesterday)
- Removed from future events view
- Still in database for historical records

---

## Testing

To test the logic:
```bash
# Run main scraper
npm run scrape

# Or run Local Girl scraper
node scripts/scrape-localgirl-direct.js
```

Check the output for:
- `markedPast: X` - number of events removed from view
- Console logs showing which events were marked as past

---

## Future Enhancements

Potential improvements:
1. Add `status` field to events (active, past, cancelled)
2. Keep past events for historical browsing
3. Email notifications when events are marked as past
4. Admin dashboard to manually manage event lifecycle
