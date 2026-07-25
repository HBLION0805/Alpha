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
   - Status: owner approved, committed, and pushed as `8f722fb1d527cf00a6b01ec74cbac28f1b56d9fd`.
   - Scope: prospectively frozen BTC 15-minute collection plans, exact sample-to-Research-Integrity binding, minimum sample/day/coverage/outcome-balance gates, one feature and integrity-policy lineage, and deterministic chronological train/calibration/final-test partitions with embargo gaps.
   - Excludes: model training, probability estimation, threshold selection, return claims, recommendation, expected value, sizing, live/provider access, persistence, broker, order, or execution.
   - Exit criteria: incomplete, post-selected, duplicated, imbalanced, policy-mixed, temporally overlapping, or integrity-blocked datasets fail closed; focused and complete validation pass; owner reviews before release.

5. **Day15-T3B2 — Frozen-Plan Shadow Dataset Assembly**
   - Status: owner approved, committed, and pushed as `3e03e698657dc532e89f088983fa331de8f81c2a`.
   - Scope: explicit frozen-plan event bindings, read-only Day15-T2 ledger snapshots, exact official settlement labels, eligible Day15-T3A audit binding, homogeneous feature versions, deterministic sample construction, and canonical Day15-T3B qualification input.
   - Excludes: automated collection, provider/network access, persistence, model or feature calculation, probability, return, recommendation, sizing, broker, order, or execution.
   - Exit criteria: missing, unsettled, duplicated, cutoff-mismatched, audit-mismatched, feature-mixed, or tampered inputs fail closed; focused and complete validation pass; owner reviews before release.

6. **Day15-T3B3 — Forward Shadow Collection Control**
   - Status: owner approved, committed, and pushed as `f3effb86c04a901df804de3cf79e1d9094736683`.
   - Scope: deterministic continuous BTC 15-minute plan creation before the first cutoff plus read-only per-event capture/settlement progress auditing against Day15-T2 histories.
   - Excludes: provider/network access, automatic collection, scheduling, persistence, sample selection, T3A audit creation, T3B qualification, model, probability, recommendation, sizing, broker, order, or execution.
   - Exit criteria: late or misaligned plans, rewritten identities, duplicate/tampered histories, missing observations, and unsettled outcomes remain explicit; focused and complete validation pass; owner reviews before release.

7. **Day15-T3B4 — Local Collection Operator Surface**
   - Status: owner approved, committed, and pushed as `95adef5849f5de67a471b720130fa6b7061f1847`.
   - Scope: explicit exclusive `freeze-plan` persistence plus verified, read-only `progress` inspection over one existing Day15-T2 ledger.
   - Excludes: network/provider access, automatic timing or collection, polling, scheduling, repair, sample selection, model, probability, recommendation, sizing, broker, order, or execution.
   - Exit criteria: artifact tampering, overwrite attempts, missing/corrupt ledgers, unsafe store identities, and invalid command options fail closed; focused and complete validation pass; owner reviews before release.

8. **Day15-T3B5 — Real Collection Source Architecture and Admission**
   - Status: owner approved, committed, and pushed as `adf28d24d454d533da8064732aeca381ba7cd0c2`.
   - Scope: source-authority classes, exact Robinhood-to-exchange market mapping, provider-neutral adapter requirements, credential isolation, bounded live-read gates, and staged release sequencing.
   - Excludes: provider SDK, credential, network call, private endpoint, browser/mobile automation, polling, scheduling, persistence, model, probability, recommendation, sizing, broker, order, or execution.
   - Exit criteria: cross-venue ambiguity fails closed; private Robinhood automation is prohibited; T3B6-T3B10 each retain separate implementation and owner-approval gates; complete validation passes.

9. **Day15-T3B6 — Provider-Neutral Event Contract Source Contracts**
   - Status: owner approved, committed, and pushed as `554274209df6f040a09ee7b7221cb8748a684c5d`.
   - Scope: deterministic provider/source capabilities, exact Robinhood-to-exchange identity and terms mappings, provenance chronology, immutable fingerprints, bounded snapshot metadata, and fixture-only admission.
   - Excludes: concrete provider, SDK, credential loading, network, live-read authorization, persistence, polling, scheduler, model, recommendation, broker, order, or execution.
   - Exit criteria: undeclared authority, ambiguous mapping, terms mismatch, stale/tampered lineage, invalid chronology, oversized inputs, and bounded-live use fail closed; focused and complete validation pass; owner reviews before release.

