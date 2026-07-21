# Twelve Data Bar Adapter Specification v1.0

## Status

Day10-T2 implements Alpha's first provider-specific fixture adapter foundation for Twelve Data REST `time_series` Bars. It adds a provider-specific request, parser, validator, normalizer, credential boundary, and MarketDataService Bar path. It is not live-connected: no concrete HTTP transport or network request exists, and it adds no provider SDK, persistence, streaming, routing, failover, trading, or execution.

The governing evidence and normalization policy is [Twelve Data Official Evidence and Bar Semantics Review](../research/TWELVE_DATA_OFFICIAL_EVIDENCE_AND_BAR_SEMANTICS.md), policy `TWELVE-DATA-BAR-NORMALIZATION-1.0`.

## Responsibility and Boundary

```text
TWELVE_DATA_API_KEY environment value
  -> injected TwelveDataHttpTransport
  -> bounded raw HTTP response
  -> TwelveDataResponseParser
  -> TwelveDataResponseValidator
  -> TwelveDataBarNormalizer
  -> Canonical Bar
  -> MarketDataService read result
```

Provider-native endpoint, credential, raw-response, row, parser, validator, and normalizer contracts stay inside `src/integration/market-data/twelve-data/` and are not re-exported from Alpha's shared-contract barrel. The integration barrel exposes only the narrow composition surface; tests reach internals by direct module import. Canonical consumers receive only validated [Canonical Bars](CANONICAL_BAR.md). Evidence, Decision, Risk, Replay, Portfolio, and Dashboard code do not import Twelve Data contracts.

## Provider Metadata

The adapter contributes one reviewed Provider Registry record:

- provider ID: `provider:twelve-data`;
- capability: `BARS`;
- asset classes: `EQUITY` and `ETF`;
- status: active and enabled for explicit discovery;
- priority: static discovery order only, never routing or quality rank.

The Provider Registry stores authoritative metadata only. It does not instantiate this adapter or load credentials. The separate composition boundary verifies that the Bar adapter's provider ID, capability, intervals, and asset classes agree with the registry record before the facade can use it.

## Credentials and HTTP Transport

Credentials load only from `TWELVE_DATA_API_KEY`. Missing, short, whitespace-bearing, or malformed values fail closed. The deterministic request object never contains the key, an `apikey` query parameter, raw headers, or a printable authorization value.

`TwelveDataHttpTransport` is an injected port. It receives the immutable request and credential separately so a composition root can place the key in the provider-approved `Authorization: apikey ...` header without exposing it to URLs, logs, results, fixtures, or audit records. Day10-T2 adds no SDK and runs no live call.

## Deterministic Request Construction

The only endpoint is `https://api.twelvedata.com/time_series`. Query keys are sorted and explicit:

- reviewed `symbol` and `exchange`;
- `interval` mapped from `PT1M`, `PT5M`, `PT15M`, or `PT1H`;
- `timezone=UTC`;
- `order=asc`;
- `prepost=false`;
- `adjust=none`;
- explicit `start_date`, `end_date`, and bounded `outputsize`.

Daily Bars, implicit windows, provider default timezone, extended hours, adjustments, retries, and unbounded output are rejected or deferred.

## Instrument Mapping

Mappings are explicit, versioned, immutable inputs. Resolution is exact by canonical instrument ID; there is no symbol guessing, live discovery, fuzzy matching, or AI.

AAPL/NASDAQ/XNAS is the sole built-in approved fixture mapping. SPY is an allowed fixture symbol, but the governing review still requires its exchange/MIC to be supplied through a separately reviewed mapping at composition time. Tests use an explicitly labeled owner-reviewed test mapping and do not promote it to production metadata.

## Parser

The parser accepts a bounded JSON object only. Empty, malformed, non-object, or oversized responses are rejected. It performs no repair, coercion, inference, or AI interpretation.

## Response Validator

The validator checks:

- provider `status` and safe error translation;
- exact symbol, exchange, optional MIC, interval, currency, and asset type against the reviewed mapping;
- non-empty `values`;
- strict UTC wall-clock `datetime` shape;
- non-negative decimal-string OHLCV fields.

