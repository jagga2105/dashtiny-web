import uuid
from sqlalchemy import (
    Column, String, Boolean, Integer, Float, DateTime, ForeignKey, 
    Text, JSON, Numeric, Date, ARRAY, UniqueConstraint, CheckConstraint, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

def generate_uuid():
    return str(uuid.uuid4())

# Flow 1: Users & Auth
class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    google_id = Column(String(255), unique=True, nullable=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=False)
    account_type = Column(String(50), default="personal_traveler")
    avatar_url = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    is_verified = Column(Boolean, default=False)
    trust_score = Column(Float, default=95.0)  # Numeric trust score (0-100)
    trip_completion_count = Column(Integer, default=0)
    verified_booking_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("trust_score >= 0.0 AND trust_score <= 100.0", name="ck_user_trust_score"),
        CheckConstraint("trip_completion_count >= 0", name="ck_user_trip_completion_count"),
        CheckConstraint("verified_booking_count >= 0", name="ck_user_verified_booking_count"),
    )

    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    itineraries = relationship("Itinerary", back_populates="owner")
    bookings = relationship("Booking", back_populates="user", cascade="all, delete-orphan")
    squad_memberships = relationship("SquadMember", back_populates="user")
    expenses_paid = relationship("SquadExpense", back_populates="paid_by_user")
    reward_transactions = relationship("RewardTransaction", back_populates="user", cascade="all, delete-orphan")
    reward_redemptions = relationship("RewardRedemption", back_populates="user", cascade="all, delete-orphan")

    @property
    def trust_score_display(self) -> str:
        prefix = f"{int(self.trust_score)}%" if self.trust_score is not None else "95%"
        return f"{prefix} Verified Explorer" if self.is_verified else f"{prefix} Explorer"


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    home_city = Column(String(100), default="Bengaluru")
    preferred_currency = Column(String(10), default="INR")
    travel_vibes = Column(JSON, default=["Beach", "Mountains"])
    dietary_pref = Column(String(100), nullable=True)
    seat_pref = Column(String(50), default="Window")
    reward_coins = Column(Integer, default=0)

    # Phase 1: Explicit Traveler Preferences & Personalization
    bio = Column(Text, nullable=True)
    travel_style = Column(String(50), default="solo")  # solo, couple, family, squad, nomad, luxury, backpacker
    pace = Column(String(50), default="balanced")  # relaxed, balanced, packed
    interests = Column(JSON, default=list)  # ["photography", "beaches", "nightlife", "history"]
    likes = Column(JSON, default=list)  # ["seafood", "sunset", "walking_tours", "cliffside_views"]
    dislikes = Column(JSON, default=list)  # ["religious", "pilgrimage", "crowds", "long_walks"]
    food_preferences = Column(JSON, default=list)  # ["local_eats", "seafood", "vegetarian", "street_food"]
    activity_preferences = Column(JSON, default=list)  # ["sightseeing", "wellness", "adventure", "museums"]
    accommodation_preference = Column(String(50), default="comfort")  # hostel, budget, comfort, boutique, luxury, resort
    transport_preference = Column(String(50), default="mix")  # walking, public_transit, cab, rental_car, mix
    budget_tier = Column(String(50), default="moderate")  # budget, moderate, premium, luxury
    budget_range = Column(JSON, default=dict)  # {"min": 20000, "max": 60000, "currency": "INR"}
    social_preferences = Column(JSON, default=dict)  # {"open_to_meetups": true, "squad_size_pref": "small"}

    __table_args__ = (
        CheckConstraint("reward_coins >= 0", name="ck_user_profile_reward_coins"),
    )

    user = relationship("User", back_populates="profile")


