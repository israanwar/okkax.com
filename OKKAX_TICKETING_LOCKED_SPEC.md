# OKKAX Ticketing --- Locked Product Specification

**Status:** LOCKED\
**Tujuan:** sumber kebenaran Antigravity untuk membangun Ticketing
sebagai ticket lifecycle and access operating system yang terintegrasi.

## 1. Definisi

Ticketing bukan QR generator. Lifecycle:

``` text
CREATE → DESIGN → INVENTORY → PRICE → SELL → ORDER → ISSUE
→ DELIVER → VALIDATE → CHECK-IN → LIFECYCLE ACTIONS → ANALYTICS → SETTLEMENT
```

## 2. Boundary

**Ticketing:** organizer/promoter/operator configuration dan
management.\
**My Tickets:** holder/audience-facing tickets.\
**Ticket Validator:** operational scanning UI untuk authorized
workforce/operator.

Validator boleh tetap menjadi menu role-specific, tetapi configuration
dan authoritative data berasal dari Ticketing/backend.

## 3. Information Architecture

Top-level internal navigation:
`OVERVIEW | MAKER | DESIGN | INVENTORY | SALES | ORDERS | ACCESS | ANALYTICS`

Functional domains: 1. Overview 2. Ticket Maker 3. Ticket Designer 4.
Ticket Classes & Inventory 5. Pricing & Sales Rules 6. Distribution &
Orders 7. Access Control & Validation 8. Ticket Security & Lifecycle 9.
Analytics & Settlement

Security/Lifecycle dapat menjadi cross-cutting controls agar navigation
tidak terlalu penuh.

## 4. Overview

KPI berbasis data aktual: Tickets Sold, Gross Sales, Inventory Sold %,
Checked In, Orders, Refunds, Net Revenue/Settlement jika tersedia.
Tambahkan sales trend, inventory by class, active sales windows,
gate/check-in status, alerts, settlement status jika datanya nyata.

## 5. Ticket Maker

Ticket Maker = **Ticket Identity Engine**.

Ticket terkait dengan Ticket ID, Event ID, Ticket Product/Class ID,
Order ID, holder reference bila diperlukan, access rights, validity,
unique token, machine-readable credential, lifecycle status, dan
security metadata.

### Symbology

2D yang dapat dipertimbangkan: QR Code, Data Matrix, PDF417, Aztec.\
1D: Code 128, Code 39, EAN-13, EAN-8, UPC-A, ITF, Codabar.

Jangan menganggap semuanya cocok untuk admission. UI dapat memberi
kategori Recommended for Event Access, Recommended for Printing,
Legacy/Special Use. Gunakan library teruji; jangan menulis algoritma
barcode sendiri.

QR/barcode tidak boleh hanya berisi predictable Ticket ID dan tidak
boleh mengekspos PII yang tidak perlu.

## 6. Ticket Designer

Desktop ideal:

``` text
Templates | Canvas / Live Preview | Properties
```

Kategori template: concert, festival, conference, exhibition, sports,
corporate, private, custom.

Elemen: logo, event name, ticket class, holder name bila digunakan,
Ticket ID, date/time, venue, gate, seat/zone, QR/barcode, terms, sponsor
mark, custom text.

Output dapat mencakup mobile/digital ticket, PDF/email representation,
printable ticket, badge, wristband/label/custom dimensions sesuai
capability aktual.

Jangan menjanjikan wallet integration sebelum integrasi benar-benar
tersedia.

## 7. Ticket Classes & Inventory

Default: 1. Tiket Reguler 2. Tiket VIP 3. Tiket VVIP 4. Tiket Presale /
Early Bird 5. Tiket On The Spot (OTS) 6. Tiket Grup 7. Tiket One Day
Pass 8. Tiket Multi-Day Pass

Wajib ada **Custom Ticket Class** untuk Backstage, Media, Crew, Sponsor,
Guest, Artist Guest, Hospitality, Meet & Greet, Student, Family,
Exhibitor, Delegate, dll.

Inventory mendukung total capacity, sellable, reserved, sponsor,
complimentary, sold, held, available serta void/refund behavior.

Total allocation tidak boleh diam-diam melebihi venue/event capacity.
Capacity change harus menghasilkan detection, warning, affected classes,
dan explicit resolution.

## 8. Pricing & Sales Rules

Dukung base price, tax, platform/payment fee bila relevan, discount,
promo, presale, early bird, group/bundle pricing, complimentary, quota,
sales window, min/max purchase, customer limits.

Dynamic pricing hanya jika dirancang transparan dan dapat dijelaskan.

## 9. Distribution

Channel: OKKAX, event public page, box office, on-site/OTS, approved
partner, sponsor allocation, complimentary/internal. Simpan attribution
untuk analytics/settlement.

## 10. Orders

Conceptual lifecycle:

``` text
Reserved → Pending Payment → Paid → Ticket Issued → Delivered → Checked In
```

Branch: Cancelled, Expired, Refunded, Transferred, Voided, Reissued.

