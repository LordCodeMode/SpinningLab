from fastapi import FastAPI, APIRouter, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os

from .core.config import settings
from .database.connection import init_db, get_db
from .database.models import User


# Create directories if they don't exist
os.makedirs(settings.FIT_FILES_DIR, exist_ok=True)
os.makedirs(settings.CACHE_DIR, exist_ok=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Training Dashboard Pro API"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative React dev server
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://localhost:8080",  # Live server
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
init_db()

# Import and include routers
from .api.routes.auth import router as auth_router
from .api.routes.activities import router as activities_router  
from .api.routes.analysis import router as analysis_router
from .api.routes.import_routes import router as import_router
from .api.dependencies import get_current_active_user

app.include_router(auth_router, prefix="/api/auth", tags=["authentication"])
app.include_router(activities_router, prefix="/api/activities", tags=["activities"])
app.include_router(analysis_router, prefix="/api/analysis", tags=["analysis"])
app.include_router(import_router, prefix="/api/import", tags=["import"])

# Settings endpoint (simple inline implementation)
settings_router = APIRouter()

@settings_router.get("/")
async def get_settings(current_user: User = Depends(get_current_active_user)):
    return {
        "ftp": current_user.ftp or 250,
        "weight": current_user.weight or 70,
        "hr_max": current_user.hr_max or 190,
        "hr_rest": current_user.hr_rest or 60
    }

@settings_router.put("/")
async def update_settings(
    settings_data: dict,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Update user settings
    for key, value in settings_data.items():
        if hasattr(current_user, key) and value is not None:
            setattr(current_user, key, value)
    
    db.commit()
    db.refresh(current_user)
    
    return {
        "ftp": current_user.ftp or 250,
        "weight": current_user.weight or 70,
        "hr_max": current_user.hr_max or 190,
        "hr_rest": current_user.hr_rest or 60
    }

app.include_router(settings_router, prefix="/api/settings", tags=["settings"])

@app.get("/")
async def root():
    return {"message": "Training Dashboard Pro API", "version": settings.VERSION}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.VERSION}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)