# Market Regime Engine Specification

Version: 1.0
Status: Foundation implemented; not production ready

## Purpose and Expected Value

The Market Regime Engine provides Alpha with one deterministic, provider-independent vocabulary for describing a benchmark market environment. It prevents future Volume, Breadth, Risk, Signal, Research, and Backtesting components from inventing contradictory regime definitions.

A regime assessment describes the environment. It is not a prediction, trade signal, recommendation, risk approval, position size, execution instruction, or permission to modify a portfolio or frozen plan.

## Responsibility

The foundation owns:

- an immutable, versioned `RegimeInputSnapshot`;
- deterministic price-feature calculations over fixed-decimal canonical observations;
- a versioned `MarketRegimePolicy` and rule set;
- one immutable, explainable `MarketRegimeAssessment`;
- primary-regime and secondary-condition separation;
- deterministic reason codes and unresolved requirements;
- translation into the existing Unified Audit contract.

It does not fetch, normalize, repair, persist, or select market data. It does not call a provider, AI model, Decision Engine, Risk Engine, Portfolio System, broker, or execution path.

## Source Authority and Existing Names

`MarketRegimeAssessment` is the only authoritative contract for a current deterministic market-environment assessment. Existing `HistoricalMarketRegime` records remain immutable historical-event context owned by Historical Pattern Library; they are not current assessments and are not redefined here. The `LearningRecord` market-regime category and Research supersession text are classification/reference fields, not competing regime models. Migration of those legacy descriptive fields requires a separate consumer-driven task.

## Dependency Direction

```text
Canonical market observations
    -> RegimeInputSnapshot
    -> deterministic feature calculations
    -> versioned regime rules
    -> MarketRegimeAssessment
    -> Evidence references and Unified Audit translation
```

Provider adapters, including Twelve Data, remain outside this domain. Provider symbols, payloads, endpoints, credentials, and adapter metadata are not accepted or emitted by Market Regime contracts.

## Input Snapshot

`RegimeInputSnapshot` contains only provider-independent values:

- snapshot ID, schema version, creation timestamp, and content fingerprint;
- resolved canonical broad-market ETF/index benchmark identity and scope, or an explicit unresolved identity state;
- inclusive observation-window start and end timestamps;
- chronological close observations using fixed-decimal atomic values and scales;
- explicit observation quality and evidence references;
- snapshot data-quality state;
- optional verified volume, breadth, and canonical volatility-index evidence;
- requested evidence-dependent secondary conditions;
- correlation, trace, and audit references.

Observation time is never replaced by receipt or evaluation time. Missing observations, stale data, rejected quality, unresolved identity, conflicting timestamps, missing evidence references, and unusable inputs remain explicit and fail closed.

The foundation rejects an individual equity as a market-wide benchmark. A reviewed broad-market ETF or index identity and explicit `BROAD_MARKET` scope are required; display symbols and provider aliases are never benchmark authority.

The optional volatility-index observation is preserved for future versioned rules but does not influence the v1 rule set. The engine does not invent an equivalent volatility index or infer missing values.

## Feature Semantics

The v1 rule set calculates features from the configured trailing observation counts:

- short trend: first-to-last close change in the short window, in basis points;
- medium trend: first-to-last close change in the medium window, in basis points;
- current drawdown: current close below the medium-window high, in basis points;
- rebound: current close above the medium-window low, in basis points;
- bounded volatility: maximum absolute adjacent close return, in basis points;
- window range: medium-window low-to-high movement, in basis points.

Calculations use integer and `BigInt` arithmetic over fixed-decimal values and truncate basis-point division toward zero. They do not use floating-point equality. The bounded volatility metric is not a calibrated forecast or statistical probability.

## Regime Vocabulary

Primary regimes are mutually exclusive:

- `BULL_TREND`
- `BEAR_TREND`
- `CORRECTION`
- `RELIEF_RALLY`
- `RANGE_BOUND`
- `INSUFFICIENT_EVIDENCE`

Secondary conditions may coexist with a primary regime:

- `HIGH_VOLATILITY`
- `DISTRIBUTION_RISK`
- `ACCUMULATION_CANDIDATE`

This split prevents a valid description such as `RELIEF_RALLY` with `HIGH_VOLATILITY` from being collapsed into one opaque label. High volatility does not erase price structure and does not itself authorize a trade.

## Deterministic Rule Set

The v1 precedence is deliberate:

1. `CORRECTION`: medium trend is non-bearish, short trend is negative, and current drawdown reaches the policy threshold.
2. `RELIEF_RALLY`: medium trend remains negative, short trend is positive, and rebound from the window low reaches the policy threshold.
3. `RANGE_BOUND`: short and medium directional movement and total window range remain within the range threshold.
4. `BULL_TREND`: short and medium trends are positive.
5. `BEAR_TREND`: short and medium trends are negative and the medium decline exceeds the range threshold.
6. Otherwise, the result is `INSUFFICIENT_EVIDENCE` with `DIRECTIONAL_STRUCTURE_UNRESOLVED`.

