import os
from alembic.config import Config
from alembic import command
from app.db.database import SessionLocal
from app.models.models import Sanctuary, DriveEscape, CommunityPost, RewardVoucher, User, UserProfile, PriceAlert

def ensure_migrations():
    """Ensure all Alembic database migrations are applied before seeding."""
    ini_path = os.path.join(os.path.dirname(__file__), "alembic.ini")
    script_path = os.path.join(os.path.dirname(__file__), "alembic")
    alembic_cfg = Config(ini_path)
    alembic_cfg.set_main_option("script_location", script_path)
    command.upgrade(alembic_cfg, "head")

def seed():
    ensure_migrations()
    db = SessionLocal()

    try:
        # Seed User
        if not db.query(User).filter_by(email="kumkum@dashtiny.ai").first():
            user = User(
                id="usr_dash_01",
                full_name="Kumkum Pandey",
                email="kumkum@dashtiny.ai",
                phone="+91 98765 43210",
                is_verified=True,
                trust_score=98.0,
                avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
            )
            db.add(user)
            db.flush()

            profile = UserProfile(
                user_id=user.id,
                home_city="Bengaluru",
                reward_coins=500,
                travel_vibes=["Beach", "Mountains", "Wellness"]
            )
            db.add(profile)
            db.commit()

        # Seed Sanctuaries with structured canonical metadata
        if db.query(Sanctuary).count() == 0:
            sanc1 = Sanctuary(
                id="sanc_01",
                title="Private Cliffside Villa & Sunset Infinity Pool",
                location="North Goa, India",
                vibe="beach",
                duration="3 Days • 2 Nights",
                price="₹14,500 / squad",
                price_amount=14500.0,
                price_currency="INR",
                price_unit="squad",
                duration_days=3,
                duration_nights=2,
                rating="4.95 ★",
                rating_value=4.95,
                reviews="142 Verified",
                review_count=142,
                rating_source="CURATED",
                image="https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80",
                tag="🔥 Top Sunset Vibe",
                highlights=["Private Pool Access", "Floating Breakfast", "Scooter Included"],
                insider_tips=["Best golden hour view from northern deck at 5:45 PM"]
            )
            sanc2 = Sanctuary(
                id="sanc_02",
                title="Floating Glass Igloo & Aurora Sky Lounge",
                location="Gulmarg, Kashmir",
                vibe="mountains",
                duration="4 Days • 3 Nights",
                price="₹28,900 / couple",
                price_amount=28900.0,
                price_currency="INR",
                price_unit="couple",
                duration_days=4,
                duration_nights=3,
                rating="4.98 ★",
                rating_value=4.98,
                reviews="98 Verified",
                review_count=98,
                rating_source="CURATED",
                image="https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop&q=80",
                tag="🏔️ Snow & Stars",
                highlights=["360° Glass Roof", "Heated Plunge Pool", "Gondola Phase 2 Passes"],
                insider_tips=["Request Glass Cabin 4 for panoramic sunrise view of Apharwat Peak"]
            )
            sanc3 = Sanctuary(
                id="sanc_03",
                title="Heritage Coffee Estate & Waterfall Sanctuary",
                location="Coorg, Karnataka",
                vibe="wellness",
                duration="2 Days • 1 Night",
                price="₹8,400 / weekend",
                price_amount=8400.0,
                price_currency="INR",
                price_unit="weekend",
                duration_days=2,
                duration_nights=1,
                rating="4.91 ★",
                rating_value=4.91,
                reviews="210 Verified",
                review_count=210,
                rating_source="CURATED",
                image="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
                tag="🍃 Organic Retreat",
                highlights=["Private Stream Dip", "Bean-to-Cup Roasting", "Bonfire Acoustic Evening"],
                insider_tips=["Visit Abbey Falls before 8:30 AM for zero crowds"]
            )
            db.add_all([sanc1, sanc2, sanc3])

        # Seed Drive Escapes
        if db.query(DriveEscape).count() == 0:
            drv1 = DriveEscape(
                id="drv_01",
                name="Nandi Hills Sunrise & Cloud Deck",
                dist_time="1 hr 15 min drive (62 km)",
                stay_suggestion="KSTDC Hill Resort & Cafe",
                vibe_tag="🌄 Early Bird Escapes",
                image="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&auto=format&fit=crop&q=80"
            )
            drv2 = DriveEscape(
                id="drv_02",
                name="Chikmagalur Coffee Ridge Trail",
                dist_time="4 hr 15 min drive (240 km)",
                stay_suggestion="Serai Luxury Estate Villa",
                vibe_tag="☕ Coffee & Mist",
                image="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80"
            )
            db.add_all([drv1, drv2])

        # Seed Community Posts
        if db.query(CommunityPost).count() == 0:
            cp1 = CommunityPost(
                id="post_01",
                author_id="usr_dash_01",
                author_name="Kumkum Pandey",
                author_avatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
                getaway_title="4-Day Gokarna Coastal Trek & Beach Camping",
                location="Gokarna, Karnataka",
                image_url="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
                content="Looking for 2 verified companions for a weekend coastal cliff hike and bioluminescent night beach chill. Budget is ₹6,500 each!",
                likes_count=86,
                companions_needed=2
            )
            db.add(cp1)

        # Seed Vouchers
        if db.query(RewardVoucher).filter_by(code="TAJ-DASHTINY-3K").count() == 0:
            v1 = RewardVoucher(
                id="vch_01",
                brand="Taj Hotels & Palaces",
                discount="₹3,000 Off Luxury Stays",
                coin_cost=500,
                category="Stays",
                code="TAJ-DASHTINY-3K"
            )
            db.add(v1)

        db.commit()
        print("✅ PostgreSQL Database Seeded Successfully with Dynamic Getaways Data!")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
