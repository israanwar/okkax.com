# OKKAX AI IMPLEMENTATION CONTRACT V1

**Versi:** 1.0
**Tanggal:** 21 Agustus 2026
**Status:** PROPOSED → menunggu review sebelum LOCK
**Lokasi canonical:** `docs/OKKAX_AI_IMPLEMENTATION_CONTRACT_V1.md`

Dokumen ini menerjemahkan `OKKAX_AI_CANONICAL_ARCHITECTURE_AGENT_SPEC_V1.md` menjadi kontrak implementasi teknis yang wajib dipatuhi oleh seluruh coding agent.

---

# 1. HIERARKI SUMBER KEBENARAN

Urutan authority:

1. `docs/OKKAX_MASTER_EXECUTION_CONTRACT_V5.md`
2. `docs/OKKAX_AI_CANONICAL_ARCHITECTURE_AGENT_SPEC_V1.md`
3. `docs/OKKAX_AI_IMPLEMENTATION_CONTRACT_V1.md`
4. locked technical specs lain
5. canonical architecture docs
6. implementasi aktual yang terbukti melalui runtime/test
7. QA logs
8. agent reports

Jika terjadi konflik, sumber dengan posisi lebih tinggi menang.

---

# 2. SATU CANONICAL BRAIN

Semua AI user-facing wajib masuk ke:

```text
POST /api/okkax/chat
```

Canonical backend orchestrator:

```python
ask_okkax_copilot(...)
```

Dilarang membuat jalur user-facing lain yang bertindak sebagai chatbot brain kedua.

Target surface:

```text
Homepage Composer
        \
Global Copilot ----> /api/okkax/chat ---> OKKAX Copilot Brain
        /
/copilot Workspace
```

`/intelligence/query` tetap diperbolehkan sebagai tool internal untuk Copilot, bukan sebagai canonical user-facing chatbot endpoint.

---

# 3. SURFACE CONTRACT

## 3.1 Homepage Composer

Frontend canonical:
`frontend/src/components/StitchAtmosphere.jsx`

Wajib:
- menggunakan `/okkax/chat`;
- guest-safe;
- read-only untuk anonymous;
- jawaban ringkas;
- tidak render raw provenance/debug;
- mobile-first;
- dapat melakukan handoff ke login/workspace.

Dilarang:
- memanggil `/intelligence/query` langsung;
- menampilkan provider/model;
- menampilkan semantic plan;
- mengeluarkan raw tool JSON.

## 3.2 Global OKKAX Copilot

Wajib menggunakan:
- current route;
- authenticated user;
- current workspace;
- selected event/entity bila ada;
- server-authoritative context.

Global Copilot tidak memiliki brain sendiri.

## 3.3 `/copilot` Workspace

Frontend canonical saat ini:
`frontend/src/pages/IntelligencePage.jsx`

Target migration:
- guest `/copilot` → `/okkax/chat`;
- authenticated `/copilot` → `/okkax/chat`;
- structured intelligence output berasal dari canonical response contract;
- `/intelligence/query` hanya dipanggil oleh backend tool orchestrator bila diperlukan.

---

# 4. CANONICAL RESPONSE CONTRACT

Target response:

```json
{
  "reply": "string",
  "answer_type": "knowledge|calculation|planning|search|comparison|action|clarification",
  "cards": [],
  "suggestions": [],
  "actions": [],
  "evidence": [],
  "state_summary": {},
  "requires_auth": false
}
```

Backward-compatible internal fields boleh tetap ada sementara migrasi, tetapi frontend tidak boleh menggantungkan UX pada:

```text
semantic_plan
reasoning_provider
pipeline_stages
provider
model
raw_provenance
raw_tool_output
```

Internal metadata tidak boleh menjadi user-facing copy.

---

# 5. PIPELINE ORDER

Canonical pipeline:

```text
1. sanitize input
2. small-talk short-circuit
3. direct deterministic calculation
4. language normalization
5. semantic concept detection
6. context/state boundary
7. current-turn authority resolution
8. intent routing
9. internal data/tool selection
10. external intelligence selection
11. deterministic calculation/tool execution
12. reasoning model if needed
13. unified response composition
14. internal leak stripping
15. response contract
```

