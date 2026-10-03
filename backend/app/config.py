import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True
    )

    PROJECT_NAME: str = "DashTiny Getaways API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database Settings
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "dashtiny_db"
    POSTGRES_PORT: str = "5432"
    DATABASE_URL: Optional[str] = None

    # Redis Cache & PubSub Settings
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    # Security & Auth (MUST be set in environment / .env file)
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Environment and Deployment Settings
    ENVIRONMENT: str = "development"
    DEMO_MODE: bool = True
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001"

    @property
    def cors_origins_list(self) -> list:
        if self.ENVIRONMENT.lower() == "production" and self.CORS_ORIGINS:
            return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        # Allow default local origins in dev
        origins = [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        for default_dev in ["http://localhost:3000", "http://127.0.0.1:3000"]:
            if default_dev not in origins:
                origins.append(default_dev)
        return origins

    # AI Planner / LLM Configuration (Free Tier: Gemini 3.5 Flash, Groq, or local Ollama)
    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    LLM_PROVIDER: str = "gemini"  # gemini, groq, ollama, openai
    LLM_MODEL: str = "gemini-3.5-flash"
    LLM_FALLBACK_MODEL: Optional[str] = "gemini-3.8-flash"
    LLM_BASE_URL: Optional[str] = None

settings = Settings()
if not settings.DATABASE_URL:
    settings.DATABASE_URL = f"postgresql://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@{settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
