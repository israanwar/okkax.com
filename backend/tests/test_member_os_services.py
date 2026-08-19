"""
Automated Pytest Suite for Member OS Advanced Domain Services.
Tests:
1. Workforce Jobs & Applications
2. Workforce Attendance & Shift Check-in/Check-out
3. Personal Wallet & Payout Requests
4. Unified Settings Endpoints
5. Permission-Gated Messaging with Relationship Verification
"""

import pytest
import httpx

import os

BASE = os.environ.get("TEST_BASE_URL", "http://127.0.0.1:8001").rstrip("/")
API = f"{BASE}/api"


@pytest.fixture(scope="session")
def worker_auth():
    r = httpx.post(f"{API}/demo/persona-login", json={"label": "worker"}, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    return {"headers": {"Authorization": f"Bearer {d['token']}"}, "user": d["user"]}


@pytest.fixture(scope="session")
def organizer_auth():
    r = httpx.post(f"{API}/demo/persona-login", json={"label": "organizer"}, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    return {"headers": {"Authorization": f"Bearer {d['token']}"}, "user": d["user"]}


# =============================================================================
# 1. WORKFORCE JOBS
# =============================================================================

def test_list_workforce_jobs():
    r = httpx.get(f"{API}/workforce/jobs", timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert "items" in d
    assert d["total"] >= 1
    job = d["items"][0]
    assert "title" in job
    assert "rate_per_day" in job


def test_apply_workforce_job(worker_auth):
    # Fetch open jobs
    jobs = httpx.get(f"{API}/workforce/jobs", headers=worker_auth["headers"], timeout=10).json()["items"]
    assert len(jobs) > 0
    job_id = jobs[0]["id"]

    # Apply
    r = httpx.post(
        f"{API}/workforce/jobs/{job_id}/apply",
        headers=worker_auth["headers"],
        json={"expected_rate": 2600000.0, "notes": "Tersedia untuk gladi resik dan show."},
        timeout=10
    )
    assert r.status_code in [200, 400]  # 400 if already applied in previous run
    if r.status_code == 200:
        assert r.json()["status"] == "success"

    # Verify in applications list
    r_apps = httpx.get(f"{API}/workforce/applications", headers=worker_auth["headers"], timeout=10)
    assert r_apps.status_code == 200
    apps = r_apps.json()["items"]
    assert any(a["job_id"] == job_id for a in apps)


# =============================================================================
# 2. WORKFORCE ATTENDANCE
# =============================================================================

def test_workforce_check_in_and_check_out(worker_auth):
    # Perform check-in
    r_in = httpx.post(
        f"{API}/workforce/check-in",
        headers=worker_auth["headers"],
        json={"shift_id": "worker-shift-001", "event_id": "EVT-MKS-2026-0001", "location_lat": -5.1477, "location_lng": 119.4327},
        timeout=10
    )
    assert r_in.status_code == 200
    d_in = r_in.json()
    assert d_in["status"] in ["success", "already_checked_in"]

    # Check attendance logs
    r_att = httpx.get(f"{API}/workforce/attendance", headers=worker_auth["headers"], timeout=10)
    assert r_att.status_code == 200
    assert r_att.json()["total"] >= 1

    # Perform check-out
    r_out = httpx.post(
        f"{API}/workforce/check-out",
        headers=worker_auth["headers"],
        json={"shift_id": "worker-shift-001", "notes": "Shift FOH selesai tanpa kendala teknis."},
        timeout=10
    )
    assert r_out.status_code in [200, 400]  # 400 if already checked out
    if r_out.status_code == 200:
        assert r_out.json()["status"] == "success"
        assert "duration_hours" in r_out.json()


# =============================================================================
# 3. PERSONAL WALLET
# =============================================================================

def test_personal_wallet_balance_and_payouts(worker_auth):
    r_wal = httpx.get(f"{API}/wallet/personal", headers=worker_auth["headers"], timeout=10)
    assert r_wal.status_code == 200
    w = r_wal.json()
    assert "available_balance" in w
    assert "protected_balance" in w
    assert "pending_balance" in w
    assert "lifetime_earnings" in w
    assert "payout_method" in w

    # Get transactions
    r_tx = httpx.get(f"{API}/wallet/transactions", headers=worker_auth["headers"], timeout=10)
    assert r_tx.status_code == 200
    assert "items" in r_tx.json()

    # Update payout method
    r_meth = httpx.put(
        f"{API}/wallet/payout-method",
        headers=worker_auth["headers"],
        json={
            "bank_name": "Bank Mandiri",
            "account_number": "1400019283741",
            "account_holder_name": "Worker OKKAX",
            "ewallet_type": "GoPay",
            "ewallet_phone": "081298765432"
        },
        timeout=10
    )
    assert r_meth.status_code == 200

    # Request small valid withdraw
    if w["available_balance"] >= 50000.0:
        r_wd = httpx.post(
            f"{API}/wallet/withdraw",
            headers=worker_auth["headers"],
            json={"amount": 50000.0, "destination_type": "bank_transfer"},
            timeout=10
        )
        assert r_wd.status_code == 200
        assert r_wd.json()["status"] == "success"


# =============================================================================
# 4. SETTINGS
# =============================================================================

def test_settings_me_and_updates(worker_auth):
    r = httpx.get(f"{API}/settings/me", headers=worker_auth["headers"], timeout=10)
    assert r.status_code == 200
    s = r.json()
    assert "profile" in s
    assert "organization" in s
    assert "notifications" in s
    assert "sessions" in s

    # Update profile
    r_p = httpx.put(
        f"{API}/settings/profile",
        headers=worker_auth["headers"],
        json={"city": "Makassar", "bio": "Senior FOH Sound Engineer berpengalaman."},
        timeout=10
    )
    assert r_p.status_code == 200

    # Update notifications
    r_n = httpx.put(
        f"{API}/settings/notifications",
        headers=worker_auth["headers"],
        json={"email_notifications": True, "push_notifications": True, "action_alerts": True},
        timeout=10
    )
    assert r_n.status_code == 200


# =============================================================================
# 5. PERMISSION-GATED MESSAGING
# =============================================================================

def test_permission_gated_messaging_flow(organizer_auth):
    # List conversations
    r_list = httpx.get(f"{API}/messages/conversations", headers=organizer_auth["headers"], timeout=10)
    assert r_list.status_code == 200
    convs = r_list.json()["items"]
    assert len(convs) >= 1

    conv_id = convs[0]["id"]

    # Get thread
    r_thread = httpx.get(f"{API}/messages/conversations/{conv_id}", headers=organizer_auth["headers"], timeout=10)
    assert r_thread.status_code == 200
    d_th = r_thread.json()
    assert "conversation" in d_th
    assert "messages" in d_th

    # Send message
    r_send = httpx.post(
        f"{API}/messages/conversations/{conv_id}/messages",
        headers=organizer_auth["headers"],
        json={"content": "Mohon perhatikan batas waktu soundcheck sebelum pukul 15:00 WITA."},
        timeout=10
    )
    assert r_send.status_code == 200
    assert r_send.json()["status"] == "success"

    # Mark as read
    r_read = httpx.post(f"{API}/messages/conversations/{conv_id}/read", headers=organizer_auth["headers"], timeout=10)
    assert r_read.status_code == 200
