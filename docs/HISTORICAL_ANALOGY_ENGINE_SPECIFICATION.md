# Historical Analogy Engine v1 Specification

Status: Implemented foundation; owner-approved and committed

Version: 1.0

Date: 2026-07-19

Task: D6-T4 Historical Analogy Engine Foundation

## 1. Problem, Value, Cost, and Build-Now Decision

Alpha can preserve historical evidence but cannot yet perform consistent, reproducible comparisons between a frozen current situation and finalized Historical Events or Historical Patterns. Informal analogy invites confirmation bias, hides missing data, and can overstate causation or future recurrence.

The engine reduces subjective comparison, exposes similarities and material differences together, keeps missing data explicit, supports structured Research Lab review, and creates a stable evidence boundary for future Event Replay and learning systems.

Implementation cost is moderate deterministic foundation work using existing provider-neutral contracts, append-only repositories, canonical validation, Unified Audit translation, and local NDJSON conventions. Operating cost is low because the engine performs no AI execution, embeddings, vector search, live data retrieval, or external service call.

Build now because the Historical Pattern Library is complete and Research Lab needs a stable comparison boundary. Historical similarity remains evidence, not proof.

## 2. Non-Goals

Version 1 does not fetch current or historical market data, call live APIs, add provider SDKs or credentials, use embeddings, add a vector database, use semantic search, let an LLM score similarity, predict markets, recommend or execute trades, backtest, replay events, integrate a broker, mutate Portfolio/Risk/Decision/Trade state, modify Python business logic, or implement production persistence.

The engine does not infer that history will repeat. It does not convert similarity into causation, predicted return, trading profitability, a strategy approval, a Decision, or a Risk override.

## 3. Architecture Position and Authority

```text
Research Lab supplies frozen current-situation evidence
  + Historical Pattern Library supplies finalized candidate evidence
  + owner-approved versioned weight profile
  -> Historical Analogy Engine validates candidates and missing data
  -> deterministic dimension comparison and fixed-scale scoring
  -> similarities, differences, completeness, evidence quality, bias, and limitations
  -> append-only analogy evidence
  -> Research Lab interprets or rejects the evidence
```

Historical Pattern Library remains historical-event and reusable-pattern truth. Research Lab remains current-research and interpretation truth. Prediction Log remains prediction truth. Strategy Versioning remains strategy truth. Decision Engine and Risk Engine retain capital-decision and risk authority. Unified Audit remains normalized trace truth.

The Analogy Engine owns only frozen comparison requests, current-situation snapshots supplied by a caller, versioned weight profiles, deterministic comparison results, and their append-only review history.

## 4. Current-Situation Snapshot

`CurrentSituationSnapshot` is immutable caller-supplied input. It freezes:

- snapshot ID, schema version, snapshot version, and as-of timestamp;
- market-data timestamp references without fetching or refreshing data;
- geography, markets, asset classes, and event categories;
- factual and quantitative observations;
- macro, monetary-policy, fiscal-policy, inflation, growth, liquidity, credit, volatility, valuation, currency, commodity, concentration, and positioning context;
- catalysts, known risks, uncertainty, disputed interpretations, and explicit missing dimensions;
- Research Lab, source, and evidence references;
- privacy, retention, correlation, trace, and safe scalar metadata.

Every comparison uses the exact frozen snapshot version. A changed snapshot requires a new analogy record. Future timestamps fail closed where disallowed. A dimension cannot be both present and declared missing.

## 5. Candidate Selection Boundary

Candidates reference finalized or reviewed Historical Events or Historical Patterns. The caller may supply frozen candidate references, or the engine may select candidates deterministically through explicit local Historical Pattern repository filters. No external or semantic search exists.

Each candidate freezes record ID, version, type, lifecycle status, title, summary, applicable period, regime summary, dimension values, evidence references, source count, pattern support count, limitations, supersession state, historical outcome observations, and an explicit candidate-quality score.

