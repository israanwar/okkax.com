"""Iteration 6 tests — Discover enrichment, 31 events, 15 cities, sections, filters, economy map, workspace graph, checkout flow."""
import os
import time
import pytest
import requests

def _read_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("REACT_APP_BACKEND_URL not found")


BASE = _read_url().rstrip("/")
API = f"{BASE}/api"
PW = os.environ["DEMO_PASSWORD"]


@pytest.fixture(scope="module")
def organizer_token():
    r = requests.post(f"{API}/auth/login", json={"email": "organizer@okkax.id", "password": PW})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def audience_token():
    r = requests.post(f"{API}/auth/login", json={"email": "audience@okkax.id", "password": PW})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def discover():
    r = requests.get(f"{API}/discover/events")
    assert r.status_code == 200
    return r.json()


# ---- Discover shape & counts ----
class TestDiscoverShape:
    def test_total_31(self, discover):
        assert discover["total"] == 31
        assert len(discover["items"]) == 31

    def test_15_cities(self, discover):
        assert len(discover["cities"]) == 15
        assert discover["totals"]["cities"] == 15

    def test_11_categories(self, discover):
        assert len(discover["categories"]) == 11
        assert discover["totals"]["categories"] == 11

    def test_totals_present(self, discover):
        t = discover["totals"]
        for k in ("events", "cities", "categories", "economic_ripple", "tickets_sold"):
            assert k in t, f"totals missing {k}"
        assert t["events"] == 31

    def test_highlights_sections(self, discover):
        h = discover["highlights"]
        for k in ("live", "this_week", "almost_sold_out", "top_impact"):
            assert k in h, f"highlights missing {k}"
            assert isinstance(h[k], list)
        assert len(h["top_impact"]) >= 1

    def test_event_enrichment_fields(self, discover):
        need = {"sold_percentage", "headline_talent", "talent_count", "tenant_count",
                "vendor_count", "sponsor_slots", "sponsor_sold", "economic_ripple",
                "is_live", "days_to_event", "this_week", "organizer_name", "event_type",
                "min_price", "max_price"}
        for ev in discover["items"]:
            missing = need - set(ev.keys())
            assert not missing, f"event {ev.get('id')} missing {missing}"


# ---- Filters ----
class TestDiscoverFilters:
    def test_city_filter(self):
        r = requests.get(f"{API}/discover/events", params={"city": "Bandung"})
        d = r.json()
        assert d["total"] >= 1
        assert all(e["city"] == "Bandung" for e in d["items"])

    def test_category_filter(self):
        r = requests.get(f"{API}/discover/events", params={"category": "Esports"})
        d = r.json()
        assert d["total"] >= 1
        assert all("Esports" in (e.get("event_type") or "") for e in d["items"])

    def test_free_true(self):
        r = requests.get(f"{API}/discover/events", params={"free": "true"})
        d = r.json()
        for e in d["items"]:
            assert e["min_price"] == 0

    def test_free_false(self):
        r = requests.get(f"{API}/discover/events", params={"free": "false"})
        d = r.json()
        assert d["total"] >= 1
        for e in d["items"]:
            assert e["min_price"] > 0

    def test_text_search(self):
        r = requests.get(f"{API}/discover/events", params={"q": "fashion"})
        d = r.json()
        assert d["total"] >= 1
        for e in d["items"]:
            assert "fashion" in e["name"].lower()


# ---- Economy map ----
class TestEconomyMap:
    def test_map_15_cities_31_events(self):
        r = requests.get(f"{API}/economy/map")
        assert r.status_code == 200
        d = r.json()
        assert len(d["cities"]) == 15
        assert d["totals"]["event_count"] == 31
        assert d["totals"]["cities"] == 15
        # each city has lat/lng and event_count
        for c in d["cities"]:
            assert isinstance(c["lat"], (int, float))
            assert isinstance(c["lng"], (int, float))
            assert c["event_count"] >= 1


# ---- Public bulk event ----
class TestBulkPublicEvent:
    def test_public_event_loads(self):
        r = requests.get(f"{API}/public/events/evt-b-nusantara-sound-fest")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["event"]["id"] == "evt-b-nusantara-sound-fest"
        assert len(d["tiers"]) >= 1
        assert len(d["talents"]) >= 1


# ---- Ticket checkout end-to-end on a bulk event ----
class TestCheckoutBulkEvent:
    def test_checkout_and_pay(self, audience_token):
        # find a tier
        pd = requests.get(f"{API}/public/events/evt-b-nusantara-sound-fest").json()
        tier = pd["tiers"][0]
        h = {"Authorization": f"Bearer {audience_token}"}
        r = requests.post(f"{API}/checkout", json={
            "event_id": "evt-b-nusantara-sound-fest",
            "tier_id": tier["id"],
            "quantity": 1,
            "buyer_name": "TEST_Iter6 Buyer",
            "buyer_email": "test_iter6@example.com",
            "buyer_phone": "081200000000",
            "method": "bank_transfer",
            "method_channel": "bca",
        }, headers=h)
        assert r.status_code == 200, r.text
        order = r.json()
        pid = order["payment"]["id"]
        # simulate payment
        r2 = requests.post(f"{API}/payments/{pid}/simulate", headers=h)
        assert r2.status_code == 200, r2.text


# ---- Workspace graph on a bulk event ----
class TestBulkEventGraph:
    def test_graph_authed(self, organizer_token):
        h = {"Authorization": f"Bearer {organizer_token}"}
        r = requests.get(f"{API}/events/evt-b-nusantara-sound-fest/graph", headers=h)
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d.get("nodes", [])) >= 3
        assert isinstance(d.get("edges", []), list)


# ---- Regression: persona login ----
class TestPersonaLogin:
    @pytest.mark.parametrize("label", ["Penyelenggara", "Sponsor", "Tenant", "Pengunjung", "Supervisor"])
    def test_persona(self, label):
        r = requests.post(f"{API}/demo/persona-login", json={"label": label})
        assert r.status_code == 200, f"{label}: {r.text}"
        assert "token" in r.json()

    def test_persona_admin_forbidden(self):
        r = requests.post(f"{API}/demo/persona-login", json={"label": "Administrator"})
        assert r.status_code in (400, 403)


# ---- Stripe checkout endpoint accessible ----
@pytest.mark.skipif(not os.environ.get("STRIPE_API_KEY"), reason="requires Stripe test credentials")
class TestStripe:
    def test_stripe_checkout_endpoint(self, audience_token):
        h = {"Authorization": f"Bearer {audience_token}"}
        pd = requests.get(f"{API}/public/events/evt-b-nusantara-sound-fest").json()
        tier = pd["tiers"][0]
        r2 = requests.post(f"{API}/payments/stripe/checkout", json={
            "event_id": "evt-b-nusantara-sound-fest",
            "tier_id": tier["id"],
            "quantity": 1,
            "buyer_name": "TEST_Iter6 Stripe",
            "buyer_email": "test_iter6b@example.com",
            "buyer_phone": "081200000001",
            "origin_url": BASE,
        }, headers=h)
        assert r2.status_code in (200, 201), r2.text
        d = r2.json()
        assert "checkout_url" in d


# ---- AI engines ----
class TestAIEngines:
    def test_engines_list(self):
        r = requests.get(f"{API}/ai/engines")
        assert r.status_code == 200
        d = r.json()
        assert len(d.get("engines", d) if isinstance(d, dict) else d) >= 1
