# Personal Market Data Zero-cost Provider Screening

## Status

T3G-C12 screens the next zero-monthly-data-fee provider candidates against the
exact personal MVP requirement using official public documentation reviewed on
2026-07-29. It performs no provider API request, reads no credential, opens no
brokerage account, purchases no subscription, and selects no provider.

## Exact Requirement

Every candidate is assessed against:

- all 12 approved symbols, including `MULS`;
- completed P1D, PT1H, PT15M, and PT5M Bars;
- current two-sided Quotes with bid, ask, sizes, timestamps, and provenance;
- explicit venue, consolidation, volume, and size-unit semantics; and
- an intraday request budget suitable for the Owner's workflow.

Official broad-coverage claims do not prove exact `MULS` availability. Exact
12-symbol coverage therefore remains `UNVERIFIED` for every new candidate.

## Screening Result

| Candidate | Free-layer finding | Result |
| --- | --- | --- |
| Tradier Brokerage | Consolidated real-time US equity/ETF data, Quotes with sizes in hundreds, daily plus 1/5/15-minute data, 120 market-data requests/minute | Architecture review required |
| Massive Stocks Basic | EOD and minute aggregates, five requests/minute, no Quotes in Basic | Rejected |
| Finnhub Free | 60 requests/minute, OHLC absent from the free plan, bid/ask with volumes is premium | Rejected |
| Alpha Vantage Free | 25 requests/day; real-time and delayed US data are premium | Rejected |
| FMP Basic | 250 requests/day; free plan is EOD only | Rejected |

Tradier is prioritized only for design. It is not selected or authorized.
Real-time data requires a Tradier Brokerage account and production credential.
That credential belongs to a broader brokerage API surface, so Alpha must
design an exact-host/path read-only adapter boundary that cannot call accounts
or orders before any credential or live diagnostic is considered.

Tradier documents 1-, 5-, and 15-minute intervals rather than a native hourly
interval. Any PT1H use would require a separately reviewed deterministic
aggregation of four completed PT15M bars.

## Official Authorities

- https://production.tradier.com/businesses/fintechs
- https://docs.tradier.com/docs/market-data
- https://docs.tradier.com/docs/quotes
- https://docs.tradier.com/docs/historical-data
- https://docs.tradier.com/docs/rate-limiting
- https://massive.com/pricing?product=stocks
- https://finnhub.io/pricing
- https://finnhub.io/docs/api/stock-bidask
- https://www.alphavantage.co/support/
- https://site.financialmodelingprep.com/pricing-plans

## Next Task

`DESIGN_TRADIER_READ_ONLY_CREDENTIAL_AND_EXACT_SYMBOL_DIAGNOSTIC` may design:

- strict market-data-only host and path allowlists;
- a credential boundary that never exports account or order authority;
- exact symbol-reference and Quote diagnostics for the 12-symbol set;
- completed-bar and PT15M-to-PT1H aggregation rules;
- one bounded, default-zero-network command; and
- fresh Owner authorization for any later real request.

The design must not open an account, request a token, implement trading,
persist market data, or execute a real provider request.
