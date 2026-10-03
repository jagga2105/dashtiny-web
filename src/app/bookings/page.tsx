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
  Briefcase,
  AlertTriangle,
} from 'lucide-react';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { DAInaChatWidget } from '@/components/layout/DAInaChatWidget';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiService } from '@/services/api';
import { useAuthStore } from '@/store/useAuthStore';
import { AirportAutocomplete } from '@/components/location/AirportAutocomplete';
import { FlightSearchForm } from '@/components/flight/FlightSearchForm';
import { FlightResults } from '@/components/flight/FlightResults';
import { FlightTripContext } from '@/components/flight/FlightTripContext';
import { FlightOffer, FlightSearchParams, FlightSearchResponse } from '@/types/flight';

type BookingCategory = 'flights' | 'hotels' | 'trains' | 'buses' | 'cabs' | 'my_bookings';

function BookingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTripId = searchParams.get('tripId');

  const { setCoins } = useAuthStore();
  const [activeCategory, setActiveCategory] = useState<BookingCategory>('flights');
  const [bookingConfirmed, setBookingConfirmed] = useState<{ title: string; pnr: string; provider: string; tripId?: string } | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userBookings, setUserBookings] = useState<any[]>([]);
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>('');

  // Flight search states (Clean defaults — populated via selected Trip)
  const [flightOrigin, setFlightOrigin] = useState('');
  const [flightDest, setFlightDest] = useState('');
  const [suggestedAirport, setSuggestedAirport] = useState<{ iata_code: string; name: string; city: string } | null>(null);
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [cabinClass, setCabinClass] = useState('economy');
  const [tripType, setTripType] = useState<'round' | 'oneway'>('round');
  const [rawFlights, setRawFlights] = useState<FlightOffer[]>([]);
  const [flightResponse, setFlightResponse] = useState<FlightSearchResponse | null>(null);
  const [lastSearchedParams, setLastSearchedParams] = useState<FlightSearchParams | null>(null);
  const [currentLiveFlightParams, setCurrentLiveFlightParams] = useState<FlightSearchParams | null>(null);
  const [isSearchingFlights, setIsSearchingFlights] = useState(false);
  const [flightError, setFlightError] = useState<string | null>(null);
  const [activeProposal, setActiveProposal] = useState<any | null>(null);
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);
  const [proposalSuccess, setProposalSuccess] = useState<string | null>(null);

  // Stale search tracking
  const [lastSearchedHotelKey, setLastSearchedHotelKey] = useState<string>('');

  // Hotel search states (Clean defaults — populated via selected Trip)
  const [hotelDest, setHotelDest] = useState('');
  const [hotelGuests, setHotelGuests] = useState(1);
  const [hotelCheckIn, setHotelCheckIn] = useState('');
  const [hotelCheckOut, setHotelCheckOut] = useState('');
  const [hotelsList, setHotelsList] = useState<any[]>([]);
  const [isSearchingHotels, setIsSearchingHotels] = useState(false);
  const [hotelError, setHotelError] = useState<string | null>(null);

  const getHotelNights = (inDate?: string, outDate?: string): number => {
    if (!inDate || !outDate) return 1;
    const start = new Date(inDate).getTime();
    const end = new Date(outDate).getTime();
    if (isNaN(start) || isNaN(end) || end <= start) return 1;
    return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
  };

  const currentHotelKey = `${hotelDest}-${hotelGuests}-${hotelCheckIn}-${hotelCheckOut}`;
  const isFlightSearchStale = Boolean(
    lastSearchedParams &&
    currentLiveFlightParams &&
    rawFlights.length > 0 &&
    (
      lastSearchedParams.origin !== currentLiveFlightParams.origin ||
      lastSearchedParams.destination !== currentLiveFlightParams.destination ||
      lastSearchedParams.departureDate !== currentLiveFlightParams.departureDate ||
      (lastSearchedParams.returnDate || '') !== (currentLiveFlightParams.returnDate || '') ||
      lastSearchedParams.passengers !== currentLiveFlightParams.passengers ||
      lastSearchedParams.cabinClass !== currentLiveFlightParams.cabinClass ||
      lastSearchedParams.tripType !== currentLiveFlightParams.tripType
    )
  );
  const isHotelSearchStale = lastSearchedHotelKey !== '' && lastSearchedHotelKey !== currentHotelKey && hotelsList.length > 0;

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
        const dest = (match.destination || '').trim();
        setHotelDest(dest);

        // Canonical location resolution:
        // If explicit 3-letter IATA code, use directly.
        // If ambiguous city (e.g. Goa, Kyoto, Mumbai), query suggest airport without silent overwrite.
        if (dest) {
          if (/^[A-Za-z]{3}$/.test(dest)) {
            setFlightDest(dest.toUpperCase());
            setSuggestedAirport(null);
          } else {
            apiService.searchLocations(dest, 1).then((airports) => {
              if (airports && airports.length > 0) {
                setSuggestedAirport({
                  iata_code: airports[0].iata_code,
                  name: airports[0].name,
                  city: airports[0].city,
                });
              } else {
                setSuggestedAirport(null);
              }
            }).catch(() => setSuggestedAirport(null));
            setFlightDest('');
          }
        } else {
          setFlightDest('');
          setSuggestedAirport(null);
        }

        if (match.origin) {
          const orig = match.origin.trim();
          if (/^[A-Za-z]{3}$/.test(orig)) {
            setFlightOrigin(orig.toUpperCase());
          } else {
            apiService.searchLocations(orig, 1).then((airports) => {
              if (airports && airports.length > 0) {
                setFlightOrigin(airports[0].iata_code);
              } else {
                setFlightOrigin('');
              }
            }).catch(() => setFlightOrigin(''));
          }
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

  // Canonical Flight Search handler adhering to L2 validated contract
  const handleSearchFlights = async (params: FlightSearchParams) => {
    setFlightError(null);
    setIsSearchingFlights(true);
    setLastSearchedParams(params);
    setFlightOrigin(params.origin);
    setFlightDest(params.destination);
    setDepartureDate(params.departureDate);
    setReturnDate(params.returnDate || '');
    setPassengers(params.passengers);
    setCabinClass(params.cabinClass);
    setTripType(params.tripType === 'roundtrip' ? 'round' : 'oneway');

    try {
      const response = await apiService.searchFlights({
        origin: params.origin,
        destination: params.destination,
        departureDate: params.departureDate,
        returnDate: params.tripType === 'roundtrip' ? params.returnDate : undefined,
        passengers: params.passengers,
        cabinClass: params.cabinClass,
        tripType: params.tripType,
      });
      setFlightResponse(response);
      setRawFlights(response?.offers || []);
    } catch (err: any) {
      console.error('Failed to search flights:', err);
      setFlightError('We couldn’t load flight options. Please try again.');
      setFlightResponse(null);
      setRawFlights([]);
    } finally {
      setIsSearchingFlights(false);
    }
  };

  const handleSelectFlightOffer = async (offer: FlightOffer) => {
    if (!selectedTripId) {
      setBookingError('Please link an active trip from the context selector to attach this flight offer.');
      return;
    }
    setIsSubmittingProposal(true);
    setBookingError(null);
    try {
      const proposal = await apiService.createFlightOfferProposal(selectedTripId, offer);
      setActiveProposal(proposal);
    } catch (err: any) {
      console.error('Failed to create proposal:', err);
      setBookingError(err?.message || 'Failed to create flight proposal.');
    } finally {
      setIsSubmittingProposal(false);
    }
  };

  const handleAcceptProposal = async () => {
    if (!activeProposal) return;
    setIsSubmittingProposal(true);
    try {
      const res = await apiService.acceptAIProposal(activeProposal.id);
      setActiveProposal(null);
      setBookingConfirmed({
        title: `${activeProposal.changes?.flight_offer?.airline || 'Flight'} (${activeProposal.changes?.flight_offer?.flight_number || 'Transport'})`,
        pnr: `PROP-${activeProposal.id.slice(0, 8).toUpperCase()}`,
        provider: activeProposal.changes?.flight_offer?.provider || 'Curated Catalog',
        tripId: selectedTripId,
      });
      setProposalSuccess(`Flight successfully attached to Trip revision (v${res.version})!`);
    } catch (err: any) {
      console.error('Failed to accept proposal:', err);
      setBookingError(err?.message || 'Failed to commit trip proposal revision.');
    } finally {
      setIsSubmittingProposal(false);
    }
  };

  // Backwards-compatible loadFlights wrapper
  const loadFlights = async (
    orig = flightOrigin,
    dest = flightDest,
    dep = departureDate,
    ret = returnDate,
    pax = passengers,
    cabin = cabinClass,
    type = tripType
  ) => {
    if (!orig || !dest || !dep) {
      setFlightError('Please specify origin, destination, and departure date.');
      return;
    }
    await handleSearchFlights({
      origin: orig,
      destination: dest,
      departureDate: dep,
      returnDate: type === 'round' ? ret : undefined,
      passengers: pax,
      cabinClass: cabin,
      tripType: type === 'round' ? 'roundtrip' : 'oneway',
    });
  };

  // Load Hotels from Backend Aggregator with all parameters
  const loadHotels = async (
    dest = hotelDest,
    guests = hotelGuests,
    inDate = hotelCheckIn,
    outDate = hotelCheckOut
  ) => {
    setHotelError(null);
    if (!dest) {
      setHotelError('Please choose an active trip above or enter a destination city (e.g. Goa, Kyoto, Manali).');
      return;
    }
    setIsSearchingHotels(true);
    try {
      const results = await apiService.searchHotels({
        destination: dest,
        guests,
        checkIn: inDate,
        checkOut: outDate,
      });
      setHotelsList(results || []);
      setLastSearchedHotelKey(`${dest}-${guests}-${inDate}-${outDate}`);
    } catch (err) {
      console.error('Failed to search hotels:', err);
      setHotelError('Unable to connect to DashTiny stay search. Please try again.');
      setHotelsList([]);
    } finally {
      setIsSearchingHotels(false);
    }
  };

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
        if (typeof res.total_coins === 'number') {
          setCoins(res.total_coins);
        }
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
              Compare travel options in DashTiny&apos;s current catalog. Once booked, attach your confirmed reference to your trip workspace.
            </p>
          </div>

          {/* Trip Attachment Dropdown Selector */}
          {activeTrips.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5 shrink-0 min-w-[280px]">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Briefcase className="w-3.5 h-3.5 text-orange-500" />
                <span>Attach to trip:</span>
              </div>
              <select
                value={selectedTripId}
                onChange={(e) => setSelectedTripId(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {activeTrips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.destination} · {t.startDate || 'Upcoming'}
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
                onClick={() => router.push(bookingConfirmed.tripId ? `/trips?tripId=${bookingConfirmed.tripId}` : '/trips')}
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

        {/* FLIGHTS TAB — L2.1 Modular Architecture */}
        {activeCategory === 'flights' && (
          <section className="space-y-6">
            {/* Active Trip Context Bar with Date/Traveler application and Suggested Airport */}
            <FlightTripContext
              activeTrips={activeTrips}
              selectedTripId={selectedTripId}
              onSelectTrip={(id) => setSelectedTripId(id)}
              onClearTrip={() => setSelectedTripId('')}
              onApplyTripDates={(start, end) => {
                setDepartureDate(start);
                if (end) setReturnDate(end);
              }}
              onApplyTripTravelers={(travelers) => setPassengers(travelers)}
              suggestedAirport={suggestedAirport}
              onApplySuggestedAirport={(code) => setFlightDest(code)}
            />

            {/* Flight Search Form with L1 Airport Autocomplete & Client Validation */}
            <FlightSearchForm
              initialOrigin={flightOrigin}
              initialDestination={flightDest}
              initialDepartureDate={departureDate}
              initialReturnDate={returnDate}
              initialPassengers={passengers}
              initialCabinClass={cabinClass}
              initialTripType={tripType === 'round' ? 'roundtrip' : 'oneway'}
              isLoading={isSearchingFlights}
              onSearch={handleSearchFlights}
              onParamsChange={setCurrentLiveFlightParams}
            />

            {/* Proposal Generation Progress */}
            {isSubmittingProposal && (
              <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-orange-900 flex items-center gap-3 animate-in fade-in" data-testid="proposal-submitting-banner">
                <div className="w-5 h-5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin shrink-0" />
                <span className="text-xs font-semibold">
                  Generating explicit Trip Proposal with AI verification layer...
                </span>
              </div>
            )}

            {/* Proposal Success Notification */}
            {proposalSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between gap-3 animate-in fade-in" data-testid="proposal-success-banner">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{proposalSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setProposalSuccess(null)}
                  className="text-emerald-700 hover:text-emerald-900 font-bold px-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Active Proposal Review Modal */}
            {activeProposal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in" data-testid="flight-proposal-modal">
                <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2 text-slate-900 font-serif-editorial font-bold text-lg">
                      <Sparkles className="w-5 h-5 text-orange-500" />
                      <span>Review Trip Proposal</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Parent v{activeProposal.parent_version}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">
                    {activeProposal.summary || 'Attach selected flight offer to your active trip.'}
                  </p>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                    <div className="flex justify-between font-semibold text-slate-800">
                      <span>{activeProposal.changes?.flight_offer?.airline} ({activeProposal.changes?.flight_offer?.flight_number})</span>
                      <span className="font-mono text-orange-600 font-bold">₹{activeProposal.changes?.flight_offer?.price?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>Route: {activeProposal.changes?.flight_offer?.origin} → {activeProposal.changes?.flight_offer?.destination}</span>
                      <span>Dep: {activeProposal.changes?.flight_offer?.departure_time}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Provenance: <strong className="text-slate-700">{activeProposal.changes?.flight_offer?.provenance || 'CURATED'}</strong></span>
                      <span>Availability: <strong className="text-slate-700">{activeProposal.changes?.flight_offer?.availability_state || 'ESTIMATED'}</strong></span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] space-y-1">
                    <p className="font-semibold">Architectural Trust Guarantee:</p>
                    <p className="text-blue-800">
                      Accepting this proposal creates an append-only TripRevision (v{activeProposal.parent_version + 1}) and records transport references with honest CURATED provenance. No third-party charge is made.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveProposal(null)}
                      disabled={isSubmittingProposal}
                      className="text-xs cursor-pointer"
                    >
                      Discard
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleAcceptProposal}
                      isLoading={isSubmittingProposal}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer shadow-sm"
                    >
                      Accept Proposal & Update Trip →
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Flight Results Component */}
            <FlightResults
              searchResponse={flightResponse}
              isLoading={isSearchingFlights}
              error={flightError}
              isStale={isFlightSearchStale}
              previousSearchParams={lastSearchedParams}
              currentSearchParams={currentLiveFlightParams}
              onRefreshSearch={() => lastSearchedParams && handleSearchFlights(lastSearchedParams)}
              selectedOfferId={activeProposal?.changes?.flight_offer?.offer_id}
              onSelectOffer={handleSelectFlightOffer}
              onRetrySearch={() => lastSearchedParams && handleSearchFlights(lastSearchedParams)}
            />
          </section>
        )}

        {/* HOTELS & STAYS TAB */}
        {activeCategory === 'hotels' && (
          <section className="space-y-4">
            {/* Filter Controls */}
            <Card className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase text-slate-400">Destination</label>
                  <input
                    type="text"
                    value={hotelDest}
                    onChange={(e) => setHotelDest(e.target.value)}
                    list="hotel-destinations-list"
                    placeholder="e.g. Kyoto, Goa, Manali"
                    className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 w-36"
                  />
                  <datalist id="hotel-destinations-list">
                    <option value="Goa" />
                    <option value="Manali" />
                    <option value="Jaipur" />
                    <option value="Kyoto" />
                    <option value="Bali" />
                    <option value="Udaipur" />
                    <option value="Rishikesh" />
                    <option value="Munnar" />
                  </datalist>
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
                  {isSearchingHotels ? 'Working out the best stay options…' : `${hotelsList.length} curated stays in catalog`}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadHotels(hotelDest, hotelGuests, hotelCheckIn, hotelCheckOut)}
                  disabled={isSearchingHotels}
                  className="border-slate-200 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5 mr-1 text-orange-500" />
                  {hotelsList.length > 0 ? 'Update results' : 'Search stays'}
                </Button>
              </div>
            </Card>

            {/* Stale Hotel Search Warning */}
            {isHotelSearchStale && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="font-bold text-sm">These offers match your previous search</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Stay criteria changed — click &quot;Update results&quot; to refresh stays for {hotelDest || 'new criteria'}.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => loadHotels(hotelDest, hotelGuests, hotelCheckIn, hotelCheckOut)}
                  isLoading={isSearchingHotels}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl shrink-0 cursor-pointer shadow-sm"
                >
                  Update results →
                </Button>
              </div>
            )}

            {/* Hotel Cards Grid with Visual Muting when Stale */}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-5 transition-opacity duration-200 ${isHotelSearchStale ? 'opacity-60 pointer-events-none' : ''}`}>
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

                  {(() => {
                    const stayNights = ht.nights || getHotelNights(hotelCheckIn, hotelCheckOut);
                    const totalAmount = ht.total_amount || ht.total_price || ((ht.price_per_night || 0) * stayNights);
                    return (
                      <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-100">
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-serif-editorial font-bold text-slate-900">
                              ₹{ht.price_per_night?.toLocaleString('en-IN')}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">/ night</span>
                          </div>
                          {stayNights > 1 && (
                            <span className="text-[11px] text-slate-500 font-semibold block">
                              ₹{totalAmount.toLocaleString('en-IN')} total ({stayNights} nights)
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                          {ht.deep_link ? (
                            <a
                              href={ht.deep_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                              title="Open provider"
                            >
                              <span>Book on {ht.source || 'Provider'}</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">Provider direct booking</span>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            isLoading={loading}
                            className="border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs cursor-pointer"
                            onClick={() =>
                              handleSaveBookingReference(
                                'hotel',
                                ht.source || 'Stay Provider',
                                `${ht.name} (${ht.room_type} · ${stayNights} ${stayNights === 1 ? 'night' : 'nights'})`,
                                totalAmount,
                                {
                                  ...ht,
                                  nightly_rate: ht.price_per_night,
                                  total_amount: totalAmount,
                                  stay_nights: stayNights,
                                }
                              )
                            }
                          >
                            Already booked? Add reference
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </Card>
              ))}
            </div>

            {hotelsList.length === 0 && !isSearchingHotels && !hotelError && (
              <Card className="p-8 rounded-2xl bg-white border border-dashed border-slate-300 text-center space-y-3 shadow-2xs">
                <div className="w-12 h-12 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center mx-auto text-orange-600">
                  <Hotel className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-serif-editorial font-bold text-slate-900 text-base">Ready to explore stays & hotels</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Verify your destination and travel dates above, then click &quot;Search stays&quot; to compare boutique stays and hotels.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => loadHotels(hotelDest, hotelGuests, hotelCheckIn, hotelCheckOut)}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs px-5 py-2 rounded-xl cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5 mr-1" />
                  Search stays
                </Button>
              </Card>
            )}
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
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold uppercase border border-slate-300">
                          {b.status === 'saved_reference' ? 'SAVED REFERENCE · UNVERIFIED' : b.status}
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
                        onClick={() => router.push(b.trip_id ? `/trips?tripId=${b.trip_id}` : '/trips')}
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
