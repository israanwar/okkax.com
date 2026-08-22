"""OKKAX Copilot — Typed Unified Response Contract (Shadow Substrate).

Defines Pydantic BaseModel classes that are 100% wire-compatible with every
dict returned by ``ask_okkax_copilot()`` in ``okkax_copilot.py``.

SHADOW MODE: This module is NOT imported by ``server.py`` or
``okkax_copilot.py``.  It is used only by:
  - ``okkax_copilot_agent.py``   (shadow agent validation layer)
  - ``tests/test_okkax_copilot_shadow.py``  (schema conformance tests)

Wire compatibility guarantees
------------------------------
The existing API response dict keys (``reply``, ``engine``, ``source``,
``timestamp``, ``suggestions``, ``tools_available``, ``grounded``, ``intents``,
``pipeline_stages``, ``reasoning_mode``, ``llm_available``) are ALL declared as
Optional so that any existing subset of keys is valid.  Extra keys that appear
in one code path but not another (``calculation``, ``semantic_plan``, etc.) are
also declared as Optional extra-passthrough fields.

Design authority:
  docs/OKKAX_AI_CANONICAL_ARCHITECTURE_AGENT_SPEC_V1.md  (§ response contract)
  backend/okkax_copilot.py (L3183-3195, L3204-3216, L3280-3295, ... all return sites)

Strict labels enforced
------------------------
``reply`` MUST contain at least one of:
  ``[FACT]``, ``[CALCULATED]``, ``[ESTIMATE]``, ``[RECOMMENDATION]``,
  ``[SIMULATION]``, ``[UNKNOWN]``
… UNLESS the source is ``small_talk`` or ``direct_calculation``.
This is validated by ``OkkaxCopilotResponse.validate_label_discipline()``.
"""

from __future__ import annotations

import re
from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, model_validator

# ---------------------------------------------------------------------------
# Label constants (mirrors okkax_copilot.py L31-36)
# ---------------------------------------------------------------------------

LABEL_FACT = "FACT"
LABEL_CALC = "CALCULATED"
LABEL_ESTIMATE = "ESTIMATE"
LABEL_RECO = "RECOMMENDATION"
LABEL_SIM = "SIMULATION"
LABEL_UNKNOWN = "UNKNOWN"

_LABEL_RE = re.compile(
    r"\[(FACT|CALCULATED|ESTIMATE|RECOMMENDATION|SIMULATION|UNKNOWN)\]"
)

_SOURCES_EXEMPT_FROM_LABEL = frozenset({"small_talk", "direct_calculation"})

# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------


class ActionProposalCard(BaseModel):
    """Structured human-in-the-loop action proposal.

    Returned when Copilot detects a write intent but cannot (and must not)
    execute it directly.  The frontend renders this as an interactive
    confirmation card.

    Fields are intentionally minimal so the proposal is easy to parse
    and does not leak internal IDs to the client.
    """
    action: str = Field(description="Canonical action key, e.g. 'resolve_compliance_blocker'")
    label: str = Field(description="Human-readable action label for the UI button")
    domain: str = Field(description="Domain of the action: ticketing | compliance | finance | supply")
    requires_role: str = Field(description="Minimum role required to approve: organizer | admin")
    params: Dict[str, Any] = Field(default_factory=dict, description="Structured parameters to pass to the domain handler on approval")
    warning: Optional[str] = Field(default=None, description="Optional warning message shown in the confirmation card")


class SemanticTurnKind(str, Enum):
    UPDATE = "UPDATE"
    QUESTION = "QUESTION"
    UPDATE_AND_QUESTION = "UPDATE_AND_QUESTION"
    CORRECTION = "CORRECTION"
    ACTION = "ACTION"


class SemanticComplexity(str, Enum):
    S0 = "S0"
    S1 = "S1"
    S2 = "S2"
    S3 = "S3"
    S4 = "S4"
    S5 = "S5"


