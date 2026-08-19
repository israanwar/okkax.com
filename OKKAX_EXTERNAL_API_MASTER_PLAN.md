# OKKAX External API Master Plan

**Status:** Architecture Source of Truth
**Project:** OKKAX.com
**Scope:** Public Website + Member Dashboard / Member OS + Backend Platform Engineering

---

## Prinsip Utama

Internal API OKKAX tetap menjadi **source of truth** untuk Event, Network, Deals, Messages, Reputation, Teams, Requirements, Blueprint, Finance Ledger, Opportunities, Action Center, Ticketing Logic, dan Event Graph. External API hanya digunakan untuk memperkaya kapabilitas yang tidak efisien, berisiko kepatuhan tinggi, atau tidak strategis jika dibangun sendiri dari nol.

| Prioritas | Arti |
|---|---|
| **P0** | **Kritis & Mutlak:** Berdampak langsung pada kelangsungan transaksi, identitas, legalitas, keamanan, dan *core flow* produk. |
| **P1** | **Operasional & Pengayaan:** Penting setelah *core flow* stabil untuk otomatisasi dan efisiensi operasional. |
| **P2** | **Skala & Enterprise:** Untuk integrasi enterprise tingkat lanjut, ekspansi regional/internasional, dan pelaporan korporat. |
| **P3** | **Opsional / Eksperimental:** Fitur riset atau integrasi sekunder. |

---

## 1. AI dan OKKAX Intelligence

| Prioritas | Provider / Layanan | Fungsi Utama di Backend |
|---|---|---|
| **P0** | **OpenAI Responses API** (`gpt-5.4`, `gpt-5.5`) | Reasoning, function calling, schema enforcement, dynamic risk modeling, dan structured JSON output. |
| **P0** | **Anthropic Claude API** (`claude-sonnet-4-6`, `claude-haiku-4-5`) | Long-context blueprint reasoning, event contract review, dan fallback analyzer. |
| **P0** | **Google Gemini API** (`gemini-2.5-pro`, `gemini-2.5-flash`) | Multimodal event floor-plan analysis, sound/lighting layout visual reasoning, dan real-time copilot grounding. |
| **P1** | **Text Embeddings** (`text-embedding-3-large`) | Semantic search, supply matching (Talent/Vendor/Workforce ke Event Requirements), dan semantic talent retrieval. |
| **P1** | **Moderation & Content Safety API** | Screening pesan deal, portfolio media upload, deskripsi event publik, dan ulasan review. |

```text
User / Member OS → OKKAX Intelligence Engine (/api/intelligence) → AI Router Layer
                                                  ├─ OpenAI Router (Reasoning & Tools)
                                                  ├─ Claude Router (Long-Doc & Governance)
                                                  └─ Gemini Router (Multimodal & Grounding)
                                                           ↓
                                              OKKAX Tool Execution Layer
                                                           ↓
                                      [Internal DB Ledger + Verified External APIs]
```

> **Aturan Utama:** AI bukan database. Data faktual, ketersediaan jadwal, harga pasti, dan saldo keuangan selalu diverifikasi terhadap database internal OKKAX sebelum dirender ke user.

---

## 2. Payment, Wallet, Protected Balance, dan Payout

| Prioritas | Provider / Endpoint | Fungsi Utama di Backend |
|---|---|---|
| **P0** | **Xendit Payments API** | Payment checkout via QRIS (Semua Bank & e-Wallet), Virtual Account (BCA, Mandiri, BNI, BRI, Permata), E-Wallet (GoPay, OVO, Dana, ShopeePay), dan Kartu Kredit/Debit. |
| **P0** | **Xendit xenPlatform** | Multi-party split payment: memisahkan otomatis antara platform fee OKKAX, host revenue, ticket sales, dan vendor escrow. |
| **P0** | **Xendit Disbursements / Payouts API** | Penarikan dana (*payout*) langsung ke rekening bank Talent, Vendor, Venue, dan Workforce secara batch atau instan. |
| **P0** | **Xendit Bank Account Inquiry API** | Validasi nama pemilik rekening bank secara *real-time* sebelum payout dieksekusi guna mencegah salah transfer. |
| **P0** | **Xendit Webhooks Engine** | Sinkronisasi status pembayaran, refund, dan payout secara asinkron dengan verifikasi signature token `x-callback-token`. |
| **P1** | **Midtrans Snap / Iris API** | Secondary fallback gateway untuk mitigasi downtime pembayaran domestik. |
| **P2** | **Stripe / International PSP** | Pemrosesan tiket atau pembayaran sponsor berbasis mata uang asing (USD, SGD, EUR) untuk event internasional. |

