"""Google Gemini AI Provider for OKKAX Intelligence."""

import asyncio
import json
import logging
import time
from typing import Any, Dict, Optional, Type
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
from ..retry import execute_with_retry
from .base import BaseLLMProvider

logger = logging.getLogger(__name__)


class GeminiProvider(BaseLLMProvider):
    """Provider adapter for Google Gemini Generative Models."""

    def __init__(self, enabled: Optional[bool] = None, api_key: Optional[str] = None):
        super().__init__(
            name="gemini",
            default_model="gemini-2.5-flash",
            enabled=enabled if enabled is not None else settings.AI_ENABLED,
        )
        self.api_key = api_key if api_key is not None else settings.GEMINI_API_KEY
        self.circuit = get_circuit_breaker("gemini")

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 5)

    async def health_check(self) -> ProviderResult:
        if not self.enabled:
            return ProviderResult.failure("gemini", "DISABLED", "Gemini provider is disabled in settings")
        if not self.is_configured():
            return ProviderResult.failure("gemini", "NOT_CONFIGURED", "Gemini API key is missing")

        start = time.time()
        try:
            res = await self.generate_text("Ping! Respond with 'PONG' only.", max_tokens=10, timeout_seconds=5.0)
            return res
        except Exception as e:
            return ProviderResult.failure("gemini", "HEALTH_CHECK_FAILED", str(e)[:150], latency_ms=(time.time() - start) * 1000)

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
            raise ProviderNotConfigured("gemini", "Provider is disabled")
        if not self.is_configured():
            raise ProviderNotConfigured("gemini", "API key missing")
        if not self.circuit.can_execute():
            raise ProviderUnavailable("gemini", "Circuit is OPEN due to repeated errors")

        target_model = model or self.default_model
        start_time = time.time()

        async def _call():
            try:
                from google import genai
                from google.genai import types

                client = genai.Client(api_key=self.api_key)
                config = types.GenerateContentConfig(
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                    system_instruction=system_instruction,
                )
                # Run synchronous SDK call in threadpool with timeout
                resp = await asyncio.wait_for(
                    asyncio.to_thread(client.models.generate_content, model=target_model, contents=prompt, config=config),
                    timeout=timeout_seconds,
                )
                text = resp.text if resp and hasattr(resp, "text") else ""
                return text
            except asyncio.TimeoutError:
                raise ProviderTimeout("gemini", timeout_seconds)
            except Exception as e:
                err_str = str(e).lower()
                if "429" in err_str or "quota" in err_str:
                    raise ProviderRateLimited("gemini")
                if "401" in err_str or "403" in err_str or "key" in err_str:
                    raise ProviderAuthenticationError("gemini", str(e)[:100])
                raise ProviderBadResponse("gemini", str(e)[:150])

        try:
            text = await execute_with_retry(_call, max_retries=1, provider_name="gemini")
            self.circuit.record_success()
            latency = (time.time() - start_time) * 1000
            return ProviderResult.success(
                provider="gemini",
                data={"text": text, "model": target_model},
                latency_ms=latency,
                provenance={
                    "provider": "gemini",
                    "model": target_model,
                    "generated_at": current_iso(),
                    "schema_valid": True,
                    "fallback_used": False,
                    "confidence": 0.95,
                },
            )
        except Exception:
            self.circuit.record_failure()
            raise

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
        """Generate structured JSON conforming to schema_cls."""
        json_prompt = (
            f"{prompt}\n\n"
            f"IMPORTANT: You MUST respond ONLY with a valid JSON object strictly matching this schema:\n"
            f"{json.dumps(schema_cls.model_json_schema(), ensure_ascii=False)}\n"
            f"Do NOT include markdown formatting or extra text."
        )
        res = await self.generate_text(
            prompt=json_prompt,
            system_instruction=system_instruction,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout_seconds=timeout_seconds,
        )
        raw_text = res.data.get("text", "").strip() if res.data else ""
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
        start, end = raw_text.find("{"), raw_text.rfind("}")
        if start == -1 or end == -1:
            raise ProviderBadResponse("gemini", "No JSON object found in response")

        try:
            parsed = json.loads(raw_text[start : end + 1])
            validated = schema_cls.model_validate(parsed)
            res.data["structured"] = validated.model_dump()
            return res
        except (json.JSONDecodeError, ValidationError) as e:
            raise ProviderBadResponse("gemini", f"Structured validation failed: {str(e)[:150]}")
