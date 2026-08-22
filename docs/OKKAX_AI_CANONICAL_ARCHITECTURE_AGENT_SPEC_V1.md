# OKKAX AI CANONICAL ARCHITECTURE & AGENT EXECUTION SPEC
## Versi 1.0 — 21 Agustus 2026

**Status:** LOCKED SPEC CANDIDATE
**Bahasa:** Indonesia
**Tujuan:** Menjadi sumber kebenaran operasional bagi seluruh coding agent, reviewer, dan implementasi terkait AI di OKKAX.COM.
**Berlaku untuk:** Homepage Composer, OKKAX Copilot global/contextual, halaman `/copilot`, OKKAX Copilot Brain, Intelligence Engine, Semantic Lexicon, RAG, Event Graph, deterministic calculators, SerpAPI Universal Router, dan seluruh jalur reasoning/tooling terkait.

---

# 0. PRINSIP UTAMA

OKKAX hanya memiliki **SATU OTAK AI CANONICAL**.

Bukan:
- Composer AI sendiri,
- Copilot AI sendiri,
- Intelligence Engine sebagai chatbot kedua,
- Search AI terpisah,
- Event Graph AI terpisah.

Tetapi:

```text
ONE OKKAX COPILOT BRAIN
│
├── Surface A: OKKAX Composer
├── Surface B: OKKAX Copilot
└── Surface C: OKKAX Copilot Workspace
```

Semua surface wajib:
1. menggunakan brain yang sama;
2. menggunakan state authority yang sama;
3. menggunakan semantic lexicon yang sama;
4. menggunakan tool router yang sama;
5. menggunakan calculation policy yang sama;
6. menggunakan response contract yang sama;
7. membedakan permission berdasarkan user/session, bukan mengganti otak;
8. tidak menampilkan internal engine/debug/provenance secara mentah kepada user;
9. bersifat mobile-first;
10. menjaga current-turn explicit user constraints sebagai otoritas tertinggi.

---

# 1. DEFINISI PRODUK AI OKKAX

## 1.1 OKKAX Composer

**Lokasi utama:** Homepage OKKAX.COM

### Fungsi
OKKAX Composer adalah pintu masuk AI tercepat untuk:
- memahami masalah event;
- menghitung angka sederhana;
- memulai event plan;
- memberi rekomendasi awal;
- mencari opsi eksternal bila diperlukan;
- memvalidasi kelayakan awal;
- mengantar user ke workspace.

### Karakter
- public-first;
- cepat;
- ringkas;
- mudah dipahami juri;
- tidak menampilkan console teknis;
- tidak menampilkan raw provenance;
- tidak memerlukan user memahami struktur OKKAX terlebih dahulu.

### Composer bukan
- halaman riset penuh;
- dashboard debug;
- Intelligence Engine;
- tempat menampilkan semua tool/API yang sedang dipakai;
- tempat menyajikan raw JSON.

### Target UX
User harus merasa:

> “Saya cukup menulis masalah event saya. OKKAX langsung memahami, menghitung, mencari, dan menyusun langkah yang relevan.”

---

## 1.2 OKKAX Copilot

**Lokasi:** assistant global/contextual di dalam pengalaman OKKAX.

### Fungsi
Copilot menjadi asisten yang memahami:
- user;
- role;
- organization;
- workspace;
- current route;
- selected event;
- selected entity;
- relevant semantic state;
- Event Graph;
- finance state;
- ticketing state;
- operational state;
- tool permissions.

### Contoh
Jika user berada di Finance:

> “Funding gap event ini berapa?”

Copilot wajib menggunakan event aktif dan calculator.

Jika user berada di Event Graph:

> “Kenapa event ini belum siap?”

Copilot wajib membaca dependency/blocker yang relevan.

Jika user berada di Venue:

> “Cari alternatif 5.000 pax dekat sini.”

Copilot dapat menggabungkan internal venue catalog dan external intelligence.

