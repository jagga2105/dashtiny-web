import { create } from 'zustand';
import {
  Trip,
  TripDay,
  TripActivity,
  TripRevision,
  TripProposal,
  RewardBalance,
} from '@/types/trip';

export type {
  Trip,
  TripDay,
  TripActivity,
  TripRevision,
  TripProposal,
  RewardBalance,
};

// Aliases for backward compatibility during migration
export type ActivityItem = TripActivity;
export type DayItinerary = TripDay;
export type TravelItinerary = Trip;

interface PlannerState {
  activeTrip: Trip | null;
  selectedDay: number | null;
  pendingProposal: TripProposal | null;
  itineraries: Trip[];
  currentItinerary: Trip | null;
  isGenerating: boolean;
  setGenerating: (val: boolean) => void;
  setActiveTrip: (trip: Trip | null) => void;
  setSelectedDay: (day: number | null) => void;
  setPendingProposal: (proposal: TripProposal | null) => void;
  setCurrentItinerary: (itinerary: Trip | null) => void;
  addItinerary: (itinerary: Trip) => void;
}

export const usePlannerStore = create<PlannerState>((set) => ({
  activeTrip: null,
  selectedDay: null,
  pendingProposal: null,
  itineraries: [],
  currentItinerary: null,
  isGenerating: false,
  setGenerating: (val) => set({ isGenerating: val }),
  setActiveTrip: (trip) => set({ activeTrip: trip, currentItinerary: trip }),
  setSelectedDay: (day) => set({ selectedDay: day }),
  setPendingProposal: (proposal) => set({ pendingProposal: proposal }),
  setCurrentItinerary: (itinerary) => set({ currentItinerary: itinerary, activeTrip: itinerary }),
  addItinerary: (itinerary) =>
    set((state) => ({
      itineraries: [itinerary, ...state.itineraries],
      currentItinerary: itinerary,
      activeTrip: itinerary,
    })),
}));