Draft, validating, rejected, archived, or insufficiently evidenced candidates are rejected. Superseded candidates are rejected under current-only policy. Patterns require at least one supporting event. The engine never silently moves to a newer version. A version or status mismatch against an injected Historical Pattern repository fails closed.

Self-referential analogy records and candidates without historical evidence are forbidden.

## 6. Comparison Dimensions and Values

Supported dimensions are:

- `EVENT_TYPE`
- `MONETARY_POLICY`
- `INFLATION`
- `GROWTH`
- `LIQUIDITY`
- `CREDIT`
- `VOLATILITY`
- `VALUATION`
- `FISCAL_POLICY`
- `CURRENCY`
- `COMMODITY`
- `GEOPOLITICS`
- `MARKET_CONCENTRATION`
- `INVESTOR_POSITIONING`
- `CATALYST`
- `MARKET_STRUCTURE`
- `ASSET_REACTION`
- `TIME_HORIZON`
- `GEOGRAPHY`
- `POLICY_RESPONSE`
- `OTHER`

Values are typed as category, number, boolean, set, or text. Each dimension result freezes current and historical values, comparison method, weight, similarity and difference contributions, confidence, evidence references, missing-data state, exclusion state, explanation code, and limitations. Missing data never becomes a neutral match.

Authoritative score evidence contains deterministic values and codes, not AI-generated prose.

## 7. Weight Profiles

`AnalogyWeightProfile` is immutable and versioned. It preserves profile ID/version, title, purpose, comparison type, dimension weights and methods, required/optional/excluded dimensions, missing-data policy, normalization policy, evidence and candidate-quality minima, quality thresholds, status, effective/retirement timestamps, policy version, owner approval reference, and deterministic fingerprint.

Rules:

- weights are non-negative safe integers;
- duplicate dimensions are rejected;
- required dimensions cannot be excluded;
- `SUM_TO_SCALE` weights total exactly 10,000;
- eligible-weight profiles still require a positive denominator;
- profile content and fingerprint must match canonical serialization;
- a changed profile creates a new version;
- every result freezes the exact profile ID, version, and fingerprint;
- only an owner-approved `ACTIVE` profile may score comparisons;
- AI cannot approve or activate a profile.

Fingerprints use the existing deterministic FNV-1a convention for replay integrity and are not cryptographic signatures.

## 8. Missing-Data Policy

Profiles choose one explicit policy:

- `FAIL_CLOSED`: required missing data rejects the comparison;
- `EXCLUDE_DIMENSION`: missing weight is excluded from similarity normalization and completeness declines;
- `PENALIZE_SCORE`: missing weight contributes zero similarity and full difference while completeness still declines;
- `REQUIRE_REVIEW`: comparison remains incomplete and requires review;
- `INCOMPLETE_RESULT`: result remains explicitly insufficient or incomplete.

Excluded dimensions never contribute. Missing weight, compared weight, eligible weight, and missing dimensions remain separate fields. The missing-data ratio is represented through missing versus eligible weight; completeness is computed independently from similarity.

## 9. Deterministic Scoring and Rounding

The v1 score scale is integer basis points from 0 through 10,000.

Comparison methods:

- `EXACT`: 10,000 for equal typed canonical values, otherwise zero;
- `NUMERIC_DISTANCE`: `10,000 - round_half_up(abs(current-historical) / max(abs(current), abs(historical), 1) * 10,000)`, bounded to the score range;
- `SET_OVERLAP`: Jaccard intersection divided by union, rounded half-up to basis points;
- `ORDINAL`: uses the numeric-distance rule for supplied ordinal numbers.

For a present dimension:

```text
similarity contribution = round_half_up(weight * dimension similarity / 10,000)
difference contribution = weight - similarity contribution
```

Aggregate rules:

```text
similarity score = round_half_up(similarity points / allowed similarity denominator * 10,000)
difference score = 10,000 - similarity score
completeness = round_half_up(compared weight / eligible weight * 10,000)
evidence quality = weighted mean of minimum current/historical dimension confidence
candidate quality = frozen candidate-quality score
comparison confidence = minimum(completeness, evidence quality, candidate quality)
```

