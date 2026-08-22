"""Test suite for COPILOT-06B Phase 1 Response Selector.

Validates:
1. Feature flag control (OKKAX_COPILOT_V2_RESPONSE=false default OFF).
2. Allowlisted cutover modes (DIRECT, DETERMINISTIC, KNOWLEDGE, INTERNAL_READ).
3. Shadow-only retention for remaining modes (PLANNING, DECISION_SUPPORT, MULTI_TOOL, ENTERTAINMENT, ACTION_PROPOSAL).
4. Failsafe fallback to legacy on exception, invalid structure, or missing contract.
5. Authorization isolation and private event security.
6. Three surfaces: HOMEPAGE, CHATBOT, WORKSPACE.
7. Pure deterministic calculations (zero LLM math).
8. Actual HTTP /okkax/chat endpoint responses.
"""

import os
import pytest
from fastapi import BackgroundTasks

from okkax_copilot_context import make_authenticated_context, make_guest_context
from okkax_copilot_router import OkkaxRoutingMode, route_okkax_query
from okkax_copilot_selector import (
    V2_ALLOWLISTED_MODES,
    V2_SHADOW_ONLY_MODES,
    clear_selector_telemetry,
    get_latest_selector_telemetry,
    is_v2_response_enabled,
    select_copilot_response,
)
from server import OkkaxChatIn, app, okkax_copilot_chat_endpoint


@pytest.fixture(autouse=True)
def clean_telemetry():
    clear_selector_telemetry()
    yield
    clear_selector_telemetry()


