export interface ActivityItem {
  time: string;
  description: string;
  location: string;
  placeType?: 'TA' | 'R' | 'H'; // TA: Tourist Attraction, R: Restaurant, H: Hotel
  estimatedCost?: number;
}

export interface DayItineraryData {
  dayNumber: number;
  title: string;
  coverImage?: string;
  weather?: string;
  activities: ActivityItem[];
}

export interface StructuredItineraryData {
  id: string;
  title: string;
  destination: string;
  source?: string;
  startDate: string;
  endDate: string;
  budget: number;
  days: DayItineraryData[];
}

export interface PlannerRequest {
  destination: string;
  origin?: string;
  start_date?: string;
  end_date?: string;
  days_count: number;
  travellers: number;
  budget: number;
  currency: string;
  persona: string;
  vibe?: string;
  interests?: string[];
  raw_prompt?: string;
}

export interface ParsedTravelPrompt extends PlannerRequest {
  isItinerary: boolean;
  budgetFormatted: string;
  isBudgetSpecified: boolean;
  companions: number; // backward compatibility
  companionsSource: 'prompt' | 'url' | 'default';
  source?: string; // backward compatibility
  rawPrompt: string; // backward compatibility
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

function formatIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Robust date extractor supporting natural travel expressions:
 * - "Goa from December 10 to December 15"
 * - "from Dec 10 to 15" / "Dec 10 - 15"
 * - "from 10 Dec to 15 Dec" / "10 to 15 Dec"
 * - "starting Nov 12 for 5 days"
 * - "2026-12-10 to 2026-12-15"
 */
export function parseDatesFromText(text: string, defaultDays: number = 4): { start_date?: string; end_date?: string; calculatedDays?: number } {
  const lower = text.toLowerCase();
  const now = new Date();
  const currentYear = now.getFullYear();

  // Pattern 1: ISO Dates: "2026-12-10 to 2026-12-15"
  const iso = lower.match(/(\d{4}-\d{2}-\d{2})\s*(?:to|-|until|through)\s*(\d{4}-\d{2}-\d{2})/);
  if (iso) {
    const s = new Date(iso[1]);
    const e = new Date(iso[2]);
    if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e >= s) {
      return { start_date: iso[1], end_date: iso[2], calculatedDays: Math.round((e.getTime() - s.getTime()) / 86400000) + 1 };
    }
  }

  // Pattern 2: Month Day to (Month) Day: 'December 10 to December 15', 'Dec 10 - 15'
  const m1 = lower.match(/(?:from\s+)?([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:to|-|until|through)\s*(?:([a-z]+)\s+)?(\d{1,2})(?:st|nd|rd|th)?/);
  if (m1) {
    const mon1 = m1[1];
    const d1 = parseInt(m1[2], 10);
    const mon2 = m1[3] || mon1;
    const d2 = parseInt(m1[4], 10);
    if (MONTH_MAP[mon1] !== undefined && MONTH_MAP[mon2] !== undefined) {
      const idx1 = MONTH_MAP[mon1];
      const idx2 = MONTH_MAP[mon2];
      let y1 = currentYear;
      if (idx1 < now.getMonth()) y1 = currentYear + 1;
      const y2 = idx2 < idx1 ? y1 + 1 : y1;
      const s = new Date(y1, idx1, d1);
      const e = new Date(y2, idx2, d2);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e >= s) {
        return { start_date: formatIsoDate(s), end_date: formatIsoDate(e), calculatedDays: Math.round((e.getTime() - s.getTime()) / 86400000) + 1 };
      }
    }
  }

