# TradingAgents Design Extraction

> Historical review: the retired product code referenced below is linked to the
> immutable pre-removal Git snapshot. Current scope is GLD/IBIT options; see
> [the deletion manifest](../OPTIONS_FOCUS_DELETION_MANIFEST.json).

Status: Phase 0.5 design review only

Alpha baseline: `1cdd76416a0036be30449882ef9565ec96e8a3ea`

Alpha branch: `codex/tradingagents-design-extraction`

Review date: 2026-07-29

## 1. Decision

Alpha should adopt selected **design patterns** from TradingAgents, but it
should not adopt TradingAgents as a runtime, dependency, execution engine, or
risk authority.

The useful extraction is:

- bind every advisory analysis to one verified, point-in-time market snapshot;
- make provider resolution explicit and auditable;
- exchange structured evidence packets rather than unbounded conversation;
- require a bounded bullish case and bearish challenge;
- route deep and quick model work through Alpha's deterministic AI Router;
- compare frozen forecasts with later outcomes and an appropriate benchmark;
- resume only from exact, identity-bound checkpoints.

The rejected extraction is:

- a second Python/LangGraph product runtime;
- LLM-controlled risk, position sizing, stop changes, portfolio changes, or
  execution;
- uncalibrated confidence presented as probability;
- automatic orders;
- Markdown as an authoritative journal or decision store;
- silent data-provider or model-provider fallback.

`AdvisoryResearchPacket` is therefore an evidence envelope only. It can inform
later deterministic evaluation, but it cannot decide a position, modify a
stop, expand a risk budget, override the unified Risk Authority, or authorize
capital action.

Phase 1 has not started and is not approved by this review.

## 2. Permanent Alpha mission and authority

This extraction preserves Alpha's permanent mission:

1. protect capital with explicit evidence, strict loss limits, and fail-closed
   decisions;
2. build operating capital through bounded short-term opportunities;
3. move only Owner-approved capital into long-term ownership of quality
   stocks;
4. compound long-term capital toward durable passive income and financial
   freedom.

Short-term activity remains a means, not the destination. AI remains advisory.
TypeScript remains Alpha's only product runtime. Python remains limited to
research, prototypes, and statistical validation.

The planned TypeScript Unified Short-Term Risk Authority remains the sole
future product authority for ETF and Event risk. Nothing in this report grants
that authority or implements the recorded Phase 0 risk defaults.

## 3. Research scope and official evidence

Only the two Owner-authorized official sources were accessed:

- [TradingAgents official repository](https://github.com/TauricResearch/TradingAgents)
- [TradingAgents official paper, arXiv:2412.20138](https://arxiv.org/abs/2412.20138)

Repository evidence was limited to official repository pages, including its
[README](https://github.com/TauricResearch/TradingAgents/blob/main/README.md),
[CHANGELOG](https://github.com/TauricResearch/TradingAgents/blob/main/CHANGELOG.md),
and [Apache-2.0 LICENSE](https://github.com/TauricResearch/TradingAgents/blob/main/LICENSE).

No TradingAgents dependency was installed. TradingAgents was not cloned or
run. No source was copied into Alpha. No account, Broker, order, or other
network API was used.

The paper describes specialized fundamental, sentiment, news, and technical
analysts; bullish and bearish researchers; a trader; risk-oriented agents; and
a fund manager. It emphasizes structured reports plus bounded debate, and it
evaluates generated trading actions in historical simulation. Alpha accepts
the evidence-organization ideas but rejects the paper's transfer of financial
authority to LLM agents.

The official repository has evolved materially beyond the paper. This review
uses the repository's current documented safeguards when evaluating data and
recovery patterns, while treating its advertised performance as research
evidence that is not transferable to Alpha.

## 4. Capability and disposition map

`Alpha status` describes the exact baseline implementation. `Disposition`
describes whether Alpha should extract the pattern.

| Capability or pattern | Alpha status | Disposition | Alpha interpretation |
| --- | --- | --- | --- |
| Canonical instrument, quote, and bar identity | `ALREADY_EXISTS` | `ACCEPT` | Preserve Alpha-owned identity, fixed decimals, time semantics, quality, fingerprints, and provenance. |
| Verified market snapshot | `PARTIALLY_EXISTS` | `ACCEPT` | Candidate Scan and market-data composition bind exact observations, but there is no complete Owner daily-use snapshot assembly path. |
| Personal Candidate Scan | `ALREADY_EXISTS` | `ACCEPT` | It is a deterministic structural filter, not a probability or trade recommendation. |
| Personal Market Data Composition | `ALREADY_EXISTS` | `ACCEPT` | It composes validated observations but does not retrieve or route data. |
| Explicit market-data provider chain | `PARTIALLY_EXISTS` | `ACCEPT` | Registry and adapter composition exist; complete reviewed routing for the personal MVP and benchmark scope does not. |
| Market Regime | `ALREADY_EXISTS` | `ACCEPT` | Deterministic foundation exists without current product wiring or an approved VIX source. |
| Broad Market Evidence | `ALREADY_EXISTS` | `ACCEPT` | Deterministic foundation exists; live benchmark assembly and Phase 1 benchmark policy remain blocked. |
| Evidence Fusion | `PARTIALLY_EXISTS` | `ACCEPT` | The engine exists but V1 accepts only Broad Market Evidence and has no Decision/Risk consumer wiring. |
| Structured analyst reports | `MISSING` | `ACCEPT` | Add one provider-neutral research packet contract later; do not create free-form agent state as authority. |
| Bull/bear challenge | `MISSING` | `DEFER` | Useful as bounded advisory contradiction discovery after Phase 1 evidence gates exist. |
| Deterministic deep/quick model routing | `ALREADY_EXISTS` | `ACCEPT` | AI Router plans eligible models and fallback deterministically; no production provider execution exists. |
| Production AI execution | `MISSING` | `DEFER` | It requires separate provider, durability, privacy, cost, and Owner review. It is not needed for Phase 1 scanning. |
| Prediction freeze and review | `ALREADY_EXISTS` | `ACCEPT` | Prediction Log preserves a forecast before outcome and separates accuracy from profitability. |
| Decision outcome reflection | `PARTIALLY_EXISTS` | `ACCEPT` | Prediction Log, Alpha Journal, Research Lab, and Strategy Review foundations exist; Trade Outcome Log and product composition remain incomplete. |
| Benchmark-relative evaluation | `PARTIALLY_EXISTS` | `ACCEPT` | Prediction outcomes allow a benchmark result, but benchmark identity, window, and calculation policy are not yet a complete product path. |
| Research workflow checkpoint/resume | `MISSING` | `DEFER` | Alpha has strong recovery patterns in the fixture Runner, but not an advisory-research workflow checkpoint contract. |
| Markdown decision memory | `MISSING` | `REJECT` | Alpha Journal and Prediction Log must remain structured, validated, append-only authority records. |
| LLM risk manager or portfolio manager | `MISSING` | `REJECT` | An LLM may describe risk evidence but can never be Risk Authority. |
| LLM trade sizing, stop adjustment, or order execution | `MISSING` | `REJECT` | These violate deterministic authority and current closed execution boundaries. |
| LangGraph product runtime | `MISSING` | `REJECT` | TypeScript remains the one product runtime; workflow ideas must be reimplemented behind Alpha contracts. |

## 5. Pattern extraction

### 5.1 Verified market snapshot

TradingAgents now documents deterministic company identity and a verified
market-data snapshot that grounds exact price and indicator statements. Its
recent changelog also records stale-OHLCV rejection.

Alpha should define `VerifiedMarketSnapshot` as a prerequisite reference, not
as a narrative assembled by a model. The snapshot should bind:

- canonical instrument identity;
- observation window and session/calendar identity;
- completed Canonical Bar IDs and fingerprints;
- Canonical Quote ID and fingerprint when a quote is required;
- observation, publication, availability, receipt, normalization, and
  evaluation times as applicable;
- quality and freshness decisions under a versioned policy;
- provider chain and data provenance;
- benchmark and volatility evidence required by the applicable use case.

Missing, stale, partial, identity-conflicting, future-dated, untraceable, or
provenance-free required observations must block the packet. The LLM must never
repair, infer, or refresh the snapshot.

For Phase 1, this pattern does not enlarge the existing candidate vocabulary.
ETF candidates remain only:

- `READY`;
- `WATCH_TRIGGER`;
- `EXCLUDED`.

The current internal contract uses `READY_FOR_DECISION`. Phase 1 should retain
that internal value to avoid an unnecessary contract migration and map it to
`READY` only in the Owner-facing product projection. It must not create a
fourth state. Any future formal rename of the internal enum requires a separate
migration that updates and validates every producer, consumer, persisted
representation, fixture, and test.

### 5.2 Explicit provider chain

TradingAgents 0.3.0 changed its configured vendor list into the exact
resolution chain and removed silent fallback to unselected vendors. Alpha
should preserve the same principle while keeping its stronger authority
separation:

- registry metadata declares provider capabilities;
- a versioned policy declares the exact ordered chain per capability and
  canonical instrument;
- every attempt records provider ID, capability, symbol mapping version,
  request fingerprint, observation time, result state, and reason;
- fallback occurs only when the recorded policy permits that exact next
  provider;
- fallback never upgrades lower-quality evidence or hides missing provenance;
- a provider change produces a new provenance record, never a rewritten
  snapshot.

Market-data fallback and AI-model fallback are separate policies. Neither may
be silent. `AdvisoryResearchPacket.data_provenance` must expose the sources
actually used.

### 5.3 Structured analyst reports

The paper identifies loss and corruption caused by long unstructured message
histories and uses structured reports for analyst-to-researcher communication.
The official repository later added typed structured output to major decision
agents.

Alpha should accept the structured boundary, not the agent hierarchy. Each
analyst contribution should be an allow-listed, schema-validated evidence
record with:

- explicit evidence references;
- claims separated from interpretation;
- contradictions and missing evidence;
- time and provenance;
- model, prompt, and policy versions when AI contributed;
- validation status.

Free-form prose may be attached for Owner readability, but it must never
replace the structured fields or source evidence.

### 5.4 Bull/bear challenge

A bounded bullish and bearish challenge can reduce one-sided reasoning. Alpha
should use it only after required deterministic evidence passes:

1. create an immutable evidence inventory;
2. construct a bullish case citing only that inventory;
3. construct a bearish case citing only that inventory;
4. identify direct contradictions and shared missing evidence;
5. validate that neither side introduced an unreferenced factual claim;
6. preserve both cases without asking an LLM to declare financial authority.

The goal is contradiction discovery, not synthetic consensus. Disagreement
cannot be averaged into confidence. Required unresolved contradictions block
downstream use.

### 5.5 Deep/quick model routing

TradingAgents separates deep-thinking and quick-thinking models by task
complexity. Alpha already has the more appropriate control plane:

- business modules submit provider-neutral task requirements;
- AI Router applies hard capability, privacy, reliability, context, deadline,
  structured-output, and budget gates;
- stable policy determines eligible primary and fallback routes;
- AI Cost Governor and audit foundations remain separate authorities.

Recommended use:

- deterministic code performs retrieval planning, calculations, identity,
  chronology, validation, and evidence gates;
- a quick eligible model may normalize or summarize already validated text
  when deterministic extraction is insufficient;
- a deep eligible model may draft the two-sided advisory synthesis;
- every result preserves provider, model, prompt, routing, and source
  fingerprints.

No model may select itself. No caller may directly name a provider model in a
business contract. A cheaper fallback may not weaken required reasoning,
privacy, provenance, or schema compliance.

### 5.6 Decision outcome reflection

TradingAgents documents a persistent decision log that later fetches realized
return and alpha versus a benchmark, then injects a reflection into a future
run.

Alpha should keep its stricter source ownership:

- Prediction Log freezes the forecast and evidence before the outcome;
- the future Trade Outcome Log owns execution and realized profitability;
- Alpha Journal owns context and reflection;
- Strategy Review evaluates one completed cycle;
- approved knowledge and Strategy Versioning govern any later rule change.

Reflection may propose a lesson, but it cannot rewrite the original packet,
prediction, trade, risk plan, or strategy. One outcome does not establish
approved knowledge.

### 5.7 Benchmark-relative evaluation

Benchmark-relative evaluation is useful only when the benchmark matches the
instrument, horizon, currency, and decision question.

- ETF intraday research should compare the analysis instrument with an
  Owner-approved broad and/or sector benchmark from `BENCHMARK_SCOPE`, using
  identical completed windows.
- A BTC 15-minute Event Contract should not use SPY alpha as its performance
  truth. It should later use calibration and decision-quality measures such as
  outcome accuracy, Brier/log loss where approved, quoted break-even
  probability, realized fee-inclusive hypothetical return, and an explicit
  no-action baseline.
- Long-term equity research should use a reviewed broad-market and, when
  appropriate, sector benchmark with currency, dividend, and evaluation-window
  semantics.

Benchmark results must be immutable outcome evidence. A favorable benchmark
comparison cannot hide violated risk, execution, or evidence gates.

### 5.8 Checkpoint/resume

TradingAgents added checkpoint resume and later corrected checkpoint identity
so a changed graph shape could not resume the wrong workflow.

Alpha should accept exact-binding recovery semantics without LangGraph:

- checkpoint identity binds packet ID, verified snapshot ID and fingerprint,
  instrument ID, workflow version, stage plan, enabled analyst set, prompt
  versions, Router decision, and policy versions;
- a resume validates the entire binding before any stage runs;
- completed immutable stages are not repeated;
- an in-flight external model call remains ambiguous unless a durable
  execution claim and provider idempotency evidence resolve it;
- changed workflow shape, instrument, snapshot, source policy, or prompt
  creates a new run and cannot resume the old one;
- Stop and Owner authority take precedence over resume.

This is a Phase 2/3 durability concern. It is not required to begin a
network-free Phase 1 scanner.

## 6. `AdvisoryResearchPacket` draft

This is a future design reference, not an implemented TypeScript contract.
Phase 1 must not implement it. A formal TypeScript contract may be designed
only in Phase 2/3 or later after an actual consumer is separately proposed and
approved.

```text
AdvisoryResearchPacket
  schema_version
  packet_id
  instrument_id
  market_snapshot_id
  as_of

  technical_evidence[]
  fundamental_evidence[]
  macro_news_evidence[]

  bullish_case
  bearish_case
  contradictions[]
  missing_evidence[]
  invalidation_conditions[]
  advisory_rating

  model_provider
  model_id
  prompt_version
  data_provenance[]
  validation_status
```

### 6.1 Field semantics

| Field | Required meaning |
| --- | --- |
| `schema_version` | Version of the packet contract and validator. |
| `packet_id` | Deterministic identity derived from declared immutable inputs, not model prose alone. |
| `instrument_id` | Alpha Canonical Instrument ID; never a display ticker or provider symbol. |
| `market_snapshot_id` | Exact verified snapshot identity. Absence or failed verification blocks the packet. |
| `as_of` | Evaluation cutoff. Every required source must prove availability no later than this instant. |
| `technical_evidence` | Typed references and bounded derived facts from completed canonical observations. |
| `fundamental_evidence` | Typed references to point-in-time filings/financial facts with publication and availability time. It may be policy-optional for intraday use, never silently fabricated. |
| `macro_news_evidence` | Typed macro/news references with event, publication, availability, receipt, and source authority. Required-but-missing evidence blocks use. |
| `bullish_case` | Structured claims whose every factual assertion cites packet evidence. |
| `bearish_case` | Independent structured challenge whose every factual assertion cites packet evidence. |
| `contradictions` | Explicit incompatible claims or evidence, with severity and affected requirement. |
| `missing_evidence` | Required and optional gaps kept separate, with reason and blocking state. |
| `invalidation_conditions` | Observable conditions that invalidate the research thesis; not mutable stop orders. |
| `advisory_rating` | Qualitative research state such as `BULLISH_LEAN`, `BEARISH_LEAN`, `BALANCED`, or `INSUFFICIENT_EVIDENCE`; never probability or permission. |
| `model_provider` | Provider identity selected by AI Router, or explicit `NOT_APPLICABLE` for a deterministic packet. |
| `model_id` | Exact routed model identity, or `NOT_APPLICABLE`. |
| `prompt_version` | Reviewed prompt/template identity; no unversioned prompt may produce a valid AI-assisted packet. |
| `data_provenance` | Provider/source, source record, canonical record, observation/publication/availability/receipt times, content fingerprint, and transformation version for every evidence item. |
| `validation_status` | At minimum `VALID`, `INVALID`, or `BLOCKED`; only deterministic validation may assign it. |

Recommended nested evidence references should carry an evidence ID, evidence
type, source authority, source record ID, canonical record ID when applicable,
content fingerprint, relevant timestamps, policy version, and quality state.
They should not embed provider-native payloads.

### 6.2 Non-authority invariants

The packet:

- provides evidence only;
- cannot determine or suggest position size;
- cannot create, loosen, move, or delete a stop;
- cannot increase a daily, weekly, drawdown, instrument, leverage, or theme
  risk limit;
- cannot override or impersonate the Unified Short-Term Risk Authority;
- cannot mutate Portfolio, capital-bucket, Decision, Trade, Strategy, Journal,
  Prediction, Broker, account, or order state;
- cannot convert advisory rating into calibrated probability;
- cannot convert `BLOCKED` or invalid evidence into a usable result.

Missing `VerifiedMarketSnapshot` or required provenance always fails closed.

### 6.3 Implementation timing and duplication gate

The draft must not become infrastructure merely because it may be useful
later. Before any formal TypeScript contract is approved, its actual consumer
must be identified and the design must demonstrate that it does not duplicate
or weaken:

- Evidence Fusion as the reviewed evidence-composition boundary;
- Broad Market Evidence as the broad benchmark evidence authority;
- Prediction Log as frozen forecast and outcome-review truth;
- Alpha Journal as context and reflection truth.

If those existing authorities can serve the approved consumer through a
narrow adapter or read model, Alpha should use that smaller design. No
`AdvisoryResearchPacket` contract, repository, workflow, or validator should
be developed for speculative future use.

## 7. Use-case boundaries

### 7.1 ETF intraday candidates

Phase 1 minimum flow:

```text
Canonical underlying bars + vehicle quote
  -> Verified Market Snapshot
  -> Personal Market Data Composition
  -> Personal Candidate Scan
  -> internal READY_FOR_DECISION / WATCH_TRIGGER / EXCLUDED
  -> product projection READY / WATCH_TRIGGER / EXCLUDED
  -> Owner-run read-only Daily Scan
```

The product projection maps internal `READY_FOR_DECISION` to displayed
`READY`; it does not add a state or change Candidate Scan authority. A future
Phase 2/3 packet may explain technical, macro/news, benchmark, bullish,
bearish, and invalidation evidence. It cannot promote `EXCLUDED`, turn
`WATCH_TRIGGER` into `READY`, select leverage, or supply
entry/stop/target/size authority.

Phase 1 still requires a separate Owner-approved design for the exact eleven
trade symbols and `BENCHMARK_SCOPE`, QQQ/SMH reads, a real VIX source or
explicit `BLOCKED` state, additional read-only request budgets, and
fail-closed macro evidence.

#### Evidence-gate levels

Macro fail-closed behavior must be policy- and use-case-specific so the absence
of ordinary macro news does not permanently disable Daily Scan:

- `STRUCTURAL_SCAN`: ordinary macro/news evidence may be `OPTIONAL` or
  `UNAVAILABLE`. Its missing state must remain visible, but absence alone does
  not block a scan based only on completed price structure, identity,
  freshness, provenance, and required market observations.
- `EVENT_SENSITIVE_SCAN`: a reviewed calendar of known FOMC, CPI, nonfarm
  payrolls, GDP, major earnings, and other policy-declared events is
  `REQUIRED`. Missing, stale, or untraceable required event-calendar evidence
  produces `BLOCKED`.
- `LEVERAGED_DECISION`: macro state, QQQ/SMH benchmark evidence, and volatility
  evidence must satisfy the exact Owner-approved policy. Missing any evidence
  declared required by that policy prevents a leveraged-instrument
  recommendation.

These levels do not authorize a recommendation. They define when a later
consumer may proceed to its next deterministic gate.

### 7.2 BTC 15-minute Event Contract

The packet may bind:

- exact BTC canonical snapshot and completed one-minute evidence;
- exact event window, target, operator, settlement source, and observation;
- UP/DOWN quotes, fee previews, and break-even arithmetic;
- macro/news evidence required by a versioned event policy;
- bullish and bearish outcome cases;
- contradictions, gaps, and thesis invalidation conditions.

It cannot provide a trade-authorized event probability. Until a prospective
dataset, leakage controls, temporal split, calibration method, and independent
evaluation are approved and passed, every probability-like output must be
marked `UNVALIDATED`. Advisory rating must not be converted into probability.

The packet cannot choose a side, cost amount, or order. The Event maximum cost
risk remains owned by the future unified Risk Authority.

### 7.3 Long-term quality-stock compounding research

The same envelope can later support long-term research with a different
versioned evidence policy:

- fundamentals become required and point-in-time;
- valuation assumptions and business-quality evidence remain explicit;
- sector, macro, competitive, governance, and capital-allocation evidence may
  be required;
- bullish and bearish cases emphasize multi-year thesis durability;
- invalidation conditions describe business-thesis failure rather than
  short-term price noise;
- benchmark-relative review uses matched long-term broad/sector benchmarks.

The packet remains research evidence. Portfolio allocation, capital-bucket
transfer, concentration limits, and purchase approval remain separate,
deterministic, and Owner-controlled.

## 8. Recent TradingAgents defects and Alpha prevention

The comparison below relies on the official repository changelog. It
distinguishes a documented TradingAgents fix from an Alpha design rule; it
does not claim the Alpha rule has complete product wiring.

| Area | Official TradingAgents evidence | Alpha design-stage prevention |
| --- | --- | --- |
| Look-ahead leakage | v0.2.3 fixed backtesting fetchers leaking future data when the analysis date fell inside a fetched window. v0.3.1 fixed an Alpha Vantage fundamentals path where a JSON-string payload bypassed a dict-only date filter and future reports entered historical runs. | Require occurrence, publication, supported availability, receipt, freeze, and decision-cutoff times; parse and validate before eligibility; require completed intervals; content-address frozen datasets; never let payload shape skip temporal checks. |
| Instrument identity | v0.3.0 added deterministic ticker-to-company resolution and a verified market snapshot; earlier behavior could analyze the wrong company or fabricate price levels. | Canonical Instrument ID is authority; display ticker and provider symbol are metadata; analysis instrument and trade vehicle are separate reviewed identities; every observation and packet must match exact canonical IDs and fingerprints. |
| Stale data | v0.3.0 added stale-OHLCV rejection and a verified data-access contract. | Canonical observations preserve freshness/quality and distinct timestamps; Candidate Scan, Broad Market Evidence, Market Regime, and Evidence Fusion fail closed under versioned age policies. |
| Provider routing | v0.3.0 made the configured vendor list the exact resolution chain with no silent fallback and added typed vendor errors. | Keep provider registry, capability composition, exact chain policy, attempt evidence, and quality validation separate. No provider is inferred, substituted, or silently retried. |
| Structured output | v0.2.4 introduced typed structured outputs for major decision agents. v0.3.0 then fixed provider-specific failures involving object-form tool choice, missing parsed results, and null-like optional prices. | Require provider-neutral strict schemas at the Alpha boundary, validate allow-listed fields after normalization, record schema capability in Router hard gates, and reject invalid output. Provider-specific repair belongs only inside an adapter and cannot change business meaning. |
| Checkpoint identity | v0.3.1 changed thread identity to include selected analysts, debate/risk depth, and asset mode so a different graph shape could not resume old state. | Bind any future research checkpoint to complete workflow shape, packet/snapshot/instrument identity, prompt/policy versions, and Owner/Stop state. Mismatch starts a new run or blocks; it never resumes approximately. |

Alpha should treat these fixes as evidence that source shape, identity, time,
routing, output schema, and recovery identity are first-class financial
correctness concerns, not implementation details.

## 9. Explicitly prohibited imports into Alpha

The following are rejected, not deferred:

1. LangGraph as a second product runtime.
2. A TradingAgents-style LLM risk team as Risk Authority.
3. Any uncalibrated confidence, rating, debate winner, or model vote presented
   as probability.
4. Automatic order placement or broker/account mutation.
5. Markdown files as authoritative Journal, Prediction, outcome, or strategy
   state.
6. Silent provider fallback, hidden data substitution, or unrecorded model
   fallback.
7. Agent-controlled position sizing, stop modification, risk-budget expansion,
   portfolio allocation, or capital-bucket transfer.
8. Copying TradingAgents Python orchestration into the TypeScript product
   runtime.

## 10. Recommended follow-up tasks

No task below is authorized by this review.

### Task 1 — Phase 1 must do

**Verified Market Snapshot and Explicit Provider Resolution Minimum Design**

After the separate benchmark/network prerequisite is Owner-approved, Phase 1
may define only:

- the minimum `VerifiedMarketSnapshot` contract;
- its strict snapshot validator;
- explicit provider resolution and attempt trace;
- freshness, identity, provenance, and completed-window gates;
- composition into the existing Personal Market Data Composition;
- composition into the existing Personal Candidate Scan;
- an Owner-run read-only Daily Scan output.

The Daily Scan preserves internal `READY_FOR_DECISION` and projects it as
Owner-facing `READY`, alongside `WATCH_TRIGGER` and `EXCLUDED`. Phase 1 must
not implement a formal `AdvisoryResearchPacket` TypeScript contract, AI calls,
Bull/Bear agents, a research workflow, Prediction or reflection extensions, or
new infrastructure without an approved current consumer. It also contains no
probability, risk, sizing, Broker, Paper Trading, or order behavior.

### Task 2 — Phase 2/3 or later

**AdvisoryResearchPacket Contract Review, Provider-neutral Two-sided Research,
and Outcome Reflection**

Only after an actual consumer is separately approved, review whether a formal
`AdvisoryResearchPacket` contract is necessary and prove that it does not
duplicate Evidence Fusion, Broad Market Evidence, Prediction Log, or Alpha
Journal. If justified, add bounded provider-neutral bullish/bearish advisory
synthesis through the existing AI Router, strict structured-output validation,
Prediction Log freeze, benchmark-relative outcome evidence, Alpha Journal
reflection, and Strategy Review linkage. Production provider execution,
durable claims, cost settlement, privacy, calibration, and checkpoint/resume
require their own approval gates.

### Task 3 — explicitly reject

**TradingAgents Runtime or Autonomous Trading Port**

Do not add LangGraph, copy the Python agent graph, introduce an LLM portfolio
or risk manager, use Markdown memory as authority, or connect model output to
automatic sizing, stops, orders, Broker accounts, or capital transfers.

## 11. Apache-2.0 boundary

The TradingAgents repository is licensed under Apache License 2.0. If Alpha
were to copy or derive and distribute TradingAgents code, the redistribution
conditions would include providing the license, marking modified files,
retaining applicable copyright/patent/trademark/attribution notices, and
carrying applicable `NOTICE` attribution if the upstream work includes such a
file. Apache-2.0 also includes a patent grant and does not grant general
trademark rights.

This report is an engineering summary, not legal advice.

The preferred Alpha approach is independent TypeScript reimplementation of
general architectural ideas against Alpha's own contracts, tests, names,
authority model, and failure rules. That reduces licensing and provenance
complexity, avoids copying Python/LangGraph behavior, and preserves the single
TypeScript product runtime. Any future proposed source reuse must receive a
separate code-provenance and license review before implementation.

## 12. Known limits of this extraction

- TradingAgents was not executed, so this review does not independently verify
  its runtime behavior or performance claims.
- The paper's historical simulation covers a different universe, horizon,
  architecture, and authority model. Its results do not establish expected
  Alpha returns.
- The repository explicitly states that LLM runs and live text sources can be
  nondeterministic. Alpha must not treat one run as reproducible market truth.
- Alpha has no production AI provider adapter, no daily Owner product entry,
  and no unified product Risk Authority implementation.
- Phase 1 benchmark scope, QQQ/SMH reads, VIX authority, macro fail-closed
  policy, and additional network budget remain blocked.
- This review adds no contract, validator, runtime, network, model, Dashboard,
  Broker, Paper Trading, order, execution, or commercial behavior.

## 13. Key Alpha paths reviewed

Governance and current state:

- [AGENTS.md](../../AGENTS.md)
- [README.md](../../README.md)
- [Core Principles](../CORE_PRINCIPLES.md)
- [Architecture](../ARCHITECTURE.md)
- [Roadmap](../ROADMAP.md)
- [Handoff](../HANDOFF.md)
- [Machine-readable current status](../status/current.json)

Personal scanning and market evidence:

- [Personal Candidate Scan specification](../specifications/PERSONAL_CANDIDATE_SCAN.md)
- [Personal Candidate Scan contract](https://github.com/HBLION0805/Alpha/blob/53a905a5f8360afeea1d24eaa084110f6ef85bdc/src/contracts/PersonalCandidateScan.ts)
- [Personal Candidate Scan engine](https://github.com/HBLION0805/Alpha/blob/53a905a5f8360afeea1d24eaa084110f6ef85bdc/src/engines/personal-candidate-scan/PersonalCandidateScanEngine.ts)
- [Personal Market Data Composition specification](../specifications/PERSONAL_MARKET_DATA_COMPOSITION.md)
- [Personal Market Data Composition contract](https://github.com/HBLION0805/Alpha/blob/53a905a5f8360afeea1d24eaa084110f6ef85bdc/src/contracts/PersonalMarketDataComposition.ts)
- [Personal Market Data Composition engine](https://github.com/HBLION0805/Alpha/blob/53a905a5f8360afeea1d24eaa084110f6ef85bdc/src/engines/personal-market-data-composition/PersonalMarketDataCompositionEngine.ts)
- [Market Regime specification](../specifications/MARKET_REGIME_ENGINE.md)
- [Market Regime contract](../../src/contracts/MarketRegime.ts)
- [Market Regime engine](../../src/engines/market-regime/MarketRegimeEngine.ts)
- [Broad Market Evidence specification](../specifications/BROAD_MARKET_EVIDENCE.md)
- [Broad Market Evidence contract](../../src/contracts/BroadMarketEvidence.ts)
- [Broad Market Evidence engine](../../src/engines/broad-market-evidence/BroadMarketEvidenceEngine.ts)
- [Evidence Fusion specification](../specifications/EVIDENCE_FUSION.md)
- [Evidence Fusion contract](../../src/contracts/EvidenceFusion.ts)
- [Evidence Fusion engine](../../src/engines/evidence-fusion/EvidenceFusionEngine.ts)

Advisory, learning, and risk boundaries:

- [AI Router specification](../AI_ROUTER_SPECIFICATION.md)
- [AI Router configuration contract](../../src/contracts/AIRouterConfig.ts)
- [AI Router engine](../../src/engines/ai-router/AIRouterEngine.ts)
- [Prediction Log specification](../PREDICTION_LOG_SPECIFICATION.md)
- [Prediction contract](../../src/contracts/PredictionRecord.ts)
- [Prediction Log engine](../../src/engines/prediction-log/PredictionLog.ts)
- [Alpha Journal specification](../ALPHA_JOURNAL_SPECIFICATION.md)
- [Alpha Journal contract](../../src/contracts/AlphaJournal.ts)
- [Alpha Journal engine](../../src/engines/alpha-journal/AlphaJournal.ts)
- [Personal Decision contract](https://github.com/HBLION0805/Alpha/blob/53a905a5f8360afeea1d24eaa084110f6ef85bdc/src/contracts/PersonalDecision.ts)
- [Capital Allocation contract](../../src/contracts/CapitalAllocation.ts)
- [Python prototype Risk Engine](https://github.com/HBLION0805/Alpha/blob/53a905a5f8360afeea1d24eaa084110f6ef85bdc/app/risk_engine.py)

## 14. Final boundary statement

TradingAgents demonstrates useful research-organization patterns and also
documents concrete correctness failures that Alpha should prevent before
product wiring. Alpha's advantage is not a larger cast of agents. It is the
combination of verified evidence, canonical identity, explicit time and
provenance, deterministic validation, one Risk Authority, immutable outcome
review, and Owner-controlled capital.

The accepted endpoint of this extraction is a future evidence-only
`AdvisoryResearchPacket`. It is not a signal, probability, trade plan, risk
decision, or execution instruction.
