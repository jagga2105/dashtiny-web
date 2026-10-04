"""
DashTiny Budget Intelligence Engine & Guardrails
backend/app/services/planner/budget_engine.py

Calculates transparent, itemized category estimates:
- Accommodation (Stay)
- Food & Dining
- Activities & Admissions
- Local Transport
- Intercity Transport (if origin provided)
- Miscellaneous & Contingency

Applies guardrails: identifies budget overruns and generates structured "reduce_cost" proposals.
All estimates carry explicit 'ESTIMATED' provenance.
"""
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class BudgetCategory(BaseModel):
    category: str
    label: str
    amount: float
    per_day: float
    currency: str = "INR"
    provenance: str = "ESTIMATED"
    notes: str


class BudgetBreakdown(BaseModel):
    total_estimated: float
    target_budget: float
    currency: str = "INR"
    is_over_budget: bool
    overage_amount: float = 0.0
    guardrail_status: str  # ON_TARGET, NEAR_TARGET, OVER_TARGET, UNDER_TARGET
    guardrail_message: Optional[str] = None
    accommodation: float = 0.0
    food: float = 0.0
    activities: float = 0.0
    local_transport: float = 0.0
    intercity_transport: float = 0.0
    miscellaneous: float = 0.0
    label: str = "ESTIMATED"
    categories: List[BudgetCategory] = Field(default_factory=list)
    available_actions: List[str] = Field(default_factory=list)


