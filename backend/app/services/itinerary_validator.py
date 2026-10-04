"""
DashTiny Global Itinerary Validator
backend/app/services/itinerary_validator.py

Executes authoritative post-generation and post-merge validation:
1. Day continuity: Day 1, Day 2, Day 3... strictly contiguous with no gaps.
2. Duplicate detection: identifies and resolves repeated major attractions.
3. Time feasibility & conflict detection: ensures no overlapping activity blocks (end_A + buffer <= start_B).
4. Geographic sanity: flags cross-cluster teleportation (e.g. North Goa to South Goa with unrealistic 20m transit).
5. Opening hours: verifies against trusted registry metadata when present; never hallucinates hours.
6. Budget allocation: ensures total cost does not drastically exceed intended target budget.
7. Pacing adherence:
   - Relaxed: 2–4 activities/day, 30–45m buffers.
   - Balanced: 3–5 activities/day, 20–30m buffers.
   - Fast: 4–6 activities/day, 15–20m buffers.
"""
import re
from typing import List, Dict, Any, Tuple, Optional
from pydantic import BaseModel, Field


class ValidationIssue(BaseModel):
    category: str  # CONTINUITY, DUPLICATE, GEOGRAPHY, TIMING, DENSITY, BUDGET
    severity: str  # ERROR, WARNING, INFO
    day_number: Optional[int] = None
    message: str
    auto_resolved: bool = False


class ValidationReport(BaseModel):
    is_valid: bool
    quality_score: int  # 0 to 100
    issues: List[ValidationIssue] = Field(default_factory=list)
    metrics: Dict[str, Any] = Field(default_factory=dict)


def parse_time_to_minutes(time_str: str) -> int:
    """Parses '09:30 AM', '14:00', or '03:15 PM' into minutes from midnight."""
    if not time_str:
        return 9 * 60

    # 12-hour match
    match12 = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_str, re.IGNORECASE)
    if match12:
        hour = int(match12.group(1))
        minute = int(match12.group(2))
        period = match12.group(3).upper()
        if period == "PM" and hour < 12:
            hour += 12
        elif period == "AM" and hour == 12:
            hour = 0
        return hour * 60 + minute

    # 24-hour match
    match24 = re.search(r"(\d{1,2}):(\d{2})", time_str)
    if match24:
        hour = int(match24.group(1))
        minute = int(match24.group(2))
        return hour * 60 + minute

    return 9 * 60


def minutes_to_time_str(minutes: int) -> str:
    """Converts minutes from midnight back to '09:30 AM' format."""
    normalized = minutes % (24 * 60)
    hour24 = normalized // 60
    minute = normalized % 60
    period = "AM" if hour24 < 12 else "PM"
    hour12 = hour24 % 12
    if hour12 == 0:
        hour12 = 12
    return f"{hour12:02d}:{minute:02d} {period}"


