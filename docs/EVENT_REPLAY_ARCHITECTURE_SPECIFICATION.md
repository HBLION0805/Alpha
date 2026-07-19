# Event Replay Architecture Specification v1.0

Status: Implemented foundation; owner-approved and committed

Version: 1.0

Date: 2026-07-19

Task: D6-T5 Event Replay Architecture Foundation

## 1. Purpose

Alpha needs a deterministic way to reconstruct historical market-event timelines from already-supplied evidence. The purpose of Event Replay is to preserve chronology, observation windows, checkpoints, provenance, missing-data state, confidence, and limitations so Research Lab and later learning systems can review historical evidence consistently.

Replay is evidence. Replay is not prediction. Replay is not execution. Replay is not backtesting.

## 2. Non-Goals

Version 1 does not implement backtesting, trading simulation, execution simulation, AI reasoning, strategy optimization, automatic learning, live-market replay, market-data downloads, provider SDKs, external APIs, broker integration, Python runtime integration, Decision Engine behavior, Risk Engine behavior, Portfolio behavior, or production persistence.

It does not calculate profitability, expected return, trade quality, risk-adjusted return, strategy performance, or future probability.

## 3. Architecture Position

```text
Historical Events, Historical Patterns, Historical Analogies, and Research evidence
  -> caller-supplied replay timeline
  -> deterministic validation of chronology, windows, checkpoints, references, and missing data
  -> replay session reconstructs ordered evidence
  -> replay statistics, completeness, confidence, quality, limitations
  -> append-only repository, export, and Unified Audit translation
  -> Research Lab or later systems may cite reviewed replay evidence
```

Historical Pattern Library remains historical-event and reusable-pattern truth. Historical Analogy Engine remains comparison truth. Research Lab remains interpretation truth. Prediction Log, Alpha Journal, and Strategy Versioning may reference replay evidence later but are not mutated by replay.

## 4. Replay Identity

Replay identity is caller-supplied and deterministic:

- `event-replay-timeline:*` identifies a versioned timeline.
- `event-replay-session:*` identifies a deterministic reconstruction run.
- `event-replay-checkpoint:*` identifies an immutable checkpoint.

Random identity generation is intentionally absent. Changed timeline evidence requires a new version or successor replay session rather than rewriting history.

## 5. Timeline Model

`ReplayTimeline` freezes:

- timeline ID, schema version, timeline version, title, description;
- Historical Event references;
- Historical Pattern references;
- Historical Analogy references;
- supporting Research/source evidence references;
- observation windows;
- chronological timeline events;
- immutable checkpoints;
- missing-data policy;
- privacy, retention, correlation, trace, and metadata.

Timeline events must be chronological. Each non-missing event requires evidence. Events preserve phase, observation timestamp, observation window, snapshot references, pattern references, analogy references, missing-data flag, and limitations.

## 6. Observation Windows

Observation windows define the evidence period being reconstructed. Supported window types are intraday, one day, three days, one week, one month, three months, one year, and custom.

The repository stores the window exactly as supplied. It does not fetch prices, infer trading calendars, normalize markets, or fill missing observations.

## 7. Event Phases

Replay phases are:

- `SETUP`
- `PRE_EVENT`
- `TRIGGER`
- `IMMEDIATE_REACTION`
- `STABILIZATION`
- `FOLLOW_THROUGH`
- `RESOLUTION`
- `REVIEW`

Phases organize the historical evidence only. They are not strategy states, trading states, broker states, or risk states.

## 8. Checkpoint Model

Checkpoints are immutable evidence freezes. Each checkpoint preserves sequence, timestamp, phase, event IDs, observation window IDs, evidence IDs, completeness score, confidence score, and canonical payload fingerprint.

Every timeline must start with `TIMELINE_START` and end with `TIMELINE_END`. Checkpoint sequence and checkpoint timestamps must be ordered. A checkpoint cannot reference a missing event or window.

