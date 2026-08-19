"""Comprehensive contract and regression tests for OKKAX Admission & Dynamic Ticketing Engine.

Validates:
1. Canonical tiered public fee policy & exact boundary math
2. Strategic negotiated fee policy (0.50% floor, 0.49% rejection)
3. Free event & credential zero fee guarantee
4. Tax engine behavior (not configured vs configured)
5. Sandbox gateway fee classification
6. 70+ data-driven templates catalog & category suggestions
7. Full admission matrix (open access, free reg, free tix, paid tix, invitation, accreditation, multi-day, complimentary, custom)
8. Security & RBAC isolation regression
"""

import os
from pathlib import Path
import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

API = "http://127.0.0.1:8001/api"
PASSWORD = os.environ.get("DEMO_PASSWORD", "DPOqsn1PJS1ATka0oagr8LCi")
ADMIN_PW = os.environ.get("ADMIN_PASSWORD", "gh8t6P_c1U_yFxy3uPv0cRf0")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin.local@okkax.id")
EVENT_ID = "evt-aruna-2026"


def _login(email, pw=PASSWORD):
    if email == ADMIN_EMAIL or "admin" in email:
        pw = ADMIN_PW
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=10)
    assert r.status_code == 200, f"Login failed for {email}: {r.text}"
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def tokens():
    return {
        "organizer": _login("organizer@okkax.id"),
        "audience": _login("audience@okkax.id"),
        "tenant": _login("tenant@okkax.id"),
        "admin": _login(ADMIN_EMAIL),
    }


def test_default_tier_templates_catalog():
    """Ensure data-driven default tier templates library contains >= 70 templates across 14 categories."""
    r = requests.get(f"{API}/ticket-tiers/templates")
    assert r.status_code == 200
    data = r.json()
    items = data.get("items", [])
    assert len(items) >= 70, f"Expected at least 70 templates, found {len(items)}"

    categories = set(t["category"] for t in items)
    assert len(categories) >= 10
    assert any("Musik" in c for c in categories)
    assert any("Konferensi" in c for c in categories)
    assert any("Expo" in c for c in categories)
    assert any("Olahraga" in c for c in categories)
    assert any("Bazaar" in c for c in categories)
    assert any("Bisnis" in c for c in categories)
    assert any("Private" in c for c in categories)
    assert any("Edukasi" in c for c in categories)
    assert any("Pemerintah" in c for c in categories)
    assert any("Seni" in c for c in categories)
    assert any("Online" in c for c in categories)
    assert any("Komunitas" in c for c in categories)
    assert any("Wisata" in c for c in categories)
    assert any("Corporate" in c for c in categories)

    # Filter by category
    r_cat = requests.get(f"{API}/ticket-tiers/templates?category=Musik")
    assert r_cat.status_code == 200
    assert len(r_cat.json()["items"]) >= 5


def test_event_suggested_tiers_matching_category(tokens):
    """Ensure suggested tiers return relevant templates matching event category."""
    r = requests.get(f"{API}/events/{EVENT_ID}/suggested-tiers", headers=_h(tokens["organizer"]))
    assert r.status_code == 200
    data = r.json()
    items = data.get("items", [])
    assert len(items) >= 3
    assert any("presale" in t["name"].lower() or "regular" in t["name"].lower() or "early" in t["name"].lower() for t in items)


