"""P0.3 Financial Semantic State — foundation + compatibility layer.

Source of truth read before writing this module:
  docs/OKKAX_MASTER_EXECUTION_CONTRACT_V5.md
  docs/OKKAX_AI_CANONICAL_ARCHITECTURE_AGENT_SPEC_V1.md      (§3 authority order, §29 P0.3)
  docs/OKKAX_AI_IMPLEMENTATION_CONTRACT_V1.md
  docs/OKKAX_LANGUAGE_INTELLIGENCE_AND_SEMANTIC_FRAME_SPEC_V1.md (§18 Financial Semantics, §25.2 FS-01..FS-06)

Purpose
-------
Stop treating every number OKKAX Copilot sees as generic "budget"/"sponsor"/
"cost". This module gives every material financial datum a typed home
(BUDGET / CASH / FUNDING / COST / DERIVED), a status lifecycle, and an
authority so the deterministic pipeline (and, later, the LLM prompt) can
tell a user's explicit constraint from a system fact from an estimate.

This is FOUNDATION + a compatibility layer, not a migration:
- `okkax_copilot.py`'s existing parse/merge/calculator pipeline is
  completely untouched (P0.1 arithmetic, P0.2 state boundary, reasoning-
  history boundary, sponsor cancellation chain, sound cap continuity, new-
  topic reset all continue to work exactly as before).
- Only ONE integration point exists: `mirror_current_turn_constraints()`,
  called once per turn to mirror the CURRENT TURN's own explicit constraints
  (never merged/inherited history) into a `FinancialState`, attached
  read-only under `plan["financial_state"]`. Nothing downstream is required
  to read it yet.

Hard rules enforced here (per architecture spec §3 + §29 P0.3, and language
spec §16/§18):
  1. Authority is FIELD-AWARE, not one global rank list. Every field belongs
     to a `FieldCategory` (USER_CONSTRAINT / TRANSACTION_FACT / CASH_STATE /
     DERIVED / POLICY) and only that category's whitelisted authorities may
     write it — see `_FIELD_CATEGORY` / `_CATEGORY_ALLOWED_AUTHORITIES` /
     `FinancialState.can_write()`. A current-turn user correction wins on
     USER_CONSTRAINT fields; a SERVER_FACT, once recorded on a
     TRANSACTION_FACT field, can only be changed by another SERVER_FACT
     (user/LLM may never edit a confirmed transaction) — "server-fact
     supremacy", enforced independently of the plain `locked` flag.
  2. DERIVED-WRITE FENCING — DERIVED fields (funding_gap / cashflow_gap /
     budget_gap) accept ONLY `DETERMINISTIC_CALCULATION` writes; USER_
     CONSTRAINT/TRANSACTION_FACT source fields (event_budget_ceiling,
     approved_budget, sound_cap, production_cap, non_cuttable_costs,
     committed/received transaction facts, ...) never accept a
     `DETERMINISTIC_CALCULATION` write at all — a calculator cannot
     silently mutate the inputs it reads. `available_cash` is the one
     narrow, intentional exception (CASH_STATE category): the SOLE sanction
     for a calculator to touch it is the explicit, relationship-gated
     `derive_cash_after_change()` helper below — no other calculator path
     in this module writes it.
  3. "800M budget - 200M sponsor cancelled = 600M cash" is never inferred
     unless the state EXPLICITLY says 800M is a cash base AND that the
     sponsorship is part of that base (`mark_included_in`). Otherwise:
     record an ambiguity, never invent the number (language spec §16,
     FS-01/FS-03).
  4. FUNDING SOURCE IDENTITY — a sponsorship is ONE identified source
     (`FundingSource`) moving through expected -> committed ->
     received/cancelled, not four unrelated field writes. Only the field
     matching a source's CURRENT status carries its money; every field for
     that source's PRIOR status is reduced accordingly the moment it moves
     on, so a naive sum across statuses can never double/triple-count the
     same money (`record_sponsorship_event`, `field_contributions`). Every
     transition also appends one identity-level `FinancialMutation`
     (subject = source_id, semantic_type, before/after {status, value},
     source_turn_id) — writing to two different fields is never conflated
     into a single lifecycle transition.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


CURRENCY_IDR = "IDR"


class FinancialStatus(str, Enum):
    UNKNOWN = "unknown"
    EXPECTED = "expected"
    COMMITTED = "committed"
    RECEIVED = "received"
    CANCELLED = "cancelled"
    CONFIRMED = "confirmed"


class FinancialAuthority(str, Enum):
    """Mirrors the authority order in
    docs/OKKAX_AI_CANONICAL_ARCHITECTURE_AGENT_SPEC_V1.md §3 (ranked 1-8).
    Only the ranks this foundation phase actually produces are enumerated;
    unused ranks (external intelligence / generic assumption / LLM
    inference) are left for later phases (P1.x) to wire in.
    """
    USER_EXPLICIT_CONSTRAINT = "user_explicit_constraint"     # rank 1
    SERVER_FACT = "server_fact"                                # rank 2
    ACTIVE_EVENT_STATE = "active_event_state"                  # rank 3
    CANONICAL_POLICY = "canonical_policy"                      # rank 4
    DETERMINISTIC_CALCULATION = "deterministic_calculation"    # derived, never LLM
    ESTIMATE = "estimate"                                       # rank 7, must be labeled
    UNKNOWN = "unknown"


# --------------------------------------------------------------------------
# Canonical field taxonomy — BUDGET / CASH / FUNDING / COST / DERIVED.
# Superset of the minimum list in language spec §18; grouping matches this
# task's brief so "budget"/"sponsor"/"cost" are never collapsed together.
# --------------------------------------------------------------------------
BUDGET_FIELDS = ("event_budget_ceiling", "approved_budget", "planning_baseline")
CASH_FIELDS = ("committed_cash", "available_cash", "receivables", "payables")
FUNDING_FIELDS = (
    "expected_sponsorship", "committed_sponsorship", "received_sponsorship",
    "cancelled_sponsorship", "replacement_expected", "replacement_committed",
    "in_kind_sponsorship", "ticket_revenue_target", "tenant_revenue_target",
)
COST_FIELDS = (
    "committed_cost", "paid_cost", "outstanding_cost", "production_cap",
    "sound_cap", "non_cuttable_costs",
)
DERIVED_FIELDS = ("funding_gap", "cashflow_gap", "budget_gap")

ALL_FINANCIAL_FIELDS = BUDGET_FIELDS + CASH_FIELDS + FUNDING_FIELDS + COST_FIELDS + DERIVED_FIELDS


class FieldCategory(str, Enum):
    """Which write-authority rule a field obeys. Replaces the old single
    global "locked" override list — every field now has ITS OWN authority
    whitelist, per the task's field-aware authority requirement.
    """
    USER_CONSTRAINT = "user_constraint"      # planning constraint: user correction wins
    TRANSACTION_FACT = "transaction_fact"    # committed/cancelled status a user can still report; server wins once confirmed
    SETTLED_FACT = "settled_fact"            # received/settled ledger truth: server_fact ONLY, never user/estimate
    CASH_STATE = "cash_state"                # available_cash: user baseline OR the ONE sanctioned relationship-gated recompute
    DERIVED = "derived"                      # *_gap: deterministic calculation ONLY
    POLICY = "policy"                        # canonical policy defaults (none defined yet in this taxonomy)


# One category per canonical field — deliberately exhaustive (no fallback
# relied upon) so every field's write rule is an explicit, reviewable
# decision rather than an implicit default.
_FIELD_CATEGORY: Dict[str, FieldCategory] = {
    "event_budget_ceiling": FieldCategory.USER_CONSTRAINT,
    "approved_budget": FieldCategory.USER_CONSTRAINT,
    "planning_baseline": FieldCategory.USER_CONSTRAINT,

    # Settled/received cash movement — ledger-grade, server-owned truth.
    # user_explicit_constraint/estimate are refused outright (see CASE N):
    # a user's claim never becomes authoritative transaction fact here.
    "committed_cash": FieldCategory.SETTLED_FACT,
    "available_cash": FieldCategory.CASH_STATE,
    "receivables": FieldCategory.SETTLED_FACT,
    "payables": FieldCategory.SETTLED_FACT,

    "expected_sponsorship": FieldCategory.USER_CONSTRAINT,     # forecast/claim, not yet a ledger fact
    "committed_sponsorship": FieldCategory.TRANSACTION_FACT,   # still user-reportable pre-ledger-integration
    "received_sponsorship": FieldCategory.SETTLED_FACT,        # money actually received — server_fact only
    "cancelled_sponsorship": FieldCategory.TRANSACTION_FACT,   # status change, still user-reportable
    "replacement_expected": FieldCategory.USER_CONSTRAINT,
    "replacement_committed": FieldCategory.TRANSACTION_FACT,
    "in_kind_sponsorship": FieldCategory.USER_CONSTRAINT,
    "ticket_revenue_target": FieldCategory.USER_CONSTRAINT,
    "tenant_revenue_target": FieldCategory.USER_CONSTRAINT,

    "committed_cost": FieldCategory.TRANSACTION_FACT,
    "paid_cost": FieldCategory.SETTLED_FACT,                   # money actually paid out — server_fact only
    "outstanding_cost": FieldCategory.TRANSACTION_FACT,
    "production_cap": FieldCategory.USER_CONSTRAINT,
    "sound_cap": FieldCategory.USER_CONSTRAINT,
    "non_cuttable_costs": FieldCategory.USER_CONSTRAINT,

    "funding_gap": FieldCategory.DERIVED,
    "cashflow_gap": FieldCategory.DERIVED,
    "budget_gap": FieldCategory.DERIVED,
}
assert set(_FIELD_CATEGORY) == set(ALL_FINANCIAL_FIELDS), "every canonical field must have an explicit category"

# Which authorities may write each category — the actual field-aware fence.
_CATEGORY_ALLOWED_AUTHORITIES: Dict[FieldCategory, frozenset] = {
    FieldCategory.USER_CONSTRAINT: frozenset({
        "user_explicit_constraint", "server_fact",
    }),
    FieldCategory.TRANSACTION_FACT: frozenset({
        "user_explicit_constraint", "server_fact",
    }),
    FieldCategory.SETTLED_FACT: frozenset({
        "server_fact",
    }),
    # NOTE: "deterministic_calculation" deliberately NOT listed here. Any
    # PUBLIC `state.set("available_cash", X, authority=DETERMINISTIC_
    # CALCULATION)` call is refused (closes the disclosed loophole) — the
    # only way to recompute available_cash is the relationship-gated
    # `derive_cash_after_change()`, which bypasses this whitelist through
    # the private `_apply_validated_derivation()` write path instead.
    FieldCategory.CASH_STATE: frozenset({
        "user_explicit_constraint", "server_fact",
    }),
    FieldCategory.DERIVED: frozenset({
        "deterministic_calculation",
    }),
    FieldCategory.POLICY: frozenset({
        "canonical_policy", "server_fact",
    }),
}


@dataclass
class FinancialDatum:
    """One material financial datum. Every field mandated by the task brief
    is present; nothing here is inferred beyond what's passed in.
    """
    value: Optional[int]
    semantic_type: str
    status: FinancialStatus = FinancialStatus.UNKNOWN
    authority: FinancialAuthority = FinancialAuthority.UNKNOWN
    currency: str = CURRENCY_IDR
    confidence: Optional[float] = None
    source_turn_id: Optional[str] = None
    locked: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "value": self.value,
            "currency": self.currency,
            "semantic_type": self.semantic_type,
            "status": self.status.value if isinstance(self.status, FinancialStatus) else self.status,
            "authority": self.authority.value if isinstance(self.authority, FinancialAuthority) else self.authority,
            "confidence": self.confidence,
            "source_turn_id": self.source_turn_id,
            "locked": self.locked,
        }


@dataclass
class FinancialMutation:
    """A tracked transition — either a plain field value change, or (when
    `source_id` is set) a funding-source lifecycle transition: subject/
    source id, semantic type (`field`), before/after {status, value}, and
    source_turn_id, per the mutation-record rule. Never a silent overwrite.
    """
    field: str
    operation: str
    before: Any
    after: Any
    source_turn_id: Optional[str] = None
    source_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "field": self.field,
            "operation": self.operation,
            "before": self.before,
            "after": self.after,
            "source_turn_id": self.source_turn_id,
            "source_id": self.source_id,
        }


@dataclass
class FinancialAmbiguity:
    """A material gap in the financial picture that must be surfaced, never
    silently resolved by assumption (language spec §16/§22)."""
    field: str
    question: str
    material: bool = True
    blocks: List[str] = field(default_factory=list)
    status: str = "unresolved"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "field": self.field,
            "question": self.question,
            "material": self.material,
            "blocks": list(self.blocks),
            "status": self.status,
        }


@dataclass
class FundingSourceEvent:
    """One entry in a funding source's lifecycle history."""
    status: FinancialStatus
    value: int
    source_turn_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status.value if isinstance(self.status, FinancialStatus) else self.status,
            "value": self.value,
            "source_turn_id": self.source_turn_id,
        }


