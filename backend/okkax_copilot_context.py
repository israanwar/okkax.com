"""OKKAX Copilot — Typed Server-Owned Session Context.

This module defines the single source-of-truth context object that the Pydantic AI
orchestration substrate injects into every tool call via RunContext dependency injection.

SHADOW MODE: This module has NO wiring to ``/okkax/chat``. It is imported only
from ``okkax_copilot_agent.py`` and ``tests/test_okkax_copilot_shadow.py``.

Design authorities:
  docs/OKKAX_MASTER_EXECUTION_CONTRACT_V5.md          (§0 supersession rule)
  docs/OKKAX_AI_CANONICAL_ARCHITECTURE_AGENT_SPEC_V1.md  (§3 authority order)
  docs/OKKAX_AI_IMPLEMENTATION_CONTRACT_V1.md         (server-side role derivation)

Non-negotiable rules enforced here:
  1. Role is NEVER accepted from the client — it must be derived server-side from
     a verified JWT.  The constructor rejects ``role=None`` only after auth.
  2. ``event_snapshot`` is tenant-safe: it is ``None`` unless the server
     verified that the caller owns or has access to the event.
  3. ``is_authenticated`` is a bool set only by the server endpoint, never by
     client payload.
  4. The context object itself is IMMUTABLE (frozen dataclass) so tool functions
     cannot accidentally mutate caller identity.

``pydantic-ai-slim==2.33.0`` is installed.  ``RunContext`` is re-exported from
``pydantic_ai`` so all tool function signatures (``ctx: RunContext[OkkaxSessionContext]``,
``ctx.deps``) use the real framework type without any mock.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Optional


# ---------------------------------------------------------------------------
# Role / Surface Enums
# ---------------------------------------------------------------------------

class CopilotRole(str, Enum):
    """Canonical server-side roles understood by OKKAX Copilot.

    Ordered from lowest to highest privilege.  Tool entitlement functions
    compare against this enum, never against raw client-supplied strings.
    """
    GUEST = "guest"                   # unauthenticated / anonymous
    AUDIENCE = "audience"             # ticket-holder / public member
    TALENT = "talent"                 # verified artist account
    VENDOR = "vendor"                 # verified vendor account
    TENANT = "tenant"                 # event tenant
    SPONSOR = "sponsor"               # event sponsor
    ORGANIZER = "organizer"           # event organizer (event owner)
    FINANCE = "finance"               # financial officer
    STAFF = "staff"                   # internal OKKAX ops staff
    ADMIN = "admin"                   # platform admin
    SUPERADMIN = "superadmin"         # super-admin


class CopilotSurface(str, Enum):
    """Which of the three official Copilot surfaces originated the request."""
    HOMEPAGE = "homepage"             # StitchHeroCommandCapsule (public)
    CHATBOT = "chatbot"               # OkkaxChat floating bot
    WORKSPACE = "workspace"           # /copilot IntelligencePage


# ---------------------------------------------------------------------------
# Tool entitlement helpers
# ---------------------------------------------------------------------------

# Roles that may access private event data (budget, compliance, graph).
_PRIVATE_EVENT_ROLES: frozenset[CopilotRole] = frozenset({
    CopilotRole.ORGANIZER,
    CopilotRole.FINANCE,
    CopilotRole.STAFF,
    CopilotRole.ADMIN,
    CopilotRole.SUPERADMIN,
})

# Roles that may trigger gated write-action proposals.
_ACTION_PROPOSAL_ROLES: frozenset[CopilotRole] = frozenset({
    CopilotRole.ORGANIZER,
    CopilotRole.ADMIN,
    CopilotRole.SUPERADMIN,
})


def _coerce_role(raw: Optional[str]) -> CopilotRole:
    """Map a raw string to a CopilotRole, defaulting to GUEST on unknown."""
    if raw is None:
        return CopilotRole.GUEST
    try:
        return CopilotRole(raw.lower().strip())
    except ValueError:
        return CopilotRole.GUEST


# ---------------------------------------------------------------------------
# Session Context
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class OkkaxSessionContext:
    """Immutable, server-owned dependency injection context for Copilot tools.

    This is the single object passed as ``ctx.deps`` in every tool invocation,
    mirroring ``pydantic_ai.RunContext[OkkaxSessionContext].deps``.  All fields
    are set server-side; client payloads are NEVER trusted to populate this.

    Tool entitlement properties
    ---------------------------
    can_access_private_event   -- True if role + event_snapshot allow reading
                                  private event state (budget, compliance, graph).
    can_propose_action         -- True if role allows returning gated write
                                  action proposals (write actions never execute
                                  directly from chat).
    public_tools_only          -- True for GUEST / HOMEPAGE surface with no
                                  authenticated event context.
    """

    # ---- Identity (server-side ONLY) --------------------------------------
    role: CopilotRole = CopilotRole.GUEST
    is_authenticated: bool = False
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    organization_id: Optional[str] = None
    plan: str = "free"               # user subscription plan: free | pro | max

    # ---- Surface & Route --------------------------------------------------
    surface: CopilotSurface = CopilotSurface.CHATBOT
    current_route: str = ""
    active_entity: Optional[Dict[str, Any]] = None

    # ---- Event Context (tenant-safe, server-verified) ---------------------
    event_id: Optional[str] = None
    event_snapshot: Optional[Dict[str, Any]] = None   # gather_event_ground_truth() output

    # ---- Calculator Policy (loaded from platform_policies) ----------------
    calculator_policy: Optional[Dict[str, Any]] = None

    # ---- DB Handle (motor AsyncIOMotorDatabase or None for tests) ---------
    # Not frozen-comparable — stored as a private attribute wrapper.
    _db: Optional[Any] = field(default=None, compare=False, hash=False, repr=False)

    # ---- Reasoning mode hint -----------------------------------------------
    reasoning_mode: str = "advanced"   # fast | advanced | smarter

    # ---- Entitlement Properties -------------------------------------------

    @property
    def is_admin(self) -> bool:
        """True iff the caller has platform admin or superadmin privileges."""
        return self.role in (CopilotRole.ADMIN, CopilotRole.SUPERADMIN)

    @property
    def can_access_private_event(self) -> bool:
        """True iff the caller has a server-verified event snapshot, a permitted
        role, AND matching tenant/organization ownership.

        Enforces:
        1. Authentication + role in _PRIVATE_EVENT_ROLES.
        2. Non-empty, available event snapshot.
        3. Admin / Superadmin passes automatically.
        4. Event owner matches caller user_id.
        5. Organizer active workspace organization_id matches event organizer_org_id.
        6. Cross-organization or unrelated access is DENIED (returns False).
        """
        if not (
            self.is_authenticated
            and self.role in _PRIVATE_EVENT_ROLES
            and self.event_snapshot is not None
            and bool(self.event_snapshot.get("available"))
        ):
            return False

        if self.is_admin:
            return True

        ev = self.event_snapshot.get("event") or self.event_snapshot
        owner_id = ev.get("owner_user_id") or self.event_snapshot.get("owner_user_id")
        event_org = ev.get("organizer_org_id") or self.event_snapshot.get("organizer_org_id")

        if owner_id and self.user_id and owner_id == self.user_id:
            return True

        if event_org and self.organization_id and event_org == self.organization_id:
            return True

        if owner_id or event_org:
            return False

        return True

    @property
    def can_propose_action(self) -> bool:
        """True iff the caller's verified role permits receiving write-action
        proposal cards.  Proposals do NOT execute — they return a structured
        card that the UI renders as a confirmation button.
        """
        return self.is_authenticated and self.role in _ACTION_PROPOSAL_ROLES

    @property
    def public_tools_only(self) -> bool:
        """True for GUEST sessions or homepage surface with no auth context."""
        return not self.is_authenticated or self.surface == CopilotSurface.HOMEPAGE


# ---------------------------------------------------------------------------
# Factory helpers (used by the shadow agent and tests)
# ---------------------------------------------------------------------------

def make_guest_context(
    current_route: str = "/",
    surface: CopilotSurface = CopilotSurface.HOMEPAGE,
    calculator_policy: Optional[Dict[str, Any]] = None,
    reasoning_mode: str = "advanced",
    db: Any = None,
    active_entity: Optional[Dict[str, Any]] = None,
) -> OkkaxSessionContext:
    """Construct an anonymous / guest context for public homepage queries."""
    return OkkaxSessionContext(
        role=CopilotRole.GUEST,
        is_authenticated=False,
        surface=surface,
        current_route=current_route,
        active_entity=active_entity,
        calculator_policy=calculator_policy,
        reasoning_mode=reasoning_mode,
        _db=db,
    )


def make_authenticated_context(
    *,
    user: Dict[str, Any],
    raw_role: str,
    surface: CopilotSurface,
    current_route: str = "",
    event_id: Optional[str] = None,
    event_snapshot: Optional[Dict[str, Any]] = None,
    organization_id: Optional[str] = None,
    calculator_policy: Optional[Dict[str, Any]] = None,
    reasoning_mode: str = "advanced",
    db: Any = None,
    active_entity: Optional[Dict[str, Any]] = None,
) -> OkkaxSessionContext:
    """Construct an authenticated context from a server-verified JWT payload.

    Args:
        user: Decoded JWT payload dict (``id``, ``email``, ``organization_id``, ``plan``).
        raw_role: Server-side resolved role string (NOT from client payload).
        surface: Which Copilot surface originated the request.
        current_route: Active frontend route path.
        event_id: Server-verified event ID (passed from ``gather_event_ground_truth``).
        event_snapshot: Output of ``gather_event_ground_truth`` if available.
        organization_id: Optional explicit active organization ID.
        calculator_policy: Active ``copilot.calculator.default`` policy doc.
        reasoning_mode: ``fast`` | ``advanced`` | ``smarter``.
        db: AsyncIOMotorDatabase instance.
    """
    resolved_org = (
        organization_id
        or user.get("organization_id")
        or user.get("org_id")
        or (user.get("_workspace_ctx") or {}).get("organization_id")
        or ""
    )
    return OkkaxSessionContext(
        role=_coerce_role(raw_role),
        is_authenticated=True,
        user_id=str(user.get("id") or user.get("_id") or ""),
        user_email=str(user.get("email") or ""),
        organization_id=str(resolved_org),
        plan=str(user.get("plan") or "free"),
        surface=surface,
        current_route=current_route,
        active_entity=active_entity,
        event_id=event_id,
        event_snapshot=event_snapshot,
        calculator_policy=calculator_policy,
        reasoning_mode=reasoning_mode,
        _db=db,
    )


# ---------------------------------------------------------------------------
# RunContext — real pydantic_ai.RunContext (no mock needed now)
# ---------------------------------------------------------------------------

# Re-export so callers use ``from okkax_copilot_context import RunContext``
# without needing to know the exact pydantic_ai internal path.
# Tool signatures ``ctx: RunContext[OkkaxSessionContext]`` remain identical.
from pydantic_ai import RunContext  # noqa: F401 — public re-export

__all__ = [
    "CopilotRole",
    "CopilotSurface",
    "OkkaxSessionContext",
    "RunContext",
    "make_guest_context",
    "make_authenticated_context",
]