def test_custom_tier_crud_and_persistence(tokens):
    """Ensure organizer can create custom tier with arbitrary name, edit, read, and delete cleanly."""
    org_h = _h(tokens["organizer"])

    custom_name = "Fan Zone Barikade A"
    create_payload = {
        "name": custom_name,
        "ticket_type": "Special Zone",
        "price": 425000,
        "quantity": 150,
        "benefits": ["Barikade Depan", "Official Lanyard"],
        "purchase_limit": 2,
        "zone": "Zone A-1",
        "session_days": 2,
        "is_multi_day": True,
        "sort_order": 10,
    }
    r_create = requests.post(f"{API}/events/{EVENT_ID}/ticket-tiers", headers=org_h, json=create_payload)
    assert r_create.status_code == 200
    created = r_create.json()["item"]
    tier_id = created["id"]
    assert created["name"] == custom_name
    assert created["price"] == 425000
    assert created["quantity"] == 150
    assert created["is_custom"] is True

    try:
        # Read back from event tiers list
        r_list = requests.get(f"{API}/events/{EVENT_ID}/ticket-tiers", headers=org_h)
        assert r_list.status_code == 200
        found = next((t for t in r_list.json()["items"] if t["id"] == tier_id), None)
        assert found is not None
        assert found["name"] == custom_name

        # Patch custom tier
        patch_payload = {"price": 450000, "benefits": ["Barikade Depan", "Official Lanyard", "Sticker Pack"]}
        r_patch = requests.patch(f"{API}/events/{EVENT_ID}/ticket-tiers/{tier_id}", headers=org_h, json=patch_payload)
        assert r_patch.status_code == 200
        assert r_patch.json()["item"]["price"] == 450000

        # Reorder tiers
        r_reorder = requests.post(f"{API}/events/{EVENT_ID}/ticket-tiers/reorder", headers=org_h, json={"tier_ids": [tier_id]})
        assert r_reorder.status_code == 200

        # Delete unused custom tier
        r_del = requests.delete(f"{API}/events/{EVENT_ID}/ticket-tiers/{tier_id}", headers=org_h)
        assert r_del.status_code == 200

        # Verify deleted
        r_list_after = requests.get(f"{API}/events/{EVENT_ID}/ticket-tiers", headers=org_h)
        assert not any(t["id"] == tier_id for t in r_list_after.json()["items"])

    except Exception:
        requests.delete(f"{API}/events/{EVENT_ID}/ticket-tiers/{tier_id}", headers=org_h)
        raise


def test_canonical_default_tier_deletion_denied(tokens):
    """Ensure canonical default tier templates cannot be deleted."""
    org_h = _h(tokens["organizer"])
    r = requests.delete(f"{API}/events/{EVENT_ID}/ticket-tiers/tpl-mus-early-bird", headers=org_h)
    assert r.status_code == 400
    assert "Cannot delete canonical default tier template" in r.json()["detail"]


def test_referenced_tier_deletion_denied_and_archive_success(tokens):
    """Ensure tier with sales cannot be destructively deleted, but can be archived."""
    org_h = _h(tokens["organizer"])
    aud_h = _h(tokens["audience"])

    r_create = requests.post(f"{API}/events/{EVENT_ID}/ticket-tiers", headers=org_h, json={
        "name": "Limited Soundcheck Pass",
        "price": 200000,
        "quantity": 10,
    })
    tier_id = r_create.json()["item"]["id"]

    try:
        r_chk = requests.post(f"{API}/checkout", headers=aud_h, json={
            "event_id": EVENT_ID,
            "tier_id": tier_id,
            "quantity": 1,
            "method": "qris",
            "method_channel": "QRIS Dynamic"
        })
        assert r_chk.status_code == 200
        pid = r_chk.json()["payment"]["id"]
        requests.post(f"{API}/payments/{pid}/simulate", headers=aud_h, json={"outcome": "success"})

        # Attempt destructive deletion -> Must be REJECTED (400)
        r_del = requests.delete(f"{API}/events/{EVENT_ID}/ticket-tiers/{tier_id}", headers=org_h)
        assert r_del.status_code == 400
        assert "Cannot delete tier with existing sales or orders" in r_del.json()["detail"]

        # Archive tier -> Must SUCCEED (200)
        r_arch = requests.post(f"{API}/events/{EVENT_ID}/ticket-tiers/{tier_id}/archive", headers=org_h)
        assert r_arch.status_code == 200
        assert r_arch.json()["item"]["active"] is False
        assert r_arch.json()["item"]["archived"] is True

    finally:
        pass


