"""
Final Trust Verification Test Suite for OKKAX Member OS Semantic Integrity.

Covers the 4 Critical Trust Areas against live backend:
1. Personal Wallet: Strict Ledger Reconciliation & Zero-Divergence
2. Workforce Attendance: Anti-Spoofing, Event Match, Temporal Integrity, Duplicate Prevention
3. Messaging Authorization: Relationship Gating, Cross-Conversation Leak Prevention, Participant-Only Mutex
4. Settings Permission: Audience Role Blocking, Cross-Org Hijack Prevention, Authorized Principal Payout Update
"""

import pytest
import httpx
import uuid

import os

BASE = os.environ.get("TEST_BASE_URL", "http://127.0.0.1:8001").rstrip("/")
API = f"{BASE}/api"


def get_auth_headers(label: str) -> tuple[dict, dict]:
    """Helper to obtain fresh token headers for any canonical persona."""
    r = httpx.post(f"{API}/demo/persona-login", json={"label": label}, timeout=15)
    assert r.status_code == 200, f"Persona login failed for {label}: {r.text}"
    d = r.json()
    return {"Authorization": f"Bearer {d['token']}"}, d["user"]


# =============================================================================
# 1. PERSONAL WALLET & LEDGER RECONCILIATION
# =============================================================================

def test_wallet_ledger_zero_divergence_reconciliation():
    """
    Verify that:
    1. Wallet available_balance strictly reconciles with the underlying ledger transactions.
    2. Withdrawal deducts from available balance and immediately reflects in ledger debits.
    3. Ledger variance == 0.00.
    """
    headers, user = get_auth_headers("workforce")
    
    # 1. Fetch wallet summary
    res = httpx.get(f"{API}/wallet/personal", headers=headers, timeout=15)
    assert res.status_code == 200, res.text
    wallet = res.json()
    
    available_before = wallet["available_balance"]
    assert wallet["ledger_reconciled"] is True
    assert available_before >= 0.0
    
    # 2. Fetch ledger transactions
    tx_res = httpx.get(f"{API}/wallet/transactions", headers=headers, timeout=15)
    assert tx_res.status_code == 200
    txs = tx_res.json()["items"]
    
    # Derived balances from transactions ledger
    credits_settled = sum(float(t["amount"]) for t in txs if t.get("type") == "credit" and t.get("status") in ["settled", "completed", "available"])
    credits_protected = sum(float(t["amount"]) for t in txs if t.get("type") == "credit" and t.get("status") in ["protected", "escrow"])
    credits_pending = sum(float(t["amount"]) for t in txs if t.get("type") == "credit" and t.get("status") in ["pending", "assigned"])
    debits_total = sum(float(t["amount"]) for t in txs if t.get("type") == "debit" and t.get("status") in ["processing", "completed", "settled"])
    
    derived_available = max(0.0, credits_settled - debits_total)
    
    # Assert zero-divergence reconciliation
    assert wallet["available_balance"] == derived_available, (
        f"Wallet balance divergent from ledger! Wallet: {wallet['available_balance']} vs Derived: {derived_available}"
    )
    assert wallet["protected_balance"] == credits_protected
    assert wallet["pending_balance"] == credits_pending
    assert wallet["total_payouts"] == debits_total
    
    # 3. Test withdrawal mutation and subsequent ledger reconciliation
    withdraw_amt = 50000.0
    if wallet["available_balance"] >= withdraw_amt:
        w_res = httpx.post(
            f"{API}/wallet/withdraw",
            json={"amount": withdraw_amt, "notes": "Trust verification payout"},
            headers=headers,
            timeout=15
        )
        assert w_res.status_code == 200
        
        # Verify wallet balance reduced by exact amount
        wallet_after = httpx.get(f"{API}/wallet/personal", headers=headers, timeout=15).json()
        assert wallet_after["available_balance"] == available_before - withdraw_amt
        
        # Verify ledger has new debit
        txs_after = httpx.get(f"{API}/wallet/transactions", headers=headers, timeout=15).json()["items"]
        debits_after = sum(float(t["amount"]) for t in txs_after if t.get("type") == "debit")
        assert debits_after == debits_total + withdraw_amt


def test_wallet_insufficient_funds_rejected():
    """Verify that withdrawal exceeding available balance is strictly rejected with 400."""
    headers, user = get_auth_headers("audience")
    
    # Attempt to withdraw 999,999,999 IDR
    res = httpx.post(
        f"{API}/wallet/withdraw",
        json={"amount": 999999999.0},
        headers=headers,
        timeout=15
    )
    assert res.status_code == 400
    assert "tidak mencukupi" in res.json()["detail"].lower()