@dataclass
class FundingSource:
    """A single identified funding source (e.g. one sponsor) moving through
    expected -> committed -> received/cancelled. ONE identity, not N
    independent numbers — see `record_sponsorship_event`.
    """
    source_id: str
    semantic_type: str = "sponsorship"
    history: List[FundingSourceEvent] = field(default_factory=list)

    @property
    def current(self) -> Optional[FundingSourceEvent]:
        return self.history[-1] if self.history else None

    def to_dict(self) -> Dict[str, Any]:
        cur = self.current
        return {
            "source_id": self.source_id,
            "semantic_type": self.semantic_type,
            "current_status": cur.status.value if cur else None,
            "current_value": cur.value if cur else None,
            "history": [e.to_dict() for e in self.history],
        }


class FinancialState:
    """Typed Financial Semantic State container. One `FinancialDatum` per
    canonical field, plus a mutation log, open ambiguities, and identified
    funding sources. This is the ONLY place derived (`*_gap`) fields may be
    written — see the `compute_*_gap` / `derive_*` helpers below.
    """

    def __init__(self) -> None:
        self.fields: Dict[str, FinancialDatum] = {}
        self.mutations: List[FinancialMutation] = []
        self.ambiguities: List[FinancialAmbiguity] = []
        # field -> list of other field names it is explicitly known to
        # include (e.g. "available_cash" includes "expected_sponsorship").
        # Populated ONLY by explicit state, never inferred — see
        # `mark_included_in` and `derive_cash_after_change`.
        self.relationships: Dict[str, List[str]] = {}
        # source_id -> FundingSource identity (rule 4 — funding source
        # identity/lifecycle). Populated by `record_sponsorship_event`.
        self.funding_sources: Dict[str, FundingSource] = {}
        # field_name -> {source_id: value} — how much of a field's current
        # total comes from which source. Lets a field be recomputed as a
        # SUM of live contributions instead of one opaque number, so a
        # source that moves on to a new status is removed from its OLD
        # field's total instead of lingering there forever.
        self.field_contributions: Dict[str, Dict[str, int]] = {}

    def can_write(self, field_name: str, authority: FinancialAuthority) -> bool:
        """Field-aware authority check (rule 1) — the single source of
        truth `set()` and `record_sponsorship_event()` both defer to, so the
        rule is defined exactly once.
        """
        if field_name not in ALL_FINANCIAL_FIELDS:
            return False
        category = _FIELD_CATEGORY[field_name]
        if authority not in _CATEGORY_ALLOWED_AUTHORITIES[category]:
            return False
        existing = self.fields.get(field_name)
        # Server-fact supremacy: once a TRANSACTION_FACT is confirmed by a
        # SERVER_FACT write, only another SERVER_FACT may change it — a
        # user/estimate can no longer edit a confirmed transaction, even
        # though user_explicit_constraint is otherwise a valid writer for
        # this category (it is how the fact gets established in the first
        # place, absent a real ledger integration).
        if (
            existing is not None
            and category == FieldCategory.TRANSACTION_FACT
            and existing.authority == FinancialAuthority.SERVER_FACT
            and authority != FinancialAuthority.SERVER_FACT
        ):
            return False
        return True

    def set(
        self,
        field_name: str,
        value: Optional[int],
        *,
        semantic_type: Optional[str] = None,
        status: FinancialStatus = FinancialStatus.UNKNOWN,
        authority: FinancialAuthority = FinancialAuthority.UNKNOWN,
        confidence: Optional[float] = None,
        source_turn_id: Optional[str] = None,
        locked: bool = False,
        operation: str = "set",
    ) -> FinancialDatum:
        if field_name not in ALL_FINANCIAL_FIELDS:
            raise ValueError(f"Unknown financial field: {field_name!r}")

        existing = self.fields.get(field_name)
        if not self.can_write(field_name, authority):
            # Refused — field-aware authority fence (rule 1) or derived-
            # write fence (rule 2). No mutation, no exception: a refused
            # write is a deterministic no-op, returning whatever was there.
            return existing if existing is not None else FinancialDatum(
                value=None, semantic_type=semantic_type or field_name,
                status=FinancialStatus.UNKNOWN, authority=FinancialAuthority.UNKNOWN,
            )

        before = existing.value if existing is not None else None
        datum = FinancialDatum(
            value=value,
            semantic_type=semantic_type or field_name,
            status=status,
            authority=authority,
            confidence=confidence,
            source_turn_id=source_turn_id,
            locked=locked,
        )
        self.fields[field_name] = datum
        if before != value and (before is not None or value is not None):
            self.mutations.append(FinancialMutation(
                field=field_name, operation=operation, before=before, after=value,
                source_turn_id=source_turn_id,
            ))
        return datum

    def get(self, field_name: str) -> Optional[FinancialDatum]:
        return self.fields.get(field_name)

    def add_ambiguity(
        self, field_name: str, question: str, *, material: bool = True,
        blocks: Optional[List[str]] = None,
    ) -> FinancialAmbiguity:
        amb = FinancialAmbiguity(field=field_name, question=question, material=material,
                                  blocks=list(blocks or [field_name]))
        self.ambiguities.append(amb)
        return amb

    def mark_included_in(self, base_field: str, part_field: str) -> None:
        """Explicitly record that `part_field`'s value is part of
        `base_field`'s value (e.g. sponsorship is part of the cash base).
        This is the ONLY mechanism `derive_cash_after_change` will accept as
        evidence — it is never inferred from co-occurrence in one message.
        """
        self.relationships.setdefault(base_field, [])
        if part_field not in self.relationships[base_field]:
            self.relationships[base_field].append(part_field)

    def field_total(self, field_name: str) -> int:
        """Sum of all live source contributions currently attributed to
        `field_name`. A source that has moved on to a different status no
        longer contributes here (see `record_sponsorship_event`)."""
        return sum(self.field_contributions.get(field_name, {}).values())

    def _apply_validated_derivation(
        self, field_name: str, value: Optional[int], *,
        status: FinancialStatus, authority: FinancialAuthority,
        source_turn_id: Optional[str], operation: str,
    ) -> FinancialDatum:
        """PRIVATE write path for the one sanctioned CASH_STATE recompute
        (`derive_cash_after_change`) ONLY. Deliberately bypasses the public
        `can_write()` category whitelist — that whitelist refuses
        `deterministic_calculation` on `available_cash` outright (see
        `_CATEGORY_ALLOWED_AUTHORITIES[CASH_STATE]`), so there is no public
        `state.set(...)` call that reaches this effect. The only caller
        inside this module is `derive_cash_after_change`, and only AFTER it
        has confirmed the relationship-evidence gate — never call this
        directly for any other purpose.
        """
        if field_name not in ALL_FINANCIAL_FIELDS:
            raise ValueError(f"Unknown financial field: {field_name!r}")
        existing = self.fields.get(field_name)
        before = existing.value if existing is not None else None
        datum = FinancialDatum(value=value, semantic_type=field_name, status=status,
                                authority=authority, source_turn_id=source_turn_id, locked=False)
        self.fields[field_name] = datum
        if before != value and (before is not None or value is not None):
            self.mutations.append(FinancialMutation(
                field=field_name, operation=operation, before=before, after=value,
                source_turn_id=source_turn_id,
            ))
        return datum

    def to_dict(self) -> Dict[str, Any]:
        return {
            "fields": {k: v.to_dict() for k, v in self.fields.items()},
            "mutations": [m.to_dict() for m in self.mutations],
            "ambiguities": [a.to_dict() for a in self.ambiguities],
            "funding_sources": {k: v.to_dict() for k, v in self.funding_sources.items()},
        }


