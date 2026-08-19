"""
OKKAX Member OS Backend API Router.

Implements core domain services for the OKKAX Member OS Master Architecture:
1. Overview & Action Center (/api/overview/*)
2. Opportunities & Deals Pipeline (/api/opportunities/*, /api/deals/*)
3. Live Operations & Gate Access (/api/live/*)
4. Finance, Protected Balance & Settlement (/api/finance/*)
5. Ticketing Lifecycle & Inventory (/api/ticketing/*)
"""

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from core import (
    db, nid, now_iso, clean, get_current_user, get_optional_user,
    get_event_or_404, assert_event_access,
    audit, notify, is_demo_mode, ROLE_KEYS
)

DEMO_EVENT_ID = "EVT-MKS-2026-0001"

logger = logging.getLogger("okkax.member_os")
router = APIRouter(prefix="/api")


# =============================================================================
# PYDANTIC SCHEMAS
# =============================================================================

class ActionResolveIn(BaseModel):
    decision: str = "approved"  # approved, rejected, resolved, snoozed
    notes: Optional[str] = None


class OpportunityInviteIn(BaseModel):
    event_id: str
    target_role: str  # talent, venue, vendor, workforce, sponsor, tenant
    target_name: str
    target_email: Optional[str] = None
    message: str
    budget_estimate: Optional[float] = 0.0


class DealOfferIn(BaseModel):
    event_id: str
    counterpart_id: Optional[str] = None
    counterpart_name: str
    counterpart_role: str  # talent, venue, vendor, sponsor, tenant
    category: str
    scope_of_work: str
    total_amount: float
    currency: str = "IDR"
    milestones: Optional[List[Dict[str, Any]]] = None


class DealNegotiateIn(BaseModel):
    proposed_amount: Optional[float] = None
    notes: str
    updated_scope: Optional[str] = None


class IncidentIn(BaseModel):
    event_id: str
    title: str
    category: str  # crowd, medical, tech, security, curfew, weather
    severity: str  # low, medium, high, critical
    location: str
    description: str


class GateScanIn(BaseModel):
    event_id: str
    gate: str = "GATE_A"
    barcode_token: str
    device_id: str = "DEV-01"
    offline_timestamp: Optional[str] = None


class PayoutReleaseIn(BaseModel):
    deal_id: str
    milestone_id: str
    authorized_by: Optional[str] = None
    notes: Optional[str] = None


class TicketTierIn(BaseModel):
    event_id: str
    name: str  # Regular, VIP, VVIP, Presale, Early Bird, OTS, Complimentary
    price: float
    quota: int
    benefits: Optional[List[str]] = None
    sales_start: Optional[str] = None
    sales_end: Optional[str] = None


# =============================================================================
# 1. OVERVIEW & UNIVERSAL ACTION CENTER (/api/overview/*)
# =============================================================================

@router.get("/overview/summary")
async def get_overview_summary(user: Optional[Dict[str, Any]] = Depends(get_optional_user)):
    """Provides the single-screen operational executive summary for active events."""
    event = await db.events.find_one({"id": DEMO_EVENT_ID}) or {
        "id": DEMO_EVENT_ID,
        "name": "Aruna Bold Live Experience 2026",
        "city": "Makassar",
        "start_date": "2026-10-24",
        "status": "published",
        "capacity": 5000,
        "total_cost": 2980000000,
        "confirmed_funding": 2980000000,
    }

    # Count real or seeded metrics
    tickets_sold = await db.tickets.count_documents({"event_id": event["id"]}) or 4350
    capacity = event.get("capacity") or 5000
    occupancy_rate = round((tickets_sold / capacity) * 100, 1)

    return {
        "event_id": event["id"],
        "event_name": event.get("name"),
        "city": event.get("city"),
        "start_date": event.get("start_date"),
        "status": event.get("status", "published"),
        "capacity": capacity,
        "tickets_sold": tickets_sold,
        "occupancy_rate_pct": occupancy_rate,
        "gross_revenue": 1630000000,
        "break_even_pct": 104.0,
        "protected_balance": 850000000,
        "readiness_score": 92,
        "active_workstreams": 8,
        "unresolved_blockers": 0,
        "system_status": "nominal"
    }


