from fastapi import APIRouter
from sqlalchemy import text

from ...core.config import settings
from ...database.connection import engine
from ...services.storage_service import storage_service
from ...tasks.queue import get_queue

router = APIRouter()


@router.get("/live", response_model=dict)
async def live() -> dict:
    return {"status": "ok", "version": settings.VERSION, "env": settings.APP_ENV}


@router.get("/ready", response_model=dict)
async def ready() -> dict:
    checks: dict[str, dict] = {}
    overall = "ok"

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        checks["database"] = {"status": "ok"}
    except Exception as exc:
        overall = "degraded"
        checks["database"] = {"status": "error", "detail": str(exc)}

    if settings.REDIS_ENABLED:
        try:
            queue = get_queue()
            checks["redis"] = {"status": "ok" if queue else "error"}
            checks["worker_queue"] = {"status": "ok" if queue else "error"}
            if queue is None:
                overall = "degraded"
        except Exception as exc:
            overall = "degraded"
            checks["redis"] = {"status": "error", "detail": str(exc)}
            checks["worker_queue"] = {"status": "error", "detail": str(exc)}
    else:
        checks["redis"] = {"status": "disabled"}
        checks["worker_queue"] = {"status": "disabled"}

    checks["storage"] = storage_service.readiness()
    if checks["storage"].get("status") != "ok":
        overall = "degraded"

    return {"status": overall, "checks": checks, "version": settings.VERSION, "env": settings.APP_ENV}
