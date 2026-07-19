# Historical Pattern Library v1 Specification

Status: Foundation implementation in owner review
Version: 1.0
Date: 2026-07-19

## 1. Problem, Value, Cost, and Build-Now Decision

Alpha lacks an authoritative structured record of historical market events, their regimes, observed asset reactions, source evidence, and reusable patterns. Research can currently cite an unresolved historical-pattern reference, but no subsystem owns that historical truth.

The Historical Pattern Library improves research consistency, prevents unsupported analogies, reduces repeated manual historical work, and creates stable evidence for Research Lab, future regime analysis, a future Historical Analogy Engine, and later Event Replay or backtesting references.

The implementation cost is moderate foundation work using Alpha's deterministic contracts and append-only repository conventions. Operating cost is low because v1 performs no network access, historical-data ingestion, provider execution, or automatic calculation from external prices.

Build the foundation now because Research Lab and Strategy Versioning need stable historical references. Keep analogy scoring, replay, backtesting, live ingestion, and prediction in separately reviewed future work.

## 2. Non-Goals

Version 1 does not fetch or scrape data, call live market or AI APIs, add provider SDKs or credentials, select a database, implement a production repository, calculate external prices automatically, run analogies, predict markets, backtest, replay events, execute trades, integrate brokers, or change Portfolio, Risk, Decision, Prediction, Journal, Research, Strategy, or Python runtime behavior.

## 3. Architecture and Authority

```text
Owner-reviewed historical sources and supplied observations
  -> Historical Event records
  -> evidence-backed Historical Pattern records
  -> append-only reviews, amendments, supersession, and archive history
  -> deterministic query, statistics, export, and audit translation
  -> frozen references consumed by Research and future comparison systems
```

The Historical Pattern Library is historical-event and reusable-pattern truth. Research Lab remains current structured-research truth. Prediction Log remains prediction truth. Alpha Journal remains context and reflection truth. Strategy Versioning remains strategy truth. Unified Audit remains normalized cross-system trace truth. The future Historical Analogy Engine may compare records but cannot own or rewrite them.

## 4. Historical Event Model

`HistoricalEvent` preserves schema and record versions, caller-supplied deterministic identity, title, multiple event categories, status/history, scope, date range with explicit precision, geography, markets, asset classes, factual description, causes, outcomes, contributing factors, policy/macro/liquidity/credit/volatility contexts, regime snapshot, observation windows, asset reactions, sources, evidence, uncertainty, disputed interpretations, related events, typed subsystem references, tags, privacy/retention, correlation/trace identities, policy versions, and scalar metadata.

Event categories include monetary tightening/easing, rate cycles, liquidity/credit/banking crises, recessions, inflation/deflation shocks, crashes and bull/bear markets, bubbles, wars and geopolitical crises, sanctions, energy/commodity/currency/sovereign-debt shocks, fiscal stimulus, regulation, technology booms, sector rotations, pandemics, supply-chain shocks, corporate failures, market-structure events, and `OTHER`. Multiple categories are allowed and duplicates are rejected.

A ticker is never required. Exact timestamps, exact dates, month, quarter, year, approximate, and bounded uncertain dates preserve their precision. Unknown or open-ended dates remain explicit.

## 5. Observation Windows and Asset Reactions

Deterministic windows are `PRE_EVENT`, `EVENT_DAY`, `FIRST_TRADING_DAY`, `THREE_TRADING_DAYS`, `ONE_WEEK`, `ONE_MONTH`, `THREE_MONTHS`, `SIX_MONTHS`, `ONE_YEAR`, `MULTI_YEAR`, and `CUSTOM`.

An asset reaction identifies an asset class and optional market, index, sector, or instrument reference; a window; start/end data references; absolute and percentage change; drawdown/gain; supplied realized volatility or liquidity observations; direction; recovery duration; source timestamp; calculation method; missing-data state; and optional currency-conversion evidence.

No value is invented. Missing data stays missing. Non-finite numbers, invalid percentage denominators, inconsistent supplied calculations, and unsupported cross-currency comparisons fail closed. Every calculated field names a deterministic calculation method. Version 1 does not fetch or derive prices from external systems.

## 6. Market Regime Model

