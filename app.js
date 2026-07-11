// Configuration
const API_BASE_URL = window.location.origin;
const USE_API = true; // Set to false to use fallback data

// ============================================================================
// SECURITY — HTML escaping for scraped/user data
// ============================================================================
// Every scraped field (from 65 sources) that lands in an innerHTML template
// MUST be wrapped in esc(). Prevents stored XSS via event name/location/
// address/source/highlights/description/deals.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ============================================================================
// DATE UTILITIES - Consistent timezone handling
// ============================================================================
// IMPORTANT: Always use these helpers to avoid UTC/local timezone bugs

function getTodayLocal() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function getTomorrowLocal() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
}

function formatDateLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function extractDateFromISO(isoString) {
  return isoString.split('T')[0];
}

function getEndOfWeekLocal() {
  const today = new Date();
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
  return formatDateLocal(endOfWeek);
}
// ============================================================================

// Event Data (fallback if API fails)
let events = [
  {
    id: 1,
    name: "Immersive Gallery Opening",
    category: "art",
    date: "Tonight",
    time: "7:00 PM - 11:00 PM",
    location: "Chelsea Arts District",
    address: "541 W 25th St, New York, NY",
    price: "free",
    spots: 150,
    image: "https://images.unsplash.com/photo-1531243269054-5ebf6f34081e?w=800&q=80",
    description: "Experience contemporary art in an intimate gallery setting. This exclusive opening features works from emerging artists pushing the boundaries of modern expression.",
    highlights: [
      "Featured works from 8 emerging artists",
      "Curated wine tasting from local vineyards",
      "Live ambient music performance",
      "Meet the artists Q&A session at 8:30 PM"
    ]
  },
  {
    id: 2,
    name: "Rooftop Jazz Session",
    category: "community",
    date: "Tomorrow",
    time: "6:30 PM - 10:00 PM",
    location: "Williamsburg",
    address: "90 Kent Ave, Brooklyn, NY",
    price: "free",
    spots: 82,
    image: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800&q=80",
    description: "Enjoy an evening of smooth jazz under the stars. Our resident quartet performs classic and contemporary pieces with the Manhattan skyline as your backdrop.",
    highlights: [
      "Live performance by Brooklyn Jazz Collective",
      "Complimentary welcome cocktail",
      "Panoramic city views",
      "Food trucks on-site"
    ]
  },
  {
    id: 3,
    name: "Chef's Table Pop-Up",
    category: "community",
    date: "Friday",
    time: "8:00 PM - 12:00 AM",
    location: "SoHo",
    address: "112 Spring St, New York, NY",
    price: "free",
    spots: 28,
    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    description: "An intimate 6-course tasting menu from Michelin-trained Chef Marcus Chen. Each dish tells a story, blending classical French techniques with modern Asian flavors.",
    highlights: [
      "6-course progressive tasting menu",
      "Wine pairing available",
      "Interactive chef demonstration",
      "Limited to 28 guests for intimate experience"
    ]
  },
  {
    id: 4,
    name: "Underground Fashion Showcase",
    category: "perks",
    date: "Saturday",
    time: "9:00 PM - 1:00 AM",
    location: "Meatpacking District",
    address: "18 Ninth Ave, New York, NY",
    price: "free",
    spots: 200,
    image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80",
    description: "Discover the next generation of fashion innovators. This underground showcase features bold designs from 12 independent designers redefining streetwear and haute couture.",
    highlights: [
      "12 emerging designers on the runway",
      "DJ set by rising electronic artist",
      "Pop-up shop with exclusive pieces",
      "Cocktails and light bites included"
    ]
  },
  {
    id: 5,
    name: "Sunset Sculpture Garden",
    category: "art",
    date: "Sunday",
    time: "5:00 PM - 9:00 PM",
    location: "Brooklyn Heights",
    address: "334 Furman St, Brooklyn, NY",
    price: "free",
    spots: 120,
    image: "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&q=80",
    description: "Wander through an outdoor exhibition of large-scale sculptures as the sun sets over the harbor. Interactive installations invite you to become part of the art.",
    highlights: [
      "15 large-scale outdoor sculptures",
      "Golden hour photography opportunities",
      "Artist talks at 6:00 PM and 7:30 PM",
      "Light refreshments provided"
    ]
  },
  {
    id: 6,
    name: "Acoustic Songwriters Circle",
    category: "community",
    date: "Monday",
    time: "7:30 PM - 10:30 PM",
    location: "East Village",
    address: "78 E 4th St, New York, NY",
    price: "free",
    spots: 65,
    image: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800&q=80",
    description: "An intimate evening with NYC's finest singer-songwriters. Each artist performs original compositions in a cozy, living room atmosphere.",
    highlights: [
      "6 featured singer-songwriters",
      "Stories behind the songs",
      "Open mic slot for audience members",
      "Craft beer and wine available"
    ]
  },
  {
    id: 7,
    name: "Farm-to-Table Dinner Series",
    category: "community",
    date: "Tuesday",
    time: "7:00 PM - 11:00 PM",
    location: "DUMBO",
    address: "55 Water St, Brooklyn, NY",
    price: "free",
    spots: 40,
    image: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80",
    description: "Celebrate local agriculture with a seasonal menu sourced entirely from Hudson Valley farms. Meet the farmers and learn about sustainable food systems.",
    highlights: [
      "4-course seasonal menu",
      "Meet local farmers and producers",
      "Zero-waste preparation demonstration",
      "Natural wine selection"
    ]
  },
  {
    id: 8,
    name: "Experimental Electronic Showcase",
    category: "community",
    date: "Wednesday",
    time: "10:00 PM - 2:00 AM",
    location: "Bushwick",
    address: "1084 Flushing Ave, Brooklyn, NY",
    price: "free",
    spots: 180,
    image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=80",
    description: "Push the boundaries of sound with experimental electronic artists using modular synthesizers, custom instruments, and generative algorithms.",
    highlights: [
      "4 live electronic performances",
      "Visual projection mapping",
      "Immersive sound system",
      "Late night vibes"
    ]
  },
  {
    id: 9,
    name: "Photography Walk & Talk",
    category: "art",
    date: "Thursday",
    time: "3:00 PM - 6:00 PM",
    location: "Lower East Side",
    address: "Meet at Essex Market",
    price: "free",
    spots: 35,
    image: "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=800&q=80",
    description: "Join acclaimed street photographer Elena Rodriguez for a walking tour focused on capturing the essence of NYC neighborhoods. All skill levels welcome.",
    highlights: [
      "2-hour guided photo walk",
      "Street photography techniques",
      "Portfolio review session",
      "Bring your own camera or phone"
    ]
  },
  {
    id: 10,
    name: "Sustainable Fashion Panel",
    category: "perks",
    date: "Next Friday",
    time: "6:00 PM - 8:30 PM",
    location: "Tribeca",
    address: "45 Harrison St, New York, NY",
    price: "free",
    spots: 90,
    image: "https://images.unsplash.com/photo-1558769132-cb1aea592f0b?w=800&q=80",
    description: "Industry leaders discuss the future of ethical fashion. Learn about sustainable materials, circular design, and how to build a conscious wardrobe.",
    highlights: [
      "Panel with 4 sustainable fashion pioneers",
      "Q&A session",
      "Sustainable fashion marketplace",
      "Networking reception with light bites"
    ]
  },
  {
    id: 11,
    name: "Molecular Mixology Workshop",
    category: "community",
    date: "Next Saturday",
    time: "5:00 PM - 8:00 PM",
    location: "Midtown",
    address: "230 Fifth Ave, New York, NY",
    price: "free",
    spots: 24,
    image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&q=80",
    description: "Learn the science of cocktails with master mixologist James Park. Explore molecular gastronomy techniques to create Instagram-worthy drinks.",
    highlights: [
      "Hands-on cocktail making",
      "Learn 4 signature techniques",
      "Taste 5 innovative cocktails",
      "Take home recipe cards"
    ]
  },
  {
    id: 12,
    name: "World Music Fusion Night",
    category: "community",
    date: "Next Sunday",
    time: "8:00 PM - 12:00 AM",
    location: "Queens",
    address: "37-24 24th St, Long Island City, NY",
    price: "free",
    spots: 150,
    image: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&q=80",
    description: "A celebration of global sounds featuring musicians blending traditional instruments with modern beats. Dance the night away to Afrobeat, cumbia, and more.",
    highlights: [
      "3 live world music acts",
      "Dance floor with pro instruction",
      "Global street food vendors",
      "Cultural exchange and celebration"
    ]
  }
];

// App State
let currentFilter = 'all';
let searchQuery = '';
let currentTimeFilter = 'all'; // 'all', 'today', 'week'
let favorites = JSON.parse(localStorage.getItem('soireeFavorites') || '[]');
let currentPage = 1;
const EVENTS_PER_PAGE = 10;

// Region State
let currentRegion = localStorage.getItem('soireeRegion') || null;
let detectedRegion = null;
let manualRegionOverride = localStorage.getItem('soireeManualRegion') === 'true';
let freeMode = false;

// Unified Gallery State
let galleryFilter = 'art';
let galleryEvents = [];
let stackIndex = 0;
let featuredIndex = 0;
let isSwipeAnimating = false;
const SWIPE_THRESHOLD = 80;

// Art sub-filter: 'openings' or 'all' (list views only)
let artSubFilter = 'openings';

// Region Definitions
const REGIONS = {
  'nyc': { name: 'New York City', shortName: 'NYC', coords: { lat: 40.7128, lng: -74.0060 } },
  'hoboken-jc': { name: 'Hoboken/Jersey City', shortName: 'Hoboken/JC', coords: { lat: 40.7439, lng: -74.0324 } },
  'nj-state': { name: 'New Jersey (All)', shortName: 'NJ', coords: { lat: 40.0583, lng: -74.4057 } },
  'north-nj': { name: 'North NJ', shortName: 'North', coords: { lat: 40.7357, lng: -74.1724 } },
  'central-nj': { name: 'Central NJ', shortName: 'Central', coords: { lat: 40.3573, lng: -74.6672 } },
  'south-nj': { name: 'South NJ', shortName: 'South', coords: { lat: 39.9259, lng: -75.0259 } },
  'jersey-shore': { name: 'Jersey Shore', shortName: 'Shore', coords: { lat: 40.2206, lng: -74.0076 } },
  'philly': { name: 'Philadelphia', shortName: 'Philly', coords: { lat: 39.9526, lng: -75.1652 } }
};

// Data Sources deemed "Always Free" by user definition
const FREE_SOURCES = ['NYC For Free', 'The Local Girl', 'Hoboken Girl', 'The Hoboken Girl'];

// Daily/Weekly Deals by Region
const DEALS_BY_REGION = {
  'nyc': {
    daily: {
      'Monday': ['$1 oysters at Grand Banks, 4-7pm', 'Half-price wine at Dante, all day', '$5 martinis at Temple Bar'],
      'Tuesday': ['2-for-1 tacos at Los Tacos No.1', 'Industry night at The Flower Shop', '$10 burger + beer at The Smith'],
      'Wednesday': ['Wine Wednesday at Terroir - 50% off bottles', '$1 oysters at Maison Premiere', 'Trivia night at The Richardson'],
      'Thursday': ['Ladies night at Le Bain', '$8 cocktails at Please Don\'t Tell', 'Half-price apps at The Mermaid Inn'],
      'Friday': ['Happy hour at Freehold - $5 beers', '$12 margaritas at Tacombi', 'Live music at Rockwood Music Hall'],
      'Saturday': ['Bottomless brunch at Jack\'s Wife Freda - $25', 'DJ brunch at Sunday in Brooklyn', 'Farmers market deals at Union Square'],
      'Sunday': ['Drag brunch at Lips', 'Jazz brunch at Birdland', '$10 bloody mary bar at The Smith', '$15 bottomless mimosas at Cafeteria', 'NFL game day specials at The Ainsworth', 'Live gospel brunch at Sylvia\'s in Harlem', 'Comedy brunch at The Stand']
    },
    weekly: ['Monday: $1 oysters citywide', 'Tuesday: Taco specials', 'Wednesday: Wine night', 'Thursday: Cocktail deals', 'Friday: Happy hours 4-7pm', 'Saturday: Brunch bottomless', 'Sunday: NFL watch parties']
  },
  'hoboken-jc': {
    daily: {
      'Monday': ['$25 unlimited wings all day at Madd Hatter', '$15 unlimited wings all day at 10th & Willow', 'All day HH at 8th St. Tavern - $5 High Lifes, $2 off Big Beers', '50% off oysters + sparkling 4-6pm at Stingray', '$1.50 oysters 4-6pm at Antique Bar + Bakery', '$1.50 oysters all day at Halifax', '4-7pm HH at Onieal\'s', '1-7pm HH at Louise & Jerry\'s', '$21.95 Prime Rib all day at Court Street', '4-6pm Aperitivo at Sorellina', '5-8pm HH at Texas Arizona - $5 drafts/house drinks'],
      'Tuesday': ['$24.99 unlimited tacos all day at Madd Hatter', '$15 unlimited wings 4pm-close at Black Bear', 'Half-price tacos all night at Green Rock', '$7.99 unlimited boneless wings all day at McSwiggan\'s', '4-6pm: 50% off oysters + sparkling at Stingray', '$3 green tea shots all night at Mike\'s Wild Moose', '$2 Miller Lite/$3 Yuengling all day at The Shannon', '8pm Souper Tuesday Trivia at 8th St. Tavern', 'All night HH at Sirenetta - half-price raw bar', '7pm Trivia at Louise & Jerry\'s', '7:30pm Trivia at Farside, The Ale House, McSwiggans, Schmitty\'s', '5-8pm HH at Texas Arizona'],
      'Wednesday': ['All day 99¢ wings at 8th St. Tavern', 'All day half-price Aperol + margaritas at 8th St. Tavern', 'All night $1 beers + $5 bar pies at Green Rock', 'All day 50% off wings at Hoboken Biergarten', '4-6pm: 50% off oysters + sparkling at Stingray', 'All night half-price wine + martinis at The Shannon', '5pm-close: $8 select wines at Onieal\'s', '8pm Trivia at The Shepherd & Knucklehead - $5 beer/wine', '8pm Trivia at Black Bear + Willie McBrides', 'Half-price wine all day at Bin 14'],
      'Thursday': ['All day 99¢ wings at 8th St. Tavern', '$1 beers til 8pm at Green Rock', '8pm start: Half-off High Noons + house drinks at Madd Hatter', '4-6pm: $20 lobster rolls + 50% off beers at Stingray', 'All day $5 margaritas at Black Bear', '8-10pm Power Hour at The Shannon - $5 u-call-it', 'All day Tacos + Tequila at Black Bear - $9 tacos, $6 Modelos', '50% off wings all day at Farside + Psycho Mike\'s', '5-8pm HH at Texas Arizona - $5 drafts'],
      'Friday': ['$1 beers til 10pm at Green Rock', 'Noon-7pm: $3 domestic drafts at Urban Coalhouse', '8-10pm Power Hour at The Shannon - $5 u-call-it', '4-6pm: $10 house cocktails at Stingray', '9pm-2am late night HH at The Lola - $10 cocktails', '10pm-12am late night HH at Sirenetta - $10 cocktails, $8 mules/wine', '4-7pm half-price beer + cocktails at The Ferryman, 10th & Willow, The Shepherd', 'Noon-7pm: $5 High Lifes at 8th St. Tavern', '4-7pm HH at Belo, River Street Garage, Sorellina, Sirenetta'],
      'Saturday': ['8-10pm Power Hour at The Shannon - $5 u-call-it', '$1 wings + $5 pints all day at Green Rock', '3-5pm: $10 house cocktails at Stingray', '11am-3pm: $49 bottomless champagne at Halifax', '11am-3pm: $35 bottomless for 2hrs at Halifax', 'Sat-Sun 11am-4pm: $29 brunch at Bin 14 w/ zeppoles + drink', '11am-4pm: $45 brunch at The Lola', 'Brunch hours: $10 bottomless mimosas at Willie McBride\'s', 'Brunch hours: Bottomless brunch at Farside', 'All day: $15 tequila buckets + $10 mimosa buckets at Fat Taco', '9pm-2am late night HH at The Lola'],
      'Sunday': ['$1 wings + $5 pints all day at Green Rock', '12:30-4pm: 50% off oysters + sparkling at Stingray', '11am-3pm: $49 bottomless champagne at Halifax', 'Sun 11am-4pm: $29 brunch at Bin 14', '11am-4pm: $45 brunch at The Lola', '10am-3:30pm: 2-for-1 brunch cocktails at Dear Maud', 'Brunch hours: $4 mimosas at The Ferryman', 'All day: $10 spritzes at Grand Vin', 'Brunch hours: Jazz brunch at Madison Bar & Grill', '$3 green tea shots all night at Mike\'s Wild Moose', '5-8pm HH at Texas Arizona']
    },
    weekly: ['Monday: Wing nights + oyster specials', 'Tuesday: Taco Tuesday + trivia nights', 'Wednesday: Wine specials + trivia', 'Thursday: Power hours + wing nights', 'Weekend: Bottomless brunch citywide']
  },
  'philly': {
    daily: {
      'Monday': ['$1 oysters at Oyster House', 'Half-price wine at Tria'],
      'Tuesday': ['Taco Tuesday at Lolita', '$5 margaritas at El Vez'],
      'Wednesday': ['Wine Wednesday at Good Dog Bar', 'Trivia at Millcreek Tavern'],
      'Thursday': ['$3 drafts at Monk\'s Café', 'Live music at World Café Live'],
      'Friday': ['Happy hour at Tradesman\'s', 'Fish fry at Abyssinia'],
      'Saturday': ['Brunch at Sabrina\'s Café', 'Reading Terminal Market deals'],
      'Sunday': ['Drag brunch at Tabu', 'Jazz brunch at South']
    },
    weekly: ['Monday: Oyster deals', 'Tuesday: Taco specials', 'Wednesday: Wine night', 'Weekend: Brunch & markets']
  }
};

// DOM Elements
const eventsList = document.getElementById('events-list');
const filterChips = document.querySelectorAll('.filter-chip');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const navItems = document.querySelectorAll('.nav-item');
const modalOverlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');
const favoritesView = document.getElementById('favorites-view');
const discoverView = document.getElementById('discover-view');
const aboutView = document.getElementById('about-view');

// Geolocation Functions
// Haversine distance formula (in km)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate closest region using Haversine distance
function getClosestRegion(lat, lng) {
  let closestRegion = 'nyc';
  let minDistance = Infinity;

  for (const [regionKey, regionData] of Object.entries(REGIONS)) {
    const distance = haversineDistance(
      lat, lng,
      regionData.coords.lat, regionData.coords.lng
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestRegion = regionKey;
    }
  }

  return closestRegion;
}

// Detect user region via geolocation
async function detectUserRegion() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve('nyc'); // Fallback to NYC
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const region = getClosestRegion(latitude, longitude);
        resolve(region);
      },
      (error) => {
        console.warn('Geolocation denied or failed:', error);
        resolve('nyc'); // Fallback to NYC
      },
      { timeout: 5000, enableHighAccuracy: false }
    );
  });
}

// ── Truth pass ──────────────────────────────────────────────────────────────
// Feeds the old UI honest data: past events dropped, duplicates collapsed,
// titles/descriptions cleaned, FREE derived from published price only, and
// the list ordered upcoming-first (tonight → tomorrow → this week → horizon
// → on view) instead of raw scrape order. Rendering stays exactly as it was.
let truthPassApplied = false; // gates favorites pruning to verified data only

