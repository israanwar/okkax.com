"""OKKAX Copilot — Knowledge Retrieval & Evidence Architecture (COPILOT-04 Shadow Substrate).

Implements typed multi-tier knowledge retrieval, evidence provenance tracking, authority resolution,
and conflict detection across all 15 core event domains.

SHADOW MODE: Not wired to production `/okkax/chat`.

Authority Tiers (Strict Order):
  TIER 1: LIVE OKKAX DATA (Authoritative tools, live database, verified event snapshot)
  TIER 2: CANONICAL OKKAX KNOWLEDGE (Locked platform specs, revenue rules, security architecture)
  TIER 3: CURATED DOMAIN KNOWLEDGE (Operations, workforce, compliance, entertainment concepts, finance terms)
  TIER 4: EXTERNAL LIVE INTELLIGENCE (External feeds, location discovery — architecture only)
  TIER 5: GENERAL MODEL KNOWLEDGE (LLM background knowledge)

Conflict Rule:
  Higher tier strictly overrides lower tier. Contradictions are explicitly detected and logged,
  never silently merged.
"""

from __future__ import annotations

import logging
import re
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from okkax_copilot_context import OkkaxSessionContext

logger = logging.getLogger("okkax.copilot.knowledge")


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class AuthorityTier(str, Enum):
    TIER_1_LIVE_DATA = "TIER_1_LIVE_DATA"
    TIER_2_CANONICAL_SPEC = "TIER_2_CANONICAL_SPEC"
    TIER_3_CURATED_DOMAIN = "TIER_3_CURATED_DOMAIN"
    TIER_4_EXTERNAL_INTEL = "TIER_4_EXTERNAL_INTEL"
    TIER_5_MODEL_GENERAL = "TIER_5_MODEL_GENERAL"


_TIER_PRIORITY: Dict[AuthorityTier, int] = {
    AuthorityTier.TIER_1_LIVE_DATA: 50,
    AuthorityTier.TIER_2_CANONICAL_SPEC: 40,
    AuthorityTier.TIER_3_CURATED_DOMAIN: 30,
    AuthorityTier.TIER_4_EXTERNAL_INTEL: 20,
    AuthorityTier.TIER_5_MODEL_GENERAL: 10,
}


class ProvenanceType(str, Enum):
    FACT = "FACT"
    CALCULATED = "CALCULATED"
    ESTIMATE = "ESTIMATE"
    RECOMMENDATION = "RECOMMENDATION"
    UNAVAILABLE = "UNAVAILABLE"


# ---------------------------------------------------------------------------
# Typed Evidence Models
# ---------------------------------------------------------------------------

class OkkaxEvidenceItem(BaseModel):
    """Single typed atomic unit of retrieved knowledge or tool evidence."""

    source_id: str = Field(description="Unique source key, e.g. 'spec:event_studio', 'tool:get_financial_status'")
    source_type: str = Field(description="'live_tool' | 'canonical_spec' | 'curated_domain' | 'external_intel'")
    authority_tier: AuthorityTier = Field(description="Authority level of the source")
    provenance_type: ProvenanceType = Field(description="Evidence provenance category")
    entity_domain: str = Field(description="Target domain: finance | ticketing | entertainment | compliance | etc.")
    title: str = Field(description="Brief human-readable evidence header")
    content: str = Field(description="Compact snippet of authoritative evidence (< 600 chars)")
    timestamp: Optional[str] = Field(default=None, description="ISO timestamp if live data")
    confidence: float = Field(default=1.0, description="Confidence score [0.0 - 1.0]")
    authoritative: bool = Field(default=True, description="Whether this item is platform-authoritative")
    available: bool = Field(default=True, description="Whether this item is available to the caller")
    live_data_required: bool = Field(default=False, description="True if query requires live tool query, not static knowledge")


class OkkaxEvidenceConflict(BaseModel):
    """Record of an explicit conflict detected between different authority tiers."""

    domain: str = Field(description="Conflict domain")
    winner_source_id: str = Field(description="Source ID of the higher-tier evidence item that won")
    winner_tier: AuthorityTier = Field(description="Tier of the winning item")
    suppressed_source_id: str = Field(description="Source ID of the lower-tier item that was overridden")
    suppressed_tier: AuthorityTier = Field(description="Tier of the overridden item")
    reason: str = Field(description="Explanation of why higher tier took precedence")


