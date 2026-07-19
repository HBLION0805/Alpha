# Research Lab v1 Specification

Status: Implemented foundation; awaiting owner review  
Version: 1.0  
Date: 2026-07-18

## 1. Problem, Value, and Timing

Alpha needs an authoritative record of what evidence was available, what assumptions and uncertainty existed, and what conclusion was justified at a point in time. Chat transcripts and mutable notes cannot provide that boundary.

Research Lab preserves structured research for securities, funds, companies, sectors, macro and policy conditions, event contracts, cryptoassets, catalysts, historical patterns and analogies, portfolio questions, and system research. Tickerless research is first-class.

Its value is reproducible Prediction evidence, honest review, and stable input for future Strategy Versioning and historical systems. Implementation and operating cost are bounded to provider-neutral TypeScript and local single-process NDJSON. It is built now because Prediction Log and Alpha Journal preserve forecasts and context, but Alpha still needs separate research truth.

Core principle: research preserves what evidence was available and what conclusion was justified at that point in time. Later information never rewrites finalized research.

## 2. Non-Goals

Research Lab v1 does not implement live market/news/regulatory APIs, scraping, browser automation, provider SDKs, AI calls, credentials, HTTP or sockets, raw copyrighted-content archives, broker/trade/portfolio execution, Strategy Versioning, Historical Pattern/Analogy engines, Event Replay, backtesting, encryption, signing, production storage, or cross-repository transactions.

## 3. Architecture and Authority

```text
Structured source references and observations
  -> Research Lab finalized evidence
  -> immutable amendments, reviews, supersession, archive history
  -> deterministic query, statistics, export, and audit translation
  -> frozen references consumed by Prediction Log and future systems
```

Research Lab is research truth. Prediction Log is prediction truth. Alpha Journal is context, rationale, reflection, and learning truth. Unified Audit Repository is normalized evidence-trace truth. Future Strategy Versioning owns strategy state. Research Lab links to these authorities and never mutates or replaces them.

## 4. Record and Categories

`ResearchRecordSnapshot` captures schema/research version, timestamps, category, title, question, scope, optional subject fields, horizon, factual observations, sources, data points, evidence, hypotheses, assumptions, uncertainty, counterarguments, risks, catalysts, thesis, conclusion, confidence, scenarios, invalidation conditions, typed references, prior-record identity, tags, author/owner, privacy/retention, trace/correlation identities, policy versions, and scalar metadata.

The authoritative `ResearchRecord` adds content-derived identity, status, and immutable lifecycle history. Ticker and asset are optional.

Categories are `STOCK`, `ETF`, `COMPANY`, `SECTOR`, `INDUSTRY`, `MACRO`, `POLICY`, `FEDERAL_RESERVE`, `EVENT_CONTRACT`, `CRYPTO`, `COMMODITY`, `BOND`, `CURRENCY`, `CATALYST`, `EARNINGS`, `GEOPOLITICAL`, `HISTORICAL_PATTERN`, `HISTORICAL_ANALOGY`, `MARKET_STRUCTURE`, `TECHNICAL_STRUCTURE`, `PORTFOLIO`, `STRATEGY_RESEARCH`, and `SYSTEM_RESEARCH`.

## 5. Lifecycle and Append-Only Behavior

```text
DRAFT -> COLLECTING -> ANALYZING -> FINALIZED -> REVIEWED
                                      |            |
                                      +--> SUPERSEDED
                                      |            |
                                      +----------> ARCHIVED
```

Draft collection and analysis are workspace state. At authoritative finalization, the repository records complete `DRAFT -> COLLECTING -> ANALYZING -> FINALIZED` provenance and accepts the immutable record. Finalized research may be reviewed, superseded, or archived; reviewed research may be superseded or archived; superseded research may only be archived. There is no reverse transition, update, overwrite, delete, or hidden replacement.

## 6. Identity and Ordering

Research IDs use a stable FNV-1a 64-bit digest of canonical key-sorted snapshot content:

```text
research:<16 lowercase hexadecimal characters>
```

This is reproducible evidence identity, not a cryptographic signature. Events carry deterministic fingerprints and monotonically increasing repository sequences. Sequence, not timestamp, controls storage/query/export order. Identical replay returns the original sequence; conflicting duplicates fail. Inputs and returned values are defensively copied.

## 7. Source and Evidence Model

Source references store structured metadata only: stable ID/type, title, publisher/owner, known publication/observation/retrieval timestamps, revision, location, privacy, reliability/freshness scores, and optional integrity reference.

Source types include company/regulatory filings, investor relations, government/central-bank releases, exchange/market references, news, papers, datasets, transcripts, charts, owner screenshots/observations, historical databases, and system output. No external content is fetched or archived.

Evidence separates facts, quantitative/price/volume observations, fundamental/macro metrics, policy statements, events, catalysts, technical structure, historical comparisons, counterevidence, assumptions, and inferences. A separate classification distinguishes fact, interpretation, assumption, and inference. Structurally detectable mismatches are rejected.

