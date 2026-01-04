import hashlib
import logging
import pickle
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Dict

from ...core.config import settings

try:
    import redis
except Exception:  # pragma: no cover - optional dependency
    redis = None

logger = logging.getLogger(__name__)


class CacheManager:
    def __init__(self, redis_url: Optional[str] = None, key_prefix: Optional[str] = None):
        self.redis_url = redis_url or settings.REDIS_URL
        self.key_prefix = key_prefix or settings.REDIS_KEY_PREFIX
        self.redis = None

        if not settings.REDIS_ENABLED:
            logger.info("Redis caching disabled via config")
            return

        if redis is None:
            logger.warning("redis-py not installed; caching disabled")
            return

        try:
            self.redis = redis.Redis.from_url(self.redis_url, decode_responses=False)
            self.redis.ping()
        except Exception as exc:
            logger.warning("Redis unavailable; caching disabled: %s", exc)
            self.redis = None

    def _build_key(self, key: str, user_id: int) -> str:
        """Build a Redis key namespace for the user and cache key."""
        cleaned = key.strip()
        if len(cleaned) > 120:
            key_hash = hashlib.md5(cleaned.encode("utf-8")).hexdigest()
            cleaned = f"{cleaned[:40]}:{key_hash}"
        return f"{self.key_prefix}:user:{user_id}:{cleaned}"

    def _lock_key(self, user_id: int, suffix: str = "cache_warmup") -> str:
        return f"{self.key_prefix}:lock:{suffix}:{user_id}"

    def acquire_lock(self, user_id: int, ttl_seconds: int = 3600, suffix: str = "cache_warmup") -> bool:
        if not self.redis:
            return False
        lock_key = self._lock_key(user_id, suffix)
        try:
            return bool(self.redis.set(lock_key, "1", nx=True, ex=ttl_seconds))
        except Exception as exc:
            logger.warning("Error acquiring cache lock %s: %s", lock_key, exc)
            return False

    def release_lock(self, user_id: int, suffix: str = "cache_warmup") -> None:
        if not self.redis:
            return
        lock_key = self._lock_key(user_id, suffix)
        try:
            self.redis.delete(lock_key)
        except Exception as exc:
            logger.warning("Error releasing cache lock %s: %s", lock_key, exc)

    def _wrap_payload(self, data: Any) -> bytes:
        payload = {
            "cached_at": time.time(),
            "data": data,
        }
        return pickle.dumps(payload, protocol=pickle.HIGHEST_PROTOCOL)

    def _unwrap_payload(self, raw: bytes) -> Any:
        try:
            decoded = pickle.loads(raw)
        except Exception:
            return None

        if isinstance(decoded, dict) and "data" in decoded and "cached_at" in decoded:
            return decoded

        return {"cached_at": None, "data": decoded}

    def get(self, key: str, user_id: int, max_age_hours: int = 24) -> Optional[Any]:
        """Get cached data if it exists and is not expired."""
        if not self.redis:
            return None

        cache_key = self._build_key(key, user_id)
        try:
            raw = self.redis.get(cache_key)
            if raw is None:
                return None

            decoded = self._unwrap_payload(raw)
            cached_at = decoded.get("cached_at")
            if cached_at is not None:
                cache_age = datetime.now(timezone.utc) - datetime.fromtimestamp(cached_at, timezone.utc)
                if cache_age > timedelta(hours=max_age_hours):
                    self.redis.delete(cache_key)
                    return None

            return decoded.get("data")
        except Exception as exc:
            logger.warning("Error reading cache %s: %s", cache_key, exc)
            return None

    def get_with_meta(self, key: str, user_id: int) -> tuple[Optional[Any], Optional[float]]:
        """Get cached data and cached_at without expiring."""
        if not self.redis:
            return None, None

        cache_key = self._build_key(key, user_id)
        try:
            raw = self.redis.get(cache_key)
            if raw is None:
                return None, None

            decoded = self._unwrap_payload(raw)
            cached_at = decoded.get("cached_at")
            return decoded.get("data"), cached_at
        except Exception as exc:
            logger.warning("Error reading cache %s: %s", cache_key, exc)
            return None, None

    def set(self, key: str, user_id: int, data: Any) -> bool:
        """Set cached data."""
        if not self.redis:
            return False

        cache_key = self._build_key(key, user_id)
        try:
            self.redis.set(cache_key, self._wrap_payload(data))
            return True
        except Exception as exc:
            logger.warning("Error writing cache %s: %s", cache_key, exc)
            return False

    def delete(self, key: str, user_id: int) -> bool:
        """Delete cached data."""
        if not self.redis:
            return True

        cache_key = self._build_key(key, user_id)
        try:
            self.redis.delete(cache_key)
            return True
        except Exception as exc:
            logger.warning("Error deleting cache %s: %s", cache_key, exc)
            return False

    def clear_user_cache(self, user_id: int) -> bool:
        """Clear all cache for a user."""
        if not self.redis:
            return True

        pattern = f"{self.key_prefix}:user:{user_id}:*"
        try:
            cursor = 0
            keys = []
            while True:
                cursor, batch = self.redis.scan(cursor=cursor, match=pattern, count=500)
                if batch:
                    keys.extend(batch)
                if cursor == 0:
                    break

            if keys:
                self.redis.delete(*keys)
            return True
        except Exception as exc:
            logger.warning("Error clearing cache for user %s: %s", user_id, exc)
            return False

    def get_cache_info(self, user_id: int) -> Dict[str, Any]:
        """Get information about cached data for a user."""
        if not self.redis:
            return {"files": 0, "total_size": 0, "files_list": []}

        pattern = f"{self.key_prefix}:user:{user_id}:*"
        try:
            cursor = 0
            keys = []
            while True:
                cursor, batch = self.redis.scan(cursor=cursor, match=pattern, count=500)
                if batch:
                    keys.extend(batch)
                if cursor == 0:
                    break

            if not keys:
                return {"files": 0, "total_size": 0, "files_list": []}

            pipeline = self.redis.pipeline()
            for key in keys:
                pipeline.strlen(key)
                pipeline.get(key)
            results = pipeline.execute()

            files_list = []
            total_size = 0

            for idx, key in enumerate(keys):
                size = results[idx * 2] or 0
                raw = results[idx * 2 + 1]
                total_size += size

                cached_at = None
                if raw:
                    decoded = self._unwrap_payload(raw)
                    cached_at = decoded.get("cached_at")

                if isinstance(key, bytes):
                    key_str = key.decode("utf-8", errors="ignore")
                else:
                    key_str = str(key)

                display_name = key_str.replace(f"{self.key_prefix}:user:{user_id}:", "", 1)

                files_list.append({
                    "name": display_name,
                    "size": size,
                    "modified": datetime.fromtimestamp(cached_at, timezone.utc).isoformat() if cached_at else None,
                })

            return {
                "files": len(files_list),
                "total_size": total_size,
                "files_list": files_list,
            }
        except Exception as exc:
            logger.warning("Error reading cache info for user %s: %s", user_id, exc)
            return {"files": 0, "total_size": 0, "files_list": []}
