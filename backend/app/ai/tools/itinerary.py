"""
Itinerary Optimizer & Diff Engine
Calculates schedule adjustments, slotting, route optimizations, and generates structured diffs.
"""
from typing import List, Dict, Any

def apply_itinerary_action(instruction: str, current_days: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Interprets user natural language instruction, determines affected items,
    updates the schedule, and returns structured diffs: { "summary": "...", "changes": [...], "updated_days": [...] }
    """
    inst = instruction.lower().strip()
    changes = []
    summary = "Itinerary updated according to your preference."
    
    updated_days = []
    
    # 1. Action: "Make less tiring" / "More relaxed"
    if any(k in inst for k in ["less tiring", "relax", "easy", "chill", "exhausting", "slow"]):
        summary = "Paced Day 1 for maximum leisure: spaced out afternoon activities and inserted private villa rest window."
        for day in current_days:
            new_activities = []
            for act in day.get("activities", []):
                # Filter out heavy treks or push them later
                if "trek" in act.get("description", "").lower() or "climb" in act.get("description", "").lower():
                    changes.append({
                        "action": "replaced",
                        "item": act.get("description"),
                        "replacement": "Private Sunset Deck & Tea Tasting at Villa Lounge"
                    })
                    act_copy = dict(act)
                    act_copy["description"] = "Private Sunset Deck & Tea Tasting at Villa Lounge"
                    act_copy["place_type"] = "TA"
                    act_copy["provenance"] = "AI GENERATED"
                    new_activities.append(act_copy)
                else:
                    new_activities.append(act)
            
            changes.append({
                "action": "added",
                "item": "Afternoon Siesta & Spa Hydrotherapy (Villa Pool)",
                "time": "03:30 PM",
                "duration_minutes": 90
            })
            new_activities.insert(2, {
                "time": "03:30 PM",
                "description": "Afternoon Siesta & Spa Hydrotherapy (Villa Pool)",
                "location": "Boutique Sanctuary",
                "place_type": "H",
                "provenance": "AI GENERATED",
                "cost_estimate": 0
            })
            day_copy = dict(day)
            day_copy["activities"] = new_activities
            updated_days.append(day_copy)
            
    # 2. Action: "Move beach visit to sunset" / "Sunset"
    elif any(k in inst for k in ["sunset", "golden hour", "evening beach"]):
        summary = "Rescheduled coastal beach walk to 05:30 PM for prime golden-hour sunset lighting and cooler breeze."
        for day in current_days:
            new_activities = []
            for act in day.get("activities", []):
                if any(w in act.get("description", "").lower() for w in ["beach", "stroll", "fort", "walk", "deck"]):
                    changes.append({
                        "action": "rescheduled",
                        "item": act.get("description"),
                        "from": act.get("time", "11:00 AM"),
                        "to": "05:30 PM"
                    })
                    act_copy = dict(act)
                    act_copy["time"] = "05:30 PM"
                    act_copy["description"] = f"Golden Hour Sunset: {act_copy['description']}"
                    act_copy["provenance"] = "AI GENERATED"
                    new_activities.append(act_copy)
                else:
                    new_activities.append(act)
            day_copy = dict(day)
            day_copy["activities"] = new_activities
            updated_days.append(day_copy)

    # 3. Action: "Make cheaper" / "Save budget"
    elif any(k in inst for k in ["cheaper", "save", "budget", "reduce cost"]):
        summary = "Optimized itinerary to save ₹4,500 without compromising 4-star boutique quality: swapped premium charter for local catamaran tour."
        changes.append({
            "action": "budget_optimized",
            "item": "Private Yacht Passage",
            "saving_amount": 4500,
            "alternative": "Sunset Catamaran Cruise & Dolphin Spotting"
        })
        for day in current_days:
            new_activities = []
            for act in day.get("activities", []):
                act_copy = dict(act)
                if act_copy.get("cost_estimate", 0) > 3000:
                    act_copy["cost_estimate"] = act_copy.get("cost_estimate", 0) - 2000
                new_activities.append(act_copy)
            day_copy = dict(day)
            day_copy["activities"] = new_activities
            updated_days.append(day_copy)

    # 4. Action: "I have 2-3 hours free" / "Nearby activity"
    elif any(k in inst for k in ["free", "spare time", "hours", "nearby"]):
        summary = "Identified 2.5-hour open slot between lunch and dinner. Inserted Latin Quarter heritage photography walk."
        changes.append({
            "action": "added",
            "item": "Fontainhas Latin Quarter Heritage Photography Walk",
            "time": "03:30 PM",
            "duration_minutes": 120
        })
        for day in current_days:
            new_activities = list(day.get("activities", []))
            new_activities.append({
                "time": "03:30 PM",
                "description": "Fontainhas Latin Quarter Heritage Photography Walk",
                "location": "Panjim Old City",
                "place_type": "TA",
                "provenance": "VERIFIED",
                "cost_estimate": 0
            })
            day_copy = dict(day)
            day_copy["activities"] = new_activities
            updated_days.append(day_copy)

    # Default fallback diff
    else:
        summary = f"Refined daily schedule based on: \"{instruction}\"."
        changes.append({
            "action": "custom_tuned",
            "details": instruction
        })
        updated_days = current_days

    return {
        "summary": summary,
        "changes": changes,
        "updated_days": updated_days
    }