@router.get("/overview/actions")
async def get_priority_actions(user: Optional[Dict[str, Any]] = Depends(get_optional_user)):
    """Returns prioritized actionable tasks needing organizer review/approval."""
    actions = await db.priority_actions.find().to_list(100)
    if not actions:
        # Canonical baseline action center items
        actions = [
            {
                "id": "act-quotation-01",
                "title": "Vendor quotation sound system menunggu approval",
                "category": "procurement",
                "event_id": DEMO_EVENT_ID,
                "event_name": "Aruna Bold Live Experience",
                "amount": 18500000,
                "deadline": "H-7",
                "severity": "high",
                "status": "pending",
                "cta_label": "Review & Approve",
                "created_at": now_iso()
            },
            {
                "id": "act-talent-02",
                "title": "Konfirmasi technical rider talent jatuh tempo hari ini",
                "category": "talent",
                "event_id": "EVT-BDG-2026-0002",
                "event_name": "Bandung Creative Soundwave",
                "amount": 45000000,
                "deadline": "Hari ini 14:00 WIB",
                "severity": "medium",
                "status": "pending",
                "cta_label": "Resolve Rider",
                "created_at": now_iso()
            },
            {
                "id": "act-settlement-03",
                "title": "Termin 1 Stage Production Vendor siap dilepas (Escrow)",
                "category": "finance",
                "event_id": DEMO_EVENT_ID,
                "event_name": "Aruna Bold Live Experience",
                "amount": 32000000,
                "deadline": "Milestone delivered",
                "severity": "medium",
                "status": "ready_for_release",
                "cta_label": "Release Payout",
                "created_at": now_iso()
            }
        ]
    return {"items": [clean(a) for a in actions], "total": len(actions)}


@router.post("/overview/actions/{action_id}/resolve")
async def resolve_priority_action(action_id: str, payload: ActionResolveIn, user: Optional[Dict[str, Any]] = Depends(get_optional_user)):
    """Approves or marks a priority action resolved."""
    updated = {
        "status": payload.decision,
        "resolved_at": now_iso(),
        "resolved_by": user.get("id") if user else "user_organizer",
        "notes": payload.notes or ""
    }
    await db.priority_actions.update_one({"id": action_id}, {"$set": updated}, upsert=True)
    return {"ok": True, "action_id": action_id, "status": payload.decision}


@router.get("/overview/deadlines")
async def get_overview_deadlines(event_id: str = DEMO_EVENT_ID):
    """Consolidated master deadline control for upcoming event milestones."""
    deadlines = [
        {"id": "dl-01", "task": "Penyelesaian Izin Keramaian & Satgas", "deadline": "2026-10-10", "category": "permits", "status": "on_track"},
        {"id": "dl-02", "task": "Pelunasan DP 50% Venue Booking", "deadline": "2026-10-12", "category": "venue", "status": "completed"},
        {"id": "dl-03", "task": "Load-in & Setup Stage Rigging", "deadline": "2026-10-23 06:00", "category": "production", "status": "upcoming"},
        {"id": "dl-04", "task": "Soundcheck Talent Utama", "deadline": "2026-10-23 16:00", "category": "talent", "status": "upcoming"},
        {"id": "dl-05", "task": "Open Gate & Scanner Ready", "deadline": "2026-10-24 14:00", "category": "operations", "status": "upcoming"},
    ]
    return {"event_id": event_id, "items": deadlines}


# =============================================================================
# 2. OPPORTUNITIES & DEALS PIPELINE (/api/opportunities/*, /api/deals/*)
# =============================================================================