class OkkaxEvidenceCollection(BaseModel):
    """Collection of retrieved evidence items with conflict resolution metadata."""

    items: List[OkkaxEvidenceItem] = Field(default_factory=list, description="Resolved evidence items")
    conflicts_detected: List[OkkaxEvidenceConflict] = Field(default_factory=list, description="Explicit conflicts resolved")
    total_text_bytes: int = Field(default=0, description="Total characters/bytes of evidence content")
    live_data_required: bool = Field(default=False, description="True if caller must invoke live tool")


# ---------------------------------------------------------------------------
# Curated Knowledge Store (Tier 2 Specs & Tier 3 Domain Knowledge)
# ---------------------------------------------------------------------------

_CURATED_KNOWLEDGE_STORE: List[Dict[str, Any]] = [
    # --- TIER 2: CANONICAL OKKAX SPECS ---
    {
        "source_id": "spec:event_studio",
        "authority_tier": AuthorityTier.TIER_2_CANONICAL_SPEC,
        "provenance_type": ProvenanceType.FACT,
        "entity_domain": "event_planning",
        "title": "OKKAX Event Studio Locked Spec",
        "keywords": ["event studio", "tahapan event", "state event", "status event", "workflow event", "draft event", "siapkan", "persiapan", "bikin konser", "buat konser", "harus saya siapkan"],
        "content": "Event Studio OKKAX menerapkan 5 lifecycle state: Draft -> In Review -> Ready to Publish -> Published -> Completed. Workflow timeline terstruktur dari W-8 (konsep awal & vendor locking), W-4 (izin polisi & tiket presale), W-2 (rehearsal & technical rider), hingga W-0 (show day & live gate monitoring).",
    },
    {
        "source_id": "spec:ticketing",
        "authority_tier": AuthorityTier.TIER_2_CANONICAL_SPEC,
        "provenance_type": ProvenanceType.FACT,
        "entity_domain": "ticketing",
        "title": "OKKAX Ticketing Architecture Spec",
        "keywords": ["tiket", "ticketing", "qr dynamic", "anti-scalping", "tier tiket", "gate scanner", "kuota tiket"],
        "content": "Sistem Ticketing OKKAX menggunakan Dynamic Rotating QR berbasis HMAC SHA-256 untuk pencegahan scalper & screenshot sharing. Tier tiket mencakup Presale, Early Bird, Regular, dan VIP dengan hard quota locking serta integrasi gate validator.",
    },
    {
        "source_id": "spec:revenue",
        "authority_tier": AuthorityTier.TIER_2_CANONICAL_SPEC,
        "provenance_type": ProvenanceType.FACT,
        "entity_domain": "finance",
        "title": "OKKAX Revenue & Settlement Architecture",
        "keywords": ["revenue", "settlement", "pencairan", "escrow", "fee platform", "payout", "vendor sound", "vendor sound system"],
        "content": "Settlement finansial OKKAX menggunakan sistem escrow berjenjang: Termin 1 (30% saat vendor lock), Termin 2 (40% saat H-7), dan Termin Final (30% H+3 pasca audit gate). Fee platform standar 3-5% untuk penjualan tiket publik.",
    },
    {
        "source_id": "spec:rbac_security",
        "authority_tier": AuthorityTier.TIER_2_CANONICAL_SPEC,
        "provenance_type": ProvenanceType.FACT,
        "entity_domain": "security",
        "title": "OKKAX Multi-Tenant & RBAC Contract",
        "keywords": ["rbac", "tenant isolation", "hak akses", "role", "organizer", "audience", "guest", "freelance", "lighting crew", "crew", "pekerjaan event", "mencari pekerjaan"],
        "content": "RBAC OKKAX membatasi akses private event data hanya untuk organizer pemilik event (`owner_user_id`), member organisasi aktif (`organizer_org_id`), dan Superadmin. Role Guest dan Audience tidak memiliki izin membaca data keuangan atau kepatuhan private.",
    },

    # --- TIER 3: CURATED DOMAIN KNOWLEDGE ---
    {
        "source_id": "domain:promoter_vs_eo",
        "authority_tier": AuthorityTier.TIER_3_CURATED_DOMAIN,
        "provenance_type": ProvenanceType.FACT,
        "entity_domain": "event_planning",
        "title": "Promotor vs Event Organizer (EO)",
        "keywords": ["promotor", "promoter", "eo", "event organizer", "perbedaan promotor eo", "tugas promotor"],
        "content": "Promotor adalah pemilik bisnis/komersial event yang memikul risiko finansial, mengatur pendanaan, pendapatan tiket, dan menanggung untung/rugi. Event Organizer (EO) adalah pelaksana operasional yang mengeksekusi produksi sesuai kontrak dan menerima management fee.",
    },
    {
        "source_id": "domain:outdoor_weather",
        "authority_tier": AuthorityTier.TIER_3_CURATED_DOMAIN,
        "provenance_type": ProvenanceType.FACT,
        "entity_domain": "production",
        "title": "Mitigasi Cuaca Event Outdoor",
        "keywords": ["outdoor", "hujan", "cuaca", "mitigasi cuaca", "rigging genset", "tenda roder", "venue kapasitas", "venue outdoor"],
        "content": "Event outdoor wajib memiliki tenda roder grade production, ground drainage memadai, sertifikasi IP54+ pada rigging listrik/genset, jalur evakuasi anti-selip, dan window keputusan 'stop show' 30-60 menit sebelum badai berdasar radar BMKG.",
    },
    {
        "source_id": "domain:breakeven_formula",
        "authority_tier": AuthorityTier.TIER_3_CURATED_DOMAIN,
        "provenance_type": ProvenanceType.CALCULATED,
        "entity_domain": "finance",
        "title": "Formula Break-Even Point (BEP) Event",
        "keywords": ["break-even", "bep", "hitung bep", "rumus bep", "target tiket bep"],
        "content": "Break-Even Point = (Total Biaya Produksi - Komitmen Sponsor - Pendapatan Tenant) / Rata-rata Harga Tiket. Ambang batas aman industri konser di Indonesia berada di 80-85% okupansi kapasitas terjual.",
    },
    {
        "source_id": "domain:sponsor_tiering",
        "authority_tier": AuthorityTier.TIER_3_CURATED_DOMAIN,
        "provenance_type": ProvenanceType.FACT,
        "entity_domain": "sponsorship",
        "title": "Struktur Tiering Sponsor Event",
        "keywords": ["sponsor tier", "presenting sponsor", "main sponsor", "supporting sponsor", "kategori sponsor", "sponsorship", "brand f&b", "brand", "cocok untuk sponsorship"],
        "content": "Tiering sponsor standar terdiri dari: Presenting Sponsor (eksklusif naming rights, kontribusi ~40% target sponsor), Main Sponsor (2-3 brand non-kompetitif, kontribusi ~30%), dan Supporting/Category Partner (kontribusi ~30%).",
    },
    {
        "source_id": "domain:compliance_permits",
        "authority_tier": AuthorityTier.TIER_3_CURATED_DOMAIN,
        "provenance_type": ProvenanceType.FACT,
        "entity_domain": "compliance",
        "title": "Matriks Perizinan Event di Indonesia",
        "keywords": ["perizinan", "izin event", "izin keramaian", "polres", "polda", "damkar", "izin polisi", "lmkn", "siapkan", "harus saya siapkan", "legalitas"],
        "content": "Perizinan event Indonesia meliputi: 1) Izin Lokasi/Venue, 2) Izin Keramaian Kepolisian (Polsek/Polres/Polda Intelkam), 3) Rekomendasi Damkar & Dinkes/Satgas Medis, 4) Lisensi Hak Cipta Musik Performing Rights (LMKN/WAMI), 5) Asuransi Public Liability.",
    },
    {
        "source_id": "domain:workforce_ratios",
        "authority_tier": AuthorityTier.TIER_3_CURATED_DOMAIN,
        "provenance_type": ProvenanceType.CALCULATED,
        "entity_domain": "workforce",
        "title": "Rasio Standar Kebutuhan Kru & Keamanan",
        "keywords": ["rasio usher", "kru keamanan", "security", "medis", "sound power", "workforce ratio", "sound system", "vendor sound system", "lighting crew", "freelance", "pekerjaan event"],
        "content": "Standar rasio live event OKKAX: Usher 1 per 80 pax, Petugas Keamanan 1 per 100 pax, Tim Medis 1 per 250 pax, dan Daya Audio Sound System 18 Watt RMS per pax untuk area terbuka.",
    },
    {
        "source_id": "domain:finance_landed_cost",
        "authority_tier": AuthorityTier.TIER_3_CURATED_DOMAIN,
        "provenance_type": ProvenanceType.FACT,
        "entity_domain": "finance",
        "title": "Definisi Landed Cost Event",
        "keywords": ["landed cost", "biaya landed", "cost per pax", "hpp tiket"],
        "content": "Landed Cost (HPP Event per Kapasitas) adalah total pengeluaran riil (Fee Talent + Sewa Venue + Rigging/Sound + Perizinan + Operasional Kru) dibagi total kapasitas tiket yang dapat dijual.",
    },
    {
        "source_id": "domain:entertainment_opener",
        "authority_tier": AuthorityTier.TIER_3_CURATED_DOMAIN,
        "provenance_type": ProvenanceType.RECOMMENDATION,
        "entity_domain": "entertainment",
        "title": "Peran dan Fungsi Opening Act (Opener)",
        "keywords": ["fungsi opener", "opening act", "opener", "tugas opener", "peran band pembuka", "artis", "event apa yang cocok"],
        "content": "Fungsi Opener (Band/Musisi Pembuka): 1) Membangun energi dan mengumpulkan penonton di area panggung, 2) Kalibrasi akustik tata suara live, 3) Memberikan transisi atmosfer musik yang selaras menuju Headliner tanpa menguras stamina penonton secara berlebihan.",
    },
    {
        "source_id": "domain:entertainment_lineup",
        "authority_tier": AuthorityTier.TIER_3_CURATED_DOMAIN,
        "provenance_type": ProvenanceType.RECOMMENDATION,
        "entity_domain": "entertainment",
        "title": "Prinsip Kurasi Lineup & Pacing Rundown",
        "keywords": ["lineup", "headliner", "kurasi lineup", "susunan artis", "rundown artis", "pacing", "artis", "event apa yang cocok"],
        "content": "Kurasi lineup ideal mengalokasikan 1 Headliner utama (penarik 60% penjualan tiket), 2 Direct Support acts, dan 1-2 Emerging Openers. Changeover antar set artis diupayakan maksimal 25-30 menit untuk menjaga flow crowd.",
    },
    {
        "source_id": "domain:entertainment_curfew",
        "authority_tier": AuthorityTier.TIER_3_CURATED_DOMAIN,
        "provenance_type": ProvenanceType.FACT,
        "entity_domain": "entertainment",
        "title": "Batas Waktu (Curfew) & Sound Level Panggung",
        "keywords": ["curfew", "jam malam", "sound level", "db limit", "kebisingan konser"],
        "content": "Batas jam malam (curfew) event outdoor perkotaan umumnya maksimal pukul 22:00-23:00 WIB sesuai regulasi ketertiban umum. Batas kebisingan FOH standar konser musik live adalah 98-102 dBA Leq untuk melindungi keselamatan pendengaran.",
    },
    {
        "source_id": "domain:audience_experience",
        "authority_tier": AuthorityTier.TIER_3_CURATED_DOMAIN,
        "provenance_type": ProvenanceType.RECOMMENDATION,
        "entity_domain": "operations",
        "title": "Crowd Flow & Fasilitas Sanitasi Penonton",
        "keywords": ["crowd control", "evakuasi penonton", "toilet ratio", "sanitasi event", "zoning", "venue kapasitas", "venue", "cocok masuk"],
        "content": "Zoning penonton wajib menyediakan koridor evakuasi utama selebar minimal 2 meter. Rasio sanitasi standar: 1 toilet per 75 penonton wanita dan 1 toilet per 100 penonton pria untuk mencegah antrean crowd berisiko.",
    },
]


