# OKKAX LANGUAGE INTELLIGENCE & SEMANTIC REASONING FRAME SPEC V1

**Versi:** 1.0
**Tanggal:** 21 Agustus 2026
**Status:** PROPOSED — review sebelum LOCK
**Lokasi canonical yang direkomendasikan:** `docs/OKKAX_LANGUAGE_INTELLIGENCE_AND_SEMANTIC_FRAME_SPEC_V1.md`

Dokumen ini adalah spesifikasi canonical untuk membuat OKKAX Copilot memahami **maksud, konteks, referensi, ambiguitas, typo, slang, angka, konsekuensi, dan hubungan sebab-akibat**, bukan sekadar mencocokkan kata.

Dokumen ini berlaku untuk:
- OKKAX Composer di homepage;
- OKKAX Copilot contextual assistant;
- OKKAX Copilot Workspace `/copilot`;
- OKKAX Copilot Brain;
- semantic lexicon;
- state engine;
- reasoning history;
- intent router;
- constraint authority;
- tool orchestration;
- deterministic calculators;
- RAG/knowledge retrieval;
- SerpAPI external intelligence;
- response composer.

---

# 1. HIERARKI SUMBER KEBENARAN

Urutan authority:

1. `docs/OKKAX_MASTER_EXECUTION_CONTRACT_V5.md`
2. `docs/OKKAX_AI_CANONICAL_ARCHITECTURE_AGENT_SPEC_V1.md`
3. `docs/OKKAX_AI_IMPLEMENTATION_CONTRACT_V1.md`
4. `docs/OKKAX_LANGUAGE_INTELLIGENCE_AND_SEMANTIC_FRAME_SPEC_V1.md`
5. locked technical specs lain
6. runtime/test evidence
7. QA logs
8. agent reports

Jika konflik, dokumen yang lebih tinggi menang.

---

# 2. TUJUAN

OKKAX tidak boleh hanya memahami **kalimat**.

OKKAX harus memahami:

```text
apa yang user maksud
apa yang user referensikan
apa yang eksplisit
apa yang implisit
apa yang masih ambigu
apa yang merupakan fakta
apa yang hanya asumsi
apa yang harus dihitung
apa yang harus dicari
apa yang harus dipertahankan
apa yang harus dilupakan
apa yang berubah
apa dampaknya
apa keputusan operasional terbaik berikutnya
```

Target utamanya:

> **Raw language → semantic meaning → authoritative state → tools/calculation → reasoning → executable answer.**

---

# 3. PRINSIP UTAMA

## 3.1 Understand intent, not punctuation

AI tidak boleh gagal hanya karena user tidak memakai:
- titik;
- koma;
- tanda tanya;
- tanda seru;
- kapitalisasi;
- struktur kalimat baku.

Contoh berikut harus dapat dipahami setara:

```text
sponsor batal 200jt sound max120 budget800 gimana
sponsor batal 200jt, sound max 120jt, budget 800jt. gimana?
sponsor batal200jt sound120 budget800 gmn bro
```

---

## 3.2 Preserve original text

Selalu simpan:

```json
{
  "original_text": "...",
  "normalized_text": "..."
}
```

Normalization tidak boleh menghancurkan original input.

---

## 3.3 Deterministic first, semantic fallback second

Urutan:

```text
exact canonical
→ alias
→ known typo
→ abbreviation
→ deterministic normalization
→ high-confidence fuzzy match
→ semantic model fallback
→ clarification if materially necessary
```

---

## 3.4 Never convert uncertainty into fact

AI wajib membedakan:

```text
FACT
USER_CONSTRAINT
CALCULATED
INFERRED
HYPOTHESIS
ESTIMATE
EXTERNAL_EVIDENCE
UNKNOWN
AMBIGUOUS
```

Contoh:

> “Sponsor Rp200 juta batal.”

Tidak otomatis berarti cash-on-hand berkurang Rp200 juta.

