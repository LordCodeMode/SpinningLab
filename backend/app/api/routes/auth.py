from datetime import timedelta, datetime
from typing import Optional
from urllib.parse import urlencode
import re

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from ...api.dependencies import get_current_active_user
from ...core.config import settings
from ...core.security import create_access_token, generate_one_time_token
from ...database.connection import get_db
from ...database.models import User
from ...services.auth_service import AuthService
from ...services.cache.cache_warmup import schedule_cache_warmup
from ...services.email_service import EmailService

limiter = Limiter(key_func=get_remote_address)
if settings.TESTING:
    limiter.enabled = False

LOCALHOST_ORIGIN_REGEX = re.compile(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$")


class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    name: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    name: Optional[str] = None
    is_active: bool
    is_email_verified: bool
    created_at: Optional[datetime] = None
    ftp: Optional[float] = 250
    weight: Optional[float] = 70
    hr_max: Optional[int] = 190
    hr_rest: Optional[int] = 60

    class Config:
        from_attributes = True


class AuthSessionResponse(BaseModel):
    message: str
    user: UserResponse


class PasswordResetRequest(BaseModel):
    email: str


class PasswordResetConfirm(BaseModel):
    token: str
    password: str


class EmailVerificationRequest(BaseModel):
    email: str


class EmailVerificationConfirm(BaseModel):
    token: str


router = APIRouter()


def _get_origin(request: Request) -> str | None:
    return request.headers.get("origin")


def _is_local_origin(request: Request) -> bool:
    origin = _get_origin(request)
    return bool(origin and LOCALHOST_ORIGIN_REGEX.match(origin))


def _request_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def _user_agent(request: Request) -> str | None:
    return request.headers.get("user-agent")


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        name=user.name,
        is_active=user.is_active,
        is_email_verified=user.is_email_verified,
        created_at=user.created_at,
        ftp=user.ftp or 250,
        weight=user.weight or 70,
        hr_max=user.hr_max or 190,
        hr_rest=user.hr_rest or 60,
    )


def _set_cookie(response: Response, key: str, value: str, max_age: int) -> None:
    cookie_kwargs = {
        "key": key,
        "value": value,
        "httponly": True,
        "secure": settings.SESSION_COOKIE_SECURE,
        "samesite": settings.SESSION_COOKIE_SAMESITE,
        "path": "/",
        "max_age": max_age,
    }
    if settings.SESSION_COOKIE_DOMAIN:
        cookie_kwargs["domain"] = settings.SESSION_COOKIE_DOMAIN
    response.set_cookie(**cookie_kwargs)


def _set_csrf_cookie(response: Response, token: str) -> None:
    cookie_kwargs = {
        "key": settings.CSRF_COOKIE_NAME,
        "value": token,
        "httponly": False,
        "secure": settings.SESSION_COOKIE_SECURE,
        "samesite": settings.SESSION_COOKIE_SAMESITE,
        "path": "/",
        "max_age": settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    }
    if settings.SESSION_COOKIE_DOMAIN:
        cookie_kwargs["domain"] = settings.SESSION_COOKIE_DOMAIN
    response.set_cookie(**cookie_kwargs)


