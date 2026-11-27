from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Draw
from ..schemas import DrawListOut, DrawOut
from ..services.sync import next_draw_date, next_draw_no

router = APIRouter(prefix="/api/draws", tags=["draws"])


@router.get("/latest", response_model=DrawOut)
def latest_draw(db: Session = Depends(get_db)):
    draw = db.query(Draw).order_by(Draw.draw_no.desc()).first()
    if draw is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="暂无开奖数据")
    return draw


@router.get("/next")
def next_draw(db: Session = Depends(get_db)):
    draw_no = next_draw_no(db)
    if draw_no is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="暂无开奖数据，无法确定下一期"
        )
    latest = db.query(Draw).order_by(Draw.draw_no.desc()).first()
    return {"draw_no": draw_no, "draw_date": next_draw_date(latest.draw_date)}


@router.get("", response_model=DrawListOut)
def list_draws(
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    total = db.query(Draw).count()
    items = (
        db.query(Draw)
        .order_by(Draw.draw_no.desc())
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .all()
    )
    return DrawListOut(items=items, total=total, page=page, page_size=pageSize)


@router.get("/{draw_no}", response_model=DrawOut)
def get_draw(draw_no: str, db: Session = Depends(get_db)):
    draw = db.get(Draw, draw_no)
    if draw is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="期号不存在")
    return draw
