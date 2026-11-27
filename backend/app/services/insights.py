from __future__ import annotations

from collections import Counter
from datetime import date, timedelta

from sqlalchemy.orm import Session

from ..models import Draw
from ..schemas import InsightsOut, NumberStat
from .prize_rules import stats_version

WINDOW_DAYS = {"1m": 30, "3m": 90, "1y": 365, "3y": 1095}
VALID_WINDOWS = set(WINDOW_DAYS)


def draws_for_window(
    db: Session,
    window: str,
    include_nine: bool = False,
    include_six: bool = False,
) -> list[Draw]:
    cutoff = date.today() - timedelta(days=WINDOW_DAYS[window])
    draws = (
        db.query(Draw)
        .filter(Draw.draw_date >= cutoff)
        .order_by(Draw.draw_no.desc())
        .all()
    )
    allowed = {"seven"}
    if include_nine:
        allowed.add("nine")
    if include_six:
        allowed.add("six")
    return [draw for draw in draws if stats_version(draw.draw_no) in allowed]


def _stats(
    numbers: range,
    counts: Counter,
    last_seen: dict[int, int],
    sample_size: int,
) -> list[NumberStat]:
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


def compute_insights(
    db: Session,
    window: str,
    include_nine: bool = False,
    include_six: bool = False,
) -> InsightsOut:
    draws = draws_for_window(db, window, include_nine, include_six)
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
