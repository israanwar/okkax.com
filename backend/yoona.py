import os
import json
import logging
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from core import db

logger = logging.getLogger("okkax.yoona")

YOONA_SYSTEM_PROMPT = """Kamu adalah "Yoona", Principal Event Intelligence & Copilot Operasional Resmi untuk platform OKKAX (Live Event Operating Network di Indonesia).

IDENTITAS & KARAKTER YOONA:
- Nama: Yoona
- Peran: OKKAX Principal Event Intelligence & Autonomous Operations Copilot
- Karakter: Sangat cerdas, berwibawa, tajam dalam kalkulasi data & finansial, profesional, hangat, serta menguasai seluruh aspek operasional live event di Indonesia dari level makro hingga teknis lapangan.
- Gaya Bahasa: Bahasa Indonesia yang elegan, profesional, berbasis data industri, dan terstruktur rapi dengan markdown, bullet points, dan tabel angka Rupiah berformat jelas.
- PANTANGAN BESAR: DILARANG KERAS menggunakan emoji apapun (seperti kilat, robot, bintang, api, sparkles, otak, dan sejenisnya) dalam seluruh teks jawaban atau judul. Gunakan tipografi teks dan penomoran editorial murni.

PENGETAHUAN TINGKAT LANJUT & LUAR BIASA YOONA:

1. STANDAR & FORMULA KALKULASI EVENT INDUSTRI INDONESIA:
   - Alokasi Anggaran Standar Konser/Festival:
     * Talent & Rider (Artis utama, supporting act, hospitality, flights, hotel bintang 4/5): 26% - 30% (standar 28%)
     * Produksi Teknis (Ground support stage, Rigging, Line Array Sound System, Lighting, LED Screen P3/P4, Genset silent, Mojo Barricade): 22% - 26% (standar 24%)
     * Venue & Legalitas (Sewa venue, Izin Keramaian Kepolisian, PBJT Pajak Hiburan 10-20%, Lisensi Royalti Musik LMKN/WAMI): 12% - 15% (standar 14%)
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


def calculate_advanced_event_model(budget: int, capacity: int, event_type: str = "Konser Musik") -> Dict[str, Any]:
    """Model komputasi finansial mendalam untuk event berskala apapun."""
    talent = int(budget * 0.28)
    production = int(budget * 0.24)
    venue = int(budget * 0.14)
    marketing = int(budget * 0.08)
    workforce = int(budget * 0.06)
    contingency = int(budget * 0.05)
    operations = budget - (talent + production + venue + marketing + workforce + contingency)

    # Monetization Projection
    target_sponsor = int(budget * 0.35)
    target_tenant = max(15000000, int(capacity * 16000))
    ticket_revenue_target = max(0, budget - target_sponsor - target_tenant)
    break_even_pax = max(1, int(capacity * 0.82))
    avg_ticket_price = int(ticket_revenue_target / break_even_pax) if capacity else 250000

    # Sound & Technical Specs
    sound_watt_rms = max(10000, int(capacity * 18))
    ushers_needed = max(6, capacity // 80)
    security_needed = max(8, capacity // 100)
    medical_posts = max(1, capacity // 2500)

    return {
        "budget": budget,
        "capacity": capacity,
        "event_type": event_type,
        "breakdown": {
            "Talent & Rider": {"amount": talent, "percent": "28%", "notes": "Honor artis headliner, supporting act, flight & hospitality"},
            "Produksi Teknis": {"amount": production, "percent": "24%", "notes": f"Stage, Line Array ({sound_watt_rms:,}W RMS), Lighting, LED, Barricade"},
            "Venue & Legalitas": {"amount": venue, "percent": "14%", "notes": "Sewa lokasi, izin Mabes/Polda/Polres, pajak hiburan PBJT"},
            "Marketing & OOH": {"amount": marketing, "percent": "8%", "notes": "Digital ads, billboard OOH, media relations"},
            "Workforce Kru": {"amount": workforce, "percent": "6%", "notes": f"LO, {ushers_needed} Usher, {security_needed} Security, Medis ({medical_posts} Pos)"},
            "Dana Cadangan": {"amount": contingency, "percent": "5%", "notes": "Buffer tak terduga (genset cadangan, cuaca, overtime)"},
            "Operasional & F&B": {"amount": operations, "percent": "15%", "notes": "Tenda roder, sanitasi, konsumsi, akomodasi kru"},
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


def deterministic_yoona_brain(query: str, history: List[Dict[str, str]] = None, current_route: str = "", role: str = "") -> str:
    """Mesin inferensi dan pengetahuan tingkat tinggi Yoona untuk respon cepat & berbobot tinggi."""
    q = query.lower()
    
    # 1. Pertanyaan tentang Identitas Yoona & OKKAX
    if any(k in q for k in ["siapa kamu", "tentang yoona", "apa itu yoona", "kenalan", "yoona"]):
        return (
            "### Halo! Saya Yoona — Principal Event Intelligence & Copilot Operasional Resmi OKKAX.\n\n"
            "Saya memandu promotor, brand sponsor, tenant, pengelola venue, dan pekerja kreatif dalam merancang serta mengoperasikan live event berskala profesional di seluruh Indonesia.\n\n"
            "#### Ruang Lingkup Konsultasi Yoona:\n"
            "1. **Komputasi Finansial & Alokasi Anggaran**: Kalkulasi alokasi pos biaya, target break-even, hingga proyeksi dana cadangan.\n"
            "2. **Penyusunan Brief & Technical Blueprint**: Menghasilkan workstreams, timeline W-8, technical rider panggung, dan spesifikasi daya sound system.\n"
            "3. **Event Graph & Dependency Analytics**: Menemukan potensi blocker antara kontrak artis, kesiapan vendor, dan pencairan sponsor.\n"
            "4. **Sponsorship Valuation & Tenant Zoning**: Skema penawaran hak eksklusif brand dan monetisasi slot UMKM/F&B.\n"
            "5. **Ticketing & Gate Control (/validator)**: Panduan sistem QR code dinamis, validasi gate scanner, dan metode pembayaran lokal.\n"
            "6. **Peta Perputaran Ekonomi (/peta)**: Analisis multiplier effect dan dampak ekonomi regional di 15+ kota besar.\n\n"
            "Ketik rencana acara atau pertanyaan teknis Anda, dan saya akan menyusun analisis komprehensif untuk Anda."
        )

    # 2. Pertanyaan tentang Perancangan Event / Kalkulasi Budget
    if any(k in q for k in ["buat event", "bikin event", "brief", "anggaran", "budget", "hitung", "kalkulasi", "simulasi", "biaya", "konser", "festival"]):
        cap = 3000
        budget = 750000000
        
        if "50000" in q or "50.000" in q or "stadion" in q:
            cap = 50000
            budget = 15000000000
        elif "10000" in q or "10.000" in q:
            cap = 10000
            budget = 2800000000
        elif "5000" in q or "5.000" in q:
            cap = 5000
            budget = 1250000000
        elif "1000" in q or "1.000" in q:
            cap = 1000
            budget = 300000000

        data = calculate_advanced_event_model(budget, cap, "Live Concert & Festival")
        
        return (
            f"### Rencana Finansial & Spesifikasi Operasional Event ({cap:,} Pax)\n\n"
            f"Berdasarkan standar industri live event OKKAX untuk skala **{cap:,} Penonton**, estimasi total investasi ideal adalah **Rp {budget:,}** dengan rincian pos anggaran berikut:\n\n"
            "| Pos Pengeluaran | Porsi | Estimasi Alokasi (IDR) | Cakupan & Catatan Operasional |\n"
            "| :--- | :--- | :--- | :--- |\n"
            f"| **Talent & Rider** | 28% | **Rp {data['breakdown']['Talent & Rider']['amount']:,}** | {data['breakdown']['Talent & Rider']['notes']} |\n"
            f"| **Produksi Teknis** | 24% | **Rp {data['breakdown']['Produksi Teknis']['amount']:,}** | {data['breakdown']['Produksi Teknis']['notes']} |\n"
            f"| **Venue & Legalitas** | 14% | **Rp {data['breakdown']['Venue & Legalitas']['amount']:,}** | {data['breakdown']['Venue & Legalitas']['notes']} |\n"
            f"| **Marketing & OOH** | 8% | **Rp {data['breakdown']['Marketing & OOH']['amount']:,}** | {data['breakdown']['Marketing & OOH']['notes']} |\n"
            f"| **Workforce Kru** | 6% | **Rp {data['breakdown']['Workforce Kru']['amount']:,}** | {data['breakdown']['Workforce Kru']['notes']} |\n"
            f"| **Dana Cadangan** | 5% | **Rp {data['breakdown']['Dana Cadangan']['amount']:,}** | {data['breakdown']['Dana Cadangan']['notes']} |\n"
            f"| **Operasional & F&B** | 15% | **Rp {data['breakdown']['Operasional & F&B']['amount']:,}** | {data['breakdown']['Operasional & F&B']['notes']} |\n\n"
            "#### Strategi Penutupan Pendanaan & Target Tiket:\n"
            f"- **Target Sponsor (Presenting & Main)**: **Rp {data['funding']['sponsor_target']:,}** (~35% biaya)\n"
            f"- **Target Slot Tenant F&B / UMKM**: **Rp {data['funding']['tenant_target']:,}**\n"
            f"- **Kebutuhan Revenue Penjualan Tiket**: **Rp {data['funding']['ticket_revenue_target']:,}**\n"
            f"- **Harga Tiket Rata-rata Break-Even**: **Rp {data['funding']['avg_ticket_price']:,}** (Dihitung pada batas aman **{data['funding']['break_even_pax']:,} tiket** atau 82% kapasitas).\n\n"
            "#### Rekomendasi Teknis & Crowd Management:\n"
            f"- **Kebutuhan Sound System**: Minimal **{data['technical_specs']['sound_watt_rms']:,} Watt RMS** Line Array dengan SPL target 104 dB di FOH.\n"
            f"- **Kebutuhan Tim Lapangan**: Minimal **{data['technical_specs']['ushers']} Usher**, **{data['technical_specs']['security']} Personel Keamanan**, dan **{data['technical_specs']['medical_posts']} Pos Medis Lengkap**.\n\n"
            "Anda dapat langsung mengeksekusi parameter ini di [Event Studio](/app/studio) untuk menghasilkan Blueprint dan visualisasi Event Graph."
        )

    # 3. Pertanyaan tentang Event Graph & Mitigasi Risiko
    if any(k in q for k in ["event graph", "grafik", "radial", "node", "dependensi", "blocker", "risiko"]):
        return (
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
        return (
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
            "### Peta Dampak Ekonomi Live Event Indonesia (/peta)\n\n"
            "Fitur Live Event Map di OKKAX mengukur bagaimana satu acara mengalirkan dampak finansial nyata ke ekosistem lokal:\n\n"
            "#### 4 Saluran Perputaran Ekonomi (Economic Ripple):\n"
            "1. **Sektor Perhotelan & Transportasi**: Okupansi hotel bintang 3-5, rental mobil, shuttle bandara, dan penerbangan domestik.\n"
            "2. **Kuliner & UMKM Daerah**: Belanja konsumsi penonton di sekitar venue dan omzet tenant lokal.\n"
            "3. **Upah Pekerja Kreatif Lokal**: Honor untuk stagehand, lighting programmer lokal, usher, security, dan driver logistik.\n"
            "4. **Pendapatan Pajak Daerah**: Pajak Barang dan Jasa Tertentu (PBJT) atas jasa kesenian dan hiburan.\n\n"
            "Eksplorasi peta interaktif 34 provinsi di [Live Event Map](/peta)."
        )

    # Default respon berpengetahuan luas
    return (
        f"### Rekomendasi Strategis Yoona untuk: *\"{query}\"*\n\n"
        "Dalam manajemen acara profesional berbasis ekosistem OKKAX, berikut rekomendasi langkah operasional terbaik:\n\n"
        "1. **Kunci Parameter Kritis Terlebih Dahulu**: Pastikan estimasi kapasitas penonton dan tanggal acara telah diselaraskan dengan ketersediaan venue di [Event Studio](/app/studio).\n"
        "2. **Monitor Rantai Pasok pada Event Graph**: Cek dependensi antara rider artis dengan kapabilitas vendor panggung & sound system di [Workspace](/app/events).\n"
        "3. **Jaga Struktur Likuiditas Acara**: Terapkan target 35% sponsor + 50% tiket + 5% dana cadangan darurat untuk menghindari defisit sebelum hari H.\n"
        "4. **Kepatuhan Legalitas & Keamanan**: Koordinasikan izin keramaian Polisi dan tim medis minimal 4-6 minggu sebelum pelaksanaan.\n\n"
        "Silakan ajukan pertanyaan lebih spesifik seputar *alokasi budget*, *strategi sponsor*, *Event Graph*, atau *validasi tiket*, dan saya akan berikan analisis detailnya."
    )


async def ask_yoona(
    message: str,
    history: Optional[List[Dict[str, str]]] = None,
    current_route: str = "",
    event_id: str = "",
    role: str = ""
) -> Dict[str, Any]:
    """Fungsi eksekusi utama Yoona dengan dual-engine (LLM + High-Performance Deterministic Knowledge)."""
    key = os.environ.get("EMERGENT_LLM_KEY") or os.environ.get("OPENAI_API_KEY")
    history = history or []

    dynamic_context = await get_dynamic_platform_context()
    
    event_context = ""
    if event_id:
        try:
            ev = await db.events.find_one({"id": event_id})
            if ev:
                event_context = f"\n[EVENT TERPILIH]: Nama: {ev.get('name')}, Kota: {ev.get('city')}, Kategori: {ev.get('category')}, Status: {ev.get('status')}, Kapasitas: {ev.get('capacity')} pax\n"
        except Exception as e:
            logger.warning(f"Failed to fetch event context for {event_id}: {e}")

    # 1. Jalankan LLM bila ada API Key
    if key:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            
            full_system = f"{YOONA_SYSTEM_PROMPT}\n{dynamic_context}\n{event_context}\n[USER STATUS]: Role={role or 'Guest/User'}, Active Route={current_route or '/'}"
            
            chat = LlmChat(
                api_key=key,
                session_id=f"yoona-session-{role or 'user'}",
                system_message=full_system,
            ).with_model("openai", "gpt-5.4").with_params(max_tokens=4500)
            
            formatted_prompt = ""
            if history:
                formatted_prompt += "Riwayat percakapan sebelumnya:\n"
                for h in history[-4:]:
                    sender = "Pengguna" if h.get("role") == "user" else "Yoona"
                    formatted_prompt += f"{sender}: {h.get('content', '')}\n"
                formatted_prompt += "\nPertanyaan terbaru pengguna:\n"
            
            formatted_prompt += message
            
            msg = UserMessage(text=formatted_prompt)
            raw = await asyncio.wait_for(chat.send_message(msg), timeout=90)
            reply = raw if isinstance(raw, str) else str(raw)
            
            return {
                "reply": reply.strip(),
                "engine": "gpt-5.4 (Yoona Neural)",
                "source": "emergent_llm",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "suggestions": get_smart_suggestions(current_route, role)
            }
        except Exception as e:
            logger.warning(f"Yoona LLM execution fallback to internal knowledge brain: {e}")

    # 2. Jalankan Mesin Pengetahuan Internal Yoona
    reply = deterministic_yoona_brain(message, history, current_route, role)
    return {
        "reply": reply,
        "engine": "yoona-core-intelligence-v2",
        "source": "internal_knowledge_brain",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "suggestions": get_smart_suggestions(current_route, role)
    }


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
