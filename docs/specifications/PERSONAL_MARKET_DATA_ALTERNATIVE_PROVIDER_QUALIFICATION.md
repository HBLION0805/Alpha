# Personal Market Data Alternative Provider Qualification

## Status

T3G-C5 records the Owner-authorized `MULS` asset-metadata outcome and defines a
deterministic, network-free alternative-provider qualification plan. It does
not select a provider, purchase a subscription, run another smoke test, weaken
the 12-symbol requirement, or authorize collection, recommendation, or trading.

## Recorded evidence

The exact T3G-C4 operation:

- used Alpaca Paper Assets;
- requested only `GET /v2/assets/MULS`;
- attempted and completed exactly one request;
- received HTTP `404`;
- emitted sanitized `ASSET_NOT_FOUND`;
- performed zero retries and zero persistence writes; and
- accessed no account, balance, position, order, or market-data endpoint.

This proves that the reviewed Alpaca Paper Assets path did not resolve exact
symbol `MULS` for that operation. It does not invalidate the issuer-confirmed
ticker and does not prove whether another broker, provider, feed, or later
session can resolve the instrument.

## Invariants

The plan must preserve:

- the exact 12-symbol requirement, including `MULS`;
- the required P1D, PT1H, PT15M, and PT5M completed Bars;
- a current two-sided ETF Quote with bid, ask, sizes, time, and provenance;
- explicit feed coverage and non-NBBO warnings;
- separate adapter, credential, Owner, cost, and exact-symbol gates; and
- zero authority to infer, forward-fill, substitute, or silently omit data.

## Candidate lanes

### Twelve Data Basic

This is the first zero-cost research lane, not a selected complete provider.
Before a bounded smoke can be proposed, reviewed evidence and implementation
must close:

- exact `MULS` symbol/reference coverage;
- P1D support in the current Alpha adapter;
- exact bid, ask, bid-size, ask-size, and timestamp semantics;
- 12-symbol interval and quote request-budget feasibility; and
- single/partial-market provenance limits.

Any network request requires a later reviewed adapter task and fresh Owner
authorization.

### Alpaca SIP

This lane remains deferred. Current official plan material records a paid
monthly path and all-US-exchange coverage, but the Paper Assets `404` is not
resolved merely by changing the market-data feed. Alpha must not purchase or
recommend the paid plan until exact `MULS` asset and market-data coverage is
demonstrated through a separately reviewed bounded test and the Owner approves
the cost.

### Multi-provider composition

This lane requires architecture review. It cannot be enabled by configuration.
A future design must bind every symbol and capability to an approved provider,
preserve source-specific provenance and coverage, synchronize freshness and
session boundaries, prevent conflicting duplicate observations, and fail
closed when any required symbol or capability is missing.

## Deterministic outcome

T3G-C5 returns:

- provider selection: `NO_PROVIDER_SELECTED`;
- current Alpaca Basic path: rejected for the exact complete requirement;
- Twelve Data Basic: qualification research required;
- Alpaca SIP: deferred for cost approval and exact coverage proof;
- multi-provider composition: architecture review required; and
- next task: network-free Twelve Data `MULS` capability and quote-contract
  research.

## Authority references

- https://alpaca.markets/data
- https://docs.alpaca.markets/us/docs/historical-stock-data-1
- https://docs.alpaca.markets/us/reference/stocklatestquotesingle-1
- https://twelvedata.com/pricing
- https://twelvedata.com/docs

## Non-authority declaration

This plan is immutable, deterministic, advisory-only, network-free, and
non-executing. It grants no provider credential, subscription, data collection,
recommendation, position sizing, portfolio mutation, order, or trading
authority.
