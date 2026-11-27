from __future__ import annotations

from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from .api import auth, bets, draws, insights
from .db import get_db

app = FastAPI(title="大乐透数据站", version="0.1.0")

app.include_router(auth.router)
app.include_router(draws.router)
app.include_router(insights.router)
app.include_router(bets.router)


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(status_code=503, content={"status": "degraded", "db": False})
    return {"status": "ok", "db": True}
