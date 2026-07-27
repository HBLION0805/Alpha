# Twelve Data Personal MULS Reference Diagnostic Architecture v1.0

## Status

T3G-C7 is design-only. It defines one exact, Owner-gated, default-zero-network
reference-data diagnostic for `MULS`. It does not implement a command,
credential loader, transport, parser, network call, persistence path, market
data adapter, recommendation, or trading behavior.

Implementation and any real request are separate tasks with separate Owner
approval.

T3G-C8 implements the network-free core: immutable contracts, the fixed request
planner, strict parser and validator, reuse of the redacted credential handle,
and a `FIXTURE_ONLY` injected Transport seam. It adds no HTTPS Transport or CLI.
C8 `confirmed=true` means fixture rehearsal only; network capability remains
structurally false and network request counts remain zero.

T3G-C8 has passed Owner review and is committed and pushed. T3G-C9 adds the
separate exact-host HTTPS Transport, current-UTC-date and request-fingerprint
authorization gate, and default-zero-network local command. C9 implementation
does not authorize a real request; independent review and fresh operation-bound
Owner authorization remain required.

## Purpose

The diagnostic answers only:

> Does the current Twelve Data ETF directory return exactly one United States
> ETF reference record whose symbol is exactly `MULS`?

A positive result would establish reference-directory presence only. It would
not prove availability from `/time_series`, P1D correctness, current Quotes,
Quote sizes, quantity units, free-budget feasibility, liquidity, tradability,
or fitness for Alpha decisions.

## Official Contract

Official evidence reviewed on 2026-07-26 establishes:

- current endpoint: `GET https://api.twelvedata.com/etfs/list`;
- `symbol` and `country` are supported exact filters;
- `page` and `outputsize` bound the response;
- the endpoint costs one API credit per request;
- Basic, Grow, Pro, and Venture return at most 50 records;
- response `result` contains `count` and `list`;
- each list entry documents `symbol`, `name`, `country`, `mic_code`,
  `fund_family`, and `fund_type`;
- reference data is updated daily.

The older support article documents `/etf`. T3G-C7 selects the current
`/etfs/list` documentation as the sole permitted endpoint. `/etf`, `/stocks`,
`/time_series`, `/quote`, arbitrary paths, and alternate hosts are forbidden.

## Frozen Request

The implementation task must construct, not accept from the caller:

```text
method: GET
scheme: https
host: api.twelvedata.com
path: /etfs/list
query:
  country=US
  format=JSON
  outputsize=1
  page=1
  symbol=MULS
credential: Authorization header added only inside the transport
timeout: 10 seconds
maximum response body: 1,000,000 characters
maximum requests: 1
maximum credits: 1
redirects: forbidden
```

The deterministic public request must never contain an API key or printable
authorization header. Query keys must be unique, sorted, and fixed. The caller
cannot supply a symbol, country, page, output size, host, path, credential
variable, retry policy, or output location.

## Execution Gate

Default behavior is dry run:

- validates the frozen request, credential-variable presence, endpoint policy,
  one-request/one-credit budget, timeout, response bound, and zero-write policy;
- reports only the public request and `[REDACTED]` credential state;
- performs zero fetches, DNS lookups, persistence writes, retries, pagination,
  polling, streaming, background work, scheduling, or trading operations.

A later implementation must require an exact confirmation flag such as
`--confirm-live-reference-diagnostic` and a fresh Owner authorization bound to
the operation date and immutable request fingerprint. Confirmation is not
granted by this design.

## Response Validation

The parser must accept one bounded JSON object only and reject malformed,
oversized, array, scalar, HTML, redirect, and provider-error responses.
Unknown fields are stripped and cannot cross the provider boundary.

The only accepted positive shape is:

- `status` is `ok`;
- `result.count` is exactly `1`;
- `result.list` contains exactly one record;
- record `symbol` is exactly `MULS`;
- record `country` is exactly `US` or `United States`;
- record `mic_code` is a syntactically valid uppercase ISO 10383 MIC;
- all required fields are strings and no required field is null.

Anything else fails closed:

| Safe result | Condition |
| --- | --- |
| `REFERENCE_CONFIRMED` | Exactly one valid US `MULS` ETF record |
| `REFERENCE_NOT_FOUND` | Successful response with count/list both zero |
| `REFERENCE_AMBIGUOUS` | More than one record or count/list disagreement |
| `REFERENCE_IDENTITY_MISMATCH` | Wrong symbol, country, or malformed MIC |
| `PROVIDER_REJECTED` | Sanitized provider-declared error |
| `HTTP_FAILURE` | Non-success HTTP status |
| `TIMEOUT` | Ten-second deadline exceeded |
| `RESPONSE_INVALID` | Malformed, oversized, or undeclared response shape |

No provider narrative or raw payload may enter diagnostics.

## Sanitized Result

The result may expose only:

- operation and request fingerprints;
- provider ID and endpoint policy ID;
- exact requested symbol `MULS`;
- safe result code;
- normalized country classification;
- validated MIC when confirmed;
- attempted/completed request counts;
- retry, persistence, account, order, recommendation, and trading counts fixed
  to zero;
- elapsed time and bounded warning codes.

It must not expose or persist the API key, headers, request URL with
credentials, raw response, fund name, fund family, fund type, narrative error,
prices, quantities, balances, positions, account data, or orders.

## Stop and Failure Semantics

- stop after the first response or first failure;
- no automatic retry, pagination, fallback, or alternate endpoint;
- cancellation and timeout are terminal sanitized results;
- ambiguous or partial results do not become reference evidence;
- a process crash after dispatch is treated as an ambiguous operation and
  cannot be blindly replayed;
- another real diagnostic requires new Owner authorization.

## Authority Boundary

T3G-C7 grants:

- no network authority;
- no credential-use authority;
- no persistence authority;
- no market-data coverage qualification;
- no provider selection;
- no collection, recommendation, portfolio, broker, order, or trading
  authority.

Even `REFERENCE_CONFIRMED` would leave every T3G-C6 blocker in force except
exact reference-directory presence.

## Required Implementation Sequence

1. T3G-C7 design review, selective commit, and push are complete.
2. T3G-C8 network-free core review, selective commit, and push are complete.
3. T3G-C9 concrete HTTPS Transport, local command, and network-free tests are
   complete locally and require independent Owner review.
4. Default dry-run execution must prove zero network.
5. A real request requires a new, operation-bound Owner authorization.
6. Record only the sanitized result and reassess the exact-symbol gate.

## Official Sources

- https://twelvedata.com/docs
- https://support.twelvedata.com/en/articles/5620513-how-to-find-all-available-symbols-at-twelve-data
- [Twelve Data Qualification](PERSONAL_MARKET_DATA_TWELVE_DATA_QUALIFICATION.md)
- [Twelve Data Official Evidence Review](../research/TWELVE_DATA_OFFICIAL_EVIDENCE_AND_BAR_SEMANTICS.md)
