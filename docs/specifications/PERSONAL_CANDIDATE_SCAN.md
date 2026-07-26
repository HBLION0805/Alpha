# Personal Candidate Scan

## Status

Design and deterministic implementation foundation for
`Personal Decision MVP-T2`.

## Purpose

The Personal Candidate Scan prepares a small daily watchlist for downstream
Personal Decision evaluation. It answers:

- Is every required timeframe present, final, current, and traceable?
- Do the daily, one-hour, fifteen-minute, and five-minute structures support the
  same underlying direction?
- Does the reviewed trade vehicle exposure match that underlying direction?
- Is the trade vehicle quote current, liquid, and within the spread limit?
- Is the candidate ready for full Decision evaluation, waiting for a trigger, or
  excluded?

This is structural filtering, not probability estimation, trade ranking, or an
order recommendation.

## Analysis instrument and trade vehicle

The analysis instrument and trade vehicle are separate identities.

For example, a future reviewed mapping may analyze one company or index while
using a bullish or inverse ETF as the candidate trade vehicle. Buying an inverse
ETF is represented as a long position in that ETF with bearish exposure to the
analysis instrument. It is not mislabeled as short-selling the underlying.

Every mapping must provide:

- mapping ID and version;
- explicit `REVIEWED` state;
- analysis instrument identity;
- trade vehicle identity;
- `BULLISH` or `BEARISH` exposure;
- at least one mapping evidence reference.

MVP-T2 does not hard-code or approve mappings for MU, TSLA, SPCX, SKHY, or any
ETF. Exact mappings remain an MVP-T3 data and product review task.

## Required timeframes

One candidate requires exactly:

- `P1D` — broad context guard;
- `PT1H` — intraday context;
- `PT15M` — setup structure;
- `PT5M` — entry-trigger structure.

Each timeframe binds two completed canonical-bar observations through IDs,
fingerprints, interval-end times, fixed-decimal closes, freshness state, and
evidence references. The scanner calculates the return with fixed-decimal
integer arithmetic and classifies it as `UP`, `DOWN`, or `FLAT` using versioned
policy thresholds.

## Candidate states

### `READY_FOR_DECISION`

- all data and mapping gates pass;
- one-hour and fifteen-minute directions agree;
- daily direction is not opposed;
- five-minute trigger confirms;
- trade vehicle exposure matches the underlying structure;
- quote, spread, and liquidity pass.

The scanner emits a narrow downstream seed containing only the trade vehicle,
current market snapshot, and `LONG` vehicle direction. Probability, evidence
assessment, risk, entry, stop, and targets must still be supplied and approved
by Personal Decision.

### `WATCH_TRIGGER`

The daily/context/setup structure supports the vehicle but the five-minute
trigger is flat or opposed. The scanner waits instead of chasing.

### `EXCLUDED`

Any missing, stale, partial, future, conflicting, unreviewed, illiquid,
wide-spread, or exposure-mismatched input is excluded.

## Authority

The output is immutable, deterministic, unranked, read-only, and advisory. It
cannot:

- calculate or claim probability;
- select position size;
- create an order;
- connect to Robinhood or another broker;
- use credentials or provider-native payloads;
- mutate Portfolio, Risk, Decision, Trade, or capital state;
- provide commercial or multi-user behavior.

## Deferred work

- exact reviewed watchlist and ETF mappings;
- live data retrieval and canonical snapshot assembly;
- market-calendar-aware orchestration;
- probability calibration;
- trade plan and Risk composition;
- paper-decision journal and outcome evaluation;
- dashboard presentation.
