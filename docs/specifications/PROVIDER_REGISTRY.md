# Market Data Provider Registry Specification v1.0

## Status

D9-T2 foundation is committed and pushed as `79c4b1fb5f5b6cc7c9988f84df0479bcce87af27`. The registry contains provider metadata only. Day10-T2 contributes the first reviewed record, `provider:twelve-data`, for explicit equity/ETF `BARS` discovery. The registry still does not instantiate adapters, call providers, select a provider, or hold credentials.

## Problem Solved

Alpha needs one canonical discovery source for external market-data provider identity and declared coverage. Without a registry, provider names, capabilities, asset classes, lifecycle state, and enablement could be duplicated across consumers or inferred from adapter implementations.

The registry gives future infrastructure one stable read-only catalog while keeping provider-specific schemas and behavior inside adapters.

## Authority Boundary

The Provider Registry is authoritative for:

- canonical provider ID and display name;
- metadata version and lifecycle status;
- declared market-data capabilities;
- declared supported asset classes;
- static discovery priority;
- default enabled state;
- documentation reference.

Adapter descriptors describe implementation compatibility only. They are not provider discovery authority. Domain systems must depend on provider-neutral registry/read contracts and canonical Market Data results, not provider classes, SDKs, schemas, or adapter instances.

## Provider Metadata Contract

Each record contains:

- schema and metadata versions;
- canonical `providerId` and display name;
- status: `ACTIVE`, `INACTIVE`, `PLANNED`, or `DEPRECATED`;
- a non-empty bounded set of supported asset classes;
- a non-empty bounded set of supported capabilities;
- integer priority from 0 through 10,000;
- `defaultEnabled`;
- a repository-relative documentation reference beneath `docs/`.

Only an `ACTIVE` provider may be enabled by default. Planned, inactive, and deprecated providers remain discoverable through the explicit `ALL` query scope but cannot pass the enabled-provider gate.

No Polygon, Robinhood, Kalshi, BRTI, Coinbase, Yahoo, Finnhub, calendar, or news record is predeclared because their exact capabilities and asset boundaries require reviewed provider-specific adapter work. Twelve Data is registered only after the Day10 official-evidence review and declares only `BARS` for equities and ETFs. Adding guessed metadata would weaken the registry's authority.

## Capability Model

The bounded capability set is:

- `LATEST_QUOTE`;
- `LATEST_TRADE`;
- `BARS`;
- `RESOLVE_INSTRUMENT`;
- `MARKET_STATUS`;
- `HEALTH`.

The registry declares coverage; it does not call or validate a live adapter. Unsupported or unknown capabilities fail explicitly. New capabilities require a contract revision, validation, documentation, and focused tests.

## Asset-Class Model

Provider coverage metadata reuses the [Canonical Instrument Foundation](CANONICAL_INSTRUMENT.md) asset classes: equity, ETF, crypto, and index. The former Market Data asset-class export remains a compatibility alias only. Unknown values and duplicate declarations are rejected. Event contracts, foreign exchange, economic-calendar events, and news require explicit typed extensions rather than being forced into an unrelated asset class.

## Registration and Validation

Registration occurs only when constructing the immutable in-memory registry. There is no runtime registration method, reflection, module scanning, or dynamic import.

Validation rejects:

- malformed identity, versions, status, priority, or documentation references;
- empty, duplicate, or unknown capability declarations;
- empty, duplicate, or unknown asset-class declarations;
- identical repeated registrations;
- conflicting records with the same provider ID;
- duplicate display names when the versioned policy requires uniqueness;
- non-active records marked enabled by default.

Input metadata is copied, normalized, and deeply frozen. Registration order never changes discovery output.

## Read-only Discovery API

The registry supports:

- deterministic listing;
- strict lookup by provider ID;
- an explicit enabled-provider gate;
- capability queries;
- asset-class queries;
- strict capability and asset-class requirements.

Default listing and queries include only active providers enabled by default. `ALL` is an explicit administrative discovery scope. Results are ordered by ascending static priority and then provider ID, deeply immutable, and JSON serializable.

Priority is display/discovery order only. It is not a quality score, dynamic rank, routing instruction, fallback chain, or authorization to select a provider.

## Fail-closed Rules

- Unknown provider ID: `UNKNOWN_PROVIDER`.
- Unknown capability: `UNKNOWN_CAPABILITY`.
- Unknown asset class: `UNKNOWN_ASSET_CLASS`.
- Disabled provider required for use: `PROVIDER_DISABLED`.
- Missing declared capability: `CAPABILITY_UNSUPPORTED`.
- Missing declared asset class: `ASSET_CLASS_UNSUPPORTED`.
- Duplicate or malformed registration: explicit registration error.

Empty query results are valid discovery results; invalid query values are not.

## Dependency Direction

```text
reviewed provider metadata records
  -> Market Data Provider Registry
  -> provider-neutral read-only discovery consumers

future provider implementation
  -> adapter boundary
  -> Market Data normalization and validation
```

The registry does not depend on adapter implementations. Domain systems do not import providers. A future composition root may validate that one adapter implementation matches a registered provider without moving provider metadata into the adapter.

## Security and Determinism

- No credentials, endpoints, SDKs, raw payloads, or headers are registry fields.
- No network, filesystem discovery, reflection, AI, fuzzy matching, or runtime mutation exists.
- Documentation references cannot traverse outside `docs/`.
- Duplicate-name comparison is exact after deterministic case normalization; no semantic matching occurs.

## Extension Procedure

Adding a provider requires one reviewed metadata record with a stable provider ID, verified capability and asset coverage, lifecycle/default-enable decision, priority, documentation, and registry validation. Adding the provider implementation remains a separate adapter task. No registry-engine or domain-system change should be required for a record that uses existing contract values.

## Deferred Work

- real provider metadata records and adapters;
- provider credentials and authentication;
- adapter-to-registry composition validation;
- live health state and health polling;
- runtime enablement configuration;
- automatic selection, routing, fallback, or dynamic ranking;
- streaming and WebSocket support;
- event-contract, economic-calendar, news, and foreign-exchange contract extensions;
- production persistence or remote configuration.