  // Pattern 3: Day Month to Day Month: '10 to 15 Dec', '10th Dec to 15th Dec'
  const m2 = lower.match(/(?:from\s+)?(\d{1,2})(?:st|nd|rd|th)?\s*(?:([a-z]+)\s+)?(?:to|-|until|through)\s*(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)/);
  if (m2) {
    const d1 = parseInt(m2[1], 10);
    const mon2 = m2[4];
    const mon1 = m2[2] || mon2;
    const d2 = parseInt(m2[3], 10);
    if (MONTH_MAP[mon1] !== undefined && MONTH_MAP[mon2] !== undefined) {
      const idx1 = MONTH_MAP[mon1];
      const idx2 = MONTH_MAP[mon2];
      let y1 = currentYear;
      if (idx1 < now.getMonth()) y1 = currentYear + 1;
      const y2 = idx2 < idx1 ? y1 + 1 : y1;
      const s = new Date(y1, idx1, d1);
      const e = new Date(y2, idx2, d2);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e >= s) {
        return { start_date: formatIsoDate(s), end_date: formatIsoDate(e), calculatedDays: Math.round((e.getTime() - s.getTime()) / 86400000) + 1 };
      }
    }
  }

  // Pattern 4: Single date: 'starting Dec 10', 'from 10 Dec'
  const m3 = lower.match(/(?:starting|from|on)\s+(?:([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?|(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+))/);
  if (m3) {
    const mon = m3[1] || m3[4];
    const d = parseInt(m3[2] || m3[3], 10);
    if (mon && MONTH_MAP[mon] !== undefined && !isNaN(d)) {
      const idx = MONTH_MAP[mon];
      let y = currentYear;
      if (idx < now.getMonth()) y = currentYear + 1;
      const s = new Date(y, idx, d);
      if (!isNaN(s.getTime())) {
        const e = new Date(s);
        e.setDate(s.getDate() + Math.max(0, defaultDays - 1));
        return { start_date: formatIsoDate(s), end_date: formatIsoDate(e), calculatedDays: defaultDays };
      }
    }
  }

  return {};
}

export function parseInterestsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const known = [
    { key: 'beaches', words: ['beach', 'beaches', 'coastal', 'ocean', 'sea'] },
    { key: 'scuba & watersports', words: ['scuba', 'snorkel', 'diving', 'surfing', 'kayak'] },
    { key: 'hiking & mountains', words: ['trek', 'trekking', 'hike', 'hiking', 'mountain', 'alpine'] },
    { key: 'culinary & dining', words: ['food', 'dining', 'cuisine', 'tasting', 'seafood', 'restaurant', 'cafe'] },
    { key: 'heritage & culture', words: ['temple', 'heritage', 'monument', 'history', 'historic', 'fort', 'culture'] },
    { key: 'nightlife & parties', words: ['nightlife', 'party', 'club', 'pub', 'cocktail', 'lounge'] },
    { key: 'wellness & spa', words: ['spa', 'wellness', 'yoga', 'ayurveda', 'relaxation', 'retreat'] },
    { key: 'photography', words: ['photo', 'photography', 'viewpoint', 'sunset', 'sunrise'] },
  ];

  const found: string[] = [];
  for (const item of known) {
    if (item.words.some((w) => lower.includes(w))) {
      found.push(item.key);
    }
  }
  return found;
}

/**
 * Parses Indian currency terms (lakh, L, k, standard commas) into integer numbers.
 * Examples:
 * - "1.5 lakh" / "1.5L" -> 150000
 * - "2 lakh" -> 200000
 * - "80k" -> 80000
 * - "₹1,50,000" -> 150000
 */
export function parseBudgetFromText(text: string, daysCount: number = 4, isInternational: boolean = false): { budget: number; formatted: string; isSpecified: boolean } {
  const lower = text.toLowerCase();

  // Pattern 1: Lakhs (e.g. "1.5 lakh", "2 lakhs", "1.5L", "2lac")
  const lakhMatch = lower.match(/(?:₹|rs\.?|inr|under|budget\s*(?:of)?|around)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:lakh|lakhs|lac|lacs|l\b)/i);
  if (lakhMatch && lakhMatch[1]) {
    const val = parseFloat(lakhMatch[1]) * 100000;
    return { budget: Math.round(val), formatted: `₹${val.toLocaleString('en-IN')}`, isSpecified: true };
  }

  // Pattern 2: Thousands with 'k' (e.g. "50k", "85k")
  const kMatch = lower.match(/(?:₹|rs\.?|inr|under|budget\s*(?:of)?|around)?\s*([0-9]+)\s*k\b/i);
  if (kMatch && kMatch[1]) {
    const val = parseInt(kMatch[1], 10) * 1000;
    return { budget: val, formatted: `₹${val.toLocaleString('en-IN')}`, isSpecified: true };
  }

  // Pattern 3: Standard currency numbers (e.g. "₹1,50,000", "75000")
  const numMatch = lower.match(/(?:₹|rs\.?|inr|under|budget\s*(?:of)?|around)\s*([0-9]{1,3}(?:,[0-9]{2,3})+|[0-9]{4,7})/i);
  if (numMatch && numMatch[1]) {
    const cleanNum = parseInt(numMatch[1].replace(/,/g, ''), 10);
    if (!isNaN(cleanNum) && cleanNum >= 5000) {
      return { budget: cleanNum, formatted: `₹${cleanNum.toLocaleString('en-IN')}`, isSpecified: true };
    }
  }

  // Not specified by traveler
  return { budget: 0, formatted: 'Not specified', isSpecified: false };
}

