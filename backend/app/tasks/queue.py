import logging
from typing import Any, Callable, Optional

from ..core.config import settings

try:
    from rq import Queue, Retry
except Exception:  # pragma: no cover - optional dependency
    Queue = None
    Retry = None

try:
    import redis
except Exception:  # pragma: no cover - optional dependency
    redis = None

logger = logging.getLogger(__name__)


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


def enqueue_job(func: Callable[..., Any], *args, **kwargs) -> bool:
    queue = get_queue()
    if not queue:
        return False

    retry_delays = getattr(settings, "RQ_RETRY_DELAYS", None) or []
    retry = None
    if Retry is not None and retry_delays:
        retry = Retry(max=len(retry_delays), interval=retry_delays)

    try:
        job = queue.enqueue(func, *args, retry=retry, **kwargs)
        logger.info("Enqueued job %s for %s", job.id, getattr(func, "__name__", str(func)))
        return True
    except Exception as exc:
        logger.warning("Failed to enqueue job for %s: %s", getattr(func, "__name__", str(func)), exc)
        return False
