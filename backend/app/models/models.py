import uuid
from sqlalchemy import Column, String, Boolean, Integer, Float, DateTime, ForeignKey, Text, JSON, Numeric, Date, ARRAY
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
    trust_score = Column(String(50), default="95% Verified Explorer")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    profile = relationship("UserProfile", back_populates="user", uselist=False)
    itineraries = relationship("Itinerary", back_populates="owner")
    bookings = relationship("Booking", back_populates="user", cascade="all, delete-orphan")
    squad_memberships = relationship("SquadMember", back_populates="user")
    expenses_paid = relationship("SquadExpense", back_populates="paid_by_user")

class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    home_city = Column(String(100), default="Bengaluru")
    preferred_currency = Column(String(10), default="INR")
    travel_vibes = Column(JSON, default=["Beach", "Mountains"])
    dietary_pref = Column(String(100), nullable=True)
    seat_pref = Column(String(50), default="Window")
    reward_coins = Column(Integer, default=250)

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
    status = Column(String(50), default="draft")  # draft, active, completed
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="itineraries")
    days = relationship("ItineraryDay", back_populates="itinerary", cascade="all, delete-orphan")
    squad_room = relationship("SquadRoom", back_populates="itinerary", uselist=False)

class ItineraryDay(Base):
    __tablename__ = "itinerary_days"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    itinerary_id = Column(String(36), ForeignKey("itineraries.id", ondelete="CASCADE"), nullable=False)
    day_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=True)
    cover_image_url = Column(Text, nullable=True)
    weather_summary = Column(String(100), nullable=True)

    itinerary = relationship("Itinerary", back_populates="days")
    activities = relationship("ItineraryActivity", back_populates="day", cascade="all, delete-orphan")

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
    provenance = Column(String(50), default="AI GENERATED")  # VERIFIED, AI GENERATED, USER GENERATED
    source_citation = Column(String(255), nullable=True)

    day = relationship("ItineraryDay", back_populates="activities")

# Flow 3: Squad Rooms, Voting & Fair Split Ledger
class SquadRoom(Base):
    __tablename__ = "squad_rooms"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    itinerary_id = Column(String(36), ForeignKey("itineraries.id", ondelete="CASCADE"), nullable=False)
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
    accuracy_percentage = Column(Integer, default=95)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

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
    status = Column(String(50), default="confirmed")  # confirmed, pending, cancelled
    pnr_ref = Column(String(50), unique=True, nullable=False)
    provenance = Column(String(50), default="PROVIDER_VERIFIED")  # Provider Inventory
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="bookings")
    trip = relationship("Itinerary", backref="bookings")

# AI Observability & Reproducibility Models (Section 8)
class AIRun(Base):
    __tablename__ = "ai_runs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    trip_id = Column(String(36), ForeignKey("itineraries.id", ondelete="SET NULL"), nullable=True)
    prompt = Column(Text, nullable=False)
    model = Column(String(100), default="gpt-4o-mini")
    latency_ms = Column(Integer, default=0)
    tokens_used = Column(Integer, default=0)
    status = Column(String(50), default="success")  # success, error
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tool_calls = relationship("AIToolCall", back_populates="run", cascade="all, delete-orphan")

class AIToolCall(Base):
    __tablename__ = "ai_tool_calls"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    run_id = Column(String(36), ForeignKey("ai_runs.id", ondelete="CASCADE"), nullable=False)
    tool_name = Column(String(100), nullable=False)  # flight_search, hotel_search, etc.
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
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

# Sanctuary & Exploration Models
class Sanctuary(Base):
    __tablename__ = "sanctuaries"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    location = Column(String(255), nullable=False)
    vibe = Column(String(50), nullable=False)  # beach, mountains, wellness, heritage
    duration = Column(String(50), nullable=False)
    price = Column(String(50), nullable=False)
    rating = Column(String(20), default="4.9 ★")
    reviews = Column(String(50), default="128 Verified")
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

class RewardVoucher(Base):
    __tablename__ = "reward_vouchers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    brand = Column(String(100), nullable=False)
    discount = Column(String(100), nullable=False)
    coin_cost = Column(Integer, nullable=False)
    category = Column(String(50), nullable=False)
    logo_url = Column(Text, nullable=True)
    code = Column(String(50), nullable=False)

