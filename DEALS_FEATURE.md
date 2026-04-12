# Daily Deals Feature

A tasteful integration for displaying drink and food deals on events without adding visual weight to the UI.

## Database Schema

The `deals` column has been added to the events table as a JSONB field:

```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS deals JSONB;
```

## Data Structure

Deals are stored as a JSON array with each deal containing a `day` and `offer`:

```json
{
  "deals": [
    {
      "day": "Monday",
      "offer": "$5 pints, all day"
    },
    {
      "day": "Tuesday",
      "offer": "2-for-1 cocktails, 5-8pm"
    },
    {
      "day": "Wednesday",
      "offer": "$1 oysters, 4-7pm"
    }
  ]
}
```

## UI Integration

### Event Cards
Events with deals display a subtle "Daily Deals" badge in the footer alongside the "Free" badge (if applicable). The badge uses the same gold accent color (#D4AF37) as the site's premium elements.

### Event Modal
When users open an event with deals, the "Daily Specials" section appears between the highlights and the CTA button. Deals are displayed in a responsive grid where:
- Mobile: 2-3 deals per row (140px minimum width)
- Desktop: 3-4 deals per row (160px minimum width)

Each deal card shows:
- **Day** in uppercase, small, bold gold text
- **Offer** in readable secondary text

The section has a subtle gold-tinted background that complements the existing design system.

## Adding Deals to Events

### Via SQL
```sql
UPDATE events
SET deals = '[
  {"day": "Monday", "offer": "$5 pints, all day"},
  {"day": "Wednesday", "offer": "$1 oysters, 4-7pm"}
]'::jsonb
WHERE id = 123;
```

### Via Scraper
When scraping events, include the deals field:

```javascript
const eventData = {
  name: "Local Bar",
  category: "perks",
  location: "East Village",
  deals: [
    { day: "Monday", offer: "$5 pints, all day" },
    { day: "Tuesday", offer: "2-for-1 cocktails, 5-8pm" }
  ]
  // ... other fields
};
```

## Design Philosophy

This feature follows the site's design principle of **information density without visual clutter**:

- ✅ Deals are only shown when they exist (no empty states)
- ✅ Card indicator is subtle and non-intrusive
- ✅ Modal section uses familiar styling patterns from highlights
- ✅ Color palette stays consistent (gold for premium/special features)
- ✅ Responsive grid adapts to screen size
- ✅ Hover states provide tactile feedback
- ✅ No additional navigation or filters needed

## Example Use Cases

- **Bars & Restaurants**: Daily happy hour specials, food deals
- **Coffee Shops**: Weekday student discounts, weekend brunch specials
- **Venues**: Member pricing by day, early bird rates
- **Markets**: Vendor-specific deals on certain days
