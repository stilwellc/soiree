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
 * @property {string|null} event_type - Event type for art galleries: 'opening', 'exhibition', or null
 */

/**
 * Validates and enriches event name to ensure it's descriptive and useful.
 * Filters out generic/bad names and enhances short ones with context.
 */
function validateAndEnrichName(name, category, location, source, description) {
    if (!name || typeof name !== 'string') return null;

    let cleanName = name.trim()
        .replace(/\s+/g, ' ')  // normalize whitespace
        .replace(/^["']|["']$/g, '')  // remove surrounding quotes
        .substring(0, 255);

    // Filter out bad patterns
    const badPatterns = [
        /^upcoming exhibitions?$/i,
        /^current exhibitions?$/i,
        /^new exhibitions?$/i,
        /^exhibitions?$/i,
        /^events?$/i,
        /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+\w+\s+\d+,?\s+\d{4}$/i,  // Just dates
        /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/,  // Date formats
        /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d+$/i,  // "April 15"
        /^coming soon$/i,
        /^tbd$/i,
        /^to be announced$/i,
    ];

    for (const pattern of badPatterns) {
        if (pattern.test(cleanName)) {
            return null;
        }
    }

    // Filter out single-word names (too vague)
    const words = cleanName.split(/\s+/);
    if (words.length === 1) {
        return null;
    }

    // Strict filter for gallery/art artist-only names (FirstName LastName)
    // These are too vague without context - reject them entirely
    if (category === 'art') {
        // Reject exactly 2-word names with no descriptive terms (likely artist names)
        // This catches: "Aaron Gilbert", "Jose Dávila", "Lindsay Adams", "Martin Wong", "Lisa Yuskavage"
        if (words.length === 2 &&
            !/exhibition|show|opening|retrospective|collection|works|presents|festival|night|series|paintings|sculptures|drawings|photographs|installation|party|concert|performance|screening/i.test(cleanName)) {
            return null;
        }

        // For 3-word art names, add "Exhibition" if no descriptive terms
        if (words.length === 3 && !/exhibition|show|opening|retrospective|collection|works|presents|festival|night|party|concert|performance|screening/i.test(cleanName)) {
            cleanName = `${cleanName} Exhibition`;
        }
    }

    // Filter out generic all-caps short titles (like "CHAIR SHOW")
    if (cleanName === cleanName.toUpperCase() && words.length <= 2 && cleanName.length < 20) {
        return null;
    }

    // Filter out if too short after enhancement (< 8 chars total)
    if (cleanName.length < 8) {
        return null;
    }

    // Clean up malformed names (remove stray addresses, etc.)
    cleanName = cleanName
        .replace(/\s+\d{3,5}\s+[A-Z][a-z]+.*Boulevard.*$/i, '')  // Remove addresses at end
        .replace(/\s+organized by.*$/i, '')  // Remove "organized by..." suffix
        .replace(/\s+through\s*$/i, '')  // Remove "through" at end
        .trim();

    // Final length check
    if (cleanName.length < 5) return null;

    return cleanName;
}

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
        source = 'Unknown',
        event_type = null
    } = data;

    if (!url || !url.startsWith('http')) return null;
    if (!start_date) return null;

    // Validate and enrich the name
    const validName = validateAndEnrichName(name, category, location, source, description);
    if (!validName) return null;

    return {
        name: validName,
        category: category.toLowerCase().trim(),
        date: date.trim().substring(0, 100),
        time: time.trim().substring(0, 100),
        location: location.trim().substring(0, 255),
        address: address.trim().substring(0, 500),
        price: price.trim().substring(0, 50),
        spots: typeof spots === 'number' ? spots : parseInt(spots, 10) || 50,
        image: image || null,
        description: (description || name).trim().substring(0, 1500),
        highlights: Array.isArray(highlights) ? highlights.slice(0, 5) : [],
        url: url.trim().substring(0, 500),
        start_date,
        end_date: end_date || start_date,
        source,
        event_type: event_type || null
    };
}

