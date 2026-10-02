'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  Plane,
  Hotel,
  Train,
  Bus,
  Car,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Star,
  MapPin,
  Ticket,
  ShieldCheck,
  ExternalLink,
  Search,
  Briefcase
} from 'lucide-react';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { DAInaChatWidget } from '@/components/layout/DAInaChatWidget';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiService } from '@/services/api';
import { useAuthStore } from '@/store/useAuthStore';

type BookingCategory = 'flights' | 'hotels' | 'trains' | 'buses' | 'cabs' | 'my_bookings';

function BookingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTripId = searchParams.get('tripId');

  const { updateCoins } = useAuthStore();
  const [activeCategory, setActiveCategory] = useState<BookingCategory>('flights');
  const [bookingConfirmed, setBookingConfirmed] = useState<{ title: string; pnr: string; provider: string; tripId?: string } | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userBookings, setUserBookings] = useState<any[]>([]);
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>('');

  // Flight search states
  const [flightOrigin, setFlightOrigin] = useState('BLR');
  const [flightDest, setFlightDest] = useState('GOI');
  const [departureDate, setDepartureDate] = useState('2026-10-15');
  const [returnDate, setReturnDate] = useState('2026-10-20');
  const [passengers, setPassengers] = useState(2);
  const [cabinClass, setCabinClass] = useState('economy');
  const [tripType, setTripType] = useState<'round' | 'oneway'>('round');
  const [flightsList, setFlightsList] = useState<any[]>([]);
  const [isSearchingFlights, setIsSearchingFlights] = useState(false);
  const [flightError, setFlightError] = useState<string | null>(null);

  // Hotel search states
  const [hotelDest, setHotelDest] = useState('Goa');
  const [hotelGuests, setHotelGuests] = useState(2);
  const [hotelCheckIn, setHotelCheckIn] = useState('2026-10-15');
  const [hotelCheckOut, setHotelCheckOut] = useState('2026-10-20');
  const [hotelsList, setHotelsList] = useState<any[]>([]);
  const [isSearchingHotels, setIsSearchingHotels] = useState(false);
  const [hotelError, setHotelError] = useState<string | null>(null);

  // Load initial trips and user reservations
  useEffect(() => {
    async function initData() {
      try {
        const [tripsData, bookingsData] = await Promise.all([
          apiService.getMyTrips(),
          apiService.getMyBookings(),
        ]);

        if (tripsData && tripsData.length > 0) {
          setActiveTrips(tripsData);
          if (paramTripId && tripsData.some((t: any) => t.id === paramTripId)) {
            setSelectedTripId(paramTripId);
          } else {
            setSelectedTripId(tripsData[0].id);
          }
        }
        if (bookingsData && bookingsData.length > 0) {
          setUserBookings(bookingsData);
        }
      } catch (err) {
        console.error('Failed to load initial booking context:', err);
      }
    }
    initData();
  }, [bookingConfirmed, paramTripId]);

  // Sync selected active trip details into search inputs
  useEffect(() => {
    if (selectedTripId && activeTrips.length > 0) {
      const match = activeTrips.find((t) => t.id === selectedTripId);
      if (match) {
        const dest = (match.destination || '').toLowerCase();
        if (dest.includes('goa')) {
          setFlightDest('GOI');
          setHotelDest('Goa');
        } else if (dest.includes('manali') || dest.includes('kullu')) {
          setFlightDest('KUU');
          setHotelDest('Manali');
        } else if (dest.includes('jaipur')) {
          setFlightDest('JAI');
          setHotelDest('Jaipur');
        }
        if (match.startDate) {
          setDepartureDate(match.startDate);
          setHotelCheckIn(match.startDate);
        }
        if (match.endDate) {
          setReturnDate(match.endDate);
          setHotelCheckOut(match.endDate);
        }
        if (match.travellers && Number(match.travellers) > 0) {
          setPassengers(Number(match.travellers));
          setHotelGuests(Number(match.travellers));
        }
      }
    }
  }, [selectedTripId, activeTrips]);

  // Load Flights from Backend Aggregator
  const loadFlights = async (orig = flightOrigin, dest = flightDest) => {
    setIsSearchingFlights(true);
    setFlightError(null);
    try {
      const results = await apiService.searchFlights(orig, dest);
      setFlightsList(results || []);
    } catch (err) {
      console.error('Failed to search flights:', err);
      setFlightError('Unable to connect to DashTiny flight search. Please try again.');
      setFlightsList([]);
    } finally {
      setIsSearchingFlights(false);
    }
  };

  // Load Hotels from Backend Aggregator
  const loadHotels = async (dest = hotelDest, guests = hotelGuests) => {
    setIsSearchingHotels(true);
    setHotelError(null);
    try {
      const results = await apiService.searchHotels(dest, guests);
      setHotelsList(results || []);
    } catch (err) {
      console.error('Failed to search hotels:', err);
      setHotelError('Unable to connect to DashTiny stay search. Please try again.');
      setHotelsList([]);
    } finally {
      setIsSearchingHotels(false);
    }
  };

  useEffect(() => {
    loadFlights();
    loadHotels();
  }, []);

  const categories = [
    { id: 'flights' as BookingCategory, label: 'Flights', icon: Plane },
    { id: 'hotels' as BookingCategory, label: 'Stays & Hotels', icon: Hotel },
    { id: 'trains' as BookingCategory, label: 'Trains', icon: Train },
    { id: 'buses' as BookingCategory, label: 'Buses', icon: Bus },
    { id: 'cabs' as BookingCategory, label: 'Cabs', icon: Car },
    { id: 'my_bookings' as BookingCategory, label: `Saved Bookings (${userBookings.length})`, icon: Ticket },
  ];

  const handleSaveBookingReference = async (
    category: 'flight' | 'hotel',
    provider: string,
    title: string,
    amount: number,
    details?: any
  ) => {
    setLoading(true);
    setBookingError(null);
    setBookingConfirmed(null);

    try {
      const res = await apiService.saveBookingReference({
        category,
        provider,
        title,
        amount,
        trip_id: selectedTripId || undefined,
        details,
      });

      if (res && res.pnr_ref) {
        setBookingConfirmed({
          title: res.title,
          pnr: res.pnr_ref,
          provider: res.provider || provider,
          tripId: selectedTripId,
        });
        updateCoins(50);
      } else {
        setBookingError("Booking reference could not be saved.");
      }
    } catch (e: any) {
      console.error('Save booking reference failed:', e);
      setBookingError(e?.detail || e?.message || "Booking reference could not be saved. Please check if your trip is selected.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 md:pb-12 flex flex-col bg-[#FAFAF9] text-slate-900 font-sans selection:bg-orange-500 selection:text-white">
      <TopNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 py-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/90 pb-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-serif-editorial font-bold text-slate-900 tracking-tight">
              Compare Flights & Stays
            </h1>
            <p className="text-slate-600 text-xs sm:text-sm font-medium max-w-2xl">
              Compare prices across Skyscanner, Booking.com, IndiGo, and Airbnb. Once booked, attach your confirmed reference to your trip workspace.
            </p>
          </div>

          {/* Trip Attachment Dropdown Selector */}
          {activeTrips.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5 shrink-0 min-w-[280px]">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Briefcase className="w-3.5 h-3.5 text-orange-500" />
                <span>Attach to Active Trip:</span>
              </div>
              <select
                value={selectedTripId}
                onChange={(e) => setSelectedTripId(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {activeTrips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.destination} ({t.startDate})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 4-Step Booking Mental Model Banner */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 font-bold flex items-center justify-center text-[11px]">1</span>
            <span className="font-semibold text-slate-800">Compare options</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline" />
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[11px]">2</span>
            <span>Book directly on provider</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline" />
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[11px]">3</span>
            <span>Save confirmation reference</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline" />
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[11px]">4</span>
            <span className="font-semibold text-emerald-900">Manage in Trip Workspace</span>
          </div>
        </div>

        {/* Confirmation Banner */}
        {bookingConfirmed && (
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-sm font-semibold text-emerald-950 block">
                  ✓ Booking added to your trip
                </span>
                <p className="text-emerald-800 font-medium text-xs">
                  Booked with: <strong>{bookingConfirmed.provider}</strong> • Reference: <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-200">{bookingConfirmed.pnr}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/trips')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs border-0 shadow-2xs cursor-pointer"
              >
                Open in Trip Workspace →
              </Button>
              <button
                onClick={() => setBookingConfirmed(null)}
                className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold px-2 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Booking Failure Alert */}
        {bookingError && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="text-amber-800 font-bold">⚠️</span>
              <div>
                <span className="text-xs font-semibold text-amber-900 block">{bookingError}</span>
                <p className="text-[11px] text-amber-700">No charges were made.</p>
              </div>
            </div>
            <button
              onClick={() => setBookingError(null)}
              className="text-amber-800 hover:text-amber-950 text-xs font-semibold px-2.5 py-1 rounded-lg border border-amber-300 hover:bg-amber-100 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Category Switcher Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-orange-600 text-white shadow-2xs font-bold'
                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* FLIGHTS TAB */}
        {activeCategory === 'flights' && (() => {
          const lowestFareFlight = flightsList.length > 0
            ? flightsList.reduce((min, f) => (f.price < min.price ? f : min), flightsList[0])
            : null;

          return (
            <section className="space-y-4">
              {/* Comprehensive Filter Controls */}
              <Card className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3.5">
                {/* Trip Type & Cabin Pill Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setTripType('round')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        tripType === 'round' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Round Trip
                    </button>
                    <button
                      type="button"
                      onClick={() => setTripType('oneway')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        tripType === 'oneway' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      One Way
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={cabinClass}
                      onChange={(e) => setCabinClass(e.target.value)}
                      className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none"
                    >
                      <option value="economy">Economy</option>
                      <option value="premium">Premium Economy</option>
                      <option value="business">Business</option>
                    </select>

                    <select
                      value={passengers}
                      onChange={(e) => setPassengers(Number(e.target.value))}
                      className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none"
                    >
                      <option value={1}>1 Traveler</option>
                      <option value={2}>2 Travelers</option>
                      <option value={3}>3 Travelers</option>
                      <option value={4}>4+ Squad</option>
                    </select>
                  </div>
                </div>

                {/* Airports & Dates Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase text-slate-400">From (Origin)</label>
                    <select
                      value={flightOrigin}
                      onChange={(e) => {
                        setFlightOrigin(e.target.value);
                        loadFlights(e.target.value, flightDest);
                      }}
                      className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="BLR">BLR — Bengaluru Kempegowda</option>
                      <option value="DEL">DEL — New Delhi Indira Gandhi</option>
                      <option value="BOM">BOM — Mumbai Chhatrapati Shivaji</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase text-slate-400">To (Destination)</label>
                    <select
                      value={flightDest}
                      onChange={(e) => {
                        setFlightDest(e.target.value);
                        loadFlights(flightOrigin, e.target.value);
                      }}
                      className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="GOI">GOI — Goa Dabolim / Mopa</option>
                      <option value="JAI">JAI — Jaipur Sanganer</option>
                      <option value="KUU">KUU — Kullu Manali Bhuntar</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase text-slate-400">Departure</label>
                    <input
                      type="date"
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase text-slate-400">
                      {tripType === 'round' ? 'Return' : 'Trip Length'}
                    </label>
                    {tripType === 'round' ? (
                      <input
                        type="date"
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                      />
                    ) : (
                      <span className="w-full flex items-center px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-100 rounded-xl border border-slate-200">
                        One Way Flight
                      </span>
                    )}
                  </div>
                </div>

                {/* Search Action Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    {isSearchingFlights ? 'Querying airline schedules...' : `${flightsList.length} offers compared for ${passengers} traveler${passengers > 1 ? 's' : ''}`}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadFlights()}
                    disabled={isSearchingFlights}
                    className="border-slate-200 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5 mr-1 text-orange-500" />
                    Refresh Offers
                  </Button>
                </div>
              </Card>

              {/* Flight Offers List with Algorithm-Driven Decision Support */}
              <div className="space-y-3">
                {flightsList.map((fl, idx) => {
                  const isLowestFare = lowestFareFlight && fl.id === lowestFareFlight.id;
                  const isFastest = fl.duration?.includes('1h');

                  return (
                    <Card
                      key={fl.id || idx}
                      className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-5 hover:border-slate-300 transition-all"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-serif-editorial font-bold text-slate-900 text-base">{fl.provider}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold">
                            {fl.flight_number}
                          </span>
                          {isLowestFare && (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wide">
                              Lowest Fare · ₹{fl.price?.toLocaleString('en-IN')}
                            </span>
                          )}
                          {isFastest && !isLowestFare && (
                            <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-bold uppercase tracking-wide">
                              Fastest Transit
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 text-slate-700 text-[10px] font-medium border border-slate-200">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Provider verified
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-sm font-semibold text-slate-800">
                          <span>{fl.origin} ({fl.departure_time})</span>
                          <ArrowRight className="w-3.5 h-3.5 text-orange-500" />
                          <span>{fl.destination} ({fl.arrival_time})</span>
                        </div>

                        <p className="text-xs text-slate-500">
                          Non-stop • {fl.duration} • {fl.baggage || '15kg check-in'} • {fl.cancellation || 'Standard cancellation'}
                        </p>

                        {/* Decision Support Rationale with Factual Criteria */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            ✓ Fits trip date ({departureDate})
                          </span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            ✓ Direct transit matches your pacing
                          </span>
                          {isLowestFare && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-700 font-semibold">
                                ✓ Lowest total cost among verified providers
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                  <div className="flex items-center justify-between md:justify-end gap-5 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="text-right">
                      <span className="text-xl font-serif-editorial font-bold text-slate-900">
                        ₹{fl.price?.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[11px] text-slate-400 block font-normal">per passenger</span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Button
                        variant="primary"
                        size="sm"
                        isLoading={loading}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs shadow-2xs cursor-pointer"
                        onClick={() =>
                          handleSaveBookingReference(
                            'flight',
                            fl.provider,
                            `${fl.provider} (${fl.flight_number}) ${fl.origin} → ${fl.destination}`,
                            fl.price,
                            fl
                          )
                        }
                      >
                        Attach Reference ➔
                      </Button>

                      {fl.deep_link && (
                        <a
                          href={fl.deep_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                        >
                          <span>Book on {fl.provider}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </a>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      );
    })()}

        {/* HOTELS & STAYS TAB */}
        {activeCategory === 'hotels' && (
          <section className="space-y-4">
            {/* Filter Controls */}
            <Card className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase text-slate-400">Destination</label>
                  <select
                    value={hotelDest}
                    onChange={(e) => {
                      setHotelDest(e.target.value);
                      loadHotels(e.target.value, hotelGuests);
                    }}
                    className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="Goa">Goa</option>
                    <option value="Manali">Manali</option>
                    <option value="Jaipur">Jaipur</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase text-slate-400">Check-In</label>
                  <input
                    type="date"
                    value={hotelCheckIn}
                    onChange={(e) => setHotelCheckIn(e.target.value)}
                    className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase text-slate-400">Check-Out</label>
                  <input
                    type="date"
                    value={hotelCheckOut}
                    onChange={(e) => setHotelCheckOut(e.target.value)}
                    className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase text-slate-400">Guests</label>
                  <select
                    value={hotelGuests}
                    onChange={(e) => {
                      setHotelGuests(Number(e.target.value));
                      loadHotels(hotelDest, Number(e.target.value));
                    }}
                    className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value={1}>1 Solo Guest</option>
                    <option value={2}>2 Guests</option>
                    <option value={4}>4+ Group</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  {isSearchingHotels ? 'Querying stays...' : `${hotelsList.length} verified stays available`}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadHotels()}
                  disabled={isSearchingHotels}
                  className="border-slate-200 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5 mr-1 text-orange-500" />
                  Refresh
                </Button>
              </div>
            </Card>

            {/* Hotel Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {hotelsList.map((ht) => (
                <Card
                  key={ht.id}
                  className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="relative h-48 -mx-6 -mt-6">
                      <Image
                        src={
                          ht.name.includes('Manali') || ht.name.includes('Himalayan')
                            ? 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop&q=80'
                            : 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80'
                        }
                        alt={ht.name}
                        fill
                        className="object-cover"
                      />
                      <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-amber-300 text-xs font-semibold flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{ht.star_rating}</span>
                      </span>

                      <span className="absolute bottom-3 left-3 px-2.5 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-medium border border-white/20">
                        {ht.source || 'Boutique Registry'}
                      </span>
                    </div>

                    <div className="pt-4 space-y-2.5">
                      <div>
                        <h4 className="text-lg font-serif-editorial font-bold text-slate-900">{ht.name}</h4>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-orange-500" />
                          <span>{ht.address}</span>
                        </p>
                      </div>

                      <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100">
                        Room: <span className="font-semibold text-slate-900">{ht.room_type}</span>
                      </div>

                      {ht.why_recommended && (
                        <p className="text-xs text-slate-600 bg-orange-50/50 p-2.5 rounded-xl border border-orange-100 leading-relaxed">
                          <span className="font-semibold text-orange-800">Why recommended:</span> {ht.why_recommended}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-100">
                    <div>
                      <span className="text-xl font-serif-editorial font-bold text-slate-900">
                        ₹{ht.price_per_night?.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-slate-400 block">/ night</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {ht.deep_link && (
                        <a
                          href={ht.deep_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                          title="Open provider"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <Button
                        variant="primary"
                        size="sm"
                        isLoading={loading}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs shadow-2xs cursor-pointer"
                        onClick={() =>
                          handleSaveBookingReference(
                            'hotel',
                            ht.source || 'Stay Provider',
                            `${ht.name} (${ht.room_type})`,
                            ht.price_per_night,
                            ht
                          )
                        }
                      >
                        Attach Reference ➔
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* MY SAVED RESERVATIONS TAB */}
        {activeCategory === 'my_bookings' && (
          <section className="space-y-4">
            <h3 className="text-lg font-serif-editorial font-bold text-slate-900">Saved Booking References</h3>
            {userBookings.length === 0 ? (
              <Card className="p-8 text-center space-y-3 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                <Ticket className="w-8 h-8 text-orange-400 mx-auto" />
                <h4 className="text-sm font-semibold text-slate-800">No Saved Bookings Yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Compare flight and hotel offers across partner providers, then attach your confirmed reservation reference codes directly into your trip workspace.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setActiveCategory('flights')}
                  className="bg-orange-600 text-white font-semibold text-xs mt-2"
                >
                  Compare Flights & Stays
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {userBookings.map((b: any) => (
                  <Card
                    key={b.id}
                    className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-semibold uppercase border border-emerald-200">
                          {b.status === 'saved_reference' ? 'CONFIRMED REF' : b.status}
                        </span>
                        <span className="font-mono text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                          REF: {b.pnr_ref}
                        </span>
                      </div>
                      <h4 className="text-base font-semibold text-slate-900">{b.title}</h4>
                      <p className="text-xs text-slate-500 font-medium">
                        Provider: {b.provider} • Category: {b.category?.toUpperCase()}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-xl font-serif-editorial font-bold text-slate-900">
                          ₹{b.amount?.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-slate-400 block">Captured Reference</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push('/trips')}
                        className="border-slate-200 text-xs font-semibold hover:bg-slate-50 shrink-0 cursor-pointer"
                      >
                        View in Trip ➔
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <DAInaChatWidget />
      <BottomNav />
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAF9]" />}>
      <BookingsContent />
    </Suspense>
  );
}