### Copilot bukan
- chatbot generik;
- search box tanpa context;
- raw query interface untuk Intelligence Engine.

---

## 1.3 OKKAX Copilot Workspace

**Route:** `/copilot`

### Fungsi
Workspace penuh dari AI yang sama untuk:
- multi-turn planning;
- multi-city planning;
- venue discovery;
- sponsor research;
- talent research;
- travel/logistics;
- budget planning;
- funding analysis;
- operational analysis;
- comparison;
- structured output;
- long-form investigation;
- external intelligence;
- knowledge synthesis.

### Prinsip
`/copilot` **tidak boleh memiliki brain terpisah**.

Authenticated `/copilot` wajib tetap masuk ke canonical `OKKAX Copilot Brain`.

Intelligence Engine digunakan sebagai **tool internal**, bukan chatbot kedua.

---

## 1.4 OKKAX Copilot Brain

Nama internal untuk canonical reasoning/orchestration layer.

Tanggung jawab:
- language normalization;
- semantic concept detection;
- context/state management;
- intent classification;
- authority resolution;
- tool routing;
- calculation routing;
- knowledge retrieval;
- external intelligence routing;
- LLM reasoning;
- response composition;
- safety;
- logging/provenance internal.

---

## 1.5 OKKAX Intelligence Engine

Intelligence Engine adalah **internal tool/data capability**.

Boleh melakukan:
- internal database matching;
- structured query;
- supply/demand matching;
- operational intelligence;
- domain lookup;
- structured result generation.

Tidak boleh:
- menjadi chatbot user-facing terpisah;
- menentukan UX contract sendiri;
- menampilkan raw provenance sebagai pengalaman utama user;
- bersaing dengan OKKAX Copilot Brain sebagai sumber jawaban.

---

# 2. CANONICAL AI ARCHITECTURE

```text
USER INPUT
    │
    ▼
LANGUAGE INTELLIGENCE
    │
    ├── Bahasa Indonesia
    ├── English
    ├── Indonesian slang
    ├── chat abbreviations
    ├── typo tolerance
    ├── fuzzy nearest-term
    └── entertainment/live-event terminology
    │
    ▼
SEMANTIC LEXICON
    │
    ├── canonical concepts
    ├── aliases
    ├── abbreviations
    ├── typo dictionary
    ├── context-sensitive acronyms
    └── relationships
    │
    ▼
CONTEXT & STATE ENGINE
    │
    ├── new topic?
    ├── true follow-up?
    ├── correction?
    ├── active event?
    ├── active entity?
    ├── current route?
    └── current authoritative constraints?
    │
    ▼
INTENT ROUTER
    │
    ├── direct calculation
    ├── knowledge
    ├── event planning
    ├── comparison
    ├── discovery/search
    ├── analysis
    ├── action
    └── clarification
    │
    ▼
AUTHORITY RESOLVER
    │
    ▼
TOOL ORCHESTRATOR
    │
    ├── OKKAX Internal Database
    ├── Event Graph
    ├── Deterministic Calculators
    ├── Intelligence Engine
    ├── Knowledge/RAG
    ├── Semantic Retrieval
    └── SerpAPI Universal Router
    │
    ▼
REASONING ROUTER
    │
    ├── deterministic only when sufficient
    ├── fast model
    ├── strong model
    └── fallback model
    │
    ▼
UNIFIED RESPONSE COMPOSER
    │
    ▼
SURFACE-SPECIFIC PRESENTATION
    │
    ├── Homepage Composer
    ├── Contextual Copilot
    └── Copilot Workspace
```

---

# 3. SOURCE OF TRUTH & AUTHORITY ORDER

Setiap jawaban harus mengikuti authority order ini:

```text
1. Explicit current-turn user constraints
2. Server-authoritative authenticated OKKAX data
3. Active event/workspace state yang masih valid
4. Canonical OKKAX policy/calculation rules
5. Verified internal knowledge
6. External intelligence / SerpAPI evidence
7. Generic planning assumptions
8. LLM inference
```