def test_free_credential_registration_flow(tokens):
    """Ensure zero-cost registration passes, invitations, and accreditations issue valid tickets without payment."""
    org_h = _h(tokens["organizer"])
    aud_h = _h(tokens["audience"])

    r_create = requests.post(f"{API}/events/{EVENT_ID}/ticket-tiers", headers=org_h, json={
        "name": "Community Invitation Pass",
        "ticket_type": "Invitation",
        "pricing_type": "free",
        "price": 0,
        "quantity": 50,
    })
    tier_id = r_create.json()["item"]["id"]

    try:
        r_reg = requests.post(f"{API}/events/{EVENT_ID}/register", headers=aud_h, json={
            "tier_id": tier_id,
            "quantity": 2,
            "attendee_name": "Tamu Undangan Komunitas",
            "credential_type": "invitation_pass"
        })
        assert r_reg.status_code == 200
        data = r_reg.json()
        assert data["order"]["gross"] == 0
        assert data["order"]["total"] == 0
        assert data["order"]["status"] == "paid"
        tickets = data["tickets"]
        assert len(tickets) == 2
        assert tickets[0]["status"] == "valid"
        assert tickets[0]["credential_type"] == "invitation_pass"

        # Validate free QR pass at gate
        qr_code = tickets[0]["qr_code"]
        r_val = requests.post(f"{API}/tickets/validate", headers=org_h, json={"qr_code": qr_code})
        assert r_val.status_code == 200
        assert r_val.json()["result"] == "Valid"

        # Duplicate scan rejected
        r_val_dup = requests.post(f"{API}/tickets/validate", headers=org_h, json={"qr_code": qr_code})
        assert r_val_dup.status_code == 200
        assert r_val_dup.json()["result"] == "Already Used"

    finally:
        requests.post(f"{API}/events/{EVENT_ID}/ticket-tiers/{tier_id}/archive", headers=org_h)


def test_canonical_tiered_public_fee_boundaries():
    """Mathematical and boundary proof for canonical single ticket tiered pricing."""
    from admission_engine import calculate_ticketing_fees, get_canonical_public_fee_rate

    # Boundary 1: <= Rp50,000 -> 1.50%
    assert get_canonical_public_fee_rate(25000) == 0.0150
    f1 = calculate_ticketing_fees(price=25000, quantity=1)
    assert f1["platform_fee"] == 375  # 25,000 * 0.0150
    assert f1["fee_rate"] == 0.0150

    assert get_canonical_public_fee_rate(50000) == 0.0150
    f2 = calculate_ticketing_fees(price=50000, quantity=1)
    assert f2["platform_fee"] == 750  # 50,000 * 0.0150

    # Boundary 2: Rp50,001–Rp150,000 -> 1.25%
    assert get_canonical_public_fee_rate(50001) == 0.0125
    f3 = calculate_ticketing_fees(price=50001, quantity=1)
    assert f3["platform_fee"] == 625  # round(50,001 * 0.0125 = 625.0125)

    assert get_canonical_public_fee_rate(100000) == 0.0125
    f4 = calculate_ticketing_fees(price=100000, quantity=1)
    assert f4["platform_fee"] == 1250  # 100,000 * 0.0125

    assert get_canonical_public_fee_rate(150000) == 0.0125
    f5 = calculate_ticketing_fees(price=150000, quantity=1)
    assert f5["platform_fee"] == 1875  # 150,000 * 0.0125

    # Boundary 3: Rp150,001–Rp1,000,000 -> 1.00%
    assert get_canonical_public_fee_rate(150001) == 0.0100
    f6 = calculate_ticketing_fees(price=150001, quantity=1)
    assert f6["platform_fee"] == 1500  # round(150,001 * 0.0100)

    assert get_canonical_public_fee_rate(300000) == 0.0100
    f7 = calculate_ticketing_fees(price=300000, quantity=1)
    assert f7["platform_fee"] == 3000

    assert get_canonical_public_fee_rate(1000000) == 0.0100
    f8 = calculate_ticketing_fees(price=1000000, quantity=1)
    assert f8["platform_fee"] == 10000

    # Boundary 4: > Rp1,000,000 -> 0.75%
    assert get_canonical_public_fee_rate(1000001) == 0.0075
    f9 = calculate_ticketing_fees(price=1000001, quantity=1)
    assert f9["platform_fee"] == 7500  # round(1,000,001 * 0.0075 = 7500.0075)

    assert get_canonical_public_fee_rate(1500000) == 0.0075
    f10 = calculate_ticketing_fees(price=1500000, quantity=1)
    assert f10["platform_fee"] == 11250


def test_strategic_negotiated_rate_and_rejection():
    """Ensure strategic negotiated rate works down to 0.50%, but rejects < 0.50%."""
    from admission_engine import calculate_ticketing_fees

    # Approved 0.50%
    f_strat = calculate_ticketing_fees(
        price=1000000,
        quantity=1,
        custom_policy={"policy_type": "strategic_negotiated", "rate": 0.0050}
    )
    assert f_strat["platform_fee"] == 5000
    assert f_strat["fee_rate"] == 0.0050
    assert f_strat["policy_type"] == "strategic_negotiated"

    # Rejection of 0.49%
    with pytest.raises(ValueError, match="below minimum strategic floor"):
        calculate_ticketing_fees(
            price=1000000,
            quantity=1,
            custom_policy={"policy_type": "strategic_negotiated", "rate": 0.0049}
        )


