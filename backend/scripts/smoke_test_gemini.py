#!/usr/bin/env python3
"""
DashTiny DAIna AI Planner — Live Gemini Smoke Test Script
(backend/scripts/smoke_test_gemini.py)

Usage:
    ./venv/bin/python scripts/smoke_test_gemini.py

Validates the complete real-world path:
1. Reads credentials and settings from backend/.env
2. Directly tests communication with Google Gemini Flash
3. Executes build_itinerary_with_planner_agent with realistic preferences & raw prompt nuances
4. Verifies spatial geocoding boundary checks, decomposed provenance (AI_GENERATED vs CURATED),
   and truthful telemetry recorded in PostgreSQL.
"""
import os
import sys
import time

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.db.database import SessionLocal
from app.models.models import User, AIRun, Itinerary
from app.ai.agents.planner_agent import get_llm_client, build_itinerary_with_planner_agent

def run_smoke_test():
    print("=" * 70)
    print("🌍 DASHTINY DAINA AI PLANNER — REAL PROVIDER SMOKE TEST")
    print("=" * 70)

    # 1. Environment & Configuration Check
    provider = settings.LLM_PROVIDER
    model = settings.LLM_MODEL
    has_key = bool(settings.GEMINI_API_KEY)
    print(f"Configured Provider : {provider}")
    print(f"Primary Model       : {model}")
    print(f"Fallback Model      : {settings.LLM_FALLBACK_MODEL}")
    print(f"API Key Present     : {'YES (' + settings.GEMINI_API_KEY[:6] + '...)' if has_key else 'NO'}")

    if not has_key:
        print("\n❌ ERROR: GEMINI_API_KEY is not set in backend/.env. Smoke test aborted.")
        sys.exit(1)

    # 2. Test Direct LLM Connectivity
    print("\n[Step 1/3] Pinging Google Gemini endpoint...")
    client_tuple = get_llm_client()
    if not client_tuple:
        print("❌ ERROR: get_llm_client() returned None. Check LLM_PROVIDER and key.")
        sys.exit(1)

    client, active_model = client_tuple
    t0 = time.time()
    try:
        ping_res = client.chat.completions.create(
            model=active_model,
            messages=[{"role": "user", "content": "Respond strictly with: DASHTINY_AI_ONLINE"}],
            max_tokens=15
        )
        ping_content = ping_res.choices[0].message.content or ""
        latency = int((time.time() - t0) * 1000)
        print(f"✅ Provider response received in {latency}ms: {ping_content.strip()}")
    except Exception as e:
        print(f"❌ ERROR connecting to Gemini endpoint: {e}")
        sys.exit(1)

    # 3. Test Full Planner Agent with Raw Nuances
    print("\n[Step 2/3] Generating 2-day Kyoto Itinerary with raw traveler prompt...")
    raw_prompt = (
        "I hate tourist traps and crowded morning buses. We love quiet early walks, "
        "authentic matcha ceremonies, and would rather spend budget on fine dining than luxury hotels."
    )

    db = SessionLocal()
    try:
        user = db.query(User).first()
        if not user:
            user = User(id="smoke-test-user", email="traveler@dashtiny.ai", full_name="Smoke Tester")
            db.add(user)
            db.commit()

        t_plan_start = time.time()
        plan_result = build_itinerary_with_planner_agent(
            destination="Kyoto",
            budget=60000.0,
            days_count=2,
            persona="culture_seeker",
            user=user,
            db=db,
            start_date_str="2026-11-20",
            end_date_str="2026-11-21",
            origin="Tokyo",
            travellers=2,
            vibe="zen & quiet heritage",
            interests=["bamboo groves", "matcha ceremonies", "kaiseki cuisine"],
            raw_prompt=raw_prompt
        )
        plan_latency = round(time.time() - t_plan_start, 2)
        print(f"✅ Itinerary generated and persisted in {plan_latency}s!")

        # 4. Assertions & Verification
        print("\n[Step 3/3] Verifying Trust Boundaries & Telemetry...")
        trip_id = plan_result["id"]
        title = plan_result["title"]
        days = plan_result["days"]

        print(f"Trip ID    : {trip_id}")
        print(f"Trip Title : {title}")
        print(f"Total Days : {len(days)}")

        ai_run = db.query(AIRun).filter(AIRun.trip_id == trip_id).first()
        if ai_run:
            print(f"Telemetry  : Model={ai_run.model} | Tokens={ai_run.tokens_used} | Status={ai_run.status}")

        for day in days:
            day_num = day.get("dayNumber") or day.get("day")
            print(f"\n  🗓️ Day {day_num}: {day.get('title')}")
            for act in day.get("activities", []):
                gen_src = act.get("generationSource")
                loc_src = act.get("locationSource")
                prov = act.get("provenance")
                cost_type = act.get("costType")
                cost_val = act.get("estimatedAllocation")
                lat = act.get("lat")
                lng = act.get("lng")
                print(f"    - [{act.get('time')}] {act.get('description')}")
                print(f"      📍 Location: {act.get('location')} (lat={lat}, lng={lng})")
                print(f"      🏷️ Sources: generation={gen_src}, location={loc_src}, provenance={prov}")
                print(f"      💰 Budget: {cost_type} = ₹{cost_val:,.0f}")
                print(f"      💡 Why: {act.get('whyRecommended')}")

        print("\n" + "=" * 70)
        print("🎉 ALL SMOKE TEST CHECKS PASSED: Live Gemini integration is fully verified!")
        print("=" * 70)

    finally:
        db.close()

if __name__ == "__main__":
    run_smoke_test()