## Aturan absolut

### Current-turn wins
Jika user berkata:

> “Budget maksimal Rp800 juta.”

Tidak ada planner/default/LLM yang boleh mengubahnya menjadi Rp1 miliar.

### Internal data beats external web
Jika event di OKKAX sudah berstatus confirmed, external search tidak boleh mengubah status internal tersebut.

### Assumption is last resort
Asumsi harus:
- jelas dilabeli estimasi;
- tidak mengganti data user;
- tidak menyamar sebagai fakta.

---

# 4. LANGUAGE INTELLIGENCE

## 4.1 Bahasa yang wajib dipahami

Prioritas:
1. Bahasa Indonesia;
2. English;
3. campuran Indonesia-English;
4. Indonesian informal chat;
5. common abbreviations;
6. domain jargon event/entertainment;
7. typo ringan sampai menengah.

### Contoh
Semua ini harus dipahami:

```text
apa beda promotor sm EO?
bedanya promoter dan event organiser apa?
gw butuh FOH yg available
sound sistem 5k pax butuh brp watt?
sponsor gw batal 200jt
loadin h-1 aman ga?
headliner cancel h-3 efek dominonya?
```

---

## 4.2 Semantic normalization

Original user text harus selalu dipertahankan.

Normalization hanya digunakan untuk:
- matching;
- routing;
- concept resolution;
- typo tolerance.

Contoh:

```text
RAW:
"bedanya promotor sm EO apaan?"

NORMALIZED:
"bedanya promoter dengan event organizer apa?"

CONCEPTS:
actor.promoter
actor.event_organizer
```

---

# 5. OKKAX SEMANTIC LEXICON

Semantic Lexicon adalah “kamus otak” OKKAX.

Bukan hanya dictionary kata-ke-kata.

Setiap concept memiliki:

```yaml
concept_id:
canonical:
canonical_id:
canonical_en:
domain:
entity_type:
aliases:
abbreviations:
common_typos:
related:
not_same_as:
routing_tags:
context_rules:
confidence_floor:
```

## Domain minimum V1

1. Actor/role
2. Event types
3. Talent
4. Venue
5. Vendor
6. Production
7. Workforce
8. Sponsor
9. Tenant
10. Ticketing
11. Finance
12. Safety
13. Compliance
14. Logistics
15. Hospitality
16. Calendar
17. Critical Path
18. Event Graph
19. Travel
20. Marketing/Promotion
21. Media
22. Commerce
23. Procurement
24. Legal
25. Tax
26. Insurance

---

# 6. TYPO, SLANG, DAN ABBREVIATION

## 6.1 Common Indonesian chat terms

Contoh:

```text
yg -> yang
dgn -> dengan
dr -> dari
utk -> untuk
krn -> karena
udh -> sudah
blm -> belum
skrg -> sekarang
gk/ga/gak/nggak -> tidak
jgn -> jangan
hrs -> harus
bsa -> bisa
klo/kalo -> kalau
gmn -> bagaimana
knp -> kenapa
brp -> berapa
jd -> jadi
lg -> lagi
```

## 6.2 Event acronyms

Harus memahami secara context-sensitive:

```text
EO
FOH
PA
IEM
SPL
RMS
LED
AV
LX
LD
SFX
RF
DMX
K3
P3K
PPN
DP
PO
RFQ
RFP
SOW
MOU
NDA
ROI
BEP
OOH
KOL
GMV
SLA
SOP
```

## 6.3 Ambiguity rules

Tidak boleh auto-normalize agresif.

Contoh:
- `GA` bisa General Admission atau “ga” = tidak;
- `SM` bisa Stage Manager atau “sama”;
- `PM` bisa Production Manager atau PM waktu;
- `DP` bisa Down Payment atau display picture;
- `LO` bisa Liaison Officer atau token lain.

Context harus menentukan.

