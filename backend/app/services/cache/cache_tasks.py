import logging
import threading

from ...database.connection import SessionLocal
from ...database.models import User
from .cache_builder import CacheBuilder

logger = logging.getLogger(__name__)


def rebuild_user_caches_task(user_id: int, mode: str = "full") -> None:
    """
    Queue cache rebuild in a detached thread to avoid blocking the request thread.
    """
    thread = threading.Thread(target=_rebuild_user_caches, args=(user_id, mode), daemon=True)
    thread.start()


def _rebuild_user_caches(user_id: int, mode: str = "full") -> None:
    """
    Background task to rebuild all caches for a user.
    """
    db = SessionLocal()
    try:
        logger.info("[Background] Starting cache rebuild for user %s (mode=%s)", user_id, mode)

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

        db.commit()
    except Exception as exc:
        logger.error("[Background] Cache rebuild failed for user %s: %s", user_id, exc, exc_info=True)
        db.rollback()
    finally:
        db.close()


def rebuild_power_curve_cache_task(user_id: int) -> None:
    """Queue a power curve cache rebuild in a detached thread."""
    thread = threading.Thread(target=_rebuild_power_curve_cache, args=(user_id,), daemon=True)
    thread.start()


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
