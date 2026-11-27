from __future__ import annotations

import time
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from ..models import Bet, Draw, DrawPrize, SyncRun
from .prize_rules import count_hits, rule_version_for, tier_for

# Max pages to walk backwards in one sync to avoid unbounded loops
MAX_BACKFILL_PAGES = 50


def parse_amount(value) -> Decimal | None:
    if value in (None, "", "---", "-"):
        return None
    if isinstance(value, (int, float, Decimal)):
        return Decimal(str(value))
    text = str(value).replace(",", "").strip()
    if not text or text == "---":
        return None
    return Decimal(text)


def parse_int(value) -> int | None:
    if value in (None, "", "---", "-"):
        return None
    if isinstance(value, int):
        return value
    text = str(value).replace(",", "").strip()
    if not text or text == "---":
        return None
    return int(text)


def _parse_numbers(result: str) -> tuple[list[int], list[int]]:
    parts = [int(p) for p in str(result).split() if p.strip()]
    if len(parts) != 7:
        raise ValueError(f"开奖号码格式异常: {result!r}")
    return sorted(parts[:5]), sorted(parts[5:7])


def _parse_date(text: str | None) -> date:
    if not text:
        raise ValueError("缺少开奖日期")
    return date.fromisoformat(str(text)[:10])


def upsert_draw(db: Session, item: dict) -> Draw:
    draw_no = str(item.get("lotteryDrawNum") or "").strip()
    if not draw_no:
        raise ValueError("缺少期号")
    front, back = _parse_numbers(item.get("lotteryDrawResult", ""))

    draw = db.get(Draw, draw_no)
    if draw is None:
        draw = Draw(draw_no=draw_no)
        db.add(draw)

    draw.draw_date = _parse_date(item.get("lotteryDrawTime"))
    draw.front_numbers = front
    draw.back_numbers = back
    draw.pool_balance = parse_amount(item.get("poolBalanceAfterdraw"))
    draw.sales_amount = parse_amount(item.get("totalSaleAmount"))
    draw.rule_version = rule_version_for(draw_no)
    draw.raw_payload = item
    draw.synced_at = datetime.utcnow()

    draw.prizes.clear()
    for entry in item.get("prizeLevelList") or []:
        level = str(entry.get("prizeLevel") or "").strip()
        if not level:
            continue
        draw.prizes.append(
            DrawPrize(
                prize_level=level,
                stake_amount=parse_amount(entry.get("stakeAmount")),
                stake_count=parse_int(entry.get("stakeCount")) or 0,
                group_code=str(entry.get("group") or "") or None,
                sort=parse_int(entry.get("sort")) or 0,
            )
        )

    db.flush()
    return draw


def _prize_amount(
    draw: Draw,
    level: str | None,
    is_additional: bool,
    multiplier: int,
    ticket_amount: Decimal | None = None,
) -> Decimal:
    if not level:
        return Decimal("0")
    prize = next((p for p in draw.prizes if p.prize_level == level), None)
    if prize is None or prize.stake_amount is None:
        return Decimal("0")
    base = Decimal(prize.stake_amount)
    if is_additional and level in ("一等奖", "二等奖"):
        base = base * Decimal("1.8")
    # Bonus draws: the API adds "<level> bonus" entries; add them when the ticket reaches 18 yuan.
    if ticket_amount is not None and Decimal(ticket_amount) >= Decimal("18"):
        bonus = sum(
            (
                Decimal(entry.stake_amount)
                for entry in draw.prizes
                if entry.prize_level == f"{level}派奖" and entry.stake_amount is not None
            ),
            Decimal("0"),
        )
        base += bonus
    return (base * multiplier).quantize(Decimal("0.01"))


def evaluate_bet(bet: Bet, draw: Draw) -> tuple[str, str | None, Decimal]:
    if draw is None or draw.rule_version != "seven_tier":
        return "pending", None, Decimal("0")
    front_hits, back_hits = count_hits(
        bet.front_numbers, bet.back_numbers, draw.front_numbers, draw.back_numbers
    )
    level = tier_for(front_hits, back_hits)
    if level is None:
        return "lost", None, Decimal("0")
    ticket_amount = Decimal(bet.ticket_amount) if bet.ticket_amount is not None else Decimal(bet.cost)
    return "won", level, _prize_amount(
        draw, level, bet.is_additional, bet.multiplier, ticket_amount
    )