# Flow 2: DAIna AI Itineraries & Day Timelines
class Itinerary(Base):
    __tablename__ = "itineraries"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    destination = Column(String(255), nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    total_budget = Column(Numeric(12, 2), nullable=True, default=0.0)
    currency = Column(String(10), default="INR")
    persona = Column(String(50), default="solo")
    origin = Column(String(100), nullable=True)
    travellers = Column(Integer, nullable=True, default=2)
    vibe = Column(String(100), nullable=True)
    raw_prompt = Column(Text, nullable=True)
    status = Column(String(50), default="draft")  # draft, upcoming, active, completed, cancelled
    is_public = Column(Boolean, default=False)
    visibility = Column(String(20), default="PRIVATE", nullable=False)  # PUBLIC, FRIENDS_ONLY, PRIVATE
    source_trip_id = Column(String(36), ForeignKey("itineraries.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("travellers IS NULL OR travellers >= 1", name="ck_itinerary_travellers"),
        CheckConstraint("total_budget IS NULL OR total_budget >= 0", name="ck_itinerary_budget"),
        CheckConstraint("start_date IS NULL OR end_date IS NULL OR end_date >= start_date", name="ck_itinerary_dates"),
        CheckConstraint("status IN ('draft', 'upcoming', 'active', 'completed', 'cancelled')", name="ck_itinerary_status"),
        CheckConstraint("visibility IN ('PUBLIC', 'FRIENDS_ONLY', 'PRIVATE')", name="ck_itinerary_visibility"),
        Index("ix_itineraries_owner_created", "owner_id", "created_at"),
        Index("ix_itineraries_owner_status_date", "owner_id", "status", "start_date"),
        Index("ix_itineraries_visibility", "visibility"),
    )

    owner = relationship("User", back_populates="itineraries")
    days = relationship("ItineraryDay", back_populates="itinerary", cascade="all, delete-orphan", order_by="ItineraryDay.day_number")
    squad_room = relationship("SquadRoom", back_populates="itinerary", uselist=False, cascade="all, delete-orphan")
    snapshots = relationship("TripSnapshot", back_populates="trip", cascade="all, delete-orphan", order_by="TripSnapshot.version.desc()")


class ItineraryDay(Base):
    __tablename__ = "itinerary_days"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    itinerary_id = Column(String(36), ForeignKey("itineraries.id", ondelete="CASCADE"), nullable=False)
    day_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=True)
    cover_image_url = Column(Text, nullable=True)
    weather_summary = Column(String(100), nullable=True)

    __table_args__ = (
        CheckConstraint("day_number >= 1", name="ck_day_number"),
        UniqueConstraint("itinerary_id", "day_number", name="uq_itinerary_day_number"),
        Index("ix_itinerary_days_itinerary_day", "itinerary_id", "day_number"),
    )

    itinerary = relationship("Itinerary", back_populates="days")
    activities = relationship("ItineraryActivity", back_populates="day", cascade="all, delete-orphan", order_by="ItineraryActivity.sort_order")


class ItineraryActivity(Base):
    __tablename__ = "itinerary_activities"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    day_id = Column(String(36), ForeignKey("itinerary_days.id", ondelete="CASCADE"), nullable=False)
    time_slot = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    location = Column(String(255), nullable=True)
    place_type = Column(String(20), nullable=True)  # H, R, TA
    estimated_transit = Column(String(255), nullable=True)
    crowd_warning = Column(String(255), nullable=True)
    cost_estimate = Column(Numeric(10, 2), nullable=True)
    sort_order = Column(Integer, default=0)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    provenance = Column(String(50), default="DETERMINISTIC")
    generation_source = Column(String(50), default="DETERMINISTIC", nullable=True)
    location_source = Column(String(50), default="UNRESOLVED", nullable=True)
    content_source = Column(String(50), default="CURATED", nullable=True)
    source_citation = Column(String(255), nullable=True)
    why_recommended = Column(Text, nullable=True)

    # Structured temporal and transit model
    start_at = Column(DateTime(timezone=True), nullable=True)
    end_at = Column(DateTime(timezone=True), nullable=True)
    timezone = Column(String(50), nullable=True, default=None)
    duration_minutes = Column(Integer, default=60, nullable=True)
    transit_minutes = Column(Integer, default=0, nullable=True)
    transit_mode = Column(String(50), default="WALK", nullable=True)
    transit_source = Column(String(50), default="ESTIMATED", nullable=True)
    transit_confidence = Column(String(50), default="ESTIMATED", nullable=True)

    __table_args__ = (
        CheckConstraint("cost_estimate >= 0", name="ck_activity_cost"),
        CheckConstraint("sort_order >= 0", name="ck_activity_sort_order"),
        CheckConstraint("duration_minutes >= 0", name="ck_activity_duration"),
        CheckConstraint("transit_minutes >= 0", name="ck_activity_transit"),
        Index("ix_activity_day_sort", "day_id", "sort_order"),
    )

    day = relationship("ItineraryDay", back_populates="activities")


# Flow 3: Squad Rooms, Voting & Fair Split Ledger
class SquadRoom(Base):
    __tablename__ = "squad_rooms"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    itinerary_id = Column(String(36), ForeignKey("itineraries.id", ondelete="CASCADE"), nullable=False, unique=True)
    room_code = Column(String(20), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    itinerary = relationship("Itinerary", back_populates="squad_room")
    members = relationship("SquadMember", back_populates="squad", cascade="all, delete-orphan")
    expenses = relationship("SquadExpense", back_populates="squad", cascade="all, delete-orphan")


class SquadMember(Base):
    __tablename__ = "squad_members"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    squad_id = Column(String(36), ForeignKey("squad_rooms.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), default="member")  # owner, member
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("squad_id", "user_id", name="uq_squad_member"),
    )

    squad = relationship("SquadRoom", back_populates="members")
    user = relationship("User", back_populates="squad_memberships")


class Friendship(Base):
    __tablename__ = "friendships"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    friend_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="accepted", nullable=False)  # pending, accepted, rejected, blocked
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "friend_id", name="uq_friendship_pair"),
        CheckConstraint("status IN ('pending', 'accepted', 'rejected', 'blocked')", name="ck_friendship_status"),
        Index("ix_friendships_user_status", "user_id", "status"),
        Index("ix_friendships_friend_status", "friend_id", "status"),
    )

    user = relationship("User", foreign_keys=[user_id], backref="friendships_initiated")
    friend = relationship("User", foreign_keys=[friend_id], backref="friendships_received")


