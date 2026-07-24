# Research Dataset Qualification and Temporal Split v1

Status: Day15-T3B owner approved, committed, and pushed as `8f722fb1d527cf00a6b01ec74cbac28f1b56d9fd`.

Schema: `1.0`

Policy: `research-dataset-qualification:btc-15-minute:1` version `1.0`

## Purpose

This boundary decides whether a completed BTC 15-minute shadow dataset is minimally eligible for later probability research and, only when eligible, produces one deterministic chronological train/calibration/test partition.

It does not train, tune, select, compare, or run a model. It reports no probability, accuracy, return, expected value, recommendation, position size, or trade authority.

## Frozen collection plan

Research must begin from a collection plan frozen strictly before its first event cutoff. The plan declares:

- exact BTC-USD and BTC 15-minute event identity;
- one continuous sequence of 15-minute planned event IDs and cutoff times;
- plan identity, version, and freeze time.

Every supplied sample must match exactly one planned event. Missing planned events remain visible in coverage. Extra, duplicated, reordered, or post-freeze-invented events fail closed.

Freezing a plan does not prove that Robinhood continuously listed every contract. A future provider adapter must create plans from authoritative availability evidence. The current boundary proves only deterministic internal coherence.

## Sample binding

Each completed sample preserves:

- exact event, observation, and outcome identities and fingerprints;
- feature cutoff and later outcome-known time;
- explicit UP or DOWN label;
- one feature schema and feature-set version;
- an exact Day15-T3A Research Integrity audit reference.

The complete immutable audit proof must be `ELIGIBLE`, use research-only authority, match the research identity and sample cutoff, predate qualification, contain no issues, and pass deterministic fingerprint reconstruction. Outcomes must become known strictly after the feature cutoff and within the bounded settlement-delay policy.

All samples in one qualified dataset use the same feature schema, feature-set version, and Research Integrity policy/rule-set version. This prevents a silent feature or eligibility-definition change from being treated as one homogeneous experiment.

## Minimum qualification policy

The conservative default v1 gate requires:

- at least 1,000 completed samples;
- at least 30 distinct UTC cutoff dates;
- at least 90% coverage of the frozen collection plan;
- at least 200 UP and 200 DOWN outcomes;
- no outcome may exceed 80% of completed samples;
- no duplicate sample, event, observation, outcome, or integrity-audit identity;
- no malformed, missing, blocked, or mismatched integrity reference.

These thresholds are minimum research gates, not proof of statistical power, stationarity, calibration, profitability, or future performance.

## Temporal partition

Eligible samples are ordered only by cutoff time and stable event identity. Random shuffling is forbidden.

The default retained-sample allocation is:

- 60% training;
- 20% calibration;
- remaining 20% final test.

Four complete samples are embargoed between training and calibration and another four between calibration and test. Embargoed samples are never assigned to a model partition.

The engine additionally requires all labels in the earlier partition to be known before the next partition begins. This prevents a training or calibration label from crossing into the future feature window.

The final test set is sealed. A future research workflow may evaluate it only after model and calibration choices are frozen under a separately reviewed specification.

## Result

The immutable result is:

- `QUALIFIED` with exact metrics, partition membership, embargo membership, dataset fingerprint, split fingerprint, and ordered audit issues; or
- `BLOCKED` with no split and explicit reasons.

Every result is `DATASET_RESEARCH_ONLY_NOT_MODEL_OR_TRADE_AUTHORITY`.

## Explicit exclusions

Day15-T3B adds no:

- data download, provider, API, network, credential, OCR, or screenshot ingestion;
- model, training, hyperparameter search, feature selection, probability, calibration result, backtest return, or benchmark;
- recommendation, ranking, expected value, sizing, Kelly calculation, Risk/Decision/Portfolio mutation;
- repository, scheduler, dashboard, broker, order, or execution behavior.

## Next milestone

After owner approval and after a real dataset passes this gate, Day15-T3C may specify a baseline probability model and calibration protocol. Fixture data cannot authorize a probability claim.