Harus diketahui dulu:
- apakah Rp800 juta adalah total budget biaya?
- apakah Rp800 juta adalah dana yang sudah tersedia?
- apakah sponsor Rp200 juta termasuk dalam Rp800 juta?
- apakah sponsor baru committed atau baru expected?
- apakah sponsor berbentuk cash atau in-kind?

---

# 4. CANONICAL PIPELINE

```text
RAW USER INPUT
    ↓
INPUT SANITIZER
    ↓
LANGUAGE NORMALIZER
    ↓
TYPO / SLANG / ABBREVIATION RESOLVER
    ↓
SEMANTIC CONCEPT DETECTOR
    ↓
CLAUSE & SUBTASK SEGMENTER
    ↓
ENTITY / NUMBER / CONSTRAINT EXTRACTOR
    ↓
REFERENCE RESOLVER
    ↓
CONVERSATION STATE BOUNDARY
    ↓
AUTHORITY RESOLVER
    ↓
AMBIGUITY & CONFIDENCE ASSESSOR
    ↓
CANONICAL SEMANTIC FRAME
    ↓
INTENT / TOOL / CALCULATOR ROUTER
    ↓
REASONING
    ↓
DECISION / RESPONSE COMPOSER
```

---

# 5. LANGUAGE NORMALIZATION

## 5.1 Indonesian informal forms

Minimum map:

```text
yg -> yang
dgn/dg -> dengan
dr -> dari
utk/u/ -> untuk
krn/karna -> karena
udh/uda/dah/sdh -> sudah
blm/blom -> belum
skrg/skrng -> sekarang
kmrn -> kemarin
bsk -> besok
ga/gk/gak/nggak/ngga/tdk -> tidak
jgn -> jangan
hrs -> harus
bsa -> bisa
klo/kalo/klw -> kalau
trus/trs -> terus
lg/lgi -> lagi
jd/jdi -> jadi
gmn/gimana -> bagaimana
knp/napa -> kenapa
brp -> berapa
byr/bayr -> bayar
duit -> uang
cuan -> keuntungan
boncos/tekor -> kerugian
req -> permintaan
```

---

## 5.2 Code switching

Contoh:

```text
cari venue yg available 5k pax di jkt terus cek load in access sama curfew nya
```

Canonical interpretation:

```json
{
  "intent": "venue_discovery",
  "city": "Jakarta",
  "capacity": 5000,
  "requirements": [
    "load_in_access",
    "curfew"
  ]
}
```

---

# 6. TYPO INTELLIGENCE

Known typo example:

```text
promotr -> promotor
promter -> promoter
sponshor -> sponsor
sponsr -> sponsor
veneu -> venue
ligthing -> lighting
confrence -> conference
soundcek -> soundcheck
sekurity -> security
contigency -> contingency
loadin -> load-in
loadout -> load-out
```

Fuzzy matching:
- hanya terhadap OKKAX semantic lexicon;
- tidak seluruh vocabulary;
- high confidence → silently normalize;
- low confidence + material impact → clarify.

---

# 7. ABBREVIATION INTELLIGENCE

Context-sensitive:

```text
GA
SM
PM
LO
DP
PO
EO
FOH
PA
IEM
SPL
RMS
LX
LD
SFX
K3
P3K
PPN
RFQ
RFP
SOW
MOU
NDA
ROI
BEP
GMV
SLA
SOP
```

Contoh:

```text
tiket GA 250rb
→ General Admission

ga jadi sponsor
→ tidak jadi sponsor
```

Tidak boleh satu abbreviation mempunyai satu arti global tanpa context.

---

# 8. NUMBER & MONEY INTELLIGENCE

Harus memahami:

```text
Rp800.000.000
800 juta
800jt
800 jt
800juta
800000000
0,8 miliar
```

Canonical:

```json
{
  "currency": "IDR",
  "amount": 800000000
}
```

Capacity:

```text
5k pax
5000 pax
5.000 orang
5 ribu penonton
lima ribu orang
```

Canonical:

```json
{
  "capacity": 5000
}
```

---

# 9. CLAUSE & SUBTASK SEGMENTATION