class TripInterestRequest(Base):
    __tablename__ = "trip_interest_requests"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    trip_id = Column(String(36), ForeignKey("itineraries.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message = Column(Text, nullable=True)
    status = Column(String(20), default="pending", nullable=False)  # pending, approved, rejected, withdrawn
    compatibility_score = Column(Integer, nullable=True)
    compatibility_breakdown = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("trip_id", "user_id", name="uq_trip_interest_request"),
        CheckConstraint("status IN ('pending', 'approved', 'rejected', 'withdrawn')", name="ck_trip_interest_status"),
        Index("ix_trip_interest_trip_status", "trip_id", "status"),
        Index("ix_trip_interest_user_status", "user_id", "status"),
    )

    trip = relationship("Itinerary", backref="interest_requests")
    user = relationship("User", backref="trip_interest_requests")


class SquadExpense(Base):
    __tablename__ = "squad_expenses"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    squad_id = Column(String(36), ForeignKey("squad_rooms.id", ondelete="CASCADE"), nullable=False)
    paid_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    description = Column(String(255), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    category = Column(String(50), nullable=False)  # flight, stay, food, activity, transit
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_squad_expense_amount"),
    )

    squad = relationship("SquadRoom", back_populates="expenses")
    paid_by_user = relationship("User", back_populates="expenses_paid")


# Flow 4: Booking Aggregation Cache & Price Intelligence Alerts
class BookingCache(Base):
    __tablename__ = "booking_aggregation_cache"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    search_hash = Column(String(255), unique=True, nullable=False)
    destination = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False)
    provider_rates = Column(JSON, nullable=False)
    cached_until = Column(DateTime(timezone=True), nullable=False)


