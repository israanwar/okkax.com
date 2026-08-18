# OKKAX Event Studio --- Locked Product Specification

**Status:** LOCKED\
**Tujuan:** sumber kebenaran Antigravity untuk arsitektur, UI/UX,
implementasi, dan QA Event Studio.

## 1. Definisi

Event Studio adalah **event creation and orchestration workspace** untuk
membangun satu event dari ide sampai siap dioperasikan. Arsitektur
internal dikunci menjadi:

``` text
EVENT → NETWORK → CALENDAR
```

Event Studio bukan salinan halaman Events, Network, atau Calendar
global.

## 2. Boundary

### Events global

Daftar dan pengelolaan seluruh event. Event Studio hanya menangani event
aktif yang sedang dibuat/diedit.

### Network global

Direktori supply ecosystem lintas platform. Network di Studio hanya
mencari, membandingkan, mengundang, dan memasangkan resource terhadap
requirement event aktif.

### Calendar global

Kalender lintas event/resource. Calendar di Studio hanya jadwal,
milestone, dependency, deadline, dan konflik event aktif.

**Dilarang:** menyalin ketiga halaman global secara utuh ke Studio.

## 3. Information Architecture

``` text
EVENT STUDIO
├── EVENT
│   ├── Brief
│   ├── Identity & Details
│   ├── Audience
│   ├── Budget
│   ├── Requirements
│   └── Blueprint
├── NETWORK
│   ├── Talent
│   ├── Venue
│   ├── Vendor
│   ├── Workforce
│   ├── Sponsor
│   └── Tenant
└── CALENDAR
    ├── Timeline
    ├── Schedule
    ├── Dependencies
    ├── Deadlines
    └── Conflicts
```

Top-level navigation internal hanya `EVENT | NETWORK | CALENDAR`. Jangan
membuat sidebar kedua.

## 4. Layout dan Density

Gunakan horizontal workspace navigation, compact seperti Calendar
dashboard. Hindari hero besar, whitespace vertikal berlebihan, nested
card tanpa fungsi, dan nested scroll trap. Area kerja harus dominan.

Command/navigation bar boleh sticky dengan syarat tidak menutupi global
header. Dropdown/popover harus memakai primitive dashboard existing,
tidak clipping, dan mengikuti portal/positioning system yang sudah
dinormalisasi.

## 5. EVENT

### Brief

Menangkap nama, jenis, tujuan, deskripsi, kota/lokasi, tanggal/range,
kapasitas, target audience, budget, kebutuhan awal, dan constraints.

### Identity & Details

Event ID, organizer, category/type, public/private, lokasi, venue
status, tanggal, capacity, description, branding/media bila tersedia.

### Audience

Target audience, estimated attendance, segmentation, geographic target,
access dan ticketing assumptions. Prediction wajib diberi label
estimate/simulation.

### Budget

Target budget, projected cost, confirmed funding, funding gap, major
categories, contingency, revenue assumptions. Finance tetap sumber
transaksi aktual.

### Requirements

Harus menjadi structured data. Kategori minimal: talent, rider, venue,
vendor/production, workforce, sponsor, tenant, ticketing, permits,
logistics, travel/accommodation, security, medical, documentation,
financial milestones.

Setiap requirement idealnya memiliki ID, category, title, description,
quantity, priority, budget estimate, deadline, status, dependencies, dan
assigned resource.

### Blueprint

Hasil editable dari Brief + Requirements: phases, workstreams,
requirements, milestones, risks, dependencies, recommended next actions.
AI output tidak boleh immutable.

## 6. NETWORK

Workflow:

``` text
Requirement → Search/Recommendation → Candidate → Compare → Shortlist
→ Invite/Request → Availability/Negotiation → Assigned/Confirmed
```

Pertahankan struktur, rating, kategori, istilah, dan data model Network
existing. Studio hanya menambahkan event-context seperti requirement
match, availability, estimated cost, conflicts, dan reason for match.

AI harus membedakan fakta database, calculated score, dan
recommendation. Jangan mengarang availability, price, rating, atau
contractual status.

## 7. CALENDAR

Event-scoped calendar mencakup timeline, schedule, dependencies,
deadlines, conflicts serta Month/Week/Day/Agenda jika diperlukan.

Pertahankan activity terminology existing seperti persiapan, venue
deadline, talent hold, kontrak, DP & pelunasan, perizinan, penjualan
tiket, sponsor, tenant, workforce, produksi, perjalanan, loading,
soundcheck, rehearsal, showtime, dismantling, settlement, laporan
pasca-event.

Conflict harus actionable: masalah, komponen terdampak, severity netral,
dan rekomendasi tindakan jika tersedia.

## 8. Shared Event State

Satu **Event ID** menjadi konteks bersama:

``` text
Event
├── Requirements
├── Network Assignments
├── Calendar Entries
├── Ticketing Configuration
├── Budget
├── Risks
└── Dependencies
```