User tidak selalu memberi satu intent.

Contoh:

```text
sponsor batal 200jt sound max120 budget800 cari venue bandung 5000pax terus hitung gapnya
```

Harus menjadi:

```json
{
  "subtasks": [
    {
      "type": "state_update",
      "field": "sponsor_loss",
      "value": 200000000
    },
    {
      "type": "constraint",
      "field": "sound_budget_ceiling",
      "value": 120000000
    },
    {
      "type": "constraint",
      "field": "event_budget_ceiling",
      "value": 800000000
    },
    {
      "type": "venue_discovery",
      "city": "Bandung",
      "capacity": 5000
    },
    {
      "type": "calculation",
      "operation": "funding_gap"
    }
  ]
}
```

Segmentation tidak boleh bergantung hanya pada punctuation.

---

# 10. REFERENCE RESOLUTION

OKKAX harus mengenali referensi seperti:

```text
yang pertama
yang kedua
yang tadi
itu
ini
dia
mereka
budgetnya
sponsornya
venue-nya
yang batal
yang mahal
yang paling dekat
penggantinya
kenapa
kok bisa
apa dampaknya
risikonya
```

---

# 11. REFERENT PRIORITY

Untuk short dependency:

```text
Kenapa?
Mengapa?
Kok bisa?
Apa dampaknya?
Risikonya?
Masih feasible?
```

Prioritas referensi:

```text
1. claim / question / change paling baru yang masih salient
2. selected entity paling baru
3. active subtask paling baru
4. active event state sebagai supporting context
5. older history hanya bila masih dalam active context segment
```

Tidak boleh langsung menjelaskan seluruh event secara acak.

---

# 12. AMBIGUITY RESOLUTION

AI tidak boleh selalu bertanya klarifikasi.

Gunakan:

```text
confidence tinggi + referent jelas
→ jawab langsung

dua interpretasi plausible tetapi salah satunya jauh lebih salient
→ pilih yang paling salient dan nyatakan interpretasi singkat bila perlu

dua interpretasi sama kuat + outcome material berbeda
→ minta klarifikasi

ambiguity tidak material
→ pilih interpretasi paling natural
```

Contoh:

Conversation:
```text
Sponsor Rp200 juta batal. Apa dampaknya?
Kenapa?
```

Interpretasi paling salient:

```text
"Kenapa dampak finansial tersebut terjadi?"
```

Bukan otomatis:

```text
"Kenapa sponsor membatalkan kontrak?"
```

Jika user ingin penyebab eksternal pembatalan, AI dapat berkata:

> “Kalau yang Anda maksud alasan sponsor membatalkan kesepakatan, saya perlu data/komunikasi sponsor tersebut.”

---

# 13. CONVERSATION STATE BOUNDARY

State engine harus membedakan:

```text
TRUE_FOLLOW_UP
NEW_TOPIC
CORRECTION
STANDALONE
KNOWLEDGE_BREAK
ACTIVE_CONTEXT_BREAK
```

Semantic state dan reasoning history harus mengikuti boundary yang sama.

---

# 14. AUTHORITY ORDER

```text
1. explicit current-turn constraint
2. server-authoritative internal data
3. valid active context
4. canonical calculation/policy
5. verified knowledge
6. external evidence
7. planning assumption
8. LLM inference
```

---

# 15. CANONICAL SEMANTIC FRAME

Semua pipeline downstream harus menerima bentuk internal konsisten.

Contoh:

```json
{
  "frame_version": "1.0",
  "original_text": "sponsor gw batal 200jt sound max120 budget800 gimana",
  "normalized_text": "sponsor saya batal Rp200 juta, sound maksimal Rp120 juta, budget Rp800 juta, bagaimana dampaknya",
  "language": ["id"],
  "intent": "event_financial_impact",
  "sub_intents": [
    "sponsor_cancellation",
    "budget_constraint",
    "production_constraint"
  ],
  "concepts": [
    "actor.sponsor",
    "finance.budget",
    "production.audio"
  ],
  "entities": {},
  "constraints": {
    "event_budget_ceiling": 800000000,
    "sound_budget_ceiling": 120000000,
    "sponsor_loss": 200000000
  },
  "references": [],
  "assumptions": [],
  "ambiguities": [],
  "confidence": 0.98,
  "state_action": "update_active_event"
}
```