# --------------------------------------------------------------------------
# Deterministic authority helper (rule minimum A/B/C from the task brief).
# --------------------------------------------------------------------------
def resolve_authority(source: str) -> FinancialAuthority:
    """Deterministic source-label -> FinancialAuthority mapping. `source` is
    a short caller-chosen tag, not free text, so this never guesses.
    """
    mapping = {
        "current_user_constraint": FinancialAuthority.USER_EXPLICIT_CONSTRAINT,
        "server_ledger_fact": FinancialAuthority.SERVER_FACT,
        "active_event_state": FinancialAuthority.ACTIVE_EVENT_STATE,
        "canonical_policy": FinancialAuthority.CANONICAL_POLICY,
        "deterministic_calculation": FinancialAuthority.DETERMINISTIC_CALCULATION,
        "estimate": FinancialAuthority.ESTIMATE,
    }
    return mapping.get(source, FinancialAuthority.UNKNOWN)


# --------------------------------------------------------------------------
# Sponsorship lifecycle — ONE identified funding source moving through
# expected -> committed -> received/cancelled (rule 4). Only the field
# matching the source's CURRENT status carries its money; the field for its
# PRIOR status is reduced the instant it moves on, so aggregation
# (`compute_funding_gap`) can never double/triple-count the same money.
# --------------------------------------------------------------------------
_SPONSORSHIP_STATUS_FIELD = {
    FinancialStatus.EXPECTED: "expected_sponsorship",
    FinancialStatus.COMMITTED: "committed_sponsorship",
    FinancialStatus.RECEIVED: "received_sponsorship",
    FinancialStatus.CANCELLED: "cancelled_sponsorship",
}


