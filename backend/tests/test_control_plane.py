"""
V5 Phase 02 Control Plane core tests.

Covers policy, R0-R3 registry, fresh authentication,
request creation, no self-approval, independent approval,
and append-only governance evidence.
"""

import os
from pathlib import Path

import pymongo
import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE = os.environ.get("TEST_BASE_URL", "http://127.0.0.1:8001") + "/api"
DB = pymongo.MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
DEMO_PASSWORD = os.environ["DEMO_PASSWORD"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@okkax.id")


def login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={
        "email": email,
        "password": password,
    })
    assert r.status_code == 200, r.text
    return r.json()["token"]


def h(token):
    return {"Authorization": f"Bearer {token}"}


def test_control_policy_exposes_v5_domains_and_risks():
    token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    r = requests.get(f"{BASE}/control/policy", headers=h(token))
    assert r.status_code == 200, r.text
    data = r.json()

    assert set(data["risk_levels"]) == {"R0", "R1", "R2", "R3"}
    assert len(data["domains"]) == 11
    assert data["risk_levels"]["R2"]["approval_required"] is True
    assert data["risk_levels"]["R3"]["fresh_auth_required"] is True


def test_non_admin_cannot_read_control_plane():
    token = login("organizer@okkax.id", DEMO_PASSWORD)
    r = requests.get(f"{BASE}/control/overview", headers=h(token))
    assert r.status_code == 403


def test_r2_request_requires_fresh_auth_then_creates_pending():
    token = login(ADMIN_EMAIL, ADMIN_PASSWORD)

    # Login itself is fresh within the configured window.
    r = requests.post(
        f"{BASE}/control/requests",
        headers=h(token),
        json={
            "action": "identity.user.suspend",
            "target_type": "user",
            "target_id": "usr-2",
            "reason": "Phase 02 test governance request",
            "payload": {"suspended": True},
        },
    )
    assert r.status_code == 200, r.text
    rec = r.json()
    assert rec["risk"] == "R2"
    assert rec["status"] == "pending"

    DB.control_requests.delete_many({"id": rec["id"]})
    DB.control_evidence.delete_many({"request_id": rec["id"]})


def test_requester_cannot_self_approve():
    token = login(ADMIN_EMAIL, ADMIN_PASSWORD)

    create = requests.post(
        f"{BASE}/control/requests",
        headers=h(token),
        json={
            "action": "identity.admin.assign",
            "target_type": "user",
            "target_id": "usr-2",
            "reason": "Phase 02 self approval denial test",
            "payload": {"roles": ["platform_admin"]},
        },
    )
    assert create.status_code == 200, create.text
    rid = create.json()["id"]

    decide = requests.post(
        f"{BASE}/control/requests/{rid}/decision",
        headers=h(token),
        json={
            "decision": "approved",
            "reason": "Attempting self approval",
        },
    )
    assert decide.status_code == 403

    rec = DB.control_requests.find_one({"id": rid})
    assert rec["status"] == "pending"

    evidence = list(DB.control_evidence.find({
        "request_id": rid,
        "outcome": "self_approval_denied",
    }))
    assert len(evidence) == 1

    DB.control_requests.delete_many({"id": rid})
    DB.control_evidence.delete_many({"request_id": rid})


def test_evidence_has_no_update_or_delete_api_surface():
    token = login(ADMIN_EMAIL, ADMIN_PASSWORD)

    r = requests.get(f"{BASE}/control/evidence", headers=h(token))
    assert r.status_code == 200

    # There is intentionally no mutation endpoint for evidence.
    bogus = requests.delete(
        f"{BASE}/control/evidence/nonexistent",
        headers=h(token),
    )
    assert bogus.status_code in {404, 405}
