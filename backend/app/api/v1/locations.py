"""
Locations & Airport Lookup API (backend/app/api/v1/locations.py)
Canonical runtime API for searching and resolving airport codes and geographic locations.
Backed exclusively by PostgreSQL airports table (no legacy SQLite querying at runtime).
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func, case

from app.db.database import get_db
from app.models.models import Airport

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
    provenance: str = "REFERENCE_DATASET"

    model_config = {"from_attributes": True}


@router.get("/search", response_model=List[AirportResponse])
def search_locations(
    q: Optional[str] = Query(default="", description="Search query: city, airport name, or IATA code"),
    limit: int = Query(default=15, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Deterministic ranked search for airports from PostgreSQL location domain.
    Read-only: Never creates, mutates, or seeds database records.
    
    Ranking Preference:
    1. Exact IATA match (e.g. 'DEL')
    2. Exact airport name match (e.g. 'Indira Gandhi International Airport')
    3. Exact city match (e.g. 'Delhi')
    4. Prefix match (IATA prefix, city prefix, name prefix)
    5. Broader token match in search_text
    """
    clean_q = (q or "").strip().lower()

    if not clean_q or len(clean_q) < 2:
        # Return prominent default hub airports
        hubs = ["DEL", "BOM", "BLR", "GOI", "HYD", "MAA", "CCU", "COK", "JAI", "AMD", "DXB", "SIN", "LHR", "BKK"]
        return db.query(Airport).filter(
            Airport.iata_code.in_(hubs),
            Airport.is_active == True
        ).order_by(
            case(
                {h: idx for idx, h in enumerate(hubs)},
                value=Airport.iata_code
            )
        ).limit(limit).all()

    # Build SQL ranking score
    # 1. Exact IATA match -> 100
    # 2. Exact Airport Name -> 90
    # 3. Exact City -> 80
    # 4. IATA prefix -> 70
    # 5. City prefix -> 60
    # 6. Name prefix -> 50
    # 7. Substring -> 20
    relevance_score = case(
        (func.lower(Airport.iata_code) == clean_q, 100),
        (func.lower(Airport.name) == clean_q, 90),
        (func.lower(Airport.city) == clean_q, 80),
        (func.lower(Airport.iata_code).startswith(clean_q), 70),
        (func.lower(Airport.city).startswith(clean_q), 60),
        (func.lower(Airport.name).startswith(clean_q), 50),
        else_=20
    )

    # Token-based filtering for multi-word queries like "Indira Gandhi"
    tokens = clean_q.split()
    token_filters = []
    for t in tokens:
        term = f"%{t}%"
        token_filters.append(
            or_(
                func.lower(Airport.iata_code).like(term),
                func.lower(Airport.city).like(term),
                func.lower(Airport.name).like(term),
                func.lower(Airport.state_region).like(term),
                Airport.search_text.like(term)
            )
        )

    query = db.query(Airport).filter(
        Airport.is_active == True,
        and_(*token_filters)
    ).order_by(
        relevance_score.desc(),
        Airport.city.asc(),
        Airport.iata_code.asc()
    ).limit(limit)

    return query.all()


@router.get("/airports/{iata_code}", response_model=AirportResponse)
def get_airport_by_iata(
    iata_code: str,
    db: Session = Depends(get_db)
):
    """
    Lookup a specific airport by its 3-letter IATA code.
    Case-insensitive. Returns 404 if unknown or unresolved.
    Read-only: Never creates, mutates, or seeds database records.
    """
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
