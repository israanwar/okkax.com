"""Phase 06B/C — Compliance evidence/decision lifecycle + readiness propagation.

Covers:
* F6B state machine (draft/submitted/issued/rejected/revoked/expired), pure
* F6B evidence append API (organizer, tenant-scoped, audit)
* F6B decision API (admin-only, reason required for reject/revoke, illegal transitions blocked)
* F6C coverage_status roll-up (empty/in_progress/partial/complete/blocked)
* F6C graph node injection + public readiness flags
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
API = "http://127.0.0.1:8001/api"
PW = os.environ.get("DEMO_PASSWORD", "DPOqsn1PJS1ATka0oagr8LCi")
ADMIN_PW = os.environ.get("ADMIN_PASSWORD", "gh8t6P_c1U_yFxy3uPv0cRf0")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin.local@okkax.id")

# Isolate the lifecycle scratch event: wipe its compliance rows before any
# test runs so the state machine tests start from a deterministic baseline
# regardless of previous runs. LOCKED Admission/Ticketing state is not
# touched — only the derived `event_compliance` collection for the one
# scratch event used by this suite. Executed in a subprocess so the async
# motor client, event loop, and any module import side-effects live in a
# separate interpreter and cannot leak into the pytest session (some
# in-process TestClient tests are sensitive to event-loop replacement).
_SCRATCH_EVENT_ID = "evt-b-nusantara-sound-fest"


@pytest.fixture(scope="module", autouse=True)
def _reset_scratch_event_compliance():
    backend_dir = str(Path(__file__).resolve().parents[1])
    script = (
        "import asyncio, sys; sys.path.insert(0, r'" + backend_dir + "');\n"
        "from core import db\n"
        "async def w():\n"
        "    await db.event_compliance.delete_many({'event_id': '" + _SCRATCH_EVENT_ID + "'})\n"
        "asyncio.run(w())\n"
    )
    subprocess.run(
        [sys.executable, "-c", script],
        check=False,
        capture_output=True,
        env={**os.environ},
        timeout=15,
    )
    yield


def _login(email, pw=PW):
    if "admin" in email:
        pw = ADMIN_PW
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def tokens():
    return {
        "organizer": _login("organizer@okkax.id"),
        "audience": _login("audience@okkax.id"),
        "tenant": _login("tenant@okkax.id"),
        "admin": _login(ADMIN_EMAIL),
    }


# ---------- Pure state-machine ----------
def test_transitions_allowed_matrix():
    from compliance_engine import (
        is_transition_allowed,
        STATUS_NOT_CONFIGURED, STATUS_DRAFT, STATUS_SUBMITTED,
        STATUS_ISSUED, STATUS_REJECTED, STATUS_REVOKED, STATUS_EXPIRED,
    )
    assert is_transition_allowed(STATUS_NOT_CONFIGURED, STATUS_DRAFT)
    assert is_transition_allowed(STATUS_NOT_CONFIGURED, STATUS_SUBMITTED)
    assert is_transition_allowed(STATUS_DRAFT, STATUS_SUBMITTED)
    assert is_transition_allowed(STATUS_SUBMITTED, STATUS_ISSUED)
    assert is_transition_allowed(STATUS_SUBMITTED, STATUS_REJECTED)
    assert is_transition_allowed(STATUS_REJECTED, STATUS_SUBMITTED)
    assert is_transition_allowed(STATUS_ISSUED, STATUS_REVOKED)
    # Illegal
    assert not is_transition_allowed(STATUS_ISSUED, STATUS_DRAFT)
    assert not is_transition_allowed(STATUS_ISSUED, STATUS_SUBMITTED)
    assert not is_transition_allowed(STATUS_REVOKED, STATUS_ISSUED)
    assert not is_transition_allowed(STATUS_EXPIRED, STATUS_ISSUED)
    assert not is_transition_allowed(STATUS_NOT_CONFIGURED, STATUS_ISSUED)  # skip submission
    assert not is_transition_allowed(STATUS_DRAFT, STATUS_ISSUED)  # skip submission


def test_coverage_status_rollup():
    from compliance_engine import (
        compute_coverage_status,
        STATUS_ISSUED, STATUS_DRAFT, STATUS_SUBMITTED, STATUS_REJECTED, STATUS_NOT_CONFIGURED,
    )
    assert compute_coverage_status([]) == "not_configured"
    assert compute_coverage_status([{"status": STATUS_NOT_CONFIGURED}]) == "not_configured"
    assert compute_coverage_status([{"status": STATUS_DRAFT}, {"status": STATUS_SUBMITTED}]) == "in_progress"
    assert compute_coverage_status([{"status": STATUS_ISSUED}, {"status": STATUS_SUBMITTED}]) == "partial"
    assert compute_coverage_status([{"status": STATUS_ISSUED}, {"status": STATUS_ISSUED}]) == "complete"
    assert compute_coverage_status([{"status": STATUS_ISSUED}, {"status": STATUS_REJECTED}]) == "blocked"


def test_summarize_for_graph_maps_to_status_labels():
    from compliance_engine import summarize_compliance_for_graph, STATUS_ISSUED, STATUS_REJECTED
    s = summarize_compliance_for_graph([{"status": STATUS_ISSUED}])
    assert s["graph_status"] == "Confirmed"
    assert s["counts"][STATUS_ISSUED] == 1
    s2 = summarize_compliance_for_graph([{"status": STATUS_REJECTED}])
    assert s2["graph_status"] == "At Risk"


# ---------- API — evidence ----------
def _fresh_item_for_event(tokens, event_id):
    """Return an item id that is currently in not_configured/draft state.
    Uses the first not-yet-issued item; safe across repeated runs because
    tests progress items forward without teardown, and the compliance
    endpoint always exposes every derived item."""
    r = requests.get(f"{API}/events/{event_id}/compliance", headers=_h(tokens["organizer"]))
    assert r.status_code == 200
    for it in r.json()["items"]:
        if it["status"] in ("not_configured", "draft", "rejected"):
            return it
    return r.json()["items"][0]


def test_evidence_requires_auth():
    r = requests.post(f"{API}/events/evt-b-nusantara-sound-fest/compliance/xxx/evidence", json={"note": "x"})
    assert r.status_code in (401, 403)


def test_evidence_rejects_cross_tenant(tokens):
    r = requests.get(f"{API}/events/evt-b-nusantara-sound-fest/compliance", headers=_h(tokens["organizer"]))
    item = r.json()["items"][0]
    r2 = requests.post(
        f"{API}/events/evt-b-nusantara-sound-fest/compliance/{item['id']}/evidence",
        headers=_h(tokens["tenant"]),
        json={"note": "hack"},
    )
    assert r2.status_code == 403


def test_evidence_requires_file_or_note(tokens):
    it = _fresh_item_for_event(tokens, "evt-b-nusantara-sound-fest")
    r = requests.post(
        f"{API}/events/evt-b-nusantara-sound-fest/compliance/{it['id']}/evidence",
        headers=_h(tokens["organizer"]), json={},
    )
    assert r.status_code == 400


def test_evidence_appends_and_transitions_to_submitted(tokens):
    it = _fresh_item_for_event(tokens, "evt-b-nusantara-sound-fest")
    r = requests.post(
        f"{API}/events/evt-b-nusantara-sound-fest/compliance/{it['id']}/evidence",
        headers=_h(tokens["organizer"]),
        json={"file_ref": "s3://demo/permit-ven.pdf", "note": "signed venue rental",
              "transition_to": "submitted"},
    )
    assert r.status_code == 200, r.text
    updated = r.json()["item"]
    assert updated["status"] == "submitted"
    assert len(updated["evidences"]) >= 1
    latest = updated["evidences"][-1]
    assert latest["file_ref"] == "s3://demo/permit-ven.pdf"
    assert latest["submitted_by_email"] == "organizer@okkax.id"


def test_evidence_illegal_transition_rejected(tokens):
    r = requests.get(f"{API}/events/evt-b-nusantara-sound-fest/compliance", headers=_h(tokens["organizer"]))
    issued = next((i for i in r.json()["items"] if i["status"] == "issued"), None)
    target = issued or r.json()["items"][0]
    r2 = requests.post(
        f"{API}/events/evt-b-nusantara-sound-fest/compliance/{target['id']}/evidence",
        headers=_h(tokens["organizer"]),
        json={"note": "x", "transition_to": "issued"},  # organizer never can go issued
    )
    assert r2.status_code == 400


# ---------- API — decision ----------
def test_decision_requires_admin(tokens):
    r = requests.get(f"{API}/events/evt-b-nusantara-sound-fest/compliance", headers=_h(tokens["organizer"]))
    item = r.json()["items"][0]
    r2 = requests.post(
        f"{API}/events/evt-b-nusantara-sound-fest/compliance/{item['id']}/decision",
        headers=_h(tokens["organizer"]),
        json={"action": "issue"},
    )
    assert r2.status_code == 403


def test_decision_requires_reason_for_reject(tokens):
    it = _fresh_item_for_event(tokens, "evt-b-nusantara-sound-fest")
    # Ensure submitted first (organizer path)
    requests.post(
        f"{API}/events/evt-b-nusantara-sound-fest/compliance/{it['id']}/evidence",
        headers=_h(tokens["organizer"]),
        json={"note": "prep", "transition_to": "submitted"},
    )
    r = requests.post(
        f"{API}/events/evt-b-nusantara-sound-fest/compliance/{it['id']}/decision",
        headers=_h(tokens["admin"]),
        json={"action": "reject"},
    )
    assert r.status_code == 400


def test_decision_full_issue_and_revoke_cycle(tokens):
    it = _fresh_item_for_event(tokens, "evt-b-nusantara-sound-fest")
    # Move to submitted first
    requests.post(
        f"{API}/events/evt-b-nusantara-sound-fest/compliance/{it['id']}/evidence",
        headers=_h(tokens["organizer"]),
        json={"note": "prep", "transition_to": "submitted"},
    )
    r_issue = requests.post(
        f"{API}/events/evt-b-nusantara-sound-fest/compliance/{it['id']}/decision",
        headers=_h(tokens["admin"]),
        json={"action": "issue"},
    )
    assert r_issue.status_code == 200, r_issue.text
    body = r_issue.json()["item"]
    assert body["status"] == "issued"
    assert body["issued_by"] == ADMIN_EMAIL
    assert body["decisions"][-1]["action"] == "issue"

    r_revoke = requests.post(
        f"{API}/events/evt-b-nusantara-sound-fest/compliance/{it['id']}/decision",
        headers=_h(tokens["admin"]),
        json={"action": "revoke", "reason": "temuan pasca-issued"},
    )
    assert r_revoke.status_code == 200
    body2 = r_revoke.json()["item"]
    assert body2["status"] == "revoked"
    assert body2["revocation_reason"] == "temuan pasca-issued"


def test_decision_invalid_action_rejected(tokens):
    it = _fresh_item_for_event(tokens, "evt-b-nusantara-sound-fest")
    r = requests.post(
        f"{API}/events/evt-b-nusantara-sound-fest/compliance/{it['id']}/decision",
        headers=_h(tokens["admin"]),
        json={"action": "hack"},
    )
    assert r.status_code == 400


# ---------- F6C — propagation ----------
def test_graph_injects_compliance_node_when_items_exist(tokens):
    # Ensure at least one compliance item exists for the event
    requests.get(f"{API}/events/evt-b-nusantara-sound-fest/compliance", headers=_h(tokens["organizer"]))
    r = requests.get(f"{API}/events/evt-b-nusantara-sound-fest/graph", headers=_h(tokens["organizer"]))
    assert r.status_code == 200, r.text
    ids = [n["id"] for n in r.json()["nodes"]]
    assert "compliance" in ids
    node = next(n for n in r.json()["nodes"] if n["id"] == "compliance")
    assert node["meta"]["coverage_status"] in ("not_configured", "in_progress", "partial", "complete", "blocked")


def test_public_readiness_reflects_compliance_when_present(tokens):
    # Public endpoint is unauthenticated but the demo event is published
    requests.get(f"{API}/events/evt-b-nusantara-sound-fest/compliance", headers=_h(tokens["organizer"]))
    r = requests.get(f"{API}/public/events/evt-b-nusantara-sound-fest")
    assert r.status_code == 200
    readiness = r.json()["readiness"]
    assert "compliance_coverage_status" in readiness
    assert "compliance_ready" in readiness
    assert "compliance_blocked" in readiness
    assert isinstance(readiness["compliance_ready"], bool)
