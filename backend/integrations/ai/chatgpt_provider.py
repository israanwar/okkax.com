"""ChatGPT (OpenAI) provider untuk OKKAX via Emergent LLM Key.

Adapter ini memakai emergentintegrations.llm.chat.LlmChat sehingga model
ChatGPT dapat dipakai tanpa OPENAI_API_KEY terpisah. Kontrak keluarannya
sama dengan provider lain (ProviderResult) supaya LLMRouter tidak berubah.
"""

import json
import logging
import os
import re
import time
from typing import Any, Dict, Optional, Type

from pydantic import BaseModel

from ..base import ProviderResult
from .base import BaseLLMProvider

logger = logging.getLogger(__name__)

CHATGPT_MODELS = {
    "gpt-5.5": "ChatGPT GPT-5.5",
    "gpt-5.4": "ChatGPT GPT-5.4",
    "gpt-5.4-mini": "ChatGPT GPT-5.4 Mini",
}
DEFAULT_CHATGPT_MODEL = "gpt-5.4"
# Model ChatGPT tertinggi yang sudah terverifikasi diterima upstream
# (probe langsung: gpt-5.5 OK, gpt-5.3 ditolak "Invalid mode").
SMARTER_CHATGPT_MODEL = "gpt-5.5"


def resolve_chatgpt_model(engine_pref: Optional[str] = None) -> str:
    """Pilih model ChatGPT dari preferensi request atau env, fallback default."""
    for candidate in (engine_pref, os.environ.get("OKKAX_CHATGPT_MODEL")):
        key = str(candidate or "").strip().lower()
        if key in CHATGPT_MODELS:
            return key
    return DEFAULT_CHATGPT_MODEL


class ChatGPTProvider(BaseLLMProvider):
    """OpenAI ChatGPT melalui Emergent universal key."""

    def __init__(self, enabled: Optional[bool] = None, model: Optional[str] = None):
        super().__init__(
            name="chatgpt",
            default_model=resolve_chatgpt_model(model),
            enabled=True if enabled is None else enabled,
        )
        self.api_key = os.environ.get("EMERGENT_LLM_KEY")

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def _chat(self, system_instruction: Optional[str], model: Optional[str], max_tokens: int):
        from emergentintegrations.llm.chat import LlmChat

        target = resolve_chatgpt_model(model or self.default_model)
        chat = LlmChat(
            api_key=self.api_key,
            session_id=f"okkax-copilot-{int(time.time() * 1000)}",
            system_message=system_instruction or "You are the OKKAX live event operating assistant.",
        ).with_model("openai", target)
        try:
            chat = chat.with_params(max_tokens=max_tokens)
        except Exception:
            pass
        return chat, target

    async def health_check(self) -> ProviderResult:
        if not self.is_configured():
            return ProviderResult.failure("chatgpt", "NOT_CONFIGURED", "EMERGENT_LLM_KEY is missing")
        return await self.generate_text("Reply with PONG only.", max_tokens=16, timeout_seconds=15.0)

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
            return ProviderResult.failure("chatgpt", "DISABLED", "ChatGPT provider disabled")
        if not self.is_configured():
            return ProviderResult.failure("chatgpt", "NOT_CONFIGURED", "EMERGENT_LLM_KEY is missing")

        import asyncio

        from emergentintegrations.llm.chat import UserMessage

        start = time.time()
        try:
            chat, target = self._chat(system_instruction, model, max_tokens)
            text = await asyncio.wait_for(
                chat.send_message(UserMessage(text=prompt)), timeout=timeout_seconds
            )
            latency = (time.time() - start) * 1000
            if not str(text or "").strip():
                return ProviderResult.failure("chatgpt", "BAD_RESPONSE", "Empty completion", latency_ms=latency)
            return ProviderResult.success(
                "chatgpt",
                data={"text": str(text), "model": target},
                latency_ms=latency,
                provenance={"source": "OpenAI ChatGPT", "model": target, "key": "emergent_universal",
                            "verified": True, "calculation_method": "llm_generation"},
            )
        except asyncio.TimeoutError:
            return ProviderResult.failure("chatgpt", "TIMEOUT", f"ChatGPT timed out after {timeout_seconds}s",
                                          latency_ms=(time.time() - start) * 1000)
        except Exception as exc:
            logger.warning("ChatGPT provider failed safely: %s", str(exc)[:180])
            return ProviderResult.failure("chatgpt", "UNAVAILABLE", str(exc)[:180],
                                          latency_ms=(time.time() - start) * 1000)

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
        schema_prompt = (
            f"{prompt}\n\nJawab HANYA dengan satu objek JSON valid sesuai schema berikut, tanpa markdown:\n"
            f"{json.dumps(schema_cls.model_json_schema(), ensure_ascii=False)}"
        )
        res = await self.generate_text(
            schema_prompt,
            system_instruction=system_instruction,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout_seconds=timeout_seconds,
        )
        if not res.ok:
            return res
        raw = str((res.data or {}).get("text") or "")
        payload: Optional[Dict[str, Any]] = None
        for candidate in (raw, re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE)):
            try:
                payload = json.loads(candidate.strip())
                break
            except Exception:
                continue
        if payload is None:
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                try:
                    payload = json.loads(match.group(0))
                except Exception:
                    payload = None
        if not isinstance(payload, dict):
            return ProviderResult.failure("chatgpt", "BAD_RESPONSE", "ChatGPT did not return valid JSON",
                                          latency_ms=res.latency_ms)
        try:
            validated = schema_cls.model_validate(payload)
        except Exception as exc:
            return ProviderResult.failure("chatgpt", "SCHEMA_MISMATCH", str(exc)[:180], latency_ms=res.latency_ms)
        res.data["structured"] = validated.model_dump()
        return res
