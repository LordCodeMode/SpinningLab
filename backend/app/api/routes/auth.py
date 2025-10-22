from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from pydantic import BaseModel
from typing import Optional

from ...database.connection import get_db
from ...database.models import User
from ...services.auth_service import AuthService
from ...core.security import create_access_token
from ...core.config import settings
from ...api.dependencies import get_current_active_user

# Pydantic models
class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    is_active: bool
    ftp: Optional[float] = 250
    weight: Optional[float] = 70
    hr_max: Optional[int] = 190
    hr_rest: Optional[int] = 60

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

router = APIRouter()

@router.post("/register", response_model=dict)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    auth_service = AuthService(db)
    
    # Check if user already exists
    if auth_service.get_user_by_username(user_data.username):
        raise HTTPException(
            status_code=400,
            detail="Username already exists"
        )
    
    # Create user
    user = auth_service.create_user(
        username=user_data.username,
        password=user_data.password,
        email=user_data.email
    )
    
    return {"message": "User created successfully", "user_id": user.id}

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login user and return JWT token."""
    auth_service = AuthService(db)
    
    # Authenticate user
    user = auth_service.authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, 
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Get current user information."""
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        is_active=current_user.is_active,
        ftp=current_user.ftp or 250,
        weight=current_user.weight or 70,
        hr_max=current_user.hr_max or 190,
        hr_rest=current_user.hr_rest or 60
    )