> **Aturan Keuangan:** OKKAX Wallet adalah antarmuka UX + internal double-entry ledger + protected balance escrow orchestration. OKKAX tidak bertindak sebagai bank penyimpanan dana liar (*non-custodial escrow routing via licensed PSP*).

---

## 3. Komunikasi & Pesan Operasional (WhatsApp, SMS & Push)

| Prioritas | Provider / Layanan | Fungsi Utama di Backend |
|---|---|---|
| **P0** | **WhatsApp Business API / Gateway** (Qontak / Fonnte / Twilio) | Pengiriman instan tiket QR pass, kode verifikasi OTP, panggilan darurat crew (*crew call broadcast*), dan notifikasi penawaran deal penting. |
| **P1** | **SMS Gateway** (Twilio / Telkomsel Digihub) | Fallback autentikasi 2FA dan notifikasi kritis saat jaringan internet venue tidak stabil. |
| **P0** | **Firebase Cloud Messaging (FCM) / WebPush API** | Push notification langsung ke browser dashboard organizer untuk event live updates, tiket terjual, dan status gerbang. |
| **P0** | **Real-Time WebSocket / Redis PubSub Engine** | Sinkronisasi data langsung (*sub-second*) untuk Live Scanner Gate Monitor, Live Attendance Ticker, Incident Escalation, dan Chat Interaktif. |

```text
Event Trigger (e.g. Tiket Terbit / Alert Panggung)
  ↓
Notification Engine (backend/notifications.py)
  ├─ In-App Action Center (Internal DB)
  ├─ WebSocket Event Stream (Realtime Dashboard)
  ├─ WhatsApp API (Mobile Notification + Ticket Pass Link)
  └─ Resend Email (Official PDF Attachment)
```

---

## 4. Email Infrastructure & Dokumen Transaksional

| Prioritas | Provider / Layanan | Fungsi Utama di Backend |
|---|---|---|
| **P0** | **Resend Transactional Email API** | Pengiriman email transaksional dengan delivery rate tinggi: aktivasi akun, invoice resmi, tiket digital dengan QR code embedded, reset password, dan ringkasan settlement. |
| **P1** | **Resend Webhooks** | Pelacakan status email *delivered*, *bounced*, *opened*, dan *complaint* untuk audit keamanan akun. |
| **P1** | **Inbound Email Routing (Resend/Postmark)** | Menerima balasan penawaran deal atau inquiry sponsorship langsung ke thread percakapan OKKAX. |

> **Catatan:** Sistem perpesanan formal (*Messages & Deals*) tetap berada di dalam platform OKKAX. Email dan WhatsApp hanya bertindak sebagai delivery & notification transport.

---

## 5. Storage, Media CDN, dan Dokumen Terdistribusi

| Prioritas | Provider / Layanan | Fungsi Utama di Backend |
|---|---|---|
| **P0** | **Cloudflare R2 / AWS S3 Compatible Object Storage** | Penyimpanan aset dokumen PDF (Quotation, Invoice, Rundown, Kontrak), tiket pass image, poster event resolusi tinggi, dan tech rider vendor. |
| **P0** | **Pre-signed Upload URL Generator** | Memungkinkan frontend mengunggah file besar langsung ke secure storage tanpa membebani memori backend server. |
| **P1** | **Image Transformation & CDN (Cloudflare Images / Cloudinary)** | Optimasi otomatis gambar poster dan foto profil ke format WebP/AVIF, auto-resizing, dan edge caching global. |
| **P1** | **Document Preview Engine (PyMuPDF / PDF.js)** | Rendering instan preview dokumen PDF di dashboard tanpa perlu download berkas. |

---

## 6. Maps, Geolocation, dan Logistik Event

