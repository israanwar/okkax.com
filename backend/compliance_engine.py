"""OKKAX Phase 06A — Compliance & Readiness Foundation (read-only, rule-based).

Implements the smallest V5 §2.7 requirement first:

    Event → Classification → Permit Requirement Engine → (Documents → Submission
    → Evidence → Status → Readiness — future micro-phases)

This module intentionally ships ONLY the deterministic, configurable rule
engine plus a read-side derivation path. It does NOT:

* invent universal police / TNI / specific-authority legal requirements
  (Contract V5 §2.7 baris 112 explicitly forbids that);
* claim any direct government-API integration (§5 baris 186);
* implement submission/approval/expiry state (deferred to Phase 06B–06C);
* modify Event Graph readiness_score (deferred to Phase 06D);
* touch Admission/Ticketing which is LOCKED.

Design principles:

1. Rules are DATA, not code — the reference seed lives in
   ``DEFAULT_COMPLIANCE_RULES`` and is upserted into ``db.compliance_rules``
   at startup. A platform admin (future micro-phase) can add/replace rules
   without touching this file.
2. Matching is a pure function of ``(event_attributes, rule)`` — no I/O, no
   randomness — so the same event always derives the same permit list, and
   two independent callers see byte-identical output.
3. Derived rows are persisted to ``db.event_compliance`` on first read
   (idempotent upsert keyed by ``(event_id, rule_id)``) so downstream
   micro-phases can attach evidence/status/audit without re-deriving.
4. Each derived row carries provenance (``rule_id``, ``rule_source``,
   ``rule_version``, ``derived_at``, ``matched_on``) — Contract V5 §6
   "Permit status: verified evidence/submission/authority status;
   provenance required".
5. When no rule matches, the endpoint returns an empty list with
   ``coverage_status="not_configured"`` — NEVER a fabricated permit.
6. Authority categories mirror Contract V5 §2.7 baris 113. The schema
   additionally supports ``requires_international`` for the future
   international-performer branch (§2.7 baris 114); no seed rule uses it
   because Contract V5 forbids "universal assumptions".
"""

from __future__ import annotations

import copy
from typing import Any, Dict, List, Optional


# -----------------------------------------------------------------------------
# 1. Enum-like constants — sourced verbatim from Contract V5 §2.7 baris 113
# -----------------------------------------------------------------------------
AUTHORITY_CATEGORIES: Dict[str, str] = {
    "local_government": "Local government / municipal authority",
    "national_government": "National government agency",
    "public_safety": "Public safety authority",
    "venue_authority": "Venue / area operator authority",
    "fire_emergency": "Fire / emergency services",
    "medical": "Medical / health services",
    "traffic": "Traffic / transportation authority",
    "immigration": "Immigration authority (international performer)",
    "manpower": "Manpower / labor authority",
    "tax": "Tax authority",
    "ip_performing_rights": "IP / performing rights body",
    "environment_noise": "Environment / noise authority",
    "event_specific": "Event-specific compliance (insurance, K3, permits set by event class)",
}

# Per-item status enum. Phase 06B introduces the submission/decision
# lifecycle; Phase 06A already ships "not_configured" as the default that
# marks a row as a placeholder awaiting organizer input (not a fabricated
# permit). Contract V5 §6 requires this to remain server-authoritative.
STATUS_NOT_CONFIGURED = "not_configured"
STATUS_DRAFT = "draft"
STATUS_SUBMITTED = "submitted"
STATUS_ISSUED = "issued"
STATUS_REJECTED = "rejected"
STATUS_REVOKED = "revoked"
STATUS_EXPIRED = "expired"

DEFAULT_ITEM_STATUS = STATUS_NOT_CONFIGURED

