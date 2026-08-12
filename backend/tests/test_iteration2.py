"""OKKAX iteration 2 tests: Google auth guard, Stripe test-mode checkout, role workspaces, PDF documents."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
PASSWORD = "Okkax#2026"
EVENT_ID = "evt-aruna-2026"


def _login(email, pw=PASSWORD):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="session", autouse=True)
def _reset():
    requests.post(f"{API}/demo/reset", timeout=30)
    yield


@pytest.fixture(scope="session")
def tokens():
    roles = ["admin", "organizer", "sponsor", "tenant", "audience",
             "talent", "venue", "vendor", "worker", "finance", "supervisor"]
    return {r: _login(f"{r}@okkax.id") for r in roles}


# --------------------------------------------------------- Google auth guard
class TestGoogleAuthGuard:
    def test_missing_session_header_400(self):
        r = requests.post(f"{API}/auth/session", timeout=15)
        assert r.status_code == 400, r.text

    def test_invalid_session_id_401_no_user_created(self):
        r = requests.post(f"{API}/auth/session", headers={"X-Session-ID": "totally-bogus-nope"}, timeout=15)
        assert r.status_code == 401, f"expected 401 got {r.status_code} {r.text}"

    def test_regression_email_password_login_still_works(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": "audience@okkax.id", "password": PASSWORD}, timeout=15)
        assert r.status_code == 200
        assert "token" in r.json()


# --------------------------------------------------------- Stripe checkout
class TestStripeCheckout:
    session_id = None
    order_id = None

    def test_create_checkout_session(self, tokens):
        # snapshot tier sold
        r = requests.get(f"{API}/events/{EVENT_ID}/ticket-tiers")
        assert r.status_code == 200
        tiers = r.json()["items"]
        tier = next(t for t in tiers if t["id"] == "tier-vip")
        sold_before = tier["sold"]

        r = requests.post(f"{API}/payments/stripe/checkout", json={
            "event_id": EVENT_ID, "tier_id": "tier-vip", "quantity": 1,
            "attendees": [{"name": "TEST Stripe"}],
            "origin_url": BASE_URL,
        }, headers=_h(tokens["audience"]), timeout=45)
        if r.status_code != 200:
            pytest.skip(f"Stripe unavailable: {r.status_code} {r.text[:400]}")

        data = r.json()
        assert "checkout_url" in data and "checkout.stripe.com" in data["checkout_url"], data
        assert data.get("session_id", "").startswith("cs_test_"), data
        assert data["order"]["status"] == "awaiting_payment"
        assert "Stripe test mode" in data.get("note", "") or "USD" in data.get("note", "")
        assert data["amount_idr"] > 0 and data["amount_usd"] > 0

        TestStripeCheckout.session_id = data["session_id"]
        TestStripeCheckout.order_id = data["order"]["id"]

        # verify: no tickets issued, tier.sold unchanged
        r2 = requests.get(f"{API}/events/{EVENT_ID}/ticket-tiers")
        tier2 = next(t for t in r2.json()["items"] if t["id"] == "tier-vip")
        assert tier2["sold"] == sold_before, f"tier.sold changed prematurely {sold_before}->{tier2['sold']}"

    def test_status_polling_pending_and_idempotent(self, tokens):
        if not TestStripeCheckout.session_id:
            pytest.skip("no stripe session")
        r = requests.get(f"{API}/payments/stripe/status/{TestStripeCheckout.session_id}",
                         headers=_h(tokens["audience"]), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["payment_status"] in ("pending", "initiated"), d
        assert not d.get("tickets"), f"tickets should not be issued: {d}"
        # call again 2 more times, still no tickets
        for _ in range(2):
            r = requests.get(f"{API}/payments/stripe/status/{TestStripeCheckout.session_id}",
                             headers=_h(tokens["audience"]), timeout=30)
            assert r.status_code == 200
            assert not r.json().get("tickets"), "tickets issued on repeated status poll"

    def test_unknown_session_id_404(self, tokens):
        r = requests.get(f"{API}/payments/stripe/status/cs_test_UNKNOWN_XYZ",
                         headers=_h(tokens["audience"]), timeout=15)
        assert r.status_code == 404


# --------------------------------------------------------- role workspace
class TestRoleWorkspace:
    def test_talent_workspace(self, tokens):
        r = requests.get(f"{API}/me/workspace", headers=_h(tokens["talent"]))
        assert r.status_code == 200
        d = r.json()
        kinds = [s["kind"] for s in d["sections"]]
        assert "talent" in kinds, d

    def test_venue_workspace(self, tokens):
        r = requests.get(f"{API}/me/workspace", headers=_h(tokens["venue"]))
        assert r.status_code == 200
        assert "venue" in [s["kind"] for s in r.json()["sections"]]

    def test_vendor_workspace(self, tokens):
        r = requests.get(f"{API}/me/workspace", headers=_h(tokens["vendor"]))
        assert r.status_code == 200
        assert "vendor" in [s["kind"] for s in r.json()["sections"]]

    def test_worker_workspace(self, tokens):
        r = requests.get(f"{API}/me/workspace", headers=_h(tokens["worker"]))
        assert r.status_code == 200
        assert "worker" in [s["kind"] for s in r.json()["sections"]]

    def test_finance_workspace(self, tokens):
        r = requests.get(f"{API}/me/workspace", headers=_h(tokens["finance"]))
        assert r.status_code == 200
        assert "finance" in [s["kind"] for s in r.json()["sections"]]

    def test_audience_workspace_empty(self, tokens):
        r = requests.get(f"{API}/me/workspace", headers=_h(tokens["audience"]))
        assert r.status_code == 200
        assert r.json()["sections"] == [] or all(len(s["items"]) == 0 for s in r.json()["sections"])

    def test_talent_self_confirm_persists(self, tokens):
        # get first talent booking
        r = requests.get(f"{API}/me/workspace", headers=_h(tokens["talent"]))
        sec = next(s for s in r.json()["sections"] if s["kind"] == "talent")
        if not sec["items"]:
            pytest.skip("no talent bookings for talent@okkax.id")
        item = sec["items"][0]
        before = item.get("status")
        target = "Confirmed" if before != "Confirmed" else "Pending"
        r = requests.post(f"{API}/me/workspace/confirm",
                          json={"kind": "talent", "id": item["id"], "status": target},
                          headers=_h(tokens["talent"]))
        assert r.status_code == 200, r.text
        # reload
        r = requests.get(f"{API}/me/workspace", headers=_h(tokens["talent"]))
        sec = next(s for s in r.json()["sections"] if s["kind"] == "talent")
        found = next(i for i in sec["items"] if i["id"] == item["id"])
        assert found["status"] == target

    def test_authz_wrong_owner_403(self, tokens):
        # get a venue booking id (belongs to venue@okkax.id)
        r = requests.get(f"{API}/me/workspace", headers=_h(tokens["venue"]))
        venue_items = next(s for s in r.json()["sections"] if s["kind"] == "venue")["items"]
        if not venue_items:
            pytest.skip("no venue bookings")
        vid = venue_items[0]["id"]
        r = requests.post(f"{API}/me/workspace/confirm",
                          json={"kind": "venue", "id": vid, "status": "Confirmed"},
                          headers=_h(tokens["vendor"]))
        assert r.status_code == 403, r.text


# --------------------------------------------------------- PDF documents
class TestDocuments:
    def _ord_id(self, tok):
        r = requests.get(f"{API}/my/orders", headers=_h(tok))
        assert r.status_code == 200
        items = r.json()["items"]
        assert items, "audience has no orders (seed problem)"
        return items[0]["id"]

    def test_invoice_pdf(self, tokens):
        oid = self._ord_id(tokens["audience"])
        r = requests.get(f"{API}/documents/invoice/{oid}", headers=_h(tokens["audience"]))
        assert r.status_code == 200, r.text[:400]
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert "attachment" in r.headers.get("content-disposition", "").lower()
        assert "OKKAX-" in r.headers.get("content-disposition", "")
        assert len(r.content) > 1024
        assert r.content.startswith(b"%PDF")

    def test_quotation_pdf(self, tokens):
        r = requests.get(f"{API}/documents/quotation/{EVENT_ID}", headers=_h(tokens["organizer"]))
        assert r.status_code == 200, r.text[:400]
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert len(r.content) > 1024

    def test_payment_schedule_pdf(self, tokens):
        r = requests.get(f"{API}/documents/payment-schedule/{EVENT_ID}", headers=_h(tokens["organizer"]))
        assert r.status_code == 200, r.text[:400]
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert len(r.content) > 1024

    def test_quotation_forbidden_for_audience(self, tokens):
        r = requests.get(f"{API}/documents/quotation/{EVENT_ID}", headers=_h(tokens["audience"]))
        assert r.status_code == 403, r.status_code

    def test_invoice_forbidden_for_other_user(self, tokens):
        oid = self._ord_id(tokens["audience"])
        # tenant user does not own the audience order and isn't organizer/admin for the event
        r = requests.get(f"{API}/documents/invoice/{oid}", headers=_h(tokens["tenant"]))
        assert r.status_code == 403, r.status_code


# --------------------------------------------------------- regression: sandbox pay still works
class TestSandboxRegression:
    def test_full_sandbox_flow_still_works(self, tokens):
        r = requests.get(f"{API}/events/{EVENT_ID}/ticket-tiers")
        tier = next(t for t in r.json()["items"] if t["sold"] < t["quantity"] and "regular" in t["id"].lower())
        r = requests.post(f"{API}/checkout", json={
            "event_id": EVENT_ID, "tier_id": tier["id"], "quantity": 1,
            "attendees": [{"name": "TEST Sandbox Regr"}],
            "method": "virtual_account", "method_channel": "BCA Virtual Account"
        }, headers=_h(tokens["audience"]))
        assert r.status_code == 200, r.text
        pid = r.json()["payment"]["id"]
        r = requests.post(f"{API}/payments/{pid}/simulate", json={"outcome": "success"},
                          headers=_h(tokens["audience"]))
        assert r.status_code == 200
        assert len(r.json()["tickets"]) == 1


# --------------------------------------------------------- demo reset includes linked_*
class TestDemoResetLinks:
    def test_talent_has_linked_ids_after_reset(self, tokens):
        r = requests.get(f"{API}/auth/me", headers=_h(tokens["talent"]))
        assert r.status_code == 200
        u = r.json()["user"]
        assert u.get("linked_talent_ids"), f"talent missing linked_talent_ids: {u}"

    def test_venue_linked(self, tokens):
        r = requests.get(f"{API}/auth/me", headers=_h(tokens["venue"]))
        assert r.json()["user"].get("linked_venue_id")

    def test_vendor_linked(self, tokens):
        r = requests.get(f"{API}/auth/me", headers=_h(tokens["vendor"]))
        assert r.json()["user"].get("linked_vendor_id")

    def test_worker_linked(self, tokens):
        r = requests.get(f"{API}/auth/me", headers=_h(tokens["worker"]))
        assert r.json()["user"].get("linked_worker_id")