Jika confidence rendah:
- jangan mengarang;
- minta klarifikasi singkat hanya jika ambiguity memengaruhi keputusan.

---

# 7. FUZZY NEAREST-TERM

Gunakan fuzzy matching hanya terhadap **OKKAX domain lexicon**, bukan seluruh bahasa.

Priority:

```text
exact canonical
→ exact alias
→ listed typo
→ contextual abbreviation
→ fuzzy high-confidence
→ clarification
```

Contoh valid:

```text
promotr -> promotor
confrence -> conference
ligthing -> lighting
veneu -> venue
sponshor -> sponsor
soundcek -> soundcheck
loadin -> load-in
```

Dangerous correction:
- `lightning` tidak boleh selalu menjadi `lighting`;
- weather/storm context harus mempertahankan lightning.

---

# 8. CONVERSATION STATE ENGINE

State engine wajib membedakan:

```text
TRUE FOLLOW-UP
vs
NEW TOPIC
vs
CORRECTION
vs
STANDALONE REQUEST
```

## 8.1 Valid follow-up

```text
T1: Konser Jakarta 5.000 pax
T2: Budget maksimal Rp800 juta
```

T2 harus retain:
- concert;
- Jakarta;
- 5.000 pax;
- budget 800M.

## 8.2 New topic boundary

```text
T1: Konser Jakarta 5.000 pax, budget 800M
T2: Sekarang buat conference 1.000 pax di Bandung
```

T2:
- conference;
- Bandung;
- 1.000;
- budget lama tidak ikut.

## 8.3 Knowledge breaks active state chain

```text
T1: Konser Jakarta 5.000
T2: Apa beda promoter dan EO?
T3: Budget maksimal Rp800 juta
```

T3 tidak boleh membangkitkan Jakarta/5.000 dari T1.

## 8.4 Current-turn correction

```text
Venue ganti Bandung, yang lain tetap.
```

Current city wins, state lain boleh dipertahankan.

## 8.5 Short dependency question

```text
Kenapa?
Apa dampaknya?
Masih feasible?
```

Boleh menggunakan active context hanya bila benar-benar ada active context yang belum terputus.

---

# 9. REASONING HISTORY BOUNDARY

Semantic state dan raw LLM history wajib menggunakan boundary yang konsisten.

Tidak boleh terjadi:

```text
semantic state bersih
tetapi
LLM melihat raw history lama
dan menghidupkan kembali constraint stale
```

### Rule

True follow-up:
- boleh mengirim active event segment ke reasoning model.

New topic/knowledge break:
- reasoning history harus dipotong pada boundary;
- old event state tidak boleh dikirim sebagai authoritative reasoning context.

---

# 10. DIRECT CALCULATION

Pertanyaan matematika jelas harus short-circuit sebelum event planner.

Contoh:

```text
Rp100 juta - Rp30 juta
→ Sisa budget: Rp70.000.000.
```

```text
Budget Rp100 juta, terpakai Rp125 juta
→ Sisa budget: -Rp25.000.000.
```

Direct calculation:
- latest message only;
- no state merge;
- no external search;
- no LLM;
- no BEP;
- no event planner.

Jika prompt event kompleks:
- kembali ke normal pipeline.

---

# 11. CONSTRAINT AUTHORITY

Explicit constraints user tidak boleh berubah.

Contoh:

```text
Budget total maksimal Rp800 juta
Sound maksimal Rp120 juta
Security dan medical tidak boleh dipotong
```

Planner wajib:
- mempertahankan angka;
- mempertahankan “do not cut” constraints;
- mengatakan infeasible jika memang infeasible;
- tidak mengganti constraint untuk membuat jawaban terlihat feasible.

### Rule
Current-turn explicit constraint > planning baseline.

---

# 12. DETERMINISTIC CALCULATORS

Gunakan deterministic calculation bila jawaban bisa dihitung pasti.

