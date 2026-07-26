# Personal Decision MVP

## Status

`Personal Decision MVP-T1` deterministic Decision Card foundation is complete.
`MVP-T2` deterministic candidate-scan and multi-timeframe snapshot composition
is also complete. Neither module is connected to live data.

This subsystem is personal, read-only decision support. It does not place orders,
connect to a broker, manage credentials, mutate a portfolio, or provide
commercial or multi-user behavior.

## Purpose

The first useful Alpha product surface must answer five questions for one
candidate:

1. Is there enough current evidence to evaluate it?
2. Is the directional probability supported by out-of-sample calibration?
3. Is the proposed entry, stop, and target internally valid?
4. Does the setup pass deterministic liquidity and risk gates?
5. Is the current conclusion `LONG`, `SHORT`, or `NO_TRADE`?

`NO_TRADE` is a successful safety result, not an error.

## Source-of-truth boundaries

- Market Data owns canonical observations and quote quality.
- Evidence Assessment owns evidence sufficiency and conflict state.
- Prediction research owns probability calibration evidence.
- Risk owns risk approval or constraints.
- Personal Decision composes those reviewed facts into one immutable advisory
  card.
- The owner remains the only execution authority.

The Personal Decision subsystem may not infer missing evidence, repair stale
observations, calibrate a probability, change a risk result, size an order, or
execute a trade.

## Required input

Every request contains only allow-listed fields:

- canonical request and instrument identity;
- one intraday evaluation timestamp and observation timestamp;
- explicit evidence assessment status and reference;
- market-data freshness, spread, and liquidity state;
- directional thesis with probability, calibration status, sample size, and
  out-of-sample validation status;
- an entry zone, stop, at least one target, and holding deadline;
- a completed risk assessment, maximum planned capital loss, and any explicit
  constraints;
- immutable evidence references.

Prices use bounded fixed-decimal values. Probability, spread, planned capital
loss, and reward-to-risk use integer basis points.

## Default fail-closed gates

An actionable `LONG` or `SHORT` requires all of the following:

- Evidence status is `SUFFICIENT`.
- Evidence and market observations are no older than the policy maximum.
- Market data is explicitly current.
- Spread does not exceed the policy maximum.
- Liquidity is explicitly sufficient.
- Probability is `CALIBRATED`, has the minimum calibration sample size, and was
  validated out of sample.
- Directional probability meets the minimum threshold.
- Risk is `APPROVED`, or `CONSTRAINED` with at least one explicit constraint.
- Planned maximum capital loss does not exceed policy.
- Entry, stop, and first target have the correct directional ordering.
- Worst-entry reward-to-risk meets policy.
- At least one immutable evidence reference is present.

If any gate fails, the result is `NO_TRADE` and contains stable blocker codes.
Required conflicts are never averaged away.

## Output

The immutable decision card contains:

- `LONG`, `SHORT`, or `NO_TRADE`;
- calibrated directional probability and sample context;
- entry zone, stop, targets, and maximum holding deadline;
- deterministic worst-entry reward-to-risk;
- evidence and risk references;
- reason and blocker codes;
- policy identity and content fingerprints;
- explicit `ADVISORY_ONLY_MANUAL_EXECUTION` authority;
- `automatedExecutionAllowed: false`, `readOnly: true`, and
  `deterministic: true`.

The card is not an order ticket and cannot contain broker, order, credential,
leverage, provider-native payload, or caller-supplied execution fields.

## Deferred work

MVP-T1 does not implement:

- live or historical data ingestion;
- the daily candidate scanner;
- probability model training or calibration;
- backtesting or paper-trade outcome measurement;
- user interface or notifications;
- position sizing;
- broker connectivity or automatic execution;
- commercial accounts, billing, or multi-user access.

## Next sequence

1. `MVP-T3`: reviewed real-data adapters, exact watchlist mappings, and
   freshness/provenance binding.
2. `MVP-T4`: paper-decision journal, outcome labels, and walk-forward
   calibration.
3. `MVP-T5`: a simple personal dashboard that displays the decision card and
   requires manual owner action outside Alpha.
