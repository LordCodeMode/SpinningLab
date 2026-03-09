from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from ..core.config import settings

try:
    from rq import Queue, Retry, get_current_job
    from rq.job import Job
except Exception:  # pragma: no cover - optional dependency
    Queue = None
    Retry = None
    Job = None

    def get_current_job():  # type: ignore
        return None

try:
    import redis
except Exception:  # pragma: no cover - optional dependency
    redis = None

logger = logging.getLogger(__name__)

INLINE_JOBS: dict[str, dict[str, Any]] = {}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class JobHandle:
    id: str
    backend: str
    status: str
    enqueued_at: datetime | None = None
    result: Any = None
    error: str | None = None
    queue_name: str | None = None


def _serialize_datetime(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _get_connection():
    if not settings.REDIS_ENABLED:
        return None
    if redis is None:
        return None
    try:
        conn = redis.Redis.from_url(settings.REDIS_URL, decode_responses=False)
        conn.ping()
        return conn
    except Exception as exc:
        logger.warning("RQ Redis unavailable: %s", exc)
        return None


def get_queue() -> Optional[Any]:
    if settings.TESTING:
        return None
    if Queue is None:
        return None
    conn = _get_connection()
    if not conn:
        return None
    return Queue(
        settings.RQ_QUEUE_NAME,
        connection=conn,
        default_timeout=settings.RQ_DEFAULT_TIMEOUT,
    )


def _store_inline_job(
    job_id: str,
    status: str,
    *,
    result: Any = None,
    error: str | None = None,
    meta: Optional[dict[str, Any]] = None,
) -> None:
    record = INLINE_JOBS.setdefault(job_id, {"id": job_id, "backend": "inline"})
    record["status"] = status
    record.setdefault("queued_at", _utc_now())
    if meta:
        record.setdefault("meta", {}).update(meta)
    if status == "running":
        record["started_at"] = _utc_now()
    if status in {"succeeded", "failed"}:
        record["ended_at"] = _utc_now()
    if result is not None:
        record["result"] = result
    if error is not None:
        record["error"] = error


def enqueue_job(
    func: Callable[..., Any],
    *args,
    meta: Optional[dict[str, Any]] = None,
    job_timeout: Optional[int] = None,
    **kwargs,
) -> JobHandle:
    queue = get_queue()
    retry_delays = getattr(settings, "RQ_RETRY_DELAYS", None) or []

    if queue:
        retry = None
        if Retry is not None and retry_delays:
            retry = Retry(max=len(retry_delays), interval=retry_delays)

        job = queue.enqueue(
            func,
            *args,
            retry=retry,
            meta=meta or {},
            job_timeout=job_timeout or settings.RQ_DEFAULT_TIMEOUT,
            **kwargs,
        )
        logger.info(
            "Enqueued job %s for %s",
            job.id,
            getattr(func, "__name__", str(func)),
            extra={
                "event_type": "job_enqueue",
                "job_id": job.id,
                "user_id": (meta or {}).get("user_id"),
            },
        )
        return JobHandle(
            id=job.id,
            backend="rq",
            status="queued",
            enqueued_at=job.enqueued_at,
            queue_name=queue.name,
        )

    if not settings.is_dev:
        raise RuntimeError("Background queue is unavailable")

    job_id = f"inline-{uuid.uuid4().hex}"
    inline_meta = dict(meta or {})
    _store_inline_job(job_id, "queued", meta=inline_meta)
    try:
        _store_inline_job(job_id, "running", meta=inline_meta)
        result = func(*args, **kwargs)
        _store_inline_job(job_id, "succeeded", result=result)
        return JobHandle(id=job_id, backend="inline", status="succeeded", enqueued_at=INLINE_JOBS[job_id]["queued_at"], result=result)
    except Exception as exc:
        logger.exception(
            "Inline job %s failed",
            job_id,
            extra={"event_type": "job_failed", "job_id": job_id, "user_id": inline_meta.get("user_id")},
        )
        _store_inline_job(job_id, "failed", error=str(exc))
        return JobHandle(id=job_id, backend="inline", status="failed", enqueued_at=INLINE_JOBS[job_id]["queued_at"], error=str(exc))


def set_job_progress(progress: Optional[float] = None, message: Optional[str] = None, **extra: Any) -> None:
    job = get_current_job()
    if not job:
        return
    if progress is not None:
        job.meta["progress"] = progress
    if message is not None:
        job.meta["message"] = message
    if extra:
        job.meta.update(extra)
    job.save_meta()


def get_job_status(job_id: str) -> dict[str, Any] | None:
    if job_id in INLINE_JOBS:
        record = INLINE_JOBS[job_id]
        return {
            "job_id": record["id"],
            "backend": record["backend"],
            "status": record.get("status", "queued"),
            "queued_at": _serialize_datetime(record.get("queued_at")),
            "started_at": _serialize_datetime(record.get("started_at")),
            "completed_at": _serialize_datetime(record.get("ended_at")),
            "result": record.get("result"),
            "error": record.get("error"),
            "progress": record.get("progress"),
            "owner_user_id": record.get("meta", {}).get("user_id"),
        }

    conn = _get_connection()
    if not conn or Job is None:
        return None

    try:
        job = Job.fetch(job_id, connection=conn)
    except Exception:
        return None

    raw_status = job.get_status(refresh=True)
    status_map = {
        "queued": "queued",
        "scheduled": "queued",
        "deferred": "queued",
        "started": "running",
        "finished": "succeeded",
        "failed": "failed",
        "stopped": "failed",
        "canceled": "failed",
    }

    result: Any = job.result if raw_status == "finished" else None
    error = job.exc_info if raw_status == "failed" else None
    return {
        "job_id": job.id,
        "backend": "rq",
        "status": status_map.get(raw_status, raw_status),
        "queued_at": _serialize_datetime(job.enqueued_at),
        "started_at": _serialize_datetime(job.started_at),
        "completed_at": _serialize_datetime(job.ended_at),
        "result": result,
        "error": error,
        "progress": job.meta.get("progress"),
        "message": job.meta.get("message"),
        "owner_user_id": job.meta.get("user_id"),
    }


def build_job_response(handle: JobHandle, *, status_url: str) -> dict[str, Any]:
    return {
        "job_id": handle.id,
        "status": handle.status,
        "backend": handle.backend,
        "queued_at": _serialize_datetime(handle.enqueued_at),
        "status_url": status_url,
        "result": handle.result,
        "error": handle.error,
    }