class PriceAlert(Base):
    __tablename__ = "price_alerts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    origin = Column(String(100), nullable=False)
    destination = Column(String(100), nullable=False)
    target_price = Column(Numeric(10, 2), nullable=False)
    current_lowest_price = Column(Numeric(10, 2), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("target_price >= 0", name="ck_price_alert_target_price"),
        CheckConstraint("current_lowest_price >= 0", name="ck_price_alert_current_price"),
        Index("ix_price_alerts_user_active", "user_id", "is_active"),
    )


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    trip_id = Column(String(36), ForeignKey("itineraries.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category = Column(String(50), nullable=False)  # flight, hotel, train, bus, cab
    provider = Column(String(100), nullable=False)  # IndiGo, Taj Hotels, Airbnb, etc.
    title = Column(String(255), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(10), default="INR")
    status = Column(String(50), default="pending")  # draft, saved_reference, pending, confirmed, cancelled
    pnr_ref = Column(String(50), nullable=True)
    provenance = Column(String(50), default="USER_PROVIDED")  # USER_PROVIDED, CURATED, PARTNER_VERIFIED
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("provider", "pnr_ref", name="uq_provider_pnr_ref"),
        CheckConstraint("amount >= 0", name="ck_booking_amount"),
        CheckConstraint("status IN ('draft', 'saved_reference', 'pending', 'confirmed', 'cancelled', 'DRAFT', 'SAVED_REFERENCE', 'PENDING', 'CONFIRMED', 'CANCELLED')", name="ck_booking_status"),
        CheckConstraint("provenance IN ('USER_PROVIDED', 'SAVED_REFERENCE', 'CURATED', 'PARTNER_VERIFIED', 'PROVIDER_VERIFIED')", name="ck_booking_provenance"),
        Index("ix_bookings_user_created", "user_id", "created_at"),
        Index("ix_bookings_trip_created", "trip_id", "created_at"),
    )

    user = relationship("User", back_populates="bookings")
    trip = relationship("Itinerary", backref="bookings")


# AI Observability & Reproducibility Models (Section 8)
class AIRun(Base):
    __tablename__ = "ai_runs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    trip_id = Column(String(36), ForeignKey("itineraries.id", ondelete="SET NULL"), nullable=True)
    prompt = Column(Text, nullable=False)
    model = Column(String(100), default="deterministic-planner-v1")
    latency_ms = Column(Integer, default=0)
    tokens_used = Column(Integer, default=0, nullable=True)
    status = Column(String(50), default="success")  # success, failed, fallback, timeout
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("status IN ('success', 'failed', 'fallback', 'timeout')", name="ck_airun_status"),
        CheckConstraint("latency_ms >= 0", name="ck_airun_latency"),
        CheckConstraint("tokens_used >= 0", name="ck_airun_tokens"),
        Index("ix_ai_runs_trip_created", "trip_id", "created_at"),
    )

    tool_calls = relationship("AIToolCall", back_populates="run", cascade="all, delete-orphan")


class AIToolCall(Base):
    __tablename__ = "ai_tool_calls"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    run_id = Column(String(36), ForeignKey("ai_runs.id", ondelete="CASCADE"), nullable=False)
    tool_name = Column(String(100), nullable=False)
    input_payload = Column(JSON, nullable=True)
    output_payload = Column(JSON, nullable=True)
    provenance = Column(String(50), default="CURATED")
    latency_ms = Column(Integer, default=0)
    error = Column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint("latency_ms >= 0", name="ck_aitoolcall_latency"),
    )

    run = relationship("AIRun", back_populates="tool_calls")


