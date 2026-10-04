"""
DashTiny AI Action & Proposal Engine (backend/app/api/v1/ai.py)
Core Engineering Invariant:
"AI proposes. Tools verify. Services execute. The database remembers. The UI lets the traveler decide."

Implements:
1. POST /api/v1/ai/proposals
   Generates a non-mutating structured diff proposal with verification and provenance.
   Persists TripProposal record. Does NOT mutate the Trip.
2. POST /api/v1/ai/proposals/{proposal_id}/accept
   The ONLY endpoint allowed to apply the AI proposal to the Trip.
   Validates parent revision lock, creates an append-only TripRevision, applies activity diff,
   logs AI observability telemetry, and commits atomically.
3. POST /api/v1/ai/proposals/{proposal_id}/reject
   Records rejection and performs no Trip mutation.
4. POST /api/v1/ai/query
   Harden legacy endpoint: strictly requires explicit trip_id (rejects 'latest'/null),
   and executes through the authoritative TripRevisionService.
"""
import time
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import (
    Itinerary, ItineraryDay, ItineraryActivity, User,
    AIRun, AIToolCall, SquadRoom, SquadMember, TripSnapshot, TripProposal, Booking, Airport
)
from app.ai.tools.itinerary import apply_itinerary_action
from app.ai.tools.weather import get_destination_weather
from app.ai.tools.maps import get_coordinates
from app.api.deps import get_current_user
from app.services.trip_revision_service import (
    serialize_trip_days,
    get_current_version,
    create_revision,
    apply_activity_diff,
    validate_revision_parent,
    record_initial_revision
)
from app.services.providers.curated import CuratedFlightProvider

router = APIRouter(prefix="/ai", tags=["DashTiny AI Action & Proposal Engine"])

_flight_provider = CuratedFlightProvider()


class AIProposalRequest(BaseModel):
    trip_id: str
    instruction: Optional[str] = ""
    proposal_type: Optional[str] = "ITINERARY_DIFF"  # ITINERARY_DIFF or ATTACH_FLIGHT_OFFER
    offer: Optional[Dict[str, Any]] = None
    offer_id: Optional[str] = None
    search_context: Optional[Dict[str, Any]] = None
    explicit_origin_airport: Optional[str] = None
    explicit_destination_airport: Optional[str] = None


class AIQueryRequest(BaseModel):
    trip_id: str
    instruction: str


def verify_trip_access(trip: Itinerary, user: User, db: Session):
    """Enforces trip ownership or squad membership."""
    is_owner = (trip.owner_id == user.id)
    squad = db.query(SquadRoom).filter(SquadRoom.itinerary_id == trip.id).first()
    is_member = False
    if squad:
        is_member = db.query(SquadMember).filter(
            SquadMember.squad_id == squad.id,
            SquadMember.user_id == user.id
        ).first() is not None
    if not is_owner and not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have permission to modify this trip."
        )