/**
 * Extracts duration/days count from phrases like:
 * - "7-day", "7 days", "10 days"
 * - "1 week" -> 7
 * - "2 weeks" -> 14
 * - "weekend" -> 3
 * - "4 nights" -> 5
 */
export function parseDaysCountFromText(text: string): number {
  const lower = text.toLowerCase();

  if (lower.includes('weekend')) return 3;
  if (lower.includes('1 week') || lower.includes('one week')) return 7;
  if (lower.includes('2 weeks') || lower.includes('two weeks')) return 14;

  const dayMatch = lower.match(/(\d+)\s*(?:day|days|-day)/i);
  if (dayMatch && dayMatch[1]) {
    return Math.min(14, Math.max(1, parseInt(dayMatch[1], 10)));
  }

  const nightMatch = lower.match(/(\d+)\s*(?:night|nights)/i);
  if (nightMatch && nightMatch[1]) {
    return Math.min(14, Math.max(1, parseInt(nightMatch[1], 10) + 1));
  }

  return 4; // default sensible duration
}

/**
 * Extracts destination cleanly from natural prompts.
 */
export function parseDestinationFromText(text: string): { destination: string; source?: string } {
  // Pattern 1: '(escape|trip|vacation) to <destination> from <source>'
  const escToFrom = text.match(/(?:trip|getaway|escape|holiday|vacation|travel|passage)\s+to\s+([a-zA-Z\s]+?)\s+from\s+([a-zA-Z\s]+?)(?=\s+(?:with|under|for|budget|$))/i);
  if (escToFrom && escToFrom[1] && escToFrom[2]) {
    return { destination: cleanName(escToFrom[1]), source: cleanName(escToFrom[2]) };
  }

  // Pattern 2: 'from <source> to <destination>' (exclude date month collisions)
  const isDateWord = (w: string) => /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d)/i.test(w.trim());
  const fromToMatch = text.match(/(?:from\s+)([a-zA-Z\s]+?)\s+to\s+([a-zA-Z\s]+?)(?=\s+(?:under|with|for|in|on|at|budget|trip|escape|vacation|$))/i);
  if (fromToMatch && fromToMatch[1] && fromToMatch[2] && !isDateWord(fromToMatch[1]) && !isDateWord(fromToMatch[2])) {
    return {
      source: cleanName(fromToMatch[1]),
      destination: cleanName(fromToMatch[2]),
    };
  }

  // Pattern 3: City at start before 'from <date>' e.g. 'Goa from December 10 to December 15'
  const cityBeforeDate = text.match(/^([a-zA-Z\s]+?)\s+(?:from\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d)|between|for\s+\d|under|with|starting)/i);
  if (cityBeforeDate && cityBeforeDate[1]) {
    const candidate = cleanName(cityBeforeDate[1]);
    if (candidate && candidate.length > 1) {
      return { destination: candidate };
    }
  }

  // Pattern 4: "<duration> <destination> trip/getaway" (e.g. "7-day Japan trip", "4 days Manali holiday")
  const durationDestMatch = text.match(/(?:\d+\s*(?:day|days|-day|week|nights?))\s+([a-zA-Z\s]+?)\s+(?:trip|getaway|itinerary|holiday|vacation|tour|escape)/i);
  if (durationDestMatch && durationDestMatch[1]) {
    const candidate = cleanName(durationDestMatch[1]);
    if (candidate && candidate.length > 2) {
      return { destination: candidate };
    }
  }

  // Pattern 5: "<duration> <destination> <anything else>" e.g. "5-day Andaman white sands & scuba"
  const durAny = text.match(/(?:\d+\s*(?:day|days|-day|week|nights?))\s+([a-zA-Z]+)/i);
  if (durAny && durAny[1]) {
    const candidate = cleanName(durAny[1]);
    if (candidate && candidate.length > 2 && !['Day', 'Days', 'Night', 'Nights', 'Weekend'].includes(candidate)) {
      return { destination: candidate };
    }
  }

  // Pattern 6: "(trip|holiday|vacation|getaway|escape|travel)\s+(?:to|in|for)\s+([a-zA-Z\s]+)"
  const intentMatch = text.match(/(?:trip|holiday|vacation|getaway|escape|travel|journey|flight|hotels?|passage)\s+(?:to|in|for)\s+([a-zA-Z\s]+?)(?=\s+(?:from|under|with|for|budget|in\s+\d|on|$))/i);
  if (intentMatch && intentMatch[1]) {
    const candidate = cleanName(intentMatch[1]);
    if (candidate && candidate.length > 2) {
      return { destination: candidate };
    }
  }

  // Pattern 7: "to\s+([a-zA-Z\s]+)"
  const toMatch = text.match(/(?:^|\s)to\s+([a-zA-Z\s]+?)(?=\s+(?:under|with|for|budget|from|$))/i);
  if (toMatch && toMatch[1]) {
    const candidate = cleanName(toMatch[1]);
    if (candidate && candidate.length > 2) {
      return { destination: candidate };
    }
  }

  // Fallback: If nothing matched, attempt extracting cleaned subject words
  const words = cleanName(text).split(' ').filter(w => w.length > 2);
  if (words.length > 0) {
    return { destination: words.slice(0, 2).join(' ') };
  }
  return { destination: 'Your Dream Destination' };
}

