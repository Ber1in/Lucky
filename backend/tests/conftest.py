from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.models import Draw, DrawPrize

DEFAULT_PRIZES = [
    ("一等奖", 1_000_000),
    ("二等奖", 50_000),
    ("三等奖", 5_000),
    ("四等奖", 300),
    ("五等奖", 150),
    ("六等奖", 15),
    ("七等奖", 5),
]


@pytest.fixture()
def engine():
    eng = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    @event.listens_for(eng, "connect")
    def _fk_on(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture()
def db(engine):
    TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = TestingSession()
    yield session
    session.close()


@pytest.fixture()
def client(db):
    from app.api.auth import login_ip_limiter, login_limiter, register_limiter

    def override_db():
        yield db

    app.dependency_overrides[get_db] = override_db
    login_limiter.clear()
    login_ip_limiter.clear()
    register_limiter.clear()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def make_draw(db):
    def _make(
        draw_no: str = "26014",
        front=(1, 2, 3, 4, 5),
        back=(1, 2),
        rule_version: str | None = None,
        draw_date: date = date(2026, 2, 2),
        prizes=DEFAULT_PRIZES,
    ) -> Draw:
        if rule_version is None:
            rule_version = "seven_tier" if int(draw_no) >= 26014 else "legacy"
        draw = Draw(
            draw_no=draw_no,
            draw_date=draw_date,
            front_numbers=list(front),
            back_numbers=list(back),
            pool_balance=800_000_000,
            sales_amount=300_000_000,
            rule_version=rule_version,
        )
        for index, (level, amount) in enumerate(prizes):
            draw.prizes.append(
                DrawPrize(
                    prize_level=level,
                    stake_amount=amount,
                    stake_count=1,
                    sort=index,
                )
            )
        db.add(draw)
        db.commit()
        return draw

    return _make


@pytest.fixture()
def register(client):
    def _register(username: str = "alice", password: str = "password123"):
        response = client.post(
            "/api/auth/register", json={"username": username, "password": password}
        )
        assert response.status_code == 201, response.text
        return response

    return _register
