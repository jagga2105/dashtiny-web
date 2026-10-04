"""
DashTiny Destination Knowledge & Geographic Clustering Registry
backend/app/services/planner/destination_registry.py

Provides structured regional intelligence, neighborhood clusters, verified coordinates,
and regional transit realities for geographic continuity and anti-ping-pong routing.
"""
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class PlaceDetail(BaseModel):
    title: str
    description: str
    location: str
    place_type: str = "TA"  # TA = Tour/Attraction, R = Restaurant, H = Hotel
    cluster: str
    cost_estimate: float = 0.0
    duration_minutes: int = 90
    lat: Optional[float] = None
    lng: Optional[float] = None
    provenance: str = "REFERENCE_DATASET"
    source: str = "DESTINATION_GRAPH"
    tags: List[str] = Field(default_factory=list)
    why_recommended_template: str = "Located in {cluster} · Fits {pace} travel pace"


class ClusterInfo(BaseModel):
    name: str
    description: str
    recommended_day_order: int
    places: List[PlaceDetail] = Field(default_factory=list)


class DestinationGeography(BaseModel):
    destination: str
    clusters: List[ClusterInfo]
    typical_intra_transit_minutes: int = 20
    typical_inter_cluster_transit_minutes: int = 60
    inter_cluster_transit_mode: str = "cab"