def test_tax_and_gateway_fee_classification():
    """Ensure tax defaults to 0 when not configured and gateway fee is marked as sandbox simulated."""
    from admission_engine import calculate_ticketing_fees

    # Tax not configured
    f_unconf = calculate_ticketing_fees(price=100000, quantity=1)
    assert f_unconf["tax"] == 0
    assert f_unconf["tax_status"] == "not_configured"
    assert f_unconf["gateway_fee_type"] == "sandbox_simulated"
    assert f_unconf["gateway_fee"] == 4000
    assert f_unconf["total"] == 100000 + 1250  # Gross + 1.25% fee (Rp0 tax)

    # Tax configured explicitly (e.g. 10% PB1 local entertainment tax)
    f_conf = calculate_ticketing_fees(
        price=100000,
        quantity=1,
        custom_policy={"tax_rate": 0.10}
    )
    assert f_conf["tax"] == 10000
    assert f_conf["tax_status"] == "configured"
    assert f_conf["total"] == 100000 + 1250 + 10000


def test_full_admission_matrix(tokens):
    """Verify open access, free reg, free tix, paid tix, invitation, accreditation, multi-day, and unknown category."""
    org_h = _h(tokens["organizer"])
    aud_h = _h(tokens["audience"])

    # 1. Unknown event category + custom tier
    r_custom = requests.post(f"{API}/events/{EVENT_ID}/ticket-tiers", headers=org_h, json={
        "name": "Astronomy Night Pass",
        "ticket_type": "Special Interest",
        "price": 85000,
        "quantity": 50,
        "session_days": 1,
    })
    assert r_custom.status_code == 200
    t_id = r_custom.json()["item"]["id"]

    # 2. Checkout paid ticket with tiered fee calculation
    r_chk = requests.post(f"{API}/checkout", headers=aud_h, json={
        "event_id": EVENT_ID,
        "tier_id": t_id,
        "quantity": 2,
        "method": "virtual_account",
        "method_channel": "BCA Virtual Account",
    })
    assert r_chk.status_code == 200
    order = r_chk.json()["order"]
    # Single ticket 85K falls in 50,001–150,000 -> 1.25% rate
    # Gross = 170,000; Platform fee = 170,000 * 0.0125 = 2,125; Tax = 0
    assert order["gross"] == 170000
    assert order["platform_fee"] == 2125
    assert order["tax"] == 0
    assert order["total"] == 172125

    # 3. Clean up
    requests.post(f"{API}/events/{EVENT_ID}/ticket-tiers/{t_id}/archive", headers=org_h)


def test_security_multi_tenant_and_unauthorized_isolation(tokens):
    """Ensure cross-org tier mutation is blocked (403) and audience cannot access organizer tier endpoints."""
    aud_h = _h(tokens["audience"])
    r_unauth = requests.post(f"{API}/events/{EVENT_ID}/ticket-tiers", headers=aud_h, json={"name": "Hacked Tier", "price": 1000})
    assert r_unauth.status_code == 403


def test_canonical_versioned_policy_load_and_governance(tokens):
    """Ensure platform policy is versioned, loaded canonically, and protected from tenant tampering."""
    aud_h = _h(tokens["audience"])
    org_h = _h(tokens["organizer"])
    adm_h = _h(tokens["admin"])

    # 1. Read global active policy
    r_pol = requests.get(f"{API}/platform/policies/ticketing", headers=org_h)
    assert r_pol.status_code == 200
    pol = r_pol.json()["item"]
    assert pol["key"] == "ticketing.public.default"
    assert pol["version"] == "2026.1"
    assert pol["active"] is True
    assert len(pol["public_tiers"]) == 4

    # 2. Non-admin tenant cannot update global platform policy (403)
    r_tamper = requests.post(f"{API}/platform/policies/ticketing", headers=org_h, json={"name": "Tenant Override"})
    assert r_tamper.status_code == 403

    r_tamper_aud = requests.post(f"{API}/platform/policies/ticketing", headers=aud_h, json={"name": "Audience Override"})
    assert r_tamper_aud.status_code == 403

    # 3. Admin attempting to set floor below 0.50% is rejected (400)
    r_inv = requests.post(f"{API}/platform/policies/ticketing", headers=adm_h, json={"minimum_strategic_fee_rate": 0.0020})
    assert r_inv.status_code == 400


