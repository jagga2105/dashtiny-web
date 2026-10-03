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

    user = relationship("User", back_populates="profile")


# Flow 2: DAIna AI Itineraries & Day Timelines
class Itinerary(Base):
    __tablename__ = "itineraries"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    destination = Column(String(255), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    total_budget = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(10), default="INR")
    persona = Column(String(50), default="solo")
    origin = Column(String(100), nullable=True)
    travellers = Column(Integer, default=2)
    vibe = Column(String(100), nullable=True)
    raw_prompt = Column(Text, nullable=True)
    status = Column(String(50), default="draft")  # draft, upcoming, active, completed, cancelled
    is_public = Column(Boolean, default=False)
    source_trip_id = Column(String(36), ForeignKey("itineraries.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("travellers >= 1", name="ck_itinerary_travellers"),
        CheckConstraint("total_budget >= 0", name="ck_itinerary_budget"),
        CheckConstraint("end_date >= start_date", name="ck_itinerary_dates"),
        CheckConstraint("status IN ('draft', 'upcoming', 'active', 'completed', 'cancelled')", name="ck_itinerary_status"),
        Index("ix_itineraries_owner_created", "owner_id", "created_at"),
        Index("ix_itineraries_owner_status_date", "owner_id", "status", "start_date"),
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


class SquadExpense(Base):
    __tablename__ = "squad_expenses"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    squad_id = Column(String(36), ForeignKey("squad_rooms.id", ondelete="CASCADE"), nullable=False)
    paid_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    description = Column(String(255), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    category = Column(String(50), nullable=False)  # flight, stay, food, activity, transit
    created_at = Column(DateTime(timezone=True), server_default=func.now())

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
    status = Column(String(50), default="confirmed")  # confirmed, pending, cancelled, saved_reference
    pnr_ref = Column(String(50), nullable=True)
    provenance = Column(String(50), default="PROVIDER_VERIFIED")  # Provider Inventory
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("provider", "pnr_ref", name="uq_provider_pnr_ref"),
        CheckConstraint("status IN ('confirmed', 'pending', 'cancelled', 'saved_reference')", name="ck_booking_status"),
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
    trust_score = Column(String(50), default="96% Verified")
    getaway_title = Column(String(255), nullable=False)
    location = Column(String(255), nullable=False)
    image_url = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    likes_count = Column(Integer, default=42)
    companions_needed = Column(Integer, default=2)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_community_posts_created", "created_at"),
        Index("ix_community_posts_source_trip", "source_trip_id"),
    )

    source_trip = relationship("Itinerary", foreign_keys=[source_trip_id])
    author = relationship("User", foreign_keys=[author_id])


class RewardVoucher(Base):
    __tablename__ = "reward_vouchers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    brand = Column(String(100), nullable=False)
    discount = Column(String(100), nullable=False)
    coin_cost = Column(Integer, nullable=False)
    category = Column(String(50), nullable=False)
    logo_url = Column(Text, nullable=True)
    code = Column(String(50), unique=True, nullable=False)


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
    action_type = Column(String(50), default="AI_QUERY", nullable=True)
    actor_type = Column(String(50), default="USER", nullable=True)
    instruction = Column(Text, nullable=True)
    model = Column(String(100), default="deterministic-planner-v1", nullable=True)
    summary = Column(String(255), nullable=True)
    days_data = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("trip_id", "version", name="uq_trip_snapshot_version"),
        Index("ix_trip_snapshots_trip_ver", "trip_id", "version"),
    )

    trip = relationship("Itinerary", back_populates="snapshots")