DESTINATION_KNOWLEDGE: Dict[str, DestinationGeography] = {
    "goa": DestinationGeography(
        destination="Goa",
        typical_intra_transit_minutes=15,
        typical_inter_cluster_transit_minutes=55,
        inter_cluster_transit_mode="cab",
        clusters=[
            ClusterInfo(
                name="Central Goa & Panjim Heritage",
                description="Fontainhas Latin Quarter, Miramar promenade, and historic river churches",
                recommended_day_order=1,
                places=[
                    PlaceDetail(
                        title="Fontainhas Latin Quarter Architectural Walk",
                        description="Stroll through vibrant Portuguese colonial villas, quaint art galleries, and historic tiled alleys.",
                        location="Fontainhas, Panjim",
                        place_type="TA",
                        cluster="Central Goa",
                        cost_estimate=0.0,
                        duration_minutes=90,
                        lat=15.4989,
                        lng=73.8315,
                        tags=["culture", "heritage", "photography", "relaxed"],
                        why_recommended_template="Historic walking sanctuary in {cluster} with zero vehicle congestion"
                    ),
                    PlaceDetail(
                        title="Traditional Goan Thali Lunch at Kokni Kanteen",
                        description="Authentic coastal lunch featuring slow-cooked fish curry, sol kadhi, and coastal vegetarian delicacies.",
                        location="Panjim City Center",
                        place_type="R",
                        cluster="Central Goa",
                        cost_estimate=450.0,
                        duration_minutes=60,
                        lat=15.4920,
                        lng=73.8240,
                        tags=["food", "seafood", "vegetarian", "culture"],
                        why_recommended_template="Renowned local institution serving authentic culinary heritage in {cluster}"
                    ),
                    PlaceDetail(
                        title="Mandovi Riverfront Sunset Promenade & Church Square",
                        description="Unwind at the iconic Church of Our Lady of the Immaculate Conception and scenic Mandovi waterfront.",
                        location="Panjim Waterfront",
                        place_type="TA",
                        cluster="Central Goa",
                        cost_estimate=0.0,
                        duration_minutes=75,
                        lat=15.4988,
                        lng=73.8286,
                        tags=["scenic", "sunset", "photography", "relaxed"],
                        why_recommended_template="Gentle twilight promenade offering golden hour views of the river"
                    )
                ]
            ),
            ClusterInfo(
                name="North Goa Coastal & Cliffside Forts",
                description="Vagator, Anjuna, Chapora Fort, and coastal sundowners",
                recommended_day_order=2,
                places=[
                    PlaceDetail(
                        title="Chapora Fort Panoramic Ridge Excursion",
                        description="Hike the red laterite stone ramparts overlooking Vagator beach and the Arabian Sea horizon.",
                        location="Chapora, North Goa",
                        place_type="TA",
                        cluster="North Goa",
                        cost_estimate=50.0,
                        duration_minutes=90,
                        lat=15.6056,
                        lng=73.7381,
                        tags=["scenic", "heritage", "adventure", "photography"],
                        why_recommended_template="Sweeping coastal vistas from the historic Portuguese cliff fortification"
                    ),
                    PlaceDetail(
                        title="Al Fresco Coastal Lunch at Olive Bar & Kitchen",
                        description="Cliff-edge Mediterranean dining with artisan sourdough, fresh burrata, and sea breeze.",
                        location="Vagator Cliff, North Goa",
                        place_type="R",
                        cluster="North Goa",
                        cost_estimate=1200.0,
                        duration_minutes=75,
                        lat=15.6025,
                        lng=73.7339,
                        tags=["food", "romantic", "scenic"],
                        why_recommended_template="Spectacular cliffside dining conveniently next to your morning fortress stop"
                    ),
                    PlaceDetail(
                        title="Vagator Coastal Sunset Deck & Acoustic Vibes",
                        description="Relax on the dramatic red cliffs with acoustic ambient music and twilight coastal breeze.",
                        location="Ozran Beach, Vagator",
                        place_type="TA",
                        cluster="North Goa",
                        cost_estimate=0.0,
                        duration_minutes=90,
                        lat=15.5975,
                        lng=73.7372,
                        tags=["sunset", "beaches", "relaxed", "nightlife"],
                        why_recommended_template="Prime sunset viewpoint keeping transit under 10 minutes from lunch"
                    ),
                    PlaceDetail(
                        title="Anjuna Beach Coastal Promenade & Flea Fleets",
                        description="Vibrant shoreline walk along the iconic rocky coves and artisan seaside stalls of Anjuna.",
                        location="Anjuna Beach, North Goa",
                        place_type="TA",
                        cluster="North Goa",
                        cost_estimate=0.0,
                        duration_minutes=60,
                        lat=15.5804,
                        lng=73.7436,
                        tags=["beaches", "shopping", "sightseeing", "photography"],
                        why_recommended_template="Historic bohemian shoreline promenade extending your coastal exploration"
                    ),
                    PlaceDetail(
                        title="Little Vagator Sea Cave & Cliff Overlook",
                        description="Scenic walk down the laterite cliff stairs to the sculpted stone Shiva carving in the seaside rocks.",
                        location="Little Vagator, Ozran Beach",
                        place_type="TA",
                        cluster="North Goa",
                        cost_estimate=0.0,
                        duration_minutes=45,
                        lat=15.5960,
                        lng=73.7365,
                        tags=["nature", "photography", "adventure", "scenic"],
                        why_recommended_template="Hidden coastal viewpoint providing dramatic Arabian Sea sunset vistas"
                    )
                ]
            ),
            ClusterInfo(
                name="North Goa Tranquil & Bohemian Coast",
                description="Morjim, Ashwem, and Mandrem pristine sands and cafes",
                recommended_day_order=3,
                places=[
                    PlaceDetail(
                        title="Ashwem Beach Slow Morning & Surf Stroll",
                        description="Wide, quiet sandy stretches ideal for bare-foot strolls, sea glass collecting, and gentle swimming.",
                        location="Ashwem Beach, Mandrem",
                        place_type="TA",
                        cluster="North Goa",
                        cost_estimate=0.0,
                        duration_minutes=120,
                        lat=15.6631,
                        lng=73.7153,
                        tags=["beaches", "wellness", "relaxed", "nature"],
                        why_recommended_template="One of Goa's cleanest, least crowded shores, tailored for unhurried pacing"
                    ),
                    PlaceDetail(
                        title="Artisan Organic Lunch at La Plage",
                        description="Barefoot French-Mediterranean seaside cuisine nestled under coconut groves.",
                        location="Ashwem, Mandrem",
                        place_type="R",
                        cluster="North Goa",
                        cost_estimate=1100.0,
                        duration_minutes=75,
                        lat=15.6610,
                        lng=73.7160,
                        tags=["food", "beach", "romantic"],
                        why_recommended_template="Celebrated beachfront dining right on the sands of Ashwem"
                    ),
                    PlaceDetail(
                        title="Morjim Turtle Conservation Estuary Walk",
                        description="Scenic walk along the Chapora river mouth and protected Olive Ridley turtle nesting sanctuary.",
                        location="Morjim Beach",
                        place_type="TA",
                        cluster="North Goa",
                        cost_estimate=0.0,
                        duration_minutes=80,
                        lat=15.6178,
                        lng=73.7350,
                        tags=["nature", "photography", "relaxed", "wildlife"],
                        why_recommended_template="Tranquil biodiversity sanctuary within short coastal transit"
                    )
                ]
            ),
            ClusterInfo(
                name="South Goa Serenity & White Sands",
                description="Palolem, Agonda, and pristine southern coastal bays",
                recommended_day_order=4,
                places=[
                    PlaceDetail(
                        title="Palolem Bay Kayaking & Secret Cove Exploration",
                        description="Gentle ocean kayaking across the crescent bay to Monkey Island and sheltered coastal lagoons.",
                        location="Palolem Beach, South Goa",
                        place_type="TA",
                        cluster="South Goa",
                        cost_estimate=500.0,
                        duration_minutes=100,
                        lat=15.0100,
                        lng=74.0232,
                        tags=["adventure", "watersports", "beaches", "scenic"],
                        why_recommended_template="Calm, natural harbor waters ideal for easy recreational kayaking"
                    ),
                    PlaceDetail(
                        title="Fresh Seafood & Coconut Curry at Dropadi",
                        description="Seaside restaurant with panoramic bay views, fresh tandoori catch, and wholesome thalis.",
                        location="Palolem Beachfront",
                        place_type="R",
                        cluster="South Goa",
                        cost_estimate=650.0,
                        duration_minutes=60,
                        lat=15.0115,
                        lng=74.0240,
                        tags=["food", "seafood", "beaches"],
                        why_recommended_template="Directly on Palolem beachfront for an effortless transition after kayaking"
                    ),
                    PlaceDetail(
                        title="Agonda Beach Sunset Horseback & Meditation Stroll",
                        description="Unspoiled three-kilometer shoreline with rolling breakers and expansive sunset horizon.",
                        location="Agonda Beach, Canacona",
                        place_type="TA",
                        cluster="South Goa",
                        cost_estimate=0.0,
                        duration_minutes=90,
                        lat=15.0445,
                        lng=73.9870,
                        tags=["sunset", "beaches", "wellness", "nature"],
                        why_recommended_template="Quiet wide-open southern sanctuary with serene sunset vistas"
                    )
                ]
            ),
            ClusterInfo(
                name="South Goa Heritage & Spice Sanctuaries",
                description="Cabo de Rama, historic Portuguese mansions, and inland spice plantations",
                recommended_day_order=5,
                places=[
                    PlaceDetail(
                        title="Cabo de Rama Historic Clifftop Fortress",
                        description="Explore ancient bastion ruins towering dramatically over turquoise waters at Goa's southernmost cape.",
                        location="Cabo de Rama, Canacona",
                        place_type="TA",
                        cluster="South Goa",
                        cost_estimate=0.0,
                        duration_minutes=90,
                        lat=15.0890,
                        lng=73.9190,
                        tags=["heritage", "scenic", "photography", "adventure"],
                        why_recommended_template="Offbeat cliffside fortress with dramatic 360-degree ocean panoramas"
                    ),
                    PlaceDetail(
                        title="Cliffside Coconut Grove Lunch at Cape Goa",
                        description="Boutique cliff terrace serving fresh fruit bowls, smoothies, and grilled catch overlooking private cove.",
                        location="Cabo de Rama Cliff",
                        place_type="R",
                        cluster="South Goa",
                        cost_estimate=950.0,
                        duration_minutes=75,
                        lat=15.0870,
                        lng=73.9210,
                        tags=["romantic", "food", "scenic"],
                        why_recommended_template="Exclusive clifftop perch paired directly with your morning fortress walk"
                    ),
                    PlaceDetail(
                        title="Sahakari Organic Spice Plantation & Rainforest Walk",
                        description="Guided tour among cinnamon, cardamom, vanilla, and betel nut groves with herbal tea reception.",
                        location="Ponda Rainforest Belt",
                        place_type="TA",
                        cluster="South Goa",
                        cost_estimate=400.0,
                        duration_minutes=90,
                        lat=15.4020,
                        lng=74.0200,
                        tags=["nature", "culture", "wellness"],
                        why_recommended_template="Rich biodiversity botanical walk showcasing traditional Goan agriculture"
                    )
                ]
            ),
            ClusterInfo(
                name="Inland Islands & Wildlife Backwaters",
                description="Divar Island, Chorao Bird Sanctuary, and river ferries",
                recommended_day_order=6,
                places=[
                    PlaceDetail(
                        title="Dr. Salim Ali Bird Sanctuary Mangrove Boat Safari",
                        description="Early morning wooden boat glide through lush tidal mangrove swamps observing kingfishers and otters.",
                        location="Chorao Island, Mandovi River",
                        place_type="TA",
                        cluster="Central Islands",
                        cost_estimate=250.0,
                        duration_minutes=90,
                        lat=15.5120,
                        lng=73.8640,
                        tags=["nature", "wildlife", "photography", "relaxed"],
                        why_recommended_template="Peaceful low-impact eco-sanctuary showcasing inland river ecology"
                    ),
                    PlaceDetail(
                        title="Divar Island Heritage Village Cycling & Bakery Lunch",
                        description="Pedal past quaint pastel houses, lush paddy fields, and enjoy freshly baked Goan poi at a traditional wood-fired bakery.",
                        location="Divar Island",
                        place_type="TA",
                        cluster="Central Islands",
                        cost_estimate=300.0,
                        duration_minutes=120,
                        lat=15.5200,
                        lng=73.8800,
                        tags=["culture", "adventure", "food", "relaxed"],
                        why_recommended_template="Step back in time on an island accessible only by river ferry"
                    ),
                    PlaceDetail(
                        title="Backwater River Sunset Catamaran Cruise",
                        description="Unwind on the tranquil river waters as the sun dips below the mangrove canopy.",
                        location="Old Goa Ferry Jetty",
                        place_type="TA",
                        cluster="Central Islands",
                        cost_estimate=800.0,
                        duration_minutes=75,
                        lat=15.5050,
                        lng=73.9100,
                        tags=["sunset", "scenic", "romantic"],
                        why_recommended_template="Serene water cruise avoiding all highway traffic"
                    )
                ]
            ),
            ClusterInfo(
                name="Artisan Markets & Farewell Coastline",
                description="Boutique souks, craft breweries, and departure promenade",
                recommended_day_order=7,
                places=[
                    PlaceDetail(
                        title="Saturday Night Souk / Artisan Flea Market",
                        description="Browse handcrafted jewelry, organic essential oils, linen fashion, and live local music.",
                        location="Arpora, North Goa",
                        place_type="TA",
                        cluster="North Goa",
                        cost_estimate=0.0,
                        duration_minutes=120,
                        lat=15.5780,
                        lng=73.7650,
                        tags=["culture", "nightlife", "shopping"],
                        why_recommended_template="Vibrant community gathering of artisans, live acoustic sets, and crafts"
                    ),
                    PlaceDetail(
                        title="Craft Beer & Goan Tapas at Susegado Microbrewery",
                        description="Sample small-batch IPAs and kokum wheat beers paired with chorizo pao and mushroom xacuti.",
                        location="Baga Creek Road",
                        place_type="R",
                        cluster="North Goa",
                        cost_estimate=700.0,
                        duration_minutes=60,
                        lat=15.5550,
                        lng=73.7550,
                        tags=["food", "nightlife", "relaxed"],
                        why_recommended_template="Celebrated local microbrewery celebrating Goan susegad lifestyle"
                    ),
                    PlaceDetail(
                        title="Miramar Beach Golden Sunset & Coconut Farewell",
                        description="Final sunset beach walk along the gentle palm-fringed sands of Miramar.",
                        location="Miramar Beach, Panjim",
                        place_type="TA",
                        cluster="Central Goa",
                        cost_estimate=0.0,
                        duration_minutes=60,
                        lat=15.4850,
                        lng=73.8100,
                        tags=["sunset", "beaches", "relaxed"],
                        why_recommended_template="Effortless sunset sendoff close to central transit exits"
                    )
                ]
            )
        ]
    ),
    "jaipur": DestinationGeography(
        destination="Jaipur",
        typical_intra_transit_minutes=15,
        typical_inter_cluster_transit_minutes=35,
        inter_cluster_transit_mode="cab",
        clusters=[
            ClusterInfo(
                name="Walled Pink City & Historic Monarchy",
                description="City Palace, Jantar Mantar, and Hawa Mahal",
                recommended_day_order=1,
                places=[
                    PlaceDetail(
                        title="Hawa Mahal Morning Facade Promenade",
                        description="Witness the early morning sun illuminate the 953 honeycombed pink sandstone jharokhas.",
                        location="Badi Choupad, Pink City",
                        place_type="TA",
                        cluster="Walled City",
                        cost_estimate=100.0,
                        duration_minutes=60,
                        lat=26.9239,
                        lng=75.8267,
                        tags=["culture", "heritage", "photography"],
                        why_recommended_template="Best viewed in soft morning light before street traffic begins"
                    ),
                    PlaceDetail(
                        title="City Palace Royal Courtyards & Museum",
                        description="Explore Pritam Niwas Chowk peacock gate, Mubarak Mahal armory, and Chandra Mahal gardens.",
                        location="City Palace Complex",
                        place_type="TA",
                        cluster="Walled City",
                        cost_estimate=300.0,
                        duration_minutes=120,
                        lat=26.9258,
                        lng=75.8237,
                        tags=["culture", "heritage", "history"],
                        why_recommended_template="Iconic royal heritage center within 5 minutes walk of Hawa Mahal"
                    ),
                    PlaceDetail(
                        title="Traditional Rajasthani Thali at Laxmi Mishthan Bhandar (LMB)",
                        description="Heritage feast with dal baati churma, gatte ki sabzi, and ker sangri.",
                        location="Johari Bazaar",
                        place_type="R",
                        cluster="Walled City",
                        cost_estimate=550.0,
                        duration_minutes=60,
                        lat=26.9200,
                        lng=75.8250,
                        tags=["food", "vegetarian", "culture"],
                        why_recommended_template="Legendary sweet shop and restaurant serving pure heritage vegetarian feasts"
                    )
                ]
            ),
            ClusterInfo(
                name="Amer Royal Fortifications & Aravalli Ridges",
                description="Amer Fort, Maota Lake, and Anokhi Museum",
                recommended_day_order=2,
                places=[
                    PlaceDetail(
                        title="Amer Fort Sheesh Mahal & Ramparts",
                        description="Marvel at the mirrored Hall of Mirrors, Mughal gardens, and sprawling marble courtyards.",
                        location="Amer Village",
                        place_type="TA",
                        cluster="Amer Ridge",
                        cost_estimate=250.0,
                        duration_minutes=150,
                        lat=26.9855,
                        lng=75.8513,
                        tags=["heritage", "culture", "photography"],
                        why_recommended_template="UNESCO World Heritage fortress set dramatically in the Aravalli hills"
                    ),
                    PlaceDetail(
                        title="Anokhi Museum of Hand Printing & Organic Cafe",
                        description="Historic mansion showcasing traditional hand block printing techniques with garden tea.",
                        location="Kheri Gate, Amer",
                        place_type="TA",
                        cluster="Amer Ridge",
                        cost_estimate=150.0,
                        duration_minutes=75,
                        lat=26.9890,
                        lng=75.8520,
                        tags=["culture", "artisan", "relaxed"],
                        why_recommended_template="Quiet artisan workshop tucked into the historic foot of Amer fort"
                    ),
                    PlaceDetail(
                        title="Nahargarh Fort Ridge Golden Sunset Over Pink City",
                        description="Panoramic twilight viewpoint perched high on the Aravalli hills overlooking the illuminated city.",
                        location="Nahargarh Fort",
                        place_type="TA",
                        cluster="Amer Ridge",
                        cost_estimate=100.0,
                        duration_minutes=90,
                        lat=26.9370,
                        lng=75.8155,
                        tags=["sunset", "photography", "scenic"],
                        why_recommended_template="Spectacular evening sunset point with the highest panoramic vista in Jaipur"
                    )
                ]
            )
        ]
    ),
    "manali": DestinationGeography(
        destination="Manali",
        typical_intra_transit_minutes=15,
        typical_inter_cluster_transit_minutes=45,
        inter_cluster_transit_mode="cab",
        clusters=[
            ClusterInfo(
                name="Old Manali Pine Forests & Cafes",
                description="Hadimba Temple, cedar forests, and riverside cafes",
                recommended_day_order=1,
                places=[
                    PlaceDetail(
                        title="Hadimba Devi Ancient Cedar Sanctuary",
                        description="Four-tiered wooden pagoda temple carved in 1553 set within towering Himalayan deodar pines.",
                        location="Dhungri Forest, Manali",
                        place_type="TA",
                        cluster="Old Manali",
                        cost_estimate=50.0,
                        duration_minutes=75,
                        lat=32.2483,
                        lng=77.1692,
                        tags=["culture", "nature", "heritage", "peaceful"],
                        why_recommended_template="Sacred wooden sanctuary nestled among centuries-old towering deodars"
                    ),
                    PlaceDetail(
                        title="Riverside Trout & Wood-fired Pizza at Cafe 1947",
                        description="Rustic stone-and-timber cafe beside the roaring Manalsu river with live acoustic sessions.",
                        location="Old Manali Bridge",
                        place_type="R",
                        cluster="Old Manali",
                        cost_estimate=600.0,
                        duration_minutes=70,
                        lat=32.2530,
                        lng=77.1720,
                        tags=["food", "relaxed", "romantic"],
                        why_recommended_template="Riverside dining with authentic alpine trout within walking distance"
                    ),
                    PlaceDetail(
                        title="Jogini Waterfall Meadow Trek",
                        description="Gentle nature hike through pine forests and apple orchards ending at the roaring tiered cascade.",
                        location="Vashisht Village",
                        place_type="TA",
                        cluster="Old Manali",
                        cost_estimate=0.0,
                        duration_minutes=120,
                        lat=32.2680,
                        lng=77.1890,
                        tags=["nature", "adventure", "scenic"],
                        why_recommended_template="Refreshing natural water trail with panoramic Beas river valley views"
                    )
                ]
            ),
            ClusterInfo(
                name="High Valley & Alpine Meadows",
                description="Solang Valley, Anjani Mahadev, and paragliding meadows",
                recommended_day_order=2,
                places=[
                    PlaceDetail(
                        title="Solang Valley Alpine Meadow Excursion",
                        description="Expansive mountain meadows framed by snow-dusted Himalayan peaks.",
                        location="Solang Valley",
                        place_type="TA",
                        cluster="Solang",
                        cost_estimate=200.0,
                        duration_minutes=150,
                        lat=32.3167,
                        lng=77.1583,
                        tags=["nature", "adventure", "scenic"],
                        why_recommended_template="Spectacular high-altitude alpine panorama and open mountain meadows"
                    ),
                    PlaceDetail(
                        title="Warm Himachali Siddu & Apple Chai Tasting",
                        description="Traditional steamed wheat dumpling stuffed with spiced poppy seeds and walnuts, served with pure ghee.",
                        location="Solang Village Stalls",
                        place_type="R",
                        cluster="Solang",
                        cost_estimate=200.0,
                        duration_minutes=45,
                        lat=32.3180,
                        lng=77.1600,
                        tags=["food", "culture", "vegetarian"],
                        why_recommended_template="Essential indigenous Himachali comfort food warming after mountain strolls"
                    )
                ]
            )
        ]
    )
}