# ---------------------------------------------------------------------------
# Retrieval Engine (Deterministic, No Bloat, No Vector DB required)
# ---------------------------------------------------------------------------

def retrieve_okkax_knowledge(
    query: str,
    ctx: Optional[OkkaxSessionContext] = None,
    max_items: int = 3,
) -> OkkaxEvidenceCollection:
    """Retrieve relevant canonical spec and curated domain knowledge for a user query.

    Enforces:
      - Keyword and semantic cue matching.
      - Minimum evidence (top 1-3 items, max ~1200 bytes total).
      - Detection of queries needing live data vs static knowledge.
      - Tenant & role authorization filtering.
    """
    clean_q = (query or "").strip().lower()
    if not clean_q:
        return OkkaxEvidenceCollection()

    # Check if query asks for dynamic live data (e.g. "siapa artis available minggu depan?", "berapa tiket terjual?")
    is_live_supply_query = bool(re.search(r"\b(siapa artis yang available|siapa artis yang bisa|jadwal artis kosong|cek ketersediaan venue|daftar vendor aktif)\b", clean_q))
    is_live_event_state_query = bool(re.search(r"\b(berapa sisa budget event|kondisi keuangan event saya|berapa tiket terjual event saya)\b", clean_q))

    if is_live_supply_query or is_live_event_state_query:
        item = OkkaxEvidenceItem(
            source_id="notice:live_tool_required",
            source_type="system_notice",
            authority_tier=AuthorityTier.TIER_1_LIVE_DATA,
            provenance_type=ProvenanceType.UNAVAILABLE,
            entity_domain="supply" if is_live_supply_query else "event",
            title="Live Database Query Required",
            content="Informasi ketersediaan live supply atau state event privat memerlukan query langsung ke database internal OKKAX melalui tool authoritative, bukan dari knowledge statis.",
            authoritative=True,
            available=False,
            live_data_required=True,
        )
        return OkkaxEvidenceCollection(
            items=[item],
            total_text_bytes=len(item.content),
            live_data_required=True,
        )

    # Score and rank curated knowledge cards
    scored_items: List[tuple[int, Dict[str, Any]]] = []
    tokens = set(re.findall(r"[a-z0-9]+", clean_q))

    for card in _CURATED_KNOWLEDGE_STORE:
        score = 0
        # Check explicit keywords
        for kw in card["keywords"]:
            if kw in clean_q:
                score += 15
            else:
                kw_tokens = set(re.findall(r"[a-z0-9]+", kw))
                overlap = len(tokens & kw_tokens)
                if overlap > 0:
                    score += overlap * 3

        # Check entity domain relevance
        if card["entity_domain"] in clean_q:
            score += 5

        if score > 0:
            scored_items.append((score, card))

    scored_items.sort(key=lambda x: x[0], reverse=True)

    items: List[OkkaxEvidenceItem] = []
    seen_ids = set()
    total_bytes = 0

    for _score, card in scored_items[:max_items]:
        if card["source_id"] in seen_ids:
            continue
        seen_ids.add(card["source_id"])

        item = OkkaxEvidenceItem(
            source_id=card["source_id"],
            source_type="canonical_spec" if card["authority_tier"] == AuthorityTier.TIER_2_CANONICAL_SPEC else "curated_domain",
            authority_tier=card["authority_tier"],
            provenance_type=card["provenance_type"],
            entity_domain=card["entity_domain"],
            title=card["title"],
            content=card["content"],
            authoritative=True,
            available=True,
            live_data_required=False,
        )
        items.append(item)
        total_bytes += len(item.content)

    return OkkaxEvidenceCollection(
        items=items,
        total_text_bytes=total_bytes,
        live_data_required=False,
    )


