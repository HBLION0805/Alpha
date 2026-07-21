# Canonical Quote Foundation Specification v1.0

## Status

D9-T4 foundation implemented locally for owner review. It defines Alpha's only provider-independent accepted quote representation, deterministic validation and construction, serialization, equality, and immutable quality/provenance metadata. It adds no provider adapter, network transport, credential, streaming, trade, bar, execution, routing, or persistence behavior.

## Philosophy and Responsibility

A provider response is not canonical market truth. Provider schemas remain inside adapters; only explicitly normalized and validated fields may become a Canonical Quote. The quote foundation owns the accepted quote contract and its invariants. The Market Data Layer remains responsible for provider orchestration, normalization candidates, operation-level failures, and policy application.

Version 1.0 models one two-sided top-of-market observation: one bid and one ask, with optional size at both sides. It is not an order book and carries no depth. An invalid, stale, unavailable, unsupported, or ambiguous provider response is not repaired or represented as a valid empty quote.

## Canonical Contract

An immutable Canonical Quote contains:

- schema version, deterministic quote ID, and deterministic content fingerprint;
- one immutable [Canonical Instrument](CANONICAL_INSTRUMENT.md);
- bid and ask fixed-decimal prices;
- optional bid and ask fixed-decimal sizes with an explicit `BASE_UNITS` quantity unit;
- explicit quote currency matching the instrument currency;
- `CURRENT` or `STALE` status;
- observation, optional provider publication, receipt, and normalization timestamps;
- versioned quality-policy metadata and bounded reason codes;
- bounded provider/adapter provenance without a raw payload.

No provider-native response object, arbitrary extension object, credential, endpoint, header, AI result, recommendation, risk calculation, or execution instruction is part of the contract.

## Quote Identity and Equality

`quoteId` is derived deterministically from canonical instrument ID, provider ID, observation time, and source reference. It identifies one reported source observation. The content fingerprint covers the full canonical input and changes when accepted content or metadata changes.

Identity equality compares quote IDs. Content equality compares fingerprints. Two records may therefore describe the same source observation while revealing different content, which exposes a correction or conflicting normalization instead of hiding it. Neither identifier is a security signature; production integrity signing is deferred.

## Fixed-Decimal Semantics

Prices and quantities use `{ atomicValue, scale }`, where `atomicValue` is a base-10 integer string and `scale` is the number of fractional decimal places. Prices must be positive. Sizes, when present, must be non-negative. Both sizes and the explicit quantity unit are supplied together or omitted together.

The validator never parses prices through binary floating point, silently rounds them, infers units, or converts currencies, cents, probabilities, prices, or odds. Bid price must not exceed ask price.

## Timestamp Semantics

- `observationTime`: when the quoted market state was observed; always required;
- `providerPublishedAt`: when the provider published the observation, when supplied;
- `receivedAt`: when the adapter received it;
- `normalizedAt`: when explicit normalization completed;
- `quality.evaluatedAt`: the deterministic time used to classify freshness.

All timestamps are canonical UTC ISO-8601 values. Required chronology is observation, optional publication, receipt, normalization, then quality evaluation. Receipt or processing time never substitutes for observation time.

## Status and Quality Metadata

The canonical status is deliberately small:

- `CURRENT`: observation age is within the active maximum age;
- `STALE`: observation age exceeds that explicit threshold.

Quality metadata preserves policy ID/version, evaluation time, maximum age in seconds, and sorted unique reason codes. Version 1.0 uses `STALE_OBSERVATION` and `MISSING_SIZE`. Freshness is calculated deterministically from observation time and evaluation time. The status must agree with that calculation; blockers cannot be averaged away and no confidence score exists.

Market Data operation statuses such as invalid, incomplete, unavailable, unsupported, out-of-order, or conflicting remain in the Market Data result envelope. Those candidates fail before canonical construction rather than becoming malformed Canonical Quotes.

## Validation and Construction

Validation reports deterministically ordered structured issues for malformed schema, identifiers, instrument records, decimals, units, currency, timestamps, chronology, quality policy, freshness classification, source provenance, quote ID, and fingerprint. Construction validates, copies fields in canonical order, omits absent optional values, and deeply freezes the result. Source inputs remain unchanged.

Serialization reconstructs and validates the quote before producing deterministic JSON. Provider-specific extra properties are discarded by canonical construction and cannot leak into the public quote.

## Provider Independence and Future Adapter Mapping

```text
future provider payload
  -> provider adapter
  -> explicit normalized candidate
  -> Market Data deterministic validation
  -> Canonical Quote construction
  -> future Evidence / Decision / Risk / Portfolio read-only consumers
```

Adapters may preserve bounded provider aliases and source references as provenance, but the embedded Alpha-owned canonical instrument remains the quote identity. Adding or replacing a provider changes its adapter and mappings, not the canonical quote contract or downstream business logic.

## Extension Procedure

A new quote kind or quality reason requires a documented consumer need, a bounded versioned contract change, deterministic validation rules, compatibility review, focused tests, and owner approval. Provider-owned fields and arbitrary metadata bags are not extension mechanisms.

## Deferred Work

- live provider adapters, credentials, HTTP, WebSocket, and streaming;
- bid/ask books, market depth, trades, bars, snapshots, market status, and event-contract quote extensions;
- corporate actions, exchange calendars, provider correction feeds, and contextual anomaly detection;
- cross-provider reconciliation, routing, fallback, and automatic provider selection;
- production persistence, signing, API, Dashboard, Evidence integration, Paper Trading, broker integration, and execution;
- AI normalization, repair, validation, provider selection, or interpretation.
