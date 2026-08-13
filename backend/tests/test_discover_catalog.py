"""Regresi katalog Discover: minimal 12 event published, idempotent, tanpa duplikat."""
import os
import httpx
import pytest

BASE = os.environ.get("TEST_BASE_URL", "http://localhost:8001")
API = f"{BASE}/api"


@pytest.fixture(scope="module")
def discover():
    r = httpx.get(f"{API}/discover/events", timeout=120)
    assert r.status_code == 200
    return r.json()


def test_minimal_12_published_events(discover):
    assert discover["total"] >= 12, discover["total"]
    assert len(discover["items"]) == discover["total"]


def test_multi_city_and_category(discover):
    assert len(discover["cities"]) >= 8
    assert len(discover["categories"]) >= 6


def test_no_duplicate_event_ids(discover):
    ids = [e["id"] for e in discover["items"]]
    assert len(ids) == len(set(ids))
    names = [e["name"] for e in discover["items"]]
    assert len(names) == len(set(names))


def test_aruna_event_still_present(discover):
    assert any(e["id"] == "evt-aruna-2026" for e in discover["items"])


def test_every_event_has_detail_page(discover):
    for e in discover["items"][:40]:
        r = httpx.get(f"{API}/public/events/{e['id']}", timeout=60)
        assert r.status_code == 200, e["id"]
        assert r.json()["event"]["id"] == e["id"]


def test_events_appear_on_economy_map(discover):
    r = httpx.get(f"{API}/economy/map", timeout=120)
    assert r.status_code == 200
    m = r.json()
    assert m["totals"]["event_count"] == discover["total"]
    assert set(discover["cities"]) == {c["city"] for c in m["cities"]}


def test_filters_and_search_work(discover):
    city = discover["cities"][0]
    r = httpx.get(f"{API}/discover/events", params={"city": city}, timeout=120).json()
    assert r["total"] >= 1 and all(e["city"] == city for e in r["items"])
    cat = discover["categories"][0]
    r = httpx.get(f"{API}/discover/events", params={"category": cat}, timeout=120).json()
    assert r["total"] >= 1 and all(e["event_type"] == cat for e in r["items"])
    word = discover["items"][0]["name"].split()[0]
    r = httpx.get(f"{API}/discover/events", params={"q": word}, timeout=120).json()
    assert r["total"] >= 1


def test_seed_is_idempotent(discover):
    """Menjalankan seeder katalog ulang tidak menambah/menduplikasi event."""
    import asyncio
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
    from seed_events import seed_extra_events

    before = discover["total"]
    asyncio.get_event_loop().run_until_complete(seed_extra_events())
    asyncio.get_event_loop().run_until_complete(seed_extra_events())
    after = httpx.get(f"{API}/discover/events", timeout=120).json()
    assert after["total"] == before
    ids = [e["id"] for e in after["items"]]
    assert len(ids) == len(set(ids))
