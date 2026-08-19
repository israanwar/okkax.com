"""
Test suite for OKKAX Member OS Backend API endpoints:
- Overview & Priority Action Center
- Deals & Opportunities Pipeline
- Live Operations & Gate Validation
- Finance & Protected Balance Escrow
- Ticketing Lifecycle & Analytics
"""

import os
import httpx
import pytest

BASE = os.environ.get("TEST_BASE_URL", "http://127.0.0.1:8000")
API = f"{BASE}/api"


def test_overview_summary_api():
    """Tests /api/overview/summary operational executive metrics."""
    r = httpx.get(f"{API}/overview/summary", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "event_id" in data
    assert "tickets_sold" in data
    assert "readiness_score" in data
    assert "gross_revenue" in data
    assert data["system_status"] == "nominal"


def test_overview_priority_actions_api():
    """Tests /api/overview/actions and resolution flow."""
    r = httpx.get(f"{API}/overview/actions", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert len(data["items"]) >= 1

    action_id = data["items"][0]["id"]
    # Resolve action
    resolve_r = httpx.post(
        f"{API}/overview/actions/{action_id}/resolve",
        json={"decision": "approved", "notes": "Approved via automated QA test"},
        timeout=15
    )
    assert resolve_r.status_code == 200
    assert resolve_r.json()["ok"] is True


def test_overview_deadlines_api():
    """Tests /api/overview/deadlines master timeline control."""
    r = httpx.get(f"{API}/overview/deadlines", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert len(data["items"]) >= 3


def test_opportunities_and_deals_api():
    """Tests /api/opportunities and /api/deals lifecycle."""
    # List opportunities
    opp_r = httpx.get(f"{API}/opportunities", timeout=15)
    assert opp_r.status_code == 200
    assert "items" in opp_r.json()

    # Create invitation
    invite_payload = {
        "event_id": "EVT-MKS-2026-0001",
        "target_role": "talent",
        "target_name": "Test Artist Management",
        "target_email": "artist@example.com",
        "message": "Undangan tampil di Aruna Bold Live Experience",
        "budget_estimate": 75000000
    }
    inv_r = httpx.post(f"{API}/opportunities/invite", json=invite_payload, timeout=15)
    assert inv_r.status_code == 200
    assert inv_r.json()["ok"] is True

    # List deals
    deals_r = httpx.get(f"{API}/deals", timeout=15)
    assert deals_r.status_code == 200
    deals = deals_r.json()["items"]
    assert len(deals) >= 1

    # Create new deal offer
    deal_payload = {
        "event_id": "EVT-MKS-2026-0001",
        "counterpart_name": "Surabaya LED Screen Vendor",
        "counterpart_role": "vendor",
        "category": "Visual & LED",
        "scope_of_work": "P3.91 LED Wall 10x6m Main Stage",
        "total_amount": 55000000,
        "currency": "IDR"
    }
    create_deal_r = httpx.post(f"{API}/deals/offers", json=deal_payload, timeout=15)
    assert create_deal_r.status_code == 200
    new_deal_id = create_deal_r.json()["deal"]["id"]

    # Negotiate deal
    neg_r = httpx.post(
        f"{API}/deals/{new_deal_id}/negotiate",
        json={"proposed_amount": 52000000, "notes": "Penyesuaian diskon volume paket"},
        timeout=15
    )
    assert neg_r.status_code == 200
    assert neg_r.json()["status"] == "negotiating"


def test_live_operations_and_gate_scan_api():
    """Tests /api/live/* command center, attendance, and gate validator scan."""
    event_id = "EVT-MKS-2026-0001"

    # Command center
    cmd_r = httpx.get(f"{API}/live/{event_id}/command", timeout=15)
    assert cmd_r.status_code == 200
    cmd_data = cmd_r.json()
    assert "venue_occupancy" in cmd_data
    assert "gate_throughput" in cmd_data

    # Gate monitor
    gate_r = httpx.get(f"{API}/live/{event_id}/gate-monitor", timeout=15)
    assert gate_r.status_code == 200
    assert "gates" in gate_r.json()

    # Attendance
    att_r = httpx.get(f"{API}/live/{event_id}/attendance", timeout=15)
    assert att_r.status_code == 200
    assert att_r.json()["check_in_pct"] > 0

    # Gate scan valid test
    scan_valid = httpx.post(
        f"{API}/live/validate",
        json={"event_id": event_id, "gate": "GATE_A", "barcode_token": "TEST-VALID-001", "device_id": "TEST-DEV"},
        timeout=15
    )
    assert scan_valid.status_code == 200
    assert scan_valid.json()["valid"] is True
    assert scan_valid.json()["status"] == "VALID"

    # Gate scan already used test
    scan_used = httpx.post(
        f"{API}/live/validate",
        json={"event_id": event_id, "gate": "GATE_A", "barcode_token": "TEST-USED-001", "device_id": "TEST-DEV"},
        timeout=15
    )
    assert scan_used.status_code == 200
    assert scan_used.json()["valid"] is False
    assert scan_used.json()["status"] == "ALREADY_USED"


def test_finance_overview_and_protected_balance_api():
    """Tests /api/finance/* ledger, escrow details, payables, receivables, and payout release."""
    event_id = "EVT-MKS-2026-0001"

    # Finance overview
    fin_r = httpx.get(f"{API}/finance/overview?event_id={event_id}", timeout=15)
    assert fin_r.status_code == 200
    fin_data = fin_r.json()
    assert "gross_ticket_revenue" in fin_data
    assert "protected_balance" in fin_data
    assert fin_data["protected_balance"]["total_in_escrow"] > 0

    # Protected balance escrow breakdown
    esc_r = httpx.get(f"{API}/finance/protected-balance?event_id={event_id}", timeout=15)
    assert esc_r.status_code == 200
    assert "items" in esc_r.json()

    # Payables & Receivables
    pay_r = httpx.get(f"{API}/finance/payables?event_id={event_id}", timeout=15)
    assert pay_r.status_code == 200
    assert len(pay_r.json()["items"]) >= 1

    rec_r = httpx.get(f"{API}/finance/receivables?event_id={event_id}", timeout=15)
    assert rec_r.status_code == 200
    assert len(rec_r.json()["items"]) >= 1

    # Payout release authorization
    payout_r = httpx.post(
        f"{API}/finance/payouts/release",
        json={
            "deal_id": "deal-sound-01",
            "milestone_id": "m1",
            "authorized_by": "Okka Anwar",
            "notes": "Pencairan termin 1 disetujui untuk vendor sound system"
        },
        timeout=15
    )
    assert payout_r.status_code == 200
    assert payout_r.json()["ok"] is True
    assert payout_r.json()["payout"]["status"] == "released"


def test_ticketing_tiers_and_analytics_api():
    """Tests /api/ticketing/* tier management and sales analytics."""
    event_id = "EVT-MKS-2026-0001"

    # List tiers
    tiers_r = httpx.get(f"{API}/ticketing/{event_id}/tiers", timeout=15)
    assert tiers_r.status_code == 200
    tiers = tiers_r.json()["items"]
    assert len(tiers) >= 3

    # Analytics
    analytics_r = httpx.get(f"{API}/ticketing/{event_id}/analytics", timeout=15)
    assert analytics_r.status_code == 200
    data = analytics_r.json()
    assert "total_tickets_sold" in data
    assert "tier_breakdown" in data
    assert len(data["tier_breakdown"]) >= 3
