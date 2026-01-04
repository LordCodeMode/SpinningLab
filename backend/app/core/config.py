import json
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import field_validator

# Get the backend directory path
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BACKEND_DIR / ".env"

class Settings(BaseSettings):
    PROJECT_NAME: str = "Training Dashboard Pro"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    TESTING: bool = False

    # Security
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days

    # Database
    DATABASE_URL: str = "postgresql+psycopg2://localhost:5432/trainings.db"

    # CORS
    BACKEND_CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
        "http://localhost:8081",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081",
    ]

    # File storage
    FIT_FILES_DIR: str = "fit_files"
    CACHE_DIR: str = "cache"

    # Redis cache
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_ENABLED: bool = True
    REDIS_KEY_PREFIX: str = "training_dashboard"
    CACHE_WARMUP_ENABLED: bool = True
    CACHE_WARMUP_MAX_AGE_HOURS: int = 24
    CACHE_WARMUP_LOCK_SECONDS: int = 3600
    CACHE_WARMUP_DELAY_SECONDS: int = 3
    POWER_CURVE_CACHE_MAX_AGE_HOURS: int = 168
    POWER_CURVE_MAX_DURATION_SECONDS: int = 43200
    POWER_CURVE_EXTENDED_STEP_SECONDS: int = 300

    # Strava API
    STRAVA_CLIENT_ID: str = ""
    STRAVA_CLIENT_SECRET: str = ""
    STRAVA_REDIRECT_URI: str = "http://localhost:8080/#/settings"

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/app.log"

    @field_validator('SECRET_KEY')
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        """Validate that SECRET_KEY is set and secure."""
        if not v:
            raise ValueError(
                "SECRET_KEY must be set in environment variables. "
                "Generate one using: openssl rand -hex 32"
            )

        # Check for insecure default values
        insecure_keys = [
            "your-secret-key-change-this-in-production",
            "your-super-secret-key-change-this-in-production",
            "changeme",
            "secret",
            "password",
        ]
        if v.lower() in insecure_keys:
            raise ValueError(
                "SECRET_KEY is using an insecure default value. "
                "Generate a secure key using: openssl rand -hex 32"
            )

        # Ensure minimum length (at least 32 characters for security)
        if len(v) < 32:
            raise ValueError(
                "SECRET_KEY must be at least 32 characters long. "
                "Generate one using: openssl rand -hex 32"
            )

        return v

    @field_validator('DATABASE_URL')
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        """Normalize legacy Postgres URLs to SQLAlchemy format."""
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+psycopg2://", 1)
        return v

    @field_validator('BACKEND_CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        """Allow comma-separated or JSON list CORS origins from env."""
        if isinstance(v, str):
            value = v.strip()
            if not value:
                return []
            if value.startswith('['):
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    pass
            return [origin.strip() for origin in value.split(',') if origin.strip()]
        return v

    class Config:
        env_file = str(ENV_FILE)
        env_file_encoding = 'utf-8'
        case_sensitive = True
        extra = 'ignore'

settings = Settings()
