"""Thread-safe In-Memory Cache Manager for External Integration Results."""

from datetime import datetime, timezone
import hashlib
import json
import logging
import time
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)


class IntegrationCache:
    """In-memory cache with time-to-live (TTL) and automatic expiration."""

    def __init__(self, max_items: int = 1000):
        self._cache: Dict[str, Tuple[Any, float]] = {}  # key -> (data, expires_at)
        self.max_items = max_items

    @staticmethod
    def hash_key(namespace: str, params: Any) -> str:
        """Create a deterministic SHA-256 cache key from namespace and parameters."""
        raw = json.dumps({"ns": namespace, "params": params}, sort_keys=True, default=str)
        digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:20]
        return f"{namespace}:{digest}"

    def get(self, key: str) -> Optional[Any]:
        """Retrieve item if present and unexpired."""
        if key in self._cache:
            data, expires_at = self._cache[key]
            if time.time() < expires_at:
                return data
            # Expired
            del self._cache[key]
        return None

    def set(self, key: str, value: Any, ttl_seconds: float):
        """Set item with time-to-live in seconds."""
        if len(self._cache) >= self.max_items:
            # Simple eviction of expired items or oldest
            self._evict()
        self._cache[key] = (value, time.time() + ttl_seconds)

    def delete(self, key: str):
        """Delete specific cache key."""
        self._cache.pop(key, None)

    def clear(self):
        """Clear all cache items."""
        self._cache.clear()

    def _evict(self):
        """Evict expired items first, or oldest 20% if none expired."""
        now = time.time()
        expired_keys = [k for k, (_, exp) in self._cache.items() if now >= exp]
        for k in expired_keys:
            del self._cache[k]

        if len(self._cache) >= self.max_items:
            # Drop 20% oldest entries
            keys_to_remove = list(self._cache.keys())[: max(1, self.max_items // 5)]
            for k in keys_to_remove:
                self._cache.pop(k, None)


# Global shared cache instance
cache = IntegrationCache()
