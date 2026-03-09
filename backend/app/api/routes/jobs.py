from fastapi import APIRouter, Depends, HTTPException

from ...api.dependencies import get_current_active_user
from ...database.models import User
from ...tasks.queue import get_job_status

router = APIRouter()


@router.get("/{job_id}")
async def get_job(job_id: str, current_user: User = Depends(get_current_active_user)):
    payload = get_job_status(job_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Job not found")
    owner_user_id = payload.get("owner_user_id")
    if owner_user_id is not None and owner_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Job not found")
    return payload
