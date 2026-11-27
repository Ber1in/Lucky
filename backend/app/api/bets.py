from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import get_current_user
from ..models import Bet, Draw, User
from ..schemas import BetIn, BetListOut, BetOut, BetUpdate, SummaryOut
from ..services.bets import apply_evaluation, compute_cost, summarize
from ..services.sync import next_draw_no

router = APIRouter(prefix="/api/bets", tags=["bets"])


def _to_out(bet: Bet, db: Session) -> BetOut:
    draw = db.get(Draw, bet.draw_no)
    return BetOut(
        id=bet.id,
        draw_no=bet.draw_no,
        front_numbers=list(bet.front_numbers),
        back_numbers=list(bet.back_numbers),
        is_additional=bet.is_additional,
        multiplier=bet.multiplier,
        cost=float(bet.cost),
        ticket_amount=float(bet.ticket_amount) if bet.ticket_amount is not None else None,
        status=bet.status,
        prize_level=bet.prize_level,
        prize_amount=float(bet.prize_amount) if bet.prize_amount is not None else None,
        draw_date=draw.draw_date if draw else None,
    )


@router.get("/summary", response_model=SummaryOut)
def summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return summarize(db, user.id)


@router.get("", response_model=BetListOut)
def list_bets(
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Bet).filter(Bet.user_id == user.id).order_by(Bet.id.desc())
    total = query.count()
    items = query.offset((page - 1) * pageSize).limit(pageSize).all()
    return BetListOut(
        items=[_to_out(b, db) for b in items], total=total, page=page, page_size=pageSize
    )


@router.post("", response_model=BetOut, status_code=status.HTTP_201_CREATED)
def create_bet(payload: BetIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    draw_no = payload.draw_no
    if draw_no is None:
        draw_no = next_draw_no(db)
        if draw_no is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="暂无开奖数据，无法确定下一期",
            )
    try:
        draw_number = int(draw_no)
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="期号无效")
    if draw_number < settings.seven_tier_start_draw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该期规则版本不支持自动核算（仅支持 26014 期及以后）",
        )
    draw = db.get(Draw, draw_no)
    cost = compute_cost(payload.is_additional, payload.multiplier)
    bet = Bet(
        user_id=user.id,
        draw_no=draw_no,
        front_numbers=payload.front_numbers,
        back_numbers=payload.back_numbers,
        is_additional=payload.is_additional,
        multiplier=payload.multiplier,
        cost=cost,
        ticket_amount=payload.ticket_amount,
    )
    apply_evaluation(bet, draw)
    db.add(bet)
    db.commit()
    db.refresh(bet)

    # Race guard: re-evaluate if the draw arrived between lookup and commit.
    if bet.status == "pending":
        fresh_draw = db.get(Draw, bet.draw_no)
        if fresh_draw is not None:
            apply_evaluation(bet, fresh_draw)
            db.commit()
            db.refresh(bet)
    return _to_out(bet, db)


@router.patch("/{bet_id}", response_model=BetOut)
def update_bet(
    bet_id: int,
    payload: BetUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bet = db.query(Bet).filter(Bet.id == bet_id, Bet.user_id == user.id).first()
    if bet is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    if payload.front_numbers is not None:
        bet.front_numbers = payload.front_numbers
    if payload.back_numbers is not None:
        bet.back_numbers = payload.back_numbers
    if payload.is_additional is not None:
        bet.is_additional = payload.is_additional
    if payload.multiplier is not None:
        bet.multiplier = payload.multiplier
    if "ticket_amount" in payload.model_fields_set:
        bet.ticket_amount = payload.ticket_amount
    bet.cost = compute_cost(bet.is_additional, bet.multiplier)
    apply_evaluation(bet, db.get(Draw, bet.draw_no))
    db.commit()
    db.refresh(bet)
    return _to_out(bet, db)


@router.delete("/{bet_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bet(bet_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bet = db.query(Bet).filter(Bet.id == bet_id, Bet.user_id == user.id).first()
    if bet is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    db.delete(bet)
    db.commit()