def get_destination_geography(destination: str) -> Optional[DestinationGeography]:
    dest_clean = destination.strip().lower()
    for key, geo in DESTINATION_KNOWLEDGE.items():
        if key in dest_clean or dest_clean in key:
            return geo
    return None


def generate_fallback_cluster(destination: str, day_idx: int) -> ClusterInfo:
    """Generates a geometrically consistent cluster for destinations not yet in the curated knowledge base."""
    cluster_names = [
        ("Central Historic Quarter", "Old Town, city center, and iconic initial orientation"),
        ("Scenic Waterfront / Nature Belt", "Riverside, coastal, or alpine nature exploration"),
        ("Artisan & Gastronomy Quarter", "Local food lanes, craft boutiques, and culinary culture"),
        ("Panoramic Ridges & Viewpoints", "Highest panoramic overlooks, sunset vistas, and green reserves"),
        ("Hidden Sanctuaries & Quiet Retreat", "Low-density offbeat districts, monasteries, and relaxation"),
        ("Contemporary Arts & Modern Scene", "Galleries, contemporary architecture, and nightlife"),
        ("Cultural Farewell & Souvenir Bazaars", "Traditional markets, landmark sendoffs, and departure teas")
    ]
    name, desc = cluster_names[(day_idx - 1) % len(cluster_names)]
    
    return ClusterInfo(
        name=f"{name} ({destination.title()})",
        description=desc,
        recommended_day_order=day_idx,
        places=[
            PlaceDetail(
                title=f"{destination.title()} {name} Walk",
                description=f"Explore the signature streets, architecture, and atmosphere of {destination.title()}'s {name}.",
                location=f"{name}, {destination.title()}",
                place_type="TA",
                cluster=name,
                cost_estimate=0.0,
                duration_minutes=90,
                tags=["culture", "sightseeing", "relaxed"],
                why_recommended_template="Curated orientation walk in {cluster} for a balanced introduction"
            ),
            PlaceDetail(
                title=f"Verified Regional Gastronomy Tasting in {name}",
                description=f"Taste signature regional specialties and fresh local seasonal delicacies.",
                location=f"{name}, {destination.title()}",
                place_type="R",
                cluster=name,
                cost_estimate=500.0,
                duration_minutes=60,
                tags=["food", "culture"],
                why_recommended_template="Authentic local dining institution clustered within your morning area"
            ),
            PlaceDetail(
                title=f"{name} Twilight Vista & Golden Hour",
                description=f"Relax as day transitions to twilight at a prominent viewpoint or open plaza in {name}.",
                location=f"{name}, {destination.title()}",
                place_type="TA",
                cluster=name,
                cost_estimate=0.0,
                duration_minutes=75,
                tags=["sunset", "scenic", "relaxed"],
                why_recommended_template="Calm golden hour conclusion keeping daily transit under 20 minutes"
            )
        ]
    )