---

# 16. ASSERTION CLASSIFICATION

Sebelum reasoning, setiap pernyataan penting harus diberi jenis:

```text
USER_FACT
USER_CONSTRAINT
USER_HYPOTHESIS
CALCULATED
SYSTEM_FACT
EXTERNAL_FACT
ESTIMATE
INFERENCE
UNKNOWN
```

Contoh:

> “Kehilangan sponsor Rp200 juta berarti dana tersisa Rp600 juta.”

Ini **BUKAN** otomatis `CALCULATED`.

Ini hanya valid bila:
- Rp800 juta = dana tersedia;
- Rp200 juta sponsor merupakan bagian dari Rp800 juta;
- dana sponsor belum tergantikan;
- tidak ada sumber funding lain.

Jika tidak, tandai:

```text
HYPOTHESIS_REQUIRES_CLARIFICATION
```

---

# 17. REASONING OVER IMPLICIT MATH

AI harus bisa mendeteksi kalkulasi implisit.

Contoh:

```text
budget 800jt sponsor 200jt batal
```

Possible calculations:
- 200 / 800 = 25%;
- funding shortfall may be Rp200 juta;
- cash available is NOT automatically Rp600 juta without funding semantics.

AI harus membedakan:

```text
budget ceiling
cash-on-hand
committed funding
expected sponsorship
revenue target
expense budget
```

---

# 18. FINANCIAL SEMANTICS

Canonical fields minimum:

```text
event_budget_ceiling
committed_cash
expected_sponsorship
committed_sponsorship
in_kind_sponsorship
ticket_revenue_target
tenant_revenue_target
funding_gap
cashflow_gap
production_cap
vendor_quote
contingency
tax
```

Dilarang menyamakan semuanya sebagai `budget`.

---

# 19. COUNTERFACTUAL & SCENARIO REASONING

OKKAX harus mampu:

```text
current scenario
vs
sponsor loss
vs
capacity reduction
vs
ticket price increase
vs
venue downgrade
vs
production reduction
vs
replacement sponsor
```

Tapi scenario tidak boleh mengubah user constraint secara diam-diam.

---

# 20. RISK CASCADE REASONING

AI harus mengenali hubungan berantai:

```text
sponsor loss
→ funding gap
→ cash coverage pressure
→ possible payment delays
→ vendor confirmation risk
→ production readiness risk
→ event graph blockers
```

Namun:
- hanya hubungan relevan yang dijelaskan;
- jangan menambahkan domain acak.

---

# 21. OPERATIONAL DECISION FRAME

Jawaban high-value sebaiknya mengikuti:

```text
1. Apa yang berubah?
2. Dampak langsung?
3. Dampak kedua/ketiga?
4. Constraint yang tidak boleh dilanggar?
5. Pilihan keputusan?
6. Trade-off tiap pilihan?
7. Rekomendasi?
8. Next executable action?
```

Tidak semua pertanyaan membutuhkan delapan bagian.

---

# 22. CLARIFICATION POLICY

Minta klarifikasi hanya jika:
- ambiguity material;
- data hilang mengubah keputusan;
- dua interpretasi sama kuat;
- calculation tidak dapat dilakukan tanpa assumption besar;
- action berisiko.

Jangan minta klarifikasi jika:
- typo jelas;
- slang jelas;
- referent sangat salient;
- calculation deterministik;
- detail yang hilang tidak material.

---

# 23. PROACTIVE INTELLIGENCE

AI boleh proaktif bila ada risiko nyata.

Contoh:
- funding gap signifikan;
- safety constraint konflik;
- venue capacity tidak cocok;
- schedule impossible;
- sponsor loss memengaruhi cash coverage;
- critical path blocker.