# Legal transitions. Everything else is a 400. Approver-side transitions
# additionally require admin role at the endpoint layer.
_ALLOWED_TRANSITIONS = {
    STATUS_NOT_CONFIGURED: {STATUS_DRAFT, STATUS_SUBMITTED},
    STATUS_DRAFT: {STATUS_SUBMITTED},
    STATUS_SUBMITTED: {STATUS_ISSUED, STATUS_REJECTED, STATUS_DRAFT},
    STATUS_REJECTED: {STATUS_DRAFT, STATUS_SUBMITTED},
    STATUS_ISSUED: {STATUS_REVOKED, STATUS_EXPIRED},
    STATUS_REVOKED: set(),
    STATUS_EXPIRED: set(),
}
APPROVER_TRANSITIONS = {STATUS_ISSUED, STATUS_REJECTED, STATUS_REVOKED}
ORGANIZER_TRANSITIONS = {STATUS_DRAFT, STATUS_SUBMITTED}

# Coverage roll-up states derived from item statuses. Phase 06C uses this
# to feed Event Graph readiness_score and the public readiness block.
COVERAGE_STATUS_NO_RULES = "not_configured"
COVERAGE_STATUS_IN_PROGRESS = "in_progress"
COVERAGE_STATUS_PARTIAL = "partial"
COVERAGE_STATUS_COMPLETE = "complete"
COVERAGE_STATUS_BLOCKED = "blocked"


def is_transition_allowed(from_status: str, to_status: str) -> bool:
    """Pure predicate — mirrors _ALLOWED_TRANSITIONS. Kept as a helper so
    tests and future callers do not import the private map directly.
    """
    return to_status in _ALLOWED_TRANSITIONS.get(from_status, set())

# Rule seed version. Bumped whenever DEFAULT_COMPLIANCE_RULES changes so that
# persisted event_compliance rows can be re-derived deterministically.
DEFAULT_RULES_VERSION = "2026.06A.1"
REFERENCE_SEED_SOURCE = "reference_seed"

# Constant used for permissive jurisdiction match ("any jurisdiction served").
JURISDICTION_ANY = "*"