`HistoricalMarketRegime` stores independent dimensions for monetary policy, inflation, growth, liquidity, credit, volatility, valuation, fiscal policy, currency, commodity conditions, market concentration, and investor positioning. Every dimension has a known, unknown, or disputed state; an optional category/value; evidence references; confidence; and a timestamp or period.

Unknown is not neutral. Disputed values preserve the disagreement. Confidence never replaces evidence.

## 7. Historical Pattern Model

A `HistoricalPattern` is a reusable evidence-backed structure derived from one or more historical events; it is not identical to an event. Pattern types cover liquidity release, policy pivots, credit stress, forced deleveraging, volatility spikes, bubble expansion/deflation, relief and bear-market rallies, earnings repricing, sector rotation, quality/safe-haven flows, dollar-liquidity stress, commodity supply shocks, geopolitical-risk release, technology-adoption cycles, capitulation, recovery, regime transition, and `OTHER`.

A pattern preserves identity/version, title, type, description, qualifying conditions, causal mechanism as an explicitly classified claim, typical sequence, observable features/dimensions, source-event IDs, evidence, counterexamples, exceptions, regime dependencies, typical reactions by horizon, confidence, limitations, invalidation conditions, minimum supporting-event count, owner approval where required, lifecycle/history, related patterns, and frozen subsystem references.

Finalization requires at least one supporting event and cannot claim guaranteed future recurrence. Similar historical outcomes never prove future repetition.

## 8. Fact, Observation, Interpretation, and Inference Boundary

Every historical evidence statement is classified as `HISTORICAL_FACT`, `QUANTITATIVE_OBSERVATION`, `SOURCE_CLAIM`, `INTERPRETATION`, `INFERENCE`, `HYPOTHESIS`, `DISPUTED_CLAIM`, `COUNTEREVIDENCE`, or `UNKNOWN`.

Facts and quantitative observations require sources. Interpretations cannot be encoded as confirmed facts. Inferred causal relationships preserve supporting evidence and confidence. Disputed claims preserve competing interpretations. Missing evidence never counts as support, and confidence never converts inference into fact.

## 9. Pattern Extraction Boundary

Pattern extraction is an owner-reviewed evidence operation. AI may propose a classification or interpretation, but deterministic validation and supplied evidence control acceptance. Version 1 stores the resulting pattern; it does not discover patterns, score analogies, infer current regimes, or create predictions.

## 10. Lifecycle, Immutability, Amendments, Reviews, and Supersession

```text
PROPOSED -> VALIDATING -> FINALIZED -> REVIEWED -> SUPERSEDED -> ARCHIVED
       \-> REJECTED
```

Draft workspace is outside the authoritative repository. Authoritative append records complete proposal, validation, and finalization provenance. Finalized events and patterns are immutable. Reviews and amendments are separate append-only records. Archive never deletes. Reverse transitions are forbidden.

Event amendments support factual/date/source/asset-reaction corrections, added evidence, changed interpretation/confidence/regime, and retracted conclusions. Pattern amendments support the equivalent pattern corrections. Parent amendment chains cannot cross records, self-reference, or cycle.

Reviews assess source quality, evidence completeness, hindsight, survivorship and selection bias, regime quality, causal inference, calculation quality, missing-data impact, limitations, and future questions. Reviews require a finalized record.

Pattern supersession preserves the prior record, identifies an already-finalized successor, explains changed evidence or methodology, rejects self-reference and cycles, and marks the prior record superseded without deleting it.

## 11. Identity, Ordering, and Integrity

IDs are deterministic caller-supplied values matching versioned patterns. Random identifiers are prohibited. Schema and record versions are explicit. Duplicate identities replay only when content is identical; conflicting duplicates fail.

Repository sequence, not timestamps, determines order. Canonical key-sorted serialization and deterministic FNV-1a fingerprints support replay integrity; fingerprints are not cryptographic signatures. Inputs and outputs are defensively copied. Truncated, malformed, noncanonical, duplicate, sequence-invalid, or fingerprint-invalid NDJSON fails closed. Store IDs reject traversal.

## 12. Repository and Development Persistence

