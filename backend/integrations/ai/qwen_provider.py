"""Qwen provider using Alibaba Model Studio's OpenAI-compatible API."""

import asyncio
import json
import os
import time
from typing import Optional, Type

import httpx
from pydantic import BaseModel, ValidationError

from ..base import ProviderResult, current_iso
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
from .base import BaseLLMProvider


class QwenProvider(BaseLLMProvider):
    """Minimal adapter for Qwen's OpenAI-compatible chat completions API."""

    def __init__(
        self,
        enabled: Optional[bool] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        workspace_id: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.api_key = api_key if api_key is not None else os.environ.get("QWEN_API_KEY", "").strip()
        self.base_url = base_url if base_url is not None else os.environ.get("QWEN_BASE_URL", "").strip()
        self.workspace_id = (
            workspace_id if workspace_id is not None else os.environ.get("QWEN_WORKSPACE_ID", "").strip()
        )
        default_model = model if model is not None else os.environ.get("QWEN_MODEL", "").strip()
        super().__init__(
            name="qwen",
            default_model=default_model,
            enabled=enabled if enabled is not None else settings.AI_ENABLED,
        )
        self.circuit = get_circuit_breaker("qwen")

    def is_configured(self) -> bool:
        return bool(
            self.api_key
            and len(self.api_key) > 5
            and self.base_url
            and self.workspace_id
            and self.default_model
        )

    def _chat_completions_url(self) -> str:
        base_url = self.base_url.replace("{WorkspaceId}", self.workspace_id).replace(
            "{workspace_id}", self.workspace_id
        )
        if not base_url.startswith(("http://", "https://")):
            base_url = f"https://{base_url}"
        base_url = base_url.rstrip("/")
        if not base_url.endswith("/compatible-mode/v1"):
            base_url = f"{base_url}/compatible-mode/v1"
        return f"{base_url}/chat/completions"

    async def health_check(self) -> ProviderResult:
        if not self.enabled:
            return ProviderResult.failure("qwen", "DISABLED", "Qwen provider is disabled in settings")
        if not self.is_configured():
            return ProviderResult.failure("qwen", "NOT_CONFIGURED", "Qwen configuration is incomplete")
        start = time.time()
        try:
            return await self.generate_text("Ping! Respond with 'PONG' only.", max_tokens=10, timeout_seconds=5.0)
        except Exception as exc:
            return ProviderResult.failure(
                "qwen",
                "HEALTH_CHECK_FAILED",
                str(exc)[:150],
                latency_ms=(time.time() - start) * 1000,
            )

    async def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 4000,
        timeout_seconds: float = 30.0,
    ) -> ProviderResult:
        if not self.enabled:
            raise ProviderNotConfigured("qwen", "Provider is disabled")
        if not self.is_configured():
            raise ProviderNotConfigured("qwen", "Qwen configuration is incomplete")
        if not self.circuit.can_execute():
            raise ProviderUnavailable("qwen", "Circuit is OPEN due to repeated errors")

        target_model = model or self.default_model
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})
        payload = {
            "model": target_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "enable_thinking": False,
        }
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        start = time.time()

        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                response = await client.post(self._chat_completions_url(), headers=headers, json=payload)
        except (httpx.TimeoutException, asyncio.TimeoutError):
            self.circuit.record_failure()
            raise ProviderTimeout("qwen", timeout_seconds)
        except httpx.RequestError as exc:
            self.circuit.record_failure()
            raise ProviderUnavailable("qwen", str(exc)[:150])

        latency_ms = (time.time() - start) * 1000
        if response.status_code == 429:
            self.circuit.record_failure()
            raise ProviderRateLimited("qwen")
        if response.status_code in (401, 403):
            self.circuit.record_failure()
            raise ProviderAuthenticationError("qwen", f"HTTP {response.status_code}")
        if response.status_code >= 400:
            self.circuit.record_failure()
            raise ProviderBadResponse("qwen", f"HTTP {response.status_code}: {response.text[:100]}")

        try:
            body = response.json()
            text = body["choices"][0]["message"].get("content") or ""
            actual_model = body.get("model") or target_model
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            self.circuit.record_failure()
            raise ProviderBadResponse("qwen", f"Malformed OpenAI-compatible response: {str(exc)[:100]}")

        self.circuit.record_success()
        return ProviderResult.success(
            provider="qwen",
            data={"text": text, "model": actual_model, "http_status": response.status_code},
            latency_ms=latency_ms,
            provenance={
                "provider": "qwen",
                "model": actual_model,
                "generated_at": current_iso(),
                "schema_valid": True,
                "fallback_used": False,
                "confidence": 0.95,
            },
        )

    async def generate_structured(
        self,
        prompt: str,
        schema_cls: Type[BaseModel],
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4000,
        timeout_seconds: float = 30.0,
    ) -> ProviderResult:
        json_prompt = (
            f"{prompt}\n\nIMPORTANT: Respond ONLY with a valid JSON object matching this schema:\n"
            f"{json.dumps(schema_cls.model_json_schema(), ensure_ascii=False)}"
        )
        result = await self.generate_text(
            prompt=json_prompt,
            system_instruction=system_instruction,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout_seconds=timeout_seconds,
        )
        raw_text = result.data.get("text", "").strip() if result.data else ""
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
        start, end = raw_text.find("{"), raw_text.rfind("}")
        if start == -1 or end == -1:
            raise ProviderBadResponse("qwen", "No JSON object found in response")
        try:
            validated = schema_cls.model_validate(json.loads(raw_text[start : end + 1]))
            result.data["structured"] = validated.model_dump()
            return result
        except (json.JSONDecodeError, ValidationError) as exc:
            raise ProviderBadResponse("qwen", f"Structured validation failed: {str(exc)[:150]}")
