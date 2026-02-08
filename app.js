// Configuration
const API_BASE_URL = window.location.origin;
const USE_API = true; // Set to false to use fallback data

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
    category: "music",
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
    category: "culinary",
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
    category: "fashion",
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
    category: "music",
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
    category: "culinary",
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
    category: "music",
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
    category: "fashion",
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
    category: "culinary",
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
    category: "music",
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

// Region State
let currentRegion = localStorage.getItem('soireeRegion') || null;
let detectedRegion = null;
let manualRegionOverride = localStorage.getItem('soireeManualRegion') === 'true';

// Region Definitions
const REGIONS = {
  'nyc': { name: 'New York City', shortName: 'NYC', coords: { lat: 40.7128, lng: -74.0060 } },
  'hoboken-jc': { name: 'Hoboken/Jersey City', shortName: 'Hoboken/JC', coords: { lat: 40.7439, lng: -74.0324 } },
  'jersey-shore': { name: 'Jersey Shore', shortName: 'Shore', coords: { lat: 40.2206, lng: -74.0076 } },
  'philly': { name: 'Philadelphia', shortName: 'Philly', coords: { lat: 39.9526, lng: -75.1652 } }
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

// Fetch Events from API
async function fetchEvents() {
  if (!USE_API) {
    return events; // Use fallback data
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/events`);
    const data = await response.json();

    if (data.success && data.events && data.events.length > 0) {
      // Ensure all events have required fields
      return data.events.map(event => ({
        ...event,
        highlights: typeof event.highlights === 'string'
          ? JSON.parse(event.highlights)
          : event.highlights || []
      }));
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
    // User has manually selected a region
    currentRegion = savedRegion;
    manualRegionOverride = true;
  } else {
    // Auto-detect region
    detectedRegion = await detectUserRegion();
    currentRegion = detectedRegion;
    localStorage.setItem('soireeRegion', currentRegion);
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

  // Mark active option in dropdown
  document.querySelectorAll('.region-option').forEach(option => {
    const optionRegion = option.dataset.region;
    if (optionRegion === 'auto') {
      option.classList.toggle('active', !manualRegionOverride);
    } else {
      option.classList.toggle('active', optionRegion === currentRegion && manualRegionOverride);
    }
  });
}

// Handle region selection
function handleRegionChange(newRegion) {
  if (newRegion === 'auto') {
    // Re-enable auto-detection
    manualRegionOverride = false;
    localStorage.setItem('soireeManualRegion', 'false');
    initRegion(); // Re-detect
  } else {
    // Manual selection
    currentRegion = newRegion;
    manualRegionOverride = true;
    localStorage.setItem('soireeRegion', newRegion);
    localStorage.setItem('soireeManualRegion', 'true');
    updateRegionUI();
    renderEvents(); // Refresh events
  }

  closeRegionDropdown();
}

// Toggle region dropdown
function toggleRegionDropdown() {
  const dropdown = document.getElementById('region-dropdown');
  const isVisible = dropdown && dropdown.style.display !== 'none';
  if (dropdown) {
    dropdown.style.display = isVisible ? 'none' : 'block';
  }
}

// Close region dropdown
function closeRegionDropdown() {
  const dropdown = document.getElementById('region-dropdown');
  if (dropdown) {
    dropdown.style.display = 'none';
  }
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
  // Show loading state
  eventsList.innerHTML = `
    <div class="loading">
      <div class="loading-spinner" aria-hidden="true"></div>
      <p>Loading amazing events...</p>
    </div>
  `;

  // Track page view
  trackPageView();

  // Initialize region (detects location)
  await initRegion();

  // Fetch events from API
  const fetchedEvents = await fetchEvents();
  if (fetchedEvents && fetchedEvents.length > 0) {
    events = fetchedEvents;
  }

  // Render and setup
  renderEvents();
  setupEventListeners();
  updateFavoriteBadge();
}

// Setup Event Listeners
function setupEventListeners() {
  // Filter chips
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => handleFilterClick(chip));
  });

  // Search
  searchInput.addEventListener('input', handleSearch);
  searchClear.addEventListener('click', clearSearch);

  // Navigation
  navItems.forEach(item => {
    item.addEventListener('click', () => handleNavClick(item));
  });

  // Modal
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  modalClose.addEventListener('click', closeModal);

  // Region selector
  const regionToggle = document.getElementById('region-toggle');
  if (regionToggle) {
    regionToggle.addEventListener('click', toggleRegionDropdown);
  }

  document.querySelectorAll('.region-option').forEach(option => {
    option.addEventListener('click', () => {
      const region = option.dataset.region;
      handleRegionChange(region);
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const selector = document.querySelector('.region-selector');
    if (selector && !selector.contains(e.target)) {
      closeRegionDropdown();
    }
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
      closeModal();
    }
    if (e.key === 'Escape') {
      closeRegionDropdown();
    }
  });
}

// Filter Events
function handleFilterClick(chip) {
  document.querySelectorAll('.filter-chip').forEach(c => {
    c.classList.remove('active');
    c.setAttribute('aria-checked', 'false');
  });
  chip.classList.add('active');
  chip.setAttribute('aria-checked', 'true');
  currentFilter = chip.dataset.filter;
  renderEvents();
}

// Search Events
function handleSearch(e) {
  searchQuery = e.target.value.toLowerCase();
  searchClear.classList.toggle('visible', searchQuery.length > 0);
  renderEvents();
}

function clearSearch() {
  searchInput.value = '';
  searchQuery = '';
  searchClear.classList.remove('visible');
  renderEvents();
}

// Navigation
function handleNavClick(item) {
  const view = item.dataset.view;

  navItems.forEach(n => n.classList.remove('active'));
  item.classList.add('active');

  if (view === 'discover') {
    currentTimeFilter = 'all';
    discoverView.classList.remove('hidden');
    favoritesView.classList.add('hidden');
    aboutView.classList.add('hidden');
    startRotating();
    renderEvents();
  } else if (view === 'today') {
    currentTimeFilter = 'today';
    discoverView.classList.remove('hidden');
    favoritesView.classList.add('hidden');
    aboutView.classList.add('hidden');
    setFixedTitle("Today's");
    renderEvents();
  } else if (view === 'week') {
    currentTimeFilter = 'week';
    discoverView.classList.remove('hidden');
    favoritesView.classList.add('hidden');
    aboutView.classList.add('hidden');
    setFixedTitle("This Week's");
    renderEvents();
  } else if (view === 'favorites') {
    discoverView.classList.add('hidden');
    favoritesView.classList.remove('hidden');
    aboutView.classList.add('hidden');
    renderFavorites();
  } else if (view === 'about') {
    discoverView.classList.add('hidden');
    favoritesView.classList.add('hidden');
    aboutView.classList.remove('hidden');
    loadStats();
  }
}

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

    // Region Filter (same logic as renderEvents)
    let matchesRegion = true;
    if (currentRegion === 'hoboken-jc') {
      const loc = event.location.toLowerCase();
      const addr = (event.address || '').toLowerCase();
      matchesRegion = loc.includes('hoboken') || loc.includes('jersey city') ||
        addr.includes('hoboken') || addr.includes('jersey city');
    } else if (currentRegion === 'nyc') {
      const loc = event.location.toLowerCase();
      const isHoboken = loc.includes('hoboken') || loc.includes('jersey city');
      matchesRegion = !isHoboken;
    }

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

// Render Events
function renderEvents() {
  // Check if current region is not supported - only support NYC and Hoboken for now
  if (currentRegion && currentRegion !== 'nyc' && currentRegion !== 'hoboken-jc') {
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

    // Region Filter
    let matchesRegion = true;
    if (currentRegion === 'hoboken-jc') {
      const loc = event.location.toLowerCase();
      const addr = (event.address || '').toLowerCase();
      matchesRegion = loc.includes('hoboken') || loc.includes('jersey city') ||
        addr.includes('hoboken') || addr.includes('jersey city');
    } else if (currentRegion === 'nyc') {
      // Default to NYC if not hoboken
      const loc = event.location.toLowerCase();
      // Exclude events that are explicitly for Hoboken/JC if we are in NYC view
      const isHoboken = loc.includes('hoboken') || loc.includes('jersey city');
      matchesRegion = !isHoboken;
    }

    return matchesFilter && matchesSearch && matchesTime && matchesRegion;
  });

  if (filteredEvents.length === 0) {
    eventsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">No events found</div>
        <div class="empty-state-text">Try adjusting your filters or search</div>
      </div>
    `;
    return;
  }

  eventsList.innerHTML = filteredEvents.map((event, index) =>
    createEventCard(event, index)
  ).join('');

  // Add event listeners to cards
  document.querySelectorAll('.event-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.favorite-btn')) {
        const eventId = parseInt(card.dataset.id);
        openModal(eventId);
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
}

// Render Favorites
function renderFavorites() {
  const favoriteEvents = events.filter(e => favorites.includes(e.id));

  if (favoriteEvents.length === 0) {
    favoritesView.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">❤️</div>
        <div class="empty-state-title">No favorites yet</div>
        <div class="empty-state-text">Start adding events you love to see them here</div>
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
  });

  favoritesView.querySelectorAll('.favorite-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const eventId = parseInt(btn.dataset.id);
      toggleFavorite(eventId);
    });
  });
}

