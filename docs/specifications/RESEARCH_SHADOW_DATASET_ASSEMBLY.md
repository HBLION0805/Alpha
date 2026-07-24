# Research Shadow Dataset Assembly v1

Status: Day15-T3B2 owner approved, committed, and pushed as `3e03e698657dc532e89f088983fa331de8f81c2a`.

Schema: `1.0`

## Purpose

This boundary deterministically projects exact, already-validated Day15-T2 shadow-ledger histories into the canonical Day15-T3B qualification input. It closes the manual gap between a prospectively frozen collection plan and later dataset qualification without creating a data provider, scheduler, model, or trading path.

The boundary is offline and caller-driven. A missing observation, missing audit, or missing official settlement remains visible and blocks assembly. No value is estimated, repaired, selected by outcome, or copied from another event.

## Inputs and authority

The caller supplies:

- one Day15-T3B collection plan frozen strictly before its first cutoff;
- one explicit event-to-observation binding for each planned event;
- immutable feature schema and feature-set versions;
- one complete Day15-T3A audit input for each binding, including the exact observation evidence member;
- one read-only snapshot of Day15-T2 shadow histories.

The frozen plan owns event intent and cutoff. The observation owns point-in-time contract facts. The settlement owns the later official UP/DOWN outcome. The T3A audit owns point-in-time feature eligibility. Assembly does not replace or broaden any of those authorities.

## Exact binding

For an event to become a sample:

- its explicit event binding must be unique and present in the frozen plan;
- its observation identity must be unique in both bindings and ledger histories;
- the observation must reconstruct under the Day15-T1 contract;
- instrument and event type must be BTC-USD and BTC 15-minute;
- both `tradingClosesAt` and `evaluatesAt` must equal the planned cutoff;
- an exact Day15-T2 settlement must reconstruct against that observation;
- the settlement must supply the label and outcome-known time;
- the engine must recompute the full T3A audit, which must be `ELIGIBLE`, contain no issues, match research identity and cutoff, predate assembly, and contain exactly one observation evidence record matching the bound observation identity and fingerprint;
- feature schema and feature-set versions must be homogeneous.

The derived sample ID is deterministic. Label is copied only from the exact official settlement winning side. Quote direction, price movement, hypothetical side economics, filenames, array order, or caller preference never determine the label.

## Result

`ASSEMBLED` returns one immutable canonical `ResearchDatasetQualificationInput`, sorted chronologically by cutoff and stable identity.

`BLOCKED` returns no qualification input and preserves ordered issues and counts for missing, unsettled, or invalid bindings.

The result also fingerprints the frozen plan and the exact observation/settlement ledger snapshot. These local fingerprints prove deterministic internal identity, not independent external market truth or cryptographic source authenticity.

Every result is `SHADOW_DATASET_RESEARCH_ONLY_NOT_MODEL_OR_TRADE_AUTHORITY`. Dataset assembly does not mean that the T3B minimum qualification gate passed.

## Explicit exclusions

Day15-T3B2 adds no:

- Robinhood, BRTI, exchange, market-data, sports, or other provider connection;
- API, network, credential, OCR, screenshot, polling, scheduling, daemon, or automatic collection;
- repository, database, output-file persistence, ledger mutation, or history repair;
- feature calculation, selection, model, probability, calibration, return, expected value, or backtest claim;
- recommendation, ranking, position size, leverage, Risk/Decision/Portfolio mutation, broker, order, or execution.

## Operational workflow

1. The owner freezes a reviewed T3B collection plan before the first cutoff.
2. Existing Day15-T1/T2 tools capture observations and later official settlements manually.
3. Each feature snapshot receives a Day15-T3A point-in-time audit.
4. This engine assembles explicit bindings from a read-only ledger snapshot.
5. The existing Day15-T3B engine independently qualifies or blocks the resulting dataset.

The current milestone intentionally provides an engine boundary rather than a filesystem console. This keeps local NDJSON single-process development storage from becoming an implied production data pipeline.

## Next milestone

Collect real forward shadow records under a frozen plan and run T3B qualification. Day15-T3C remains blocked until a real, non-fixture dataset independently qualifies and the owner approves a separate model-research specification.