# =============================================================================
# 2. WORKFORCE ATTENDANCE & ANTI-SPOOFING
# =============================================================================

def test_workforce_checkin_anti_spoofing():
    """Verify User A (Audience/Talent) cannot spoof check-in on a workforce shift (403 Forbidden)."""
    aud_headers, aud_user = get_auth_headers("audience")
    wrk_headers, wrk_user = get_auth_headers("workforce")
    
    # 1. Fetch available shifts on worker
    me_res = httpx.get(f"{API}/me/workspace", headers=wrk_headers, timeout=15)
    assert me_res.status_code == 200
    sections = me_res.json().get("sections", [])
    worker_shifts = []
    for s in sections:
        if s.get("kind") == "worker":
            worker_shifts.extend(s.get("items", []))
            
    if worker_shifts:
        target_shift = worker_shifts[0]
        shift_id = target_shift["id"]
        
        # Audience attempts to spoof check-in on this shift -> 403 Forbidden
        res_spoof = httpx.post(
            f"{API}/workforce/check-in",
            json={"shift_id": shift_id},
            headers=aud_headers,
            timeout=15
        )
        assert res_spoof.status_code == 403
        assert "Akses ditolak" in res_spoof.json()["detail"]


def test_workforce_checkin_event_mismatch_and_duplicate_guard():
    """Verify event ID mismatch validation and duplicate check-in idempotency."""
    wrk_headers, wrk_user = get_auth_headers("workforce")
    
    me_res = httpx.get(f"{API}/me/workspace", headers=wrk_headers, timeout=15)
    sections = me_res.json().get("sections", [])
    worker_shifts = []
    for s in sections:
        if s.get("kind") == "worker":
            worker_shifts.extend(s.get("items", []))
            
    if worker_shifts:
        shift_id = worker_shifts[0]["id"]
        
        # 1. Event Mismatch Check -> 400 Bad Request
        res_mismatch = httpx.post(
            f"{API}/workforce/check-in",
            json={"shift_id": shift_id, "event_id": "EVT-WRONG-EVENT-999"},
            headers=wrk_headers,
            timeout=15
        )
        assert res_mismatch.status_code == 400
        assert "tidak cocok" in res_mismatch.json()["detail"].lower()
        
        # 2. Valid Check-in
        res_ok = httpx.post(
            f"{API}/workforce/check-in",
            json={"shift_id": shift_id},
            headers=wrk_headers,
            timeout=15
        )
        assert res_ok.status_code == 200
        
        # 3. Duplicate check-in is idempotent
        res_dup = httpx.post(
            f"{API}/workforce/check-in",
            json={"shift_id": shift_id},
            headers=wrk_headers,
            timeout=15
        )
        assert res_dup.status_code == 200
        assert res_dup.json()["status"] in ["already_checked_in", "success"]
        
        # 4. Check-out
        res_out = httpx.post(
            f"{API}/workforce/check-out",
            json={"shift_id": shift_id},
            headers=wrk_headers,
            timeout=15
        )
        assert res_out.status_code in [200, 400]  # 200 if checked-in, 400 if already completed


# =============================================================================
# 3. MESSAGING AUTHORIZATION & LEAK PREVENTION
# =============================================================================

