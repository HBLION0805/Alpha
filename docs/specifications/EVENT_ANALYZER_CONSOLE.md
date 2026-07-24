# Event Analyzer Console Prototype

Status: Day13-T3 v0.2 implemented locally, uncommitted, and pending owner review.

Assessment schema: `2.0`

Candle-series schema: `1.0`

Policy: `event-analyzer:btc-15-minute:2` version `2.0`, rule set `2.0`

## Purpose

The Event Analyzer Console is Alpha's executable deterministic testing workflow for one BTC 15-minute binary event. It accepts owner-supplied event values plus an optional bounded local file of recent one-minute candles, calculates transparent uncalibrated features and probability, compares that estimate with one contract-side market price, reports edge, and emits `BUY`, `HOLD`, or `NO_TRADE` as a prototype analytical recommendation.

The console is not Evidence Fusion, the Decision Engine, Risk Engine, a broker, or an execution system. Every result is `PROTOTYPE_ONLY_NOT_AUTHORIZED` and cannot authorize capital allocation or execution.

## Why v0.2 exists

The v0.1 prototype evaluated a real test with target `66621.97`, current price `66607.57`, 842 seconds remaining, UP contract price `0.45`, and manually classified UP momentum. It estimated 54.92% and returned BUY UP. DOWN won after BTC weakened sharply.

The failure was not proof that a deterministic model can guarantee the next outcome. It exposed a narrower defect: coarse manual momentum hid weakening candles, lower recent closes, downside acceleration, expanding downside range, and relatively stronger selling volume. Version 0.2 adds structured candle facts and refuses to treat manual momentum as equivalent evidence.

## Inputs

The only supported event type is `BTC_15_MINUTE` for canonical instrument `instrument:crypto:btc-usd`. The command requires:

- a bounded event ID, canonical observation time, and current-price source, source-record, and observation IDs;
- target BTC price;
- current BTC price;
- remaining whole seconds from 1 through 900;
- contract side: `YES`, `NO`, `UP`, or `DOWN`;
- exact contract market price strictly between `0` and `1`, with at most four decimal places;
- either a local `--candles-file` or legacy `--momentum=UP|FLAT|DOWN`.

Target, current, OHLC, and volume values use immutable fixed-decimal atomic representations internally. Atomic values are bounded to 24 digits and scales to `0..8`; every bigint-to-number conversion must remain a finite safe integer or evidence fails closed. Contract prices become integer basis points. The engine receives no provider payload, credential, live observation, arbitrary extension object, screenshot, or AI result.

## Candle file schema

The local JSON object contains a bounded `candles` array:

```json
{
  "schemaVersion": "1.0",
  "interval": "PT1M",
  "timestampSemantics": "INTERVAL_START",
  "eventId": "event:btc-15m:20260721-1445",
  "instrumentId": "instrument:crypto:btc-usd",
  "asOfTime": "2026-07-21T14:36:00.000Z",
  "provenance": {
    "sourceId": "source:owner-fixture",
    "sourceRecordId": "source-record:btc:20260721-1436",
    "observationId": "observation:btc:20260721-1436"
  },
  "candles": [
    {
      "timestamp": "2026-07-21T14:35:00.000Z",
      "open": "66635.00",
      "high": "66638.00",
      "low": "66598.00",
      "close": "66607.57",
      "volume": "260"
    }
  ]
}
```

The policy accepts 5 through 30 strictly chronological completed PT1M candles. Each candle timestamp is the inclusive interval start. Adjacent timestamps must be exactly 60 seconds apart, unique, and canonical UTC. `asOfTime` must equal the authoritative current-price observation time, and the final candle must start exactly 60 seconds earlier. Event ID, canonical instrument ID, and observation ID must match the current-price context. The latest close must equal `currentPrice` exactly after scale normalization. Missing, malformed, stale, future, mismatched, or unrelated provenance is invalid and cannot produce `BUY`. OHLC relationships are validated without repair. Prices must be positive; volume must be non-negative or explicit `null` when unavailable.

Screenshots are not accepted because pixels do not provide canonical prices, timestamps, volume semantics, provenance, or deterministic validation. OCR and visual interpretation would introduce avoidable ambiguity. Structured data is reviewable, serializable, reproducible, and testable.

## Deterministic candle features

Version 2.0 calculates with fixed decimals and integer basis points:

- recent return from first supplied close to latest close;
- short return over the last three candles;
- medium return over the last five candles;
- average absolute close-to-close return;
- total and ending consecutive bullish/bearish candle counts;
- bullish and bearish real-body pressure as exactly complementary basis-point shares summing to 10,000;
- average close location near highs, mid-range, or near lows;
- recent two-candle range expansion versus the prior window;
- symmetrical upside/downside acceleration from expanding or persistent returns;
- bullish/bearish relative-volume confirmation when every volume is available;
- prior-to-recent up/down reversal risk using explicit return, consecutive-direction, high, and close rules;
- derived `STRONG_UP`, `WEAK_UP`, `NEUTRAL`, `WEAK_DOWN`, `STRONG_DOWN`, `REVERSAL_RISK_UP_TO_DOWN`, `REVERSAL_RISK_DOWN_TO_UP`, or `INSUFFICIENT_EVIDENCE` momentum.

Relative-volume comparison uses only internally consistent values in the supplied window. It makes no claim about absolute exchange or provider volume units. Any missing volume yields `UNAVAILABLE` and contributes nothing.

## Probability integration

The original target-distance/time calculation remains transparent. Version 2.0 replaces coarse momentum influence with candle-derived momentum whenever sufficient candle evidence exists:

- strong momentum: bounded to +/-1,200 basis points;
- weak momentum: +/-500 basis points;
- reversal: +/-1,500 basis points;
- relative-volume confirmation: at most +/-200 basis points;
- all candle influence combined: clamped to +/-1,600 basis points;
- final probability: conservatively clamped to 10% through 90%.

No single candle feature can create an extreme estimate. The model remains uncalibrated and is not a statistical probability guarantee, expected return, or profitability assessment.

When no candle file is supplied, manual momentum still produces the legacy estimate for comparison, but evidence quality is `LEGACY_COARSE` and recommendation is always `NO_TRADE`. Candle-derived momentum overrides a contradictory manual value.

## Recommendation rules

`BUY` requires all of the following:

- `SUFFICIENT` candle evidence;
- positive edge of at least 500 basis points;
- no severe candle contradiction for the selected side;
- no unstable direction where target distance is small relative to observed movement;
- at least 60 seconds remaining;
- market contract price no greater than 0.8500.

`HOLD` requires the same quality and safety gates with positive edge below 500 basis points. HOLD means preserve the analysis and do not initiate a new trade; it does not assess an existing position.

`NO_TRADE` is returned for legacy-only, insufficient, malformed, contradictory, unstable, expired-time, policy-price, or non-positive-edge cases. Up-to-down reversal or strong bearish structure blocks BUY UP. Down-to-up reversal or strong bullish structure blocks BUY DOWN. The engine never automatically converts contradiction into an opposite-side purchase.

## Console usage

```text
npm run event-analyzer -- --event-id=event:btc-15m:20260721-1445 --observation-time=2026-07-21T14:36:00.000Z --current-price-source-id=source:owner-fixture --current-price-source-record-id=source-record:btc:20260721-1436:bearish --current-price-observation-id=observation:btc:20260721-1436 --target-price=66621.97 --current-price=66607.57 --remaining-seconds=842 --contract-side=UP --market-price=0.45 --candles-file=fixtures/event-analyzer/bearish-reversal.json
```

```text
npm run event-analyzer -- --help
```

The command reads only the named local JSON file and returns deterministic JSON. It makes no API or AI call, reads no credential, writes no file, persists nothing, and emits no order.

Reviewed fixtures are under `fixtures/event-analyzer/`: bullish continuation, bearish reversal, neutral/choppy missing-volume evidence, and malformed OHLC evidence.

## Traceability and limitations

Output is deeply frozen and includes schema, policy, rule, and feature versions; deterministic input fingerprint and analysis ID; all features; evidence quality; ordered issues and contradiction flags; reason codes; risk explanations; `NOT_EVALUATED` profitability; and prototype-only authorization.

FNV-1a supports local deterministic change detection only and is not cryptographic integrity. Local provenance proves only identity and coherence inside the owner-supplied fixture; it does not make the file authoritative external market evidence. A future actionable workflow must separately establish authoritative source provenance, sufficient Evidence Fusion, Decision evaluation, Risk evaluation, owner approval, and execution controls.

## Deferred work

- calibrated probability supported by reviewed historical outcome evidence;
- authoritative event-market and BTC observation adapters;
- event-specific Evidence Fusion sources and provenance;
- screenshot/OCR ingestion, which requires a separate reviewed untrusted-input boundary;
- fees, spread, liquidity, payoff, sizing, portfolio, Prediction Log, audit, persistence, replay, backtesting, Dashboard, live API, Paper Trading, brokerage, and execution integration.