| Prioritas | Provider / Layanan | Fungsi Utama di Backend |
|---|---|---|
| **P0** | **Google Maps JavaScript API & SDK** | Visualisasi peta event publik, peta sebaran ekonomi event (`/map`, `/peta`), dan lokasi venue di dashboard. |
| **P0** | **Google Places API (New) & Autocomplete** | Pencarian tempat, nama gedung, aula, dan pengisian alamat otomatis di Event Studio. |
| **P0** | **Google Geocoding & Reverse Geocoding** | Konversi dua arah antara alamat tertulis dan koordinat lintang/bujur (Latitude/Longitude). |
| **P1** | **Google Routes API & Distance Matrix** | Perhitungan jarak dan estimasi waktu tempuh logistik vendor, load-in stage, dan mobilisasi kru event. |
| **P1** | **Time Zone API** | Normalisasi zona waktu event multi-kota (WIB, WITA, WIT, UTC). |

---

## 7. Cuaca, Lingkungan, dan Mitigasi Risiko Acara

| Prioritas | Provider / Layanan | Fungsi Utama di Backend |
|---|---|---|
| **P0** | **BMKG Open Data API (Indonesia)** | Data prakiraan cuaca lokal per kecamatan/kabupaten, kecepatan angin, kelembapan, dan peringatan dini cuaca ekstrem. |
| **P1** | **OpenWeatherMap / Tomorrow.io API** | Secondary radar presipitasi *hourly* dan indeks radiasi UV untuk event outdoor / festival musik. |

> **Implementasi di OKKAX Intelligence:** Data cuaca dianalisis otomatis untuk menghitung *Outdoor Risk Score*, rekomendasi penutup panggung, proteksi kelistrikan, dan manajemen antrean tiket.

---

## 8. Kalender & Sinkronisasi Jadwal Eksternal

| Prioritas | Provider / Layanan | Fungsi Utama di Backend |
|---|---|---|
| **P0** | **Google Calendar API (OAuth 2.0)** | Sinkronisasi dua arah jadwal rundown event, shift kru, dan jadwal manggung talent ke Google Calendar pengguna. |
| **P1** | **Google Calendar Free/Busy API** | Pengecekan ketersediaan jadwal talent/venue secara instan sebelum organizer mengirim penawaran deal. |
| **P1** | **Microsoft Graph Calendar API** | Sinkronisasi kalender untuk pengguna korporat, B2B venue, dan enterprise event organizers. |

---

## 9. E-Signature, Legalitas, dan Kepatuhan Kontrak

| Prioritas | Provider / Layanan | Fungsi Utama di Backend |
|---|---|---|
| **P1** | **PrivyID / VIDA / Peruri Sign API (PSrE Indonesia)** | Tanda tangan elektronik tersertifikasi dengan kekuatan hukum mengikat di Indonesia untuk kontrak deal bernilai tinggi (> Rp 100 Juta). |
| **P1** | **DocuSign eSignature REST API** | Integrasi tanda tangan kontrak digital standar internasional untuk talent dan sponsor global. |
| **P0** | **Internal Cryptographic Audit Trail** | Perekaman hash SHA-256 dokumen, IP address, timestamp ISO-8601, dan persetujuan role untuk setiap milestone deal. |

---

## 10. Identitas, KYC, KYB, dan Pencegahan Fraud

| Prioritas | Provider / Layanan | Fungsi Utama di Backend |
|---|---|---|
| **P1** | **Verihubs / Privy KYC API** | Verifikasi e-KTP dan liveness face match bagi talent/organizer penarik dana untuk mencegah identity theft. |
| **P1** | **Kemenkumham / AHU Business Registry Verification** | Validasi legalitas PT/CV organizer atau vendor sebelum menerbitkan faktur B2B dan tiket berskala mega. |
| **P0** | **Cloudflare Turnstile** | CAPTCHA privasi-tinggi tanpa interupsi untuk mencegah bot scraping tiket, brute-force login, dan spam booking. |
| **P0** | **HMAC-SHA256 Ticket Cryptography** | Enkripsi payload QR tiket dengan timestamp rotasi dinamis untuk mencegah screenshot ticket sharing / percaloan. |

---

## 11. Pajak & Kepatuhan Keuangan Domestik (e-Faktur / PPh / PPN)

| Prioritas | Provider / Layanan | Fungsi Utama di Backend |
|---|---|---|
| **P1** | **OnlinePajak / Pajakku API / DJP Gateway** | Pembuatan Faktur Pajak elektronik (e-Faktur) otomatis atas PPN 11%/12% biaya jasa platform OKKAX. |
| **P1** | **Withholding Tax Calculator (PPh 21 / PPh 23)** | Perhitungan otomatis dan pembuatan bukti potong pajak penghasilan atas fee Talent dan jasa sewa Vendor. |