Gunakan canonical backend states existing. Jangan menambah enum sebelum
audit.

Order detail: reference, event, buyer sesuai permission, items,
quantities, subtotal, tax, fee, total, payment state, issuance,
refund/transfer history, audit events.

## 11. Payment & Issuance

Frontend tidak menentukan payment truth. Issuance mengikuti
authoritative backend/payment state. Tangani idempotency, duplicate
callbacks, duplicate issuance, retries, partial failure, refund
reconciliation.

## 12. Access Control

Policy dapat terkait gate, zone, date, session, time window, ticket
class, re-entry.

Contoh:

``` text
GATE A: Regular + VIP
GATE B: VIP + VVIP
BACKSTAGE: Crew + Artist + Production
```

## 13. Ticket Validator

Prioritaskan speed, readability, minimal taps, auditability, dan neutral
OKKAX visual system.

States minimal: VALID, ALREADY USED, WRONG GATE, INVALID, VOID,
REFUNDED, EXPIRED, WRONG DATE/SESSION, ACCESS DENIED.

Backend adalah sumber kebenaran validation/check-in.

## 14. Concurrency & Offline

Tangani simultaneous duplicate scan secara atomic/idempotent di backend.

Jangan mengklaim offline validation tersedia jika belum dibangun. Jika
nanti dibuat, wajib signed/verifiable credential, device authorization,
cache policy, sync, duplicate reconciliation, explicit offline
indicator.

## 15. Security & Lifecycle

Minimal: unpredictable token, server validation, duplicate detection,
revocation, void, reissue, transfer, name change bila diperbolehkan,
refund, cancellation, lost-ticket recovery, check-in audit,
operator/device audit.

Dynamic/rotating QR adalah advanced feature dan harus benar-benar
memakai time-bound signed token + validation policy, bukan animasi
frontend.

## 16. Transfer

Policy: transferable/non-transferable, deadline, max transfer count, new
holder, invalidasi credential lama, audit trail. Jangan membiarkan dua
credential aktif untuk satu entitlement kecuali rule eksplisit.

## 17. Refund

Eligibility → amount/reason → request → approval/policy → payment refund
→ ticket revocation → inventory return policy → Finance reconciliation →
audit. Jangan tampilkan Refunded sebelum authoritative state tersedia.

## 18. Analytics

Sales by class/channel/time, inventory utilization, orders, AOV, refund
rate, check-in rate, attendance, peak entry, revenue, tax, fees,
settlement. Hanya tampilkan segmentasi yang didukung data.

## 19. Settlement & Finance

Finance adalah authoritative financial ledger:

``` text
Ticket Sales → Gross Revenue → Tax → Fees → Refunds → Net Revenue → Settlement → Finance
```

Jangan membuat ledger finansial paralel.

## 20. Integrasi Event Studio

Gunakan Event ID yang sama. Event identity, date, venue, capacity,
audience assumptions, budget, calendar, requirements dapat memengaruhi
Ticketing. Ticketing mengembalikan sales, attendance, revenue,
gate/workforce needs, schedule, settlement.

## 21. Integrasi Calendar

Calendar dapat menerima ticket sales opening, presale start/end, general
sale, OTS, refund deadline, distribution deadline, gate opening,
check-in period, settlement deadline. Hindari duplikasi data.

## 22. Integrasi Network

Ticketing dapat memengaruhi workforce, security, ticketing vendor, gate
operator, equipment. AI boleh menyarankan perubahan tetapi tidak
melakukan perubahan material diam-diam.

## 23. Event Graph

Graph dapat memodelkan Event, Ticket Class, Sales Window, Gate,
Workforce, Payment/Settlement, Capacity, Risk. Capacity change harus
dapat menunjukkan downstream impact terhadap inventory, revenue,
gate/workforce, dan risk.

## 24. OKKAX Intelligence

Use cases: abnormal sales, inventory risk, sell-through forecast jika
data memadai, capacity conflict, ticketing health, check-in bottleneck,
staffing recommendation.

AI **tidak boleh** menjadi sumber kebenaran sales, payment, ticket
validity, admission, refund, atau pricing/access policy.

## 25. UI/UX

Ikuti compact Calendar/dashboard system: dark neutral, high information
density, shared controls, sticky/scroll/dropdown behavior konsisten,
**tanpa rainbow badges/status**.

Navigation pada viewport sempit memakai controlled horizontal
scroll/adaptive navigation, bukan mengecilkan teks berlebihan.

## 26. Designer UX

Jika dibangun: undo/redo, save, preview, safe area, selection,
properties, zoom, print/digital preview, validation sebelum export.
Audit dependency/security/license sebelum memakai editor library.

Pisahkan visual design, ticket data, dan security credential. Mengubah
desain tidak boleh mengubah entitlement/identity.

## 27. Accessibility & Performance

