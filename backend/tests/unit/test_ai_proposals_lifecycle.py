import pytest
from datetime import date
from starlette.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.models import Itinerary, ItineraryDay, ItineraryActivity, TripSnapshot, TripProposal, AIRun
from app.services.trip_revision_service import record_initial_revision


def test_ai_proposal_does_not_mutate_trip(client: TestClient, db_session: Session, test_user):
    """
    Item 8 & 23:
    POST /api/v1/ai/proposals:
    - Generates a structured proposal
    - Verifies Trip is NOT mutated
    - Proposal status is 'pending'
    """
    trip = Itinerary(
        title="Kyoto Zen Proposal Test",
        destination="Kyoto",
        owner_id=test_user.id,
        total_budget=50000.0,
        currency="INR",
        start_date=date(2026, 11, 10),
        end_date=date(2026, 11, 12)
    )
    db_session.add(trip)
    db_session.commit()

    day1 = ItineraryDay(itinerary_id=trip.id, day_number=1, title="Day 1")
    db_session.add(day1)
    db_session.commit()

    act1 = ItineraryActivity(
        day_id=day1.id,
        time_slot="09:00 AM",
        description="Original Activity: Bamboo Forest Walk",
        location="Arashiyama",
        place_type="TA",
        cost_estimate=200.0,
        sort_order=0
    )
    db_session.add(act1)
    db_session.commit()

    # Record baseline initial revision v1 upon trip creation
    record_initial_revision(db_session, trip.id, test_user.id)
    db_session.commit()

    # Request proposal
    res = client.post("/api/v1/ai/proposals", json={
        "trip_id": trip.id,
        "instruction": "I have 2 hours free, add a nearby walk"
    })
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["trip_id"] == trip.id
    assert "proposal_id" in data
    assert "summary" in data
    assert len(data["changes"]) > 0
    assert "before" in data
    assert "after" in data
    assert "verification" in data
    assert "provenance" in data

    # CRITICAL: Verify Trip in database was NOT mutated
    db_session.expire_all()
    current_acts = db_session.query(ItineraryActivity).filter(ItineraryActivity.day_id == day1.id).all()
    assert len(current_acts) == 1
    assert current_acts[0].description == "Original Activity: Bamboo Forest Walk"

    # Verify no AI proposal snapshot was created yet
    snapshots = db_session.query(TripSnapshot).filter(TripSnapshot.trip_id == trip.id).all()
    assert not any(s.action_type == "AI_PROPOSAL_ACCEPTED" for s in snapshots)

    # Verify proposal record exists in DB
    proposal = db_session.query(TripProposal).filter(TripProposal.id == data["proposal_id"]).first()
    assert proposal is not None
    assert proposal.status == "pending"


def test_ai_proposal_accept_mutates_trip_creates_revision(client: TestClient, db_session: Session, test_user):
    """
    Item 8 & 23:
    POST /api/v1/ai/proposals/{proposal_id}/accept:
    - Verifies proposal still matches parent version
    - Mutates trip activities safely
    - Creates append-only TripRevision
    - Marks proposal 'accepted'
    - Records AI telemetry
    """
    trip = Itinerary(
        title="Tokyo Proposal Commit Test",
        destination="Tokyo",
        owner_id=test_user.id,
        total_budget=80000.0,
        currency="INR",
        start_date=date(2026, 12, 1),
        end_date=date(2026, 12, 3)
    )
    db_session.add(trip)
    db_session.commit()

    day1 = ItineraryDay(itinerary_id=trip.id, day_number=1, title="Day 1")
    db_session.add(day1)
    db_session.commit()

    act1 = ItineraryActivity(
        day_id=day1.id,
        time_slot="10:00 AM",
        description="Visit Senso-ji Temple",
        location="Asakusa",
        place_type="TA",
        cost_estimate=0.0,
        sort_order=0
    )
    db_session.add(act1)
    db_session.commit()

    # Record baseline initial revision v1 upon trip creation
    record_initial_revision(db_session, trip.id, test_user.id)
    db_session.commit()

    # Generate proposal
    prop_res = client.post("/api/v1/ai/proposals", json={
        "trip_id": trip.id,
        "instruction": "I have 2 hours free in the afternoon, add a nearby walk"
    })
    assert prop_res.status_code == 200
    prop_id = prop_res.json()["proposal_id"]

    # Now ACCEPT proposal
    accept_res = client.post(f"/api/v1/ai/proposals/{prop_id}/accept")
    assert accept_res.status_code == 200, accept_res.text
    acc_data = accept_res.json()
    assert acc_data["status"] == "success"
    assert acc_data["proposal_status"] == "accepted"
    assert acc_data["revision_version"] == 2

    # Verify database was mutated
    db_session.expire_all()
    acts_after = db_session.query(ItineraryActivity).filter(ItineraryActivity.day_id == day1.id).all()
    assert len(acts_after) >= 2
    assert any("Heritage Photography Walk" in a.description for a in acts_after)

    # Verify append-only revision in TripSnapshot
    snapshot = db_session.query(TripSnapshot).filter(
        TripSnapshot.trip_id == trip.id,
        TripSnapshot.version == 2
    ).first()
    assert snapshot is not None
    assert snapshot.action_type == "AI_PROPOSAL_ACCEPTED"

    # Verify AI run telemetry
    ai_run = db_session.query(AIRun).filter(AIRun.trip_id == trip.id).first()
    assert ai_run is not None
    assert ai_run.status == "success"

    # Cannot accept twice
    res_again = client.post(f"/api/v1/ai/proposals/{prop_id}/accept")
    assert res_again.status_code == 400


