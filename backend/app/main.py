from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
import redis

from app.config import settings
from app.db.database import SessionLocal
from app.api.v1 import auth, planner, squad, explore, community, rewards, trips, bookings, chat, ai

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(planner.router, prefix=settings.API_V1_STR)
app.include_router(trips.router, prefix=settings.API_V1_STR)
app.include_router(bookings.router, prefix=settings.API_V1_STR)
app.include_router(squad.router, prefix=settings.API_V1_STR)
app.include_router(explore.router, prefix=settings.API_V1_STR)
app.include_router(community.router, prefix=settings.API_V1_STR)
app.include_router(rewards.router, prefix=settings.API_V1_STR)
app.include_router(chat.router, prefix=settings.API_V1_STR)
app.include_router(ai.router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs"
    }

@app.get("/health")
def healthcheck(response: Response):
    """
    Authentic health check verifying PostgreSQL database and Redis cache connectivity.
    """
    db_status = "disconnected"
    try:
        with SessionLocal() as db_session:
            db_session.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)[:50]}"

    redis_status = "disconnected"
    try:
        r = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, socket_connect_timeout=0.5)
        if r.ping():
            redis_status = "connected"
    except Exception:
        redis_status = "disconnected"

    # Degraded if database is down
    if db_status != "connected":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        overall_status = "unhealthy"
    else:
        overall_status = "healthy"

    return {
        "status": overall_status,
        "api": "healthy",
        "database": db_status,
        "redis": redis_status,
        "version": settings.VERSION
    }