Urutan ini tidak boleh dibalik tanpa spec revision.

---

# 6. DIRECT CALCULATION CONTRACT

P0.1 behavior wajib dipertahankan.

Contoh:

```text
Rp100 juta - Rp30 juta
=> Sisa budget: Rp70.000.000.
```

```text
Budget Rp100 juta, terpakai Rp125 juta
=> Sisa budget: -Rp25.000.000.
```

Direct calculation:
- latest message only;
- no history merge;
- no LLM;
- no SerpAPI;
- no event planner;
- no Intelligence Engine;
- no BEP unless explicitly requested.

---

# 7. STATE ENGINE CONTRACT

## 7.1 True follow-up

```text
T1: konser Jakarta 5.000 pax
T2: budget maksimal Rp800 juta
```

T2 retains:
- event_type;
- city;
- capacity;
- active event context.

## 7.2 New self-contained topic

```text
T1: konser Jakarta 5.000 pax budget 800M
T2: buat conference 1.000 pax Bandung
```

T2 must not inherit:
- Jakarta;
- 5.000;
- Rp800M.

## 7.3 Knowledge break

```text
T1: konser Jakarta 5.000
T2: apa beda promotor dan EO?
T3: budget maksimal Rp800 juta
```

T3 must not resurrect T1.

## 7.4 Reasoning history boundary

LLM history must obey the same active-context boundary as semantic state.

Dilarang:
- semantic state bersih tetapi raw LLM history membawa stale numerical constraints.

---

# 8. CURRENT-TURN AUTHORITY CONTRACT

Priority:

```text
current-turn explicit constraint
> server-authoritative workspace data
> active valid state
> platform policy
> external evidence
> planning assumptions
> LLM inference
```

Examples:

```text
"Budget maksimal Rp800 juta"
```

Tidak boleh diubah menjadi baseline Rp1 miliar.

```text
"Sound maksimal Rp120 juta"
```

Tidak boleh menghasilkan production technical Rp240 juta.

```text
"Security dan medical tidak boleh dipotong"
```

Planner harus menjaga constraint atau menyatakan infeasible.

---

# 9. SEMANTIC LEXICON CONTRACT

Target module:

```text
backend/copilot/terminology.py
```

atau canonical package setara yang disetujui sebelum implementasi.

Public API minimum:

```python
normalize_chat_text(text: str)
detect_concepts(text: str)
resolve_abbreviation(token: str, context: str)
suggest_nearest_term(token: str, context: str)
```

Input original tidak boleh dimodifikasi secara destruktif.

Semantic result wajib mempertahankan:
- original text;
- normalized text;
- concept ID;
- matched token;
- method;
- confidence.

---

# 10. SEMANTIC KNOWLEDGE FILES

Target directory:

```text
knowledge/semantic/
```

Recommended files:

```text
01_bahasa_indonesia.md
02_english.md
03_indonesian_slang.md
04_abbreviations.md
05_typo_dictionary.md
06_event_roles.md
07_entertainment.md
08_live_production.md
09_venue.md
10_ticketing.md
11_sponsorship.md
12_finance.md
13_workforce.md
14_safety_compliance.md
15_logistics.md
16_event_graph.md
```

Agent dilarang membuat daftar alias tersebar di banyak file Python jika konsep sudah tersedia di semantic lexicon canonical.

---

# 11. FUZZY MATCHING CONTRACT

Priority:

```text
exact canonical
→ exact alias
→ listed typo
→ contextual abbreviation
→ fuzzy high-confidence
→ clarification
```

Rules:
- fuzzy hanya terhadap OKKAX domain lexicon;
- tidak terhadap seluruh vocabulary bahasa;
- auto-correct harus high confidence;
- ambiguous top candidates → no silent normalization;
- business-critical ambiguity → clarify.

Tidak boleh:

```text
lighting -> lightning
GA -> always general admission
SM -> always stage manager
DP -> always down payment
```

tanpa context.

---

# 12. KNOWLEDGE RETRIEVAL CONTRACT

Target future architecture:

```text
BM25
+
semantic embeddings
+
optional reranker
```

Free preferred components:
- SentenceTransformers;
- Qdrant OSS atau Chroma OSS;
- local BM25;
- open datasets yang legal digunakan.

