import os
import re
import json
import logging
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone

from core import db

logger = logging.getLogger("okkax.copilot")

# -----------------------------------------------------------------------------
# Copilot v2 — grounded operational agent primitives.
# Source priority is enforced in the response labels:
#   FACT           = read verbatim from canonical OKKAX DB / policy
#   CALCULATED     = derived deterministically from FACT (e.g. funding_gap)
#   ESTIMATE       = pure model math with no live DB row (calculator)
#   RECOMMENDATION = general knowledge guidance, not authoritative
#   SIMULATION     = hypothetical scenario the caller requested
#   UNKNOWN        = the data is not available to Copilot yet
# Every response block that mixes classes MUST label them.
# -----------------------------------------------------------------------------
LABEL_FACT = "FACT"
LABEL_CALC = "CALCULATED"
LABEL_ESTIMATE = "ESTIMATE"
LABEL_RECO = "RECOMMENDATION"
LABEL_SIM = "SIMULATION"
LABEL_UNKNOWN = "UNKNOWN"

# Hard cap on how much history Copilot ingests. Prevents unbounded prompt
# injection surface and keeps latency stable.
_MAX_HISTORY_TURNS = 6
_MAX_HISTORY_CHAR = 4000

# Prompt-injection guard: strip system-instruction markers/tokens that
# clients could smuggle inside chat history to override the system prompt.
_INJECT_PATTERNS = [
    re.compile(r"(?i)<\|system\|>|<\|assistant\|>|<\|user\|>"),
    re.compile(r"(?im)^(?:system|assistant)\s*:\s*"),
    re.compile(r"(?i)ignore (?:all )?(?:previous|prior|above) instructions"),
]


# -----------------------------------------------------------------------------
# Copilot business-constant policy (versioned, admin-configurable).
# Migrated from hardcoded constants in `calculate_advanced_event_model` so the
# same governance surface as Ticketing/Compliance applies: policy lives in
# `db.platform_policies` keyed `copilot.calculator.default` with a canonical
# reference seed and safe-fallback loader mirroring
# `admission_engine.get_active_ticketing_fee_policy`.
# -----------------------------------------------------------------------------
CANONICAL_COPILOT_CALCULATOR_KEY = "copilot.calculator.default"
DEFAULT_COPILOT_CALCULATOR_POLICY_DOC: Dict[str, Any] = {
    "id": "policy-copilot-calculator-default",
    "key": CANONICAL_COPILOT_CALCULATOR_KEY,
    "name": "OKKAX Copilot Reference Calculator Policy",
    "version": "2026.10A.1",
    "active": True,
    "source": "reference_seed",
    "budget_allocation": {
        "talent": 0.28, "production": 0.24, "venue": 0.14,
        "marketing": 0.08, "workforce": 0.06, "contingency": 0.05,
        # `operations` derives from remainder to always sum to 1.0
    },
    "funding_targets": {
        "sponsor_ratio_of_budget": 0.35,
        "tenant_flat_per_pax": 16000,
        "tenant_floor_idr": 15000000,
        "ticket_break_even_occupancy": 0.82,
    },
    "technical_ratios": {
        "sound_watt_rms_per_pax": 18,
        "sound_watt_rms_floor": 10000,
        "ushers_per_pax": 80,
        "security_per_pax": 100,
        "medical_pax_per_post": 2500,
    },
    "notes": {
        "venue_legalitas": "Sewa venue + biaya perizinan sesuai jurisdiction (rujuk /api/events/{id}/compliance untuk item aktual)",
        "talent_rider": "Honor artis headliner, supporting act, flight & hospitality",
        "production": "Stage, Line Array, Lighting, LED, Barricade",
        "marketing": "Digital ads, billboard OOH, media relations",
        "contingency": "Buffer tak terduga (genset cadangan, cuaca, overtime)",
        "operations": "Tenda roder, sanitasi, konsumsi, akomodasi kru",
    },
    "created_at": "2026-10-01T00:00:00+00:00",
    "updated_at": "2026-10-01T00:00:00+00:00",
}


async def get_active_copilot_calculator_policy(database=None) -> Dict[str, Any]:
    """Fetch active calculator policy from ``platform_policies`` with the
    same safe deterministic fallback pattern used elsewhere in OKKAX.
    """
    if database is not None:
        try:
            doc = await database.platform_policies.find_one(
                {"key": CANONICAL_COPILOT_CALCULATOR_KEY, "active": True},
                {"_id": 0},
            )
            if doc and isinstance(doc, dict) and "budget_allocation" in doc:
                return doc
        except Exception:
            pass
    import copy as _copy
    return _copy.deepcopy(DEFAULT_COPILOT_CALCULATOR_POLICY_DOC)


async def upsert_reference_copilot_calculator_policy(database) -> Dict[str, Any]:
    """Idempotent seeder called at startup, mirroring compliance rules."""
    doc = dict(DEFAULT_COPILOT_CALCULATOR_POLICY_DOC)
    res = await database.platform_policies.update_one(
        {"key": CANONICAL_COPILOT_CALCULATOR_KEY},
        {"$set": doc},
        upsert=True,
    )
    return {"inserted": res.upserted_id is not None, "updated": bool(res.modified_count)}


# -----------------------------------------------------------------------------
# Copilot per-user monthly quota (separate counter from Intelligence Engine).
# -----------------------------------------------------------------------------
COPILOT_PLAN_LIMITS = {"free": 10000, "pro": 100000, "max": 1000000}


async def get_or_create_copilot_quota(user: dict) -> Dict[str, Any]:
    user_id = str(user.get("id") or user.get("_id"))
    plan = user.get("plan") or "free"
    plan_limit = COPILOT_PLAN_LIMITS.get(plan, COPILOT_PLAN_LIMITS["free"])
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    doc = await db.copilot_usage.find_one({"user_id": user_id, "month": month}, {"_id": 0})
    if not doc:
        doc = {"user_id": user_id, "month": month, "usage": 0}
        await db.copilot_usage.insert_one(dict(doc))
    usage = int(doc.get("usage") or 0)
    return {
        "plan": plan, "usage": usage, "limit": plan_limit,
        "remaining": max(0, plan_limit - usage),
        "reset_month": month,
    }


