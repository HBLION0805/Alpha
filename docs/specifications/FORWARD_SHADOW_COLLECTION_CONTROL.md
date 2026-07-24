# Forward Shadow Collection Control v1

Status: Day15-T3B3 implemented locally and pending owner review.

Schema: `1.0`

## Purpose

This boundary creates one deterministic continuous BTC-USD 15-minute collection plan before its first cutoff and later reports collection progress from a caller-supplied read-only Day15-T2 shadow-ledger snapshot.

It fills the control gap between manual `capture`/`settle` operations and Day15-T3B2 assembly. It does not collect market data, choose a sample, create a T3A audit, qualify a dataset, or authorize trading.

## Plan creation

The caller declares:

- plan identity and version;
- the local creation/freeze timestamp;
- the first future UTC cutoff;
- the number of consecutive 15-minute events.

The engine requires the creation time to be strictly before the first cutoff and the cutoff to lie exactly on a 15-minute UTC boundary. It derives every event identity from its cutoff and returns the existing canonical `ResearchDatasetCollectionPlan` shape plus its deterministic fingerprint.

The engine accepts at most 100,000 events. Creating a plan does not prove that Robinhood will list every planned contract. The creation timestamp is caller-supplied local evidence, not an independently signed external timestamp. Changing any plan field creates a different fingerprint and must use a new plan identity or version.

## Progress audit

The progress audit accepts:

- one canonical frozen collection plan;
- an explicit `asOfTime`;
- one read-only list of Day15-T2 shadow histories.

For each planned event, the engine matches candidate observations only when:

- instrument is `instrument:crypto:btc-usd`;
- event type is `BTC_15_MINUTE`;
- both trading close and evaluation time exactly equal the planned cutoff;
- the stored observation reconstructs under Day15-T1;
- any settlement reconstructs against its exact observation under Day15-T2.
- observation capture and settlement-known times do not follow the audit `asOfTime`.

The engine never silently selects one candidate observation. It reports all matching observation IDs and all settled candidate IDs in stable order for later explicit Day15-T3B2 binding.

Each event receives one progress state:

- `UPCOMING`: cutoff is after `asOfTime` and there is no candidate observation;
- `OVERDUE_MISSING`: cutoff has passed and no candidate observation exists;
- `CAPTURED_UNSETTLED`: at least one candidate observation exists but none has an official settlement;
- `SETTLED_CANDIDATE`: at least one exact candidate observation has an official settlement.

The overall progress is:

- `IN_PROGRESS` while any planned event is upcoming, missing, or unsettled;
- `READY_FOR_BINDING` only when every planned event has at least one settled candidate;
- `BLOCKED` when plan or ledger identity/coherence cannot be proved.

Observations outside the plan are counted but cannot improve coverage.

## Output and authority

The immutable result includes:

- exact plan and ledger-snapshot fingerprints;
- stable per-event progress;
- planned, upcoming, missing, captured, and settled-candidate counts;
- observation and settlement candidate IDs;
- explicit ordered issues.

Every result is `FORWARD_COLLECTION_RESEARCH_ONLY_NOT_MODEL_OR_TRADE_AUTHORITY`.

## Explicit exclusions

Day15-T3B3 adds no:

- Robinhood, BRTI, exchange, provider, API, network, credential, OCR, screenshot, polling, scheduler, daemon, or automatic capture;
- repository, database, file writer, ledger mutation, repair, retry, or production persistence;
- automatic observation selection, T3A audit creation, T3B qualification, temporal split, feature computation, model, probability, calibration, return, or expected value;
- recommendation, ranking, sizing, Risk/Decision/Portfolio mutation, broker, order, or execution.

## Operational sequence

1. Create and preserve one plan before its first cutoff.
2. Use the existing explicit Day15-T1/T2 capture and settlement commands.
3. Audit progress from a read-only ledger snapshot.
4. When progress is `READY_FOR_BINDING`, create explicit T3A audit inputs and T3B2 bindings.
5. Run T3B qualification independently.

Day15-T3C remains blocked until a real, non-fixture dataset independently qualifies.
