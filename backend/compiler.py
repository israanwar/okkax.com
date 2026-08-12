import os
import json
import asyncio
import logging
from typing import Optional

logger = logging.getLogger(__name__)

SYSTEM = """You are the OKKAX AI Event Compiler. You convert an event brief into a structured Event Blueprint
for the Indonesian event economy. Rules:
- NEVER invent confirmed facts, prices, availability, permits, taxes or attendance. Anything numeric you propose
  must be labelled as "Estimasi AI" or "Harga indikatif".
- Output MUST be a single valid JSON object, no markdown fences, no commentary.
- Keep it compact: maximum 5 entries per array, short sentences (max 20 words each).
- Use Indonesian for human-readable text, English for keys and product terms.
JSON schema:
{
 "summary": str,
 "format": str,
 "phases": [{"name": str, "objective": str, "duration": str}],
 "workstreams": [{"name": str, "owner_role": str, "description": str}],
 "timeline": [{"week": str, "activity": str, "status": "Belum diketahui"}],
 "required_capabilities": [str],
 "talent_requirements": [{"category": str, "notes": str, "label": "Estimasi AI"}],
 "venue_requirements": [{"requirement": str, "value": str}],
 "vendor_requirements": [{"category": str, "scope": str, "label": "Estimasi AI"}],
 "workforce_requirements": [{"role": str, "headcount": int, "shift": str}],
 "sponsor_inventory": [{"tier": str, "price_estimate": int, "quantity": int, "rights": [str]}],
 "tenant_zones": [{"name": str, "category": str, "slots": int, "price_estimate": int}],
 "ticket_recommendations": [{"name": str, "type": str, "price_estimate": int, "quantity": int}],
 "budget_categories": [{"category": str, "amount_estimate": int, "label": "Estimasi AI"}],
 "funding_model": [{"source": str, "amount_estimate": int}],
 "risks": [{"risk": str, "severity": "Low|Medium|High|Critical", "mitigation": str}],
 "missing_information": [str],
 "next_actions": [str]
}"""