class BudgetEngine:
    @staticmethod
    def calculate_estimate(
        days_count: int,
        travelers: int,
        target_budget: float = 0.0,
        currency: str = "INR",
        accommodation_preference: str = "comfort",
        origin: Optional[str] = None,
        destination: str = "Goa",
        activities_cost_sum: float = 0.0,
        food_preferences: Optional[List[str]] = None,
        dining_style: Optional[str] = None,
        transport_preference: Optional[str] = None,
        travel_mode: Optional[str] = None
    ) -> BudgetBreakdown:
        """
        Calculates itemized category budget based on travelers, nights, and travel style.
        Ensures food estimates are derived from destination and food preferences, NOT accommodation preference!
        """
        nights = max(1, days_count - 1)
        travelers = max(1, travelers)

        # 1. Stay (per room per night, assuming 1 room per 2 travelers)
        rooms = max(1, (travelers + 1) // 2)
        room_rates = {
            "hostel": 900.0,
            "budget": 1800.0,
            "comfort": 3500.0,
            "boutique": 6500.0,
            "luxury": 14000.0,
            "resort": 16000.0
        }
        nightly_rate = room_rates.get(accommodation_preference.lower(), 3500.0)
        stay_total = round(nights * rooms * nightly_rate, 2)

        # 2. Food & Dining: Derived from destination tier, dining style, and food preferences
        # Independent from accommodation preference!
        dest_lower = destination.lower()
        is_intl_tier1 = any(k in dest_lower for k in ["tokyo", "paris", "rome", "dubai", "singapore", "london", "new york", "zurich"])
        
        # Base daily rate per person
        clean_food_prefs = [f.lower().strip() for f in (food_preferences or [])]
        clean_style = (dining_style or "").lower().strip()

        if is_intl_tier1:
            base_daily_food = 2800.0
            if "fine_dining" in clean_style or "gourmet" in clean_food_prefs or "luxury" in clean_style:
                base_daily_food = 4500.0
            elif "street_food" in clean_food_prefs or "casual" in clean_style or "budget" in clean_style:
                base_daily_food = 1800.0
        else:
            base_daily_food = 1100.0
            if "fine_dining" in clean_style or "gourmet" in clean_food_prefs or "luxury" in clean_style:
                base_daily_food = 2600.0
            elif "street_food" in clean_food_prefs or "casual" in clean_style or "budget" in clean_style:
                base_daily_food = 650.0
            elif "seafood" in clean_food_prefs:
                base_daily_food = 1400.0

        food_total = round(days_count * travelers * base_daily_food, 2)

        # 3. Activities & Sightseeing
        if activities_cost_sum > 0:
            act_total = round(activities_cost_sum * travelers, 2)
        else:
            daily_act_rate = 600.0 if not is_intl_tier1 else 1500.0
            act_total = round(days_count * travelers * daily_act_rate, 2)

        # 4. Local Transport (cabs, rickshaws, rentals per day per group)
        trans_pref = (transport_preference or "mix").lower()
        if "walk" in trans_pref:
            daily_local_transit = 250.0
        elif "public" in trans_pref or "metro" in trans_pref:
            daily_local_transit = 450.0 * max(1, travelers // 2)
        elif "rental" in trans_pref:
            daily_local_transit = 2200.0
        else:
            daily_local_transit = 1000.0 if travelers <= 2 else 1800.0

        local_transit_total = round(days_count * daily_local_transit, 2)

        # 5. Intercity Transport estimate if origin specified (e.g. flights/trains)
        intercity_total = 0.0
        intercity_notes = "Not included (local destination only)"
        if origin and origin.lower() != destination.lower():
            clean_mode = (travel_mode or "flight").lower()
            if "train" in clean_mode or "rail" in clean_mode:
                fare_est = 1600.0 if currency == "INR" else 45.0
            elif "bus" in clean_mode or "car" in clean_mode:
                fare_est = 1200.0 if currency == "INR" else 35.0
            else:
                fare_est = 5500.0 if currency == "INR" else 150.0
            intercity_total = round(fare_est * travelers, 2)
            intercity_notes = f"Estimated return transit for {travelers} traveler{'s' if travelers > 1 else ''}"

        # 6. Miscellaneous / Contingency Buffer
        misc_total = round((stay_total + food_total + act_total + local_transit_total) * 0.08, 2)

        total_est = round(stay_total + food_total + act_total + local_transit_total + intercity_total + misc_total, 2)

        # Guardrails check
        is_over = False
        overage = 0.0
        guardrail_status = "ON_TARGET"
        guardrail_message = None
        actions = []

        if target_budget > 0:
            if total_est > target_budget * 1.10:
                is_over = True
                overage = round(total_est - target_budget, 2)
                guardrail_status = "OVER_TARGET"
                guardrail_message = (
                    f"You're about ₹{int(overage):,} above target."
                )
                actions = [
                    "reduce_cost", "keep_highlights", "change_stay", "reduce_activities",
                    "Reduce cost", "Keep highlights", "Change stay", "Reduce activities"
                ]
            elif total_est < target_budget * 0.70:
                guardrail_status = "UNDER_TARGET"
                guardrail_message = (
                    f"This itinerary is estimated at ₹{int(total_est):,}, leaving comfortable room under your ₹{int(target_budget):,} target."
                )
                actions = ["Upgrade stay", "Keep highlights"]
            else:
                guardrail_status = "ON_TARGET"
                guardrail_message = f"Estimated total (₹{int(total_est):,}) aligns comfortably with your ₹{int(target_budget):,} target."
                actions = ["Keep highlights"]

        categories = [
            BudgetCategory(
                category="accommodation",
                label="Stay & Accommodation",
                amount=stay_total,
                per_day=round(stay_total / days_count, 2),
                currency=currency,
                notes=f"{nights} nights ({accommodation_preference.title()} standard)"
            ),
            BudgetCategory(
                category="food",
                label="Dining & Local Cuisine",
                amount=food_total,
                per_day=round(food_total / days_count, 2),
                currency=currency,
                notes=f"Breakfast, lunch & dinner across {days_count} days"
            ),
            BudgetCategory(
                category="activities",
                label="Activities & Experiences",
                amount=act_total,
                per_day=round(act_total / days_count, 2),
                currency=currency,
                notes="Tours, guides, entrance passes, and rentals"
            ),
            BudgetCategory(
                category="local_transport",
                label="Local Transport",
                amount=local_transit_total,
                per_day=round(local_transit_total / days_count, 2),
                currency=currency,
                notes="Local cabs, autos, and airport/station transfers"
            ),
            BudgetCategory(
                category="miscellaneous",
                label="Buffer & Contingency",
                amount=misc_total,
                per_day=round(misc_total / days_count, 2),
                currency=currency,
                notes="Shopping, tipping, refreshments, and flexibility reserve"
            )
        ]

        if intercity_total > 0:
            categories.append(
                BudgetCategory(
                    category="intercity_transport",
                    label=f"Transit ({origin} → {destination})",
                    amount=intercity_total,
                    per_day=round(intercity_total / days_count, 2),
                    currency=currency,
                    notes=intercity_notes
                )
            )

        return BudgetBreakdown(
            total_estimated=total_est,
            target_budget=target_budget,
            currency=currency,
            is_over_budget=is_over,
            overage_amount=overage,
            guardrail_status=guardrail_status,
            guardrail_message=guardrail_message,
            accommodation=stay_total,
            food=food_total,
            activities=act_total,
            local_transport=local_transit_total,
            intercity_transport=intercity_total,
            miscellaneous=misc_total,
            label="ESTIMATED",
            categories=categories,
            available_actions=actions
        )

    @staticmethod
    def generate_cost_reduction_diff(
        current_days: List[Dict[str, Any]],
        current_budget_breakdown: BudgetBreakdown
    ) -> Dict[str, Any]:
        """
        Creates a structured cost reduction proposal diff without mutating the trip:
        - Swaps expensive premium activities for high-rated scenic/heritage walks
        - Optimizes dining to authentic local establishments
        - Recalculates estimated savings
        """
        diff_changes = []
        updated_days = []
        total_savings = 0.0

        for day in current_days:
            new_acts = []
            for act in day.get("activities", []):
                act_copy = dict(act)
                cost = act_copy.get("cost_estimate", 0.0)
                title = act_copy.get("title", act_copy.get("description", ""))

                # If activity is costly (> ₹1,000 per person), optimize
                if cost > 1000.0:
                    saving = round(cost * 0.60, 2)
                    total_savings += saving
                    alt_title = f"Local Heritage & Scenic Walk: {title.split(':')[0]}"
                    diff_changes.append({
                        "action": "budget_optimized",
                        "original_item": title,
                        "replacement": alt_title,
                        "saving_amount": saving,
                        "reason": "Replaced premium fee-based charter with scenic heritage walk"
                    })
                    act_copy["title"] = alt_title
                    act_copy["description"] = f"Curated scenic walk: {act_copy.get('description', '')}"
                    act_copy["cost_estimate"] = cost - saving
                new_acts.append(act_copy)

            day_copy = dict(day)
            day_copy["activities"] = new_acts
            updated_days.append(day_copy)

        return {
            "summary": f"Reduced estimated trip cost by ₹{int(total_savings):,} by swapping high-fee excursions for serene local alternatives.",
            "total_savings": total_savings,
            "new_estimated_total": max(0.0, current_budget_breakdown.total_estimated - total_savings),
            "changes": diff_changes,
            "updated_days": updated_days
        }
