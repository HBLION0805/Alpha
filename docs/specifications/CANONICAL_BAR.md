# Canonical Bar Foundation Specification v1.0

## Status and Purpose

D9-T5 foundation is committed and pushed as `0551e2ee20f9ce80ad6608929ed98c49abce77a3`. Canonical Bar defines Alpha's provider-independent OHLCV record before any live provider adapter exists. It is the only canonical bar representation intended for future Research, Evidence, Decision, Replay, Backtesting, Strategy Evaluation, event-market learning, and Portfolio read-only consumers.

This foundation adds contracts, deterministic validation and construction, identity and content comparison, serialization, focused tests, and a type-only Market Data compatibility boundary. It adds no provider adapter, retrieval operation, network transport, credential, streaming, persistence, resampling, consumer wiring, broker behavior, or execution.

## Canonical Ownership

A provider-native bar is untrusted adapter input, not Alpha market truth. Provider schemas, symbols, interval strings, native IDs, headers, and payloads remain inside future adapters. A bar becomes canonical only after explicit field mapping and deterministic validation against this contract.

The embedded [Canonical Instrument](CANONICAL_INSTRUMENT.md) remains authoritative for instrument identity. Provider identity is bounded provenance only. Provider symbols, provider instrument IDs, display symbols, and provider-native bar IDs never enter the canonical Bar record or define its identity.

## OHLCV Contract

One immutable Canonical Bar contains:

- schema version, deterministic Alpha bar ID, and deterministic content fingerprint;
- one immutable Canonical Instrument;
- one bounded canonical interval;
- explicit half-open interval boundaries;
- fixed-decimal open, high, low, close, and volume values;
- explicit currency and `BASE_UNITS` volume unit;
- `FINAL` or `PARTIAL` lifecycle status;
- explicit session metadata;
- explicit adjustment state;
- observation, optional publication, receipt, normalization, and evaluation timestamps;
- versioned quality metadata and sorted reason codes;
- bounded source provenance without a raw payload.

Prices and volume use `{ atomicValue, scale }`. `atomicValue` is a base-10 integer string and `scale` is the number of fractional decimal places. Construction never passes these values through binary floating point and never silently rounds or repairs them.

For the currently supported Alpha asset classes, OHLC values must be non-negative and volume must be non-negative. The high must be greater than or equal to open, low, and close. The low must be less than or equal to open, high, and close. Currency must match the canonical instrument.

## Interval Semantics

Version 1.0 supports a bounded ISO-8601-style representation:

- `PT1M` — one minute;
- `PT5M` — five minutes;
- `PT15M` — fifteen minutes;
- `PT1H` — one hour;
- `P1D` — one session day.

All bars use the half-open convention `[intervalStart, intervalEnd)`: the start belongs to the bar and the end belongs to the next adjacent interval. Intraday boundaries must differ by the exact declared duration. `P1D` is a session-day bucket, not an assumed 24-hour exchange session; it requires explicit session date, type, and timezone, and only enforces that end follows start. This preserves regular, extended, combined, continuous, and still-unknown session contexts without implementing an exchange calendar.

New intervals require a schema revision, deterministic duration or boundary semantics, tests, documentation, and owner approval. Provider strings are not extension values.

## Timestamp Semantics

- `intervalStart`: inclusive start of the represented interval;
- `intervalEnd`: exclusive end of the represented interval;
- `observationTime`: when the provider-observed bar state existed;
- `providerPublishedAt`: when the provider published it, when supplied;
- `receivedAt`: when a future adapter received it;
- `normalizedAt`: when explicit mapping completed;
- `quality.evaluatedAt`: deterministic time used for quality evaluation.

All timestamps are canonical UTC ISO-8601 values. A final bar must be observed at or after its interval end. A partial bar must be observed before interval end. Publication, receipt, normalization, and evaluation must follow in order. Receipt or processing time never substitutes for a missing observation time.

## Status, Quality, and Provenance

Lifecycle and quality remain separate:

- lifecycle: `FINAL` or `PARTIAL`;
- freshness: `CURRENT` or `STALE`;
- delivery: `REAL_TIME`, `DELAYED`, `END_OF_DAY`, or `UNKNOWN`;
- market coverage: `FULL_MARKET`, `SINGLE_VENUE`, `PARTIAL_MARKET`, or `UNKNOWN`;
- derivation: `PROVIDER_REPORTED`, `DERIVED`, or `UNKNOWN`.