Keyboard/focus/labels/contrast, status tidak hanya warna. Gunakan
pagination/virtualization, server filtering, debounced search, optimized
queries, lazy-loaded designer. Jangan render puluhan ribu tiket
sekaligus.

## 28. Security & Privacy

Server-side authorization, least privilege, PII protection, audit
sensitive actions, no secrets/raw payment credentials di frontend, no
predictable validation token, rate limiting bila tepat, prevent
enumeration, validate state transitions server-side.

## 29. Roles

Ikuti entitlement existing. Organizer/Promoter mengelola; authorized
Workforce/operator memvalidasi; Audience hanya tiket/order miliknya;
Admin governance sesuai permission. Jangan mengubah role model hanya
demi UI.

## 30. Audit Trail

Catat action kritis: create, issue, reissue, transfer, void, refund,
check-in, override, pricing change, inventory change, settlement.
Idealnya actor, timestamp, target, before/after state, device/context
bila relevan.

## 31. Edge Cases

Uji sold out, quota exhausted, sales window belum mulai/selesai,
duplicate order, payment-success/issuance-retry, refund, transfer, void,
duplicate/simultaneous scan, wrong gate/date, cancelled event, capacity
reduction, disabled class, network failure, API timeout.

## 32. Integrity Rules

1.  Sold/available count tidak boleh invalid.
2.  Issued ticket traceable ke authorized source.
3.  Refunded/void ticket tidak lolos validation.
4.  Check-in atomic/idempotent.
5.  Capacity mismatch terdeteksi.
6.  Financial totals berasal dari authoritative state.
7.  UI cache bukan sumber kebenaran admission.

## 33. Testing

Unit tests pricing/inventory/state transition; API/auth tests; issuance
idempotency; validation concurrency; refund/void/transfer; capacity
rules; browser/responsive tests; dropdown/scroll tests; designer
save/export jika dibangun; validator states.

## 34. Definition of Done

-   [ ] Lifecycle ticketing lengkap.
-   [ ] Maker bukan QR generator sederhana.
-   [ ] 8 default classes + custom class.
-   [ ] Inventory integrity dan capacity rules.
-   [ ] Pricing/sales windows.
-   [ ] Orders lifecycle.
-   [ ] Issuance terkait authoritative payment.
-   [ ] Access policy + validator backend-authoritative.
-   [ ] Duplicate/concurrent scan ditangani.
-   [ ] Refund/void/transfer lifecycle.
-   [ ] Analytics data aktual.
-   [ ] Settlement terhubung Finance.
-   [ ] Event ID shared context.
-   [ ] Calendar/Event Graph/Intelligence integration jelas.
-   [ ] AI bukan sumber kebenaran transaksi/admission.
-   [ ] Compact UI, tanpa rainbow UI.
-   [ ] Desktop/tablet/mobile diuji.
-   [ ] Build sukses, regression pass.
-   [ ] Browser QA + screenshots.
-   [ ] Known limitations dilaporkan.

## 35. Implementation Sequence

**T0 Audit:** routes, existing Tickets/My Tickets/Validator, models,
payment, event, auth, tests.\
**T1 Domain Model & Contracts:** product/class, inventory, order, ticket
instance, credential, lifecycle.\
**T2 Overview + Inventory.**\
**T3 Pricing + Sales.**\
**T4 Orders + Issuance.**\
**T5 Access + Validator.**\
**T6 Security Lifecycle:** void/reissue/transfer/refund/audit.\
**T7 Designer + Maker.**\
**T8 Analytics + Finance + Event Graph/Intelligence signals.**

Setiap phase harus PASS/LOCK sebelum phase berikutnya.

## 36. Bukti Wajib Antigravity

Setiap major phase: scope, files inspected/changed, schema/API/migration
impact, authorization impact, tests added/results, build, browser QA,
screenshots, regressions, security findings, checklist, limitations.
Jangan klaim secure/complete/fully tested tanpa bukti.

## 37. Product Locks

-   **LOCK-TK-01:** Ticketing = organizer/promoter operating module; My
    Tickets = holder-facing.
-   **LOCK-TK-02:** Validator tetap role-specific operational interface.
-   **LOCK-TK-03:** Maker = identity/credential engine.
-   **LOCK-TK-04:** Designer mendukung digital dan print-oriented
    output.
-   **LOCK-TK-05:** 8 default classes + custom.
-   **LOCK-TK-06:** Inventory terkait venue capacity.
-   **LOCK-TK-07:** Backend/Finance authoritative untuk payment.
-   **LOCK-TK-08:** Validation/check-in backend-authoritative dan
    concurrency-safe.
-   **LOCK-TK-09:** Terintegrasi dengan Event ID, Calendar, Finance,
    Event Graph, Intelligence.
-   **LOCK-TK-10:** AI bukan sumber kebenaran
    validity/payment/admission/refund.
-   **LOCK-TK-11:** Compact OKKAX dashboard, tanpa rainbow status
    design.
-   **LOCK-TK-12:** Existing terminology, roles, APIs, business logic
    tidak berubah tanpa audit.
