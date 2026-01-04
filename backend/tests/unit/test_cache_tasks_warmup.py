from datetime import datetime, timedelta

import pytest
from fastapi import BackgroundTasks
from sqlalchemy.orm import sessionmaker

from app.database.models import User
from app.services.cache import cache_tasks, cache_warmup


class StubCacheBuilder:
    def __init__(self, db):
        self.db = db
        self.rebuilt = False

    def rebuild_after_import(self, user, mode="full"):
        self.rebuilt = True
        return {
            "success": True,
            "operations": {"power_curve": {"success": True}},
            "duration_seconds": 0.01,
        }

    def build_power_curve_cache(self, user):
        return True

    def is_cache_valid(self, user, max_age_hours=24):
        return False

    def build_all_cache(self, user):
        return {"success": True}


class FakeCacheManager:
    def __init__(self):
        self.redis = True
        self.locks = set()
        self.data = {}

    def acquire_lock(self, user_id, ttl_seconds=60, suffix="lock"):
        key = (user_id, suffix)
        if key in self.locks:
            return False
        self.locks.add(key)
        return True

    def release_lock(self, user_id, suffix="lock"):
        self.locks.discard((user_id, suffix))

    def get(self, key, user_id, max_age_hours=None):
        return self.data.get((user_id, key))


class ImmediateThread:
    def __init__(self, target=None, args=(), daemon=True):
        self.target = target
        self.args = args

    def start(self):
        if self.target:
            self.target(*self.args)


def _create_user(db):
    user = User(
        username="cacheuser",
        email="cache@example.com",
        hashed_password="hashed",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_rebuild_user_caches_task_executes(test_engine, monkeypatch):
    SessionLocal = sessionmaker(bind=test_engine)
    db = SessionLocal()
    user = _create_user(db)

    monkeypatch.setattr(cache_tasks, "SessionLocal", lambda: db)
    monkeypatch.setattr(cache_tasks, "CacheBuilder", StubCacheBuilder)
    monkeypatch.setattr(cache_tasks.threading, "Thread", ImmediateThread)

    cache_tasks.rebuild_user_caches_task(user.id)


def test_rebuild_power_curve_cache_task_executes(test_engine, monkeypatch):
    SessionLocal = sessionmaker(bind=test_engine)
    db = SessionLocal()
    user = _create_user(db)

    monkeypatch.setattr(cache_tasks, "SessionLocal", lambda: db)
    monkeypatch.setattr(cache_tasks, "CacheBuilder", StubCacheBuilder)
    monkeypatch.setattr("app.services.cache.cache_manager.CacheManager", FakeCacheManager)
    monkeypatch.setattr(cache_tasks.threading, "Thread", ImmediateThread)

    cache_tasks.rebuild_power_curve_cache_task(user.id)


def test_schedule_cache_warmup_adds_task(monkeypatch):
    bg = BackgroundTasks()
    fake_manager = FakeCacheManager()

    monkeypatch.setattr(cache_warmup, "CacheManager", lambda: fake_manager)
    monkeypatch.setattr(cache_warmup.settings, "CACHE_WARMUP_ENABLED", True)
    monkeypatch.setattr(cache_warmup.settings, "CACHE_WARMUP_MAX_AGE_HOURS", 1)

    cache_warmup.schedule_cache_warmup(bg, user_id=123)
    assert len(bg.tasks) == 1


def test_warm_cache_for_user_runs(monkeypatch, test_engine):
    SessionLocal = sessionmaker(bind=test_engine)
    db = SessionLocal()
    user = _create_user(db)

    fake_manager = FakeCacheManager()
    monkeypatch.setattr(cache_warmup, "CacheManager", lambda: fake_manager)
    monkeypatch.setattr(cache_warmup, "SessionLocal", lambda: db)
    monkeypatch.setattr(cache_warmup, "CacheBuilder", StubCacheBuilder)
    monkeypatch.setattr(cache_warmup.settings, "CACHE_WARMUP_DELAY_SECONDS", 0)
    monkeypatch.setattr(cache_warmup.settings, "CACHE_WARMUP_LOCK_SECONDS", 60)
    monkeypatch.setattr(cache_warmup.settings, "CACHE_WARMUP_MAX_AGE_HOURS", 1)

    cache_warmup._warm_cache_for_user(user.id)
