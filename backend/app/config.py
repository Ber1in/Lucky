import os


class Settings:
    app_name = "dlt-lottery-tracker"
    database_url = os.environ.get("DATABASE_URL", "sqlite:///./app.db")
    secret_key = os.environ.get("SECRET_KEY", "dev-only-secret-change-me")
    session_ttl_days = int(os.environ.get("SESSION_TTL_DAYS", "30"))
    cookie_name = "dlt_session"
    cookie_secure = os.environ.get("COOKIE_SECURE", "0") == "1"
    cookie_samesite = "lax"

    # Official Sporttery API
    sporttery_base = "https://webapi.sporttery.cn"
    sporttery_history_path = "/gateway/lottery/getHistoryPageListV1.qry"
    sporttery_game_no = "85"
    sporttery_page_size = 100
    sporttery_user_agent = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    sporttery_referer = "https://static.sporttery.cn/"
    sync_timeout_seconds = 15.0

    # First draw using the seven-tier prize rules
    seven_tier_start_draw = 26014

    login_max_failures = int(os.environ.get("LOGIN_MAX_FAILURES", "10"))
    login_window_seconds = int(os.environ.get("LOGIN_WINDOW_SECONDS", "300"))


settings = Settings()
