'use client';

import React from 'react';
import {
  CalendarDays,
  Compass,
  Ticket,
  DollarSign,
  Users,
  Sparkles,
  History,
  Globe,
  Lock,
  Shield,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export type TripTab = 'plan' | 'map' | 'bookings' | 'budget' | 'people' | 'history';

interface TripHeaderProps {
  currentTrip: any;
  trips: any[];
  activeTripIndex: number;
  setActiveTripIndex: (idx: number) => void;
  activeTab: TripTab;
  setActiveTab: (tab: TripTab) => void;
  bookingsCount: number;
  onOpenSquadModal: () => void;
  onNewTrip: () => void;
  onUpdateVisibility?: (visibility: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE') => Promise<void> | void;
}

export const TripHeader: React.FC<TripHeaderProps> = ({
  currentTrip,
  trips,
  activeTripIndex,
  setActiveTripIndex,
  activeTab,
  setActiveTab,
  bookingsCount,
  onOpenSquadModal,
  onNewTrip,
  onUpdateVisibility,
}) => {
  const [isVisibilityMenuOpen, setIsVisibilityMenuOpen] = React.useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = React.useState(false);

  const currentVisibility: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE' =
    currentTrip?.visibility || (currentTrip?.is_public ? 'PUBLIC' : 'PRIVATE');

  const handleSelectVisibility = async (vis: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE') => {
    setIsVisibilityMenuOpen(false);
    if (!onUpdateVisibility || vis === currentVisibility) return;
    setIsUpdatingVisibility(true);
    try {
      await onUpdateVisibility(vis);
    } finally {
      setIsUpdatingVisibility(false);
    }
  };
  return (
    <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-serif-editorial font-bold text-slate-900 tracking-tight">
            {currentTrip.destination}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 font-medium flex flex-wrap items-center gap-2">
            <span>{currentTrip.startDate} – {currentTrip.endDate}</span>
            <span>•</span>
            <span>
              {currentTrip.travellers != null
                ? `${currentTrip.travellers} travelers`
                : currentTrip.travelers != null
                ? `${currentTrip.travelers} travelers`
                : 'Travelers: Not specified'}
            </span>
            <span>•</span>
            <span className="font-semibold text-slate-900">
              {currentTrip.budget ? `₹${Number(currentTrip.budget).toLocaleString('en-IN')} est.` : 'Budget not specified'}
            </span>
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {/* Tri-State Visibility Control */}
          <div className="relative">
            <button
              onClick={() => setIsVisibilityMenuOpen(!isVisibilityMenuOpen)}
              disabled={isUpdatingVisibility}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                currentVisibility === 'PUBLIC'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : currentVisibility === 'FRIENDS_ONLY'
                  ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
              title="Trip Visibility & Sharing Control"
            >
              {currentVisibility === 'PUBLIC' && <Globe className="w-3.5 h-3.5 text-emerald-600" />}
              {currentVisibility === 'FRIENDS_ONLY' && <Users className="w-3.5 h-3.5 text-blue-600" />}
              {currentVisibility === 'PRIVATE' && <Lock className="w-3.5 h-3.5 text-slate-500" />}
              <span>
                {currentVisibility === 'PUBLIC'
                  ? 'Public'
                  : currentVisibility === 'FRIENDS_ONLY'
                  ? 'Friends Only'
                  : 'Private'}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
            </button>

            {isVisibilityMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Trip Visibility
                </div>
                <button
                  onClick={() => handleSelectVisibility('PUBLIC')}
                  className={`w-full text-left px-2.5 py-2 rounded-xl flex items-start gap-2 hover:bg-slate-50 transition cursor-pointer ${
                    currentVisibility === 'PUBLIC' ? 'bg-emerald-50/60 font-semibold text-emerald-900' : 'text-slate-700'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5 mt-0.5 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-medium">Public</div>
                    <div className="text-[10px] text-slate-500 font-normal leading-tight">Explore & community can view</div>
                  </div>
                </button>
                <button
                  onClick={() => handleSelectVisibility('FRIENDS_ONLY')}
                  className={`w-full text-left px-2.5 py-2 rounded-xl flex items-start gap-2 hover:bg-slate-50 transition cursor-pointer ${
                    currentVisibility === 'FRIENDS_ONLY' ? 'bg-blue-50/60 font-semibold text-blue-900' : 'text-slate-700'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 mt-0.5 text-blue-600 shrink-0" />
                  <div>
                    <div className="font-medium">Friends Only</div>
                    <div className="text-[10px] text-slate-500 font-normal leading-tight">Only accepted companions</div>
                  </div>
                </button>
                <button
                  onClick={() => handleSelectVisibility('PRIVATE')}
                  className={`w-full text-left px-2.5 py-2 rounded-xl flex items-start gap-2 hover:bg-slate-50 transition cursor-pointer ${
                    currentVisibility === 'PRIVATE' ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-700'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5 mt-0.5 text-slate-500 shrink-0" />
                  <div>
                    <div className="font-medium">Private</div>
                    <div className="text-[10px] text-slate-500 font-normal leading-tight">Strictly you & your squad</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenSquadModal}
            className="bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 mr-1.5 text-orange-600" />
            Squad Room
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onNewTrip}
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs cursor-pointer shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            New Trip
          </Button>
        </div>
      </div>

      {/* Trip Switcher Selector (if multiple trips) */}
      {trips.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-100 no-scrollbar">
          <span className="text-[11px] font-medium text-slate-400 shrink-0">Switch Trip:</span>
          {trips.map((t, idx) => (
            <button
              key={t.id}
              onClick={() => setActiveTripIndex(idx)}
              className={`px-3 py-1 rounded-xl text-xs transition-all shrink-0 cursor-pointer ${
                activeTripIndex === idx
                  ? 'bg-orange-100 text-orange-900 font-semibold border border-orange-200'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {t.destination} ({t.days?.length || 3} Days)
            </button>
          ))}
        </div>
      )}

      {/* Primary Cockpit Navigation Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto no-scrollbar pt-1">
        {[
          { id: 'plan' as TripTab, label: 'Plan', icon: CalendarDays },
          { id: 'map' as TripTab, label: 'Route View', icon: Compass },
          { id: 'bookings' as TripTab, label: `Bookings (${bookingsCount})`, icon: Ticket },
          { id: 'budget' as TripTab, label: 'Budget', icon: DollarSign },
          { id: 'people' as TripTab, label: 'People', icon: Users },
          { id: 'history' as TripTab, label: 'History', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 px-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                isActive
                  ? 'bg-white text-orange-600 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