function applyTruthPass(rawEvents) {
  if (!window.TruthPass || typeof window.TruthPass.verify !== 'function') {
    return rawEvents;
  }
  try {
    const verified = window.TruthPass.verify(rawEvents, new Date());
    truthPassApplied = true;
    return verified.events.map(e => ({
      ...e,
      name: e.cleanName || e.name,
      // cleanDescription is null when the scrape only had junk/template text —
      // surface nothing rather than "Event in Hoboken: …"
      description: e.cleanDescription || '',
      location: e.location || ''
    }));
  } catch (err) {
    console.error('Truth pass failed, falling back to raw events:', err);
    return rawEvents;
  }
}

// Cache of the first raw /api/events response payload. loadTechStats() and
// the network graph reuse this instead of firing their own duplicate fetch
// (~230KB each) on the About view.
let cachedEventsResponse = null;
async function getEventsResponse() {
  if (cachedEventsResponse) return cachedEventsResponse;
  const response = await fetch(`${API_BASE_URL}/api/events`);
  cachedEventsResponse = await response.json();
  return cachedEventsResponse;
}

// Fetch Events from API
async function fetchEvents() {
  if (!USE_API) {
    return events; // Use fallback data
  }

  try {
    const data = await getEventsResponse();

    if (data.success && data.events && data.events.length > 0) {
      // Ensure all events have required fields
      const mapped = data.events.map(event => ({
        ...event,
        highlights: typeof event.highlights === 'string'
          ? JSON.parse(event.highlights)
          : event.highlights || []
      }));
      // Run the truth pass: drops past events, dedupes, cleans titles and
      // descriptions, derives honest FREE flags, sorts soonest-first
      return applyTruthPass(mapped);
    } else {
      console.warn('No events from API, using fallback');
      return events; // Fallback to hardcoded events
    }
  } catch (error) {
    console.error('Error fetching events:', error);
    return events; // Fallback to hardcoded events
  }
}

// Initialize region on app load
async function initRegion() {
  const savedRegion = localStorage.getItem('soireeRegion');
  const manualOverride = localStorage.getItem('soireeManualRegion') === 'true';

  if (manualOverride && savedRegion) {
    currentRegion = savedRegion;
    manualRegionOverride = true;
  } else {
    detectedRegion = await detectUserRegion();
    currentRegion = detectedRegion;
    localStorage.setItem('soireeRegion', currentRegion);
  }

  // Show detected city in auto-detect option
  const detectedLabel = document.getElementById('region-auto-detected');
  if (detectedLabel && (detectedRegion || currentRegion)) {
    const regionInfo = REGIONS[detectedRegion || currentRegion];
    if (regionInfo) {
      detectedLabel.textContent = `Near ${regionInfo.name}`;
    }
  }

  updateRegionUI();
}

// Update region UI
function updateRegionUI() {
  const regionNameEl = document.getElementById('current-region-name');
  const regionData = REGIONS[currentRegion];
  if (regionNameEl && regionData) {
    regionNameEl.textContent = regionData.shortName;
  }

  // Update header location text
  const locationDiv = document.querySelector('.location');
  if (locationDiv && regionData) {
    locationDiv.textContent = regionData.name;
  }

  // Mark active option in region picker panel + ARIA
  document.querySelectorAll('.region-panel-option').forEach(option => {
    const optionRegion = option.dataset.region;
    let isActive;
    if (optionRegion === 'auto') {
      isActive = !manualRegionOverride;
    } else {
      isActive = optionRegion === currentRegion && manualRegionOverride;
    }
    option.classList.toggle('active', isActive);
    option.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}

// Handle region selection
function handleRegionChange(newRegion) {
  if (newRegion === 'auto') {
    manualRegionOverride = false;
    localStorage.setItem('soireeManualRegion', 'false');
    initRegion();
  } else {
    currentRegion = newRegion;
    manualRegionOverride = true;
    localStorage.setItem('soireeRegion', newRegion);
    localStorage.setItem('soireeManualRegion', 'true');
    updateRegionUI();
    renderEvents();
    updateCategoryCounts();
    updateSalonHero();
  }

  closeRegionDropdown();
}

// Lock/unlock body scroll (iOS-safe)
function lockBodyScroll() {
  const scrollY = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = '100%';
  document.body.style.overflow = 'hidden';
}

function unlockBodyScroll() {
  const scrollY = Math.abs(parseInt(document.body.style.top || '0', 10));
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  document.body.style.overflow = '';
  window.scrollTo(0, scrollY);
}

// Toggle region picker (morphs hero title ↔ city list)
function toggleRegionDropdown() {
  const hero = document.querySelector('.hero');
  const backdrop = document.getElementById('region-backdrop');
  const panel = document.getElementById('hero-region-panel');
  const toggle = document.getElementById('region-toggle');

  if (!hero) return;

  const opening = !hero.classList.contains('hero--picking');
  hero.classList.toggle('hero--picking');
  document.body.classList.toggle('region-picking', opening);
  if (backdrop) backdrop.classList.toggle('active', opening);
  if (panel) panel.setAttribute('aria-hidden', !opening);
  if (toggle) toggle.setAttribute('aria-expanded', opening ? 'true' : 'false');

  if (opening) {
    if (window.innerWidth < 768) lockBodyScroll();
    // Focus active option after animation settles
    setTimeout(() => {
      if (panel) {
        const activeOption = panel.querySelector('.region-panel-option.active')
                          || panel.querySelector('.region-panel-option');
        if (activeOption) activeOption.focus();
      }
    }, 300);
  } else {
    unlockBodyScroll();
    if (toggle) toggle.focus();
  }
}

// Close region picker
function closeRegionDropdown() {
  const hero = document.querySelector('.hero');
  const backdrop = document.getElementById('region-backdrop');
  const panel = document.getElementById('hero-region-panel');
  const toggle = document.getElementById('region-toggle');
  if (!hero) return;
  if (hero.classList.contains('hero--picking')) {
    hero.classList.remove('hero--picking');
    document.body.classList.remove('region-picking');
    if (backdrop) backdrop.classList.remove('active');
    if (panel) panel.setAttribute('aria-hidden', 'true');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    unlockBodyScroll();
  }
}

// Keyboard navigation for region picker
function setupRegionKeyboardNav() {
  const panel = document.getElementById('hero-region-panel');
  if (!panel) return;

  panel.addEventListener('keydown', (e) => {
    const options = Array.from(panel.querySelectorAll('.region-panel-option'));
    const currentFocus = document.activeElement;
    const currentIndex = options.indexOf(currentFocus);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        options[currentIndex < options.length - 1 ? currentIndex + 1 : 0].focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        options[currentIndex > 0 ? currentIndex - 1 : options.length - 1].focus();
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (currentFocus && currentFocus.dataset.region !== undefined) {
          handleRegionChange(currentFocus.dataset.region);
        }
        break;
      case 'Tab':
        if (!e.shiftKey && currentIndex === options.length - 1) {
          e.preventDefault();
          options[0].focus();
        } else if (e.shiftKey && currentIndex === 0) {
          e.preventDefault();
          options[options.length - 1].focus();
        }
        break;
    }
  });
}

// Swipe-to-dismiss for mobile region picker
function setupSwipeToDismiss() {
  const panel = document.getElementById('hero-region-panel');
  if (!panel) return;

  const panelInner = panel.querySelector('.region-panel-inner');
  const handle = panel.querySelector('.region-panel-handle');
  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  function shouldCapture(e) {
    if (window.innerWidth >= 768) return false;
    if (handle && handle.contains(e.target)) return true;
    const list = panel.querySelector('.region-panel-list');
    if (list && list.scrollTop <= 0) return true;
    return false;
  }

  panel.addEventListener('touchstart', (e) => {
    if (!shouldCapture(e)) return;
    startY = e.touches[0].clientY;
    currentY = startY;
    isDragging = true;
  }, { passive: true });

  panel.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;
    if (deltaY > 0 && panelInner) {
      const dampened = deltaY * 0.4;
      panelInner.style.transform = `translateY(${dampened}px)`;
      panelInner.style.opacity = Math.max(0.5, 1 - (deltaY / 500));
    }
  }, { passive: true });

  panel.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    const deltaY = currentY - startY;

    if (panelInner) {
      panelInner.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease';
      panelInner.style.transform = '';
      panelInner.style.opacity = '';
      setTimeout(() => { panelInner.style.transition = ''; }, 300);
    }

    if (deltaY > 80) closeRegionDropdown();
    startY = 0;
    currentY = 0;
  }, { passive: true });
}

// Render coming soon placeholder for non-NYC regions
function renderComingSoon(regionName) {
  eventsList.innerHTML = `
    <div class="coming-soon-state">
      <div class="coming-soon-icon">🚀</div>
      <div class="coming-soon-title">New areas being added soon!</div>
      <div class="coming-soon-text">
        Check back in ${regionName} for exciting events coming your way.
      </div>
      <button class="btn btn-primary" onclick="handleRegionChange('nyc')">
        Explore NYC Events
      </button>
    </div>
  `;
}

// Initialize App
async function init() {
  // Show skeleton loading cards
  eventsList.innerHTML = Array.from({ length: 3 }, () => `
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton-header"></div>
      <div class="skeleton-label">
        <div class="skeleton-line medium"></div>
        <div class="skeleton-line short"></div>
      </div>
      <div style="min-height:20px"></div>
      <div class="skeleton-footer">
        <div class="skeleton-line" style="width:80px;height:24px"></div>
        <div class="skeleton-line" style="width:50px"></div>
      </div>
    </div>
  `).join('');

  // Track page view
  trackPageView();

  // Initialize region (detects location)
  await initRegion();

  // Fetch events from API
  const fetchedEvents = await fetchEvents();
  if (fetchedEvents && fetchedEvents.length > 0) {
    events = fetchedEvents;
  }
  eventsLoaded = true;

  // Truth-pass hygiene: favorites whose ids fell out of the verified feed
  // would inflate the nav badge forever. Prune them — but only against a
  // truth-passed list, never the hardcoded fallback (API-down would
  // otherwise wipe real favorites).
  if (truthPassApplied) {
    const validIds = new Set(events.map(e => e.id));
    const prunedFavorites = favorites.filter(id => validIds.has(id));
    if (prunedFavorites.length !== favorites.length) {
      favorites = prunedFavorites;
      localStorage.setItem('soireeFavorites', JSON.stringify(favorites));
    }
  }

  // Render and setup
  renderEvents();
  setupEventListeners();
  updateFavoriteBadge();
  updateCategoryCounts();
  updateValueStrip();
  updateSalonHero();

  // Navigate to URL path on initial load (e.g. direct link to /today)
  const initialView = PATH_VIEWS[location.pathname] || 'discover';
  if (initialView !== 'discover') {
    navigateToView(initialView, { pushHistory: false });
  } else {
    history.replaceState({ view: 'discover' }, '', location.pathname);
  }

  // Deep link: /e/* pages inject window.__DEEP_EVENT_ID__ server-side —
  // open that event's detail modal once the verified list is in
  if (window.__DEEP_EVENT_ID__ != null) {
    const deepId = parseInt(window.__DEEP_EVENT_ID__, 10);
    window.__DEEP_EVENT_ID__ = null;
    if (!Number.isNaN(deepId) && events.some(e => e.id === deepId)) {
      openModal(deepId);
    }
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Filter chips — set accent colors and listeners
  filterChips.forEach(chip => {
    const color = chip.dataset.color;
    if (color) chip.style.setProperty('--chip-color', color);
    chip.addEventListener('click', () => handleFilterClick(chip));
  });

  // Art sub-filter toggle (Openings / All Shows)
  document.querySelectorAll('.art-subfilter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.art-subfilter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      artSubFilter = btn.dataset.artFilter;
      currentPage = 1;
      renderEvents();
    });
  });

  // Search
  searchInput.addEventListener('input', handleSearch);
  searchClear.addEventListener('click', clearSearch);

  // Navigation
  navItems.forEach(item => {
    item.addEventListener('click', () => handleNavClick(item));
  });

  // Logo → home
  const navBrandHome = document.getElementById('nav-brand-home');
  if (navBrandHome) {
    navBrandHome.addEventListener('click', () => navigateToView('discover'));
    navBrandHome.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') navigateToView('discover');
    });
  }

  // Browser back/forward
  window.addEventListener('popstate', (e) => {
    const view = (e.state && e.state.view) || PATH_VIEWS[location.pathname] || 'discover';
    navigateToView(view, { pushHistory: false });
  });

  // Modal
  modalOverlay.addEventListener('click', (e) => {
    // Ghost-click guard: a tap on a swipe-stack card opens the modal from
    // touchend, then the browser fires the synthetic click a moment later —
    // it lands on the freshly-opened overlay and would instantly close it.
    // Ignore any overlay click in the first beats after opening.
    if (Date.now() - modalOpenedAt < 500) return;
    if (e.target === modalOverlay) closeModal();
  });
  modalClose.addEventListener('click', closeModal);

  // Region selector
  const regionToggle = document.getElementById('region-toggle');
  if (regionToggle) {
    regionToggle.addEventListener('click', toggleRegionDropdown);
  }
  const regionPanelClose = document.getElementById('region-panel-close');
  if (regionPanelClose) {
    regionPanelClose.addEventListener('click', closeRegionDropdown);
  }
  const regionBackdrop = document.getElementById('region-backdrop');
  if (regionBackdrop) {
    regionBackdrop.addEventListener('click', closeRegionDropdown);
  }

  document.querySelectorAll('.region-panel-option').forEach(option => {
    option.addEventListener('click', () => {
      const region = option.dataset.region;
      handleRegionChange(region);
    });
  });

  // On desktop, prevent page scroll when touching the region picker panel
  const regionPanel = document.getElementById('hero-region-panel');
  if (regionPanel) {
    regionPanel.addEventListener('touchmove', (e) => {
      // Only prevent default on desktop (inline panel); full-screen mobile needs to scroll
      if (window.innerWidth >= 768) e.preventDefault();
    }, { passive: false });
  }

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
      closeModal();
    }
    if (e.key === 'Escape') {
      closeRegionDropdown();
    }
  });

  // Region picker: keyboard nav + swipe-to-dismiss
  setupRegionKeyboardNav();
  setupSwipeToDismiss();
}

// Filter Events
function handleFilterClick(chip) {
  document.querySelectorAll('.filter-chip').forEach(c => {
    c.classList.remove('active');
    c.classList.remove('filter-chip-pop');
    c.setAttribute('aria-checked', 'false');
  });
  chip.classList.add('active');
  chip.classList.add('filter-chip-pop');
  chip.setAttribute('aria-checked', 'true');
  currentFilter = chip.dataset.filter;
  currentPage = 1;

  // Show art sub-filter when Art is active on list views
  const artSubEl = document.getElementById('art-subfilter');
  if (artSubEl) {
    artSubEl.classList.toggle('hidden', currentFilter !== 'art');
  }

  renderEvents();
  setTimeout(() => chip.classList.remove('filter-chip-pop'), 300);
}

// Search Events
function handleSearch(e) {
  searchQuery = e.target.value.toLowerCase();
  searchClear.classList.toggle('visible', searchQuery.length > 0);
  currentPage = 1;
  renderEvents();
}

function clearSearch() {
  searchInput.value = '';
  searchQuery = '';
  searchClear.classList.remove('visible');
  currentPage = 1;
  renderEvents();
}

// Navigation
// Map view name → URL path
const VIEW_PATHS = { discover: '/', all: '/all', today: '/today', week: '/week', favorites: '/favorites', about: '/about', social: '/social', pins: '/pins' };
const PATH_VIEWS = { '/': 'discover', '/all': 'all', '/today': 'today', '/week': 'week', '/favorites': 'favorites', '/about': 'about', '/social': 'social', '/pins': 'pins' };

function navigateToView(view, opts = {}) {
  const navItem = document.querySelector(`[data-view="${view}"]`);
  if (navItem) {
    handleNavClick(navItem, opts);
  } else {
    // Home (discover) has no nav item — call handleNavClick with a synthetic element
    handleNavClick({ dataset: { view }, classList: { contains: () => false, add: () => {}, remove: () => {} } }, opts);
  }
}

function handleNavClick(item, { pushHistory = true } = {}) {
  const view = item.dataset.view;

  // Update active state (logo/home has no nav item to activate)
  navItems.forEach(n => n.classList.remove('active'));
  if (item.classList) item.classList.add('active');

  // Update browser URL
  if (pushHistory) {
    const path = VIEW_PATHS[view] || '/';
    history.pushState({ view }, '', path);
  }

  // Find the currently visible view
  const socialView = document.getElementById('social-view');
  const pinsView = document.getElementById('pins-view');
  const views = [discoverView, favoritesView, aboutView, socialView, pinsView];
  const visibleView = views.find(v => !v.classList.contains('hidden'));

  function showView() {
    const unifiedGallery = document.getElementById('unified-gallery');
    const eventsListEl = document.getElementById('events-list');

    // Restore nav/footer if coming from social/pins view
    document.querySelector('.nav-bar').style.display = '';
    document.querySelector('.app-footer').style.display = '';

    if (view === 'discover') {
      currentTimeFilter = 'all';
      discoverView.classList.remove('hidden');
      discoverView.classList.add('view-home');
      favoritesView.classList.add('hidden');
      aboutView.classList.add('hidden');
      socialView.classList.add('hidden');
      pinsView.classList.add('hidden');
      if (unifiedGallery) unifiedGallery.classList.remove('hidden');
      if (eventsListEl) eventsListEl.classList.add('hidden');
      const subscribeStripEvents = document.getElementById('subscribe-strip-events');
      if (subscribeStripEvents) subscribeStripEvents.classList.add('hidden');
      // Hide art sub-filter on home view
      const artSubEl = document.getElementById('art-subfilter');
      if (artSubEl) artSubEl.classList.add('hidden');
      startRotating();
      updateCategoryCounts();
    } else if (view === 'all') {
      currentTimeFilter = 'all';
      currentPage = 1;
      discoverView.classList.remove('hidden');
      discoverView.classList.remove('view-home');
      favoritesView.classList.add('hidden');
      aboutView.classList.add('hidden');
      socialView.classList.add('hidden');
      pinsView.classList.add('hidden');
      if (unifiedGallery) unifiedGallery.classList.add('hidden');
      if (eventsListEl) eventsListEl.classList.remove('hidden');
      const subscribeStripEvents = document.getElementById('subscribe-strip-events');
      if (subscribeStripEvents) subscribeStripEvents.classList.remove('hidden');
      setFixedTitle("This Week's");
      renderEvents();
    } else if (view === 'today') {
      currentTimeFilter = 'today';
      currentPage = 1;
      discoverView.classList.remove('hidden');
      discoverView.classList.remove('view-home');
      favoritesView.classList.add('hidden');
      aboutView.classList.add('hidden');
      socialView.classList.add('hidden');
      pinsView.classList.add('hidden');
      if (unifiedGallery) unifiedGallery.classList.add('hidden');
      if (eventsListEl) eventsListEl.classList.remove('hidden');
      const subscribeStripEvents = document.getElementById('subscribe-strip-events');
      if (subscribeStripEvents) subscribeStripEvents.classList.remove('hidden');
      setFixedTitle("Today's");
      renderEvents();
    } else if (view === 'week') {
      currentTimeFilter = 'week';
      currentPage = 1;
      discoverView.classList.remove('hidden');
      discoverView.classList.remove('view-home');
      favoritesView.classList.add('hidden');
      aboutView.classList.add('hidden');
      socialView.classList.add('hidden');
      pinsView.classList.add('hidden');
      if (unifiedGallery) unifiedGallery.classList.add('hidden');
      if (eventsListEl) eventsListEl.classList.remove('hidden');
      const subscribeStripEvents = document.getElementById('subscribe-strip-events');
      if (subscribeStripEvents) subscribeStripEvents.classList.remove('hidden');
      setFixedTitle("This Week's");
      renderEvents();
    } else if (view === 'favorites') {
      discoverView.classList.add('hidden');
      favoritesView.classList.remove('hidden');
      aboutView.classList.add('hidden');
      socialView.classList.add('hidden');
      pinsView.classList.add('hidden');
      const subscribeStripEvents = document.getElementById('subscribe-strip-events');
      if (subscribeStripEvents) subscribeStripEvents.classList.add('hidden');
      renderFavorites();
    } else if (view === 'about') {
      discoverView.classList.add('hidden');
      const subscribeStripEvents = document.getElementById('subscribe-strip-events');
      if (subscribeStripEvents) subscribeStripEvents.classList.add('hidden');
      favoritesView.classList.add('hidden');
      aboutView.classList.remove('hidden');
      socialView.classList.add('hidden');
      pinsView.classList.add('hidden');
      loadStats();
      loadSourceHealth();
      // Tech dashboard init is gated here so it only runs when About is
      // actually opened. Each initializer self-guards against re-running.
      const techDashboard = document.getElementById('tech-dashboard');
      if (techDashboard) {
        requestAnimationFrame(() => initNetworkGraph());
        initActivityChart();
      }
    } else if (view === 'social') {
      discoverView.classList.add('hidden');
      favoritesView.classList.add('hidden');
      aboutView.classList.add('hidden');
      socialView.classList.remove('hidden');
      pinsView.classList.add('hidden');
      const subscribeStripEvents = document.getElementById('subscribe-strip-events');
      if (subscribeStripEvents) subscribeStripEvents.classList.add('hidden');
      document.querySelector('.nav-bar').style.display = 'none';
      document.querySelector('.app-footer').style.display = 'none';
      renderSocialPosts();
    } else if (view === 'pins') {
      discoverView.classList.add('hidden');
      favoritesView.classList.add('hidden');
      aboutView.classList.add('hidden');
      socialView.classList.add('hidden');
      pinsView.classList.remove('hidden');
      const subscribeStripEvents = document.getElementById('subscribe-strip-events');
      if (subscribeStripEvents) subscribeStripEvents.classList.add('hidden');
      document.querySelector('.nav-bar').style.display = 'none';
      document.querySelector('.app-footer').style.display = 'none';
    }
  }

  // If switching to a different view container, fade out then in
  const targetView = (view === 'favorites') ? favoritesView : (view === 'about') ? aboutView : (view === 'social') ? socialView : (view === 'pins') ? pinsView : discoverView;
  if (visibleView && visibleView !== targetView) {
    visibleView.classList.add('view-fade-out');
    setTimeout(() => {
      visibleView.classList.remove('view-fade-out');
      showView();
      targetView.classList.add('view-fade-in');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          targetView.classList.remove('view-fade-in');
        });
      });
    }, 280);
  } else {
    showView();
  }
}

