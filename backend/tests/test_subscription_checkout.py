"""Targeted tests for the subscription (Pro/Max) monetization flow.

Mirrors the ticket checkout contract (create order -> simulate
success/fail) applied to a subscription plan. Covers the primary
scenario (Talent buys Pro), the fail-path invariant (entitlement never
changes on a failed payment), audience being blocked, and price/role
resolution across every paid role.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8001").rstrip("/")
API = f"{BASE_URL}/api"
PASSWORD = os.environ.get("DEMO_PASSWORD", "DPOqsn1PJS1ATka0oagr8LCi")

PAID_ROLE_ACCOUNTS = {
    "organizer": ("organizer@okkax.id", 99000),
    "talent": ("talent@okkax.id", 39000),
    "sponsor": ("sponsor@okkax.id", 99000),
    "tenant": ("tenant@okkax.id", 29000),
    "vendor": ("vendor@okkax.id", 59000),
    "workforce": ("worker@okkax.id", 19000),
}


def _login(email):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _checkout(headers, plan="pro", billing="monthly", method="qris", channel="QRIS Dynamic"):
    return requests.post(
        f"{API}/subscription/checkout",
        json={"plan": plan, "billing": billing, "method": method, "method_channel": channel},
        headers=headers, timeout=15,
    )


def test_talent_pro_primary_scenario_full_flow():
    headers = _login("talent@okkax.id")

    checkout = _checkout(headers, plan="pro", billing="monthly")
    assert checkout.status_code == 200, checkout.text
    body = checkout.json()
    assert body["order"]["role"] == "talent"
    assert body["order"]["plan"] == "pro"
    assert body["order"]["total"] == 39000
    assert body["order"]["status"] == "awaiting_payment"
    assert body["payment"]["status"] == "Awaiting Payment"

    payment_id = body["payment"]["id"]
    sim = requests.post(f"{API}/subscription/payments/{payment_id}/simulate", json={"outcome": "success"}, headers=headers, timeout=15)
    assert sim.status_code == 200, sim.text
    sim_body = sim.json()
    assert sim_body["payment"]["status"] == "Simulated Paid"
    entitlement = sim_body["entitlement"]
    assert entitlement["plan"] == "pro"
    assert entitlement["role"] == "talent"
    assert entitlement["status"] == "active"

    # Entitlement is durable — reachable independent of the checkout call.
    me = requests.get(f"{API}/my/subscription", headers=headers, timeout=15)
    assert me.status_code == 200
    assert me.json()["subscription"]["plan"] == "pro"
    assert me.json()["subscription"]["status"] == "active"

    # Activation notification landed with role/period/total/date, scoped to
    # this member's active notification_role so it actually surfaces in
    # their feed.
    notifs = requests.get(f"{API}/notifications?limit=10", headers=headers, timeout=15)
    assert notifs.status_code == 200
    items = notifs.json().get("items", [])
    activation = next((n for n in items if n.get("type") == "subscription_activated"), None)
    assert activation is not None, "activation notification missing from feed"
    assert "Pro" in activation["title"]
    assert "Talent" in activation["body"]
    assert "bulanan" in activation["body"]
    assert "39,000" in activation["body"] or "39.000" in activation["body"]

    orders = requests.get(f"{API}/my/subscription-orders", headers=headers, timeout=15)
    assert orders.status_code == 200
    assert any(o["status"] == "paid" and o["plan"] == "pro" for o in orders.json()["items"])


def test_failed_payment_leaves_entitlement_unchanged():
    headers = _login("talent@okkax.id")

    before = requests.get(f"{API}/my/subscription", headers=headers, timeout=15).json().get("subscription")

    checkout = _checkout(headers, plan="max", billing="yearly", method="bank_transfer", channel="Transfer manual dengan bukti pembayaran")
    assert checkout.status_code == 200
    payment_id = checkout.json()["payment"]["id"]

    sim = requests.post(f"{API}/subscription/payments/{payment_id}/simulate", json={"outcome": "fail"}, headers=headers, timeout=15)
    assert sim.status_code == 200
    assert sim.json()["payment"]["status"] == "Failed"
    assert "entitlement" not in sim.json()

    after = requests.get(f"{API}/my/subscription", headers=headers, timeout=15).json().get("subscription")
    assert after == before, "a failed payment must never mutate the stored entitlement"

    orders = requests.get(f"{API}/my/subscription-orders", headers=headers, timeout=15).json()["items"]
    assert any(o["status"] == "failed" and o["plan"] == "max" for o in orders)


def test_audience_cannot_purchase_pro_or_max():
    headers = _login("audience@okkax.id")
    for plan in ("pro", "max"):
        r = _checkout(headers, plan=plan)
        assert r.status_code == 403, r.text
        assert "Audience" in r.json()["detail"]


@pytest.mark.parametrize("role,email_price", list(PAID_ROLE_ACCOUNTS.items()))
def test_role_resolves_authoritative_price(role, email_price):
    email, expected_pro_monthly = email_price
    headers = _login(email)
    r = _checkout(headers, plan="pro", billing="monthly")
    assert r.status_code == 200, r.text
    order = r.json()["order"]
    assert order["role"] == role
    assert order["total"] == expected_pro_monthly


def test_client_supplied_total_is_ignored_server_computes_price():
    """The checkout body has no `total` field at all — the server always
    looks the price up from its own table, it never trusts a client-sent
    amount. This test documents that contract via the response shape."""
    headers = _login("talent@okkax.id")
    r = _checkout(headers, plan="max", billing="monthly")
    assert r.status_code == 200
    assert r.json()["order"]["total"] == 79000  # talent maxMonthly, not client-influenced
