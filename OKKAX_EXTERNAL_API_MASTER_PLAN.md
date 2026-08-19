# OKKAX External API Master Plan

**Status:** Architecture Source of Truth\
**Project:** OKKAX.com\
**Scope:** Public Website + Member Dashboard / Member OS

## Prinsip Utama

Internal API OKKAX tetap menjadi **source of truth** untuk Event,
Network, Deals, Messages, Reputation, Teams, Requirements, Blueprint,
Finance Ledger, Opportunities, Action Center, Ticketing Logic, dan Event
Graph. External API hanya digunakan untuk memperkaya kapabilitas yang
tidak efisien atau tidak strategis jika dibangun sendiri.

  Prioritas   Arti
  ----------- --------------------------------------------------------
  P0          Sangat penting dan berdampak langsung pada produk inti
  P1          Penting setelah core flow stabil
  P2          Scale, enterprise, enrichment
  P3          Optional atau eksperimen

## 1. AI dan OKKAX Intelligence

  -----------------------------------------------------------------------
  Prioritas               Provider                Fungsi
  ----------------------- ----------------------- -----------------------
  P0                      OpenAI Responses API    Reasoning, function
                                                  calling, structured
                                                  output, multimodal

  P0                      Anthropic Claude API    Long-context reasoning
                                                  dan fallback

  P0                      Google Gemini API       Multimodal,
                                                  long-context, function
                                                  calling

  P1                      Embeddings              Semantic retrieval dan
                                                  matching

  P1                      Moderation/Safety       Messages, profile,
                                                  review, upload
  -----------------------------------------------------------------------

``` text
User → OKKAX Intelligence API → AI Router
                              ├─ OpenAI
                              ├─ Claude
                              └─ Gemini
                                      ↓
                              OKKAX Tool Layer
                                      ↓
                         Internal + External APIs
```

AI tidak menjadi database. Data faktual tetap berasal dari OKKAX dan
provider terverifikasi.

## 2. Payment, Wallet, Protected Balance dan Payout

  Prioritas   Provider             Fungsi
  ----------- -------------------- --------------------------------------
  P0          Xendit Payments      QRIS, e-wallet, VA, payment channels
  P0          Xendit xenPlatform   Multi-party account, routing, split
  P0          Xendit Payouts       Payout Talent, Vendor, Workforce
  P0          Xendit Webhooks      Sinkronisasi payment/payout
  P1          Midtrans             Secondary gateway/fallback
  P2          International PSP    Event internasional

OKKAX Wallet adalah UX + internal ledger + protected balance + payout
orchestration, bukan penyimpanan dana secara mandiri.

## 3. Maps, Places dan Logistics

  Prioritas   API                          Fungsi
  ----------- ---------------------------- ------------------------
  P0          Google Maps JavaScript API   Event/venue map
  P0          Places API                   Place dan venue search
  P0          Autocomplete                 Input lokasi
  P0          Geocoding                    Address ↔ coordinates
  P1          Routes API                   Logistics
  P1          Route Matrix                 Distance/time ranking
  P1          Time Zone API                International events

Ranking dapat menggabungkan availability, rating, price, location,
travel distance, dan event requirement fit.

## 4. Calendar

-   Google Calendar API --- P0/P1
-   Google Calendar FreeBusy --- P1
-   Microsoft Graph Calendar --- P1

External calendar hanya sync layer. OKKAX Calendar tetap source of truth
operasional.

## 5. Weather dan Event Risk

-   BMKG --- P0/P1 untuk Indonesia.
-   Global weather provider --- P2 untuk ekspansi internasional.

Dipakai untuk outdoor risk, stage/electrical protection, crowd comfort,
load-in/out, schedule adjustment, dan proactive Intelligence alerts.

## 6. Global Event Discovery

-   Ticketmaster Discovery API --- P1.
-   Venue/Attraction enrichment --- P1.
-   Partner event feeds --- P2.

External discovery hanya enrichment. Event OKKAX tetap sumber utama.

## 7. Artist dan Music Data

-   Spotify Web API --- P1.
-   YouTube Data API --- P1.
-   Additional music metadata --- P2.

Talent Profile menggabungkan verified OKKAX identity, portfolio,
availability, rate, event history, reputation, Spotify reference, dan
YouTube reference.

## 8. Email Infrastructure

-   Resend transactional email --- P0/P1.
-   Delivery/bounce webhooks --- P1.
-   Inbound email --- P1.

Digunakan untuk registration, reset password, ticket confirmation,
invoice, deals, contracts, payments, payouts, event updates,
cancellations, dan reminders.

**Messages tetap native OKKAX. Email hanya notification layer.**

## 9. Professional Messaging