# Structured Traveler Memory (Section 10)
class TravelerMemory(Base):
    __tablename__ = "traveler_memories"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category = Column(String(50), nullable=False)  # explicit, behavioral, trip_history, derived
    key = Column(String(100), nullable=False)  # budget_sensitivity, preferred_airlines, etc.
    value = Column(JSON, nullable=False)
    confidence = Column(Float, default=1.0)
    source = Column(String(50), default="EXPLICIT", nullable=False)  # EXPLICIT, TRIP_HISTORY, BEHAVIORAL
    source_reference = Column(String(255), nullable=True)
    is_explicit = Column(Boolean, default=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "category", "key", name="uq_user_memory_key"),
        CheckConstraint("confidence >= 0.0 AND confidence <= 1.0", name="ck_memory_confidence"),
        Index("ix_traveler_memories_user_cat_key", "user_id", "category", "key"),
    )


# Sanctuary & Exploration Models
class Sanctuary(Base):
    __tablename__ = "sanctuaries"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    location = Column(String(255), nullable=False)
    vibe = Column(String(50), nullable=False)
    duration = Column(String(50), nullable=False)
    price = Column(String(50), nullable=False)
    price_amount = Column(Numeric(10, 2), default=42000.0)
    price_currency = Column(String(10), default="INR")
    price_unit = Column(String(50), default="traveler")
    duration_days = Column(Integer, default=5)
    duration_nights = Column(Integer, default=4)
    rating = Column(String(20), default="4.9 ★")
    rating_value = Column(Float, default=4.9)
    reviews = Column(String(50), default="128 Verified")
    review_count = Column(Integer, default=128)
    rating_source = Column(String(50), default="Verified")
    image = Column(Text, nullable=False)
    tag = Column(String(100), nullable=False)
    highlights = Column(JSON, nullable=False)
    insider_tips = Column(JSON, nullable=True)

    __table_args__ = (
        CheckConstraint("price_amount >= 0", name="ck_sanctuary_price_amount"),
        CheckConstraint("duration_days >= 0", name="ck_sanctuary_duration_days"),
        CheckConstraint("duration_nights >= 0", name="ck_sanctuary_duration_nights"),
        CheckConstraint("rating_value >= 0.0 AND rating_value <= 5.0", name="ck_sanctuary_rating_value"),
        CheckConstraint("review_count >= 0", name="ck_sanctuary_review_count"),
    )


class DriveEscape(Base):
    __tablename__ = "drive_escapes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    dist_time = Column(String(100), nullable=False)
    stay_suggestion = Column(String(255), nullable=False)
    vibe_tag = Column(String(50), nullable=False)
    image = Column(Text, nullable=False)
    curated_by = Column(String(100), default="DAIna AI")


class CommunityPost(Base):
    __tablename__ = "community_posts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    author_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    source_trip_id = Column(String(36), ForeignKey("itineraries.id", ondelete="SET NULL"), nullable=True)
    author_name = Column(String(100), nullable=False)
    author_avatar = Column(Text, nullable=False)
    getaway_title = Column(String(255), nullable=False)
    location = Column(String(255), nullable=False)
    image_url = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    likes_count = Column(Integer, default=42)
    companions_needed = Column(Integer, default=2)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("likes_count >= 0", name="ck_community_post_likes"),
        CheckConstraint("companions_needed >= 0", name="ck_community_post_companions"),
        Index("ix_community_posts_created", "created_at"),
        Index("ix_community_posts_source_trip", "source_trip_id"),
    )

    source_trip = relationship("Itinerary", foreign_keys=[source_trip_id])
    author = relationship("User", foreign_keys=[author_id])

    @property
    def trust_score(self) -> str:
        """Derive author trust display dynamically from the author User record."""
        if self.author:
            return self.author.trust_score_display
        return "Community Explorer"

    @trust_score.setter
    def trust_score(self, value):
        # Deprecated: Do not store duplicate formatted trust strings on post
        pass


