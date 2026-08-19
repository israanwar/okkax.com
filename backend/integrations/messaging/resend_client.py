"""Resend Transactional Email Provider for OKKAX."""

import asyncio
import base64
import logging
import re
import time
from typing import Any, Dict, List, Optional
import httpx

from ..base import BaseProvider, ProviderResult, current_iso
from ..circuit_breaker import get_circuit_breaker
from ..config import settings
from ..exceptions import (
    ProviderAuthenticationError,
    ProviderBadResponse,
    ProviderNotConfigured,
    ProviderRateLimited,
    ProviderTimeout,
    ProviderUnavailable,
)
from ..registry import registry
from ..retry import execute_with_retry

logger = logging.getLogger(__name__)


def _mask_email(email: str) -> str:
    """Mask email address for safe logging (e.g., j***@example.com)."""
    if "@" not in email:
        return "***"
    user, domain = email.split("@", 1)
    if len(user) <= 2:
        masked_user = user[0] + "***"
    else:
        masked_user = user[0] + "***" + user[-1]
    return f"{masked_user}@{domain}"


def _is_valid_email(email: str) -> bool:
    """Validate email address format."""
    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    return bool(re.match(pattern, email.strip()))


class ResendEmailClient(BaseProvider):
    """Client wrapper for Resend Transactional Email API."""

    def __init__(
        self,
        enabled: Optional[bool] = None,
        api_key: Optional[str] = None,
        from_email: Optional[str] = None,
    ):
        super().__init__(
            name="resend",
            enabled=enabled if enabled is not None else settings.EMAIL_ENABLED,
        )
        self.api_key = api_key if api_key is not None else settings.RESEND_API_KEY
        self.from_email = from_email or settings.RESEND_FROM_EMAIL
        self.circuit = get_circuit_breaker("resend")
        self._sent_idempotency_keys: Dict[str, str] = {}  # key -> message_id

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 5)

    async def health_check(self) -> ProviderResult:
        if not self.enabled:
            return ProviderResult.failure("resend", "DISABLED", "Resend email provider is disabled in settings")
        if not self.is_configured():
            return ProviderResult.failure("resend", "NOT_CONFIGURED", "Resend API key is missing")

        start = time.time()
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    "https://api.resend.com/api-keys",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                if resp.status_code in (200, 201):
                    return ProviderResult.success("resend", {"status": "connected"}, latency_ms=(time.time() - start) * 1000)
                return ProviderResult.failure("resend", "AUTH_FAILED", f"HTTP {resp.status_code}: {resp.text[:100]}", latency_ms=(time.time() - start) * 1000)
        except Exception as e:
            return ProviderResult.failure("resend", "HEALTH_CHECK_FAILED", str(e)[:150], latency_ms=(time.time() - start) * 1000)

    async def send_email(
        self,
        to: str | List[str],
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        idempotency_key: Optional[str] = None,
        template_type: str = "custom",
        related_id: Optional[str] = None,
        timeout_seconds: float = 15.0,
    ) -> ProviderResult:
        """Send transactional email with idempotency and sanitized logging."""
        recipients = [to] if isinstance(to, str) else to
        for r in recipients:
            if not _is_valid_email(r):
                return ProviderResult.failure("resend", "INVALID_RECIPIENT", f"Invalid email format: {r}")

        # Idempotency check
        if idempotency_key and idempotency_key in self._sent_idempotency_keys:
            existing_msg_id = self._sent_idempotency_keys[idempotency_key]
            logger.info(f"Resend: Duplicate email suppressed by idempotency_key={idempotency_key} (msg_id={existing_msg_id})")
            return ProviderResult.success(
                provider="resend",
                data={"id": existing_msg_id, "idempotent_replay": True},
                cached=True,
            )

        if not self.enabled:
            logger.info(f"Resend: Email disabled. Simulated send to {[_mask_email(r) for r in recipients]} (subject: {subject})")
            return ProviderResult.success(
                provider="resend",
                data={"simulated": True, "recipients": [_mask_email(r) for r in recipients], "subject": subject},
            )

        if not self.is_configured():
            raise ProviderNotConfigured("resend", "API key missing")

        if not self.circuit.can_execute():
            raise ProviderUnavailable("resend", "Circuit is OPEN due to repeated errors")

        payload: Dict[str, Any] = {
            "from": self.from_email,
            "to": recipients,
            "subject": subject,
            "html": html_content,
        }
        if text_content:
            payload["text"] = text_content
        if attachments:
            payload["attachments"] = attachments

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key

        start_time = time.time()

        async def _call():
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                try:
                    resp = await client.post("https://api.resend.com/emails", json=payload, headers=headers)
                    if resp.status_code == 429:
                        raise ProviderRateLimited("resend")
                    if resp.status_code in (401, 403):
                        raise ProviderAuthenticationError("resend", resp.text[:100])
                    if resp.status_code >= 400:
                        raise ProviderBadResponse("resend", f"HTTP {resp.status_code}: {resp.text[:100]}")

                    return resp.json()
                except httpx.TimeoutException:
                    raise ProviderTimeout("resend", timeout_seconds)
                except httpx.RequestError as e:
                    raise ProviderBadResponse("resend", str(e)[:150])

        try:
            data = await execute_with_retry(_call, max_retries=1, provider_name="resend")
            self.circuit.record_success()
            latency = (time.time() - start_time) * 1000
            msg_id = data.get("id", "msg_sim")

            if idempotency_key:
                self._sent_idempotency_keys[idempotency_key] = msg_id

            logger.info(
                f"Resend: Email sent successfully to {[_mask_email(r) for r in recipients]} "
                f"(template={template_type}, related_id={related_id}, msg_id={msg_id}, latency={latency:.1f}ms)"
            )

            res = ProviderResult.success(
                provider="resend",
                data={"id": msg_id, "recipients_masked": [_mask_email(r) for r in recipients]},
                latency_ms=latency,
            )
            registry.record_call("resend", res)
            return res
        except Exception as e:
            self.circuit.record_failure()
            logger.error(f"Resend: Failed to send email: {type(e).__name__} ({str(e)[:100]})")
            res = ProviderResult.failure("resend", "SEND_FAILED", str(e)[:150], latency_ms=(time.time() - start_time) * 1000)
            registry.record_call("resend", res)
            raise


email_client = ResendEmailClient()
resend_client = email_client
registry.register(email_client)
