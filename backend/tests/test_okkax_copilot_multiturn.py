import pytest
from okkax_copilot import build_semantic_plan, merge_multi_turn_state, parse_constraints
from okkax_copilot_selector import select_copilot_response
from okkax_copilot_router import OkkaxSessionContext, route_okkax_query


@pytest.mark.anyio
async def test_multiturn_exact_user_request_flow(monkeypatch):
    monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")

    # Turn 1
    t1_msg = "saya mau buat event di makassar"
    p1 = build_semantic_plan(t1_msg)
    assert p1["entities"]["city"] == "Makassar"

    res1 = await select_copilot_response(t1_msg, history=[], current_route="/")
    assert res1.get("selected_engine") == "V2"
    r1_text = res1.get("reply", "")

    # Turn 2
    history1 = [
        {"role": "user", "content": t1_msg},
        {"role": "assistant", "content": r1_text},
    ]
    t2_msg = "saya ada budget 500 juta tapi saya mau undang noah, bisa ga tuh, berapa sponsor yang saya butuhkan?"
    p2 = merge_multi_turn_state(build_semantic_plan(t2_msg), history1)

    assert p2["entities"]["city"] == "Makassar"
    assert p2["constraints"]["budget"] == 500000000
    assert p2["entities"]["talent_name"] == "Noah"
    assert p2["constraints"]["capacity"] is None  # Unknown, NOT 0

    res2 = await select_copilot_response(t2_msg, history=history1, current_route="/")
    assert res2.get("selected_engine") == "V2"
    r2_text = res2.get("reply", "")

    assert "Makassar" in r2_text
    assert "500,000,000" in r2_text or "500.000.000" in r2_text
    assert "Noah" in r2_text
    assert "belum terverifikasi" in r2_text
    assert "Kapasitas tidak disebut" in r2_text or "unknown" in r2_text.lower()

    # Assert NO internal reasoning labels leak into final reply
    for label in ["[FACT]", "[CALCULATED]", "[ESTIMATE]", "[UNKNOWN]", "[RECOMMENDATION]", "[SIMULATION]"]:
        assert label not in r2_text


@pytest.mark.anyio
async def test_multiturn_budget_addition_and_city_override(monkeypatch):
    monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")

    history = [
        {"role": "user", "content": "saya mau buat event di makassar"},
        {"role": "assistant", "content": "Baik!"},
        {"role": "user", "content": "saya ada budget 500 juta tapi saya mau undang noah, bisa ga tuh, berapa sponsor yang saya butuhkan?"},
        {"role": "assistant", "content": "Baik!"},
    ]

    # Budget addition +200M
    t3_add = "kalau budget saya tambah 200 juta gimana?"
    p3_add = merge_multi_turn_state(build_semantic_plan(t3_add), history)
    assert p3_add["entities"]["city"] == "Makassar"
    assert p3_add["constraints"]["budget"] == 700000000
    assert p3_add["entities"]["talent_name"] == "Noah"

    res3_add = await select_copilot_response(t3_add, history=history, current_route="/")
    assert res3_add.get("selected_engine") == "V2"
    r3_add_text = res3_add.get("reply", "")
    assert "700,000,000" in r3_add_text or "700.000.000" in r3_add_text

    for label in ["[FACT]", "[CALCULATED]", "[ESTIMATE]", "[UNKNOWN]", "[RECOMMENDATION]", "[SIMULATION]"]:
        assert label not in r3_add_text

    # City override to Jakarta
    t3_city = "kalau pindah ke Jakarta?"
    p3_city = merge_multi_turn_state(build_semantic_plan(t3_city), history)
    assert p3_city["entities"]["city"] == "Jakarta"
    assert p3_city["constraints"]["budget"] == 500000000
    assert p3_city["entities"]["talent_name"] == "Noah"

    res3_city = await select_copilot_response(t3_city, history=history, current_route="/")
    assert res3_city.get("selected_engine") == "V2"
    r3_city_text = res3_city.get("reply", "")

    for label in ["[FACT]", "[CALCULATED]", "[ESTIMATE]", "[UNKNOWN]", "[RECOMMENDATION]", "[SIMULATION]"]:
        assert label not in r3_city_text


@pytest.mark.anyio
async def test_grounding_guard_unverified_talent_fee_and_unknown_capacity(monkeypatch):
    monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")

    history = [
        {"role": "user", "content": "saya mau buat event di makassar"},
        {"role": "assistant", "content": "Baik, lokasi Makassar dicatat."},
    ]
    t2_msg = "saya ada budget 500 juta tapi saya mau undang noah, bisa ga tuh, berapa sponsor yang saya butuhkan?"
    res = await select_copilot_response(t2_msg, history=history, current_route="/")
    reply = res.get("reply", "")

    # Grounding guard assertions:
    # 1. State retention
    assert "Makassar" in reply
    assert "500.000.000" in reply or "500,000,000" in reply
    assert "Noah" in reply

    # 2. No fabricated nominal sponsor gap or fake feasibility conclusion
    assert "estimasi Sponsor Gap Rp" not in reply
    assert "estimasi Sponsor Gap 175" not in reply
    assert "secara feasible" not in reply

    # 3. No bogus BEP or fake ticket price calculation
    assert "BEP 1 pax" not in reply
    assert "Break-even: 1 tiket" not in reply

    # 4. Solutif next requirements explained clearly
    assert "Rate card" in reply or "rate card" in reply
    assert "minimum" in reply.lower() or "butuhkan" in reply.lower() or "butuh" in reply.lower()

    # 5. Zero internal labels
    for label in ["[FACT]", "[CALCULATED]", "[ESTIMATE]", "[UNKNOWN]", "[RECOMMENDATION]", "[SIMULATION]"]:
        assert label not in reply

@pytest.mark.anyio
async def test_grounding_guard_generic_talent_and_bep_guards(monkeypatch):
    monkeypatch.setenv("OKKAX_COPILOT_V2_RESPONSE", "true")

    t_msg = "budget 750 juta panggil Sheila on 7 di Bali, berapa sponsornya?"
    res = await select_copilot_response(t_msg, history=[], current_route="/")
    reply = res.get("reply", "")

    assert "Bali" in reply
    assert "750" in reply
    assert "Sheila On 7" in reply or "Sheila on 7" in reply or "Sheila" in reply
    assert "estimasi Sponsor Gap" not in reply
    assert "BEP 1 pax" not in reply
    assert "Break-even: 1 tiket" not in reply

    for label in ["[FACT]", "[CALCULATED]", "[ESTIMATE]", "[UNKNOWN]", "[RECOMMENDATION]", "[SIMULATION]"]:
        assert label not in reply