class SemanticExecutionPlan(BaseModel):
    """Shadow-only control-plane contract; never a production reply."""

    problem_type: str
    user_goal: str
    turn_kind: SemanticTurnKind
    surface: Literal["HOMEPAGE", "CHATBOT", "WORKSPACE"]
    complexity: SemanticComplexity
    state_delta: Dict[str, Any] = Field(default_factory=dict)
    referenced_entities: List[Dict[str, Any]] = Field(default_factory=list)
    material_unknowns: List[str] = Field(default_factory=list)
    knowledge_queries: List[str] = Field(default_factory=list)
    live_data_requirements: List[str] = Field(default_factory=list)
    deterministic_operations: List[str] = Field(default_factory=list)
    tool_plan: List[str] = Field(default_factory=list)
    authorization_requirements: List[str] = Field(default_factory=list)
    response_shape: str = "plain_answer"
    verification_requirements: List[str] = Field(default_factory=list)


class ProviderMeta(BaseModel):
    """Metadata about which LLM provider / model answered this turn."""
    provider: Optional[str] = None
    model: Optional[str] = None
    latency_ms: Optional[float] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None


# ---------------------------------------------------------------------------
# Canonical response model
# ---------------------------------------------------------------------------


class OkkaxCopilotResponse(BaseModel):
    """Typed contract for every response emitted by ``ask_okkax_copilot()``.

    All fields except ``reply`` are Optional so the model validates partial
    returns without raising.  Extra keys from the existing dict (e.g.
    ``semantic_plan``, ``multi_city``) pass through via ``model_config``
    ``extra='allow'``.

    Use ``OkkaxCopilotResponse.model_validate(raw_dict)`` to validate a live
    response.  Validation does NOT mutate the original dict.
    """

    model_config = {"extra": "allow"}

    # ---- Required core -----------------------------------------------------
    reply: str = Field(description="Human-readable reply with strict label discipline")
    engine: str = Field(default="Okkax Copilot")
    source: str = Field(default="unknown")
    timestamp: Optional[str] = None

    # ---- Routing / telemetry -----------------------------------------------
    reasoning_mode: Optional[str] = None
    llm_available: Optional[bool] = None
    grounded: bool = False
    intents: List[str] = Field(default_factory=list)
    pipeline_stages: List[str] = Field(default_factory=list)

    # ---- Surface hints -----------------------------------------------------
    suggestions: List[str] = Field(default_factory=list)
    tools_available: List[str] = Field(default_factory=list)

    # ---- Structured data (Optional) ----------------------------------------
    calculation: Optional[Dict[str, Any]] = None
    semantic_plan: Optional[Dict[str, Any]] = None
    intelligence: Optional[Dict[str, Any]] = None
    venue_discovery: Optional[Dict[str, Any]] = None
    multi_city: Optional[Any] = None
    tools_executed: List[str] = Field(default_factory=list)
    parsed_constraints: Optional[Dict[str, Any]] = None

    # ---- Action card (for write-intent turns) ------------------------------
    action_proposal: Optional[ActionProposalCard] = None

    # ---- Retrieved evidence collection (Optional) -------------------------
    evidence: Optional[Dict[str, Any]] = None
    decision_plan: Optional[Dict[str, Any]] = None
    event_plan: Optional[Dict[str, Any]] = None

    # ---- Provider metadata (only on LLM-answered turns) -------------------
    reasoning_provider: Optional[ProviderMeta] = None
    engine_key: Optional[str] = None
    provider: Optional[str] = None

    # ---- Validators --------------------------------------------------------

    @model_validator(mode="after")
    def validate_label_discipline(self) -> "OkkaxCopilotResponse":
        """Verify that non-trivial replies carry at least one canonical label.

        Exempt sources: ``small_talk``, ``direct_calculation``.
        This enforces the canonical architecture spec label discipline without
        raising on the deterministic short-circuit paths.
        """
        if self.source in _SOURCES_EXEMPT_FROM_LABEL:
            return self
        if not _LABEL_RE.search(self.reply):
            raise ValueError(
                f"OkkaxCopilotResponse.reply for source='{self.source}' MUST contain at least "
                f"one of [FACT] [CALCULATED] [ESTIMATE] [RECOMMENDATION] [SIMULATION] [UNKNOWN]. "
                f"Got reply starting with: {self.reply[:120]!r}"
            )
        return self

    @model_validator(mode="after")
    def validate_no_internal_leaks(self) -> "OkkaxCopilotResponse":
        """Ensure the reply does not expose internal technical markers.

        Blocks are the same patterns caught by ``_strip_internal_leaks()`` in
        ``okkax_copilot.py``.  If the validator catches a leak it raises so
        the test harness surfaces the regression immediately.
        """
        _LEAK_PATTERNS = [
            r"\[INJECT\]",
            r"<\|system\|>",
            r"<\|assistant\|>",
            r"EMERGENT_LLM_KEY",
            r"OPENAI_API_KEY",
        ]
        for pat in _LEAK_PATTERNS:
            if re.search(pat, self.reply, re.IGNORECASE):
                raise ValueError(
                    f"OkkaxCopilotResponse.reply contains forbidden internal token matching /{pat}/. "
                    "Strip internal leaks before returning."
                )
        return self

    # ---- Convenience --------------------------------------------------------

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "OkkaxCopilotResponse":
        """Validate an existing ``ask_okkax_copilot`` return dict.

        Raises ``pydantic.ValidationError`` on contract violations.
        Does not modify the original dict.
        """
        return cls.model_validate(data)

    def has_label(self, label: str) -> bool:
        """Return True if the reply contains the given label tag."""
        return f"[{label}]" in self.reply

    def label_set(self) -> frozenset[str]:
        """Return all label tags present in the reply."""
        return frozenset(_LABEL_RE.findall(self.reply))


