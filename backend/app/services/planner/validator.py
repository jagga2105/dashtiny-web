"""
DashTiny Itinerary Validator (Compatibility Module)
backend/app/services/planner/validator.py

Re-exports from app.services.itinerary_validator to maintain 100% backward compatibility.
"""
from app.services.itinerary_validator import (
    ValidationIssue,
    ValidationReport,
    GlobalItineraryValidator,
    ItineraryValidator,
    parse_time_to_minutes,
    minutes_to_time_str
)

__all__ = [
    "ValidationIssue",
    "ValidationReport",
    "GlobalItineraryValidator",
    "ItineraryValidator",
    "parse_time_to_minutes",
    "minutes_to_time_str"
]
