/**
 * DashTiny Date Formatter
 * Canonical date formatting utility for search summaries, trip contexts, cards, and comparisons.
 * Parses YYYY-MM-DD cleanly without timezone skew.
 */

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const WEEKDAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Format a YYYY-MM-DD string to friendly date:
 * - default: "20 Oct 2026"
 * - withWeekday: "Tue, 20 Oct"
 * - noYear: "20 Oct"
 */
export function formatFriendlyDate(
  dateStr?: string | null,
  options?: { includeYear?: boolean; withWeekday?: boolean }
): string {
  if (!dateStr) return '';

  const { includeYear = true, withWeekday = false } = options || {};

  try {
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);

      if (!isNaN(year) && monthIdx >= 0 && monthIdx < 12 && !isNaN(day)) {
        const d = new Date(year, monthIdx, day);
        const month = MONTH_NAMES_SHORT[monthIdx];
        const weekday = WEEKDAY_NAMES_SHORT[d.getDay()];

        if (withWeekday) {
          return `${weekday}, ${day} ${month}`;
        }

        return includeYear ? `${day} ${month} ${year}` : `${day} ${month}`;
      }
    }

    const fallbackDate = new Date(dateStr);
    if (!isNaN(fallbackDate.getTime())) {
      const day = fallbackDate.getDate();
      const month = MONTH_NAMES_SHORT[fallbackDate.getMonth()];
      const year = fallbackDate.getFullYear();
      const weekday = WEEKDAY_NAMES_SHORT[fallbackDate.getDay()];

      if (withWeekday) {
        return `${weekday}, ${day} ${month}`;
      }
      return includeYear ? `${day} ${month} ${year}` : `${day} ${month}`;
    }
  } catch {
    // Ignore and fallback to raw string
  }

  return dateStr;
}

/**
 * Formats a date range cleanly:
 * "20–25 Oct" (same month) or "20 Oct – 05 Nov" or "20–25 Oct 2026"
 */
export function formatFriendlyDateRange(startStr?: string | null, endStr?: string | null): string {
  if (!startStr) return '';
  if (!endStr) return formatFriendlyDate(startStr);

  try {
    const sParts = startStr.split('T')[0].split('-');
    const eParts = endStr.split('T')[0].split('-');

    if (sParts.length === 3 && eParts.length === 3) {
      const sYear = sParts[0];
      const sMonth = parseInt(sParts[1], 10) - 1;
      const sDay = parseInt(sParts[2], 10);

      const eYear = eParts[0];
      const eMonth = parseInt(eParts[1], 10) - 1;
      const eDay = parseInt(eParts[2], 10);

      // Same year and month: "20–25 Oct"
      if (sYear === eYear && sMonth === eMonth) {
        return `${sDay}–${eDay} ${MONTH_NAMES_SHORT[sMonth]}`;
      }

      // Same year, different months: "20 Oct – 5 Nov"
      if (sYear === eYear) {
        return `${sDay} ${MONTH_NAMES_SHORT[sMonth]} – ${eDay} ${MONTH_NAMES_SHORT[eMonth]}`;
      }

      // Different years: "20 Oct 2026 – 5 Jan 2027"
      return `${sDay} ${MONTH_NAMES_SHORT[sMonth]} ${sYear} – ${eDay} ${MONTH_NAMES_SHORT[eMonth]} ${eYear}`;
    }
  } catch {
    // Fallback
  }

  return `${formatFriendlyDate(startStr, { includeYear: false })} – ${formatFriendlyDate(endStr, { includeYear: true })}`;
}

/**
 * Returns today's date in the user's local timezone formatted as YYYY-MM-DD.
 * Prevents UTC offset bugs where early-morning local dates are treated as yesterday.
 */
export function getLocalTodayDate(dateObj: Date = new Date()): string {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Adds days to a YYYY-MM-DD date string using local date math without timezone drift.
 */
export function addDaysToDate(dateStr: string, days: number): string {
  if (!dateStr) return '';
  const parts = dateStr.split('T')[0].split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return dateStr;
  }
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + days);
  return getLocalTodayDate(d);
}