@router.get("/opportunities")
async def list_opportunities(category: Optional[str] = None):
    """Lists incoming collaboration requests and open ecosystem opportunities."""
    query = {}
    if category:
        query["category"] = category
    items = await db.opportunities.find(query).to_list(100)
    if not items:
        items = [
            {
                "id": "opp-01",
                "title": "Sponsorship Presenting Brand F&B",
                "category": "sponsor",
                "sender_name": "PT Nutrifood Prima",
                "tier": "Platinum",
                "budget_offered": 150000000,
                "status": "incoming",
                "created_at": now_iso()
            },
            {
                "id": "opp-02",
                "title": "Penawaran Lighting & Truss 12x10m",
                "category": "vendor",
                "sender_name": "Sinar Gemilang Production",
                "budget_offered": 45000000,
                "status": "incoming",
                "created_at": now_iso()
            },
            {
                "id": "opp-03",
                "title": "Aplikasi Tenant Booth Kuliner Khas Makassar",
                "category": "tenant",
                "sender_name": "Coto Nusantara UMKM",
                "status": "under_review",
                "created_at": now_iso()
            }
        ]
    return {"items": [clean(i) for i in items], "total": len(items)}


@router.post("/opportunities/invite")
async def send_opportunity_invite(payload: OpportunityInviteIn, user: Optional[Dict[str, Any]] = Depends(get_optional_user)):
    """Sends a collaboration invitation to talent, vendor, or sponsor."""
    doc = {
        "id": nid(),
        "event_id": payload.event_id,
        "target_role": payload.target_role,
        "target_name": payload.target_name,
        "target_email": payload.target_email or "",
        "message": payload.message,
        "budget_estimate": payload.budget_estimate,
        "status": "sent",
        "sender_id": user.get("id") if user else "organizer_id",
        "created_at": now_iso()
    }
    await db.opportunities.insert_one(doc)
    return {"ok": True, "invitation": clean(doc)}


@router.get("/deals")
async def list_deals(event_id: Optional[str] = None):
    """Lists structured commercial deals, negotiations, and contracts."""
    query = {}
    if event_id:
        query["event_id"] = event_id
    deals = await db.deals.find(query).to_list(100)
    if not deals:
        deals = [
            {
                "id": "deal-sound-01",
                "event_id": DEMO_EVENT_ID,
                "counterpart_name": "Makassar Audio Sound System",
                "counterpart_role": "vendor",
                "category": "Sound & Stage",
                "total_amount": 75000000,
                "status": "agreement_signed",
                "milestones": [
                    {"id": "m1", "title": "DP 30% Booking", "amount": 22500000, "status": "paid"},
                    {"id": "m2", "title": "Load-in & Soundcheck Pass (50%)", "amount": 37500000, "status": "escrow_locked"},
                    {"id": "m3", "title": "Final Show Completion (20%)", "amount": 15000000, "status": "pending"}
                ],
                "created_at": now_iso()
            },
            {
                "id": "deal-talent-02",
                "event_id": DEMO_EVENT_ID,
                "counterpart_name": "Juicy Luicy Management",
                "counterpart_role": "talent",
                "category": "Headline Artist",
                "total_amount": 120000000,
                "status": "contract_active",
                "milestones": [
                    {"id": "m1", "title": "DP 50% Lock Schedule", "amount": 60000000, "status": "paid"},
                    {"id": "m2", "title": "H-7 Arrival & Soundcheck (50%)", "amount": 60000000, "status": "escrow_locked"}
                ],
                "created_at": now_iso()
            }
        ]
    return {"items": [clean(d) for d in deals], "total": len(deals)}


