# BTC Event Contract Shadow Ledger v1

Status: Day15-T2 implemented locally and pending owner review.

Schema: `1.0`

Default local store: `data/runtime/event-contract-shadow/event-contract-shadow-v1.ndjson`

## Purpose

The BTC Event Contract Shadow Ledger preserves validated Day15-T1 observations and later official settlement results as an append-only local evidence history. It gives future probability research a reproducible dataset without rewriting observations after the outcome is known.

The ledger is not a trading account, Prediction Log, Trade Outcome Log, recommendation engine, broker, or execution system. No entry represents a real order or capital movement.

## Lifecycle

```text
validated observation input
  -> immutable Day15-T1 observation
  -> append OBSERVATION_APPENDED
  -> later official settlement input
  -> exact observation/terms/contract/source validation
  -> append SETTLEMENT_APPENDED
  -> read-only hypothetical side outcomes and aggregate summary
```

An observation may exist without a settlement. A settlement cannot exist without its observation. Each observation has at most one final settlement.

## Observation authority

The ledger accepts only a complete `EventContractObservationRecord` produced by the Day15-T1 engine. It revalidates the record fingerprint, schema, authorization status, chronology, quotes, fee previews, evidence, and deterministic economics before append.

Repeated identical append requests are idempotent and return `REPLAYED`. Reusing an observation ID or settlement ID with different content fails as an idempotency conflict.

## Settlement input

A final settlement requires:

- settlement ID and observation ID;
- exact Day15-T1 terms ID and contract ID;
- settlement timestamp no earlier than contract evaluation;
- final winning side: `UP` or `DOWN`;
- settlement source ID equal to the observation's declared settlement source;
- official source-record and evidence IDs.

The settlement output is immutable, fingerprinted, shadow-only, and cannot be changed or deleted.

## Hypothetical outcomes

After settlement, the service calculates both side outcomes from the already-frozen Day15-T1 fee previews:

- winning side net result = maximum payout minus all-in cost;
- losing side net result = negative all-in cost.

These values answer only, “What would this exact frozen fee preview have produced if that side had been selected?” They do not claim that a model selected the side, that an order filled, or that money was earned.

Prediction selection, model confidence, expected value, position size, actual fills, and real profitability remain separate future records.

## Repository

The in-memory repository is deterministic test/development state. The local repository writes canonical NDJSON beneath a caller-supplied root and a bounded store ID.

Repository guarantees:

- monotonic sequence assigned at append;
- canonical event fingerprint;
- append-only observation and settlement events;
- defensive copies;
- exact replay/conflict behavior;
- strict reload with sequence, fingerprint, schema, reference, and record validation;
- rejection of truncated, malformed, noncanonical, or traversal paths;
- no update, overwrite, or delete operation.

The local file is single-owner, single-process, unencrypted development persistence. It is not a production database, multi-writer transaction system, backup, signed audit trail, or disaster-recovery mechanism.

## Local console

The local command reads one explicit JSON file or returns a summary:

```text
npm run event-contract-shadow -- capture --input=<observation.json> --store-dir=<runtime-dir> --accepted-at=<UTC>
npm run event-contract-shadow -- settle --input=<settlement.json> --store-dir=<runtime-dir> --accepted-at=<UTC>
npm run event-contract-shadow -- summary --store-dir=<runtime-dir>
```

The command performs no network call, provider access, credential read, OCR, screenshot processing, scheduling, polling, broker action, or order execution.

## Fail-closed behavior

The ledger rejects:

- malformed or unvalidated Day15-T1 observations;
- record or repository fingerprint mismatch;
- duplicate identities with changed content;
- settlement before evaluation;
- missing or mismatched observation, terms, contract, or source;
- duplicate settlement for one observation;
- malformed, truncated, noncanonical, or out-of-sequence storage;
- undeclared fields and unsafe paths.

## Deferred work

- automatic Robinhood, exchange, and BRTI capture;
- official-source outcome retrieval;
- calibrated probability and uncertainty;
- model prediction freeze;
- market-versus-model expected value;
- virtual position selection and risk sizing;
- real Trade Outcome Log integration;
- Dashboard, scheduling, multi-process persistence, backup, broker, order, or execution integration.
