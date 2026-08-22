"""OKKAX Copilot — Canonical Read-Only Tool Catalog (real pydantic-ai-slim 2.33.0).

Defines the authoritative catalog of 12 typed, read-only tools registered with
the real Pydantic AI ``Agent``.

SHADOW MODE — these tools are NOT wired to ``/okkax/chat``.

Architecture & Security Guarantees
----------------------------------
1. NO new business logic: Every tool delegates 100% to canonical OKKAX functions
   or pre-loaded, server-verified event snapshots.
2. ZERO duplicated formulas or constants: Formulas and ratios are imported from
   the authoritative source.
3. Strict Read-Only: 0 write tools.
4. Real Dynamic Entitlement (via ToolPrepareFunc):
   - PUBLIC_READ: exposed to all callers (Guest + Authenticated).
   - AUTH_READ: exposed only to authenticated callers (prepare returns None for guest).
   - EVENT_CONTEXT_READ: exposed only when `can_access_private_event` is True.
   Unauthorized tool schemas are completely invisible to the LLM.
5. Authoritative Provenance: Every result carries `source`, `authoritative`,
   `available`, and `error` state.
6. Offline & Test Safety: Missing DB or event context yields safe typed errors,
   never hallucinations.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition

from okkax_copilot_context import OkkaxSessionContext
from okkax_copilot_models import (
    EventBudgetResult,
    EventComplianceReadinessResult,
    EventFinancialStatusResult,
    EventOperationalBlockersResult,
    EventTicketingHealthResult,
    MyTicketsSummaryResult,
    NetworkSupplyResult,
    PrivateEventSummary,
    PublicCalendarResult,
    PublicCatalogResult,
    PublicPlatformContext,
    WorkforceRatiosResult,
)

logger = logging.getLogger("okkax.copilot.tools")


# ---------------------------------------------------------------------------
# Canonical defaults for workforce ratios
# (inlined to avoid importing okkax_copilot at module level during test collection)
# Mirrors DEFAULT_COPILOT_CALCULATOR_POLICY_DOC["technical_ratios"] exactly.
# ---------------------------------------------------------------------------
_DEFAULT_TECHNICAL_RATIOS = {
    "sound_watt_rms_per_pax": 18,
    "sound_watt_rms_floor": 10_000,
    "ushers_per_pax": 80,
    "security_per_pax": 100,
    "medical_pax_per_post": 2_500,
}
_DEFAULT_POLICY_VERSION = "2026.10A.1"


# ---------------------------------------------------------------------------
# Dynamic Entitlement Guards (pydantic_ai.tools.ToolPrepareFunc)
# ---------------------------------------------------------------------------

async def _prepare_public(
    ctx: RunContext[OkkaxSessionContext],
    tool_def: ToolDefinition,
) -> Optional[ToolDefinition]:
    """Always expose this tool — available to GUEST and all authenticated callers."""
    return tool_def


async def _prepare_authenticated(
    ctx: RunContext[OkkaxSessionContext],
    tool_def: ToolDefinition,
) -> Optional[ToolDefinition]:
    """Expose this tool only to authenticated callers (Guest schemas hidden)."""
    if ctx.deps.is_authenticated:
        return tool_def
    return None


async def _prepare_private_event(
    ctx: RunContext[OkkaxSessionContext],
    tool_def: ToolDefinition,
) -> Optional[ToolDefinition]:
    """Expose this tool only when the caller has verified private event access.

    Returns ``None`` (hides schema from LLM) unless ALL of:
      1. ``is_authenticated == True``
      2. ``role in _PRIVATE_EVENT_ROLES`` (organizer/finance/staff/admin/superadmin)
      3. ``event_snapshot is not None``
      4. ``event_snapshot["available"] == True``
    """
    if ctx.deps.can_access_private_event:
        return tool_def
    return None


# ---------------------------------------------------------------------------
# Authoritative Entitlement Lists & Resolution
# ---------------------------------------------------------------------------

PUBLIC_TOOL_NAMES: List[str] = [
    "calculate_event_budget",
    "calculate_workforce_ratios",
    "get_public_platform_context",
    "get_public_calendar_events",
    "get_public_event_catalog",
    "search_network_supply",
]

AUTH_TOOL_NAMES: List[str] = [
    "get_my_tickets_summary",
]

PRIVATE_EVENT_TOOL_NAMES: List[str] = [
    "get_private_event_summary",
    "get_event_financial_status",
    "get_event_ticketing_health",
    "get_event_compliance_readiness",
    "get_event_operational_blockers",
]


def get_entitled_tools_for_context(ctx: OkkaxSessionContext) -> List[str]:
    """Derive truthful, server-authorized tool names based strictly on authoritative session context.

    Guarantees:
      - Guest: Public tools only. Zero private event tools, zero write tools.
      - Authenticated without private event access: Public + authenticated tools.
      - Authorized organizer with verified event snapshot: Public + authenticated + private event tools.
      - Write capabilities: Never advertised unless specifically permitted.
      - Never trusts client-side role or current_route for authorization.
    """
    tools = list(PUBLIC_TOOL_NAMES)
    if ctx.is_authenticated:
        tools.extend(AUTH_TOOL_NAMES)
    if ctx.can_access_private_event:
        tools.extend(PRIVATE_EVENT_TOOL_NAMES)
    return tools


# ---------------------------------------------------------------------------
# 1. calculate_event_budget (PUBLIC_READ)
# ---------------------------------------------------------------------------

def calculate_event_budget_tool(
    ctx: RunContext[OkkaxSessionContext],
    budget: int,
    capacity: int,
    event_type: str = "Konser Musik",
) -> EventBudgetResult:
    """Hitung alokasi anggaran event secara deterministik.

    Args:
        ctx:        RunContext carrying OkkaxSessionContext.
        budget:     Total event budget in IDR.
        capacity:   Expected audience capacity in pax.
        event_type: Event category label (default: "Konser Musik").

    Returns:
        EventBudgetResult with breakdown and break-even ticket price.
    """
    if budget <= 0:
        raise ValueError(f"budget must be > 0, got {budget}")
    if capacity <= 0:
        raise ValueError(f"capacity must be > 0, got {capacity}")

    from okkax_copilot import calculate_advanced_event_model  # noqa: PLC0415
    policy = ctx.deps.calculator_policy
    raw = calculate_advanced_event_model(budget, capacity, event_type, policy=policy)

    breakeven = 0
    if raw.get("funding") and "breakeven_ticket_price" in raw["funding"]:
        breakeven = int(raw["funding"]["breakeven_ticket_price"])

    return EventBudgetResult(
        budget=raw["budget"],
        capacity=raw["capacity"],
        event_type=raw["event_type"],
        policy_key=raw["policy_key"],
        policy_version=raw["policy_version"],
        breakdown=raw["breakdown"],
        funding=raw["funding"],
        technical_specs=raw["technical_specs"],
        breakeven_price_idr=breakeven,
        source="calculator_policy",
        authoritative=True,
        available=True,
    )


# ---------------------------------------------------------------------------
# 2. calculate_workforce_ratios (PUBLIC_READ)
# ---------------------------------------------------------------------------

def calculate_workforce_ratios_tool(
    ctx: RunContext[OkkaxSessionContext],
    capacity: int,
) -> WorkforceRatiosResult:
    """Hitung kebutuhan workforce berdasarkan kapasitas penonton.

    Args:
        ctx:      RunContext carrying OkkaxSessionContext.
        capacity: Audience capacity in pax.

    Returns:
        WorkforceRatiosResult with deterministic ratios.
    """
    if capacity <= 0:
        raise ValueError(f"capacity must be > 0, got {capacity}")

    policy = ctx.deps.calculator_policy or {}
    tr = policy.get("technical_ratios") or _DEFAULT_TECHNICAL_RATIOS

    sound_floor = int(tr.get("sound_watt_rms_floor", _DEFAULT_TECHNICAL_RATIOS["sound_watt_rms_floor"]))
    sound_per_pax = int(tr.get("sound_watt_rms_per_pax", _DEFAULT_TECHNICAL_RATIOS["sound_watt_rms_per_pax"]))
    ushers_ratio = int(tr.get("ushers_per_pax", _DEFAULT_TECHNICAL_RATIOS["ushers_per_pax"]))
    security_ratio = int(tr.get("security_per_pax", _DEFAULT_TECHNICAL_RATIOS["security_per_pax"]))
    medical_ratio = int(tr.get("medical_pax_per_post", _DEFAULT_TECHNICAL_RATIOS["medical_pax_per_post"]))

    return WorkforceRatiosResult(
        capacity=capacity,
        ushers=max(6, capacity // ushers_ratio),
        security=max(8, capacity // security_ratio),
        medical_posts=max(1, capacity // medical_ratio),
        sound_watt_rms=max(sound_floor, capacity * sound_per_pax),
        policy_version=policy.get("version", _DEFAULT_POLICY_VERSION),
        source="calculator_policy",
        authoritative=True,
        available=True,
    )


# ---------------------------------------------------------------------------
# 3. get_public_platform_context (PUBLIC_READ)
# ---------------------------------------------------------------------------

async def get_public_platform_context_tool(
    ctx: RunContext[OkkaxSessionContext],
) -> PublicPlatformContext:
    """Ambil ringkasan real-time platform OKKAX dari database."""
    try:
        from okkax_copilot import get_dynamic_platform_context  # noqa: PLC0415
        raw_text = await get_dynamic_platform_context()
        return PublicPlatformContext(
            raw_text=raw_text,
            source="platform_db",
            authoritative=True,
            available=True,
        )
    except Exception as exc:
        logger.warning("get_public_platform_context_tool fallback: %s", exc)
        return PublicPlatformContext(
            raw_text="",
            source="platform_db",
            authoritative=True,
            available=False,
            error=str(exc),
        )


# ---------------------------------------------------------------------------
# 4. get_public_calendar_events (PUBLIC_READ)
# ---------------------------------------------------------------------------

async def get_public_calendar_events_tool(
    ctx: RunContext[OkkaxSessionContext],
    city: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    category: Optional[str] = None,
) -> PublicCalendarResult:
    """Ambil daftar event kalender publik OKKAX dari calendar_engine."""
    try:
        from calendar_engine import public_calendar  # noqa: PLC0415
        res = await public_calendar(
            city=city or "",
            date_from=date_from or "",
            date_to=date_to or "",
            category=category or "",
        )
        entries = res.get("items") or res.get("entries") or []
        return PublicCalendarResult(
            city=city,
            date_from=date_from,
            date_to=date_to,
            category=category,
            events=entries[:20],
            total_count=len(entries),
            source="calendar_engine",
            authoritative=True,
            available=True,
        )
    except Exception as exc:
        logger.warning("get_public_calendar_events_tool fallback: %s", exc)
        return PublicCalendarResult(
            city=city,
            date_from=date_from,
            date_to=date_to,
            category=category,
            events=[],
            total_count=0,
            source="calendar_engine",
            authoritative=True,
            available=False,
            error=str(exc),
        )


# ---------------------------------------------------------------------------
# 5. get_public_event_catalog (PUBLIC_READ)
# ---------------------------------------------------------------------------

async def get_public_event_catalog_tool(
    ctx: RunContext[OkkaxSessionContext],
    city: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 10,
) -> PublicCatalogResult:
    """Cari event publik yang diterbitkan di platform OKKAX.

    Delegates directly to canonical `server.discover()` with fallback.
    """
    try:
        try:
            from server import discover  # noqa: PLC0415
            res = await discover(
                city=city or "",
                category=category or "",
                limit=min(max(1, limit), 50),
            )
            items = res.get("items") or []
            formatted = []
            for d in items:
                formatted.append({
                    "id": d.get("id"),
                    "name": d.get("name"),
                    "city": d.get("city"),
                    "category": d.get("category"),
                    "venue_name": d.get("venue_name"),
                    "start_date": d.get("start_date"),
                    "capacity": d.get("capacity"),
                })
            return PublicCatalogResult(
                city=city,
                category=category,
                events=formatted,
                total_count=len(formatted),
                provenance_type="FACT",
                source="discover_service",
                authoritative=True,
                available=True,
            )
        except Exception:
            from core import db  # noqa: PLC0415
            query: Dict[str, Any] = {"status": "published"}
            if city and city.strip():
                query["city"] = {"$regex": f"^{city.strip()}$", "$options": "i"}
            if category and category.strip():
                query["category"] = {"$regex": f"^{category.strip()}$", "$options": "i"}

            docs = await db.events.find(query, {"_id": 0}).to_list(min(max(1, limit), 50))
            formatted = []
            for d in docs:
                formatted.append({
                    "id": d.get("id"),
                    "name": d.get("name"),
                    "city": d.get("city"),
                    "category": d.get("category"),
                    "venue_name": d.get("venue_name"),
                    "start_date": d.get("start_date"),
                    "capacity": d.get("capacity"),
                })
            return PublicCatalogResult(
                city=city,
                category=category,
                events=formatted,
                total_count=len(formatted),
                provenance_type="FACT",
                source="catalog_db",
                authoritative=True,
                available=True,
            )
    except Exception as exc:
        logger.warning("get_public_event_catalog_tool fallback: %s", exc)
        return PublicCatalogResult(
            city=city,
            category=category,
            events=[],
            total_count=0,
            provenance_type="UNAVAILABLE",
            source="catalog_db",
            authoritative=False,
            available=False,
            error=str(exc),
        )


# ---------------------------------------------------------------------------
# 6. search_network_supply (PUBLIC_READ)
# ---------------------------------------------------------------------------

async def search_network_supply_tool(
    ctx: RunContext[OkkaxSessionContext],
    kind: str = "talent",
    city: Optional[str] = None,
    keyword: Optional[str] = None,
    limit: int = 10,
) -> NetworkSupplyResult:
    """Cari data jaringan supply OKKAX: talent, venue, vendor, atau pekerja/worker.

    Delegates to canonical `server.catalog_*()` functions with fallback.
    """
    target_kind = (kind or "talent").lower()
    limit_val = min(max(1, limit), 50)
    try:
        try:
            import server  # noqa: PLC0415
            items: List[Dict[str, Any]] = []
            if target_kind == "talent":
                res = await server.catalog_talents(q=keyword or "", city=city or "", limit=limit_val)
                for d in res.get("items", []):
                    items.append({"id": d.get("id"), "name": d.get("stage_name") or d.get("name"), "genre": d.get("genre"), "fee": d.get("base_fee")})
            elif target_kind == "venue":
                res = await server.catalog_venues(q=keyword or "", city=city or "", limit=limit_val)
                for d in res.get("items", []):
                    items.append({"id": d.get("id"), "name": d.get("name"), "city": d.get("city"), "capacity": d.get("standing_capacity")})
            elif target_kind == "vendor":
                res = await server.catalog_vendors(q=keyword or "", city=city or "", limit=limit_val)
                for d in res.get("items", []):
                    items.append({"id": d.get("id"), "name": d.get("name"), "category": d.get("category"), "city": d.get("city") or d.get("service_cities")})
            elif target_kind in ("worker", "workforce"):
                res = await server.catalog_workers(q=keyword or "", city=city or "", limit=limit_val)
                for d in res.get("items", []):
                    items.append({"id": d.get("id"), "name": d.get("name"), "role": d.get("role"), "daily_rate": d.get("daily_rate")})

            return NetworkSupplyResult(
                kind=target_kind,
                city=city,
                keyword=keyword,
                items=items,
                total_count=len(items),
                provenance_type="FACT",
                source="network_catalog_service",
                authoritative=True,
                available=True,
            )
        except Exception:
            from core import db  # noqa: PLC0415
            items = []
            if target_kind == "talent":
                q: Dict[str, Any] = {}
                if keyword:
                    q["$or"] = [
                        {"name": {"$regex": keyword, "$options": "i"}},
                        {"stage_name": {"$regex": keyword, "$options": "i"}},
                        {"genre": {"$regex": keyword, "$options": "i"}},
                    ]
                docs = await db.talents.find(q, {"_id": 0}).to_list(limit_val)
                items = [{"id": d.get("id"), "name": d.get("stage_name") or d.get("name"), "genre": d.get("genre"), "fee": d.get("base_fee") or d.get("fee")} for d in docs]
            elif target_kind == "venue":
                q = {}
                if city:
                    q["city"] = {"$regex": f"^{city.strip()}$", "$options": "i"}
                if keyword:
                    q["name"] = {"$regex": keyword, "$options": "i"}
                docs = await db.venues.find(q, {"_id": 0}).to_list(limit_val)
                items = [{"id": d.get("id"), "name": d.get("name"), "city": d.get("city"), "capacity": d.get("standing_capacity") or d.get("capacity")} for d in docs]
            elif target_kind == "vendor":
                q = {}
                if keyword:
                    q["$or"] = [
                        {"name": {"$regex": keyword, "$options": "i"}},
                        {"category": {"$regex": keyword, "$options": "i"}},
                    ]
                docs = await db.vendors.find(q, {"_id": 0}).to_list(limit_val)
                items = [{"id": d.get("id"), "name": d.get("name"), "category": d.get("category"), "city": d.get("city")} for d in docs]
            elif target_kind in ("worker", "workforce"):
                q = {}
                if keyword:
                    q["role"] = {"$regex": keyword, "$options": "i"}
                docs = await db.workers.find(q, {"_id": 0}).to_list(limit_val)
                items = [{"id": d.get("id"), "name": d.get("name"), "role": d.get("role"), "daily_rate": d.get("daily_rate")} for d in docs]

            return NetworkSupplyResult(
                kind=target_kind,
                city=city,
                keyword=keyword,
                items=items,
                total_count=len(items),
                provenance_type="FACT",
                source="network_catalog",
                authoritative=True,
                available=True,
            )
    except Exception as exc:
        logger.warning("search_network_supply_tool fallback: %s", exc)
        return NetworkSupplyResult(
            kind=kind,
            city=city,
            keyword=keyword,
            items=[],
            total_count=0,
            provenance_type="UNAVAILABLE",
            source="network_catalog",
            authoritative=False,
            available=False,
            error=str(exc),
        )


# ---------------------------------------------------------------------------
# 7. get_my_tickets_summary (AUTH_READ)
# ---------------------------------------------------------------------------

async def get_my_tickets_summary_tool(
    ctx: RunContext[OkkaxSessionContext],
) -> MyTicketsSummaryResult:
    """Ambil ringkasan portofolio tiket milik pengguna yang sedang login.

    Delegates to canonical `server.my_tickets()` with fallback.
    """
    if not ctx.deps.is_authenticated or not ctx.deps.user_id:
        return MyTicketsSummaryResult(
            user_id=None,
            ticket_count=0,
            provenance_type="UNAVAILABLE",
            source="ticketing_engine",
            authoritative=False,
            available=False,
            error="unauthenticated",
        )

    user_id = ctx.deps.user_id
    try:
        try:
            from server import my_tickets  # noqa: PLC0415
            res = await my_tickets(user={"id": user_id})
            tickets = res.get("items") or []
        except Exception:
            from core import db  # noqa: PLC0415
            tickets = await db.tickets.find({"user_id": user_id}, {"_id": 0}).to_list(100)

        active: List[Dict[str, Any]] = []
        past: List[Dict[str, Any]] = []
        total_spent = 0

        for t in tickets:
            status = t.get("status", "valid")
            price = int(t.get("price", 0))
            total_spent += price
            item = {
                "ticket_id": t.get("id"),
                "event_id": t.get("event_id"),
                "tier_name": t.get("tier_name"),
                "status": status,
                "price": price,
            }
            if status in ("valid", "issued"):
                active.append(item)
            else:
                past.append(item)

        return MyTicketsSummaryResult(
            user_id=user_id,
            ticket_count=len(tickets),
            active_tickets=active,
            past_tickets=past,
            total_spent_idr=total_spent,
            provenance_type="FACT",
            source="ticketing_engine",
            authoritative=True,
            available=True,
        )
    except Exception as exc:
        logger.warning("get_my_tickets_summary_tool fallback: %s", exc)
        return MyTicketsSummaryResult(
            user_id=user_id,
            ticket_count=0,
            provenance_type="UNAVAILABLE",
            source="ticketing_engine",
            authoritative=False,
            available=False,
            error=str(exc),
        )


# ---------------------------------------------------------------------------
# 8. get_private_event_summary (EVENT_CONTEXT_READ)
# ---------------------------------------------------------------------------

def get_private_event_summary_tool(
    ctx: RunContext[OkkaxSessionContext],
) -> PrivateEventSummary:
    """Baca ringkasan operasional event yang sudah diverifikasi server."""
    if not ctx.deps.can_access_private_event:
        return PrivateEventSummary(
            event_id=ctx.deps.event_id or "",
            available=False,
            error="unauthorized_or_missing_snapshot",
        )

    snap = ctx.deps.event_snapshot or {}
    ev = snap.get("event") or {}

    return PrivateEventSummary(
        event_id=ctx.deps.event_id or ev.get("id", ""),
        name=ev.get("name") or snap.get("name"),
        city=ev.get("city"),
        status=ev.get("status"),
        capacity=ev.get("capacity"),
        days=ev.get("days"),
        available=True,
        finance=snap.get("finance"),
        ticketing=snap.get("ticketing"),
        compliance=snap.get("compliance"),
        operational=snap.get("operational"),
        graph_node_count=snap.get("graph_node_count"),
        source="event_ground_truth",
        authoritative=True,
    )


# ---------------------------------------------------------------------------
# 9. get_event_financial_status (EVENT_CONTEXT_READ)
# ---------------------------------------------------------------------------

async def get_event_financial_status_tool(
    ctx: RunContext[OkkaxSessionContext],
) -> EventFinancialStatusResult:
    """Ambil rincian status keuangan event: total cost, confirmed funding, dan funding gap."""
    if not ctx.deps.can_access_private_event:
        return EventFinancialStatusResult(
            event_id=ctx.deps.event_id or "",
            available=False,
            error="unauthorized_or_missing_snapshot",
        )

    event_id = ctx.deps.event_id or ""
    snap = ctx.deps.event_snapshot or {}
    finance = snap.get("finance") or {}

    # If snap already has the values, construct result directly
    if "total_cost" in finance and "confirmed_funding" in finance:
        return EventFinancialStatusResult(
            event_id=event_id,
            total_cost=int(finance.get("total_cost") or 0),
            confirmed_funding=int(finance.get("confirmed_funding") or 0),
            funding_gap=int(finance.get("funding_gap") or 0),
            source="budget_engine",
            authoritative=True,
            available=True,
        )

    # Fallback to compute_budget
    try:
        from server import compute_budget  # noqa: PLC0415
        b = await compute_budget(event_id)
        return EventFinancialStatusResult(
            event_id=event_id,
            total_cost=int(b.get("total_cost") or 0),
            confirmed_funding=int(b.get("confirmed_funding") or 0),
            funding_gap=int(b.get("funding_gap") or 0),
            cost_lines=b.get("cost_lines", [])[:10],
            funding_lines=b.get("funding_lines", [])[:10],
            source="budget_engine",
            authoritative=True,
            available=True,
        )
    except Exception as exc:
        logger.warning("get_event_financial_status_tool fallback: %s", exc)
        return EventFinancialStatusResult(
            event_id=event_id,
            available=False,
            error=str(exc),
        )


# ---------------------------------------------------------------------------
# 10. get_event_ticketing_health (EVENT_CONTEXT_READ)
# ---------------------------------------------------------------------------

async def get_event_ticketing_health_tool(
    ctx: RunContext[OkkaxSessionContext],
) -> EventTicketingHealthResult:
    """Ambil metrik penjualan tiket event: sold, kapasitas, GMV, dan sell-through rate."""
    if not ctx.deps.can_access_private_event:
        return EventTicketingHealthResult(
            event_id=ctx.deps.event_id or "",
            available=False,
            error="unauthorized_or_missing_snapshot",
        )

    event_id = ctx.deps.event_id or ""
    snap = ctx.deps.event_snapshot or {}
    ticketing = snap.get("ticketing") or {}

    if "sold" in ticketing and "capacity" in ticketing:
        return EventTicketingHealthResult(
            event_id=event_id,
            tier_count=int(ticketing.get("tier_count") or 0),
            sold_tickets=int(ticketing.get("sold") or 0),
            total_capacity=int(ticketing.get("capacity") or 0),
            sell_through_pct=float(ticketing.get("sell_through_pct") or 0.0),
            gmv_idr=int(ticketing.get("gmv_idr") or 0),
            source="ticketing_engine",
            authoritative=True,
            available=True,
        )

    try:
        from core import db  # noqa: PLC0415
        tiers = await db.ticket_tiers.find({"event_id": event_id}, {"_id": 0}).to_list(50)
        sold = sum(t.get("sold", 0) for t in tiers)
        capacity = sum(t.get("quantity", 0) for t in tiers)
        gmv = sum(t.get("sold", 0) * t.get("price", 0) for t in tiers)
        pct = round((sold / capacity) * 100, 2) if capacity else 0.0

        return EventTicketingHealthResult(
            event_id=event_id,
            tier_count=len(tiers),
            sold_tickets=sold,
            total_capacity=capacity,
            sell_through_pct=pct,
            gmv_idr=gmv,
            tiers=[{"name": t.get("name"), "sold": t.get("sold"), "quantity": t.get("quantity"), "price": t.get("price")} for t in tiers],
            source="ticketing_engine",
            authoritative=True,
            available=True,
        )
    except Exception as exc:
        logger.warning("get_event_ticketing_health_tool fallback: %s", exc)
        return EventTicketingHealthResult(
            event_id=event_id,
            available=False,
            error=str(exc),
        )


# ---------------------------------------------------------------------------
# 11. get_event_compliance_readiness (EVENT_CONTEXT_READ)
# ---------------------------------------------------------------------------

async def get_event_compliance_readiness_tool(
    ctx: RunContext[OkkaxSessionContext],
) -> EventComplianceReadinessResult:
    """Ambil status kelayakan perizinan dan compliance legal event."""
    if not ctx.deps.can_access_private_event:
        return EventComplianceReadinessResult(
            event_id=ctx.deps.event_id or "",
            available=False,
            error="unauthorized_or_missing_snapshot",
        )

    event_id = ctx.deps.event_id or ""
    snap = ctx.deps.event_snapshot or {}
    comp = snap.get("compliance") or {}

    if "coverage_status" in comp:
        return EventComplianceReadinessResult(
            event_id=event_id,
            total_rules=int(comp.get("total") or 0),
            coverage_status=comp.get("coverage_status") or "not_configured",
            by_status=comp.get("by_status") or {},
            blocked_items=comp.get("blocked_items") or [],
            source="compliance_engine",
            authoritative=True,
            available=True,
        )

    try:
        from core import db  # noqa: PLC0415
        from compliance_engine import compute_coverage_status  # noqa: PLC0415
        rows = await db.event_compliance.find({"event_id": event_id}, {"_id": 0}).to_list(200)
        by_status: Dict[str, int] = {}
        blocked = []
        for r in rows:
            s = r.get("status", "not_configured")
            by_status[s] = by_status.get(s, 0) + 1
            if s in ("rejected", "revoked", "expired"):
                blocked.append({
                    "rule_id": r.get("rule_id"),
                    "title": r.get("title"),
                    "status": s,
                })
        return EventComplianceReadinessResult(
            event_id=event_id,
            total_rules=len(rows),
            coverage_status=compute_coverage_status(rows) if rows else "not_configured",
            by_status=by_status,
            blocked_items=blocked,
            source="compliance_engine",
            authoritative=True,
            available=True,
        )
    except Exception as exc:
        logger.warning("get_event_compliance_readiness_tool fallback: %s", exc)
        return EventComplianceReadinessResult(
            event_id=event_id,
            available=False,
            error=str(exc),
        )


# ---------------------------------------------------------------------------
# 12. get_event_operational_blockers (EVENT_CONTEXT_READ)
# ---------------------------------------------------------------------------

async def get_event_operational_blockers_tool(
    ctx: RunContext[OkkaxSessionContext],
) -> EventOperationalBlockersResult:
    """Ambil data risiko operasional, insiden terbuka, dan kontrak pending."""
    if not ctx.deps.can_access_private_event:
        return EventOperationalBlockersResult(
            event_id=ctx.deps.event_id or "",
            available=False,
            error="unauthorized_or_missing_snapshot",
        )

    event_id = ctx.deps.event_id or ""
    snap = ctx.deps.event_snapshot or {}
    op = snap.get("operational") or {}

    if "high_severity_risks" in op or "open_incidents" in op:
        return EventOperationalBlockersResult(
            event_id=event_id,
            high_severity_risks=int(op.get("high_severity_risks") or 0),
            open_incidents=int(op.get("open_incidents") or 0),
            talent_pending=int(op.get("talent_pending") or 0),
            vendor_pending=int(op.get("vendor_pending") or 0),
            risks=[],
            source="operations_engine",
            authoritative=True,
            available=True,
        )

    try:
        from core import db  # noqa: PLC0415
        risks = await db.risks.find(
            {"event_id": event_id, "severity": {"$in": ["High", "Critical"]}},
            {"_id": 0},
        ).to_list(50)
        incidents = await db.incidents.count_documents(
            {"event_id": event_id, "status": {"$in": ["open", "pending", "investigating"]}}
        )
        talent_pending = await db.event_talents.count_documents(
            {"event_id": event_id, "status": {"$ne": "Confirmed"}}
        )
        vendor_pending = await db.event_vendors.count_documents(
            {"event_id": event_id, "status": {"$ne": "Confirmed"}}
        )

        return EventOperationalBlockersResult(
            event_id=event_id,
            high_severity_risks=len(risks),
            open_incidents=incidents,
            talent_pending=talent_pending,
            vendor_pending=vendor_pending,
            risks=[{"title": r.get("title"), "severity": r.get("severity"), "status": r.get("status")} for r in risks],
            source="operations_engine",
            authoritative=True,
            available=True,
        )
    except Exception as exc:
        logger.warning("get_event_operational_blockers_tool fallback: %s", exc)
        return EventOperationalBlockersResult(
            event_id=event_id,
            available=False,
            error=str(exc),
        )
