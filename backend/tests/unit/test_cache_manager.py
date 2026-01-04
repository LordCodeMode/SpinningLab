"""Unit tests for cache manager."""

import pickle

import pytest

from app.services.cache import cache_manager as cache_module


class DummyPipeline:
    def __init__(self, store):
        self._store = store
        self._commands = []

    def strlen(self, key):
        self._commands.append(("strlen", key))
        return self

    def get(self, key):
        self._commands.append(("get", key))
        return self

    def execute(self):
        results = []
        for cmd, key in self._commands:
            if cmd == "strlen":
                raw = self._store.get(key)
                results.append(len(raw) if raw else 0)
            elif cmd == "get":
                results.append(self._store.get(key))
        return results


class DummyRedis:
    def __init__(self):
        self.store = {}

    def ping(self):
        return True

    def set(self, key, value, nx=False, ex=None):
        if nx and key in self.store:
            return False
        self.store[key] = value
        return True

    def get(self, key):
        return self.store.get(key)

    def delete(self, *keys):
        for key in keys:
            self.store.pop(key, None)

    def scan(self, cursor=0, match=None, count=500):
        keys = list(self.store.keys())
        if match:
            prefix = match.rstrip("*")
            keys = [k for k in keys if k.startswith(prefix)]
        return 0, keys

    def pipeline(self):
        return DummyPipeline(self.store)


class DummyRedisModule:
    class Redis:
        @staticmethod
        def from_url(url, decode_responses=False):
            return DummyRedis()


def make_manager(monkeypatch):
    monkeypatch.setattr(cache_module, "redis", DummyRedisModule)
    return cache_module.CacheManager(redis_url="redis://dummy", key_prefix="td")


def test_cache_set_get_delete(monkeypatch):
    manager = make_manager(monkeypatch)
    assert manager.set("sample_key", 1, {"value": 42}) is True
    assert manager.get("sample_key", 1) == {"value": 42}
    assert manager.delete("sample_key", 1) is True
    assert manager.get("sample_key", 1) is None


def test_cache_key_hashing(monkeypatch):
    manager = make_manager(monkeypatch)
    long_key = "x" * 140
    built = manager._build_key(long_key, 9)
    assert built.startswith("td:user:9:")
    assert len(built) < len(long_key) + 20


def test_cache_locking(monkeypatch):
    manager = make_manager(monkeypatch)
    assert manager.acquire_lock(7, ttl_seconds=10) is True
    assert manager.acquire_lock(7, ttl_seconds=10) is False
    manager.release_lock(7)
    assert manager.acquire_lock(7, ttl_seconds=10) is True


def test_cache_info(monkeypatch):
    manager = make_manager(monkeypatch)
    manager.set("alpha", 2, {"value": 1})
    manager.set("beta", 2, {"value": 2})
    info = manager.get_cache_info(2)
    assert info["files"] == 2
    assert info["total_size"] > 0
    names = {item["name"] for item in info["files_list"]}
    assert {"alpha", "beta"} <= names


def test_cache_payload_wrap_unwrap(monkeypatch):
    manager = make_manager(monkeypatch)
    payload = manager._wrap_payload({"ok": True})
    decoded = pickle.loads(payload)
    assert "cached_at" in decoded
    assert decoded["data"] == {"ok": True}
    assert manager._unwrap_payload(payload)["data"] == {"ok": True}
