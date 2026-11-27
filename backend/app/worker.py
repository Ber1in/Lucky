from __future__ import annotations

import logging

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from .db import SessionLocal
from .models import Draw
from .services.auth import purge_expired
from .services.sporttery import SportteryClient
from .services.sync import backfill, backfill_newer, evaluate_pending_bets, sync_latest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("dlt.worker")


def bootstrap() -> None:
    """Fill missing periods on startup and evaluate pending bets."""
    db = SessionLocal()
    try:
        client = SportteryClient()
        count = db.query(Draw).count()
        if count == 0:
            logger.info("开奖表为空，开始全量回填")
            logger.info("回填完成，共处理 %s 条", backfill(db, client))
        else:
            data = client.fetch_page(1, 1)
            total = int((data.get("value") or {}).get("total") or 0)
            if total and count < total:
                logger.info("本地期数 %s 少于官方 %s，执行全量回填", count, total)
                logger.info("回填完成，共处理 %s 条", backfill(db, client))
            else:
                written = backfill_newer(db, client)
                logger.info("启动增量补齐 %s 条", written)
        evaluate_pending_bets(db)
    except Exception:
        logger.exception("启动同步失败，稍后由定时任务重试")
    finally:
        db.close()


def run_sync() -> None:
    db = SessionLocal()
    try:
        # sync_latest.fill_gaps handles gaps; avoid double writes and false no_update results.
        run = sync_latest(db, SportteryClient())
        logger.info("同步结束：%s %s", run.status, run.message)
    except Exception:
        logger.exception("同步任务失败")
    finally:
        db.close()


def purge_job() -> None:
    db = SessionLocal()
    try:
        logger.info("清理过期会话 %s 条", purge_expired(db))
    finally:
        db.close()


def main() -> None:
    bootstrap()
    scheduler = BlockingScheduler(timezone="Asia/Shanghai")
    scheduler.add_job(
        run_sync,
        CronTrigger(day_of_week="mon,wed,sat", hour=21, minute=35, timezone="Asia/Shanghai"),
        id="dlt-draw-sync",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        purge_job,
        CronTrigger(hour=3, minute=10, timezone="Asia/Shanghai"),
        id="dlt-session-purge",
        replace_existing=True,
    )
    logger.info("worker 已启动，等待开奖日 21:35 触发")
    scheduler.start()


if __name__ == "__main__":
    main()