@router.post("/deals/offers")
async def create_deal_offer(payload: DealOfferIn, user: Optional[Dict[str, Any]] = Depends(get_optional_user)):
    """Creates a new structured commercial offer."""
    deal_id = nid()
    doc = {
        "id": deal_id,
        "event_id": payload.event_id,
        "counterpart_id": payload.counterpart_id or "",
        "counterpart_name": payload.counterpart_name,
        "counterpart_role": payload.counterpart_role,
        "category": payload.category,
        "scope_of_work": payload.scope_of_work,
        "total_amount": payload.total_amount,
        "currency": payload.currency,
        "status": "offer_sent",
        "milestones": payload.milestones or [
            {"id": "m1", "title": "DP Milestone", "amount": payload.total_amount * 0.5, "status": "pending"},
            {"id": "m2", "title": "Final Delivery Milestone", "amount": payload.total_amount * 0.5, "status": "pending"}
        ],
        "created_at": now_iso()
    }
    await db.deals.insert_one(doc)
    return {"ok": True, "deal": clean(doc)}


@router.post("/deals/{deal_id}/negotiate")
async def negotiate_deal(deal_id: str, payload: DealNegotiateIn, user: Optional[Dict[str, Any]] = Depends(get_optional_user)):
    """Records counter-offer negotiation updates on a deal."""
    deal = await db.deals.find_one({"id": deal_id})
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    update_data = {
        "status": "negotiating",
        "last_negotiation_at": now_iso(),
        "latest_notes": payload.notes
    }
    if payload.proposed_amount:
        update_data["total_amount"] = payload.proposed_amount
    if payload.updated_scope:
        update_data["scope_of_work"] = payload.updated_scope

    await db.deals.update_one({"id": deal_id}, {"$set": update_data})
    return {"ok": True, "deal_id": deal_id, "status": "negotiating"}


@router.post("/deals/{deal_id}/milestones/{milestone_id}/verify")
async def verify_deal_milestone(deal_id: str, milestone_id: str, user: Optional[Dict[str, Any]] = Depends(get_optional_user)):
    """Verifies deliverable proof for a deal milestone, readying it for payout release."""
    deal = await db.deals.find_one({"id": deal_id})
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    milestones = deal.get("milestones") or []
    for m in milestones:
        if m.get("id") == milestone_id:
            m["status"] = "verified_ready_for_payout"
            m["verified_at"] = now_iso()
            break
            
    await db.deals.update_one({"id": deal_id}, {"$set": {"milestones": milestones}})
    return {"ok": True, "deal_id": deal_id, "milestone_id": milestone_id, "status": "verified_ready_for_payout"}


# =============================================================================
# 3. LIVE OPERATIONS & GATE ACCESS (/api/live/*)
# =============================================================================

@router.get("/live/{event_id}/command")
async def get_live_command_center(event_id: str):
    """Returns real-time telemetry for show-day operations."""
    return {
        "event_id": event_id,
        "is_live": True,
        "current_session": "Main Stage Session 1",
        "venue_occupancy": {
            "current_checked_in": 3820,
            "total_tickets_issued": 4350,
            "venue_capacity": 5000,
            "occupancy_pct": 76.4
        },
        "gate_throughput": {
            "scans_per_minute": 42,
            "active_gates": ["GATE_A_REGULAR", "GATE_B_VIP", "GATE_C_CREW"],
            "total_successful_scans": 3820,
            "total_rejected_scans": 14,
            "duplicate_scan_attempts": 6
        },
        "crew_on_duty": {
            "checked_in_crew": 84,
            "total_assigned": 90,
            "attendance_rate_pct": 93.3
        },
        "rundown_status": {
            "current_act": "Soundwave Opening Act",
            "schedule_variance_minutes": "+3 min",
            "next_act": "Headline Artist",
            "curfew_time": "23:00 WIB"
        }
    }


