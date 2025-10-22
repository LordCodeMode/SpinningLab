# ============================================
# FILE: backend/app/api/routes/import_routes.py
# Import routes with automatic cache rebuilding
# ============================================

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import os
import hashlib
import tempfile
import logging

from ...database.connection import get_db
from ...database.models import User, Activity
from ...api.dependencies import get_current_active_user
from ...services.fit_processing.fit_import_service import FitImportService
from ...services.cache.cache_builder import CacheBuilder
from ...core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/fit-files")
async def import_fit_files(
    background_tasks: BackgroundTasks,
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
    
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    # Validate file types
    for file in files:
        if not file.filename.lower().endswith('.fit'):
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type: {file.filename}. Only .fit files are allowed."
            )
    
    # Create user directory
    user_fit_dir = os.path.join(settings.FIT_FILES_DIR, str(current_user.id))
    os.makedirs(user_fit_dir, exist_ok=True)
    
    import_service = FitImportService(db)
    results = []
    successful_imports = 0
    
    for file in files:
        try:
            # Read file content
            content = await file.read()
            file_hash = hashlib.md5(content).hexdigest()
            
            # Check for duplicates
            existing_activity = db.query(Activity).filter(
                Activity.user_id == current_user.id,
                Activity.file_hash == file_hash
            ).first()
            
            if existing_activity:
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "message": "File already imported (duplicate hash)"
                })
                continue
            
            # Save file to disk temporarily
            with tempfile.NamedTemporaryFile(delete=False, suffix='.fit') as temp_file:
                temp_file.write(content)
                temp_path = temp_file.name
            
            try:
                # Process the FIT file
                result = import_service.process_fit_file(
                    file_path=temp_path,
                    user=current_user,
                    file_hash=file_hash,
                    file_size=len(content),
                    original_filename=file.filename
                )
                
                if result.success:
                    successful_imports += 1
                
                results.append({
                    "filename": file.filename,
                    "success": result.success,
                    "message": result.message,
                    "activity_id": result.activity_id
                })
                
            finally:
                # Clean up temp file
                os.unlink(temp_path)
                
        except Exception as e:
            logger.error(f"Error processing {file.filename}: {e}")
            results.append({
                "filename": file.filename,
                "success": False,
                "message": f"Error processing file: {str(e)}"
            })
    
    # =========================================
    # CRITICAL: Trigger cache rebuild in background
    # =========================================
    if successful_imports > 0:
        logger.info(f"Triggering cache rebuild for user {current_user.id} after {successful_imports} successful imports")
        
        # Add cache rebuild task to background
        background_tasks.add_task(
            rebuild_user_caches_task,
            user_id=current_user.id
        )
    
    return {
        "results": results,
        "total": len(files),
        "successful": successful_imports,
        "failed": len(files) - successful_imports,
        "cache_rebuild_triggered": successful_imports > 0,
        "message": f"Imported {successful_imports} files. Cache rebuild initiated in background." if successful_imports > 0 else "No new files imported."
    }


@router.post("/rebuild-cache")
async def rebuild_cache_endpoint(
    background_tasks: BackgroundTasks,
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
    
    # Trigger rebuild in background
    background_tasks.add_task(
        rebuild_user_caches_task,
        user_id=current_user.id
    )
    
    return {
        "success": True,
        "message": "Cache rebuild initiated in background. This may take a few seconds.",
        "user_id": current_user.id
    }


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


# =========================================
# BACKGROUND TASK
# =========================================

def rebuild_user_caches_task(user_id: int):
    """
    Background task to rebuild all caches for a user.
    
    This runs asynchronously after FIT file import completes.
    It rebuilds:
    - Training load (CTL/ATL/TSB) - CRITICAL for form tracking
    - Power curve - includes new peak power values
    - Critical power model
    - Efficiency metrics
    - VO2Max estimates
    - Zone distributions
    - Activity summaries
    """
    # Create new database session for background task
    from ...database.connection import SessionLocal
    db = SessionLocal()
    
    try:
        logger.info(f"[Background] Starting cache rebuild for user {user_id}")
        
        # Get user
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.error(f"[Background] User {user_id} not found")
            return
        
        # Rebuild all caches
        cache_builder = CacheBuilder(db)
        result = cache_builder.rebuild_after_import(user)
        
        # Log results
        if result["success"]:
            logger.info(
                f"[Background] Cache rebuild completed successfully for user {user_id} "
                f"in {result['duration_seconds']:.2f}s"
            )
        else:
            failed_ops = [
                name for name, op in result["operations"].items() 
                if not op.get("success", False)
            ]
            logger.warning(
                f"[Background] Cache rebuild completed with {len(failed_ops)} failures "
                f"for user {user_id}: {', '.join(failed_ops)}"
            )
        
        # Commit any changes
        db.commit()
        
    except Exception as e:
        logger.error(f"[Background] Cache rebuild failed for user {user_id}: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()