// Helper: Event Region Classification
// Whole-word keyword test — substring matching misfiled venues ("Sean Kelly"
// contains 'sea', "Deal Lake" vs "dealer") into the wrong region entirely.
const hasWord = (text, kw) =>
  new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);

const getEventRegion = (event) => {
  const loc = (event.location || '').toLowerCase();
  const addr = (event.address || '').toLowerCase();
  const source = (event.source || '').toLowerCase();
  const shoreK = ['shore', 'beach', 'ocean', 'sea', 'asbury', 'long branch', 'belmar', 'point pleasant', 'seaside', 'avalon', 'stone harbor', 'brigantine', 'atlantic city', 'cape may', 'wildwood', 'manasquan', 'bradley beach', 'ocean grove', 'spring lake', 'sea girt', 'deal'];
  const southK = ['camden', 'cherry hill', 'mount laurel', 'medford', 'glassboro', 'vineland', 'millville', 'bridgeton', 'salem', 'deptford', 'moorestown', 'haddonfield', 'collingswood'];
  const centralK = ['princeton', 'new brunswick', 'edison', 'woodbridge', 'manalapan', 'freehold', 'marlboro', 'sayreville', 'old bridge', 'rahway', 'somerville', 'flemington', 'plainfield', 'trenton', 'hamilton', 'ewing', 'lawrence', 'robbinsville'];
  const northK = ['newark', 'paterson', 'clifton', 'passaic', 'wayne', 'hackensack', 'teaneck', 'fort lee', 'paramus', 'ridgewood', 'montclair', 'morristown', 'mahwah', 'summit', 'chatham', 'madison', 'dover', 'sparta', 'sussex'];

  if (loc.includes('hoboken') || loc.includes('jersey city') || addr.includes('hoboken') || addr.includes('jersey city')) return 'hoboken-jc';
  if (shoreK.some(k => hasWord(loc, k) || hasWord(addr, k))) return 'jersey-shore';
  if (southK.some(k => hasWord(loc, k) || hasWord(addr, k))) return 'south-nj';
  if (centralK.some(k => hasWord(loc, k) || hasWord(addr, k))) return 'central-nj';
  if (northK.some(k => hasWord(loc, k) || hasWord(addr, k))) return 'north-nj';
  if (source.includes('visit nj') || hasWord(loc, 'nj') || addr.includes('new jersey')) return 'jersey-shore';
  return 'nyc';
};

const matchesCurrentRegion = (event) => {
  const r = getEventRegion(event);
  if (currentRegion === 'nyc') return r === 'nyc';
  if (currentRegion === 'hoboken-jc') return r === 'hoboken-jc';
  if (currentRegion === 'nj-state') return r !== 'nyc' && r !== 'hoboken-jc';
  return r === currentRegion;
};

// Helper function to check if event matches time filter
function matchesTimeFilter(event) {
  if (currentTimeFilter === 'all') return true;
  if (!event.start_date) return false;

  const todayStr = getTodayLocal();
  const startDateStr = extractDateFromISO(event.start_date);
  const endDateStr = event.end_date ? extractDateFromISO(event.end_date) : startDateStr;

  if (currentTimeFilter === 'today') {
    return todayStr >= startDateStr && todayStr <= endDateStr;
  }

  if (currentTimeFilter === 'week') {
    const endOfWeekStr = getEndOfWeekLocal();
    return startDateStr <= endOfWeekStr && endDateStr >= todayStr;
  }

  return true;
}

// Update filter chip count badges
function updateFilterCounts() {
  const counts = {};
  let total = 0;

  events.forEach(event => {
    const matchesSearch = !searchQuery ||
      event.name.toLowerCase().includes(searchQuery) ||
      event.location.toLowerCase().includes(searchQuery) ||
      event.description.toLowerCase().includes(searchQuery);
    const matchesTime = matchesTimeFilter(event);
    // Use consistent region logic
    const matchesRegion = matchesCurrentRegion(event);

    if (matchesSearch && matchesTime && matchesRegion) {
      total++;
      counts[event.category] = (counts[event.category] || 0) + 1;
    }
  });

  document.querySelectorAll('.filter-chip').forEach(chip => {
    const filter = chip.dataset.filter;
    let countEl = chip.querySelector('.filter-count');

    if (!countEl) {
      countEl = document.createElement('span');
      countEl.className = 'filter-count';
      chip.appendChild(countEl);
    }

    const count = filter === 'all' ? total : (counts[filter] || 0);
    countEl.textContent = count;

    // Hide zero-count chips (except All)
    if (filter !== 'all' && count === 0) {
      chip.style.display = 'none';
    } else {
      chip.style.display = '';
    }
  });
}

// Create Deals Card — collapsed = tiny peek, expanded = full detail
function createDealsCard(timeFilter) {
  const regionDeals = DEALS_BY_REGION[currentRegion];
  if (!regionDeals) return '';

  const regionName = REGIONS[currentRegion]?.shortName || REGIONS[currentRegion]?.name || 'your area';
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  if (timeFilter === 'today') {
    const todayDeals = regionDeals.daily?.[todayName] || [];
    if (todayDeals.length === 0) return '';

    // Build expanded content
    const expandedHTML = todayDeals.map(deal => {
      const atIdx = deal.lastIndexOf(' at ');
      const offer = atIdx > -1 ? deal.substring(0, atIdx) : deal;
      const venue = atIdx > -1 ? deal.substring(atIdx + 4) : '';
      return `<div class="deals-exp-item"><span class="deals-exp-offer">${offer}</span>${venue ? `<span class="deals-exp-venue">${venue}</span>` : ''}</div>`;
    }).join('');

    return `
      <div class="deals-peek" id="deals-peek-today" onclick="toggleDealsCard('today')">
        <span class="deals-peek-label">${todayName}'s Deals</span>
        <span class="deals-peek-count">${todayDeals.length} in ${regionName}</span>
        <svg class="deals-peek-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="deals-expanded" id="deals-expanded-today" style="display:none;">
        <div class="deals-exp-header">
          <div>
            <div class="deals-exp-label">${regionName}</div>
            <h3 class="deals-exp-title">${todayName}'s Deals</h3>
          </div>
          <button class="deals-exp-close" onclick="toggleDealsCard('today')" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="deals-exp-list">${expandedHTML}</div>
      </div>
    `;
  } else if (timeFilter === 'week') {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const allDays = days.filter(d => (regionDeals.daily?.[d] || []).length > 0);
    if (allDays.length === 0) return '';
    const totalDeals = allDays.reduce((sum, d) => sum + regionDeals.daily[d].length, 0);

    // Build expanded content
    const expandedHTML = allDays.map(day => {
      const dayDeals = regionDeals.daily[day];
      const isToday = day === todayName;
      const items = dayDeals.map(deal => {
        const atIdx = deal.lastIndexOf(' at ');
        const offer = atIdx > -1 ? deal.substring(0, atIdx) : deal;
        const venue = atIdx > -1 ? deal.substring(atIdx + 4) : '';
        return `<div class="deals-exp-item"><span class="deals-exp-offer">${offer}</span>${venue ? `<span class="deals-exp-venue">${venue}</span>` : ''}</div>`;
      }).join('');
      return `
        <div class="deals-exp-day ${isToday ? 'deals-exp-day-today' : ''}">
          <div class="deals-exp-day-label">
            <span>${day}</span>
            ${isToday ? '<span class="deals-exp-today-badge">Today</span>' : ''}
          </div>
          <div class="deals-exp-list">${items}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="deals-peek" id="deals-peek-week" onclick="toggleDealsCard('week')">
        <span class="deals-peek-label">This Week's Deals</span>
        <span class="deals-peek-count">${totalDeals} deals in ${regionName}</span>
        <svg class="deals-peek-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="deals-expanded" id="deals-expanded-week" style="display:none;">
        <div class="deals-exp-header">
          <div>
            <div class="deals-exp-label">${regionName}</div>
            <h3 class="deals-exp-title">This Week's Deals</h3>
          </div>
          <button class="deals-exp-close" onclick="toggleDealsCard('week')" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="deals-exp-days">${expandedHTML}</div>
      </div>
    `;
  }

  return '';
}

// Toggle Deals Card
function toggleDealsCard(timeFilter) {
  const peek = document.getElementById(`deals-peek-${timeFilter}`);
  const expanded = document.getElementById(`deals-expanded-${timeFilter}`);
  const isOpen = expanded.style.display !== 'none';

  if (isOpen) {
    expanded.style.display = 'none';
    peek.style.display = '';
  } else {
    expanded.style.display = '';
    peek.style.display = 'none';
  }
}

// Render Events
// ── Curated framing: the copy rewrites itself per view AND per category so
// filtering genuinely changes the experience, not just the list. ────────────
const CURATED_COPY = {
  today: {
    all:       { eyebrow: 'Tonight', head: 'The evening, <em>curated.</em>', sub: n => `${n.n} ways to spend tonight — ${n.free} free.` },
    art:       { eyebrow: 'Tonight · Art', head: 'Openings &amp; <em>after hours.</em>', sub: n => `${n.n} shows to see before the lights go down.` },
    perks:     { eyebrow: 'Tonight · Perks', head: 'Pop-ups &amp; <em>little luxuries.</em>', sub: n => `${n.n} finds worth dressing up for.` },
    community: { eyebrow: 'Tonight · Culture', head: 'Gatherings &amp; <em>goings-on.</em>', sub: n => `${n.n} ways to be among people tonight.` },
    music:     { eyebrow: 'Tonight · Music', head: 'Sets, stages &amp; <em>sound.</em>', sub: n => `${n.n} rooms with music in them tonight.` },
  },
  week: {
    all:       { eyebrow: 'The week ahead', head: 'Seven nights, <em>a full card.</em>', sub: n => `${n.n} invitations this week — ${n.free} free.` },
    art:       { eyebrow: 'The week in art', head: 'On view <em>this week.</em>', sub: n => `${n.n} exhibitions and openings to catch.` },
    perks:     { eyebrow: 'The week in perks', head: 'Pop-ups <em>all week.</em>', sub: n => `${n.n} fleeting things before they vanish.` },
    community: { eyebrow: 'The week in culture', head: 'The city, <em>gathering.</em>', sub: n => `${n.n} happenings across seven nights.` },
    music:     { eyebrow: 'The week in music', head: 'A week of <em>sound.</em>', sub: n => `${n.n} nights worth listening for.` },
  },
};

function curatedIntroHTML(count, freeCount) {
  const tf = currentTimeFilter;
  if (tf !== 'today' && tf !== 'week') return '';
  const cat = CURATED_COPY[tf][currentFilter] ? currentFilter : 'all';
  const c = CURATED_COPY[tf][cat];
  const region = (typeof REGIONS !== 'undefined' && REGIONS[currentRegion] && REGIONS[currentRegion].name) || 'the city';
  return `
    <div class="curated-intro" data-tf="${tf}" data-cat="${esc(cat)}">
      <p class="curated-eyebrow">${esc(c.eyebrow)} · ${esc(region)}</p>
      <h2 class="curated-head">${c.head}</h2>
      <p class="curated-sub">${esc(c.sub({ n: count, free: freeCount }))}</p>
    </div>`;
}

function dayLabelFor(dateStr) {
  const today = getTodayLocal();
  if (dateStr <= today) return 'Tonight';
  const d = new Date(dateStr + 'T12:00:00');
  const t = new Date(today + 'T12:00:00');
  const diff = Math.round((d - t) / 86400000);
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

function renderEvents() {
  // Keep the footer's derived truth line in step with whatever the page
  // renders (runs on load, region change, filter change — cheap, idempotent)
  updateFooterTruth();

  // Show/hide art sub-filter based on current category
  const artSubEl = document.getElementById('art-subfilter');
  if (artSubEl) {
    artSubEl.classList.toggle('hidden', currentFilter !== 'art');
  }

  // Check if current region is legitimate
  const validRegions = ['nyc', 'hoboken-jc', 'nj-state', 'north-nj', 'central-nj', 'south-nj', 'jersey-shore'];
  if (currentRegion && !validRegions.includes(currentRegion)) {
    const regionData = REGIONS[currentRegion];
    renderComingSoon(regionData ? regionData.name : 'this area');
    return;
  }

  updateFilterCounts();
  const filteredEvents = events.filter(event => {
    const matchesFilter = currentFilter === 'all' || event.category === currentFilter;
    const matchesSearch = !searchQuery ||
      event.name.toLowerCase().includes(searchQuery) ||
      event.location.toLowerCase().includes(searchQuery) ||
      event.description.toLowerCase().includes(searchQuery);
    const matchesTime = matchesTimeFilter(event);

    // Use consistent region logic
    const matchesRegion = matchesCurrentRegion(event);

    // Free Filter Logic (Source-based: User Defined)
    let matchesFree = true;
    if (freeMode) {
      // Truth pass derives isFree from the published price/tags only
      matchesFree = event.isFree === true;
    }

    // Art sub-filter: when viewing art category, filter by openings vs all
    let matchesArtType = true;
    if (currentFilter === 'art' && artSubFilter === 'openings') {
      matchesArtType = !event.event_type || event.event_type === 'opening';
    }

    return matchesFilter && matchesSearch && matchesTime && matchesRegion && matchesFree && matchesArtType;
  });

  // Add deals card at top for today/week views (even if no events)
  const dealsCard = (currentTimeFilter === 'today' || currentTimeFilter === 'week')
    ? createDealsCard(currentTimeFilter)
    : '';

  // Curated framing (today/week) — rewrites itself with the active filter.
  const freeCount = filteredEvents.filter(e => e.isFree === true).length;
  const curatedIntro = curatedIntroHTML(filteredEvents.length, freeCount);

  if (filteredEvents.length === 0) {
    eventsList.innerHTML = curatedIntro + dealsCard + `
      <div class="empty-state">
        <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
        <div class="empty-state-title">Nothing on this bill yet</div>
        <div class="empty-state-text">Try another night or a different room.</div>
      </div>
    `;
    return;
  }

  // THIS WEEK — a curated weekly spread: single-day events grouped under day
  // headers (Tonight / Tomorrow / weekday); ongoing exhibitions collapse into
  // one "On view all week" section. Full-width dividers span the card grid.
  if (currentTimeFilter === 'week') {
    const today = getTodayLocal();
    const ordered = [...filteredEvents].sort((a, b) =>
      (a.start_date || '').localeCompare(b.start_date || ''));
    const groups = {}; // key -> { label, dateLabel, order, events: [] }
    for (const e of ordered) {
      const s = extractDateFromISO(e.start_date) || '';
      const en = e.end_date ? extractDateFromISO(e.end_date) : s;
      let key, label, dateLabel, order;
      if (en > s && s <= today) {           // ongoing / multi-day exhibition
        key = '~onview'; label = 'On view all week'; dateLabel = ''; order = '~';
      } else {
        key = s; label = dayLabelFor(s); order = s;
        dateLabel = s ? new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      }
      (groups[key] = groups[key] || { label, dateLabel, order, events: [] }).events.push(e);
    }
    let idx = 0;
    const html = Object.values(groups).sort((a, b) => a.order.localeCompare(b.order)).map(g => {
      const divider = `<div class="day-divider">
          <span class="day-name">${esc(g.label)}</span>
          ${g.dateLabel ? `<span class="day-date">${esc(g.dateLabel)}</span>` : ''}
          <span class="day-rule" aria-hidden="true"></span>
          <span class="day-count">${g.events.length}</span>
        </div>`;
      return divider + g.events.map(e => createEventCard(e, idx++)).join('');
    }).join('');
    eventsList.innerHTML = curatedIntro + dealsCard + html;
  } else {
    // TODAY / ALL — paginated list (today already sorted soonest-first).
    const totalPages = Math.ceil(filteredEvents.length / EVENTS_PER_PAGE);
    const startIndex = (currentPage - 1) * EVENTS_PER_PAGE;
    const paginatedEvents = filteredEvents.slice(startIndex, startIndex + EVENTS_PER_PAGE);

    let paginationHTML = '';
    if (totalPages > 1) {
      paginationHTML = `
        <div class="pagination">
          <button class="pagination-btn" id="prev-page" ${currentPage === 1 ? 'disabled' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M15 18l-6-6 6-6"/></svg>
            Previous
          </button>
          <span class="pagination-info">Page ${currentPage} of ${totalPages}</span>
          <button class="pagination-btn" id="next-page" ${currentPage === totalPages ? 'disabled' : ''}>
            Next
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      `;
    }
    eventsList.innerHTML = curatedIntro + dealsCard + paginatedEvents.map((event, index) =>
      createEventCard(event, startIndex + index)
    ).join('') + paginationHTML;
  }

  // Add event listeners to cards
  document.querySelectorAll('.event-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.favorite-btn')) {
        const eventId = parseInt(card.dataset.id);
        openModal(eventId);
      }
    });
    card.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.favorite-btn')) {
        e.preventDefault();
        openModal(parseInt(card.dataset.id));
      }
    });
  });

  // Add favorite button listeners
  document.querySelectorAll('.favorite-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const eventId = parseInt(btn.dataset.id);
      toggleFavorite(eventId);
    });
  });

  // Add pagination listeners
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderEvents();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderEvents();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // Trigger scroll-reveal for cards
  initCardReveal();
}

