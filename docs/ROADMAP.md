# Alpha Roadmap

> Long-term development roadmap for Alpha.

---

# Phase 1 — Foundation (Completed)

Status: Completed

- Portfolio System
- Dashboard
- Decision Engine
- Config System
- Git Repository
- GitHub Repository
- Project Documentation

---

# Phase 2 — Core Infrastructure and Architecture (Current)

Status: In Progress

Goals:

- Maintain project documentation and development workflow
- Integrate the Risk Engine across decision systems
- Extend deterministic decision and learning records into reviewable product capabilities
- Reconcile the current Python prototype with the TypeScript architecture without weakening system boundaries

Documented Architecture (designs may precede implementation):

- Research Framework
- Instrument Ranking Engine
- Trade Outcome Log
- Knowledge Approval Layer architecture

Implemented and Tested Foundations:

- Opportunity Score Engine v1
- Prediction Engine v1
- AI Router deterministic planning foundation
- AI Cost Governor deterministic enforcement foundation
- AI Provider Adapter interface and registry foundation
- AI Execution Coordinator deterministic foundation
- AI Reservation Manager deterministic in-memory foundation
- AI Cost Ledger append-only local accounting foundation
- Unified Audit Repository append-only evidence and traceability foundation
- AI Runtime Workflow deterministic orchestration foundation
- Prediction Log append-only repository and deterministic review lifecycle foundation
- Alpha Journal append-only evidence, amendment, review, privacy, export, and audit foundation
- Research Lab append-only evidence, lifecycle, amendment, review, supersession, privacy, export, and audit foundation
- Strategy Versioning immutable definition/version lineage, validation, owner approval, activation, comparison, rollback, performance, export, and audit foundation
- Development Validation Log append-only task lifecycle, validation, owner review, Git evidence, defect/risk/follow-up, export, and audit foundation
- Historical Pattern Library append-only historical-event, regime, asset-reaction, reusable-pattern, amendment, review, supersession, export, and audit foundation
- Historical Analogy Engine deterministic current-situation comparison, scoring, ranking, bias, review, export, and audit foundation
- Event Replay Architecture deterministic timeline, checkpoint, replay-session, review, export, and audit foundation
- Python-TypeScript Integration Boundary versioned local read-only foundation
- Unified Validation Reporting foundation
- Historical Evidence Product Surface read-only aggregation foundation
- Cross-System Evidence Linking read-only resolution foundation

Day 5 Milestone Status:

- Day 5 is complete through the owner-approved and pushed Development Validation Log foundation.
- The five Day 5 learning-infrastructure foundations are Prediction Log, Alpha Journal, Research Lab, Strategy Versioning, and Development Validation Log.
- The Day 5 closeout validation baseline was 648/648 TypeScript tests, including 333 AI Infrastructure tests and 273 Day 5 learning-infrastructure tests.

Day 6 Milestone Status:

- D6-T1, the Development Efficiency Standard v1 documentation milestone, is complete.
- D6-T1 centralized repeated Codex workflow rules, context-loading policy, task template, owner review template, and deterministic validation-bundle guidance.
- D6-T1 does not modify Alpha business logic, Python or TypeScript runtime behavior, provider integration, network/API code, credentials, runtime data, or capital-control boundaries.
- D6-T2 is complete and pushed as the architecture-only Production Persistence and Recovery foundation.
- D6-T2 documents future durable persistence, transaction, recovery, backup, restore, retention, integrity, and development-vs-production boundaries without implementing production persistence.
- D6-T3 Historical Pattern Library is complete, committed, and pushed as `9358c9fc5d6350cfcddc385806738a7ce8235abb`.
- D6-T4 Historical Analogy Engine is complete, committed, and pushed as `95a634ad097a96527a0eef7f8984014dac4ed160`.
- D6-T4 separates similarity, difference, completeness, evidence quality, and candidate quality; produces no prediction or trading recommendation; and adds no AI scoring, embeddings, vector database, Event Replay, live data, provider, network, broker, or Python behavior.
- D6-T5 Event Replay Architecture is complete, committed, and pushed as `cf37492431e4bf32f53b9bfe4e1ba6b742648984`.
- D6-T5 preserves caller-supplied timelines, observation windows, immutable checkpoints, replay sessions, evidence references, missing-data state, completeness, confidence, limitations, export, and audit translation without backtesting, prediction, execution simulation, live-market data, provider, network, broker, or Python behavior.
- Current aggregate validation is 827/827 TypeScript tests, including 68/68 focused Historical Pattern Library tests, 91/91 focused Historical Analogy Engine tests, and 20/20 focused Event Replay tests.
- Day 6 is complete.

