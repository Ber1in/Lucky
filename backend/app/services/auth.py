from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from ..config import settings
from ..models import AuthSession, User
from ..security import hash_token, new_session_token


def create_session(db: Session, user: User) -> str:
    token = new_session_token()
    expires_at = datetime.utcnow() + timedelta(days=settings.session_ttl_days)
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=expires_at,
            last_seen_at=datetime.utcnow(),
        )
    )
    db.commit()
    return token


def revoke_session(db: Session, token: str) -> None:
    session = db.query(AuthSession).filter(AuthSession.token_hash == hash_token(token)).first()
    if session is not None:
        db.delete(session)
        db.commit()


def purge_expired(db: Session) -> int:
    deleted = (
        db.query(AuthSession)
        .filter(AuthSession.expires_at < datetime.utcnow())
        .delete(synchronize_session=False)
    )
    db.commit()
    return int(deleted)
