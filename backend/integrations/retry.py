"""Asynchronous Retry Utilities with Exponential Backoff and Jitter."""

import asyncio
from functools import wraps
import logging
import random
import time
from typing import Any, Callable, Tuple, Type
from .exceptions import (
    ProviderAuthenticationError,
    ProviderNotConfigured,
    ProviderRateLimited,
    ProviderTimeout,
    ProviderUnavailable,
)

logger = logging.getLogger(__name__)

# Errors that should NOT be retried (fail-fast)
NON_RETRYABLE_EXCEPTIONS: Tuple[Type[Exception], ...] = (
    ProviderNotConfigured,
    ProviderAuthenticationError,
    ValueError,
    TypeError,
)


async def execute_with_retry(
    coro_fn: Callable[..., Any],
    *args,
    max_retries: int = 2,
    base_delay: float = 0.5,
    max_delay: float = 4.0,
    provider_name: str = "unknown",
    **kwargs,
) -> Any:
    """Execute async callable with exponential backoff and jitter."""
    attempt = 0
    last_exception = None

    while attempt <= max_retries:
        try:
            return await coro_fn(*args, **kwargs)
        except NON_RETRYABLE_EXCEPTIONS:
            # Re-raise non-retryable exceptions immediately
            raise
        except ProviderRateLimited as e:
            last_exception = e
            if attempt == max_retries:
                raise
            delay = e.retry_after if e.retry_after is not None else min(max_delay, base_delay * (2 ** attempt))
            delay += random.uniform(0, 0.25 * delay)
            logger.warning(
                f"Provider '{provider_name}' rate limited (429). Retrying in {delay:.2f}s (attempt {attempt + 1}/{max_retries})"
            )
            await asyncio.sleep(delay)
            attempt += 1
        except (ProviderTimeout, ProviderUnavailable, Exception) as e:
            last_exception = e
            if attempt == max_retries:
                raise
            delay = min(max_delay, base_delay * (2 ** attempt))
            delay += random.uniform(0, 0.25 * delay)
            logger.warning(
                f"Provider '{provider_name}' error ({type(e).__name__}: {str(e)[:100]}). "
                f"Retrying in {delay:.2f}s (attempt {attempt + 1}/{max_retries})"
            )
            await asyncio.sleep(delay)
            attempt += 1

    if last_exception:
        raise last_exception