Minimum:
- arithmetic;
- budget remaining;
- funding gap;
- BEP;
- ticket economics;
- tax;
- contingency;
- sponsor replacement;
- per-city budget;
- tour total;
- production allocation;
- travel distance;
- capacity;
- workforce ratios;
- schedule dates bila input cukup.

LLM tidak boleh:
- mengubah hasil angka deterministik;
- “memperbaiki” hasil calculator dengan asumsi tersembunyi.

---

# 13. KNOWLEDGE LAYER

Knowledge bukan hanya keyword matching.

Knowledge sources:
- OKKAX Semantic Lexicon;
- OKKAX knowledge markdown;
- canonical architecture docs;
- event operations knowledge;
- legal/compliance references;
- external open knowledge.

### Free supplemental knowledge
Direkomendasikan:
- Wikimedia / Wikipedia;
- Wikidata;
- OpenStreetMap;
- OpenAlex;
- Crossref;
- GDELT;
- public government documents;
- other legally usable open datasets.

Knowledge harus:
- terindeks;
- retrievable;
- versioned;
- provenance-aware internal;
- tidak menyalin materi berhak cipta wholesale.

---

# 14. RAG / SEMANTIC RETRIEVAL

Target stack gratis:
- BM25;
- SentenceTransformers;
- Qdrant OSS atau Chroma OSS;
- optional reranker.

Pipeline:

```text
query
→ lexical retrieval
→ semantic retrieval
→ merge
→ rerank
→ top context
→ reasoning
```

RAG tidak boleh:
- mengambil seluruh knowledge base ke prompt;
- memasukkan irrelevant context;
- mengalahkan explicit current-turn constraint.

---

# 15. SERPAPI UNIVERSAL EXTERNAL INTELLIGENCE

SerpAPI adalah external intelligence layer.

Prinsip:

> REGISTER ALL, CALL ONLY WHEN NEEDED.

## 15.1 Engine categories

### General web
- Google Search
- Google Light
- Google AI Mode
- Google AI Overview
- Bing
- DuckDuckGo
- Yahoo
- Yandex
- Baidu
- Naver
- Brave AI Mode

### Local/place
- Google Maps
- Google Local
- Google Local Services
- Apple Maps
- Bing Maps
- DuckDuckGo Maps
- Yelp
- Tripadvisor

### Events/current
- Google Events
- Google News
- Google Trends
- Google Videos
- YouTube

### Travel/logistics
- Google Flights
- Flights Deals
- Hotels
- Travel Explore
- Maps Directions
- Maps Autocomplete

### Talent/media
- Search
- News
- Trends
- YouTube
- Images
- Short Videos
- Instagram/Facebook public profile where supported

### Commercial/procurement
- Google Shopping
- Amazon
- eBay
- Walmart
- Home Depot
- product APIs

### Workforce
- Google Jobs
- Search

### Research/legal/IP
- Google Scholar
- Scholar Author
- Scholar Case Law
- Google Patents
- Patent Details

### Finance/market
- Google Finance
- Finance Markets
- Trends
- News
- Ads Transparency

### Visual
- Google Images
- Images Light
- Images Related
- Google Lens
- Reverse Image
- Bing Images
- Yahoo Images
- Yandex Images

### Platform/app/media
- Google Play
- Apple App Store
- YouTube
- social profile engines

---

## 15.2 Universal router pattern

Tidak membuat 100 hardcoded bespoke functions.

Gunakan:

```python
serpapi_request(engine, params)
```

ditambah registry:

```python
SERPAPI_ENGINE_REGISTRY = {
  "...": {
    "engine": "...",
    "capabilities": [...],
    "query_parameter": "...",
    "normalizer": "...",
    "cache_ttl": ...,
    "priority": ...
  }
}
```

## 15.3 Routing rule

```text
current external fact?
→ external intelligence

internal event data?
→ internal OKKAX

direct calculation?
→ no SerpAPI

knowledge stable?
→ knowledge layer first
```