Day 7 Milestone Status:

- D7-T1 delivered the versioned typed local Python-TypeScript read boundary and one registered read-only Risk Engine operation.
- D7-T2 delivered unified validation reporting over existing validators without changing their business behavior.
- D7-T3 delivered the read-only Historical Evidence Product Surface over existing historical repositories.
- D7-T4 delivered explicit, deterministic, version-aware Cross-System Evidence Linking across Prediction, Strategy Version, Historical Evidence, Event Replay, Prediction Outcome, and Journal records.
- Day 7 is complete and pushed through `4033bce3a4b57e80a4cbcc82e575420e298aa50f`.
- The aggregate baseline is 876/876 TypeScript tests plus 11/11 focused Python integration tests.
- Day 7 added no dashboard integration, mutable cross-runtime operation, provider or network/API integration, live market data, broker behavior, AI reasoning, automatic learning, production persistence, or capital-domain behavior change.

## Day 8 — Deterministic Intelligence Layer Foundations (In Progress)

Day 8 begins from explicit evidence links and existing immutable records. It is a small, staged learning/evaluation phase, not a new recommendation platform, memory database, or automation milestone. See [Architecture Checkpoint 1](ARCHITECTURE_CHECKPOINT_1.md) for the full capability analysis and model strategy.

1. **D8-T1 — Evidence Assessment Foundation**
   - Status: completed, committed, and pushed as `d5aeff9e24b2c2e237c2e6bd94379dc8e36ee719` with the “No Evidence, No Decision” gate.
   - Depends on Day 7 evidence links and product surface.
   - Produces deterministic completeness, provenance, availability, version-consistency, and limitation assessment from explicit links only.
   - Exit criteria: source authority preserved; no recommendation/ranking; unresolved evidence remains explicit; only `SUFFICIENT` required evidence may reach downstream decision evaluation; focused tests pass.

2. **D8-T2 — Strategy Review Foundation**
   - Status: completed, committed, and pushed as `553d0e2946cd305e999bf8d7fbaec387381ed592`.
   - Consumes one explicitly completed prediction/plan/execution/outcome cycle, Evidence Assessment, risk findings, replay state, and explicit strategy-version references.
   - Preserves prediction quality, execution quality, risk discipline, and realized profitability independently; excludes aggregate scoring, ranking, learning approval, strategy mutation, and production outcome authority.
   - Exit criteria: active or incomplete cycles fail closed; profitability cannot hide prediction, execution, or risk failures; provenance and focused tests are complete.

3. **D8-T3A — Knowledge Approval Layer Architecture**
   - Status: completed, committed, and pushed as `83bd3d598ca949f9d9829f0ea03f493eef288ea9`.
   - Defines facts, interpretations, Candidate Knowledge, deterministic approval eligibility, owner decisions, Approved Knowledge, supersession/deprecation/revocation, and the separate Strategy Change Proposal boundary.
   - Excludes runtime contracts, repositories, AI calls, persistence, strategy mutation, and a general-purpose memory database.
   - Exit criteria: “No Strategy Change Without Approved Knowledge” is authoritative; source ownership and fail-closed rules are explicit; documentation validation passes; owner approves the architecture.

4. **D8-T3B — Minimal Knowledge Approval Foundation**
   - Status: completed, committed, and pushed as `a44fb34d489111b389a758a4a489ebcd6702ef60`.
   - Combines typed candidate/decision/approved-knowledge contracts, deterministic policy guards, owner-only approval, append-only lifecycle, an in-memory repository/current read model, and Unified Audit translation.
   - Excludes Strategy Change Proposal implementation, AI review adapters, production persistence, broad retrieval, dashboard work, and automatic learning.
   - Exit criteria: completed and `SUFFICIENT` review evidence is required; blockers fail closed; approval is owner-only; knowledge cannot mutate strategy; focused tests and strict typecheck pass.

5. **D8-T4 — Intelligence Layer Milestone Review**
   - Build now after D8-T3B as a short documentation/validation closeout.
   - Reconciles architecture, decisions, roadmap, handoff, test baseline, production limitations, and backlog.
   - No standalone review engine is created.

The separate Strategy Change Proposal workflow remains backlog and must not delay Phase 1 API or Paper Trading. A separate Candidate-only task, Approval Workflow task, and Approved Knowledge Store task are not planned; the cohesive minimum belongs in D8-T3B.

Day 8 foundations are not production ready. Production persistence, transaction/recovery, privacy/retention enforcement, dashboard integration, live data, providers, brokers, backtesting, and automation remain separately reviewed work.