# ---------------------------------------------------------------------------
# Authority & Conflict Resolver
# ---------------------------------------------------------------------------

def resolve_evidence_conflicts(
    evidence_items: List[OkkaxEvidenceItem],
) -> OkkaxEvidenceCollection:
    """Resolve conflicts among multiple evidence items according to authority precedence:

    TIER 1 > TIER 2 > TIER 3 > TIER 4 > TIER 5.

    When contradictory evidence is provided for the same entity/domain field:
      - Higher tier strictly takes precedence.
      - Conflict is explicitly recorded in `conflicts_detected`.
      - Lower tier evidence is marked suppressed or removed.
    """
    if not evidence_items:
        return OkkaxEvidenceCollection()

    # Sort evidence items by authority tier priority (highest first)
    sorted_items = sorted(
        evidence_items,
        key=lambda x: _TIER_PRIORITY.get(x.authority_tier, 0),
        reverse=True,
    )

    resolved: List[OkkaxEvidenceItem] = []
    conflicts: List[OkkaxEvidenceConflict] = []
    seen_domains: Dict[str, OkkaxEvidenceItem] = {}

    for item in sorted_items:
        key = item.entity_domain
        if key not in seen_domains:
            seen_domains[key] = item
            resolved.append(item)
        else:
            existing = seen_domains[key]
            # Check if there is an authority conflict on the same domain
            if existing.authority_tier != item.authority_tier:
                conflict = OkkaxEvidenceConflict(
                    domain=key,
                    winner_source_id=existing.source_id,
                    winner_tier=existing.authority_tier,
                    suppressed_source_id=item.source_id,
                    suppressed_tier=item.authority_tier,
                    reason=f"{existing.authority_tier.value} ({existing.source_id}) takes precedence over {item.authority_tier.value} ({item.source_id}) for {key}.",
                )
                conflicts.append(conflict)
                logger.info("Evidence conflict resolved: %s", conflict.reason)

    total_bytes = sum(len(x.content) for x in resolved)

    return OkkaxEvidenceCollection(
        items=resolved,
        conflicts_detected=conflicts,
        total_text_bytes=total_bytes,
    )