def test_ai_proposal_reject_leaves_trip_unchanged(client: TestClient, db_session: Session, test_user):
    """
    Item 8 & 23:
    POST /api/v1/ai/proposals/{proposal_id}/reject:
    - Marks proposal rejected
    - Leaves Trip completely untouched
    - No revisions created
    """
    trip = Itinerary(
        title="Kyoto Reject Proposal Test",
        destination="Kyoto",
        owner_id=test_user.id,
        total_budget=50000.0,
        currency="INR",
        start_date=date(2026, 11, 10),
        end_date=date(2026, 11, 12)
    )
    db_session.add(trip)
    db_session.commit()

    day1 = ItineraryDay(itinerary_id=trip.id, day_number=1, title="Day 1")
    db_session.add(day1)
    db_session.commit()

    act1 = ItineraryActivity(
        day_id=day1.id,
        time_slot="09:00 AM",
        description="Untouched Morning Walk",
        location="Maruyama Park",
        place_type="TA",
        cost_estimate=0.0,
        sort_order=0
    )
    db_session.add(act1)
    db_session.commit()

    # Record baseline initial revision v1 upon trip creation
    record_initial_revision(db_session, trip.id, test_user.id)
    db_session.commit()

    # Generate proposal
    prop_res = client.post("/api/v1/ai/proposals", json={
        "trip_id": trip.id,
        "instruction": "Add heavy nightlife bar crawl"
    })
    assert prop_res.status_code == 200
    prop_id = prop_res.json()["proposal_id"]

    # Reject proposal
    rej_res = client.post(f"/api/v1/ai/proposals/{prop_id}/reject")
    assert rej_res.status_code == 200
    assert rej_res.json()["status"] == "success"
    assert rej_res.json()["proposal_status"] == "rejected"

    # Verify proposal status in DB
    prop = db_session.query(TripProposal).filter(TripProposal.id == prop_id).first()
    assert prop.status == "rejected"

    # Trip state is 100% unchanged
    db_session.expire_all()
    acts = db_session.query(ItineraryActivity).filter(ItineraryActivity.day_id == day1.id).all()
    assert len(acts) == 1
    assert acts[0].description == "Untouched Morning Walk"

    # Cannot accept after rejection
    acc_res = client.post(f"/api/v1/ai/proposals/{prop_id}/accept")
    assert acc_res.status_code == 400


def test_ai_proposal_stale_parent_conflict(client: TestClient, db_session: Session, test_user):
    """
    Item 8 & 23:
    If trip revision advanced between proposal generation and acceptance:
    Returns 409 Conflict.
    """
    trip = Itinerary(
        title="Conflict Test Trip",
        destination="Goa",
        owner_id=test_user.id,
        total_budget=40000.0,
        currency="INR",
        start_date=date(2026, 12, 10),
        end_date=date(2026, 12, 13)
    )
    db_session.add(trip)
    db_session.commit()

    day1 = ItineraryDay(itinerary_id=trip.id, day_number=1, title="Day 1")
    db_session.add(day1)
    db_session.commit()

    act1 = ItineraryActivity(
        day_id=day1.id,
        time_slot="10:00 AM",
        description="Beach Relax",
        location="Anjuna",
        place_type="TA",
        cost_estimate=0.0,
        sort_order=0
    )
    db_session.add(act1)
    db_session.commit()

    # Record baseline initial revision v1 upon trip creation
    record_initial_revision(db_session, trip.id, test_user.id)
    db_session.commit()

    # Generate proposal 1
    prop1 = client.post("/api/v1/ai/proposals", json={
        "trip_id": trip.id,
        "instruction": "Add sunset cocktail"
    }).json()

    # Generate proposal 2
    prop2 = client.post("/api/v1/ai/proposals", json={
        "trip_id": trip.id,
        "instruction": "Add yoga session"
    }).json()

    # Accept proposal 1 -> advances revision to v1
    acc1 = client.post(f"/api/v1/ai/proposals/{prop1['proposal_id']}/accept")
    assert acc1.status_code == 200

    # Accept proposal 2 -> parent_version was 0, but current is now 1 -> must 409 Conflict
    acc2 = client.post(f"/api/v1/ai/proposals/{prop2['proposal_id']}/accept")
    assert acc2.status_code == 409
    assert "modified" in acc2.json()["detail"].lower()