// ── Scroll-triggered card reveal with stagger ──
let cardRevealObserver = null;

function initCardReveal() {
  // Disconnect previous observer
  if (cardRevealObserver) cardRevealObserver.disconnect();

  const cards = document.querySelectorAll('.event-card:not(.card-revealed)');
  if (!cards.length) return;

  let batchIndex = 0;
  let batchTimer = null;

  cardRevealObserver = new IntersectionObserver((entries) => {
    const visible = entries.filter(e => e.isIntersecting);
    if (!visible.length) return;

    visible.forEach(entry => {
      const card = entry.target;
      // Stagger within batch
      const delay = Math.min(batchIndex, 4) * 60;
      card.style.transitionDelay = `${delay}ms`;
      card.classList.add('card-revealed');
      cardRevealObserver.unobserve(card);
      batchIndex++;
    });

    // Reset batch after a pause
    clearTimeout(batchTimer);
    batchTimer = setTimeout(() => { batchIndex = 0; }, 200);
  }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

  cards.forEach(c => cardRevealObserver.observe(c));
}

// Render Favorites
function renderFavorites() {
  const favoriteEvents = events.filter(e => favorites.includes(e.id));

  if (favoriteEvents.length === 0) {
    favoritesView.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>
        <div class="empty-state-title">No favorites yet</div>
        <div class="empty-state-text">Tap the heart on events you love</div>
        <button class="btn btn-primary empty-state-cta" onclick="navigateToView('all')">Browse Events</button>
      </div>
    `;
    return;
  }

  favoritesView.innerHTML = `
    <div class="events">
      ${favoriteEvents.map((event, index) => createEventCard(event, index)).join('')}
    </div>
  `;

  // Add event listeners
  favoritesView.querySelectorAll('.event-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.favorite-btn')) {
        const eventId = parseInt(card.dataset.id);
        openModal(eventId);
      }
    });
    card.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.favorite-btn')) {
        e.preventDefault();
        openModal(parseInt(card.dataset.id));
      }
    });
  });

  favoritesView.querySelectorAll('.favorite-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const eventId = parseInt(btn.dataset.id);
      toggleFavorite(eventId);
    });
  });

  initCardReveal();
}

// Render Social Media Posts for Instagram
function renderSocialPosts() {
  const nycEvents = events.filter(event => getEventRegion(event) === 'nyc');

  // Date range: today → +7 days
  const today = new Date();
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + 7);
  const todayStr = formatDateLocal(today);
  const endOfWeekStr = formatDateLocal(endOfWeek);

  // Format week label: "Feb 21 – 28, 2026"
  const weekLabel = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    + ' – ' + endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Set week labels
  ['social-week-art', 'social-week-perks', 'social-week-community'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = weekLabel;
  });

  const thisWeekEvents = nycEvents.filter(event => {
    const eventDate = event.start_date || extractDateFromISO(event.date) || event.date;
    if (!eventDate) return false;
    return eventDate >= todayStr && eventDate <= endOfWeekStr;
  });

  // All events per category for NYC this week
  const artEvents = thisWeekEvents.filter(e => e.category === 'art');
  const perksEvents = thisWeekEvents.filter(e => e.category === 'perks');
  const communityEvents = thisWeekEvents.filter(e => e.category === 'community');

  // Max 8 in the card visual; ALL events go in the caption below
  renderSocialCategory('social-art-events', artEvents.slice(0, 8));
  renderSocialCategory('social-perks-events', perksEvents.slice(0, 8));
  renderSocialCategory('social-community-events', communityEvents.slice(0, 8));

  // Generate caption blocks with ALL events + hashtags
  renderSocialCaption('social-art-caption', artEvents, 'Art', weekLabel);
  renderSocialCaption('social-perks-caption', perksEvents, 'Perks & Pop-Ups', weekLabel);
  renderSocialCaption('social-community-caption', communityEvents, 'Culture & Community', weekLabel);

  // Set footer taglines with total curated event count
  const totalCount = thisWeekEvents.length;
  document.querySelectorAll('.social-tagline').forEach(el => {
    el.textContent = `Visit for all ${totalCount} curated events this week`;
  });

  // Dynamically distribute vertical space across event rows to fill 4:5 frame
  requestAnimationFrame(() => distributeSocialSpacing());
}

function distributeSocialSpacing() {
  document.querySelectorAll('.social-post').forEach(post => {
    const list = post.querySelector('.social-events-list');
    const rows = list ? list.querySelectorAll('.social-event-row') : [];
    if (!rows.length) return;

    const count = rows.length;

    // Scale font size down for dense cards
    const fontSize = count <= 4 ? 17 : count <= 6 ? 15 : 14;
    rows.forEach(r => {
      const name = r.querySelector('.social-event-name');
      if (name) name.style.fontSize = fontSize + 'px';
    });

    // Reset padding to measure natural height
    rows.forEach(r => r.style.padding = '0');

    const listHeight = list.clientHeight;
    let contentHeight = 0;
    rows.forEach(r => { contentHeight += r.scrollHeight; });

    const availableSpace = listHeight - contentHeight;
    const verticalPad = Math.max(2, Math.floor(availableSpace / (count * 2)));

    rows.forEach(r => {
      r.style.paddingTop = verticalPad + 'px';
      r.style.paddingBottom = verticalPad + 'px';
    });
  });
}


function renderSocialCategory(containerId, categoryEvents) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (categoryEvents.length === 0) {
    container.innerHTML = '<div class="social-empty">No events this week</div>';
    return;
  }

  container.innerHTML = categoryEvents.map((event, i) => {
    // Short date: "Fri 2/21"
    let shortDate = '';
    const dateStr = event.start_date ? event.start_date.split('T')[0] : null;
    if (dateStr) {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const day = dt.toLocaleDateString('en-US', { weekday: 'short' });
      shortDate = `${day} ${m}/${d}`;
    }

    return `<div class="social-event-row">
      <span class="social-event-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="social-event-name">${esc(event.name)}</span>
      ${shortDate ? `<span class="social-event-meta">${esc(shortDate)}</span>` : ''}
    </div>`;
  }).join('');
}

function renderSocialCaption(captionId, allEvents, categoryName, weekLabel) {
  const el = document.getElementById(captionId);
  if (!el) return;

  if (allEvents.length === 0) {
    el.innerHTML = '';
    return;
  }

  // Build plain-text caption for clipboard
  const eventLines = allEvents.map(event => {
    let detail = '';
    const dateStr = event.start_date ? event.start_date.split('T')[0] : null;
    if (dateStr) {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      detail = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    if (event.location) detail += (detail ? ' · ' : '') + event.location;
    return `• ${event.name} — ${detail}`;
  }).join('\n');

  const categoryHashtags = {
    'Art': '#NYCArt #ArtGallery #GalleryOpening #ContemporaryArt #ArtExhibition #NYCCulture #ArtLovers #NYCArtists #ArtShow #CulturalNYC',
    'Perks & Pop-Ups': '#NYCPerks #PopUpNYC #SampleSale #NYCDeals #PopUpShop #ExclusiveNYC #LimitedTime #NYCPopUps #NYCSavings',
    'Culture & Community': '#NYCCommunity #NYCLocal #ThingsToDoNYC #NYCWeekend #NYCFree #NYCEvents #NYCLife #CommunityNYC #FreeNYC #NYCFun'
  };

  const baseHashtags = '#NYC #NewYorkCity #NYCEvents #ThingsToDoNYC #NYCLife #NewYork #WeekendNYC #Soiree #SoireeToday';
  const catTags = categoryHashtags[categoryName] || '';

  const captionText = `${categoryName} in NYC this week (${weekLabel}) — ${allEvents.length} curated events.\n\n${eventLines}\n\nDiscover the full lineup at soiree.today\n\n${baseHashtags}\n${catTags}`;

  // Determine the social-post ID from the caption ID (e.g. social-art-caption → social-art)
  const postId = captionId.replace('-caption', '');

  el.innerHTML = `
    <div class="social-caption-buttons">
      <button class="social-copy-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Copy Caption</span>
      </button>
      <button class="social-download-btn" data-post-id="${postId}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>Save Photo</span>
      </button>
    </div>
    <div class="social-preview-image" style="display:none;">
      <p class="social-preview-hint">Long-press the image below to save to Photos</p>
      <img class="social-preview-img" alt="Soirée ${categoryName}">
      <button class="social-preview-close">Dismiss</button>
    </div>
  `;

  el.querySelector('.social-copy-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(captionText);
      btn.querySelector('span').textContent = 'Copied!';
      setTimeout(() => { btn.querySelector('span').textContent = 'Copy Caption'; }, 2000);
    } catch (err) {
      btn.querySelector('span').textContent = 'Failed';
      setTimeout(() => { btn.querySelector('span').textContent = 'Copy Caption'; }, 2000);
    }
  });

  el.querySelector('.social-download-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const postEl = document.getElementById(postId);
    if (!postEl) return;

    const previewContainer = el.querySelector('.social-preview-image');
    const previewImg = el.querySelector('.social-preview-img');

    btn.querySelector('span').textContent = 'Generating...';
    try {
      // Clone at the same viewport size, then use scale to produce 1080x1350 output
      const rect = postEl.getBoundingClientRect();
      const clone = postEl.cloneNode(true);
      clone.style.cssText = `position:fixed;left:-9999px;top:0;width:${rect.width}px;height:${rect.height}px;z-index:-1;`;
      document.body.appendChild(clone);

      // Scale factor: output 1080px from the element's current rendered width
      const scaleFactor = 1080 / rect.width;

      const canvas = await html2canvas(clone, {
        width: rect.width,
        height: rect.height,
        scale: scaleFactor,
        useCORS: true,
        backgroundColor: '#EDE8E0'
      });

      document.body.removeChild(clone);

      const fileName = `soiree-${categoryName.toLowerCase().replace(/[^a-z]/g, '-')}.png`;

      // Try Web Share API first (works on iOS — opens native share sheet with "Save to Photos")
      if (navigator.canShare) {
        canvas.toBlob(async (blob) => {
          const file = new File([blob], fileName, { type: 'image/png' });
          try {
            await navigator.share({ files: [file] });
            btn.querySelector('span').textContent = 'Save Photo';
          } catch (shareErr) {
            // User cancelled share — show inline fallback
            showPreviewFallback(canvas, previewImg, previewContainer, btn);
          }
        }, 'image/png');
      } else {
        showPreviewFallback(canvas, previewImg, previewContainer, btn);
      }
    } catch (err) {
      console.error('Download failed:', err);
      btn.querySelector('span').textContent = 'Failed';
      setTimeout(() => { btn.querySelector('span').textContent = 'Save Photo'; }, 2000);
    }
  });

  function showPreviewFallback(canvas, previewImg, previewContainer, btn) {
    const dataUrl = canvas.toDataURL('image/png');
    previewImg.src = dataUrl;
    previewContainer.style.display = 'block';
    btn.querySelector('span').textContent = 'Save Photo';
  }

  el.querySelector('.social-preview-close').addEventListener('click', () => {
    el.querySelector('.social-preview-image').style.display = 'none';
  });
}

// Format Date for Display
// Clean up scraped descriptions for display — strips junk, deduplicates, truncates
function sanitizeDescription(text) {
  if (!text || typeof text !== 'string') return '';
  let desc = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/read more\.?\.?\.?/gi, '')
    .replace(/click here\.?/gi, '')
    .replace(/learn more\.?/gi, '')
    .replace(/sign up (now|today|here)\.?/gi, '')
    .replace(/register (now|today|here)\.?/gi, '')
    .replace(/buy tickets?\.?/gi, '')
    .replace(/get tickets?\.?/gi, '')
    .replace(/follow us on\.*/gi, '')
    .replace(/share this event\.?/gi, '')
    .replace(/add to calendar\.?/gi, '')
    .replace(/all rights reserved\.?/gi, '')
    .replace(/©.*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove duplicate sentences
  const sentences = desc.split(/(?<=[.!?])\s+/);
  const seen = new Set();
  const unique = [];
  for (const s of sentences) {
    const norm = s.toLowerCase().trim();
    if (norm.length < 5 || seen.has(norm)) continue;
    seen.add(norm);
    unique.push(s);
  }
  desc = unique.join(' ');

  // Truncate at sentence boundary around 500 chars
  if (desc.length > 500) {
    const cut = desc.substring(0, 500);
    const bp = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
    desc = bp > 200 ? desc.substring(0, bp + 1) : cut.trim();
  }

  // The regex tag-stripper above is bypassable by an unclosed tag, and the
  // result is written to innerHTML. HTML-escape the final string so nothing
  // that survives stripping can be interpreted as markup.
  return esc(desc);
}

function formatEventDate(event) {
  // If we have structured dates, format them nicely
  if (event.start_date) {
    // Parse as UTC to avoid timezone conversion
    const startDateStr = event.start_date.split('T')[0];
    const endDateStr = event.end_date ? event.end_date.split('T')[0] : startDateStr;

    // Check if this is a placeholder date (Feb 15, 2026)
    if (startDateStr === '2026-02-15') {
      return `Ongoing${event.time && event.time !== 'See details' ? ' • ' + event.time : ''}`;
    }

    const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);

    const startDate = new Date(Date.UTC(startYear, startMonth - 1, startDay));
    const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));

    const options = { month: 'short', day: 'numeric', timeZone: 'UTC' };
    const startFormatted = startDate.toLocaleDateString('en-US', options);

    // If single day event
    if (startDateStr === endDateStr) {
      return `${startFormatted}${event.time ? ' • ' + event.time : ''}`;
    } else {
      // Multi-day event
      const endFormatted = endDate.toLocaleDateString('en-US', options);
      return `${startFormatted} - ${endFormatted}${event.time ? ' • ' + event.time : ''}`;
    }
  }

  // Fallback to original format
  return `${event.date}${event.time ? ' • ' + event.time : ''}`;
}

// Format Short Date for Badge
function formatBadgeDate(event) {
  // Exhibitions carry a healed chip from the truth pass ("THRU JUL 17",
  // "THRU JAN 9 ’27", "OPENS SEP 12") — the raw start_date bypasses that
  // healing and printed corrupted opening dates. Trust the chip.
  if (event.isExhibition && event.dateChip) {
    return event.dateChip.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
  }
  // Only use structured dates if they exist and seem valid
  if (event.start_date) {
    try {
      const startDateStr = extractDateFromISO(event.start_date);
      const todayStr = getTodayLocal();
      const tomorrowStr = getTomorrowLocal();

      const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
      const [todayYear] = todayStr.split('-').map(Number);

      // Sanity check: only use if date is within reasonable range
      const yearsDiff = startYear - todayYear;
      if (yearsDiff < -1 || yearsDiff > 2) {
        return event.date || 'See Details';
      }

      // Check if it's today
      if (startDateStr === todayStr) {
        return 'Today';
      }

      // Check if it's tomorrow
      if (startDateStr === tomorrowStr) {
        return 'Tomorrow';
      }

      // Otherwise show formatted date
      const startDate = new Date(Date.UTC(startYear, startMonth - 1, startDay));
      const options = { month: 'short', day: 'numeric', timeZone: 'UTC' };
      return startDate.toLocaleDateString('en-US', options);
    } catch (e) {
      // If date parsing fails, fall back to text
      return event.date || 'See Details';
    }
  }

  // No structured date - show generic message for clarity
  // Don't show generic placeholders like "Upcoming", "This Week", "Today" without confirmation
  const genericTerms = ['upcoming', 'this week', 'this weekend', 'today', 'tonight', 'tomorrow'];
  const dateText = (event.date || '').toLowerCase();
  if (genericTerms.some(term => dateText === term)) {
    return 'See Details';
  }

  // If there's specific date text (like "Jan 24"), show it
  return event.date || 'See Details';
}

// Category fallback gradients for cards without images
const CATEGORY_GRADIENTS = {
  art: 'linear-gradient(135deg, #A0686B 0%, #8B4545 100%)',
  perks: 'linear-gradient(135deg, #B8956A 0%, #8B6347 100%)',
  community: 'linear-gradient(135deg, #8BA89B 0%, #6B8B7B 100%)',
  music: 'linear-gradient(135deg, #8B8B8B 0%, #5A5A5A 100%)',
  culinary: 'linear-gradient(135deg, #A8906E 0%, #8B6F47 100%)',
  fashion: 'linear-gradient(135deg, #6B6B6B 0%, #3D3D3D 100%)',
  lifestyle: 'linear-gradient(135deg, #C9A18E 0%, #B8826B 100%)',
};

// Category doodle illustrations — the brand fallback art
const CATEGORY_DOODLES = {
  art: 'assets/images/art-doodles.png',
  perks: 'assets/images/perks-doodles.png',
  community: 'assets/images/community-doodles.png',
};

// Card artwork: the doodle crop always paints underneath (hash of the title
// keeps the crop consistent per event); when the listing has a real
// photograph we layer it on top, and onerror peels it away to the doodle.
function eventCardArt(event) {
  let style;
  if (CATEGORY_DOODLES[event.category]) {
    let h = 0;
    for (let i = 0; i < event.name.length; i++) h = ((h << 5) - h) + event.name.charCodeAt(i) | 0;
    const x = Math.abs(h % 80) + 10;          // 10-89%
    const y = Math.abs((h >>> 8) % 80) + 10;  // 10-89%
    style = `background-image: url('${CATEGORY_DOODLES[event.category]}'); background-size: 280%; background-position: ${x}% ${y}%`;
  } else {
    style = `background: ${CATEGORY_GRADIENTS[event.category] || CATEGORY_GRADIENTS.community}`;
  }
  const img = event.image
    ? `<img class="event-art-photo" src="${esc(event.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`
    : '';
  return { style, img };
}

// Create Event Card
function createEventCard(event, index) {
  const isFavorited = favorites.includes(event.id);
  const isFree = event.isFree === true;
  const badgeDate = formatBadgeDate(event);
  const timeText = event.time && event.time !== 'See details' ? event.time : '';
  const displayName = esc(event.name.replace(/American Museum of Natural History/gi, 'AMNH'));
  const categoryName = esc(getCategoryName(event.category));
  const art = eventCardArt(event);

  return `
    <div class="event-card" data-id="${event.id}" data-category="${esc(event.category)}" data-start-date="${esc(event.start_date || '')}" data-end-date="${esc(event.end_date || '')}" role="article" tabindex="0">
      <div class="event-card-accent"></div>
      <div class="event-card-image" style="${art.style}">${art.img}</div>
      <div class="event-card-inner">
        <div class="event-card-top">
          <div class="event-card-meta">
            <span class="event-card-category">${categoryName}</span>
            <span class="event-card-date">${esc(badgeDate)}${timeText ? ' · ' + esc(timeText) : ''}</span>
          </div>
          <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-id="${event.id}" aria-label="${isFavorited ? 'Remove from' : 'Add to'} favorites">
            <svg viewBox="0 0 24 24" fill="${isFavorited ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>
        </div>
        <div class="event-card-body">
          <h3 class="event-name">${displayName}</h3>
        </div>
        <div class="event-card-footer">
          <div class="event-footer-location">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span>${esc(event.location)}</span>
          </div>
          <div class="event-footer-badges">
            ${event.soldOut === true ? '<span class="event-footer-soldout">Sold Out</span>' : ''}
            ${isFree ? '<span class="event-footer-free">Free</span>' : ''}
            ${(event.deals && Array.isArray(event.deals) && event.deals.length > 0) ? '<span class="event-footer-deals">Daily Deals</span>' : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

// Modal
let modalOpenedAt = 0; // see the ghost-click guard on the overlay listener

function openModal(eventId) {
  const event = events.find(e => e.id === eventId);
  if (!event) return;
  modalOpenedAt = Date.now();

  const isFavorited = favorites.includes(event.id);
  const isFree = event.isFree === true;
  const dateDisplay = formatEventDate(event);
  const categoryName = esc(getCategoryName(event.category));
  // sanitizeDescription() already HTML-escapes its output
  const descriptionText = sanitizeDescription(event.description);

  // Build info pills
  const datePill = `
    <div class="modal-info-pill">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <div class="modal-pill-content">
        <span class="modal-pill-label">When</span>
        <span class="modal-pill-value">${esc(formatBadgeDate(event))}</span>
        ${event.time && event.time !== 'See details' ? `<span class="modal-pill-sub">${esc(event.time)}</span>` : ''}
      </div>
    </div>`;

  const locationPill = `
    <div class="modal-info-pill">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
      <div class="modal-pill-content">
        <span class="modal-pill-label">Where</span>
        <span class="modal-pill-value">${esc(event.location)}</span>
        ${event.address ? `<span class="modal-pill-sub">${esc(event.address)}</span>` : ''}
      </div>
    </div>`;

  const freePill = isFree ? `<div class="modal-free-pill">Free Entry</div>` : '';
  const soldOutPill = event.soldOut === true ? `<div class="modal-soldout-pill">Sold Out</div>` : '';

  // Build highlights
  const highlightsHTML = (event.highlights && event.highlights.length > 0) ? `
    <div class="modal-highlights-section">
      <span class="modal-section-label">What to Expect</span>
      <div class="modal-highlights-grid">
        ${event.highlights.map(h => `
          <div class="modal-highlight-item">
            <div class="modal-highlight-check">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <span class="modal-highlight-text">${esc(h)}</span>
          </div>
        `).join('')}
      </div>
    </div>` : '';

  // Build deals section (daily drink/food specials)
  const dealsHTML = (event.deals && Array.isArray(event.deals) && event.deals.length > 0) ? `
    <div class="modal-deals-section">
      <span class="modal-section-label">Daily Specials</span>
      <div class="modal-deals-grid">
        ${event.deals.map(deal => `
          <div class="modal-deal-item">
            <div class="modal-deal-day">${esc(deal.day)}</div>
            <div class="modal-deal-text">${esc(deal.offer)}</div>
          </div>
        `).join('')}
      </div>
    </div>` : '';

  // CTA button — only emit the anchor for http(s) URLs; escape the href so a
  // scraped url can't break out of the attribute or inject javascript:/data:.
  const safeUrl = /^https?:\/\//i.test(event.url || '') ? esc(event.url) : '';
  const ctaHTML = safeUrl
    ? `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="modal-cta-btn">
        View Full Details
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
        </svg>
      </a>`
    : `<button class="modal-cta-btn rsvp-btn" onclick="handleRSVP(${event.id})">
        Reserve Your Spot
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>`;

  // Invitation-drawer photo hero: real event photograph with a warm treatment,
  // peeling away to the category doodle art on 404 (Salon fallback behavior).
  const modalArt = eventCardArt(event);
  const modalPhotoHero = `
    <div class="modal-photo-hero" style="${modalArt.style}">
      ${modalArt.img}
      <div class="modal-photo-grad" aria-hidden="true"></div>
      <span class="modal-photo-cat">${categoryName}</span>
    </div>`;

  const modalContent = `
    <div class="modal-handle"></div>

    ${modalPhotoHero}

    <!-- Hero — compact header with category swatch -->
    <div class="modal-hero">
      <div class="modal-hero-swatch" data-category="${esc(event.category)}">
        ${event.category === 'art' ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`
        : event.category === 'perks' ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`}
      </div>
      <div class="modal-hero-title-block">
        <span class="modal-hero-category">${categoryName}</span>
        <h2 class="modal-hero-title" id="modal-dynamic-title">${esc(event.name)}</h2>
        ${event.source ? `<div class="modal-source-badge"><span class="modal-source-dot"></span>${esc(event.source)}</div>` : ''}
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="modal-actions-bar">
      <button class="modal-action-btn ${isFavorited ? 'favorited' : ''}" id="modal-fav-btn"
        onclick="toggleFavorite(${event.id}); updateModalFavBtn(${event.id})"
        aria-label="${isFavorited ? 'Remove from favorites' : 'Save event'}">
        <svg viewBox="0 0 24 24" fill="${isFavorited ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        ${isFavorited ? 'Saved' : 'Save'}
      </button>
      <button class="modal-action-btn" onclick="shareEvent(${event.id})" aria-label="Share event">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        Share
      </button>
      <button class="modal-action-btn" onclick="downloadICS(${event.id})" aria-label="Add to calendar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Calendar
      </button>
    </div>

    <!-- Info Pills -->
    <div class="modal-info-pills">
      ${datePill}
      ${locationPill}
      ${freePill}
      ${soldOutPill}
    </div>

    <!-- Description (omitted entirely when the scrape had only template junk) -->
    ${descriptionText ? `
    <div class="modal-body-content">
      <span class="modal-section-label">About This Event</span>
      <p class="modal-description">${descriptionText}</p>
    </div>` : ''}

    <!-- Highlights -->
    ${highlightsHTML}

    <!-- Deals -->
    ${dealsHTML}

    <!-- CTA -->
    <div class="modal-cta-section">
      <div class="modal-cta-divider"></div>
      ${ctaHTML}
    </div>
  `;

  document.getElementById('modal-body').innerHTML = modalContent;

  // Set dynamic aria-labelledby to the modal title
  const modalTitleEl = document.querySelector('.modal-hero-title');
  if (modalTitleEl) {
    modalTitleEl.id = 'modal-dynamic-title';
    modalOverlay.setAttribute('aria-labelledby', 'modal-dynamic-title');
  }

  // Remember which element had focus before opening
  modalOverlay._previousFocus = document.activeElement;

  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Move focus into the modal (close button)
  requestAnimationFrame(() => {
    modalClose.focus();
  });

  // Focus trapping
  modalOverlay._trapFocus = (e) => {
    if (e.key !== 'Tab') return;
    const focusable = modalOverlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  modalOverlay.addEventListener('keydown', modalOverlay._trapFocus);
}

function closeModal() {
  // Remove focus trap
  if (modalOverlay._trapFocus) {
    modalOverlay.removeEventListener('keydown', modalOverlay._trapFocus);
    modalOverlay._trapFocus = null;
  }

  modalOverlay.classList.remove('active');
  document.body.style.overflow = '';

  // Restore focus to the element that opened the modal
  if (modalOverlay._previousFocus) {
    modalOverlay._previousFocus.focus();
    modalOverlay._previousFocus = null;
  }
}

function handleRSVP(eventId) {
  const event = events.find(e => e.id === eventId);
  closeModal();
  showToast(`You're on the list for ${event.name}`);
}

function updateModalFavoriteBtn(eventId) {
  const isFavorited = favorites.includes(eventId);
  const btn = document.querySelector('.modal-actions .btn-secondary');
  if (btn) {
    btn.textContent = isFavorited ? 'Remove from Favorites' : 'Add to Favorites';
  }
}

// Update the new modal favorite button state
function updateModalFavBtn(eventId) {
  const isFavorited = favorites.includes(eventId);
  const btn = document.getElementById('modal-fav-btn');
  if (!btn) return;
  btn.classList.toggle('favorited', isFavorited);
  const svg = btn.querySelector('svg');
  if (svg) svg.setAttribute('fill', isFavorited ? 'currentColor' : 'none');
  // Update text node (last child)
  const textNodes = [...btn.childNodes].filter(n => n.nodeType === 3);
  if (textNodes.length) textNodes[textNodes.length - 1].textContent = isFavorited ? ' Saved' : ' Save';
  btn.setAttribute('aria-label', isFavorited ? 'Remove from favorites' : 'Save event');
}

// Favorites
function toggleFavorite(eventId) {
  // Normalize: dataset ids arrive as strings; a string in the array would
  // never match the numeric check and the heart could only ever add
  eventId = typeof eventId === 'string' ? parseInt(eventId, 10) : eventId;
  const wasAdded = !favorites.includes(eventId);
  if (wasAdded) {
    favorites.push(eventId);
  } else {
    favorites = favorites.filter(id => id !== eventId);
  }

  localStorage.setItem('soireeFavorites', JSON.stringify(favorites));
  updateFavoriteBadge();

  // Pulse the heart button that was clicked
  if (wasAdded) {
    const btn = document.querySelector(`.favorite-btn[data-id="${eventId}"]`);
    if (btn) {
      btn.classList.add('fav-pulse');
      setTimeout(() => btn.classList.remove('fav-pulse'), 400);
    }
  }

  // Re-render current view
  const activeNav = document.querySelector('.nav-item.active');
  if (activeNav?.dataset.view === 'favorites') {
    renderFavorites();
  } else {
    renderEvents();
  }

  // Refresh desktop gallery sidebar favorite states
  if (window.innerWidth >= 768 && document.getElementById('gallery-featured')) {
    renderFeaturedLayout();
  }

  // Mobile stack: repaint so the heart's filled state is visible immediately.
  // Never mid-swipe — completeSwipe() toggles before its fly-out transition,
  // and a repaint here would destroy the animating card.
  if (window.innerWidth < 768 && !isSwipeAnimating && document.getElementById('gallery-stack-cards')) {
    renderStackCards();
  }
}

function updateFavoriteBadge() {
  const badge = document.querySelector('.favorite-badge');
  if (badge) {
    badge.textContent = favorites.length;
    badge.style.display = favorites.length > 0 ? 'block' : 'none';
  }
}

// Stats & Analytics
async function trackPageView() {
  if (!USE_API) return;

  try {
    await fetch(`${API_BASE_URL}/api/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error tracking page view:', error);
  }
}

async function loadStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/stats`);
    const data = await response.json();

    if (data.success && data.stats) {
      const formatNumber = (num) => num ? num.toLocaleString('en-US') : '—';

      const statEls = ['stat-events', 'stat-views', 'stat-unique'];
      const vals = [
        formatNumber(data.stats.totalEventsScraped || data.stats.totalEvents),
        formatNumber(data.stats.pageViews),
        formatNumber(data.stats.uniqueEvents)
      ];
      statEls.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el) {
          setTimeout(() => {
            el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            el.style.opacity = '0';
            el.style.transform = 'translateY(6px)';
            setTimeout(() => {
              el.textContent = vals[i];
              el.style.opacity = '1';
              el.style.transform = 'translateY(0)';
            }, 120);
          }, 200 + i * 150);
        }
      });
    }
  } catch (error) {
    console.error('Error loading stats:', error);
    ['stat-events', 'stat-views', 'stat-unique'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
  }

  // Load technical stats (also updates stat-sources)
  loadTechStats();
}