Under `PENALIZE_SCORE`, the similarity denominator is total eligible weight. Under policies that permit exclusion, it is compared weight. Zero denominators, non-finite input, out-of-range values, and unsafe integer arithmetic fail closed.

Similarity, difference, completeness, evidence quality, candidate quality, and comparison confidence remain separate. A high similarity with completeness below 8,000 cannot be classified `HIGH`. Evidence quality is never merged silently into similarity.

## 10. Quality and Confidence

Quality is `HIGH`, `MODERATE`, `LOW`, `INSUFFICIENT`, or `INVALID`, based on the frozen profile thresholds plus minimum completeness, evidence-quality, and candidate-quality gates. Confidence is a bounded summary with its own score, level, policy version, and reason codes.

Prediction confidence and trading confidence are not part of this subsystem. Comparison quality describes the reliability of the comparison evidence, not expected profit.

## 11. Result Model and Ranking

Each completed analogy freezes request, snapshot, candidate, profile, method, timestamp, dimension results, strongest similarities, strongest differences, missing dimensions, exclusions, score components, confidence, quality, historical outcome observations, regime differences, limitations, bias risks, invalidation conditions, sources, Research reference, optional consumer references, audit reference, privacy/retention, trace identities, lifecycle, and history.

Historical outcomes are explicitly marked as observations and not forecasts.

Eligible completed results rank deterministically by:

1. quality classification;
2. completeness score;
3. evidence-quality score;
4. similarity score;
5. fewer critical differences;
6. stable historical candidate ID;
7. stable analogy ID.

Rejected and invalid records are not ranked. Incomplete records remain identifiable. Maximum count and pagination are validated and deterministic. Top-ranked never means recommended action or guaranteed analogue.

## 12. Bias and Limitation Controls

Structured bias risks cover hindsight, survivorship, selection, confirmation, regime mismatch, policy-response mismatch, geography mismatch, market-structure mismatch, data-quality weakness, missing-data bias, small supporting-event count, overlapping candidate events, outcome cherry-picking, and causality overstatement.

Every risk freezes severity, statement, evidence, and review requirement. Critical unresolved bias requires review. Results always preserve the candidate's limitations plus explicit non-causation and no-trading-signal limitations.

Structurally detectable guaranteed-recurrence and trading-recommendation language is rejected.

## 13. Lifecycle, Review, Amendment, and Supersession

```text
PROPOSED -> VALIDATING -> COMPLETED -> REVIEWED -> SUPERSEDED -> ARCHIVED
       \-> REJECTED
```

Completed records are immutable. Reviews and amendments append separate evidence. An amendment may clarify interpretation or add limitations but cannot rewrite score components. A changed snapshot, candidate version, profile, or scoring method requires a new analogy and explicit supersession.

Reverse transitions, review before completion, missing originals, self-reference, self-supersession, cyclic supersession, and no-change supersession are rejected. Archive never deletes.

## 14. Repository and Local Persistence

`HistoricalAnalogyRepository` supports append-only requests, snapshots, weight profiles, analogy results, reviews, amendments, supersession, and archive events; retrieval and full history; queries by snapshot, event, pattern, profile, Research reference, status, quality, score, completeness, and date; current/superseded views; stable ranking and pagination; statistics; and export.

The in-memory repository supports deterministic tests and local use. The canonical NDJSON implementation writes beneath `data/runtime/historical-analogies/`, assigns monotonic repository sequence independently from timestamps, flushes each append, and strictly replays canonical history.

There is no update, overwrite, or delete path. Identical append is idempotent; conflicting duplicate fails. Inputs and outputs are defensively copied. Malformed, truncated, noncanonical, duplicate, sequence-invalid, or fingerprint-invalid NDJSON fails closed. Store IDs reject path traversal.