## Day 9 — Provider-Independent Market Boundary (In Progress)

1. **D9-T1 — Market Data Layer Foundation**
   - Status: completed, committed, and pushed as `52b292748cfac4af63d164b804bff084439b176e`.
   - Scope: canonical instrument and latest-quote contracts, explicit provider capabilities, opaque raw adapter boundary, fixed-decimal values, deterministic normalization/validation, provenance, quality states, and one read-only service.
   - Excludes: live providers, credentials, network/API calls, trades/bars/streaming, persistence, automatic fallback, Evidence/Replay wiring, Paper Trading, Dashboard, recommendation, broker, or execution behavior.
   - Exit criteria: provider schemas remain isolated; invalid, stale, incomplete, unsupported, unavailable, out-of-order, and conflicting data fail closed; focused tests and strict typecheck pass.

2. **D9-T2 — Provider Registry Foundation**
   - Status: implemented locally and validated; pending owner review, commit, and push.
   - Scope: canonical provider metadata, explicit lifecycle/default enablement, bounded capabilities and asset classes, deterministic immutable discovery, strict lookup/gates, validation, and documentation.
   - Excludes: provider records based on guesses, adapter instantiation, runtime reflection/registration, network/API code, credentials, selection, dynamic ranking, fallback, Paper Trading, or domain integration.
   - Exit criteria: duplicate/malformed registrations fail explicitly; ID/capability/asset queries are deterministic and immutable; disabled or unsupported requirements fail closed; focused tests and strict typecheck pass.

The Prediction Log local foundation now preserves deterministic immutable forecasts, append-only lifecycle history, outcomes, and reviews. Production durability, cross-record transactions, signing, and integration with later business systems remain future work.

The Alpha Journal local foundation now preserves deterministic point-in-time context, rationale, reflection, amendments, and lessons without replacing Prediction Log or other source records.

The Research Lab local foundation now preserves structured evidence, sources, assumptions, conclusions, reviews, and supersession without replacing Prediction Log, Alpha Journal, or Unified Audit.

The Strategy Versioning local foundation now preserves immutable strategy lineage, explicit change evidence, deterministic comparisons, owner-controlled lifecycle authority, active-version trade-plan freezing, and rollback through a new version. It does not execute trades or mutate other business systems.

The Development Validation Log local foundation now preserves detailed engineering-task, validation, review, Git-reference, defect, risk, warning, lesson, and follow-up evidence without replacing Git, Unified Audit, HANDOFF, CHANGELOG, Alpha Journal, or issue tracking. Its owner-approved implementation was pushed as `cc9fb3fb47b467764ee9227993e77047a5c1a11d`, completing the Day 5 implementation milestone.

---

# Phase 3 — Decision Intelligence Implementation

Planned Features:

- Instrument Ranking Engine implementation
- Decision record storage
- Event Contract Engine
- Trade Planning Engine
- Profit-Taking Engine
- Position Sizing
- Daily Goal System
- Dashboard integration

---

# Phase 4 — Learning System Implementation

Planned Features:

- Trade Outcome Log implementation
- Knowledge Approval product integration and production hardening
- Strategy Versioning product integration and production hardening
- Performance Analysis
- Research Lab product integration and production hardening

---

# Phase 5 — Long-Term Investing

Planned Features:

- Stock Watchlist
- Portfolio Allocation
- Dividend Tracking
- Capital Growth Dashboard

---

# Phase 6 — Automation

Planned Features:

- AI Router Optimization
- Production-grade transactional AI reservation, ledger, audit persistence, and provider-billing reconciliation
- Reviewed production provider adapters and durable, crash-recoverable runtime workflow execution
- Broker Integration
- Market Data Integration
- Mobile Dashboard

---

# Backlog

- Historical Analogy Engine product integration and production hardening
- Strategy Validation Lab
- Catalyst Calendar
- Relative Strength Engine
- Sector Rotation Engine
- Event Replay product integration and production hardening
- Knowledge Retrieval Policy / Read Model after a concrete consumer and production persistence/privacy review
- Strategy Change Proposal workflow after a concrete consumer and durable evidence requirements are approved
- Price Timeline Database
- Backtesting and reviewed-learning expansion
- Production provider adapters
- Production database and transactional outbox architecture
- Live market-data integrations

---

# Long-Term Vision

Alpha becomes a complete Personal Capital Operating System that helps its owner:

- Protect Capital
- Allocate Capital
- Grow Capital
- Compound Capital

through disciplined decision making and continuous improvement.