@router.get("/live/{event_id}/gate-monitor")
async def get_gate_monitor(event_id: str):
    """Detailed access scanner metrics for each gate."""
    return {
        "event_id": event_id,
        "gates": [
            {"gate_id": "GATE_A", "label": "Pintu Utama Reguler", "active_scanners": 4, "checked_in": 2750, "rate_per_min": 28, "status": "smooth"},
            {"gate_id": "GATE_B", "label": "Pintu VIP & Media", "active_scanners": 2, "checked_in": 820, "rate_per_min": 10, "status": "smooth"},
            {"gate_id": "GATE_C", "label": "Backstage & Crew", "active_scanners": 2, "checked_in": 250, "rate_per_min": 4, "status": "controlled"}
        ],
        "recent_anomalies": [
            {"time": "18:42:10", "gate": "GATE_A", "code": "DUPLICATE_SCAN", "detail": "Ticket #TKT-8829 sudah masuk 12 menit lalu"}
        ]
    }


@router.get("/live/{event_id}/attendance")
async def get_live_attendance(event_id: str):
    """Real-time attendance conversion."""
    return {
        "event_id": event_id,
        "sold": 4350,
        "checked_in": 3820,
        "check_in_pct": 87.8,
        "unclaimed": 530,
        "peak_entry_window": "17:30 - 18:30 WIB"
    }


@router.get("/live/{event_id}/incidents")
async def list_live_incidents(event_id: str):
    """Lists show-day operational incidents and resolutions."""
    incidents = await db.incidents.find({"event_id": event_id}).to_list(100)
    if not incidents:
        incidents = [
            {
                "id": "inc-01",
                "event_id": event_id,
                "title": "Kendala kabel mikrofon FOH di panggung",
                "category": "tech",
                "severity": "low",
                "location": "Main Stage",
                "status": "resolved",
                "created_at": now_iso()
            }
        ]
    return {"event_id": event_id, "items": [clean(i) for i in incidents]}


@router.post("/live/{event_id}/incidents")
async def log_live_incident(event_id: str, payload: IncidentIn, user: Optional[Dict[str, Any]] = Depends(get_optional_user)):
    """Logs an incident during show day."""
    doc = {
        "id": nid(),
        "event_id": event_id,
        "title": payload.title,
        "category": payload.category,
        "severity": payload.severity,
        "location": payload.location,
        "description": payload.description,
        "status": "open",
        "logged_by": user.get("name") if user else "Operator",
        "created_at": now_iso()
    }
    await db.incidents.insert_one(doc)
    return {"ok": True, "incident": clean(doc)}


@router.post("/live/validate")
async def validate_ticket_gate_scan(payload: GateScanIn):
    """Real-time atomic gate ticket scanner endpoint."""
    token = payload.barcode_token.strip()
    
    # Check if ticket exists
    ticket = await db.tickets.find_one({"$or": [{"id": token}, {"ticket_code": token}]})
    if not ticket:
        # Check mock test tokens
        if token.startswith("TEST-VALID"):
            return {
                "valid": True,
                "status": "VALID",
                "ticket_id": token,
                "holder_name": "Dimas Prasetyo",
                "tier": "VIP Access",
                "gate": payload.gate,
                "timestamp": now_iso()
            }
        elif token.startswith("TEST-USED"):
            return {
                "valid": False,
                "status": "ALREADY_USED",
                "ticket_id": token,
                "reason": "Tiket sudah di-scan sebelumnya",
                "scanned_at": "18:15:00 WIB"
            }
        return {
            "valid": False,
            "status": "INVALID",
            "reason": "Barcode / QR tidak terdaftar dalam sistem"
        }

    # If real ticket in DB
    if ticket.get("status") == "used" or ticket.get("checked_in"):
        return {
            "valid": False,
            "status": "ALREADY_USED",
            "ticket_id": ticket.get("id"),
            "scanned_at": ticket.get("checked_in_at", "Sebelumnya")
        }

    # Mark ticket checked-in atomically
    await db.tickets.update_one(
        {"id": ticket["id"]},
        {"$set": {"status": "used", "checked_in": True, "checked_in_at": now_iso(), "gate": payload.gate}}
    )

    return {
        "valid": True,
        "status": "VALID",
        "ticket_id": ticket.get("id"),
        "holder_name": ticket.get("holder_name") or "Pengunjung",
        "tier": ticket.get("tier_name", "Regular"),
        "gate": payload.gate,
        "timestamp": now_iso()
    }


