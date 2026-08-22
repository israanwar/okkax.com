"""Broad semantic acceptance matrix for the shared OKKAX Copilot brain.

The matrix intentionally asserts capability and answer-quality invariants,
not canned wording.  Ten event contexts x fifteen problem families yield 150
unique production-pipeline turns across roles and domains.
"""

from __future__ import annotations

import re

import pytest
from fastapi import BackgroundTasks

from okkax_copilot_router import analyze_semantic_problem
from okkax_copilot_state import reconstruct_conversation_state
from server import OkkaxChatIn, okkax_copilot_chat_endpoint


CONTEXTS = [
    ("Makassar", "konser", "2.500", "700 juta"),
    ("Jakarta", "festival", "6.000", "1,2 miliar"),
    ("Bandung", "expo", "3.000", "850 juta"),
    ("Surabaya", "corporate event", "1.500", "500 juta"),
    ("Bali", "festival", "4.000", "950 juta"),
    ("Medan", "konser", "5.000", "1 miliar"),
    ("Semarang", "expo", "2.000", "600 juta"),
    ("Yogyakarta", "show", "1.000", "350 juta"),
    ("Palembang", "festival", "3.500", "800 juta"),
    ("Malang", "konser", "2.800", "650 juta"),
]


def _families(city: str, event_type: str, capacity: str, budget: str) -> list[str]:
    return [
        f"Sebagai organizer, apa prioritas paling masuk akal untuk {event_type} {capacity} pax di {city} dengan budget {budget}?",
        f"Saya talent lokal. Job seperti apa yang sebaiknya saya pilih untuk {event_type} di {city}?",
        f"Saya pemilik venue {capacity} pax di {city}; bandingkan corporate, expo, konser, dan festival untuk ruang saya.",
        f"Saya vendor lighting dan LED di {city}; proyek seperti apa yang memberi margin sehat dengan risiko operasional wajar?",
        f"Sebagai sponsor, aktivasi apa yang sebaiknya diprioritaskan untuk {event_type} {capacity} pax tanpa mengarang ROI?",
        f"Saya freelancer stage crew dengan pengalaman awal; job apa yang aman saya ambil dulu di event {city}?",
        f"Sebagai tenant F&B, format booth apa yang sebaiknya dipilih untuk {event_type} {capacity} pax?",
        f"Penjualan tiket event {city} belum diketahui. Risiko ticketing apa yang harus saya kunci dulu?",
        f"Dengan budget {budget} untuk {capacity} pax, keputusan finance apa yang paling urgent tanpa membuat angka palsu?",
        f"Apa urutan readiness compliance sebelum show {event_type} di {city} dinyatakan siap?",
        f"Produksi premium {event_type} {capacity} pax di {city}; apa yang harus dikunci sebelum meminta quotation vendor?",
        f"Cari venue di {city} untuk {capacity} pax dan jelaskan harga sewanya jika memang ada di katalog.",
        f"Bro, gue mau bikin {event_type} {capacity} pax di {city}; mending ngunci apaan dulu biar gak boncos?",
        f"For a {capacity}-pax {event_type} in {city}, what should I lock first and what remains unknown?",
        f"Buat draft event {event_type} {capacity} pax di {city}, tetapi jangan publish atau mengeksekusi apa pun.",
    ]


@pytest.mark.anyio
async def test_shared_brain_150_turn_acceptance_matrix(monkeypatch):
    monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
    # Acceptance must prove the deterministic fallback remains useful when
    # providers are absent/rate-limited; provider-enabled behavior is covered
    # separately by integration tests.
    for key in ("GEMINI_API_KEY", "GEMINI_API_KEY_SECONDARY", "OPENROUTER_API_KEY", "OPENAI_API_KEY"):
        monkeypatch.setenv(key, "")

    prompts = [prompt for ctx in CONTEXTS for prompt in _families(*ctx)]
    assert len(prompts) == 150
    assert len(set(prompts)) == 150

    live_count = action_count = 0
    for prompt in prompts:
        semantic = analyze_semantic_problem(prompt)
        response = await okkax_copilot_chat_endpoint(
            payload=OkkaxChatIn(message=prompt, history=[], current_route="/"),
            background_tasks=BackgroundTasks(),
            user=None,
        )
        reply = str(response.get("reply") or "").strip()
        lowered = reply.lower()

        assert len(reply) >= 40, prompt
        assert "hasil analisis deterministik okkax" not in lowered, prompt
        assert "policy internal" not in lowered, prompt
        assert "configurable via" not in lowered, prompt
        assert "pipeline_stages" not in lowered, prompt
        assert "/api/" not in lowered, prompt
        assert not re.search(r"\brp\s*0(?:\D|$)", lowered), prompt
        assert not re.search(r"\b(?:event_id|llm_available|reasoning_mode)\b", lowered), prompt

        if semantic["live_data_required"]:
            live_count += 1
            assert response.get("tools_selected") or any(
                term in lowered for term in ("katalog", "belum tersedia", "tidak ditemukan", "quotation", "data live")
            ), prompt
            assert any(term in lowered for term in ("harga", "quotation", "belum tersedia")), prompt

        if semantic["problem_type"] == "action_request":
            action_count += 1
            assert response.get("reasoning_mode") == "action_gate", prompt
            assert any(term in lowered for term in ("konfirmasi", "tidak dieksekusi", "proposal", "draft")), prompt

    assert live_count == 10
    assert action_count == 10


@pytest.mark.parametrize(
    ("prompt", "expected"),
    [
        ("15% dari 800 juta", "Rp120.000.000"),
        ("2,4 miliar dibagi 8", "Rp300.000.000"),
        ("150 juta kali 4", "Rp600.000.000"),
    ],
)
@pytest.mark.anyio
async def test_acceptance_arithmetic_is_exact(monkeypatch, prompt, expected):
    monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")
    response = await okkax_copilot_chat_endpoint(
        payload=OkkaxChatIn(message=prompt, history=[], current_route="/"),
        background_tasks=BackgroundTasks(),
        user=None,
    )
    assert expected in response["reply"]
    assert response.get("reasoning_mode") == "deterministic"


def test_contextual_m_unit_is_consistent_between_parser_and_typed_state():
    history = [
        {"role": "user", "content": "Event outdoor 5k pax di Makassar, budget 1M, produksi premium."},
        {"role": "assistant", "content": "Budget dipahami Rp1 miliar."},
    ]
    initial = reconstruct_conversation_state(history, "")
    assert initial.event_budget == 1_000_000_000

    updated = reconstruct_conversation_state(history, "Ubah budget jadi 950M")
    assert updated.prior_budget == 1_000_000_000
    assert updated.event_budget == 950_000_000
