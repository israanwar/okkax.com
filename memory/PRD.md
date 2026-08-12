# OKKAX — Event Economy Operating Network (PRD)

## Original problem statement (ringkas)
Bangun aplikasi web full-stack **OKKAX** — "Event Economy Operating Network". Bukan landing page atau mockup:
harus punya autentikasi nyata, database persisten, RBAC 15 peran, relasi data benar, kalkulasi dinamis, alur
transaksi sandbox, data demo, dan vertical slice end-to-end yang dapat diuji juri:
Brief → AI Blueprint → Event Graph → Talent & Rider → Venue & Vendor → Sponsor & Tenant → Budget/Funding Gap →
Publish → Ticket purchase → Sandbox payment → QR ticket → Validasi → Economic Ripple.
Tagline: "One event. Every moving part." Browser title: "OKKAX — The Event Economy Operating Network".

## User choices (dari ask_human)
- AI Event Compiler: Emergent LLM Key (Claude) — diimplementasikan dengan `claude-haiku-4-5-20251001` + fallback deterministik.
- Auth: JWT email + password (Google login belum diimplementasikan — backlog P1).
- Pembayaran: sandbox simulasi internal (Stripe test mode belum diimplementasikan — backlog P1).
- Prioritas: vertical slice penuh + landing page.
- Bahasa: campuran (istilah produk Inggris, konten Indonesia).

## Arsitektur
- Backend: FastAPI (`/app/backend/server.py`, `core.py` auth/RBAC/audit, `compiler.py` AI, `seed_data.py` demo seed).
- Frontend: React + Tailwind + shadcn primitives, near-black + warm ivory + vermilion accent, Manrope/Playfair/Inter.
- DB: MongoDB, koleksi: users, organizations, talents, venues, vendors, workers, events, event_briefs,
  event_blueprints, event_talents, rider_items, event_venues, event_vendors, event_jobs, event_workers,
  sponsor_packages, sponsor_interests, sponsor_commitments, tenant_zones, booth_slots, tenant_applications,
  ticket_tiers, ticket_orders, tickets, ticket_validations, payments, payment_milestones, refunds,
  budget_items, funding_items, schedule_items, incidents, risks, notifications, audit_logs, login_attempts,
  password_reset_tokens.
- Event Graph, budget/funding gap, break-even, Economic Ripple dihitung on-the-fly dari relasi (bukan angka statis).

## Personas
Organizer/corporate buyer, event organizer, promotor, talent & talent management, venue manager, vendor,
sponsor, tenant/exhibitor, worker/freelancer, audience, finance approver, event supervisor, platform admin.

## Implemented (12 Juni 2026 — MVP)
- Auth JWT (register, login, logout, forgot/reset password, protected routes), RBAC 15 peran, isolasi data organisasi, audit log, rate-limit login.
- Event Studio (guided brief 4 langkah + autosave), AI Event Compiler async (baseline instan → Claude Haiku menyempurnakan di background, semua output berlabel & editable).
- Event Graph interaktif (node, status, dependency, filter, readiness score).
- Talent network + Structured Rider Engine 17 kategori + Landed Talent Cost otomatis.
- Venue compatibility score dengan penjelasan; vendor matching berskor; workforce jobs + QR check-in simulasi.
- Sponsor Exchange (packages, express interest, approve/reject, commitment, milestone) → mengurangi funding gap.
- Tenant Exchange (zones, booth map, apply, approve → booth occupied, revenue masuk funding, compatibility conflicts).
- Ticketing (14 tipe tier), publish event, Discover portal + halaman publik event dengan indikator kesiapan faktual.
- Checkout sandbox: VA (6 bank), QRIS, e-wallet (5), kartu, retail, corporate; PayLater & international ditandai future.
- Payment object lengkap (fee, pajak estimasi, net, status, audit), simulate paid/failed, refund sandbox, milestones, split settlement simulation.
- Tiket QR unik + validator (Valid / Already Used / Invalid), inventory berkurang, revenue & ripple ikut berubah.
- Budget Engine + What-If Simulator (Lean/Balanced/Premium + Apply Scenario), Economic Ripple, Command Center, Run of Show, incident, risk register, notification center, Admin panel, guided demo 16 langkah, demo reset.

## Implemented (12 Juni 2026 — iterasi 2)
- **Google login sekali klik** via Emergent-managed auth: `POST /api/auth/session` (tukar X-Session-ID → JWT + cookie httpOnly), halaman AuthCallback, tombol di /login dan /register. Login email+password tetap jalan.
- **Stripe test mode** untuk pembelian tiket kartu (Flow B / `STRIPE_API_KEY` environment; sandbox claimable tidak tersedia untuk negara ID): `POST /api/payments/stripe/checkout`, polling `GET /api/payments/stripe/status/{id}`, webhook `POST /api/webhook/stripe`, fulfillment idempoten (tiket QR + inventory), halaman /payment/success & /payment/cancel. Nilai IDR dikonversi ke USD pada kurs indikatif Rp16.000/USD dan ditampilkan sebagai catatan.
- **Dashboard peran** `/app/me` + `GET /api/me/workspace`: talent (booking, rider, jadwal pembayaran), venue (booking + deposit), vendor (kontrak), worker (shift, upah, check-in), finance approver/supervisor (milestone menunggu). Self-confirm `POST /api/me/workspace/confirm` dengan pengecekan kepemilikan (403 untuk pihak lain). Akun demo dipetakan lewat `DEMO_LINKS`.
- **Dokumen resmi PDF ber-logo OKKAX** (reportlab): invoice per order, quotation per event (biaya per kategori + funding gap + break-even), payment schedule (semua milestone). Tombol unduh di Orders dan workspace event; otorisasi dijaga.
- Diuji: 24/24 test backend iterasi 2 + Playwright UI lulus (`/app/backend/tests/test_iteration2.py`).

## Backlog
- P1: email nyata (Resend) untuk notifikasi & reset password; pembayaran kartu Stripe dalam IDR (butuh akun Stripe Indonesia); nomor tiket dari counter monotonik (hindari race pada fulfillment konkuren).
- P2: travel/hotel/logistics booking module, verified delivery record & review, tax reference admin, dispute/content report, upload dokumen verifikasi (object storage), SVG Event Graph dengan layout otomatis.

## Next tasks
1. Google login + email provider.
2. Dashboard per peran (talent, venue, vendor, worker, finance approver).
3. Invoice/quotation dokumen & payment schedule export.