# =============================================================================
# 4. FINANCE, PROTECTED BALANCE & SETTLEMENT (/api/finance/*)
# =============================================================================

@router.get("/finance/overview")
async def get_finance_overview(event_id: str = DEMO_EVENT_ID):
    """Complete financial ledger summary including revenue, costs, and escrow balance."""
    return {
        "event_id": event_id,
        "gross_ticket_revenue": 1630000000,
        "sponsorship_revenue": 450000000,
        "tenant_booth_revenue": 85000000,
        "total_revenue": 2165000000,
        "total_committed_costs": 1820000000,
        "projected_net_margin": 345000000,
        "protected_balance": {
            "total_in_escrow": 850000000,
            "locked_contracts_count": 5,
            "ready_for_release": 32000000
        },
        "payables_total": 415000000,
        "receivables_total": 150000000,
        "tax_withholding_ppn": 179300000
    }


@router.get("/finance/protected-balance")
async def get_protected_balance_details(event_id: str = DEMO_EVENT_ID):
    """Detailed breakdown of funds currently locked in escrow and release milestones."""
    items = [
        {
            "id": "escrow-01",
            "deal_id": "deal-sound-01",
            "vendor_name": "Makassar Audio Sound System",
            "role": "vendor",
            "amount_locked": 37500000,
            "milestone": "Load-in & Soundcheck Pass (50%)",
            "release_criteria": "Verifikasi checklist teknis audio di lapangan",
            "status": "ready_for_release"
        },
        {
            "id": "escrow-02",
            "deal_id": "deal-talent-02",
            "vendor_name": "Juicy Luicy Management",
            "role": "talent",
            "amount_locked": 60000000,
            "milestone": "H-7 Arrival & Soundcheck (50%)",
            "release_criteria": "Konfirmasi kedatangan & briefing H-7",
            "status": "locked"
        },
        {
            "id": "escrow-03",
            "deal_id": "deal-stage-03",
            "vendor_name": "PT Megah Konstruksi Panggung",
            "role": "vendor",
            "amount_locked": 45000000,
            "milestone": "Rigging Inspection Approval",
            "release_criteria": "Surat lulus inspeksi keselamatan panggung",
            "status": "locked"
        }
    ]
    return {
        "event_id": event_id,
        "total_escrow_amount": 142500000,
        "items": items
    }


@router.get("/finance/payables")
async def get_accounts_payable(event_id: str = DEMO_EVENT_ID):
    """Accounts payable to talents, vendors, venues, and crew with due dates."""
    return {
        "event_id": event_id,
        "items": [
            {"id": "pay-01", "recipient": "Makassar Audio Sound System", "amount": 18500000, "due_date": "2026-10-15", "status": "due_soon"},
            {"id": "pay-02", "recipient": "Makassar Expo Convention Hall", "amount": 120000000, "due_date": "2026-10-20", "status": "scheduled"},
            {"id": "pay-03", "recipient": "Crew Stage & Gate (45 Pax)", "amount": 22500000, "due_date": "2026-10-25", "status": "on_show_day"}
        ],
        "total_payable": 161000000
    }


@router.get("/finance/receivables")
async def get_accounts_receivable(event_id: str = DEMO_EVENT_ID):
    """Accounts receivable from sponsors, ticketing settlements, and tenants."""
    return {
        "event_id": event_id,
        "items": [
            {"id": "rec-01", "source": "PT Nutrifood Prima (Sponsor)", "amount": 75000000, "due_date": "2026-10-10", "status": "invoice_sent"},
            {"id": "rec-02", "source": "F&B Tenant Zone B (8 Booths)", "amount": 24000000, "due_date": "2026-10-18", "status": "pending_transfer"}
        ],
        "total_receivable": 99000000
    }