`HIGH_VOLATILITY` is added independently when maximum absolute adjacent return reaches the configured threshold.

`DISTRIBUTION_RISK` and `ACCUMULATION_CANDIDATE` are never inferred from price. The conservative v1 gate requires both:

- verified volume evidence with an explicit unit-semantics version; and
- verified breadth evidence.

Distribution requires a distribution volume signal and negative breadth. Accumulation requires an accumulation volume signal and positive breadth. Missing, unverified, unavailable, or contradictory inputs produce unresolved requirements rather than a guessed condition.

Supplemental volume and breadth observations must also satisfy the policy freshness threshold. Stale supplemental evidence blocks only the dependent condition and marks the assessment limited; it does not erase an independently supported primary price regime.

## Policy and Configuration

Every assessment preserves policy ID, policy version, and rule-set version. The caller must supply:

- short and medium trend windows;
- correction drawdown threshold;
- relief-rally rebound threshold;
- high-volatility threshold;
- range-bound threshold;
- freshness threshold;
- minimum required observations;
- strong-evidence observation minimum;
- the approved bounded-volatility metric.

Thresholds are not scattered through classification logic. Invalid, zero, incompatible, or unsupported policy values are rejected before evaluation.

## Evidence Strength

Assessment strength uses:

- `STRONG_EVIDENCE`
- `MODERATE_EVIDENCE`
- `WEAK_EVIDENCE`
- `INSUFFICIENT_EVIDENCE`

These labels describe deterministic input sufficiency and coverage. They are not probabilities, calibration claims, prediction confidence, expected profitability, or trade quality. Missing optional evidence may reduce evidence strength without erasing a supported primary price regime; missing required price evidence yields `INSUFFICIENT_EVIDENCE`.

## Output and Explainability

`MarketRegimeAssessment` preserves:

- assessment and schema identity;
- assessed and created timestamps;
- observation window and canonical benchmark identity;
- primary regime and ordered secondary conditions;
- evidence-strength classification;
- stable reason codes and unresolved requirements;
- input snapshot ID and fingerprint;
- policy and rule-set versions;
- deterministic feature values when evaluation is possible;
- evidence and audit references;
- data-quality state;
- explicit deterministic/read-only markers.

Outputs are deeply immutable, serializable, and deterministically ordered. The input snapshot fingerprint is FNV-1a deterministic local change detection, not a cryptographic integrity primitive.

## Evidence and Audit Boundary

The assessment carries explicit source evidence references but does not become an Evidence Engine replacement or mutate evidence records. `auditRecordFromMarketRegimeAssessment` translates a completed assessment into the existing Unified Audit input contract with regime policy versions, reasons, evidence strength, quality, trace references, and snapshot fingerprint. Unified Audit remains the audit authority and persistence owner.

## Failure Behavior

The engine returns `INSUFFICIENT_EVIDENCE` for valid but unusable snapshots, including insufficient observations, stale or rejected data, unresolved canonical identity, missing source evidence, contradictory observations, or unmatched directional structure. Malformed contracts and invalid policies are rejected with structured validation issues.

No missing value is inferred. Narrative quality, AI output, one stock's move, or a successful provider transport cannot override these gates.

## Security and Immutability

The module accepts no credentials, URLs, provider responses, arbitrary payloads, or AI text. Snapshot construction copies only declared fields, deeply freezes data, and excludes provider-native properties. The engine has no network, persistence, scheduling, trading, portfolio, strategy-mutation, or execution API.

## Extension Procedure

A future rule or input must add a versioned contract value, deterministic validation, explicit policy threshold, reason code, focused tests, and documentation. A new price-derived label must prove that it does not duplicate Decision or Risk authority. A volume-, breadth-, or volatility-index rule must cite an approved canonical source and semantics before activation.

Do not add provider-specific exceptions to this engine. Provider differences belong in adapters and canonical normalization.

## Deferred Work

- live or startup wiring;
- market-wide benchmark selection policy;
- approved breadth source and Breadth Engine;
- verified volume semantics and Volume Engine;
- calibrated statistical volatility models;
- VIX-like rule integration;
- exchange calendars and session-aware freshness;
- persistence and historical assessment repository;
- Dashboard presentation;
- Evidence Engine product composition;
- Decision and Risk consumer integration;
- backtesting and strategy-version comparison;
- AI summaries;
- signals, recommendations, sizing, Paper Trading, brokerage, and execution.
