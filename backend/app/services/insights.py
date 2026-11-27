from __future__ import annotations

from collections import Counter
from datetime import date, timedelta

from sqlalchemy.orm import Session

from ..models import Draw
from ..schemas import InsightsOut, NumberStat

VALID_WINDOWS = {"all", "last100", "last1y"}


def draws_for_window(db: Session, window: str) -> list[Draw]:
    query = db.query(Draw).order_by(Draw.draw_no.desc())
    if window == "last100":
        query = query.limit(100)
    elif window == "last1y":
        query = query.filter(Draw.draw_date >= date.today() - timedelta(days=365))
    return query.all()


def _stats(numbers: range, counts: Counter, last_seen: dict[int, int], sample_size: int) -> list[NumberStat]:
    rows = []
    for number in numbers:
        count = counts.get(number, 0)
        rows.append(
            NumberStat(
                number=number,
                count=count,
                pct=round(count / sample_size * 100, 2) if sample_size else 0.0,
                omission=last_seen.get(number),
            )
        )
    rows.sort(key=lambda stat: (-stat.count, stat.number))
    return rows


def compute_insights(db: Session, window: str) -> InsightsOut:
    draws = draws_for_window(db, window)
    sample_size = len(draws)

    front_counts: Counter = Counter()
    back_counts: Counter = Counter()
    front_last: dict[int, int] = {}
    back_last: dict[int, int] = {}

    for index, draw in enumerate(draws):
        for number in draw.front_numbers:
            front_counts[number] += 1
            front_last.setdefault(number, index)
        for number in draw.back_numbers:
            back_counts[number] += 1
            back_last.setdefault(number, index)

    return InsightsOut(
        window=window,
        sample_size=sample_size,
        front=_stats(range(1, 36), front_counts, front_last, sample_size),
        back=_stats(range(1, 13), back_counts, back_last, sample_size),
    )
