import logging
import threading
import time

from fastapi import BackgroundTasks

from ...core.config import settings
from ...database.connection import SessionLocal
from ...database.models import User
from .cache_builder import CacheBuilder
from .cache_manager import CacheManager

logger = logging.getLogger(__name__)


def schedule_cache_warmup(background_tasks: BackgroundTasks, user_id: int) -> None:
    if not settings.CACHE_WARMUP_ENABLED:
        return

    cache_manager = CacheManager()
    if not cache_manager.redis:
        return

    cache_built_at = cache_manager.get(
        "cache_built_at",
        user_id,
        max_age_hours=settings.CACHE_WARMUP_MAX_AGE_HOURS,
    )
    if cache_built_at is not None:
        return

    background_tasks.add_task(_start_warmup_thread, user_id)


def _start_warmup_thread(user_id: int) -> None:
    thread = threading.Thread(target=_warm_cache_for_user, args=(user_id,), daemon=True)
    thread.start()


def _warm_cache_for_user(user_id: int) -> None:
    cache_manager = CacheManager()
    if not cache_manager.redis:
        return

    if settings.CACHE_WARMUP_DELAY_SECONDS > 0:
        time.sleep(settings.CACHE_WARMUP_DELAY_SECONDS)

    lock_acquired = cache_manager.acquire_lock(
        user_id,
        ttl_seconds=settings.CACHE_WARMUP_LOCK_SECONDS,
        suffix="cache_warmup",
    )
    if not lock_acquired:
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return

        cache_builder = CacheBuilder(db)
        if cache_builder.is_cache_valid(user, settings.CACHE_WARMUP_MAX_AGE_HOURS):
            return

        logger.info("Starting cache warmup for user %s", user_id)
        cache_builder.build_all_cache(user)
    except Exception as exc:
        logger.exception("Cache warmup failed for user %s: %s", user_id, exc)
    finally:
        cache_manager.release_lock(user_id, suffix="cache_warmup")
        db.close()
