import { create } from 'zustand';

export type BookingCategory = 'flights' | 'hotels' | 'trains' | 'buses' | 'movies' | 'cabs' | 'services';

export interface BookingSearchCriteria {
  category: BookingCategory;
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  guests: number;
  travelClass: string;
  movieCity?: string;
}

interface BookingState {
  activeCategory: BookingCategory;
  criteria: BookingSearchCriteria;
  setActiveCategory: (cat: BookingCategory) => void;
  setCriteria: (updated: Partial<BookingSearchCriteria>) => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  activeCategory: 'flights',
  criteria: {
    category: 'flights',
    origin: 'Delhi (DEL)',
    destination: 'Bengaluru (BLR)',
    departDate: '2026-08-15',
    returnDate: '2026-08-20',
    guests: 1,
    travelClass: 'Economy',
    movieCity: 'Bengaluru',
  },

  setActiveCategory: (category) =>
    set((state) => ({
      activeCategory: category,
      criteria: { ...state.criteria, category },
    })),

  setCriteria: (updated) =>
    set((state) => ({
      criteria: { ...state.criteria, ...updated },
    })),
}));