Unknown provider-native fields are stripped. Provider error messages and raw payloads do not appear in public Market Data results.

## Bar Normalizer

Provider `datetime` is treated as the interval open only because the request forces UTC. Canonical intervals are half-open `[start, end)`. `observationTime` is the derived interval end for an eligible closed historical Bar; `providerPublishedAt` is omitted because the response does not provide it.

The normalizer:

- preserves decimal precision using `{ atomicValue, scale }` without floating-point arithmetic;
- uses `RAW` adjustment for `adjust=none`;
- uses `DELAYED`, `PARTIAL_MARKET`, and `PROVIDER_REPORTED` quality classifications;
- uses `UNKNOWN` session because no exchange-calendar proof is implemented;
- rejects rows outside the request window;
- rejects open or closure-buffer Bars using a policy minimum of 120 seconds;
- validates through the authoritative Canonical Bar constructor;
- sorts by interval start and Bar ID;
- deduplicates identical rows, reports the exact duplicate count and warning, and rejects conflicting content for one logical Bar;
- preserves an adapter-owned source reference and content fingerprint.

Canonical normalization standardizes structure; it does not upgrade source coverage or accuracy.

## Volume Evidence Gate

Official evidence does not yet prove that every relevant live equity `volume` value satisfies Alpha's canonical `BASE_UNITS` meaning. Therefore:

- fixture normalization requires explicit `FIXTURE_REVIEWED` volume evidence;
- live normalization requires `OFFICIALLY_VERIFIED` volume evidence;
- `UNRESOLVED` volume evidence always fails closed;
- narrative quality, provider success, or other fields cannot bypass this gate.

This prevents the first adapter from fabricating unit certainty.

## MarketDataService Integration

`MarketDataService.getBars` delegates to the capability-specific Bar orchestrator. The orchestrator checks authoritative registry status/enablement, declared and policy-required capabilities, registry and adapter asset classes, adapter interval support, health, bounded window and record policy, returned-record limits, duplicate reporting, chronological ordering, and every Canonical Bar before returning an immutable deterministic result. Accepted results always contain explicit passed validation dimensions.

The request distinguishes `HISTORICAL` from `INTRADAY`. Stale intraday results fail closed and withhold Bars. Historical results may remain available as explicitly `STALE` historical evidence; they are never relabeled current.

Transport success, parsing, provider validation, normalization, canonical validation, and acceptance remain separate. A successful HTTP response does not imply valid data.

## Optional Bounded Smoke Policy

A later manually composed live smoke adapter must be governed by one explicit versioned policy containing:

- the single allowed provider and approved official-evidence references;
- an allow-list of reviewed symbols and supported intervals;
- a maximum lookback window, returned-record limit of at most 20 Bars, and maximum API-credit budget per run;
- `MANUAL_ONE_SHOT` execution only;
- explicit prohibitions on polling, persistence, and secret logging.

Construction fails closed when any smoke-policy control is missing or exceeded. The smoke path still requires credentials outside source control and the live volume evidence gate. No concrete live transport or smoke execution exists in this milestone.

## Security

- No credential value is committed, logged, serialized, or placed in a query string.
- No provider SDK or ambient network client is imported.
- Raw headers are not part of contracts.
- Provider messages are treated as untrusted data and normalized to bounded safe errors.
- Provider text cannot become AI instructions.
- Source and content references contain no secret-bearing material.

## Replacement and Extension

A future provider implements the provider-neutral Bar adapter port, contributes reviewed registry metadata, uses its own private parser and validator, and returns the same Canonical Bar contract. Replacing Twelve Data must not change business logic.

Extending Twelve Data requires official evidence, a versioned mapping/policy change, fixtures, focused tests, and owner review. New intervals, Quotes, Trades, streaming, or asset classes are separate tasks.

## Deferred

- concrete live HTTP composition and owner-approved smoke execution;
- official live equity-volume unit resolution;
- built-in reviewed SPY exchange/MIC mapping;
- `P1D` and exchange-calendar/session validation;
- Quotes, Trades, WebSocket, streaming, retries, routing, failover, caching, and persistence;
- Evidence, Replay, Paper Trading, Dashboard, broker, and execution integration.
