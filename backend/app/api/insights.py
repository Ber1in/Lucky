from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..schemas import InsightsOut
from ..services.insights import VALID_WINDOWS, compute_insights

router = APIRouter(prefix="/api/insights", tags=["insights"])


@router.get("/numbers", response_model=InsightsOut)
def number_insights(window: str = Query(default="all"), db: Session = Depends(get_db)):
    if window not in VALID_WINDOWS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="window 只能是 all、last100 或 last1y",
        )
    return compute_insights(db, window)
