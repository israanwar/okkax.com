# OKKAX — Event Economy Operating Network (PRD)

## Problem statement
Full-stack app yang mengubah satu event brief menjadi sistem ekonomi event digital: Brief → Blueprint →
Event Graph → Matching → Funding → Publishing → Sandbox Ticketing/Payments → Economic Ripple.
Peran: organizer, talent, venue, vendor, sponsor, tenant, worker, audience, finance, supervisor, admin.
Bahasa UI: Indonesia. Estetika: near-black premium, tipografi Bricolage Grotesque / Plus Jakarta Sans / IBM Plex Mono.

## Palet resmi (final, per permintaan user Juni 2026)
Hanya 3 warna: **hitam** (`#0a0a0a` / `#141414`), **pink premium** (`--okx-accent #ff2e7e`,
`--okx-accent-soft #ff7ab0`, `--okx-accent-tint #1b0711`), dan **putih**. Oranye/amber DILARANG.
Logo: mark X pink pada latar hitam (`LOGO_URL` di `frontend/src/lib/api.js`).

## Arsitektur
- Frontend React SPA (`/app/frontend/src`) + Tailwind + Shadcn UI. Auth JWT + Emergent Google OAuth.
- Backend FastAPI (`/app/backend`): `server.py` (routing), `compiler.py` (AI compiler + AI_ENGINES),
  `extras.py` (Stripe + Google auth), `seed_data.py` (event utama + katalog), `seed_events.py` (multi-event/multi-kota).
- MongoDB via MONGO_URL. Stripe Flow B (STRIPE_API_KEY di backend .env). PDF via ReportLab, preview via PyMuPDF.

## Sudah diimplementasi
- MVP vertical slice lengkap (blueprint, graph, matching, funding, publishing, ticketing sandbox, ripple).
- Google login, Stripe test checkout, dokumen PDF (invoice/quotation/payment schedule).
- Halaman demo `/juri` dan mode presentasi `/present`, GuidedDemo.
- Overhaul tipografi + logo kustom.
- **Juni 2026 — sesi ini:**
  - Integrasi ChatGPT/OpenAI models sebagai mesin AI Event Compiler yang bisa dipilih
    (`GET /api/ai/engines`, `POST /api/events/{id}/compile?engine=`; default `gpt-5.4`;
    pilihan gpt-5.5, gpt-5.4-mini, Claude Haiku 4.5, Claude Sonnet 4.6) + dropdown `ai-engine-select` di tab Blueprint.
  - 8 event demo baru di 7 kota tambahan (Jakarta, Bandung, Surabaya, Yogyakarta, Denpasar, Medan, Semarang)
    dengan 9 jenis event, 7 venue baru, tiers, sponsor package, tenant zone, workforce, budget/funding, risks.
  - Event Graph interaktif baru: kanvas SVG radial (satu Event ID di pusat), hover highlight dependency,
    klik node → panel detail + navigasi dependency, filter kategori, zoom, daftar node.
  - Repalet total ke hitam/pink/putih (index.css tokens, StatusBadge, Landing, JuriDemo, Tickets, Checkout, dll).
  - Logo baru pink-on-black.
  - **Peta Kota Event** (`/peta`, alias `/map`): `GET /api/economy/map` mengagregasi dampak ekonomi per kota
    (biaya event, GMV tiket, sponsor, tenant, venue, talent, vendor, upah tenaga kerja, bisnis teraktivasi).
    Frontend SVG peta Indonesia (`frontend/src/data/indonesia-map.json`, 34 provinsi tersimplifikasi) dengan
    gelembung per kota yang mengikuti metrik terpilih, hover highlight, klik kota → panel detail + daftar event,
    dan peringkat kota. Tertaut di nav publik & footer.

  - **Redesign Event Graph (workspace + homepage)**: layout radial simetris (Event di pusat, satu/dua orbit
    tergantung jumlah node), ikon SVG inline per kategori (`NodeIcon`, diekspor dari `workspace/BlueprintGraph.jsx`),
    garis radial rapi + kurva melengkung ke pusat untuk relasi turunan, animasi aliran halus (stroke-dashoffset),
    pulse pada node kritis/pusat, label anti-tabrakan (anchor mengikuti sudut), hover highlight dependency.
    Nav publik: menu Categories & Cities dihapus (cukup Discover).

  - **Discover P0 (Agu 2026)**: katalog demo diperbesar ke 31 event, 15 kota, 11 kategori
    (`seed_events.py`: EXTRA_EVENTS + BULK_VENUES/BULK_EVENTS/_bulk_specs dengan tanggal relatif hari ini,
    sehingga ada event berstatus `live`). `GET /api/discover/events` diperkaya: sold_percentage, headline_talent,
    tenant_count, vendor_count, sponsor_slots/sold, economic_ripple, is_live/this_week/days_to_event,
    plus `totals` & `highlights` (live / this_week / almost_sold_out / top_impact).
    Halaman Discover dirombak: strip statistik jaringan, indikator "N event ditemukan", tombol Reset filter,
    4 carousel seksi, grid "Semua event", kartu kaya (organizer, talent utama, progress tiket, tenant/vendor/sponsor, ripple).
  - Semua sisa warna hijau/amber (readiness badge, /juri, tiket, checkout) diganti ke token hitam/pink/putih.

  - **Fix P0 katalog Discover hilang (Agu 2026)**: penyebabnya startup hanya menjalankan
    `seed_data.seed(force=False)` yang berhenti bila DB sudah pernah di-seed, sehingga 30 event katalog
    tidak pernah masuk ke DB lama/produksi (hanya event Aruna tampil). Sekarang `startup()` di `server.py`
    SELALU memanggil `seed_extra_events()` yang 100% upsert (tanpa delete_many/drop) dengan id deterministik.
    Ditambah tes regresi `backend/tests/test_discover_catalog.py` (>=12 published, tanpa duplikat,
    idempotent saat seed diulang, konsisten dengan /peta dan halaman detail).

## Backlog
- P0 Email Nyata: kirim invoice + tiket QR ke email pembeli setelah pembayaran (WAJIB pakai playbook Resend via integration_expert).: kirim invoice + tiket QR ke email pembeli setelah pembayaran (WAJIB pakai playbook Resend via integration_expert).
- P1 Lencana Rekam Jejak vendor/worker untuk event yang selesai.
- P2 Tema terang khusus cetak untuk laporan/halaman juri.
- P2 Streaming (SSE) untuk output AI compiler agar terasa real-time.
- P2 Zoom/pan pada Peta Kota Event dan filter rentang tanggal.

## Status uji
Iteration 5: backend 13/13 pass (`/app/backend/tests/test_iteration5.py`), frontend Playwright pass.
Satu temuan palet di Landing.jsx sudah diperbaiki setelah laporan.