Retrieval harus:
- top-k terbatas;
- deduplicated;
- relevance-scored;
- tidak memasukkan seluruh knowledge pack ke prompt.

---

# 13. SERPAPI UNIVERSAL ROUTER CONTRACT

Target package:

```text
backend/integrations/search/
    __init__.py
    serpapi_client.py
    engine_registry.py
    router.py
    normalizers.py
```

Jika struktur repository existing memiliki namespace lebih tepat, agent harus mengikuti struktur existing tanpa refactor besar.

## 13.1 Core client

Canonical generic request:

```python
async def serpapi_request(
    engine: str,
    params: dict,
    *,
    timeout_s: float,
) -> dict:
    ...
```

Dilarang membuat 100 client HTTP independen.

## 13.2 Engine registry

Setiap engine harus memiliki metadata:

```python
{
    "engine": "google_maps",
    "capabilities": ["places", "venue", "vendor", "local"],
    "query_param": "q",
    "normalizer": "places",
    "cache_ttl_s": 86400,
    "priority": 10,
    "enabled": True,
}
```

## 13.3 Register-all / route-selectively

Semua supported engines boleh diregistrasikan.

Tidak boleh:
- fan-out ke semua engines;
- memanggil engine yang tidak relevan;
- memakai external search untuk deterministic/internal question.

Default:

```text
primary
→ optional validator
→ fallback only if needed
```

---

# 14. SERPAPI CAPABILITY REGISTRY

Capability minimum:

```text
general_web
local_place
venue
vendor
event_discovery
news
trends
talent_intelligence
images
video
jobs
hotels
flights
travel
directions
shopping
products
finance
research
patents
reviews
social_profile
reverse_image
```

Copilot memilih capability terlebih dahulu, bukan provider terlebih dahulu.

---

# 15. SERPAPI NORMALIZED RESULT

Universal item contract:

```json
{
  "type": "place|news|event|video|product|job|research|finance|web",
  "title": "...",
  "summary": "...",
  "url": "...",
  "location": null,
  "rating": null,
  "published_at": null,
  "source_engine": "...",
  "retrieved_at": "...",
  "metadata": {}
}
```

Raw payload boleh disimpan internal untuk debugging terbatas, tetapi tidak menjadi user-facing response.

---

# 16. EXTERNAL INTELLIGENCE AUTHORITY

SerpAPI adalah external evidence.

Tidak boleh:
- mengubah internal confirmed status;
- mengalahkan current-turn user constraint;
- dianggap confirmed hanya karena muncul di search result.

External result status:
- discovered;
- externally reported;
- candidate;
- needs verification.

---

# 17. EXTERNAL SEARCH PRIVACY

Query ke external provider tidak boleh berisi:
- auth token;
- password;
- secret;
- private user identifiers;
- unnecessary PII;
- confidential contract text;
- private workspace data yang tidak diperlukan.

Gunakan minimal query representation.

---

# 18. TOOL ORCHESTRATOR CONTRACT

Canonical tool categories:

```text
internal_ground_truth
event_graph
calculator
intelligence_query
knowledge_retrieval
external_intelligence
action
```

Tool selection:
- intent-driven;
- permission-aware;
- state-aware;
- cost-aware;
- latency-aware.

---

# 19. MODEL ROUTER CONTRACT

Model tidak boleh memutus authority.

Model roles:

```text
fast model:
- lightweight classification
- summarization
- extraction

strong model:
- complex multi-domain reasoning
- synthesis
- planning

fallback:
- provider outage
```

Deterministic tasks:
- no LLM.

Provider switch tidak boleh mengubah:
- state semantics;
- canonical calculations;
- response contract;
- security rules.

---

# 20. FALLBACK CONTRACT

## LLM unavailable
Use:
- deterministic calculations;
- internal structured tools;
- user-friendly limitation.

## SerpAPI unavailable
Use:
- internal catalog;
- cached data;
- knowledge;
- state that live lookup is unavailable only when material.

## Intelligence Engine unavailable
Copilot may continue with:
- knowledge;
- calculator;
- external intelligence;
if the requested task permits.

Dilarang fabricate result.

