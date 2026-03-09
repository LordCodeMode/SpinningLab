from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from ..database.connection import SessionLocal
from ..database.models import Activity, User
from ..services.cache.cache_tasks import run_cache_rebuild_two_stage_job
from ..services.fit_processing.fit_import_service import FitImportService
from ..services.storage_service import build_fit_file_key, storage_service
from ..services.strava_service import strava_service
from .queue import set_job_progress

logger = logging.getLogger(__name__)


def _run_async(coro):
    return asyncio.run(coro)


def run_fit_import_job(user_id: int, staged_files: list[dict[str, Any]]) -> dict[str, Any]:
    db: Session = SessionLocal()
    import_service = FitImportService(db)
    results: list[dict[str, Any]] = []
    successful_imports = 0

    try:
        logger.info(
            "Starting FIT import job",
            extra={"event_type": "fit_import_start", "user_id": user_id},
        )
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")

        total_files = max(len(staged_files), 1)
        for index, item in enumerate(staged_files, start=1):
            storage_key = item["storage_key"]
            file_hash = item["file_hash"]
            filename = item["filename"]
            file_size = item["file_size"]
            set_job_progress(
                progress=min(0.8, index / total_files * 0.8),
                message=f"Processing {filename}",
                processed=index - 1,
                total=total_files,
            )

            existing_activity = (
                db.query(Activity)
                .filter(Activity.user_id == user_id, Activity.file_hash == file_hash)
                .first()
            )
            if existing_activity:
                results.append(
                    {
                        "filename": filename,
                        "success": False,
                        "message": "File already imported (duplicate hash)",
                        "activity_id": existing_activity.id,
                    }
                )
                storage_service.delete(storage_key)
                continue

            try:
                with storage_service.download_to_temp_path(storage_key, suffix=".fit") as temp_path:
                    result = import_service.process_fit_file(
                        file_path=temp_path,
                        user=user,
                        file_hash=file_hash,
                        file_size=file_size,
                        original_filename=filename,
                    )

                if result.success:
                    successful_imports += 1
                    final_key = build_fit_file_key(user_id, file_hash)
                    if not storage_service.exists(final_key):
                        storage_service.copy(storage_key, final_key)

                results.append(
                    {
                        "filename": filename,
                        "success": result.success,
                        "message": result.message,
                        "activity_id": result.activity_id,
                    }
                )
            except Exception as exc:
                logger.exception(
                    "FIT import job failed for %s",
                    filename,
                    extra={"event_type": "fit_import_error", "user_id": user_id},
                )
                results.append(
                    {
                        "filename": filename,
                        "success": False,
                        "message": f"Error processing file: {exc}",
                    }
                )
            finally:
                storage_service.delete(storage_key)

        cache_rebuild_triggered = successful_imports > 0
        if cache_rebuild_triggered:
            set_job_progress(progress=0.9, message="Rebuilding caches")
            run_cache_rebuild_two_stage_job(user_id)

        payload = {
            "results": results,
            "total": len(staged_files),
            "successful": successful_imports,
            "failed": len(staged_files) - successful_imports,
            "cache_rebuild_triggered": cache_rebuild_triggered,
            "message": (
                f"Imported {successful_imports} files. Cache rebuild completed."
                if cache_rebuild_triggered
                else "No new files imported."
            ),
        }
        logger.info(
            "Completed FIT import job",
            extra={"event_type": "fit_import_complete", "user_id": user_id},
        )
        set_job_progress(progress=1.0, message="FIT import completed", result=payload)
        return payload
    finally:
        db.close()


def run_strava_sync_job(user_id: int, after_iso: Optional[str] = None, limit: Optional[int] = None) -> dict[str, Any]:
    db: Session = SessionLocal()
    try:
        logger.info(
            "Starting Strava sync job",
            extra={"event_type": "strava_sync_start", "user_id": user_id},
        )
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")
        if not user.strava_athlete_id:
            raise ValueError("Not connected to Strava")

        after_date = None
        if after_iso:
            after_date = datetime.fromisoformat(after_iso)
        elif user.strava_last_sync:
            after_date = user.strava_last_sync
        else:
            latest = (
                db.query(Activity.start_time)
                .filter(Activity.user_id == user_id, Activity.strava_activity_id.isnot(None))
                .order_by(Activity.start_time.desc())
                .first()
            )
            if latest and latest[0]:
                after_date = latest[0] - timedelta(seconds=1)

        set_job_progress(progress=0.1, message="Syncing Strava activities")
        result = _run_async(
            strava_service.import_user_activities(
                user=user,
                db=db,
                after=after_date,
                limit=limit,
            )
        )
        user.strava_last_sync = datetime.now(timezone.utc)
        db.commit()

        if result.get("imported", 0) > 0:
            set_job_progress(progress=0.9, message="Rebuilding caches")
            run_cache_rebuild_two_stage_job(user_id)

        payload = {
            "success": True,
            "message": f"Imported {result['imported']} activities from Strava",
            "stats": result,
            "cache_rebuild_triggered": result.get("imported", 0) > 0,
        }
        logger.info(
            "Completed Strava sync job",
            extra={"event_type": "strava_sync_complete", "user_id": user_id},
        )
        set_job_progress(progress=1.0, message="Strava sync completed", result=payload)
        return payload
    finally:
        db.close()
