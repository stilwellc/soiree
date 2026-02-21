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
let currentPage = 1;
const EVENTS_PER_PAGE = 10;

// Region State
let currentRegion = localStorage.getItem('soireeRegion') || null;
let detectedRegion = null;
let manualRegionOverride = localStorage.getItem('soireeManualRegion') === 'true';
let freeMode = false;

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

  // Render and setup
  renderEvents();
  setupEventListeners();
  updateFavoriteBadge();
  updateCategoryCounts();
  updateValueStrip();

  // Navigate to URL path on initial load (e.g. direct link to /today)
  const initialView = PATH_VIEWS[location.pathname] || 'discover';
  if (initialView !== 'discover') {
    navigateToView(initialView, { pushHistory: false });
  } else {
    history.replaceState({ view: 'discover' }, '', location.pathname);
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
const VIEW_PATHS = { discover: '/', all: '/all', today: '/today', week: '/week', favorites: '/favorites', about: '/about', social: '/social' };
const PATH_VIEWS = { '/': 'discover', '/all': 'all', '/today': 'today', '/week': 'week', '/favorites': 'favorites', '/about': 'about', '/social': 'social' };

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
  const views = [discoverView, favoritesView, aboutView, socialView];
  const visibleView = views.find(v => !v.classList.contains('hidden'));

  function showView() {
    const categoryGrid = document.getElementById('category-grid');
    const eventsListEl = document.getElementById('events-list');

    // Restore nav/footer if coming from social view
    document.querySelector('.nav-bar').style.display = '';
    document.querySelector('.app-footer').style.display = '';

    if (view === 'discover') {
      currentTimeFilter = 'all';
      discoverView.classList.remove('hidden');
      discoverView.classList.add('view-home');
      favoritesView.classList.add('hidden');
      aboutView.classList.add('hidden');
      socialView.classList.add('hidden');
      if (categoryGrid) categoryGrid.classList.remove('hidden');
      if (eventsListEl) eventsListEl.classList.add('hidden');
      const subscribeStripEvents = document.getElementById('subscribe-strip-events');
      if (subscribeStripEvents) subscribeStripEvents.classList.add('hidden');
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
      if (categoryGrid) categoryGrid.classList.add('hidden');
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
      if (categoryGrid) categoryGrid.classList.add('hidden');
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
      if (categoryGrid) categoryGrid.classList.add('hidden');
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
      loadStats();
    } else if (view === 'social') {
      discoverView.classList.add('hidden');
      favoritesView.classList.add('hidden');
      aboutView.classList.add('hidden');
      socialView.classList.remove('hidden');
      const subscribeStripEvents = document.getElementById('subscribe-strip-events');
      if (subscribeStripEvents) subscribeStripEvents.classList.add('hidden');
      // Hide nav and footer for clean screenshots
      document.querySelector('.nav-bar').style.display = 'none';
      document.querySelector('.app-footer').style.display = 'none';
      renderSocialPosts();
    }
  }

  // If switching to a different view container, fade out then in
  const targetView = (view === 'favorites') ? favoritesView : (view === 'about') ? aboutView : (view === 'social') ? socialView : discoverView;
  if (visibleView && visibleView !== targetView) {
    visibleView.classList.add('view-fade-out');
    setTimeout(() => {
      visibleView.classList.remove('view-fade-out');
      showView();
      targetView.classList.add('view-fade-out');
      requestAnimationFrame(() => {
        targetView.classList.remove('view-fade-out');
      });
    }, 200);
  } else {
    showView();
  }
}