Fingerprints use Alpha's existing deterministic FNV-style integrity convention. They are replay-integrity checks, not cryptographic signatures.

## 9. Replay Session Model

A replay session is the deterministic reconstruction of one exact timeline version. It stores:

- timeline reference;
- replay timestamp;
- replay mode fixed to `DETERMINISTIC_EVIDENCE_RECONSTRUCTION`;
- ordered event IDs;
- checkpoint IDs;
- replay statistics;
- quality status;
- limitations;
- frozen references;
- lifecycle history;
- privacy, retention, correlation, trace, and metadata.

The engine sorts and verifies timeline order, validates checkpoints, computes statistics, and appends the session. It performs no simulation or prediction.

## 10. Lifecycle

```text
PROPOSED -> VALIDATING -> READY -> REPLAYING -> COMPLETED -> REVIEWED -> SUPERSEDED -> ARCHIVED
       \-> REJECTED
```

Completed sessions are immutable. Reviews, supersessions, and archive events append separate evidence. Supersession requires a material change in timeline evidence, supporting evidence, or checkpoint method. Archive never deletes history.

## 11. Missing Data, Completeness, and Confidence

Missing data policy is explicit:

- `FAIL_CLOSED` rejects missing timeline events.
- `PRESERVE_GAP` allows gaps and lowers completeness.
- `REQUIRE_REVIEW` preserves gaps and marks review need through quality.
- `INCOMPLETE_RESULT` keeps replay evidence explicitly incomplete.

Completeness is computed from missing versus total events. Confidence is computed from evidence-bearing events. Quality is derived from completeness and confidence as `COMPLETE`, `PARTIAL`, `INCOMPLETE`, or `INVALID`.

Missing data never becomes a neutral match and never becomes a simulated value.

## 12. Evidence Boundary

Replay may reference:

- Historical Events
- Historical Patterns
- Historical Analogies
- Research Lab records
- Prediction Log records
- Alpha Journal records
- snapshots
- supporting source evidence

Replay does not own those records and cannot mutate them. It freezes references for reconstruction only.

## 13. Repository and Local Persistence

`EventReplayRepository` supports append-only timelines, sessions, reviews, supersessions, archives, retrieval, history, query, listing, export, and statistics.

The in-memory repository supports deterministic tests and local workflows. The canonical NDJSON repository writes beneath `data/runtime/event-replays/`, assigns monotonic repository sequence, flushes every append, and strictly replays canonical history.

There is no update, overwrite, or delete path. Local NDJSON remains unencrypted single-owner, single-process development persistence, not production storage or a transaction boundary.

## 14. Unified Audit

Pure audit translation maps replay timeline/session/review/supersession/archive/export/validation records into Unified Audit inputs. Translation preserves source IDs, versions, status, reason codes, quality, statistics, privacy, retention, correlation, trace, policy versions, and safe metadata.

Translation does not recursively persist an audit record and does not include credentials or unnecessary private payloads.

## 15. Export

JSON and NDJSON exports preserve repository order. `LOCAL_ONLY` replay sessions cannot be externally exported. Sensitive external export requires explicit authorization. Export never mutates source records and never generates an AI summary.

## 16. Validation Rules

Validation rejects malformed IDs, invalid timestamps, non-chronological events, missing checkpoints, invalid checkpoint fingerprints, checkpoint references to missing timeline content, missing non-gap evidence, unresolved references claiming resolution without frozen status, invalid lifecycle transitions, self or cyclic supersession, invalid pagination, secret metadata, privacy export violations, corrupt storage, path traversal, and structurally detectable prediction, trading, or simulation language.

## 17. Known Limitations

Version 1 reconstructs only caller-supplied evidence. It cannot verify external facts, fetch market data, infer missing values, normalize time zones or trading calendars, coordinate cross-repository transactions, encrypt or sign local storage, enforce retention, or provide production recovery.

Replay can improve review discipline, but it does not measure whether a strategy would have made money.
