"""Unit and API integration tests for OKKAX Notification System."""
import os
from pathlib import Path
import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

API = "http://127.0.0.1:8001/api"
PASSWORD = os.environ.get("DEMO_PASSWORD", "DPOqsn1PJS1ATka0oagr8LCi")


def _login(email, pw=PASSWORD):
    if email == os.environ.get("ADMIN_EMAIL", "admin.local@okkax.id"):
        pw = os.environ.get("ADMIN_PASSWORD", "gh8t6P_c1U_yFxy3uPv0cRf0")
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=10)
    assert r.status_code == 200, f"Login failed for {email}: {r.text}"
    return r.json()["token"]


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def test_initial_seed_minimum_100_for_organizer():
    """Ensure organizer has >= 100 notifications on GET /notifications."""
    token = _login("organizer@okkax.id")
    r = requests.get(f"{API}/notifications?limit=20", headers=_h(token), timeout=10)
    assert r.status_code == 200
    data = r.json()

    assert "items" in data
    assert "unread" in data
    assert "total" in data
    assert data["total"] >= 100, f"Expected total >= 100, got {data['total']}"
    assert len(data["items"]) <= 20
    assert data["unread"] >= 0


def test_role_awareness_different_roles():
    """Ensure different roles (talent, sponsor, tenant, audience) receive distinct content."""
    tok_talent = _login("talent@okkax.id")
    tok_sponsor = _login("sponsor@okkax.id")
    tok_tenant = _login("tenant@okkax.id")
    tok_audience = _login("audience@okkax.id")

    r_talent = requests.get(f"{API}/notifications?limit=50", headers=_h(tok_talent), timeout=10).json()
    r_sponsor = requests.get(f"{API}/notifications?limit=50", headers=_h(tok_sponsor), timeout=10).json()
    r_tenant = requests.get(f"{API}/notifications?limit=50", headers=_h(tok_tenant), timeout=10).json()
    r_audience = requests.get(f"{API}/notifications?limit=50", headers=_h(tok_audience), timeout=10).json()

    assert r_talent["total"] >= 100
    assert r_sponsor["total"] >= 100
    assert r_tenant["total"] >= 100
    assert r_audience["total"] >= 100

    talent_titles = [i["title"] for i in r_talent["items"]]
    sponsor_titles = [i["title"] for i in r_sponsor["items"]]
    tenant_titles = [i["title"] for i in r_tenant["items"]]
    audience_titles = [i["title"] for i in r_audience["items"]]

    assert any("perform" in t.lower() or "rider" in t.lower() or "soundcheck" in t.lower() for t in talent_titles)
    assert any("sponsor" in t.lower() or "aktivasi" in t.lower() or "proposal" in t.lower() for t in sponsor_titles)
    assert any("booth" in t.lower() or "tenant" in t.lower() or "bazaar" in t.lower() for t in tenant_titles)
    assert any("ticket" in t.lower() or "tiket" in t.lower() or "gate" in t.lower() or "penonton" in t.lower() for t in audience_titles)


def test_seeding_idempotency_on_multiple_fetches():
    """Ensure fetching notifications 10x in a row does NOT increase total count."""
    token = _login("organizer@okkax.id")

    r1 = requests.get(f"{API}/notifications?limit=12", headers=_h(token), timeout=10).json()
    total1 = r1["total"]

    for _ in range(10):
        r = requests.get(f"{API}/notifications?limit=12", headers=_h(token), timeout=10).json()
        assert r["total"] == total1, f"Expected idempotent total {total1}, got {r['total']}"


def test_mark_single_notification_read():
    """Ensure marking a single notification as read updates its state."""
    token = _login("talent@okkax.id")
    r = requests.get(f"{API}/notifications?limit=10", headers=_h(token), timeout=10).json()

    unread_items = [i for i in r["items"] if not i.get("read")]
    if not unread_items:
        pytest.skip("No unread items found for test user")

    target = unread_items[0]
    initial_unread = r["unread"]

    # Mark single read
    r_post = requests.post(f"{API}/notifications/{target['id']}/read", headers=_h(token), timeout=10)
    assert r_post.status_code == 200
    assert r_post.json().get("ok") is True

    # Re-fetch
    r_after = requests.get(f"{API}/notifications?limit=10", headers=_h(token), timeout=10).json()
    assert r_after["unread"] == initial_unread - 1