The versioned quality policy preserves policy ID/version, evaluation time, maximum observation age, and explicit reason codes. Freshness is derived deterministically; the lifecycle and the `PARTIAL_BAR` reason must agree. Unknown coverage, derived values, and unknown adjustment state must remain visible through their corresponding reason codes. There is no confidence score and no AI quality judgment.

Source metadata records provider ID, adapter ID/version, source reference, and content-integrity reference. It contains no provider symbol, provider instrument ID, raw provider object, provider-native bar ID, endpoint, header, credential, or unrestricted metadata bag.

## Adjustment-State Boundary

Every bar declares one of:

- `RAW`;
- `SPLIT_ADJUSTED`;
- `DIVIDEND_ADJUSTED`;
- `FULLY_ADJUSTED`;
- `UNKNOWN`.

The field prevents raw and adjusted data from being treated as interchangeable. D9-T5 does not calculate, verify, or transform corporate-action adjustments. `UNKNOWN` remains explicit and requires a warning reason; it is never silently interpreted as raw.

## Identity and Equality

`barId` is Alpha-generated deterministically from canonical instrument identity, canonical interval and boundaries, session identity, adjustment state, provider identity, and source reference. Provider-native bar IDs and display symbols do not participate.

Identity equality compares bar IDs. Content equality compares canonical input values. Fingerprint equality compares the stored deterministic fingerprint. A shared identity with changed content exposes a corrected or conflicting source observation rather than hiding it. The FNV-1a fingerprint is a deterministic change detector, not a cryptographic signature.

## Validation and Fail-Closed Behavior

Structured, deterministically ordered issues cover malformed schema, instrument, interval, boundary duration, timestamps, lifecycle, OHLCV values, currency, quantity unit, session, quality, adjustment, provenance, ID, and fingerprint. Malformed bars throw on construction and produce no canonical record. No field is inferred, averaged, rounded, repaired, or completed by AI.

Construction copies fields in canonical order, strips unrecognized provider extensions, sorts reason codes, and deeply freezes the result. Source inputs remain unchanged. Serialization revalidates and reconstructs the record before emitting deterministic JSON.

## Provider Mapping Philosophy

```text
future provider-native bar
  -> provider adapter parser
  -> explicit normalized candidate
  -> deterministic validator
  -> Canonical Bar
  -> future read-only Research / Evidence / Decision / Replay / Backtesting consumers
```

A future adapter must map a verified provider interval, session convention, adjustment state, coverage, and timestamps explicitly. Ambiguous semantics fail closed. Free-tier or provider-specific limitations never change canonical contracts.

## Example

```json
{
  "schemaVersion": "1.0",
  "instrument": { "instrumentId": "instrument:00000000000000000000000001" },
  "interval": "PT5M",
  "intervalStart": "2026-07-20T14:30:00.000Z",
  "intervalEnd": "2026-07-20T14:35:00.000Z",
  "value": {
    "open": { "atomicValue": "2240000", "scale": 4 },
    "high": { "atomicValue": "2245000", "scale": 4 },
    "low": { "atomicValue": "2239000", "scale": 4 },
    "close": { "atomicValue": "2243000", "scale": 4 },
    "volume": { "atomicValue": "12500", "scale": 0 }
  }
}
```

The abbreviated example omits required quality, timing, session, adjustment, and provenance fields for readability. A valid serialized Canonical Bar always contains the complete contract and never contains a provider-native payload.

## Deferred Work

- live provider adapters, HTTP, WebSocket, credentials, and streaming;
- Market Data bar retrieval, provider selection, routing, fallback, caching, and persistence;
- exchange calendars, session calculation, holidays, and timezone-database enforcement;
- corporate-action adjustment calculation or verification;
- trade-to-bar aggregation, resampling, gap filling, corrections, and bulk historical ingestion;
- trade records, order books, market depth, Paper Trading, broker integration, and execution;
- Evidence, Decision, Research, Replay, Backtesting, Strategy Evaluation, Portfolio, API, and Dashboard wiring;
- AI normalization, repair, validation, anomaly detection, or interpretation.
