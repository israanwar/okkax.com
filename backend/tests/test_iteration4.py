"""Iteration 4 backend tests — /present Mode Presentasi & extended /api/demo/summary."""
import os
import time
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
EVENT_ID = "evt-aruna-2026"


@pytest.fixture(scope="module")
def organizer_token():
    r = requests.post(f"{API}/auth/login", json={
        "email": "organizer@okkax.id", "password": os.environ["DEMO_PASSWORD"]})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def org_headers(organizer_token):
    return {"Authorization": f"Bearer {organizer_token}"}


# ---------------------------- /api/demo/summary schema
class TestDemoSummarySchema:
    def test_public_no_auth(self):
        r = requests.get(f"{API}/demo/summary")
        assert r.status_code == 200
        self.data = r.json()

    def test_has_brief_operations_ripple(self):
        d = requests.get(f"{API}/demo/summary").json()
        for key in ("brief", "operations", "ripple"):
            assert key in d, f"missing {key}"

        for k in ("city", "days", "setup_days", "capacity", "budget",
                  "headliner", "headliner_fee", "headliner_landed_cost",
                  "booths", "sponsor_tiers"):
            assert k in d["brief"], f"brief missing {k}"

        for k in ("readiness", "rider_matched", "rider_total",
                  "workforce_filled", "workforce_needed",
                  "vendors_confirmed", "vendors_total",
                  "milestones_paid", "milestones_total", "milestones_pending_amount",
                  "incidents_open", "incidents_total",
                  "tickets_sold", "ticket_capacity"):
            assert k in d["operations"], f"operations missing {k}"

        for k in ("businesses_activated", "workers_activated",
                  "vendor_payout", "workforce_payout",
                  "venue_income", "ticket_gmv", "economic_activity"):
            assert k in d["ripple"], f"ripple missing {k}"

    def test_no_sensitive_fields(self):
        r = requests.get(f"{API}/demo/summary")
        blob = r.text.lower()
        for bad in ("password_hash", "jwt_secret", "sk_test", "sk-emergent", "api_key", "\"token\""):
            assert bad not in blob, f"sensitive token found in summary: {bad}"

    def test_personas_no_admin(self):
        d = requests.get(f"{API}/demo/summary").json()
        emails = [p["email"] for p in d["personas"]]
        assert "admin@okkax.id" not in emails
        labels = [p["label"] for p in d["personas"]]
        assert "Super Administrator" not in labels


# ---------------------------- data integrity vs source of truth
class TestDataIntegrity:
    def test_budget_numbers_match(self, org_headers):
        d = requests.get(f"{API}/demo/summary").json()
        b = requests.get(f"{API}/events/{EVENT_ID}/budget", headers=org_headers).json()
        assert d["key_numbers"]["total_event_cost"] == b["total_cost"]
        assert d["key_numbers"]["confirmed_funding"] == b["confirmed_funding"]
        assert d["key_numbers"]["funding_gap"] == b["funding_gap"]

    def test_headliner_landed_cost_matches_largest_talent(self, org_headers):
        d = requests.get(f"{API}/demo/summary").json()
        t = requests.get(f"{API}/events/{EVENT_ID}/talents", headers=org_headers).json()["items"]
        largest = max(t, key=lambda x: x["landed_cost"])
        assert d["brief"]["headliner_landed_cost"] == largest["landed_cost"]
        assert d["brief"]["headliner"] == largest["talent_name"]

    def test_ticket_gmv_matches_paid_orders(self, org_headers):
        d = requests.get(f"{API}/demo/summary").json()
        payments = requests.get(f"{API}/events/{EVENT_ID}/payments", headers=org_headers).json()["payments"]
        paid_total = sum(
            p["gross"] + p["platform_fee"] + p["tax_estimate"]
            for p in payments
            if p["status"] == "Simulated Paid" and p["purpose"] == "Ticket purchase"
        )
        assert d["ripple"]["ticket_gmv"] == paid_total


# ---------------------------- funding mutation reduces funding_gap
class TestFundingGapMutation:
    def test_add_funding_item_reduces_gap(self, org_headers):
        before = requests.get(f"{API}/demo/summary").json()["key_numbers"]["funding_gap"]
        payload = {
            "source_type": "internal_marketing_budget",
            "source_name": "TEST_iter4_gap",
            "amount": 25000000,
            "status": "committed",
        }
        r = requests.post(f"{API}/events/{EVENT_ID}/funding-items", json=payload, headers=org_headers)
        assert r.status_code in (200, 201), r.text
        item = r.json()
        item_id = item.get("id") or item.get("funding_item_id")

        after = requests.get(f"{API}/demo/summary").json()["key_numbers"]["funding_gap"]
        assert after == before - 25000000, f"expected gap to drop by 25M ({before}->{after})"

        # cleanup via demo reset
        rr = requests.post(f"{API}/demo/reset")
        assert rr.status_code in (200, 201)


# ---------------------------- read-only: no unintended mutation
class TestReadOnlySummary:
    def test_multiple_calls_stable(self):
        a = requests.get(f"{API}/demo/summary").json()
        time.sleep(0.5)
        b = requests.get(f"{API}/demo/summary").json()
        assert a["key_numbers"] == b["key_numbers"]
        assert a["operations"] == b["operations"]
        assert a["ripple"] == b["ripple"]


# ---------------------------- Sensitive routes still protected
class TestSensitiveRoutesProtected:
    def test_admin_metrics_requires_auth(self):
        r = requests.get(f"{API}/admin/metrics")
        assert r.status_code in (401, 403), r.status_code


# ---------------------------- Regression: QR validate valid then already used
class TestQRRegression:
    def test_qr_valid_then_already_used(self, org_headers):
        # Get a valid ticket
        orders = requests.get(f"{API}/events/{EVENT_ID}/ticket-orders", headers=org_headers).json()
        # find any ticket
        r = requests.get(f"{API}/events/{EVENT_ID}/tickets", headers=org_headers)
        if r.status_code != 200:
            pytest.skip("tickets endpoint not available")
        tickets = r.json()
        valid = next((t for t in tickets if t.get("status") == "valid"), None)
        if not valid:
            pytest.skip("no valid ticket to test QR flow")
        qr = valid["qr_code"]
        v1 = requests.post(f"{API}/tickets/validate", json={"qr_code": qr}, headers=org_headers)
        assert v1.status_code == 200
        assert v1.json().get("valid") is True or v1.json().get("status") in ("valid", "used")
        v2 = requests.post(f"{API}/tickets/validate", json={"qr_code": qr}, headers=org_headers)
        # second should indicate already used
        j = v2.json()
        assert j.get("valid") is False or "used" in str(j).lower()

        # reset demo to keep state clean
        requests.post(f"{API}/demo/reset")
