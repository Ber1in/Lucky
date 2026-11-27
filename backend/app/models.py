from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    sessions: Mapped[list["AuthSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    bets: Mapped[list["Bet"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class AuthSession(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user: Mapped[User] = relationship(back_populates="sessions")


class Draw(Base):
    __tablename__ = "draws"

    draw_no: Mapped[str] = mapped_column(String(8), primary_key=True)
    draw_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    front_numbers: Mapped[list[int]] = mapped_column(JSON, nullable=False)
    back_numbers: Mapped[list[int]] = mapped_column(JSON, nullable=False)
    pool_balance: Mapped[float | None] = mapped_column(Numeric(16, 2), nullable=True)
    sales_amount: Mapped[float | None] = mapped_column(Numeric(16, 2), nullable=True)
    rule_version: Mapped[str] = mapped_column(String(16), nullable=False, default="legacy")
    raw_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    prizes: Mapped[list["DrawPrize"]] = relationship(
        back_populates="draw", cascade="all, delete-orphan", order_by="DrawPrize.sort"
    )


class DrawPrize(Base):
    __tablename__ = "draw_prizes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    draw_no: Mapped[str] = mapped_column(
        ForeignKey("draws.draw_no", ondelete="CASCADE"), index=True, nullable=False
    )
    prize_level: Mapped[str] = mapped_column(String(32), nullable=False)
    stake_amount: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    stake_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    group_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    sort: Mapped[int | None] = mapped_column(Integer, nullable=True)

    draw: Mapped[Draw] = relationship(back_populates="prizes")


class Bet(Base):
    __tablename__ = "bets"
    __table_args__ = (
        CheckConstraint("multiplier >= 1 AND multiplier <= 99", name="ck_bets_multiplier"),
        Index("ix_bets_user_draw", "user_id", "draw_no"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Bets may target a not-yet-drawn period, so no FK to draws; sync backfills and evaluates later.
    draw_no: Mapped[str] = mapped_column(String(8), index=True, nullable=False)
    front_numbers: Mapped[list[int]] = mapped_column(JSON, nullable=False)
    back_numbers: Mapped[list[int]] = mapped_column(JSON, nullable=False)
    is_additional: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    multiplier: Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)
    cost: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    # Ticket amount for one draw, used for bonus-prize eligibility; falls back to cost when null.
    ticket_amount: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    prize_level: Mapped[str | None] = mapped_column(String(32), nullable=True)
    prize_amount: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    user: Mapped[User] = relationship(back_populates="bets")


class SyncRun(Base):
    __tablename__ = "sync_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    message: Mapped[str | None] = mapped_column(String(1000), nullable=True)