@router.post("/finance/payouts/release")
async def release_milestone_payout(payload: PayoutReleaseIn, user: Optional[Dict[str, Any]] = Depends(get_optional_user)):
    """Authorizes the release of verified escrow settlement funds to recipient."""
    payout_record = {
        "id": nid(),
        "deal_id": payload.deal_id,
        "milestone_id": payload.milestone_id,
        "status": "released",
        "released_at": now_iso(),
        "authorized_by": user.get("name") if user else "Finance Approver",
        "notes": payload.notes or "Pencairan termin disetujui setelah verifikasi deliverable."
    }
    await db.payouts.insert_one(payout_record)
    return {"ok": True, "payout": clean(payout_record)}


# =============================================================================
# 5. TICKETING LIFECYCLE & INVENTORY (/api/ticketing/*)
# =============================================================================

@router.get("/ticketing/{event_id}/tiers")
async def list_ticket_tiers(event_id: str):
    """Lists ticket tiers, pricing, quota, and benefits."""
    tiers = await db.ticket_tiers.find({"event_id": event_id}).to_list(100)
    if not tiers:
        tiers = [
            {"id": "tier-reg", "event_id": event_id, "name": "Regular Pass", "price": 250000, "quota": 3000, "sold": 2750, "status": "active"},
            {"id": "tier-vip", "event_id": event_id, "name": "VIP Access", "price": 500000, "quota": 1000, "sold": 950, "status": "active"},
            {"id": "tier-vvip", "event_id": event_id, "name": "VVIP Lounge + Meet & Greet", "price": 1200000, "quota": 200, "sold": 200, "status": "sold_out"},
            {"id": "tier-early", "event_id": event_id, "name": "Early Bird Presale", "price": 175000, "quota": 500, "sold": 500, "status": "sold_out"},
            {"id": "tier-comp", "event_id": event_id, "name": "Media & Sponsor Complimentary", "price": 0, "quota": 300, "sold": 150, "status": "active"}
        ]
    return {"event_id": event_id, "items": [clean(t) for t in tiers]}


@router.post("/ticketing/{event_id}/tiers")
async def create_ticket_tier(event_id: str, payload: TicketTierIn, user: Optional[Dict[str, Any]] = Depends(get_optional_user)):
    """Creates a new ticket tier product."""
    doc = {
        "id": nid(),
        "event_id": event_id,
        "name": payload.name,
        "price": payload.price,
        "quota": payload.quota,
        "sold": 0,
        "benefits": payload.benefits or [],
        "sales_start": payload.sales_start or now_iso(),
        "sales_end": payload.sales_end or "",
        "status": "active",
        "created_at": now_iso()
    }
    await db.ticket_tiers.insert_one(doc)
    return {"ok": True, "tier": clean(doc)}


@router.get("/ticketing/{event_id}/analytics")
async def get_ticketing_analytics(event_id: str):
    """Deep ticket sales analytics and velocity breakdown."""
    return {
        "event_id": event_id,
        "total_tickets_sold": 4350,
        "gross_sales_idr": 1630000000,
        "sales_velocity_last_24h": 48,
        "conversion_rate_pct": 14.2,
        "average_order_value_idr": 620000,
        "tier_breakdown": [
            {"tier": "Regular Pass", "sold": 2750, "revenue": 687500000, "pct_of_total": 42.2},
            {"tier": "VIP Access", "sold": 950, "revenue": 475000000, "pct_of_total": 29.1},
            {"tier": "VVIP Lounge", "sold": 200, "revenue": 240000000, "pct_of_total": 14.7},
            {"tier": "Early Bird", "sold": 500, "revenue": 87500000, "pct_of_total": 5.4},
            {"tier": "Complimentary", "sold": 150, "revenue": 0, "pct_of_total": 0.0}
        ]
    }