## 8. Questions, Scenarios, Assumptions, and Uncertainty

Question, hypothesis, evidence, interpretation, thesis, and conclusion are distinct fields. Finalized research requires a non-empty question, evidence, thesis, and conclusion.

Base, bull, bear, and alternative scenarios may include probability, catalysts, invalidation, expected behavior, horizon, and evidence. Probability is optional for qualitative work and otherwise must be 0 through 100.

Assumptions preserve importance, confidence, source support, testability, and invalidation. Uncertainty preserves categories, unknowns, missing data, and unresolved questions. Counterarguments and counterevidence remain visible; inference is never encoded as fact.

## 9. Amendments, Reviews, and Supersession

Amendments are separate immutable factual/source corrections, clarifications, added evidence, interpretation/confidence changes, or retractions. Parent chains must remain within one record and cannot be missing, self-referential, or cyclic.

Reviews record what held up/failed, correct/incorrect assumptions, source/process/conclusion quality, Prediction/profitability references, lessons, follow-up questions, and non-executing strategy-change candidates.

Supersession requires a separately finalized new record that freezes the prior ID. A supersession event links both and records changed facts, assumptions, regime, thesis, reason, owner, timestamp, and audit reference. Prior research remains retrievable and visible as `SUPERSEDED`.

## 10. Evidence Graph and Future Compatibility

Typed references support Prediction, Journal, Strategy, Portfolio Snapshot, Unified Audit, Historical Pattern, other Research, Decision, Trade, Development Validation, market snapshot, catalyst event, and future Event Replay records. Every reference is explicitly `RESOLVED` or `UNRESOLVED`; resolved references freeze a version. Mismatched types, duplicates, self-reference, and self-supersession are rejected.

Minimal Historical Pattern and Event Replay extension points prevent redesign while leaving comparison periods, similarity/difference analysis, market responses, regimes, analogy confidence, and historical engines to future tasks.

## 11. Repository and Persistence

`ResearchRepository` exposes append-finalized, amendment, review, supersession, archive, retrieval, complete history, deterministic query/pagination, related research, and event inspection. It exposes no mutation or deletion.

The in-memory implementation supports deterministic tests/local use. The local canonical NDJSON implementation stores runtime data beneath `data/runtime/research-lab/`, restricts store IDs, prevents traversal, flushes every append, requires canonical newline-terminated events, verifies contiguous sequences/fingerprints on replay, and fails closed on malformed, truncated, non-canonical, duplicate, or inconsistent history.

Local persistence is unencrypted, single-owner, single-process development storage—not a production database, concurrent writer, backup system, or transaction boundary.

## 12. Query, Statistics, and Export

Filters support date, category, status, market, ticker/asset, company, sector/industry, theme, catalyst, Prediction, Journal, Strategy, Historical Pattern, tags, trace/correlation identities, and current-only records. Pagination follows repository sequence.

Deterministic summaries expose identity/version, category, title, status, conclusion, confidence, subject, tags, amendments, and review state. Statistics cover category/status/time/subject, current/superseded/reviewed counts, Prediction/Journal links, sources/reliability, assumptions, unresolved questions, and process quality. No AI summarization exists.

Stable JSON/NDJSON exports include filtered histories. `LOCAL_ONLY` records cannot leave the local boundary; sensitive external export requires configured authorization. Export never changes source state.

## 13. Integrations

Prediction integration validates that required research exists and is currently finalized/reviewed. Accepted evidence freezes research ID, version, status, conclusion summary, and confidence. Missing/non-current research produces a policy-controlled rejection or warning. Later changes never rewrite locked Predictions.

Journal may record why research started, owner observations, behavioral context, reviews, lessons, and follow-up questions; it does not duplicate the Research record. Neither system mutates the other.

A pure Unified Audit translation maps finalization, amendment, review, supersession, archive, export, and validation-rejection evidence to `RESEARCH_RECORD` inputs from the `RESEARCH` subsystem. It preserves identity/version, timestamp, status, reasons, evidence count, trace/correlation, policies, privacy, retention, and actor while excluding raw content and secrets. It performs no persistence or recursive audit.

## 14. Validation and Limitations

Validation rejects malformed/future timestamps, invalid IDs/lifecycle, empty questions/evidence/conclusions, duplicate/conflicting identities, invalid confidence/probabilities, missing source/data/evidence links, malformed reliability/freshness, invalid/self references, unsupported privacy, secret-bearing metadata, invalid pagination/ranges, invalid amendment/review/supersession chains, path traversal, and corrupt persistence.

Known limitations include non-cryptographic fingerprints, structural rather than transactional cross-repository resolution, two local appends for new-record finalization plus supersession, and no encryption, tamper seal, retention executor, backup/recovery, or multi-writer coordination. Future providers and systems can be added behind typed boundaries without changing Research Lab ownership or existing records.
