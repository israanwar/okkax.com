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


def test_minimal_31_published_events(discover):
    assert discover["total"] >= 31, discover["total"]
    assert len(discover["items"]) == discover["total"]


def test_multi_city_and_category(discover):
    assert len(discover["cities"]) >= 15
    assert len(discover["categories"]) >= 11


def test_no_duplicate_event_ids(discover):
    ids = [e["id"] for e in discover["items"]]
    assert len(ids) == len(set(ids))
    names = [e["name"] for e in discover["items"]]
    assert len(names) == len(set(names))


def test_every_event_has_a_unique_cover_image(discover):
    """Kartu Discover harus memakai koleksi foto unik yang beragam dari katalog."""
    images = [e["hero_image"].split("?", 1)[0] for e in discover["items"]]
    assert all(images)
    assert len(set(images)) >= 30


def test_every_event_uses_an_indonesian_local_cover(discover):
    """Discover harus memakai koleksi visual Indonesia yang terkurasi, bukan stok eksternal."""
    images = [e["hero_image"] for e in discover["items"]]
    assert all(image.startswith("/assets/discover-indonesia/") for image in images)


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
    """Menjalankan seluruh seeder ulang tidak menambah/menduplikasi dokumen."""
    import subprocess
    import sys
    from pymongo import MongoClient

    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "okkax")
    client = MongoClient(mongo_url)
    db = client[db_name]

    collections = ["events", "event_briefs", "ticket_tiers", "event_vendors", "risks"]
    before = {name: db[name].count_documents({}) for name in collections}

    subprocess.run([sys.executable, "seed_data.py", "--force"], check=True, cwd=backend_dir)
    once = {name: db[name].count_documents({}) for name in collections}

    subprocess.run([sys.executable, "seed_data.py", "--force"], check=True, cwd=backend_dir)
    twice = {name: db[name].count_documents({}) for name in collections}

    after = httpx.get(f"{API}/discover/events", timeout=120).json()
    assert once == before
    assert twice == once
    assert after["total"] == discover["total"]
    ids = [e["id"] for e in after["items"]]
    assert len(ids) == len(set(ids))
