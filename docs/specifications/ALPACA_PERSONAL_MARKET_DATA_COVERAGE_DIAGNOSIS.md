# Alpaca Personal Market Data Coverage Diagnosis

## Status

T3G-C3 records the fail-closed qualification result from the Owner-authorized
2026-07-24 Alpaca Basic IEX one-shot read. It adds no network request,
credential access, persistence, recommendation, or trading authority.

## Observed evidence

The reviewed T3G command:

- attempted and completed one P1D request;
- received a provider response for the exact 12-symbol request;
- found `MULS` absent from the returned Bars map;
- stopped before PT1H, PT15M, PT5M, and latest Quotes;
- made zero retries and zero persistence writes; and
- exposed no raw payload, price, quantity, timestamp, or credential.

The result proves that Alpaca Basic IEX did not satisfy exact 12-symbol P1D
coverage for that completed session. It does not prove why `MULS` was absent.

## Cause boundary

Issuer evidence confirms that `MULS` is the GraniteShares 2x Short MU Daily
ETF ticker. Alpaca documents that Basic equity data uses the single-venue IEX
feed, while SIP covers all US exchanges. A missing IEX Bar can therefore be
consistent with no qualifying IEX observation, but the redacted Bars response
cannot distinguish that possibility from asset metadata, halt, provider, or
other availability causes.

Alpha must not:

- declare the ticker invalid;
- invent or forward-fill the missing Bar;
- substitute MU, MULL, SIP, or another symbol;
- treat the other 11 P1D symbols as fully verified across all five requests;
- retry or widen the request without fresh Owner authority; or
- describe IEX as NBBO or consolidated market coverage.

## Provider qualification

For the exact personal MVP requirement, Alpaca Basic IEX is `BLOCKED`:

- the reviewed adapter exists;
- `MULS` exact-symbol verification is `FAILED`;
- the other 11 symbols remain `PENDING_LIVE_SMOKE` because the operation
  stopped before every interval and latest Quotes completed; and
- `READY_FOR_PERSONAL_COLLECTION` is forbidden while any required symbol is
  failed or unverified.

This is a qualification decision for the complete 12-symbol provider path. It
does not prohibit future use of Alpaca IEX for a separately specified partial
or research-only path.

## Future resolution options

Any later resolution is a separate task and authority boundary:

1. inspect asset status through a reviewed read-only metadata adapter;
2. run a new Owner-authorized exact-symbol smoke on another completed session;
3. evaluate consolidated SIP coverage subject to the Owner's cost approval; or
4. qualify another provider that supplies all required Bars and two-sided
   Quotes.

No option may silently reduce the exact symbol set or weaken evidence quality.

## Authority references

- https://docs.alpaca.markets/us/docs/about-market-data-api
- https://docs.alpaca.markets/us/docs/historical-stock-data-1
- https://docs.alpaca.markets/us/docs/market-data-faq
- https://graniteshares.com/media/ybrjp1hr/graniteshares-etf-trust-s-l-single-stock-etfs-prospectus.pdf

## Non-authority declaration
