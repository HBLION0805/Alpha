# Market Data Layer Specification v1.0

## Status

D9-T1 foundation is committed and pushed as `52b292748cfac4af63d164b804bff084439b176e`. This specification defines a provider-independent, quote-first boundary. It does not add a live provider, network transport, credential, data store, or market-data consumer.

## Problem Solved and Expected Value

Alpha needs one stable boundary between external provider schemas and internal deterministic systems. Without it, provider symbols, timestamps, number formats, and error behavior could leak into Evidence, Decision, Risk, Replay, or Dashboard code.

The foundation makes provider replacement possible without changing downstream domain contracts. It also ensures that transport success is never confused with valid market data and that rejected data retains a traceable reason.

## Responsibility

The Market Data Layer owns:

- orchestration from explicitly selected provider adapter to accepted canonical data;
- explicit provider identity and capability declarations;
- isolation of raw provider payloads;
- deterministic normalization and validation orchestration;
- observation, publication, receipt, normalization, evaluation, and processing timestamps;
- categorical quality, availability, blocker, and warning results;
- read-only delivery of validated canonical data.

It does not own predictions, evidence sufficiency, recommendations, risk rules, allocation, execution, paper trading, replay storage, strategy review, knowledge approval, UI rendering, or AI interpretation.

## Initial Contract Scope

Version 1.0 service behavior supports a latest two-sided quote path and, from Day10-T2, a separate provider-neutral Bar path. It consumes the shared [Canonical Quote Foundation](CANONICAL_QUOTE.md) and [Canonical Bar Foundation](CANONICAL_BAR.md) as Alpha's only accepted representations. The first Bar implementation is the narrowly bounded [Twelve Data Bar Adapter](TWELVE_DATA_ADAPTER.md). Trades, event-contract quotes, foreign exchange, market status, streaming, and provider orchestration remain deferred.

### Canonical Instrument Identity

Market Data consumes the shared [Canonical Instrument Foundation](CANONICAL_INSTRUMENT.md). A canonical instrument contains an Alpha-owned opaque `instrumentId` and immutable versioned display/classification metadata. Display symbols are labels, not globally unique IDs. Provider symbols and provider instrument IDs remain source metadata and never replace Alpha's canonical ID.

Future alias resolution belongs behind the provider-neutral Instrument Resolver port and an explicit versioned mapping snapshot. D9-T3 defines that port but adds no resolver implementation or live lookup. The current quote request continues to name an already-known canonical instrument ID.

### Fixed-Decimal Values

Prices and quantities use `{ atomicValue, scale }`. `atomicValue` is a base-10 integer string; `scale` gives the number of fractional decimal places. This preserves provider precision without floating-point rounding. Price values must be positive. Sizes, when supplied, must be non-negative and accompanied by the explicit `BASE_UNITS` quantity unit.

Currency is an explicit three-letter uppercase code permitted by the active policy. The layer performs no implicit currency, cents, probability, odds, or unit conversion.

## Time Model

The contract keeps these times distinct:

- `observationTime`: when the market state was observed;
- `providerPublishedAt`: when the provider published it, when supplied;
- `receivedAt`: when the adapter received it;
- `normalizedAt`: when explicit field mapping completed;
- `evaluatedAt`: the caller-supplied deterministic policy evaluation time;
- `processedAt`: when the service produced its result.

All timestamps are canonical UTC ISO-8601 values. Receipt or processing time never substitutes for a missing required observation time. Chronology and optional previous-observation input support deterministic freshness and out-of-order checks.

## Provider Adapter Port and Capability Model

Each adapter declares a stable provider ID, adapter ID/version, enabled state, canonical instrument asset classes, and explicit capabilities. The v1 service requires `LATEST_QUOTE`; health and identity-resolution capabilities remain independently declared.

The D9-T2 [Provider Registry](PROVIDER_REGISTRY.md) is the authoritative discovery source for provider identity, lifecycle metadata, declared capabilities, asset classes, priority, default enablement, and documentation. Adapter descriptors remain implementation compatibility declarations; they are not a competing provider catalog.

The caller selects one provider explicitly. The service does not rank providers, use AI, perform fallback, or merge providers. A missing, disabled, disallowed, unhealthy, or incapable provider returns an explicit result before transport where possible.

The adapter port contains only descriptor and health reads, raw latest-quote retrieval, explicit quote normalization, and safe provider-error normalization. No provider-specific SDK or schema appears in the canonical contract.