@router.post("/proposals")
def create_ai_proposal(
    request: AIProposalRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    P0 AI Proposal Generation:
    1. Authenticates traveler and loads explicit Trip (rejects 'latest' or null).
    2. Validates owner/member access.
    3. Loads canonical Trip state.
    4. Runs AI/action engine & verification tools.
    5. Produces structured diff.
    6. Persists TripProposal record.
    7. DOES NOT mutate the Trip!
    """
    if not request.trip_id or request.trip_id.strip() in ["latest", ""]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An explicit, valid trip_id is required. Falling back to default or 'latest' trips is disabled."
        )

    trip = db.query(Itinerary).filter(Itinerary.id == request.trip_id.strip()).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    verify_trip_access(trip, user, db)

    # 1. Get current revision version for parent locking (every Trip starts at v1)
    curr_version = get_current_version(db, trip.id)
    if curr_version == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trip has not been initialized with baseline revision v1."
        )

    # BRANCH 1: ATTACH_FLIGHT_OFFER
    # Strictly isolated from generic itinerary AI, geocoding, and weather tools.
    if request.proposal_type == "ATTACH_FLIGHT_OFFER" or request.offer:
        # Step A: Validate Offer ID
        target_offer_id = request.offer_id or (request.offer.get("offer_id") if request.offer else None)
        if not target_offer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="offer_id is required to attach a flight offer to a trip."
            )

        # Step B: Determine effective search context
        ctx = request.search_context or (request.offer if request.offer else {})
        ctx_origin = (ctx.get("origin") or "").strip().upper()
        ctx_dest = (ctx.get("destination") or "").strip().upper()
        ctx_dep = (ctx.get("departure_date") or ctx.get("departureDate") or "").strip()
        ctx_ret = (ctx.get("return_date") or ctx.get("returnDate") or "").strip() or None
        ctx_cabin = (ctx.get("cabin_class") or ctx.get("cabinClass") or "economy").strip().lower()
        ctx_pax = int(ctx.get("passengers") or 1)
        ctx_trip_type = (ctx.get("trip_type") or ctx.get("tripType") or ("roundtrip" if ctx_ret else "oneway")).strip().lower()

        if not ctx_origin or not ctx_dest or not ctx_dep:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A valid search context (origin, destination, departure_date) is required to verify flight offer."
            )

        # Step C: If both search_context and an offer payload were provided, verify search context agreement
        if request.search_context and request.offer:
            offer_origin = (request.offer.get("origin") or "").strip().upper()
            offer_dest = (request.offer.get("destination") or "").strip().upper()
            offer_dep = (request.offer.get("departure_date") or "").strip()
            offer_ret = (request.offer.get("return_date") or "").strip()
            offer_cabin = (request.offer.get("cabin_class") or "").strip().lower()
            offer_pax = request.offer.get("passengers")
            offer_trip_type = (request.offer.get("trip_type") or "").strip().lower()

            mismatches = []
            if ctx_origin and offer_origin and ctx_origin != offer_origin:
                mismatches.append(f"origin ({offer_origin} vs {ctx_origin})")
            if ctx_dest and offer_dest and ctx_dest != offer_dest:
                mismatches.append(f"destination ({offer_dest} vs {ctx_dest})")
            if ctx_dep and offer_dep and ctx_dep != offer_dep:
                mismatches.append(f"departure date ({offer_dep} vs {ctx_dep})")
            if ctx_trip_type == "roundtrip" and ctx_ret and offer_ret and ctx_ret != offer_ret:
                mismatches.append(f"return date ({offer_ret} vs {ctx_ret})")
            if ctx_cabin and offer_cabin and ctx_cabin != offer_cabin:
                mismatches.append(f"cabin ({offer_cabin} vs {ctx_cabin})")
            if ctx_pax is not None and offer_pax is not None and int(ctx_pax) != int(offer_pax):
                mismatches.append(f"passengers ({offer_pax} vs {ctx_pax})")
            if ctx_trip_type and offer_trip_type and ctx_trip_type != offer_trip_type:
                mismatches.append(f"trip type ({offer_trip_type} vs {ctx_trip_type})")

            if mismatches:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Flight offer search context does not match active search context: {', '.join(mismatches)}. Please refresh your search."
                )

        # Step D: Validate Trip vs Flight Compatibility (P0 L2.6)
        # 1. Trip Origin Validation
        if trip.origin and trip.origin.strip():
            city_airports = db.query(Airport).filter(
                func.lower(Airport.city) == trip.origin.strip().lower(),
                Airport.is_active == True
            ).all()
            if len(city_airports) > 1:
                if not (request.explicit_origin_airport and request.explicit_origin_airport.strip().upper() == ctx_origin):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Trip origin '{trip.origin}' is ambiguous between multiple airports ({', '.join(a.iata_code for a in city_airports)}). Select an airport from the airport directory."
                    )
            elif len(city_airports) == 1:
                if city_airports[0].iata_code != ctx_origin:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Trip origin mismatch: Trip origin is '{trip.origin}' ({city_airports[0].iata_code}), but flight departs from '{ctx_origin}'."
                    )
            else:
                clean_trip_origin = trip.origin.strip().upper()
                iata_match = db.query(Airport).filter(
                    Airport.iata_code == clean_trip_origin,
                    Airport.is_active == True
                ).first()
                if iata_match:
                    if clean_trip_origin != ctx_origin:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail=f"Trip origin mismatch: Trip origin is '{trip.origin}', but flight departs from '{ctx_origin}'."
                        )
                else:
                    name_matches = db.query(Airport).filter(
                        func.lower(Airport.name).like(f"%{trip.origin.strip().lower()}%"),
                        Airport.is_active == True
                    ).all()
                    if len(name_matches) > 1:
                        if not (request.explicit_origin_airport and request.explicit_origin_airport.strip().upper() == ctx_origin):
                            raise HTTPException(
                                status_code=status.HTTP_409_CONFLICT,
                                detail=f"Trip origin '{trip.origin}' is ambiguous between multiple airports ({', '.join(a.iata_code for a in name_matches)}). Select an airport from the airport directory."
                            )
                    elif len(name_matches) == 1:
                        if name_matches[0].iata_code != ctx_origin:
                            raise HTTPException(
                                status_code=status.HTTP_409_CONFLICT,
                                detail=f"Trip origin mismatch: Trip origin is '{trip.origin}' ({name_matches[0].iata_code}), but flight departs from '{ctx_origin}'."
                            )
                    else:
                        if clean_trip_origin != ctx_origin:
                            raise HTTPException(
                                status_code=status.HTTP_409_CONFLICT,
                                detail=f"Trip origin mismatch: Trip origin '{trip.origin}' does not match flight origin '{ctx_origin}'."
                            )

        # 2. Trip Destination Validation
        city_airports = db.query(Airport).filter(
            func.lower(Airport.city) == trip.destination.strip().lower(),
            Airport.is_active == True
        ).all()
        if len(city_airports) > 1:
            if not (request.explicit_destination_airport and request.explicit_destination_airport.strip().upper() == ctx_dest):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Trip destination '{trip.destination}' is ambiguous between multiple airports ({', '.join(a.iata_code for a in city_airports)}). Select an airport from the airport directory."
                )
        elif len(city_airports) == 1:
            if city_airports[0].iata_code != ctx_dest:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Trip destination mismatch: Trip destination is '{trip.destination}' ({city_airports[0].iata_code}), but flight arrives at '{ctx_dest}'."
                )
        else:
            clean_trip_dest = (trip.destination or "").strip().upper()
            iata_match = db.query(Airport).filter(
                Airport.iata_code == clean_trip_dest,
                Airport.is_active == True
            ).first()
            if iata_match:
                if clean_trip_dest != ctx_dest:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Trip destination mismatch: Trip destination is '{trip.destination}', but flight arrives at '{ctx_dest}'."
                    )
            else:
                name_matches = db.query(Airport).filter(
                    func.lower(Airport.name).like(f"%{trip.destination.strip().lower()}%"),
                    Airport.is_active == True
                ).all()
                if len(name_matches) > 1:
                    if not (request.explicit_destination_airport and request.explicit_destination_airport.strip().upper() == ctx_dest):
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail=f"Trip destination '{trip.destination}' is ambiguous between multiple airports ({', '.join(a.iata_code for a in name_matches)}). Select an airport from the airport directory."
                        )
                elif len(name_matches) == 1:
                    if name_matches[0].iata_code != ctx_dest:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail=f"Trip destination mismatch: Trip destination is '{trip.destination}' ({name_matches[0].iata_code}), but flight arrives at '{ctx_dest}'."
                        )
                else:
                    if clean_trip_dest != ctx_dest:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail=f"Trip destination mismatch: Trip destination '{trip.destination}' does not match flight destination '{ctx_dest}'."
                        )

        # 3. Trip Dates vs Flight Dates Validation
        try:
            flight_dep_date = datetime.strptime(ctx_dep, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid departure_date format. Must be YYYY-MM-DD."
            )

        if trip.start_date:
            if flight_dep_date < trip.start_date:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Flight departure date ({flight_dep_date}) is outside Trip dates ({trip.start_date} to {trip.end_date}). Departure is before trip start date."
                )
            if trip.end_date and flight_dep_date > trip.end_date:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Flight departure date ({flight_dep_date}) is outside Trip dates ({trip.start_date} to {trip.end_date}). Departure is after trip end date."
                )

        if ctx_trip_type == "roundtrip" and ctx_ret:
            try:
                flight_ret_date = datetime.strptime(ctx_ret, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid return_date format. Must be YYYY-MM-DD."
                )
            if trip.end_date and flight_ret_date > trip.end_date:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Flight return date ({flight_ret_date}) is outside Trip dates ({trip.start_date} to {trip.end_date}). Return is after trip end date."
                )
            if trip.start_date and flight_ret_date < trip.start_date:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Flight return date ({flight_ret_date}) is outside Trip dates ({trip.start_date} to {trip.end_date}). Return is before trip start date."
                )

        # Step E: Query provider to reconstruct authoritative canonical offers for this search context
        canonical_offers = _flight_provider.search_flights(
            origin=ctx_origin,
            destination=ctx_dest,
            departure_date=ctx_dep,
            return_date=ctx_ret if ctx_trip_type == "roundtrip" else None,
            passengers=ctx_pax,
            cabin_class=ctx_cabin,
            trip_type=ctx_trip_type,
            db=db
        )
        canonical_match = next((o for o in canonical_offers if o.offer_id == target_offer_id), None)
        if not canonical_match:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Flight offer '{target_offer_id}' could not be verified against the canonical catalog for this search context. Offer is invalid or expired."
            )

        # Step F: Forgery validation against client-submitted offer payload
        if request.offer:
            client_price = request.offer.get("price")
            if client_price is not None and abs(float(client_price) - float(canonical_match.price)) > 0.01:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Forged flight offer metadata detected: price mismatch (submitted: {client_price}, canonical: {canonical_match.price})."
                )
            client_airline = request.offer.get("airline")
            if client_airline and client_airline.strip().lower() != canonical_match.airline.strip().lower():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Forged flight offer metadata detected: airline mismatch (submitted: {client_airline}, canonical: {canonical_match.airline})."
                )
            client_fn = request.offer.get("flight_number")
            if client_fn and client_fn.strip().lower() != canonical_match.flight_number.strip().lower():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Forged flight offer metadata detected: flight number mismatch."
                )

        # Step G: Use canonical verified offer attributes exclusively
        offer = canonical_match.model_dump() if hasattr(canonical_match, "model_dump") else canonical_match.dict()

        airline = offer.get("airline", "Selected Airline")
        flight_number = offer.get("flight_number", "FL-100")
        origin = offer.get("origin", "")
        dest = offer.get("destination", "")
        price = float(offer.get("price", 0))
        summary = f"Attach {airline} flight {flight_number} ({origin} → {dest}) to your trip"

        changes = [{
            "action": "attach_flight",
            "flight_number": flight_number,
            "airline": airline,
            "origin": origin,
            "destination": dest,
            "departure_time": offer.get("departure_time"),
            "arrival_time": offer.get("arrival_time"),
            "price": price,
            "why_recommended": offer.get("why_recommended", "Traveler selected curated flight offer")
        }]

        before_days = serialize_trip_days(trip)
        updated_days = []
        for idx, day in enumerate(before_days):
            day_copy = dict(day)
            acts = list(day.get("activities", []))
            if idx == 0:
                transit_act = {
                    "time": offer.get("departure_time", "08:00 AM"),
                    "description": f"Flight {airline} {flight_number}: {origin} → {dest}",
                    "location": f"{offer.get('origin_airport', {}).get('name', origin)} Airport",
                    "place_type": "TR",
                    "provenance": "CURATED",
                    "cost_estimate": price,
                    "why_recommended": offer.get("why_recommended", "Selected transportation for trip"),
                    "location_source": "AIRPORT_DIRECTORY",
                    "transit_mode": "flight"
                }
                acts.insert(0, transit_act)
            if offer.get("trip_type") == "roundtrip" and idx == len(before_days) - 1 and len(before_days) > 1:
                # P0 L2.6: Real canonical inbound segment data
                inbound = offer.get("inbound") or {}
                ret_dep_time = inbound.get("departure_time") or "06:00 PM"
                ret_fn = inbound.get("flight_number") or f"{flight_number}-R"
                ret_airline = inbound.get("airline") or airline
                ret_orig = inbound.get("origin") or dest
                ret_dest = inbound.get("destination") or origin
                
                ret_orig_city = offer.get('destination_airport', {}).get('city', ret_orig)
                ret_dest_city = offer.get('origin_airport', {}).get('city', ret_dest)

                return_act = {
                    "time": ret_dep_time,
                    "description": f"Return · {ret_airline} {ret_fn}\n{ret_orig_city} ({ret_orig}) → {ret_dest_city} ({ret_dest})",
                    "location": f"{offer.get('destination_airport', {}).get('name', dest)} Airport",
                    "place_type": "TR",
                    "provenance": "CURATED",
                    "cost_estimate": 0,
                    "why_recommended": f"Canonical return flight segment: {ret_airline} {ret_fn}",
                    "location_source": "AIRPORT_DIRECTORY",
                    "transit_mode": "flight"
                }
                acts.append(return_act)
            day_copy["activities"] = acts
            updated_days.append(day_copy)

        proposal = TripProposal(
            trip_id=trip.id,
            user_id=user.id,
            parent_version=curr_version,
            instruction=request.instruction or summary,
            summary=summary,
            changes=changes,
            before_state={"days": before_days},
            after_state=updated_days,
            verification={
                "spatial_bounds": "VERIFIED",
                "airport_codes": f"{origin} - {dest}",
                "route_feasible": True,
                "flight_verified": True,
                "canonical_offer_id": target_offer_id
            },
            provenance={
                "tier": "CURATED",
                "source": "CURATED_DATABASE",
                "model": "curated-flight-v1",
                "why_recommended": offer.get("why_recommended", "Selected curated flight offer"),
                "proposal_type": "ATTACH_FLIGHT_OFFER",
                "offer_payload": offer
            },
            status="pending"
        )
        db.add(proposal)
        db.commit()
        db.refresh(proposal)

        return {
            "proposal_id": proposal.id,
            "id": proposal.id,
            "trip_id": proposal.trip_id,
            "parent_version": proposal.parent_version,
            "proposal_type": "ATTACH_FLIGHT_OFFER",
            "summary": proposal.summary,
            "changes": {
                "flight_offer": offer,
                "action": "attach_flight",
                "summary": summary
            },
            "before": proposal.before_state,
            "after": {"days": proposal.after_state},
            "verification": proposal.verification,
            "provenance": proposal.provenance,
            "status": proposal.status
        }

    # BRANCH 2: ITINERARY_DIFF (Generic AI / Action Engine)
    # 1. Load canonical Trip state
    before_days = serialize_trip_days(trip)

    # 2. Run action tool to produce diff
    action_result = apply_itinerary_action(request.instruction, before_days)

    # 3. Verification tools: verify coordinates and weather advisory
    spatial_verified = True
    for d in action_result.get("updated_days", []):
        for act in d.get("activities", []):
            loc = act.get("location") or trip.destination
            if act.get("lat") is None or act.get("lng") is None:
                coords = get_coordinates(loc)
                if coords.get("found"):
                    act["lat"] = coords.get("lat")
                    act["lng"] = coords.get("lng")
                    if not act.get("provenance") or act.get("provenance") == "DETERMINISTIC":
                        act["provenance"] = coords.get("provenance", "GEOCODED")
                    act["location_source"] = "GEOCODED"
                else:
                    spatial_verified = False
                    if not act.get("provenance"):
                        act["provenance"] = "CURATED_UNRESOLVED"
                    act["location_source"] = "UNRESOLVED"
            else:
                act.setdefault("location_source", "GEOCODED")

    weather_profile = get_destination_weather(trip.destination)
    weather_condition = weather_profile.get("condition") or "Weather unavailable"

    # 5. Persist TripProposal record (TRIP IS NOT MUTATED)
    proposal = TripProposal(
        trip_id=trip.id,
        user_id=user.id,
        parent_version=curr_version,
        instruction=request.instruction,
        summary=action_result["summary"],
        changes=action_result["changes"],
        before_state={"days": before_days},
        after_state=action_result["updated_days"],
        verification={
            "spatial_bounds": "VERIFIED" if spatial_verified else "UNRESOLVED",
            "weather_advisory": weather_condition,
            "route_feasible": True
        },
        provenance={
            "tier": "AI_GENERATED",
            "source": "deterministic-planner-v1",
            "model": "deterministic-planner-v1",
            "why_recommended": "Optimized schedule matching traveler instruction"
        },
        status="pending"
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)

    return {
        "proposal_id": proposal.id,
        "trip_id": proposal.trip_id,
        "summary": proposal.summary,
        "changes": proposal.changes,
        "before": proposal.before_state,
        "after": {"days": proposal.after_state},
        "verification": proposal.verification,
        "provenance": proposal.provenance
    }


@router.post("/proposals/{proposal_id}/accept")
def accept_ai_proposal(
    proposal_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    P0 AI Proposal Acceptance:
    Only this endpoint is allowed to mutate the Trip!
    1. Reloads current Trip with row lock.
    2. Verifies ownership / permissions.
    3. Verifies proposal still applies to current revision (no concurrent modifications).
    4. Creates an append-only TripRevision via TripRevisionService.
    5. Applies activity diff while preserving stable activity IDs.
    6. Persists AI observability telemetry (AIRun, AIToolCall).
    7. Atomically commits changes.
    """
    start_time = time.time()

    proposal = db.query(TripProposal).filter(TripProposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if proposal.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Proposal is already {proposal.status}"
        )

    # Lock the Trip row
    trip = db.query(Itinerary).filter(Itinerary.id == proposal.trip_id).with_for_update().first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    verify_trip_access(trip, user, db)

    # Verify revision concurrency
    current_ver = get_current_version(db, trip.id)
    if current_ver != proposal.parent_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Trip has been modified (current revision v{current_ver}) since proposal was generated "
                f"(target v{proposal.parent_version}). Please generate a fresh proposal."
            )
        )

    try:
        # Apply diff to database while preserving stable activity IDs (pure PostgreSQL mutation)
        apply_activity_diff(db, trip, proposal.after_state)

        # Check if proposal is ATTACH_FLIGHT_OFFER
        prov = proposal.provenance or {}
        is_flight = prov.get("proposal_type") == "ATTACH_FLIGHT_OFFER" or any(
            c.get("action") == "attach_flight" for c in (proposal.changes or [])
        )
        if is_flight:
            offer_payload = prov.get("offer_payload") or {}
            airline_name = offer_payload.get("airline") or offer_payload.get("provider", "Curated Airline")
            flight_num = offer_payload.get("flight_number", "FL")
            booking_ref = Booking(
                trip_id=trip.id,
                user_id=user.id,
                category="flight",
                provider=airline_name,
                title=f"Flight {airline_name} {flight_num}",
                amount=float(offer_payload.get("price", 0)),
                currency=offer_payload.get("currency", "INR"),
                status="pending",
                provenance="CURATED",
                details={
                    "offer_id": offer_payload.get("offer_id"),
                    "origin": offer_payload.get("origin"),
                    "destination": offer_payload.get("destination"),
                    "departure_time": offer_payload.get("departure_time"),
                    "arrival_time": offer_payload.get("arrival_time"),
                    "source": "CURATED_DATABASE",
                    "verification": "UNVERIFIED_CURATED_OFFER"
                }
            )
            db.add(booking_ref)

        db.flush()
        db.expire_all()

        # Reload trip to get freshly flushed activities
        trip = db.query(Itinerary).filter(Itinerary.id == proposal.trip_id).first()

        # Serialize authoritative resulting canonical state AFTER mutation
        resulting_days = serialize_trip_days(trip)

        # Create append-only revision containing RESULTING STATE
        snapshot, next_ver = create_revision(
            db=db,
            trip_id=trip.id,
            user_id=user.id,
            action_type="ATTACH_FLIGHT_OFFER" if is_flight else "AI_PROPOSAL_ACCEPTED",
            days_data=resulting_days,
            summary=proposal.summary,
            instruction=proposal.instruction,
            model="curated-flight-v1" if is_flight else "deterministic-planner-v1",
            actor_type="USER",
            parent_version=proposal.parent_version
        )

        latency_ms = int((time.time() - start_time) * 1000)

        # AI Observability records
        ai_run = AIRun(
            user_id=user.id,
            trip_id=trip.id,
            prompt=proposal.instruction,
            model="deterministic-planner-v1",
            latency_ms=latency_ms,
            tokens_used=0,
            status="success"
        )
        db.add(ai_run)
        db.flush()

        tool_call = AIToolCall(
            run_id=ai_run.id,
            tool_name="ai_proposal_accept",
            input_payload={"proposal_id": proposal.id, "parent_version": proposal.parent_version},
            output_payload={"new_version": next_ver, "changes_count": len(proposal.changes)},
            provenance="AI_GENERATED",
            latency_ms=latency_ms
        )
        db.add(tool_call)

        # Mark proposal accepted
        proposal.status = "accepted"

        # Commit all operations atomically
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to apply proposal: {str(exc)}"
        )

    # Reload updated trip
    db.refresh(trip)
    updated_days = serialize_trip_days(trip)

    return {
        "status": "success",
        "action": "proposal_accepted",
        "proposal_status": "accepted",
        "proposal_id": proposal.id,
        "trip_id": trip.id,
        "revision_version": next_ver,
        "summary": proposal.summary,
        "trip": {
            "id": trip.id,
            "title": trip.title,
            "destination": trip.destination,
            "startDate": str(trip.start_date),
            "endDate": str(trip.end_date),
            "budget": float(trip.total_budget),
            "days": updated_days
        }
    }


@router.post("/proposals/{proposal_id}/reject")
def reject_ai_proposal(
    proposal_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    P0 AI Proposal Rejection:
    Marks the proposal rejected and performs NO mutation to the Trip.
    """
    proposal = db.query(TripProposal).filter(TripProposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if proposal.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Proposal is already {proposal.status}"
        )

    trip = db.query(Itinerary).filter(Itinerary.id == proposal.trip_id).first()
    if trip:
        verify_trip_access(trip, user, db)

    proposal.status = "rejected"
    db.commit()

    return {
        "status": "success",
        "action": "proposal_rejected",
        "proposal_status": "rejected",
        "proposal_id": proposal.id,
        "trip_id": proposal.trip_id
    }


@router.post("/query")
def ai_query(
    request: AIQueryRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Compatibility wrapper around POST /api/v1/ai/proposals (Requirement 8).
    DOES NOT directly mutate the Trip.
    Returns a structured proposal requiring traveler approval before any mutation.
    """
    prop_req = AIProposalRequest(
        trip_id=request.trip_id,
        instruction=request.instruction
    )
    return create_ai_proposal(request=prop_req, user=user, db=db)
