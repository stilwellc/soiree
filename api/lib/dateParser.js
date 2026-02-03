/**
 * Date parsing utility for extracting structured dates from human-readable text
 */

/**
 * Parse a date string and return structured date information
 * @param {string} dateText - Human-readable date text (e.g., "Friday", "Jan 24", "This Weekend")
 * @param {string} timeText - Time text (optional, can contain date info)
 * @returns {Object} { start_date: Date, end_date: Date }
 */
export function parseDateText(dateText = '', timeText = '') {
  const now = new Date();
  const combinedText = `${dateText} ${timeText}`.toLowerCase().trim();

  let startDate = null;
  let endDate = null;

  // Handle "Today" or "Tonight"
  if (combinedText.match(/\b(today|tonight)\b/)) {
    startDate = new Date(now);
    endDate = new Date(now);
  }

  // Handle "Tomorrow"
  else if (combinedText.match(/\btomorrow\b/)) {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() + 1);
    endDate = new Date(startDate);
  }

  // Handle day of week (e.g., "Friday", "Saturday")
  else {
    const dayMatch = combinedText.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    if (dayMatch) {
      const targetDay = dayMatch[1];
      startDate = getNextDayOfWeek(targetDay, now);
      endDate = new Date(startDate);
    }
  }

  // Handle specific date formats (e.g., "January 24", "Jan 24", "1/24")
  if (!startDate) {
    const dateMatch = dateText.match(/([A-Za-z]+)\s+(\d{1,2})/);
    if (dateMatch) {
      const [, month, day] = dateMatch;
      startDate = parseMonthDay(month, day, now);
      endDate = new Date(startDate);
    }
  }

  // Handle numeric dates (e.g., "1/24", "01/24/2026")
  if (!startDate) {
    const numericMatch = combinedText.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
    if (numericMatch) {
      const [, month, day, year] = numericMatch;
      const fullYear = year ? (year.length === 2 ? 2000 + parseInt(year) : parseInt(year)) : now.getFullYear();
      startDate = new Date(fullYear, parseInt(month) - 1, parseInt(day));
      endDate = new Date(startDate);
    }
  }

  // Handle date ranges (e.g., "Jan 24-26", "Friday - Sunday")
  const rangeMatch = dateText.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})/);
  if (rangeMatch && startDate) {
    const [, startDay, endDay] = rangeMatch;
    endDate = new Date(startDate);
    endDate.setDate(parseInt(endDay));
  }

  // Handle weekend keywords
  if (combinedText.match(/\b(this\s+)?weekend\b/) && !startDate) {
    startDate = getNextDayOfWeek('friday', now);
    endDate = getNextDayOfWeek('sunday', now);
  }

  // Handle week keywords
  if (combinedText.match(/\b(this\s+)?week\b/) && !startDate) {
    startDate = new Date(now);
    endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 7);
  }

  // Handle full date formats with year (e.g., "Sat, Oct 11, 2025", "January 15, 2026")
  if (!startDate) {
    const fullDateMatch = combinedText.match(/([A-Za-z]+)[,\s]+([A-Za-z]+)\s+(\d{1,2})[,\s]+(\d{4})/);
    if (fullDateMatch) {
      const [, , month, day, year] = fullDateMatch;
      startDate = parseMonthDay(month, day, now);
      startDate.setFullYear(parseInt(year));
      endDate = new Date(startDate);
    }
  }

  // Try another format: "Month Day, Year" (e.g., "October 11, 2025")
  if (!startDate) {
    const altDateMatch = combinedText.match(/([A-Za-z]+)\s+(\d{1,2})[,\s]+(\d{4})/);
    if (altDateMatch) {
      const [, month, day, year] = altDateMatch;
      startDate = parseMonthDay(month, day, now);
      startDate.setFullYear(parseInt(year));
      endDate = new Date(startDate);
    }
  }

  // If we still don't have a date, return nulls (don't guess!)
  if (!startDate) {
    return { start_date: null, end_date: null };
  }

  // Normalize dates to midnight UTC for consistency
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  // Return ISO date strings
  return {
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0]
  };
}

/**
 * Get the next occurrence of a specific day of the week
 * @param {string} targetDay - Day name (e.g., "friday")
 * @param {Date} fromDate - Starting date
 * @returns {Date}
 */
function getNextDayOfWeek(targetDay, fromDate) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDayIndex = days.indexOf(targetDay.toLowerCase());

  if (targetDayIndex === -1) {
    return new Date(fromDate);
  }

  const currentDayIndex = fromDate.getDay();
  let daysUntilTarget = targetDayIndex - currentDayIndex;

  // If the target day is today or has passed this week, get next week's occurrence
  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7;
  }

  const nextDate = new Date(fromDate);
  nextDate.setDate(nextDate.getDate() + daysUntilTarget);
  return nextDate;
}

/**
 * Parse month name and day into a Date object
 * @param {string} monthStr - Month name (e.g., "January", "Jan")
 * @param {string} dayStr - Day number
 * @param {Date} referenceDate - Reference date for determining year
 * @returns {Date}
 */
function parseMonthDay(monthStr, dayStr, referenceDate) {
  const months = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11
  };

  const monthIndex = months[monthStr.toLowerCase()];
  if (monthIndex === undefined) {
    return new Date(referenceDate);
  }

  const day = parseInt(dayStr);
  const year = referenceDate.getFullYear();

  // Create date with the parsed month and day
  let date = new Date(year, monthIndex, day);

  // If the date is in the past, assume it's for next year
  if (date < referenceDate) {
    date = new Date(year + 1, monthIndex, day);
  }

  return date;
}

/**
 * Extract date from a time element's text (handles formats like "Jan 24 - 7:00 PM")
 * @param {string} timeElemText - Text content from time element
 * @returns {Object} { date: string, time: string, start_date: string, end_date: string }
 */
export function extractDateFromTimeText(timeElemText) {
  const parts = timeElemText.split('-');
  let dateStr = '';
  let timeStr = '';

  if (parts.length > 0) {
    dateStr = parts[0].trim();

    // Check if there's a time component
    const timeMatch = timeElemText.match(/(\d{1,2}:\d{2}\s*[AP]M.*)/i);
    if (timeMatch) {
      timeStr = timeMatch[1];
    }
  }

  const { start_date, end_date } = parseDateText(dateStr, timeStr);

  return {
    date: dateStr || 'See details',
    time: timeStr || 'See details',
    start_date,
    end_date
  };
}
