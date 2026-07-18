# Alpha Prediction Log Specification v1.0

Status: Implemented foundation

Date: 2026-07-18

## 1. Purpose

Prediction Log is Alpha's authoritative record of every forecast captured before its outcome is known. It is evidence, not memory, and it is not chat history.

The log exists so Alpha can compare what was expected with what occurred without hindsight edits. It supports future Learning Loop, Strategy Versioning, Alpha Journal, Research Lab, portfolio decisions, trade attribution, and post-trade review while remaining independent from those systems.

Prediction accuracy and trading profitability are separate measurements. A correct prediction can be unprofitable, and a profitable trade can follow an inaccurate or incomplete prediction. Neither value may be inferred from the other.

## 2. Scope

The v1 foundation provides:

- Provider-independent TypeScript contracts
- Deterministic prediction identities
- Immutable prediction and decision snapshots
- A deterministic lifecycle and legal-transition policy
- Separate append-only outcome and review records
- In-memory and local NDJSON repositories
- Filtering, history, statistics, summaries, translation, and export
- Deterministic validation and comprehensive focused tests

The foundation does not provide:

- Live market data or market-data validation
- Broker, portfolio, position, or trade execution
- Provider SDKs, credentials, network calls, or production adapters
- Alpha Journal, Research Lab, Learning Loop, or Strategy Versioning implementation
- A multi-process or production database
- Cross-repository transactions, encryption, backup, or tamper-resistant signing

## 3. Core Principles

1. A prediction is permanently recorded before outcome.
2. A prediction snapshot becomes immutable once appended; locking prohibits all forecast changes.
3. Outcomes, reviews, and history are new records and never modify the original forecast.
4. Prediction accuracy is independent from profitability.
5. Every prediction is reviewable and can participate in the future Learning Loop.
6. Prediction IDs are deterministic functions of the complete immutable snapshot.
7. Evidence and version references are explicit.
8. Repository history is append-only: there is no delete, overwrite, or generic update operation.
9. All lifecycle transitions are deterministic and fail closed.
10. Prediction Log records advisory evidence only and owns no capital or execution authority.

## 4. Architecture Placement

```text
Research Framework
  -> Opportunity Score Engine
  -> Prediction Engine proposal
  -> Prediction Log draft
  -> Owner/system submission
  -> Prediction Log lock (forecast freeze)
  -> Instrument Ranking / Risk / final Decision
  -> External owner-controlled execution, if any
  -> Outcome evidence arrives
  -> Prediction Review
  -> Future Learning Loop / Strategy Versioning proposals
```

Prediction Engine evaluates a proposed forecast. Prediction Log owns permanent forecast evidence, lifecycle, outcome linkage, and review linkage. Decision Engine and Trade Outcome Log remain separate authorities.

AI Router, selected-model, risk, opportunity, configuration, and policy information enter Prediction Log only as immutable references or snapshot values. Prediction Log does not invoke, reroute, approve, or execute AI.

## 5. Prediction Lifecycle

```text
DRAFT
  -> SUBMITTED
  -> LOCKED
  -> OUTCOME_KNOWN
  -> REVIEWED
  -> ARCHIVED
```

The only legal transitions are:

| Current | Next | Required evidence |
|---|---|---|
| None | Draft | Valid immutable snapshot and deterministic ID |
| Draft | Submitted | Submission reason |
| Submitted | Locked | Lock time and reason |
| Locked | Outcome Known | Immutable outcome with evidence |
| Outcome Known | Reviewed | Started and completed review |
| Reviewed | Archived | Archival reason |
| Archived | None | Terminal state |

Skipping, reversing, repeating, or branching transitions is forbidden. History sequence numbers must be contiguous, references must match, and lifecycle timestamps cannot move backward or occur in the future.

## 6. Immutable Prediction Contract

`PredictionSnapshot` captures the evidence-known-at-creation boundary:

- Created time and prediction timestamp
- Prediction/subject type
- Market, ticker, and asset context
- Category and prediction statement
- Expected direction, horizon, and catalyst
- Normalized confidence value, level, and rationale
- Supporting evidence
- Research, journal, audit, strategy, future trade, and future review references
- Prediction and schema versions
- Strategy identity and version
- Owner and AI version
- Review-required flag
- Immutable decision snapshot

`Prediction` adds only its deterministic ID, current reconstructed lifecycle status, lock time, and append-only history. Current status is a projection of history; it is not an independently editable field.

### 6.1 Deterministic ID

The v1 ID is a stable FNV-1a 64-bit digest of a canonical, key-sorted representation of every immutable snapshot field:

```text
prediction:<16 lowercase hexadecimal characters>
```

The algorithm is provider-independent and reproducible. A change to any immutable snapshot field produces a different identity. The ID is evidence identity, not a security signature. A future signed or cryptographic identity version must be introduced through an explicit schema/version migration and must not rewrite v1 IDs.

## 7. Decision Snapshot

`PredictionDecisionSnapshot` freezes:

- Opportunity ID, score, and scoring-policy version
- Risk assessment ID, deterministic risk output, and risk-policy version
- AI Router decision reference
- Selected model ID
- Configuration version
- Policy version
- Reasoning level
- Prediction timestamp
- Market timestamp

