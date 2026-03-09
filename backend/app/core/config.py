import json
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import field_validator, model_validator

# Get the backend directory path
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BACKEND_DIR / ".env"

class Settings(BaseSettings):
    PROJECT_NAME: str = "Training Dashboard Pro"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    TESTING: bool = False
    APP_ENV: str = "development"

    # Security
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30
    EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    SESSION_COOKIE_NAME: str = "td_access"
    REFRESH_COOKIE_NAME: str = "td_refresh"
    CSRF_COOKIE_NAME: str = "td_csrf"
    CSRF_HEADER_NAME: str = "X-CSRF-Token"
    SESSION_COOKIE_SECURE: bool = False
    SESSION_COOKIE_SAMESITE: str = "lax"
    SESSION_COOKIE_DOMAIN: str = ""
    LOGIN_MAX_FAILED_ATTEMPTS: int = 5
    LOGIN_LOCK_MINUTES: int = 15

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

    # Frontend / email
    FRONTEND_BASE_URL: str = "http://localhost:8080"
    PASSWORD_RESET_URL: str = "http://localhost:8080/index.html"
    EMAIL_VERIFICATION_URL: str = "http://localhost:8080/index.html"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "Training Dashboard Pro"
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False

    # Storage
    STORAGE_BACKEND: str = "local"
    STORAGE_BUCKET: str = ""
    STORAGE_REGION: str = ""
    STORAGE_ENDPOINT_URL: str = ""
    STORAGE_ACCESS_KEY_ID: str = ""
    STORAGE_SECRET_ACCESS_KEY: str = ""
    STORAGE_PREFIX: str = "training-dashboard"
    STORAGE_HEALTHCHECK_WRITE_TEST: bool = False

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
    RQ_QUEUE_NAME: str = "default"
    RQ_DEFAULT_TIMEOUT: int = 3600
    RQ_RETRY_DELAYS: list[int] = [60, 300, 900]
    PERF_LOG_SLOW_SECONDS: float = 1.0
    PERF_LOG_ALL: bool = False
    JSON_LOGS: bool = False
    SENTRY_DSN: str = ""

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

    @field_validator("APP_ENV")
    @classmethod
    def validate_app_env(cls, v: str) -> str:
        value = (v or "").strip().lower()
        if value not in {"development", "staging", "production", "test"}:
            raise ValueError("APP_ENV must be one of development, staging, production, test")
        return value

    @field_validator("SESSION_COOKIE_SAMESITE")
    @classmethod
    def validate_cookie_samesite(cls, v: str) -> str:
        value = (v or "").strip().lower()
        if value not in {"lax", "strict", "none"}:
            raise ValueError("SESSION_COOKIE_SAMESITE must be lax, strict, or none")
        return value

    @field_validator("STORAGE_BACKEND")
    @classmethod
    def validate_storage_backend(cls, v: str) -> str:
        value = (v or "").strip().lower()
        if value not in {"local", "s3"}:
            raise ValueError("STORAGE_BACKEND must be 'local' or 's3'")
        return value

    @model_validator(mode="after")
    def validate_runtime_requirements(self):
        if self.SESSION_COOKIE_SAMESITE == "none" and not self.SESSION_COOKIE_SECURE:
            raise ValueError("SESSION_COOKIE_SECURE must be true when SESSION_COOKIE_SAMESITE is 'none'")

        if self.APP_ENV in {"production", "staging"}:
            if not self.FRONTEND_BASE_URL:
                raise ValueError("FRONTEND_BASE_URL must be set in staging/production")
            if not self.PASSWORD_RESET_URL:
                raise ValueError("PASSWORD_RESET_URL must be set in staging/production")
            if not self.EMAIL_VERIFICATION_URL:
                raise ValueError("EMAIL_VERIFICATION_URL must be set in staging/production")
            if not self.BACKEND_CORS_ORIGINS:
                raise ValueError("BACKEND_CORS_ORIGINS must be configured in staging/production")
            if self.REDIS_ENABLED and not self.REDIS_URL:
                raise ValueError("REDIS_URL must be set when REDIS_ENABLED is true")
            if not self.SMTP_HOST or not self.SMTP_FROM_EMAIL:
                raise ValueError("SMTP_HOST and SMTP_FROM_EMAIL must be configured in staging/production")
            if self.STORAGE_BACKEND == "s3":
                missing = [
                    key for key, value in {
                        "STORAGE_BUCKET": self.STORAGE_BUCKET,
                        "STORAGE_REGION": self.STORAGE_REGION,
                        "STORAGE_ACCESS_KEY_ID": self.STORAGE_ACCESS_KEY_ID,
                        "STORAGE_SECRET_ACCESS_KEY": self.STORAGE_SECRET_ACCESS_KEY,
                    }.items()
                    if not value
                ]
                if missing:
                    raise ValueError(f"S3 storage is enabled but missing: {', '.join(missing)}")

        if bool(self.STRAVA_CLIENT_ID) ^ bool(self.STRAVA_CLIENT_SECRET):
            raise ValueError("STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set together")

        return self

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_staging(self) -> bool:
        return self.APP_ENV == "staging"

    @property
    def is_dev(self) -> bool:
        return self.APP_ENV in {"development", "test"} or self.DEBUG or self.TESTING

    class Config:
        env_file = str(ENV_FILE)
        env_file_encoding = 'utf-8'
        case_sensitive = True
        extra = 'ignore'

settings = Settings()
