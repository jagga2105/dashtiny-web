# 🌍 DashTiny — Intelligent Travel Platform

> **Golden Engineering Rule**:  
> *"AI proposes. Tools verify. Services execute. The database remembers. The UI lets the traveler decide."*

---

## 📌 Vision

DashTiny is an intelligent travel companion that unifies discovery, itinerary planning, inventory comparison, group collaboration, and active trip management into a single seamless platform.

It is **not** another generic online travel agency (OTA).  
It is **not** an open-ended hallucinating chatbot.

DashTiny eliminates the cognitive burden of juggling dozens of disjointed websites (Google Flights, Booking.com, Airbnb, TripAdvisor, Maps, Weather, and Visa portals) by organizing everything around a single persistent object: the **Trip**.

---

## 🏗️ Architecture: Experience-First Trip Graph

Every module in DashTiny — Explore, Planner, Search & Compare, Squad, and Trips — is an operational lens into assembling, optimizing, and executing a **Trip**:

```
User (Traveler Memory & Explicit Preferences)
 └── Trips
      ├── Destination & Route Geometry
      ├── Party Sizing (Solo / Couples / Family / Squad)
      ├── Dates & Time Pacing
      ├── Curated Hotel & Sanctuary Offers
      ├── Itinerary Days & Time-Slotted Activities
      ├── Budget Breakdown & Squad Expense Ledger
      ├── Weather Advisories & Geocoded Coordinates
      └── AI Observability & Provenance Telemetry
```

---

## 🛡️ Architectural Trust Boundaries & Provenance

DashTiny never presents hallucinated inventory, fabricated coordinates, or disguised data. Every data point in the UI carries an explicit provenance tier:

| Tier | Category | Examples | UI Treatment |
| :--- | :--- | :--- | :--- |
| **`VERIFIED`** | Provider Inventory, Official Policy, Coordinates | Real airline flights, partner hotel inventory, geocoded GPS | Green verification badge, partner citation, exact timestamp |
| **`CURATED`** | Editorial & Guide Selections | Hand-selected local sanctuaries, heritage dining | Curated badge, editorial review note |
| **`AI GENERATED`** | Pacing, Narrative, Route Optimization | Daily narrative, activity sequencing, slot allocation | Subtle AI aura, editable pills, "Why recommended" tooltip |
| **`USER GENERATED`** | Community Posts, Traveler Reviews | Tips from fellow travelers, squad memories | Explorer trust score, traveler avatar |

---

## ⚡ Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5
- **Styling**: TailwindCSS with CSS variables & dark glassmorphic design system
- **State & Data**: React hooks, centralized API client, native Fetch
- **Motion & Icons**: Framer Motion, Lucide React

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **ORM & Database**: SQLAlchemy 2.0 with PostgreSQL (In-memory SQLite for testing)
- **Cache & PubSub**: Redis
- **Security**: Strict JWT authentication (HS256) via environment configuration
- **Validation**: Pydantic v2 schemas with 422 HTTP validation
- **Testing**: Pytest with automated integration test suite

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ and npm
- Python 3.11+
- PostgreSQL & Redis (optional for local dev / testing)

### 2. Frontend Setup
```bash
# Clone the repository
git clone https://github.com/jagga2105/dashtiny-web.git
cd dashtiny-web

# Install dependencies
npm install

# Start the Next.js development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

### 3. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install requirements
pip install -r requirements.txt
pip install pytest httpx

# Configure environment
cp .env.example .env
# Edit .env to set your SECRET_KEY and database credentials

# Run database migrations or initial schema
python3 init_db.py

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```
API Documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs).

### 4. Running Backend Tests
```bash
cd backend
./venv/bin/pytest tests/ -v
```

---

## 📡 API Reference Overview

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/auth/register` | `POST` | Create a new traveler account |
| `/api/v1/auth/login` | `POST` | Authenticate with password or sandbox OTP and receive JWT |
| `/api/v1/planner/generate` | `POST` | Synthesize deterministic, preference-constrained itinerary |
| `/api/v1/trips` | `GET` | Fetch authenticated user's active and completed trips |
| `/api/v1/trips/{id}` | `GET` | Retrieve complete trip workspace with days, activities, and budget |
| `/api/v1/bookings/flights` | `GET` | Query normalized flight inventory offers |
| `/api/v1/bookings/hotels` | `GET` | Query normalized stay inventory scaled to party size |
| `/api/v1/squad/rooms/{code}`| `GET` | Join collaborative squad room and access shared ledger |
| `/api/v1/ai/action` | `POST` | Execute targeted conversational diff on active itinerary |

---

## 📄 License
DashTiny is developed under the MIT License.
