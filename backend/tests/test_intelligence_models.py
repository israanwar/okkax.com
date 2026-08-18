"""
Unit tests for OKKAX Intelligence core schema foundation.
Validates Pydantic models, Provenance contract, enum values, and serialization.
"""

import pytest
from pydantic import ValidationError
from intelligence_models import (
    Provenance,
    ProvenanceStatus,
    IntelligenceIntent,
    IntelligenceIntentCategory,
    NetworkDirection,
    IntelligenceRequest,
    ToolResult,
    StructuredPayload,
    StructuredPayloadType,
    IntelligenceEntitlementTelemetry,
    IntelligenceResponse,
)


class TestProvenanceModel:
    """Test suite for the mandatory OKKAX Provenance Contract."""

    def test_valid_verified_provenance(self):
        prov = Provenance(
            source="internal_database",
            provider_id="okkax_core",
            status=ProvenanceStatus.VERIFIED,
            verified=True,
            confidence=0.98,
            calculation_method="exact_database_match",
        )
        assert prov.source == "internal_database"
        assert prov.provider_id == "okkax_core"
        assert prov.status == ProvenanceStatus.VERIFIED
        assert prov.verified is True
        assert prov.confidence == 0.98
        assert prov.calculation_method == "exact_database_match"
        assert isinstance(prov.as_of, str) and len(prov.as_of) > 10

    def test_valid_estimated_provenance(self):
        prov = Provenance(
            source="deterministic_engine",
            provider_id="budget_solver_v5",
            status=ProvenanceStatus.ESTIMATED,
            verified=False,
            confidence=0.85,
            calculation_method="baseline_benchmark_fallback",
        )
        assert prov.status == ProvenanceStatus.ESTIMATED
        assert prov.verified is False
        assert prov.confidence == 0.85

    def test_valid_unavailable_provenance(self):
        prov = Provenance(
            source="external_provider",
            provider_id="regional_tax_adapter",
            status=ProvenanceStatus.UNAVAILABLE,
            verified=False,
            confidence=0.0,
        )
        assert prov.status == ProvenanceStatus.UNAVAILABLE
        assert prov.verified is False
        assert prov.confidence == 0.0
        assert prov.calculation_method is None

    def test_provenance_confidence_bounds(self):
        # Confidence must be between 0.0 and 1.0
        with pytest.raises(ValidationError):
            Provenance(
                source="internal_database",
                provider_id="okkax_core",
                status=ProvenanceStatus.VERIFIED,
                verified=True,
                confidence=1.5,  # Invalid: > 1.0
            )

        with pytest.raises(ValidationError):
            Provenance(
                source="internal_database",
                provider_id="okkax_core",
                status=ProvenanceStatus.VERIFIED,
                verified=True,
                confidence=-0.1,  # Invalid: < 0.0
            )

    def test_invalid_provenance_status_enum(self):
        with pytest.raises(ValidationError):
            Provenance(
                source="internal_database",
                provider_id="okkax_core",
                status="invented_status",  # Invalid enum
                verified=True,
                confidence=1.0,
            )


class TestIntelligenceIntentModel:
    """Test suite for intent classification and cross-role resolution."""

    def test_workforce_demand_intent(self):
        intent = IntelligenceIntent(
            category=IntelligenceIntentCategory.WORKFORCE_DISCOVERY,
            detected_role="worker",
            network_direction=NetworkDirection.SUPPLY_TO_DEMAND,
            target_city="Jakarta",
            extracted_parameters={"role_category": "Usher", "min_rate": 350000},
        )
        assert intent.category == IntelligenceIntentCategory.WORKFORCE_DISCOVERY
        assert intent.detected_role == "worker"
        assert intent.network_direction == NetworkDirection.SUPPLY_TO_DEMAND
        assert intent.target_city == "Jakarta"
        assert intent.extracted_parameters["role_category"] == "Usher"

    def test_organizer_blueprint_intent(self):
        intent = IntelligenceIntent(
            category=IntelligenceIntentCategory.EVENT_DESIGN_BLUEPRINT,
            detected_role="organizer",
            network_direction=NetworkDirection.DEMAND_TO_SUPPLY,
            target_city="Surabaya",
            target_capacity=10000,
            target_budget_idr=2500000000,
        )
        assert intent.category == IntelligenceIntentCategory.EVENT_DESIGN_BLUEPRINT
        assert intent.target_capacity == 10000
        assert intent.target_budget_idr == 2500000000

    def test_role_neutral_intent(self):
        intent = IntelligenceIntent(
            category=IntelligenceIntentCategory.GENERAL_INTELLIGENCE,
            detected_role=None,
            network_direction=NetworkDirection.BIDIRECTIONAL,
        )
        assert intent.detected_role is None
        assert intent.network_direction == NetworkDirection.BIDIRECTIONAL


