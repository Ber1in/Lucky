from __future__ import annotations

import pytest

from app.services.prize_rules import rule_version_for, stats_version, tier_for


@pytest.mark.parametrize(
    ("front_hits", "back_hits", "level"),
    [
        (5, 2, "一等奖"),
        (5, 1, "二等奖"),
        (5, 0, "三等奖"),
        (4, 2, "三等奖"),
        (4, 1, "四等奖"),
        (4, 0, "五等奖"),
        (3, 2, "五等奖"),
        (3, 1, "六等奖"),
        (2, 2, "六等奖"),
        (3, 0, "七等奖"),
        (2, 1, "七等奖"),
        (1, 2, "七等奖"),
        (0, 2, "七等奖"),
        (2, 0, None),
        (1, 1, None),
        (1, 0, None),
        (0, 1, None),
        (0, 0, None),
    ],
)
def test_seven_tier_mapping(front_hits, back_hits, level):
    assert tier_for(front_hits, back_hits) == level


def test_rule_version_boundary():
    assert rule_version_for("26013") == "legacy"
    assert rule_version_for("26014") == "seven_tier"
    assert rule_version_for("26135") == "seven_tier"
    assert rule_version_for("abc") == "legacy"


def test_stats_version_boundary():
    assert stats_version("18018") == "six"
    assert stats_version("19019") == "nine"
    assert stats_version("26013") == "nine"
    assert stats_version("26014") == "seven"
    assert stats_version("26135") == "seven"
