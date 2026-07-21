# Broad Market Evidence Foundation Specification

Status: Day12-T1 owner-approved, committed, and pushed

Schema version: `1.0`

Feature calculation version: policy supplied

## Problem Solved

The Market Regime Engine must not independently assemble unrelated benchmark observations. Broad Market Evidence provides one deterministic, provider-independent composition boundary between reviewed Canonical Bar observations and future Market Regime evaluation.

The boundary is:

`canonical market observations -> Broad Market Evidence snapshot -> fixed-decimal benchmark features -> evidence composition assessment -> future Market Regime input adapter`

The assessment describes available broad-market evidence. It does not classify a regime, predict a return, issue a signal, or authorize a trade.

## Responsibilities

The foundation owns:

- explicit reviewed benchmark membership;
- immutable evidence snapshots and deterministic fingerprints;
- fixed-decimal benchmark feature calculation;
- deterministic multi-benchmark agreement and disagreement facts;
- explicit quality, evidence-strength, issues, warnings, and missing evidence;
- policy, rule-set, feature-calculation, source, and audit trace references;
- deterministic translation to the existing Unified Audit contract.

It does not fetch or normalize data, resolve symbols, store records, classify market regimes, call AI, or mutate Decision, Risk, Portfolio, Strategy, or execution state.

## Benchmark Identity

Every benchmark uses an Alpha-owned Canonical Instrument ID plus reviewed metadata version, broad-market classification, asset class, and review reference. The foundation accepts only reviewed ETF or index identities. An individual equity is rejected even if its price happens to correlate with a market index.

SPY, QQQ, and SOXX names are used only by deterministic test-fixture helpers. They are not production lookup aliases, canonical IDs, or automatic discovery rules. Display symbols are never inferred as provider symbols.

Policy declares every benchmark as `REQUIRED` or `OPTIONAL`. Snapshot membership must exactly match policy membership. A missing benchmark remains an explicit membership entry with `MISSING` availability and no observations.

## Snapshot Contract

`BroadMarketEvidenceSnapshot` preserves:

- schema version, snapshot ID, deterministic fingerprint, as-of time, creation time, interval, and evidence window;
- deterministic Canonical Instrument ordering;
- reviewed benchmark membership and availability;
- provider-neutral observation ID, Canonical Bar ID, Canonical Bar observation fingerprint, observation time, fixed-decimal close, quality, and evidence references;
- correlation, trace, and existing audit references.

Provider payloads, provider symbols, credentials, headers, predictions, trading instructions, position sizes, and recommendations are not contract fields. Construction copies declared fields only, preserving source records unchanged and preventing provider-native extras from crossing the boundary.

Available observations must be strictly chronological, unique by timestamp, inside the evidence window, positive fixed decimals, and tied to the declared benchmark identity. Invalid chronology, duplicate timestamps, invalid identity, or invalid canonical references reject snapshot construction.

## V1 Feature Definitions

The V1 feature module is Broad Market Evidence-specific because composition adds recovery and cross-benchmark facts that are not part of the current Market Regime contract. The module intentionally uses the same fixed-decimal basis-point conventions as Market Regime without changing existing regime behavior. A shared analytics framework is not introduced.

For the configured trailing windows:

- short return: `(latest / short-window first - 1) * 10,000` basis points;
- medium return: `(latest / medium-window first - 1) * 10,000` basis points;
- drawdown: non-negative decline from the medium-window high to latest;
- rebound: non-negative gain from the medium-window low to latest;
- volatility proxy: maximum absolute adjacent return inside the medium window;
- window range: gain from the medium-window low to high;
- recovery percentage: `(latest - low) / (high - low) * 10,000`; a flat window has explicit zero recovery because no decline exists to recover.

All calculations align decimal scales with `BigInt`, truncate integer basis-point results deterministically, and reject unsafe numeric boundaries. JavaScript floating-point price arithmetic, statistical models, optimization, probabilities, and hidden defaults are absent.

## Composition Rules

The versioned policy supplies benchmark membership, expected interval, short and medium windows, minimum observations, freshness, positive and negative trend thresholds, drawdown, rebound, volatility, minimum required benchmarks, contradiction threshold, and evidence-strength agreement counts.

Accepted fresh benchmark summaries may produce only descriptive facts:

- `POSITIVE`, `NEGATIVE`, or `NEUTRAL` medium-trend direction;
- agreement and disagreement counts;
- positive, negative, neutral, rebound, drawdown, and high-volatility counts;
- stale and missing counts;
- benchmark-level feature summaries.

These values are evidence facts. The contract contains no bull, bear, correction, relief-rally, signal, recommendation, probability, expected-return, entry, or exit field. Market Regime remains the only authority for regime classification.

## Quality Precedence

Structural validation rejects malformed input before assessment. For valid requests, quality is deterministic in this order:

1. `STALE` when every required benchmark is present but stale.
2. `INSUFFICIENT` when accepted required benchmarks are below the configured minimum.
3. `CONTRADICTORY` when accepted positive and negative groups each meet the configured opposing-count threshold.
4. `PARTIAL` when the minimum is met but any required benchmark remains missing, stale, rejected, conflicting, or observation-insufficient.
5. `COMPLETE` when every required benchmark is fresh and accepted and no contradiction exists.

Missing optional evidence produces a warning and does not by itself downgrade `COMPLETE`. There is no silent downgrade, averaging away of blockers, or invented replacement observation.

Evidence strength is adequacy, not probability:

- `INSUFFICIENT_EVIDENCE` for `INSUFFICIENT` or `STALE`;
- `WEAK_EVIDENCE` for `PARTIAL` or `CONTRADICTORY`;
- otherwise `STRONG_EVIDENCE`, `MODERATE_EVIDENCE`, or `WEAK_EVIDENCE` according to explicit agreement-count thresholds.

## Provenance and Audit

Every benchmark summary preserves Canonical Bar references, observation fingerprints through the snapshot, evidence references, issues, and reviewed identity metadata. The assessment preserves snapshot fingerprint, evidence window, policy ID/version, rule-set version, feature calculation version, trace IDs, audit references, and deterministic aggregate facts.

`auditRecordFromBroadMarketEvidenceAssessment` translates an assessment into the existing Unified Audit input. It creates no audit repository, persistence layer, or competing authority.

## Relationship With Market Regime

Day12-T1 does not change Market Regime classification or wire the systems together. A future additive adapter may use an accepted Broad Market Evidence assessment and its benchmark summaries to construct a reviewed Market Regime input. That adapter must preserve the Evidence Gate, quality blockers, policy references, and source trace. Market Regime must not reinterpret missing or contradictory benchmark evidence as sufficient.

## Extension Procedure

To add a benchmark or feature:

1. approve its canonical identity and broad-market classification;
2. add it explicitly to a versioned policy;
3. define source and unit semantics before calculation;
4. version any calculation or rule change;
5. add deterministic fixtures for complete, missing, stale, conflicting, and invalid cases;
6. update the future regime adapter separately.

No runtime symbol guessing or automatic benchmark discovery is permitted.

## Known Limitations and Deferred Work

Deferred:

- live benchmark fetching and Twelve Data requests;
- VIX, breadth, and verified volume evidence;
- persistence, replay, backtesting, caching, streaming, routing, and fallback;
- Market Regime consumer wiring;
- Dashboard, alerts, signals, Decision, Risk, Portfolio, Paper Trading, brokerage, and execution;
- AI and probabilistic models;
- dynamic benchmark discovery and production symbol resolution.

V1 uses closes only. It does not claim consolidated-market coverage, breadth, volume semantics, causal interpretation, or future performance.