Local NDJSON is unencrypted single-owner, single-process development persistence, not a production database, cross-repository transaction, backup system, retention executor, or concurrent-writer boundary. Future production persistence must implement the existing port and `docs/PRODUCTION_PERSISTENCE_RECOVERY_SPECIFICATION.md`.

## 15. Query, Statistics, and Export

Statistics deterministically report requests, candidate types and identities, quality, similarity and completeness ranges, missing and excluded dimensions, weight-profile status, review and supersession state, Research and Prediction links, critical bias risk, and explicit sample size. Averages exist only with a nonzero sample size.

JSON and NDJSON exports preserve repository order. `LOCAL_ONLY` records cannot leave the local boundary. Sensitive external export requires configured authorization. Export never mutates source state and produces no AI-generated summary.

## 16. Subsystem Integration Boundaries

### Historical Pattern Library

The engine may read finalized events and patterns through the repository port and freeze exact version, status, summary, regime, evidence count, limitations, reactions, and outcomes. It cannot modify historical records, create historical facts, silently upgrade versions, or remove limitations.

### Research Lab

Research Lab may submit frozen snapshots and candidate/profile choices, receive structured results, and record interpretation, implications, counterarguments, usefulness, or rejection. The engine cannot finalize Research conclusions or mutate Research records.

### Prediction Log

Prediction Log may later freeze reviewed analogy ID/version, scoring method, profile, and limitations as evidence. Supersession never rewrites a locked Prediction. This task implements no runtime integration and creates no Prediction.

### Strategy Versioning

Strategy Versioning may later freeze reviewed analogy evidence with limitations and regime differences. Similarity cannot approve or activate a strategy. This task creates no Strategy.

### Decision and Risk Engines

Decision Engine must not treat a raw similarity score as an automatic decision. Risk Engine retains every hard constraint. Analogy evidence cannot bypass owner approval or risk rules. No Decision, Risk, Portfolio, Trade, or capital-control runtime behavior changes.

## 17. Unified Audit Integration

Pure deterministic translations support request creation, snapshot freeze, profile proposal/approval/rejection, completion, review, amendment, supersession, archive, export, and validation rejection. They preserve IDs/versions, frozen inputs, score components, completeness, evidence quality, lifecycle, reason codes, limitations, privacy/retention, correlation, and trace identity.

Translations exclude credentials, raw copyrighted source content, and unnecessary payloads. They return normalized audit input and do not recursively persist an operation audit.

## 18. Event Replay Compatibility Boundary

Version 1 defines typed compatibility references for Event Replay ID/version, observation window, optional price/event timeline, optional execution context, and replay-quality status. D6-T5 separately implements an Event Replay Architecture foundation for deterministic evidence reconstruction. No price-timeline database, backtest, execution simulation, prediction, or trading authority exists.

Future replay evidence may validate or challenge analogy assumptions but cannot rewrite analogy history.

## 19. Validation Rules

Validation rejects malformed identities, timestamps, future as-of input, invalid candidate lifecycle or frozen version, candidates without evidence, malformed profiles, negative/non-finite weights, invalid normalization, duplicate dimensions, required/excluded conflicts, invalid missing-data policy, zero denominators, non-finite/out-of-range scores, missing-data similarity, hidden completeness/evidence merging, invalid lifecycle, review/amendment/supersession errors, unresolved references claiming resolution, privacy downgrade, secret metadata, corrupt storage, traversal, invalid pagination, guaranteed recurrence, trading recommendations, and non-owner profile activation.

## 20. Known Limitations

Version 1 compares caller-supplied normalized dimensions and cannot verify external facts, discover candidates semantically, infer current regimes, resolve cross-repository references transactionally, coordinate multiple writers, encrypt or sign local files, execute retention, provide production recovery, or measure predictive/trading performance.

Fixed-scale deterministic comparison reduces ambiguity but does not eliminate historical-data selection, normalization, regime-classification, or interpretation bias. Research and owner review remain required for material use.