function cleanName(raw: string): string {
  // Strip common noisy words
  const stripped = raw
    .replace(/\b(a|an|the|under|with|for|my|our|partner|friends|squad|couple|family|budget|trip|luxury|cheap|best|escape|getaway|vacation|holiday|passage|weekend|white\s+sands|scuba|starting|from|to|between|around)\b/gi, '')
    .trim();

  // Capitalize title
  return stripped
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Natural language intent parser for DashTiny travel requests.
 * Produces canonical PlannerRequest with no information discarded.
 */
export function parseTravelPrompt(prompt: string): ParsedTravelPrompt {
  const lower = prompt.toLowerCase();
  let days_count = parseDaysCountFromText(prompt);
  const { destination, source } = parseDestinationFromText(prompt);

  // Date parsing: Extract explicit dates and recalculate days_count if both dates provided
  const { start_date, end_date, calculatedDays } = parseDatesFromText(prompt, days_count);
  if (calculatedDays) {
    days_count = calculatedDays;
  }

  // Check international vs domestic heuristic
  const internationalKeywords = ['japan', 'tokyo', 'kyoto', 'paris', 'france', 'bali', 'indonesia', 'vietnam', 'dubai', 'uae', 'thailand', 'singapore', 'europe', 'switzerland', 'italy', 'london', 'uk'];
  const isInternational = internationalKeywords.some((k) => destination.toLowerCase().includes(k));

  const { budget, formatted: budgetFormatted, isSpecified: isBudgetSpecified } = parseBudgetFromText(prompt, days_count, isInternational);

  // Companions & Persona
  let companions = 2;
  let companionsSource: 'prompt' | 'url' | 'default' = 'default';
  let persona = 'solo';
  let vibe = 'Leisure & Scenic';

  const countMatch = lower.match(/(?:for\s+)?(\d+)\s*(?:people|persons|travellers|travelers|guests|adults|friends|of us)\b/i);
  const wordCountMatch = lower.match(/\b(?:for\s+)?(two|three|four|five|six)\s+(?:people|persons|travellers|travelers|guests|adults|friends|of us)\b/i);
  const wordMap: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6 };

  if (countMatch && countMatch[1]) {
    companions = parseInt(countMatch[1], 10);
    companionsSource = 'prompt';
  } else if (wordCountMatch && wordCountMatch[1]) {
    companions = wordMap[wordCountMatch[1].toLowerCase()] || 2;
    companionsSource = 'prompt';
  } else if (lower.includes('solo') || lower.includes('alone') || lower.includes('myself')) {
    companions = 1;
    persona = 'solo';
    vibe = 'Solo Backpacking & Discovery';
    companionsSource = 'prompt';
  } else if (lower.includes('partner') || lower.includes('couple') || lower.includes('romantic') || lower.includes('wife') || lower.includes('husband') || lower.includes('girlfriend') || lower.includes('boyfriend')) {
    companions = 2;
    persona = 'couple';
    vibe = 'Romantic Escapes & Fine Dining';
    companionsSource = 'prompt';
  } else if (lower.includes('family') || lower.includes('kids') || lower.includes('children') || lower.includes('parents')) {
    companions = 4;
    persona = 'family';
    vibe = 'Family Comfort & Nature';
    companionsSource = 'prompt';
  } else if (lower.includes('squad') || lower.includes('friends') || lower.includes('gang') || lower.includes('buddies')) {
    companions = 4;
    persona = 'squad';
    vibe = 'Squad Adventures & Nightlife';
    companionsSource = 'prompt';
  } else if (lower.includes('nomad') || lower.includes('workation') || lower.includes('wifi') || lower.includes('coworking')) {
    companions = 1;
    persona = 'nomad';
    vibe = 'Digital Nomad & Cafe Hop';
    companionsSource = 'prompt';
  }

  if (lower.includes('luxury') || lower.includes('5-star') || lower.includes('resort') || lower.includes('villa')) {
    vibe = 'Bespoke Luxury & Private Villas';
  } else if (lower.includes('adventure') || lower.includes('trek') || lower.includes('scuba') || lower.includes('rafting')) {
    vibe = 'High Adrenaline & Expeditions';
  } else if (lower.includes('beach') || lower.includes('coastal') || lower.includes('ocean')) {
    vibe = 'Coastal Sunshine & Beach Clubs';
  }

  const interests = parseInterestsFromText(prompt);

  return {
    isItinerary: true,
    destination: destination || 'Your Dream Destination',
    origin: source,
    source,
    start_date,
    end_date,
    days_count,
    budget,
    budgetFormatted,
    isBudgetSpecified,
    currency: 'INR',
    travellers: companions,
    companions,
    companionsSource,
    persona,
    vibe,
    interests,
    raw_prompt: prompt,
    rawPrompt: prompt,
  };
}

