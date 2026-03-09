from fastapi import FastAPI, Request, HTTPException
from starlette.responses import StreamingResponse
import httpx
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response
import asyncio
import os
import logging
import re
import uuid
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from .core.config import settings
from .core.logging import configure_logging, request_id_context
from .database.connection import init_db
from .tasks.queue import get_queue

configure_logging()

if settings.SENTRY_DSN and settings.APP_ENV in {"staging", "production"}:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.APP_ENV,
            integrations=[
                FastApiIntegration(),
                LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
            ],
            traces_sample_rate=0.0,
        )
    except Exception as exc:  # pragma: no cover - optional dependency
        logging.getLogger(__name__).warning("Failed to initialize backend Sentry: %s", exc)

logger = logging.getLogger(__name__)
LOCALHOST_ORIGIN_REGEX = re.compile(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$")
DEFAULT_DEV_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8081",
]


def is_allowed_origin(origin: str | None) -> bool:
    if not origin:
        return False
    if origin in settings.BACKEND_CORS_ORIGINS:
        return True
    return settings.is_dev and bool(LOCALHOST_ORIGIN_REGEX.match(origin))


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        origin = request.headers.get("origin")

        # Prevent clickjacking attacks
        response.headers["X-Frame-Options"] = "DENY"

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Enable XSS protection (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Content Security Policy
        connect_sources = ["'self'"] + settings.BACKEND_CORS_ORIGINS
        connect_sources.extend([
            "https://api.mapbox.com",
            "https://events.mapbox.com",
            "https://*.tiles.mapbox.com",
            "https://www.strava.com",
            "https://*.strava.com",
            "wss:",
            "ws:",
        ])
        if settings.is_dev:
            connect_sources.extend(["http://localhost:*", "http://127.0.0.1:*"])
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self'; "
            "font-src 'self' data:; "
            "img-src 'self' data: blob: https://api.mapbox.com https://*.tiles.mapbox.com https://*.strava.com; "
            f"connect-src {' '.join(dict.fromkeys(connect_sources))}; "
            "worker-src 'self' blob:; "
            "object-src 'none'; "
            "manifest-src 'self'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self';"
        )

        if settings.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions Policy (formerly Feature Policy)
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=(), payment=()"
        )

        if is_allowed_origin(origin):
            # Ensure CORS headers are present even on auth/error responses.
            response.headers.setdefault("Access-Control-Allow-Origin", origin)
            response.headers.setdefault("Access-Control-Allow-Credentials", "true")
            response.headers.setdefault("Access-Control-Allow-Methods", "*")
            response.headers.setdefault("Access-Control-Allow-Headers", "*")

        return response


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        token = request_id_context.set(request_id)
        request.state.request_id = request_id
        try:
            response = await call_next(request)
        finally:
            request_id_context.reset(token)
        response.headers["X-Request-ID"] = request_id
        return response


class CSRFMiddleware(BaseHTTPMiddleware):
    SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
    EXEMPT_PATHS = {
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/refresh",
        "/api/auth/password-reset/request",
        "/api/auth/password-reset/confirm",
        "/api/auth/verify-email/request",
        "/api/auth/verify-email/confirm",
        "/api/health/live",
        "/api/health/ready",
    }

    async def dispatch(self, request: Request, call_next):
        if request.method in self.SAFE_METHODS or not request.url.path.startswith("/api/"):
            return await call_next(request)

        if request.url.path in self.EXEMPT_PATHS:
            return await call_next(request)

        if request.headers.get("authorization"):
            return await call_next(request)

        session_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
        if not session_token:
            return await call_next(request)

        csrf_cookie = request.cookies.get(settings.CSRF_COOKIE_NAME)
        csrf_header = request.headers.get(settings.CSRF_HEADER_NAME)
        if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
            return JSONResponse(status_code=403, content={"detail": "CSRF validation failed"})

        return await call_next(request)


