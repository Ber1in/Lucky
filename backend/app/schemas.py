from __future__ import annotations

import re
from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_\-]+$")
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id: int
    username: str

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    token: str
    user: UserOut


class DrawPrizeOut(BaseModel):
    prize_level: str
    stake_amount: float | None
    stake_count: int | None

    model_config = {"from_attributes": True}


class DrawOut(BaseModel):
    draw_no: str
    draw_date: date
    front_numbers: list[int]
    back_numbers: list[int]
    pool_balance: float | None
    sales_amount: float | None
    rule_version: str
    prizes: list[DrawPrizeOut] = []

    model_config = {"from_attributes": True}


class DrawListOut(BaseModel):
    items: list[DrawOut]
    total: int
    page: int
    page_size: int


class NumberStat(BaseModel):
    number: int
    count: int
    pct: float
    omission: int | None


class InsightsOut(BaseModel):
    window: str
    sample_size: int
    front: list[NumberStat]
    back: list[NumberStat]


class BetIn(BaseModel):
    draw_no: str | None = Field(default=None, min_length=5, max_length=8)
    front_numbers: list[int]
    back_numbers: list[int]
    is_additional: bool = False
    multiplier: int = Field(ge=1, le=99)
    ticket_amount: float | None = Field(default=None, ge=0, le=30000)

    @field_validator("draw_no")
    @classmethod
    def check_draw_no(cls, v: str | None) -> str | None:
        if v is None:
            return None
        value = v.strip()
        if not re.fullmatch(r"\d{5}", value):
            raise ValueError("期号必须为 5 位数字")
        return value

    @field_validator("front_numbers")
    @classmethod
    def check_front(cls, v: list[int]) -> list[int]:
        if len(v) != 5:
            raise ValueError("前区必须正好 5 个号码")
        if len(set(v)) != 5:
            raise ValueError("前区号码不能重复")
        if any(n < 1 or n > 35 for n in v):
            raise ValueError("前区号码必须在 01–35 之间")
        return sorted(v)

    @field_validator("back_numbers")
    @classmethod
    def check_back(cls, v: list[int]) -> list[int]:
        if len(v) != 2:
            raise ValueError("后区必须正好 2 个号码")
        if len(set(v)) != 2:
            raise ValueError("后区号码不能重复")
        if any(n < 1 or n > 12 for n in v):
            raise ValueError("后区号码必须在 01–12 之间")
        return sorted(v)


class BetUpdate(BaseModel):
    front_numbers: list[int] | None = None
    back_numbers: list[int] | None = None
    is_additional: bool | None = None
    multiplier: int | None = Field(default=None, ge=1, le=99)
    ticket_amount: float | None = Field(default=None, ge=0, le=30000)

    @field_validator("front_numbers")
    @classmethod
    def check_front(cls, v: list[int] | None) -> list[int] | None:
        if v is None:
            return v
        if len(v) != 5 or len(set(v)) != 5 or any(n < 1 or n > 35 for n in v):
            raise ValueError("前区必须为 5 个不重复的 01–35 号码")
        return sorted(v)

    @field_validator("back_numbers")
    @classmethod
    def check_back(cls, v: list[int] | None) -> list[int] | None:
        if v is None:
            return v
        if len(v) != 2 or len(set(v)) != 2 or any(n < 1 or n > 12 for n in v):
            raise ValueError("后区必须为 2 个不重复的 01–12 号码")
        return sorted(v)


class BetOut(BaseModel):
    id: int
    draw_no: str
    front_numbers: list[int]
    back_numbers: list[int]
    is_additional: bool
    multiplier: int
    cost: float
    ticket_amount: float | None
    status: str
    prize_level: str | None
    prize_amount: float | None
    draw_date: date | None = None

    model_config = {"from_attributes": True}


class BetListOut(BaseModel):
    items: list[BetOut]
    total: int
    page: int
    page_size: int


class DrawSummary(BaseModel):
    draw_no: str
    cost: float
    prize: float
    net: float
    settled: bool


class SummaryOut(BaseModel):
    total_cost: float
    total_prize: float
    net: float
    pending_cost: float
    pending_count: int
    bet_count: int
    by_draw: list[DrawSummary] = []
