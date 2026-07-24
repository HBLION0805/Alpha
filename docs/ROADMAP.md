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

## Day 8 — Deterministic Intelligence Layer Foundations (Completed)

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
   - Status: milestone reconciled before Day 9 proceeded; no standalone review engine was created.
   - Reconciled architecture, decisions, roadmap direction, production limitations, and backlog through the subsequent market-domain checkpoint.

The separate Strategy Change Proposal workflow remains backlog and must not delay Phase 1 API or Paper Trading. A separate Candidate-only task, Approval Workflow task, and Approved Knowledge Store task are not planned; the cohesive minimum belongs in D8-T3B.

Day 8 foundations are not production ready. Production persistence, transaction/recovery, privacy/retention enforcement, dashboard integration, live data, providers, brokers, backtesting, and automation remain separately reviewed work.

## Day 9 — Canonical Market Domain (Completed)

1. **D9-T1 — Market Data Layer Foundation**
   - Status: completed, committed, and pushed as `52b292748cfac4af63d164b804bff084439b176e`.
   - Scope: canonical instrument and latest-quote contracts, explicit provider capabilities, opaque raw adapter boundary, fixed-decimal values, deterministic normalization/validation, provenance, quality states, and one read-only service.
   - Excludes: live providers, credentials, network/API calls, trades/bars/streaming, persistence, automatic fallback, Evidence/Replay wiring, Paper Trading, Dashboard, recommendation, broker, or execution behavior.
   - Exit criteria: provider schemas remain isolated; invalid, stale, incomplete, unsupported, unavailable, out-of-order, and conflicting data fail closed; focused tests and strict typecheck pass.

2. **D9-T2 — Provider Registry Foundation**
   - Status: completed, committed, and pushed as `79c4b1fb5f5b6cc7c9988f84df0479bcce87af27`.
   - Scope: canonical provider metadata, explicit lifecycle/default enablement, bounded capabilities and asset classes, deterministic immutable discovery, strict lookup/gates, validation, and documentation.
   - Excludes: provider records based on guesses, adapter instantiation, runtime reflection/registration, network/API code, credentials, selection, dynamic ranking, fallback, Paper Trading, or domain integration.
   - Exit criteria: duplicate/malformed registrations fail explicitly; ID/capability/asset queries are deterministic and immutable; disabled or unsupported requirements fail closed; focused tests and strict typecheck pass.

3. **D9-T3A and D9-T3 — Provider Selection Research and Canonical Instrument Foundation**
   - Status: completed, committed, and pushed as `c2cb8628ef6315da41e29a3974af7aa1c389ed6c`.
   - Scope: deterministic provider-evidence gates plus Alpha-owned immutable instrument identity, validation, serialization, equality, and resolver boundary.
   - Excludes: provider selection without official evidence, live symbol lookup, provider mapping records, network calls, credentials, quotes, bars, routing, or execution.

4. **D9-T4 — Canonical Quote Foundation**
   - Status: completed, committed, and pushed as `a114d98f87ab50e96e655409e55be057098a4328`.
   - Scope: Alpha's immutable provider-independent two-sided top-of-market Quote, fixed-decimal values, timestamps, provenance, quality, identity, fingerprint, equality, and validation.
   - Excludes: last-price substitution, provider adapter, network, streaming, order book, trade, bar, routing, broker, or execution behavior.

5. **D9-T5 — Canonical Bar Foundation**
   - Status: completed, committed, and pushed as `0551e2ee20f9ce80ad6608929ed98c49abce77a3`.
   - Scope: Alpha's immutable provider-independent OHLCV Bar, canonical intervals, half-open time boundaries, session/adjustment/quality/provenance metadata, deterministic identity and content fingerprint, equality, serialization, and validation.
   - Excludes: provider adapter, network, calendar, adjustment engine, resampling, streaming, persistence, backtesting, Paper Trading, broker, or execution behavior.

Day 9 is foundation-complete, not production-ready. It owns canonical market identities and records but has no live source, concrete transport, secret, storage, or downstream consumer integration. Day 10 later added a narrowly reviewed fixture mapping and adapter boundary without changing this production-readiness classification.