def record_sponsorship_event(
    state: FinancialState,
    amount: int,
    *,
    status: FinancialStatus,
    source_id: str = "default",
    source_turn_id: Optional[str] = None,
    authority: FinancialAuthority = FinancialAuthority.USER_EXPLICIT_CONSTRAINT,
    locked: bool = True,
) -> FundingSource:
    """Move funding source `source_id` to `status` with `amount`. Returns
    the (possibly unchanged) `FundingSource` identity. `source_id` defaults
    to "default" for single-sponsor callers (e.g. `mirror_current_turn_
    constraints`, which cannot yet distinguish named sponsors from chat
    text) — callers that DO know the identity (e.g. "ACME") should pass it.
    """
    target_field = _SPONSORSHIP_STATUS_FIELD.get(status, "expected_sponsorship")

    if not state.can_write(target_field, authority):
        # Refused per field-aware authority (e.g. a confirmed SERVER_FACT
        # transaction status cannot be edited by a user/estimate write).
        # No bookkeeping is mutated — deterministic no-op.
        return state.funding_sources.get(source_id) or FundingSource(source_id=source_id)

    source = state.funding_sources.setdefault(source_id, FundingSource(source_id=source_id))
    before_event = source.current

    # Atomic lifecycle authority fence: never move the identity to a new
    # status unless the same authority is also allowed to vacate its prior
    # authoritative status. Example: a USER claim cannot move a SERVER_FACT
    # RECEIVED sponsorship to CANCELLED while leaving received money behind.
    if before_event is not None:
        prior_field = _SPONSORSHIP_STATUS_FIELD.get(before_event.status)
        if (
            prior_field
            and prior_field != target_field
            and not state.can_write(prior_field, authority)
        ):
            return source

    source.history.append(FundingSourceEvent(status=status, value=amount, source_turn_id=source_turn_id))

    # Vacate the source's PRIOR status field so its money is never visible
    # under two statuses/fields at once (the double-counting this rule
    # exists to prevent).
    if before_event is not None:
        prior_field = _SPONSORSHIP_STATUS_FIELD.get(before_event.status)
        if prior_field and prior_field != target_field and state.can_write(prior_field, authority):
            state.field_contributions.setdefault(prior_field, {}).pop(source_id, None)
            remaining = state.field_total(prior_field)
            state.set(
                prior_field, remaining, semantic_type=prior_field,
                status=FinancialStatus.UNKNOWN if remaining == 0 else before_event.status,
                authority=authority, source_turn_id=source_turn_id, locked=locked,
                operation=f"funding_source_vacate:{source_id}:{before_event.status.value}",
            )

    state.field_contributions.setdefault(target_field, {})[source_id] = amount
    state.set(
        target_field, state.field_total(target_field), semantic_type=target_field, status=status,
        authority=authority, source_turn_id=source_turn_id, locked=locked,
        operation=f"funding_source_{status.value}:{source_id}",
    )

    # Identity-level mutation — subject/source id, semantic type, before/
    # after {status, value}, source_turn_id (mutation-record rule).
    state.mutations.append(FinancialMutation(
        field=target_field,
        operation=f"funding_source_lifecycle:{status.value}",
        before={"status": before_event.status.value, "value": before_event.value} if before_event else None,
        after={"status": status.value, "value": amount},
        source_turn_id=source_turn_id,
        source_id=source_id,
    ))
    return source


