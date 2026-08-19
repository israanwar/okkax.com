"""Integration tests for Health Diagnostic and Integration Status API."""

import asyncio
from pathlib import Path
import sys
import pytest
from starlette.testclient import TestClient

# Ensure backend root is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from integrations.health import get_all_integrations_status, run_provider_self_test
from server import app


class TestIntegrationsHealthAPI:
    def test_get_all_integrations_status_schema_and_privacy(self):
        async def _test():
            report = await get_all_integrations_status()
            assert "status" in report
            assert "total_providers" in report
            assert report["total_providers"] >= 8
            assert "providers" in report

            # Check individual provider metadata
            for name, p in report["providers"].items():
                assert "enabled" in p
                assert "configured" in p
                assert "status" in p
                assert p["status"] in ("disabled", "not_configured", "healthy", "degraded", "unavailable")

                # PRIVACY / SECURITY AUDIT: Ensure NO API key or secret is leaked in status payload
                p_str = str(p).lower()
                assert "api_key" not in p_str
                assert "secret" not in p_str
                assert "token" not in p_str
                assert "password" not in p_str

        asyncio.run(_test())

    def test_run_self_test_non_destructive(self):
        async def _test():
            # Test self-test on BMKG (open data)
            bmkg_res = await run_provider_self_test("bmkg")
            assert bmkg_res.provider == "bmkg"

            # Test self-test on unconfigured provider
            privy_res = await run_provider_self_test("privy_esign")
            assert privy_res.ok is False
            assert privy_res.error_code == "NOT_CONFIGURED"

            # Test unknown provider
            unknown_res = await run_provider_self_test("non_existent_provider")
            assert unknown_res.ok is False
            assert unknown_res.error_code == "PROVIDER_NOT_FOUND"

        asyncio.run(_test())

    def test_fastapi_status_endpoint_via_client(self):
        from core import get_current_user
        client = TestClient(app)

        # 1. Unauthenticated request -> Rejected 401
        app.dependency_overrides.pop(get_current_user, None)
        resp_unauth = client.get("/api/integrations/status")
        assert resp_unauth.status_code == 401

        # 2. Audience user -> Forbidden 403
        app.dependency_overrides[get_current_user] = lambda: {"id": "usr_aud_01", "email": "aud@test.com", "role": "audience", "roles": ["audience"]}
        try:
            resp_aud = client.get("/api/integrations/status")
            assert resp_aud.status_code == 403

            # 3. Privileged Admin user -> 200 OK
            app.dependency_overrides[get_current_user] = lambda: {"id": "usr_adm_01", "email": "admin@okkax.id", "role": "admin", "roles": ["admin"]}
            resp = client.get("/api/integrations/status")
            assert resp.status_code == 200
            data = resp.json()
            assert data["total_providers"] >= 8
            assert "gemini" in data["providers"]
            assert "resend" in data["providers"]
            assert "bmkg" in data["providers"]
            assert "r2_storage" in data["providers"]
        finally:
            app.dependency_overrides.pop(get_current_user, None)
