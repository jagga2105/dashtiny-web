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

export interface ParsedTravelPrompt {
  isItinerary: boolean;
  destination: string;
  source?: string;
  days_count: number;
  budget: number;
  budgetFormatted: string;
  companions: number;
  persona: string;
  vibe: string;
  rawPrompt: string;
}

/**
 * Parses Indian currency terms (lakh, L, k, standard commas) into integer numbers.
 * Examples:
 * - "1.5 lakh" / "1.5L" -> 150000
 * - "2 lakh" -> 200000
 * - "80k" -> 80000
 * - "₹1,50,000" -> 150000
 */
export function parseBudgetFromText(text: string, daysCount: number = 4, isInternational: boolean = false): { budget: number; formatted: string } {
  const lower = text.toLowerCase();

  // Pattern 1: Lakhs (e.g. "1.5 lakh", "2 lakhs", "1.5L", "2lac")
  const lakhMatch = lower.match(/(?:₹|rs\.?|inr|under|budget\s*(?:of)?|around)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:lakh|lakhs|lac|lacs|l\b)/i);
  if (lakhMatch && lakhMatch[1]) {
    const val = parseFloat(lakhMatch[1]) * 100000;
    return { budget: Math.round(val), formatted: `₹${val.toLocaleString('en-IN')}` };
  }

  // Pattern 2: Thousands with 'k' (e.g. "50k", "85k")
  const kMatch = lower.match(/(?:₹|rs\.?|inr|under|budget\s*(?:of)?|around)?\s*([0-9]+)\s*k\b/i);
  if (kMatch && kMatch[1]) {
    const val = parseInt(kMatch[1], 10) * 1000;
    return { budget: val, formatted: `₹${val.toLocaleString('en-IN')}` };
  }

  // Pattern 3: Standard currency numbers (e.g. "₹1,50,000", "75000")
  const numMatch = lower.match(/(?:₹|rs\.?|inr|under|budget\s*(?:of)?|around)\s*([0-9]{1,3}(?:,[0-9]{2,3})+|[0-9]{4,7})/i);
  if (numMatch && numMatch[1]) {
    const cleanNum = parseInt(numMatch[1].replace(/,/g, ''), 10);
    if (!isNaN(cleanNum) && cleanNum >= 5000) {
      return { budget: cleanNum, formatted: `₹${cleanNum.toLocaleString('en-IN')}` };
    }
  }

  // Fallback: Dynamic estimation based on trip length & destination category
  const dailyRate = isInternational ? 20000 : 9000;
  const estimated = dailyRate * Math.max(1, daysCount);
  return { budget: estimated, formatted: `₹${estimated.toLocaleString('en-IN')} (Estimated)` };
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
  const lower = text.toLowerCase();

  // Pattern A: "from <source> to <destination>"
  const fromToMatch = text.match(/(?:from\s+)([a-zA-Z\s]+?)\s+to\s+([a-zA-Z\s]+?)(?=\s+(?:under|with|for|in|on|at|budget|trip|escape|vacation|$))/i);
  if (fromToMatch && fromToMatch[1] && fromToMatch[2]) {
    return {
      source: cleanName(fromToMatch[1]),
      destination: cleanName(fromToMatch[2]),
    };
  }

  // Pattern B: "<duration> <destination> trip/getaway" (e.g. "7-day Japan trip", "4 days Manali holiday")
  const durationDestMatch = text.match(/(?:\d+\s*(?:day|days|-day|week|nights?))\s+([a-zA-Z\s]+?)\s+(?:trip|getaway|itinerary|holiday|vacation|tour|escape)/i);
  if (durationDestMatch && durationDestMatch[1]) {
    const candidate = cleanName(durationDestMatch[1]);
    if (candidate && candidate.length > 2) {
      return { destination: candidate };
    }
  }

  // Pattern C: "(trip|holiday|vacation|getaway|escape|travel)\s+(?:to|in|for)\s+([a-zA-Z\s]+)"
  const intentMatch = text.match(/(?:trip|holiday|vacation|getaway|escape|travel|journey|flight|hotels?|passage)\s+(?:to|in|for)\s+([a-zA-Z\s]+?)(?=\s+(?:from|under|with|for|budget|in\s+\d|on|$))/i);
  if (intentMatch && intentMatch[1]) {
    const candidate = cleanName(intentMatch[1]);
    if (candidate && candidate.length > 2) {
      return { destination: candidate };
    }
  }

  // Pattern D: "to\s+([a-zA-Z\s]+)"
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
    .replace(/\b(a|an|the|under|with|for|my|our|partner|friends|squad|couple|family|budget|trip|luxury|cheap|best)\b/gi, '')
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
 */
export function parseTravelPrompt(prompt: string): ParsedTravelPrompt {
  const lower = prompt.toLowerCase();
  const days_count = parseDaysCountFromText(prompt);
  const { destination, source } = parseDestinationFromText(prompt);

  // Check international vs domestic heuristic
  const internationalKeywords = ['japan', 'tokyo', 'kyoto', 'paris', 'france', 'bali', 'indonesia', 'vietnam', 'dubai', 'uae', 'thailand', 'singapore', 'europe', 'switzerland', 'italy', 'london', 'uk'];
  const isInternational = internationalKeywords.some((k) => destination.toLowerCase().includes(k));

  const { budget, formatted: budgetFormatted } = parseBudgetFromText(prompt, days_count, isInternational);

  // Companions & Persona
  let companions = 2;
  let persona = 'solo';
  let vibe = 'Leisure & Scenic';

  if (lower.includes('solo') || lower.includes('alone') || lower.includes('myself')) {
    companions = 1;
    persona = 'solo';
    vibe = 'Solo Backpacking & Discovery';
  } else if (lower.includes('partner') || lower.includes('couple') || lower.includes('romantic') || lower.includes('wife') || lower.includes('husband') || lower.includes('girlfriend') || lower.includes('boyfriend')) {
    companions = 2;
    persona = 'couple';
    vibe = 'Romantic Escapes & Fine Dining';
  } else if (lower.includes('family') || lower.includes('kids') || lower.includes('children') || lower.includes('parents')) {
    companions = 4;
    persona = 'family';
    vibe = 'Family Comfort & Nature';
  } else if (lower.includes('squad') || lower.includes('friends') || lower.includes('gang') || lower.includes('buddies')) {
    companions = 4;
    persona = 'squad';
    vibe = 'Squad Adventures & Nightlife';
  } else if (lower.includes('nomad') || lower.includes('workation') || lower.includes('wifi') || lower.includes('coworking')) {
    companions = 1;
    persona = 'nomad';
    vibe = 'Digital Nomad & Cafe Hop';
  }

  if (lower.includes('luxury') || lower.includes('5-star') || lower.includes('resort') || lower.includes('villa')) {
    vibe = 'Bespoke Luxury & Private Villas';
  } else if (lower.includes('adventure') || lower.includes('trek') || lower.includes('scuba') || lower.includes('rafting')) {
    vibe = 'High Adrenaline & Expeditions';
  } else if (lower.includes('beach') || lower.includes('coastal') || lower.includes('ocean')) {
    vibe = 'Coastal Sunshine & Beach Clubs';
  }

  return {
    isItinerary: true,
    destination: destination || 'Your Dream Destination',
    source,
    days_count,
    budget,
    budgetFormatted,
    companions,
    persona,
    vibe,
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
