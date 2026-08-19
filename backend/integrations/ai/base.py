"""Abstract Base Class for LLM Providers in OKKAX."""

from abc import abstractmethod
from typing import Any, Dict, Optional, Type
from pydantic import BaseModel
from ..base import BaseProvider, ProviderResult


class BaseLLMProvider(BaseProvider):
    """Base interface for all LLM and Generative AI providers."""

    def __init__(self, name: str, default_model: str, enabled: bool = False):
        super().__init__(name=name, enabled=enabled)
        self.default_model = default_model

    @abstractmethod
    async def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 4000,
        timeout_seconds: float = 30.0,
    ) -> ProviderResult:
        """Generate raw text response from the model."""
        pass

    @abstractmethod
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
        """Generate a response strictly conforming to the given Pydantic schema."""
        pass