Proaktif bukan berarti:
- menambah ide acak;
- membuat scope baru;
- mengganti constraint user.

---

# 24. DECISION QUALITY OVER VERBOSITY

Jawaban dianggap pintar bila:
- tepat;
- relevan;
- mampu menghubungkan sebab-akibat;
- tidak mengarang;
- mengenali ambiguity;
- tahu kapan berhenti;
- menawarkan keputusan operasional.

Bukan karena panjang.

---

# 25. ADVERSARIAL REASONING DATASET — SPONSOR LOSS CASE

Dataset ini digunakan untuk regression/evaluation. Pernyataan di bawah **bukan semuanya fakta**. Beberapa sengaja merupakan ambiguity probe atau hypothesis yang wajib divalidasi.

Scenario seed:

```text
T1: Saya mau festival di Jakarta untuk 5.000 pax.
T2: Budget maksimal Rp800 juta.
T3: Sound maksimal Rp120 juta.
T4: Sponsor Rp200 juta batal. Apa dampaknya?
T5: Kenapa?
```

---

## 25.1 Ambiguity & referent tests

### AR-01
`Kenapa?`

Target:
- resolve immediate salient referent;
- default: why sponsor loss creates the stated impact;
- do not randomly explain headliner/weather/load-in.

### AR-02
`Kenapa sponsornya batal?`

Target:
- distinguish external cancellation cause from internal financial impact;
- if cause data unavailable, state unknown / search if authorized.

### AR-03
`Kenapa dampaknya segitu?`

Target:
- explain calculation/assumption behind impact.

### AR-04
`Maksudnya kenapa?`

Target:
- resolve most recent claim;
- clarify only if referent remains materially ambiguous.

### AR-05
`Yang 200 juta itu kenapa?`

Target:
- resolve amount to cancelled sponsor, not sound cap.

---

## 25.2 Financial semantics tests

### FS-01
`Berarti uang saya tinggal 600 juta?`

Correct behavior:
- do NOT automatically say yes;
- check whether 800M is expense ceiling or committed cash and whether sponsorship is included.

### FS-02
`Sponsor 200 juta itu berapa persen dari budget 800 juta?`

Expected:
- 25%.

### FS-03
`Kalau memang dana available tadinya 800 juta termasuk sponsor 200 juta, sekarang sisa berapa?`

Expected:
- Rp600 juta.

### FS-04
`Kalau dana tinggal 600 juta dan sound tetap 120 juta, sound jadi berapa persen?`

Expected:
- 20%.

### FS-05
`Kalau 600 juta untuk 5.000 pax, budget per pax berapa?`

Expected:
- Rp120.000 per pax.

### FS-06
`Apakah funding gap pasti 200 juta?`

Correct:
- depends on funding structure/replacement sources;
- loss vs gap must be distinguished.

---

## 25.3 Constraint preservation tests

### CP-01
`Security dan medical tidak boleh dipotong`

Expected:
- mark as non-cuttable constraints.

### CP-02
`Sound juga tidak boleh lebih dari 120 juta`

Expected:
- preserve ceiling exactly.

### CP-03
`Jangan turunkan kapasitas`

Expected:
- do not propose capacity reduction as recommendation.

### CP-04
`Venue harus tetap Jakarta`

Expected:
- do not move event to another city.

---

## 25.4 Scenario reasoning tests

### SR-01
`Kalau kapasitas boleh turun ke 3.000, apa efeknya?`

Expected:
- simulation, not state mutation unless user confirms.

### SR-02
`Kalau tiket dinaikkan untuk tutup 200 juta, berapa tambahan rata-rata per orang kalau 5.000 tiket terjual?`

Expected:
- Rp40.000 per ticket additional gross requirement, before fees/tax caveats.

### SR-03
`Kalau cuma 4.000 tiket yang realistis terjual?`

Expected:
- Rp50.000 additional gross per sold ticket to cover 200M, before fees/tax.

### SR-04
`Apa pilihan selain menaikkan tiket?`

