"""Tests for demo endpoint security gating (STEP 1 audit remediation).

Verifies:
- `is_demo_mode()` reads env `OKKAX_DEMO_MODE` and honours truthy/falsy variants.
- `POST /api/demo/persona-login` returns 404 when demo mode is off.
- `POST /api/demo/reset` returns 404 when demo mode is off (even for admins).
- `POST /api/demo/reset` returns 401 without auth, 403 for non-admin, 200 for admin.

Tests only touch the gates and do not verify persona seed content or seed side
effects (seed_data.seed is stubbed for positive admin case).
"""

import os
from pathlib import Path
from unittest.mock import patch

import pytest
from dotenv import load_dotenv
from fastapi.testclient import TestClient

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from core import get_optional_user, is_demo_mode  # noqa: E402
from server import app  # noqa: E402

client = TestClient(app)


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

def test_persona_login_returns_404_when_demo_mode_off():
    with patch.dict(os.environ, {"OKKAX_DEMO_MODE": "false"}, clear=False):
        response = client.post("/api/demo/persona-login", json={"label": "Penyelenggara"})
    assert response.status_code == 404
    assert response.json().get("detail") == "Not found"


def test_persona_login_passes_gate_when_demo_mode_on():
    """Ketika demo mode aktif, gate 404 tidak muncul. Handler tetap dapat
    merespons 200 (persona ada) atau 404 dengan detail persona-not-seeded,
    tetapi bukan 404 gate marker."""
    with patch.dict(os.environ, {"OKKAX_DEMO_MODE": "true"}, clear=False):
        response = client.post("/api/demo/persona-login", json={"label": "Penyelenggara"})
    if response.status_code == 404:
        assert response.json().get("detail") != "Not found"


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