// Source-health telemetry: paints the SOURCE HEALTH module and, when any
// source is reporting below its expected level, an alert banner.
async function loadSourceHealth() {
  const listEl = document.getElementById('source-health-list');
  const alertEl = document.getElementById('source-alert');
  const alertText = document.getElementById('source-alert-text');
  const idEl = document.getElementById('source-health-id');
  if (!listEl) return;
  try {
    const resp = await fetch(`${API_BASE_URL}/api/source-health`);
    const data = await resp.json();
    const sources = (data && data.sources) || [];
    const summary = (data && data.summary) || { total: 0, low: 0, down: 0 };

    if (!sources.length) {
      listEl.innerHTML = '<div class="source-health-loading">No source telemetry yet — check back after the next sync.</div>';
      if (alertEl) alertEl.classList.add('hidden');
      return;
    }

    // Sort rows by severity (down > low > learning > ok) so the most urgent
    // sources surface at the top regardless of API ordering.
    const severityRank = { down: 0, low: 1, learning: 2, ok: 3 };
    const ordered = [...sources].sort(
      (a, b) => (severityRank[a.status] ?? 9) - (severityRank[b.status] ?? 9)
    );

    // Drive the About "arch status" badge from live health: any down → red
    // "Degraded", any low → amber "Partial", else green "Operational".
    updateArchStatus(ordered);

    listEl.innerHTML = ordered.map(s => {
      const exp = (s.status === 'low' || s.status === 'down') && s.expected > 0
        ? ` <span class="sh-exp">/ ~${s.expected}</span>` : '';
      return `<div class="sh-row ${esc(s.status)}">
        <span class="sh-dot" aria-hidden="true"></span>
        <span class="sh-name" title="${esc(s.source)}">${esc(s.source)}</span>
        <span class="sh-count">${s.current}${exp}</span>
      </div>`;
    }).join('');
    if (idEl) idEl.textContent = 'SRC-' + String(summary.total).padStart(2, '0');

    // Alert banner: down sources are the priority; then low sources.
    if (alertEl && alertText) {
      const down = sources.filter(s => s.status === 'down');
      const low = sources.filter(s => s.status === 'low');
      if (down.length || low.length) {
        alertEl.classList.toggle('is-down', down.length > 0);
        const names = [...down, ...low].slice(0, 4)
          .map(s => `${esc(s.source)} (${s.current})`).join(', ');
        const more = (down.length + low.length) > 4 ? `, +${down.length + low.length - 4} more` : '';
        const n = down.length + low.length;
        alertText.innerHTML = `<b>${n} source${n !== 1 ? 's' : ''}</b> reporting below expected — ${names}${more}.`;
        alertEl.classList.remove('hidden');
      } else {
        alertEl.classList.add('hidden');
      }
    }
  } catch (err) {
    console.error('source-health load failed:', err);
    listEl.innerHTML = '<div class="source-health-loading">Telemetry unavailable.</div>';
    if (alertEl) alertEl.classList.add('hidden');
  }
}

// Paint the About "System Architecture" status badge from live source health.
// any down → red "Degraded"; else any low → amber "Partial"; else green
// "Operational". Reflects reality instead of the hardcoded "Operational".
function updateArchStatus(sources) {
  const badge = document.querySelector('.about-arch-status');
  if (!badge) return;
  const dot = badge.querySelector('.about-arch-dot');
  const hasDown = sources.some(s => s.status === 'down');
  const hasLow = sources.some(s => s.status === 'low');

  let label, cls;
  if (hasDown) { label = 'Degraded'; cls = 'is-down'; }
  else if (hasLow) { label = 'Partial'; cls = 'is-low'; }
  else { label = 'Operational'; cls = 'is-ok'; }

  badge.classList.remove('is-down', 'is-low', 'is-ok');
  badge.classList.add(cls);

  // Rebuild text while preserving the dot element.
  badge.textContent = '';
  if (dot) badge.appendChild(dot);
  else {
    const d = document.createElement('span');
    d.className = 'about-arch-dot';
    badge.appendChild(d);
  }
  badge.appendChild(document.createTextNode(label));
}

