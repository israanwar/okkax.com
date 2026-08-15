OKKAX
# MASTER EXECUTION CONTRACT V5
Product → Network → Economy → Intelligence → Profitability → Scale
MASTER SOURCE OF TRUTH FOR CLAUDE CODE, CODEX, EMERGENT, AND HUMAN CONTRIBUTORS

Purpose
This document is the authoritative execution boundary for OKKAX. Agents must implement only work that is explicitly traceable to this roadmap. They must not invent product scope, redesign architecture, introduce unrelated features, or continue to a later phase without an explicit task contract and gate approval.
North Star
OKKAX is the operating network for the live-event economy.
Supersession Rule
This V5 document governs execution order. Earlier roadmaps remain historical/design evidence only where they do not conflict with V5. If any prior instruction conflicts with V5, V5 wins unless the owner explicitly issues a newer written amendment.
Current execution principle
Do not rebuild. Inspect existing implementation first. Preserve correct working code. Changes must be minimal, additive where possible, backward-compatible, tested, and reversible.

# 1. NON-NEGOTIABLE SYSTEM CONSTITUTION
SD-01 — Systemic Design Principle
Every feature must have a clear upstream cause, downstream consequence, shared source of truth, and visible connection to the event lifecycle.
One lifecycle:
DISCOVERY / DEMAND
→ EVENT INTENT
→ EVENT BRIEF
→ EVENT REQUIREMENTS
→ BUDGET + FUNDING
→ SUPPLY MATCHING
→ AVAILABILITY + PRICING
→ QUOTE / NEGOTIATION
→ CONTRACT
→ PROTECTED FUNDING
→ PERMITS + COMPLIANCE
→ PRODUCTION / FULFILLMENT
→ TICKETING
→ LIVEPASS / ACCESS
→ EVENT OPERATIONS
→ EVENT GRAPH
→ READINESS
→ EVENT DAY
→ COMPLETION
→ SETTLEMENT
→ POST-EVENT EVIDENCE
→ ANALYTICS + INTELLIGENCE
→ REPUTATION / REPEAT BUSINESS
## 1.1 Agent anti-improvisation rules
- NO feature may be added because it is 'useful', 'standard', 'best practice', or 'nice to have' unless it maps to a V5 phase and an approved task.
- NO new role, permission, workflow, status, table/collection, service, API provider, payment method, pricing rule, tax rule, UI navigation item, or domain may be invented without an approved requirement.
- NO broad refactor, stack replacement, dependency migration, architecture rewrite, design-system replacement, or schema redesign unless explicitly requested.
- NO silent changes to business rules.
- NO fake commercial facts presented as real. Seed/demo/reference data must be labeled or traceable.
- NO hardcoded tax rate, financial threshold, commission, permit requirement, or provider availability when these are policy/configuration concerns.
- NO cross-organization access inferred from knowing a resource ID or participating in the same event.
- NO frontend state is an authorization authority.
- NO agent may continue to the next roadmap task after finishing the assigned task.
- When uncertain, STOP and report the ambiguity instead of choosing a product direction.
## 1.2 Visual constitution
- Brand colors: black, OKKAX pink, white. Gray only as neutral UI derivative.
- Public surfaces: editorial and aspirational.
- Audience: simple, immediate, mobile-first Event Companion.
- Organizer/business workspace: operational and information-dense.
- Admin: control-room, high-density, action-oriented.
- Critical artifacts (invoice, receipt, quote, contract, settlement, work order, LivePass, reports) must share one recognizable OKKAX artifact language.
- Do not introduce purple SaaS aesthetics, rainbow gradients, decorative orange/blue systems, or generic card-heavy dashboards.
# 2. EXECUTION ROADMAP V5

