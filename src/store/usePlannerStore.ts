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

export const usePlannerStore = create<PlannerState>((set) => ({
  itineraries: [],
  currentItinerary: null,
  isGenerating: false,
  setGenerating: (val) => set({ isGenerating: val }),
  setCurrentItinerary: (itinerary) => set({ currentItinerary: itinerary }),
  addItinerary: (itinerary) =>
    set((state) => ({
      itineraries: [itinerary, ...state.itineraries],
      currentItinerary: itinerary,
    })),
}));