# ---------------------------------------------------------------------------
# Typed tool result envelopes (for canonical read-only tools)
# Every tool result carries authoritative provenance metadata.
# ---------------------------------------------------------------------------


class PublicPlatformContext(BaseModel):
    """Typed result of the public platform context summary tool."""
    total_events: int = 0
    published_events: int = 0
    total_venues: int = 0
    total_talents: int = 0
    total_vendors: int = 0
    event_summaries: List[str] = Field(default_factory=list)
    raw_text: str = ""
    provenance_type: Literal["FACT", "CALCULATED", "ESTIMATE", "UNAVAILABLE"] = "FACT"
    source: str = "platform_db"
    authoritative: bool = True
    available: bool = True
    error: Optional[str] = None


class EventBudgetResult(BaseModel):
    """Typed result of the event budget calculator tool."""
    budget: int
    capacity: int
    event_type: str
    policy_key: str
    policy_version: str
    breakdown: Dict[str, Any] = Field(default_factory=dict)
    funding: Dict[str, Any] = Field(default_factory=dict)
    technical_specs: Dict[str, Any] = Field(default_factory=dict)
    breakeven_price_idr: int = 0
    provenance_type: Literal["FACT", "CALCULATED", "ESTIMATE", "UNAVAILABLE"] = "CALCULATED"
    source: str = "calculator_policy"
    authoritative: bool = True
    available: bool = True
    error: Optional[str] = None


class WorkforceRatiosResult(BaseModel):
    """Typed result of workforce ratio calculator tool."""
    capacity: int
    ushers: int
    security: int
    medical_posts: int
    sound_watt_rms: int
    policy_version: str
    provenance_type: Literal["FACT", "CALCULATED", "ESTIMATE", "UNAVAILABLE"] = "CALCULATED"
    source: str = "calculator_policy"
    authoritative: bool = True
    available: bool = True
    error: Optional[str] = None


class PublicCalendarResult(BaseModel):
    """Typed result of public calendar event discovery tool."""
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    city: Optional[str] = None
    category: Optional[str] = None
    events: List[Dict[str, Any]] = Field(default_factory=list)
    total_count: int = 0
    provenance_type: Literal["FACT", "CALCULATED", "ESTIMATE", "UNAVAILABLE"] = "FACT"
    source: str = "calendar_engine"
    authoritative: bool = True
    available: bool = True
    error: Optional[str] = None


class PublicCatalogResult(BaseModel):
    """Typed result of public event catalog search tool."""
    category: Optional[str] = None
    city: Optional[str] = None
    events: List[Dict[str, Any]] = Field(default_factory=list)
    total_count: int = 0
    provenance_type: Literal["FACT", "CALCULATED", "ESTIMATE", "UNAVAILABLE"] = "FACT"
    source: str = "catalog_db"
    authoritative: bool = True
    available: bool = True
    error: Optional[str] = None


