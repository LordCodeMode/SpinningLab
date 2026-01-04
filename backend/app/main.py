from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import asyncio
import os
import logging
import re
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from .core.config import settings
from .database.connection import init_db

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
LOCALHOST_ORIGIN_REGEX = re.compile(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$")


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
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https:; "
            "connect-src 'self' http://localhost:* http://127.0.0.1:*"
        )

        # Strict Transport Security (HSTS) - only enable in production with HTTPS
        # Uncomment when deploying with HTTPS:
        # response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions Policy (formerly Feature Policy)
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=(), payment=()"
        )

        if origin and (origin in settings.BACKEND_CORS_ORIGINS or LOCALHOST_ORIGIN_REGEX.match(origin)):
            # Ensure CORS headers are present even on auth/error responses.
            response.headers.setdefault("Access-Control-Allow-Origin", origin)
            response.headers.setdefault("Access-Control-Allow-Credentials", "true")
            response.headers.setdefault("Access-Control-Allow-Methods", "*")
            response.headers.setdefault("Access-Control-Allow-Headers", "*")

        return response


class PerformanceMonitoringMiddleware(BaseHTTPMiddleware):
    """Log API endpoint response times for performance monitoring."""

    async def dispatch(self, request: Request, call_next):
        import time
        start_time = time.time()

        response = await call_next(request)

        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)

        # Log slow requests (> 1 second)
        if process_time > 1.0:
            logger.warning(
                f"Slow request: {request.method} {request.url.path} "
                f"took {process_time:.2f}s"
            )
        # Log all requests in debug mode
        elif logger.isEnabledFor(logging.DEBUG):
            logger.debug(
                f"{request.method} {request.url.path} "
                f"completed in {process_time:.3f}s"
            )

        return response


class LocalDevCORSMiddleware(BaseHTTPMiddleware):
    """Ensure CORS headers are present for any localhost origin."""
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")
        requested_headers = request.headers.get("access-control-request-headers")
        requested_method = request.headers.get("access-control-request-method")

        try:
            if origin and LOCALHOST_ORIGIN_REGEX.match(origin):
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


# Create directories if they don't exist
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
    if origin and LOCALHOST_ORIGIN_REGEX.match(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    return response

app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

# Performance monitoring middleware (logs response times)
app.add_middleware(PerformanceMonitoringMiddleware)

# Request size limit middleware (500MB max for batch uploads)
app.add_middleware(RequestSizeLimitMiddleware, max_upload_size=500 * 1024 * 1024)

# Security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# CORS middleware (MUST be added LAST to be outermost - executes first)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative React dev server
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://localhost:8080",  # Live server
        "http://localhost:8081",  # Alternate live server
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081",
    ],
    allow_origin_regex=LOCALHOST_ORIGIN_REGEX.pattern,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dev fallback: ensure CORS headers for any localhost origin.
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

    # Auto-initialize database (creates tables if they don't exist)
    init_db()

    logger.info("="*60)
    logger.info("✓ Application ready!")
    logger.info("="*60)

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

app.include_router(auth_router, prefix="/api/auth", tags=["authentication"])
app.include_router(activities_router, prefix="/api/activities", tags=["activities"])
app.include_router(analysis_router, prefix="/api/analysis", tags=["analysis"])
app.include_router(import_router, prefix="/api/import", tags=["import"])
app.include_router(settings_router, prefix="/api/settings", tags=["settings"])
app.include_router(strava_router, prefix="/api", tags=["strava"])
app.include_router(workouts_router, prefix="/api/workouts", tags=["workouts"])
app.include_router(calendar_router, prefix="/api/calendar", tags=["calendar"])
app.include_router(training_plans_router, prefix="/api/training-plans", tags=["training-plans"])

@app.get("/")
async def root():
    return {"message": "Training Dashboard Pro API", "version": settings.VERSION}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.VERSION}

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
        uvicorn_kwargs["reload_excludes"] = ["data", "cache", "trainings.db", "*.db"]
        uvicorn_app = "app.main:app"
    else:
        uvicorn_app = app

    uvicorn.run(uvicorn_app, **uvicorn_kwargs)