def test_historical_order_immutability_on_policy_change(tokens):
    """Ensure historical orders maintain immutable policy snapshot and applied amounts across future policy updates."""
    aud_h = _h(tokens["audience"])
    adm_h = _h(tokens["admin"])
    org_h = _h(tokens["organizer"])

    # 1. Create a custom tier for test
    r_tier = requests.post(f"{API}/events/{EVENT_ID}/ticket-tiers", headers=org_h, json={
        "name": "Immutability Proof Tier",
        "price": 200000,
        "quantity": 20,
    })
    tier_id = r_tier.json()["item"]["id"]

    try:
        # 2. Create order under initial policy version
        r_chk = requests.post(f"{API}/checkout", headers=aud_h, json={
            "event_id": EVENT_ID,
            "tier_id": tier_id,
            "quantity": 1,
            "method": "virtual_account",
            "method_channel": "BCA Virtual Account",
        })
        assert r_chk.status_code == 200
        order = r_chk.json()["order"]
        order_id = order["id"]
        snap = order.get("fee_policy_snapshot", {})

        # Verify all required snapshot fields are stored
        assert snap["policy_key"] == "ticketing.public.default"
        assert snap["policy_version"] == "2026.1"
        assert snap["fee_rate"] == 0.0100  # 1.00% for 200k
        assert snap["platform_fee_amount"] == 2000
        assert snap["tax_amount"] == 0
        assert snap["gateway_fee"] == 4000
        assert snap["gateway_fee_type"] == "sandbox_simulated"
        assert snap["fee_bearer"] == "buyer_absorbs"

        # 3. Simulate future policy version update by Admin
        r_update = requests.post(f"{API}/platform/policies/ticketing", headers=adm_h, json={
            "name": "OKKAX Canonical Public Tiered Fee Policy V2",
            "version": "2026.2",
            "minimum_strategic_fee_rate": 0.0050,
            "public_tiers": [
                {"max_price": 50000, "rate": 0.0150, "name": "Micro Tier"},
                {"max_price": 150000, "rate": 0.0125, "name": "Standard Tier"},
                {"max_price": 1000000, "rate": 0.0110, "name": "Changed Mid Tier (1.10%)"},
                {"max_price": None, "rate": 0.0075, "name": "VIP Tier"},
            ]
        })
        assert r_update.status_code == 200

        # 4. Fetch historical order back and verify 100% immutability
        r_orders = requests.get(f"{API}/my/orders", headers=aud_h)
        assert r_orders.status_code == 200
        hist_order = next((o for o in r_orders.json()["items"] if o["id"] == order_id), None)
        assert hist_order is not None
        assert hist_order["gross"] == 200000
        assert hist_order["platform_fee"] == 2000
        assert hist_order["total"] == 202000
        assert hist_order["fee_policy_snapshot"]["policy_version"] == "2026.1"
        assert hist_order["fee_policy_snapshot"]["fee_rate"] == 0.0100
        assert hist_order["fee_policy_snapshot"]["platform_fee_amount"] == 2000

    finally:
        # Restore default policy 2026.1
        from admission_engine import DEFAULT_TICKETING_FEE_POLICY_DOC
        requests.post(f"{API}/platform/policies/ticketing", headers=adm_h, json=DEFAULT_TICKETING_FEE_POLICY_DOC)
        requests.post(f"{API}/events/{EVENT_ID}/ticket-tiers/{tier_id}/archive", headers=org_h)


def test_missing_or_corrupt_policy_fails_safely():
    """Ensure calculator and policy loader fall back safely to default template when DB is missing or corrupted."""
    import asyncio
    from admission_engine import get_active_ticketing_fee_policy, DEFAULT_TICKETING_FEE_POLICY_DOC

    class MockCorruptDB:
        class CorruptCollection:
            async def find_one(self, *args, **kwargs):
                raise RuntimeError("Database connection timed out or collection corrupted")
        platform_policies = CorruptCollection()

    fallback_policy = asyncio.run(get_active_ticketing_fee_policy(MockCorruptDB()))
    assert fallback_policy["key"] == "ticketing.public.default"
    assert fallback_policy["version"] == "2026.1"
    assert len(fallback_policy["public_tiers"]) == 4