# --------------------------------------------------------------------------
# Derived values — deterministic only, per rule C. Each returns UNKNOWN and
# records a material ambiguity when its required inputs are not explicitly
# present in typed state, rather than inventing a number.
# --------------------------------------------------------------------------
def compute_budget_gap(state: FinancialState, *, source_turn_id: Optional[str] = None) -> FinancialDatum:
    """budget_gap = projected/committed cost - event_budget_ceiling."""
    ceiling = state.get("event_budget_ceiling")
    committed_cost = state.get("committed_cost")
    paid_cost = state.get("paid_cost")
    outstanding_cost = state.get("outstanding_cost")

    cost_value = None

    # An explicit committed_cost is treated as the authoritative total
    # committed exposure. Otherwise reconstruct exposure from settled paid
    # cost plus still-outstanding cost.
    if committed_cost is not None and committed_cost.value is not None:
        cost_value = committed_cost.value
    else:
        known_parts = [
            d.value for d in (paid_cost, outstanding_cost)
            if d is not None and d.value is not None
        ]
        if known_parts:
            cost_value = sum(known_parts)

    if ceiling is None or ceiling.value is None or cost_value is None:
        state.add_ambiguity(
            "budget_gap",
            "Berapa projected/committed cost untuk dibandingkan dengan event_budget_ceiling?",
            material=True, blocks=["budget_gap"],
        )
        return state.set("budget_gap", None, status=FinancialStatus.UNKNOWN,
                          authority=FinancialAuthority.DETERMINISTIC_CALCULATION,
                          source_turn_id=source_turn_id, operation="derive_budget_gap")

    gap = cost_value - ceiling.value
    return state.set("budget_gap", gap, status=FinancialStatus.CONFIRMED,
                      authority=FinancialAuthority.DETERMINISTIC_CALCULATION,
                      source_turn_id=source_turn_id, operation="derive_budget_gap")


