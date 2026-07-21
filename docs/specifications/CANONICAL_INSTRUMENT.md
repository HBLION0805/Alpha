# Canonical Instrument Foundation Specification v1.0

## Status

D9-T3 foundation is committed and pushed as `c2cb8628ef6315da41e29a3974af7aa1c389ed6c`. It defines Alpha's permanent provider-independent instrument identity, validation, construction, serialization, equality, and resolver port. D9-T4 Canonical Quote and D9-T5 Canonical Bar consume this identity as separate foundations; the instrument subsystem itself still adds no repository, provider mapping, live lookup, market-data operation, network transport, credential, trade, execution, or routing behavior.

## Problem Solved

Symbols are labels, not durable identities. The same display symbol can exist on different venues, a symbol can change, and every provider can use a different alias for the same instrument. If domain records store provider symbols as identity, replacing a provider can split history, corrupt joins, or require business-system migrations.

Alpha therefore owns one immutable opaque canonical instrument ID. Quotes, trades, bars, evidence, decisions, portfolios, and future execution references use that ID rather than a provider alias.

## Responsibility

The Canonical Instrument foundation owns:

- the Alpha canonical instrument record;
- the bounded asset-class, instrument-type, status, and identifier contracts;
- deterministic validation and immutable construction;
- canonical serialization;
- identity equality semantics;
- the provider-neutral resolver request/result port;
- the boundary that prevents provider aliases from entering canonical metadata.

It does not own:

- provider registration or capability metadata;
- provider adapters, SDKs, credentials, endpoints, or transport;
- live symbol, FIGI, ISIN, CUSIP, or exchange lookup;
- quotes, trades, bars, option chains, or derivatives;
- exchange calendars or corporate-action processing;
- portfolio, evidence, decision, risk, routing, execution, or UI behavior;
- production persistence or runtime discovery.

## Identity Model

### Canonical ID

`instrumentId` is an Alpha-owned opaque identifier beginning with `instrument:`. Its remaining value is bounded lowercase opaque text. It must not be derived from a provider symbol, display symbol, exchange, currency, or current classification.

Values such as `AAPL`, `SPY`, `BTC`, `ETH`, and `QQQ` are display symbols. They are not canonical IDs.

The foundation validates caller-supplied IDs but does not generate them. Identifier allocation and durable uniqueness enforcement require a future reviewed repository boundary. Once assigned, an ID is never reused for another instrument.

### Identity Equality

Two canonical records represent the same instrument if and only if their `instrumentId` values match. Display symbol, name, status, classification, and metadata version do not define identity. Full-record equality remains ordinary canonical JSON equality when an exact version comparison is needed.

## Canonical Instrument Contract

One immutable record version contains:

- schema version;
- opaque canonical instrument ID;
- metadata version;
- display symbol;
- display name;
- asset class;
- instrument type;
- lifecycle status;
- three-letter uppercase currency code;
- optional Alpha-canonical exchange code;
- optional canonical timezone text;
- effective-from timestamp.

The record contains no provider ID, provider symbol, provider instrument ID, raw payload, endpoint, credential, or provider-specific extension object.

### Asset Classes

Version 1.0 supports only the classes already required by Alpha's current foundations:

- `EQUITY`;
- `ETF`;
- `CRYPTO`;
- `INDEX`.

Unknown classes fail closed. Foreign exchange, commodities, bonds, options, futures, event contracts, and other derivatives require explicit future contract extensions rather than arbitrary strings.

### Instrument Types

Version 1.0 supports:

- `COMMON_STOCK` for `EQUITY`;
- `EXCHANGE_TRADED_FUND` for `ETF`;
- `CRYPTO_ASSET` for `CRYPTO`;
- `MARKET_INDEX` for `INDEX`.

The validator enforces these pairings. This small mapping avoids a speculative universal security ontology.

### Status

Version 1.0 supports:

- `ACTIVE`;
- `INACTIVE`;
- `DELISTED`;
- `DEPRECATED`.

Status describes the supplied immutable record version. It does not authorize trading and is not a substitute for market status, exchange calendars, risk policy, or execution eligibility.

### Exchange, Currency, and Timezone

Currency is a canonical three-letter uppercase code. The foundation does not perform currency conversion or infer quote currency.

Exchange and timezone are optional because not every canonical instrument has one authoritative listing venue or market timezone. When supplied, exchange is an Alpha-canonical code and timezone is `UTC` or bounded IANA-style text. Version 1.0 validates syntax only; exchange-master and timezone-database verification are deferred.

## Identity Lifecycle

Canonical identity is immutable. Metadata evolution uses a new immutable record version with the same canonical ID, a new `metadataVersion`, and an explicit `effectiveFrom` timestamp.