// Helper: Event Region Classification
const getEventRegion = (event) => {
  const loc = (event.location || '').toLowerCase();
  const addr = (event.address || '').toLowerCase();
  const source = (event.source || '').toLowerCase();
  const shoreK = ['shore', 'beach', 'ocean', 'sea', 'asbury', 'long branch', 'belmar', 'point pleasant', 'seaside', 'avalon', 'stone harbor', 'brigantine', 'atlantic city', 'cape may', 'wildwood', 'manasquan', 'bradley beach', 'ocean grove', 'spring lake', 'sea girt', 'deal'];
  const southK = ['camden', 'cherry hill', 'mount laurel', 'medford', 'glassboro', 'vineland', 'millville', 'bridgeton', 'salem', 'deptford', 'moorestown', 'haddonfield', 'collingswood'];
  const centralK = ['princeton', 'new brunswick', 'edison', 'woodbridge', 'manalapan', 'freehold', 'marlboro', 'sayreville', 'old bridge', 'rahway', 'somerville', 'flemington', 'plainfield', 'trenton', 'hamilton', 'ewing', 'lawrence', 'robbinsville'];
  const northK = ['newark', 'paterson', 'clifton', 'passaic', 'wayne', 'hackensack', 'teaneck', 'fort lee', 'paramus', 'ridgewood', 'montclair', 'morristown', 'mahwah', 'summit', 'chatham', 'madison', 'dover', 'sparta', 'sussex'];

  if (loc.includes('hoboken') || loc.includes('jersey city') || addr.includes('hoboken') || addr.includes('jersey city')) return 'hoboken-jc';
  if (shoreK.some(k => loc.includes(k) || addr.includes(k))) return 'jersey-shore';
  if (southK.some(k => loc.includes(k) || addr.includes(k))) return 'south-nj';
  if (centralK.some(k => loc.includes(k) || addr.includes(k))) return 'central-nj';
  if (northK.some(k => loc.includes(k) || addr.includes(k))) return 'north-nj';
  if (source.includes('visit nj') || loc.includes('nj') || addr.includes('new jersey')) return 'jersey-shore';
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

// Render Events
function renderEvents() {
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
      matchesFree = FREE_SOURCES.includes(event.source);
    }

    return matchesFilter && matchesSearch && matchesTime && matchesRegion && matchesFree;
  });

  if (filteredEvents.length === 0) {
    eventsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
        <div class="empty-state-title">No events found</div>
        <div class="empty-state-text">Try adjusting your filters or search</div>
      </div>
    `;
    return;
  }

  // Pagination
  const totalPages = Math.ceil(filteredEvents.length / EVENTS_PER_PAGE);
  const startIndex = (currentPage - 1) * EVENTS_PER_PAGE;
  const endIndex = startIndex + EVENTS_PER_PAGE;
  const paginatedEvents = filteredEvents.slice(startIndex, endIndex);

  let paginationHTML = '';
  if (totalPages > 1) {
    paginationHTML = `
      <div class="pagination">
        <button class="pagination-btn" id="prev-page" ${currentPage === 1 ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          Previous
        </button>
        <span class="pagination-info">Page ${currentPage} of ${totalPages}</span>
        <button class="pagination-btn" id="next-page" ${currentPage === totalPages ? 'disabled' : ''}>
          Next
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>
    `;
  }

  eventsList.innerHTML = paginatedEvents.map((event, index) =>
    createEventCard(event, startIndex + index)
  ).join('') + paginationHTML;

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
}

// Render Social Media Posts for Instagram
function renderSocialPosts() {
  // Filter events: NYC region, this week, categories: art, perks, culinary
  const nycEvents = events.filter(event => {
    const region = getEventRegion(event);
    return region === 'nyc';
  });

  // Get this week's events
  const today = new Date();
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + 7);
  const todayStr = formatDateLocal(today);
  const endOfWeekStr = formatDateLocal(endOfWeek);

  const thisWeekEvents = nycEvents.filter(event => {
    const eventDate = event.start_date || extractDateFromISO(event.date) || event.date;
    if (!eventDate) return false;
    return eventDate >= todayStr && eventDate <= endOfWeekStr;
  });

  // Split by category
  const artEvents = thisWeekEvents.filter(e => e.category === 'art').slice(0, 6);
  const perksEvents = thisWeekEvents.filter(e => e.category === 'perks').slice(0, 6);
  const foodEvents = thisWeekEvents.filter(e => e.category === 'culinary').slice(0, 6);

  // Render each category
  renderSocialCategory('social-art-events', artEvents);
  renderSocialCategory('social-perks-events', perksEvents);
  renderSocialCategory('social-food-events', foodEvents);
}

function renderSocialCategory(containerId, categoryEvents) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (categoryEvents.length === 0) {
    container.innerHTML = '<div class="social-empty">No events this week</div>';
    return;
  }

  container.innerHTML = categoryEvents.map(event => {
    const date = formatEventDate(event);
    const time = event.time || '';
    const location = event.location || '';

    return `
      <div class="social-event-item">
        <div class="social-event-name">${event.name}</div>
        <div class="social-event-details">
          ${date ? `
            <div class="social-event-detail">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span>${date}</span>
            </div>
          ` : ''}
          ${time ? `
            <div class="social-event-detail">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>${time}</span>
            </div>
          ` : ''}
        </div>
        ${location ? `<div class="social-event-location">${location}</div>` : ''}
      </div>
    `;
  }).join('');
}

// Format Date for Display
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
  const isFree = FREE_SOURCES.includes(event.source);
  const badgeDate = formatBadgeDate(event);
  const timeText = event.time && event.time !== 'See details' ? event.time : 'Event';

  return `
    <div class="event-card" data-id="${event.id}" data-category="${event.category}" data-start-date="${event.start_date || ''}" data-end-date="${event.end_date || ''}" ${animationDelay} role="article" tabindex="0">
      <div class="event-card-header">
        <div class="event-name">${event.name}</div>
        <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-id="${event.id}" aria-label="${isFavorited ? 'Remove from' : 'Add to'} favorites">
          <svg viewBox="0 0 24 24" fill="${isFavorited ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>
      </div>
      <div class="event-card-label">
        <div class="event-label-title">${event.location}</div>
        <div class="event-label-subtitle">${getCategoryName(event.category)}</div>
      </div>
      <div class="event-card-body"></div>
      <div class="event-card-footer">
        <div class="event-footer-left">
          <span class="event-footer-big">${badgeDate}</span>
          <span class="event-footer-small">${timeText}</span>
        </div>
        <div class="event-footer-right">${isFree ? 'Free' : formatEventDate(event)}</div>
      </div>
    </div>
  `;
}

// Modal
function openModal(eventId) {
  const event = events.find(e => e.id === eventId);
  if (!event) return;

  const isFavorited = favorites.includes(event.id);
  const isFree = FREE_SOURCES.includes(event.source);
  const dateDisplay = formatEventDate(event);
  const categoryName = getCategoryName(event.category);

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
        <span class="modal-pill-value">${formatBadgeDate(event)}</span>
        ${event.time && event.time !== 'See details' ? `<span class="modal-pill-sub">${event.time}</span>` : ''}
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
        <span class="modal-pill-value">${event.location}</span>
        ${event.address ? `<span class="modal-pill-sub">${event.address}</span>` : ''}
      </div>
    </div>`;

  const freePill = isFree ? `<div class="modal-free-pill">Free Entry</div>` : '';

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
            <span class="modal-highlight-text">${h}</span>
          </div>
        `).join('')}
      </div>
    </div>` : '';

  // CTA button
  const ctaHTML = event.url
    ? `<a href="${event.url}" target="_blank" rel="noopener noreferrer" class="modal-cta-btn">
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

  const modalContent = `
    <div class="modal-handle"></div>

    <!-- Hero -->
    <div class="modal-hero">
      <div class="modal-hero-bg" style="background-image: url('${event.image || ''}')"></div>
      <div class="modal-hero-gradient"></div>
      <span class="modal-hero-category">${categoryName}</span>
      <div class="modal-hero-title-block">
        <h2 class="modal-hero-title" id="modal-dynamic-title">${event.name}</h2>
        ${event.source ? `<div class="modal-source-badge"><span class="modal-source-dot"></span>${event.source}</div>` : ''}
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
    </div>

    <!-- Description -->
    <div class="modal-body-content">
      <span class="modal-section-label">About This Event</span>
      <p class="modal-description">${event.description}</p>
    </div>

    <!-- Highlights -->
    ${highlightsHTML}

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

async function loadTechStats() {
  try {
    // Measure API response time
    const startTime = performance.now();
    const response = await fetch(`${API_BASE_URL}/api/events`);
    const endTime = performance.now();
    const data = await response.json();

    // Update API speed (element may not exist in current layout)
    const apiSpeed = Math.round(endTime - startTime);
    const apiSpeedEl = document.getElementById('api-speed');
    if (apiSpeedEl) apiSpeedEl.textContent = `~${apiSpeed}ms`;

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


async function initNetworkGraph() {
  const canvas = document.getElementById('network-graph');
  if (!canvas) return;

  // Read canvas dimensions before the async fetch — getBoundingClientRect forces
  // a synchronous layout reflow so we get the real width even right after unhide.
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || 360; // fallback if layout hasn't settled
  const isMobile = width < 480;
  const height = isMobile ? Math.round(width * 0.85) : 440;

  // Fetch ALL events from API (not filtered by region)
  let allEvents = [];
  try {
    const response = await fetch(`${API_BASE_URL}/api/events`);
    const data = await response.json();
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
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    setInterval(() => {
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
    music: '#F07CAD',
    culinary: '#F0A050',
    fashion: '#C8A0C8',
    perks: '#50B8D8',
    lifestyle: '#70C080',
    community: '#E88060'
  };
  const CATEGORY_LABELS = {
    art: 'ART',
    music: 'MUSIC',
    culinary: 'FOOD',
    fashion: 'FASHION',
    perks: 'PERKS',
    lifestyle: 'LIFE',
    community: 'COMM.'
  };
  const ALL_CATEGORIES = ['art', 'music', 'culinary', 'fashion', 'perks', 'lifestyle', 'community'];

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

    requestAnimationFrame(animate);
  }

  animate();

  // Update stats
  const nodesEl = document.getElementById('network-nodes');
  const eventsEl = document.getElementById('network-events');
  if (nodesEl) nodesEl.textContent = sources.length;
  if (eventsEl) eventsEl.textContent = allEvents.length;

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

// ── Category Galleries ───────────────────────────────
const GALLERY_CATEGORIES = ['art', 'culinary', 'perks'];

function renderCategoryGalleries() {
  GALLERY_CATEGORIES.forEach(cat => {
    const row = document.getElementById(`gallery-${cat}`);
    if (!row) return;

    // Pick up to 5 random region-matched events for this category
    const pool = events.filter(e => e.category === cat && matchesCurrentRegion(e));
    const picked = pool.length <= 5 ? pool : pool.sort(() => Math.random() - 0.5).slice(0, 5);

    if (picked.length === 0) {
      row.innerHTML = `<div class="cat-gallery-empty">No events found in this area</div>`;
      return;
    }

    row.innerHTML = picked.map((event, i) => createEventCard(event, i)).join('');

    // Wire up card click → modal (same as main list)
    row.querySelectorAll('.event-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.favorite-btn')) {
          openModal(parseInt(card.dataset.id));
        }
      });
    });
    row.querySelectorAll('.favorite-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(parseInt(btn.dataset.id));
      });
    });
  });

  // "See all" buttons → navigate to Today filtered by category
  document.querySelectorAll('.cat-gallery-see-all').forEach(btn => {
    if (btn._soireeHandlerAttached) return;
    btn._soireeHandlerAttached = true;
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      document.querySelectorAll('.filter-chip').forEach(c => {
        const matches = c.dataset.filter === cat;
        c.classList.toggle('active', matches);
        c.setAttribute('aria-checked', matches ? 'true' : 'false');
      });
      currentFilter = cat;
      navigateToView('all');
    });
  });
}

// Keep old name as alias so region-change call still works
function updateCategoryCounts() { renderCategoryGalleries(); }

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

// ── Value strip event count ────────────────────────
function updateValueStrip() {
  const el = document.getElementById('value-events');
  if (el && events.length > 0) {
    el.textContent = events.length;
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    initRotatingTitle();
    initSubscribeForm();
    initSubscribeStrip();
    initSubscribeStripEvents();
    initScrollReveal();
    updateValueStrip();

    const freeCheckbox = document.getElementById('free-mode-toggle');
    if (freeCheckbox) freeCheckbox.addEventListener('change', toggleFreeMode);

    // Tech dashboard - always visible, initialize graph immediately
    const techDashboard = document.getElementById('tech-dashboard');
    if (techDashboard) {
      requestAnimationFrame(() => initNetworkGraph());
    }
  });
} else {
  init();
  initRotatingTitle();
  initSubscribeForm();
  initSubscribeStrip();
  initSubscribeStripEvents();
}
// v1.0.2

