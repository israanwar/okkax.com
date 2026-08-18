"""
OKKAX Intelligence - Core Data Models & Schemas.

Pure schema foundation for OKKAX Intelligence:
- IntelligenceRequest
- IntelligenceIntent
- ToolResult
- Provenance
- StructuredPayload
- IntelligenceResponse

Adheres strictly to the OKKAX Provenance Contract, cross-role intent resolution,
and provider-agnostic data structures.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict


class ProvenanceStatus(str, Enum):
    """Validation status for any intelligence data point."""
    VERIFIED = "verified"
    ESTIMATED = "estimated"
    UNAVAILABLE = "unavailable"


class Provenance(BaseModel):
    """
    Mandatory audit & data governance provenance tracking.
    Must accompany all intelligence data outputs.
    """
    model_config = ConfigDict(extra="allow")

    source: str = Field(
        ...,
        description="Source category, e.g. 'internal_database', 'external_provider', 'deterministic_engine'."
    )
    provider_id: str = Field(
        ...,
        description="Provider-neutral identifier, e.g. 'okkax_core', 'ticketing_provider', 'tax_engine'."
    )
    status: ProvenanceStatus = Field(
        ...,
        description="Verification state of the data point: 'verified', 'estimated', or 'unavailable'."
    )
    verified: bool = Field(
        ...,
        description="True if ground-truth verified by platform/provider; False otherwise."
    )
    as_of: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO-8601 timestamp of when the data was retrieved or computed."
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score between 0.0 and 1.0."
    )
    calculation_method: Optional[str] = Field(
        default=None,
        description="Explicit calculation methodology when numeric data is derived."
    )


class IntelligenceIntentCategory(str, Enum):
    """Broad domain intent classifications across all roles."""
    WORKFORCE_DISCOVERY = "workforce_discovery"
    VENDOR_PROCUREMENT = "vendor_procurement"
    TALENT_MATCHING = "talent_matching"
    VENUE_DISCOVERY = "venue_discovery"
    SPONSOR_ACQUISITION = "sponsor_acquisition"
    TENANT_COMMERCIAL = "tenant_commercial"
    EVENT_DESIGN_BLUEPRINT = "event_design_blueprint"
    FINANCIAL_MODELING = "financial_modeling"
    ECONOMIC_RIPPLE = "economic_ripple"
    SCHEDULE_AVAILABILITY = "schedule_availability"
    GENERAL_INTELLIGENCE = "general_intelligence"


class NetworkDirection(str, Enum):
    """Two-way matching direction: Supply looking for Demand vs Demand looking for Supply."""
    SUPPLY_TO_DEMAND = "supply_to_demand"
    DEMAND_TO_SUPPLY = "demand_to_supply"
    BIDIRECTIONAL = "bidirectional"


class IntelligenceIntent(BaseModel):
    """
    Automatically resolved intent & context metadata.
    Extracted from prompt and authenticated session without manual role selector.
    """
    model_config = ConfigDict(extra="allow")

    category: IntelligenceIntentCategory = Field(
        ...,
        description="Resolved high-level domain category."
    )
    detected_role: Optional[str] = Field(
        default=None,
        description="Inferred or session-grounded persona (e.g. 'worker', 'vendor', 'talent', 'venue', 'sponsor', 'tenant', 'organizer')."
    )
    network_direction: NetworkDirection = Field(
        default=NetworkDirection.BIDIRECTIONAL,
        description="Two-way matching orientation (Supply -> Demand or Demand -> Supply)."
    )
    target_city: Optional[str] = Field(
        default=None,
        description="Geographic scope extracted from query."
    )
    target_capacity: Optional[int] = Field(
        default=None,
        ge=0,
        description="Audience capacity parameter if specified."
    )
    target_budget_idr: Optional[int] = Field(
        default=None,
        ge=0,
        description="Financial budget parameter in IDR if specified."
    )
    confidence: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="NLU intent resolution confidence score."
    )
    extracted_parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional domain-specific parameters extracted from prompt."
    )


class IntelligenceRequest(BaseModel):
    """
    Standard request envelope for OKKAX Intelligence.
    Requires authenticated session (Free, Pro, or Max plan).
    """
    model_config = ConfigDict(extra="allow")

    query: str = Field(
        ...,
        min_length=1,
        max_length=4000,
        description="Natural language question or command submitted by the user."
    )
    conversation_id: Optional[str] = Field(
        default=None,
        description="Thread/conversation session identifier for message continuity."
    )
    event_id: Optional[str] = Field(
        default=None,
        description="Optional active event context if invoked from an event scope."
    )
    client_context: Dict[str, Any] = Field(
        default_factory=dict,
        description="Optional client metadata (e.g. current UI route, viewport)."
    )


class ToolResult(BaseModel):
    """
    Standardized atomic result emitted by any OKKAX Intelligence tool.
    Carries deterministic data alongside required provenance.
    """
    model_config = ConfigDict(extra="allow")

    tool_name: str = Field(
        ...,
        description="Name of the atomic tool executed."
    )
    success: bool = Field(
        ...,
        description="Whether the tool execution succeeded."
    )
    data: Dict[str, Any] = Field(
        default_factory=dict,
        description="Grounded payload returned by the provider/engine."
    )
    provenance: Provenance = Field(
        ...,
        description="Audit and data verification metadata."
    )
    error_message: Optional[str] = Field(
        default=None,
        description="Error detail if tool execution failed."
    )


class StructuredPayloadType(str, Enum):
    """Types of interactive card/data structures returned in the response."""
    JOB_CARDS = "job_cards"
    PROCUREMENT_CARDS = "procurement_cards"
    TALENT_CARDS = "talent_cards"
    VENUE_CARDS = "venue_cards"
    SPONSOR_CARDS = "sponsor_cards"
    TENANT_CARDS = "tenant_cards"
    FINANCIAL_BREAKDOWN = "financial_breakdown"
    BLUEPRINT_SUMMARY = "blueprint_summary"
    ECONOMIC_RIPPLE = "economic_ripple"
    AVAILABILITY_MATRIX = "availability_matrix"
    GENERIC_DATA = "generic_data"


class StructuredPayload(BaseModel):
    """
    Interactive structured component payload for frontend rendering.
    """
    model_config = ConfigDict(extra="allow")

    payload_type: StructuredPayloadType = Field(
        ...,
        description="Identifier determining how the frontend should render the cards."
    )
    items: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Structured data items (e.g. job listings, venue options, budget rows)."
    )
    summary_metrics: Dict[str, Any] = Field(
        default_factory=dict,
        description="Top-level aggregations or key metrics."
    )
    provenance: Optional[Provenance] = Field(
        default=None,
        description="Consolidated provenance for the structured payload."
    )


class IntelligenceEntitlementTelemetry(BaseModel):
    """
    Entitlement telemetries returned with response.
    """
    model_config = ConfigDict(extra="allow")

    plan: str = Field(
        ...,
        description="Subscription tier: 'free', 'pro', or 'max'."
    )
    usage: int = Field(
        ...,
        ge=0,
        description="Queries used in current billing/usage cycle."
    )
    limit: Optional[int] = Field(
        default=None,
        ge=0,
        description="Configured query limit for the tier (None if unconstrained)."
    )
    remaining: Optional[int] = Field(
        default=None,
        ge=0,
        description="Remaining queries available in current period."
    )
    reset_at: Optional[str] = Field(
        default=None,
        description="ISO timestamp for the next quota reset."
    )
    warning_state: Literal["normal", "low_credit", "exhausted"] = Field(
        default="normal",
        description="Credit health state."
    )
    upgrade_eligible: bool = Field(
        default=False,
        description="Whether the user is eligible for an upgrade plan."
    )


class IntelligenceResponse(BaseModel):
    """
    Complete response envelope for OKKAX Intelligence.
    Contains grounded editorial synthesis, structured action payload,
    resolved intent, executed tool audit, and entitlement telemetry.
    """
    model_config = ConfigDict(extra="allow")

    reply_markdown: str = Field(
        ...,
        description="Editorial, high-level, data-grounded synthesis in Bahasa Indonesia."
    )
    intent: IntelligenceIntent = Field(
        ...,
        description="Auto-resolved intent and context metadata."
    )
    structured_payload: Optional[StructuredPayload] = Field(
        default=None,
        description="Actionable interactive card structures."
    )
    tool_results: List[ToolResult] = Field(
        default_factory=list,
        description="Audit trace of all atomic tools invoked during generation."
    )
    entitlement: Optional[IntelligenceEntitlementTelemetry] = Field(
        default=None,
        description="Current credit & usage state."
    )
    provenance: Provenance = Field(
        ...,
        description="Primary response provenance."
    )
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO-8601 response generation timestamp."
    )