## Day 10 — External World Integration (Completed)

1. **Day10-T1 — Twelve Data Official Evidence and Bar Semantics Review**
   - Status: completed, committed, and pushed as `42027f4d8a234cc9fe3ffb41a72a288985061c21`; no adapter implementation.
   - Scope: current official-source register, constrained provider decision, deterministic Twelve Data intraday Bar normalization policy, minimal immutable Provider Symbol mapping policy, and explicit unresolved semantics.
   - Excludes: provider adapter, live request, credential, network code, public/commercial use, persistence, routing/fallback, streaming, Paper Trading, broker, or execution.
   - Exit criteria: official evidence is traceable; the decision is `APPROVED WITH CONSTRAINTS` or `NOT APPROVED`; unknown facts fail closed; documentation and complete registered validation pass.

2. **Day10-T2 — First Provider-specific Fixture Adapter Foundation**
   - Status: completed, committed, and pushed as `a61d253010e0c963917b1773f2e8d0d2a92ccb60`.
   - Scope: Twelve Data REST request contract, injected transport port, environment credential boundary, fixture parser/validator/normalizer, reviewed AAPL mapping, Canonical Bar integration, and provider-neutral Bar service path.
   - Excludes: concrete live transport, live request, Quote/Trade, streaming, polling, persistence, routing/fallback, Paper Trading, broker, or execution.

3. **Day10-T3B — Market Data Boundary Consolidation**
   - Status: completed, committed, and pushed as `e2e3370a5ab1ee123d1f6ab61fa43ca52c6aa94e`.
   - Scope: authoritative registry/adapter composition, multi-capability binding, Quote/Bar orchestrator separation, Bar-policy parity, observation fingerprint correction semantics, provider-native export cleanup, bounded live-smoke policy, and governance reconciliation.
   - Excludes: new providers, live network behavior, routing/fallback, persistence, downstream domain wiring, Paper Trading, broker, or execution.
   - Exit criteria: all D-class consolidation findings are corrected, the complete registered validation passes, and live-smoke blockers remain explicit.

## Day 11 — Bounded Live Verification and Market Context (Completed)

1. **Day11-T1 — Twelve Data Live Smoke Transport Foundation**
   - Status: completed, committed, and pushed as `b73387c2b9499db9c5b263d36fcc8b0d8790abda`; no real live request has been executed.
   - Scope: opaque environment credential handle, allow-listed one-request HTTPS transport, strict AAPL/PT5M policy, mandatory dry run, explicit confirmation command, sanitized result, network-free tests, and safety-scan controls.
   - Excludes: automatic live execution, retries, polling, scheduling, streaming, persistence, SPY, multi-symbol calls, Quotes/Trades, Evidence/Decision/Risk/Portfolio wiring, Paper Trading, broker, or execution.
   - Exit criteria: strict typecheck and registered validation pass; dry-run and all automated tests prove zero live calls; no secret is tracked; unresolved equity-volume units continue to block Canonical acceptance; owner reviews the milestone before separately authorizing one request.

2. **Day11-T2 — Market Regime Engine Architecture and Minimal Deterministic Foundation**
   - Status: completed, committed, and pushed as `f51b3251526535cb9f7255e01d3299d0587e1d99`.
   - Scope: immutable provider-independent regime snapshots, fixed-decimal price features, versioned policy thresholds, mutually exclusive primary regimes, independent evidence-gated conditions, explainable assessments, and Unified Audit translation.
   - Excludes: live/startup wiring, provider calls, AI, signals, recommendations, Risk/Decision/Portfolio mutation, volume/breadth invention, persistence, Dashboard, backtesting, Paper Trading, brokerage, or execution.
   - Exit criteria: missing or contradictory required evidence fails closed; correction remains distinct from bear trend; relief rally remains distinct from bull trend; high volatility can coexist with a primary regime; distribution/accumulation require verified volume and breadth evidence; focused and complete validation pass.

