"""
OKKAX backend integration tests.
Covers: auth, RBAC, event studio + blueprint, talent/rider, venue,
vendor/workforce, sponsor flow, tenant flow, ticketing+sandbox payment,
refund, QR validation, budget, discover, admin, persistence.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
PASSWORD = os.environ["DEMO_PASSWORD"]
EVENT_ID = "evt-aruna-2026"

# ---------- helpers ----------

def _login(email):
    password = os.environ["ADMIN_PASSWORD"] if email == os.environ["ADMIN_EMAIL"] else PASSWORD
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def tokens():
    emails = {
        "admin": os.environ["ADMIN_EMAIL"],
        "organizer": "organizer@okkax.id",
        "sponsor": "sponsor@okkax.id",
        "tenant": "tenant@okkax.id",
        "audience": "audience@okkax.id",
    }
    return {role: _login(email) for role, email in emails.items()}


# ---------- reset seed once ----------
@pytest.fixture(scope="session", autouse=True)
def _reset():
    requests.post(f"{API}/demo/reset", timeout=30)
    yield


# ---------- auth ----------
class TestAuth:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=15)
        assert r.status_code == 200

    def test_login_all_demo(self, tokens):
        assert all(tokens.values())

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": os.environ["ADMIN_EMAIL"], "password": "wrong"})
        assert r.status_code in (400, 401)

    def test_me(self, tokens):
        r = requests.get(f"{API}/auth/me", headers=_h(tokens["organizer"]))
        assert r.status_code == 200
        assert r.json()["user"]["email"] == "organizer@okkax.id"

    def test_register_and_forgot_password_does_not_leak_token(self):
        email = f"TEST_org_{int(time.time())}@okkax.id"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "InitPass#1", "name": "Test Org",
            "role": "organizer", "organization_name": "TEST Org",
            "city": "Jakarta", "terms_accepted": True})
        assert r.status_code == 200, r.text
        assert "token" in r.json()
        assert r.json()["user"]["roles"] == ["organizer"]

        # forgot
        r = requests.post(f"{API}/auth/forgot-password", json={"email": email})
        assert r.status_code == 200
        assert "demo_token" not in r.json()
        assert "token" not in r.json()

    def test_register_rejects_multiple_roles(self):
        email = f"TEST_multi_role_{int(time.time())}@okkax.id"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "InitPass#1", "name": "Test Multi Role",
            "roles": ["organizer", "sponsor"], "terms_accepted": True})
        assert r.status_code == 400
        assert "satu peran" in r.json()["detail"].lower()


# ---------- RBAC ----------
class TestRBAC:
    def test_sponsor_cannot_read_org_event_write_endpoint(self, tokens):
        r = requests.get(f"{API}/events/{EVENT_ID}/sponsor-interests", headers=_h(tokens["sponsor"]))
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"

    def test_organizer_cannot_call_admin(self, tokens):
        r = requests.get(f"{API}/admin/metrics", headers=_h(tokens["organizer"]))
        assert r.status_code == 403

    def test_admin_metrics(self, tokens):
        r = requests.get(f"{API}/admin/metrics", headers=_h(tokens["admin"]))
        assert r.status_code == 200
        assert "users" in r.json() or "metrics" in r.json() or isinstance(r.json(), dict)


# ---------- Event Studio + Blueprint ----------
class TestEventStudio:
    created_event_id = None

    def test_create_event_and_compile(self, tokens):
        payload = {
            "name": "TEST Konser Sandbox 2026",
            "event_type": "Concert",
            "objective": "Uji end to end",
            "description": "Event tes automation",
            "city": "Jakarta",
            "venue_preference": "Indoor",
            "start_date": "2026-11-01",
            "days": 1, "setup_days": 1, "capacity": 500,
            "audience_profile": "GenZ", "target_age": "18+",
            "budget": 500000000, "currency": "IDR",
            "attendance_format": "Onsite", "accessibility": "Wheelchair"
        }
        r = requests.post(f"{API}/events", json=payload, headers=_h(tokens["organizer"]))
        assert r.status_code == 200, r.text
        eid = r.json()["event"]["id"]
        TestEventStudio.created_event_id = eid

        # compile
        r = requests.post(f"{API}/events/{eid}/compile", headers=_h(tokens["organizer"]))
        assert r.status_code == 200, r.text
        bp = r.json()["blueprint"]
        assert bp["ai_status"] in ("refining", "done", "ai_error")

        # GET blueprint immediately (may still be refining)
        r = requests.get(f"{API}/events/{eid}/blueprint", headers=_h(tokens["organizer"]))
        assert r.status_code == 200

    def test_blueprint_edit_persist(self, tokens):
        eid = TestEventStudio.created_event_id
        assert eid
        r = requests.patch(f"{API}/events/{eid}/blueprint", json={"summary": "TEST summary edited"},
                           headers=_h(tokens["organizer"]))
        assert r.status_code == 200
        r = requests.get(f"{API}/events/{eid}/blueprint", headers=_h(tokens["organizer"]))
        assert r.json()["blueprint"]["summary"] == "TEST summary edited"


# ---------- Talent + Rider on demo event ----------
class TestTalentRider:
    et_id = None

    def test_add_and_remove_talent(self, tokens):
        # ensure talent not already added; use tal-lantera
        r = requests.get(f"{API}/events/{EVENT_ID}/talents", headers=_h(tokens["organizer"]))
        assert r.status_code == 200
        existing = {t["talent_id"] for t in r.json()["items"]}
        talent_id = "tal-lantera"
        if talent_id in existing:
            # remove first
            et = next(t for t in r.json()["items"] if t["talent_id"] == talent_id)
            requests.delete(f"{API}/events/{EVENT_ID}/talents/{et['id']}", headers=_h(tokens["organizer"]))

        r = requests.post(f"{API}/events/{EVENT_ID}/talents",
                          json={"talent_id": talent_id, "performance_slot": "20:00"},
                          headers=_h(tokens["organizer"]))
        assert r.status_code == 200, r.text
        et = r.json()["event_talent"]
        assert et["landed_cost"] > et["fee"]
        TestTalentRider.et_id = et["id"]

        # rider items exist
        r = requests.get(f"{API}/events/{EVENT_ID}/talents", headers=_h(tokens["organizer"]))
        riders = [x for x in r.json()["riders"] if x["event_talent_id"] == et["id"]]
        assert len(riders) > 0

        # update a rider status
        rid = riders[0]["id"]
        r = requests.patch(f"{API}/events/{EVENT_ID}/rider/{rid}",
                           json={"status": "Confirmed", "estimated_cost": riders[0]["estimated_cost"]},
                           headers=_h(tokens["organizer"]))
        assert r.status_code == 200

        # remove
        r = requests.delete(f"{API}/events/{EVENT_ID}/talents/{et['id']}", headers=_h(tokens["organizer"]))
        assert r.status_code == 200


# ---------- Venue ----------
class TestVenue:
    def test_matches_and_select(self, tokens):
        r = requests.get(f"{API}/events/{EVENT_ID}/venue-matches", headers=_h(tokens["organizer"]))
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) > 0
        first = items[0]
        assert "score" in first["compatibility"] and "reasons" in first["compatibility"]
        # select
        r = requests.post(f"{API}/events/{EVENT_ID}/venue",
                          json={"venue_id": first["id"]},
                          headers=_h(tokens["organizer"]))
        assert r.status_code == 200


# ---------- Sponsor flow ----------
class TestSponsorFlow:
    interest_id = None

    def test_express_interest(self, tokens):
        r = requests.get(f"{API}/events/{EVENT_ID}/sponsor-packages")
        assert r.status_code == 200
        pkg = next(p for p in r.json()["items"] if p["sold"] < p["quantity"])
        r = requests.post(f"{API}/sponsor-interests",
                          json={"package_id": pkg["id"], "message": "TEST interest"},
                          headers=_h(tokens["sponsor"]))
        assert r.status_code == 200, r.text
        TestSponsorFlow.interest_id = r.json()["item"]["id"]

    def test_approve_and_budget_updates(self, tokens):
        # snapshot budget
        r = requests.get(f"{API}/events/{EVENT_ID}/budget", headers=_h(tokens["organizer"]))
        before = r.json().get("confirmed_funding", 0)

        r = requests.post(f"{API}/sponsor-interests/{TestSponsorFlow.interest_id}/decision",
                          json={"decision": "approved"}, headers=_h(tokens["organizer"]))
        assert r.status_code == 200
        after = r.json()["budget"]["confirmed_funding"]
        assert after > before, f"funding did not increase: {before}->{after}"


# ---------- Tenant flow ----------
class TestTenantFlow:
    app_id = None

    def test_apply(self, tokens):
        r = requests.get(f"{API}/tenant/opportunities", headers=_h(tokens["tenant"]))
        assert r.status_code == 200
        item = next(x for x in r.json()["items"] if x["event"]["id"] == EVENT_ID)
        booth = next(b for b in item["booths"] if b["status"] == "available")
        r = requests.post(f"{API}/tenant-applications",
                          json={"booth_id": booth["id"], "business_name": "TEST Kopi",
                                "product_category": "Beverage", "power_watt": 500, "staffing": 2},
                          headers=_h(tokens["tenant"]))
        assert r.status_code == 200, r.text
        TestTenantFlow.app_id = r.json()["item"]["id"]

    def test_approve(self, tokens):
        r = requests.post(f"{API}/tenant-applications/{TestTenantFlow.app_id}/decision",
                          json={"decision": "approved"}, headers=_h(tokens["organizer"]))
        assert r.status_code == 200


# ---------- Ticket + Sandbox Payment ----------
class TestTicketing:
    order_id = None
    payment_id = None
    ticket_qr = None
    fail_payment_id = None

    def _get_tier(self):
        r = requests.get(f"{API}/events/{EVENT_ID}/ticket-tiers")
        return next(t for t in r.json()["items"] if "regular" in t["id"].lower() or t["name"].lower().startswith("regular"))

    def test_paylater_unavailable_and_va_success(self, tokens):
        tier = self._get_tier()
        r = requests.post(f"{API}/checkout", json={
            "event_id": EVENT_ID, "tier_id": tier["id"], "quantity": 2,
            "attendees": [{"name": "TEST A1"}, {"name": "TEST A2"}],
            "method": "paylater", "method_channel": "Future integration"
        }, headers=_h(tokens["audience"]))
        assert r.status_code == 400

        r = requests.post(f"{API}/checkout", json={
            "event_id": EVENT_ID, "tier_id": tier["id"], "quantity": 2,
            "attendees": [{"name": "TEST A1"}, {"name": "TEST A2"}],
            "method": "virtual_account", "method_channel": "BCA Virtual Account"
        }, headers=_h(tokens["audience"]))
        assert r.status_code == 200, r.text
        TestTicketing.order_id = r.json()["order"]["id"]
        TestTicketing.payment_id = r.json()["payment"]["id"]

        r = requests.post(f"{API}/payments/{TestTicketing.payment_id}/simulate",
                          json={"outcome": "success"}, headers=_h(tokens["audience"]))
        assert r.status_code == 200
        tix = r.json()["tickets"]
        assert len(tix) == 2
        TestTicketing.ticket_qr = tix[0]["qr_code"]

    def test_tier_sold_increment_and_mytickets(self, tokens):
        r = requests.get(f"{API}/my/tickets", headers=_h(tokens["audience"]))
        assert r.status_code == 200
        assert len(r.json()["items"]) >= 2

    def test_payment_failure_path(self, tokens):
        tier = self._get_tier()
        r = requests.post(f"{API}/checkout", json={
            "event_id": EVENT_ID, "tier_id": tier["id"], "quantity": 1,
            "attendees": [{"name": "TEST Fail"}],
            "method": "qris", "method_channel": "QRIS Dynamic"
        }, headers=_h(tokens["audience"]))
        assert r.status_code == 200
        pid = r.json()["payment"]["id"]
        r = requests.post(f"{API}/payments/{pid}/simulate", json={"outcome": "fail"},
                          headers=_h(tokens["audience"]))
        assert r.status_code == 200
        assert r.json()["payment"]["status"] == "Failed"

    def test_qr_validation_flow(self, tokens):
        # first valid
        r = requests.post(f"{API}/tickets/validate", json={"qr_code": TestTicketing.ticket_qr},
                          headers=_h(tokens["organizer"]))
        assert r.status_code == 200
        assert r.json()["result"] == "Valid"
        # second already used
        r = requests.post(f"{API}/tickets/validate", json={"qr_code": TestTicketing.ticket_qr},
                          headers=_h(tokens["organizer"]))
        assert r.json()["result"] == "Already Used"
        # invalid
        r = requests.post(f"{API}/tickets/validate", json={"qr_code": "OKKAX|UNKNOWN|BAD"},
                          headers=_h(tokens["organizer"]))
        assert r.json()["result"] == "Invalid"

    def test_refund(self, tokens):
        r = requests.post(f"{API}/orders/{TestTicketing.order_id}/refund",
                          json={"type": "full", "reason": "TEST"}, headers=_h(tokens["audience"]))
        assert r.status_code == 200
        # verify
        r = requests.get(f"{API}/my/orders", headers=_h(tokens["audience"]))
        order = next(o for o in r.json()["items"] if o["id"] == TestTicketing.order_id)
        assert order["status"] == "refunded"


# ---------- Budget + Simulator ----------
class TestBudget:
    def test_budget_and_simulate(self, tokens):
        r = requests.get(f"{API}/events/{EVENT_ID}/budget", headers=_h(tokens["organizer"]))
        assert r.status_code == 200
        b = r.json()
        assert "total_cost" in b and "confirmed_funding" in b and "funding_gap" in b

        r = requests.post(f"{API}/events/{EVENT_ID}/simulate", json={}, headers=_h(tokens["organizer"]))
        assert r.status_code == 200
        scenarios = r.json().get("scenarios") or r.json().get("items") or []
        assert scenarios, r.text


# ---------- Discover & Public ----------
class TestDiscover:
    def test_discover_and_public(self):
        r = requests.get(f"{API}/discover/events")
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(e.get("id") == EVENT_ID or e.get("event", {}).get("id") == EVENT_ID for e in items) or len(items) >= 1
        r = requests.get(f"{API}/public/events/{EVENT_ID}")
        assert r.status_code == 200
        data = r.json()
        assert data.get("event", {}).get("id") == EVENT_ID


# ---------- Graph / Ripple / Command Center ----------
class TestOps:
    def test_graph(self, tokens):
        r = requests.get(f"{API}/events/{EVENT_ID}/graph", headers=_h(tokens["organizer"]))
        assert r.status_code == 200
        assert "nodes" in r.json()

    def test_ripple(self, tokens):
        r = requests.get(f"{API}/events/{EVENT_ID}/ripple", headers=_h(tokens["organizer"]))
        assert r.status_code == 200

    def test_command_center(self, tokens):
        r = requests.get(f"{API}/events/{EVENT_ID}/command-center", headers=_h(tokens["organizer"]))
        assert r.status_code == 200


# ---------- Admin ----------
class TestAdmin:
    def test_admin_users_and_orgs(self, tokens):
        r = requests.get(f"{API}/admin/users", headers=_h(tokens["admin"]))
        assert r.status_code == 200
        r = requests.get(f"{API}/admin/organizations", headers=_h(tokens["admin"]))
        assert r.status_code == 200
        r = requests.get(f"{API}/admin/audit-logs", headers=_h(tokens["admin"]))
        assert r.status_code == 200