def evaluate_bets_for_draw(db: Session, draw: Draw) -> int:
    bets = db.query(Bet).filter(Bet.draw_no == draw.draw_no).all()
    for bet in bets:
        status, level, amount = evaluate_bet(bet, draw)
        bet.status = status
        bet.prize_level = level
        bet.prize_amount = amount
    db.flush()
    return len(bets)


def evaluate_pending_bets(db: Session) -> int:
    rows = db.query(Bet.draw_no).filter(Bet.status == "pending").distinct().all()
    evaluated = 0
    for (draw_no,) in rows:
        draw = db.get(Draw, draw_no)
        if draw is not None:
            evaluated += evaluate_bets_for_draw(db, draw)
    db.commit()
    return evaluated


MAX_DRAWS_PER_YEAR = 156
DRAW_WEEKDAYS = (0, 2, 5)  # Monday, Wednesday, Saturday


def latest_draw_no(db: Session) -> str | None:
    row = db.query(Draw.draw_no).order_by(Draw.draw_no.desc()).first()
    return row[0] if row else None


def next_draw_no(db: Session) -> str | None:
    """Return the next not-yet-drawn period, or None when no history exists."""
    latest = latest_draw_no(db)
    if latest is None:
        return None
    try:
        year = int(latest[:2])
        sequence = int(latest[2:])
    except (TypeError, ValueError):
        return None
    if sequence >= MAX_DRAWS_PER_YEAR:
        return f"{(year + 1) % 100:02d}001"
    return f"{year:02d}{sequence + 1:03d}"


def next_draw_date(latest_date: date) -> date:
    """Return the next scheduled draw date after the latest drawn date."""
    for offset in range(1, 8):
        candidate = latest_date + timedelta(days=offset)
        if candidate.weekday() in DRAW_WEEKDAYS:
            return candidate
    return latest_date + timedelta(days=1)


def _is_newer(draw_no: str, local_max: str | None) -> bool:
    return local_max is None or str(draw_no) > local_max


def _upsert_and_evaluate(db: Session, item: dict) -> Draw:
    draw = upsert_draw(db, item)
    evaluate_bets_for_draw(db, draw)
    return draw


def backfill(db: Session, client, page_size: int = 100) -> int:
    """Full backfill. Idempotent; records sync_runs and re-raises on failure."""
    run = SyncRun(status="running", attempts=0, started_at=datetime.utcnow())
    db.add(run)
    db.commit()
    run_id = run.id

    written = 0
    total = 0
    page = 0
    try:
        page = 1
        while page <= MAX_BACKFILL_PAGES:
            data = client.fetch_page(page, page_size)
            value = data.get("value") or {}
            items = value.get("list") or []
            if not items:
                break
            for item in items:
                _upsert_and_evaluate(db, item)
                written += 1
            db.commit()
            total = int(value.get("total") or 0)
            if total and page * page_size >= total:
                break
            page += 1

        stored = db.query(Draw).count()
        if total and stored < total:
            raise RuntimeError(f"回填不完整：本地 {stored} 期，官方 {total} 期")

        run = db.get(SyncRun, run_id)
        run.status = "success"
        run.attempts = page
        run.finished_at = datetime.utcnow()
        run.message = f"回填 {written} 条"
        db.commit()
        return written
    except Exception as exc:
        db.rollback()
        run = db.get(SyncRun, run_id)
        if run is not None:
            run.status = "failed"
            run.finished_at = datetime.utcnow()
            run.message = f"回填失败: {exc}"[:1000]
            db.commit()
        raise