## 15.4 Query examples

Venue:
```text
Google Maps
+ Google Local
+ internal venue catalog
```

Concert trends:
```text
Search
+ News
+ Trends
+ YouTube
```

Hotel/crew:
```text
Hotels
+ Maps
```

Routing production:
```text
Maps Directions
```

Research:
```text
Scholar
+ Search
```

Jobs:
```text
Jobs
+ Search
```

---

# 16. SERPAPI COST/LATENCY CONTROL

Dilarang:
- memanggil semua engine;
- query fan-out tanpa alasan;
- memanggil external web untuk internal calculation.

Default pattern:

```text
Primary engine
→ optional validator
→ fallback only on failure/insufficient evidence
```

Cache:
- venue/place: long TTL;
- news/trends: short TTL;
- hotel/flight: shorter TTL;
- repeated identical query: reuse cache bila aman.

---

# 17. EXTERNAL INTELLIGENCE PROVENANCE

Provider metadata disimpan internal:

```json
{
  "source_type": "external_search",
  "provider": "serpapi",
  "engine": "google_maps",
  "retrieved_at": "...",
  "url": "..."
}
```

User-facing answer:
- tidak perlu mengatakan “Menurut Google”;
- tidak menampilkan provider/debug internals;
- evidence link boleh tersedia dalam expandable evidence jika diperlukan.

Dilarang:
- menyembunyikan ketidakpastian;
- menyebut unverified external result sebagai confirmed internal fact.

---

# 18. REASONING MODEL ROUTER

Model bukan sumber kebenaran tunggal.

Gunakan berdasarkan task:

```text
deterministic task
→ no LLM

classification ringan
→ fast model

complex multi-domain reasoning
→ strong model

primary unavailable
→ fallback provider
```

Model router dapat memanfaatkan:
- Gemini;
- ChatGPT/OpenAI;
- OpenRouter;
- Groq;
- local Ollama;
- other approved provider.

Namun:
- provider baru tidak boleh mengubah response contract;
- provider fallback tidak boleh mengubah semantic state;
- provider failure tidak boleh diam-diam membuat jawaban numerik palsu.

---

# 19. UNIFIED RESPONSE CONTRACT

Semua user-facing AI surface wajib menerima contract yang sama.

Target:

```json
{
  "reply": "...",
  "answer_type": "knowledge",
  "cards": [],
  "suggestions": [],
  "actions": [],
  "evidence": [],
  "state_summary": {},
  "requires_auth": false
}
```

Internal-only:

```text
provider
model
engine
serpapi_engine
pipeline_stages
semantic_plan
raw_provenance
raw_tool_output
confidence
latency
debug
```

Tidak boleh ditampilkan secara mentah kepada user.

---

# 20. RESPONSE QUALITY CONTRACT

Jawaban user wajib:
1. langsung menjawab;
2. tidak mengulang prompt;
3. tidak menampilkan reasoning internal;
4. tidak menyebut semantic_state;
5. tidak menyebut pipeline;
6. tidak menyebut provider/model;
7. tidak membuat assumption diam-diam;
8. membedakan fact/estimate;
9. tidak memberi generic fallback bila knowledge tersedia;
10. tidak membuat jawaban panjang untuk pertanyaan sederhana;
11. tidak memaksa semua query menjadi event-planning analysis;
12. mengikuti format user bila eksplisit.

---

# 21. PERMISSION MODEL

## Guest Composer
Allowed:
- read-only reasoning;
- public knowledge;
- public external search;
- calculation;
- public demo discovery.

Forbidden:
- private workspace data;
- mutations;
- privileged operational action.

## Authenticated Context Copilot
Allowed:
- role context;
- organization context;
- current event;
- relevant private tools;
- permission-gated action.

## Copilot Workspace
Allowed:
- deepest analysis;
- multi-tool orchestration;
- structured planning;
- workspace research;
- authenticated external intelligence.