def compute_funding_gap(state: FinancialState, *, source_turn_id: Optional[str] = None) -> FinancialDatum:
    """funding_gap = required funding - committed funding.

    Required funding = sum of explicitly-set revenue/sponsorship TARGETS
    (ticket_revenue_target + tenant_revenue_target + expected_sponsorship).
    Committed funding = committed_sponsorship + received_sponsorship. Any
    missing side keeps the result UNKNOWN with an ambiguity recorded — this
    foundation phase never guesses a "required funding" figure.
    """
    required_parts = [
        state.get("ticket_revenue_target"),
        state.get("tenant_revenue_target"),
        state.get("expected_sponsorship"),
    ]
    if not any(p is not None and p.value is not None for p in required_parts):
        state.add_ambiguity(
            "funding_gap",
            "Berapa target funding (ticket/tenant/sponsorship) yang harus dipenuhi?",
            material=True, blocks=["funding_gap"],
        )
        return state.set("funding_gap", None, status=FinancialStatus.UNKNOWN,
                          authority=FinancialAuthority.DETERMINISTIC_CALCULATION,
                          source_turn_id=source_turn_id, operation="derive_funding_gap")
    required = sum(p.value for p in required_parts if p is not None and p.value is not None)
    committed_parts = [state.get("committed_sponsorship"), state.get("received_sponsorship")]
    if not any(p is not None and p.value is not None for p in committed_parts):
        state.add_ambiguity(
            "funding_gap",
            "Berapa committed/received funding yang sudah benar-benar tersedia?",
            material=True, blocks=["funding_gap"],
        )
        return state.set(
            "funding_gap", None,
            status=FinancialStatus.UNKNOWN,
            authority=FinancialAuthority.DETERMINISTIC_CALCULATION,
            source_turn_id=source_turn_id,
            operation="derive_funding_gap",
        )

    committed = sum(
        p.value for p in committed_parts
        if p is not None and p.value is not None
    )
    gap = required - committed
    return state.set("funding_gap", gap, status=FinancialStatus.CONFIRMED,
                      authority=FinancialAuthority.DETERMINISTIC_CALCULATION,
                      source_turn_id=source_turn_id, operation="derive_funding_gap")