class TestCopilot06BFeatureFlag:
    """Test A: Feature Flag & Rollback behavior."""

    def test_default_flag_is_off_when_unset(self, monkeypatch):
        monkeypatch.delenv("OKKAX_COPILOT_V2_RESPONSE", raising=False)
        assert is_v2_response_enabled() is False

    def test_flag_off_explicitly(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "false")
        assert is_v2_response_enabled() is False

    def test_flag_on_explicitly(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        assert is_v2_response_enabled() is True

    @pytest.mark.anyio
    async def test_flag_off_returns_exact_legacy_response(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "false")
        legacy_mock = {"reply": "Legacy reply", "engine": "Legacy Engine", "source": "legacy"}
        res = await select_copilot_response(
            message="Halo",
            legacy_response=legacy_mock,
        )
        assert res == legacy_mock
        telemetry = get_latest_selector_telemetry()
        assert len(telemetry) == 1
        assert telemetry[0]["selected_engine"] == "LEGACY"
        assert telemetry[0]["fallback_reason"] == "FLAG_OFF"


class TestCopilot06BCutoverModes:
    """Test B & C: Mode Allowlist & Shadow-Only retention."""

    @pytest.mark.anyio
    async def test_direct_mode_cuts_over_to_v2(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        legacy_mock = {"reply": "Legacy Halo", "engine": "Legacy"}
        res = await select_copilot_response(
            message="Halo",
            legacy_response=legacy_mock,
        )
        assert res.get("selected_engine") == "V2"
        assert res.get("v2_mode") == "DIRECT"
        assert "Halo" in res.get("reply", "")

    @pytest.mark.anyio
    async def test_deterministic_pure_arithmetic_cuts_over_to_v2(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        legacy_mock = {"reply": "Legacy Math", "engine": "Legacy"}
        res = await select_copilot_response(
            message="2,4 miliar dibagi 8",
            legacy_response=legacy_mock,
        )
        assert res.get("selected_engine") == "V2"
        assert res.get("v2_mode") == "DETERMINISTIC"
        assert "Rp300.000.000" in res.get("reply", "")

    @pytest.mark.anyio
    async def test_knowledge_mode_cuts_over_to_v2(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        legacy_mock = {"reply": "Legacy Knowledge", "engine": "Legacy"}
        res = await select_copilot_response(
            message="Apa bedanya promotor dan event organizer?",
            legacy_response=legacy_mock,
        )
        assert res.get("selected_engine") == "V2"
        assert res.get("v2_mode") == "KNOWLEDGE"
        assert "Promotor" in res.get("reply", "") and "Event Organizer" in res.get("reply", "")

    @pytest.mark.anyio
    async def test_internal_read_calendar_cuts_over_to_v2(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        legacy_mock = {"reply": "Legacy Calendar", "engine": "Legacy"}
        res = await select_copilot_response(
            message="Event apa di Jakarta minggu ini?",
            current_route="/discover",
            legacy_response=legacy_mock,
        )
        assert res.get("selected_engine") == "V2"
        assert res.get("v2_mode") == "INTERNAL_READ"
        assert "get_public_calendar_events" in res.get("tools_selected", [])

    @pytest.mark.anyio
    async def test_planning_mode_remains_legacy(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        legacy_mock = {"reply": "Legacy Planning Roadmap", "engine": "Legacy Engine"}
        res = await select_copilot_response(
            message="Buat rencana festival musik 8.000 orang di Jakarta.",
            legacy_response=legacy_mock,
        )
        assert res == legacy_mock
        telemetry = get_latest_selector_telemetry()
        assert telemetry[-1]["selected_engine"] == "LEGACY"
        assert "MODE_NOT_ALLOWLISTED: PLANNING" in telemetry[-1]["fallback_reason"]

    @pytest.mark.anyio
    async def test_decision_support_cuts_over_to_v2(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        legacy_mock = {"reply": "Legacy Decision Tradeoff", "engine": "Legacy Engine"}
        res = await select_copilot_response(
            message="Venue A kapasitas 5.000 harga 180 juta vs Venue B kapasitas 9.000 harga 260 juta. Target 7.000 pax. Mana yang lebih masuk akal?",
            legacy_response=legacy_mock,
        )
        assert res.get("selected_engine") == "V2"
        assert res.get("v2_mode") == "DECISION_SUPPORT"
        telemetry = get_latest_selector_telemetry()
        assert telemetry[-1]["selected_engine"] == "V2"
        assert telemetry[-1]["routing_mode"] == "DECISION_SUPPORT"

    @pytest.mark.anyio
    async def test_action_proposal_remains_legacy(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        legacy_mock = {"reply": "Legacy Action Confirmation", "engine": "Legacy Engine"}
        res = await select_copilot_response(
            message="Buat 1.000 QR tiket Regular.",
            legacy_response=legacy_mock,
        )
        assert res == legacy_mock
        telemetry = get_latest_selector_telemetry()
        assert telemetry[-1]["selected_engine"] == "LEGACY"
        assert "MODE_NOT_ALLOWLISTED: ACTION_PROPOSAL" in telemetry[-1]["fallback_reason"]


class TestCopilot06BFailsafeAndSecurity:
    """Test D, E, & F: Failsafe, Security & Three Surfaces."""

    @pytest.mark.anyio
    async def test_v2_generation_exception_falls_back_to_legacy(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        legacy_mock = {"reply": "Safe Fallback", "engine": "Legacy Engine"}

        # Simulate unexpected error in generator
        async def mock_generate_v2_fail(*args, **kwargs):
            raise RuntimeError("Simulated internal generation glitch")

        monkeypatch.setattr("okkax_copilot_selector.generate_v2_response", mock_generate_v2_fail)

        res = await select_copilot_response(
            message="Halo",
            legacy_response=legacy_mock,
        )
        assert res == legacy_mock
        telemetry = get_latest_selector_telemetry()
        assert telemetry[-1]["selected_engine"] == "LEGACY"
        assert "GENERATION_ERROR" in telemetry[-1]["fallback_reason"]

    @pytest.mark.anyio
    async def test_unauthorized_private_access_falls_back_safely(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        legacy_mock = {"reply": "Public General Answer", "engine": "Legacy Engine"}

        # Anonymous caller asking for private event financial status
        res = await select_copilot_response(
            message="Cek budget dan status keuangan event saya",
            user=None,
            event_snapshot=None,
            legacy_response=legacy_mock,
        )
        # Should fallback to legacy or safe public response without leaking private details
        assert res == legacy_mock

    @pytest.mark.anyio
    async def test_three_surfaces_supported_identically(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        legacy_mock = {"reply": "Legacy", "engine": "Legacy"}

        # Surface 1: HOMEPAGE
        res_home = await select_copilot_response(
            message="Halo",
            current_route="/",
            legacy_response=legacy_mock,
        )
        assert res_home.get("selected_engine") == "V2"

        # Surface 2: CHATBOT
        res_chat = await select_copilot_response(
            message="Halo",
            current_route="/discover",
            legacy_response=legacy_mock,
        )
        assert res_chat.get("selected_engine") == "V2"

        # Surface 3: WORKSPACE
        demo_user = {"id": "usr-1", "email": "organizer@okkax.id", "organization_id": "org-1", "roles": ["organizer"]}
        res_work = await select_copilot_response(
            message="Halo",
            current_route="/workspace",
            user=demo_user,
            role="organizer",
            legacy_response=legacy_mock,
        )
        assert res_work.get("selected_engine") == "V2"


class TestCopilot06BHttpEndpoint:
    """Test G: Actual HTTP /okkax/chat execution on 4 cutover acceptance cases."""

    @pytest.mark.anyio
    async def test_http_endpoint_halo_v2_response(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        bg_tasks = BackgroundTasks()
        payload = OkkaxChatIn(message="Halo", current_route="/")
        resp = await okkax_copilot_chat_endpoint(payload=payload, background_tasks=bg_tasks, user=None)
        assert resp is not None
        assert "reply" in resp
        assert resp.get("selected_engine") == "V2"
        assert resp.get("v2_mode") == "DIRECT"

    @pytest.mark.anyio
    async def test_http_endpoint_math_v2_response(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        bg_tasks = BackgroundTasks()
        payload = OkkaxChatIn(message="2,4 miliar dibagi 8", current_route="/")
        resp = await okkax_copilot_chat_endpoint(payload=payload, background_tasks=bg_tasks, user=None)
        assert resp is not None
        assert "Rp300.000.000" in resp.get("reply", "")
        assert resp.get("selected_engine") == "V2"
        assert resp.get("v2_mode") == "DETERMINISTIC"

    @pytest.mark.anyio
    async def test_http_endpoint_knowledge_v2_response(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        bg_tasks = BackgroundTasks()
        payload = OkkaxChatIn(message="Apa beda promotor dan EO?", current_route="/")
        resp = await okkax_copilot_chat_endpoint(payload=payload, background_tasks=bg_tasks, user=None)
        assert resp is not None
        assert "Promotor" in resp.get("reply", "")
        assert "[FACT]" not in resp.get("reply", "")
        assert resp.get("selected_engine") == "V2"
        assert resp.get("v2_mode") == "KNOWLEDGE"

    @pytest.mark.anyio
    async def test_http_endpoint_calendar_v2_response(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        bg_tasks = BackgroundTasks()
        payload = OkkaxChatIn(message="Event apa di Jakarta minggu ini?", current_route="/discover")
        resp = await okkax_copilot_chat_endpoint(payload=payload, background_tasks=bg_tasks, user=None)
        assert resp is not None
        assert resp.get("selected_engine") == "V2"
        assert resp.get("v2_mode") == "INTERNAL_READ"
        assert "get_public_calendar_events" in resp.get("tools_selected", [])
        # Temporal assertion: no distant October events should appear for "minggu ini"
        reply = resp.get("reply", "")
        assert "25 Okt" not in reply
        assert "28 Okt" not in reply
        assert "minggu ini" in reply or "Tidak ada event" in reply


class TestCopilot06BTemporalPhrases:
    """Test temporal phrase resolution and filtering."""

    @pytest.mark.parametrize("phrase,expected_label", [
        ("Event apa di Jakarta hari ini?", "hari ini"),
        ("Ada konser di Bandung besok?", "besok"),
        ("Event apa di Jakarta minggu ini?", "minggu ini"),
        ("Ada acara apa di Surabaya akhir pekan ini?", "akhir pekan ini"),
        ("Event apa di Bali minggu depan?", "minggu depan"),
        ("Ada festival apa di Medan bulan ini?", "bulan ini"),
    ])
    def test_temporal_resolution_phrases(self, phrase, expected_label):
        from okkax_copilot_selector import resolve_temporal_range
        df, dt, label = resolve_temporal_range(phrase)
        assert label == expected_label
        assert df is not None
        assert dt is not None
        assert df <= dt


class TestCopilot06BTruthfulToolsEntitlement:
    """Rigorous verification that tools_available represents only server-authorized tools."""

    @pytest.mark.anyio
    async def test_guest_cannot_see_private_tools_in_tools_available(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        from server import okkax_copilot_chat_endpoint, OkkaxChatIn
        from fastapi import BackgroundTasks
        bg = BackgroundTasks()
        payload = OkkaxChatIn(message="Halo", current_route="/")
        resp = await okkax_copilot_chat_endpoint(payload=payload, background_tasks=bg, user=None)
        tools = resp.get("tools_available", [])
        assert "confirm_and_execute_write" not in tools
        assert "get_event_financial_status" not in tools
        assert "get_event_ticketing_health" not in tools
        assert "get_event_compliance_readiness" not in tools
        assert "get_event_operational_blockers" not in tools
        assert "get_private_event_summary" not in tools
        assert "get_my_tickets_summary" not in tools
        # Only public read tools
        assert "get_public_calendar_events" in tools
        assert "calculate_event_budget" in tools

    @pytest.mark.anyio
    async def test_guest_cannot_see_confirm_and_execute_write(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        from server import okkax_copilot_chat_endpoint, OkkaxChatIn
        from fastapi import BackgroundTasks
        bg = BackgroundTasks()
        payload = OkkaxChatIn(message="2,4 miliar dibagi 8", current_route="/")
        resp = await okkax_copilot_chat_endpoint(payload=payload, background_tasks=bg, user=None)
        assert "confirm_and_execute_write" not in resp.get("tools_available", [])

    @pytest.mark.anyio
    async def test_authenticated_unrelated_member_cannot_see_private_event_tools(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        import server
        from server import okkax_copilot_chat_endpoint, OkkaxChatIn
        from fastapi import BackgroundTasks

        async def _mock_quota(u):
            pass
        monkeypatch.setattr(server, "increment_copilot_quota", _mock_quota)

        bg = BackgroundTasks()
        user = {"id": "usr-aud-1", "email": "aud@okkax.id", "roles": ["audience"]}
        payload = OkkaxChatIn(message="Halo", current_route="/mytickets")
        resp = await okkax_copilot_chat_endpoint(payload=payload, background_tasks=bg, user=user)
        tools = resp.get("tools_available", [])
        assert "get_my_tickets_summary" in tools
        assert "get_event_financial_status" not in tools
        assert "get_event_ticketing_health" not in tools
        assert "confirm_and_execute_write" not in tools

    @pytest.mark.anyio
    async def test_organizer_a_cannot_see_event_b_private_tools(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        import server
        from server import okkax_copilot_chat_endpoint, OkkaxChatIn
        from fastapi import BackgroundTasks, HTTPException

        async def _mock_quota(u):
            pass
        async def _mock_get_event(event_id):
            return {"id": event_id, "title": "Event Beta", "organization_id": "org-beta"}
        async def _mock_assert_access(ev, user):
            raise HTTPException(status_code=403, detail="Forbidden")

        monkeypatch.setattr(server, "increment_copilot_quota", _mock_quota)
        monkeypatch.setattr(server, "get_event_or_404", _mock_get_event)
        monkeypatch.setattr(server, "assert_event_access", _mock_assert_access)

        bg = BackgroundTasks()
        user = {"id": "usr-org-a", "email": "org.a@okkax.id", "roles": ["organizer"], "org_id": "org-alpha"}
        payload = OkkaxChatIn(message="Cek budget event", event_id="evt-beta", current_route="/workspace")
        resp = await okkax_copilot_chat_endpoint(payload=payload, background_tasks=bg, user=user)
        tools = resp.get("tools_available", [])
        assert "get_event_financial_status" not in tools
        assert "get_event_ticketing_health" not in tools
        assert "get_private_event_summary" not in tools

    @pytest.mark.anyio
    async def test_authorized_organizer_gets_correct_entitled_set(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        import server
        from server import okkax_copilot_chat_endpoint, OkkaxChatIn
        from fastapi import BackgroundTasks

        async def _mock_quota(u):
            pass
        async def _mock_get_event(event_id):
            return {"id": event_id, "title": "Aruna Fest", "organization_id": "org-1"}
        async def _mock_assert_access(ev, user):
            pass
        async def _mock_gather(event_id):
            return {"available": True, "event": {"id": event_id, "name": "Aruna Fest", "city": "Jakarta"}}

        monkeypatch.setattr(server, "increment_copilot_quota", _mock_quota)
        monkeypatch.setattr(server, "get_event_or_404", _mock_get_event)
        monkeypatch.setattr(server, "assert_event_access", _mock_assert_access)
        monkeypatch.setattr(server, "gather_event_ground_truth", _mock_gather)

        bg = BackgroundTasks()
        user = {"id": "usr-org-1", "email": "organizer@okkax.id", "roles": ["organizer"], "organization_id": "org-1"}
        payload = OkkaxChatIn(message="Cek event", event_id="evt-aruna-2026", current_route="/workspace")
        resp = await okkax_copilot_chat_endpoint(payload=payload, background_tasks=bg, user=user)
        tools = resp.get("tools_available", [])
        assert "get_public_calendar_events" in tools
        assert "get_my_tickets_summary" in tools
        assert "get_event_financial_status" in tools
        assert "get_event_ticketing_health" in tools
        assert "get_event_compliance_readiness" in tools
        assert "get_event_operational_blockers" in tools
        assert "get_private_event_summary" in tools
        assert "confirm_and_execute_write" not in tools

    @pytest.mark.anyio
    async def test_current_route_copilot_does_not_elevate_guest(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        from server import okkax_copilot_chat_endpoint, OkkaxChatIn
        from fastapi import BackgroundTasks
        bg = BackgroundTasks()
        payload = OkkaxChatIn(message="Halo", current_route="/copilot")
        resp = await okkax_copilot_chat_endpoint(payload=payload, background_tasks=bg, user=None)
        tools = resp.get("tools_available", [])
        assert "get_event_financial_status" not in tools
        assert "confirm_and_execute_write" not in tools

    @pytest.mark.anyio
    async def test_forged_client_role_does_not_elevate_access(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        from server import okkax_copilot_chat_endpoint, OkkaxChatIn
        from fastapi import BackgroundTasks
        bg = BackgroundTasks()
        payload = OkkaxChatIn(message="Halo", role="superadmin", event_id="evt-aruna-2026", current_route="/admin")
        resp = await okkax_copilot_chat_endpoint(payload=payload, background_tasks=bg, user=None)
        tools = resp.get("tools_available", [])
        assert "get_event_financial_status" not in tools
        assert "confirm_and_execute_write" not in tools
        assert "get_my_tickets_summary" not in tools

    @pytest.mark.anyio
    async def test_exact_budget_calculation_prompt_regression(self, monkeypatch):
        monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
        from server import okkax_copilot_chat_endpoint, OkkaxChatIn
        from fastapi import BackgroundTasks
        bg = BackgroundTasks()
        payload = OkkaxChatIn(message="Saya mau bikin konser 8.000 orang di Jakarta bulan November dengan budget Rp4 miliar.", current_route="/")
        resp = await okkax_copilot_chat_endpoint(payload=payload, background_tasks=bg, user=None)
        assert resp.get("selected_engine") == "V2"
        assert resp.get("v2_mode") == "DETERMINISTIC"
        reply = resp.get("reply", "")
        assert len(reply) > 20
        assert "8.000" in reply or "8,000" in reply
        assert "4" in reply or "miliar" in reply or "4.000.000.000" in reply or "4,000,000,000" in reply