class PerformanceMonitoringMiddleware(BaseHTTPMiddleware):
    """Log API endpoint response times for performance monitoring."""

    async def dispatch(self, request: Request, call_next):
        import time
        start_time = time.time()

        response = await call_next(request)

        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = f"{process_time:.3f}"

        # Log slow requests (> 1 second)
        slow_threshold = getattr(settings, "PERF_LOG_SLOW_SECONDS", 1.0)
        if process_time >= slow_threshold:
            logger.warning(
                "Slow request: %s %s status=%s duration=%.3fs",
                request.method,
                request.url.path,
                getattr(response, "status_code", "?"),
                process_time,
            )
        # Log all requests in debug mode
        elif getattr(settings, "PERF_LOG_ALL", False) or logger.isEnabledFor(logging.DEBUG):
            logger.info(
                "Request: %s %s status=%s duration=%.3fs",
                request.method,
                request.url.path,
                getattr(response, "status_code", "?"),
                process_time,
            )

        return response


class LocalDevCORSMiddleware(BaseHTTPMiddleware):
    """Ensure CORS headers are present for any localhost origin."""
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")
        requested_headers = request.headers.get("access-control-request-headers")
        requested_method = request.headers.get("access-control-request-method")

        try:
            if origin and settings.is_dev and LOCALHOST_ORIGIN_REGEX.match(origin):
                if request.method == "OPTIONS":
                    response = Response(status_code=200)
                else:
                    response = await call_next(request)

                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Allow-Methods"] = requested_method or "*"
                response.headers["Access-Control-Allow-Headers"] = requested_headers or "*"
                return response

            return await call_next(request)
        except asyncio.CancelledError:
            # Suppress noisy shutdown cancellation stack traces in dev.
            return Response(status_code=499)


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Limit maximum request body size to prevent DoS attacks."""

    def __init__(self, app, max_upload_size: int = 500 * 1024 * 1024):  # 500MB default
        super().__init__(app)
        self.max_upload_size = max_upload_size

    async def dispatch(self, request: Request, call_next):
        # Check Content-Length header
        if request.headers.get("content-length"):
            content_length = int(request.headers["content-length"])
            if content_length > self.max_upload_size:
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=413,
                    content={
                        "detail": f"Request body too large. Maximum size is {self.max_upload_size / 1024 / 1024:.0f}MB"
                    }
                )

        response = await call_next(request)
        return response


if settings.STORAGE_BACKEND == "local":
    os.makedirs(settings.FIT_FILES_DIR, exist_ok=True)
os.makedirs(settings.CACHE_DIR, exist_ok=True)

# Initialize rate limiter (disabled during tests)
limiter = Limiter(key_func=get_remote_address)
if settings.TESTING:
    limiter.enabled = False

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Training Dashboard Pro API"
)

# Add rate limiter to app state
app.state.limiter = limiter

# Custom rate limit handler with CORS support
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Custom rate limit exceeded handler that includes CORS headers."""
    from fastapi.responses import JSONResponse
    response = JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please try again later."}
    )
    # Add CORS headers manually to rate limit responses
    origin = request.headers.get("origin")
    if is_allowed_origin(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    return response

app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

app.add_middleware(RequestContextMiddleware)
app.add_middleware(CSRFMiddleware)

# Performance monitoring middleware (logs response times)
app.add_middleware(PerformanceMonitoringMiddleware)

# Request size limit middleware (500MB max for batch uploads)
app.add_middleware(RequestSizeLimitMiddleware, max_upload_size=500 * 1024 * 1024)

# Security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# CORS middleware (MUST be added LAST to be outermost - executes first)
cors_origins = list(dict.fromkeys(settings.BACKEND_CORS_ORIGINS + (DEFAULT_DEV_ORIGINS if settings.is_dev else [])))
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=LOCALHOST_ORIGIN_REGEX.pattern if settings.is_dev else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if settings.is_dev:
    app.add_middleware(LocalDevCORSMiddleware)


# Startup event: Initialize database automatically
@app.on_event("startup")
async def startup_event():
    """
    Run on application startup.

    Automatically initializes the database if it doesn't exist.
    This means users just need to start the app - no manual commands!
    """
    logger.info("="*60)
    logger.info("Training Dashboard Pro - Starting Up")
    logger.info("="*60)

    init_db()

    logger.info("="*60)
    logger.info("✓ Application ready!")
    logger.info("="*60)
    queue = get_queue()
    if settings.REDIS_ENABLED and queue is None and not settings.is_dev:
        logger.warning("Redis/RQ is enabled but no queue connection is available")

# Import and include routers
from .api.routes.auth import router as auth_router
from .api.routes.activities import router as activities_router
from .api.routes.analysis import router as analysis_router
from .api.routes.import_routes import router as import_router
from .api.routes.settings import router as settings_router
from .api.routes.strava import router as strava_router
from .api.routes.workouts import router as workouts_router
from .api.routes.calendar import router as calendar_router
from .api.routes.training_plans import router as training_plans_router
from .api.routes.health import router as health_router
from .api.routes.jobs import router as jobs_router

app.include_router(auth_router, prefix="/api/auth", tags=["authentication"])
app.include_router(activities_router, prefix="/api/activities", tags=["activities"])
app.include_router(analysis_router, prefix="/api/analysis", tags=["analysis"])
app.include_router(import_router, prefix="/api/import", tags=["import"])
app.include_router(settings_router, prefix="/api/settings", tags=["settings"])
app.include_router(strava_router, prefix="/api", tags=["strava"])
app.include_router(workouts_router, prefix="/api/workouts", tags=["workouts"])
app.include_router(calendar_router, prefix="/api/calendar", tags=["calendar"])
app.include_router(training_plans_router, prefix="/api/training-plans", tags=["training-plans"])
app.include_router(health_router, prefix="/api/health", tags=["health"])
app.include_router(jobs_router, prefix="/api/jobs", tags=["jobs"])

@app.get("/")
async def root():
    return {"message": "Training Dashboard Pro API", "version": settings.VERSION}

@app.get("/api/assets/rpm-avatar")
async def rpm_avatar_proxy():
    """Proxy a default avatar (RPM first, then fallback) to avoid browser CORS issues."""
    candidate_urls = [
        "https://models.readyplayer.me/64f1b9e005b410c1b9f8a6b7.glb",
        "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/RiggedSimple/glTF-Binary/RiggedSimple.glb"
    ]

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        last_error = None
        for url in candidate_urls:
            try:
                response = await client.get(url)
                response.raise_for_status()
                media_type = response.headers.get("content-type", "model/gltf-binary")
                return StreamingResponse(
                    content=response.aiter_bytes(),
                    media_type=media_type,
                    headers={"Cache-Control": "public, max-age=3600"}
                )
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                continue

    # If all candidates failed, surface a helpful error
    raise HTTPException(status_code=502, detail=f"Avatar fetch failed: {last_error}")

if __name__ == "__main__":
    import uvicorn

    reload_enabled = settings.DEBUG
    uvicorn_kwargs = {
        "host": os.getenv("UVICORN_HOST", "0.0.0.0"),
        "port": int(os.getenv("UVICORN_PORT", 8000)),
        "reload": reload_enabled,
    }

    if reload_enabled:
        uvicorn_kwargs["reload_dirs"] = ["app"]
        uvicorn_kwargs["reload_excludes"] = [
            "data",
            "cache",
            "trainings.db",
            "*.db",
            "venv",
            ".venv",
            "node_modules",
            "tests",
            "scripts",
            "alembic",
        ]
        uvicorn_app = "app.main:app"
    else:
        uvicorn_app = app

    uvicorn.run(uvicorn_app, **uvicorn_kwargs)