class RewardVoucher(Base):
    __tablename__ = "reward_vouchers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    brand = Column(String(100), nullable=False)
    discount = Column(String(100), nullable=False)
    coin_cost = Column(Integer, nullable=False)
    category = Column(String(50), nullable=False)
    logo_url = Column(Text, nullable=True)
    code = Column(String(50), nullable=False)

    __table_args__ = (
        UniqueConstraint("code", name="uq_reward_voucher_code"),
        CheckConstraint("coin_cost >= 0", name="ck_voucher_coin_cost"),
    )


class RewardTransaction(Base):
    __tablename__ = "reward_transactions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    delta = Column(Integer, nullable=False)  # +50, -150
    balance_after = Column(Integer, nullable=False)
    type = Column(String(50), nullable=False)  # BOOKING_SAVED, VOUCHER_REDEEMED, TRIP_SHARED, ONBOARDING
    reason = Column(String(255), nullable=False)
    reference_type = Column(String(50), nullable=True)  # booking, voucher, community_post
    reference_id = Column(String(100), nullable=True)
    idempotency_key = Column(String(120), unique=True, index=True, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("balance_after >= 0", name="ck_reward_tx_balance_after"),
        Index("ix_reward_tx_user_created", "user_id", "created_at"),
    )

    user = relationship("User", back_populates="reward_transactions")


class RewardRedemption(Base):
    __tablename__ = "reward_redemptions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    voucher_id = Column(String(36), ForeignKey("reward_vouchers.id", ondelete="CASCADE"), nullable=False)
    coins_spent = Column(Integer, nullable=False)
    voucher_code = Column(String(50), nullable=False)
    status = Column(String(50), default="active")  # active, used, expired
    redeemed_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "voucher_id", name="uq_user_voucher_redemption"),
        CheckConstraint("coins_spent >= 0", name="ck_reward_redemption_coins_spent"),
        Index("ix_reward_redemptions_user", "user_id", "redeemed_at"),
    )

    user = relationship("User", back_populates="reward_redemptions")
    voucher = relationship("RewardVoucher")


class PostLike(Base):
    __tablename__ = "post_likes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    post_id = Column(String(36), ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_post_user_like"),)