``` text
Connection / Opportunity
→ Acceptance
→ Communication Permission
→ Conversation
→ Messages + Attachments
→ Deal / Event Context
```

Communication graph harus menjadi proprietary data moat OKKAX.
WhatsApp/SMS/email, jika digunakan, hanya delivery/notification layer.

## 10. E-Signature dan Contracts

-   DocuSign eSignature API --- P1.
-   Indonesian certified e-sign provider --- P1/P2.

Use cases: Talent, Vendor, Workforce, Sponsor, Tenant, Venue agreements
dan deal amendments.

## 11. Identity, KYC dan KYB

-   Identity verification --- P1.
-   Business verification --- P1.
-   Bank account verification --- P1.
-   Liveness/enhanced verification --- P2.

Dipicu terutama saat payout, high-value transaction, organization
creation, contract signing tertentu, atau verified status.

## 12. Security dan Anti-Bot

-   Cloudflare Turnstile --- P0.
-   OKKAX Auth/Session --- P0.
-   Fraud/risk scoring --- P1.
-   Rate limiting --- P1.

Proteksi untuk register, login abuse, password reset, public forms,
checkout, scraping, dan sensitive actions.

## 13. Product Analytics

-   PostHog Product Analytics --- P0/P1.
-   Session Replay --- P1.
-   Feature Flags --- P1.
-   Experiments --- P1.
-   Error Tracking --- P1.

Metric utama: activation, feature adoption, Event Studio completion,
role engagement, checkout conversion, Intelligence usage, Free→Pro
conversion, retention dan drop-off.

## 14. Media dan Asset Delivery

P1/P2. Provider harus mendukung CDN, image resizing, WebP/AVIF, signed
URLs, upload API, transformations dan caching.

Digunakan untuk posters, artist images, vendor portfolios, sponsor
assets, tickets, documents dan video.

## 15. Search dan Semantic Discovery

P2 setelah skala membesar:

-   dedicated keyword search;
-   vector search;
-   hybrid search.

``` text
Filter + Keyword + Semantic Match + Availability + Price + Reputation + Distance
= Ranked Result
```

## 16. Accounting dan Enterprise Finance

-   Jurnal --- P2.
-   Xero --- P2.
-   QuickBooks --- P2.
-   SAP --- P3.
-   Oracle --- P3.

OKKAX tetap memiliki finance ledger, invoice, payment, settlement,
protected balance dan tax breakdown. Accounting platform adalah
downstream integration.

## 17. Public Website API Map

  Area                    External Capability
  ----------------------- --------------------------
  Homepage Intelligence   OpenAI / Claude / Gemini
  Live Event Map          Google Maps
  Discovery               Ticketmaster enrichment
  Artist content          Spotify / YouTube
  Weather                 BMKG
  Analytics               PostHog
  Security                Turnstile
  Checkout                Xendit

## 18. Member Dashboard API Map

**Organizer/Promoter:** AI, Maps, Calendar, Xendit, BMKG, e-sign,
Resend, PostHog.\
**Talent:** Spotify, YouTube, Calendar, Payout, e-sign, AI.\
**Workforce:** Maps, Calendar, Payout, identity, notifications.\
**Vendor:** Maps, Calendar, Payout, e-sign, accounting, AI.\
**Sponsor:** Maps, Intelligence, e-sign, analytics, payments.\
**Tenant:** Maps, Calendar, payments, documents.\
**Audience:** Maps, event enrichment, media, payments/e-wallet, email.

## 19. OKKAX Intelligence Tool Set

``` text
search_events()
search_talents()
search_venues()
search_vendors()
search_workforce()
search_sponsors()
search_tenants()
check_availability()
get_event_budget()
get_ticket_sales()
get_finance_status()
get_protected_balance()
get_weather()
calculate_route()
calculate_distance()
get_calendar_conflicts()
get_contract_status()
get_payment_status()
get_payout_status()
calculate_break_even()
simulate_ticket_price()
simulate_capacity()
simulate_event_scenario()
get_artist_metadata()
get_external_event_context()
create_requirement()
create_action_item()
prepare_deal()
prepare_document()
```

AI memilih tool. Backend mengeksekusi dengan authorization, validation,
audit log, dan policy enforcement.

## 20. Recommended Stack dan Urutan Implementasi

### Wave 1 --- Core

1.  OpenAI
2.  Anthropic Claude
3.  Google Gemini
4.  Xendit
5.  Google Maps Platform
6.  Resend
7.  Cloudflare Turnstile

### Wave 2 --- Operational Intelligence

8.  Google Calendar
9.  BMKG
10. PostHog
11. Spotify
12. YouTube
13. DocuSign / local e-sign
14. Ticketmaster

### Wave 3 --- Scale / Enterprise

