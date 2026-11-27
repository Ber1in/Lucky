from __future__ import annotations

import threading

from app.ratelimit import SlidingWindowLimiter


def test_blocked_does_not_create_keys():
    limiter = SlidingWindowLimiter(2, 60, max_keys=10)
    assert limiter.blocked("missing") is False
    assert len(limiter._events) == 0


def test_capacity_is_bounded():
    limiter = SlidingWindowLimiter(2, 60, max_keys=10)
    for index in range(50):
        limiter.record(f"key-{index}")
    assert len(limiter._events) <= 10


def test_concurrent_records_do_not_raise():
    limiter = SlidingWindowLimiter(2, 60, max_keys=50)
    errors: list[Exception] = []

    def worker(offset: int) -> None:
        try:
            for index in range(500):
                key = f"key-{offset}-{index}"
                limiter.record(key)
                limiter.blocked(key)
                limiter.record("shared")
        except Exception as exc:  # pragma: no cover - diagnostics on failure
            errors.append(exc)

    threads = [threading.Thread(target=worker, args=(index,)) for index in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert errors == []
    assert len(limiter._events) <= 50


def test_window_blocks_after_threshold():
    limiter = SlidingWindowLimiter(2, 60)
    limiter.record("a", now=100.0)
    limiter.record("a", now=101.0)
    assert limiter.blocked("a", now=102.0) is True
    # Window expiry lifts the block
    assert limiter.blocked("a", now=200.0) is False