The selected model is recorded for traceability only. Business behavior does not depend on a provider or provider SDK. The snapshot cannot be changed by lifecycle, outcome, review, translation, export, or repository reads.

## 8. Evidence Graph

Prediction evidence supports typed references to:

- Research records
- Journal entries
- Unified Audit records and traces
- Strategy identities and versions
- Future trade records
- Future review records

The foundation creates no referenced subsystem. References are identifiers only and preserve subsystem ownership. At least one supporting-evidence statement, research reference, audit reference, and strategy reference is required. Journal, trade, and review reference collections exist now but may remain empty until those systems create records.

## 9. Outcome and Review Lifecycle

### 9.1 Outcome

An outcome may be appended only while a prediction is locked. It records:

- Outcome and prediction identities
- Known time and market time
- Actual direction and result
- Optional benchmark result
- Audit evidence references

The outcome advances the prediction to `OUTCOME_KNOWN`. It cannot change the prediction statement, confidence, timestamps, decision snapshot, or evidence snapshot.

### 9.2 Review

Review is a two-record process:

```text
Outcome appended
  -> Review start appended
  -> Accuracy calculated
  -> Profitability calculated independently
  -> Completed review appended
  -> Prediction advances to REVIEWED
  -> Lessons may be linked later
```

`PredictionReview` preserves:

- Review, prediction, and outcome identities
- Start and completion timestamps
- Reviewer
- Accuracy classification
- Profitability classification
- Overall review result
- Direction, timing, magnitude, catalyst, and overall scores
- Separate accuracy and profitability rationales
- Future lesson references

Accuracy options are `ACCURATE`, `PARTIALLY_ACCURATE`, `INACCURATE`, and `INDETERMINATE`.

Profitability options are `PROFITABLE`, `BREAK_EVEN`, `UNPROFITABLE`, `NOT_APPLICABLE`, and `INDETERMINATE`.

The two fields are stored and aggregated independently. Review before outcome, review of an unlocked prediction, completion without a start record, and archive before review all fail closed.

## 10. Repository Contracts

`PredictionRepository` owns:

- Append prediction
- Append lifecycle history
- Lookup and existence checks
- Stable search and filtering
- Complete history retrieval

`PredictionReviewRepository` owns:

- Append outcome
- Append review start
- Append completed review
- Outcome and review lookup
- Stable review enumeration for statistics

`PredictionLogRepository` combines these ports for the v1 local service. It exposes no delete, overwrite, update-in-place, or amendment operation.

### 10.1 In-Memory Repository

The in-memory implementation provides defensive cloning, duplicate-identity rejection, contiguous history, stable ordering, and deterministic tests. It is not durable.

### 10.2 Local NDJSON Repository

The local implementation appends one versioned event envelope per line and rebuilds the same in-memory projection on reload. It rejects malformed envelopes and truncated final records.

The local repository is approved only for single-owner, single-process development. It is not concurrent-writer safe, encrypted, signed, backed up, or a production transaction boundary. Runtime prediction data must remain outside Git tracking.

## 11. Query, Statistics, Translation, and Export

Filters support status, category, direction, market, ticker, owner, strategy, research reference, created-time range, and review requirement. Results are ordered by creation time and deterministic ID, with validated offset/limit pagination.

Statistics include:

- Total and reviewed predictions
- Accuracy counts and weighted accuracy rate
- Profitability counts and profitability rate
- Average prediction confidence
- Average completed-review score
- Counts by lifecycle status and category

Indeterminate accuracy and not-applicable/indeterminate profitability are excluded from their respective rate denominators.

Pure translations create stable summaries without changing source records. Exports support deterministic JSON, newline-terminated NDJSON, and escaped CSV.

## 12. Validation Rules

Validation rejects:

- Missing, malformed, or non-deterministic IDs
- Duplicate prediction, outcome, or review identities
- Missing supporting evidence or required evidence references
- Invalid schema, prediction, strategy, configuration, or policy references
- Confidence or opportunity scores outside 0 through 100
- Review scores outside 0 through 100
- Invalid enum values
- Invalid or future timestamps
- Market evidence timestamp after prediction time
- Outcome evidence before lock
- Backward lifecycle timestamps
- Missing or noncontiguous history
- Illegal lifecycle transitions
- Outcome for an unlocked prediction
- Review before outcome or before outcome time
- Review completion without review start
- Archive before completed review

## 13. Failure and Atomicity Boundary

Validation is performed before every append. In-process operations are ordered so deterministic preconditions are checked before dependent records are written.

The local v1 store does not claim transactional crash safety across the outcome-plus-transition or review-plus-transition pairs. A production repository must append related records atomically or use a reviewed transactional outbox/event-store design. Production migration must preserve the current provider-neutral ports, immutable identities, and append-only history.

## 14. Future Compatibility

Future systems consume Prediction Log through contracts and typed references:

- Learning Loop reads completed reviews and proposes lessons.
- Strategy Versioning links evidence without rewriting predictions.
- Alpha Journal summarizes prediction and review records without replacing them.
- Research Lab analyzes exported or queried evidence.
- Trade Outcome Log links profitability and execution quality while leaving prediction accuracy independent.
- Portfolio and Decision systems may reference locked predictions but cannot edit them.

New providers, models, data sources, or persistence engines must not change business-layer contracts or lifecycle rules.