def backfill_newer(
    db: Session, client, page_size: int = 100, max_pages: int = MAX_BACKFILL_PAGES
) -> int:
    """Fill missing periods from the newest page until an existing period is reached."""
    run = SyncRun(status="running", attempts=0, started_at=datetime.utcnow())
    db.add(run)
    db.commit()
    run_id = run.id

    local_max = latest_draw_no(db)
    written = 0
    pages = 0
    try:
        for page in range(1, max_pages + 1):
            pages = page
            data = client.fetch_page(page, page_size)
            items = (data.get("value") or {}).get("list") or []
            if not items:
                break
            newer = [
                item for item in items if _is_newer(item.get("lotteryDrawNum", ""), local_max)
            ]
            if not newer:
                break
            for item in newer:
                _upsert_and_evaluate(db, item)
                written += 1
            db.commit()
            if len(newer) < len(items):
                break

        run = db.get(SyncRun, run_id)
        run.status = "success"
        run.attempts = pages
        run.finished_at = datetime.utcnow()
        run.message = f"补齐 {written} 条"
        db.commit()
        return written
    except Exception as exc:
        db.rollback()
        run = db.get(SyncRun, run_id)
        if run is not None:
            run.status = "failed"
            run.finished_at = datetime.utcnow()
            run.message = f"补齐失败: {exc}"[:1000]
            db.commit()
        raise


def sync_latest(
    db: Session,
    client,
    max_attempts: int = 12,
    interval_seconds: int = 300,
    sleep=time.sleep,
    retry_when_stale: bool = True,
    fill_gaps: bool = True,
) -> SyncRun:
    """Sync the latest period.

    - Only write and report success when a period newer than the local max is found.
    - Retry at a fixed interval while the official result is not published yet.
    - Record no_update / failed when retry_when_stale is off or attempts are exhausted.
    """
    run = SyncRun(status="running", attempts=0, started_at=datetime.utcnow())
    db.add(run)
    db.commit()
    run_id = run.id

    local_max = latest_draw_no(db)
    # Fill gaps first (downtime, interrupted backfill); failures must not block this sync.
    if fill_gaps:
        try:
            backfill_newer(db, client)
        except Exception:
            pass
    last_error: str | None = None

    for attempt in range(1, max_attempts + 1):
        run = db.get(SyncRun, run_id)
        run.attempts = attempt
        db.commit()

        try:
            data = client.fetch_page(1, 100)
            items = (data.get("value") or {}).get("list") or []
            if not items:
                raise RuntimeError("官方接口暂未返回开奖数据")

            newer = [
                item
                for item in items
                if _is_newer(str(item.get("lotteryDrawNum", "")), local_max)
            ]
            if not newer:
                # Refresh the latest period even without a new draw to pick up late or corrected prize data.
                for item in items:
                    if str(item.get("lotteryDrawNum", "")) == local_max:
                        _upsert_and_evaluate(db, item)
                        break
                evaluate_pending_bets(db)
                db.commit()

                if retry_when_stale and attempt < max_attempts:
                    sleep(interval_seconds)
                    continue
                run = db.get(SyncRun, run_id)
                run.status = "no_update"
                run.finished_at = datetime.utcnow()
                run.message = f"暂无新期次（本地最新 {local_max}）"
                db.commit()
                return run

            latest_written = local_max
            for item in sorted(newer, key=lambda entry: str(entry.get("lotteryDrawNum", ""))):
                draw = _upsert_and_evaluate(db, item)
                latest_written = draw.draw_no
            db.commit()

            evaluate_pending_bets(db)
            db.commit()

            run = db.get(SyncRun, run_id)
            run.status = "success"
            run.finished_at = datetime.utcnow()
            run.message = f"更新至 {latest_written} 期"
            db.commit()
            return run
        except Exception as exc:
            last_error = str(exc)
            db.rollback()
            run = db.get(SyncRun, run_id)
            if run is None:  # pragma: no cover - transaction fallback
                run = SyncRun(id=run_id, status="running", started_at=datetime.utcnow())
                db.add(run)
            run.attempts = attempt
            db.commit()

    run = db.get(SyncRun, run_id)
    run.status = "failed"
    run.finished_at = datetime.utcnow()
    run.message = f"重试 {max_attempts} 次后失败: {last_error}"[:1000]
    db.commit()
    return run