## Raw and Normalized Boundary

Raw payloads are opaque and remain inside the adapter boundary. Before normalization, the service passes an immutable copy to the adapter. The public result contains only canonical values, source metadata, validation details, and safe errors. It never contains raw headers, credentials, unrestricted payloads, or provider exceptions.

Normalization maps explicit fields only and either returns a candidate or rejects the payload with blockers. It preserves provider identity, provider instrument references, source reference, and a content-integrity reference. Inferred or repaired values are forbidden unless a future version defines a reviewed deterministic rule.

## Stable Result Envelope

The result separates four stages:

1. transport: `NOT_ATTEMPTED`, `SUCCEEDED`, `FAILED`, or `UNAVAILABLE`;
2. normalization: `NOT_ATTEMPTED`, `NORMALIZED`, or `REJECTED`;
3. validation: `NOT_RUN`, `PASSED`, or `FAILED`;
4. operation result: `ACCEPTED`, `REJECTED`, `UNAVAILABLE`, or `UNSUPPORTED`.

An accepted result includes an immutable Canonical Quote with deterministic identity, fingerprint, timestamps, quality-policy metadata, and bounded provenance. Every result preserves request, provider, capability, policy ID/version, trace metadata, blockers, warnings, and timing metadata. There is no confidence score.

## Validation and Quality Statuses

Validation checks schema, provider identity, instrument identity, provenance, timestamps, freshness, numeric validity, precision, ordering, internal quote consistency, and exact duplicate handling.

Quality is categorical: `VALID`, `INVALID`, `STALE`, `INCOMPLETE`, `UNAVAILABLE`, `UNSUPPORTED`, `OUT_OF_ORDER`, or `CONFLICTING`. A large market move is not automatically invalid; contextual anomaly detection is deferred.

## Fail-Closed Behavior

Canonical data is withheld when any required condition fails, including:

- provider unavailable, disabled, disallowed, or unsupported;
- malformed raw or normalized envelopes;
- missing canonical identity or provenance;
- missing required observation time;
- invalid or ambiguous numeric units, currency, or precision;
- stale, future, or out-of-order observations;
- bid price above ask price;
- exact duplicates rejected by policy;
- explicitly conflicting provider fields.

Invalid data is never converted to a valid empty snapshot. Conflicts are never silently averaged. AI cannot repair, normalize, validate, or override blockers.

## Configuration and Policy

The caller supplies an explicit versioned policy consistent with Alpha configuration conventions. It records allowed providers, required capabilities, duplicate behavior, and per-asset-class quote rules for freshness, timestamp requirement, price precision, and currency.

There is no universal freshness threshold and no new configuration framework. A later Config System adapter may provide these contracts without changing the service.

## Security

- Credentials and provider schemas remain confined to reviewed adapters. The Day10-T2 Twelve Data adapter defines an injected HTTP transport and credential loader but performs no network request during registered validation.
- Adapters must normalize errors into safe bounded fields.
- Raw headers and secret-bearing payloads are not public result fields.
- Provider text is untrusted data and must never be interpreted as an AI instruction.
- Source references and integrity references support traceability without retaining full sensitive payloads.

## Dependency Direction

```text
future external provider
  -> provider adapter
  -> explicit normalization
  -> deterministic validation
  -> canonical Market Data Layer result
  -> future read-only Evidence / Replay / Paper Trading adapters
```

Evidence, Decision, Risk, Replay, and Dashboard code must not import provider clients or provider schemas. Provider adapters must not depend on those domain systems. D9-T1 does not wire any consumer automatically.

## Extension Procedure

A new provider requires a reviewed adapter that implements the existing port, declares only supported capabilities, maps aliases explicitly, normalizes safe errors, and passes contract fixtures. A new data type requires a bounded discriminated canonical contract, type-specific policy and validator, focused tests, and documentation review. Adding a provider must not require business-logic changes.

## Deferred Items

- additional live provider integrations and general runtime credential composition;
- provider fallback, ranking, and multi-provider reconciliation;
- trades, streaming, market status, event-contract quotes, and foreign exchange;
- production persistence and a market timeline database;
- contextual anomaly or bad-tick detection;
- Evidence, Replay, Dashboard, API, and Paper Trading integration;
- AI interpretation, recommendations, broker integration, and execution.
