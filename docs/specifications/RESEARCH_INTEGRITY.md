# Research Integrity and Leakage Prevention v1

Status: Day15-T3A owner approved, committed, and pushed as `4c9ef2dfcecb8ce8623b4629df6f5a2d55d041f4`.

Schema: `1.0`

Policy: `research-integrity:point-in-time:1` version `1.0`

## Purpose

Research Integrity is the fail-closed boundary before calibration, backtesting, or model comparison. It proves that every supplied evidence record could legitimately have been known at the simulated decision cutoff and that the exact dataset was frozen before the audit result was created.

The boundary does not train a model, estimate probability, recommend a contract side, calculate expected value, size a position, mutate capital, or execute a trade.

## Time model

Alpha keeps four meanings separate:

- `occurredAt`: when the represented fact or observation occurred;
- `publishedAt`: when the source published that exact version, when applicable;
- `availableAt`: the earliest supported time that exact version could be used;
- `receivedAt`: when Alpha or the research process actually received the record.

`cutoffAt` is the simulated decision-time knowledge boundary. `evaluatedAt` is when the integrity audit is performed.

For every eligible record:

- occurrence cannot follow publication, availability, or receipt;
- publication cannot follow availability;
- availability cannot follow the research cutoff;
- receipt cannot follow the audit evaluation;
- a completed interval cannot end after the cutoff.

## Research modes

`FORWARD` represents a real point-in-time decision. Both `availableAt` and `receivedAt` must be no later than `cutoffAt`, and the dataset must already be frozen.

`HISTORICAL_REPLAY` represents research assembled after the historical cutoff. Receipt and dataset freeze may occur after `cutoffAt`, but each exact source version still requires a point-in-time availability reference proving `availableAt <= cutoffAt`. This permits honest retrospective research without pretending that later revisions were known earlier.

## Evidence rules

Every evidence record has an exact source identity, content fingerprint, availability basis, and availability reference. Supported evidence kinds are canonical quote, canonical bar, news, filing, event-contract observation, market context, and dataset feature.

Availability bases are also internally constrained: source-publication evidence requires a publication timestamp, provider-receipt availability equals the exact receipt time, and exchange-interval-close applies only to Canonical Bars.

Canonical bars additionally require:

- exact interval start and end;
- `FINAL` completion status;
- interval end no later than the research cutoff.

Point-in-time evidence must not declare interval boundaries and uses `POINT_IN_TIME` status.

Outcome and settlement evidence are always blocked from pre-outcome research, even if caller metadata claims otherwise. Any record explicitly marked outcome-bearing is also blocked.

## Dataset manifest

The caller supplies one immutable dataset manifest containing the exact ordered-independent set of evidence IDs and content fingerprints. The engine:

- rejects duplicate evidence or manifest identities;
- requires exact membership and fingerprint agreement;
- requires the dataset to be frozen no later than `evaluatedAt`;
- additionally requires freeze no later than `cutoffAt` in `FORWARD` mode;
- derives a deterministic dataset fingerprint and audit fingerprint.

Dataset assembly time is not treated as source availability. A historical dataset may be assembled later only when every member independently passes its point-in-time availability checks.

## Result

The deterministic result is either:

- `ELIGIBLE`: no leakage or dataset-integrity blocker was found; or
- `BLOCKED`: one or more ordered blocker codes explain why the dataset cannot support calibration or backtesting.

`ELIGIBLE` means only research-integrity eligibility. It is not evidence sufficiency, statistical validity, calibrated probability, profitability, risk approval, or trade authority.

Every result is immutable and marked `RESEARCH_ONLY_NOT_TRADE_AUTHORITY`.

## Trust boundary

The engine verifies internal coherence and exact caller-supplied references. It does not independently prove that a timestamp or archive is externally truthful. Provider integration, signed source archives, production persistence, and tamper-resistant provenance remain future work.

## Explicit exclusions

Day15-T3A adds no:

- probability model, feature selection, training, calibration, or backtest return;
- recommendation, ranking, expected value, position sizing, or Kelly calculation;
- live/provider/API/network access, credential, OCR, or screenshot ingestion;
- Prediction, Decision, Risk, Portfolio, broker, order, or execution integration;
- repository, scheduler, dashboard, or production persistence.

## Next milestone

After owner approval, Alpha may collect and audit a sufficiently large shadow dataset. Day15-T3B may then define dataset qualification and temporal train/calibration/test splits. No probability claim should begin from fixture-only evidence.