Perubahan dapat menghasilkan derived update, warning, suggested action,
atau user confirmation. Jangan melakukan perubahan material diam-diam.

## 9. OKKAX Intelligence

Intelligence adalah reasoning layer, **bukan tab keempat**. Ia dapat
membantu melengkapi brief, menghasilkan draft blueprint, menemukan
requirement, merekomendasikan kandidat, mendeteksi conflict/downstream
impact, dan memberi next-best-action.

AI wajib transparan, membedakan recommendation dan fakta, meminta
konfirmasi untuk perubahan material, serta memiliki fallback jika
API/model gagal.

## 10. Event Graph

Event Graph merepresentasikan dependency dari sumber data yang sama,
bukan database paralel. Node dapat mewakili event, organizer, talent,
rider, venue, vendor, workforce, sponsor, tenant, ticket tier, funding,
payment, risk, requirement.

## 11. Autosave

State minimal: Saving..., Saved, Save failed · Retry. Jangan menampilkan
Saved sebelum backend mengonfirmasi. Hindari race condition dan stale
response overwrite.

## 12. Responsive

Desktop: workspace luas. Tablet: controls wrap rapi. Mobile:
single-column, touch target memadai, tabs horizontal-scroll terkontrol.
Tidak boleh ada viewport overflow tidak disengaja.

## 13. Visual System

Ikuti design system dashboard OKKAX existing: black/dark neutral,
putih/gray, accent brand selektif, **tanpa rainbow status UI**,
typography/radius/border/button/input/dropdown/card konsisten. Reuse
shared primitives.

Motion subtle, functional, 150--250 ms bila sesuai, reduced-motion
compliant.

## 14. Accessibility & Performance

Keyboard navigation, focus visible, semantic labels, ARIA, contrast
memadai, status tidak hanya mengandalkan warna. Debounce search, cancel
stale request, lazy-load domain berat, cache aman, virtualize list besar
bila perlu.

## 15. Security & Integrity

Jangan hardcode production data, expose secrets, bypass authorization,
menganggap hidden UI sebagai authorization, mengubah backend contract
tanpa audit, atau mengirim data sensitif yang tidak diperlukan ke AI.
Semua writes mengikuti permission existing.

## 16. Error States

Setiap domain wajib memiliki loading, empty, error, retry, dan
partial-data state. Empty state harus contextual dan actionable.

## 17. Definition of Done

-   [ ] EVENT \| NETWORK \| CALENDAR menjadi arsitektur utama.
-   [ ] Tidak ada duplikasi halaman global.
-   [ ] Semua domain menggunakan Event ID yang sama.
-   [ ] Blueprint/requirements editable.
-   [ ] Network dan Calendar benar-benar event-scoped.
-   [ ] Shared state konsisten.
-   [ ] Dropdown/popover tidak clipping.
-   [ ] Scroll hierarchy benar, tanpa nested scroll trap.
-   [ ] Desktop/tablet/mobile diuji.
-   [ ] Tidak ada rainbow UI.
-   [ ] Motion konsisten.
-   [ ] Business logic/API existing tidak rusak.
-   [ ] Production build sukses.
-   [ ] Regression tests pass.
-   [ ] Browser QA + screenshot proof tersedia.
-   [ ] Files changed dan limitations dilaporkan.

## 18. Instruksi Antigravity

Audit route, component, state, API, backend model, authorization, dan
tests sebelum coding. Reuse primitives. Implementasi bertahap.
Build/test setiap tahap. Jangan rewrite besar tanpa alasan. Jangan
mengubah global Events/Network/Calendar kecuali shared primitive memang
perlu. Jangan mengubah istilah/data existing karena redesign.

## 19. Bukti Wajib

Laporan akhir wajib berisi: arsitektur sebelum/sesudah, files
inspected/modified, perubahan EVENT/NETWORK/CALENDAR, shared-state
behavior, AI behavior jika disentuh, responsive QA, dropdown/scroll QA,
build, tests, browser tests, screenshots, regression findings, checklist
DoD, dan known limitations. Jangan klaim PASS untuk hal yang tidak
diuji.

## 20. Product Locks

-   **LOCK-ES-01:** Event Studio = Event + Network + Calendar.
-   **LOCK-ES-02:** Event-scoped orchestration workspace.
-   **LOCK-ES-03:** Global Events/Network/Calendar tetap memiliki fungsi
    sendiri.
-   **LOCK-ES-04:** Tidak ada sidebar internal kedua.
-   **LOCK-ES-05:** Navigation horizontal dan compact.
-   **LOCK-ES-06:** Event ID adalah shared context.
-   **LOCK-ES-07:** Intelligence = reasoning layer, bukan tab.
-   **LOCK-ES-08:** Event Graph = representation layer, bukan database
    paralel.
-   **LOCK-ES-09:** Tidak ada rainbow status UI.
-   **LOCK-ES-10:** Business logic/API/terminologi existing tidak
    berubah hanya karena redesign.
