# Architecture Checkpoint 1 — Roadmap v2 Reconciliation

Date: 2026-07-19
Baseline: `4033bce3a4b57e80a4cbcc82e575420e298aa50f`
Status: Approved planning direction; no Day 8 runtime implementation is included.

## Purpose

Day 7 completed the narrow Python-TypeScript read boundary, unified validation reporting, a Historical Evidence Product Surface, and Cross-System Evidence Linking. This checkpoint decides what should follow those foundations without creating a speculative intelligence platform.

The recommended next phase is a deterministic **Intelligence Layer foundation**: evidence assessment, strategy evaluation, and reviewed learning proposals. It is not an AI decision engine, a memory database, automated strategy optimization, or capital-execution work.

## Verified Starting Point

Implemented source authorities remain separate:

- Prediction Log owns immutable forecasts, outcomes, and reviews.
- Strategy Versioning owns immutable strategy lineage, validations, approvals, activations, comparisons, and recorded performance evidence.
- Alpha Journal owns context, reflection, review, and lessons.
- Research Lab owns structured research evidence and interpretation.
- Historical Pattern Library owns historical events and reusable patterns.
- Historical Analogy Engine owns deterministic comparison records, not forecasts.
- Event Replay owns deterministic historical-evidence reconstruction.
- Historical Evidence Product Surface and Cross-System Evidence Linking are read-only consumers; neither owns source records.
- Unified Audit owns normalized subsystem trace evidence; production persistence remains specified, not implemented.

The Day 7 aggregate baseline is 876/876 deterministic tests plus 11/11 focused Python integration tests. Local NDJSON is single-owner development persistence, not a production transaction, recovery, or memory platform.

## Capability Decisions

### A. Evidence Engine → Evidence Assessment Foundation

| Item | Decision |
| --- | --- |
| Problem solved | Product consumers need a transparent view of explicit linked evidence without traversing repository internals or treating raw links as a recommendation. |
| Expected value | Makes evidence completeness, availability, version consistency, provenance, limitations, and declared source confidence reviewable before a decision consumer uses it. |
| Deterministic responsibilities | Consume only explicit cross-system links; resolve through read ports; calculate declared completeness and quality indicators with published rules; preserve source versions, limitations, and unresolved states; fail closed on incomplete required evidence. |
| Appropriate AI role | Optional drafting or summarizing of already-resolved evidence for owner review only. AI cannot create links, alter metrics, infer relevance, approve evidence, or produce a decision. |
| Inputs and dependencies | Cross-System Evidence Linking, Historical Evidence Product Surface, Prediction Log, Strategy Versioning, Historical Pattern/Analogy, Event Replay, Research Lab, and Journal read ports. |
| Outputs | A read-only assessment with source references, deterministic metric components, missing/unavailable evidence, limitations, and no recommendation field. |
| Source of truth | Existing domain repositories; the assessment is a derived view only. |
| Cost | Medium implementation cost; low operating cost because it is local deterministic computation with no provider, network, or persistence dependency. |
| Risks | False confidence if heterogeneous source confidence is blended; scope must prohibit a hidden composite recommendation score. |
| Decision | Build now as D8-T1. Rename from “Evidence Engine” to **Evidence Assessment Foundation** to avoid implying ownership or opaque reasoning. |

### B. Strategy Evaluation Engine → Strategy Performance Evaluation Foundation

| Item | Decision |
| --- | --- |
| Problem solved | Strategy Versioning stores validations, comparisons, and performance evidence but does not yet deterministically evaluate completed prediction evidence into a bounded, comparable version assessment. |
| Expected value | Supplies honest version-level evidence for owner review while keeping prediction quality distinct from trade profitability and preventing rankings from incomplete samples. |
| Deterministic responsibilities | Join completed Prediction Log outcomes/reviews to explicit frozen strategy-version references; calculate published counts, coverage, accuracy classifications, and sample-completeness gates; report non-comparability rather than rank insufficient samples. |
| Appropriate AI role | Optional explanation draft after deterministic results exist. AI cannot choose metrics, rank incomplete samples, change a strategy, approve a version, or infer trade profitability. |
| Inputs and dependencies | D8-T1 assessment output; Prediction Log outcomes/reviews; Strategy Versioning records and validation/performance references; explicit link resolution. A future Trade Outcome Log is required before profitability or execution-quality assessment. |
| Outputs | Read-only strategy-version evaluation report, comparability state, metric provenance, limitations, and an explicit `NOT_EVALUABLE`/incomplete state where evidence is insufficient. |
| Source of truth | Prediction Log for forecast/outcome truth; Strategy Versioning for version truth. The evaluator owns no strategy state. |
| Cost | Medium implementation cost; low operating cost. |
| Risks | Selection bias, sample-size overclaiming, and accidental conflation of prediction accuracy with trading profitability. |
| Decision | Build now as D8-T2 after D8-T1. Rename from “Strategy Evaluation Engine” to **Strategy Performance Evaluation Foundation** to make the narrow scope explicit. |

