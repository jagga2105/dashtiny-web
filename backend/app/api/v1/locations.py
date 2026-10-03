"""
Locations & Airport Lookup API (backend/app/api/v1/locations.py)
Canonical runtime API for searching and resolving airport codes and geographic locations.
Backed exclusively by PostgreSQL airports table (no legacy SQLite querying at runtime).
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.db.database import get_db
from app.models.models import Airport
from app.db.seed_airports import seed_airports

router = APIRouter(prefix="/locations", tags=["Locations & Airports"])


class AirportResponse(BaseModel):
    id: str
    iata_code: str
    icao_code: Optional[str] = None
    name: str
    city: str
    state_region: Optional[str] = None
    country: str
    country_code: Optional[str] = "IN"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[str] = None
    is_active: bool

    model_config = {"from_attributes": True}


@router.get("/search", response_model=List[AirportResponse])
def search_locations(
    q: Optional[str] = Query(default="", description="Search query: city, airport name, or IATA code"),
    limit: int = Query(default=15, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Search airports and destinations from PostgreSQL.
    Matches against IATA code, city, airport name, and search_text index.
    If query is empty, returns primary active hub airports.
    """
    # Ensure baseline airport dataset is available in PostgreSQL
    total = db.query(Airport).count()
    if total == 0:
        seed_airports(db)

    clean_q = (q or "").strip().lower()
    
    if not clean_q or len(clean_q) < 2:
        # Return prominent hub airports
        hubs = ["DEL", "BOM", "BLR", "GOI", "HYD", "MAA", "CCU", "COK", "DXB", "SIN", "BKK", "HND"]
        return db.query(Airport).filter(
            Airport.iata_code.in_(hubs),
            Airport.is_active == True
        ).all()

    # If exactly 3 uppercase letters, prioritize exact IATA code match
    if len(clean_q) == 3 and clean_q.isalpha():
        exact = db.query(Airport).filter(
            func.lower(Airport.iata_code) == clean_q,
            Airport.is_active == True
        ).all()
        if exact:
            # Also fetch partial matches to fill limit
            others = db.query(Airport).filter(
                func.lower(Airport.iata_code) != clean_q,
                Airport.is_active == True,
                or_(
                    func.lower(Airport.city).like(f"%{clean_q}%"),
                    func.lower(Airport.name).like(f"%{clean_q}%"),
                    Airport.search_text.like(f"%{clean_q}%")
                )
            ).limit(limit - len(exact)).all()
            return exact + others

    # General search
    term = f"%{clean_q}%"
    results = db.query(Airport).filter(
        Airport.is_active == True,
        or_(
            func.lower(Airport.iata_code).like(term),
            func.lower(Airport.city).like(term),
            func.lower(Airport.name).like(term),
            func.lower(Airport.state_region).like(term),
            Airport.search_text.like(term)
        )
    ).order_by(
        # Order exact city prefix match first
        func.lower(Airport.city).like(f"{clean_q}%").desc(),
        Airport.iata_code.asc()
    ).limit(limit).all()

    return results


@router.get("/airports/{iata_code}", response_model=AirportResponse)
def get_airport_by_iata(
    iata_code: str,
    db: Session = Depends(get_db)
):
    """
    Lookup a specific airport by its 3-letter IATA code.
    Case-insensitive. Returns 404 if unknown or unresolved.
    """
    # Ensure baseline airport dataset is available in PostgreSQL
    total = db.query(Airport).count()
    if total == 0:
        seed_airports(db)

    clean_iata = iata_code.strip().upper()
    if len(clean_iata) != 3 or not clean_iata.isalpha():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid IATA code. Must be a 3-letter alphabetic code."
        )

    airport = db.query(Airport).filter(
        Airport.iata_code == clean_iata,
        Airport.is_active == True
    ).first()

    if not airport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Airport with IATA code '{clean_iata}' not found."
        )

    return airport
