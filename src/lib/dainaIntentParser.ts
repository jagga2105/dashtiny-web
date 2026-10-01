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

/**
 * Checks if a user message has itinerary intent and extracts source / destination via regex
 */
export function checkMessageForItinerary(message: string): { isItinerary: boolean; source?: string; destination?: string } {
  const itineraryKeywords = [
    'itinerary', 'itinery', 'itiniry', 'iternary', 'itinary', 'itnery',
    'itenary', 'trip', 'plan', 'travel', 'journey', 'holiday', 'vacation'
  ];

  const lowerMessage = message.toLowerCase();
  const isItinerary = itineraryKeywords.some((word) => lowerMessage.includes(word));

  if (!isItinerary) return { isItinerary: false };

  // Patterns to extract source and destination
  const patterns = [
    /(?:from\s+)?([a-zA-Z\s]+)\s+to\s+([a-zA-Z\s]+)/i,
    /(?:plan|create|make)(?:\s+a)?\s+(?:trip|itinerary)\s+(?:from\s+)?([a-zA-Z\s]+)\s+to\s+([a-zA-Z\s]+)/i,
    /(?:travel|journey)\s+(?:from\s+)?([a-zA-Z\s]+)\s+to\s+([a-zA-Z\s]+)/i
  ];

  for (const pattern of patterns) {
    const match = lowerMessage.match(pattern);
    if (match && match[1] && match[2]) {
      return {
        isItinerary: true,
        source: match[1].trim(),
        destination: match[2].trim(),
      };
    }
  }

  // If destination mentioned without explicit 'from'
  const destMatch = lowerMessage.match(/(?:to|in|for)\s+([a-zA-Z\s]+)/i);
  if (destMatch && destMatch[1]) {
    return {
      isItinerary: true,
      destination: destMatch[1].trim(),
    };
  }

  return { isItinerary: true };
}

/**
 * Cleans raw markdown JSON code blocks from LLM responses (replicated from Angular GenerativeAiService)
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
    lower.includes('cafe')
  ) {
    return 'R';
  }

  if (
    lower.includes('hotel') ||
    lower.includes('check-in') ||
    lower.includes('accommodation') ||
    lower.includes('stay') ||
    lower.includes('resort')
  ) {
    return 'H';
  }

  return 'TA';
}