def _fallback(brief: dict) -> dict:
    cap = int(brief.get("capacity") or 1000)
    budget = int(brief.get("budget") or 1000000000)
    days = int(brief.get("days") or 1)
    return {
        "summary": f"{brief.get('name')} adalah {brief.get('event_type')} di {brief.get('city')} "
                   f"dengan target {cap:,} pengunjung selama {days} hari. Blueprint ini adalah Estimasi AI dan perlu konfirmasi.",
        "format": brief.get("attendance_format") or "Offline",
        "phases": [
            {"name": "Pre-Production", "objective": "Kunci talent, venue, dan vendor utama", "duration": "8 minggu"},
            {"name": "Production", "objective": "Load-in, instalasi, rehearsal", "duration": f"{brief.get('setup_days') or 1} hari"},
            {"name": "Show Days", "objective": "Eksekusi run of show", "duration": f"{days} hari"},
            {"name": "Post-Event", "objective": "Settlement, laporan dampak ekonomi", "duration": "2 minggu"},
        ],
        "workstreams": [
            {"name": "Talent & Rider", "owner_role": "Event Organizer", "description": "Kontrak talent dan pemenuhan rider terstruktur"},
            {"name": "Venue & Produksi", "owner_role": "Event Organizer", "description": "Venue, stage, sound, lighting, LED"},
            {"name": "Commercial", "owner_role": "Organizer", "description": "Sponsor, tenant, ticketing"},
            {"name": "Operations", "owner_role": "Event Supervisor", "description": "Workforce, keamanan, medis, run of show"},
            {"name": "Finance", "owner_role": "Finance Approver", "description": "Budget, milestone payment, settlement"},
        ],
        "timeline": [
            {"week": "W-8", "activity": "Konfirmasi talent & venue", "status": "Belum diketahui"},
            {"week": "W-6", "activity": "Sponsor outreach & tenant open", "status": "Belum diketahui"},
            {"week": "W-4", "activity": "Publish event & buka penjualan tiket", "status": "Belum diketahui"},
            {"week": "W-1", "activity": "Load-in & rehearsal", "status": "Belum diketahui"},
        ],
        "required_capabilities": ["Stage & Rigging", "Sound System", "Lighting", "LED Screen", "Security", "Medical", "Ticketing Crew"],
        "talent_requirements": [{"category": brief.get("talent_category") or "Music Band", "notes": "Headliner utama, 90 menit", "label": "Estimasi AI"}],
        "venue_requirements": [
            {"requirement": "Kapasitas minimum", "value": f"{cap}"},
            {"requirement": "Tipe", "value": brief.get("venue_preference") or "Indoor"},
            {"requirement": "Setup days", "value": str(brief.get("setup_days") or 1)},
        ],
        "vendor_requirements": [
            {"category": "Stage", "scope": "Main stage + barricade", "label": "Estimasi AI"},
            {"category": "Sound", "scope": f"Line array untuk {cap} pax", "label": "Estimasi AI"},
            {"category": "Lighting", "scope": "Moving head + follow spot", "label": "Estimasi AI"},
            {"category": "LED", "scope": "Main LED + side wing", "label": "Estimasi AI"},
            {"category": "Security", "scope": "Perimeter + crowd control", "label": "Estimasi AI"},
            {"category": "Medical", "scope": "Ambulance + medical post", "label": "Estimasi AI"},
        ],
        "workforce_requirements": [
            {"role": "Usher", "headcount": max(10, cap // 100), "shift": "Show day"},
            {"role": "Ticketing Crew", "headcount": max(6, cap // 200), "shift": "Show day"},
            {"role": "Stagehand", "headcount": 12, "shift": "Load-in & load-out"},
            {"role": "Liaison Officer", "headcount": 4, "shift": "Show day"},
        ],
        "sponsor_inventory": [
            {"tier": "Presenting Sponsor", "price_estimate": int(budget * 0.2), "quantity": 1, "rights": ["Naming on title", "LED Exposure", "Stage Mention", "VIP Hospitality"]},
            {"tier": "Main Sponsor", "price_estimate": int(budget * 0.08), "quantity": 2, "rights": ["Booth Activation", "LED Exposure", "Social Media Exposure"]},
            {"tier": "Supporting Sponsor", "price_estimate": int(budget * 0.03), "quantity": 5, "rights": ["Logo Placement", "Product Sampling"]},
            {"tier": "Category Partner", "price_estimate": int(budget * 0.01), "quantity": 5, "rights": ["Category Exclusivity", "Logo Placement"]},
        ],
        "tenant_zones": [
            {"name": "Food & Beverage Zone", "category": "Food and Beverage", "slots": 14, "price_estimate": 7500000},
            {"name": "Creative & UMKM Zone", "category": "UMKM Lokal", "slots": 10, "price_estimate": 5000000},
            {"name": "Brand Activation Zone", "category": "Sponsor Activation", "slots": 6, "price_estimate": 12000000},
        ],
        "ticket_recommendations": [
            {"name": "Early Bird", "type": "Early Bird", "price_estimate": 250000, "quantity": max(200, cap // 5)},
            {"name": "Regular", "type": "Regular", "price_estimate": 375000, "quantity": max(500, cap // 2)},
            {"name": "VIP", "type": "VIP", "price_estimate": 950000, "quantity": max(100, cap // 10)},
        ],
        "budget_categories": [
            {"category": "Talent", "amount_estimate": int(budget * 0.28), "label": "Estimasi AI"},
            {"category": "Venue", "amount_estimate": int(budget * 0.14), "label": "Estimasi AI"},
            {"category": "Production", "amount_estimate": int(budget * 0.24), "label": "Estimasi AI"},
            {"category": "Marketing", "amount_estimate": int(budget * 0.08), "label": "Estimasi AI"},
            {"category": "Workforce", "amount_estimate": int(budget * 0.06), "label": "Estimasi AI"},
            {"category": "Contingency", "amount_estimate": int(budget * 0.05), "label": "Estimasi AI"},
        ],
        "funding_model": [
            {"source": "Organizer Budget", "amount_estimate": budget},
            {"source": "Sponsor Commitments", "amount_estimate": int(budget * 0.35)},
            {"source": "Tenant Revenue", "amount_estimate": 200000000},
            {"source": "Ticket Revenue", "amount_estimate": int(cap * 0.6 * 375000)},
        ],
        "risks": [
            {"risk": "Rider teknis talent belum dikonfirmasi vendor", "severity": "High", "mitigation": "Kunci vendor sound & lighting 6 minggu sebelum show"},
            {"risk": "Cuaca dan curfew venue", "severity": "Medium", "mitigation": "Siapkan skenario rundown alternatif"},
            {"risk": "Funding gap belum tertutup", "severity": "High", "mitigation": "Percepat sponsor commitment dan tenant occupancy"},
        ],
        "missing_information": ["Status pajak talent", "Konfirmasi izin keramaian", "Kapasitas listrik venue aktual"],
        "next_actions": ["Pilih talent dan aktifkan rider", "Cocokkan venue", "Kunci vendor produksi", "Buat sponsor package", "Konfigurasi ticket tier"],
        "source": "rule_based_fallback",
    }


async def compile_blueprint(brief: dict) -> dict:
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        return _fallback(brief)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        chat = LlmChat(
            api_key=key,
            session_id=f"okkax-compile-{brief.get('event_id')}",
            system_message=SYSTEM,
        ).with_model("anthropic", "claude-haiku-4-5-20251001").with_params(max_tokens=14000)
        msg = UserMessage(text="Event brief (JSON):\n" + json.dumps(brief, default=str, ensure_ascii=False))
        raw = await asyncio.wait_for(chat.send_message(msg), timeout=150)
        text = raw if isinstance(raw, str) else str(raw)
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        start, end = text.find("{"), text.rfind("}")
        data = json.loads(text[start:end + 1])
        base = _fallback(brief)
        base.update({k: v for k, v in data.items() if v})
        base["source"] = "claude-haiku-4-5"
        return base
    except Exception as e:
        logger.warning(f"AI compile failed, using deterministic fallback: {e}")
        fb = _fallback(brief)
        fb["source"] = "rule_based_fallback"
        fb["ai_error"] = str(e)[:200]
        return fb