---

## 12. Musik, Artis, dan Ekosistem Kreatif

| Prioritas | Provider / Layanan | Fungsi Utama di Backend |
|---|---|---|
| **P1** | **Spotify Web API** | Mengambil data artis terverifikasi, jumlah monthly listeners, album populer, genre, dan embed player untuk profil Talent. |
| **P1** | **YouTube Data API v3** | Mengambil video live performance terbaru dan visual showreel artis untuk kurasi organizer. |
| **P2** | **Ticketmaster Discovery API** | Referensi jadwal tur artis internasional untuk deteksi potensi routing festival di Asia Tenggara. |

---

## 13. Observability, Logging & Error Tracking

| Prioritas | Provider / Layanan | Fungsi Utama di Backend |
|---|---|---|
| **P0** | **Sentry SDK (Python FastAPI + React)** | Error capture instan, stacktrace monitoring, unhandled exception alerting, dan performance transaction tracing. |
| **P1** | **PostHog Product Analytics** | Pelacakan alur konversi tiket, retensi dashboard organizer, funnel Event Studio, dan feature flag rollout. |
| **P1** | **BetterStack / OpenTelemetry** | Uptime monitoring, external API latency tracking, dan alert status webhook pihak ketiga. |

---

# OKKAX MCP (Model Context Protocol) Master Strategy

Untuk mempercepat penyelesaian dan pemeliharaan platform OKKAX secara eksponensial, kita mengintegrasikan **Model Context Protocol (MCP)** ke dalam alur kerja agentic coding dan backend runtime. MCP memberikan AI akses langsung yang aman, terstandarisasi, dan instan ke database, API server, log, serta pengujian sistem.

```text
+-------------------------------------------------------------------------------+
|                       ANTIGRAVITY AI AGENTIC ENVIRONMENT                      |
+-------------------------------------------------------------------------------+
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
   ┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
   │   MongoDB MCP     │      │   FastAPI MCP     │      │   Xendit/Mock MCP │
   │ Direct Query/Seed │      │ Endpoint Testing  │      │ Webhook Simulator │
   └───────────────────┘      └───────────────────┘      └───────────────────┘
             │                          │                          │
             ▼                          ▼                          ▼
   ┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
   │    Sentry MCP     │      │    GitHub MCP     │      │  Filesystem MCP   │
   │ Exception Triage  │      │ CI/CD & Branches  │      │ Code Architecture │
   └───────────────────┘      └───────────────────┘      └───────────────────┘
```

---

## Daftar MCP Server Utama untuk Akselerasi Project OKKAX

### 1. 🗄️ MongoDB MCP Server (`mcp-server-mongodb`)
- **Fungsi Utama:**
  - Menjalankan agregasi pipeline, query analitik finansial, dan inspeksi schema langsung pada database `okkax_local`.
  - Memverifikasi konsistensi relasi antara Event, Ticket Tiers, Orders, dan Deals secara instan.
  - Melakukan validasi *index performance* pada koleksi berukuran besar (misal: `events`, `users`, `notifications`).
- **Tools yang Disediakan:**
  - `mongodb_find_documents(collection, filter, limit)`
  - `mongodb_aggregate(collection, pipeline)`
  - `mongodb_validate_indexes(collection)`
  - `mongodb_inspect_schema(collection)`

### 2. ⚡ FastAPI & OpenAPI REST Testing MCP Server (`mcp-server-openapi`)
- **Fungsi Utama:**
  - Membaca dan mengeksekusi ~191 endpoint pada `server.py` secara otomatis menggunakan spesifikasi OpenAPI (`http://127.0.0.1:8001/openapi.json`).
  - Menghasilkan payload pengujian otomatis untuk alur ticketing, checkout, kalender, dan copilot.
  - Menguji regression security dan RBAC headers (`Authorization: Bearer <token>`) tanpa perlu menulis script tes manual dari nol.
- **Tools yang Disediakan:**
  - `api_list_endpoints(tag_filter)`
  - `api_execute_request(method, path, headers, body)`
  - `api_validate_contract(endpoint, sample_response)`

### 3. 💳 Xendit & Payment Gateway Webhook Simulator MCP (`mcp-server-payment-sim`)
- **Fungsi Utama:**
  - Mensimulasikan callback webhook pembayaran QRIS, Virtual Account terbayar, dan payout sukses/gagal langsung ke endpoint `/api/payments/webhook`.
  - Menguji penanganan *idempotency key* dan perlindungan *double-spending* pada pemesanan tiket.
  - Mensimulasikan pencairan dana (*disbursement*) bertahap ke rekening vendor dan talent.