def compute_cashflow_gap(state: FinancialState, *, source_turn_id: Optional[str] = None) -> FinancialDatum:
    """cashflow_gap = near-term due payments (payables) - available_cash."""
    payables = state.get("payables")
    available = state.get("available_cash")
    if payables is None or payables.value is None or available is None or available.value is None:
        state.add_ambiguity(
            "cashflow_gap",
            "Berapa payables jatuh tempo near-term dan available_cash saat ini?",
            material=True, blocks=["cashflow_gap"],
        )
        return state.set("cashflow_gap", None, status=FinancialStatus.UNKNOWN,
                          authority=FinancialAuthority.DETERMINISTIC_CALCULATION,
                          source_turn_id=source_turn_id, operation="derive_cashflow_gap")
    gap = payables.value - available.value
    return state.set("cashflow_gap", gap, status=FinancialStatus.CONFIRMED,
                      authority=FinancialAuthority.DETERMINISTIC_CALCULATION,
                      source_turn_id=source_turn_id, operation="derive_cashflow_gap")


def derive_cash_after_change(
    state: FinancialState,
    *,
    cash_field: str = "available_cash",
    changed_field: str = "cancelled_sponsorship",
    source_turn_id: Optional[str] = None,
) -> FinancialDatum:
    """Recompute `cash_field` after a change to `changed_field` (e.g. a
    sponsor cancellation) — but ONLY when state explicitly says
    `changed_field` is included in `cash_field`'s base (via
    `mark_included_in`). Never inferred from the two numbers merely
    appearing in the same conversation (language spec §16, FS-01/FS-03).
    """
    base = state.get(cash_field)
    changed = state.get(changed_field)
    included = changed_field in (state.relationships.get(cash_field) or [])

    derivation_operation = f"derive_cash_after_change:{changed_field}"
    already_applied = any(
        m.field == cash_field and m.operation == derivation_operation
        for m in state.mutations
    )

    # Idempotency: after a relationship has already been consumed by a
    # successful derivation, replaying the same helper must not subtract
    # the same change again. A caller may explicitly mark the relationship
    # again later to authorize a genuinely new derivation.
    if not included and already_applied and base is not None:
        return base

    if base is None or base.value is None or changed is None or changed.value is None or not included:
        state.add_ambiguity(
            cash_field,
            f"Apakah {changed_field} termasuk bagian dari {cash_field}? Tanpa konfirmasi ini, "
            f"{cash_field} tidak bisa dihitung ulang.",
            material=True, blocks=[cash_field],
        )
        # Ambiguous — the base figure (if any) stays as-is; never invented.
        return base if base is not None else state._apply_validated_derivation(
            cash_field, None, status=FinancialStatus.UNKNOWN,
            authority=FinancialAuthority.DETERMINISTIC_CALCULATION, source_turn_id=source_turn_id,
            operation="derive_cash_after_change_unresolved",
        )
    new_value = base.value - changed.value

    # Consume the explicit inclusion relationship. After subtraction the
    # changed component is no longer part of the resulting cash base, which
    # also prevents accidental repeated subtraction.
    relationships = state.relationships.get(cash_field) or []
    if changed_field in relationships:
        relationships.remove(changed_field)

    # Relationship evidence confirmed above — this is the ONE sanctioned
    # write path for available_cash; see `_apply_validated_derivation`.
    return state._apply_validated_derivation(
        cash_field, new_value, status=FinancialStatus.CONFIRMED,
        authority=FinancialAuthority.DETERMINISTIC_CALCULATION,
        source_turn_id=source_turn_id, operation=derivation_operation,
    )