10. **Day15-T3B7 — First Exchange Fixture Adapter**
   - Status: official Robinhood mapping-evidence correction committed and pushed as `c9c4444775776dbd0eebfe757f07d4ff39949154`.
   - Scope: concrete fixture-only Kalshi provider, exact official `KXBTC15M-26JUL232045-45` market and `KXBTC15M` series validation, exact public Robinhood event evidence, content-addressed `CRYPTO15M` terms, reviewed mapping, and fixture settlement snapshot.
   - Excludes: network, credential, transport, live-read authorization, persistence, polling, scheduler, T1/T2 mutation, probability, recommendation, sizing, broker, order, or execution.
   - Exit criteria: all three fixtures parse and normalize fail closed; platform and exchange identities, complete canonical terms, native labels, rules, terms link, and terms digest are retained; exact mapping and fixture snapshot pass focused and complete validation.

11. **Day15-T3B8 — Bounded Live-Read Smoke**
   - Status: committed and pushed as `e0fd00586c802a1e386fcb14f5a05f0d096ffe79`; the separately owner-authorized first request succeeded with one request, one record, zero retries, and zero writes.
   - Scope: one official Kalshi public endpoint, one exact mapped finalized market, one request, 100,000-byte and one-record bounds, injected HTTPS transport, zero credentials, zero persistence, sanitized errors, and an explicit manual command that defaults to a network-free dry run.
   - Excludes: Robinhood private endpoints or authenticated sessions, streaming, polling, retry, scheduling, automatic ledger mutation, quote relabeling, fee inference, model, recommendation, sizing, broker, order, or execution.
   - Exit criteria: exact policy authorization, dry-run isolation, transport allow-listing, strict T3B7 normalization, bounded-live source lineage, sanitized output, focused tests, and complete validation pass; owner reviews before any single live request is separately authorized.

12. **Day15-T3B9 — Collection Runner Architecture**
   - Status: owner approved, committed, and pushed as `a8d0fcdd22997e78b3038e44ad03267b35e97826`.
   - Scope: frozen-plan admission bundles, independent platform/exchange evidence lanes, pilot and task state machines, injected wall/monotonic clocks, single-worker leases, one bounded retry, transactional idempotency, SQLite pilot storage direction, crash recovery, sanitized monitoring, and emergency stop.
   - Excludes: runner implementation, dynamic discovery, automatic mapping approval, Robinhood private access, automatic platform quote/fee capture, backfill, raw-response persistence, multi-worker execution, model, recommendation, sizing, broker, order, or execution.
   - Exit criteria: authority, clock, cutoff, retry, lease, storage, recovery, monitoring, and platform-evidence gaps are explicit; T3B10 prerequisites remain separately gated; complete validation passes.