/**
 * Checks if a user message has itinerary intent and extracts source / destination via regex
 */
export function checkMessageForItinerary(message: string): { isItinerary: boolean; source?: string; destination?: string } {
  const parsed = parseTravelPrompt(message);
  return {
    isItinerary: parsed.isItinerary,
    source: parsed.source,
    destination: parsed.destination,
  };
}

/**
 * Cleans raw markdown JSON code blocks from LLM responses
 */
export function cleanJsonString(jsonString: string): string {
  try {
    const jsonEndIndex = jsonString.lastIndexOf('}');
    if (jsonEndIndex > -1) {
      jsonString = jsonString.substring(0, jsonEndIndex + 1);
    }

    jsonString = jsonString.replace(/```json\n|\n```/g, '');
    jsonString = jsonString.replace(/\/\*[\s\S]*?\*\//g, '');
    jsonString = jsonString.replace(/\/\/.*/g, '');
    jsonString = jsonString.replace(/\n\n[\s\S]*$/, '');
    jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');

    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonString = jsonString.slice(firstBrace, lastBrace + 1);
    }

    return jsonString;
  } catch (error) {
    console.error('Error cleaning JSON string:', error);
    return jsonString;
  }
}

/**
 * Infers place type based on activity description keywords (TA: Tourist Attraction, R: Restaurant, H: Hotel)
 */
export function inferPlaceType(activity: string): 'TA' | 'R' | 'H' {
  const lower = activity.toLowerCase();
  if (
    lower.includes('restaurant') ||
    lower.includes('lunch') ||
    lower.includes('dinner') ||
    lower.includes('food') ||
    lower.includes('curry') ||
    lower.includes('cafe') ||
    lower.includes('tasting') ||
    lower.includes('dining')
  ) {
    return 'R';
  }

  if (
    lower.includes('hotel') ||
    lower.includes('check-in') ||
    lower.includes('accommodation') ||
    lower.includes('stay') ||
    lower.includes('resort') ||
    lower.includes('villa') ||
    lower.includes('cottage')
  ) {
    return 'H';
  }

  return 'TA';
}