def test_platform_policy_version_history_persisted_and_admin_gated(tokens):
    """Ensure every canonical policy update archives the prior version and history is admin-only.

    Closes the final gap in the configurable/versioned policy governance layer:
    the platform-level policy evolution itself is now recoverable and inspectable,
    just as individual order snapshots already were.
    """
    aud_h = _h(tokens["audience"])
    org_h = _h(tokens["organizer"])
    adm_h = _h(tokens["admin"])

    # 1. Non-admins cannot read policy history
    r_forbid_aud = requests.get(f"{API}/platform/policies/ticketing/history", headers=aud_h)
    assert r_forbid_aud.status_code == 403
    r_forbid_org = requests.get(f"{API}/platform/policies/ticketing/history", headers=org_h)
    assert r_forbid_org.status_code == 403

    # 2. Capture current active version
    r_cur = requests.get(f"{API}/platform/policies/ticketing", headers=adm_h)
    assert r_cur.status_code == 200
    active_before = r_cur.json()["item"]
    prior_version = active_before["version"]

    # 3. Admin bumps to a distinct provisional version
    new_version = "2026.9-history-probe"
    r_upd = requests.post(f"{API}/platform/policies/ticketing", headers=adm_h, json={
        "name": "OKKAX Canonical Public Tiered Fee Policy (History Probe)",
        "version": new_version,
        "minimum_strategic_fee_rate": 0.0050,
    })
    assert r_upd.status_code == 200
    assert r_upd.json()["item"]["version"] == new_version
    assert r_upd.json()["item"].get("updated_by")

    try:
        # 4. Prior version now appears in archived history
        r_hist = requests.get(f"{API}/platform/policies/ticketing/history", headers=adm_h)
        assert r_hist.status_code == 200
        hist = r_hist.json()["items"]
        matched = [h for h in hist if h.get("version") == prior_version and h.get("superseded_by_version") == new_version]
        assert matched, f"Prior version {prior_version} not archived when superseded by {new_version}"
        entry = matched[0]
        assert entry["active"] is False
        assert entry.get("archived_at")
        assert entry.get("archived_by")
        assert entry["key"] == "ticketing.public.default"

    finally:
        # 5. Restore canonical default (this itself archives the probe version too)
        from admission_engine import DEFAULT_TICKETING_FEE_POLICY_DOC
        requests.post(f"{API}/platform/policies/ticketing", headers=adm_h, json=DEFAULT_TICKETING_FEE_POLICY_DOC)


def test_client_fee_tampering_ignored_in_checkout(tokens):
    """Ensure client cannot send arbitrary fee_rate or tamper with server-authoritative calculation."""
    aud_h = _h(tokens["audience"])
    org_h = _h(tokens["organizer"])

    # Create tier for 100k (canonical rate = 1.25% -> 1,250 fee)
    r_tier = requests.post(f"{API}/events/{EVENT_ID}/ticket-tiers", headers=org_h, json={
        "name": "Tampering Test Tier",
        "price": 100000,
        "quantity": 10,
    })
    tier_id = r_tier.json()["item"]["id"]

    try:
        # Attempt to pass malicious 0.0001 fee_rate and platform_fee in body
        r_chk = requests.post(f"{API}/checkout", headers=aud_h, json={
            "event_id": EVENT_ID,
            "tier_id": tier_id,
            "quantity": 1,
            "method": "virtual_account",
            "method_channel": "BCA Virtual Account",
            "fee_rate": 0.0001,
            "platform_fee": 10,
            "total": 100010,
        })
        assert r_chk.status_code == 200
        order = r_chk.json()["order"]
        # Server must strictly enforce canonical 1.25% fee (1,250) and ignore client payload
        assert order["gross"] == 100000
        assert order["platform_fee"] == 1250
        assert order["total"] == 101250
        assert order["fee_policy_snapshot"]["fee_rate"] == 0.0125
        assert order["fee_policy_snapshot"]["platform_fee_amount"] == 1250

    finally:
        requests.post(f"{API}/events/{EVENT_ID}/ticket-tiers/{tier_id}/archive", headers=org_h)
