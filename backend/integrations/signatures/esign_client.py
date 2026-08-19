"""E-Signature Interface and Capability Contract for OKKAX Deals and Contracts."""

from abc import abstractmethod
import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from ..base import BaseProvider, ProviderResult
from ..exceptions import ProviderNotConfigured
from ..registry import registry

logger = logging.getLogger(__name__)


class ESignDocumentRequest(BaseModel):
    """Specification for digital signature document dispatch."""

    document_id: str
    document_title: str
    document_pdf_url: str
    signers: List[Dict[str, str]]  # list of {"name": str, "email": str, "role": str}
    reference_deal_id: Optional[str] = None


class BaseESignProvider(BaseProvider):
    """Abstract interface for legally certified electronic signature providers."""

    @abstractmethod
    async def request_signature(self, req: ESignDocumentRequest) -> ProviderResult:
        pass

    @abstractmethod
    async def get_signature_status(self, document_id: str) -> ProviderResult:
        pass


class PrivyESignProvider(BaseESignProvider):
    """PrivyID / Certified Indonesian PSrE Provider Contract."""

    def __init__(self):
        super().__init__(name="privy_esign", enabled=False)

    def is_configured(self) -> bool:
        return False

    async def health_check(self) -> ProviderResult:
        return ProviderResult.failure(
            "privy_esign",
            "NOT_CONFIGURED",
            "Certified E-Signature provider is not configured for this deployment",
        )

    async def request_signature(self, req: ESignDocumentRequest) -> ProviderResult:
        raise ProviderNotConfigured("privy_esign", "E-Signature capability contract is reserved for certified deployment")

    async def get_signature_status(self, document_id: str) -> ProviderResult:
        raise ProviderNotConfigured("privy_esign", "E-Signature status check requires configured PSrE provider")


esign_client = PrivyESignProvider()
privy_client = esign_client
registry.register(esign_client)
