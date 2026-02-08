/**
 * Date utility functions for consistent timezone handling across the application.
 * 
 * IMPORTANT: Always use these helpers to avoid UTC/local timezone bugs.
 * - Database stores dates as DATE type (no timezone)
 * - API returns dates as ISO strings (e.g., "2026-02-07T00:00:00.000Z")
 * - Frontend should compare dates in LOCAL timezone
 */

/**
 * Get today's date in YYYY-MM-DD format using LOCAL timezone
 * @returns {string} Date string in YYYY-MM-DD format
 */
function getTodayLocal() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get tomorrow's date in YYYY-MM-DD format using LOCAL timezone
 * @returns {string} Date string in YYYY-MM-DD format
 */
function getTomorrowLocal() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Convert a Date object to YYYY-MM-DD format using LOCAL timezone
 * @param {Date} date - Date object to convert
 * @returns {string} Date string in YYYY-MM-DD format
 */
function formatDateLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Extract date portion from ISO string (ignores timezone)
 * @param {string} isoString - ISO date string (e.g., "2026-02-07T00:00:00.000Z")
 * @returns {string} Date string in YYYY-MM-DD format
 */
function extractDateFromISO(isoString) {
    return isoString.split('T')[0];
}

/**
 * Get the end of the current week (Sunday) in YYYY-MM-DD format using LOCAL timezone
 * @returns {string} Date string in YYYY-MM-DD format
 */
function getEndOfWeekLocal() {
    const today = new Date();
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
    return formatDateLocal(endOfWeek);
}

/**
 * Check if a date string is today (local timezone)
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {boolean}
 */
function isToday(dateStr) {
    return dateStr === getTodayLocal();
}

/**
 * Check if a date string is tomorrow (local timezone)
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {boolean}
 */
function isTomorrow(dateStr) {
    return dateStr === getTomorrowLocal();
}

// Export for Node.js (backend)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getTodayLocal,
        getTomorrowLocal,
        formatDateLocal,
        extractDateFromISO,
        getEndOfWeekLocal,
        isToday,
        isTomorrow
    };
}