## Day 12 — Broad Market Evidence (Completed)

1. **Day12-T1 — Broad Market Evidence Foundation**
   - Status: completed, committed, and pushed as `35cf0398bd9633dc68063397cbc589edeb9f83c4`.
   - Scope: reviewed Canonical Instrument benchmark membership; immutable provider-independent snapshots; fixed-decimal return, drawdown, rebound, volatility, range, and recovery facts; deterministic cross-benchmark composition quality; provenance; and Unified Audit translation.
   - Excludes: live fetching, VIX/breadth/volume integration, regime behavior changes, signals, Decision/Risk/Portfolio wiring, persistence, replay, backtesting, Dashboard, Paper Trading, AI, broker, or execution.
   - Exit criteria: required and optional membership is explicit; malformed, stale, missing, insufficient, and contradictory evidence fails closed; output contains no regime or action result; focused and complete validation pass; owner reviews before release.

## Day 13 — Evidence Composition and Executable Prototype (Completed)

1. **Day13-T1 — Evidence Fusion Layer Foundation**
   - Status: completed, committed, and pushed as `7c670acd7a934ece5e6cbee844a9f5aa121c82d0`.
   - Scope: provider-neutral fusion input, explicit Broad Market Evidence adapter, versioned source policy, immutable assessment/snapshot, deterministic completeness/freshness/quality gates, provenance, and Unified Audit translation.
   - Excludes: additional evidence producers, Market Regime/Decision/Risk/Dashboard/Portfolio wiring, scoring, probability, AI, live data, provider access, persistence, replay, Paper Trading, brokerage, or execution.
   - Exit criteria: only complete/current compatible required evidence produces `READY`; all blockers remain explicit; no raw benchmark observations cross the boundary; focused and complete validation pass; owner reviews before release.

2. **Day13-T2 — Event Analyzer Console Prototype**
   - Status: completed, committed, and pushed as `5cfd0d2568e7216eaff99a8beb710fcd8c3aec48`.
   - Scope: one executable BTC 15-minute console workflow with fixed-decimal inputs, a versioned deterministic uncalibrated probability heuristic, contract-side fair value, market comparison, edge, prototype recommendation, and explicit risk explanation.
   - Excludes: production Decision/Risk/Fusion integration, calibrated probability, live/provider data, UI, API, AI, persistence, sizing, portfolio changes, Paper Trading, brokerage, orders, or execution.
   - Exit criteria: high probability alone cannot produce `BUY`; invalid input fails closed; prediction and profitability remain separate; output is immutable and non-authoritative; focused and complete validation pass; owner reviews before release.

3. **Day13-T3 — Deterministic One-minute Candle Feature Correction**
   - Status: completed with Day13-T2, committed, and pushed as `5cfd0d2568e7216eaff99a8beb710fcd8c3aec48`.
   - Scope: bounded local PT1M candle input, deterministic fixed-decimal features, richer momentum/reversal classification, bounded probability influence, legacy-evidence downgrade, and side-contradiction gates based on the reviewed failed UP test.
   - Excludes: screenshots/OCR, live fetching, provider/BRTI/Robinhood integration, calibrated models, Prediction Log, Decision/Risk/Portfolio wiring, persistence, polling, UI, brokerage, or execution.
   - Exit criteria: the bearish-reversal regression returns `NO_TRADE`; invalid/insufficient/legacy evidence fails closed; feature output is auditable and deterministic; complete validation passes; owner reviews before release.
   - Correction status: owner-review corrections bind completed candles to exact observation time, current price, instrument/event identity, bounded provenance, and safe fixed-decimal limits.

## Day 14 — Capital Allocation Architecture (Completed)