# -----------------------------------------------------------------------------
# 2. Reference seed rules — DATA, not policy claims
# -----------------------------------------------------------------------------
# Each rule is a plain dict with an explicit ``source`` field so downstream
# code and audits can tell reference-seed rules apart from admin-authored
# ones. NONE of these rules assert police/TNI/agency-specific mandates;
# they cover generic operational categories that any organizer already
# performs (venue agreement, insurance, medical standby, fire evacuation
# plan, traffic coordination when using public space, noise notice, IP /
# performing rights). Jurisdiction is scoped to ``ID`` for the Indonesia
# reference set; ``*`` means "applies regardless of jurisdiction served".
#
# Matching predicates are keyword-based against ``event_type`` so admins can
# extend event categories without editing this file.
DEFAULT_COMPLIANCE_RULES: List[Dict[str, Any]] = [
    {
        "id": "cr-ven-001",
        "version": DEFAULT_RULES_VERSION,
        "source": REFERENCE_SEED_SOURCE,
        "jurisdiction": JURISDICTION_ANY,
        "event_type_keywords": [],   # empty = any event_type
        "scale_min": 1,
        "public_space_only": False,
        "safety_only": False,
        "requires_international": None,   # None = irrelevant
        "authority_category": "venue_authority",
        "title": "Venue Rental Agreement & House Rules Acknowledgement",
        "description": "Signed rental agreement with venue authority covering house rules, load-in windows, and post-event turnover.",
        "evidence_required": True,
        "default_deadline_offset_days": -30,
    },
    {
        "id": "cr-ins-001",
        "version": DEFAULT_RULES_VERSION,
        "source": REFERENCE_SEED_SOURCE,
        "jurisdiction": JURISDICTION_ANY,
        "event_type_keywords": [],
        "scale_min": 1,
        "public_space_only": False,
        "safety_only": False,
        "requires_international": None,
        "authority_category": "event_specific",
        "title": "Event Liability Insurance Coverage",
        "description": "Event public liability insurance certificate valid across all event days.",
        "evidence_required": True,
        "default_deadline_offset_days": -21,
    },
    {
        "id": "cr-med-001",
        "version": DEFAULT_RULES_VERSION,
        "source": REFERENCE_SEED_SOURCE,
        "jurisdiction": "ID",
        "event_type_keywords": ["music", "festival", "konser", "concert"],
        "scale_min": 500,
        "public_space_only": False,
        "safety_only": True,
        "requires_international": None,
        "authority_category": "medical",
        "title": "On-site Medical Standby (First Aid + Ambulance)",
        "description": "Medical team with first-aid post and standby ambulance sized to attendance, coordinated with local health service.",
        "evidence_required": True,
        "default_deadline_offset_days": -14,
    },
    {
        "id": "cr-fire-001",
        "version": DEFAULT_RULES_VERSION,
        "source": REFERENCE_SEED_SOURCE,
        "jurisdiction": "ID",
        "event_type_keywords": [],
        "scale_min": 1000,
        "public_space_only": False,
        "safety_only": True,
        "requires_international": None,
        "authority_category": "fire_emergency",
        "title": "Fire Safety & Evacuation Plan Coordination",
        "description": "Fire evacuation plan, extinguisher placement, and coordination with fire/emergency service for events over 1,000 pax.",
        "evidence_required": True,
        "default_deadline_offset_days": -14,
    },
    {
        "id": "cr-traf-001",
        "version": DEFAULT_RULES_VERSION,
        "source": REFERENCE_SEED_SOURCE,
        "jurisdiction": "ID",
        "event_type_keywords": [],
        "scale_min": 1000,
        "public_space_only": True,
        "safety_only": False,
        "requires_international": None,
        "authority_category": "traffic",
        "title": "Traffic Management Coordination (Public-Space Ingress/Egress)",
        "description": "Traffic management plan for events using open / public-space venues over 1,000 pax; coordinated with transportation authority.",
        "evidence_required": True,
        "default_deadline_offset_days": -21,
    },
    {
        "id": "cr-env-001",
        "version": DEFAULT_RULES_VERSION,
        "source": REFERENCE_SEED_SOURCE,
        "jurisdiction": "ID",
        "event_type_keywords": ["music", "festival", "konser", "concert"],
        "scale_min": 1000,
        "public_space_only": False,
        "safety_only": False,
        "requires_international": None,
        "authority_category": "environment_noise",
        "title": "Noise Level Compliance & Neighborhood Notice",
        "description": "Noise-level plan aligned with environment/noise regulation and prior notice to neighboring stakeholders.",
        "evidence_required": False,
        "default_deadline_offset_days": -14,
    },
    {
        "id": "cr-ipr-001",
        "version": DEFAULT_RULES_VERSION,
        "source": REFERENCE_SEED_SOURCE,
        "jurisdiction": "ID",
        "event_type_keywords": ["music", "festival", "konser", "concert"],
        "scale_min": 1,
        "public_space_only": False,
        "safety_only": False,
        "requires_international": None,
        "authority_category": "ip_performing_rights",
        "title": "Performing Rights / Music Licensing Compliance",
        "description": "Coverage of music performing-rights licensing for the setlist performed, sourced from the applicable rights body.",
        "evidence_required": True,
        "default_deadline_offset_days": -21,
    },
]


# -----------------------------------------------------------------------------
# 3. Pure-domain matcher (I/O free, deterministic)
# -----------------------------------------------------------------------------
_INTL_EVENT_ATTRS = (
    "has_international_performer",
    "international_performer",
    "has_international_talent",
)


def _event_jurisdiction(event: Dict[str, Any]) -> Optional[str]:
    """Derive event jurisdiction. Explicit fields win; falls back to a
    country code inferred from the presence of Indonesia-specific fields
    (`city`, `province`). Returns None when nothing is knowable, in which
    case ONLY rules with jurisdiction=='*' can match — guarantees no
    fabricated regional compliance.
    """
    for k in ("jurisdiction", "country_code", "country"):
        v = event.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    # Indonesia demo dataset uses `city`/`venue_name` without explicit country.
    if event.get("city") or event.get("province"):
        return "ID"
    return None


def _event_is_public_space(event: Dict[str, Any], venue: Optional[Dict[str, Any]]) -> bool:
    """True when the event uses an open / public-space venue.

    Uses explicit `is_public_space` if set; otherwise falls back to
    `venue.indoor == False` (outdoor => public space impact likely). When
    neither signal is present, defaults to False to avoid triggering
    public-space rules on unknown venues.
    """
    if isinstance(event.get("is_public_space"), bool):
        return bool(event["is_public_space"])
    if venue and isinstance(venue.get("indoor"), bool):
        return not bool(venue["indoor"])
    if isinstance(event.get("indoor"), bool):
        return not bool(event["indoor"])
    return False