def test_mark_all_notifications_read():
    """Ensure marking all notifications as read sets unread=0 and subsequent GET stays 0."""
    token = _login("sponsor@okkax.id")

    # Mark all read
    r_post = requests.post(f"{API}/notifications/read", headers=_h(token), timeout=10)
    assert r_post.status_code == 200
    assert r_post.json().get("ok") is True

    # Re-fetch
    r_after = requests.get(f"{API}/notifications?limit=12", headers=_h(token), timeout=10).json()
    assert r_after["unread"] == 0

    # Ensure all returned items are read
    for item in r_after["items"]:
        assert item["read"] is True


def test_history_pagination():
    """Ensure /notifications/history supports limit and pagination."""
    token = _login("organizer@okkax.id")

    r_page1 = requests.get(f"{API}/notifications/history?page=1&limit=25", headers=_h(token), timeout=10).json()
    r_page2 = requests.get(f"{API}/notifications/history?page=2&limit=25", headers=_h(token), timeout=10).json()

    assert len(r_page1["items"]) == 25
    assert len(r_page2["items"]) == 25
    assert r_page1["items"][0]["id"] != r_page2["items"][0]["id"]


def test_aggregation_unit_logic():
    """Ensure presentation aggregation groups duplicate ticket sales correctly."""
    from notifications import aggregate_notifications

    sample_items = [
        {
            "id": "notif-1",
            "user_id": "usr-1",
            "event_id": "evt-aruna-2026",
            "event_name": "Aruna Bold Live Experience 2026",
            "type": "ticket_sale",
            "title": "Penjualan tiket baru",
            "body": "2 tiket Presale terjual.",
            "read": False,
            "created_at": "2026-08-18T10:00:00Z",
            "metadata": {"quantity": 2, "tier_name": "Presale", "amount": 500000},
        },
        {
            "id": "notif-2",
            "user_id": "usr-1",
            "event_id": "evt-aruna-2026",
            "event_name": "Aruna Bold Live Experience 2026",
            "type": "ticket_sale",
            "title": "Penjualan tiket baru",
            "body": "3 tiket Presale terjual.",
            "read": False,
            "created_at": "2026-08-18T10:05:00Z",
            "metadata": {"quantity": 3, "tier_name": "Presale", "amount": 750000},
        },
        {
            "id": "notif-3",
            "user_id": "usr-1",
            "event_id": "evt-aruna-2026",
            "event_name": "Aruna Bold Live Experience 2026",
            "type": "ticket_sale",
            "title": "Penjualan tiket baru",
            "body": "1 tiket Regular terjual.",
            "read": True,
            "created_at": "2026-08-18T10:10:00Z",
            "metadata": {"quantity": 1, "tier_name": "Regular", "amount": 350000},
        },
        {
            "id": "notif-other",
            "user_id": "usr-1",
            "event_id": "evt-aruna-2026",
            "event_name": "Aruna Bold Live Experience 2026",
            "type": "talent_confirmation",
            "title": "Rider talent dikonfirmasi",
            "body": "Aksara Band menyetujui Backline Rider.",
            "read": False,
            "created_at": "2026-08-18T10:15:00Z",
            "metadata": {},
        }
    ]

    aggregated = aggregate_notifications(sample_items)
    assert len(aggregated) == 2, f"Expected 2 items, got {len(aggregated)}"

    ticket_group = next(i for i in aggregated if i["type"] == "ticket_sale_aggregated")
    assert ticket_group["metadata"]["total_quantity"] == 6
    assert ticket_group["metadata"]["total_amount"] == 1600000
    assert ticket_group["read"] is False
    assert "6 tiket terjual" in ticket_group["body"]