### C. Learning Engine Foundation → Reviewed Learning Proposal Foundation

| Item | Decision |
| --- | --- |
| Problem solved | Completed outcomes, journal reviews, and version assessments need a controlled path to proposed lessons without rewriting evidence or changing active strategies. |
| Expected value | Establishes an auditable human-review boundary for learning before any future strategy change. |
| Deterministic responsibilities | Require completed source records; preserve fact, derived metric, inference, and proposed lesson as distinct fields; create reviewable proposals; enforce no learning during frozen trade execution; require a new Strategy Versioning proposal and owner approval for any strategy change. |
| Appropriate AI role | AI may draft a candidate explanation or lesson from supplied completed evidence, marked advisory and review-required. It cannot accept a lesson, create an automatic rule, approve/activate a strategy, or learn from live/frozen execution. |
| Inputs and dependencies | D8-T2 evaluation report, Prediction Log reviews, Alpha Journal reviews/lessons, Research Lab evidence, Strategy Versioning, and explicit evidence links. Trade Outcome Log remains required for trading-profitability lessons. |
| Outputs | Append-only, review-required learning proposals with provenance, fact/inference separation, invalidation conditions, and optional strategy-change candidate references. |
| Source of truth | Source systems retain facts; Alpha Journal retains reflection; Strategy Versioning retains strategy changes. The workflow owns only proposed learning evidence. |
| Cost | Medium-to-high implementation cost because lifecycle, review, and provenance rules matter more than storage. Operating cost stays low until optional AI drafting is separately approved. |
| Risks | Hindsight bias, feedback loops, reactive strategy changes, and scope creep into automatic optimization. |
| Decision | Build now only as D8-T3 **Reviewed Learning Proposal Foundation**, after D8-T2. Do not build a broad autonomous “Learning Engine.” |

### D. Alpha Memory Foundation → Backlog as a Retrieval Policy, Not a Database

| Item | Decision |
| --- | --- |
| Problem solved | Future consumers may need a curated way to retrieve approved facts, rules, and lessons across existing authorities. |
| Expected value | Low immediate value: current Journal, Research Lab, Strategy Versioning, Historical Pattern Library, project documentation, and read-only evidence links already hold the relevant categories. |
| Deterministic responsibilities | Future work may define a read-only retrieval policy, freshness/version rules, and authority precedence. |
| Appropriate AI role | Optional retrieval-assisted summarization only after deterministic source selection and authorization rules exist. |
| Inputs and dependencies | Proven Day 8 use cases, production persistence/recovery decisions, privacy/retention rules, and owner-approved retrieval requirements. |
| Outputs | Future curated read model, never an unbounded fact store or competing authority. |
| Source of truth | Existing systems remain authoritative. |
| Cost | High design and migration risk; potentially material operating/privacy cost if generalized storage or AI retrieval is introduced. |
| Risks | Duplicating Journal, Research, Config, Strategy, Historical Pattern, documentation, and persistence authority; stale copies; unclear retention. |
| Decision | Do not build now. Rename the backlog item to **Knowledge Retrieval Policy / Read Model** and require a concrete consumer before any implementation. |

### E. Intelligence Layer Review → Merge into Milestone Review

| Item | Decision |
| --- | --- |
| Problem solved | Prevents a collection of new derived views from silently becoming a recommendation or automation layer. |
| Expected value | Maintains boundaries and identifies whether the next product integration is justified. |
| Deterministic responsibilities | Verify ownership, validation, provenance, no-op behavior for incomplete evidence, and absence of strategy/capital mutation. |
| Appropriate AI role | Architecture and review assistance only; no runtime role. |
| Inputs and dependencies | Completed D8-T1 through D8-T3 validation and owner review evidence. |
| Outputs | Documentation reconciliation, decision record, handoff, and backlog updates. |
| Source of truth | Architecture, decisions, Git history, and existing source systems. |
| Cost | Low; documentation and validation work. |
| Risks | A separate standing “review engine” would duplicate normal task and milestone review. |
| Decision | Do not create a standalone subsystem. Merge into D8-T4 **Intelligence Layer Milestone Review**. |

## Day 8 Recommended Sequence