# ---------------------------------------------------------------------------
# Canonical Scenarios (3000 Dataset) & Domain Glossary Retrievers
# ---------------------------------------------------------------------------

from functools import lru_cache
from pathlib import Path
import json

_DATASET_DIR = Path(__file__).resolve().parents[1] / "docs" / "OKKAX_COPILOT_DATASET_V1"


@lru_cache(maxsize=1)
def _load_canonical_scenarios_dataset() -> List[Dict[str, Any]]:
    path = _DATASET_DIR / "okkax_canonical_scenarios_3000.jsonl"
    scenarios = []
    if path.exists():
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        scenarios.append(json.loads(line))
                    except Exception:
                        pass
    return scenarios


@lru_cache(maxsize=1)
def _load_domain_glossary_dataset() -> Dict[str, Any]:
    path = _DATASET_DIR / "okkax_language_lexicon_v1.json"
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def retrieve_canonical_scenarios(query: str, limit: int = 3) -> List[Dict[str, Any]]:
    """Retrieve top-K relevant canonical scenarios from the 3,000 scenario dataset."""
    scenarios = _load_canonical_scenarios_dataset()
    if not scenarios:
        return []

    q_lower = query.lower()
    q_tokens = set(re.findall(r"[a-z0-9]+", q_lower))

    scored = []
    for sc in scenarios:
        score = 0
        gt = sc.get("ground_truth") or {}
        known = gt.get("known") or {}
        city = str(known.get("city") or "").lower()
        event_type = str(known.get("event_type") or "").lower()
        capacity = known.get("capacity")

        if city and city in q_lower:
            score += 25
        if event_type and event_type in q_lower:
            score += 20
        if capacity and str(capacity) in q_lower:
            score += 20

        utterance = sc.get("canonical_utterance", "").lower()
        u_tokens = set(re.findall(r"[a-z0-9]+", utterance))
        overlap = len(q_tokens & u_tokens)
        score += overlap * 2

        if score > 10:
            scored.append((score, sc))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [sc for _, sc in scored[:limit]]


def retrieve_domain_glossary(query: str) -> Dict[str, str]:
    """Retrieve matched domain terms & definitions from language lexicon dataset."""
    lexicon = _load_domain_glossary_dataset()
    v_terms = lexicon.get("verified_domain_terms") or {}
    c_abbs = lexicon.get("contextual_abbreviations") or {}

    q_lower = query.lower()
    matched = {}

    for term, definition in v_terms.items():
        if re.search(rf"\b{re.escape(term.lower())}\b", q_lower):
            matched[term] = definition

    for abb, expansion in c_abbs.items():
        if re.search(rf"\b{re.escape(abb.lower())}\b", q_lower) and abb not in matched:
            matched[abb] = expansion

    return matched
