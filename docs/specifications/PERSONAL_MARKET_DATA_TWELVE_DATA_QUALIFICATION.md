# Personal Market Data Twelve Data Qualification v1.0

## Status

T3G-C6 performs a deterministic, network-free qualification of Twelve Data
Basic against Alpha's exact personal decision-support requirement. It uses only
the official evidence already reviewed on 2026-07-20 and the current repository
implementation. It does not call Twelve Data, read a credential, persist market
data, recommend a trade, or authorize execution.

## Exact Requirement

The requirement remains unchanged:

- all 12 approved symbols, including `MULS`;
- completed P1D, PT1H, PT15M, and PT5M Bars;
- a current two-sided quote with bid, ask, bid size, ask size, timestamp, and
  provenance;
- explicit quantity units and conversion rules;
- a request budget capable of supporting the intended intraday workflow.

The exact symbol set cannot be reduced to make a provider pass.

## Capability Findings

| Dimension | Finding | Reason |
| --- | --- | --- |
| Exact MULS reference | `UNVERIFIED` | Broad U.S. ETF coverage is not exact-symbol proof. No Twelve Data request for MULS has been authorized or executed. |
| PT5M/PT15M/PT1H Bars | `NARROW_IMPLEMENTATION_ONLY` | Official evidence and the adapter support these intervals, but the adapter has only a built-in AAPL fixture mapping rather than the exact 12-symbol registry. |
| P1D Bar | `BLOCKED` | The current adapter rejects P1D. A daily time-series row is not automatically a confirmed official EOD close. |
| Two-sided Quote | `UNVERIFIED` | The reviewed implementation is Bars-only and does not prove Alpha's exact bid/ask/timestamp/provenance contract. |
| Quote sizes | `UNVERIFIED` | Exact bid-size/ask-size fields, units, and conversion rules are not established. |
| Bar volume units | `BLOCKED` | Live equity volume is not officially proven as Alpha `BASE_UNITS`; the existing normalizer correctly fails closed. |
| Free request budget | `BLOCKED` | The minimum complete requirement and intended five-minute cadence exceed the Basic limits. |

Canonical normalization must never upgrade partial-market data into SIP, NBBO,
or consolidated full-market evidence.

## Deterministic Budget

The frozen evidence states that Basic permits eight API credits per minute and
800 per day, and that `/time_series` costs one credit per requested symbol.
The proof deliberately excludes all Quote credits because their endpoint contract
has not passed review. Therefore every result below is a conservative Bars-only
lower bound; adding Quotes can only increase the cost.

- one four-interval Bar coverage snapshot: `12 symbols × 4 intervals = 48 credits`;
- minimum time at eight credits/minute: `ceil(48 / 8) = 6 minutes`;
- maximum Bar-only coverage snapshots per 800-credit day: `floor(800 / 48) = 16`;
- regular-session five-minute cycles: `390 / 5 = 78`;
- PT5M Bars per cycle: `12 credits`;
- minimum Bar-only daily cadence, adding only one P1D, one PT1H, and one PT15M
  observation per symbol: `(78 × 12) + (12 × 3) = 972 credits`;
- minimum daily deficit against Basic: `972 - 800 = 172 credits`.

This Bars-only lower bound already fails. Quote collection and more frequent slower
interval refreshes would cost more, not less.

## Decision

`TWELVE_DATA_BASIC` is `NOT_QUALIFIED_AS_COMPLETE_PROVIDER`.

It remains a `BARS_RESEARCH_CANDIDATE_ONLY`. No provider is selected and no
network, credential, persistence, collection, recommendation, portfolio, or
trading authority is granted.

## Next Task

The next permissible task is
`DESIGN_BOUNDED_TWELVE_DATA_REFERENCE_DIAGNOSTIC`: design an exact, one-shot,
default-dry-run reference-data diagnostic for MULS. Any real request remains a
separate Owner-authorized operation. Passing exact-symbol reference discovery
would not resolve the P1D, Quote, quantity, or free-budget blockers.

## Governing Evidence

- [Twelve Data Official Evidence and Bar Semantics](../research/TWELVE_DATA_OFFICIAL_EVIDENCE_AND_BAR_SEMANTICS.md)
- [Twelve Data Bar Adapter](TWELVE_DATA_ADAPTER.md)
- [Twelve Data Live Smoke](TWELVE_DATA_LIVE_SMOKE.md)
- [Personal Alternative Provider Qualification](PERSONAL_MARKET_DATA_ALTERNATIVE_PROVIDER_QUALIFICATION.md)
