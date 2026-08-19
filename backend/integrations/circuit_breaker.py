"""Simple in-memory Circuit Breaker pattern for external integrations."""

from datetime import datetime, timezone
from enum import Enum
import logging
import time
from typing import Dict

logger = logging.getLogger(__name__)


class CircuitState(str, Enum):
    CLOSED = "CLOSED"      # Normal operation
    OPEN = "OPEN"          # Failing, fast-fail without calling external service
    HALF_OPEN = "HALF_OPEN"  # Testing recovery


class CircuitBreaker:
    """Tracks error rates and protects backend from cascade failures."""

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_time_seconds: float = 30.0,
        half_open_success_threshold: int = 2,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_time_seconds = recovery_time_seconds
        self.half_open_success_threshold = half_open_success_threshold

        self.state: CircuitState = CircuitState.CLOSED
        self.failure_count: int = 0
        self.success_count: int = 0
        self.last_failure_time: float = 0.0
        self.last_state_change: float = time.time()

    def can_execute(self) -> bool:
        """Check if request is allowed to execute."""
        now = time.time()
        if self.state == CircuitState.OPEN:
            if now - self.last_failure_time >= self.recovery_time_seconds:
                logger.info(f"CircuitBreaker[{self.name}]: Probe recovery window reached -> switching to HALF_OPEN")
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0
                return True
            return False
        return True

    def record_success(self):
        """Record a successful execution."""
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.half_open_success_threshold:
                logger.info(f"CircuitBreaker[{self.name}]: Service recovered -> switching to CLOSED")
                self.state = CircuitState.CLOSED
                self.failure_count = 0
                self.success_count = 0
        elif self.state == CircuitState.CLOSED:
            self.failure_count = 0

    def record_failure(self):
        """Record a failed execution."""
        self.last_failure_time = time.time()
        self.failure_count += 1

        if self.state == CircuitState.HALF_OPEN:
            logger.warning(f"CircuitBreaker[{self.name}]: Probe failed in HALF_OPEN -> returning to OPEN")
            self.state = CircuitState.OPEN
        elif self.state == CircuitState.CLOSED:
            if self.failure_count >= self.failure_threshold:
                logger.error(f"CircuitBreaker[{self.name}]: Failure threshold {self.failure_threshold} reached -> opening circuit")
                self.state = CircuitState.OPEN
                self.last_state_change = time.time()


# Global registry of circuit breakers
_circuit_breakers: Dict[str, CircuitBreaker] = {}


def get_circuit_breaker(name: str) -> CircuitBreaker:
    """Retrieve or create a circuit breaker for a provider."""
    if name not in _circuit_breakers:
        _circuit_breakers[name] = CircuitBreaker(name)
    return _circuit_breakers[name]
