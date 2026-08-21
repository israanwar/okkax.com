"""Deterministic OKKAX language normalization before semantic routing.

Language resources are advisory only. Business truth remains in the existing
Copilot parser, calculators, FinancialState, Event Graph, and server data.
"""
from __future__ import annotations

import difflib
import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

DOCS_ROOT = Path(__file__).resolve().parents[1] / "docs"
DATASET_ROOT = DOCS_ROOT / "OKKAX_COPILOT_DATASET_V1"
KBBI_ROOT = DOCS_ROOT / "KBBI-SQL-database-main"

# Explicit meanings win over KBBI and fuzzy recovery.
EXPLICIT_ALIASES = {
    "tdk": "tidak", "tak": "tidak", "gak": "tidak", "ga": "tidak",
    "nggak": "tidak", "ngga": "tidak", "ndak": "tidak", "nda": "tidak",
    "yg": "yang", "dgn": "dengan", "dg": "dengan", "utk": "untuk",
    "u/": "untuk", "sm": "sama", "ama": "sama", "sdh": "sudah",
    "udh": "sudah", "dah": "sudah", "blm": "belum", "blom": "belum",
    "skrg": "sekarang", "skrng": "sekarang", "kmrn": "kemarin",
    "jgn": "jangan", "hrs": "harus", "bsa": "bisa", "kalo": "kalau",
    "klo": "kalau", "klw": "kalau", "gmn": "bagaimana", "knp": "kenapa",
    "napa": "kenapa", "brp": "berapa", "ssun": "susun", "rcna": "rencana",
    "trmasuk": "termasuk", "kptusan": "keputusan", "lbh": "lebih",
    "dlu": "dulu", "jt": "juta", "htg": "hitung",
    "itung": "hitung",
}

DOMAIN_ALIASES = {
    "event promoter": "promoter",
    "event organiser": "event organizer",
    "eo": "event organizer",
    "break even": "break-even",
    "breakeven": "break-even",
    "soundcek": "soundcheck",
    "bep": "break-even",
    "promotr": "promotor",
    "sponsr": "sponsor",
    "knser": "konser",
    "veneu": "venue",
    "jkt": "Jakarta",
    "bdg": "Bandung",
}

PROTECTED_TERMS = {
    "promotor", "promoter", "event promoter", "event organizer", "event organiser",
    "foh", "boh", "bep", "break-even", "rider", "technical rider",
    "hospitality rider", "load-in", "load-out", "soundcheck", "settlement",
    "door open", "show call", "gmv", "dp", "ga", "early bird", "presale",
    "regular", "vip", "vendor", "talent", "artist", "artis", "venue",
    "workforce", "tenant", "sponsor", "sponsorship",
}

FUZZY_TYPO_ALIASES = {
    "sponsr": "sponsor", "promotr": "promotor", "knser": "konser",
    "veneu": "venue", "soundcek": "soundcheck",
}

_TOKEN_RE = re.compile(r"https?://\S+|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|[A-Za-zÀ-ÿ]*\d[\w.,/-]*|[A-Za-zÀ-ÿ]+(?:[-'][A-Za-zÀ-ÿ]+)?|[^\w\s]", re.UNICODE)


def _flatten_mapping(value: Any) -> Dict[str, str]:
    result: Dict[str, str] = {}
    if isinstance(value, dict):
        for key, item in value.items():
            if isinstance(item, str):
                result[str(key).strip().lower()] = item.strip()
            elif isinstance(item, dict):
                result.update(_flatten_mapping(item))
    elif isinstance(value, list):
        for item in value:
            if isinstance(item, dict):
                result.update(_flatten_mapping(item))
    return result


@lru_cache(maxsize=1)
def _load_okkax_lexicon() -> Dict[str, Any]:
    path = DATASET_ROOT / "okkax_language_lexicon_v1.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return {}


@lru_cache(maxsize=1)
def _load_kbbi_resources() -> Dict[str, Any]:
    """Load small JSON mapping exports once; never execute user SQL.

    The repository's KBBI SQL dump is retained as source material. JSON exports
    are preferred for request-safe lazy lookup and the current fallback remains
    fully functional when these files are absent.
    """
    paths = {
        "standard": KBBI_ROOT / "baku-nonbaku/dictionary_baku_nonbaku__JSON.json",
        "synonym": KBBI_ROOT / "sinonim/dictionary_sinonim__JSON.json",
        "antonym": KBBI_ROOT / "antonim/dictionary_antonim__JSON.json",
    }
    out: Dict[str, Any] = {}
    for kind, path in paths.items():
        try:
            out[kind] = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError, TypeError):
            out[kind] = {}
    return out