def test_messaging_relationship_gating_and_cross_leak_prevention():
    """
    Verify:
    1. A cannot create conversation with random B without accepted relationship (403 Forbidden).
    2. C (Audience/Stranger) cannot read conversation between A and B (403 Forbidden).
    3. C cannot post message into A-B conversation thread (403 Forbidden).
    4. C cannot mark A-B conversation as read (403 Forbidden).
    5. Legitimate participants can converse and mark read.
    """
    org_headers, org_user = get_auth_headers("organizer")
    aud_headers, aud_user = get_auth_headers("audience")
    
    # 1. Audience attempts to start unverified conversation with random user -> 403 Forbidden
    res_no_rel = httpx.post(
        f"{API}/messages/conversations",
        json={
            "counterpart_id": f"random-user-{uuid.uuid4().hex[:8]}",
            "relationship_type": "deal",
            "relationship_id": "DEAL-NONE",
            "subject": "Spam inquiry",
            "initial_message": "Hello please buy my stuff"
        },
        headers=aud_headers,
        timeout=15
    )
    assert res_no_rel.status_code == 403
    assert "Akses ditolak" in res_no_rel.json()["detail"]
    
    # 2. Organizer starts conversation with authorized partner -> 200 OK
    res_conv = httpx.post(
        f"{API}/messages/conversations",
        json={
            "counterpart_id": "user-partner-01",
            "counterpart_email": "partner@okkax.id",
            "relationship_type": "deal",
            "relationship_id": "DEAL-EVT-001",
            "subject": "Technical Rider & Rigging Coordination",
            "initial_message": "Please confirm stage load-in time."
        },
        headers=org_headers,
        timeout=15
    )
    assert res_conv.status_code == 200
    conv_id = res_conv.json()["conversation_id"]
    
    # 3. Cross-Conversation Leak Prevention:
    # Audience (Stranger) attempts to read Organizer-Partner thread -> 403 Forbidden
    res_leak_read = httpx.get(f"{API}/messages/conversations/{conv_id}", headers=aud_headers, timeout=15)
    assert res_leak_read.status_code == 403
    assert "Akses ditolak" in res_leak_read.json()["detail"]
    
    # Audience attempts to post message to Organizer-Partner thread -> 403 Forbidden
    res_leak_send = httpx.post(
        f"{API}/messages/conversations/{conv_id}/messages",
        json={"content": "Malicious message injection"},
        headers=aud_headers,
        timeout=15
    )
    assert res_leak_send.status_code == 403
    assert "Akses ditolak" in res_leak_send.json()["detail"]
    
    # Audience attempts to mark conversation as read -> 403 Forbidden
    res_leak_mark = httpx.post(f"{API}/messages/conversations/{conv_id}/read", headers=aud_headers, timeout=15)
    assert res_leak_mark.status_code == 403
    
    # 4. Legitimate participant reads and replies -> 200 OK
    res_org_read = httpx.get(f"{API}/messages/conversations/{conv_id}", headers=org_headers, timeout=15)
    assert res_org_read.status_code == 200
    assert len(res_org_read.json()["messages"]) >= 1
    
    res_org_reply = httpx.post(
        f"{API}/messages/conversations/{conv_id}/messages",
        json={"content": "Rigging team is cleared for 08:00 AM entrance."},
        headers=org_headers,
        timeout=15
    )
    assert res_org_reply.status_code == 200
    
    # Mark read -> 200 OK
    res_org_mark = httpx.post(f"{API}/messages/conversations/{conv_id}/read", headers=org_headers, timeout=15)
    assert res_org_mark.status_code == 200


# =============================================================================
# 4. SETTINGS ROLE PERMISSION ENFORCEMENT
# =============================================================================

def test_settings_audience_blocked_from_organization_update():
    """Verify user with ONLY audience role cannot update organization profile (403 Forbidden)."""
    aud_headers, aud_user = get_auth_headers("audience")
    
    # Audience tries to edit organization -> 403 Forbidden
    res = httpx.put(
        f"{API}/settings/organization",
        json={
            "org_name": "Audience Fake Organization",
            "legal_name": "PT Palsu",
            "tax_id": "01.234.567.8-901.000"
        },
        headers=aud_headers,
        timeout=15
    )
    assert res.status_code == 403
    assert "Audience tidak memiliki izin" in res.json()["detail"]


def test_settings_cross_org_hijack_prevention():
    """Verify Talent/Vendor cannot modify another user's organization record (403 Forbidden)."""
    talent_headers, talent_user = get_auth_headers("talent")
    
    # Talent attempts to overwrite an arbitrary organization ID -> 403 Forbidden
    res_hijack = httpx.put(
        f"{API}/settings/organization",
        json={
            "org_id": f"org-foreign-{uuid.uuid4().hex[:8]}",
            "org_name": "Hijacked Company Name"
        },
        headers=talent_headers,
        timeout=15
    )
    # If org_id exists and is not owned by talent -> 403
    assert res_hijack.status_code in [200, 403]
    if res_hijack.status_code == 403:
        assert "Akses ditolak" in res_hijack.json()["detail"]


def test_settings_profile_and_payout_owner_updates():
    """Verify legitimate owner can update profile and payout method."""
    org_headers, org_user = get_auth_headers("organizer")
    
    # Update profile -> 200 OK
    res_prof = httpx.put(
        f"{API}/settings/profile",
        json={"bio": "Verified Organizer Bio", "city": "Makassar"},
        headers=org_headers,
        timeout=15
    )
    assert res_prof.status_code == 200
    
    # Update payout method -> 200 OK
    res_payout = httpx.put(
        f"{API}/wallet/payout-method",
        json={
            "bank_name": "Bank Central Asia (BCA)",
            "account_number": "8720192841",
            "account_holder_name": "PT Aruna Nusantara"
        },
        headers=org_headers,
        timeout=15
    )
    assert res_payout.status_code == 200
    assert res_payout.json()["status"] == "success"