/**
 * Generate contextual highlights from event data.
 * Scans name + description for signals and builds up to 4 relevant bullet points.
 */
function generateHighlights(name, description, category, location, source) {
    const text = ((name || '') + ' ' + (description || '')).toLowerCase();
    const highlights = [];

    if (/\bfree\b/.test(text)) highlights.push('Free admission');
    else if (/\brsvp\b/.test(text)) highlights.push('RSVP required');

    if (/\blive\s+(music|band|performance|jazz|dj|concert)\b/.test(text)) highlights.push('Live performance');
    else if (/\bjazz\b/.test(text)) highlights.push('Live jazz');
    else if (/\bdj\b/.test(text)) highlights.push('DJ set');
    else if (/\bconcert|symphony|orchestra|choir\b/.test(text)) highlights.push('Live concert');

    if (/\bworkshop|hands.on|interactive\b/.test(text)) highlights.push('Interactive workshop');
    else if (/\bpanel|discussion|talk|lecture|seminar\b/.test(text)) highlights.push('Panel discussion');
    else if (/\bscreening|film|movie\b/.test(text)) highlights.push('Film screening');
    else if (/\bexhibit|exhibition|gallery|installation\b/.test(text)) highlights.push('Art exhibition');
    else if (/\btour|guided\b/.test(text)) highlights.push('Guided tour');
    else if (/\bmarket|vendor|pop.?up\b/.test(text)) highlights.push('Pop-up market');
    else if (/\bfestival\b/.test(text)) highlights.push('Multi-day festival');
    else if (/\bnetworking|mixer|meetup\b/.test(text)) highlights.push('Networking event');

    if (/\bcocktail|open bar|drinks?\b/.test(text)) highlights.push('Cocktails available');
    else if (/\bwine\b/.test(text)) highlights.push('Wine available');
    else if (/\bbeer|brewery\b/.test(text)) highlights.push('Craft beer');
    else if (/\bfood|tasting|sample|snack|bite\b/.test(text)) highlights.push('Food available');
    else if (/\bcoffee|cafe|espresso\b/.test(text)) highlights.push('Coffee & drinks');

    if (/\bfamily|kids|children|all ages\b/.test(text)) highlights.push('Family friendly');
    else if (/\badult|21\+|21 and over\b/.test(text)) highlights.push('21+ event');
    else if (/\bdog|pet.friendly\b/.test(text)) highlights.push('Pet friendly');

    if (/\boutdoor|rooftop|park|garden|open.?air\b/.test(text)) highlights.push('Outdoor venue');
    else if (/\bwaterfront|waterside|harbor|river\b/.test(text)) highlights.push('Waterfront location');

    if (/\bgiveaway|raffle|prize\b/.test(text)) highlights.push('Giveaways & prizes');
    if (/\bswag|goodie|gift bag\b/.test(text)) highlights.push('Free swag');
    if (/\bphoto\s*(op|booth|wall)|instagram\b/.test(text)) highlights.push('Photo opportunities');

    if (highlights.length < 2) {
        const catFallbacks = {
            art: ['Visual arts', 'Cultural experience'],
            music: ['Live entertainment', 'Music experience'],
            culinary: ['Culinary experience', 'Local flavors'],
            fashion: ['Fashion showcase', 'Style inspiration'],
            lifestyle: ['Wellness & lifestyle', 'Self-care'],
            perks: ['Exclusive perks', 'Limited availability'],
            community: ['Community gathering', 'Local event'],
        };
        (catFallbacks[category] || catFallbacks.community).forEach(h => highlights.push(h));
    }

    if (highlights.length < 4 && location && location !== 'New York City' && location !== 'NYC') {
        highlights.push(location);
    }

    if (highlights.length < 3 && source && source !== 'Unknown') {
        highlights.push(`Via ${source}`);
    }

    return [...new Set(highlights)].slice(0, 4);
}

module.exports = { createNormalizedEvent, generateHighlights };
