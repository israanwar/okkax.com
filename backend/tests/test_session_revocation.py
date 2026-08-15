"""Phase 01 — Server-authoritative revocable session tests.

Covers the acceptance list from the V5 task contract:

- login creates a session row + a JWT whose `sid` claim references it;
- a valid (unrevoked, unexpired) session is accepted by
  `get_current_user`;
- a revoked session is rejected;
- an expired session is rejected;
- a token whose sid belongs to a different user is rejected;
- POST /auth/logout revokes the exact session that authorized the
  request;
- reusing a token after logout is rejected;
- suspension enforcement still runs (defense in depth);
- sid-less tokens (legacy) are rejected — production issuance sites
  never emit them.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pymongo
import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from core import create_access_token  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8001").rstrip("/")
API = f"{BASE_URL}/api"
DEMO_PASSWORD = os.environ["DEMO_PASSWORD"]

_db = pymongo.MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

# Deterministic prefix so cleanup never sweeps peer-suite rows.
TEST_PREFIX = "test-sessrev-"


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


def _seed_session(user_id, *, revoked=False, expires_delta=timedelta(days=7)):
    sid = f"{TEST_PREFIX}{uuid.uuid4()}"
    now = datetime.now(timezone.utc)
    _db.sessions.insert_one({
        "id": sid, "user_id": user_id,
        "issued_at": now.isoformat(),
        "expires_at": (now + expires_delta).isoformat(),
        "revoked_at": now.isoformat() if revoked else None,
    })
    return sid


@pytest.fixture(autouse=True)
def _cleanup():
    _db.sessions.delete_many({"id": {"$regex": f"^{TEST_PREFIX}"}})
    yield
    _db.sessions.delete_many({"id": {"$regex": f"^{TEST_PREFIX}"}})


# ------------------------------------------------------------ login flow

def test_login_creates_session_row_and_sid_claim():
    r = requests.post(f"{API}/auth/login",
                      json={"email": "audience@okkax.id", "password": DEMO_PASSWORD}, timeout=10)
    assert r.status_code == 200, r.text
    tok = r.json()["token"]

    # Decode payload part of the JWT (segment 1) without signature check.
    import base64, json
    payload_b64 = tok.split(".")[1] + "=="
    payload = json.loads(base64.urlsafe_b64decode(payload_b64))
    sid = payload.get("sid")
    assert sid, "login JWT missing sid claim"

    # Row must exist and be unrevoked.
    row = _db.sessions.find_one({"id": sid}, {"_id": 0})
    assert row is not None
    assert row["user_id"] == payload["sub"]
    assert row.get("revoked_at") is None
    # Housekeeping — remove the login's session so it does not pile up.
    _db.sessions.delete_one({"id": sid})


def test_valid_session_accepted_on_protected_endpoint():
    tok = requests.post(f"{API}/auth/login",
                        json={"email": "audience@okkax.id", "password": DEMO_PASSWORD},
                        timeout=10).json()["token"]
    r = requests.get(f"{API}/auth/me", headers=_h(tok), timeout=10)
    assert r.status_code == 200, r.text
    assert r.json()["user"]["email"] == "audience@okkax.id"


# ------------------------------------------------------------ negative paths

def test_revoked_session_rejected():
    sid = _seed_session("usr-4", revoked=True)
    tok = create_access_token("usr-4", "audience@okkax.id", sid=sid)
    r = requests.get(f"{API}/auth/me", headers=_h(tok), timeout=10)
    assert r.status_code == 401, r.text
    assert "revoked" in r.json().get("detail", "").lower()


def test_expired_session_rejected():
    # Session already past its expires_at — JWT signature exp is far
    # in the future because we did not shorten it, so the check that
    # trips is the SESSION expiry, not the JWT expiry.
    sid = _seed_session("usr-4", expires_delta=timedelta(seconds=-30))
    tok = create_access_token("usr-4", "audience@okkax.id", sid=sid)
    r = requests.get(f"{API}/auth/me", headers=_h(tok), timeout=10)
    assert r.status_code == 401, r.text
    assert "expired" in r.json().get("detail", "").lower()


def test_sid_belonging_to_different_user_rejected():
    """Session was issued for user A; token claims user B. Even though
    both the JWT signature and the session row are valid on their own,
    the user-id mismatch blocks the request."""
    sid = _seed_session("usr-4")  # audience
    tok = create_access_token("usr-1", "organizer@okkax.id", sid=sid)  # organizer
    r = requests.get(f"{API}/auth/me", headers=_h(tok), timeout=10)
    assert r.status_code == 401, r.text
    assert "invalid" in r.json().get("detail", "").lower()


def test_sid_missing_from_token_rejected():
    """Legacy JWTs minted before Phase 01 lack `sid`. Production
    issuance no longer emits these; the endpoint must not silently
    accept them."""
    import jwt as _jwt
    payload = {
        "sub": "usr-4", "email": "audience@okkax.id", "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        # deliberately no `sid`
    }
    tok = _jwt.encode(payload, os.environ["JWT_SECRET"], algorithm="HS256")
    r = requests.get(f"{API}/auth/me", headers=_h(tok), timeout=10)
    assert r.status_code == 401, r.text
    assert "session" in r.json().get("detail", "").lower()


def test_nonexistent_sid_rejected():
    tok = create_access_token("usr-4", "audience@okkax.id",
                              sid=f"{TEST_PREFIX}does-not-exist-{uuid.uuid4()}")
    r = requests.get(f"{API}/auth/me", headers=_h(tok), timeout=10)
    assert r.status_code == 401, r.text


# ------------------------------------------------------------ logout

def test_logout_revokes_current_session_and_token_becomes_unusable():
    tok = requests.post(f"{API}/auth/login",
                        json={"email": "audience@okkax.id", "password": DEMO_PASSWORD},
                        timeout=10).json()["token"]
    # Sanity — token works before logout.
    assert requests.get(f"{API}/auth/me", headers=_h(tok), timeout=10).status_code == 200
    # Logout.
    r = requests.post(f"{API}/auth/logout", headers=_h(tok), timeout=10)
    assert r.status_code == 200, r.text
    # Same token must be rejected now (session revoked, no logout-all).
    r2 = requests.get(f"{API}/auth/me", headers=_h(tok), timeout=10)
    assert r2.status_code == 401, r2.text
    assert "revoked" in r2.json().get("detail", "").lower()
    # Cleanup — remove the just-created session row.
    import base64, json
    payload = json.loads(base64.urlsafe_b64decode(tok.split(".")[1] + "=="))
    _db.sessions.delete_one({"id": payload["sid"]})


def test_logout_is_idempotent_within_a_single_session():
    """Second logout with the same (now revoked) token must still 401
    at the auth layer rather than crash — the endpoint only fires when
    the session is still valid."""
    tok = requests.post(f"{API}/auth/login",
                        json={"email": "audience@okkax.id", "password": DEMO_PASSWORD},
                        timeout=10).json()["token"]
    requests.post(f"{API}/auth/logout", headers=_h(tok), timeout=10)
    # Second attempt cannot re-authorize because the sid is revoked;
    # 401 is the correct answer, not 500.
    r = requests.post(f"{API}/auth/logout", headers=_h(tok), timeout=10)
    assert r.status_code == 401, r.text


def test_logout_scoped_to_one_session_not_all_user_sessions():
    """Logging out from token A must NOT revoke a second session token B
    for the same user (no logout-all)."""
    login = lambda: requests.post(  # noqa: E731
        f"{API}/auth/login",
        json={"email": "audience@okkax.id", "password": DEMO_PASSWORD},
        timeout=10,
    ).json()["token"]
    tok_a = login()
    tok_b = login()

    # Revoke A.
    assert requests.post(f"{API}/auth/logout", headers=_h(tok_a), timeout=10).status_code == 200
    # B remains valid.
    r = requests.get(f"{API}/auth/me", headers=_h(tok_b), timeout=10)
    assert r.status_code == 200, r.text

    # Cleanup.
    import base64, json
    for tok in (tok_a, tok_b):
        pl = json.loads(base64.urlsafe_b64decode(tok.split(".")[1] + "=="))
        _db.sessions.delete_one({"id": pl["sid"]})


# ------------------------------------------------------------ layered defenses

def test_suspended_user_with_valid_session_still_denied():
    """Session validation runs BEFORE suspension check, so we prove
    both by seeding an active session for a suspended user."""
    uid = f"{TEST_PREFIX}suspended-user"
    _db.users.delete_one({"id": uid})
    _db.users.insert_one({
        "id": uid, "email": f"{TEST_PREFIX}suspended@okkax.id",
        "password_hash": "unused", "name": "Sess-Susp",
        "roles": ["audience"], "suspended": True, "onboarded": True,
    })
    try:
        sid = _seed_session(uid)
        tok = create_access_token(uid, f"{TEST_PREFIX}suspended@okkax.id", sid=sid)
        r = requests.get(f"{API}/auth/me", headers=_h(tok), timeout=10)
        assert r.status_code == 403, r.text
    finally:
        _db.users.delete_one({"id": uid})