# --------------------------------------------------------------------------
# Compatibility layer — mirror ONLY the current turn's own explicit
# constraints into a fresh FinancialState. Does not read merged/inherited
# history state, so P0.2's state boundary is respected automatically: a
# standalone/new-topic turn's FinancialState never carries a prior event's
# numbers either (rule A: only what THIS turn explicitly said is LOCKED).
# --------------------------------------------------------------------------
def mirror_current_turn_constraints(
    entities: Dict[str, Any],
    constraints: Dict[str, Any],
    *,
    source_turn_id: Optional[str] = None,
) -> FinancialState:
    state = FinancialState()

    budget = constraints.get("budget")
    if budget is not None:
        state.set("event_budget_ceiling", budget, status=FinancialStatus.CONFIRMED,
                   authority=FinancialAuthority.USER_EXPLICIT_CONSTRAINT,
                   source_turn_id=source_turn_id, locked=True, operation="user_set_budget_ceiling")

    vendor_max_budget = constraints.get("vendor_max_budget")
    vendor_type = entities.get("vendor_type")
    if vendor_max_budget is not None and vendor_type == "sound":
        state.set("sound_cap", vendor_max_budget, status=FinancialStatus.CONFIRMED,
                   authority=FinancialAuthority.USER_EXPLICIT_CONSTRAINT,
                   source_turn_id=source_turn_id, locked=True, operation="user_set_sound_cap")
    elif vendor_max_budget is not None:
        state.set("production_cap", vendor_max_budget, status=FinancialStatus.CONFIRMED,
                   authority=FinancialAuthority.USER_EXPLICIT_CONSTRAINT,
                   source_turn_id=source_turn_id, locked=True, operation="user_set_production_cap")

    sponsor_status = constraints.get("sponsor_status")
    sponsor_replacement = constraints.get("sponsor_replacement")
    sponsor_offer = constraints.get("sponsor_offer")
    sponsor_expected = constraints.get("sponsor_expected")
    if sponsor_status == "cancelled" and sponsor_expected is not None:
        record_sponsorship_event(state, sponsor_expected, status=FinancialStatus.CANCELLED,
                                  source_turn_id=source_turn_id)
    elif sponsor_replacement is not None:
        record_sponsorship_event(state, sponsor_replacement, status=FinancialStatus.EXPECTED,
                                  source_turn_id=source_turn_id)
    elif sponsor_offer is not None:
        record_sponsorship_event(state, sponsor_offer, status=FinancialStatus.EXPECTED,
                                  source_turn_id=source_turn_id)
    elif sponsor_expected is not None:
        record_sponsorship_event(state, sponsor_expected, status=FinancialStatus.EXPECTED,
                                  source_turn_id=source_turn_id)

    return state