| Phase | Objective | Primary outputs | Gate |
| --- | --- | --- | --- |
| 00 Foundation | Stabilize existing product | repo/env/DB/seed/routing/health/logging/regression | F0 |
| 01 Identity & Trust | Establish who acts and for whom | auth, accounts, organizations, workspaces, RBAC, tenant isolation | F1 |
| 02 Control & Security | Govern platform safely | Control Plane, approvals, audit, security architecture | F2 |
| 03 Network Supply | Build event-economy supply | talent, venue, vendor, workforce, sponsor, tenant | F3 |
| 04 Event Compiler | Turn intent into executable requirements | brief, requirements, budget, calendar, matching | F4 |
| 05 Commerce Engine | Make relationships commercially executable | quote, negotiation, contract, protected payment, tax engine | F5 |
| 06 Compliance & Readiness | Determine whether event can legally/operationally proceed | permits, safety, rider, logistics, readiness | F6 |
| 07 Ticketing & LivePass | Sell, own and validate access | inventory, checkout, ticketing, LivePass, access credentials | F7 |
| 08 Event Operations | Operate live event state | Event Graph, timeline, incidents, fulfillment | F8 |
| 09 Finance & Settlement | Close the economic lifecycle | completion, payout, settlement, reconciliation, artifacts | F9 |
| 10 Intelligence & Growth | Turn network data into advantage | analytics, recommendations, grounded Intelligence, reputation | F10 |
| 11 Scale & Championship | Production readiness and proof | performance, SEO/AEO/GEO, Jury Mode, QA, release | F11 |

