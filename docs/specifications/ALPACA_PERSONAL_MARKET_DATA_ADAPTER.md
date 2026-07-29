# Alpaca Personal Market Data Adapter Foundation

## Status

MVP-T3D implements a network-free, read-only Alpaca Basic IEX request planner
and strict provider-response validation boundary. It does not implement an HTTPS
transport, read credentials, contact Alpaca, persist data, or create Canonical
Bars or Quotes.

## Fixed dry-run operation

One dry-run plan contains exactly five requests:

1. one batch `1Day` bars request;
2. one batch `1Hour` bars request;
3. one batch `15Min` bars request;
4. one batch `5Min` bars request; and
5. one batch latest-quotes request.

Every request contains the exact ordered set:

`MU,MULL,TSLA,TSLL,TSLQ,SPCX,SPCH,SSPC,SKHY,SKUU,SKDD`

The planner fixes:

- method `GET`;
- host `data.alpaca.markets`;
- stock Bars or Latest Quotes endpoint only;
- `feed=iex`;
- `currency=USD`;
- raw, ascending bars;
- explicit UTC start and end windows;
- 1 to 1,000 response records per symbol and bars request, allowing one exact
  completed P1D session while retaining the hard upper bound;
- 10-second future transport timeout;
- 1,000,000-byte future response limit; and
- a total budget of five requests.

Dry-run reports zero network requests and zero persistence writes.

## Response validation

Provider-native JSON remains inside this integration boundary. Validation:

- accepts only the documented compact bars and quote field sets;
- requires the exact requested symbol set;
- rejects missing or unexpected symbols;
- requires finite positive prices and valid OHLC relationships;
- requires safe non-negative integer volume, trade count, and quote sizes;
- requires strict RFC 3339 UTC timestamps and chronological bars;
- rejects crossed quotes;
- rejects unknown fields rather than copying extensions;
- rejects malformed or oversized JSON;
- sanitizes provider error envelopes; and
- rejects a non-empty pagination token instead of fetching another page.

Validated quote sizes retain the provider's documented round-lot semantics.
Provider timestamps may retain up to nanosecond precision at this boundary.
They are not yet converted to Canonical `BASE_UNITS`. That explicit conversion,
content fingerprinting, freshness evaluation, completed-bar enforcement, and
Canonical construction belong to the next normalization task.

## Market-quality boundary

Alpaca Basic stock data uses IEX. Alpha records this as `SINGLE_VENUE`.

The implementation must never describe:

- an IEX quote as NBBO;
- IEX volume as consolidated US market volume;
- a missing IEX observation as proof that a symbol is unavailable everywhere;
  or
- a successful response as sufficient evidence for a trade.

## Forbidden authority

This foundation has no:

- trading or broker-account endpoint;
- order, position, portfolio, or buying-power operation;
- credential loader or secret storage;
- concrete network transport;
- retry, polling, streaming, scheduling, pagination, or background operation;
- persistence;
- recommendation, sizing, leverage, or automated execution authority.

## Official references

- [Alpaca Historical Bars](https://docs.alpaca.markets/us/reference/stockbars)
- [Alpaca Latest Quotes](https://docs.alpaca.markets/us/reference/stocklatestquotes-1)
- [Alpaca Market Data API](https://docs.alpaca.markets/us/docs/about-market-data-api)
- [Alpaca Market Data FAQ](https://docs.alpaca.markets/us/docs/market-data-faq)

## Next gate

Before one bounded live read:

1. use the T3E Canonical normalization and reviewed daily-boundary policy;
2. implement redacted local credential handles;
3. implement one reviewed HTTPS transport with exact host, endpoint, redirect,
   timeout, cancellation, response-size, and request-count controls;
4. add injected network-free transport tests;
5. rerun dry-run and verify zero network and zero persistence;
6. receive separate Owner approval for one bounded smoke operation; and
7. verify all 11 active exact symbols without automatically following pagination.
