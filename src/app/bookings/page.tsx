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
  X,
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
import { AttachFlightModal } from '@/components/flight/AttachFlightModal';
import { TripProposalModal } from '@/components/flight/TripProposalModal';
import { FlightOffer, FlightSearchParams, FlightSearchResponse } from '@/types/flight';
import { formatCurrency } from '@/lib/formatCurrency';
import { formatFriendlyDate } from '@/lib/formatDate';

type BookingCategory = 'flights' | 'hotels' | 'trains' | 'buses' | 'cabs' | 'my_bookings';

function BookingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTripId = searchParams.get('tripId');

  const { setCoins } = useAuthStore();
  const [activeCategory, setActiveCategory] = useState<BookingCategory>('flights');
  const [bookingConfirmed, setBookingConfirmed] = useState<{ title: string; pnr: string; provider: string; tripId?: string } | null>(null);
  const [flightAttached, setFlightAttached] = useState<{
    airline: string;
    flightNumber: string;
    version: number;
    tripId: string;
    deepLink?: string;
    provider: string;
  } | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userBookings, setUserBookings] = useState<any[]>([]);
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>('');

  // Flight search states (Clean defaults — populated via selected Trip)
  const [flightOrigin, setFlightOrigin] = useState('');
  const [flightDest, setFlightDest] = useState('');
  const [suggestedOriginAirport, setSuggestedOriginAirport] = useState<{ iata_code: string; name: string; city: string } | null>(null);
  const [suggestedAirport, setSuggestedAirport] = useState<{ iata_code: string; name: string; city: string } | null>(null);
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [cabinClass, setCabinClass] = useState('economy');
  const [tripType, setTripType] = useState<'round' | 'oneway'>('round');
  const [rawFlights, setRawFlights] = useState<FlightOffer[]>([]);
  const [flightResponse, setFlightResponse] = useState<FlightSearchResponse | null>(null);
  const [lastSearchedParams, setLastSearchedParams] = useState<FlightSearchParams | null>(null);
  const [currentFlightParams, setCurrentFlightParams] = useState<FlightSearchParams | null>(null);
  const [isSearchingFlights, setIsSearchingFlights] = useState(false);
  const [flightError, setFlightError] = useState<string | null>(null);
  const [pendingOfferForProposal, setPendingOfferForProposal] = useState<FlightOffer | null>(null);
  const [activeProposal, setActiveProposal] = useState<any | null>(null);
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);
  const [proposalSuccess, setProposalSuccess] = useState<string | null>(null);
  const [isNotifiedComingSoon, setIsNotifiedComingSoon] = useState(false);

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
    currentFlightParams &&
    rawFlights.length > 0 &&
    (
      lastSearchedParams.origin !== currentFlightParams.origin ||
      lastSearchedParams.destination !== currentFlightParams.destination ||
      lastSearchedParams.departureDate !== currentFlightParams.departureDate ||
      (lastSearchedParams.returnDate || '') !== (currentFlightParams.returnDate || '') ||
      lastSearchedParams.passengers !== currentFlightParams.passengers ||
      lastSearchedParams.cabinClass !== currentFlightParams.cabinClass ||
      lastSearchedParams.tripType !== currentFlightParams.tripType
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
          const normalizedTrips = tripsData.map((t: any) => ({
            id: t.id,
            title: t.title || t.destination,
            destination: t.destination,
            origin: t.origin || t.origin_city || '',
            startDate: t.startDate || t.start_date || '',
            endDate: t.endDate || t.end_date || '',
            travellers: t.travellers || t.travelers_count || 1,
            status: t.status || 'planning',
          }));
          setActiveTrips(normalizedTrips);
          if (paramTripId && normalizedTrips.some((t: any) => t.id === paramTripId)) {
            setSelectedTripId(paramTripId);
          } else {
            setSelectedTripId(normalizedTrips[0].id);
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
            setSuggestedOriginAirport(null);
          } else {
            apiService.searchLocations(orig, 1).then((airports) => {
              if (airports && airports.length > 0) {
                setSuggestedOriginAirport({
                  iata_code: airports[0].iata_code,
                  name: airports[0].name,
                  city: airports[0].city,
                });
              } else {
                setSuggestedOriginAirport(null);
              }
            }).catch(() => setSuggestedOriginAirport(null));
            setFlightOrigin('');
          }
        } else {
          setFlightOrigin('');
          setSuggestedOriginAirport(null);
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

  const handleSelectFlightOffer = (offer: FlightOffer) => {
    if (isFlightSearchStale) {
      setBookingError('Search parameters have changed. Please update your results before selecting a flight.');
      return;
    }
    if (
      currentFlightParams &&
      (offer.origin !== currentFlightParams.origin ||
        offer.destination !== currentFlightParams.destination ||
        offer.departure_date !== currentFlightParams.departureDate ||
        (offer.trip_type === 'roundtrip' && offer.return_date !== currentFlightParams.returnDate))
    ) {
      setBookingError('Selected flight does not match active search parameters. Please update your results.');
      return;
    }
    if (!selectedTripId && activeTrips.length > 0) {
      setSelectedTripId(activeTrips[0].id);
    }
    setPendingOfferForProposal(offer);
  };

  const handleCreateProposalFromOffer = async () => {
    if (!pendingOfferForProposal) return;
    if (isFlightSearchStale) {
      setBookingError('Search parameters have changed. Please update your results before creating a proposal.');
      return;
    }
    const targetTripId = selectedTripId || (activeTrips.length > 0 ? activeTrips[0].id : null);
    if (!targetTripId) {
      setBookingError('Please link an active trip from the context selector to attach this flight offer.');
      return;
    }
    setIsSubmittingProposal(true);
    setBookingError(null);
    try {
      const proposal = await apiService.createFlightOfferProposal(
        targetTripId,
        pendingOfferForProposal,
        currentFlightParams || lastSearchedParams || undefined
      );
      setActiveProposal(proposal);
      setPendingOfferForProposal(null);
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
      const offer = activeProposal.changes?.flight_offer;
      setFlightAttached({
        airline: offer?.airline || 'Flight',
        flightNumber: offer?.flight_number || '',
        version: res.version,
        tripId: selectedTripId,
        deepLink: offer?.deep_link,
        provider: offer?.provider || 'Curated Catalog',
      });
      setActiveProposal(null);
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

  const categories: { id: BookingCategory; label: string; icon: any; disabled?: boolean; badge?: string }[] = [
    { id: 'flights', label: 'Flights', icon: Plane, disabled: false },
    { id: 'hotels', label: 'Stays & Hotels', icon: Hotel, disabled: false },
    { id: 'trains', label: 'Trains', icon: Train, disabled: true, badge: 'Coming soon' },
    { id: 'buses', label: 'Buses', icon: Bus, disabled: true, badge: 'Coming soon' },
    { id: 'cabs', label: 'Cabs', icon: Car, disabled: true, badge: 'Coming soon' },
    { id: 'my_bookings', label: `Saved Bookings (${userBookings.length})`, icon: Ticket, disabled: false },
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
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-stone-200/90 pb-5">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-serif-editorial font-bold text-stone-900 tracking-tight">
              Find your way there
            </h1>
            <p className="text-stone-600 text-xs sm:text-sm font-medium max-w-2xl">
              Compare current DashTiny travel options and choose what fits your Trip.
            </p>
          </div>

          {/* Quiet Grounding of Active Trip */}
          {activeTrips.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-stone-600 bg-white px-3.5 py-2 rounded-2xl border border-stone-200/90 shadow-2xs">
              <Briefcase className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span className="text-stone-500 font-medium">Trip:</span>
              <select
                value={selectedTripId}
                onChange={(e) => setSelectedTripId(e.target.value)}
                className="font-bold text-stone-900 bg-transparent border-0 p-0 text-xs focus:ring-0 focus:outline-none cursor-pointer"
                aria-label="Active trip"
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

        {/* Bookings Coming Soon Strategic Notice */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-800 to-orange-950 p-6 sm:p-7 text-white shadow-xl border border-stone-700/60" data-testid="bookings-coming-soon-banner">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                <span>Architecture Ready · Booking Integration In Progress</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-serif-editorial font-bold tracking-tight text-white">
                Bookings are coming soon — stay tuned.
              </h2>
              <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
                We&apos;re building trusted booking integrations. Stay tuned.
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-300">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                  <span>Plan your complete trip</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                  <span>Compare your itinerary</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                  <span>Save travel options</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                  <span>Prepare everything before booking</span>
                </li>
              </ul>
              <p className="text-stone-400 text-xs font-medium pt-0.5">
                Stay tuned as we integrate trusted provider networks.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
              <Button
                onClick={() => router.push('/planner')}
                className="bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs sm:text-sm px-6 py-2.5 rounded-2xl shadow-lg shadow-orange-950/40 cursor-pointer flex items-center justify-center gap-2"
                data-testid="continue-planning-cta"
              >
                <span>Continue planning</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
              <button
                type="button"
                onClick={() => setIsNotifiedComingSoon(!isNotifiedComingSoon)}
                className="px-4 py-2 rounded-2xl border border-stone-600 bg-stone-800/80 hover:bg-stone-700 text-stone-200 text-xs font-medium transition-colors cursor-pointer text-center"
                data-testid="keep-me-updated-cta"
              >
                {isNotifiedComingSoon ? '✓ We will keep you updated' : 'Keep me updated'}
              </button>
            </div>
          </div>
        </div>

        {/* Flight Attached to Trip Notification Banner (Zero Fake PNR) */}
        {flightAttached && (
          <div
            className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in"
            data-testid="flight-attached-banner"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-emerald-950">✓ Flight attached to Trip</span>
                  <span className="text-emerald-800">· {flightAttached.airline} {flightAttached.flightNumber}</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Revision v{flightAttached.version}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  No booking has been made by DashTiny. Continue to the provider to book.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {flightAttached.deepLink && (
                <a
                  href={flightAttached.deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900 font-semibold text-xs transition-colors cursor-pointer"
                  data-testid="continue-provider-btn"
                >
                  <span>Continue to provider</span>
                  <ExternalLink className="w-3 h-3 text-emerald-600" />
                </a>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(flightAttached.tripId ? `/trips?tripId=${flightAttached.tripId}` : '/trips')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs border-0 shadow-2xs cursor-pointer"
              >
                Open Trip →
              </Button>
              <button
                type="button"
                onClick={() => setFlightAttached(null)}
                className="text-stone-500 hover:text-stone-800 text-xs px-1.5 py-1 cursor-pointer font-medium"
              >
                Continue browsing
              </button>
            </div>
          </div>
        )}

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
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar" data-testid="booking-category-tabs">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;

            if (cat.disabled) {
              return (
                <div
                  key={cat.id}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 bg-slate-100/60 border border-slate-200/50 cursor-not-allowed select-none opacity-60 shrink-0"
                  title={`${cat.label} booking integration is coming soon in a future release`}
                  data-testid={`category-tab-${cat.id}-disabled`}
                >
                  <Icon className="w-3.5 h-3.5 text-slate-400" />
                  <span>{cat.label}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-wider bg-slate-200 text-slate-600 px-1 py-0.2 rounded">
                    Soon
                  </span>
                </div>
              );
            }

            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-orange-600 text-white shadow-2xs font-bold'
                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200'
                }`}
                data-testid={`category-tab-${cat.id}`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* FLIGHTS TAB — Frozen for L4 */}
        {activeCategory === 'flights' && (
          <section className="space-y-6">
            <Card className="p-8 sm:p-12 rounded-3xl bg-white border border-stone-200 shadow-2xs text-center space-y-4 max-w-2xl mx-auto my-4" data-testid="flights-frozen-card">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 mx-auto">
                <Plane className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Provider Integration In Progress</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-serif-editorial font-bold text-stone-900">
                  Bookings are coming soon — stay tuned.
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto leading-relaxed">
                  We&apos;re building trusted booking integrations. Pseudo-live flight search and attachment are paused while real partner networks are configured.
                </p>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  onClick={() => router.push('/planner')}
                  className="bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs px-6 py-2.5 rounded-xl shadow-2xs cursor-pointer flex items-center gap-2"
                >
                  <span>Build Itinerary in Planner</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setActiveCategory('my_bookings')}
                  className="text-stone-600 hover:text-stone-900 text-xs px-5 py-2.5 rounded-xl border-stone-300 cursor-pointer"
                >
                  View Saved Bookings
                </Button>
              </div>
            </Card>
          </section>
        )}

        {/* HOTELS & STAYS TAB — Frozen for L4 */}
        {activeCategory === 'hotels' && (
          <section className="space-y-6">
            <Card className="p-8 sm:p-12 rounded-3xl bg-white border border-stone-200 shadow-2xs text-center space-y-4 max-w-2xl mx-auto my-4" data-testid="hotels-frozen-card">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 mx-auto">
                <Hotel className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Provider Integration In Progress</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-serif-editorial font-bold text-stone-900">
                  Bookings are coming soon — stay tuned.
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto leading-relaxed">
                  We&apos;re building trusted booking integrations. Hotel reservation linking and stay aggregations will be enabled once trusted partner agreements go live.
                </p>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  onClick={() => router.push('/planner')}
                  className="bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs px-6 py-2.5 rounded-xl shadow-2xs cursor-pointer flex items-center gap-2"
                >
                  <span>Build Itinerary in Planner</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setActiveCategory('my_bookings')}
                  className="text-stone-600 hover:text-stone-900 text-xs px-5 py-2.5 rounded-xl border-stone-300 cursor-pointer"
                >
                  View Saved Bookings
                </Button>
              </div>
            </Card>
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
