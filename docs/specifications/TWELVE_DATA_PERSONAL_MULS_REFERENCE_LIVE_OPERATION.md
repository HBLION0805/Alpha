# Twelve Data Personal MULS Reference Live Operation v1.1

## Status

Personal MVP-T3G-C9 defines and implements one local, manually invoked,
default-zero-network live-operation boundary around the reviewed T3G-C8
`MULS` reference diagnostic.

This operation does not itself authorize a real request. A real request remains
separately Owner-gated after implementation, validation, and independent review.

## Purpose

The operation may answer only whether the current Twelve Data ETF directory
returns exactly one valid United States ETF reference record for `MULS`.

It cannot qualify:

- Bars or Quotes;
- P1D session correctness;
- Quote sizes or quantity units;
- volume semantics;
- request-budget feasibility;
- liquidity or tradability;
- recommendations, portfolio actions, orders, or trading.

## Frozen HTTPS Boundary

- method: `GET`;
- endpoint: `https://api.twelvedata.com/etfs/list`;
- query, in order:
  - `country=US`;
  - `format=JSON`;
  - `outputsize=1`;
  - `page=1`;
  - `symbol=MULS`;
- authentication: `Authorization: apikey <API_KEY>`, constructed only inside
  the concrete Transport;
- timeout: 10 seconds;
- maximum response: 1,000,000 UTF-8 bytes and 1,000,000 characters;
- redirects, retries, pagination, fallback, polling, scheduling, background
  execution, and persistence: forbidden;
- request and credit budget: exactly one.

The Transport must reject alternate hosts, paths, ports, credentials in the
URL, changed query values or ordering, added fields, non-GET methods, changed
budgets, and pre-cancelled requests before dispatch.

## Local Command

The command is:

```text
npm run twelve-data:muls-reference -- [authorization flags]
```

No arguments means dry run and must perform zero network requests.

A live attempt requires exactly:

```text
--confirm-live-reference-diagnostic
--authorization-date=<YYYY-MM-DD UTC>
--request-fingerprint=<exact dry-run fingerprint>
```

The date must equal the UTC date of the operation clock. The fingerprint must
equal the fingerprint deterministically derived from the immutable T3G-C8
request. Unknown, duplicate, missing, stale, or mismatched authorization values
fail before Transport execution.

The command accepts no symbol, endpoint, query, credential name, output path,
retry, timeout, or budget override.

## Credential Boundary

Only `ALPHA_TWELVE_DATA_API_KEY` is copied from the command environment.
The public request, URL, output, errors, tests, and documentation must not
contain the key. The concrete Transport may reveal it only long enough to build
the in-memory `Authorization` header passed to the HTTPS executor and the live
operation may reveal it only long enough to re-sanitize a typed provider-error
diagnostic. Neither boundary retains or emits the revealed value.

## Result and Failure Boundary

The operation emits only sanitized policy identity, request fingerprint,
authorization state, request counts, response-validation result, normalized
country and MIC when confirmed, elapsed time, and bounded warnings.

Raw payloads, provider narratives, headers, credentials, fund name, fund family,
fund type, prices, quantities, balances, positions, accounts, and orders cannot
cross the boundary.

T3G-C10 permits one narrowly bounded exception for failed HTTP responses:

- only a JSON object no longer than 4,096 characters may be inspected;
- only top-level `status`, `code`, and `message` are allow-listed;
- `status` is emitted only when it is exactly `error`;
- `code` is emitted only when it is a safe integer from 100 through 599;
- `message` is normalized to one line and capped at 240 Unicode characters;
- the configured credential, labelled API-key or Authorization values, and
  32-character hexadecimal secret-shaped tokens are replaced with
  `[REDACTED]`;
- truncation is declared explicitly;
- unknown fields, nested values, headers, URLs, and the raw response body are
  never emitted or retained.

Malformed, oversized, non-object, or wholly unrecognized error payloads retain
only the existing sanitized HTTP status. Diagnostic parsing does not authorize
a retry or a second request. Direct Transport-error serialization remains
status-only; the diagnostic can be emitted only after the live-operation
boundary re-sanitizes it against the configured credential.

Timeout, cancellation, network failure, HTTP failure, oversized response,
invalid receipt time, malformed response, provider rejection, not found,
ambiguity, and identity mismatch are terminal. No real attempt may be replayed
without a new Owner authorization.

## Testing Boundary

All automated tests inject a fake HTTPS executor and must make zero real network
requests. They cover:

- exact URL and authorization-header construction;
- host, path, query, method, field, timeout, and size rejection;
- cancellation, timeout, HTTP, size, clock, and unknown failure sanitization;
- bounded provider-error parsing, allow-listing, truncation, and credential
  redaction;
- dry-run zero-network behavior;
- exact date and fingerprint authorization binding;
- one confirmed injected execution;
- parser integration and secret/raw-payload non-disclosure;
- CLI argument and environment allow-listing.

## Authority Boundary

T3G-C9 adds a concrete local HTTPS capability but grants no standing network
authority. It adds no collection loop, persistence, provider selection,
market-data qualification, recommendation, portfolio mutation, broker, order,
paper-trading, or real-trading authority.

After implementation, a separate independent review and fresh Owner
authorization are required before at most one real request.

## Official Sources

- https://twelvedata.com/docs/introduction/quickstart
- https://twelvedata.com/docs/etfs
- [Twelve Data Personal MULS Reference Diagnostic](TWELVE_DATA_PERSONAL_MULS_REFERENCE_DIAGNOSTIC.md)
- [Twelve Data Qualification](PERSONAL_MARKET_DATA_TWELVE_DATA_QUALIFICATION.md)
