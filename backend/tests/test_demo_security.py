"""Tests for demo endpoint security gating (STEP 1 audit remediation +
OKKAX_COMPETITION_DEMO_LOGIN narrow gate).

Verifies:
- `is_demo_mode()` reads env `OKKAX_DEMO_MODE` and honours truthy/falsy variants.
- `is_competition_demo_login_enabled()` reads env `OKKAX_COMPETITION_DEMO_LOGIN`.
- `POST /api/demo/persona-login` returns 404 when BOTH gates are off.
- `POST /api/demo/persona-login` succeeds when EITHER gate is on, independently.
- `POST /api/demo/persona-login` only accepts canonical persona keys — legacy
  free-text/Indonesian labels and non-canonical roles (e.g. "worker",
  "Supervisor", "Finance") are rejected with 400.
- `POST /api/demo/reset` remains gated by `is_demo_mode()` ONLY — the narrower
  competition flag must never widen this or any other demo-only surface.
- `POST /api/demo/reset` returns 401 without auth, 403 for non-admin, 200 for admin.

Tests only touch the gates and do not verify persona seed content or seed side
effects (seed_data.seed is stubbed for positive admin case).
"""

import os
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest
from dotenv import load_dotenv
from fastapi.testclient import TestClient

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from core import get_optional_user, is_demo_mode, is_competition_demo_login_enabled  # noqa: E402
from server import app  # noqa: E402

client = TestClient(app)

BASE = os.environ.get("TEST_BASE_URL", "http://127.0.0.1:8001").rstrip("/")
API = f"{BASE}/api"

_BOTH_GATES_OFF = {"OKKAX_DEMO_MODE": "false", "OKKAX_COMPETITION_DEMO_LOGIN": "false"}


def _override_user(roles):
    """Return a dependency override that yields a stub user with given roles."""
    def _dep():
        return {"id": "test-user", "email": "test@okkax.local", "name": "Test", "roles": roles}
    return _dep


# ------------------------------------------------------------------ is_demo_mode

def test_is_demo_mode_true_when_env_true():
    with patch.dict(os.environ, {"OKKAX_DEMO_MODE": "true"}, clear=False):
        assert is_demo_mode() is True


def test_is_demo_mode_false_when_env_false():
    with patch.dict(os.environ, {"OKKAX_DEMO_MODE": "false"}, clear=False):
        assert is_demo_mode() is False


@pytest.mark.parametrize("value", ["1", "yes", "on", "TRUE", "True", "  true  "])
def test_is_demo_mode_accepts_truthy_variants(value):
    with patch.dict(os.environ, {"OKKAX_DEMO_MODE": value}, clear=False):
        assert is_demo_mode() is True


@pytest.mark.parametrize("value", ["0", "no", "off", "FALSE", "False", "disabled", "anything", ""])
def test_is_demo_mode_rejects_non_truthy_values(value):
    with patch.dict(os.environ, {"OKKAX_DEMO_MODE": value}, clear=False):
        assert is_demo_mode() is False


def test_is_demo_mode_false_when_env_not_set(monkeypatch):
    """Default aman: kalau env tidak diset sama sekali, demo mode OFF."""
    monkeypatch.delenv("OKKAX_DEMO_MODE", raising=False)
    assert "OKKAX_DEMO_MODE" not in os.environ
    assert is_demo_mode() is False


# ------------------------------------------------------------------ persona login gate

def _stub_persona_lookup():
    """Mock the DB/token layer for in-process TestClient persona-login calls.

    A TestClient request that reaches real Motor DB (even indirectly through
    FastAPI's startup lifecycle re-running per bare `.post()` call) hits a
    known TestClient+Motor event-loop conflict the second time it happens in
    one test session (documented in test_suspended_enforcement.py's module
    docstring: "avoids the motor event-loop juggling that plagues TestClient
    + real DB mixes"). Every TestClient-based persona-login test below uses
    this stub so none of them touch real Motor DB; the 9-canonical-key and
    identity-spoofing tests further down verify real seed data instead, via
    httpx against the live server (same convention as
    test_suspended_enforcement.py / test_final_trust_verification.py)."""
    stub_user = {
        "id": "usr-1", "email": "organizer@okkax.id", "name": "Aruna Brand Team",
        "roles": ["organizer"], "org_id": "org-aruna", "suspended": False,
    }

    async def fake_find_one(*_a, **_kw):
        return dict(stub_user)

    async def fake_issue_access_token(user_id, email):
        return "stub-token", {"id": "stub-session"}

    async def fake_audit(*_a, **_kw):
        return None

    return (
        patch("extras.db.users.find_one", new=fake_find_one),
        patch("extras.issue_access_token", new=fake_issue_access_token),
        patch("extras.audit", new=fake_audit),
    )


def test_persona_login_returns_404_when_both_gates_off():
    with patch.dict(os.environ, _BOTH_GATES_OFF, clear=False):
        response = client.post("/api/demo/persona-login", json={"label": "organizer"})
    assert response.status_code == 404
    assert response.json().get("detail") == "Not found"