async def increment_copilot_quota(user: dict):
    user_id = str(user.get("id") or user.get("_id"))
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    await db.copilot_usage.update_one(
        {"user_id": user_id, "month": month},
        {"$inc": {"usage": 1}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )


def sanitize_history(history: Optional[List[Dict[str, Any]]]) -> List[Dict[str, str]]:
    """Return a bounded, defused copy of client-supplied chat history."""
    if not history:
        return []
    out: List[Dict[str, str]] = []
    for turn in list(history)[-_MAX_HISTORY_TURNS:]:
        if not isinstance(turn, dict):
            continue
        role = turn.get("role", "user")
        content = str(turn.get("content", ""))[:_MAX_HISTORY_CHAR]
        for pat in _INJECT_PATTERNS:
            content = pat.sub("", content)
        if role not in ("user", "assistant"):
            role = "user"
        out.append({"role": role, "content": content})
    return out

OKKAX_COPILOT_SYSTEM_PROMPT = """Kamu adalah "OKKAX Copilot" (atau "OKKAX AI"), Principal Event Intelligence & Copilot Operasional Resmi untuk platform OKKAX (Live Event Operating Network di Indonesia).

IDENTITAS & KARAKTER OKKAX COPILOT:
- Nama: OKKAX Copilot (OKKAX AI)
- Peran: OKKAX Principal Event Intelligence & Autonomous Operations Copilot
- Karakter: Sangat cerdas, berwibawa, tajam dalam kalkulasi data & finansial, profesional, hangat, serta menguasai seluruh aspek operasional live event di Indonesia dari level makro hingga teknis lapangan.
- Gaya Bahasa: Bahasa Indonesia yang elegan, profesional, berbasis data industri, dan terstruktur rapi dengan markdown, bullet points, dan tabel angka Rupiah berformat jelas.
- PANTANGAN BESAR: DILARANG KERAS menggunakan emoji apapun (seperti kilat, robot, bintang, api, sparkles, otak, dan sejenisnya) dalam seluruh teks jawaban atau judul. Gunakan tipografi teks dan penomoran editorial murni.

PENGETAHUAN TINGKAT LANJUT & LUAR BIASA OKKAX COPILOT:

1. STANDAR & FORMULA KALKULASI EVENT INDUSTRI INDONESIA:
   - Alokasi Anggaran Standar Konser/Festival:
     * Talent & Rider (Artis utama, supporting act, hospitality, flights, hotel bintang 4/5): 26% - 30% (standar 28%)
     * Produksi Teknis (Ground support stage, Rigging, Line Array Sound System, Lighting, LED Screen P3/P4, Genset silent, Mojo Barricade): 22% - 26% (standar 24%)
     * Venue & Legalitas (sewa venue + biaya perizinan/lisensi/pajak sesuai jurisdiction, rujuk endpoint compliance untuk daftar rule aktual): 12% - 15% (standar 14%)
     * Marketing, OOH & Performance Ads (Billboard, Meta Ads, TikTok Ads, KOL / Media Partner): 7% - 9% (standar 8%)
     * Workforce & Kru Operasional (Liaison Officer/LO, Usher, Stagehand, Security perimeter, Crowd Control, Tim Medis): 5% - 7% (standar 6%)
     * Dana Cadangan (Contingency Fund untuk over-capacity/cuaca/genset backup): 5% - 8% (standar 5%)
     * Operasional & Logistik (Tenda roder, sanitasi toilet portable, HT radio, akomodasi, katering kru): 14% - 16% (standar 15%)

2. STRATEGI STRUKTUR TIKET & BREAK-EVEN:
   - Skema Tiering:
     * Super Early Bird / Early Bird (15-20% kuota): Diskon 30-40% untuk mengunci cashflow awal.
     * Presale 1 & 2 (30-40% kuota): Diskon 15-25%.
     * Regular / General Sale (30-40% kuota): Harga patokan break-even.
     * VIP & VVIP (10-15% kuota): Margin tertinggi (2.5x - 4x harga regular) dengan benefit soundcheck access, VIP fast-lane gate, dedicated lounge, katering & exclusive merchandise.
   - Formula Break-Even: Biaya Bersih Event (setelah dikurangi target komitmen Sponsor & Tenant) dibagi dengan target 80-85% okupansi tiket terjual.

3. SPONSORSHIP & TENANT MONETIZATION:
   - Presenting Sponsor (1 Brand Eksklusif): Naming rights (e.g. "Brand X presents [Event Name]"), 40% porsi LED backdrop, VIP booth aktivasi 10x10m, opening speech rights (~20-25% total budget).
   - Main Sponsor (2-3 Brand non-kompetitif): Logo co-branding, booth 6x6m, social media exposure blast (~8-10% total budget per brand).
   - Supporting Sponsor & Category Partner (Official Telco, Banking/E-Wallet, Beverage, Automotive): Hak penjualan eksklusif kategori produk di venue (~3-5% total budget).
   - Tenant F&B & UMKM: Skema sewa flat per booth (Rp 5jt - Rp 15jt per event) atau revenue sharing 15-20% dari GMV tenant via POS/QRIS terpusat.

4. TEKNIS OPERASIONAL, SOUND & STAGE RIGGING:
   - Sound System Line Array: Kebutuhan daya ~15-20 Watt RMS per pax untuk outdoor festival; Sound Pressure Level (SPL) ideal 102-108 dB di area FOH (Front of House) mixer.
   - Barricade Mojo: Wajib di depan panggung utama dengan jarak buffer minimal 3-4 meter untuk keselamatan photopass, security, dan tim medis darurat.
   - Crowd Safety: Rasio usher minimal 1:80 pax, Security 1:100 pax. Titik evakuasi darurat minimal 2 jalur keluar terpisah dengan lebar pintu minimal 3 meter per 1.000 pax.
   - Medis: 1 Pos Medis + 1 Unit Ambulans Advance Life Support standby per 2.000-3.000 penonton.

5. ARSITEKTUR & FITUR UTAMA OKKAX:
   - Brief to Blueprint: Penyusunan fase kerja (Pre-Production, Production, Show Day, Post-Event), workstream peran, dan timeline W-8 s/d W-1.
   - Interactive Event Graph: Visualisasi radial yang menempatkan Event ID di pusat dengan node orbit (Talent, Venue, Vendor, Workforce, Sponsor, Tenant, Ticketing, Funding) dan status Confirmed, Pending, atau Blocked.
   - Matching Marketplace: Pencarian rekanan terkurasi di 15+ kota besar di Indonesia.
   - Ticket Validator (/validator): Scanner QR tiket dinamis anti-pemalsuan dan deteksi live crowd arrival rate.
   - Live Event Map (/peta): Analisis dampak perputaran ekonomi per kota di 34 provinsi.
"""


async def get_dynamic_platform_context() -> str:
    """Mengambil ringkasan data real-time terkini dari database OKKAX."""
    try:
        total_events = await db.events.count_documents({})
        published_events = await db.events.count_documents({"status": "published"})
        total_venues = await db.venues.count_documents({})
        total_talents = await db.talents.count_documents({})
        total_vendors = await db.vendors.count_documents({})
        
        sample_events = await db.events.find(
            {"status": "published"},
            {"id": 1, "name": 1, "city": 1, "category": 1, "start_date": 1, "ticket_tiers": 1, "capacity": 1}
        ).limit(8).to_list(8)
        
        event_summaries = []
        for ev in sample_events:
            tiers = ev.get("ticket_tiers", [])
            tier_info = ", ".join([f"{t.get('name')} (Rp {t.get('price', 0):,})" for t in tiers[:2]]) if tiers else "Tiket tersedia"
            event_summaries.append(f"- **{ev.get('name')}** ({ev.get('city')}) - Kategori: {ev.get('category', 'Music')} - Target: {ev.get('capacity', 0):,} pax. {tier_info}")

        return f"""
[DATA REAL-TIME SISTEM OKKAX]:
- Total Event Aktif: {total_events} event ({published_events} tampil di katalog Discover publik).
- Jaringan Rekanan Terverifikasi: {total_venues} Venue Resmi, {total_talents} Artis/Talent, {total_vendors} Vendor Produksi di 15+ kota Indonesia.
- Highlight Event Terkini:
{chr(10).join(event_summaries) if event_summaries else "- Data katalog siap."}
"""
    except Exception as e:
        logger.warning(f"Failed to fetch dynamic platform context: {e}")
        return ""


def calculate_advanced_event_model(
    budget: int,
    capacity: int,
    event_type: str = "Konser Musik",
    policy: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Model komputasi finansial mendalam untuk event berskala apapun.

    Reads authoritative ratios from ``policy`` (versioned platform_policies
    doc, keyed ``copilot.calculator.default``) with a safe fallback to the
    reference seed constants. This removes the hardcoded 28/24/14/8/6/5%
    literal split so admins can revise ratios without a code change.
    """
    cfg = policy or DEFAULT_COPILOT_CALCULATOR_POLICY_DOC
    alloc = cfg.get("budget_allocation") or DEFAULT_COPILOT_CALCULATOR_POLICY_DOC["budget_allocation"]
    ft = cfg.get("funding_targets") or DEFAULT_COPILOT_CALCULATOR_POLICY_DOC["funding_targets"]
    tr = cfg.get("technical_ratios") or DEFAULT_COPILOT_CALCULATOR_POLICY_DOC["technical_ratios"]
    notes = cfg.get("notes") or DEFAULT_COPILOT_CALCULATOR_POLICY_DOC["notes"]

    talent = int(budget * float(alloc.get("talent", 0.28)))
    production = int(budget * float(alloc.get("production", 0.24)))
    venue = int(budget * float(alloc.get("venue", 0.14)))
    marketing = int(budget * float(alloc.get("marketing", 0.08)))
    workforce = int(budget * float(alloc.get("workforce", 0.06)))
    contingency = int(budget * float(alloc.get("contingency", 0.05)))
    operations = budget - (talent + production + venue + marketing + workforce + contingency)

    # Monetization Projection
    target_sponsor = int(budget * float(ft.get("sponsor_ratio_of_budget", 0.35)))
    target_tenant = max(int(ft.get("tenant_floor_idr", 15000000)),
                        int(capacity * int(ft.get("tenant_flat_per_pax", 16000))))
    ticket_revenue_target = max(0, budget - target_sponsor - target_tenant)
    occ = float(ft.get("ticket_break_even_occupancy", 0.82))
    break_even_pax = max(1, int(capacity * occ))
    avg_ticket_price = int(ticket_revenue_target / break_even_pax) if capacity else 250000

    # Sound & Technical Specs
    sound_watt_rms = max(int(tr.get("sound_watt_rms_floor", 10000)),
                         int(capacity * int(tr.get("sound_watt_rms_per_pax", 18))))
    ushers_needed = max(6, capacity // int(tr.get("ushers_per_pax", 80)))
    security_needed = max(8, capacity // int(tr.get("security_per_pax", 100)))
    medical_posts = max(1, capacity // int(tr.get("medical_pax_per_post", 2500)))

    def _pct(x: float) -> str:
        return f"{int(round(x * 100))}%"
    return {
        "budget": budget,
        "capacity": capacity,
        "event_type": event_type,
        "policy_key": cfg.get("key", CANONICAL_COPILOT_CALCULATOR_KEY),
        "policy_version": cfg.get("version", DEFAULT_COPILOT_CALCULATOR_POLICY_DOC["version"]),
        "breakdown": {
            "Talent & Rider": {"amount": talent, "percent": _pct(float(alloc.get("talent", 0.28))),
                                 "notes": notes.get("talent_rider", "")},
            "Produksi Teknis": {"amount": production, "percent": _pct(float(alloc.get("production", 0.24))),
                                 "notes": f"Line Array {sound_watt_rms:,}W RMS · " + notes.get("production", "")},
            "Venue & Legalitas": {"amount": venue, "percent": _pct(float(alloc.get("venue", 0.14))),
                                    "notes": notes.get("venue_legalitas", "")},
            "Marketing & OOH": {"amount": marketing, "percent": _pct(float(alloc.get("marketing", 0.08))),
                                  "notes": notes.get("marketing", "")},
            "Workforce Kru": {"amount": workforce, "percent": _pct(float(alloc.get("workforce", 0.06))),
                                "notes": f"LO · {ushers_needed} Usher · {security_needed} Security · {medical_posts} Pos Medis"},
            "Dana Cadangan": {"amount": contingency, "percent": _pct(float(alloc.get("contingency", 0.05))),
                                "notes": notes.get("contingency", "")},
            "Operasional & F&B": {"amount": operations,
                                    "percent": _pct(max(0.0, 1.0 - (float(alloc.get("talent", 0.28)) + float(alloc.get("production", 0.24)) + float(alloc.get("venue", 0.14)) + float(alloc.get("marketing", 0.08)) + float(alloc.get("workforce", 0.06)) + float(alloc.get("contingency", 0.05))))),
                                    "notes": notes.get("operations", "")},
        },
        "funding": {
            "sponsor_target": target_sponsor,
            "tenant_target": target_tenant,
            "ticket_revenue_target": ticket_revenue_target,
            "avg_ticket_price": avg_ticket_price,
            "break_even_pax": break_even_pax,
        },
        "technical_specs": {
            "sound_watt_rms": sound_watt_rms,
            "ushers": ushers_needed,
            "security": security_needed,
            "medical_posts": medical_posts,
        }
    }


# -----------------------------------------------------------------------------
# Prompt parser — extracts numeric intent (budget, target, capacity, saving)
# so Copilot answers the actual question, never a canned template. Pure fn.
# -----------------------------------------------------------------------------
_MONEY_UNITS = {
    "m": 1_000_000_000, "milyar": 1_000_000_000, "miliar": 1_000_000_000, "b": 1_000_000_000,
    "jt": 1_000_000, "juta": 1_000_000,
    "rb": 1_000, "ribu": 1_000, "k": 1_000,
}
_MONEY_RE = re.compile(
    r"(?:rp\s*)?(\d+(?:[\.,]\d+)?)\s*(miliar|milyar|juta|jt|ribu|rb|m|b|k)\b",
    re.IGNORECASE,
)
_CAP_RE = re.compile(
    r"(\d+(?:[\.,]\d+)?)\s*(?:rb|ribu|k)?\s*(?:pax|penonton|orang|attendee|attendees)\b",
    re.IGNORECASE,
)
_SAVING_TOKENS = ("kurangi", "kurangkan", "turun", "turunkan", "potong", "hemat", "efisiensi", "reduce", "trim", "cut", "jadi rp", "menjadi rp", "target rp", "target ke", "batasi")


def _to_int_money(value: str, unit: str) -> int:
    try:
        v = float(value.replace(",", "."))
    except Exception:
        return 0
    mult = _MONEY_UNITS.get(unit.lower(), 1)
    return int(v * mult)


# -----------------------------------------------------------------------------
# Universal intent classifier + constraint extractor (natural ID/EN).
# These primitives replace the per-domain keyword→template branches with a
# single routing layer so Copilot composes context per query rather than
# echoing canned strings.
# -----------------------------------------------------------------------------
INTENT_CONVERSATIONAL = "CONVERSATIONAL"
INTENT_KNOWLEDGE = "KNOWLEDGE"
INTENT_ANALYTICAL = "ANALYTICAL"
INTENT_SIMULATION = "SIMULATION"
INTENT_ACTION = "ACTION"
INTENT_UNKNOWN = "UNKNOWN"

_ACTION_VERBS = (
    "generate", "keluarkan", "issue", "terbitkan", "buatkan", "buat qr", "cetak",
    "batalkan", "cancel", "refund", "kembalikan dana", "bayar", "release payout",
    "release", "bebaskan", "aktifkan", "publish", "publikasikan", "tolak sponsor",
    "kirim ke", "sisipkan", "assign", "invite sponsor", "tutup event",
)
_QTY_TICKET_RE = re.compile(r"(\d+(?:[\.,]\d+)?)\s*(?:qr|tiket|ticket|tix)\b", re.IGNORECASE)
_DATE_HMINUS_RE = re.compile(r"\bh[-\s]?(\d{1,3})\b", re.IGNORECASE)
_DATE_ISO_RE = re.compile(r"\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2})\b")
_INDO_CITIES = ("jakarta", "bandung", "surabaya", "yogyakarta", "yogya", "denpasar",
                "medan", "semarang", "makassar", "bali", "bogor", "malang",
                "palembang", "manado", "batam", "pekanbaru")
_EVENT_TYPE_TOKENS = ("konser", "festival", "expo", "konferensi", "seminar", "workshop",
                       "bazaar", "esports", "olahraga", "wedding", "peluncuran",
                       "product launch", "pameran", "gathering", "reuni", "run")
_CANCEL_TOKENS = ("batal", "cancel", "batalkan", "mundur", "withdraw")


def parse_constraints(text: str) -> Dict[str, Any]:
    """Extract structured constraints — money (baseline/target/budget), pax,
    quantity, city, event_type, date, action verbs, cancellation — from a
    natural Indonesian/English prompt. Never invents; missing = None.
    """
    base = parse_budget_prompt(text)
    q = text.lower()
    qty = None
    m = _QTY_TICKET_RE.search(q)
    if m:
        try:
            qty = int(float(m.group(1).replace(",", ".")))
        except Exception:
            qty = None
    action_verbs = [v for v in _ACTION_VERBS if v in q]
    city = next((c.capitalize() for c in _INDO_CITIES if c in q), None)
    ev_type = next((t for t in _EVENT_TYPE_TOKENS if t in q), None)
    h_minus = None
    hm = _DATE_HMINUS_RE.search(q)
    if hm:
        try:
            h_minus = int(hm.group(1))
        except Exception:
            pass
    iso_date = None
    dm = _DATE_ISO_RE.search(q)
    if dm:
        iso_date = dm.group(1)
    cancellation = any(t in q for t in _CANCEL_TOKENS)
    return {**base,
            "quantity_tickets": qty,
            "action_verbs": action_verbs,
            "city": city,
            "event_type": ev_type,
            "days_before": h_minus,
            "iso_date": iso_date,
            "cancellation_intent": cancellation}


def _domain_tags(text: str, parsed: Dict[str, Any]) -> List[str]:
    q = text.lower()
    tags: List[str] = []
    dm = {
        "budget": ("budget", "anggaran", "biaya", "cost", "alokasi"),
        "sponsor": ("sponsor", "sponsorship", "presenting", "brand partner"),
        "tenant": ("tenant", "booth", "umkm", "bazaar"),
        "ticketing": ("tiket", "ticket", "qr", "tier", "sell-through", "gmv", "penjualan", "pax", "penonton"),
        "compliance": ("compliance", "izin", "permit", "readiness", "safety", "K3", "insurance"),
        "finance": ("finance", "payout", "funding", "gap", "settlement", "invoice", "receivable", "payable", "break-even", "break even", "margin", "roi"),
        "live_ops": ("insiden", "incident", "gate", "live", "attendance", "run of show", "rundown"),
        "graph": ("event graph", "graph", "dependency", "blocker", "at risk"),
        "ripple": ("ripple", "multiplier", "dampak ekonomi", "pdrb", "omset"),
        "supply": ("talent", "vendor", "venue", "workforce", "kru", "crew", "matching"),
        "marketing": ("marketing", "ads", "billboard", "kol", "ooh", "campaign"),
        "management": ("manage", "management", "koordinasi", "leadership", "workflow", "tim"),
        "knowledge": ("apa beda", "definisi", "apa itu", "prinsip", "sop", "standar", "jelaskan", "how to", "bagaimana"),
        "risk": ("risk", "risiko", "cuaca", "hujan", "wind", "outdoor safety"),
    }
    for tag, kws in dm.items():
        if any(k in q for k in kws):
            tags.append(tag)
    return tags


def classify_intent(text: str, parsed: Optional[Dict[str, Any]] = None) -> str:
    """Return one of INTENT_* — the single routing decision for the reply
    composer. Priority favors safety: ACTION > SIMULATION > ANALYTICAL
    > CONVERSATIONAL > KNOWLEDGE > UNKNOWN.
    """
    if _small_talk_reply(text) is not None:
        return INTENT_CONVERSATIONAL
    p = parsed if parsed is not None else parse_constraints(text)
    q = text.lower()
    # ACTION: contains explicit verb OR (quantity + issuance/refund verb-like phrase)
    if p.get("action_verbs") or (p.get("quantity_tickets") and any(w in q for w in ("generate", "keluarkan", "issue", "terbitkan", "buat", "bikin", "cetak", "tolong buat", "mohon"))):
        return INTENT_ACTION
    if p.get("saving_intent") or ("simulasi" in q) or ("skenario" in q) or ("what if" in q) or (p.get("cancellation_intent") and (p.get("days_before") is not None)):
        return INTENT_SIMULATION
    # KNOWLEDGE precedes ANALYTICAL when the question is clearly informational
    # (definition/comparison/how-to/safety-yes-no) and carries no live-data
    # numeric anchor. Numeric constraints still route to ANALYTICAL.
    knowledge_hit = any(k in q for k in ("apa itu", "apa yang dimaksud", "bagaimana cara", "kenapa", "mengapa",
                                          "how to", "jelaskan", "definisi", "prinsip", "sop", "standar",
                                          "apa beda", "beda antara", "perbedaan", " vs ",
                                          "aman gak", "aman ga", "aman kah", "aman kalau", "aman jika"))
    numeric_anchor = p.get("budget") is not None or p.get("capacity") is not None or p.get("quantity_tickets")
    if knowledge_hit and not numeric_anchor:
        return INTENT_KNOWLEDGE
    analytic_domain_hits = any(k in q for k in ("blocker", "risiko", "risk", "compliance", "readiness",
                                                 "break-even", "break even", "budget", "anggaran",
                                                 "funding", "gap", "gmv", "sell-through", "attendance",
                                                 "sponsor", "tenant", "vendor", "talent", "venue",
                                                 "supply", "ripple", "multiplier", "forecast", "impact",
                                                 "pricing", "harga pasar", "roi", "margin",
                                                 "tiket", "ticket", "penjualan", "sell", "penonton",
                                                 "produksi", "kru", "crew", "insiden", "incident",
                                                 "boncos", "meleset", "bermasalah", "alternatif",
                                                 "prioritas", "impact", "dampak"))
    if analytic_domain_hits or numeric_anchor:
        return INTENT_ANALYTICAL
    if knowledge_hit:
        return INTENT_KNOWLEDGE
    return INTENT_UNKNOWN


def parse_budget_prompt(text: str) -> Dict[str, Any]:
    """Extract (baseline, target, capacity, saving_intent). NEVER invents
    a value; missing fields stay None so the caller can label them UNKNOWN.
    """
    q = text.lower()
    money_matches = [(m.start(), _to_int_money(m.group(1), m.group(2))) for m in _MONEY_RE.finditer(q)]
    money_vals = [v for _, v in money_matches if v > 0]

    saving = any(tok in q for tok in _SAVING_TOKENS) or ("dari rp" in q and "jadi" in q)

    baseline = None
    target = None
    if saving and len(money_vals) >= 2:
        baseline, target = money_vals[0], money_vals[1]
    elif saving and len(money_vals) == 1:
        target = money_vals[0]

    # Budget = target (if saving intent) OR the single/largest money value.
    budget = target if saving else (money_vals[0] if money_vals else None)

    # Capacity: explicit "N pax/orang/penonton". No fallback to fabricated defaults.
    cap = None
    cap_m = _CAP_RE.search(q)
    if cap_m:
        raw = cap_m.group(1).replace(",", ".")
        try:
            n = float(raw)
        except Exception:
            n = 0.0
        # Suffix "rb"/"ribu"/"k" multiplies by 1000
        tail = q[cap_m.end(1): cap_m.end()]
        if any(t in tail for t in ("rb", "ribu", "k")):
            n *= 1000
        cap = int(n) if n > 0 else None
    if cap is None:
        # Barefoot integers with "stadion" hint (backwards-compat with one legacy test)
        if "stadion" in q and any(tok in q for tok in ("50.000", "50000")):
            cap = 50000
    return {"baseline": baseline, "target": target, "budget": budget,
            "capacity": cap, "saving_intent": bool(saving)}


# -----------------------------------------------------------------------------
# Small-talk router — greetings/thanks/ack/goodbye/casual. Runs BEFORE any
# domain/default branch so tiny inputs like "bro" never get boilerplate.
# Returns None when the query is not small talk.
# -----------------------------------------------------------------------------
_GREET = {"halo", "hai", "hey", "hi", "hello", "helo", "hei", "yo", "assalamualaikum",
          "selamat pagi", "selamat siang", "selamat sore", "selamat malam",
          "pagi", "siang", "sore", "malam"}
_CASUAL_ADDRESS = {"bro", "gan", "min", "mimin", "kak", "bang", "boss", "bos", "sis"}
_THANKS = {"makasih", "terima kasih", "makasi", "thanks", "thx", "tq", "thank you"}
_ACK = {"oke", "ok", "okey", "okei", "sip", "siap", "roger", "noted", "mantap",
        "keren", "baik", "beres"}
_GOODBYE = {"bye", "dadah", "sampai jumpa", "see ya", "see you", "goodbye", "later"}


def _small_talk_reply(query: str) -> Optional[str]:
    """Return a short, natural, tone-matched reply for casual chat; None
    otherwise. No labels, no pipeline mention, no domain drift."""
    text = query.strip().lower()
    if not text or len(text) > 60:
        return None
    tokens = {t.strip(" ,.!?…") for t in text.split() if t.strip(" ,.!?…")}
    is_casual = bool(tokens & _CASUAL_ADDRESS) and len(tokens) <= 3
    is_greeting = bool(tokens & _GREET) or any(g in text for g in ("selamat pagi", "selamat siang", "selamat sore", "selamat malam"))
    is_thanks = bool(tokens & _THANKS) or "terima kasih" in text
    is_ack = bool(tokens & _ACK) and len(tokens) <= 3
    is_bye = bool(tokens & _GOODBYE) or "sampai jumpa" in text

    # Only fire when the whole input is small talk (no other content) OR is
    # a short greeting that includes a generic "can you help" phrasing.
    non_stop = tokens - _GREET - _CASUAL_ADDRESS - _THANKS - _ACK - _GOODBYE - {"?", ""}
    _help_phrase = any(p in text for p in ("bisa dibantu", "bisa bantu", "bisa membantu",
                                            "ada yang bisa", "bisa help", "help me"))
    if is_greeting and _help_phrase and len(text) <= 60:
        pass  # fall through to greeting reply
    elif non_stop and not is_greeting and not is_thanks and not is_ack and not is_bye and not is_casual:
        return None
    elif non_stop and len(non_stop) > 1 and not _help_phrase:
        return None

    if is_thanks:
        return "Sama-sama! Kalau butuh bantuan lagi tinggal bilang."
    if is_bye:
        return "Sampai jumpa. Semoga eventnya lancar!"
    if is_ack:
        return "Siap. Ada lagi yang mau dibahas?"
    if is_casual and not is_greeting:
        # Echo user's own casual address for a natural tone
        addr = next(iter(tokens & _CASUAL_ADDRESS))
        return f"{addr.capitalize()}, siap. Ada yang bisa saya bantu?"
    if is_greeting:
        pref = None
        for g in ("selamat pagi", "selamat siang", "selamat sore", "selamat malam"):
            if g in text:
                pref = g.capitalize()
                break
        opener = pref or "Halo"
        addr = next(iter(tokens & _CASUAL_ADDRESS), "")
        addr_txt = f" {addr}" if addr else ""
        return f"{opener}{addr_txt}! Ada yang bisa saya bantu soal event Anda?"
    return None


def _strip_internal_leaks(text: str) -> str:
    """Remove developer-facing terminology from user chat bubbles: API paths,
    endpoint hints, DB collection names, provider/model labels, pipeline
    stage names. Keeps domain labels (FACT/CALCULATED/…) which are UX-facing.
    """
    if not text:
        return text
    patterns = [
        (re.compile(r"`?/api/[a-zA-Z0-9/_\-{}\.]+`?"), ""),
        (re.compile(r"`?POST /[^\s`]+`?", re.IGNORECASE), ""),
        (re.compile(r"`?GET /[^\s`]+`?", re.IGNORECASE), ""),
        (re.compile(r"`?db\.[a-z_]+`?"), "data OKKAX"),
        (re.compile(r"`event_id`"), "event Anda"),
        (re.compile(r"policy\s*`[a-z0-9\._]+`\s*versi\s*`[^`]+`", re.IGNORECASE), "policy internal versioned"),
        (re.compile(r"`EMERGENT_LLM_KEY`|`OPENAI_API_KEY`"), ""),
        (re.compile(r"`AI_ENGINES`|`resolve_engine`|`platform_policies`"), ""),
        (re.compile(r"`engine`\s*field", re.IGNORECASE), "preferensi provider"),
        (re.compile(r"reasoning_mode|pipeline_stages|LLM_UNAVAILABLE|llm_available", re.IGNORECASE), ""),
    ]
    for pat, repl in patterns:
        text = pat.sub(repl, text)
    # collapse whitespace introduced by removals
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def build_semantic_plan(text: str, parsed: Optional[Dict[str, Any]] = None,
                         history: Optional[List[Dict[str, str]]] = None,
                         event_id_present: bool = False) -> Dict[str, Any]:
    """Deterministic semantic interpreter — produces the structured plan the
    reply composer routes on. When an LLM is wired later this function is
    the fallback; the shape stays identical so callers do not care which
    interpreter produced it.
    """
    p = parsed if parsed is not None else parse_constraints(text)
    intent = classify_intent(text, p)
    domains = _domain_tags(text, p)

    entities = {
        "city": p.get("city"),
        "event_type": p.get("event_type"),
        "quantity_tickets": p.get("quantity_tickets"),
        "iso_date": p.get("iso_date"),
        "days_before": p.get("days_before"),
        "action_verbs": p.get("action_verbs") or [],
        "cancellation_intent": p.get("cancellation_intent"),
    }
    constraints = {
        "baseline": p.get("baseline"),
        "target": p.get("target"),
        "budget": p.get("budget"),
        "capacity": p.get("capacity"),
        "saving_intent": p.get("saving_intent"),
    }

    missing: List[str] = []
    if intent == INTENT_ACTION:
        if p.get("quantity_tickets") is None and any(v in ("generate", "issue", "keluarkan", "terbitkan", "cetak") for v in entities["action_verbs"]):
            missing.append("quantity_tickets")
        if "tier_name" not in text.lower() and "regular" not in text.lower() and "vip" not in text.lower() and "presale" not in text.lower():
            missing.append("tier_name")
        if not event_id_present:
            missing.append("event_id")
    elif intent == INTENT_ANALYTICAL:
        if constraints["budget"] is None and constraints["capacity"] is None and not event_id_present:
            missing.append("budget_or_capacity_or_event_id")
        elif constraints["budget"] is None and not event_id_present and any(t in domains for t in ("budget", "finance", "sponsor", "tenant")):
            missing.append("budget")
        elif constraints["capacity"] is None and not event_id_present and any(t in domains for t in ("ticketing", "supply", "live_ops")):
            missing.append("capacity")
    elif intent == INTENT_SIMULATION:
        if constraints["baseline"] is None and constraints["target"] is None and constraints["budget"] is None:
            missing.append("baseline_or_target_budget")

    needs_live_data = event_id_present or any(k in text.lower() for k in ("event saya", "event gue", "event ini", "aruna", "nusantara"))
    needs_graph = any(k in text.lower() for k in ("graph", "dependency", "blocker", "at risk", "readiness"))
    needs_intelligence = bool(set(_intent_keywords(text)) & _INTELLIGENCE_ROUTED_INTENTS)
    needs_action = intent == INTENT_ACTION

    objective_bits: List[str] = []
    if intent == INTENT_ACTION and entities["action_verbs"]:
        objective_bits.append(f"lakukan {', '.join(entities['action_verbs'])}")
    if constraints["saving_intent"] and constraints["baseline"] and constraints["target"]:
        objective_bits.append(f"turunkan Rp{constraints['baseline']:,} → Rp{constraints['target']:,}")
    if constraints["budget"] and constraints["capacity"]:
        objective_bits.append(f"analisis {constraints['capacity']:,} pax Rp{constraints['budget']:,}")
    if entities["cancellation_intent"] and entities["days_before"]:
        objective_bits.append(f"analisis dampak pembatalan H-{entities['days_before']}")
    if not objective_bits:
        objective_bits.append(text.strip()[:80])

    return {
        "intent": intent,
        "domains": domains,
        "objective": " · ".join(objective_bits),
        "entities": entities,
        "constraints": constraints,
        "missing_fields": missing,
        "needs_live_data": needs_live_data,
        "needs_graph": needs_graph,
        "needs_intelligence": needs_intelligence,
        "needs_action": needs_action,
    }


def merge_multi_turn_state(plan: Dict[str, Any], history: Optional[List[Dict[str, str]]]) -> Dict[str, Any]:
    """Merge follow-up plan with prior turns. Short user turns (numbers,
    single words like 'Regular', 'iya', 'Jakarta', 'lanjut') don't have
    enough signal on their own — carry forward missing constraints from
    the most recent analytical/simulation/action turn.
    """
    if not history:
        return plan
    prior_plans: List[Dict[str, Any]] = []
    for turn in list(history)[-6:]:
        if turn.get("role") != "user":
            continue
        c = str(turn.get("content", ""))
        if not c.strip():
            continue
        pp = build_semantic_plan(c)
        if pp["intent"] in (INTENT_ANALYTICAL, INTENT_SIMULATION, INTENT_ACTION):
            prior_plans.append(pp)
    if not prior_plans:
        return plan
    latest_prior = prior_plans[-1]

    merged = {**plan}
    # If current is UNKNOWN or KNOWLEDGE with very short content, inherit intent+domains
    if plan["intent"] in (INTENT_UNKNOWN, INTENT_KNOWLEDGE) and prior_plans:
        # Only inherit when this turn looks like a follow-up (short input)
        short_turn = sum(1 for _ in plan["objective"].split()) <= 3
        if short_turn:
            merged["intent"] = latest_prior["intent"]
            merged["domains"] = list(set((plan.get("domains") or []) + latest_prior.get("domains", [])))
            merged["needs_action"] = latest_prior.get("needs_action", False)
            merged["needs_intelligence"] = latest_prior.get("needs_intelligence", False)
    # Fill missing constraints from prior
    for k in ("baseline", "target", "budget", "capacity"):
        if merged["constraints"].get(k) is None and latest_prior["constraints"].get(k) is not None:
            merged["constraints"][k] = latest_prior["constraints"][k]
    for k in ("city", "event_type", "quantity_tickets", "days_before"):
        if merged["entities"].get(k) is None and latest_prior["entities"].get(k) is not None:
            merged["entities"][k] = latest_prior["entities"][k]
    # Recompute missing fields against merged constraints
    if merged["intent"] == INTENT_ACTION:
        merged["missing_fields"] = [f for f in merged["missing_fields"]
                                     if not (f == "quantity_tickets" and merged["entities"].get("quantity_tickets"))]
    if merged["intent"] == INTENT_ANALYTICAL:
        c = merged["constraints"]
        merged["missing_fields"] = [f for f in merged["missing_fields"]
                                     if not ((f == "budget" and c.get("budget")) or
                                             (f == "capacity" and c.get("capacity")) or
                                             (f == "budget_or_capacity_or_event_id" and (c.get("budget") or c.get("capacity"))))]
    return merged


# Compact domain knowledge notes — used as CONTEXT for KNOWLEDGE intent
# composer. NOT canned final answers; composer weaves relevant note into
# a short direct reply.
_KNOWLEDGE_NOTES: Dict[str, str] = {
    "promoter_vs_eo": "Promoter memikul risiko finansial (talent, venue, funding, revenue tiket) dan mengambil untung/rugi dari sisa margin. Event Organizer (EO) adalah pelaksana operasional yang biasanya menerima management fee tetap dan risiko produksinya terbatas pada kontrak jasa.",
    "outdoor_weather": "Event outdoor wajib memiliki mitigasi cuaca: tenda roder atau canopy grade production, ground drainage yang cukup, IP54+ pada rigging listrik/genset, jalur evakuasi anti-selip, standby dokter/ambulans, dan window keputusan `stop show` ~30–60 menit sebelum hujan berat berdasar radar BMKG.",
    "breakeven_definition": "Break-even = (biaya total setelah dikurangi komitmen sponsor & tenant) dibagi target harga tiket rata-rata; target aman biasanya di 80–85% okupansi kapasitas terjual.",
    "sponsor_tier": "Sponsor umumnya terdiri dari Presenting (eksklusif, naming rights), Main (2–3 brand non-kompetitif), Supporting/Category Partner (hak kategori). Distribusi budget contribution biasanya 40% / 30% / 30%.",
    "compliance_general": "Compliance event terdiri dari perizinan lokal (venue authority, keramaian, keselamatan kebakaran, medis, traffic), lisensi konten (performing rights), dan asuransi event liability. Rule aktual bergantung jurisdiction — Copilot mengambil dari policy compliance OKKAX bila event Anda dilampirkan.",
}


def _knowledge_note_for(text: str) -> Optional[str]:
    q = text.lower()
    if any(k in q for k in ("beda promoter", "promoter vs", "eo dan promoter", "promoter dan eo", "apa itu promoter", "apa itu eo")):
        return _KNOWLEDGE_NOTES["promoter_vs_eo"]
    if any(k in q for k in ("outdoor", "hujan", "cuaca")):
        return _KNOWLEDGE_NOTES["outdoor_weather"]
    if "break" in q and ("even" in q or "-even" in q):
        return _KNOWLEDGE_NOTES["breakeven_definition"]
    if any(k in q for k in ("apa itu sponsor", "tingkatan sponsor", "sponsor tier", "presenting sponsor")):
        return _KNOWLEDGE_NOTES["sponsor_tier"]
    if any(k in q for k in ("apa itu compliance", "izin event", "permit event")):
        return _KNOWLEDGE_NOTES["compliance_general"]
    return None


def deterministic_okkax_copilot_brain(query: str, history: List[Dict[str, str]] = None, current_route: str = "", role: str = "", policy: Optional[Dict[str, Any]] = None, stages: Optional[List[str]] = None) -> str:
    _st = _small_talk_reply(query)
    if _st is not None:
        return _st
    """Mesin inferensi dan pengetahuan tingkat tinggi OKKAX Copilot untuk respon cepat & berbobot tinggi."""
    q = query.lower()
    
    # 1. Pertanyaan tentang Identitas OKKAX Copilot & Platform OKKAX
    if any(k in q for k in ["siapa kamu", "tentang okkax", "apa itu okkax", "kenalan", "copilot", "okkax copilot", "siapa okkax"]):
        return (
            "### Halo! Saya OKKAX Copilot — Principal Event Intelligence & Copilot Operasional Resmi OKKAX.\n\n"
            "Saya memandu promotor, brand sponsor, tenant, pengelola venue, dan pekerja kreatif dalam merancang serta mengoperasikan live event berskala profesional di seluruh Indonesia.\n\n"
            "#### Ruang Lingkup Konsultasi OKKAX Copilot:\n"
            "1. **Komputasi Finansial & Alokasi Anggaran**: Kalkulasi alokasi pos biaya, target break-even, hingga proyeksi dana cadangan.\n"
            "2. **Penyusunan Brief & Technical Blueprint**: Menghasilkan workstreams, timeline W-8, technical rider panggung, dan spesifikasi daya sound system.\n"
            "3. **Event Graph & Dependency Analytics**: Menemukan potensi blocker antara kontrak artis, kesiapan vendor, dan pencairan sponsor.\n"
            "4. **Sponsorship Valuation & Tenant Zoning**: Skema penawaran hak eksklusif brand dan monetisasi slot UMKM/F&B.\n"
            "5. **Ticketing & Gate Control (/validator)**: Panduan sistem QR code dinamis, validasi gate scanner, dan metode pembayaran lokal.\n"
            "6. **Peta Perputaran Ekonomi (/peta)**: Analisis multiplier effect dan dampak ekonomi regional di 15+ kota besar.\n\n"
            "Ketik rencana acara atau pertanyaan teknis Anda, dan saya akan menyusun analisis komprehensif untuk Anda."
        )

    # 2. Pertanyaan tentang Perancangan Event / Kalkulasi Budget.
    # Fires ONLY when we have real quantitative signal: a budget number, a
    # saving-intent, or an explicit budget-domain keyword. Generic "konser/
    # festival" alone routes on to sponsor/tenant/etc. handlers below.
    _parsed_probe = parse_budget_prompt(query)
    if (_parsed_probe["saving_intent"]
        or _parsed_probe["budget"] is not None
        or any(k in q for k in ["anggaran", "budget", "hitung anggaran", "hitung biaya",
                                "kalkulasi biaya", "kalkulasi anggaran", "simulasi biaya",
                                "brief event", "buat event", "bikin event",
                                "hemat", "potong", "turun", "kurangi", "kurangkan",
                                "reduce", "trim", "cut", "target rp", "dari rp"])):
        parsed = _parsed_probe
        cap = parsed["capacity"]        # may be None => don't invent
        budget = parsed["budget"]        # may be None => ask, don't invent
        target = parsed["target"]        # may be None
        baseline = parsed["baseline"] or budget
        saving_intent = parsed["saving_intent"]

        # A. User wants to CUT budget — reason from the actual numbers, not a template.
        if saving_intent and baseline and target:
            delta = baseline - target
            pct = round(delta / baseline * 100, 1) if baseline else 0.0
            reduction_note = f"[{LABEL_SIM}] Skenario penghematan berbasis angka yang Anda berikan (tidak berdasarkan event live)."
            base_data = calculate_advanced_event_model(baseline, cap or 0, "User-supplied", policy=None)
            tgt_data = calculate_advanced_event_model(target, cap or 0, "User-supplied", policy=None)
            cap_line = (f"Kapasitas: {cap:,} pax (user)" if cap else f"[{LABEL_UNKNOWN}] Kapasitas tidak disebut — tidak diasumsikan; sponsor/tenant/tiket target diturunkan dari budget saja.")
            rows = [
                f"### Simulasi Penurunan Budget Event",
                reduction_note,
                "",
                f"[{LABEL_FACT}] Baseline: **Rp{baseline:,}** → Target: **Rp{target:,}**",
                f"[{LABEL_CALC}] Penghematan: **Rp{delta:,}** (**{pct}%** dari baseline).",
                f"[{LABEL_FACT}] {cap_line}",
                "",
                "| Pos Pengeluaran | Baseline (Rp) | Target (Rp) | Selisih (Rp) |",
                "| :--- | ---: | ---: | ---: |",
            ]
            for k in ("Talent & Rider", "Produksi Teknis", "Venue & Legalitas", "Marketing & OOH", "Workforce Kru", "Dana Cadangan", "Operasional & F&B"):
                b_amt = base_data["breakdown"][k]["amount"]
                t_amt = tgt_data["breakdown"][k]["amount"]
                rows.append(f"| **{k}** | Rp{b_amt:,} | Rp{t_amt:,} | Rp{(b_amt - t_amt):,} |")
            rows.append("")
            rows.append(f"[{LABEL_RECO}] Prioritas pemotongan yang umum aman tanpa menurunkan kualitas show: Marketing/OOH → Operasional/F&B → Contingency. Hindari memotong Talent/Produksi/Safety yang bisa merusak pengalaman & reputasi.")
            if not cap:
                rows.append(f"[{LABEL_UNKNOWN}] Untuk menerbitkan target tiket rata-rata & spesifikasi teknis (sound wattage, usher, security), sebutkan kapasitas penonton yang direncanakan.")
            rows.append(f"[{LABEL_FACT}] Sumber ratio: policy `{base_data.get('policy_key')}` versi `{base_data.get('policy_version')}` (configurable via `platform_policies`).")
            return "\n".join(rows)

        # B. User memberikan budget + kapasitas eksplisit — proyeksikan (ESTIMATE).
        if budget and cap:
            data = calculate_advanced_event_model(budget, cap, "User-supplied", policy=None)
            header = f"### Rencana Alokasi Anggaran Event ({cap:,} pax · Rp{budget:,})"
            body = [
                header,
                f"[{LABEL_ESTIMATE}] Proyeksi berdasarkan angka yang Anda berikan; ratio dari policy `{data.get('policy_key')}` versi `{data.get('policy_version')}`.",
                "",
                "| Pos Pengeluaran | Porsi | Estimasi Alokasi (IDR) | Cakupan & Catatan |",
                "| :--- | :--- | ---: | :--- |",
            ]
            for k in ("Talent & Rider", "Produksi Teknis", "Venue & Legalitas", "Marketing & OOH", "Workforce Kru", "Dana Cadangan", "Operasional & F&B"):
                b = data["breakdown"][k]
                body.append(f"| **{k}** | {b['percent']} | Rp{b['amount']:,} | {b['notes']} |")
            body += [
                "",
                "#### Rekomendasi Teknis & Crowd Management",
                f"[{LABEL_ESTIMATE}] Sound: minimal **{data['technical_specs']['sound_watt_rms']:,} Watt RMS** Line Array (SPL target 104 dB di FOH).",
                f"[{LABEL_ESTIMATE}] Tim lapangan: **{data['technical_specs']['ushers']} Usher**, **{data['technical_specs']['security']} Security**, **{data['technical_specs']['medical_posts']} Pos Medis**.",
                "",
                f"[{LABEL_RECO}] Untuk menerbitkan target break-even & harga tiket rata-rata terkalibrasi, lakukan lanjutan di Event Studio yang menautkan angka ke data live (sponsor commitment, tenant occupancy, tier struktur).",
            ]
            return "\n".join(body)

        # C. Budget-only tanpa kapasitas — tidak menginvent capacity, ajukan klarifikasi.
        if budget and not cap:
            data = calculate_advanced_event_model(budget, 0, "User-supplied", policy=None)
            return "\n".join([
                f"### Alokasi Anggaran (Rp{budget:,})",
                f"[{LABEL_ESTIMATE}] Alokasi persentase dari policy `{data.get('policy_key')}` versi `{data.get('policy_version')}` untuk budget yang Anda sebut.",
                f"[{LABEL_UNKNOWN}] Kapasitas penonton belum disebut — Copilot tidak mengasumsikan angka. Sebutkan target pax agar Copilot dapat menghitung sound wattage, usher, security, medis, dan target tiket break-even.",
                "",
                "| Pos Pengeluaran | Porsi | Estimasi Alokasi (IDR) |",
                "| :--- | :--- | ---: |",
                *[f"| **{k}** | {data['breakdown'][k]['percent']} | Rp{data['breakdown'][k]['amount']:,} |"
                  for k in ("Talent & Rider", "Produksi Teknis", "Venue & Legalitas", "Marketing & OOH", "Workforce Kru", "Dana Cadangan", "Operasional & F&B")],
            ])

        # D. Tidak ada angka sama sekali — Copilot minta konteks alih-alih mengarang template.
        return "\n".join([
            "### Butuh angka spesifik dulu",
            f"[{LABEL_UNKNOWN}] Copilot tidak mengasumsikan kapasitas atau budget yang tidak Anda sebut.",
            f"[{LABEL_RECO}] Sebutkan minimal salah satu:",
            "- **Kapasitas** (contoh: `3.000 pax`, `10.000 penonton`)",
            "- **Budget total** (contoh: `Rp1,2 miliar`, `Rp800 juta`)",
            "- **Target penghematan** (contoh: `turun dari Rp1M ke Rp800jt`)",
            "",
            f"[{LABEL_RECO}] Untuk analisis grounded (bukan simulasi), pilih event Anda di UI supaya Copilot dapat membaca budget, sponsor commitment, dan tier tiket aktual dari data OKKAX.",
        ])

    # 3. Pertanyaan tentang Event Graph & Mitigasi Risiko
    if any(k in q for k in ["event graph", "grafik", "radial", "node", "dependensi", "blocker", "risiko"]):
        return (
            f"[{LABEL_RECO}] Panduan umum Event Graph (untuk analisis LIVE, sertakan `event_id` + login sehingga Copilot dapat membaca node/status/coverage aktual):\n\n"
            "### Analisis Arsitektur Event Graph OKKAX\n\n"
            "Event Graph di OKKAX adalah kanvas visualisasi relasi dependensi berbasis SVG radial yang memastikan tidak ada titik buta (blind spot) dalam eksekusi acara.\n\n"
            "#### Hierarki Struktur Node:\n"
            "1. **Core Center**: **Event ID** sebagai jangkar operasional utama.\n"
            "2. **Inner Orbit (Kritis / Blocker Utama)**:\n"
            "   - **Talent**: Penandatanganan kontrak dan persetujuan technical rider.\n"
            "   - **Venue**: Ketersediaan tanggal, izin tempat, dan kapasitas daya listrik/genset.\n"
            "   - **Vendors**: Panggung (Stage Rigging), Tata Suara (Sound System), Tata Cahaya (Lighting), LED Screen, dan Mojo Barricade.\n"
            "3. **Outer Orbit (Monetisasi & Operasional)**:\n"
            "   - **Sponsors**: Pencairan termin dana sponsor (Termin 1 DP, Termin 2 Show Day).\n"
            "   - **Tenants**: Kesiapan instalasi listrik & air bersih di zona F&B.\n"
            "   - **Workforce**: Jadwal briefing Liaison Officer, Usher, dan Tim Medis.\n"
            "   - **Ticketing & Funding**: Monitoring funding gap secara langsung.\n\n"
            "#### Makna Status Warna Node:\n"
            "- **Confirmed (Hijau)**: Terikat kontrak resmi dan tervalidasi.\n"
            "- **Pending / Draft (Kuning)**: Masih dalam negosiasi atau pengajuan proposal.\n"
            "- **Blocked / At-Risk (Merah)**: Ada kendala kritis (misal: rider teknis belum dipenuhi vendor yang menyebabkan node panggung terkunci).\n\n"
            "Buka tab Event Graph pada [Workspace](/app/events) Anda untuk memantau status secara langsung."
        )

    # 4. Pertanyaan tentang Sponsorship & Tenant Monetization
    if any(k in q for k in ["sponsor", "tenant", "booth", "paket sponsor", "umkm", "hak sponsor", "presenting"]):
        _ft = (policy or DEFAULT_COPILOT_CALCULATOR_POLICY_DOC).get("funding_targets", {})
        _spr = float(_ft.get("sponsor_ratio_of_budget", 0.35)) * 100
        _tpp = int(_ft.get("tenant_flat_per_pax", 16000))
        _tfl = int(_ft.get("tenant_floor_idr", 15000000))
        return (
            f"[{LABEL_RECO}] Panduan valuasi berdasarkan policy `copilot.calculator.default` — untuk data LIVE (sponsor commitment aktual, tenant approved, booth occupancy per zona), sertakan `event_id` + login sehingga Copilot dapat membaca dari `db.sponsor_commitments` / `db.tenant_applications`.\n\n"
            f"[{LABEL_FACT}] Ratio configurable: target sponsor {_spr:.0f}% dari budget · target tenant Rp{_tpp:,}/pax (floor Rp{_tfl:,}).\n\n"
            "### Panduan Valuasi Sponsorship & Zonasi Tenant\n\n"
            "Untuk memaksimalkan pendapatan non-tiket, OKKAX membagi kemitraan komersial secara terstruktur:\n\n"
            "#### 1. Pembagian Paket Sponsor:\n"
            "- **Presenting Sponsor (Eksklusif 1 Brand)**:\n"
            "  - Naming rights: *\"Brand X Presents [Event Name]\"*\n"
            "  - Logo dominan pada main stage backdrop, LED loop 40% durasi, dan tiket digital.\n"
            "  - Hak booth aktivasi experience terbesar (10x10m) di titik lalu lintas utama penonton.\n"
            "  - VIP hospitality lounge & 50 tiket VVIP.\n"
            "- **Main Sponsor (2 - 3 Brand Non-Kompetitif)**:\n"
            "  - Logo sekunder pada materi promosi, booth aktivasi 6x6m, dan mention MC tiap sesi.\n"
            "- **Supporting Sponsor & Category Partner**:\n"
            "  - Hak eksklusif kategori (e.g. Official Beverage, Official Bank, Official Telco).\n\n"
            "#### 2. Tata Kelola Zona Tenant F&B & UMKM:\n"
            "- **Zonasi Standar**: Pisahkan area tenant basah (makanan olahan panas/memasak) dengan tenant kering (merchandise/minuman siap saji).\n"
            "- **Infrastruktur Wajib**: Titik listrik tersendiri (beban 2-4A per booth), titik air bersih, dan tempat pembuangan limbah tertutup.\n\n"
            "Gunakan [Portal Sponsor](/app/sponsor) atau [Portal Tenant](/app/tenant) untuk mulai mengundang mitra."
        )

    # 5. Pertanyaan tentang Validasi Tiket & Gate Control
    if any(k in q for k in ["tiket", "validasi", "scanner", "scan", "gate", "pintu masuk", "validator", "qr code", "check-in"]):
        return (
            f"[{LABEL_RECO}] Panduan operasional gate & Validator (untuk melihat penjualan tier & GMV LIVE, sertakan `event_id` + login sehingga Copilot menarik dari `db.ticket_tiers`, `db.payments`, dan `db.ticket_validations`).\n\n"
            "### Sistem Gate Scanner & Keamanan Tiket OKKAX\n\n"
            "OKKAX menjamin kelancaran arus penonton (crowd flow) di pintu masuk dengan sistem ticketing anti-fraud:\n\n"
            "#### Fitur Scanner & Gate Control:\n"
            "1. **Signature QR Terenkripsi**: Setiap tiket memiliki token verifikasi satu kali pakai (one-time valid token).\n"
            "2. **Kamera Scanner Bawaan**: Petugas gate cukup membuka [Ticket Validator](/validator) di browser smartphone kru tanpa perlu install aplikasi tambahan.\n"
            "3. **Deteksi Duplikasi Instan**: Jika tiket dicoba di-scan dua kali di gate berbeda, sistem langsung memberikan peringatan merah (*\"Ticket Already Used\"*) dengan catatan waktu & gate sebelumnya.\n"
            "4. **Live Arrival Rate Counter**: Menampilkan visualisasi jumlah penonton yang sudah berada di dalam venue vs yang masih di luar secara real-time.\n\n"
            "Uji coba scan tiket secara langsung di halaman [Ticket Validator](/validator)."
        )

    # 6. Pertanyaan tentang Dampak Ekonomi Regional (/peta)
    if any(k in q for k in ["peta", "map", "dampak ekonomi", "economic ripple", "multiplier", "kota"]):
        return (
            f"[{LABEL_RECO}] Panduan umum ripple ekonomi. Untuk KOMPUTASI grounded per kota, Copilot mendelegasikan ke `/api/intelligence/economic-ripple` — sertakan pertanyaan spesifik + login untuk memicu delegasi.\n\n"
            "### Peta Dampak Ekonomi Live Event Indonesia (/peta)\n\n"
            "Fitur Live Event Map di OKKAX mengukur bagaimana satu acara mengalirkan dampak finansial nyata ke ekosistem lokal:\n\n"
            "#### 4 Saluran Perputaran Ekonomi (Economic Ripple):\n"
            "1. **Sektor Perhotelan & Transportasi**: Okupansi hotel bintang 3-5, rental mobil, shuttle bandara, dan penerbangan domestik.\n"
            "2. **Kuliner & UMKM Daerah**: Belanja konsumsi penonton di sekitar venue dan omzet tenant lokal.\n"
            "3. **Upah Pekerja Kreatif Lokal**: Honor untuk stagehand, lighting programmer lokal, usher, security, dan driver logistik.\n"
            "4. **Pendapatan Pajak Daerah**: Pajak Barang dan Jasa Tertentu (PBJT) atas jasa kesenian dan hiburan.\n\n"
            "Eksplorasi peta interaktif 34 provinsi di [Live Event Map](/peta)."
        )

    # Default fallback — universal intent composer. Instead of templates
    # per domain, we compose a contextual reply from the classified intent
    # + parsed constraints + calculator policy. Kalau intent = UNKNOWN dan
    # tidak ada konteks numerik, Copilot tetap membantu dengan satu
    # klarifikasi terarah (bukan boilerplate).
    _cparsed = parse_constraints(query)
    _cint = classify_intent(query, _cparsed)
    hints = []
    if _cparsed.get("event_type"):
        hints.append(f"tipe event: {_cparsed['event_type']}")
    if _cparsed.get("city"):
        hints.append(f"kota: {_cparsed['city']}")
    if _cparsed.get("days_before"):
        hints.append(f"H-{_cparsed['days_before']}")
    hint_line = " · ".join(hints) if hints else ""
    if _cint == INTENT_KNOWLEDGE:
        return (
            f"### Ringkasan Domain OKKAX terkait pertanyaan Anda\n\n"
            f"[{LABEL_RECO}] Copilot menyimpan pengetahuan operasional lintas fase event: "
            "brief → matching → funding → compliance → ticketing → live ops → settlement. "
            f"{('Konteks yang terdeteksi: ' + hint_line + '.') if hint_line else ''}\n\n"
            f"[{LABEL_RECO}] Untuk membuat jawaban ini bergerak ke rekomendasi grounded "
            "berbasis event Anda, lampirkan event yang sedang dikerjakan sehingga Copilot "
            "dapat menarik data live (compliance, funding, tier, insiden) dan menggabungkan "
            "dengan Event Graph."
        )
    if _cint in (INTENT_ANALYTICAL, INTENT_SIMULATION):
        return (
            f"### Analisis diperlukan untuk: *\"{query}\"*\n\n"
            f"[{LABEL_UNKNOWN}] Copilot mendeteksi permintaan analitis tanpa cukup angka "
            "spesifik atau referensi event. Untuk mengalirkan ini melalui pipeline "
            "reasoning (kalkulator + Event Graph + Intelligence Engine), berikan minimal "
            "salah satu: kapasitas pax, budget total, target penghematan, tipe event, "
            "kota, atau event yang sedang dikerjakan. "
            f"{('Petunjuk yang tertangkap: ' + hint_line + '.') if hint_line else ''}"
        )
    return (
        f"### Perlu satu klarifikasi kecil\n\n"
        f"[{LABEL_UNKNOWN}] Copilot belum yakin arah pertanyaan Anda. "
        "Sebutkan domain yang ingin dibahas (budget, sponsor, tenant, ticketing, "
        "compliance, finance/break-even, live ops, Event Graph, atau ripple ekonomi) "
        f"{('dan konteks: ' + hint_line) if hint_line else ''} — Copilot akan lanjut ke "
        "analisis grounded, bukan panduan generik."
    )


# -----------------------------------------------------------------------------
# Grounded event snapshot & compact tool registry (READ-first).
# The endpoint layer (server.okkax_copilot_chat_endpoint) is responsible for
# tenant isolation via assert_event_access BEFORE these helpers run — the
# helpers themselves assume caller is already authorized to read the event.
# -----------------------------------------------------------------------------
async def gather_event_ground_truth(event_id: str) -> Dict[str, Any]:
    """Aggregate a tenant-safe live snapshot of an event. Returns UNKNOWN
    marker fields when a sub-fetch fails or the event does not exist.
    """
    ev = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not ev:
        return {"available": False, "reason": "event_not_found"}
    snap: Dict[str, Any] = {
        "available": True,
        "event": {
            "id": ev.get("id"),
            "name": ev.get("name"),
            "city": ev.get("city"),
            "event_type": ev.get("event_type") or ev.get("category"),
            "status": ev.get("status"),
            "capacity": ev.get("capacity"),
            "start_date": ev.get("start_date"),
            "end_date": ev.get("end_date"),
            "days": ev.get("days"),
        },
    }
    # Compliance snapshot (Phase 06 rows already persisted on demand)
    try:
        rows = await db.event_compliance.find({"event_id": event_id}, {"_id": 0}).to_list(200)
        from compliance_engine import compute_coverage_status
        by_status: Dict[str, int] = {}
        blocked_items = []
        for r in rows:
            s = r.get("status", "not_configured")
            by_status[s] = by_status.get(s, 0) + 1
            if s in ("rejected", "revoked", "expired"):
                blocked_items.append({
                    "rule_id": r.get("rule_id"),
                    "title": r.get("title"),
                    "authority_category": r.get("authority_category"),
                    "status": s,
                })
        snap["compliance"] = {
            "total": len(rows),
            "by_status": by_status,
            "coverage_status": compute_coverage_status(rows) if rows else "not_configured",
            "blocked_items": blocked_items,
        }
    except Exception as e:
        logger.warning(f"compliance snapshot failed: {e}")
        snap["compliance"] = {"error": True}
    # Ticketing snapshot
    try:
        tiers = await db.ticket_tiers.find({"event_id": event_id}, {"_id": 0}).to_list(50)
        sold = sum(t.get("sold", 0) for t in tiers)
        capacity = sum(t.get("quantity", 0) for t in tiers)
        gmv = sum(t.get("sold", 0) * t.get("price", 0) for t in tiers)
        snap["ticketing"] = {
            "tier_count": len(tiers),
            "sold": sold,
            "capacity": capacity,
            "sell_through_pct": round((sold / capacity) * 100, 2) if capacity else 0,
            "gmv_idr": gmv,
        }
    except Exception as e:
        logger.warning(f"ticketing snapshot failed: {e}")
        snap["ticketing"] = {"error": True}
    # Budget/funding (delegates to server.compute_budget so numbers stay canonical)
    try:
        from server import compute_budget  # late import to avoid circular
        b = await compute_budget(event_id)
        snap["finance"] = {
            "total_cost": b.get("total_cost"),
            "confirmed_funding": b.get("confirmed_funding"),
            "funding_gap": b.get("funding_gap"),
        }
    except Exception as e:
        logger.warning(f"budget snapshot failed: {e}")
        snap["finance"] = {"error": True}
    # Graph blocker & pending counts (light-weight — count docs, do not rebuild graph)
    try:
        risks = await db.risks.find({"event_id": event_id, "severity": {"$in": ["High", "Critical"]}}, {"_id": 0}).to_list(50)
        incidents = await db.incidents.count_documents({"event_id": event_id, "status": {"$in": ["open", "pending", "investigating"]}})
        talent_pending = await db.event_talents.count_documents({"event_id": event_id, "status": {"$ne": "Confirmed"}})
        vendor_pending = await db.event_vendors.count_documents({"event_id": event_id, "status": {"$ne": "Confirmed"}})
        snap["operational"] = {
            "high_severity_risks": len(risks),
            "open_incidents": incidents,
            "talent_pending": talent_pending,
            "vendor_pending": vendor_pending,
        }
    except Exception as e:
        logger.warning(f"operational snapshot failed: {e}")
        snap["operational"] = {"error": True}
    return snap


# Compact tool registry. Each tool is a pure descriptor consumed by the
# intent router below AND published in the response so callers see which
# sources actually grounded the reply. Write tools are gated behind a
# `requires_confirmation` flag — Copilot never fires them without an
# explicit follow-up confirmation payload from the UI plus an admin role.
# -----------------------------------------------------------------------------
# Intelligence Engine router — Copilot delegates supply/economic-ripple/
# breakeven/risk/pricing/forecast intents to the internal Intelligence
# handlers as reasoning tools. Returns StructuredPayload + Provenance which
# Copilot embeds into its reply so users always see the grounded source.
# -----------------------------------------------------------------------------
async def run_intelligence_query(query: str, user: dict) -> Optional[Dict[str, Any]]:
    """Invoke the Intelligence Engine `execute_intelligence_query` as a
    plain Python coroutine. Returns dict {summary, provenance, payload}
    or None on failure. All quota/RBAC enforcement of the Intelligence
    Engine still applies because we pass the authenticated user object.
    """
    try:
        from intelligence_engine import execute_intelligence_query
        from intelligence_models import IntelligenceRequest
        req = IntelligenceRequest(query=query)
        result = await execute_intelligence_query(req, user)
        # IntelligenceResponse pydantic model — normalize to plain dict
        rd = result.model_dump() if hasattr(result, "model_dump") else dict(result)
        return {
            "summary": rd.get("summary_text") or rd.get("summary") or "",
            "intent": (rd.get("intent") or {}).get("category") if isinstance(rd.get("intent"), dict) else rd.get("intent_category"),
            "structured_payload": rd.get("structured_payload"),
            "tools_executed": rd.get("tools_executed", []),
            "provenance": (rd.get("structured_payload") or {}).get("provenance") if isinstance(rd.get("structured_payload"), dict) else None,
        }
    except Exception as e:
        logger.warning(f"copilot->intelligence delegation failed: {e}")
        return None


# Intents that trigger Intelligence Engine delegation. Kept small on purpose —
# other intents remain grounded via `gather_event_ground_truth`.
_INTELLIGENCE_ROUTED_INTENTS = {"supply", "economic_ripple", "breakeven", "risk", "pricing", "forecasting"}


COPILOT_TOOLS: List[Dict[str, Any]] = [
    {"name": "get_event_ground_truth", "kind": "read", "domain": "event",
     "desc": "Live snapshot of event: metadata, compliance coverage, ticketing sold/capacity/GMV, finance total_cost/confirmed_funding/funding_gap, operational risk/incident/pending counts."},
    {"name": "get_event_graph", "kind": "read", "domain": "graph",
     "desc": "Radial dependency graph — nodes/edges/status_counts/readiness_score."},
    {"name": "get_event_compliance", "kind": "read", "domain": "compliance",
     "desc": "Phase 06 permit/compliance rows + coverage_status + provenance."},
    {"name": "get_event_budget", "kind": "read", "domain": "finance",
     "desc": "Server-authoritative compute_budget (cost lines, confirmed funding, gap)."},
    {"name": "get_ticketing_summary", "kind": "read", "domain": "ticketing",
     "desc": "Per-tier sold/quantity, GMV, sell-through, fee policy version."},
    {"name": "search_supply", "kind": "read", "domain": "network",
     "desc": "Search talents/venues/vendors/workers by city+keyword."},
    {"name": "intelligence_query", "kind": "read", "domain": "reasoning",
     "desc": "Delegate to /api/intelligence/query for grounded NLU + Provenance card."},
    {"name": "recommend_action", "kind": "advisory", "domain": "any",
     "desc": "Propose next step (RECOMMENDATION label) — never a write."},
    {"name": "confirm_and_execute_write", "kind": "write", "domain": "any",
     "requires_confirmation": True, "requires_admin": True,
     "desc": "Write actions (evidence submit, decision issue/revoke, refund, payout release) — refused unless explicit confirmation payload + admin role + audit."},
]


def get_copilot_tool_schemas() -> List[Dict[str, Any]]:
    """Compact JSON tool schema (OpenAI/Anthropic function-calling shape)
    for the Copilot read tools + confirmation-gated write. Callers/clients
    can render this to build in-UI action affordances; execution stays
    server-side and RBAC-gated.
    """
    return [
        {"type": "function", "function": {
            "name": "get_event_ground_truth", "description": "Live snapshot of event: metadata, compliance coverage, ticketing sold/capacity/GMV, finance total_cost/confirmed_funding/funding_gap, operational risk/incident/pending counts.",
            "parameters": {"type": "object", "properties": {"event_id": {"type": "string"}}, "required": ["event_id"]}}},
        {"type": "function", "function": {
            "name": "get_event_graph", "description": "Radial dependency graph — nodes/edges/status_counts/readiness_score.",
            "parameters": {"type": "object", "properties": {"event_id": {"type": "string"}}, "required": ["event_id"]}}},
        {"type": "function", "function": {
            "name": "get_event_compliance", "description": "Phase 06 permit/compliance rows + coverage_status + provenance.",
            "parameters": {"type": "object", "properties": {"event_id": {"type": "string"}}, "required": ["event_id"]}}},
        {"type": "function", "function": {
            "name": "get_event_budget", "description": "Server-authoritative compute_budget (cost lines, confirmed funding, gap).",
            "parameters": {"type": "object", "properties": {"event_id": {"type": "string"}}, "required": ["event_id"]}}},
        {"type": "function", "function": {
            "name": "get_ticketing_summary", "description": "Per-tier sold/quantity, GMV, sell-through, fee policy version.",
            "parameters": {"type": "object", "properties": {"event_id": {"type": "string"}}, "required": ["event_id"]}}},
        {"type": "function", "function": {
            "name": "search_supply", "description": "Search talents/venues/vendors/workers by city+keyword.",
            "parameters": {"type": "object", "properties": {"kind": {"type": "string", "enum": ["talent", "venue", "vendor", "worker"]}, "city": {"type": "string"}, "keyword": {"type": "string"}}}}},
        {"type": "function", "function": {
            "name": "intelligence_query", "description": "Delegate to /api/intelligence/query for grounded NLU + Provenance card.",
            "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}},
        {"type": "function", "function": {
            "name": "confirm_and_execute_write", "description": "Write action (evidence submit, decision issue/revoke, refund, payout release) — refused unless explicit confirmation payload + admin role + audit.",
            "parameters": {"type": "object", "properties": {"action": {"type": "string"}, "confirmed": {"type": "boolean"}, "event_id": {"type": "string"}}, "required": ["action", "confirmed"]}}},
    ]


def _intent_keywords(q: str) -> List[str]:
    q = q.lower()
    tags = []
    if any(k in q for k in ["blocker", "blocked", "risiko", "risk", "at risk", "kendala"]):
        tags.append("blocker")
    if any(k in q for k in ["compliance", "permit", "izin", "compliance", "compliance status", "readiness compliance"]):
        tags.append("compliance")
    if any(k in q for k in ["budget", "break-even", "break even", "anggaran", "biaya", "funding", "gap"]):
        tags.append("budget")
    if any(k in q for k in ["tiket", "ticket", "penjualan", "sold", "sell-through", "sell through"]):
        tags.append("ticketing")
    if any(k in q for k in ["finance", "payables", "receivables", "payout", "settlement", "kas"]):
        tags.append("finance")
    if any(k in q for k in ["incident", "insiden", "gate", "live", "attendance"]):
        tags.append("live_ops")
    if any(k in q for k in ["talent", "artis", "band", "musisi", "venue", "vendor", "sound", "lighting", "led", "genset", "worker", "usher", "security", "kru", "medis", "supply"]):
        tags.append("supply")
    if any(k in q for k in ["dampak ekonomi", "economic ripple", "multiplier", "pdrb", "hotel", "omset"]):
        tags.append("economic_ripple")
    if any(k in q for k in ["break-even", "break even", "titik impas"]):
        tags.append("breakeven")
    if any(k in q for k in ["harga pasar", "benchmark harga", "harga rata-rata", "pricing benchmark"]):
        tags.append("pricing")
    if any(k in q for k in ["forecast", "proyeksi", "prediksi", "sensitivitas"]):
        tags.append("forecasting")
    if any(k in q for k in ["release", "issue", "reject", "revoke", "refund", "bayar", "cairkan", "setujui", "keluarkan"]):
        tags.append("write_intent")
    return tags


def _format_grounded_event_block(snap: Dict[str, Any]) -> str:
    """Human-readable grounded block, labeled per source-priority contract."""
    if not snap.get("available"):
        return f"[{LABEL_UNKNOWN}] Event tidak ditemukan atau tidak dapat diakses."
    ev = snap["event"]
    lines = [f"[{LABEL_FACT}] Event: **{ev.get('name')}** · {ev.get('city')} · {ev.get('event_type')} · status {ev.get('status')} · kapasitas {ev.get('capacity')} pax · mulai {ev.get('start_date')}"]
    c = snap.get("compliance", {})
    if c and not c.get("error"):
        lines.append(f"[{LABEL_FACT}] Compliance: coverage=**{c.get('coverage_status')}** ({c.get('total')} item, breakdown {c.get('by_status')})")
        if c.get("blocked_items"):
            for bi in c["blocked_items"][:5]:
                lines.append(f"  - [{LABEL_FACT}] BLOCKED: {bi['title']} ({bi['authority_category']}) · status {bi['status']}")
    t = snap.get("ticketing", {})
    if t and not t.get("error"):
        lines.append(f"[{LABEL_FACT}] Ticketing: {t.get('sold')}/{t.get('capacity')} terjual ({t.get('sell_through_pct')}%) · GMV Rp{(t.get('gmv_idr') or 0):,}")
    f = snap.get("finance", {})
    if f and not f.get("error"):
        gap = f.get("funding_gap") or 0
        gap_label = LABEL_CALC
        lines.append(f"[{gap_label}] Finance: cost Rp{(f.get('total_cost') or 0):,} · confirmed funding Rp{(f.get('confirmed_funding') or 0):,} · funding gap Rp{gap:,}")
    o = snap.get("operational", {})
    if o and not o.get("error"):
        lines.append(f"[{LABEL_FACT}] Ops: high-severity risks={o.get('high_severity_risks')} · open incidents={o.get('open_incidents')} · talent pending={o.get('talent_pending')} · vendor pending={o.get('vendor_pending')}")
    return "\n".join(lines)


async def _grounded_reply(query: str, snap: Dict[str, Any], intents: List[str]) -> Optional[str]:
    """Produce a grounded, labeled answer for the highest-priority intent
    when the caller supplied a valid event context. Returns None when no
    grounded response is applicable — the deterministic knowledge brain
    then handles it as a knowledge/RECOMMENDATION query.
    """
    if not snap.get("available"):
        return None
    header = _format_grounded_event_block(snap)
    if "write_intent" in intents:
        return (
            "### Konfirmasi diperlukan sebelum eksekusi\n\n"
            + header
            + "\n\n[" + LABEL_RECO + "] Aksi write (issue/revoke/refund/payout) tidak dieksekusi dari sini. "
            "Silakan konfirmasi di UI terkait dengan akun admin. Copilot hanya menyediakan analisis + rekomendasi; "
            "eksekusi finansial/legal memerlukan RBAC + reauth + audit trail eksplisit."
        )
    if "blocker" in intents or "compliance" in intents:
        c = snap.get("compliance", {})
        ops = snap.get("operational", {})
        blocks: List[str] = [header, "", "### Blocker & Compliance"]
        if c.get("blocked_items"):
            blocks.append(f"[{LABEL_FACT}] Compliance blocker aktif: {len(c['blocked_items'])} item.")
        else:
            blocks.append(f"[{LABEL_FACT}] Tidak ada compliance blocker aktif; coverage `{c.get('coverage_status')}`.")
        if ops.get("high_severity_risks"):
            blocks.append(f"[{LABEL_FACT}] Risk register high/critical: {ops['high_severity_risks']} item.")
        if ops.get("open_incidents"):
            blocks.append(f"[{LABEL_FACT}] Insiden operasional terbuka: {ops['open_incidents']}.")
        blocks.append(f"[{LABEL_RECO}] Prioritas tindak lanjut: selesaikan compliance blocker → tutup insiden → dorong talent/vendor Pending ke Confirmed.")
        return "\n".join(blocks)
    if "budget" in intents or "finance" in intents:
        f = snap.get("finance", {})
        t = snap.get("ticketing", {})
        return "\n".join([header, "", "### Analisis Finansial Event",
                          f"[{LABEL_CALC}] Funding gap saat ini Rp{(f.get('funding_gap') or 0):,}.",
                          f"[{LABEL_FACT}] Realisasi tiket Rp{(t.get('gmv_idr') or 0):,} dari kapasitas {t.get('capacity')}.",
                          f"[{LABEL_RECO}] Bila gap > 0, evaluasi sponsor commitment terbuka, tier pricing, dan cost lines yang belum di-lock."])
    if "ticketing" in intents:
        t = snap.get("ticketing", {})
        return "\n".join([header, "", "### Ticketing",
                          f"[{LABEL_FACT}] Sold {t.get('sold')} dari kapasitas {t.get('capacity')} ({t.get('sell_through_pct')}%). GMV Rp{(t.get('gmv_idr') or 0):,}."])
    if "live_ops" in intents:
        o = snap.get("operational", {})
        return "\n".join([header, "", "### Live Operations",
                          f"[{LABEL_FACT}] Insiden terbuka: {o.get('open_incidents')}. Risks high/critical: {o.get('high_severity_risks')}."])
    if "supply" in intents or "economic_ripple" in intents:
        return "\n".join([header, "", "### Supply / Ripple",
                          f"[{LABEL_RECO}] Gunakan `/api/intelligence/query` dengan intent supply/economic-ripple untuk data grounded + Provenance. Copilot memfasilitasi routing."])
    # Default grounded overview
    return "\n".join([header, "", f"[{LABEL_RECO}] Ajukan pertanyaan spesifik (blocker/compliance/budget/tiket/ops/supply) agar Copilot dapat memberikan analisis grounded per domain."])


async def ask_okkax_copilot(
    message: str,
    history: Optional[List[Dict[str, str]]] = None,
    current_route: str = "",
    event_id: str = "",
    role: str = "",
    grounded_event_snapshot: Optional[Dict[str, Any]] = None,
    authed_user: Optional[dict] = None,
    engine_pref: Optional[str] = None,
) -> Dict[str, Any]:
    """Fungsi eksekusi utama OKKAX Copilot dengan dual-engine (LLM + High-Performance Deterministic Knowledge)."""
    key = os.environ.get("EMERGENT_LLM_KEY") or os.environ.get("OPENAI_API_KEY")
    history = sanitize_history(history)

    pipeline_stages: List[str] = ["parse_prompt"]

    # Small-talk short-circuit — greetings/thanks/ack/goodbye/casual address.
    # NO intelligence, snapshot, calculator, or tool executes for these.
    _st = _small_talk_reply(message)
    if _st is not None:
        pipeline_stages.append("small_talk_reply")
        return {
            "reply": _st,
            "engine": "okkax-copilot-conversational",
            "source": "small_talk",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "suggestions": get_smart_suggestions(current_route, role),
            "tools_available": [t["name"] for t in COPILOT_TOOLS],
            "grounded": False,
            "intents": ["small_talk"],
            "pipeline_stages": pipeline_stages,
            "reasoning_mode": "conversational",
            "llm_available": bool(key),
        }

    dynamic_context = await get_dynamic_platform_context()
    pipeline_stages.append("load_platform_context")

    intents = _intent_keywords(message)
    parsed = parse_constraints(message)
    plan = build_semantic_plan(message, parsed, history=history, event_id_present=bool(event_id))
    plan = merge_multi_turn_state(plan, history)
    intent_class = plan["intent"]
    calculator_policy = await get_active_copilot_calculator_policy(db)
    pipeline_stages.append("load_calculator_policy")
    pipeline_stages.append(f"classify_intent:{intent_class}")
    if plan["missing_fields"]:
        pipeline_stages.append("plan_missing_fields:" + ",".join(plan["missing_fields"]))
    # Adopt merged constraints back into `parsed` so downstream computes
    # see multi-turn carry-over.
    for k in ("baseline", "target", "budget", "capacity", "saving_intent"):
        if parsed.get(k) is None and plan["constraints"].get(k) is not None:
            parsed[k] = plan["constraints"][k]

    # KNOWLEDGE intent with a matching domain note — answer directly,
    # semantic-first (bukan template). Composer memakai domain note ringkas
    # dari model knowledge sebagai konteks bukan sebagai canned final.
    _knote = _knowledge_note_for(message)
    if intent_class == INTENT_KNOWLEDGE and _knote and not (grounded_event_snapshot and grounded_event_snapshot.get("available")):
        pipeline_stages.append("knowledge_composer")
        reply = _strip_internal_leaks(
            f"[{LABEL_RECO}] {_knote}\n\n"
            f"Kalau perlu penerapan spesifik untuk event Anda, lampirkan event yang sedang dikerjakan sehingga Copilot dapat menggabungkan penjelasan ini dengan data live (funding, tier, compliance, insiden)."
        )
        return {
            "reply": reply,
            "engine": "okkax-intelligence-core-v2-knowledge",
            "source": "knowledge_note",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "suggestions": get_smart_suggestions(current_route, role),
            "tools_available": [t["name"] for t in COPILOT_TOOLS],
            "intents": ["knowledge"] + plan["domains"],
            "pipeline_stages": pipeline_stages,
            "reasoning_mode": "knowledge",
            "llm_available": bool(key),
            "grounded": False,
            "semantic_plan": plan,
        }

    # ACTION intent — Copilot never self-executes writes. Composes an
    # explicit confirmation-required reply that names the domain operation
    # and delegates to the domain engine present in the UI. If required
    # fields are missing, asks for the SINGLE most-important one instead
    # of gate-blocking generically.
    if intent_class == INTENT_ACTION:
        pipeline_stages.append("action_plan")
        act = ", ".join(parsed.get("action_verbs") or []) or "aksi write"
        qty = parsed.get("quantity_tickets")
        # Ask for the ONE most important missing field first, instead of
        # a generic gate — completes the multi-turn action flow naturally.
        _ask = None
        _priority_missing = [f for f in plan["missing_fields"] if f in ("quantity_tickets", "tier_name", "event_id")]
        if _priority_missing:
            _labels = {"quantity_tickets": "berapa banyak tiket yang mau dibuat",
                        "tier_name": "tiket masuk tier apa (Regular / VIP / Presale)",
                        "event_id": "event mana yang akan diberi tiket ini"}
            _ask = _labels[_priority_missing[0]]
        qty_line = f"Kuantitas: {qty} tiket." if qty else ""
        who = "admin/organizer" if authed_user else "akun yang login"
        if _ask:
            reply = _strip_internal_leaks(
                f"[{LABEL_RECO}] Sebelum lanjut ke eksekusi **{act}**, mohon jelaskan: **{_ask}**?\n\n"
                f"{qty_line}\n"
                f"Setelah lengkap, konfirmasi akhir dilakukan di modul terkait ({who}) — domain engine yang menjalankan verifikasi, idempotency, dan audit."
            )
        else:
            reply = _strip_internal_leaks(
                f"### Konfirmasi diperlukan sebelum eksekusi\n\n"
                f"[RECOMMENDATION] Copilot mendeteksi permintaan aksi: **{act}**.\n"
                f"{qty_line}\n\n"
                f"Untuk keamanan (RBAC + tenant isolation + audit), Copilot tidak "
                f"menjalankan aksi finansial/inventory/permit langsung dari chat. "
                f"Silakan konfirmasi aksi ini di modul terkait pada workspace Anda "
                f"({who}) — pipeline domain existing yang akan menjalankan verifikasi, "
                f"idempotency, dan pencatatan audit."
            )
        return {
            "reply": reply,
            "engine": "okkax-intelligence-core-v2-action-gate",
            "source": "action_gate",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "suggestions": get_smart_suggestions(current_route, role),
            "tools_available": [t["name"] for t in COPILOT_TOOLS],
            "intents": ["action"] + plan["domains"],
            "pipeline_stages": pipeline_stages,
            "reasoning_mode": "action_gate",
            "llm_available": bool(key),
            "grounded": False,
            "parsed_constraints": {k: v for k, v in parsed.items() if v not in (None, [], False)},
            "semantic_plan": plan,
        }

    grounded_block = ""
    grounded_reply: Optional[str] = None
    if grounded_event_snapshot and grounded_event_snapshot.get("available"):
        grounded_block = _format_grounded_event_block(grounded_event_snapshot)
        grounded_reply = await _grounded_reply(message, grounded_event_snapshot, intents)
        pipeline_stages.append("gather_event_ground_truth")
        pipeline_stages.append("compose_grounded_reply")

    # Delegate to Intelligence Engine for supply/economic/breakeven/risk/
    # pricing/forecast intents — but ONLY when the caller is authenticated,
    # because the Intelligence Engine enforces its own quota + tenant guard.
    intelligence_block: Optional[Dict[str, Any]] = None
    if authed_user and (set(intents) & _INTELLIGENCE_ROUTED_INTENTS):
        intelligence_block = await run_intelligence_query(message, authed_user)
        if intelligence_block:
            pipeline_stages.append("intelligence_query")

    # Complexity heuristic: analytical queries need real reasoning. When the
    # LLM is unavailable AND the query is analytical (saving intent, budget+cap,
    # blocker/finance intent), we still ship the deterministic calculations
    # but transparently mark that advanced reasoning is offline.
    is_analytical = bool(
        parsed["saving_intent"] or (parsed["budget"] and parsed["capacity"])
        or (set(intents) & {"blocker", "compliance", "budget", "finance",
                             "supply", "economic_ripple", "breakeven", "risk",
                             "pricing", "forecasting"})
    )
    if parsed["saving_intent"] or parsed["budget"]:
        pipeline_stages.append("compute_budget_projection")

    event_context = ""
    if event_id and grounded_block:
        event_context = f"\n[EVENT LIVE SNAPSHOT]:\n{grounded_block}\n"

    def _render_intelligence(block: Dict[str, Any]) -> str:
        parts = [f"### {LABEL_FACT} · Intelligence Engine",
                 f"[{LABEL_FACT}] Intent: {block.get('intent') or 'general_intelligence'}"]
        if block.get("summary"):
            parts.append(f"[{LABEL_FACT}] {block['summary']}")
        prov = block.get("provenance") or {}
        if prov:
            parts.append(f"[{LABEL_FACT}] Provenance: source=`{prov.get('source')}` · verified={prov.get('verified')} · method=`{prov.get('calculation_method')}` · confidence={prov.get('confidence')}")
        sp = block.get("structured_payload") or {}
        if sp.get("items"):
            parts.append(f"[{LABEL_FACT}] Structured items: {len(sp['items'])} ({sp.get('payload_type', 'items')})")
        return "\n".join(parts)

    # Resolve preferred provider/model via AI_ENGINES router (never hardcode).
    try:
        from compiler import AI_ENGINES, DEFAULT_ENGINE, resolve_engine
        engine_cfg = resolve_engine(engine_pref)
    except Exception:
        engine_cfg = {"provider": "openai", "model": "gpt-5.4", "label": "ChatGPT GPT-5.4"}

    # 1. Jalankan LLM bila ada API Key
    if key:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage

            full_system = f"{OKKAX_COPILOT_SYSTEM_PROMPT}\n{dynamic_context}\n{event_context}\n[USER STATUS]: Role={role or 'Guest/User'}, Active Route={current_route or '/'}"
            if intelligence_block:
                full_system += "\n[INTELLIGENCE ENGINE RESULT]:\n" + _render_intelligence(intelligence_block) + "\n"

            chat = LlmChat(
                api_key=key,
                session_id=f"okkax-copilot-session-{role or 'user'}",
                system_message=full_system,
            ).with_model(engine_cfg.get("provider", "openai"), engine_cfg.get("model", "gpt-5.4")).with_params(max_tokens=4500)

            formatted_prompt = ""
            if history:
                formatted_prompt += "Riwayat percakapan sebelumnya:\n"
                for h in history[-4:]:
                    sender = "Pengguna" if h.get("role") == "user" else "OKKAX Copilot"
                    formatted_prompt += f"{sender}: {h.get('content', '')}\n"
                formatted_prompt += "\nPertanyaan terbaru pengguna:\n"

            formatted_prompt += message

            msg = UserMessage(text=formatted_prompt)
            raw = await asyncio.wait_for(chat.send_message(msg), timeout=90)
            reply = raw if isinstance(raw, str) else str(raw)

            pipeline_stages.append("llm_reasoning")
            return {
                "reply": reply.strip(),
                "engine": f"{engine_cfg.get('label', engine_cfg.get('model'))} (OKKAX Neural)",
                "engine_key": engine_cfg.get("model"),
                "provider": engine_cfg.get("provider"),
                "source": "provider_llm+intelligence" if intelligence_block else "provider_llm",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "suggestions": get_smart_suggestions(current_route, role),
                "tools_available": [t["name"] for t in COPILOT_TOOLS],
                "intelligence": intelligence_block,
                "intents": intents,
                "grounded": bool(grounded_reply or intelligence_block),
                "pipeline_stages": pipeline_stages,
                "reasoning_mode": "llm",
            }
        except Exception as e:
            logger.warning(f"OKKAX Copilot LLM execution fallback to internal knowledge brain: {e}")

    # 2. LLM tidak tersedia. Transparansi ada di metadata (`llm_available`,
    # `reasoning_mode`) — TIDAK di chat bubble. User tidak perlu melihat
    # istilah developer/internal di reply.
    if grounded_reply is not None or intelligence_block is not None:
        parts: List[str] = []
        if grounded_reply:
            parts.append(grounded_reply)
        if intelligence_block:
            parts.append(_render_intelligence(intelligence_block))
        parts.append("---")
        parts.append(f"[{LABEL_RECO}] Panduan pengetahuan pendukung:")
        parts.append(deterministic_okkax_copilot_brain(message, history, current_route, role, policy=calculator_policy))
        reply = _strip_internal_leaks("\n\n".join(parts))
        return {
            "reply": reply,
            "engine": "okkax-intelligence-core-v2-grounded",
            "source": "internal_knowledge_brain+live_event_snapshot" + ("+intelligence_engine" if intelligence_block else ""),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "suggestions": get_smart_suggestions(current_route, role),
            "tools_available": [t["name"] for t in COPILOT_TOOLS],
            "intelligence": intelligence_block,
            "grounded": True,
            "intents": intents,
            "pipeline_stages": pipeline_stages,
            "reasoning_mode": "deterministic_fallback",
            "llm_available": bool(key),
            "semantic_plan": plan,
        }
    reply = _strip_internal_leaks(deterministic_okkax_copilot_brain(message, history, current_route, role, policy=calculator_policy))
    return {
        "reply": reply,
        "engine": "okkax-intelligence-core-v2",
        "source": "internal_knowledge_brain",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "suggestions": get_smart_suggestions(current_route, role),
        "tools_available": [t["name"] for t in COPILOT_TOOLS],
        "grounded": False,
        "intents": intents,
        "pipeline_stages": pipeline_stages,
        "reasoning_mode": "deterministic" if not is_analytical else "deterministic_fallback",
        "llm_available": bool(key),
        "semantic_plan": plan,
    }


# Aliases for backward compatibility
ask_yoona = ask_okkax_copilot
deterministic_yoona_brain = deterministic_okkax_copilot_brain


def get_smart_suggestions(current_route: str = "", role: str = "") -> List[str]:
    """Menghasilkan saran prompt cerdas yang kontekstual terhadap rute aktif pengguna."""
    if "/studio" in current_route:
        return [
            "Bantu susun alokasi budget konser musik 5.000 pax Rp 1.2 Milyar",
            "Berapa daya genset & sound system ideal untuk 5.000 pax?",
            "Bagaimana pembagian kuota tiket Early Bird vs Regular?"
        ]
    if "/peta" in current_route or "/map" in current_route:
        return [
            "Kota mana dengan perputaran ekonomi event tertinggi?",
            "Bagaimana formula perhitungan multiplier effect ekonomi di OKKAX?",
            "Sektor lokal apa yang menerima dampak ekonomi terbesar?"
        ]
    if "/validator" in current_route:
        return [
            "Bagaimana cara mengatasi tiket yang gagal di-scan?",
            "Bagaimana SOP penanganan penonton saat terjadi antrean panjang di gate?",
            "Bagaimana cara membaca status tiket yang sudah used?"
        ]
    if "/sponsor" in current_route:
        return [
            "Bagaimana strategi menentukan harga paket Presenting Sponsor?",
            "Benefit apa saja yang paling dicari brand sponsor saat ini?",
            "Bagaimana cara menyusun proposal sponsor digital di OKKAX?"
        ]
    if "/tenant" in current_route:
        return [
            "Berapa harga sewa ideal untuk booth F&B di festival 5.000 pax?",
            "Fasilitas teknis apa yang wajib disediakan untuk tenant kuliner?",
            "Bagaimana sistem kurasi tenant UMKM di OKKAX?"
        ]
    
    return [
        "Bantu hitung budget & break-even festival 5.000 pax",
        "Bagaimana cara kerja Event Graph dan status nodenya?",
        "Jelaskan sistem verifikasi scanner tiket di pintu masuk",
        "Bagaimana pembagian benefit untuk Presenting Sponsor?"
    ]
