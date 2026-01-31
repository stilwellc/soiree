// Configuration
const API_BASE_URL = window.location.origin;
const USE_API = true; // Set to false to use fallback data

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
let favorites = JSON.parse(localStorage.getItem('soireeFavorites') || '[]');

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

// Initialize App
async function init() {
  // Show loading state
  eventsList.innerHTML = `
    <div class="loading">
      <div class="loading-spinner" aria-hidden="true"></div>
      <p>Loading amazing events...</p>
    </div>
  `;

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

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
      closeModal();
    }
  });
}

// Filter Events
function handleFilterClick(chip) {
  filterChips.forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
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
    discoverView.classList.remove('hidden');
    favoritesView.classList.add('hidden');
    renderEvents();
  } else if (view === 'favorites') {
    discoverView.classList.add('hidden');
    favoritesView.classList.remove('hidden');
    renderFavorites();
  }
}

// Render Events
function renderEvents() {
  const filteredEvents = events.filter(event => {
    const matchesFilter = currentFilter === 'all' || event.category === currentFilter;
    const matchesSearch = !searchQuery ||
      event.name.toLowerCase().includes(searchQuery) ||
      event.location.toLowerCase().includes(searchQuery) ||
      event.description.toLowerCase().includes(searchQuery);

    return matchesFilter && matchesSearch;
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

// Create Event Card
function createEventCard(event, index) {
  const isFavorited = favorites.includes(event.id);
  const animationDelay = index < 3 ? `style="animation-delay: ${0.4 + index * 0.1}s"` : '';

  return `
    <div class="event-card" data-id="${event.id}" data-category="${event.category}" ${animationDelay} role="article" tabindex="0">
      <div class="event-image" style="background-image: url('${event.image}')">
        <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-id="${event.id}" aria-label="${isFavorited ? 'Remove from' : 'Add to'} favorites">
          <svg viewBox="0 0 24 24" fill="${isFavorited ? 'white' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>
        <div class="event-badge">${event.price === 'free' ? 'Free Entry' : event.price}</div>
      </div>
      <div class="event-details">
        <div class="event-date">${event.date} • ${event.time}</div>
        <div class="event-name">${event.name}</div>
        <div class="event-location">${event.location}</div>
        <div class="event-tags">
          <div class="tag">${getCategoryName(event.category)}</div>
          <div class="tag">${event.spots} spots left</div>
        </div>
      </div>
    </div>
  `;
}

// Modal
function openModal(eventId) {
  const event = events.find(e => e.id === eventId);
  if (!event) return;

  const isFavorited = favorites.includes(event.id);

  const modalContent = `
    <div class="modal-image" style="background-image: url('${event.image}')"></div>
    <div class="modal-content">
      <div class="modal-title">${event.name}</div>
      <div class="modal-meta">
        <div class="modal-meta-item">
          <svg class="modal-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>${event.date} • ${event.time}</span>
        </div>
        <div class="modal-meta-item">
          <svg class="modal-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span>${event.address}</span>
        </div>
        <div class="modal-meta-item">
          <svg class="modal-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span>${event.spots} spots remaining</span>
        </div>
      </div>
      <div class="modal-description">${event.description}</div>
      <div class="modal-highlights">
        <h3>Event Highlights</h3>
        <ul>
          ${event.highlights.map(h => `<li>${h}</li>`).join('')}
        </ul>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="handleRSVP(${event.id})">RSVP Now</button>
        <button class="btn btn-secondary" onclick="toggleFavorite(${event.id}); updateModalFavoriteBtn(${event.id})">
          ${isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
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

// Utilities
function getCategoryName(category) {
  const names = {
    art: 'Art & Culture',
    music: 'Music',
    culinary: 'Culinary',
    fashion: 'Fashion'
  };
  return names[category] || category;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