### D8-T1 — Evidence Assessment Foundation

- Build now: yes; schedule as a weekend architecture/implementation task or two tightly scoped evening sessions.
- Scope: provider-neutral read-only assessment contract, fixed metric policy, source provenance, unresolved-state reporting, in-memory adapter tests, and documentation.
- Exclusions: recommendations, ranking, AI calls, fuzzy matching, persistence, dashboard wiring, Decision/Risk mutation, live data, and provider/network code.
- Prerequisites: completed Day 7 links and product surface; documented metric semantics; owner-approved task specification.
- Exit criteria: deterministic calculation components are inspectable; sources remain authoritative; incomplete evidence is explicit; focused dependency tests pass.
- Model: GPT-5.6 Sol, high reasoning for specification and final architecture review; GPT-5.6 Terra, medium reasoning for implementation.

### D8-T2 — Strategy Performance Evaluation Foundation

- Build now: yes, after D8-T1; schedule as a weekend task because sample comparability and metric semantics require careful review.
- Scope: deterministic evaluation of completed prediction outcomes/reviews against explicit strategy-version references; sample gates and non-comparable results.
- Exclusions: trade-profitability calculation, broker/trade data, backtesting, auto-ranking, strategy activation, AI optimization, and dashboard wiring.
- Prerequisites: D8-T1; explicit outcome-to-strategy links; approved minimum-sample and completeness policy.
- Exit criteria: prediction quality and profitability remain separate; incomplete samples never receive misleading rankings; source/version provenance is retained; focused tests pass.
- Model: GPT-5.6 Sol, high reasoning for metric policy; GPT-5.6 Terra, medium reasoning for implementation and tests.

### D8-T3 — Reviewed Learning Proposal Foundation

- Build now: yes, after D8-T2; schedule as one architecture session plus a bounded implementation session.
- Scope: immutable, review-required proposals derived from completed evidence; fact/inference separation; owner-reviewed handoff to Strategy Versioning only.
- Exclusions: automatic learning, strategy mutation, activation, learning during frozen execution, AI approval, trade-profitability conclusions without a Trade Outcome Log, and provider/network code.
- Prerequisites: D8-T2; explicit learning-proposal lifecycle; owner review policy.
- Exit criteria: every proposal is traceable to completed evidence; no proposal changes a strategy; owner approval remains outside the workflow; focused tests pass.
- Model: GPT-5.6 Sol, high reasoning for lifecycle/boundaries; GPT-5.6 Terra, medium reasoning for implementation and tests.

### D8-T4 — Intelligence Layer Milestone Review

- Build now: yes, after D8-T3; schedule as a short evening documentation and validation task.
- Scope: architecture/roadmap/decision/handoff reconciliation, dependency review, focused and milestone validation summary, and backlog review.
- Exclusions: new runtime behavior, dashboard work, automation, production infrastructure, and a standalone review engine.
- Prerequisites: D8-T1 through D8-T3 owner-approved work.
- Exit criteria: implemented versus planned boundaries are accurate; no new authority is implied; Day 9 direction is evidence-backed.
- Model: GPT-5.6 Sol, high reasoning for final integration review; GPT-5.6 Luna, medium reasoning for approved documentation and Git finalization.

## Backlog and Gates

- **Trade Outcome Log** remains a prerequisite before evaluating trading profitability, execution quality, or strategy return attribution.
- **Knowledge Retrieval Policy / Read Model** remains deferred until a concrete consumer, authority precedence, privacy/retention policy, and production-persistence plan exist.
- Dashboard integration is deferred until a read-only consumer has stable assessment contracts.
- Production persistence, external providers, live market data, broker integration, backtesting, and automation remain separate owner-reviewed work.

## Development Model Strategy

- GPT-5.6 Sol: core architecture, cross-system design, major system boundaries, metric/lifecycle policy, and final integration reviews.
- GPT-5.6 Terra: implementation, integrations, validation, Dashboard work, and most engineering tasks.
- GPT-5.6 Luna: documentation, Git operations, renaming, formatting, and routine small fixes.

Quality takes priority over token savings. Use stronger models only where they materially improve architecture, risk, or integration judgment. Task prompts should cite stable documents rather than regenerate unchanged context. Focused validation normally precedes milestone-wide validation.

## Foundation Completion vs Production Readiness

Day 8 foundations will be complete only when their contracts, deterministic behavior, tests, documentation, and owner-review boundaries are implemented. They are not production ready until durable persistence, transaction/recovery, privacy/retention enforcement, live-data and execution policies, and any required security review are separately completed.
