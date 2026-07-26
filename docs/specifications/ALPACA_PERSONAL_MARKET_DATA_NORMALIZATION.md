# Alpaca Personal Market Data Canonical Normalization

## Status

MVP-T3E converts only previously validated Alpaca Basic IEX provider rows into
Alpha Canonical Bars and Canonical Quotes. It performs no network request,
credential access, persistence, recommendation, sizing, portfolio mutation, or
execution.

## Exact instrument binding

Normalization requires the exact 12-symbol mapping catalog:

`MU,MULL,MULS,TSLA,TSLL,TSLQ,SPCX,SPCH,SSPC,SKHY,SKUU,SKDD`

Each provider symbol must match the Canonical Instrument display symbol.
Missing, reordered, substituted, or extra mappings fail before Canonical
construction.

## Quote policy

Alpaca documents stock quote sizes in round lots. T3E fixes the U.S. equity
round-lot conversion at exactly 100 base-unit shares:

```text
canonical base units = provider round lots * 100
```

Both bid and ask sizes are retained with `BASE_UNITS`. No lot value is guessed,
silently rounded, or omitted.

Provider timestamps may carry nanosecond precision. Canonical timestamps use
the platform's millisecond UTC representation, while the complete validated
provider row, including the original timestamp, is included in the content
integrity reference. Two provider observations that differ below millisecond
precision therefore retain different Canonical fingerprints.

Quote freshness derives only from the versioned policy's maximum age:

- age within the bound becomes `CURRENT`;
- age over the bound becomes `STALE` with `STALE_OBSERVATION`; and
- future observations or invalid receipt/normalization/evaluation ordering fail
  closed.

## Bar policy

PT1M, PT5M, PT15M, and PT1H interval ends use the existing Canonical fixed
interval durations.

P1D does not use an invented 24-hour duration. Every daily row requires a
reviewed explicit boundary containing:

- exact symbol;
- provider interval start;
- exact interval end; and
- exchange session date.

This prevents silent errors from exchange calendars, holidays, and daylight
saving time.

A Bar becomes `FINAL` only when:

- its interval end is no later than receipt time minus the closure buffer;
- it lies inside the exact requested window;
- receipt, normalization, and evaluation chronology is valid; and
- all Canonical construction rules pass.

An open or partially complete interval is rejected rather than emitted as a
partial Bar.

Freshness is evaluated independently for every interval. An old completed Bar
is preserved as `STALE` with `STALE_INTERVAL`; it is never presented as current.

## IEX market-quality semantics

All output records preserve provider `provider:alpaca-basic-iex`.

- Bar coverage is `SINGLE_VENUE`.
- IEX volume remains `BASE_UNITS` share volume.
- IEX volume is not consolidated U.S. market volume.
- IEX Quotes are not NBBO.
- Delivery is recorded as real-time within the selected IEX feed, not as proof
  of full-market observation.

## Provenance and integrity

Every Canonical record binds:

- request identity;
- exact provider symbol;
- Canonical instrument identity;
- IEX feed and single-venue coverage;
- interval when applicable;
- original validated provider row;
- explicit P1D boundary when applicable; and
- adapter and policy versions.

The provider-native content is hashed into a deterministic FNV-1a integrity
reference before crossing the Canonical boundary.

## Fail-closed boundaries

Normalization rejects:

- a rejected or wrong-kind provider response;
- a non-IEX or non-single-venue response;
- missing or substituted mappings;
- invalid timestamps or lifecycle chronology;
- an invalid round-lot policy;
- a current/unclosed Bar;
- a Bar outside the request window;
- a P1D Bar without an exact boundary;
- a future observation; and
- any row that fails Canonical validation.

## Next gate

T3F adds redacted Alpaca credential handles, a one-shot HTTPS transport, and a
default zero-network dry-run. A later T3G may propose one bounded live smoke,
but it must remain separately Owner-authorized and must not widen the fixed
host, endpoint, symbol, feed, request-count, timeout, byte, or no-persistence
boundaries.