## 2.1 Phase 00 — Foundation
- Audit repository before changing it.
- Verify frontend/backend boot, Mongo connectivity, environment variables, deterministic seed/upsert behavior, API health, routing, error handling, baseline logging, Git cleanliness, and existing regression.
- Do not rewrite the app, replace the stack, mass-upgrade dependencies, globally redesign UI, or rename architecture without an approved reason.
- Exit: frontend PASS; backend PASS; DB PASS; existing routes PASS; no P0 regression; clean checkpoint.
## 2.2 Phase 01 — Identity & Trust
- Authentication → Account → Organization → Membership → Workspace → Role → Permission → Scope.
- Support audience account, personal workspace, organization workspace, membership, workspace switching, organization owner/admin, platform admin, Super Admin, RBAC, tenant isolation, session revocation, suspended-account enforcement.
- RESOURCE ID ≠ ACCESS RIGHT. Same event ≠ same organization ≠ shared private data.
- Exit: no privilege escalation, no cross-org leakage, no stale workspace privilege, suspended users cannot retain authority.
## 2.3 Phase 02 — Control & Security
- Implement the OKKAX Control Plane, not a generic CRUD admin.
- Domains: Overview; Identity & Access; Live Economy; Commerce & Finance; Ticketing; Verification & Trust; Event Operations; Intelligence & Data; Security; Analytics; Audit & Governance.
- Risk levels: R0 Routine; R1 Sensitive; R2 High Risk; R3 Critical.
- R2/R3 require governed re-authentication/approval according to policy. Requester must not self-approve. Critical actions must create immutable evidence.
- Backend is authorization source of truth. Super Admin is powerful but never untracked god mode.
## 2.4 Phase 03 — Network Supply
- Canonical supply entities: Talent, Venue, Vendor, Workforce, Sponsor, Tenant, Organizer/Promoter/EO/Company.
- Each supply entity requires identity/organization, profile, category, location, availability, capabilities, pricing source, verification, portfolio, rating, commercial status, calendar, relationships.
- Vendor/workforce taxonomy must be extensible. Do not create a separate marketplace for every physical requirement.
- Core pattern: REQUIREMENT → MATCHING → QUALIFIED SUPPLY.
## 2.5 Phase 04 — Event Compiler
- Event Intent → Guided Brief → Event Classification → Requirement Engine → Budget Model → Dependency Graph → Supply Matching → Event Plan.
- Requirements can represent talent, venue, stage, lighting, sound, security, medical, transport, hotel, wristband, gate scanners, permits, workforce, sponsor target, tenant inventory, and other event-specific needs.
- Each requirement must expose required/optional/fulfilled/at-risk/blocked state.
- Calendar must cover event schedule plus talent, venue, vendor and workforce availability and conflicts.
## 2.6 Phase 05 — Commerce Engine
- Estimate → Official Quote → Negotiation → Accepted Quote → Contract → 100% Funding Secured → Upfront Release + Protected Balance → Fulfillment.
- Protected funds are not OKKAX revenue.
- Completion must support provider completion submission, buyer review, dispute, policy-driven auto-accept fallback, evidence, and audit.
- Tax must be a configurable Tax Engine. Never hardcode '11%' globally.
- Default business model: zero commission on talent/vendor/venue/workforce contract value; OKKAX earns infrastructure revenue.
## 2.7 Phase 06 — Compliance & Readiness
- Event → Classification → Permit Requirement Engine → Documents → Submission/Evidence → Status → Readiness.
- Permit requirements are rule-based by jurisdiction, event type, scale, venue, public-space impact, safety and other characteristics. Do not hardcode universal police/TNI requirements.
- Support authority categories such as local/national government, public safety, venue/area authority, fire/emergency, medical, traffic, immigration, manpower, tax, IP/performing rights, environment/noise, and event-specific compliance.
- International performer workflows may introduce immigration, tax, logistics/customs and other dependencies.
- Permit/compliance blockers must affect Event Graph and readiness.
## 2.8 Phase 07 — Ticketing & LivePass
- Venue Configuration → Sellable Capacity → Inventory → Ticket Product → Ticket Studio → Order → Payment → Issuance → Ownership → LivePass → Validation → Access.
- Native inventory modes: General Admission, Reserved Seating, Zoned GA, Table Seating, Hybrid.
- Organizer controls visual design; OKKAX remains credential/security authority.
- LivePass principle: a ticket is not a file; it is a live access entitlement.
- Validation checks authenticity, freshness, entitlement, current state and redemption/replay.
- Support digital credential → wristband/physical credential exchange without duplicating entitlement.
- One event has one Ticketing Authority.
- Audience transaction requires account identity; public browsing remains open; auth gate occurs at transactional action and returns user to preserved checkout context.
## 2.9 Phase 08 — Event Operations
- Event Graph becomes operational source of truth, not decorative visualization.
- Graph nodes/relationships must represent real domain state across requirements, talent, venue, vendors, workforce, permits, sponsors, tenants, finance, ticketing, access, incidents and readiness.
- State changes must affect readiness/risk where applicable.
- Event-day operations include timeline, incidents, fulfillment, live access state and operational evidence.
## 2.10 Phase 09 — Finance & Settlement
- Funding, payments, protected balance, payouts, refunds, disputes, settlement, tax evidence, reconciliation, invoice, receipt and financial reporting.
- GMV ≠ Revenue ≠ Protected Funds ≠ Tax ≠ Profit.
- Artifact family: OKKAX / INVOICE, RECEIPT, QUOTE, CONTRACT, SETTLEMENT, WORK ORDER, EVENT REPORT, CREDENTIAL.
- Historical financial evidence must not be silently mutable.
## 2.11 Phase 10 — Intelligence & Growth
- Intelligence must be grounded in user/workspace permissions, event state, Event Graph, commercial state and provenance.
- Do not implement generic chat as the core differentiator.
- Risk → Recommendation → Action → Graph changes → Readiness changes is the target closed loop.
- Analytics, reputation and repeat-business mechanisms must derive from real network activity.
## 2.12 Phase 11 — Scale & Championship
- Performance, accessibility, responsive QA, SEO/AEO/GEO, production data/provenance, security audit, monitoring, Jury Mode, deterministic demo and final release.
- Championship demo path: understand product <30 sec → open event → requirements → network → transaction → Graph changes → Intelligence → resolve risk → ticket → validation → settlement → impact.
- Release target: zero visible P0 bug, console error, network 5xx, dead Jury screen, cross-org leak, unlabeled fake commercial data, critical security issue, or mobile overflow.
# 3. BUSINESS & REVENUE CONSTITUTION
- Zero commission by default on talent, venue, vendor and workforce contract principal.
- OKKAX earns from infrastructure, not by taking a percentage of people's work.
- Ticketing fee is core transactional revenue and remains independent of subscription plan (REV-11).
- Protected Payment uses fixed/tiered infrastructure pricing, not an uncapped percentage of large contracts.
- Payment-provider costs must be transparent; do not silently convert them into hidden commission.
- Subscription plans: Free Rp0; Pro Rp299K/month; Business Rp799K/month; Scale Rp1.499M/month; Enterprise Rp2.999M+/month; Enterprise Custom negotiated.
- Enterprise Custom may cover SSO/SCIM, custom API, ERP/accounting integration, dedicated SLA/support/security/compliance.
- Revenue engines: Ticketing; Protected Payment; Subscription; Intelligence; Enterprise; Promotion; API/Integrations.
- Profitability filter: every major feature must primarily Acquire, Activate, Monetize, Retain, or be required for security/compliance.
Ticketing fee blueprint is a commercial configuration, not a permanent hardcoded constant. Any exact percentage/minimum/cap must live in configurable policy and be reviewed against provider costs, tax treatment, fraud/support cost, competitive benchmark and margin.
# 4. SECURITY CONSTITUTION
- Browser/client is untrusted.
- Authorization formula: authenticated + active account + active workspace + membership + role + permission + resource scope + relationship + resource state + policy → allow/deny.
- Platform authority and organization authority are separate boundaries.
- Shared event does not imply shared tenant/private data.
- Workspace switching must discard prior workspace authority.
- Sessions are server-authoritative and revocable; stale tokens must not preserve revoked privilege.
- Sensitive authority should not be permanently embedded in long-lived JWT claims.
- R2/R3 actions require fresh authentication/approval according to policy.
- Audit evidence must be append-only/immutable in intent and cannot be silently deleted or rewritten.
- Payment/refund/settlement status is server/provider authoritative, never frontend authoritative.
- Ticket credential replay, duplication and post-exchange reuse must be detected/denied according to event policy.
- Intelligence must never disclose another workspace's private data.
Unacceptable security outcomes include cross-org private data access, self-elevation, org-to-platform privilege escalation, unauthorized admin permission grant, Super Admin session takeover without detection/response, unauthorized payout destination change, frontend financial manipulation, reusable ticket credential abuse, cross-workspace AI leakage, and silent audit tampering.
# 5. API & INTEGRATION ROADMAP
Agents must not integrate providers merely because they exist. Integrations are introduced only when the relevant V5 phase requires them, credentials/legal prerequisites exist, and an approved task names the provider or provider-selection task.