def _lookup_mapping(mapping: Any, word: str) -> Optional[Any]:
    target = word.lower().strip()
    if isinstance(mapping, dict):
        for key, value in mapping.items():
            if str(key).lower().strip() == target:
                return value
    if isinstance(mapping, list):
        for row in mapping:
            if not isinstance(row, dict):
                continue
            values = {str(k).lower(): v for k, v in row.items()}
            for field in ("nonbaku", "non_baku", "kata_nonbaku", "word", "kata", "term"):
                if str(values.get(field, "")).lower().strip() == target:
                    return row
    return None


def kbbi_lookup(word: str) -> Dict[str, Any]:
    """Read-only standard/synonym/antonym lookup for tests and normalization."""
    resources = _load_kbbi_resources()
    result: Dict[str, Any] = {"word": word, "standard": None, "synonyms": [], "antonyms": [], "definition": None}
    row = _lookup_mapping(resources.get("standard"), word)
    if isinstance(row, str):
        result["standard"] = row
    elif isinstance(row, dict):
        values = {str(k).lower(): v for k, v in row.items()}
        result["standard"] = values.get("baku") or values.get("standard") or values.get("kata_baku")
        result["definition"] = values.get("arti") or values.get("definisi") or values.get("definition")
    for kind, field in (("synonym", "synonyms"), ("antonym", "antonyms")):
        row = _lookup_mapping(resources.get(kind), word)
        if isinstance(row, str):
            result[field] = [row]
        elif isinstance(row, (list, tuple)):
            result[field] = list(row)
        elif isinstance(row, dict):
            values = {str(k).lower(): v for k, v in row.items()}
            raw = values.get("sinonim") or values.get("synonym") or values.get("antonim") or values.get("antonym")
            result[field] = raw if isinstance(raw, list) else ([raw] if raw else [])
    return result


def _resource_aliases() -> Dict[str, str]:
    lexicon = _load_okkax_lexicon()
    aliases: Dict[str, str] = {}
    informal = _flatten_mapping(lexicon.get("informal_indonesian", {}))
    aliases.update({k: v for k, v in informal.items() if k and v})
    aliases.update(_flatten_mapping(lexicon.get("known_typos", {})))
    aliases.update(_flatten_mapping(lexicon.get("contextual_abbreviations", {})))
    aliases.update(EXPLICIT_ALIASES)
    aliases.update(DOMAIN_ALIASES)
    return {str(k).lower(): str(v) for k, v in aliases.items()}


def _protected_or_unsafe(token: str) -> bool:
    low = token.lower()
    return (
        (low in PROTECTED_TERMS and not (low == "ga" and token == "ga")) or token.startswith(("http://", "https://"))
        or "@" in token or any(ch.isdigit() for ch in token)
        or (token[:1].isupper() and token[1:] != token[1:].lower())
    )


def _normalize_org_context(text: str) -> str:
    if re.search(r"\b\d[\d.,]*\s*(?:rb|ribu|k)?\s*(?:pax|penonton|orang|org)\b", text, re.I):
        return re.sub(r"\borg\b", "orang", text, flags=re.I)
    return text


def _apply_aliases(text: str, corrections: list, aliases: list, domain_terms: list) -> str:
    mapping = _resource_aliases()
    protected = set(PROTECTED_TERMS)
    normalized = re.sub(r"(?<!\w)u\s*/(?!\w)", "untuk", text, flags=re.I)
    normalized = re.sub(r"\b(?:be|bep)\s+(?=(?:regular|vip|vvip|presale|early\s+bird)\b)", "break-even ", normalized, flags=re.I)
    for phrase in sorted(DOMAIN_ALIASES, key=len, reverse=True):
        if re.search(rf"(?<!\w){re.escape(phrase)}(?!\w)", normalized, re.I):
            replacement = DOMAIN_ALIASES[phrase]
            normalized = re.sub(rf"(?<!\w){re.escape(phrase)}(?!\w)", replacement, normalized, flags=re.I)
            aliases.append({"raw": phrase, "canonical": replacement})
            domain_terms.append(replacement)
    tokens = _TOKEN_RE.findall(normalized)
    output = []
    for token in tokens:
        low = token.lower()
        if low in protected and not (low == "ga" and token == "ga"):
            output.append(token)
            domain_terms.append(token)
            continue
        replacement = mapping.get(low)
        if replacement and not _protected_or_unsafe(token):
            output.append(replacement)
            if replacement != token:
                corrections.append({"raw": token, "normalized": replacement, "source": "explicit_or_lexicon"})
                aliases.append({"raw": token, "canonical": replacement})
        else:
            output.append(token)
    return " ".join(output).replace(" / ", "/")