Expected:
- sponsor replacement;
- tenant/commercial;
- cost reduction respecting locked safety;
- payment restructuring;
- optional scope reduction;
- no silent constraint changes.

---

## 25.5 Logistics & venue reasoning tests

### LV-01
`Kalau pindah ke venue outdoor lebih murah pasti lebih hemat kan?`

Expected:
- challenge assumption;
- outdoor may increase power, weather mitigation, rigging, security, sanitation, sound coverage, permits.

### LV-02
`Kalau venue lebih murah tapi jauh dari audience gimana?`

Expected:
- analyze attendance/logistics/transport trade-off.

### LV-03
`Kalau load-in venue cuma 8 jam cukup?`

Expected:
- needs production scope; use event knowledge/tooling; no arbitrary yes/no.

---

## 25.6 Risk cascade tests

### RC-01
`Kalau sponsor nggak terganti 24 jam ke depan apa yang paling bahaya?`

Expected:
- identify cash-critical commitments;
- vendor/talent/venue deadlines;
- payment schedule;
- graph blockers;
- prioritize based on actual data if available.

### RC-02
`Apa worst case-nya?`

Expected:
- relevant scenario chain;
- not sensational;
- distinguish financial vs operational vs safety.

### RC-03
`Apa yang harus saya lock dulu?`

Expected:
- choose based on critical path and non-refundable/deadline-sensitive dependencies.

---

## 25.7 Knowledge + current event tests

### KC-01
`Promotor sama EO bedanya apa dan di kasus saya siapa yang tanggung sponsor gagal?`

Expected:
- answer knowledge distinction;
- then apply to current event only if roles/contract are known;
- do not invent responsibility.

### KC-02
`Kalau EO saya cuma vendor jasa berarti sponsor bukan tanggung jawab dia kan?`

Expected:
- likely, but contract controls;
- avoid absolute legal claim without contract.

---

## 25.8 Typo / slang / punctuation tests

All must be interpreted correctly:

```text
sponsr 200jt batal gmn
sponsor batal200 sound120 budget800 ap efeknya
sponshor cancel 200jt knp
budget800jt sponsor200 ilang sound max120 gimana bro
ga ada sponsor 200jt lg efeknya brp
```

---

# 26. ASSERTION VALIDATION DATASET

The following statements must NOT be accepted blindly.

### AV-01
`Sponsor 200 juta batal berarti uang riil sekarang 600 juta.`

Classification:
- hypothesis unless funding semantics confirm it.

### AV-02
`Kehilangan 200 juta berarti 25% kekuatan finansial acara hancur.`

Valid only if:
- 800M is the relevant financial base.

Otherwise:
- contextual ratio hypothesis.

### AV-03
`Venue 5.000 pax di Jakarta pasti mahal.`

Classification:
- general expectation, not fact;
- live data required for specific claim.

### AV-04
`Outdoor pasti lebih murah.`

Classification:
- false generalization.

### AV-05
`Harus turunkan kapasitas ke 3.000.`

Classification:
- proposal, not mandatory conclusion.

---

# 27. RISK MODEL

Risk dimensions:

```text
financial
cashflow
commercial
venue
production
technical
safety
compliance
talent
workforce
ticketing
schedule
logistics
weather
reputation
customer_experience
```

Each risk may have:

```json
{
  "probability": null,
  "impact": "low|medium|high|critical",
  "confidence": 0.0,
  "evidence": [],
  "dependencies": [],
  "mitigations": []
}
```

Do not fabricate probability numbers without data.

---

# 28. PROACTIVE ACTION POLICY

AI may proactively recommend only when:

```text
risk is material
AND recommendation respects locked constraints
AND recommendation is directly connected to user's objective
```

Example:
- sponsor loss + payment deadline tomorrow → surface urgent funding action.

Do not:
- generate unrelated strategy ideas;
- change venue/capacity without permission if locked.

---

# 29. TOOL-SELECTION SEMANTICS

Semantic frame determines tools.

Examples:

```text
funding gap
→ deterministic calculator + internal finance

venue candidate
→ internal venue catalog + external intelligence

why did sponsor company withdraw
→ internal CRM/notes if authorized + external current web only if relevant

latest event regulation
→ external current knowledge

promoter vs EO
→ knowledge layer, no SerpAPI needed
```

---

# 30. SERPAPI INTERACTION

SerpAPI is external evidence, not semantic brain.

Flow:

```text
semantic frame
→ capability required
→ SerpAPI engine router
→ normalized evidence
→ authority resolver
→ reasoning
```

No external search for:
- direct arithmetic;
- internal confirmed data;
- stable knowledge already available;
- simple semantic normalization.

---

# 31. RESPONSE BEHAVIOR

## Simple question
Simple answer.

## Ambiguous but likely referent
Answer likely interpretation; disclose interpretation briefly if material.

## Material ambiguity
Clarify.

## High-risk decision
Show:
- fact;
- uncertainty;
- trade-off;
- recommended action.

## Complex operational problem
Produce:
- diagnosis;
- calculations;
- risks;
- decision options;
- next action.

---

# 32. USER-FACING LANGUAGE

Do not expose:

```text
semantic_state
semantic_plan
reasoning_provider
pipeline_stages
raw provenance
model/provider internals
raw DB collection names
internal policy IDs
```

---

# 33. TRAINING/EVALUATION PRINCIPLE

Do not use these datasets as fine-tuning data automatically.

Use them as:

```text
golden regression cases
prompt-evaluation corpus
semantic parser tests
state tests
tool routing tests
response-quality tests
```

For each case store:

```json
{
  "input": "...",
  "history": [],
  "expected_semantic_frame": {},
  "forbidden_inferences": [],
  "expected_tools": [],
  "expected_answer_properties": []
}
```

---

# 34. AGENT IMPLEMENTATION RULE

Agent implementing this spec must not try to solve everything in one giant refactor.

Recommended micro-phases:

```text
LI-1 normalization primitives
LI-2 slang + abbreviation
LI-3 semantic lexicon
LI-4 typo/fuzzy
LI-5 clause segmentation
LI-6 canonical semantic frame
LI-7 referent resolver
LI-8 ambiguity/confidence
LI-9 authority integration
LI-10 tool-router integration
```

Each phase:
- targeted;
- regression tested;
- no unrelated changes.

---

# 35. ACCEPTANCE GATE

Language Intelligence V1 is not PASS until system handles at minimum:

### Clean language
```text
Apa perbedaan promotor dan EO?
```

### Slang
```text
beda promotor sm EO apaan
```

### Typo
```text
beda promotr dan EO
```

### No punctuation
```text
sponsor batal 200jt sound max120 budget800 gimana
```

### Mixed language
```text
sponsor cancel 200jt what impact ke budget 800jt
```

### Ambiguous short dependency
```text
Kenapa?
```

### Multi-subtask
```text
sponsor batal 200jt cari penggantinya sama hitung gap baru
```

### Counterfactual
```text
kalau kapasitas turun 3000 gimana
```

### Authority
```text
security medical jangan dipotong
```

### Unknown
```text
kenapa sponsor X batal
```

without internal/external evidence:
- must not fabricate reason.

---

# 36. FINAL PRINCIPLE

OKKAX yang cerdas bukan sistem yang selalu menjawab.

OKKAX yang cerdas adalah sistem yang:

```text
mengerti bahasa yang berantakan
mengerti maksud
mengerti referensi
mengerti angka
mengerti apa yang belum diketahui
mengerti mana fakta dan asumsi
mengerti konteks yang masih aktif
mengerti kapan konteks sudah mati
mengerti tool yang relevan
mengerti konsekuensi berantai
mengerti constraint user
mengerti kapan harus bertanya
mengerti kapan tidak perlu bertanya
menghasilkan keputusan yang bisa dieksekusi
```

**Target akhir:**
User boleh menulis seperti manusia nyata, bukan seperti mengisi form untuk mesin.

# END
