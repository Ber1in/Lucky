from __future__ import annotations

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Bet, User
from app.security import hash_password


def _bet_payload(**overrides):
    payload = {
        "draw_no": "26014",
        "front_numbers": [1, 2, 3, 4, 5],
        "back_numbers": [1, 2],
        "is_additional": False,
        "multiplier": 2,
    }
    payload.update(overrides)
    return payload


@pytest.mark.parametrize(
    "overrides",
    [
        {"multiplier": 0},
        {"multiplier": 100},
        {"draw_no": "26_136"},
        {"draw_no": "2613"},
        {"front_numbers": [1, 2, 3, 4, 4]},
        {"front_numbers": [1, 2, 3, 4, 36]},
        {"back_numbers": [1, 1]},
        {"back_numbers": [0, 2]},
        {"front_numbers": [1, 2, 3, 4]},
    ],
)
def test_api_rejects_invalid_bet(client, register, make_draw, overrides):
    register()
    make_draw()
    response = client.post("/api/bets", json=_bet_payload(**overrides))
    assert response.status_code == 422


def test_db_check_rejects_invalid_multiplier(db, make_draw):
    make_draw()
    user = User(username="alice", password_hash=hash_password("password123"))
    db.add(user)
    db.commit()
    db.add(
        Bet(
            user_id=user.id,
            draw_no="26014",
            front_numbers=[1, 2, 3, 4, 5],
            back_numbers=[1, 2],
            is_additional=False,
            multiplier=0,
            cost=2,
            status="pending",
        )
    )
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