| Domain | Future API / integration need | Phase | Rule |
| --- | --- | --- | --- |
| Identity | Google OAuth/OIDC; optional Apple/Microsoft later; email/OTP provider; MFA/WebAuthn capability | 01–02 | Do not replace working auth without audit; provider selection configurable. |
| Payments Indonesia | Payment gateway supporting QRIS, Virtual Account, e-wallet, cards, banking, PayLater/OTC where legally/provider-supported | 05/07/09 | Payment Method Registry; show only actually available channels; webhook/server status authoritative. |
| Bank/Payout | Disbursement/payout API, beneficiary validation, bank-account verification where supported | 05/09 | Govern payout changes as high-risk actions; no invented bank support. |
| Tax | Tax rules/configuration and, later, e-invoice/e-tax integration where legally required/available | 05/09 | No global hardcoded 11%; jurisdiction and transaction-type aware. |
| Maps/Geospatial | Google Maps Platform or approved equivalent: geocoding, places, routes/directions, venue location | 03/04/07 | Provider keys server-protected; cache/usage policy respected. |
| Calendar | Google Calendar/Microsoft 365 calendar integration; iCal export | 03/04 | Canonical availability remains OKKAX-controlled; external calendars synchronize, not replace source of truth. |
| Communications | Transactional email; SMS/WhatsApp Business/push notifications | 01 onward | Templates branded; secrets protected; notification preferences respected. |
| Storage/Media | Object storage/CDN for event artwork, documents, contracts, permits, ticket assets | 00 onward | Signed access for private files; provenance and ownership metadata. |
| Documents/E-sign | PDF/document rendering; e-signature provider where legally/operationally appropriate | 05/06/09 | Signed document/evidence cannot be silently mutated. |
| Ticket Wallet | Apple Wallet and Google Wallet event pass integration | 07 | Wallet pass is representation of server-side entitlement, not authority by itself. |
| Access Hardware | Scanner/validator API; QR/barcode; optional NFC/RFID/wristband hardware adapters | 07/08 | Technology-agnostic entitlement; offline mode must reconcile safely. |
| Fraud/Risk | Device/risk signals, bot protection, rate limiting, optional fraud provider | 02/05/07 | Risk provider augments policy; never becomes sole authorization source. |
| Permits/Authorities | Government/authority APIs only where officially available; otherwise evidence/submission workflow | 06 | Never fabricate direct government integration. |
| Immigration/International | Official/partner APIs only where legally available; otherwise guided compliance/evidence workflow | 06 | Jurisdiction-specific; no universal assumptions. |
| Accounting/ERP | Xero/QuickBooks/ERP/accounting APIs; Indonesian accounting integrations as selected | 09/11 | Enterprise/custom; reconciliation remains auditable. |
| Analytics/Observability | Error monitoring, logs, metrics, tracing, product analytics | 00/11 | No secrets/PII in logs; monitoring required before production. |
| Search | Search/index service when dataset scale requires it | 03/04/11 | Do not add premature infrastructure before measurable need. |
| AI/LLM | Approved LLM provider(s), retrieval/embedding/vector capability if required | 10 | Graph/provenance/permission grounded; provider abstraction preferred; no private-data leakage. |
| SEO/Search engines | Google Search Console/Bing Webmaster/sitemap/indexing workflows | 11 | Public surfaces only; canonical/locale/schema rules. |
| Enterprise Identity | SSO/SAML/OIDC, SCIM | 11 / Enterprise Custom | Not required for early core unless contracted. |
| API Ecosystem | Public/partner API, webhooks, API keys/OAuth clients | 11 | Versioned, scoped, rate-limited, audited. |