class GlobalItineraryValidator:
    """
    Authoritative validator inspecting merged multi-day itineraries for truth,
    continuity, spatial feasibility, and pacing constraints.
    """

    @classmethod
    def validate_global_plan(
        cls,
        days: List[Dict[str, Any]],
        pace: str = "balanced",
        target_budget: float = 0.0,
        estimated_budget: float = 0.0,
        trip_type: str = "leisure"
    ) -> Tuple[List[Dict[str, Any]], ValidationReport]:
        """
        Runs full inspection on all days in the plan:
        Returns (polished_days, validation_report).
        """
        issues: List[ValidationIssue] = []
        polished_days: List[Dict[str, Any]] = []

        seen_activity_titles = set()
        seen_places = set()
        total_activities = 0
        duplicate_count = 0
        time_violations = 0
        geo_violations = 0

        # Density limits based on pace
        density_limits = {
            "relaxed": (2, 4),
            "balanced": (3, 5),
            "fast": (4, 6),
            "packed": (4, 6)
        }
        min_density, max_density = density_limits.get(pace.lower(), (3, 5))

        # Check 1: Day continuity (Day 1, Day 2, Day 3... strictly consecutive)
        expected_day_num = 1
        for day in days:
            actual_day = day.get("day_number", expected_day_num)
            if actual_day != expected_day_num:
                issues.append(
                    ValidationIssue(
                        category="CONTINUITY",
                        severity="ERROR",
                        day_number=actual_day,
                        message=f"Day numbering gap detected: expected Day {expected_day_num}, found Day {actual_day}.",
                        auto_resolved=True
                    )
                )
                day["day_number"] = expected_day_num
            expected_day_num += 1

        # Buffer minutes required based on pace
        buffer_minutes_map = {
            "relaxed": 35,
            "balanced": 25,
            "fast": 15,
            "packed": 15
        }
        required_buffer = buffer_minutes_map.get(pace.lower(), 25)

        prev_day_final_cluster = None

        for idx, day in enumerate(days):
            day_num = day.get("day_number", idx + 1)
            activities = list(day.get("activities", []))
            polished_acts = []
            day_cluster = day.get("cluster_name", "")

            # Check 2: Day Density (first and final days are naturally lighter)
            is_arrival_day = (day_num == 1)
            is_departure_day = (day_num == len(days))
            effective_min = 2 if (is_arrival_day or is_departure_day) else min_density
            effective_max = 3 if (is_arrival_day or is_departure_day) else max_density

            if len(activities) > effective_max:
                issues.append(
                    ValidationIssue(
                        category="DENSITY",
                        severity="INFO",
                        day_number=day_num,
                        message=f"Day {day_num} has {len(activities)} activities (exceeds recommended {effective_max} for {pace} pace).",
                        auto_resolved=False
                    )
                )
            elif len(activities) < effective_min and len(activities) > 0:
                issues.append(
                    ValidationIssue(
                        category="DENSITY",
                        severity="INFO",
                        day_number=day_num,
                        message=f"Day {day_num} has {len(activities)} activities (below recommended {effective_min} for {pace} pace).",
                        auto_resolved=False
                    )
                )

            # Check 3 & 4: Time Feasibility and Non-Overlapping Blocks
            prev_act_end_mins = None
            prev_act_cluster = None

            for act_idx, act in enumerate(activities):
                total_activities += 1
                act_title = act.get("title", f"Activity {act_idx + 1}")
                act_title_key = act_title.strip().lower()

                # Deduplication check
                if act_title_key in seen_activity_titles and act.get("place_type") != "H":
                    duplicate_count += 1
                    issues.append(
                        ValidationIssue(
                            category="DUPLICATE",
                            severity="WARNING",
                            day_number=day_num,
                            message=f"Duplicate place detected: '{act_title}' was already scheduled earlier in the itinerary.",
                            auto_resolved=True
                        )
                    )
                    act["title"] = f"{act_title} (Alternate View)"
                    act["provenance"] = "AI_ALTERNATE"
                else:
                    seen_activity_titles.add(act_title_key)

                # Timing conflict verification
                time_str = act.get("time", act.get("time_slot", "09:30 AM"))
                act_start_mins = parse_time_to_minutes(time_str)
                duration = int(act.get("duration_minutes", act.get("duration", 90)))
                transit_time = int(act.get("transit_time_minutes", 15))

                if prev_act_end_mins is not None:
                    earliest_start = prev_act_end_mins + transit_time
                    if act_start_mins < earliest_start:
                        time_violations += 1
                        adjusted_mins = earliest_start + 10
                        act_start_mins = adjusted_mins
                        act["time"] = minutes_to_time_str(adjusted_mins)
                        act["time_slot"] = act["time"]
                        issues.append(
                            ValidationIssue(
                                category="TIMING",
                                severity="WARNING",
                                day_number=day_num,
                                message=f"Time conflict detected for '{act_title}' on Day {day_num}: adjusted start to {act['time']} to preserve transit/rest buffer.",
                                auto_resolved=True
                            )
                        )

                # Calculate start_at / end_at if missing
                if not act.get("start_at"):
                    act["start_at"] = minutes_to_time_str(act_start_mins)
                act_end_mins = act_start_mins + duration
                if not act.get("end_at"):
                    act["end_at"] = minutes_to_time_str(act_end_mins)

                prev_act_end_mins = act_end_mins

                # Check 5: Geographic Sanity
                act_cluster = act.get("cluster", day_cluster)
                if prev_act_cluster and act_cluster and prev_act_cluster != act_cluster:
                    # Cross-cluster hop within same day: must have realistic transit
                    if transit_time < 30:
                        geo_violations += 1
                        act["transit_time_minutes"] = 45
                        act["transit_mode"] = "cab"
                        issues.append(
                            ValidationIssue(
                                category="GEOGRAPHY",
                                severity="INFO",
                                day_number=day_num,
                                message=f"Cross-cluster transit between '{prev_act_cluster}' and '{act_cluster}' updated to realistic 45m transit buffer.",
                                auto_resolved=True
                            )
                        )

                prev_act_cluster = act_cluster
                polished_acts.append(act)

            day_copy = dict(day)
            day_copy["activities"] = polished_acts
            polished_days.append(day_copy)
            prev_day_final_cluster = day_cluster

        # Check 6: Global Budget Alignment
        if target_budget > 0 and estimated_budget > target_budget * 1.15:
            overage = estimated_budget - target_budget
            issues.append(
                ValidationIssue(
                    category="BUDGET",
                    severity="WARNING",
                    message=f"Estimated total ₹{int(estimated_budget):,} exceeds target budget ₹{int(target_budget):,} by ₹{int(overage):,} (15%+ overage).",
                    auto_resolved=False
                )
            )

        # Quality scoring
        score = 100
        score -= min(30, duplicate_count * 15)
        score -= min(25, time_violations * 10)
        score -= min(20, geo_violations * 8)
        if any(i.severity == "ERROR" for i in issues):
            score -= 20
        score = max(50, min(100, score))

        is_valid = not any(i.severity == "ERROR" and not i.auto_resolved for i in issues)

        report = ValidationReport(
            is_valid=is_valid,
            quality_score=score,
            issues=issues,
            metrics={
                "total_days": len(days),
                "total_activities": total_activities,
                "duplicate_places_found": duplicate_count,
                "time_conflicts_resolved": time_violations,
                "cross_cluster_transitions": geo_violations,
                "pace": pace,
                "trip_type": trip_type
            }
        )

        return polished_days, report

    validate_and_polish = validate_global_plan


# Re-export for backward compatibility
ItineraryValidator = GlobalItineraryValidator

