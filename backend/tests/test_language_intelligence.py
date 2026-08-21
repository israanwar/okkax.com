"""Focused Language Intelligence V1 tests."""
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from language_intelligence import kbbi_lookup, normalize_user_language
from okkax_copilot import build_semantic_plan, parse_constraints


def test_noisy_event_planning_normalizes_before_semantics():
    result = normalize_user_language(
        "Ssun rcna awal knser live di Jakarta u/ 8.000 org, trmasuk kptusan yg hrus dikunci lbih dlu."
    )
    assert result["raw_text"].startswith("Ssun")
    assert "susun rencana" in result["normalized_text"].lower()
    assert "konser" in result["normalized_text"].lower()
    assert "untuk 8.000 orang" in result["normalized_text"].lower()
    plan = build_semantic_plan(result["normalized_text"])
    assert plan["entities"]["city"] == "Jakarta"
    assert plan["entities"]["event_type"] == "konser"
    assert plan["constraints"]["capacity"] == 8000


def test_slang_and_mixed_language_event_planning():
    result = normalize_user_language("ssun rcna knser jkt u/ 8rb org dong")
    plan = build_semantic_plan(result["normalized_text"])
    assert plan["entities"]["city"] == "Jakarta"
    assert plan["entities"]["event_type"] == "konser"
    assert plan["constraints"]["capacity"] == 8000


def test_breakeven_variants_share_ticketing_meaning():
    plans = [build_semantic_plan(normalize_user_language(text)["normalized_text"]) for text in (
        "Hitung breakeven Regular & VIP",
        "htg BEP reg & vip",
        "itung BE regular sm vip dong",
        "BEP reg vip brp?",
    )]
    assert all(plan["intent"] in ("ANALYTICAL", "KNOWLEDGE") for plan in plans)
    assert all("finance" in plan["domains"] or "ticketing" in plan["domains"] for plan in plans)


def test_contextual_capacity_and_budget_max_constraints():
    venue_result = normalize_user_language("venue jkt yg muat 10rb tp budget gw mentok 250jt ada nda?")
    venue = parse_constraints(venue_result["normalized_text"])
    assert venue["city"] == "Jakarta"
    assert venue["capacity"] == 10000
    assert venue_result["constraint_hints"]["budget_max"] == 250000000
    assert venue_result["constraint_hints"]["capacity_min"] == 10000

    talent = normalize_user_language("talent jangan lebih dari 300jt")["normalized_text"]
    assert "jangan lebih dari" in talent
    talent_result = normalize_user_language("talent jangan lebih dari 300jt")
    assert talent_result["constraint_hints"]["budget_max"] == 300000000


def test_negation_is_preserved():
    sponsor = normalize_user_language("ga usah masukin sponsor")
    outdoor = normalize_user_language("jangan venue outdoor")
    assert "tidak" in sponsor["normalized_text"].lower()
    assert sponsor["constraint_hints"]["exclude_sponsor"] is True
    assert "jangan venue outdoor" in outdoor["normalized_text"].lower()
    assert outdoor["constraint_hints"]["exclude_outdoor"] is True


def test_domain_knowledge_aliases_are_protected():
    result = normalize_user_language("event organiser vs promoter bedanya? EO ngapain? FOH soundcheck")
    text = result["normalized_text"].lower()
    assert "event organizer" in text
    assert "promoter" in text
    assert "foh" in text
    assert "soundcheck" in text


def test_kbbi_lookup_is_read_only_and_non_rewriting():
    result = kbbi_lookup("aktifitas")
    assert result["word"] == "aktifitas"
    assert isinstance(result["synonyms"], list)
    assert isinstance(result["antonyms"], list)
    # Synonyms/antonyms are metadata only; normalization does not substitute them.
    assert normalize_user_language("aktifitas event")["normalized_text"]


def test_arithmetic_input_is_untouched_by_language_module():
    result = normalize_user_language("Rp100 juta - Rp30 juta")
    assert result["raw_text"] == "Rp100 juta - Rp30 juta"
    assert result["normalized_text"] == "Rp100 juta - Rp30 juta"
