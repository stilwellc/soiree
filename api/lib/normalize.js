/**
 * @typedef {Object} NormalizedEvent
 * @property {string} name - Event title
 * @property {string} category - Event category (e.g., 'art', 'music')
 * @property {string} date - Display date (string)
 * @property {string} time - Display time (string)
 * @property {string} location - Venue name or neighborhood
 * @property {string} address - Detailed address
 * @property {string} price - Price string (default: "free")
 * @property {number} spots - Number of available spots (default: random or specific)
 * @property {string} image - URL to event image
 * @property {string} description - Short description
 * @property {string[]} highlights - Array of highlight strings
 * @property {string} url - Source URL (unique key)
 * @property {string|null} start_date - ISO timestamp
 * @property {string|null} end_date - ISO timestamp
 * @property {string} source - Source of the event (e.g., "TimeOut", "NYC For Free")
 */

/**
 * Creates a normalized event object with defaults and validation.
 * @param {Partial<NormalizedEvent>} data - Raw event data
 * @returns {NormalizedEvent|null} - Normalized event or null if invalid
 */
function createNormalizedEvent(data) {
    const {
        name,
        category = 'community',
        date = 'Upcoming',
        time = 'See details',
        location = 'New York City',
        address = 'NYC',
        price = 'free',
        spots = 50,
        image,
        description,
        highlights = [],
        url,
        start_date = null,
        end_date = null,
        source = 'Unknown'
    } = data;

    if (!name || name.trim().length < 2) return null;
    if (!url || !url.startsWith('http')) return null;
    if (!start_date) return null;

    return {
        name: name.trim().substring(0, 255),
        category: category.toLowerCase().trim(),
        date: date.trim().substring(0, 100),
        time: time.trim().substring(0, 100),
        location: location.trim().substring(0, 255),
        address: address.trim().substring(0, 500),
        price: price.trim().substring(0, 50),
        spots: typeof spots === 'number' ? spots : parseInt(spots, 10) || 50,
        image: image || null,
        description: (description || name).trim().substring(0, 500),
        highlights: Array.isArray(highlights) ? highlights.slice(0, 5) : [],
        url: url.trim().substring(0, 500),
        start_date,
        end_date: end_date || start_date,
        source
    };
}

module.exports = { createNormalizedEvent };
