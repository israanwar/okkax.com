"""Suspended account enforcement tests (STEP 2).

Verifies enforcement is centralized in `ensure_account_active` and applied at
every auth entry point:
- normal password login  (POST /api/auth/login)
- JWT verification       (dependency `get_current_user`)
- persona quick login    (POST /api/demo/persona-login)

Hits the RUNNING backend on `TEST_BASE_URL` via httpx (same integration
pattern as test_iteration*/test_discover_catalog). This avoids the motor
event-loop juggling that plagues TestClient + real DB mixes and matches how
the endpoints are called in production.
"""

import os
from pathlib import Path

import httpx
import pymongo
import pytest
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from core import SUSPENDED_MESSAGE, create_access_token, ensure_account_active, hash_password  # noqa: E402

BASE = os.environ.get("TEST_BASE_URL", "http://127.0.0.1:8001").rstrip("/")
API = f"{BASE}/api"

# Sync client for fixture setup/teardown — never inside a request path.
_sync_client = pymongo.MongoClient(os.environ["MONGO_URL"])
_sync_db = _sync_client[os.environ["DB_NAME"]]

TEST_PASSWORD = "step2-test-password-123"
ACTIVE_ID = "test-step2-active"
SUSPENDED_ID = "test-step2-suspended"
ACTIVE_EMAIL = "step2-active@example.com"
SUSPENDED_EMAIL = "step2-suspended@example.com"


def _make_doc(*, user_id, email, suspended):
    return {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(TEST_PASSWORD),
        "name": "Step2 Test User",
        "roles": ["audience"],
        "suspended": suspended,
        "onboarded": True,
        "org_id": None,
        "created_at": "2026-01-01T00:00:00Z",
    }


@pytest.fixture(scope="module", autouse=True)
def _seed_users():
    ids = [ACTIVE_ID, SUSPENDED_ID]
    emails = [ACTIVE_EMAIL, SUSPENDED_EMAIL]
    _sync_db.users.delete_many({"id": {"$in": ids}})
    _sync_db.users.delete_many({"email": {"$in": emails}})
    _sync_db.login_attempts.delete_many({"identifier": {"$in": emails}})
    _sync_db.users.insert_one(_make_doc(user_id=ACTIVE_ID, email=ACTIVE_EMAIL, suspended=False))
    _sync_db.users.insert_one(_make_doc(user_id=SUSPENDED_ID, email=SUSPENDED_EMAIL, suspended=True))
    yield
    _sync_db.users.delete_many({"id": {"$in": ids}})
    _sync_db.login_attempts.delete_many({"identifier": {"$in": emails}})


# ------------------------------------------------------------ pure helper unit

def test_ensure_account_active_raises_403_for_suspended():
    with pytest.raises(HTTPException) as info:
        ensure_account_active({"id": "x", "suspended": True})
    assert info.value.status_code == 403
    assert info.value.detail == SUSPENDED_MESSAGE


def test_ensure_account_active_ignores_missing_flag():
    ensure_account_active({"id": "x"})
    ensure_account_active({"id": "x", "suspended": False})
    ensure_account_active(None)


# ------------------------------------------------------------ /auth/login

def test_login_allowed_for_active_user():
    r = httpx.post(f"{API}/auth/login",
                   json={"email": ACTIVE_EMAIL, "password": TEST_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("token")
    assert body["user"]["email"] == ACTIVE_EMAIL


def test_login_denied_for_suspended_user():
    r = httpx.post(f"{API}/auth/login",
                   json={"email": SUSPENDED_EMAIL, "password": TEST_PASSWORD}, timeout=30)
    assert r.status_code == 403, r.text
    assert r.json().get("detail") == SUSPENDED_MESSAGE


def test_login_wrong_password_still_returns_401_not_403():
    """Suspended check runs AFTER password verify: wrong password stays 401 so
    attackers cannot enumerate suspended accounts via response code."""
    r = httpx.post(f"{API}/auth/login",
                   json={"email": SUSPENDED_EMAIL, "password": "definitely-wrong"}, timeout=30)
    assert r.status_code == 401, r.text
    _sync_db.login_attempts.delete_many({"identifier": SUSPENDED_EMAIL})


# ------------------------------------------------------------ /auth/me (JWT dep)

def test_authenticated_active_user_allowed_on_protected_endpoint():
    token = create_access_token(ACTIVE_ID, ACTIVE_EMAIL)
    r = httpx.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["user"]["email"] == ACTIVE_EMAIL


def test_authenticated_suspended_user_denied_on_protected_endpoint():
    token = create_access_token(SUSPENDED_ID, SUSPENDED_EMAIL)
    r = httpx.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r.status_code == 403, r.text
    assert r.json().get("detail") == SUSPENDED_MESSAGE


def test_authenticated_suspended_user_denied_on_notifications_endpoint():
    """Enforcement lives in get_current_user, so every dependency-user endpoint
    gets it for free."""
    token = create_access_token(SUSPENDED_ID, SUSPENDED_EMAIL)
    r = httpx.post(f"{API}/notifications/read",
                   headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r.status_code == 403, r.text
    assert r.json().get("detail") == SUSPENDED_MESSAGE


# ------------------------------------------------------------ persona login

def test_persona_login_denied_for_suspended_persona():
    """Temporarily suspend the organizer persona; endpoint must return 403."""
    _sync_db.users.update_one({"email": "organizer@okkax.id"}, {"$set": {"suspended": True}})
    try:
        r = httpx.post(f"{API}/demo/persona-login",
                       json={"label": "Penyelenggara"}, timeout=30)
    finally:
        _sync_db.users.update_one({"email": "organizer@okkax.id"}, {"$set": {"suspended": False}})
    assert r.status_code == 403, r.text
    assert r.json().get("detail") == SUSPENDED_MESSAGE


def test_persona_login_still_works_for_active_persona():
    _sync_db.users.update_one({"email": "organizer@okkax.id"}, {"$set": {"suspended": False}})
    r = httpx.post(f"{API}/demo/persona-login",
                   json={"label": "Penyelenggara"}, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json().get("token")
