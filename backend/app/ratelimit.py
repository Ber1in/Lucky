from __future__ import annotations

import threading
import time
from collections import defaultdict, deque


class SlidingWindowLimiter:
    """In-process sliding-window limiter for single-node deployments.

    FastAPI sync endpoints run in a thread pool, so all reads and writes share one lock.
    """

    def __init__(self, max_events: int, window_seconds: int, max_keys: int = 10_000):
        self.max_events = max_events
        self.window_seconds = window_seconds
        self.max_keys = max_keys
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, bucket: deque[float], now: float) -> None:
        cutoff = now - self.window_seconds
        while bucket and bucket[0] < cutoff:
            bucket.popleft()

    def _blocked(self, key: str, now: float) -> bool:
        # Read-only lookup; never create an empty bucket for unknown keys.
        bucket = self._events.get(key)
        if not bucket:
            return False
        self._prune(bucket, now)
        return len(bucket) >= self.max_events

    def _record(self, key: str, now: float) -> None:
        bucket = self._events.get(key)
        if bucket is None:
            bucket = deque()
            self._events[key] = bucket
        self._prune(bucket, now)
        bucket.append(now)
        self._enforce_capacity()

    def _enforce_capacity(self) -> None:
        if len(self._events) <= self.max_keys:
            return
        for key in list(self._events):
            if not self._events[key]:
                del self._events[key]
        overflow = len(self._events) - self.max_keys
        if overflow > 0:
            for key in list(self._events)[:overflow]:
                del self._events[key]

    def blocked(self, key: str, now: float | None = None) -> bool:
        now = now if now is not None else time.monotonic()
        with self._lock:
            return self._blocked(key, now)

    def record(self, key: str, now: float | None = None) -> None:
        now = now if now is not None else time.monotonic()
        with self._lock:
            self._record(key, now)

    def hit(self, key: str, now: float | None = None) -> bool:
        """Record one event; return False when the threshold is reached."""
        now = now if now is not None else time.monotonic()
        with self._lock:
            if self._blocked(key, now):
                return False
            self._record(key, now)
            return True

    def clear_key(self, key: str) -> None:
        with self._lock:
            self._events.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._events.clear()
