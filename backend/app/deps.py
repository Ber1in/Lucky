from __future__ import annotations

from datetime import datetime

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import AuthSession, User
from .security import hash_token


def client_key(request: Request) -> str:
    # Behind Nginx, request.client.host is the container IP; prefer trusted forwarded headers.
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(settings.cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    session = (
        db.query(AuthSession).filter(AuthSession.token_hash == hash_token(token)).first()
    )
    if session is None or session.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="会话已失效")
    session.last_seen_at = datetime.utcnow()
    db.commit()
    return session.user
