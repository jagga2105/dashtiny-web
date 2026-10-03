import os
import sys
from alembic.config import Config
from alembic import command
from app.db.database import engine, Base, SessionLocal
from app.models import models
from app.models.models import RewardVoucher

def seed_default_vouchers():
    db = SessionLocal()
    try:
        count = db.query(RewardVoucher).count()
        if count == 0:
            print("Seeding initial RewardVouchers into dashtiny_db...")
            defaults = [
                RewardVoucher(
                    id="vch_01",
                    brand="Taj Hotels & Palaces",
                    discount="₹3,000 Off Luxury Stays",
                    coin_cost=150,
                    category="Stays",
                    code="TAJ-DASHTINY-3K"
                ),
                RewardVoucher(
                    id="vch_02",
                    brand="IndiGo Getaway Pass",
                    discount="15% Cashback on Flights",
                    coin_cost=200,
                    category="Flights",
                    code="6E-ESCAPE-15"
                ),
                RewardVoucher(
                    id="vch_03",
                    brand="Airbnb Sanctuaries",
                    discount="₹2,500 Squad Discount",
                    coin_cost=100,
                    category="Villas",
                    code="AIRBNB-SQUAD-25"
                )
            ]
            for d in defaults:
                db.add(d)
            db.commit()
            print("✅ Default vouchers seeded successfully.")
    finally:
        db.close()

def seed_default_airports():
    from app.db.seed_airports import seed_airports
    db = SessionLocal()
    try:
        count = seed_airports(db)
        print(f"✅ Canonical airport dataset initialized ({count} records in DB).")
    finally:
        db.close()

def init_db():
    print("Applying all Alembic database migrations to dashtiny_db...")
    ini_path = os.path.join(os.path.dirname(__file__), "alembic.ini")
    script_path = os.path.join(os.path.dirname(__file__), "alembic")
    alembic_cfg = Config(ini_path)
    alembic_cfg.set_main_option("script_location", script_path)
    command.upgrade(alembic_cfg, "head")
    print("✅ All Alembic migrations applied successfully to head!")
    seed_default_vouchers()
    seed_default_airports()

if __name__ == "__main__":
    init_db()
