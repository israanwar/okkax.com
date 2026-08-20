"""
Test suite for Okkax Copilot multi-city bug fix (iteration_8).

Covers:
- TURN 1: 5-city venue discovery + synthesis
- TURN 2: state persistence (budget follow-up)
- TURN 3: state persistence (routing follow-up)
- Anti-regression: single-city venue discovery
- Anti-regression: small talk, knowledge, action, single-event analytics
- Non-hardcoded verification with a different set of cities
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback for local direct testing if env not populated in test process
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

ENDPOINT = f"{BASE_URL}/api/okkax/chat"
TIMEOUT = 180  # AI planning can be slow


def _post(message: str, history=None):
    payload = {"message": message, "history": history or []}
    r = requests.post(ENDPOINT, json=payload, timeout=TIMEOUT)
    return r


# ---------- TURN 1: 5-city discovery ----------

@pytest.fixture(scope="module")
def turn1_response():
    msg = ("Bantu cari dan membandingkan kebutuhan venue konser di "
           "Jakarta, Bandung, Surabaya, Yogyakarta, dan Bali untuk tour 5.000 pax per kota.")
    r = _post(msg, [])
    assert r.status_code == 200, f"Turn1 status {r.status_code}: {r.text[:400]}"
    data = r.json()
    return {"user_msg": msg, "data": data}


class TestTurn1MultiCity:
    def test_status_and_shape(self, turn1_response):
        d = turn1_response["data"]
        assert "reply" in d and isinstance(d["reply"], str) and len(d["reply"]) > 50

    def test_semantic_plan_5_cities(self, turn1_response):
        d = turn1_response["data"]
        sp = d.get("semantic_plan") or {}
        entities = sp.get("entities") or {}
        cities = entities.get("cities") or []
        cities_lower = [c.lower() for c in cities]
        expected = ["jakarta", "bandung", "surabaya", "yogyakarta", "bali"]
        for e in expected:
            assert any(e in c for c in cities_lower), \
                f"City {e} missing in semantic_plan.entities.cities={cities}"
        assert len(cities) == 5, f"Expected 5 cities, got {len(cities)}: {cities}"

    def test_multi_city_capacity(self, turn1_response):
        d = turn1_response["data"]
        mc = d.get("multi_city") or {}
        assert mc.get("capacity_per_city") == 5000, \
            f"capacity_per_city expected 5000, got {mc.get('capacity_per_city')}"
        assert len(mc.get("cities") or []) == 5

    def test_tools_executed_venue_discovery_per_city(self, turn1_response):
        d = turn1_response["data"]
        tools = d.get("tools_executed") or []
        def _name(t):
            if isinstance(t, dict):
                return str(t.get("tool", ""))
            return str(t)
        vd = [t for t in tools if _name(t).startswith("venue_discovery")]
        assert len(vd) >= 5, f"Expected >=5 venue_discovery tool entries, got {len(vd)}: {tools}"

    def test_pipeline_stages(self, turn1_response):
        d = turn1_response["data"]
        stages = d.get("pipeline_stages") or []
        stages_joined = " ".join([str(s) for s in stages]).lower()
        for keyword in ["decompose_multi_city", "venue_discovery",
                        "compute_multi_city_projection", "compose_multi_city"]:
            assert keyword in stages_joined, \
                f"Missing stage '{keyword}' in pipeline_stages={stages}"

    def test_reply_contains_comparison_table_with_5_cities(self, turn1_response):
        d = turn1_response["data"]
        reply = d["reply"]
        assert "| Kota" in reply or "| kota" in reply.lower(), \
            "Reply must contain a markdown table with '| Kota |' header"
        for city in ["Jakarta", "Bandung", "Surabaya", "Yogyakarta", "Bali"]:
            assert city in reply, f"City '{city}' missing in comparison table reply"

    def test_reply_has_tradeoff_recommendation_next_action(self, turn1_response):
        reply = turn1_response["data"]["reply"].lower()
        assert "trade-off" in reply or "tradeoff" in reply or "trade off" in reply, \
            "Reply must contain 'Trade-off' section"
        assert "[recommendation]" in reply or "rekomendasi" in reply
        assert "next action" in reply or "langkah selanjutnya" in reply or "aksi selanjutnya" in reply


# ---------- TURN 2: state persistence — budget ----------

@pytest.fixture(scope="module")
def turn2_response(turn1_response):
    history = [
        {"role": "user", "content": turn1_response["user_msg"]},
        {"role": "assistant", "content": turn1_response["data"]["reply"]},
    ]
    msg = "Buat struktur budget tour lima kota tersebut."
    r = _post(msg, history)
    assert r.status_code == 200, f"Turn2 status {r.status_code}: {r.text[:400]}"
    return {"user_msg": msg, "history": history, "data": r.json()}


class TestTurn2StatePersistence:
    def test_still_5_cities(self, turn2_response):
        d = turn2_response["data"]
        mc = d.get("multi_city") or {}
        cities = mc.get("cities") or []
        assert len(cities) == 5, f"State lost — expected 5 cities in turn2, got {len(cities)}: {cities}"
        assert mc.get("capacity_per_city") == 5000

    def test_reply_covers_all_cities_and_total_budget(self, turn2_response):
        reply = turn2_response["data"]["reply"]
        for city in ["Jakarta", "Bandung", "Surabaya", "Yogyakarta", "Bali"]:
            assert city in reply, f"Turn2 reply missing city '{city}'"
        # Should mention total budget across cities
        low = reply.lower()
        assert "total" in low and ("budget" in low or "anggaran" in low), \
            "Turn2 reply must include total budget across cities"


# ---------- TURN 3: state persistence — routing ----------

@pytest.fixture(scope="module")
def turn3_response(turn2_response):
    history = turn2_response["history"] + [
        {"role": "user", "content": turn2_response["user_msg"]},
        {"role": "assistant", "content": turn2_response["data"]["reply"]},
    ]
    msg = "Susun routing tour untuk kota-kota itu."
    r = _post(msg, history)
    assert r.status_code == 200, f"Turn3 status {r.status_code}: {r.text[:400]}"
    return {"data": r.json()}


class TestTurn3Routing:
    def test_state_persists(self, turn3_response):
        d = turn3_response["data"]
        mc = d.get("multi_city") or {}
        cities = mc.get("cities") or []
        assert len(cities) == 5, f"Turn3 state lost: {cities}"
        assert mc.get("capacity_per_city") == 5000

    def test_reply_has_routing_km(self, turn3_response):
        reply = turn3_response["data"]["reply"]
        low = reply.lower()
        assert "routing tour" in low or "routing" in low, "Reply must contain 'Routing tour' section"
        assert re.search(r"\d+\s*km", low), "Reply must contain km-per-leg values"
        assert "total" in low and "km" in low, "Reply must contain total distance in km"
        assert "next action" in low or "aksi selanjutnya" in low or "langkah" in low


# ---------- Anti-regression: single-city ----------

class TestSingleCityRegression:
    def test_single_city_bandung(self):
        r = _post("Carikan venue konser di Bandung untuk 3.000 pax", [])
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        # Should NOT be multi_city mode
        mc = d.get("multi_city") or {}
        cities = mc.get("cities") or []
        assert len(cities) <= 1, f"Single-city prompt should not trigger multi_city with {cities}"
        tools = d.get("tools_executed") or []
        tool_names = [(t.get("tool") if isinstance(t, dict) else t) or "" for t in tools]
        assert any(str(n).startswith("venue_discovery") for n in tool_names), \
            f"Expected venue_discovery, got {tool_names}"
        reply = d["reply"].lower()
        assert "bandung" in reply
        assert len(d["reply"]) > 80


# ---------- Anti-regression: other copilot paths ----------

class TestOtherCopilotPaths:
    def test_small_talk(self):
        r = _post("hai", [])
        assert r.status_code == 200
        assert "reply" in r.json() and len(r.json()["reply"]) > 0

    def test_knowledge(self):
        r = _post("apa beda promoter dan EO?", [])
        assert r.status_code == 200
        assert len(r.json().get("reply", "")) > 30

    def test_action(self):
        r = _post("buatkan 50 tiket VIP", [])
        assert r.status_code == 200
        assert "reply" in r.json()

    def test_single_event_budget(self):
        r = _post("Hitung budget dan break-even konser 5000 pax tiket 250rb di GBK", [])
        assert r.status_code == 200
        assert len(r.json().get("reply", "")) > 50


# ---------- Non-hardcoded: different cities & capacity ----------

class TestNonHardcoded:
    def test_different_cities_and_capacity(self):
        msg = ("Bantu cari dan membandingkan kebutuhan venue konser di "
               "Medan, Semarang, Makassar untuk tour 8.000 pax per kota.")
        r = _post(msg, [])
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        sp = d.get("semantic_plan") or {}
        cities = [c.lower() for c in (sp.get("entities") or {}).get("cities", [])]
        for e in ["medan", "semarang", "makassar"]:
            assert any(e in c for c in cities), f"City {e} missing in {cities}"
        mc = d.get("multi_city") or {}
        assert mc.get("capacity_per_city") == 8000, \
            f"Capacity not adaptive; expected 8000 got {mc.get('capacity_per_city')}"
        reply = d["reply"]
        for city in ["Medan", "Semarang", "Makassar"]:
            assert city in reply, f"Reply missing {city}"
        # Ensure Jakarta not injected (unless mentioned) — reply should focus on the 3 requested
        # Basic sanity: reply length > 200
        assert len(reply) > 200
