# Personal Market Data Provider Coverage

## Status

MVP-T3C implements a deterministic, fail-closed provider coverage and readiness
assessment. It does not make a network request, store a credential, place an
order, or authorize live collection.
T3G-C3 records the first exact live-smoke result: Alpaca Basic IEX omitted
`MULS` from the completed 2026-07-24 P1D response. The adapter is implemented,
but the complete 12-symbol provider path is now `BLOCKED`.


## Personal MVP requirement

The provider path must support the exact 12-symbol set:

- MU, MULL, and MULS
- TSLA, TSLL, and TSLQ
- SPCX, SPCH, and SSPC
- SKHY, SKUU, and SKDD

It must also support completed `P1D`, `PT1H`, `PT15M`, and `PT5M` bars plus a
current two-sided ETF quote with bid, ask, bid size, ask size, timestamps, and
provenance.

No provider statement substitutes for an exact-symbol live smoke check. New or
thinly traded listings remain unverified until the exact instrument is observed.

## Provider decision

### Blocked complete-provider candidate: Alpaca Basic using IEX

Alpaca Basic was selected for the first bounded smoke because the official
material documents:

- zero monthly plan cost;
- US stock and ETF market data;
- minute, hour, and day bar aggregations;
- a free IEX feed; and
- a symbol allowance larger than the 12-symbol MVP set.

IEX is a single venue. Alpha must preserve `SINGLE_VENUE` coverage and must not
describe its quotes as NBBO, its volume as consolidated market volume, or its
evidence as complete market truth.

The Owner-authorized smoke completed one P1D request and stopped because
`MULS` was absent. Issuer evidence confirms the ticker, but a single-venue
Bars response cannot distinguish no IEX observation from other metadata,
halt, or provider availability causes. Alpha therefore fails the complete
provider qualification without inventing data or declaring the ticker invalid.

### Deferred premium path: Alpaca SIP

The paid SIP plan is recorded as a future option when consolidated US-exchange
coverage is necessary. Its current documented monthly price is USD 99. A
zero-dollar MVP budget blocks this path deterministically.

### Bars-only backup candidate: Twelve Data Basic

Twelve Data documents the required time-series intervals and a free allowance of
eight API credits per minute and 800 per day. It is not selected as the complete
MVP provider because:

- the current Alpha adapter does not implement daily bars;
- reviewed evidence does not establish the exact bid, ask, bid-size, and
  ask-size contract needed by Alpha; and
- US observations must not be treated as consolidated full-market volume.

It remains a possible bounded bars backup after its adapter and evidence gaps
are closed.

## Readiness states

- `BLOCKED`: a required capability, exact symbol, or budget constraint fails.
- `READY_FOR_BOUNDED_SMOKE`: official capability evidence is sufficient to
  design a small Owner-approved test, but implementation, credentials, or exact
  symbol verification remains incomplete.
- `READY_FOR_PERSONAL_COLLECTION`: the adapter exists, the Owner approved live
  use, credentials are locally available, and every required symbol passed the
  exact live smoke checks.

`READY_FOR_BOUNDED_SMOKE` is not permission to access a network. Network access
requires a separate reviewed adapter, explicit Owner approval, local credential
handling, request limits, timeout and response-size controls, and evidence of
the exact symbols returned.

## Authority references

- [Alpaca Market Data](https://alpaca.markets/data)
- [Alpaca Historical Bars](https://docs.alpaca.markets/us/v1.4.2/reference/stockbars)
- [Alpaca Latest Quote](https://docs.alpaca.markets/us/reference/stocklatestquotesingle-1)
- [Alpaca Market Data FAQ](https://docs.alpaca.markets/us/docs/market-data-faq)
- [Twelve Data Time Series](https://twelvedata.com/docs/market-data/time-series)
- [Twelve Data Pricing](https://twelvedata.com/pricing)
- [Twelve Data US Equities Feed](https://support.twelvedata.com/en/articles/9935903-us-equities-market-data)

## Authority boundary

This module is deterministic, immutable, advisory-only, read-only, and
non-executing. It has no broker, order, position-sizing, leverage-selection,
credential, network, or portfolio-mutation authority.