class NetworkSupplyResult(BaseModel):
    """Typed result of network supply search tool (talents, venues, vendors, workers)."""
    kind: str = "talent"
    city: Optional[str] = None
    keyword: Optional[str] = None
    items: List[Dict[str, Any]] = Field(default_factory=list)
    total_count: int = 0
    provenance_type: Literal["FACT", "CALCULATED", "ESTIMATE", "UNAVAILABLE"] = "FACT"
    source: str = "network_catalog"
    authoritative: bool = True
    available: bool = True
    error: Optional[str] = None


class MyTicketsSummaryResult(BaseModel):
    """Typed result of user ticket portfolio query (requires authenticated user)."""
    user_id: Optional[str] = None
    ticket_count: int = 0
    active_tickets: List[Dict[str, Any]] = Field(default_factory=list)
    past_tickets: List[Dict[str, Any]] = Field(default_factory=list)
    total_spent_idr: int = 0
    provenance_type: Literal["FACT", "CALCULATED", "ESTIMATE", "UNAVAILABLE"] = "FACT"
    source: str = "ticketing_engine"
    authoritative: bool = True
    available: bool = True
    error: Optional[str] = None


class PrivateEventSummary(BaseModel):
    """Typed result of private event data access (requires ``can_access_private_event``)."""
    event_id: str
    name: Optional[str] = None
    city: Optional[str] = None
    status: Optional[str] = None
    capacity: Optional[int] = None
    days: Optional[int] = None
    available: bool = False
    finance: Optional[Dict[str, Any]] = None
    ticketing: Optional[Dict[str, Any]] = None
    compliance: Optional[Dict[str, Any]] = None
    operational: Optional[Dict[str, Any]] = None
    graph_node_count: Optional[int] = None
    provenance_type: Literal["FACT", "CALCULATED", "ESTIMATE", "UNAVAILABLE"] = "FACT"
    source: str = "event_ground_truth"
    authoritative: bool = True
    error: Optional[str] = None


class EventFinancialStatusResult(BaseModel):
    """Typed result of verified event financial status / budget breakdown."""
    event_id: str
    total_cost: int = 0
    confirmed_funding: int = 0
    funding_gap: int = 0
    cost_lines: List[Dict[str, Any]] = Field(default_factory=list)
    funding_lines: List[Dict[str, Any]] = Field(default_factory=list)
    provenance_type: Literal["FACT", "CALCULATED", "ESTIMATE", "UNAVAILABLE"] = "CALCULATED"
    source: str = "budget_engine"
    authoritative: bool = True
    available: bool = True
    error: Optional[str] = None


class EventTicketingHealthResult(BaseModel):
    """Typed result of verified event ticketing velocity and GMV."""
    event_id: str
    tier_count: int = 0
    sold_tickets: int = 0
    total_capacity: int = 0
    sell_through_pct: float = 0.0
    gmv_idr: int = 0
    tiers: List[Dict[str, Any]] = Field(default_factory=list)
    provenance_type: Literal["FACT", "CALCULATED", "ESTIMATE", "UNAVAILABLE"] = "FACT"
    source: str = "ticketing_engine"
    authoritative: bool = True
    available: bool = True
    error: Optional[str] = None


class EventComplianceReadinessResult(BaseModel):
    """Typed result of verified event legal permit and compliance coverage status."""
    event_id: str
    total_rules: int = 0
    coverage_status: str = "not_configured"
    by_status: Dict[str, int] = Field(default_factory=dict)
    blocked_items: List[Dict[str, Any]] = Field(default_factory=list)
    provenance_type: Literal["FACT", "CALCULATED", "ESTIMATE", "UNAVAILABLE"] = "CALCULATED"
    source: str = "compliance_engine"
    authoritative: bool = True
    available: bool = True
    error: Optional[str] = None


class EventOperationalBlockersResult(BaseModel):
    """Typed result of verified operational blockers, risks, incidents, and pending contracts."""
    event_id: str
    high_severity_risks: int = 0
    open_incidents: int = 0
    talent_pending: int = 0
    vendor_pending: int = 0
    risks: List[Dict[str, Any]] = Field(default_factory=list)
    provenance_type: Literal["FACT", "CALCULATED", "ESTIMATE", "UNAVAILABLE"] = "ESTIMATE"
    source: str = "operations_engine"
    authoritative: bool = True
    available: bool = True
    error: Optional[str] = None
