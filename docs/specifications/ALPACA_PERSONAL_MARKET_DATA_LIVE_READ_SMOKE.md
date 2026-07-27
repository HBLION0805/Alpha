# Alpaca Personal Market Data One-Shot Live-Read Smoke

## Status

MVP-T3G implements the reviewed operation boundary for one manually confirmed
Alpaca Basic IEX market-data rehearsal. The implementation and tests use
injected network-free transports. No real Alpaca request was executed while
building or validating T3G.

## Owner gate

The operation is dry-run by default. Live mode requires the one exact
confirmation flag:

`--confirm-alpaca-live-read`

Unknown, duplicated, or substituted flags fail closed. This flag is a local
Owner declaration for one foreground invocation; it is not remote identity
authentication and does not authorize any later or background run.

## Exact operation

One confirmed invocation executes the T3D plan in its immutable order:

1. P1D Bars;
2. PT1H Bars;
3. PT15M Bars;
4. PT5M Bars; and
5. Latest Quotes.

Each request is executed no more than once. The operation has no retry,
pagination, polling, streaming, scheduling, or background loop. A transport
failure records the distinction between an attempted request and a completed
response because network outcome may be ambiguous.

## Validation and normalization

Every completed response must:

1. contain the exact ordered 12-symbol set;
2. pass the T3D provider-envelope and row validation;
3. preserve `feed=iex` and `SINGLE_VENUE`;
4. pass T3E identity, chronology, freshness, and completed-Bar rules; and
5. construct valid Canonical Bars or Canonical Quotes.

P1D rows require an explicit reviewed session boundary for every returned
symbol and session. T3G does not invent a 24-hour trading day or silently infer
exchange holidays and daylight-saving boundaries.

Any rejected response or Canonical conversion stops the remaining requests.
No partial response is described as a successful rehearsal.
A provider-validation failure may expose only a bounded diagnostic containing
the request ordinal, declared request scope, stable issue codes, and sorted
missing, unexpected, or invalid symbol identifiers. It exposes no provider
body, prices, quantities, timestamps, credentials, or provider narrative.



## Output boundary

The result contains only:

- mode and fixed budgets;
- number of network requests and validated responses;
- Canonical Bar and Quote counts;
- redacted credential diagnostics;
- IEX quality warnings; and
- explicit zero persistence, recommendation, and trading authority.

It returns no raw provider body, credential, order, position, portfolio,
recommendation, target price, stop, sizing, or execution instruction.

## Real-run prerequisites

Before the first real request:

1. the Owner must separately approve that exact run;
2. both local credential variables must be configured;
3. the explicit four windows must describe completed observations;
4. reviewed P1D session boundaries must cover every requested daily row;
5. the complete Alpha validation bundle must remain green; and
6. the result must be reviewed before any later product integration.

Passing this smoke proves only that the bounded data path works. It does not
prove Alpaca IEX is NBBO, consolidated, sufficient for a decision, or suitable
for automated operation.

## Local command entry

The reviewed local entry point is:

`npm run live-smoke:alpaca-personal-market-data -- --session-date=<YYYY-MM-DD> --daily-start=<UTC> --session-open=<UTC> --session-close=<UTC>`

The command is a zero-network dry run unless the exact
`--confirm-alpaca-live-read` flag is also present. It rejects missing,
duplicated, unknown, non-canonical, or chronologically invalid arguments. The
Owner supplies the reviewed completed-session timestamps; the command does not
infer an exchange calendar, holiday, daylight-saving transition, or partial
session.
Before credentials are copied into the operation input, the command evaluates
its clock exactly once. The clock must return canonical UTC and the reviewed
`sessionClose` must be at least 60 seconds earlier. A future session, a session
that has not closed, a session still inside the closure buffer, or an invalid
clock fails closed before any transport can run. The same 60-second boundary is
used by T3E when rejecting current or not-yet-closed Bars.



Only `ALPHA_ALPACA_API_KEY_ID` and `ALPHA_ALPACA_API_SECRET_KEY` are copied from
the process environment into the immutable operation input. No other process
environment value crosses that boundary. The command uses the credentials only
for the approved market-data transport. It never calls the Paper Trading or
Live Trading order endpoints and never reads or mutates either account balance.