async function loadTechStats() {
  try {
    // Reuse the cached /api/events payload instead of re-fetching. Only when
    // the cache is cold do we hit the network (and can time it).
    let data;
    if (cachedEventsResponse) {
      data = cachedEventsResponse;
    } else {
      const startTime = performance.now();
      data = await getEventsResponse();
      const endTime = performance.now();
      const apiSpeed = Math.round(endTime - startTime);
      const apiSpeedEl = document.getElementById('api-speed');
      if (apiSpeedEl) apiSpeedEl.textContent = `~${apiSpeed}ms`;
    }

    // Get last scrape time from most recent event
    if (data.success && data.events && data.events.length > 0) {
      const mostRecent = data.events.reduce((latest, event) => {
        const eventTime = new Date(event.scraped_at || event.created_at);
        const latestTime = new Date(latest.scraped_at || latest.created_at);
        return eventTime > latestTime ? event : latest;
      });

      const lastScrape = new Date(mostRecent.scraped_at || mostRecent.created_at);
      const now = new Date();
      const diffHours = Math.floor((now - lastScrape) / (1000 * 60 * 60));

      let timeText;
      if (diffHours < 1) {
        const diffMins = Math.floor((now - lastScrape) / (1000 * 60));
        timeText = `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
      } else if (diffHours < 24) {
        timeText = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      } else {
        const diffDays = Math.floor(diffHours / 24);
        timeText = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
      }

      document.getElementById('last-scrape').textContent = timeText;

      // Count unique sources (approximate based on URL patterns)
      const sources = new Set();
      data.events.forEach(event => {
        if (event.url) {
          try {
            const hostname = new URL(event.url).hostname;
            sources.add(hostname);
          } catch (e) { }
        }
      });

      const sourceCountEl = document.getElementById('source-count');
      if (sources.size > 0 && sourceCountEl) {
        sourceCountEl.textContent = `${sources.size} curated sources`;
      }
      // Update the about page metrics bar source count
      const statSourcesEl = document.getElementById('stat-sources');
      if (sources.size > 0 && statSourcesEl) {
        statSourcesEl.textContent = `${sources.size}+`;
      }
    }
  } catch (error) {
    console.error('Error loading tech stats:', error);
    const lastScrapeEl = document.getElementById('last-scrape');
    if (lastScrapeEl) lastScrapeEl.textContent = 'Recently';
    const apiSpeedFallback = document.getElementById('api-speed');
    if (apiSpeedFallback) apiSpeedFallback.textContent = '~200ms';
  }
}

// Utilities
function getCategoryName(category) {
  const names = {
    art: 'Art',
    perks: 'Perks & Pop-Ups',
    community: 'Culture & Community'
  };
  return names[category] || category;
}

// Share event
function shareEvent(eventId) {
  const event = events.find(e => e.id === eventId);
  if (!event) return;

  // Use Web Share API if available
  if (navigator.share) {
    navigator.share({
      title: event.name,
      text: `Check out ${event.name} at ${event.location}`,
      url: event.url || window.location.href
    }).catch(() => {
      // Fallback to copy
      fallbackShare(event);
    });
  } else {
    fallbackShare(event);
  }
}

function fallbackShare(event) {
  const url = event.url || window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Link copied to clipboard!');
  }).catch(() => {
    showToast('Share: ' + url);
  });
}

// Calendar export (ICS)
function downloadICS(eventId) {
  const event = events.find(e => e.id === eventId);
  if (!event) return;

  // Build start/end dates
  let dtStart, dtEnd;
  if (event.start_date) {
    dtStart = event.start_date.replace(/[-:]/g, '').replace(/\.\d+/, '').replace('T', 'T');
    if (!dtStart.includes('T')) dtStart += 'T190000';
    if (event.end_date && event.end_date !== event.start_date) {
      dtEnd = event.end_date.replace(/[-:]/g, '').replace(/\.\d+/, '').replace('T', 'T');
      if (!dtEnd.includes('T')) dtEnd += 'T230000';
    } else {
      // Default 3-hour duration
      dtEnd = dtStart.replace(/T(\d{2})/, (_, h) => 'T' + String(Math.min(23, parseInt(h) + 3)).padStart(2, '0'));
    }
  } else {
    // No structured date — use tomorrow at 7pm as placeholder
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const pad = (n) => String(n).padStart(2, '0');
    dtStart = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T190000`;
    dtEnd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T220000`;
  }

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Soiree//Event//EN',
    'BEGIN:VEVENT',
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${event.name}`,
    `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
    `LOCATION:${event.address || event.location || ''}`,
    event.url ? `URL:${event.url}` : '',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.name.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Calendar event downloaded');
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// Rotating title text
let rotatingInterval = null;

function initRotatingTitle() {
  startRotating();
}

function startRotating() {
  stopRotating();
  const words = document.querySelectorAll('.title-word');
  if (words.length === 0) return;

  let current = 0;
  words.forEach((w, i) => {
    w.classList.remove('active', 'exit');
    if (i === 0) w.classList.add('active');
  });

  rotatingInterval = setInterval(() => {
    const prev = current;
    current = (current + 1) % words.length;

    words[prev].classList.add('exit');
    words[prev].classList.remove('active');

    setTimeout(() => {
      words[prev].classList.remove('exit');
    }, 500);

    words[current].classList.add('active');
  }, 2000);
}

function stopRotating() {
  if (rotatingInterval) {
    clearInterval(rotatingInterval);
    rotatingInterval = null;
  }
}

function setFixedTitle(text) {
  stopRotating();
  const panel = document.getElementById('hero-title-panel');
  const words = document.querySelectorAll('.title-word');
  // Fade out, swap, fade in
  if (panel) panel.style.opacity = '0';
  setTimeout(() => {
    words.forEach(w => w.classList.remove('active', 'exit'));
    let found = false;
    for (const w of words) {
      if (w.textContent.trim().toLowerCase() === text.toLowerCase()) {
        w.classList.add('active');
        found = true;
        break;
      }
    }
    if (!found) { words[0].textContent = text; words[0].classList.add('active'); }
    if (panel) panel.style.opacity = '1';
  }, 200);
}

// ============================================================================
// NETWORK GRAPH VISUALIZATION
// ============================================================================

function lightenHex(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}


// Honour the OS "reduce motion" setting: when set, canvas visualizations
// paint one static frame and skip the requestAnimationFrame loop.
const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Activity Chart (scrape + instagram timeline) ──────────────────
async function initActivityChart() {
  const canvas = document.getElementById('activity-chart');
  if (!canvas || canvas.hasAttribute('data-init')) return;
  canvas.setAttribute('data-init', 'true');

  // Fetch timeline data
  let timeline = [];
  try {
    const resp = await fetch(`${API_BASE_URL}/api/stats`);
    const data = await resp.json();
    if (data.timeline) timeline = data.timeline;
  } catch (e) { /* ignore */ }

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || 300;
  const h = rect.height || 140;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  // Build 30-day date array
  const days = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  // Map timeline data to day buckets
  const scrapeByDay = {};
  const igByDay = {};
  for (const entry of timeline) {
    const dateStr = typeof entry.date === 'string' ? entry.date.slice(0, 10) : new Date(entry.date).toISOString().slice(0, 10);
    if (entry.type === 'scrape') scrapeByDay[dateStr] = (scrapeByDay[dateStr] || 0) + Number(entry.count);
    if (entry.type === 'instagram') igByDay[dateStr] = (igByDay[dateStr] || 0) + Number(entry.count);
  }

  const scrapeData = days.map(d => scrapeByDay[d] || 0);
  const igData = days.map(d => igByDay[d] || 0);
  const maxVal = Math.max(1, ...scrapeData, ...igData);

  // Colors
  const scrapeColor = '#7C6AE8';
  const scrapeGlow = 'rgba(124, 106, 232, 0.2)';
  const igColor = '#FF6B9D';
  const igGlow = 'rgba(255, 107, 157, 0.25)';
  const gridColor = 'rgba(255, 255, 255, 0.05)';
  const labelColor = 'rgba(255, 255, 255, 0.25)';

  // Chart margins
  const ml = 4, mr = 4, mt = 8, mb = 18;
  const cw = w - ml - mr;
  const ch = h - mt - mb;
  const barW = Math.max(2, (cw / days.length) * 0.35);
  const gap = 2;

  // Clear
  ctx.clearRect(0, 0, w, h);

  // Grid lines (3 horizontal)
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 4; i++) {
    const y = mt + (ch / 3) * i;
    ctx.beginPath();
    ctx.moveTo(ml, y);
    ctx.lineTo(w - mr, y);
    ctx.stroke();
  }

  // Draw bars
  for (let i = 0; i < days.length; i++) {
    const x = ml + (i / (days.length - 1)) * cw;
    const sv = scrapeData[i];
    const iv = igData[i];

    // Scrape bar
    if (sv > 0) {
      const bh = (sv / maxVal) * ch;
      const y = mt + ch - bh;

      // Glow
      ctx.shadowColor = scrapeGlow;
      ctx.shadowBlur = 8;
      ctx.fillStyle = scrapeColor;
      ctx.beginPath();
      ctx.roundRect(x - barW - gap / 2, y, barW, bh, [2, 2, 0, 0]);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Instagram bar
    if (iv > 0) {
      const bh = Math.max(6, (iv / maxVal) * ch);
      const y = mt + ch - bh;

      ctx.shadowColor = igGlow;
      ctx.shadowBlur = 10;
      ctx.fillStyle = igColor;
      ctx.beginPath();
      ctx.roundRect(x + gap / 2, y, barW, bh, [2, 2, 0, 0]);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // Date labels (show every ~7 days)
  ctx.fillStyle = labelColor;
  ctx.font = '9px Jost, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < days.length; i += 7) {
    const x = ml + (i / (days.length - 1)) * cw;
    const d = new Date(days[i] + 'T12:00:00');
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    ctx.fillText(label, x, h - 2);
  }

  // Empty state
  if (timeline.length === 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = 'italic 12px Jost, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Collecting activity data...', w / 2, h / 2);
  }
}

async function initNetworkGraph() {
  const canvas = document.getElementById('network-graph');
  if (!canvas) return;

  // Read canvas dimensions before the async fetch — getBoundingClientRect forces
  // a synchronous layout reflow so we get the real width even right after unhide.
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || 360; // fallback if layout hasn't settled
  const isMobile = width < 480;
  const height = isMobile ? Math.round(width * 0.85) : Math.round(width * 0.9);

  // Reuse the cached /api/events payload (not filtered by region) rather than
  // firing a third duplicate fetch.
  let allEvents = [];
  try {
    const data = await getEventsResponse();
    if (data.success && data.events) {
      allEvents = data.events;
    }
  } catch (error) {
    console.error('Failed to fetch events for network graph:', error);
    // continue — dashboard elements still need to initialize
  }

  // ── Dashboard elements: always initialize (each guards itself) ─────────────

  // Last Scrape timestamp
  const scrapeEl = document.getElementById('last-scrape');
  if (scrapeEl && !scrapeEl.hasAttribute('data-init')) {
    scrapeEl.setAttribute('data-init', 'true');
    scrapeEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' EST';
  }

  // Activity Log
  const techLog = document.getElementById('js-tech-log');
  if (techLog && !techLog.hasAttribute('data-init')) {
    techLog.setAttribute('data-init', 'true');
    const logs = [
      { msg: 'System initialized', type: 'success' },
      { msg: 'Connecting to database...', type: 'info' },
      { msg: 'Fetching event data streams...', type: 'info' },
      { msg: `Parsing JSON payload (${(allEvents.length * 0.5).toFixed(1)} KB)`, type: 'success' },
      { msg: 'Analyzing geospatial vectors...', type: 'info' },
      { msg: 'Node clustering active', type: 'success' },
      { msg: 'UI Layer mounted', type: 'success' }
    ];
    const addLog = (msg, type = 'info') => {
      const entry = document.createElement('div');
      entry.className = 'tech-log-entry';
      const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      entry.innerHTML = `<span class="tech-log-ts" style="color:#aaa;">[${time}]</span><span class="tech-log-msg ${type}" style="color:${type === 'success' ? '#4CAF50' : '#555'}">${msg}</span>`;
      techLog.prepend(entry);
      if (techLog.children.length > 20) techLog.lastChild.remove();
    };
    logs.forEach(l => addLog(l.msg, l.type));
    setInterval(() => {
      const verbs = ['Ping', 'Sync', 'Optimizing', 'Calibrating', 'Verifying'];
      const nouns = ['Node', 'Packet', 'Latency', 'Cache', 'Buffer'];
      addLog(`${verbs[Math.floor(Math.random() * verbs.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]} ${Math.floor(Math.random() * 999)}`, 'info');
    }, 2500);
  }

  // Traffic Chart
  const trafficCanvas = document.getElementById('traffic-chart');
  if (trafficCanvas && !trafficCanvas.hasAttribute('init')) {
    trafficCanvas.setAttribute('init', 'true');
    const tCtx = trafficCanvas.getContext('2d');
    const tDpr = window.devicePixelRatio || 1;
    let points = new Array(60).fill(60).map((_, i) => 60 + Math.sin(i * 0.5) * 10 + Math.random() * 10);

    function frame() {
      const r = trafficCanvas.getBoundingClientRect();
      if (r.width === 0) return requestAnimationFrame(frame);
      if (trafficCanvas.width !== Math.floor(r.width * tDpr)) {
        trafficCanvas.width = r.width * tDpr;
        trafficCanvas.height = r.height * tDpr;
        tCtx.scale(tDpr, tDpr);
      }
      const w = r.width, h = r.height;
      tCtx.clearRect(0, 0, w, h);
      tCtx.strokeStyle = '#f9f9f9';
      tCtx.lineWidth = 1;
      tCtx.beginPath();
      for (let x = 0; x < w; x += w / 10) { tCtx.moveTo(x, 0); tCtx.lineTo(x, h); }
      tCtx.stroke();
      tCtx.beginPath();
      points.forEach((p, i) => {
        const x = (i / (points.length - 1)) * w;
        const y = h - (p / 100) * h;
        if (i === 0) tCtx.moveTo(x, y); else tCtx.lineTo(x, y);
      });
      tCtx.lineTo(w, h); tCtx.lineTo(0, h); tCtx.closePath();
      const grad = tCtx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(76,175,80,0.15)');
      grad.addColorStop(1, 'rgba(76,175,80,0)');
      tCtx.fillStyle = grad; tCtx.fill();
      tCtx.beginPath();
      points.forEach((p, i) => {
        const x = (i / (points.length - 1)) * w;
        const y = h - (p / 100) * h;
        if (i === 0) tCtx.moveTo(x, y); else tCtx.lineTo(x, y);
      });
      tCtx.strokeStyle = '#4CAF50'; tCtx.lineWidth = 2; tCtx.lineJoin = 'round'; tCtx.stroke();
      // Reduced-motion: paint one frame, don't loop.
      if (!prefersReducedMotion()) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // Live ticker mutates the chart data — skip when motion is reduced.
    if (!prefersReducedMotion()) setInterval(() => {
      points.shift();
      const last = points[points.length - 1] || 50;
      let next = Math.max(20, Math.min(95, last + (Math.random() - 0.5) * 15));
      points.push(next);
      const rpsEl = document.getElementById('traffic-rps');
      if (rpsEl) rpsEl.textContent = Math.floor(next * 2 + 100);
      const deltaEl = document.querySelector('.traffic-delta');
      if (deltaEl) {
        const change = ((next - last) / last) * 100;
        deltaEl.textContent = (change > 0 ? '▲' : '▼') + Math.abs(change).toFixed(1) + '%';
        deltaEl.style.color = change > 0 ? '#4CAF50' : '#FF9800';
      }
    }, 1000);
  }

  // ── Topology canvas: only if events available and not already drawn ─────────
  if (allEvents.length === 0 || canvas.hasAttribute('data-init')) return;
  canvas.setAttribute('data-init', 'true');

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // Set canvas size — responsive height for mobile
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const cx = width / 2;
  const cy = height / 2;

  // Color + label maps
  const NODE_COLORS = {
    'nyc': '#4A90E2',
    'hoboken-jc': '#6BCB77',
    'north-nj': '#9370DB',
    'central-nj': '#FFB347',
    'south-nj': '#FF6B6B',
    'jersey-shore': '#00CED1'
  };
  const REGION_LABELS = {
    'nyc': 'NYC',
    'hoboken-jc': 'HBK/JC',
    'north-nj': 'N.NJ',
    'central-nj': 'C.NJ',
    'south-nj': 'S.NJ',
    'jersey-shore': 'SHORE'
  };

  // Group events by source
  const sourceMap = new Map();
  allEvents.forEach(e => {
    if (!sourceMap.has(e.source)) sourceMap.set(e.source, []);
    sourceMap.get(e.source).push(e);
  });

  const sources = Array.from(sourceMap.keys());
  const orbitRadius = Math.min(width, height) * 0.32;

  function getRegion(events) {
    const rc = { 'nyc': 0, 'hoboken-jc': 0, 'north-nj': 0, 'central-nj': 0, 'south-nj': 0, 'jersey-shore': 0 };
    events.forEach(e => {
      const loc = (e.location || '').toLowerCase();
      const src = (e.source || '').toLowerCase();
      if (loc.includes('hoboken') || loc.includes('jersey city')) rc['hoboken-jc']++;
      else if (loc.includes('shore') || loc.includes('beach') || loc.includes('asbury') || loc.includes('cape may') || loc.includes('wildwood') || loc.includes('ocean')) rc['jersey-shore']++;
      else if (loc.includes('camden') || loc.includes('cherry hill')) rc['south-nj']++;
      else if (src.includes('visit nj') || loc.includes('princeton') || loc.includes('trenton') || loc.includes('new brunswick')) rc['central-nj']++;
      else if (loc.includes('newark') || loc.includes('paterson') || loc.includes('montclair')) rc['north-nj']++;
      else rc['nyc']++;
    });
    let maxRegion = 'nyc', maxCount = -1;
    for (const [r, c] of Object.entries(rc)) { if (c > maxCount) { maxCount = c; maxRegion = r; } }
    return maxRegion;
  }

  // Category definitions (middle ring)
  const CATEGORY_COLORS = {
    art: '#9B8FE8',
    perks: '#50B8D8',
    community: '#E88060'
  };
  const CATEGORY_LABELS = {
    art: 'ART',
    perks: 'PERKS',
    community: 'CULTURE'
  };
  const ALL_CATEGORIES = ['art', 'perks', 'community'];

  // Group events by category
  const categoryMap = new Map();
  ALL_CATEGORIES.forEach(cat => categoryMap.set(cat, []));
  allEvents.forEach(e => {
    if (e.category && categoryMap.has(e.category)) {
      categoryMap.get(e.category).push(e);
    }
  });

  // Track which categories each source feeds
  const sourceCategories = new Map();
  allEvents.forEach(e => {
    if (!sourceCategories.has(e.source)) sourceCategories.set(e.source, new Set());
    if (e.category) sourceCategories.get(e.source).add(e.category);
  });

  // All known sources (including ones that may currently return zero events)
  const ALL_SOURCES = ['TimeOut NY', 'NYC For Free', 'MoMA', 'AMNH', 'Whitney Museum', 'Guggenheim', 'New Museum', 'The Local Girl'];
  const allSources = [
    ...sources,
    ...ALL_SOURCES.filter(s => !sourceMap.has(s))
  ];

  const nodeScale = isMobile ? 0.7 : 1;
  const outerRadius = Math.min(width, height) * 0.40;
  const innerRadius = Math.min(width, height) * 0.22;

  const maxCatEvents = Math.max(...ALL_CATEGORIES.map(c => categoryMap.get(c).length), 1);
  const maxSrcEvents = sources.length > 0 ? Math.max(...sources.map(s => sourceMap.get(s).length), 1) : 1;

  // Build node array
  const nodes = [];

  // Node 0: Soirée center
  nodes.push({
    x: cx, y: cy,
    radius: Math.round(15 * nodeScale),
    color: '#C1694F',
    vx: 0, vy: 0, fixed: true,
    label: 'SOIRÉE',
    type: 'center',
    eventCount: allEvents.length,
    pulsePhase: 0,
    targetRadius: 0
  });

  // Nodes 1..7: category nodes (middle ring)
  const catNodeStart = 1;
  ALL_CATEGORIES.forEach((cat, i) => {
    const evts = categoryMap.get(cat) || [];
    const angle = (i / ALL_CATEGORIES.length) * Math.PI * 2 - Math.PI / 2;
    const r = Math.max(Math.round((5 + (evts.length / maxCatEvents) * 10) * nodeScale), Math.round(4 * nodeScale));
    nodes.push({
      x: cx + Math.cos(angle) * innerRadius,
      y: cy + Math.sin(angle) * innerRadius,
      radius: r,
      color: CATEGORY_COLORS[cat],
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      fixed: false,
      label: CATEGORY_LABELS[cat],
      type: 'category',
      category: cat,
      eventCount: evts.length,
      pulsePhase: Math.random() * Math.PI * 2,
      targetRadius: innerRadius
    });
  });

  // Nodes N+: source nodes (outer ring)
  const srcNodeStart = nodes.length;
  allSources.forEach((source, i) => {
    const evts = sourceMap.get(source) || [];
    const isDead = evts.length === 0;
    const region = isDead ? null : getRegion(evts);
    const angle = (i / allSources.length) * Math.PI * 2 - Math.PI / 2;
    const r = isDead ? Math.round(4 * nodeScale) : Math.round((5 + (evts.length / maxSrcEvents) * 10) * nodeScale);
    nodes.push({
      x: cx + Math.cos(angle) * outerRadius,
      y: cy + Math.sin(angle) * outerRadius,
      radius: r,
      color: isDead ? '#3a3a3a' : (NODE_COLORS[region] || '#4A90E2'),
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      fixed: false,
      label: source.split(' ').slice(0, 2).join(' ').toUpperCase(),
      type: 'source',
      source,
      eventCount: evts.length,
      pulsePhase: Math.random() * Math.PI * 2,
      dead: isDead,
      targetRadius: outerRadius
    });
  });

  // Two-hop packets: source → category → center
  const packets = [];

  function spawnSourcePacket() {
    const liveIdxs = [];
    for (let i = srcNodeStart; i < nodes.length; i++) {
      if (!nodes[i].dead) liveIdxs.push(i);
    }
    if (!liveIdxs.length) return;
    const srcIdx = liveIdxs[Math.floor(Math.random() * liveIdxs.length)];
    const srcCats = sourceCategories.get(nodes[srcIdx].source);
    if (!srcCats || !srcCats.size) return;
    const catArr = Array.from(srcCats);
    const targetCat = catArr[Math.floor(Math.random() * catArr.length)];
    const catIdx = nodes.findIndex(n => n.type === 'category' && n.category === targetCat);
    if (catIdx === -1) return;
    packets.push({
      fromIdx: srcIdx, toIdx: catIdx,
      t: 0, speed: 0.005 + Math.random() * 0.004,
      color: nodes[srcIdx].color,
      size: 2 + Math.random() * 1.5,
      phase: 1
    });
  }

  function spawnCategoryPacket(catIdx) {
    packets.push({
      fromIdx: catIdx, toIdx: 0,
      t: 0, speed: 0.007 + Math.random() * 0.004,
      color: nodes[catIdx].color,
      size: 2.5 + Math.random() * 1.5,
      phase: 2
    });
  }

  for (let i = 0; i < Math.min(allSources.length, 6); i++) spawnSourcePacket();

  let frame_t = 0;
  let lastPacketSpawn = 0;

  function animate() {
    frame_t++;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#080d18';
    ctx.fillRect(0, 0, width, height);

    // Radial grid circles
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    for (let r = 55; r < Math.max(width, height) * 1.2; r += 55) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Radial spokes
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * width, cy + Math.sin(a) * width);
      ctx.stroke();
    }

    // --- Physics (each node orbits its own target radius) ---
    nodes.forEach((node, i) => {
      if (node.fixed) return;
      const dx = cx - node.x;
      const dy = cy - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const force = (dist - node.targetRadius) * 0.008;
      node.vx += (dx / dist) * force;
      node.vy += (dy / dist) * force;

      node.vx += (-dy / dist) * 0.009;
      node.vy += (dx / dist) * 0.009;

      node.vx *= 0.92;
      node.vy *= 0.92;

      // Repulsion within same ring type only
      nodes.forEach((other, j) => {
        if (i === j || other.type !== node.type) return;
        const dx2 = other.x - node.x;
        const dy2 = other.y - node.y;
        const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 0.001;
        const minDist = node.radius + other.radius + 20;
        if (dist2 < minDist) {
          const repel = (minDist - dist2) * 0.045;
          node.vx -= (dx2 / dist2) * repel;
          node.vy -= (dy2 / dist2) * repel;
        }
      });

      node.x += node.vx;
      node.y += node.vy;

      const pad = node.radius + 12;
      if (node.x < pad) node.vx += 0.6;
      if (node.x > width - pad) node.vx -= 0.6;
      if (node.y < pad) node.vy += 0.6;
      if (node.y > height - pad) node.vy -= 0.6;
    });

    // --- Connections: source → category ---
    for (let i = srcNodeStart; i < nodes.length; i++) {
      const srcNode = nodes[i];
      if (srcNode.dead) continue;
      const srcCats = sourceCategories.get(srcNode.source) || new Set();
      for (let j = catNodeStart; j < srcNodeStart; j++) {
        const catNode = nodes[j];
        if (srcCats.has(catNode.category)) {
          const alpha = 0.10 + 0.05 * Math.sin(frame_t * 0.015 + i * 0.7 + j * 0.5);
          ctx.beginPath();
          ctx.strokeStyle = srcNode.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
          ctx.lineWidth = 0.7;
          ctx.moveTo(srcNode.x, srcNode.y);
          ctx.lineTo(catNode.x, catNode.y);
          ctx.stroke();
        }
      }
    }

    // --- Connections: category → center ---
    for (let i = catNodeStart; i < srcNodeStart; i++) {
      const catNode = nodes[i];
      const alpha = 0.28 + 0.10 * Math.sin(frame_t * 0.018 + i * 1.3);
      const hexAlpha = Math.round(alpha * 255).toString(16).padStart(2, '0');
      const grad = ctx.createLinearGradient(nodes[0].x, nodes[0].y, catNode.x, catNode.y);
      grad.addColorStop(0, `rgba(212,175,55,${alpha})`);
      grad.addColorStop(1, catNode.color + hexAlpha);
      ctx.beginPath();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.2;
      ctx.moveTo(nodes[0].x, nodes[0].y);
      ctx.lineTo(catNode.x, catNode.y);
      ctx.stroke();
    }

    // --- Data packets ---
    for (let idx = packets.length - 1; idx >= 0; idx--) {
      const pkt = packets[idx];
      pkt.t += pkt.speed;
      if (pkt.t >= 1) {
        if (pkt.phase === 1) spawnCategoryPacket(pkt.toIdx);
        packets.splice(idx, 1);
        continue;
      }
      const from = nodes[pkt.fromIdx];
      const to = nodes[pkt.toIdx];
      if (!from || !to) continue;
      const px = from.x + (to.x - from.x) * pkt.t;
      const py = from.y + (to.y - from.y) * pkt.t;
      const halo = ctx.createRadialGradient(px, py, 0, px, py, pkt.size * 3.5);
      halo.addColorStop(0, pkt.color + 'cc');
      halo.addColorStop(1, pkt.color + '00');
      ctx.beginPath();
      ctx.fillStyle = halo;
      ctx.arc(px, py, pkt.size * 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = '#ffffff';
      ctx.arc(px, py, pkt.size * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    if (frame_t - lastPacketSpawn > 40 + Math.random() * 40) {
      lastPacketSpawn = frame_t;
      spawnSourcePacket();
    }

    // --- Draw nodes ---
    nodes.forEach((node) => {
      const t = frame_t * 0.028 + node.pulsePhase;
      const pulse = 1 + 0.18 * Math.sin(t);

      // Outer glow
      const outerGlowR = node.radius * 2.8 * pulse;
      const outerGlow = ctx.createRadialGradient(node.x, node.y, node.radius * 0.4, node.x, node.y, outerGlowR);
      outerGlow.addColorStop(0, node.color + '2a');
      outerGlow.addColorStop(1, node.color + '00');
      ctx.beginPath();
      ctx.fillStyle = outerGlow;
      ctx.arc(node.x, node.y, outerGlowR, 0, Math.PI * 2);
      ctx.fill();

      // Pulsing rings
      if (node.type === 'center') {
        const ring1R = node.radius + 7 + 3 * Math.sin(t);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(193,105,79,${0.35 + 0.18 * Math.sin(t)})`;
        ctx.lineWidth = 1.5;
        ctx.arc(node.x, node.y, ring1R, 0, Math.PI * 2);
        ctx.stroke();
        const ring2R = node.radius + 14 + 5 * Math.sin(t * 0.65);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(193,105,79,${0.12 + 0.08 * Math.sin(t * 0.65)})`;
        ctx.lineWidth = 1;
        ctx.arc(node.x, node.y, ring2R, 0, Math.PI * 2);
        ctx.stroke();
      } else if (!node.dead) {
        const ringR = node.radius + 3 + 1.5 * Math.sin(t);
        ctx.beginPath();
        ctx.strokeStyle = node.color + Math.round((0.20 + 0.12 * Math.sin(t)) * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = 1;
        ctx.arc(node.x, node.y, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Node fill
      const nodeGrad = ctx.createRadialGradient(
        node.x - node.radius * 0.3, node.y - node.radius * 0.35, 0,
        node.x, node.y, node.radius
      );
      nodeGrad.addColorStop(0, lightenHex(node.color, 50));
      nodeGrad.addColorStop(1, node.color);
      ctx.beginPath();
      ctx.fillStyle = nodeGrad;
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = node.color + 'bb';
      ctx.lineWidth = 1;
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Event count inside node
      if (!node.dead && node.radius >= 9) {
        ctx.font = `bold ${Math.round(node.radius * 0.75)}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(node.eventCount, node.x, node.y);
        ctx.textBaseline = 'alphabetic';
      }

      // Label below node
      const labelSize = isMobile ? 7 : 8;
      ctx.font = `bold ${labelSize}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      if (node.type === 'center') {
        ctx.fillStyle = 'rgba(193,105,79,0.90)';
        ctx.fillText('SOIRÉE', node.x, node.y + node.radius + 11);
      } else if (node.dead) {
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillText(node.label, node.x, node.y + node.radius + 10);
      } else if (node.type === 'category') {
        ctx.fillStyle = node.color + 'cc';
        ctx.fillText(node.label, node.x, node.y + node.radius + 10);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText(node.label, node.x, node.y + node.radius + 10);
      }
    });

    // Reduced-motion: render one static frame, skip the rAF loop.
    if (!prefersReducedMotion()) requestAnimationFrame(animate);
  }

  animate();

  // Update stats
  const nodesEl = document.getElementById('network-nodes');
  const eventsEl = document.getElementById('network-events');
  if (nodesEl) nodesEl.textContent = sources.length;
  // EVENTS reports the verified total — the same number the hero curates —
  // never the raw scrape count (they disagreed: 55 raw vs 43 verified)
  if (eventsEl) {
    eventsEl.textContent = eventsLoaded ? events.length : applyTruthPass(allEvents).length;
  }

  // --- Legend: grouped by region for active nodes, plus offline indicator ---
  const techLegend = document.getElementById('js-tech-legend');
  if (techLegend) {
    techLegend.innerHTML = '';
    // Show category nodes in legend
    nodes.filter(n => n.type === 'category').forEach(n => {
      const item = document.createElement('div');
      item.className = 'tech-legend-item';
      item.innerHTML = `<div class="tech-dot" style="background:${n.color};box-shadow:0 0 5px ${n.color}88;"></div><span>${n.label} <span style="color:#999;font-size:10px">${n.eventCount}</span></span>`;
      techLegend.appendChild(item);
    });
    // Offline source count
    const deadCount = nodes.filter(n => n.type === 'source' && n.dead).length;
    if (deadCount > 0) {
      const item = document.createElement('div');
      item.className = 'tech-legend-item';
      item.innerHTML = `<div class="tech-dot" style="background:#3a3a3a;"></div><span style="color:rgba(255,255,255,0.3)">OFFLINE <span style="font-size:10px">${deadCount}</span></span>`;
      techLegend.appendChild(item);
    }
  }

  // Regions count
  const regions = new Set();
  allEvents.forEach(e => {
    const loc = e.location.toLowerCase();
    if (loc.includes('hoboken') || loc.includes('jersey city')) regions.add('Hoboken/JC');
    else regions.add('NYC');
  });
  const regionsEl = document.getElementById('network-regions');
  if (regionsEl) regionsEl.textContent = regions.size;
}

/* Free Mode Logic */
function toggleFreeMode() {
  const checkbox = document.getElementById('free-mode-toggle');
  freeMode = checkbox ? checkbox.checked : !freeMode;
  renderEvents();
  showToast(freeMode ? 'Showing free events only' : 'Showing all events');
}

// ── Unified Gallery (Card Stack + Featured) ─────────────────
function getGalleryEvents() {
  const pool = events.filter(e => {
    const matchesRegion = matchesCurrentRegion(e);
    const matchesCat = galleryFilter === 'all' || e.category === galleryFilter;
    // Home gallery: for art, show openings only (not full exhibition viewing windows)
    const matchesType = galleryFilter !== 'art' || !e.event_type || e.event_type === 'opening';
    return matchesRegion && matchesCat && matchesType;
  });
  // Events arrive from the truth pass upcoming-first — deal the deck in
  // honest order (soonest real date on top) instead of a random shuffle
  return pool.slice(0, 15);
}

function renderUnifiedGallery() {
  galleryEvents = getGalleryEvents();
  stackIndex = 0;
  featuredIndex = 0;

  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    renderStack();
  } else {
    renderFeaturedLayout();
  }

  // Update tab active states
  document.querySelectorAll('.gallery-tab').forEach(tab => {
    const isActive = tab.dataset.filter === galleryFilter;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // Reset progress bar
  updateGalleryProgress();
}

function updateGalleryProgress() {
  const progressBar = document.getElementById('gallery-progress-bar');
  if (!progressBar || galleryEvents.length === 0) {
    if (progressBar) progressBar.style.width = '0%';
    return;
  }
  const isMobile = window.innerWidth < 768;
  const current = isMobile ? stackIndex + 1 : featuredIndex + 1;
  const pct = Math.min((current / galleryEvents.length) * 100, 100);
  progressBar.style.width = `${pct}%`;
}

// ── Mobile Card Stack ──
function renderStack() {
  const container = document.getElementById('gallery-stack-cards');
  const counter = document.getElementById('gallery-stack-counter');
  const emptyEl = document.getElementById('gallery-stack-empty');
  const actions = document.querySelector('.gallery-stack-actions');
  if (!container) return;

  if (galleryEvents.length === 0) {
    container.innerHTML = '';
    // Collapse the deck's reserved 4/5 aspect so the empty state sits
    // right under the tabs instead of below ~430px of nothing
    container.classList.add('stack-cards-collapsed');
    if (counter) counter.textContent = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (actions) actions.style.display = 'none';
    return;
  }

  container.classList.remove('stack-cards-collapsed');
  if (emptyEl) emptyEl.classList.add('hidden');
  if (actions) actions.style.display = '';
  updateStackCounter();
  renderStackCards();
}

function updateStackCounter() {
  const counter = document.getElementById('gallery-stack-counter');
  if (counter && galleryEvents.length > 0) {
    const current = Math.min(stackIndex + 1, galleryEvents.length);
    counter.textContent = `${current} of ${galleryEvents.length}`;
  }
  updateGalleryProgress();
}

function renderStackCards() {
  const container = document.getElementById('gallery-stack-cards');
  if (!container) return;
  container.innerHTML = '';
  isSwipeAnimating = false;

  if (stackIndex >= galleryEvents.length) {
    showStackComplete();
    return;
  }

  const maxVisible = 3;
  for (let i = 0; i < maxVisible; i++) {
    const eventIdx = stackIndex + i;
    if (eventIdx >= galleryEvents.length) break;

    const event = galleryEvents[eventIdx];
    const wrapper = document.createElement('div');
    wrapper.className = 'stack-card';
    wrapper.dataset.depth = i;
    wrapper.dataset.eventId = event.id;
    wrapper.innerHTML = `
      <div class="stack-card-overlay stack-card-overlay--like"></div>
      <div class="stack-card-overlay stack-card-overlay--skip"></div>
      ${createEventCard(event, 0)}
    `;
    container.appendChild(wrapper);

    if (i === 0) {
      attachSwipeHandlers(wrapper, event);
    }
  }
}

function showStackComplete() {
  const container = document.getElementById('gallery-stack-cards');
  const actions = document.querySelector('.gallery-stack-actions');
  const counter = document.getElementById('gallery-stack-counter');
  if (container) {
    container.innerHTML = `
      <div class="gallery-stack-done">
        <div class="gallery-done-check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div class="gallery-done-text">You've seen them all!</div>
        <button class="gallery-done-reset">Start Over</button>
      </div>
    `;
    const resetBtn = container.querySelector('.gallery-done-reset');
    if (resetBtn) resetBtn.addEventListener('click', resetStack);
  }
  if (actions) actions.style.display = 'none';
  if (counter) counter.textContent = '';
}

function resetStack() {
  stackIndex = 0;
  galleryEvents = getGalleryEvents();
  renderStack();
}

// ── Swipe Handler ──
function attachSwipeHandlers(cardEl, event) {
  let startX = 0, startY = 0, currentX = 0, currentY = 0;
  let isDragging = false, directionLocked = null, hasMoved = false;
  let rafId = null;
  const likeOverlay = cardEl.querySelector('.stack-card-overlay--like');
  const skipOverlay = cardEl.querySelector('.stack-card-overlay--skip');

  function onStart(x, y) {
    if (isSwipeAnimating) return;
    startX = x; startY = y; currentX = x; currentY = y;
    isDragging = true; directionLocked = null; hasMoved = false;
    cardEl.classList.add('dragging');
  }

  function applyTransform() {
    const dx = currentX - startX;
    const rotate = dx * 0.06;
    cardEl.style.transform = `translateX(${dx}px) rotate(${rotate}deg)`;

    const progress = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
    if (dx > 0) {
      likeOverlay.style.opacity = progress * 0.7;
      skipOverlay.style.opacity = 0;
    } else {
      skipOverlay.style.opacity = progress * 0.7;
      likeOverlay.style.opacity = 0;
    }
    rafId = null;
  }

  function onMove(x, y) {
    if (!isDragging) return;
    const dx = x - startX;
    const dy = y - startY;

    if (!directionLocked && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      directionLocked = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      if (directionLocked === 'vertical') {
        isDragging = false;
        cardEl.classList.remove('dragging');
        return;
      }
    }

    if (directionLocked === 'horizontal') {
      hasMoved = true;
      currentX = x;
      currentY = y;
      if (!rafId) rafId = requestAnimationFrame(applyTransform);
    }
  }

  function onEnd() {
    if (!isDragging) return;
    isDragging = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    cardEl.classList.remove('dragging');
    const dx = currentX - startX;

    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      completeSwipe(dx > 0 ? 'right' : 'left', cardEl, event);
    } else if (!hasMoved) {
      openModal(event.id);
      resetCardPosition(cardEl, likeOverlay, skipOverlay);
    } else {
      resetCardPosition(cardEl, likeOverlay, skipOverlay);
    }
  }

  // Touch events
  cardEl.addEventListener('touchstart', (e) => {
    // Match the mouse path's guard: a tap on the heart must only toggle the
    // favorite — without this, touchend also fired onEnd → openModal, and the
    // modal swallowed every subsequent tap on the card
    if (e.target.closest('.favorite-btn')) return;
    const t = e.touches[0];
    onStart(t.clientX, t.clientY);
  }, { passive: true });

  cardEl.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    onMove(t.clientX, t.clientY);
    if (directionLocked === 'horizontal') e.preventDefault();
  }, { passive: false });

  cardEl.addEventListener('touchend', onEnd, { passive: true });

  // Mouse events (desktop testing)
  cardEl.addEventListener('mousedown', (e) => {
    if (e.target.closest('.favorite-btn')) return;
    e.preventDefault();
    onStart(e.clientX, e.clientY);
    const onMouseMove = (ev) => onMove(ev.clientX, ev.clientY);
    const onMouseUp = () => {
      onEnd();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  // Favorite button inside card
  cardEl.querySelectorAll('.favorite-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(parseInt(btn.dataset.id));
    });
  });
}

function resetCardPosition(cardEl, likeOverlay, skipOverlay) {
  cardEl.style.transform = '';
  if (likeOverlay) likeOverlay.style.opacity = 0;
  if (skipOverlay) skipOverlay.style.opacity = 0;
}

function completeSwipe(direction, cardEl, event) {
  isSwipeAnimating = true;
  const flyX = direction === 'right' ? '120%' : '-120%';
  const flyRotate = direction === 'right' ? 15 : -15;
  cardEl.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 1, 1), opacity 0.3s ease';
  cardEl.style.transform = `translateX(${flyX}) rotate(${flyRotate}deg)`;
  cardEl.style.opacity = '0';

  if (direction === 'right' && !favorites.includes(event.id)) {
    toggleFavorite(event.id);
  }

  // After card flies out, promote remaining cards then re-render
  cardEl.addEventListener('transitionend', function handler(e) {
    if (e.propertyName !== 'transform') return;
    cardEl.removeEventListener('transitionend', handler);
    stackIndex++;
    updateStackCounter();
    renderStackCards();
  }, { once: false });
}

// ── Stack Action Buttons ──
function initStackActions() {
  const skipBtn = document.getElementById('stack-skip');
  const favBtn = document.getElementById('stack-fav');

  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      const frontCard = document.querySelector('.stack-card[data-depth="0"]');
      if (!frontCard || isSwipeAnimating) return;
      const eventId = parseInt(frontCard.dataset.eventId);
      const event = galleryEvents.find(e => e.id === eventId);
      if (event) completeSwipe('left', frontCard, event);
    });
  }

  if (favBtn) {
    favBtn.addEventListener('click', () => {
      const frontCard = document.querySelector('.stack-card[data-depth="0"]');
      if (!frontCard || isSwipeAnimating) return;
      const eventId = parseInt(frontCard.dataset.eventId);
      const event = galleryEvents.find(e => e.id === eventId);
      if (event) completeSwipe('right', frontCard, event);
    });
  }
}

// ── Desktop: Featured + Sidebar ──
function renderFeaturedLayout() {
  const mainEl = document.getElementById('gallery-featured-main');
  const sidebarEl = document.getElementById('gallery-featured-sidebar');
  const emptyEl = document.getElementById('gallery-featured-empty');
  const wrapEl = document.getElementById('gallery-featured');
  if (!mainEl || !sidebarEl) return;

  if (galleryEvents.length === 0) {
    mainEl.innerHTML = '';
    sidebarEl.innerHTML = '';
    // Collapse the empty main/sidebar stubs so the message centers alone
    if (wrapEl) wrapEl.classList.add('gallery-featured--empty');
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }
  if (wrapEl) wrapEl.classList.remove('gallery-featured--empty');
  if (emptyEl) emptyEl.classList.add('hidden');

  renderFeaturedCard(featuredIndex);

  sidebarEl.innerHTML = galleryEvents.map((ev, i) => {
    const isFavorited = favorites.includes(ev.id);
    const isActive = i === featuredIndex;
    const displayName = esc(ev.name.replace(/American Museum of Natural History/gi, 'AMNH'));
    const art = eventCardArt(ev);
    return `
      <div class="sidebar-card ${isActive ? 'active' : ''}" data-event-id="${ev.id}" data-index="${i}" data-category="${esc(ev.category)}">
        <div class="sidebar-card-image" style="${art.style}">${art.img}</div>
        <div class="sidebar-card-info">
          <div class="sidebar-card-name">${displayName}</div>
          <div class="sidebar-card-meta">${esc(formatBadgeDate(ev))} · ${esc(ev.location)}</div>
        </div>
        <button class="sidebar-card-fav ${isFavorited ? 'favorited' : ''}" data-id="${ev.id}" aria-label="${isFavorited ? 'Remove from' : 'Add to'} favorites">
          <svg viewBox="0 0 24 24" fill="${isFavorited ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>
      </div>
    `;
  }).join('');

  // Wire sidebar clicks
  sidebarEl.querySelectorAll('.sidebar-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.sidebar-card-fav')) return;
      const idx = parseInt(card.dataset.index);
      featuredIndex = idx;
      renderFeaturedCard(idx);
      sidebarEl.querySelectorAll('.sidebar-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      updateGalleryProgress();
    });
  });

  // Wire sidebar favorite buttons
  sidebarEl.querySelectorAll('.sidebar-card-fav').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(parseInt(btn.dataset.id));
    });
  });
}

function renderFeaturedCard(index) {
  const mainEl = document.getElementById('gallery-featured-main');
  if (!mainEl || !galleryEvents[index]) return;
  const event = galleryEvents[index];
  mainEl.innerHTML = createEventCard(event, 0);

  const card = mainEl.querySelector('.event-card');
  if (card) {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.favorite-btn')) openModal(event.id);
    });
  }
  mainEl.querySelectorAll('.favorite-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(parseInt(btn.dataset.id));
    });
  });
}

// ── Gallery Tabs ──
function initGalleryTabs() {
  document.querySelectorAll('.gallery-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      galleryFilter = tab.dataset.filter;
      renderUnifiedGallery();
    });
  });
}

// ── Responsive re-render on breakpoint cross ──
let lastGalleryMode = window.innerWidth < 768 ? 'mobile' : 'desktop';
window.addEventListener('resize', () => {
  const newMode = window.innerWidth < 768 ? 'mobile' : 'desktop';
  if (newMode !== lastGalleryMode) {
    lastGalleryMode = newMode;
    renderUnifiedGallery();
  }
});

// Keep old name as alias so region-change call still works
function updateCategoryCounts() { renderUnifiedGallery(); }

// ── Instagram Grid ───────────────────────────────────
function initInstagramGrid() {
  const igUrl = 'https://www.instagram.com/yourdailysoiree/';

  // Make entire subscribe section clickable
  document.querySelectorAll('#subscribe-strip-home, #subscribe-strip-about, #subscribe-strip-events').forEach(section => {
    section.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      window.open(igUrl, '_blank', 'noopener');
    });
  });

  const grids = document.querySelectorAll('.ig-grid');
  if (grids.length === 0) return;

  // When the feed has no posts (the endpoint returns {posts:[]} on failure),
  // hide the whole band rather than rendering an empty vitrine. Inline
  // display survives the view-switch class toggling on #subscribe-strip-events.
  const igSections = document.querySelectorAll('#subscribe-strip-home, #subscribe-strip-about, #subscribe-strip-events');
  const hideBand = () => igSections.forEach(s => { s.style.display = 'none'; });

  fetch('/api/instagram-feed')
    .then(r => r.json())
    .then(data => {
      if (!data.posts || data.posts.length === 0) { hideBand(); return; }
      grids.forEach(grid => {
        grid.innerHTML = data.posts.map(p =>
          `<a href="${esc(p.permalink)}" target="_blank" rel="noopener"><img src="${esc(p.media_url)}" alt="" loading="lazy"></a>`
        ).join('');
      });
    })
    .catch(hideBand);
}

// ── Inline Subscribe Strip ───────────────────────────
function initSubscribeStrip() {
  const form = document.getElementById('subscribe-strip-form');
  const successEl = document.getElementById('subscribe-strip-success');
  const btn = document.getElementById('subscribe-strip-btn');
  if (!form) return;

  // Pre-fill region from current selection
  const regionSelect = document.getElementById('subscribe-strip-region');
  if (regionSelect && currentRegion) {
    const opt = regionSelect.querySelector(`option[value="${currentRegion}"]`);
    if (opt) regionSelect.value = currentRegion;
  }

  // Chip toggles
  form.querySelectorAll('.subscribe-strip-chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('active'));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('subscribe-strip-email').value.trim();
    if (!email) return;

    const region = regionSelect ? regionSelect.value : currentRegion;
    const categories = [...form.querySelectorAll('.subscribe-strip-chip.active')].map(c => c.dataset.cat);

    btn.disabled = true;
    try {
      const resp = await fetch(`${API_BASE_URL}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, region, categories })
      });
      const data = await resp.json();
      if (data.success) {
        form.style.display = 'none';
        successEl.style.display = 'block';
      } else {
        alert(data.error || 'Something went wrong. Please try again.');
        btn.disabled = false;
      }
    } catch {
      alert('Network error. Please try again.');
      btn.disabled = false;
    }
  });
}

