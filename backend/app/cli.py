from __future__ import annotations

import argparse
import sys

from .db import SessionLocal
from .models import AuthSession, User
from .security import hash_password
from .services.sporttery import SportteryClient
from .services.sync import backfill, sync_latest


def reset_password(db, username: str, new_password: str) -> bool:
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        return False
    user.password_hash = hash_password(new_password)
    # Password resets usually mean the account may be compromised; revoke all sessions.
    db.query(AuthSession).filter(AuthSession.user_id == user.id).delete(synchronize_session=False)
    db.commit()
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="app.cli", description="大乐透数据站运维命令")
    sub = parser.add_subparsers(dest="command", required=True)

    reset = sub.add_parser("reset-password", help="重置指定用户密码")
    reset.add_argument("username")
    reset.add_argument("password")

    sub.add_parser("backfill", help="全量回填历史开奖")
    sub.add_parser("sync", help="增量同步最新一期")

    args = parser.parse_args(argv)
    db = SessionLocal()
    try:
        if args.command == "reset-password":
            ok = reset_password(db, args.username, args.password)
            print("密码已重置" if ok else "用户不存在")
            return 0 if ok else 1

        client = SportteryClient()
        if args.command == "backfill":
            count = backfill(db, client)
            print(f"回填完成，共处理 {count} 条")
            return 0
        if args.command == "sync":
            run = sync_latest(db, client, max_attempts=1, retry_when_stale=False)
            print(f"{run.status}: {run.message}")
            return 0 if run.status == "success" else 1
        return 2
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
