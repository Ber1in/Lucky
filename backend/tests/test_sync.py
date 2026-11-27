from __future__ import annotations

from decimal import Decimal

from app.models import Draw
from app.services.sync import backfill, backfill_newer, sync_latest, upsert_draw


def make_item(draw_no="26014", result="01 02 03 04 05 01 02", draw_date="2026-02-02", prizes=None):
    if prizes is None:
        prizes = [
            {"prizeLevel": "一等奖", "stakeAmount": "1,000,000", "stakeCount": "2", "group": "101", "sort": 101},
            {"prizeLevel": "二等奖", "stakeAmount": "50,000", "stakeCount": "10", "group": "102", "sort": 102},
            {"prizeLevel": "三等奖", "stakeAmount": "5,000", "stakeCount": "1,037", "group": "103", "sort": 103},
        ]
    return {
        "lotteryDrawNum": draw_no,
        "lotteryDrawTime": draw_date,
        "lotteryDrawResult": result,
        "poolBalanceAfterdraw": "800,000,000.00",
        "totalSaleAmount": "300,000,000",
        "prizeLevelList": prizes,
    }


class FakeClient:
    def __init__(self, payloads=None, errors=0):
        self.payloads = payloads or []
        self.errors = errors
        self.calls = 0

    def fetch_page(self, page, page_size=None):
        self.calls += 1
        if self.errors > 0:
            self.errors -= 1
            raise RuntimeError("模拟网络失败")
        if page - 1 < len(self.payloads):
            return self.payloads[page - 1]
        return {"success": True, "value": {"list": [], "total": 0}}


def test_upsert_draw_parses(db):
    draw = upsert_draw(db, make_item())
    db.commit()

    assert draw.draw_no == "26014"
    assert draw.front_numbers == [1, 2, 3, 4, 5]
    assert draw.back_numbers == [1, 2]
    assert draw.pool_balance == Decimal("800000000.00")
    assert draw.rule_version == "seven_tier"
    assert {p.prize_level for p in draw.prizes} == {"一等奖", "二等奖", "三等奖"}
    third = next(p for p in draw.prizes if p.prize_level == "三等奖")
    assert int(third.stake_count) == 1037


def test_rule_version_boundary(db):
    legacy = upsert_draw(db, make_item(draw_no="26013", draw_date="2026-02-01"))
    fresh = upsert_draw(db, make_item(draw_no="26014"))
    db.commit()
    assert legacy.rule_version == "legacy"
    assert fresh.rule_version == "seven_tier"


def test_backfill_idempotent(db):
    client = FakeClient(
        [
            {
                "success": True,
                "value": {
                    "list": [make_item("26014"), make_item("26013", draw_date="2026-02-01")],
                    "total": 2,
                },
            }
        ]
    )
    assert backfill(db, client) == 2
    assert db.query(Draw).count() == 2
    assert backfill(db, client) == 2
    assert db.query(Draw).count() == 2


def test_sync_latest_success(db):
    client = FakeClient([{"success": True, "value": {"list": [make_item()], "total": 1}}])
    run = sync_latest(db, client, fill_gaps=False, sleep=lambda _: None)
    assert run.status == "success"
    assert run.attempts == 1
    assert db.query(Draw).count() == 1


def test_sync_latest_retries(db):
    client = FakeClient(
        [{"success": True, "value": {"list": [make_item()], "total": 1}}], errors=2
    )
    run = sync_latest(db, client, fill_gaps=False, max_attempts=3, sleep=lambda _: None)
    assert run.status == "success"
    assert run.attempts == 3


def test_sync_latest_failure(db):
    client = FakeClient([], errors=5)
    run = sync_latest(db, client, fill_gaps=False, max_attempts=2, sleep=lambda _: None)
    assert run.status == "failed"
    assert run.attempts == 2
    assert "模拟网络失败" in (run.message or "")


def test_sync_latest_no_update(db):
    upsert_draw(db, make_item("26014"))
    db.commit()
    client = FakeClient(
        [{"success": True, "value": {"list": [make_item("26014")], "total": 1}}]
    )
    run = sync_latest(db, client, fill_gaps=False, max_attempts=2, sleep=lambda _: None)
    assert run.status == "no_update"
    assert run.attempts == 2
    assert "暂无新期次" in (run.message or "")


def test_sync_latest_upserts_all_newer_items(db):
    upsert_draw(db, make_item("26014"))
    db.commit()
    items = [make_item("26016"), make_item("26015"), make_item("26014")]
    client = FakeClient([{"success": True, "value": {"list": items, "total": 3}}])
    run = sync_latest(db, client, fill_gaps=False, sleep=lambda _: None)
    assert run.status == "success"
    assert db.query(Draw).count() == 3


def test_backfill_newer_fills_gap(db):
    upsert_draw(db, make_item("26014"))
    db.commit()
    items = [make_item("26016"), make_item("26015"), make_item("26014")]
    client = FakeClient([{"success": True, "value": {"list": items, "total": 3}}])
    assert backfill_newer(db, client) == 2
    assert db.query(Draw).count() == 3


def test_sync_latest_fills_gap_and_reports_success(db):
    upsert_draw(db, make_item("26014"))
    db.commit()
    items = [make_item("26016"), make_item("26015"), make_item("26014")]
    client = FakeClient([{"success": True, "value": {"list": items, "total": 3}}])
    run = sync_latest(db, client, sleep=lambda _: None)
    assert run.status == "success"
    assert db.query(Draw).count() == 3


def test_sync_latest_evaluates_pending_bets(db):
    from datetime import date

    from app.models import Bet, User
    from app.security import hash_password

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
            multiplier=2,
            cost=4,
            status="pending",
        )
    )
    db.commit()

    client = FakeClient([{"success": True, "value": {"list": [make_item()], "total": 1}}])
    run = sync_latest(db, client, fill_gaps=False, sleep=lambda _: None)
    assert run.status == "success"
    bet = db.query(Bet).first()
    assert bet.status == "won"
    assert bet.prize_level == "一等奖"