## 5.1 API integration contract
- All provider secrets live in environment/secret management, never source code or client bundles.
- Every external API requires timeout, retry/backoff policy where safe, idempotency where transactional, structured error handling, observability, and test/sandbox strategy.
- Webhooks require signature verification or equivalent provider-authentication mechanism and idempotent processing.
- External provider status never overrides OKKAX domain invariants without validated mapping.
- Provider-specific logic must be isolated behind adapters/services when practical to prevent lock-in and reduce future migration cost.
- No provider name may be displayed as supported until the integration is actually configured and tested.
# 6. DATA & SOURCE-OF-TRUTH RULES

| Domain | Canonical authority |
| --- | --- |
| Identity/account state | OKKAX backend/session/account records |
| Membership/role/permission | OKKAX backend authorization records |
| Organization private data | Owning organization + explicit relationship policies |
| Event lifecycle | OKKAX event/domain state |
| Requirements/readiness | Requirement Engine + Event Graph derived state |
| Availability | OKKAX canonical availability, optionally synchronized from external calendars |
| Commercial quote/contract | Accepted versioned commercial records |
| Payment state | Verified payment provider + OKKAX transaction state machine |
| Protected balance/settlement | OKKAX finance ledger + provider reconciliation |
| Ticket ownership | OKKAX entitlement record |
| Gate access | OKKAX entitlement/current credential state + validator evidence |
| Permit status | Verified evidence/submission/authority status; provenance required |
| Intelligence | Derived from permitted canonical data and cited provenance |

- Do not duplicate authoritative status across unrelated collections/tables without a synchronization contract.
- Derived values must be recomputable or traceable.
- Every important state transition must have actor/time/reason/evidence where applicable.
- Demo/reference data must be deterministic and clearly distinguishable from verified real-world commercial data.
# 7. TOKEN & COST ECONOMY PROTOCOL
Goal: reduce repeated context reconstruction in Claude Code, Codex and Emergent.
MASTER EXECUTION CONTRACT (this document)
↓
PHASE CONTRACT
↓
TASK CONTRACT
↓
AGENT EXECUTION
↓
TEST + DIFF + CHECKPOINT
## 7.1 Required task prompt format
OKKAX TASK CONTRACT

TASK
[one sentence]

ROADMAP TRACE
Phase: [00–11]
Requirement IDs / section: [...]

CURRENT STATE
[max 5 bullets]

READ FIRST
[exact files / directories]

INVARIANTS
[only rules relevant to this task]

IMPLEMENT
[precise scope]

DO NOT
[explicit exclusions]

VERIFY
[commands / tests / acceptance checks]

OUTPUT
- files changed
- tests run and result
- remaining blockers
- no extra work performed

STOP
Do not continue to the next roadmap task.
## 7.2 Agent specialization default

| Agent | Default use |
| --- | --- |
| Claude Code | Feature implementation, multi-file UI, React workflows, backend feature wiring, adapting existing code. |
| Codex | Repository audit, security review, bug isolation, tests, API-contract verification, regression, targeted refactoring. |
| Emergent | Environment integration, preview, deployment verification, competition provenance, final publish. |

This division is a default, not a rigid law. Never ask two agents to independently redesign the same feature. One agent implements; another may review/test a bounded diff.
## 7.3 Emergent credit protection
LOCAL REPOSITORY
→ CLAUDE/CODEX
→ LOCAL TESTS
→ REVIEW DIFF
→ GIT COMMIT
→ GITHUB
→ EMERGENT PULL
→ PREVIEW
→ ONLY IF PASS
→ PUBLISH
- Treat Emergent credit as release/integration resource, not exploratory coding budget.
- Do not repeatedly prompt Emergent for UI/logic experiments that can be implemented and tested locally.
- Do not republish after every small change. Batch only changes that already pass local checks and are appropriate for the current task.
# 8. CHANGE CONTROL & SCOPE GOVERNANCE
Any proposed feature, improvement or correction must be classified before implementation.

