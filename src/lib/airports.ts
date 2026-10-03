/**
 * Centralized Airport & Destination Registry
 * Maps traveler destinations and cities to standard IATA airport codes.
 */

export interface AirportMapping {
  code: string;
  city: string;
  country: string;
  name: string;
}

export const AIRPORT_REGISTRY: Record<string, AirportMapping> = {
  // India — Major Hubs & Getaways
  goa: { code: 'GOI', city: 'Goa', country: 'India', name: 'Dabolim / Manohar Intl' },
  manali: { code: 'KUU', city: 'Kullu Manali', country: 'India', name: 'Bhuntar Airport' },
  kullu: { code: 'KUU', city: 'Kullu Manali', country: 'India', name: 'Bhuntar Airport' },
  jaipur: { code: 'JAI', city: 'Jaipur', country: 'India', name: 'Jaipur Intl' },
  delhi: { code: 'DEL', city: 'Delhi', country: 'India', name: 'Indira Gandhi Intl' },
  mumbai: { code: 'BOM', city: 'Mumbai', country: 'India', name: 'Chhatrapati Shivaji Intl' },
  bangalore: { code: 'BLR', city: 'Bengaluru', country: 'India', name: 'Kempegowda Intl' },
  bengaluru: { code: 'BLR', city: 'Bengaluru', country: 'India', name: 'Kempegowda Intl' },
  kolkata: { code: 'CCU', city: 'Kolkata', country: 'India', name: 'Netaji Subhash Chandra Bose Intl' },
  chennai: { code: 'MAA', city: 'Chennai', country: 'India', name: 'Chennai Intl' },
  hyderabad: { code: 'HYD', city: 'Hyderabad', country: 'India', name: 'Rajiv Gandhi Intl' },
  srinagar: { code: 'SXR', city: 'Srinagar', country: 'India', name: 'Sheikh ul-Alam Intl' },
  kashmir: { code: 'SXR', city: 'Srinagar', country: 'India', name: 'Sheikh ul-Alam Intl' },
  leh: { code: 'IXL', city: 'Leh', country: 'India', name: 'Kushok Bakula Rimpochee' },
  ladakh: { code: 'IXL', city: 'Leh', country: 'India', name: 'Kushok Bakula Rimpochee' },
  udaipur: { code: 'UDR', city: 'Udaipur', country: 'India', name: 'Maharana Pratap' },
  kochi: { code: 'COK', city: 'Kochi', country: 'India', name: 'Cochin Intl' },
  kerala: { code: 'COK', city: 'Kochi', country: 'India', name: 'Cochin Intl' },
  munnar: { code: 'COK', city: 'Kochi / Munnar', country: 'India', name: 'Cochin Intl' },
  varanasi: { code: 'VNS', city: 'Varanasi', country: 'India', name: 'Lal Bahadur Shastri Intl' },
  gokarna: { code: 'GOI', city: 'Gokarna / Goa', country: 'India', name: 'Dabolim Airport' },
  rishikesh: { code: 'DED', city: 'Dehradun / Rishikesh', country: 'India', name: 'Jolly Grant Airport' },
  dehradun: { code: 'DED', city: 'Dehradun', country: 'India', name: 'Jolly Grant Airport' },
  andaman: { code: 'IXZ', city: 'Port Blair / Andaman', country: 'India', name: 'Veer Savarkar Intl' },
  havelock: { code: 'IXZ', city: 'Port Blair / Havelock', country: 'India', name: 'Veer Savarkar Intl' },
  coorg: { code: 'MYQ', city: 'Mysuru / Coorg', country: 'India', name: 'Mysore Airport' },

  // International Sanctuaries
  kyoto: { code: 'KIX', city: 'Kyoto / Osaka', country: 'Japan', name: 'Kansai Intl / Itami' },
  osaka: { code: 'KIX', city: 'Osaka', country: 'Japan', name: 'Kansai Intl' },
  tokyo: { code: 'HND', city: 'Tokyo', country: 'Japan', name: 'Haneda / Narita' },
  japan: { code: 'HND', city: 'Tokyo', country: 'Japan', name: 'Tokyo Haneda' },
  bali: { code: 'DPS', city: 'Bali', country: 'Indonesia', name: 'Ngurah Rai Intl' },
  ubud: { code: 'DPS', city: 'Ubud / Bali', country: 'Indonesia', name: 'Ngurah Rai Intl' },
  paris: { code: 'CDG', city: 'Paris', country: 'France', name: 'Charles de Gaulle' },
  london: { code: 'LHR', city: 'London', country: 'UK', name: 'Heathrow' },
  dubai: { code: 'DXB', city: 'Dubai', country: 'UAE', name: 'Dubai Intl' },
  singapore: { code: 'SIN', city: 'Singapore', country: 'Singapore', name: 'Changi Intl' },
  bangkok: { code: 'BKK', city: 'Bangkok', country: 'Thailand', name: 'Suvarnabhumi' },
  rome: { code: 'FCO', city: 'Rome', country: 'Italy', name: 'Leonardo da Vinci–Fiumicino' },
  barcelona: { code: 'BCN', city: 'Barcelona', country: 'Spain', name: 'El Prat' },
  amsterdam: { code: 'AMS', city: 'Amsterdam', country: 'Netherlands', name: 'Schiphol' },
  zurich: { code: 'ZRH', city: 'Zurich', country: 'Switzerland', name: 'Zurich Airport' },
  zermatt: { code: 'ZRH', city: 'Zurich / Zermatt', country: 'Switzerland', name: 'Zurich Intl' },
  santorini: { code: 'JTR', city: 'Santorini', country: 'Greece', name: 'Thira Intl' },
};

/**
 * Resolves destination or free text to standard 3-letter IATA code.
 * Temporary client-side compatibility helper (authoritative search is via /locations/search).
 * Unknown destinations remain unresolved (empty string) instead of silently mapping to Goa.
 */
export function getAirportCodeForDestination(destination: string, fallbackCode: string = ''): string {
  if (!destination) return fallbackCode;
  
  const cleaned = destination.trim().toLowerCase();
  
  // If user already typed a 3-letter uppercase IATA code
  if (/^[A-Za-z]{3}$/.test(cleaned)) {
    return cleaned.toUpperCase();
  }

  // Exact match
  if (AIRPORT_REGISTRY[cleaned]) {
    return AIRPORT_REGISTRY[cleaned].code;
  }

  // Substring match
  for (const [key, mapping] of Object.entries(AIRPORT_REGISTRY)) {
    if (cleaned.includes(key)) {
      return mapping.code;
    }
  }

  return fallbackCode;
}

/**
 * Resolves a friendly city name from destination string
 */
export function getCityNameForDestination(destination: string, fallbackCity: string = ''): string {
  if (!destination) return fallbackCity;
  const cleaned = destination.trim().toLowerCase();

  for (const [key, mapping] of Object.entries(AIRPORT_REGISTRY)) {
    if (cleaned.includes(key)) {
      return mapping.city.split('/')[0].trim();
    }
  }

  // If destination is comma-separated (e.g., "Palolem, Goa")
  const parts = destination.split(',').map((p) => p.trim());
  if (parts.length > 0 && parts[0]) {
    return parts[0];
  }

  return destination || fallbackCity;
}
