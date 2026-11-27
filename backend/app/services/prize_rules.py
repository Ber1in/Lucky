from __future__ import annotations

from ..config import settings

# Seven-tier rules (from draw 26014): (front hits, back hits) -> prize level
SEVEN_TIER_MAP: dict[tuple[int, int], str] = {
    (5, 2): "一等奖",
    (5, 1): "二等奖",
    (5, 0): "三等奖",
    (4, 2): "三等奖",
    (4, 1): "四等奖",
    (4, 0): "五等奖",
    (3, 2): "五等奖",
    (3, 1): "六等奖",
    (2, 2): "六等奖",
    (3, 0): "七等奖",
    (2, 1): "七等奖",
    (1, 2): "七等奖",
    (0, 2): "七等奖",
}

FLOATING_LEVELS = {"一等奖", "二等奖"}
ADDITIONAL_RATE = 1.8


def rule_version_for(draw_no: str) -> str:
    try:
        number = int(draw_no)
    except (TypeError, ValueError):
        return "legacy"
    return "seven_tier" if number >= settings.seven_tier_start_draw else "legacy"


def tier_for(front_hits: int, back_hits: int) -> str | None:
    return SEVEN_TIER_MAP.get((front_hits, back_hits))


def _as_int_set(values: list[int] | None) -> set[int]:
    return {int(v) for v in (values or [])}


def count_hits(bet_front: list[int], bet_back: list[int], draw_front: list[int], draw_back: list[int]) -> tuple[int, int]:
    return (
        len(_as_int_set(bet_front) & _as_int_set(draw_front)),
        len(_as_int_set(bet_back) & _as_int_set(draw_back)),
    )
