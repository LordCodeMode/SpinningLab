import logging
import threading
from datetime import datetime

from ...database.connection import SessionLocal
from ...database.models import User
from .cache_builder import CacheBuilder
from ...tasks.queue import enqueue_job

logger = logging.getLogger(__name__)


def rebuild_user_caches_task(user_id: int, mode: str = "full") -> None:
    """
    Queue cache rebuild in a detached thread to avoid blocking the request thread.
    """
    if enqueue_job(run_cache_rebuild_job, user_id, mode=mode):
        return
    thread = threading.Thread(target=_rebuild_user_caches, args=(user_id, mode), daemon=True)
    thread.start()


def _rebuild_user_caches(user_id: int, mode: str = "full") -> None:
    """
    Background task to rebuild all caches for a user.
    """
    from .cache_manager import CacheManager

    cache_manager = CacheManager()
    db = SessionLocal()
    started_at = None
    try:
        logger.info("[Background] Starting cache rebuild for user %s (mode=%s)", user_id, mode)
        started_at = datetime.utcnow().isoformat() + "Z"
        cache_manager.set(
            "cache_rebuild_status",
            user_id,
            {"status": "running", "mode": mode, "started_at": started_at},
        )

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.error("[Background] User %s not found", user_id)
            return

        cache_builder = CacheBuilder(db)
        result = cache_builder.rebuild_after_import(user, mode=mode)

        if result["success"]:
            logger.info(
                "[Background] Cache rebuild completed successfully for user %s in %.2fs",
                user_id,
                result["duration_seconds"],
            )
            cache_manager.set(
                "cache_rebuild_status",
                user_id,
                {
                    "status": "success",
                    "mode": mode,
                    "started_at": started_at,
                    "completed_at": datetime.utcnow().isoformat() + "Z",
                    "duration_seconds": result.get("duration_seconds", 0.0),
                },
            )
        else:
            failed_ops = [
                name for name, op in result["operations"].items()
                if not op.get("success", False)
            ]
            logger.warning(
                "[Background] Cache rebuild completed with %s failures for user %s: %s",
                len(failed_ops),
                user_id,
                ", ".join(failed_ops),
            )
            cache_manager.set(
                "cache_rebuild_status",
                user_id,
                {
                    "status": "partial",
                    "mode": mode,
                    "started_at": started_at,
                    "completed_at": datetime.utcnow().isoformat() + "Z",
                    "duration_seconds": result.get("duration_seconds", 0.0),
                    "failed_operations": failed_ops,
                },
            )

        db.commit()
    except Exception as exc:
        logger.error("[Background] Cache rebuild failed for user %s: %s", user_id, exc, exc_info=True)
        cache_manager.set(
            "cache_rebuild_status",
            user_id,
            {
                "status": "failed",
                "mode": mode,
                "started_at": started_at,
                "completed_at": datetime.utcnow().isoformat() + "Z",
                "error": str(exc),
            },
        )
        db.rollback()
    finally:
        db.close()


def rebuild_user_caches_two_stage(user_id: int) -> None:
    """
    Run a fast rebuild immediately, then a full rebuild right after.
    Keeps the UI responsive while still guaranteeing full accuracy.
    """
    if enqueue_job(run_cache_rebuild_two_stage_job, user_id):
        return
    thread = threading.Thread(target=_rebuild_user_caches_two_stage, args=(user_id,), daemon=True)
    thread.start()


def _rebuild_user_caches_two_stage(user_id: int) -> None:
    from .cache_manager import CacheManager

    cache_manager = CacheManager()
    lock_acquired = True
    if cache_manager.redis:
        lock_acquired = cache_manager.acquire_lock(user_id, ttl_seconds=3600, suffix="cache_rebuild")
        if not lock_acquired:
            logger.info("[Background] Cache rebuild already running for user %s", user_id)
            return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.error("[Background] User %s not found", user_id)
            return

        cache_builder = CacheBuilder(db)

        logger.info("[Background] Starting cache rebuild for user %s (mode=fast)", user_id)
        cache_manager.set(
            "cache_rebuild_status",
            user_id,
            {"status": "running", "mode": "fast", "started_at": datetime.utcnow().isoformat() + "Z"},
        )
        fast_result = cache_builder.rebuild_after_import(user, mode="fast")
        if fast_result.get("success"):
            logger.info(
                "[Background] Fast cache rebuild completed for user %s in %.2fs",
                user_id,
                fast_result.get("duration_seconds", 0.0),
            )
        else:
            logger.warning("[Background] Fast cache rebuild completed with failures for user %s", user_id)

        logger.info("[Background] Starting cache rebuild for user %s (mode=full)", user_id)
        cache_manager.set(
            "cache_rebuild_status",
            user_id,
            {"status": "running", "mode": "full", "started_at": datetime.utcnow().isoformat() + "Z"},
        )
        full_result = cache_builder.rebuild_after_import(user, mode="full")
        if full_result.get("success"):
            logger.info(
                "[Background] Full cache rebuild completed for user %s in %.2fs",
                user_id,
                full_result.get("duration_seconds", 0.0),
            )
        else:
            failed_ops = [
                name for name, op in full_result.get("operations", {}).items()
                if not op.get("success", False)
            ]
            logger.warning(
                "[Background] Full cache rebuild completed with %s failures for user %s: %s",
                len(failed_ops),
                user_id,
                ", ".join(failed_ops),
            )
            cache_manager.set(
                "cache_rebuild_status",
                user_id,
                {
                    "status": "partial",
                    "mode": "full",
                    "started_at": datetime.utcnow().isoformat() + "Z",
                    "completed_at": datetime.utcnow().isoformat() + "Z",
                    "failed_operations": failed_ops,
                },
            )

        db.commit()
    except Exception as exc:
        logger.error("[Background] Two-stage cache rebuild failed for user %s: %s", user_id, exc, exc_info=True)
        cache_manager.set(
            "cache_rebuild_status",
            user_id,
            {
                "status": "failed",
                "mode": "two_stage",
                "started_at": datetime.utcnow().isoformat() + "Z",
                "completed_at": datetime.utcnow().isoformat() + "Z",
                "error": str(exc),
            },
        )
        db.rollback()
    finally:
        if cache_manager.redis and lock_acquired:
            cache_manager.release_lock(user_id, suffix="cache_rebuild")
        db.close()


def rebuild_power_curve_cache_task(user_id: int) -> None:
    """Queue a power curve cache rebuild in a detached thread."""
    if enqueue_job(run_power_curve_rebuild_job, user_id):
        return
    thread = threading.Thread(target=_rebuild_power_curve_cache, args=(user_id,), daemon=True)
    thread.start()


def run_cache_rebuild_job(user_id: int, mode: str = "full") -> None:
    _rebuild_user_caches(user_id, mode)


def run_cache_rebuild_two_stage_job(user_id: int) -> None:
    _rebuild_user_caches_two_stage(user_id)


def run_power_curve_rebuild_job(user_id: int) -> None:
    _rebuild_power_curve_cache(user_id)


def _rebuild_power_curve_cache(user_id: int) -> None:
    from .cache_manager import CacheManager

    cache_manager = CacheManager()
    if not cache_manager.redis:
        return

    if not cache_manager.acquire_lock(user_id, ttl_seconds=1800, suffix="power_curve_refresh"):
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return

        cache_builder = CacheBuilder(db)
        cache_builder.build_power_curve_cache(user)
    except Exception as exc:
        logger.exception("[Background] Power curve rebuild failed for user %s: %s", user_id, exc)
    finally:
        cache_manager.release_lock(user_id, suffix="power_curve_refresh")
        db.close()