def test_persona_login_passes_gate_when_demo_mode_on():
    """Ketika demo mode aktif, gate 404 tidak muncul; canonical persona key
    resolves to a real 200 login."""
    find_patch, token_patch, audit_patch = _stub_persona_lookup()
    with find_patch, token_patch, audit_patch, \
         patch.dict(os.environ, {**_BOTH_GATES_OFF, "OKKAX_DEMO_MODE": "true"}, clear=False):
        response = client.post("/api/demo/persona-login", json={"label": "organizer"})
    assert response.status_code == 200, response.text
    assert response.json().get("token") == "stub-token"


def test_persona_login_gate_condition_true_when_only_competition_flag_set():
    """Unit-level proof the endpoint's exact gate expression,
    `is_demo_mode() or is_competition_demo_login_enabled()`, evaluates True
    for the specific combination that matters for production: competition
    flag on, full demo mode still off. Combined with
    `test_persona_login_returns_404_when_both_gates_off` (both False ->
    blocked) and `test_persona_login_passes_gate_when_demo_mode_on` (proves
    the True branch of this exact `if not (...)` reaches a real 200 through
    the live endpoint), this pins down the OR truth table without a second
    real-Motor TestClient round-trip in this session (see `_stub_persona_lookup`)."""
    with patch.dict(os.environ, {"OKKAX_DEMO_MODE": "false", "OKKAX_COMPETITION_DEMO_LOGIN": "true"}, clear=False):
        assert (is_demo_mode() or is_competition_demo_login_enabled()) is True


