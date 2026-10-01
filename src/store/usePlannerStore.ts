import { create } from 'zustand';

export interface ActivityItem {
  time: string;
  description: string;
  location: string;
  placeType?: 'TA' | 'R' | 'H';
  estimatedTransit?: string;
  crowdWarning?: string;
}

export interface DayItinerary {
  dayNumber: number;
  title: string;
  morning?: string;
  afternoon?: string;
  evening?: string;
  estimatedCost?: number;
  location?: string;
  coverImage?: string;
  weather?: string;
  activities?: ActivityItem[];
}

export interface TravelItinerary {
  id: string;
  title?: string;
  source?: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  travelStyle?: string;
  interests?: string[];
  days: DayItinerary[];
  weatherForecast?: string;
  recommendedFlight?: string;
}

interface PlannerState {
  itineraries: TravelItinerary[];
  currentItinerary: TravelItinerary | null;
  isGenerating: boolean;
  setGenerating: (val: boolean) => void;
  setCurrentItinerary: (itinerary: TravelItinerary) => void;
  addItinerary: (itinerary: TravelItinerary) => void;
}

const mockDefaultItinerary: TravelItinerary = {
  id: 'itin_blr_01',
  title: '5-Day Coastal & Tech Explorer',
  source: 'Delhi',
  destination: 'Bengaluru',
  startDate: '2026-08-15',
  endDate: '2026-08-19',
  budget: 25000,
  travelStyle: 'Moderate Pace, Solo',
  interests: ['Food', 'Nature', 'Nightlife', 'Tech Hubs'],
  weatherForecast: 'Sunny with pleasant evening breeze (22°C - 28°C)',
  recommendedFlight: 'IndiGo 6E-204 (08:30 AM → 11:15 AM) - ₹4,850',
  days: [
    {
      dayNumber: 1,
      title: 'Arrival & Botanical Gardens',
      morning: 'Arrive at Kempegowda Intl Airport. Check-in at Indiranagar Hotel.',
      afternoon: 'Explore Lalbagh Botanical Garden & Glass House.',
      evening: 'Craft beer tasting at Toit Microbrewery in Indiranagar.',
      estimatedCost: 3500,
      location: 'Indiranagar & Lalbagh',
    },
    {
      dayNumber: 2,
      title: 'Heritage Palace & Culinary Walk',
      morning: 'Visit the majestic Bengaluru Palace & Mayo Hall.',
      afternoon: 'Traditional South Indian thali lunch at Vidyarthi Bhavan, Gandhi Bazaar.',
      evening: 'Sunset walk at Cubbon Park & Visvesvaraya Museum.',
      estimatedCost: 2800,
      location: 'Central Bengaluru',
    },
  ],
};

export const usePlannerStore = create<PlannerState>((set) => ({
  itineraries: [mockDefaultItinerary],
  currentItinerary: mockDefaultItinerary,
  isGenerating: false,
  setGenerating: (val) => set({ isGenerating: val }),
  setCurrentItinerary: (itinerary) => set({ currentItinerary: itinerary }),
  addItinerary: (itinerary) =>
    set((state) => ({
      itineraries: [itinerary, ...state.itineraries],
      currentItinerary: itinerary,
    })),
}));
