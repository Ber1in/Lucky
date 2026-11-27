from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import bearer_token, client_key, get_current_user
from ..models import User
from ..ratelimit import SlidingWindowLimiter
from ..schemas import LoginIn, RegisterIn, TokenOut, UserOut
from ..security import hash_password, verify_password
from ..services.auth import create_session, revoke_session

router = APIRouter(prefix="/api/auth", tags=["auth"])

login_limiter = SlidingWindowLimiter(settings.login_max_failures, settings.login_window_seconds)
# Per-source failure cap to prevent username rotation from bypassing the account limiter.
login_ip_limiter = SlidingWindowLimiter(30, settings.login_window_seconds)
register_limiter = SlidingWindowLimiter(20, 3600)

# Run a dummy verification for unknown users to avoid timing-based account enumeration.
DUMMY_HASH = hash_password("timing-dummy-password")


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.cookie_name,
        value=token,
        max_age=settings.session_ttl_days * 86400,
        httponly=True,
        samesite=settings.cookie_samesite,
        secure=settings.cookie_secure,
        path="/",
    )


def _authenticate(db: Session, request: Request, username: str, password: str) -> User:
    ip = client_key(request)
    limiter_key = f"login:{ip}:{username}"
    ip_key = f"login-ip:{ip}"
    if login_limiter.blocked(limiter_key) or login_ip_limiter.blocked(ip_key):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="尝试过于频繁")

    def record_failure() -> None:
        login_limiter.record(limiter_key)
        login_ip_limiter.record(ip_key)

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        verify_password(DUMMY_HASH, password)
        record_failure()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    if not verify_password(user.password_hash, password):
        record_failure()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    login_limiter.clear_key(limiter_key)
    return user


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, request: Request, response: Response, db: Session = Depends(get_db)):
    if not register_limiter.hit(f"register:{client_key(request)}"):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="注册过于频繁")
    exists = db.query(User).filter(User.username == payload.username).first()
    if exists is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="用户名已被占用")
    user = User(username=payload.username, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_session(db, user)
    _set_session_cookie(response, token)
    return user


@router.post("/login", response_model=UserOut)
def login(payload: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    user = _authenticate(db, request, payload.username, payload.password)
    token = create_session(db, user)
    _set_session_cookie(response, token)
    return user


@router.post("/token", response_model=TokenOut)
def token_login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    user = _authenticate(db, request, payload.username, payload.password)
    token = create_session(db, user)
    return TokenOut(token=token, user=UserOut.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = bearer_token(request) or request.cookies.get(settings.cookie_name)
    if token:
        revoke_session(db, token)
    response.delete_cookie(settings.cookie_name, path="/")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