Examples of metadata evolution include symbol changes, display-name corrections, status changes, or canonical exchange corrections. A later durable repository must append versions and preserve the complete history. It must not update or delete earlier versions in place.

An instrument becoming inactive, delisted, or deprecated does not permit ID reuse. Merger, conversion, or economically distinct successor treatment requires an explicit future lineage model; the foundation does not guess whether two instruments are economically identical.

## Instrument Identifier Boundary

The resolver accepts only a bounded discriminated identifier:

- `CANONICAL_ID` with an Alpha canonical ID; or
- `PROVIDER_SYMBOL` with a provider ID and provider-owned symbol value.

A provider alias exists only in the resolver request and mapping evidence. It never enters the canonical instrument record. Other identifier schemes such as FIGI, ISIN, CUSIP, or exchange-native IDs are unsupported until an explicit extension defines their semantics and validation.

## Resolver Port

`InstrumentResolver.resolve` is a synchronous provider-neutral read port. An implementation must use an explicit local mapping snapshot and return one of:

- `RESOLVED` with exactly one immutable canonical instrument;
- `NOT_FOUND` with no fabricated instrument;
- `AMBIGUOUS` with deterministically ordered candidate canonical IDs;
- `INVALID` for malformed input;
- `UNSUPPORTED` for an identifier scheme the implementation cannot resolve.

The port performs no network request, dynamic provider lookup, runtime reflection, fuzzy matching, AI inference, or automatic symbol repair. Identical request and mapping snapshot must produce identical output.

D9-T3 defines the interface only. No resolver implementation, mapping repository, or provider alias record is introduced.

## Validation and Construction

Validation is deterministic and reports sorted structured issues for:

- malformed records;
- unsupported schema version;
- invalid or non-opaque canonical ID;
- invalid metadata version;
- invalid display symbol or name;
- unsupported or incompatible classification;
- invalid status;
- invalid currency, exchange, or timezone syntax;
- invalid effective timestamp;
- malformed or unsupported resolution identifiers;
- malformed provider identity on a provider-symbol request.

Construction rejects invalid input, copies fields into canonical order, omits absent optional values, and deeply freezes the result. Input objects remain unchanged. Serialization reconstructs and validates the canonical record before emitting deterministic JSON.

## Integration Direction

```text
future provider symbol
  -> future explicit mapping snapshot
  -> Instrument Resolver port
  -> Canonical Instrument
  -> Quote / Trade / Bar / Evidence / Decision / Portfolio references
```

The Market Data Layer now imports the canonical instrument contract and keeps its former `MarketAssetClass` name only as a compatibility alias. The Provider Registry uses canonical instrument asset classes for coverage metadata. Neither integration causes a provider call or resolves a symbol.

Domain systems must not import provider symbol types or provider-native records. Provider adapters may submit resolver identifiers at a future composition boundary, but the returned canonical identity remains the only downstream identity.

## Mapping Philosophy

Future provider mapping must be explicit, versioned, auditable, and reversible. A mapping must preserve at least the provider identity, provider alias, canonical instrument ID, effective interval, source/provenance, and review status without copying those fields into the canonical instrument.

Exact mappings are authoritative only within their approved effective interval. Missing mappings return `NOT_FOUND`. Multiple valid mappings return `AMBIGUOUS`. The resolver cannot guess from similar text, normalize an unknown ticker into an instrument, or use AI to choose a candidate.

Provider replacement changes mapping records and adapters, not canonical IDs or historical domain references.

## Security and Provider Independence

- No API key, credential, endpoint, header, or raw payload is part of the contract.
- Provider symbol text is untrusted input and receives bounded validation.
- Resolver implementations cannot execute text, load modules, or call providers implicitly.
- AI cannot allocate IDs, resolve aliases, repair mappings, or override an ambiguous or missing result.
- Canonical IDs reveal no required provider relationship.

## Extension Procedure

Adding an asset class, instrument type, status, or identifier scheme requires:

1. a documented business need;
2. an explicit bounded contract revision;
3. deterministic validation and compatibility rules;
4. focused tests;
5. dependent-contract review;
6. owner approval.

Arbitrary strings and provider-owned enum values are not extension mechanisms.

## Deferred Work

- canonical ID allocation service and durable uniqueness enforcement;
- append-only instrument repository and history queries;
- resolver implementation and mapping repository;
- provider mapping records and live provider adapters;
- FIGI, ISIN, CUSIP, exchange-native identifier, and corporate-action integration;
- exchange calendars, market sessions, and timezone-database validation;
- options, futures, foreign exchange, commodities, bonds, event contracts, and other derivatives;
- trades, streaming, routing, execution, and Paper Trading; Canonical Quote and Canonical Bar are now separate implemented foundations;
- production persistence, API, Dashboard, and downstream consumer migrations beyond current Market Data contracts.
