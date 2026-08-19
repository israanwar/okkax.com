import asyncio
from pathlib import Path
import sys
import time
import pytest

# Ensure backend directory is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from integrations.base import BaseProvider, ProviderResult
from integrations.cache import IntegrationCache
from integrations.circuit_breaker import CircuitBreaker, CircuitState, get_circuit_breaker
from integrations.exceptions import (
    ProviderAuthenticationError,
    ProviderBadResponse,
    ProviderError,
    ProviderNotConfigured,
    ProviderRateLimited,
    ProviderTimeout,
    ProviderUnavailable,
)
from integrations.registry import ProviderRegistry
from integrations.retry import execute_with_retry


class DummyMockProvider(BaseProvider):
    def __init__(self, name: str = "mock_provider", configured: bool = True, enabled: bool = True):
        super().__init__(name=name, enabled=enabled)
        self._configured = configured

    def is_configured(self) -> bool:
        return self._configured

    async def health_check(self) -> ProviderResult:
        if not self.enabled:
            return ProviderResult.failure(self.name, "DISABLED", "Disabled")
        if not self.is_configured():
            return ProviderResult.failure(self.name, "NOT_CONFIGURED", "Not configured")
        return ProviderResult.success(self.name, {"status": "ok"})


class TestProviderResultAndExceptions:
    def test_provider_result_success(self):
        res = ProviderResult.success(
            provider="gemini",
            data={"text": "Halo"},
            latency_ms=45.2,
            cached=False,
            provenance={"model": "gemini-2.5-flash"},
        )
        assert res.ok is True
        assert res.provider == "gemini"
        assert res.data == {"text": "Halo"}
        assert res.latency_ms == 45.2
        assert res.cached is False
        assert res.provenance == {"model": "gemini-2.5-flash"}
        assert res.request_id.startswith("req_")
        assert len(res.timestamp) > 10

    def test_provider_result_failure(self):
        res = ProviderResult.failure(
            provider="resend",
            error_code="RATE_LIMIT",
            error_message="Too many requests",
            latency_ms=12.0,
        )
        assert res.ok is False
        assert res.provider == "resend"
        assert res.error_code == "RATE_LIMIT"
        assert res.error_message == "Too many requests"

    def test_exception_hierarchy(self):
        err = ProviderTimeout("gemini", 10.0)
        assert isinstance(err, ProviderError)
        assert err.status_code == 504
        assert "10.0s" in str(err)

        auth_err = ProviderAuthenticationError("openai", "Bad key")
        assert isinstance(auth_err, ProviderError)
        assert auth_err.status_code == 401


class TestCircuitBreaker:
    def test_circuit_breaker_transitions(self):
        cb = CircuitBreaker("test_service", failure_threshold=3, recovery_time_seconds=0.1, half_open_success_threshold=2)
        assert cb.state == CircuitState.CLOSED
        assert cb.can_execute() is True

        # Record 2 failures -> still closed
        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitState.CLOSED
        assert cb.can_execute() is True

        # 3rd failure -> OPEN
        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        assert cb.can_execute() is False

        # Wait for recovery time -> should switch to HALF_OPEN on can_execute()
        time.sleep(0.12)
        assert cb.can_execute() is True
        assert cb.state == CircuitState.HALF_OPEN

        # 1st success in half-open -> still half-open
        cb.record_success()
        assert cb.state == CircuitState.HALF_OPEN

        # 2nd success in half-open -> recovers to CLOSED
        cb.record_success()
        assert cb.state == CircuitState.CLOSED
        assert cb.failure_count == 0


class TestRetryMechanism:
    def test_retry_on_rate_limit(self):
        async def _test():
            attempts = 0

            async def _flaky():
                nonlocal attempts
                attempts += 1
                if attempts < 2:
                    raise ProviderRateLimited("mock", retry_after=0.01)
                return "SUCCESS"

            res = await execute_with_retry(_flaky, max_retries=2, base_delay=0.01, provider_name="mock")
            assert res == "SUCCESS"
            assert attempts == 2

        asyncio.run(_test())

    def test_no_retry_on_auth_error(self):
        async def _test():
            attempts = 0

            async def _auth_fail():
                nonlocal attempts
                attempts += 1
                raise ProviderAuthenticationError("mock", "Invalid key")

            with pytest.raises(ProviderAuthenticationError):
                await execute_with_retry(_auth_fail, max_retries=3, provider_name="mock")

            assert attempts == 1  # Fails fast without retrying

        asyncio.run(_test())


class TestCacheManager:
    def test_cache_ttl_and_eviction(self):
        test_cache = IntegrationCache(max_items=5)
        key = test_cache.hash_key("test", {"query": "jakarta"})

        test_cache.set(key, {"temp": 30}, ttl_seconds=0.05)
        assert test_cache.get(key) == {"temp": 30}

        time.sleep(0.06)
        assert test_cache.get(key) is None  # Expired

    def test_cache_max_items_eviction(self):
        test_cache = IntegrationCache(max_items=3)
        for i in range(5):
            test_cache.set(f"k{i}", f"v{i}", ttl_seconds=60)

        assert len(test_cache._cache) <= 3


class TestProviderRegistry:
    def test_registry_tracking_and_self_test(self):
        async def _test():
            reg = ProviderRegistry()
            mock_p = DummyMockProvider(name="dummy_1", configured=True, enabled=True)
            reg.register(mock_p)

            assert reg.get("dummy_1") is mock_p
            status = reg.get_all_status()
            assert "dummy_1" in status
            assert status["dummy_1"]["status"] == "healthy"

            # Run self-test
            res = await reg.run_self_test("dummy_1")
            assert res.ok is True
            assert res.data == {"status": "ok"}

        asyncio.run(_test())