def _apply_fuzzy(text: str, corrections: list, ambiguity: list) -> str:
    candidates = tuple(FUZZY_TYPO_ALIASES)
    output = []
    for token in text.split():
        low = token.lower()
        if _protected_or_unsafe(token) or low in PROTECTED_TERMS or len(low) < 4:
            output.append(token)
            continue
        match = difflib.get_close_matches(low, candidates, n=2, cutoff=0.9)
        if len(match) == 1 and match[0] != low:
            replacement = FUZZY_TYPO_ALIASES[match[0]]
            output.append(replacement)
            corrections.append({"raw": token, "normalized": replacement, "source": "conservative_fuzzy"})
        elif len(match) > 1:
            ambiguity.append({"token": token, "candidates": match})
            output.append(token)
        else:
            output.append(token)
    return " ".join(output)


def _extract_constraint_hints(text: str) -> Dict[str, Any]:
    q = text.lower()
    hints: Dict[str, Any] = {"budget_max": None, "capacity_min": None, "exclude_sponsor": False, "exclude_outdoor": False}
    max_cue = r"(?:maksimal|max|mentok|jangan\s+lebih\s+dari|tidak\s+lebih\s+dari|ga\s+boleh\s+di\s+atas|under|<=)"
    money = r"(?:rp\s*)?(\d{1,3}(?:\.\d{3})+|\d+(?:[\.,]\d+)?)\s*(miliar|milyar|juta|jt|ribu|rb|m|b|k)\b"
    match = re.search(max_cue + r"[^.!?]{0,30}?" + money, q)
    if match:
        value, unit = match.group(1), match.group(2).lower()
        multipliers = {"m": 1_000_000, "juta": 1_000_000, "jt": 1_000_000, "miliar": 1_000_000_000, "milyar": 1_000_000_000, "b": 1_000_000_000, "ribu": 1_000, "rb": 1_000, "k": 1_000}
        try:
            number = float(value.replace(".", "") if "." in value and len(value.rsplit(".", 1)[-1]) == 3 else value.replace(",", "."))
            hints["budget_max"] = int(number * multipliers[unit])
        except (ValueError, KeyError):
            pass
    capacity = re.search(r"(?:muat|kapasitas|minimal|setidaknya)\s*(\d+(?:[\.,]\d+)?)\s*(rb|ribu|k)?\s*(?:pax|penonton|orang|org)?", q)
    if capacity:
        number = float(capacity.group(1).replace(".", "") if "." in capacity.group(1) and len(capacity.group(1).rsplit(".", 1)[-1]) == 3 else capacity.group(1).replace(",", "."))
        if capacity.group(2):
            number *= 1000
        hints["capacity_min"] = int(number)
    hints["exclude_sponsor"] = bool(re.search(r"\b(?:tidak|ga|gak|nggak)\b[^.!?]{0,24}\bsponsor(?:ship)?\b", q))
    hints["exclude_outdoor"] = bool(re.search(r"\bjangan\b[^.!?]{0,24}\bvenue\s+outdoor\b", q))
    return hints


def normalize_user_language(raw_text: str, conversation_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    raw = "" if raw_text is None else str(raw_text)
    cleaned = unicodedata.normalize("NFKC", raw).replace("\u00a0", " ")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    corrections: list = []
    aliases: list = []
    domain_terms: list = []
    ambiguity: list = []
    normalized = _normalize_org_context(cleaned)
    normalized = _apply_aliases(normalized, corrections, aliases, domain_terms)
    normalized = _apply_fuzzy(normalized, corrections, ambiguity)
    normalized = re.sub(
        r"\b(muat|kapasitas)\s+(\d+(?:[\.,]\d+)?)\s*(rb|ribu|k)\b(?!\s*(?:pax|penonton|orang))",
        r"\1 \2 \3 orang",
        normalized,
        flags=re.I,
    )
    normalized = re.sub(r"\s+([,?.!])", r"\1", normalized)
    confidence = 1.0 if not ambiguity else 0.75
    if corrections:
        confidence = min(confidence, 0.98)
    return {
        "raw_text": raw,
        "normalized_text": normalized,
        "corrections": corrections,
        "aliases": aliases,
        "domain_terms": sorted(set(str(x).lower() for x in domain_terms)),
        "confidence": confidence,
        "ambiguity": ambiguity,
        "constraint_hints": _extract_constraint_hints(normalized),
    }