// Format Date for Display
function formatEventDate(event) {
  // If we have structured dates, format them nicely
  if (event.start_date) {
    // Parse as UTC to avoid timezone conversion
    const startDateStr = event.start_date.split('T')[0];
    const endDateStr = event.end_date ? event.end_date.split('T')[0] : startDateStr;

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

// Create Event Card
function createEventCard(event, index) {
  const isFavorited = favorites.includes(event.id);
  const animationDelay = index < 3 ? `style="animation-delay: ${0.4 + index * 0.1}s"` : '';

  return `
    <div class="event-card" data-id="${event.id}" data-category="${event.category}" data-start-date="${event.start_date || ''}" data-end-date="${event.end_date || ''}" ${animationDelay} role="article" tabindex="0">
      <div class="event-card-header">
        <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-id="${event.id}" aria-label="${isFavorited ? 'Remove from' : 'Add to'} favorites">
          <svg viewBox="0 0 24 24" fill="${isFavorited ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>
        <div class="event-badge">${formatBadgeDate(event)}</div>
        <div class="event-category-badge">${getCategoryName(event.category)}</div>
      </div>
      <div class="event-details">
        <div class="event-name">${event.name}</div>
        <div class="event-date">${formatEventDate(event)}</div>
        <div class="event-location">${event.location}</div>
      </div>
    </div>
  `;
}

// Modal
function openModal(eventId) {
  const event = events.find(e => e.id === eventId);
  if (!event) return;

  const isFavorited = favorites.includes(event.id);
  const capacityPercent = Math.min(100, Math.floor((event.spots / 250) * 100));

  const modalContent = `
    <div class="modal-image" style="background-image: url('${event.image}')">
      <div class="modal-image-overlay"></div>
    </div>
    <div class="modal-content">
      <div class="modal-category">${getCategoryName(event.category)}</div>
      <h2 class="modal-title">${event.name}</h2>

      <div class="modal-meta">
        <div class="modal-meta-item">
          <svg class="modal-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <div>
            <div class="meta-label">When</div>
            <div class="meta-value">${formatEventDate(event)}</div>
            ${event.start_date ? `<div class="meta-sublabel">${event.start_date}${event.end_date !== event.start_date ? ' to ' + event.end_date : ''}</div>` : ''}
          </div>
        </div>
        <div class="modal-meta-item">
          <svg class="modal-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <div>
            <div class="meta-label">Where</div>
            <div class="meta-value">${event.location}</div>
            <div class="meta-sublabel">${event.address}</div>
          </div>
        </div>
      </div>

      <div class="modal-section">
        <h3>About This Event</h3>
        <p class="modal-description">${event.description}</p>
      </div>

      ${event.highlights && event.highlights.length > 0 ? `
      <div class="modal-section">
        <h3>What to Expect</h3>
        <ul class="modal-highlights">
          ${event.highlights.map(h => `<li>${h}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      <div class="modal-actions">
        ${event.url ? `
          <a href="${event.url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-block">
            View Event Details
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="7" y1="17" x2="17" y2="7"></line>
              <polyline points="7 7 17 7 17 17"></polyline>
            </svg>
          </a>
        ` : `
          <button class="btn btn-primary btn-block" onclick="handleRSVP(${event.id})">
            Reserve Your Spot
          </button>
        `}
        <button class="btn btn-secondary btn-icon" onclick="toggleFavorite(${event.id}); updateModalFavoriteBtn(${event.id})" aria-label="${isFavorited ? 'Remove from favorites' : 'Add to favorites'}">
          <svg viewBox="0 0 24 24" fill="${isFavorited ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>
        <button class="btn btn-secondary btn-icon" onclick="shareEvent(${event.id})" aria-label="Share event">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
        </button>
      </div>
    </div>
  `;

  document.getElementById('modal-body').innerHTML = modalContent;
  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

function handleRSVP(eventId) {
  const event = events.find(e => e.id === eventId);
  alert(`🎉 You're on the list for ${event.name}!\n\nWe'll send you a confirmation email shortly with all the details.`);
  closeModal();
}

function updateModalFavoriteBtn(eventId) {
  const isFavorited = favorites.includes(eventId);
  const btn = document.querySelector('.modal-actions .btn-secondary');
  if (btn) {
    btn.textContent = isFavorited ? 'Remove from Favorites' : 'Add to Favorites';
  }
}

// Favorites
function toggleFavorite(eventId) {
  if (favorites.includes(eventId)) {
    favorites = favorites.filter(id => id !== eventId);
  } else {
    favorites.push(eventId);
  }

  localStorage.setItem('soireeFavorites', JSON.stringify(favorites));
  updateFavoriteBadge();

  // Re-render current view
  const activeNav = document.querySelector('.nav-item.active');
  if (activeNav?.dataset.view === 'favorites') {
    renderFavorites();
  } else {
    renderEvents();
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
      // Format numbers with commas
      const formatNumber = (num) => num.toLocaleString('en-US');

      document.getElementById('stat-events').textContent = formatNumber(data.stats.totalEvents);
      document.getElementById('stat-views').textContent = formatNumber(data.stats.pageViews);
      document.getElementById('stat-unique').textContent = formatNumber(data.stats.uniqueEvents);
    }
  } catch (error) {
    console.error('Error loading stats:', error);
    document.getElementById('stat-events').textContent = '0';
    document.getElementById('stat-views').textContent = '0';
    document.getElementById('stat-unique').textContent = '0';
  }

  // Load technical stats
  loadTechStats();
}

async function loadTechStats() {
  try {
    // Measure API response time
    const startTime = performance.now();
    const response = await fetch(`${API_BASE_URL}/api/events`);
    const endTime = performance.now();
    const data = await response.json();

    // Update API speed
    const apiSpeed = Math.round(endTime - startTime);
    document.getElementById('api-speed').textContent = `~${apiSpeed}ms`;

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

      if (sources.size > 0) {
        document.getElementById('source-count').textContent = `${sources.size} curated sources`;
      }
    }
  } catch (error) {
    console.error('Error loading tech stats:', error);
    document.getElementById('last-scrape').textContent = 'Recently';
    document.getElementById('api-speed').textContent = '~200ms';
  }
}

// Utilities
function getCategoryName(category) {
  const names = {
    art: 'Art & Culture',
    music: 'Music',
    culinary: 'Food & Drink',
    fashion: 'Fashion',
    perks: 'Perks',
    lifestyle: 'Lifestyle',
    community: 'Community'
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
  const words = document.querySelectorAll('.title-word');
  words.forEach(w => w.classList.remove('active', 'exit'));
  // Find matching word or use first
  for (const w of words) {
    if (w.textContent.trim().toLowerCase() === text.toLowerCase()) {
      w.classList.add('active');
      return;
    }
  }
  words[0].textContent = text;
  words[0].classList.add('active');
}

// ============================================================================
// NETWORK GRAPH VISUALIZATION
// ============================================================================

function initNetworkGraph() {
  const canvas = document.getElementById('network-graph');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // Set canvas size
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 400 * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = 400;

  // Create nodes based on actual data sources (without revealing names)
  const sourceCount = new Set(events.map(e => e.source)).size;
  const nodes = [];

  // Central node
  nodes.push({
    x: width / 2,
    y: height / 2,
    radius: 12,
    color: '#D4AF37',
    vx: 0,
    vy: 0,
    fixed: true,
    label: 'Soirée'
  });

  // Create nodes for each data source (anonymized)
  const angleStep = (Math.PI * 2) / sourceCount;
  const orbitRadius = Math.min(width, height) * 0.3;

  for (let i = 0; i < sourceCount; i++) {
    const angle = i * angleStep;
    nodes.push({
      x: width / 2 + Math.cos(angle) * orbitRadius,
      y: height / 2 + Math.sin(angle) * orbitRadius,
      radius: 6,
      color: '#8B7355',
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      fixed: false,
      label: `Node ${i + 1}`
    });
  }

  // Animation loop
  function animate() {
    ctx.clearRect(0, 0, width, height);

    // Update node positions (simple physics)
    nodes.forEach((node, i) => {
      if (node.fixed) return;

      // Attract to orbit
      const dx = width / 2 - node.x;
      const dy = height / 2 - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const targetDist = orbitRadius;
      const force = (dist - targetDist) * 0.01;

      node.vx += (dx / dist) * force;
      node.vy += (dy / dist) * force;

      // Damping
      node.vx *= 0.95;
      node.vy *= 0.95;

      // Update position
      node.x += node.vx;
      node.y += node.vy;

      // Repel from other nodes
      nodes.forEach((other, j) => {
        if (i === j) return;
        const dx2 = other.x - node.x;
        const dy2 = other.y - node.y;
        const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (dist2 < 50 && dist2 > 0) {
          const repel = (50 - dist2) * 0.02;
          node.vx -= (dx2 / dist2) * repel;
          node.vy -= (dy2 / dist2) * repel;
        }
      });
    });

    // Draw connections
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.15)';
    ctx.lineWidth = 1;
    nodes.forEach((node, i) => {
      if (i === 0) return; // Skip central node
      ctx.beginPath();
      ctx.moveTo(nodes[0].x, nodes[0].y);
      ctx.lineTo(node.x, node.y);
      ctx.stroke();
    });

    // Draw nodes
    nodes.forEach((node, i) => {
      // Glow effect
      const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 2);
      gradient.addColorStop(0, node.color + '40');
      gradient.addColorStop(1, node.color + '00');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius * 2, 0, Math.PI * 2);
      ctx.fill();

      // Node circle
      ctx.fillStyle = node.color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(node.x - node.radius * 0.3, node.y - node.radius * 0.3, node.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(animate);
  }

  animate();

  // Update stats
  document.getElementById('network-nodes').textContent = sourceCount;
  document.getElementById('network-events').textContent = events.length;

  // Count unique regions
  const regions = new Set();
  events.forEach(e => {
    const loc = e.location.toLowerCase();
    if (loc.includes('hoboken') || loc.includes('jersey city')) {
      regions.add('Hoboken/JC');
    } else {
      regions.add('NYC');
    }
  });
  document.getElementById('network-regions').textContent = regions.size;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    initRotatingTitle();
    // Initialize network graph when About view is shown
    const aboutView = document.getElementById('about-view');
    const observer = new MutationObserver(() => {
      if (!aboutView.classList.contains('hidden')) {
        initNetworkGraph();
        observer.disconnect();
      }
    });
    observer.observe(aboutView, { attributes: true, attributeFilter: ['class'] });
  });
} else {
  init();
  initRotatingTitle();
}
// v1.0.1