def _event_has_international(event: Dict[str, Any]) -> bool:
    for k in _INTL_EVENT_ATTRS:
        if bool(event.get(k)):
            return True
    return False


def _event_scale(event: Dict[str, Any]) -> int:
    """Best-effort scale = expected attendee capacity. Zero when unknown."""
    for k in ("expected_attendees", "capacity", "attendee_capacity"):
        v = event.get(k)
        if isinstance(v, (int, float)) and v > 0:
            return int(v)
    return 0


def _event_type_tokens(event: Dict[str, Any]) -> List[str]:
    parts: List[str] = []
    for k in ("event_type", "category", "sub_category"):
        v = event.get(k)
        if isinstance(v, str) and v.strip():
            parts.append(v.lower())
    return parts


def _rule_matches(
    rule: Dict[str, Any],
    event: Dict[str, Any],
    venue: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """Return a `matched_on` breakdown when the rule fires, else None.

    The breakdown becomes part of the row's provenance so an auditor can see
    WHY a specific compliance item was raised — Contract V5 §6.
    """
    juris = _event_jurisdiction(event)
    rule_juris = rule.get("jurisdiction", JURISDICTION_ANY)
    if rule_juris != JURISDICTION_ANY:
        if not juris or juris != rule_juris:
            return None

    keywords = [str(k).lower() for k in rule.get("event_type_keywords", []) if k]
    tokens = _event_type_tokens(event)
    if keywords:
        if not any(any(kw in tok for tok in tokens) for kw in keywords):
            return None

    scale = _event_scale(event)
    scale_min = int(rule.get("scale_min", 1) or 1)
    if scale_min > 0 and scale < scale_min:
        # Special case: allow rules with scale_min==1 to match unknown-scale
        # events (scale==0) since they represent "always applies".
        if not (scale_min == 1 and scale == 0):
            return None

    if rule.get("public_space_only") and not _event_is_public_space(event, venue):
        return None
    if rule.get("safety_only"):
        # Safety-only rules apply to event_types where crowd safety is
        # meaningful — matched via keyword overlap OR explicit `safety_flag`.
        if not (keywords or event.get("safety_flag") is True):
            return None

    req_intl = rule.get("requires_international")
    if req_intl is True and not _event_has_international(event):
        return None
    if req_intl is False and _event_has_international(event):
        return None

    return {
        "jurisdiction": juris,
        "scale": scale,
        "event_type_tokens": tokens,
        "is_public_space": _event_is_public_space(event, venue),
        "has_international_performer": _event_has_international(event),
        "matched_keywords": [kw for kw in keywords if any(kw in tok for tok in tokens)],
    }


def derive_required_compliance(
    event: Dict[str, Any],
    rules: Optional[List[Dict[str, Any]]] = None,
    venue: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Pure function: given an event (and optional venue), produce the
    deterministic list of compliance rows the event requires under the
    supplied rule set. Never mutates inputs. Never touches I/O.
    """
    active_rules = rules if rules is not None else DEFAULT_COMPLIANCE_RULES
    rows: List[Dict[str, Any]] = []
    for rule in active_rules:
        matched = _rule_matches(rule, event, venue)
        if matched is None:
            continue
        rows.append({
            "rule_id": rule["id"],
            "rule_version": rule.get("version", DEFAULT_RULES_VERSION),
            "rule_source": rule.get("source", REFERENCE_SEED_SOURCE),
            "authority_category": rule["authority_category"],
            "authority_category_label": AUTHORITY_CATEGORIES.get(
                rule["authority_category"], rule["authority_category"]
            ),
            "title": rule["title"],
            "description": rule["description"],
            "evidence_required": bool(rule.get("evidence_required", False)),
            "jurisdiction": rule.get("jurisdiction", JURISDICTION_ANY),
            "status": DEFAULT_ITEM_STATUS,
            "matched_on": matched,
        })
    # Deterministic order: authority_category then rule_id, so both callers
    # and tests observe the same shape without depending on Mongo iteration.
    rows.sort(key=lambda r: (r["authority_category"], r["rule_id"]))
    return rows


def compute_coverage_status(rows: List[Dict[str, Any]]) -> str:
    """Roll-up state for the whole event derived from item statuses.

    * empty                                     -> ``not_configured``
    * any rejected/revoked/expired              -> ``blocked``
    * all issued                                -> ``complete``
    * some issued (mixed with pending)          -> ``partial``
    * only drafts/submitted/not_configured      -> ``in_progress``

    This feeds Event Graph readiness_score (Phase 06C) and the public
    readiness block. Contract V5 §6 requires this to be derivable.
    """
    if not rows:
        return COVERAGE_STATUS_NO_RULES
    statuses = [r.get("status", DEFAULT_ITEM_STATUS) for r in rows]
    if any(s in (STATUS_REJECTED, STATUS_REVOKED, STATUS_EXPIRED) for s in statuses):
        return COVERAGE_STATUS_BLOCKED
    if all(s == STATUS_ISSUED for s in statuses):
        return COVERAGE_STATUS_COMPLETE
    if any(s == STATUS_ISSUED for s in statuses):
        return COVERAGE_STATUS_PARTIAL
    if any(s == STATUS_SUBMITTED or s == STATUS_DRAFT for s in statuses):
        return COVERAGE_STATUS_IN_PROGRESS
    return COVERAGE_STATUS_NO_RULES


def summarize_compliance_for_graph(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compact summary consumed by /events/{id}/graph to render a single
    Compliance node with a graph-appropriate status label (Confirmed /
    Pending / At Risk / Draft) and counts for the tooltip.
    """
    coverage = compute_coverage_status(rows)
    graph_status = {
        COVERAGE_STATUS_NO_RULES: "Draft",
        COVERAGE_STATUS_IN_PROGRESS: "Pending",
        COVERAGE_STATUS_PARTIAL: "Pending",
        COVERAGE_STATUS_COMPLETE: "Confirmed",
        COVERAGE_STATUS_BLOCKED: "At Risk",
    }[coverage]
    counts: Dict[str, int] = {}
    for r in rows:
        s = r.get("status", DEFAULT_ITEM_STATUS)
        counts[s] = counts.get(s, 0) + 1
    return {
        "coverage_status": coverage,
        "graph_status": graph_status,
        "total": len(rows),
        "counts": counts,
    }


# -----------------------------------------------------------------------------
# 4. Async persistence helpers — thin, so the endpoint stays readable
# -----------------------------------------------------------------------------
async def get_active_compliance_rules(database=None) -> List[Dict[str, Any]]:
    """Fetch active rules from ``platform_policies``-style store, falling
    back to the deterministic reference seed when the DB is unavailable or
    empty. Mirrors the resilience pattern used by
    ``admission_engine.get_active_ticketing_fee_policy``.
    """
    if database is not None:
        try:
            rows = await database.compliance_rules.find(
                {"active": {"$ne": False}}, {"_id": 0}
            ).to_list(500)
            if rows:
                return rows
        except Exception:
            pass
    return copy.deepcopy(DEFAULT_COMPLIANCE_RULES)


async def upsert_reference_compliance_rules(database) -> Dict[str, int]:
    """Idempotently seed the reference rule set. Preserves any admin-authored
    rules (source != reference_seed) and updates seed rows in place when the
    seed version bumps. Safe to call on every startup.
    """
    inserted = 0
    updated = 0
    for rule in DEFAULT_COMPLIANCE_RULES:
        doc = {**copy.deepcopy(rule), "active": True}
        res = await database.compliance_rules.update_one(
            {"id": rule["id"]},
            {"$set": doc},
            upsert=True,
        )
        if res.upserted_id is not None:
            inserted += 1
        elif res.modified_count:
            updated += 1
    return {"inserted": inserted, "updated": updated, "total_seed_rules": len(DEFAULT_COMPLIANCE_RULES)}