def test_persona_login_passes_gate_when_competition_demo_login_on_live():
    """End-to-end proof against a fresh, fully isolated backend process
    (own port, own event loop) — sidesteps the in-process TestClient+Motor
    conflict entirely while still exercising the real ASGI app, real DB
    lookup, and real token issuance for the exact production combination:
    OKKAX_COMPETITION_DEMO_LOGIN=true, OKKAX_DEMO_MODE=false."""
    import socket
    import subprocess
    import time

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]

    env = {**os.environ, "OKKAX_DEMO_MODE": "false", "OKKAX_COMPETITION_DEMO_LOGIN": "true"}
    proc = subprocess.Popen(
        [str(Path(".venv/bin/uvicorn")), "server:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=str(Path(__file__).resolve().parents[1]),
        env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        base = f"http://127.0.0.1:{port}/api"
        deadline = time.monotonic() + 30
        up = False
        while time.monotonic() < deadline:
            try:
                if httpx.get(f"{base}/health", timeout=2).status_code == 200:
                    up = True
                    break
            except httpx.HTTPError:
                pass
            time.sleep(0.5)
        assert up, "isolated backend did not become healthy in time"

        response = httpx.post(f"{base}/demo/persona-login", json={"label": "organizer"}, timeout=15)
        assert response.status_code == 200, response.text
        body = response.json()
        assert body.get("token")
        assert body.get("user", {}).get("email") == "organizer@okkax.id"
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()


def test_competition_demo_login_flag_does_not_widen_demo_reset_gate():
    """The narrow competition flag must ONLY unlock persona-login — it must
    never widen `/demo/reset` or any other demo-only surface."""
    with patch.dict(os.environ, {**_BOTH_GATES_OFF, "OKKAX_COMPETITION_DEMO_LOGIN": "true"}, clear=False):
        response = client.post("/api/demo/reset")
    assert response.status_code == 404
    assert response.json().get("detail") == "Not found"


@pytest.mark.parametrize("value", ["1", "yes", "on", "TRUE", "True", "  true  "])
def test_is_competition_demo_login_accepts_truthy_variants(value):
    with patch.dict(os.environ, {"OKKAX_COMPETITION_DEMO_LOGIN": value}, clear=False):
        assert is_competition_demo_login_enabled() is True


@pytest.mark.parametrize("value", ["0", "no", "off", "FALSE", "False", "disabled", "anything", ""])
def test_is_competition_demo_login_rejects_non_truthy_values(value):
    with patch.dict(os.environ, {"OKKAX_COMPETITION_DEMO_LOGIN": value}, clear=False):
        assert is_competition_demo_login_enabled() is False


def test_is_competition_demo_login_false_when_env_not_set(monkeypatch):
    monkeypatch.delenv("OKKAX_COMPETITION_DEMO_LOGIN", raising=False)
    assert is_competition_demo_login_enabled() is False


@pytest.mark.parametrize("label", [
    "organizer", "promoter", "talent", "venue", "vendor",
    "workforce", "sponsor", "tenant", "audience",
])
def test_persona_login_accepts_every_canonical_key(label):
    """Hits the live running backend (real seed data) rather than TestClient
    — see `_stub_persona_lookup` for why a second in-process DB-touching
    TestClient call in this file is avoided."""
    response = httpx.post(f"{API}/demo/persona-login", json={"label": label}, timeout=15)
    assert response.status_code == 200, f"{label}: {response.text}"
    assert response.json().get("token")


@pytest.mark.parametrize("label", [
    "Penyelenggara", "Pengunjung", "Supervisor", "Finance", "worker",
    "Sponsor Brand", "admin", "super_admin", "platform_admin",
    "", "  ", "organizer; DROP TABLE users",
])
def test_persona_login_rejects_non_canonical_keys(label):
    """Anything outside the exact 9 canonical keys is rejected — this closes
    the old free-text/alias/legacy-role loophole, including the alternate
    'worker' spelling and any attempt to name an admin role directly."""
    with patch.dict(os.environ, {**_BOTH_GATES_OFF, "OKKAX_DEMO_MODE": "true"}, clear=False):
        response = client.post("/api/demo/persona-login", json={"label": label})
    assert response.status_code == 400, f"{label}: expected 400, got {response.status_code} {response.text}"
    assert response.json().get("detail") == "Persona demo tidak dikenali"


def test_persona_login_ignores_client_supplied_identity_fields():
    """Client cannot smuggle an arbitrary email/user_id/role/org_id through —
    only `label` is read; everything else in the body is ignored and the
    server resolves identity strictly from the matching seeded account.
    Hits the live running backend (real seed data), same reasoning as
    `test_persona_login_accepts_every_canonical_key` above."""
    response = httpx.post(f"{API}/demo/persona-login", json={
        "label": "organizer",
        "email": "attacker@evil.example",
        "user_id": "usr-999-fake",
        "role": "super_admin",
        "roles": ["super_admin"],
        "organization_id": "org-not-mine",
    }, timeout=15)
    assert response.status_code == 200, response.text
    user = response.json().get("user") or {}
    assert user.get("email") == "organizer@okkax.id"
    assert user.get("id") != "usr-999-fake"
    assert "super_admin" not in (user.get("roles") or [])
    assert user.get("org_id") != "org-not-mine"


# ------------------------------------------------------------------ demo reset gate

def test_demo_reset_returns_404_when_demo_mode_off_no_auth():
    with patch.dict(os.environ, {"OKKAX_DEMO_MODE": "false"}, clear=False):
        response = client.post("/api/demo/reset")
    assert response.status_code == 404
    assert response.json().get("detail") == "Not found"


def test_demo_reset_returns_404_when_demo_mode_off_even_with_admin():
    app.dependency_overrides[get_optional_user] = _override_user(["platform_admin"])
    try:
        with patch.dict(os.environ, {"OKKAX_DEMO_MODE": "false"}, clear=False):
            response = client.post("/api/demo/reset")
    finally:
        app.dependency_overrides.pop(get_optional_user, None)
    assert response.status_code == 404
    assert response.json().get("detail") == "Not found"


def test_demo_reset_returns_401_without_auth_when_demo_mode_on():
    with patch.dict(os.environ, {"OKKAX_DEMO_MODE": "true"}, clear=False):
        response = client.post("/api/demo/reset")
    assert response.status_code == 401


def test_demo_reset_returns_403_for_non_admin_authenticated():
    app.dependency_overrides[get_optional_user] = _override_user(["organizer"])
    try:
        with patch.dict(os.environ, {"OKKAX_DEMO_MODE": "true"}, clear=False):
            response = client.post("/api/demo/reset")
    finally:
        app.dependency_overrides.pop(get_optional_user, None)
    assert response.status_code == 403


def test_demo_reset_returns_403_for_audience_role():
    app.dependency_overrides[get_optional_user] = _override_user(["audience"])
    try:
        with patch.dict(os.environ, {"OKKAX_DEMO_MODE": "true"}, clear=False):
            response = client.post("/api/demo/reset")
    finally:
        app.dependency_overrides.pop(get_optional_user, None)
    assert response.status_code == 403


def _stub_seed_and_audit():
    """Patch seed_data.seed and server.audit so the positive path doesn't
    mutate the real database."""
    async def fake_seed(force=False):
        return {"seeded": True, "reason": "stubbed in test"}

    async def fake_audit(*_args, **_kwargs):
        return None

    return patch("seed_data.seed", new=fake_seed), patch("server.audit", new=fake_audit)


def test_demo_reset_allowed_for_platform_admin_when_demo_mode_on():
    app.dependency_overrides[get_optional_user] = _override_user(["platform_admin"])
    seed_patch, audit_patch = _stub_seed_and_audit()
    try:
        with seed_patch, audit_patch, patch.dict(os.environ, {"OKKAX_DEMO_MODE": "true"}, clear=False):
            response = client.post("/api/demo/reset")
    finally:
        app.dependency_overrides.pop(get_optional_user, None)
    assert response.status_code == 200
    body = response.json()
    assert body.get("ok") is True
    assert body.get("seeded") is True


def test_demo_reset_allowed_for_super_admin_when_demo_mode_on():
    app.dependency_overrides[get_optional_user] = _override_user(["super_admin"])
    seed_patch, audit_patch = _stub_seed_and_audit()
    try:
        with seed_patch, audit_patch, patch.dict(os.environ, {"OKKAX_DEMO_MODE": "true"}, clear=False):
            response = client.post("/api/demo/reset")
    finally:
        app.dependency_overrides.pop(get_optional_user, None)
    assert response.status_code == 200
    assert response.json().get("ok") is True
