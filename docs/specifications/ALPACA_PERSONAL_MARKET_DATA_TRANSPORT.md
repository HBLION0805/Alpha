# Alpaca Personal Market Data Credential and HTTPS Boundary

## Status

MVP-T3F implements local redacted Alpaca market-data credentials, one reviewed
read-only HTTPS transport, and a default zero-network dry-run. T3F does not
perform a real request and does not authorize a live smoke, continuous runtime,
broker-account access, trading, persistence, recommendation, or execution.

## Credential boundary

Credentials are read only from two process-environment variables:

- `ALPHA_ALPACA_API_KEY_ID`
- `ALPHA_ALPACA_API_SECRET_KEY`

Both values must be printable, bounded, non-empty, and different. The loader
rejects missing, trimmed, control-character, short, or oversized values. No
credential value is written to a file, query parameter, diagnostic, JSON
representation, error message, or returned dry-run report.

The credential handle exposes raw values only through the narrow transport
method. User-facing representations contain `[REDACTED]`.

## Exact network allowlist

The transport permits `GET` only to:

- `https://data.alpaca.markets/v2/stocks/bars`
- `https://data.alpaca.markets/v2/stocks/quotes/latest`

The scheme, host, port, credentials, path, query keys, exact ordered 11-symbol
set, `feed=iex`, and `currency=USD` are revalidated immediately before a
request. Bar requests additionally require one approved timeframe, a canonical
UTC interval, raw adjustment, ascending order, and a record limit from 2 to
1,000.

Trading, account, position, order, SIP, substituted-host, redirect, polling,
streaming, pagination, and undeclared-query paths fail before network
invocation.

## Execution budgets

Every admitted request has:

- one executor invocation and no automatic retry;
- a fixed 10-second timeout;
- cancellation support;
- redirect rejection;
- a 1,000,000-byte UTF-8 response limit; and
- sanitized typed errors that omit provider bodies and credentials.

The caller must explicitly invoke each request. T3F adds no loop, schedule,
background process, retry, persistence, or multi-page traversal.

## Zero-network dry-run

The default T3F operation:

1. validates the two credential variables;
2. constructs the fixed four Bars plus one Latest Quotes plan;
3. validates every request against the HTTPS allowlist; and
4. returns a redacted immutable readiness summary.

It invokes transport execution zero times, reports zero network requests, and
performs zero persistence writes. Injected counting-transport tests prove this
property without opening a socket.

## Market-quality boundary

All requests remain fixed to Alpaca Basic IEX. Successful transport does not
make an IEX quote NBBO, does not make IEX volume consolidated U.S. volume, and
does not by itself authorize a recommendation or trade.

## Next gate

T3G implements the code boundary for one Owner-gated bounded live-read smoke.
The real request remains unexecuted until separate Owner authorization and
local credential readiness. The operation:

1. defaults to dry-run and requires one exact confirmation flag;
2. execute no more than the exact approved request budget;
3. write no provider body, credential, portfolio, or order state;
4. pass every response through T3D validation and T3E normalization;
5. report missing symbols, stale evidence, single-venue limitations, and all
   sanitized failures; and
6. stop without retry, pagination, polling, streaming, recommendation, sizing,
   or execution.
