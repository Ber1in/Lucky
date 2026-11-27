from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from sqlalchemy.orm import Session

from ..models import Bet, Draw
from ..schemas import DrawSummary, SummaryOut
from .sync import evaluate_bet


def compute_cost(is_additional: bool, multiplier: int) -> Decimal:
    unit = Decimal("3") if is_additional else Decimal("2")
    return (unit * multiplier).quantize(Decimal("0.01"))


def apply_evaluation(bet: Bet, draw: Draw | None) -> None:
    if draw is None:
        bet.status = "pending"
        bet.prize_level = None
        bet.prize_amount = Decimal("0")
        return
    status, level, amount = evaluate_bet(bet, draw)
    bet.status = status
    bet.prize_level = level
    bet.prize_amount = amount


def summarize(db: Session, user_id: int) -> SummaryOut:
    bets = db.query(Bet).filter(Bet.user_id == user_id).all()
    settled = [bet for bet in bets if bet.status != "pending"]
    pending = [bet for bet in bets if bet.status == "pending"]

    total_cost = sum((Decimal(bet.cost) for bet in settled), Decimal("0"))
    total_prize = sum(
        (Decimal(bet.prize_amount or 0) for bet in settled if bet.status == "won"), Decimal("0")
    )
    pending_cost = sum((Decimal(bet.cost) for bet in pending), Decimal("0"))

    groups: dict[str, dict] = defaultdict(
        lambda: {"cost": Decimal("0"), "prize": Decimal("0"), "settled": True}
    )
    for bet in bets:
        group = groups[bet.draw_no]
        group["cost"] += Decimal(bet.cost)
        if bet.status == "pending":
            group["settled"] = False
        elif bet.status == "won":
            group["prize"] += Decimal(bet.prize_amount or 0)

    by_draw = [
        DrawSummary(
            draw_no=draw_no,
            cost=float(value["cost"]),
            prize=float(value["prize"]),
            net=float(value["prize"] - value["cost"]),
            settled=bool(value["settled"]),
        )
        for draw_no, value in sorted(groups.items(), reverse=True)
    ]

    return SummaryOut(
        total_cost=float(total_cost),
        total_prize=float(total_prize),
        net=float(total_prize - total_cost),
        pending_cost=float(pending_cost),
        pending_count=len(pending),
        bet_count=len(bets),
        by_draw=by_draw,
    )