---

# 21. USER-FACING OUTPUT CONTRACT

User-facing answer dilarang menampilkan:

```text
semantic_state
semantic_plan
reasoning_provider
pipeline_stages
provider_llm
deterministic_engine
internal prompt
raw endpoint
raw DB collection
raw JSON provenance
```

Simple query → simple answer.

Complex planning → structured answer.

Knowledge query → direct explanation.

Search query → candidate/evidence-based answer.

---

# 22. KNOWLEDGE QUERY CONTRACT

Example:

```text
Apa beda promotor dan EO?
```

Expected:
- direct substantive explanation;
- semantic aliases accepted;
- typo accepted if high confidence;
- no event planner;
- no stale event context;
- no generic “lampirkan event” fallback unless user asks for application to specific event.

---

# 23. MOBILE-FIRST IMPLEMENTATION CONTRACT

Required widths:

```text
390×844
430×932
768×1024
1440 desktop
```

Hard gate:

```javascript
document.documentElement.scrollWidth <= window.innerWidth
```

For all AI surfaces:
- no body horizontal overflow;
- input always usable;
- response cards stack;
- tables use internal scroll only if unavoidable;
- CTA stays visible;
- no clipped header;
- no desktop fixed widths on mobile;
- `min-w-0` where flex/grid child needs shrinking.

---

# 24. `/copilot` MIGRATION CONTRACT

Current known risk:
authenticated `/copilot` may use `/intelligence/query` directly.

Target migration:

```text
IntelligencePage.runQuery()
→ POST /okkax/chat
```

Then backend may internally call:

```python
run_intelligence_query(...)
```

when appropriate.

Frontend must adapt to canonical response contract instead of Intelligence Engine raw response shape.

No UI redesign in the same micro-phase unless required to render canonical response safely.

---

# 25. HOMEPAGE COMPOSER CONTRACT

Must remain:
- fast;
- guest-safe;
- no private tools;
- no mutation;
- no debug metadata;
- same brain;
- same semantics;
- same current knowledge access when allowed.

Homepage must not be a reduced-quality “fake AI”.

Capability differences are permission/depth differences, not intelligence differences.

---

# 26. AUTHENTICATED CONTEXT CONTRACT

Authenticated request may pass:
- role;
- current route;
- active workspace;
- active event reference;
- selected entity;
- user-authorized context.

Backend must resolve authoritative identity/session.

Frontend-supplied role/org is not authoritative.

---

# 27. TEST MATRIX — CORE BRAIN

Minimum regression matrix:

## Arithmetic
- subtraction;
- negative balance;
- addition;
- exact output mode;
- event-planning guard.

## State
- true follow-up;
- new event;
- knowledge break;
- context resurrection prevention;
- short dependency;
- corrections.

## Authority
- budget ceiling;
- production cap;
- sponsor cancellation;
- non-cuttable safety;
- infeasible constraints.

## Knowledge
- promoter/promotor;
- EO/event organizer;
- typo;
- abbreviation;
- slang.

## External intelligence
- venue search;
- event search;
- current talent/news;
- travel/hotel;
- no search for internal arithmetic.

## Permissions
- guest;
- organizer;
- sponsor;
- tenant;
- unsupported/private action.

---

# 28. TEST MATRIX — SURFACES

Each canonical test should be exercised on:

```text
Homepage Composer
Public /copilot
Authenticated /copilot
```

Expected semantic answer must remain equivalent.

Differences allowed:
- layout;
- depth;
- cards;
- authenticated actions;
- available private data.

Differences not allowed:
- contradictory calculation;
- different meaning of user state;
- different canonical terminology;
- one surface being substantially “dumber”.

---

# 29. TEST MATRIX — MOBILE

For each surface:

```text
390×844
430×932
768×1024
```

Check:
- no page overflow;
- send button visible;
- input not clipped;
- response readable;
- cards stack;
- evidence collapsible;
- buttons >= usable touch size;
- no inaccessible off-screen controls.

---

# 30. CACHE CONTRACT

Cache allowed for:
- external search;
- stable knowledge retrieval;
- place lookup;
- public metadata.

Cache key must include relevant:
- engine;
- normalized query;
- locale;
- location;
- filters.

