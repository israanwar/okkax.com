"""Iteration 5 backend tests — AI engines, multi-event seed, event graph, compile flow."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL missing"
API = f"{BASE_URL}/api"

NEW_EVENT_IDS = [
    "evt-nusa-tech", "evt-bandung-indie", "evt-surabaya-expo",
    "evt-jogja-kuliner", "evt-bali-fashion", "evt-medan-startup",
    "evt-jkt-esports", "evt-semarang-umkm",
]


@pytest.fixture(scope="module")
def organizer_token():
    r = requests.post(f"{API}/auth/login", json={
        "email": "organizer@okkax.id", "password": os.environ["DEMO_PASSWORD"]})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def audience_token():
    r = requests.post(f"{API}/auth/login", json={
        "email": "audience@okkax.id", "password": os.environ["DEMO_PASSWORD"]})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def org_headers(organizer_token):
    return {"Authorization": f"Bearer {organizer_token}"}


# ------------- AI engines
class TestAIEngines:
    def test_engines_list(self):
        r = requests.get(f"{API}/ai/engines")
        assert r.status_code == 200
        data = r.json()
        # Accept either dict {engines:[...], default:...} or list
        engines = data.get("engines") if isinstance(data, dict) else data
        assert engines and len(engines) == 5, f"expected 5, got {len(engines) if engines else 0}: {data}"
        ids = [e.get("id") or e.get("model") for e in engines]
        assert any("gpt-5.4" in str(i) for i in ids), ids
        assert any("claude" in str(i) for i in ids), ids
        if isinstance(data, dict) and "default" in data:
            assert "gpt-5.4" in data["default"]


# ------------- Discover events (public)
class TestDiscoverEvents:
    def test_events_count_cities(self):
        r = requests.get(f"{API}/discover/events")
        assert r.status_code == 200
        data = r.json()
        events = data.get("items") or data.get("events") if isinstance(data, dict) else data
        assert len(events) >= 9, f"expected >=9 events, got {len(events)}"
        cities = {e.get("city") for e in events}
        expected_cities = {"Jakarta", "Bandung", "Surabaya", "Yogyakarta", "Denpasar", "Medan", "Semarang", "Makassar"}
        missing = expected_cities - cities
        assert not missing, f"missing cities: {missing}. Got: {cities}"
        cats = {e.get("category") or e.get("event_type") for e in events}
        assert len(cats) >= 8, f"expected >=8 categories, got {len(cats)}: {cats}"

    def test_events_have_tickets(self):
        r = requests.get(f"{API}/discover/events").json()
        events = r.get("items") or r.get("events") if isinstance(r, dict) else r
        by_id = {e.get("id") or e.get("event_id"): e for e in events}
        for eid in NEW_EVENT_IDS:
            assert eid in by_id, f"event {eid} missing from discover"
            e = by_id[eid]
            tiers = e.get("ticket_tiers") or e.get("tiers") or []
            assert len(tiers) >= 1, f"{eid} has no ticket tiers"
            for t in tiers:
                assert (t.get("price") or 0) >= 0
                assert "sold" in t or "available" in t or "quantity" in t


# ------------- Event graph
class TestEventGraph:
    @pytest.mark.parametrize("eid", NEW_EVENT_IDS)
    def test_graph(self, eid, org_headers):
        r = requests.get(f"{API}/events/{eid}/graph", headers=org_headers)
        assert r.status_code == 200, f"{eid}: {r.status_code} {r.text[:200]}"
        d = r.json()
        assert "nodes" in d and "edges" in d
        assert len(d["nodes"]) >= 1
        assert "readiness_score" in d
        assert "status_counts" in d


# ------------- Compile flow with gpt-5.4-mini
class TestCompile:
    def test_compile_and_poll(self, org_headers):
        eid = "evt-nusa-tech"
        r = requests.post(f"{API}/events/{eid}/compile?engine=gpt-5.4-mini", headers=org_headers)
        assert r.status_code in (200, 201, 202), r.text
        initial = r.json().get("blueprint") or {}
        assert initial.get("ai_engine"), f"missing ai_engine in compile response: {initial}"
        assert initial.get("ai_vendor")
        # Poll blueprint
        final = None
        for _ in range(30):
            time.sleep(3)
            b = requests.get(f"{API}/events/{eid}/blueprint", headers=org_headers)
            if b.status_code != 200:
                continue
            bj = b.json().get("blueprint") or {}
            status = bj.get("ai_status")
            if status in ("done", "ready", "completed", "error", "fallback"):
                final = bj
                break
            if bj.get("ai_error"):
                final = bj
                break
        assert final is not None, "blueprint never resolved"
        assert final.get("ai_engine") or final.get("source"), f"missing engine info: {list(final.keys())}"


# ------------- Ticket purchase on a new event
class TestNewEventTicketPurchase:
    def test_end_to_end(self, audience_token):
        h = {"Authorization": f"Bearer {audience_token}"}
        eid = "evt-bandung-indie"
        # get tiers
        r = requests.get(f"{API}/discover/events")
        rj = r.json()
        events = rj.get("items") or rj.get("events") if isinstance(rj, dict) else rj
        ev = next(e for e in events if (e.get("id") or e.get("event_id")) == eid)
        tiers = ev.get("ticket_tiers") or ev.get("tiers") or []
        assert tiers, "no tiers"
        tier = tiers[0]
        tier_id = tier.get("id") or tier.get("tier_id")
        # checkout
        payload = {"event_id": eid, "tier_id": tier_id, "quantity": 1,
                   "method": "card", "method_channel": "Kartu Kredit (sandbox)",
                   "attendees": [{"name": "TEST_Iter5 Buyer"}]}
        r = requests.post(f"{API}/checkout", json=payload, headers=h)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        pay_id = body["payment"]["id"]
        # simulate paid
        sim = requests.post(f"{API}/payments/{pay_id}/simulate", json={"outcome": "success"}, headers=h)
        assert sim.status_code == 200, sim.text
        tickets = sim.json().get("tickets") or []
        assert len(tickets) >= 1, "no tickets issued"
        assert tickets[0].get("qr_code")