| Classification | Action |
| --- | --- |
| Bug/regression inside existing roadmap behavior | Fix within current phase/task; add regression test. |
| Missing requirement already implied by V5 | Map it explicitly to the relevant phase, update task contract, then implement. |
| Enhancement that improves an existing V5 feature | Allowed only as an amendment to that phase; must not create a new disconnected domain. |
| New feature outside V5 | DO NOT IMPLEMENT. Record as proposal/backlog and request owner decision. |
| Architecture conflict discovered | STOP. Report conflict, affected files/data, options, migration risk. Do not choose silently. |
| Security-critical defect | STOP expansion; isolate/fix under Phase 02 rules before continuing. |

Amendment rule: additions must be written as V5.x amendments with phase mapping, upstream cause, downstream consequence, source of truth, business/security impact, API impact, acceptance tests, and migration implications.
# 9. CURRENT WORK POSITION & RESUMPTION RULE
The roadmap is now V5. Existing unfinished implementation must be reconciled against V5 before coding continues. Do not resurrect an older step merely because it was previously next.
- First action when returning to Claude Code: audit the current repository/checkpoint and map unfinished work to V5 Phase 00/01/02.
- The known historical checkpoint around Step 06C/RBAC is not permission to continue blindly. Inspect what is already implemented, what passes, what is missing, and which V5 acceptance criteria it satisfies.
- Finish the smallest currently-blocking V5 requirement first. Do not jump to later supply, commerce, ticketing, intelligence, or visual enhancements.
- After each bounded task: test → review diff → commit → stop.
- No phase is complete until its exit gate passes.
# 10. FIRST CLAUDE CODE INSTRUCTION
Use the following as the first bounded instruction after placing this document in the repository:
Read docs/OKKAX_MASTER_EXECUTION_CONTRACT_V5.md as the product execution authority.

TASK
Audit the current repository state only. Do not implement features yet.

ROADMAP TRACE
V5 Phase 00 Foundation + Phase 01 Identity & Trust + Phase 02 Control & Security.

OBJECTIVE
Determine exactly what is already implemented, partially implemented, broken, or missing relative to the V5 requirements, with special attention to the existing RBAC/workspace/auth checkpoint.

RULES
- Do not redesign architecture.
- Do not add features.
- Do not refactor broadly.
- Do not upgrade dependencies.
- Do not change database schema.
- Do not continue to a later roadmap phase.
- Inspect code and tests before making conclusions.
- Treat existing working behavior as an asset to preserve.

OUTPUT ONLY
1. Current architecture summary.
2. V5 requirement-to-code mapping.
3. Completed items.
4. Partial items.
5. Missing items.
6. Bugs/security gaps.
7. Exact files involved.
8. Existing tests and missing tests.
9. Recommended NEXT SINGLE TASK only.
10. Estimated change scope for that task.

STOP after the audit.
# 11. FIRST CODEX INSTRUCTION
Read docs/OKKAX_MASTER_EXECUTION_CONTRACT_V5.md as the execution authority.

Perform an independent repository audit focused on:
- authentication/session authority,
- workspace switching,
- RBAC/permissions/scope,
- tenant isolation / IDOR-BOLA risk,
- suspended-account enforcement,
- privilege escalation,
- existing tests and regression risk.

Do not implement.
Do not redesign.
Do not propose unrelated features.
Map every finding to V5 Phase 01 or Phase 02.
Return severity, evidence/file path, affected invariant, and the smallest safe remediation.
STOP after the audit.
# 12. DEFINITION OF DONE FOR EVERY TASK
- Task is traceable to one V5 phase and approved requirement.
- Existing implementation was inspected first.
- Change stayed within declared files/scope or deviations were explicitly approved.
- No unrelated feature/refactor was added.
- Authorization/security invariants remain intact.
- Business rules were not silently changed.
- Automated tests were added/updated where behavior changed.
- Relevant local checks pass.
- Diff was reviewed for accidental changes, secrets and generated junk.
- A reversible Git checkpoint exists.
- Agent reports blockers honestly and stops.
# 13. FINAL DIRECTIVE TO ALL AGENTS
Do not optimize OKKAX for feature count. Optimize it for systemic completeness, reliability, profitability, trust, and demonstrable real-world impact.
When a requested implementation is not clearly authorized by this document or a later owner-approved amendment, DO NOT IMPROVISE. STOP AND ASK FOR A DECISION.