-   Microsoft Graph
-   Midtrans fallback
-   KYC/KYB
-   accounting integrations
-   dedicated search/vector infrastructure
-   international PSP
-   ERP integrations

## 21. Integration Architecture

``` text
                    ┌─ AI Providers
                    ├─ Payments
                    ├─ Maps / Places
                    ├─ Weather
Frontend → OKKAX API├─ Music / Media
                    ├─ Event Enrichment
                    ├─ Email
                    ├─ e-Sign
                    └─ Analytics / Security
```

Secret provider tidak boleh berada di frontend kecuali browser SDK resmi
menggunakan credential terbatas yang memang dirancang untuk client-side.

## 22. Backend Integration Layer

``` text
backend/integrations/
  ai/
    openai_provider.py
    anthropic_provider.py
    gemini_provider.py
  payments/
    xendit_provider.py
    midtrans_provider.py
  maps/
    google_maps_provider.py
  weather/
    bmkg_provider.py
  calendar/
    google_calendar_provider.py
    microsoft_calendar_provider.py
  media/
    spotify_provider.py
    youtube_provider.py
  discovery/
    ticketmaster_provider.py
  communication/
    email_provider.py
  signatures/
    esign_provider.py
```

Business logic tidak boleh tightly coupled ke provider tertentu.

## 23. Cache Policy

**Long cache:** artist metadata, venue/place details, city metadata,
static external references.\
**Medium cache:** routes, event enrichment, discovery references.\
**Short cache:** weather, availability, dynamic intelligence.\
**No stale cache:** payment confirmation, payout, settlement, ticket
validation, auth dan contract signing state.

## 24. Reliability Requirements

Setiap integration wajib memiliki:

-   timeout;
-   safe retry + exponential backoff;
-   circuit breaker;
-   structured logging;
-   correlation ID;
-   metrics;
-   rate-limit handling;
-   caching;
-   webhook verification;
-   idempotency untuk transaksi;
-   graceful degradation;
-   fallback bila relevan.

External API failure tidak boleh membuat seluruh dashboard gagal render.

## 25. Performance Rules

1.  Jangan fetch semua external APIs saat initial load.
2.  Lazy load enrichment.
3.  Aggregasi provider calls di backend.
4.  Pagination untuk katalog besar.
5.  Hindari request waterfall.
6.  Parallelize independent requests.
7.  Cache data yang aman.
8.  Prefetch hanya high-probability data.
9.  Enrichment tidak boleh blocking critical UI.
10. Event Graph, ticker, maps, media dan Intelligence harus
    progressive/non-blocking.

## 26. Security Rules

1.  Provider secrets server-side.
2.  Webhook wajib diverifikasi.
3.  Payment operations idempotent.
4.  Payout memiliki authorization + audit trail.
5.  AI tool call melewati permission layer.
6.  External responses divalidasi schema.
7.  Sensitive PII tidak dikirim ke AI tanpa kebutuhan/policy.
8.  OAuth menggunakan minimum scope.
9.  Refresh token dienkripsi.
10. Sandbox dan production credentials dipisahkan.

## 27. Strategic Data Moat

Tetap proprietary OKKAX:

-   Event Graph;
-   professional relationship graph;
-   deal history;
-   availability history;
-   reputation;
-   fulfillment history;
-   requirement graph;
-   derived price intelligence yang lawful;
-   operational performance;
-   ticketing performance;
-   workforce history;
-   sponsor-event relationships;
-   vendor-event relationships;
-   settlement reliability;
-   communication permission graph.

External APIs memperkaya graph tersebut, bukan memilikinya.

## 28. Final Architecture Principle

``` text
INTELLIGENCE
OpenAI / Claude / Gemini

MONEY MOVEMENT
Xendit + fallback

WORLD CONTEXT
Google Maps / BMKG / Calendar

ECOSYSTEM ENRICHMENT
Spotify / YouTube / Ticketmaster

INFRASTRUCTURE
Email / e-Sign / Analytics / Security
```

Core proprietary OKKAX tetap mencakup:

``` text
Events
Network
Deals
Messages
Teams
Reputation
Requirements
Blueprint
Finance Ledger
Opportunities
Action Center
Ticketing Logic
Event Graph
```

## 29. Implementation Order

``` text
PHASE 1
AI Router → Xendit → Google Maps → Resend → Turnstile

PHASE 2
Google Calendar → BMKG → PostHog

PHASE 3
Spotify → YouTube → Ticketmaster → e-Signature

PHASE 4
KYC/KYB → Accounting → Microsoft Graph
→ International Payments → Enterprise Integrations
```

**Target akhir:** external integration layer OKKAX harus modular, cepat,
fault-tolerant, aman, observable, cache-aware, dan provider-replaceable
tanpa merusak business logic maupun UI.