- **Tools yang Disediakan:**
  - `simulate_qris_payment_success(order_id, amount)`
  - `simulate_va_paid_callback(va_number, amount)`
  - `simulate_disbursement_completed(disbursement_id)`
  - `verify_webhook_signature(payload, secret_token)`

### 4. 🚨 Sentry Error Tracking & Diagnosis MCP (`mcp-server-sentry`)
- **Fungsi Utama:**
  - Mengambil daftar unhandled error, traceback Python di backend, dan React error boundary di frontend secara real-time.
  - Mengidentifikasi timeout external API (misal: keterlambatan respon AI provider atau gateway cuaca) dan langsung mengusulkan perbaikan baris kode terkait.
- **Tools yang Disediakan:**
  - `sentry_get_latest_issues(project, limit)`
  - `sentry_get_stacktrace(issue_id)`
  - `sentry_resolve_issue(issue_id)`

### 5. 🔍 Codebase Vector & Graph Semantic Search MCP (`mcp-server-codebase`)
- **Fungsi Utama:**
  - Navigasi super-cepat melintasi berkas backend besar (`server.py`, `intelligence_engine.py`, `member_os_services.py`).
  - Menemukan deklarasi model Pydantic, dekorator rute, fungsi helper enkripsi, dan middleware secara instan berdasarkan semantik.
- **Tools yang Disediakan:**
  - `code_semantic_search(query, directory)`
  - `code_find_references(symbol_name)`
  - `code_extract_ast_definitions(file_path)`

### 6. 🐙 GitHub & CI/CD Workflow MCP (`mcp-server-github`)
- **Fungsi Utama:**
  - Membuat branch fitur modular, merilis pull request terstruktur dengan ringkasan pengujian, dan memantau status GitHub Actions.
  - Memverifikasi bahwa seluruh *test suite* backend dan *check-secrets.sh* lolos sebelum merge ke `main`.
- **Tools yang Disediakan:**
  - `github_create_pull_request(title, body, branch, base)`
  - `github_get_workflow_runs(workflow_id)`
  - `github_check_pr_status(pr_number)`

### 7. 📄 PDF & ReportLab QA Inspector MCP (`mcp-server-document-qa`)
- **Fungsi Utama:**
  - Memvalidasi hasil kompilasi PDF ReportLab dari `document_engine.py` (Invoice, Quotation, Schedule) secara otomatis.
  - Memeriksa keakuratan tabel, kalkulasi PPN/total, tata letak logo wordmark, dan halaman multi-page tanpa perlu membuka viewer manual.
- **Tools yang Disediakan:**
  - `pdf_extract_text_and_tables(pdf_path)`
  - `pdf_render_page_as_image(pdf_path, page_num)`
  - `pdf_validate_metadata_and_signatures(pdf_path)`

---

## Struktur Direktori Integrasi Backend

```text
backend/
├── integrations/
│   ├── __init__.py
│   ├── ai/
│   │   ├── openai_client.py
│   │   ├── claude_client.py
│   │   └── gemini_client.py
│   ├── payments/
│   │   ├── xendit_client.py
│   │   └── midtrans_client.py
│   ├── messaging/
│   │   ├── whatsapp_client.py
│   │   ├── resend_email_client.py
│   │   └── push_notification_client.py
│   ├── maps/
│   │   └── google_maps_client.py
│   ├── weather/
│   │   └── bmkg_client.py
│   ├── storage/
│   │   └── r2_storage_client.py
│   ├── signatures/
│   │   └── esign_client.py
│   └── tax/
│       └── tax_compliance_client.py
├── intelligence_engine.py
├── intelligence_models.py
├── member_os_services.py
├── document_engine.py
├── notifications.py
└── server.py
```

---

## Kebijakan Cache & Reliability