// ── Events List Subscribe Strip ───────────────────────────
function initSubscribeStripEvents() {
  const form = document.getElementById('subscribe-strip-form-events');
  const successEl = document.getElementById('subscribe-strip-success-events');
  const btn = document.getElementById('subscribe-strip-btn-events');
  if (!form) return;

  // Pre-fill region from current selection
  const regionSelect = document.getElementById('subscribe-strip-region-events');
  if (regionSelect && currentRegion) {
    const opt = regionSelect.querySelector(`option[value="${currentRegion}"]`);
    if (opt) regionSelect.value = currentRegion;
  }

  // Chip toggles
  form.querySelectorAll('.subscribe-strip-chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('active'));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('subscribe-strip-email-events').value.trim();
    if (!email) return;

    const region = regionSelect ? regionSelect.value : currentRegion;
    const categories = [...form.querySelectorAll('.subscribe-strip-chip.active')].map(c => c.dataset.cat);

    btn.disabled = true;
    try {
      const resp = await fetch(`${API_BASE_URL}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, region, categories })
      });
      const data = await resp.json();
      if (data.success) {
        form.style.display = 'none';
        successEl.style.display = 'block';
      } else {
        alert(data.error || 'Something went wrong. Please try again.');
        btn.disabled = false;
      }
    } catch {
      alert('Network error. Please try again.');
      btn.disabled = false;
    }
  });
}

// ── Scroll Reveal ──────────────────────────────────
function initScrollReveal() {
  const sections = document.querySelectorAll('.reveal-section');
  if (!sections.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  sections.forEach(s => observer.observe(s));
}

// ── Footer: "The City at Dusk" ─────────────────────────────────
// Hand-drawn skyline whose gold windows light up, staggered, the first time
// the footer scrolls into view. Window placement is randomized per load;
// a few keep twinkling. Reduced motion: everything lights at once, static.
function initFooterReveal() {
  const footer = document.querySelector('.dusk-footer');
  const host = document.getElementById('sf-wins-host');
  const svg = document.getElementById('sf-city-svg');
  if (!footer || !host || !svg) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SVGNS = 'http://www.w3.org/2000/svg';

  // {x,y: first window top-left, w,h, cols, rows, dx,dy col/row pitch, skip:[indices]}
  const grids = [
    // left bank (Hoboken / Jersey City)
    { x: 79,   y: 192, w: 11, h: 15, cols: 2, rows: 3, dx: 19,   dy: 26 },                  // brownstone 1
    { x: 140,  y: 172, w: 11, h: 15, cols: 3, rows: 4, dx: 18,   dy: 25, skip: [10] },      // brownstone 2
    { x: 202,  y: 208, w: 11, h: 15, cols: 2, rows: 2, dx: 19,   dy: 27 },                  // brownstone 3
    { x: 274,  y: 243, w: 12, h: 14, cols: 1, rows: 1, dx: 0,    dy: 0 },                   // warehouse side
    { x: 322,  y: 243, w: 12, h: 14, cols: 1, rows: 1, dx: 0,    dy: 0 },
    // right bank (New York)
    { x: 939,  y: 116, w: 9,  h: 12, cols: 2, rows: 6, dx: 13,   dy: 26 },                  // slim tower
    { x: 990,  y: 170, w: 11, h: 13, cols: 4, rows: 4, dx: 18,   dy: 26, skip: [14, 15] },  // water tower building
    { x: 1087, y: 144, w: 9,  h: 12, cols: 4, rows: 5, dx: 14.5, dy: 25 },                  // empire base
    { x: 1096, y: 96,  w: 8,  h: 10, cols: 3, rows: 1, dx: 12,   dy: 0 },                   // empire mid
    { x: 1103, y: 64,  w: 7,  h: 9,  cols: 2, rows: 1, dx: 9,    dy: 0 },                   // empire top
    { x: 1167, y: 206, w: 11, h: 14, cols: 3, rows: 2, dx: 17,   dy: 27 },                  // cornice row 1
    { x: 1224, y: 188, w: 11, h: 14, cols: 3, rows: 2, dx: 16,   dy: 27, skip: [4] },       // cornice row 2 (door)
    { x: 1281, y: 214, w: 11, h: 14, cols: 3, rows: 2, dx: 16,   dy: 26 },                  // cornice row 3
    { x: 1350, y: 162, w: 11, h: 14, cols: 3, rows: 3, dx: 17,   dy: 27 }                   // café corner
  ];

  const wins = [];
  grids.forEach(g => {
    let i = 0;
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++, i++) {
        if (g.skip && g.skip.indexOf(i) !== -1) continue;
        const rect = document.createElementNS(SVGNS, 'rect');
        // a touch of hand wobble so no two windows sit perfectly
        const jx = (Math.random() - .5) * 1.6, jy = (Math.random() - .5) * 1.6;
        rect.setAttribute('x', (g.x + c * g.dx + jx).toFixed(1));
        rect.setAttribute('y', (g.y + r * g.dy + jy).toFixed(1));
        rect.setAttribute('width', g.w);
        rect.setAttribute('height', g.h);
        rect.setAttribute('rx', 2.5);
        rect.setAttribute('class', 'win');
        host.appendChild(rect);
        wins.push(rect);
      }
    }
  });

  // choose ~72% of windows to light, each on its own moment; a few twinkle
  const chosen = [];
  wins.forEach(w => {
    if (Math.random() < 0.72) {
      chosen.push(w);
      w.style.transitionDelay = (Math.random() * 2.8).toFixed(2) + 's';
      if (!reduced && Math.random() < 0.16) {
        w.style.setProperty('--twd', (3.5 + Math.random() * 4).toFixed(2) + 's');
        w.style.setProperty('--twdel', (3 + Math.random() * 5).toFixed(2) + 's');
        w.dataset.tw = '1';
      }
    }
  });

  // mobile shows the heart of the drawing: the river, the sun, both banks
  const mq = window.matchMedia('(max-width:700px)');
  function frame() {
    svg.setAttribute('viewBox', mq.matches ? '356 0 716 300' : '0 0 1440 300');
  }
  if (mq.addEventListener) mq.addEventListener('change', frame); else mq.addListener(frame);
  frame();

  // dusk falls when the skyline scrolls into view
  let fell = false;
  function fallDusk() {
    if (fell) return;
    fell = true;
    footer.classList.add('lit');
    requestAnimationFrame(() => {
      chosen.forEach(w => {
        w.classList.add('on');
        if (w.dataset.tw) w.classList.add('tw');
      });
      footer.querySelectorAll('.sun-ray,.sun-reflect,.beacon,.lamp-glow')
        .forEach(el => el.classList.add('glow'));
    });
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { fallDusk(); io.disconnect(); }
      });
    }, { threshold: 0.25 });
    io.observe(footer.querySelector('.dusk-skyline-wrap'));
  } else {
    fallDusk();
  }
}

// ── Footer truth line ──────────────────────────────
// One derived sentence, computed from the SAME verified (truth-passed)
// `events` array the page renders — never a separate fetch, so the number
// can't disagree with the counts shown elsewhere. Uses the app's own date
// logic (matchesTimeFilter's rules) and region scoping.
function updateFooterTruth() {
  const el = document.getElementById('sf-truth-line');
  if (!el) return;
  if (!eventsLoaded) return; // no data yet → no numeric claim

  const todayStr = getTodayLocal();
  const endOfWeekStr = getEndOfWeekLocal();
  let tonightFree = 0;
  let weekCount = 0;

  events.forEach(ev => {
    if (!ev.start_date) return;
    if (!matchesCurrentRegion(ev)) return;
    const startDateStr = extractDateFromISO(ev.start_date);
    const endDateStr = ev.end_date ? extractDateFromISO(ev.end_date) : startDateStr;
    const isTonight = todayStr >= startDateStr && todayStr <= endDateStr;
    const isThisWeek = startDateStr <= endOfWeekStr && endDateStr >= todayStr;
    if (isTonight && ev.isFree === true) tonightFree++;
    if (isThisWeek) weekCount++;
  });

  let html;
  if (tonightFree > 0) {
    html = `<span class="num">${tonightFree}</span> free ` +
      (tonightFree === 1 ? 'thing is' : 'things are') +
      ' happening under tonight&rsquo;s sky &mdash; go find one.';
  } else if (weekCount > 0) {
    html = `The city rests tonight &mdash; <span class="num">${weekCount}</span> ` +
      (weekCount === 1 ? 'gathering' : 'gatherings') + ' this week.';
  } else {
    // nothing verifiable to count → no numeric claim
    html = 'the city is catching its breath &mdash; tomorrow&rsquo;s list is already brewing.';
  }

  if (el.innerHTML !== html) el.innerHTML = html;
  requestAnimationFrame(() => el.classList.add('show'));
}

// ── Footer navigation (Navigate column → app router) ───────────
function initFooterNav() {
  document.querySelectorAll('.dusk-link-col a[data-view]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToView(link.dataset.view);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

// ── Value strip event count ────────────────────────
// Only ever prints the loaded (verified) count — never the boot fallback data,
// so "Curating N experiences" always equals what the ledger actually renders.
let eventsLoaded = false;
function updateValueStrip() {
  const el = document.getElementById('value-events');
  if (el && eventsLoaded && events.length > 0) {
    el.textContent = events.length;
    // "100% free" was a hardcoded falsehood for the verified set — derive the
    // suffix from the honest isFree flags instead ("— 19 free."), or nothing.
    const suffixEl = document.getElementById('value-free-suffix');
    if (suffixEl) {
      const freeCount = events.filter(e => e.isFree === true).length;
      suffixEl.innerHTML = freeCount > 0
        ? ` — <span class="value-line-num">${freeCount}</span> free.`
        : '.';
    }
  }
}

// ── Salon hero: ticker, guest count, floating "happening soon" tag ──
function initSalonHero() {
  // Smooth-scroll the "Browse tonight" button to the gallery
  const browse = document.getElementById('hero-browse-btn');
  if (browse) {
    browse.addEventListener('click', (e) => {
      const target = document.getElementById('unified-gallery');
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
}

function updateSalonHero() {
  if (!eventsLoaded) return;
  const inRegion = events.filter(e => matchesCurrentRegion(e));
  const pool = inRegion.length ? inRegion : events;

  // Guest count
  const countEl = document.getElementById('hero-count');
  if (countEl) countEl.textContent = pool.length;

  // "Happening soon" — events starting within the next ~8 days
  const tagWeek = document.getElementById('hero-tag-week');
  if (tagWeek) {
    const now = Date.now();
    const soon = pool.filter(e => {
      const d = new Date(e.start_date);
      return !isNaN(d) && (d - now) > -86400000 && (d - now) < 86400000 * 8;
    }).length;
    tagWeek.textContent = `${soon || pool.length} events`;
  }

  // Marquee ticker — a curated ribbon of live event names
  const track = document.getElementById('salon-ticker-track');
  if (track) {
    const names = pool.slice(0, 16)
      .map(e => (e.name || '').replace(/American Museum of Natural History/gi, 'AMNH'))
      .filter(Boolean)
      .map(n => (n.length > 46 ? n.slice(0, 44) + '…' : n));
    if (names.length) {
      const html = names.map(n => `<span>${esc(n)}</span>`).join('');
      // duplicate the run so the -50% keyframe loops seamlessly
      track.innerHTML = html + html;
    }
  }
}

// ── Email Subscription ──────────────────────────────
function initSubscribeForm() {
  const form = document.getElementById('subscribe-form');
  const successEl = document.getElementById('subscribe-success');
  const againBtn = document.getElementById('subscribe-again');
  if (!form) return;

  // Chip toggles
  form.querySelectorAll('.subscribe-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
    });
  });

  // Pre-fill region from current selection
  const regionSelect = document.getElementById('subscribe-region');
  if (regionSelect && currentRegion) {
    const option = regionSelect.querySelector(`option[value="${currentRegion}"]`);
    if (option) regionSelect.value = currentRegion;
  }

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('subscribe-btn');
    const btnText = btn.querySelector('.subscribe-btn-text');
    const btnLoad = btn.querySelector('.subscribe-btn-loading');
    const email = document.getElementById('subscribe-email').value.trim();
    const region = regionSelect ? regionSelect.value : 'nyc';
    const categories = Array.from(form.querySelectorAll('.subscribe-chip.active'))
      .map(c => c.dataset.cat);

    if (!email) return;

    btn.disabled = true;
    btnText.style.display = 'none';
    btnLoad.style.display = 'inline-flex';

    try {
      const resp = await fetch(`${API_BASE_URL}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, region, categories })
      });
      const data = await resp.json();

      if (data.success) {
        form.style.display = 'none';
        successEl.style.display = 'block';
      } else {
        alert(data.error || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('Subscribe error:', err);
      alert('Network error. Please try again.');
    } finally {
      btn.disabled = false;
      btnText.style.display = 'inline';
      btnLoad.style.display = 'none';
    }
  });

  // "Update preferences" button
  if (againBtn) {
    againBtn.addEventListener('click', () => {
      successEl.style.display = 'none';
      form.style.display = 'flex';
    });
  }
}

// Single bootstrap so the loading and already-parsed (defer) paths can never
// drift — previously the `else` branch was missing initGalleryTabs (and others),
// so once app.js loaded with `defer` the category tabs stopped responding.
function bootstrap() {
  init();
  initRotatingTitle();
  initSubscribeForm();
  initSubscribeStrip();
  initSubscribeStripEvents();
  initScrollReveal();
  initFooterReveal();
  initFooterNav();
  initInstagramGrid();
  initGalleryTabs();
  initStackActions();
  initSalonHero();
  updateValueStrip();

  const freeCheckbox = document.getElementById('free-mode-toggle');
  if (freeCheckbox) freeCheckbox.addEventListener('change', toggleFreeMode);

  // Tech dashboard (network graph + activity chart) lives inside the About
  // view; initialized lazily when About opens so non-About loads don't fire a
  // duplicate /api/events + /api/stats fetch. Each init self-guards.
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
// v1.0.2

