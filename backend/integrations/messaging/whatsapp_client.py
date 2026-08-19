"""WhatsApp Business API Adapter for OKKAX Operational Notifications."""

import asyncio
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


def normalize_phone_id(phone: str) -> str:
    """Normalize Indonesian phone numbers to E.164 (+628xxxx)."""
    cleaned = re.sub(r"[^\d+]", "", phone.strip())
    if cleaned.startswith("08"):
        cleaned = "+62" + cleaned[1:]
    elif cleaned.startswith("628"):
        cleaned = "+" + cleaned
    elif not cleaned.startswith("+") and cleaned.startswith("8"):
        cleaned = "+62" + cleaned
    return cleaned


def mask_phone(phone: str) -> str:
    """Mask phone number for safe logs (e.g. +62812****890)."""
    norm = normalize_phone_id(phone)
    if len(norm) > 8:
        return norm[:6] + "****" + norm[-3:]
    return "***"


class WhatsAppClient(BaseProvider):
    """Provider adapter for WhatsApp Business Cloud API / Gateway."""

    def __init__(
        self,
        enabled: Optional[bool] = None,
        access_token: Optional[str] = None,
        phone_number_id: Optional[str] = None,
    ):
        super().__init__(
            name="whatsapp",
            enabled=enabled if enabled is not None else settings.WHATSAPP_ENABLED,
        )
        self.access_token = access_token if access_token is not None else settings.WHATSAPP_ACCESS_TOKEN
        self.phone_number_id = phone_number_id if phone_number_id is not None else settings.WHATSAPP_PHONE_NUMBER_ID
        self.circuit = get_circuit_breaker("whatsapp")
        self._sent_idempotency_keys: Dict[str, str] = {}  # ref_id -> message_id

    def is_configured(self) -> bool:
        return bool(self.access_token and self.phone_number_id)

    async def health_check(self) -> ProviderResult:
        if not self.enabled:
            return ProviderResult.failure("whatsapp", "DISABLED", "WhatsApp provider is disabled in settings")
        if not self.is_configured():
            return ProviderResult.failure("whatsapp", "NOT_CONFIGURED", "WhatsApp credentials missing")

        start = time.time()
        try:
            url = f"https://graph.facebook.com/v19.0/{self.phone_number_id}"
            headers = {"Authorization": f"Bearer {self.access_token}"}
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    return ProviderResult.success("whatsapp", {"status": "connected"}, latency_ms=(time.time() - start) * 1000)
                return ProviderResult.failure("whatsapp", "AUTH_FAILED", f"HTTP {resp.status_code}: {resp.text[:100]}", latency_ms=(time.time() - start) * 1000)
        except Exception as e:
            return ProviderResult.failure("whatsapp", "HEALTH_CHECK_FAILED", str(e)[:150], latency_ms=(time.time() - start) * 1000)

    async def send_template(
        self,
        recipient: str,
        template_key: str,
        variables: Optional[Dict[str, str]] = None,
        reference_id: Optional[str] = None,
        timeout_seconds: float = 15.0,
    ) -> ProviderResult:
        """Send WhatsApp template message with duplicate protection and sanitized logging."""
        norm_phone = normalize_phone_id(recipient)
        if not re.match(r"^\+628\d{8,12}$", norm_phone):
            return ProviderResult.failure("whatsapp", "INVALID_PHONE_NUMBER", f"Invalid phone format: {recipient}")

        # Idempotency / Duplicate protection
        if reference_id and reference_id in self._sent_idempotency_keys:
            existing_id = self._sent_idempotency_keys[reference_id]
            logger.info(f"WhatsApp: Duplicate suppressed by reference_id={reference_id} (msg_id={existing_id})")
            return ProviderResult.success(
                provider="whatsapp",
                data={"id": existing_id, "idempotent_replay": True},
                cached=True,
            )

        if not self.enabled:
            logger.info(f"WhatsApp: Disabled. Simulated template '{template_key}' to {mask_phone(norm_phone)}")
            return ProviderResult.success(
                provider="whatsapp",
                data={"simulated": True, "recipient_masked": mask_phone(norm_phone), "template": template_key},
            )

        if not self.is_configured():
            raise ProviderNotConfigured("whatsapp", "Access token or phone number ID missing")

        if not self.circuit.can_execute():
            raise ProviderUnavailable("whatsapp", "Circuit is OPEN due to repeated errors")

        url = f"https://graph.facebook.com/v19.0/{self.phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

        # Build WhatsApp Cloud API template payload
        components = []
        if variables:
            body_params = [{"type": "text", "text": str(v)} for v in variables.values()]
            components.append({"type": "body", "parameters": body_params})

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": norm_phone.replace("+", ""),
            "type": "template",
            "template": {
                "name": template_key,
                "language": {"code": "id"},
                "components": components,
            },
        }

        start_time = time.time()

        async def _call():
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                try:
                    resp = await client.post(url, json=payload, headers=headers)
                    if resp.status_code == 429:
                        raise ProviderRateLimited("whatsapp")
                    if resp.status_code in (401, 403):
                        raise ProviderAuthenticationError("whatsapp", resp.text[:100])
                    if resp.status_code >= 400:
                        raise ProviderBadResponse("whatsapp", f"HTTP {resp.status_code}: {resp.text[:100]}")

                    return resp.json()
                except httpx.TimeoutException:
                    raise ProviderTimeout("whatsapp", timeout_seconds)
                except httpx.RequestError as e:
                    raise ProviderBadResponse("whatsapp", str(e)[:150])

        try:
            data = await execute_with_retry(_call, max_retries=1, provider_name="whatsapp")
            self.circuit.record_success()
            latency = (time.time() - start_time) * 1000
            msg_id = data.get("messages", [{}])[0].get("id", "wa_msg_sim")

            if reference_id:
                self._sent_idempotency_keys[reference_id] = msg_id

            logger.info(
                f"WhatsApp: Template '{template_key}' sent to {mask_phone(norm_phone)} "
                f"(msg_id={msg_id}, ref_id={reference_id}, latency={latency:.1f}ms)"
            )

            res = ProviderResult.success(
                provider="whatsapp",
                data={"id": msg_id, "recipient_masked": mask_phone(norm_phone)},
                latency_ms=latency,
            )
            registry.record_call("whatsapp", res)
            return res
        except Exception as e:
            self.circuit.record_failure()
            logger.error(f"WhatsApp: Send failed: {type(e).__name__} ({str(e)[:100]})")
            res = ProviderResult.failure("whatsapp", "SEND_FAILED", str(e)[:150], latency_ms=(time.time() - start_time) * 1000)
            registry.record_call("whatsapp", res)
            raise


whatsapp_client = WhatsAppClient()
registry.register(whatsapp_client)