`HistoricalPatternRepository` exposes append-only event and pattern finalization, event/pattern amendments, event/pattern reviews, pattern supersession, archive, retrieval, history, event/pattern queries, related-record queries, current/superseded filtering, deterministic pagination/statistics/export, and event inspection. There is no update, overwrite, or delete operation.

The in-memory repository supports tests and local use. The canonical NDJSON repository writes beneath `data/runtime/historical-patterns/`, flushes every append, and strictly replays its history. It is unencrypted, single-owner, single-process development persistence—not a production database, transaction boundary, backup system, retention executor, or concurrent writer.

Future production persistence must implement the existing port and the requirements in `docs/PRODUCTION_PERSISTENCE_RECOVERY_SPECIFICATION.md` without moving business rules into storage.

## 13. Query, Statistics, and Export

Queries filter events by category, date/period, geography, market, asset class, regime, Research/Strategy reference, tag, status, and current state; patterns by type, supporting event, Research/Strategy reference, tag, status, and current state. Pagination follows repository sequence.

Statistics deterministically count event categories, pattern types, decades, geographies, statuses, regimes, asset classes, source types, pattern support sizes, current/superseded and reviewed/unreviewed records, missing data, disputed claims, evidence, and Research/Strategy links. No AI-generated summaries exist.

JSON and NDJSON exports use deterministic repository order. `LOCAL_ONLY` records cannot be externally transferred. Configured sensitive exports require an explicit authorization reference. Export does not mutate source records.

## 14. Subsystem Integration Boundaries

Research Lab may freeze finalized historical record ID, version, status, and summary, cite reactions and regime context, and create questions from limitations. Historical changes never rewrite finalized Research.

Alpha Journal may record why an analogy was considered, owner interpretation, behavior, lessons, uncertainty, disagreement, and later review. It does not duplicate or mutate the historical record.

Prediction Log may freeze finalized historical references used as evidence but must not treat a pattern as a prediction. Later historical changes never rewrite locked Predictions.

Strategy Versioning may freeze historical evidence with limitations, supporting-event count, and regime differences. Historical similarity alone cannot approve or activate a strategy, and past profitability does not prove future profitability.

All integrations are reference-only in D6-T3. No existing subsystem behavior changes.

## 15. Unified Audit Integration

Pure deterministic translations cover event/pattern finalization, amendment, review, pattern supersession, archive, export, and validation rejection. They preserve record ID/version/type/status, source and evidence counts, policy versions, privacy/retention, trace/correlation identities, actor, and reason codes while excluding raw copyrighted content, credentials, and unnecessary private payloads. Translation does not recursively persist an operation audit.

## 16. Future Historical Analogy Engine Boundary

The stable input boundary can carry candidate event/pattern IDs, current-event feature references, comparison dimensions, required regime dimensions, observation horizons, a similarity-weight profile reference, excluded dimensions, missing-data policy, and evidence requirements.

The future engine must report similarities, differences, missing data, and source evidence; avoid causation claims from similarity; never generate a trading decision directly; and return evidence for Research Lab review. D6-T3 implements no comparison or vendor-specific AI workflow.

## 17. Future Event Replay Compatibility

Event and reaction identities, explicit periods, observation windows, calculation-method references, and source-data references provide stable inputs for a future Event Replay system. No timeline database, external price series, replay engine, or backtest is implemented.

## 18. Validation Rules

Validation rejects malformed IDs/timestamps/date ranges/precision, impossible ordering, missing finalization evidence, unsupported pattern support, invalid lifecycle transitions, review before finalization, missing amendment originals, invalid calculations, non-finite values, invalid confidence, malformed typed references, false resolved references, secret metadata, self/cyclic links, invalid privacy downgrade, corrupt/noncanonical storage, traversal, invalid pagination, unsupported currency aggregation, structurally detectable inference-as-fact, and language claiming guaranteed recurrence.

## 19. Bias and Limitations

Historical evidence is vulnerable to hindsight, survivorship, selection, source-quality, missing-data, regime-classification, causal-inference, measurement, currency, and sample-size bias. Reviews preserve these assessments and applicability limits. A small or selected sample cannot be generalized silently.

Version 1 does not verify external facts, resolve references transactionally across repositories, encrypt or sign local files, enforce retention, coordinate multiple writers, guarantee production recovery, ingest data, compare current markets, or authorize capital decisions.
