# ============================================
# FILE: backend/app/api/routes/import_routes.py
# Import routes with automatic cache rebuilding
# ============================================

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
import hashlib
import logging

from ...database.connection import get_db
from ...database.models import User, Activity
from ...api.dependencies import get_current_active_user
from ...services.cache.cache_builder import CacheBuilder
from ...services.cache.cache_tasks import run_cache_rebuild_job
from ...services.storage_service import storage_service, build_fit_file_key
from ...tasks.queue import build_job_response, enqueue_job
from ...tasks.worker_jobs import run_fit_import_job

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/fit-files")
async def import_fit_files(
    request: Request,
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Import FIT files for the current user.

    After successful import, automatically triggers cache rebuild in background
    to ensure all analysis data (training load, power curve, etc.) is updated
    with the new activities.
    """

    # Maximum file size: 50MB per file (FIT files are typically 100KB-5MB)
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB in bytes

    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    # Limit number of files per request
    MAX_FILES_PER_REQUEST = 100
    if len(files) > MAX_FILES_PER_REQUEST:
        raise HTTPException(
            status_code=400,
            detail=f"Too many files. Maximum {MAX_FILES_PER_REQUEST} files per request."
        )

    # Validate file types and sizes
    for file in files:
        if not file.filename.lower().endswith('.fit'):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type: {file.filename}. Only .fit files are allowed."
            )
    
    staged_files = []
    
    for file in files:
        try:
            # Read file content
            content = await file.read()

            # Validate file size
            if len(content) > MAX_FILE_SIZE:
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "message": f"File too large. Maximum size is {MAX_FILE_SIZE / 1024 / 1024:.0f}MB"
                })
                continue

            # Check for empty files
            if len(content) == 0:
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "message": "File is empty"
                })
                continue

            file_hash = hashlib.md5(content).hexdigest()
            
            # Check for duplicates
            existing_activity = db.query(Activity).filter(
                Activity.user_id == current_user.id,
                Activity.file_hash == file_hash
            ).first()
            
            if existing_activity:
                staged_files.append({
                    "filename": file.filename,
                    "file_hash": file_hash,
                    "file_size": len(content),
                    "storage_key": None,
                    "duplicate": True,
                })
                continue

            staged_key = f"staged-imports/{current_user.id}/{file_hash}.fit"
            storage_service.put_bytes(staged_key, content, content_type="application/octet-stream")
            staged_files.append(
                {
                    "filename": file.filename,
                    "file_hash": file_hash,
                    "file_size": len(content),
                    "storage_key": staged_key,
                }
            )
                
        except Exception as e:
            logger.error(f"Error processing {file.filename}: {e}")
            staged_files.append(
                {
                    "filename": file.filename,
                    "file_hash": None,
                    "file_size": len(content) if isinstance(content, bytes) else 0,
                    "storage_key": None,
                    "error": f"Error processing file: {str(e)}",
                }
            )

    duplicates = [item for item in staged_files if item.get("duplicate")]
    errored = [item for item in staged_files if item.get("error")]
    queued = [item for item in staged_files if item.get("storage_key")]

    if not queued:
        results = [
            {
                "filename": item["filename"],
                "success": False,
                "message": item.get("error") or "File already imported (duplicate hash)",
            }
            for item in staged_files
        ]
        return {
            "results": results,
            "total": len(files),
            "successful": 0,
            "failed": len(errored),
            "cache_rebuild_triggered": False,
            "message": "No new files imported.",
        }

    job = enqueue_job(run_fit_import_job, current_user.id, queued, meta={"user_id": current_user.id})
    payload = build_job_response(job, status_url=f"/api/jobs/{job.id}")
    payload["message"] = f"Queued import of {len(queued)} FIT files."
    payload["duplicate_count"] = len(duplicates)
    payload["preflight_duplicates"] = [
        {"filename": item["filename"], "message": "File already imported (duplicate hash)"}
        for item in duplicates
    ]
    payload["preflight_errors"] = [
        {"filename": item["filename"], "message": item["error"]}
        for item in errored
    ]
    return JSONResponse(status_code=status.HTTP_202_ACCEPTED, content=payload)


@router.post("/rebuild-cache")
async def rebuild_cache_endpoint(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Manually trigger cache rebuild for current user.
    
    Useful for:
    - Fixing cache inconsistencies
    - Updating after settings changes (FTP, weight, etc.)
    - Forcing recalculation of all analysis data
    """
    
    logger.info(f"Manual cache rebuild requested by user {current_user.id}")
    
    job = enqueue_job(run_cache_rebuild_job, current_user.id, meta={"user_id": current_user.id})
    payload = build_job_response(job, status_url=f"/api/jobs/{job.id}")
    payload["message"] = "Cache rebuild queued."
    payload["user_id"] = current_user.id
    return JSONResponse(status_code=status.HTTP_202_ACCEPTED, content=payload)


@router.get("/cache-status")
async def get_cache_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get current cache status for the user.
    Shows when cache was last built and cache size.
    """
    
    try:
        cache_builder = CacheBuilder(db)
        status = cache_builder.get_cache_status(current_user)
        
        return status
    except Exception as e:
        logger.error(f"Error getting cache status: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting cache status: {str(e)}")
