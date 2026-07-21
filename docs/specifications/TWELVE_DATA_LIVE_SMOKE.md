# Twelve Data Live Smoke Transport Specification v1.0

## Status

Day11-T1 implements the smallest owner-triggered Twelve Data HTTPS smoke foundation. It introduces one reviewed concrete transport and one manual command, but implementation and automated validation do not execute a live request. The path does not authorize trading, decisions, persistence, polling, retries, streaming, background work, or scheduling.

The first live request remains a separate owner-authorized operation.

## Boundary

```text
ALPHA_TWELVE_DATA_API_KEY environment value
  -> redacted credential handle
  -> strict AAPL/PT5M live-smoke policy
  -> approved immutable symbol mapping
  -> TwelveDataHttpsTransport
  -> existing parser and response validator
  -> existing Bar normalizer
  -> Canonical acceptance blocked while live equity-volume units remain unverified
  -> sanitized diagnostic summary
```

The transport belongs to `src/integration/market-data/twelve-data/`. It uses the platform HTTPS capability directly; no provider SDK or general HTTP library is added. Provider-native payloads stay inside the adapter.

## Credential Handling

The only accepted variable is `ALPHA_TWELVE_DATA_API_KEY`. The loader trims surrounding whitespace and rejects missing, blank, control-bearing, short, or malformed values. The returned credential handle uses private storage; JSON, string conversion, diagnostics, errors, results, and snapshots contain only `[REDACTED]`.

The public deterministic request contains no key. The concrete transport adds the key only while forming the provider request, does not retain or report that target, and never places it in an Alpha result, error, log, or audit record. No `.env` file or real credential is created by this milestone.

## Transport Controls

The transport:

- accepts only `GET https://api.twelvedata.com/time_series`;
- rejects alternate protocols, hosts, ports, credentials embedded in endpoints, duplicate public query keys, and public `apikey` parameters;
- makes one platform `fetch` call per invocation;
- forbids redirects;
- applies a finite 10-second request timeout and a 1,000,000-character response bound;
- supports caller cancellation;
- has no retry, polling, cache, persistence, or response-body logging path;
- returns only typed live responses and safe typed failures;
- translates network, timeout, cancellation, HTTP, malformed JSON, oversized response, and provider-declared errors without retaining provider narratives.

Automated tests inject a deterministic executor and never invoke the platform network implementation.

## Authoritative Live-Smoke Policy

Policy `twelve-data-live-smoke:aapl-pt5m:1`, version `1.0`, permits only:

- provider `provider:twelve-data` in active, enabled composition;
- `BARS` capability;
- one reviewed AAPL mapping;
- U.S. listed Equity or ETF scope, with the initial symbol fixed to `AAPL`;
- interval `PT5M`, mapped to provider `5min`;
- one explicit UTC start/end window no longer than 23,400 seconds;
- at most 10 returned records;
- one provider request and one API-credit budget;
- `MANUAL_ONE_SHOT` execution with official evidence references.

Polling, persistence, streaming, automatic retry, background execution, secret logging, implicit symbol discovery, SPY, daily Bars, and silent clamping are forbidden. Every violation fails closed before transport invocation.

## Dry Run

Dry run is the default. It requires credential presence, then validates registry/composition compatibility, policy bounds, AAPL mapping, PT5M mapping, UTC window, request/credit limits, and transport endpoint readiness. It reports the bounded public request and a redacted credential diagnostic.

Dry run never calls the transport, opens a connection, intentionally resolves DNS, writes market data, or changes domain state.

## Manual Command

The explicit command is:

```text
npm run live-smoke:twelve-data -- --start=<canonical UTC timestamp> --end=<canonical UTC timestamp>
```

Without `--confirm-live-smoke`, it performs dry run only. After separate owner authorization, the owner may add the flag:

```text
npm run live-smoke:twelve-data -- --start=<canonical UTC timestamp> --end=<canonical UTC timestamp> --confirm-live-smoke
```

The command always states `LIVE SMOKE ONLY — NO TRADING OR DECISION AUTHORIZATION`. Confirmed execution performs exactly one request and prints only provider ID, AAPL identity, PT5M window, budgets, accepted count, bounded validation/quality states, duplicate count, blocker/warning codes, and elapsed time. It does not print a raw provider response, raw values, credential, request URL, headers, or execution instructions.

This command is not imported by application startup and is not included in automated test execution.

## Bar and Volume Semantics

The existing parser, validator, closure buffer, UTC interval-open interpretation, half-open interval convention, and Canonical Bar gates remain authoritative. The request continues to use `timezone=UTC`, `prepost=false`, `adjust=none`, chronological order, and closed PT5M bars only. No SIP, NBBO, consolidated, full-market, or equity-volume-unit claim is added.

The official source review does not establish Alpha's required live equity-volume unit. Day11-T1 therefore selects fail-closed design B:

- the live transport and provider parser may succeed;
- a sanitized diagnostic may confirm transport and provider-response behavior;
- live rows cannot become accepted Canonical Bars while `volumeEvidenceStatus` is `UNRESOLVED`;
- the result reports `BLOCKED_UNVERIFIED_VOLUME` and withholds Canonical data.

No `UNKNOWN` quantity unit is invented and Canonical Bar validity is not weakened.

## Safety and Rollback

The validation bundle allow-lists network capability only in `TwelveDataHttpsTransport.ts` and requires the approved endpoint, redirect rejection, finite timeout handling, and response bound. Provider SDKs, other concrete transports, arbitrary hosts, insecure HTTP, polling, streaming, persistence, runtime data, and tracked `.env` files remain prohibited.

Rollback requires only removing or disabling the manual command and concrete transport export, then unsetting `ALPHA_TWELVE_DATA_API_KEY`. No provider data cleanup is necessary because this foundation writes nothing.

Before an owner-authorized request:

1. review the staged code, specification, and green validation report;
2. confirm the intended UTC window represents no more than one regular trading day and avoids the current partial bar;
3. set `ALPHA_TWELVE_DATA_API_KEY` only in the local process environment;
4. run dry mode and confirm zero network requests plus redacted output;
5. separately authorize one confirmed command;
6. inspect sanitized output and immediately stop after the single request;
7. run `git status` and credential scans to confirm no artifact or secret was created.

## Deferred

- execution of the first real request;
- resolution of live equity-volume units and Canonical acceptance;
- SPY and multi-symbol requests;
- retry/backoff, polling, scheduling, streaming, caching, or persistence;
- raw-response retention or correction history;
- Quotes, Trades, daily Bars, market calendars, routing, or fallback;
- Evidence, Decision, Risk, Portfolio, Replay, Paper Trading, broker, or execution integration.
