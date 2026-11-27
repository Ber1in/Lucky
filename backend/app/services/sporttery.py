from __future__ import annotations

import time

import httpx

from ..config import settings


class SportteryError(RuntimeError):
    pass


class SportteryClient:
    """Official Sporttery draw API client. The WAF requires HTTPS, a browser UA, and a Referer."""

    def __init__(self, timeout: float | None = None):
        self.timeout = timeout or settings.sync_timeout_seconds

    def fetch_page(self, page: int, page_size: int | None = None) -> dict:
        page_size = page_size or settings.sporttery_page_size
        params = {
            "gameNo": settings.sporttery_game_no,
            "provinceId": "0",
            "pageSize": str(page_size),
            "isVerify": "1",
            "pageNo": str(page),
        }
        headers = {
            "User-Agent": settings.sporttery_user_agent,
            "Referer": settings.sporttery_referer,
            "Accept": "application/json, text/plain, */*",
        }
        url = settings.sporttery_base + settings.sporttery_history_path
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                with httpx.Client(
                    timeout=self.timeout, headers=headers, follow_redirects=True
                ) as client:
                    response = client.get(url, params=params)
                    response.raise_for_status()
                    data = response.json()
                break
            except Exception as exc:  # Retry network errors with exponential backoff
                last_error = exc
                if attempt < 2:
                    time.sleep(1.5**attempt)
        else:  # pragma: no cover - network path
            raise SportteryError(f"请求官方接口失败: {last_error}") from last_error

        if not isinstance(data, dict) or not data.get("success"):
            raise SportteryError("官方接口返回结构异常")
        if "value" not in data or "list" not in (data.get("value") or {}):
            raise SportteryError("官方接口缺少 value.list")
        return data