| Jenis Data | TTL Cache | Strategi / Penyimpanan |
|---|---|---|
| **Prakiraan Cuaca BMKG** | 30 Menit | In-Memory TTL Cache (`SHA-256(city)`) |
| **Google Places Search** | 24 Jam | In-Memory TTL Cache (`SHA-256(query, limit)`) |
| **Google Routes Calculation** | 12 Jam | In-Memory TTL Cache (`SHA-256(origin, dest, mode)`) |
| **Profil & Metadata Spotify** | 7 Hari | In-Memory TTL Cache (`SHA-256(artist_name)`) |
| **Showreels & Video YouTube** | 3 Hari | In-Memory TTL Cache (`SHA-256(query, limit)`) |
| **Status Pembayaran & Payout** | **0 Detik (No Cache)** | *Direct Database Read + Webhook Event Processing* |
| **Validasi Tiket QR Gate** | **0 Detik (Real-time)** | *Direct Atomic DB Update + Offline Public-Key Fallback* |

---

## Matriks Status Provider Aktual (Verification & Capability Matrix)

| Provider Key | Enabled Default | Status Saat Ini | Klasifikasi | Fallback Behavior | Kebutuhan Kredensial Live |
|---|---|---|---|---|---|
| **`bmkg`** | `true` | `healthy` | **LIVE_VERIFIED** | Deterministic Baseline Weather (`Cerah Berawan`, 30°C) | *None (Public Open API)* |
| **`gemini`** | `false` | `disabled` / `not_configured` | **MOCK_VERIFIED** | Fallback to OpenAI → Anthropic → Deterministic Compiler | `GEMINI_API_KEY`, `GEMINI_ENABLED=true` |
| **`openai`** | `false` | `disabled` / `not_configured` | **MOCK_VERIFIED** | Fallback to Anthropic → Deterministic Compiler | `OPENAI_API_KEY`, `OPENAI_ENABLED=true` |
| **`anthropic`** | `false` | `disabled` / `not_configured` | **MOCK_VERIFIED** | Fallback to Deterministic Compiler | `ANTHROPIC_API_KEY`, `ANTHROPIC_ENABLED=true` |
| **`resend`** | `false` | `disabled` / `not_configured` | **MOCK_VERIFIED** | In-app notification database logging | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_ENABLED=true` |
| **`whatsapp`** | `false` | `disabled` / `not_configured` | **MOCK_VERIFIED** | In-app notification database logging | `WHATSAPP_API_KEY`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ENABLED=true` |
| **`fcm`** | `false` | `disabled` / `not_configured` | **MOCK_VERIFIED** | Web in-app polling & notification history | `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT_JSON`, `FCM_ENABLED=true` |
| **`google_places`** | `false` | `disabled` / `not_configured` | **MOCK_VERIFIED** | Static venue list & simulated place extraction | `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_ENABLED=true` |
| **`google_routes`** | `false` | `disabled` / `not_configured` | **MOCK_VERIFIED** | Deterministic Haversine distance & duration estimation | `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_ENABLED=true` |
| **`r2_storage`** | `false` | `disabled` / `not_configured` | **MOCK_VERIFIED** | Local simulated mock storage URLs | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `STORAGE_ENABLED=true` |
| **`spotify`** | `false` | `disabled` / `not_configured` | **MOCK_VERIFIED** | Database local artist profile fallback | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_ENABLED=true` |
| **`youtube`** | `false` | `disabled` / `not_configured` | **MOCK_VERIFIED** | Local portfolio showreel fallback | `YOUTUBE_API_KEY`, `YOUTUBE_ENABLED=true` |
| **`privy_esign`** | `false` | `not_configured` | **IMPLEMENTATION READY** | Interface contract (NotConfigured default; no fake signatures) | `PRIVY_API_KEY`, `PRIVY_MERCHANT_KEY`, `PRIVY_ENABLED=true` |

---

## Standar Keandalan & Error Handling

Setiap modul integrasi di `backend/integrations/` menerapkan:
1. **Strict Timeout:** Maksimum 5.0–10.0 detik untuk API sinkron, 60.0 detik untuk AI generation.
2. **Exponential Backoff & Retry:** Otomatis mencoba ulang 3 kali pada status kode `429`, `502`, `503`, `504` dengan jitter.
3. **Circuit Breaker:** Membuka sirkuit jika kegagalan mencapai 50% dalam 1 menit, mengalihkan ke mode fallback (*cached weather* atau *rule-based compiler*).
4. **Zero Crashing Policy:** Kegagalan external API pihak ketiga tidak boleh menyebabkan *crash* pada endpoint backend utama atau memblokir dashboard member.
5. **Zero Secret Leakage:** Status dan health endpoint hanya mengekspos metrics status operasional; kredensial tidak pernah keluar dari server.