Mutation tetap:
- RBAC enforced;
- server-authoritative;
- confirmation bila diperlukan;
- audit logged.

---

# 22. MOBILE-FIRST CONTRACT

AI surfaces wajib lulus minimal:

```text
390×844
430×932
768×1024
1440 desktop regression
```

Hard invariant:

```javascript
document.documentElement.scrollWidth <= window.innerWidth
```

Tidak boleh:
- body horizontal overflow;
- graph/table/card memaksa page width;
- response panel keluar viewport;
- CTA terpotong;
- input composer keluar viewport;
- fixed desktop sidebar dipaksakan ke mobile.

### Data-heavy content
Jika horizontal structure memang diperlukan:
- scroll hanya di internal component;
- bukan body;
- mobile stack bila memungkinkan.

---

# 23. ACCESSIBILITY

Minimum:
- keyboard navigation;
- visible focus state;
- semantic buttons;
- labels/aria;
- adequate touch targets;
- readable type scale;
- screen-reader friendly loading/response;
- no color-only status meaning.

---

# 24. SECURITY & PRIVACY

Copilot tidak boleh:
- expose secret;
- expose raw env;
- leak access token;
- bypass RBAC;
- leak another tenant;
- expose private event data to guest;
- send sensitive internal data ke external search tanpa kebutuhan;
- trust client role/organization as authoritative;
- execute mutation tanpa permission/confirmation.

External search query harus diprivatisasi:
- jangan mengirim token;
- jangan mengirim private PII;
- jangan mengirim confidential contract terms kecuali explicitly safe and required.

---

# 25. OBSERVABILITY

Internal logging minimal:

```text
request_id
user_id/anonymous
workspace_id if authorized
route
intent
state_boundary_decision
tools_selected
external_engines_selected
calculator_used
provider
latency
error_class
fallback_used
```

Dilarang memasukkan:
- password;
- raw auth token;
- secret;
- sensitive unnecessary PII.

---

# 26. FAILURE MODES

## External search unavailable
Fallback:
- internal knowledge/data;
- clearly state live lookup unavailable if needed;
- do not fabricate.

## LLM unavailable
Fallback:
- deterministic reply where possible;
- structured internal tool output;
- user-friendly failure if reasoning truly required.

## Calculator missing required input
- say what is missing;
- do not invent numeric assumption unless explicit planning estimate is allowed.

## Ambiguous terminology
- use context;
- if unresolved and important, clarify.

---

# 27. AGENT EXECUTION RULES

Semua coding agent wajib patuh:

1. Read this file before AI-related change.
2. One micro-phase only.
3. Do not create a second AI brain.
4. Do not create duplicate state logic.
5. Do not add provider-specific UX.
6. Do not bypass canonical response contract.
7. Do not expose debug metadata to user.
8. Do not change auth/payment/Event Graph unless explicitly in scope.
9. Do not refactor unrelated code.
10. Every numerical claim must have deterministic source or explicit estimate.
11. Test targeted behavior.
12. Preserve locked behavior.
13. No commit/push without explicit authorization.
14. No full regression unless requested.
15. STOP after report.

---

# 28. DEFINITION OF DONE AI MICRO-PHASE

A task is done only if:
- root cause reproduced;
- exact scope identified;
- minimal fix implemented;
- targeted tests PASS;
- regression relevant to locked behavior PASS;
- syntax/build PASS;
- diff clean;
- no unrelated changes;
- no secret leakage;
- runtime evidence exists where applicable;
- status clearly reported.

---

# 29. LOCKED / CURRENT EXECUTION ROADMAP

## P0.1 Direct Arithmetic
Status target: LOCK

Purpose:
- simple arithmetic never enters event planner.

## P0.2 State Boundary
Purpose:
- true follow-up retains context;
- new topic does not;
- raw LLM reasoning history obeys same boundary.

## P0.3 Constraint Authority
Purpose:
- current-turn explicit constraints always win;
- infeasibility must be stated, not “fixed” by changing user values.