def _clear_cookie(response: Response, key: str) -> None:
    cookie_kwargs = {
        "key": key,
        "path": "/",
        "secure": settings.SESSION_COOKIE_SECURE,
        "samesite": settings.SESSION_COOKIE_SAMESITE,
    }
    if settings.SESSION_COOKIE_DOMAIN:
        cookie_kwargs["domain"] = settings.SESSION_COOKIE_DOMAIN
    response.delete_cookie(**cookie_kwargs)


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    _set_cookie(
        response,
        settings.SESSION_COOKIE_NAME,
        access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    _set_cookie(
        response,
        settings.REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )
    _set_csrf_cookie(response, generate_one_time_token())
    response.headers["Cache-Control"] = "no-store"


def _clear_auth_cookies(response: Response) -> None:
    _clear_cookie(response, settings.SESSION_COOKIE_NAME)
    _clear_cookie(response, settings.REFRESH_COOKIE_NAME)
    _clear_cookie(response, settings.CSRF_COOKIE_NAME)
    response.headers["Cache-Control"] = "no-store"


def _ensure_csrf_cookie(response: Response, request: Request) -> None:
    csrf_cookie = request.cookies.get(settings.CSRF_COOKIE_NAME)
    if csrf_cookie:
        _set_csrf_cookie(response, csrf_cookie)
        return
    _set_csrf_cookie(response, generate_one_time_token())


def _build_auth_session_response(user: User, message: str) -> AuthSessionResponse:
    return AuthSessionResponse(message=message, user=_user_response(user))


def _issue_session(response: Response, auth_service: AuthService, user: User, request: Request) -> AuthSessionResponse:
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    _, refresh_token = auth_service.create_refresh_session(
        user,
        expires_days=settings.REFRESH_TOKEN_EXPIRE_DAYS,
        ip_address=_request_ip(request),
        user_agent=_user_agent(request),
    )
    _set_auth_cookies(response, access_token, refresh_token)
    return _build_auth_session_response(user, "Authenticated successfully")


@router.post("/register", response_model=dict)
@limiter.limit("3/hour")
async def register(
    request: Request,
    background_tasks: BackgroundTasks,
    user_data: UserCreate,
    db: Session = Depends(get_db),
):
    auth_service = AuthService(db)
    email_service = EmailService()

    normalized_email = (user_data.email or "").strip().lower()
    normalized_username = (user_data.username or "").strip() or normalized_email
    if not normalized_email:
        raise HTTPException(status_code=400, detail="Email is required")

    if auth_service.get_user_by_username(normalized_username):
        raise HTTPException(status_code=400, detail="Username already exists")
    if auth_service.get_user_by_email(normalized_email):
        raise HTTPException(status_code=400, detail="Email already exists")

    try:
        user = auth_service.create_user(
            username=normalized_username,
            password=user_data.password,
            email=normalized_email,
            name=user_data.name,
            is_email_verified=False,
            is_active=True,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    verification_payload = {"message": "Account created. Please verify your email before signing in.", "user_id": user.id}
    verify_user, verify_token = auth_service.create_email_verification(
        normalized_email,
        settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES,
    )
    if verify_user and verify_token:
        query = urlencode({"mode": "verify", "token": verify_token})
        verify_url = f"{settings.EMAIL_VERIFICATION_URL}?{query}"
        if email_service.can_deliver_auth_emails():
            background_tasks.add_task(
                email_service.send_verification_email,
                verify_user.email,
                verify_user.name,
                verify_url,
            )
        elif _is_local_origin(request):
            verification_payload["dev_verify_url"] = verify_url

    auth_service.record_security_event(
        "register",
        user=user,
        identifier=normalized_email,
        ip_address=_request_ip(request),
        user_agent=_user_agent(request),
        success=True,
    )
    return verification_payload


@router.post("/login", response_model=AuthSessionResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    auth_service = AuthService(db)
    identifier = (form_data.username or "").strip()
    user = auth_service.get_user_by_username(identifier) or auth_service.get_user_by_email(identifier)

    if user and auth_service.is_login_locked(user):
        auth_service.record_security_event(
            "login_locked",
            user=user,
            identifier=identifier,
            ip_address=_request_ip(request),
            user_agent=_user_agent(request),
            success=False,
        )
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account temporarily locked. Please try again later.",
        )

    authenticated_user = auth_service.authenticate_user(identifier, form_data.password)
    if not authenticated_user:
        auth_service.register_failed_login(user)
        auth_service.record_security_event(
            "login_failed",
            user=user,
            identifier=identifier,
            ip_address=_request_ip(request),
            user_agent=_user_agent(request),
            success=False,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not authenticated_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled",
        )
    if not authenticated_user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before signing in",
        )

    auth_service.clear_failed_logins(authenticated_user, ip_address=_request_ip(request))
    auth_service.record_security_event(
        "login_success",
        user=authenticated_user,
        identifier=identifier,
        ip_address=_request_ip(request),
        user_agent=_user_agent(request),
        success=True,
    )
    auth_service.revoke_user_sessions(authenticated_user.id)
    return _issue_session(response, auth_service, authenticated_user, request)


@router.post("/refresh", response_model=AuthSessionResponse)
@limiter.limit("20/minute")
async def refresh_session(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    auth_service = AuthService(db)
    refresh_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    user, next_refresh_token = auth_service.rotate_refresh_session(
        refresh_token or "",
        expires_days=settings.REFRESH_TOKEN_EXPIRE_DAYS,
        ip_address=_request_ip(request),
        user_agent=_user_agent(request),
    )
    if not user or not next_refresh_token:
        _clear_auth_cookies(response)
        auth_service.record_security_event(
            "refresh_failed",
            identifier="cookie_refresh",
            ip_address=_request_ip(request),
            user_agent=_user_agent(request),
            success=False,
        )
        raise HTTPException(status_code=401, detail="Session expired")

    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    _set_auth_cookies(response, access_token, next_refresh_token)
    auth_service.record_security_event(
        "refresh_success",
        user=user,
        identifier=user.email or user.username,
        ip_address=_request_ip(request),
        user_agent=_user_agent(request),
        success=True,
    )
    return _build_auth_session_response(user, "Session refreshed")


@router.post("/logout", response_model=dict)
async def logout(
    request: Request,
    response: Response,
    current_user: Optional[User] = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    auth_service = AuthService(db)
    refresh_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if refresh_token:
        auth_service.revoke_refresh_session(refresh_token)
    _clear_auth_cookies(response)
    if current_user:
        auth_service.record_security_event(
            "logout",
            user=current_user,
            identifier=current_user.email or current_user.username,
            ip_address=_request_ip(request),
            user_agent=_user_agent(request),
            success=True,
        )
    return {"message": "Logged out successfully"}


@router.post("/verify-email/request", response_model=dict)
@limiter.limit("5/hour")
async def request_email_verification(
    request: Request,
    background_tasks: BackgroundTasks,
    payload: EmailVerificationRequest,
    db: Session = Depends(get_db),
):
    auth_service = AuthService(db)
    email_service = EmailService()

    if not email_service.can_deliver_auth_emails() and not _is_local_origin(request):
        raise HTTPException(status_code=503, detail="Verification email is not configured on this server")

    user, token = auth_service.create_email_verification(
        payload.email,
        settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES,
    )
    if user and token:
        query = urlencode({"mode": "verify", "token": token})
        verify_url = f"{settings.EMAIL_VERIFICATION_URL}?{query}"
        if email_service.can_deliver_auth_emails():
            background_tasks.add_task(
                email_service.send_verification_email,
                user.email,
                user.name,
                verify_url,
            )
        elif _is_local_origin(request):
            return {
                "message": "Local verification link generated for development.",
                "dev_verify_url": verify_url,
            }

    return {"message": "If an account with that email exists, a verification link has been sent."}


@router.post("/verify-email/confirm", response_model=dict)
@limiter.limit("10/hour")
async def confirm_email_verification(
    request: Request,
    payload: EmailVerificationConfirm,
    db: Session = Depends(get_db),
):
    auth_service = AuthService(db)
    user = auth_service.verify_email(payload.token)
    if not user:
        auth_service.record_security_event(
            "verify_email_failed",
            identifier="verify_token",
            ip_address=_request_ip(request),
            user_agent=_user_agent(request),
            success=False,
        )
        raise HTTPException(status_code=400, detail="Invalid or expired verification link")

    auth_service.record_security_event(
        "verify_email_success",
        user=user,
        identifier=user.email or user.username,
        ip_address=_request_ip(request),
        user_agent=_user_agent(request),
        success=True,
    )
    return {"message": "Email verified successfully"}


@router.post("/password-reset/request", response_model=dict)
@limiter.limit("5/hour")
async def request_password_reset(
    request: Request,
    background_tasks: BackgroundTasks,
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
):
    email_service = EmailService()
    auth_service = AuthService(db)

    if not email_service.can_deliver_auth_emails() and not _is_local_origin(request):
        raise HTTPException(status_code=503, detail="Password reset email is not configured on this server")

    user, token = auth_service.create_password_reset(
        payload.email,
        settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
    )
    if user and token:
        query = urlencode({"mode": "reset", "token": token})
        reset_url = f"{settings.PASSWORD_RESET_URL}?{query}"
        if email_service.can_deliver_auth_emails():
            background_tasks.add_task(
                email_service.send_password_reset_email,
                user.email,
                user.name,
                reset_url,
            )
        elif _is_local_origin(request):
            return {
                "message": "Local reset link generated for development.",
                "dev_reset_url": reset_url,
            }

    return {"message": "If an account with that email exists, a reset link has been sent."}


@router.post("/password-reset/confirm", response_model=AuthSessionResponse)
@limiter.limit("10/hour")
async def confirm_password_reset(
    request: Request,
    response: Response,
    payload: PasswordResetConfirm,
    db: Session = Depends(get_db),
):
    auth_service = AuthService(db)
    try:
        user = auth_service.reset_password(payload.token, payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not user:
        auth_service.record_security_event(
            "password_reset_confirm_failed",
            identifier="reset_token",
            ip_address=_request_ip(request),
            user_agent=_user_agent(request),
            success=False,
        )
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    auth_service.revoke_user_sessions(user.id)
    auth_service.record_security_event(
        "password_reset_confirm_success",
        user=user,
        identifier=user.email or user.username,
        ip_address=_request_ip(request),
        user_agent=_user_agent(request),
        success=True,
    )
    return _issue_session(response, auth_service, user, request)


@router.get("/me", response_model=UserResponse)
async def read_users_me(
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
):
    schedule_cache_warmup(background_tasks, current_user.id)
    _ensure_csrf_cookie(response, request)
    return _user_response(current_user)