1. **Day14-T1 — Capital Allocation Framework v1.0**
   - Status: completed, committed, and pushed as `5cfd0d2568e7216eaff99a8beb710fcd8c3aec48`.
   - Scope: immutable provider-independent candidate/recommendation contracts, current Portfolio/Fusion/Regime/Risk read inputs, fail-closed construction, deterministic ordering/fingerprint, cash posture, avoid records, and explicit extension boundaries.
   - Excludes: Opportunity Ranking/scoring, calculated target weights, optimization, leverage, Decision or Portfolio runtime wiring, persistence, Dashboard, AI, provider/API access, brokerage, orders, or execution.
   - Exit criteria: evidence and Risk gates precede construction; candidates remain `UNRANKED`; output is immutable and non-executable; focused and complete validation pass; owner reviews before release.
   - Correction status: owner-review corrections enforce recursive declared fields, exact candidate-to-Fusion identity, Fusion/Regime-before-Risk ordering, and explicit constrained-risk semantics.

## Day 15 — Event Contract Evidence and Shadow Validation (In Progress)

1. **Day15-T1 — BTC Event Contract Observation**
   - Status: owner approved, committed, and pushed as `9b243e24a1d56aac127b12388ee3fb9e86982383`.
   - Scope: immutable BTC 15-minute contract terms, explicit settlement semantics, BRTI reference-price identity, exact UP/DOWN quotes, exact order-fee previews, evidence binding, fixed-decimal arithmetic, maximum profit, and fee-inclusive break-even probability.
   - Excludes: probability estimation, recommendation, expected value, sizing, live/provider access, credentials, OCR, persistence, Paper Trading, brokerage, orders, or execution.
   - Exit criteria: unknown and incomplete records fail closed; 15-minute chronology and freshness are exact; both sides and all evidence bind; preview arithmetic reconciles; focused and complete validation pass; owner reviews before release.

2. **Day15-T2 — Local Capture and Shadow Observation Ledger**
   - Status: owner approved, committed, and pushed as `52a62e1565709a1897225c8f455c8f1d73bd2115`.
   - Scope: owner-supplied JSON capture, canonical append-only local NDJSON observations, exact official-settlement binding, immutable query/history/summary surfaces, and fee-inclusive hypothetical UP/DOWN outcomes.
   - Excludes: probability estimation, recommendation, expected value, position sizing, live/provider access, credentials, OCR, Paper Trading, brokerage, orders, or execution.
   - Exit criteria: exact replay is idempotent; conflicts, duplicate settlement, invalid chronology/reference, unsafe path, and corrupt history fail closed; focused and complete validation pass; owner reviews before release.

3. **Day15-T3A — Research Integrity and Leakage Prevention**
   - Status: owner approved, committed, and pushed as `4c9ef2dfcecb8ce8623b4629df6f5a2d55d041f4`.
   - Scope: deterministic point-in-time occurrence/publication/availability/receipt rules, forward-versus-historical semantics, completed-interval enforcement, outcome-leakage blocking, and exact frozen dataset manifests.
   - Excludes: model training, calibration, probability, expected value, returns, recommendation, sizing, live data, persistence, broker, or execution behavior.
   - Exit criteria: future information, post-cutoff revisions, incomplete bars, outcome contamination, and dataset mismatch fail closed; focused and complete validation pass; owner reviews before release.

4. **Day15-T3B — Dataset Qualification and Temporal Split Design**
   - Status: implemented locally and pending owner review.
   - Scope: prospectively frozen BTC 15-minute collection plans, exact sample-to-Research-Integrity binding, minimum sample/day/coverage/outcome-balance gates, one feature and integrity-policy lineage, and deterministic chronological train/calibration/final-test partitions with embargo gaps.
   - Excludes: model training, probability estimation, threshold selection, return claims, recommendation, expected value, sizing, live/provider access, persistence, broker, order, or execution.
   - Exit criteria: incomplete, post-selected, duplicated, imbalanced, policy-mixed, temporally overlapping, or integrity-blocked datasets fail closed; focused and complete validation pass; owner reviews before release.

5. **Day15-T3C — Baseline Probability Research**
   - Status: planned only after Day15-T3B owner approval and a real dataset independently qualifies.
   - Intended scope: pre-declared baseline models and calibration diagnostics using the sealed temporal partitions; the final-test partition remains untouched until model and threshold choices are frozen.

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