Do not cache:
- private response across tenants;
- active event mutable state without scoped key;
- auth-dependent result globally.

---

# 31. OBSERVABILITY CONTRACT

Internal trace should support:

```text
request_id
surface
intent
state_boundary
authority_decision
tools
calculator
external_engines
provider
latency
fallback
error
```

This is internal telemetry only.

---

# 32. SECURITY CONTRACT

Must preserve:
- auth;
- RBAC;
- workspace membership;
- tenant isolation;
- suspended account enforcement;
- server-authoritative identity;
- no secret leakage;
- no mutation bypass.

AI feature work must not weaken any of these.

---

# 33. FILE CHANGE DISCIPLINE

Agent must identify:

```text
FILES_READ
FILES_CHANGED
FILES_NOT_TOUCHED
```

If a task is backend-only:
- no frontend changes.

If a task is terminology-only:
- no calculator changes.

If a task is responsive-only:
- no business logic changes.

---

# 34. AGENT PROMPT PROTOCOL

Every implementation task should follow:

```text
OBJECTIVE
SCOPE
DO
DO NOT
TEST
REPORT
STOP
```

Agent must stop after report unless explicitly authorized to commit/push.

---

# 35. GIT CHECKPOINT CONTRACT

Before commit:
1. `git status`
2. `git diff --check`
3. review exact diff
4. secret scan
5. stage only intended files
6. targeted tests already PASS
7. no unrelated untracked/staged file

No force push.

No automatic push unless explicitly instructed.

---

# 36. DEFINITION OF DONE

A micro-phase is done only if:

```text
requirement satisfied
+ minimal implementation complete
+ targeted test PASS
+ relevant regression PASS
+ syntax/build PASS
+ no known regression
+ clean scope
+ evidence available
```

“Agent says done” is not evidence.

---

# 37. MIGRATION ORDER

Canonical sequence:

```text
P0.1 Direct Arithmetic
P0.2 State + Reasoning History Boundary
P0.3 Constraint Authority
P0.4 Unified Copilot Brain
P0.5 Unified Response Contract
P1.1 Semantic Lexicon
P1.2 Knowledge Retrieval/RAG
P1.3 SerpAPI Universal Router
P1.4 External Intelligence Orchestration
P1.5 Mobile Stabilization
P2 Judging Polish
```

Do not implement lower-priority layers by breaking higher-priority correctness.

---

# 38. NON-NEGOTIABLE INVARIANTS

```text
ONE BRAIN
ONE STATE AUTHORITY
ONE RESPONSE CONTRACT
ONE TOOL ORCHESTRATOR
ONE SEMANTIC LEXICON
```

Not allowed:

```text
Composer has separate rules
/copilot has separate brain
Intelligence Engine chats directly with user
SerpAPI bypasses Copilot
LLM overrides deterministic calculations
external data overrides internal confirmed facts
```

---

# 39. AGENT BLOCK CONDITIONS

Agent must return BLOCKED if:
- request creates a second brain;
- request weakens authority order;
- request requires exposing debug metadata;
- request bypasses RBAC;
- task requires broad refactor outside explicit scope;
- exact canonical behavior is unclear and cannot be derived from higher specs.

Report:

```text
STATUS: BLOCKED
CONFLICT:
AFFECTED SPEC:
MINIMAL SAFE ALTERNATIVE:
STOP
```

---

# 40. FINAL IMPLEMENTATION PRINCIPLE

OKKAX Copilot harus menjadi orchestrator sistem, bukan hanya wrapper LLM.

Canonical intelligence:

```text
language
+ semantics
+ memory
+ authority
+ internal truth
+ deterministic math
+ graph dependencies
+ retrieval
+ real-time external intelligence
+ reasoning
+ unified presentation
```

Jika salah satu komponen tidak diperlukan untuk sebuah query, jangan dipanggil.

Kecerdasan OKKAX diukur dari:
- ketepatan;
- relevansi;
- kemampuan menjaga konteks;
- kemampuan membuang konteks stale;
- penggunaan tool yang tepat;
- kemampuan mengakui ketidakpastian;
- kualitas keputusan;
- kecepatan;
- keamanan;
- konsistensi lintas surface.

# END
