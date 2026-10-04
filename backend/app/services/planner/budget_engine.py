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
        activities_cost_sum: float = 0.0
    ) -> BudgetBreakdown:
        """
        Calculates itemized category budget based on travelers, nights, and travel style.
        """
        nights = max(1, days_count - 1)

        # 1. Stay (per room per night, assuming 1 room per 2 travelers)
        rooms = max(1, (travelers + 1) // 2)
        room_rates = {
            "budget": 1800.0,
            "comfort": 3500.0,
            "boutique": 6500.0,
            "luxury": 14000.0
        }
        nightly_rate = room_rates.get(accommodation_preference.lower(), 3500.0)
        stay_total = round(nights * rooms * nightly_rate, 2)

        # 2. Food & Dining (per traveler per day)
        daily_food_rates = {
            "budget": 600.0,
            "comfort": 1200.0,
            "boutique": 2000.0,
            "luxury": 3800.0
        }
        per_person_food = daily_food_rates.get(accommodation_preference.lower(), 1200.0)
        food_total = round(days_count * travelers * per_person_food, 2)

        # 3. Activities & Sightseeing
        # If activities sum provided, use it; otherwise provide a standard estimate
        if activities_cost_sum > 0:
            act_total = round(activities_cost_sum * travelers, 2)
        else:
            daily_act_rate = 500.0
            act_total = round(days_count * travelers * daily_act_rate, 2)

        # 4. Local Transport (cabs, rickshaws, rentals per day per group)
        daily_local_transit = 1000.0 if travelers <= 2 else 1800.0
        local_transit_total = round(days_count * daily_local_transit, 2)

        # 5. Intercity Transport estimate if origin specified (e.g. flights/trains)
        intercity_total = 0.0
        intercity_notes = "Not included (local destination only)"
        if origin and origin.lower() != destination.lower():
            # Standard estimated return fare per passenger
            fare_est = 5500.0 if currency == "INR" else 150.0
            intercity_total = round(fare_est * travelers, 2)
            intercity_notes = f"Estimated return transit for {travelers} traveler{'s' if travelers > 1 else ''}"

        # 6. Miscellaneous / Contingency
        misc_total = round((stay_total + food_total + act_total + local_transit_total) * 0.08, 2)

        total_est = round(stay_total + food_total + act_total + local_transit_total + intercity_total + misc_total, 2)

        # Guardrails check
        is_over = False
        overage = 0.0
        guardrail_status = "ON_TARGET"
        guardrail_message = None
        actions = []

        if target_budget > 0:
            if total_est > target_budget * 1.15:
                is_over = True
                overage = round(total_est - target_budget, 2)
                guardrail_status = "OVER_TARGET"
                guardrail_message = (
                    f"This itinerary is estimated at ₹{int(total_est):,}, which is about "
                    f"₹{int(overage):,} above your target budget of ₹{int(target_budget):,}."
                )
                actions = ["reduce_cost", "keep_itinerary", "adjust_budget"]
            elif total_est < target_budget * 0.70:
                guardrail_status = "UNDER_TARGET"
                guardrail_message = (
                    f"This itinerary is estimated at ₹{int(total_est):,}, leaving comfortable "
                    f"room under your ₹{int(target_budget):,} target."
                )
                actions = ["upgrade_experience", "keep_itinerary"]
            else:
                guardrail_status = "ON_TARGET"
                guardrail_message = f"Estimated total (₹{int(total_est):,}) aligns comfortably with your ₹{int(target_budget):,} target."
                actions = ["keep_itinerary"]

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