class TripSnapshot(Base):
    __tablename__ = "trip_snapshots"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    trip_id = Column(String(36), ForeignKey("itineraries.id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(50), default="ai_query", nullable=False)
    action_type = Column(String(100), default="AI_MODIFY_ITINERARY", nullable=False)
    actor_type = Column(String(50), default="USER", nullable=False)
    instruction = Column(Text, nullable=True)
    model = Column(String(100), default="deterministic-planner-v1", nullable=True)
    summary = Column(String(255), nullable=True)
    days_data = Column(JSON, nullable=False)
    parent_version = Column(Integer, nullable=True)
    restored_from_version = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("trip_id", "version", name="uq_trip_snapshot_version"),
        CheckConstraint("version >= 1", name="ck_snapshot_version"),
        Index("ix_trip_snapshots_trip_ver", "trip_id", "version"),
        Index("ix_trip_snapshots_trip_created", "trip_id", "created_at"),
    )

    trip = relationship("Itinerary", back_populates="snapshots")


class TripProposal(Base):
    __tablename__ = "trip_proposals"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    trip_id = Column(String(36), ForeignKey("itineraries.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    parent_version = Column(Integer, nullable=True)
    instruction = Column(Text, nullable=True)
    summary = Column(String(255), nullable=True)
    changes = Column(JSON, nullable=True, default=list)
    before_state = Column(JSON, nullable=True, default=dict)
    after_state = Column(JSON, nullable=True, default=dict)
    verification = Column(JSON, nullable=True, default=dict)
    provenance = Column(JSON, nullable=True, default=dict)
    request = Column(JSON, nullable=True, default=dict)
    structured_intent = Column(JSON, nullable=True, default=dict)
    proposal_data = Column(JSON, nullable=True, default=dict)
    status = Column(String(50), default="pending", nullable=False)  # pending, accepted, rejected, expired
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("status IN ('pending', 'accepted', 'rejected', 'expired')", name="ck_trip_proposal_status"),
        CheckConstraint("parent_version IS NULL OR parent_version >= 1", name="ck_proposal_parent_version"),
        Index("ix_trip_proposals_trip_status", "trip_id", "status"),
        Index("ix_trip_proposals_trip_created", "trip_id", "created_at"),
        Index("ix_trip_proposals_user_created", "user_id", "created_at"),
        Index("ix_trip_proposals_status", "status"),
    )

    trip = relationship("Itinerary", backref="proposals")
    user = relationship("User")


class Airport(Base):
    __tablename__ = "airports"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    iata_code = Column(String(3), unique=True, index=True, nullable=False)
    icao_code = Column(String(4), index=True, nullable=True)
    name = Column(String(200), nullable=False)
    city = Column(String(100), index=True, nullable=False)
    state_region = Column(String(100), nullable=True)
    country = Column(String(100), nullable=False, default="India")
    country_code = Column(String(2), nullable=True, default="IN")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    timezone = Column(String(50), nullable=True)
    search_text = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    provenance = Column(String(50), default="REFERENCE_DATASET", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    __table_args__ = (
        Index("ix_airports_search_text", "search_text"),
        Index("ix_airports_city_iata", "city", "iata_code"),
        Index("ix_airports_country", "country"),
        Index("ix_airports_active", "is_active"),
    )


class SquadSuggestion(Base):
    __tablename__ = "squad_suggestions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    squad_id = Column(String(36), ForeignKey("squad_rooms.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    instruction = Column(Text, nullable=False)
    status = Column(String(50), default="open", nullable=False)  # open, proposal_generated, accepted, rejected, withdrawn
    proposal_id = Column(String(36), ForeignKey("trip_proposals.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("status IN ('open', 'proposal_generated', 'accepted', 'rejected', 'withdrawn')", name="ck_squad_suggestion_status"),
        Index("ix_squad_suggestions_squad_status", "squad_id", "status"),
        Index("ix_squad_suggestions_user_created", "user_id", "created_at"),
    )

    squad = relationship("SquadRoom", backref="suggestions")
    user = relationship("User")
    proposal = relationship("TripProposal")
    votes = relationship("SquadVote", back_populates="suggestion", cascade="all, delete-orphan")


class SquadVote(Base):
    __tablename__ = "squad_votes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    squad_id = Column(String(36), ForeignKey("squad_rooms.id", ondelete="CASCADE"), nullable=False)
    suggestion_id = Column(String(36), ForeignKey("squad_suggestions.id", ondelete="CASCADE"), nullable=True)
    proposal_id = Column(String(36), ForeignKey("trip_proposals.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    vote = Column(String(10), nullable=False)  # up, down
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("vote IN ('up', 'down')", name="ck_squad_vote_type"),
        Index("ix_squad_votes_suggestion", "suggestion_id", "user_id"),
        Index("ix_squad_votes_proposal", "proposal_id", "user_id"),
    )

    suggestion = relationship("SquadSuggestion", back_populates="votes")
    proposal = relationship("TripProposal")
    user = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), nullable=False)  # INTEREST_RECEIVED, INTEREST_APPROVED, INTEREST_REJECTED, FRIEND_REQUEST, FRIEND_ACCEPTED, SQUAD_INVITATION, SQUAD_SUGGESTION_CREATED, SQUAD_VOTE_STARTED, ITINERARY_REVISED
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    payload = Column(JSON, nullable=True, default=dict)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_notifications_user_read", "user_id", "is_read"),
        Index("ix_notifications_user_created", "user_id", "created_at"),
    )

    user = relationship("User", backref="notifications")