## P0.4 Unified Copilot Brain
Purpose:
- Composer;
- context Copilot;
- `/copilot`;
all route through canonical brain.

## P0.5 Unified Response Contract
Purpose:
- no user-facing debug/intelligence-console behavior.

## P1.1 Semantic Intelligence Layer
Purpose:
- ID/EN/slang/typo/acronym/entertainment lexicon.

## P1.2 Semantic Retrieval/RAG
Purpose:
- knowledge markdown retrieval.

## P1.3 SerpAPI Universal Router
Purpose:
- all registered engines accessible;
- intent-based selective routing.

## P1.4 External Intelligence Orchestration
Purpose:
- internal + external evidence synthesis.

## P1.5 Mobile AI Stabilization
Purpose:
- all AI surfaces viewport-safe.

## P2
- judging polish;
- animation;
- evidence UX;
- performance tuning.

---

# 30. WHAT MUST NEVER HAPPEN

The following are architectural failures:

```text
Homepage Composer -> one brain
/copilot guest -> second brain
/copilot authenticated -> third brain
```

```text
current user budget 800M
planner silently changes to 1B
```

```text
knowledge query
inherits old event constraints
```

```text
semantic state reset
but raw LLM history resurrects stale event
```

```text
direct arithmetic
calls LLM/search/event calculator
```

```text
user sees:
semantic_plan
reasoning_provider
pipeline_stages
provider/model internals
raw provenance JSON
```

```text
all SerpAPI engines called for every query
```

```text
mobile page width exceeds viewport
```

---

# 31. CANONICAL NAMING

**Homepage AI:** OKKAX Composer
**Global contextual assistant:** OKKAX Copilot
**Full AI page:** OKKAX Copilot Workspace
**Canonical backend brain:** OKKAX Copilot Brain
**Internal structured data/matching tool:** OKKAX Intelligence Engine
**External web intelligence:** OKKAX External Intelligence / SerpAPI Router
**Language layer:** OKKAX Semantic Lexicon
**Knowledge retrieval:** OKKAX Knowledge Engine
**Dependency graph:** OKKAX Event Graph

---

# 32. FINAL PRODUCT PRINCIPLE

OKKAX Copilot harus terasa seperti:

> sistem operasi cerdas untuk live-event economy,

bukan:

> chatbot yang kebetulan tahu event.

Copilot harus mampu:
- memahami bahasa user;
- memahami typo;
- memahami jargon;
- memahami konteks;
- mempertahankan state yang relevan;
- membuang state yang sudah tidak relevan;
- menghormati constraints;
- menghitung dengan benar;
- membaca data internal;
- memahami dependencies;
- mencari dunia luar ketika dibutuhkan;
- memilih tool yang tepat;
- menyusun satu jawaban yang jelas;
- bekerja konsisten di semua surface;
- aman;
- mobile-first;
- cepat;
- dapat diaudit.

---

# 33. AGENT STOP CONDITION

Jika agent diminta mengubah AI OKKAX dan menemukan bahwa tugas:
- menciptakan brain kedua;
- menduplikasi state engine;
- menambah provider tanpa router;
- mem-bypass response contract;
- mengubah locked behavior di luar scope;
- membutuhkan refactor besar yang tidak diperintahkan;

agent wajib:

```text
STATUS: BLOCKED
REASON: architectural conflict with OKKAX AI canonical spec
PROPOSED MINIMAL ALTERNATIVE: ...
STOP
```

---

# 34. FINAL AUTHORITY

File ini harus diperlakukan sebagai locked AI architecture spec setelah disetujui.

Jika implementasi aktual bertentangan:
- jangan mengubah spec diam-diam;
- laporkan konflik;
- lakukan minimal migration menuju spec.

Jika agent report bertentangan:
- source + runtime evidence menang.

Jika provider/model behavior bertentangan:
- canonical OKKAX state/calculation authority menang.

---

# END
