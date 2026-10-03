"""
Airport Data Seeder Compatibility Wrapper (backend/app/db/seed_airports.py)
Delegates directly to canonical importer (backend/scripts/import_airports.py).
Eliminates duplicate ingestion pipelines and redundant hardcoded dictionaries.
"""
from typing import Optional
from sqlalchemy.orm import Session
from app.models.models import Airport
from scripts.import_airports import import_airports_data


def seed_airports(db: Session, force: bool = False) -> int:
    """
    Seeds airports into PostgreSQL by invoking the canonical importer.
    Idempotent: if airports already exist and force=False, returns current count.
    Returns the total number of airports in the database.
    """
    count = db.query(Airport).count()
    if count > 0 and not force:
        return count

    res = import_airports_data(db)
    return res["total"]