class TestIntelligenceRequestModel:
    """Test suite for request payload validation."""

    def test_valid_request(self):
        req = IntelligenceRequest(
            query="Bantu hitung budget konser 15.000 pax di Senayan",
            conversation_id="conv-12345",
            event_id="ev-senayan-01",
            client_context={"route": "/"},
        )
        assert req.query == "Bantu hitung budget konser 15.000 pax di Senayan"
        assert req.conversation_id == "conv-12345"
        assert req.event_id == "ev-senayan-01"

    def test_empty_query_raises_validation_error(self):
        with pytest.raises(ValidationError):
            IntelligenceRequest(query="")


class TestToolResultAndStructuredPayload:
    """Test suite for atomic tool outputs and interactive card structures."""

    def test_tool_result_with_provenance(self):
        prov = Provenance(
            source="internal_database",
            provider_id="okkax_core",
            status=ProvenanceStatus.VERIFIED,
            verified=True,
            confidence=1.0,
            calculation_method="exact_database_match",
        )
        res = ToolResult(
            tool_name="query_venues",
            success=True,
            data={"matched_count": 3, "venues": [{"id": "ven-1", "name": "Stadion GBK"}]},
            provenance=prov,
        )
        assert res.tool_name == "query_venues"
        assert res.success is True
        assert res.provenance.status == ProvenanceStatus.VERIFIED
        assert res.data["matched_count"] == 3

    def test_structured_payload_cards(self):
        payload = StructuredPayload(
            payload_type=StructuredPayloadType.JOB_CARDS,
            items=[
                {"job_id": "job-1", "role": "Usher", "daily_rate": 350000},
                {"job_id": "job-2", "role": "Stagehand", "daily_rate": 450000},
            ],
            summary_metrics={"total_positions": 2, "avg_rate": 400000},
        )
        assert payload.payload_type == StructuredPayloadType.JOB_CARDS
        assert len(payload.items) == 2
        assert payload.summary_metrics["total_positions"] == 2


class TestIntelligenceResponseEnvelope:
    """Test suite for full Intelligence Response serialization and deserialization."""

    def test_complete_response_envelope(self):
        prov = Provenance(
            source="deterministic_engine",
            provider_id="okkax_intelligence_core",
            status=ProvenanceStatus.VERIFIED,
            verified=True,
            confidence=0.96,
            calculation_method="event_grounded_sum",
        )
        intent = IntelligenceIntent(
            category=IntelligenceIntentCategory.FINANCIAL_MODELING,
            detected_role="organizer",
            target_city="Jakarta",
            target_budget_idr=3000000000,
        )
        entitlement = IntelligenceEntitlementTelemetry(
            plan="free",
            usage=12,
            limit=15,
            remaining=3,
            reset_at="2026-09-01T00:00:00Z",
            warning_state="low_credit",
            upgrade_eligible=True,
        )
        payload = StructuredPayload(
            payload_type=StructuredPayloadType.FINANCIAL_BREAKDOWN,
            items=[{"category": "Talent & Rider", "amount": 840000000}],
            summary_metrics={"total_budget": 3000000000},
        )

        resp = IntelligenceResponse(
            reply_markdown="### Analisis Finansial Acara\nTotal budget Rp 3.000.000.000...",
            intent=intent,
            structured_payload=payload,
            tool_results=[],
            entitlement=entitlement,
            provenance=prov,
        )

        # Test dictionary conversion and JSON dump/load
        d = resp.model_dump()
        assert d["reply_markdown"].startswith("### Analisis")
        assert d["intent"]["category"] == "financial_modeling"
        assert d["entitlement"]["plan"] == "free"
        assert d["entitlement"]["remaining"] == 3
        assert d["provenance"]["status"] == "verified"

        # Test round-trip reconstruction
        reconstructed = IntelligenceResponse.model_validate(d)
        assert reconstructed.intent.category == IntelligenceIntentCategory.FINANCIAL_MODELING
        assert reconstructed.entitlement.remaining == 3