13. **Day15-T3B10 — Forward Collection Pilot**
   - Status: in progress through separately reviewed tasks; T3B10-T1 runner contracts and state validation are committed and pushed as `b1423fb9d1040febecbde518bf05094623c6f473`.
   - T3B10-T1 scope: immutable runner definitions, owner-approval evidence, exact admission bundles, scheduled tasks, deterministic idempotency, and compare-and-swap pilot/task transitions.
   - T3B10-T1 excludes: repository, SQLite, migration, scheduler, clocks, leases, retry execution, worker, adapter invocation, network, persistence, pilot activation, model, recommendation, sizing, broker, order, or execution.
   - T3B10-T2 status: completed, committed, and pushed as `3f25aaa9ccc3160de93b92e686fe1f562c22bf28`.
   - T3B10-T2 scope: strict local-pilot schema, migration checksums, named atomic transactions, claim/result evidence, durable lease representation, idempotency, outbox, crash recovery, backup, restore, and corruption-test requirements.
   - T3B10-T2 excludes: dependency selection, database/migration/repository implementation, scheduler, clocks, active leases, retry execution, worker, provider request, persistence, pilot activation, model, recommendation, sizing, broker, order, or execution.
   - T3B10-T3A status: completed, committed, and pushed as `3191639fe268b1830ecc1cd70298ef9430db2b4e`.
   - T3B10-T3A scope: Node 24.12+ runtime pin, no third-party SQLite package, traversal/symlink/file-identity controls, exact 14-table `STRICT` schema, forward-only migration verification, temporary network-free migration tests, and a Git-ignored future runtime path.
   - T3B10-T3A excludes: repository operations, application runtime store creation, scheduler, clocks, active leases, retry execution, worker, provider request, pilot activation, backup/restore tooling, model, recommendation, sizing, broker, order, or execution.
   - T3B10-T3B status: completed, committed, and pushed as `854d2f94021c59dde6974c53a81653864dfd3e29`.
   - T3B10-T3B scope: T2-T10 plus explicit T8B validation-state transition, exact authority/source binding, compare-and-swap versions, durable lease and attempt claims, bounded retry, atomic normalized evidence/outbox commit, sanitized immutable reads, and 31 focused network-free tests.
   - T3B10-T3B excludes: application runtime store creation, scheduler, worker, timer, heartbeat/recovery loop, retry executor, provider request, real pilot activation, outbox publishing, backup/restore tooling, model, recommendation, sizing, broker, order, or execution.
   - T3B10-T3C status: completed, committed, and pushed as `47a7a45df7dd9ad03e996389aaa2cc8b394aa699`.
   - T3B10-T3C scope: immutable recovery reports, mutation blockers, owner-resume gating, invariant/counter checks, SQLite online backup, canonical digest-bound manifests, offline restore to a new path, and 11 focused network-free drills.
   - T3B10-T3C excludes: scheduler/worker operation, automatic lease resolution, retry execution, real pilot resume, provider requests, configured-store switching, backup retention deletion, repair, model, recommendation, broker, order, or execution.
   - T3B10-T4 status: completed, committed, and pushed as `bfe4751d39ae3d0a9e4c0bc70d6889198f9f0516`.
   - T3B10-T4 scope: immutable recovery assessments and owner decisions, deterministic dispositions, one-time process-session authorization, restore/resume separation, Emergency Stop precedence, race rules, and a separately gated T4A-T4D implementation sequence.
   - T3B10-T4 excludes: contracts, migration 002, repository transactions, operator commands, scheduler/worker operation, provider requests, real activation/resume, model, recommendation, broker, order, or execution.
   - T3B10-T4A status: completed, committed, and pushed as `12848f9621e6d9abf9477cdb5c24260b50351a97`.
   - T3B10-T4A scope: strict immutable recovery and stop-control contracts, deterministic recovery disposition, assessment verification, exact-owner decision/action validation, and Emergency Stop classification.
   - T3B10-T4A excludes: migration 002, database writes, repository transactions, owner commands, authenticated operator/session gates, scheduler/worker operation, provider requests, real activation/resume, model, recommendation, broker, order, or execution.
   - T3B10-T4B status: migration 002 and named recovery-control transactions implemented locally, tested, and pending owner review.
   - T3B10-T4B scope: exact 19-table schema v2, immutable recovery-control evidence, deterministic verification on write/read, one-time decision consumption, session-authorization persistence, Emergency Stop precedence, compare-and-swap stop/terminal transitions, and atomic receipt/outbox evidence.
   - T3B10-T4B excludes: owner commands, authenticated runtime session enforcement, ordinary repository unlock, scheduler/worker operation, provider requests, real activation/resume, model, recommendation, broker, order, or execution.
   - Intended scope: one owner-selected frozen plan, one active single-host runner, one admitted provider composition, fixed start/stop times, shadow-only evidence, and independent post-pilot review.
   - Blocker: no approved automatic Robinhood quote or fee-preview source exists, so an exchange-only pilot cannot claim complete T1 observations or dataset qualification.

14. **Day15-T3C — Baseline Probability Research**
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
