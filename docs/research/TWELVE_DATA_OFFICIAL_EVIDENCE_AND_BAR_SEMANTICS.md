# Twelve Data Official Evidence and Bar Semantics

Version: 1.0

Task: Day10-T1

Policy ID: `TWELVE-DATA-BAR-NORMALIZATION-1.0`

Decision status: **APPROVED WITH CONSTRAINTS**

Evidence access date: 2026-07-20

## 1. Decision Scope

Twelve Data is approved as Alpha's first **development** market-data provider for a narrow, reversible slice: one explicitly selected provider, REST only, manually reviewed symbol mappings, U.S. listed stocks and ETFs, and bounded historical or delayed intraday Bars. This approval does not authorize an adapter in this task, a live request, public display, redistribution, execution-quality use, full-market claims, NBBO claims, streaming, routing, fallback, persistence, Paper Trading, or broker integration.

The approval applies only to Alpha's current single-owner personal/internal, non-commercial phase. A future public or commercial product requires a new licensing review, appropriate business plan or add-on, attribution review, and owner approval.

## 2. Evidence Method

Every provider fact below is tied to an official Twelve Data source. Alpha distinguishes the provider's factual claim from Alpha's conservative interpretation. Official documentation can establish a usable provider contract, but it does not make the data complete, accurate, immutable, execution-grade, or suitable for every downstream decision.

Evidence statuses:

- `VERIFIED_OFFICIAL`: the cited source directly supports the claim.
- `PARTIALLY_VERIFIED_OFFICIAL`: the source supports only part of the claim or leaves endpoint-specific details unresolved.
- `UNRESOLVED — ADAPTER MUST USE CONSERVATIVE UNKNOWN CLASSIFICATION`: the required official sources do not establish the semantic claim.

## 3. Official Source Register

All sources were accessed on 2026-07-20.

| ID | Official source title | Official URL | Relevant section or endpoint | Evidence status | Alpha interpretation and implementation consequence |
| --- | --- | --- | --- | --- | --- |
| TD-01 | Individual Pricing | https://twelvedata.com/pricing | Basic, Grow, credits, individual-purpose statement | VERIFIED_OFFICIAL | Basic is free with 8 API credits per minute, 800 per day, and 8 trial WebSocket credits. Individual plans are for personal, internal, non-commercial use. Limits remain provider configuration, not canonical data fields. |
| TD-02 | US Equities Market Data | https://support.twelvedata.com/en/articles/9935903-us-equities-market-data | Coverage, licensing, historical/EOD, OTC | VERIFIED_OFFICIAL | Listed U.S. equities are symbolically covered, but the default real-time feed represents about 5% of U.S. trading volume. It is `PARTIAL_MARKET`, never full SIP or NBBO. Historical/EOD coverage is a distinct feed claim. |
| TD-03 | API Documentation | https://twelvedata.com/docs | Authentication and `/time_series` | VERIFIED_OFFICIAL | REST supports API-key query authentication and recommends the `Authorization: apikey ...` header. `/time_series` exposes interval, order, timezone, adjustment, metadata, and OHLCV strings. The credential must remain behind a secret provider and never enter logs or source control. |
| TD-04 | Introduction to Twelve Data | https://support.twelvedata.com/en/articles/5609168-introduction-to-twelve-data | Coverage, intervals, REST/WebSocket | VERIFIED_OFFICIAL | The service supports REST market data across multiple asset classes and intraday/daily intervals. This broad platform claim does not override plan-, market-, or endpoint-specific constraints. |
| TD-05 | Credits | https://support.twelvedata.com/en/articles/5615854-credits | API and WebSocket credits | VERIFIED_OFFICIAL | API credits reset each minute; `/time_series` costs one credit per requested symbol. Basic's separate 800/day limit still applies. |
| TD-06 | Commercial and Personal Usage | https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage | Individual and business plans | VERIFIED_OFFICIAL | Individual plans permit personal/internal use and prohibit redistribution and commercial display to third parties. Business and exchange licensing must be reviewed before public-product use. |
| TD-07 | Terms of Use | https://twelvedata.com/terms | Acceptable use, redistribution, retention, free tier, security | VERIFIED_OFFICIAL | Alpha must not redistribute outside its tier, use free-tier data commercially, exceed limits, share credentials, or cache beyond documented timeframes. Retention duration is not resolved for the proposed adapter and persistent storage remains out of scope. |
| TD-08 | How to Get Historical Prices | https://support.twelvedata.com/en/articles/5656039-how-to-get-historical-prices | Intervals, lookback, date windows | VERIFIED_OFFICIAL | `1min`, `5min`, `15min`, `1h`, and `1day` are available. Intraday history is bounded by provider availability; output windows must be explicit and bounded. |
| TD-09 | Why Close and OHLC Prices Can Differ | https://support.twelvedata.com/en/articles/6374888-why-close-and-ohlc-prices-can-differ | Source, after-hours, adjustments, recalculation | VERIFIED_OFFICIAL | Intraday and daily/EOD values are not interchangeable. Closing auctions, late trades, corrections, after-hours data, source aggregation, and adjustment choices may change apparent values. |
| TD-10 | Pre/Post-Market Data | https://support.twelvedata.com/en/articles/5195429-pre-post-market-data | Extended-hours availability and `prepost` | VERIFIED_OFFICIAL | Extended hours require explicit `prepost=true` and have plan/interval constraints. The first adapter must request regular hours only with `prepost=false`; combined-session data is deferred. |
| TD-11 | How to Find All Available Symbols at Twelve Data | https://support.twelvedata.com/en/articles/5620513-how-to-find-all-available-symbols-at-twelve-data | `/stocks`, `/etf`, reference fields and refresh | VERIFIED_OFFICIAL | Reference data supplies symbol, exchange, currency, and asset type and is refreshed daily in multiple passes. A symbol alone is not Alpha identity and ambiguous symbol-only mapping fails closed. |
| TD-12 | End of Day (EOD) Pricing Market Data | https://support.twelvedata.com/en/articles/12682324-end-of-day-eod-pricing-market-data | EOD fields, availability, preliminary/confirmed data | VERIFIED_OFFICIAL | EOD data is a distinct product with preliminary and later confirmed values. A daily `/time_series` row must not automatically be treated as the final official EOD close. P1D is deferred. |

Additional official semantics used by this policy:

| ID | Official source title | Official URL | Relevant section | Evidence status | Consequence |
| --- | --- | --- | --- | --- | --- |
| TD-13 | Timezones | https://support.twelvedata.com/en/articles/5745849-timezones | Default timezones and `timezone` parameter | VERIFIED_OFFICIAL | Intraday requests must explicitly use `timezone=UTC`; Alpha never parses provider-local timestamps using the local machine timezone. |
| TD-14 | Are the prices adjusted? | https://support.twelvedata.com/en/articles/5179064-are-the-prices-adjusted | Split and dividend adjustment | VERIFIED_OFFICIAL | Intraday prices are unadjusted; daily, weekly, and monthly prices are split-adjusted. Alpha still sends an explicit `adjust` value and never relies on the provider default. |
| TD-15 | Data Delays | https://support.twelvedata.com/en/articles/5203307-data-delays | REST candle latency | VERIFIED_OFFICIAL | REST candles are typically available 0.3 to 2 minutes after close. The first adapter uses a versioned closure buffer and never accepts the current open interval as final. |
| TD-16 | Getting Historical Data | https://support.twelvedata.com/en/articles/5214728-getting-historical-data | `start_date`, `end_date`, `outputsize` | VERIFIED_OFFICIAL | `end_date` is a maximum datetime and `outputsize` bounds rows. Requests must specify deterministic windows and never assume that `start_date` alone guarantees the desired range. |

## 4. Verified Provider Facts

### Pricing and Limits

- Basic costs $0 and includes 8 API credits per minute, 800 API credits per day, and 8 trial WebSocket credits.
- API credits regenerate each minute; the Basic daily limit is a separate ceiling.
- `/time_series` consumes one API credit per requested symbol.
- Paid Grow and higher tiers remove the daily API limit, but their pricing and included markets may change and must be rechecked before purchase.
- Trial WebSocket access is not approval for streaming. The first adapter is REST only.

### U.S. Equity Coverage

- Twelve Data states that listed U.S. equities across U.S. exchanges are present in its symbol universe; OTC is excluded by default.
- The default real-time U.S. feed represents approximately 5% of total U.S. trading volume and is not a consolidated full-market feed.
- Alpha must classify that feed as `PARTIAL_MARKET`. It must never claim full SIP, full-market coverage, or NBBO.
- The provider separately states that next-trading-day historical/EOD U.S. data covers 100% of U.S. trading volume. Alpha treats that as an endpoint- and timing-specific claim, not a property inherited by intraday real-time Bars.

### Licensing

- Individual plans are limited to personal/internal use and do not grant redistribution or commercial display to third parties.
- Basic/free data cannot be used commercially.
- External distribution, public display, white-label use, or redistribution requires a separately reviewed business tier, add-on, exchange terms, and attribution obligations.
- The terms restrict storage or caching beyond documentation-defined periods. Because the reviewed sources do not establish the retention period for Alpha's proposed Bar cache, persistent provider-data storage remains prohibited until clarified.

### Bar and Symbol Semantics

- `/time_series` supplies OHLC strings and, where applicable, a volume string.
- `datetime` identifies when the bar opened. With `timezone=UTC`, intraday rows can map to canonical UTC interval starts.
- `order=asc` and `order=desc` are supported; Alpha requests ascending order and still sorts canonically.
- The initial interval mapping can support 1, 5, and 15 minutes and 1 hour. Although 1 day is supported by Twelve Data, Alpha defers it because exchange-session boundaries and official EOD confirmation require a separate policy.
- Provider symbol metadata includes exchange and MIC where available, currency, and asset type. Symbol-only identity remains insufficient.

## 5. Unresolved Provider Facts

The reviewed sources do not establish all record-level semantics needed for stronger classifications:

| Question | Status | Required adapter behavior |
| --- | --- | --- |
| Provider publication timestamp for each `/time_series` row | UNRESOLVED — ADAPTER MUST USE CONSERVATIVE UNKNOWN CLASSIFICATION | Omit `providerPublishedAt`; never substitute `receivedAt`. |
| Immutable provider record ID for each Bar | UNRESOLVED — ADAPTER MUST USE CONSERVATIVE UNKNOWN CLASSIFICATION | Use the adapter-owned non-content source-reference policy below and record that it is not a provider ID. |
| Record-level correction or revision marker | UNRESOLVED — ADAPTER MUST USE CONSERVATIVE UNKNOWN CLASSIFICATION | Same source reference plus changed fingerprint is a correction candidate; never overwrite history silently. |
| Duplicate-record identifier or sequence | UNRESOLVED — ADAPTER MUST USE CONSERVATIVE UNKNOWN CLASSIFICATION | Deduplicate only by stable source reference plus identical content fingerprint. |
| Explicit partial/final flag in `/time_series` | UNRESOLVED — ADAPTER MUST USE CONSERVATIVE UNKNOWN CLASSIFICATION | Do not ingest the current/open interval; accept only intervals closed beyond the policy buffer. |
| Exact equity volume unit beyond “trading volume” | UNRESOLVED — ADAPTER MUST USE CONSERVATIVE UNKNOWN CLASSIFICATION | Live acceptance remains blocked until a reviewed fixture and official clarification support `BASE_UNITS`; fixture-only development may preserve the raw decimal and warning without claiming execution-grade volume. |
| Endpoint-specific real-time versus delayed flag | UNRESOLVED — ADAPTER MUST USE CONSERVATIVE UNKNOWN CLASSIFICATION | REST Bars use `DELAYED` only under the documented candle-latency policy; otherwise use `UNKNOWN`. |
| Endpoint-specific market coverage outside default U.S. intraday feed | UNRESOLVED — ADAPTER MUST USE CONSERVATIVE UNKNOWN CLASSIFICATION | Use `UNKNOWN`; do not inherit the real-time or EOD coverage claim across endpoints. |
| Guaranteed correction horizon and finality | UNRESOLVED — ADAPTER MUST USE CONSERVATIVE UNKNOWN CLASSIFICATION | `FINAL` means closed under Alpha's retrieval policy, not immutable or immune from later correction. |
| Permitted cache/retention duration | UNRESOLVED — ADAPTER MUST USE CONSERVATIVE UNKNOWN CLASSIFICATION | No persistent Twelve Data Bar store until the owner obtains official clarification or plan-specific terms. |

These unresolved facts do not block fixture-first adapter construction. Volume-unit confirmation and retention terms block live canonical acceptance and persistent storage respectively.

## 6. Twelve Data Bar Normalization Policy

### 6.1 Request Envelope

The first adapter is limited to one explicitly selected Twelve Data provider record, one manually approved mapping, REST `/time_series`, U.S. stocks or ETFs, regular hours, and bounded historical intraday windows. It must send explicit values for:

- `symbol` and `exchange` or another reviewed provider discriminator from the mapping snapshot;
- `interval`;
- `timezone=UTC`;
- `order=asc`;
- `prepost=false`;
- `adjust=none` for the initial raw intraday slice;
- explicit `start_date` and `end_date`, plus a configured `outputsize` no greater than the provider maximum.

Authentication uses the recommended `Authorization: apikey ...` header through a future secret-provider boundary. The key must not appear in URLs, fixtures, errors, logs, audit payloads, or source control.

### 6.2 Interval Mapping

| Twelve Data interval | Canonical interval | Initial adapter status |
| --- | --- | --- |
| `1min` | `PT1M` | Allowed |
| `5min` | `PT5M` | Allowed |
| `15min` | `PT15M` | Allowed |
| `1h` | `PT1H` | Allowed |
| `1day` | `P1D` | Deferred pending session-calendar and confirmed-EOD policy |

No unsupported provider interval is approximated, resampled, or rounded into a canonical interval.

### 6.3 Time and Lifecycle

- The provider `datetime` is interpreted as interval open, as documented by `/time_series`.
- Intraday requests force UTC. The adapter parses the returned value against the explicit UTC request and rejects malformed, offset-ambiguous, or absent timestamps.
- Canonical boundaries are `[intervalStart, intervalEnd)`. `intervalEnd` is derived only by adding the exact canonical intraday duration.
- Rows must match the requested interval duration and appear within the approved request window.
- `observationTime` is the interval end for a closed historical Bar, representing the earliest deterministic instant at which the complete interval could exist. This is a documented Alpha derivation; it is not provider publication time. `receivedAt` never substitutes for it.
- `providerPublishedAt` remains absent because `/time_series` does not expose a row-level publication timestamp in the reviewed evidence.
- A Bar is eligible for canonical `FINAL` only when its interval ended before `receivedAt` by at least the versioned closure buffer. The initial policy minimum is two minutes, matching the upper bound of the provider's stated typical REST candle delay. `FINAL` means closed under this policy, not correction-proof.
- The open interval and intervals inside the closure buffer are rejected from the initial adapter rather than guessed as `PARTIAL`, because the response lacks a record-level partial flag and observation timestamp.
- P1D is not accepted. A daily `/time_series` record is not automatically an official confirmed EOD close.

### 6.4 Session Classification

- With `prepost=false`, U.S. stock and ETF Bars may be classified `REGULAR` only when their boundaries fall inside a separately reviewed exchange-session window for the mapped venue.
- Day10-T1 does not implement an exchange calendar. Fixtures use explicit known session metadata; a later live smoke test requires a reviewed calendar/session boundary or must use `UNKNOWN` session and fail any consumer that requires regular-session proof.
- `EXTENDED` and `COMBINED` are deferred. Provider extended-hours records must not be mixed into regular-session Bars.

### 6.5 Values, Adjustment, and Quality

- OHLCV strings are parsed to Alpha fixed-decimal values without floating-point arithmetic, silent rounding, or inferred precision.
- Missing, null, non-finite, negative, or structurally invalid OHLCV values fail closed. Existing Canonical Bar OHLC relationships remain authoritative.
- `adjust=none` plus the official intraday adjustment documentation permits `RAW` for this slice. Other adjustment modes are deferred; absent adjustment evidence maps to `UNKNOWN` with the required warning.
- Volume is preserved exactly. Because official evidence does not explicitly define the equity unit as shares/base units, live canonical acceptance remains blocked pending clarification; no volume-derived decision is authorized.
- U.S. intraday real-time market coverage is `PARTIAL_MARKET`; unverified endpoint/feed combinations are `UNKNOWN`.
- REST candle delivery can be `DELAYED` when the documented closed-candle policy applies; otherwise it is `UNKNOWN`.
- Values parsed directly from provider OHLCV fields are `PROVIDER_REPORTED`. Adapter-derived timestamps or boundaries must remain traceable and must not upgrade market coverage or finality.
- Canonical normalization standardizes structure, not data quality. It creates no confidence score and makes no accuracy, completeness, NBBO, or execution-quality claim.

### 6.6 Identity, Duplicates, and Corrections

The reviewed endpoint does not provide an immutable row ID. The adapter may create this deterministic source reference:

```text
twelve-data-bar:v1:{providerId}:{canonicalInstrumentId}:{providerExchangeOrMic}:{providerInterval}:{intervalStartUtc}:{sessionMode}:{adjustmentMode}
```

This is an Alpha adapter-owned logical source reference, not a Twelve Data record identifier. Every component must come from the approved request and immutable symbol mapping. OHLCV values, receipt time, normalization time, and content fingerprint are excluded.

- Same source reference plus same canonical fingerprint: exact duplicate; return one deterministic record and preserve a duplicate warning/count outside identity.
- Same source reference plus changed fingerprint: correction or conflict candidate; retain the logical Bar identity, preserve both observations in any future append-only store, and require deterministic latest-observation policy before consumer use.
- Different stable identity fields: different logical Bar.
- Output is sorted by `intervalStart`, then canonical Bar ID. Provider response order is never trusted as the sole ordering guarantee.

### 6.7 Bounded Windows and Failure Behavior

- The adapter policy must set `maxRecords`, `maxLookback`, timeout, and credit budget below provider limits. Day10-T1 does not choose operational values beyond the provider's documented 5,000-record maximum.
- Empty `values`, missing `meta`, metadata mismatch, missing required fields, unsupported interval, ambiguous identity, status other than documented success, or window overflow fails closed.
- Provider errors are normalized without raw headers, secrets, or unbounded payloads.
- No retry, cache, persistence, routing, fallback, or automatic provider selection is authorized by this policy.

## 7. Minimal Immutable Symbol-Mapping Policy

Policy ID: `PROVIDER-SYMBOL-MAPPING-1.0`.

Each mapping snapshot contains:

| Field | Rule |
| --- | --- |
| `mappingId` | Alpha-owned deterministic ID over provider, canonical instrument, provider symbol, exchange/MIC, asset type, effective-from, and mapping version; no display-only label. |
| `providerId` | Exact Provider Registry ID for Twelve Data. |
| `providerSymbol` | Provider-native symbol preserved only in the adapter boundary. |
| `providerExchangeId` | Exchange or MIC from reviewed reference evidence when available; required when symbol-only identity can be ambiguous. |
| `providerAssetType` | Reviewed provider asset type when available. |
| `canonicalInstrumentId` | Existing Alpha Canonical Instrument ID. |
| `effectiveFrom` | Explicit UTC timestamp. |
| `effectiveTo` | Optional UTC timestamp; a new snapshot closes applicability without editing history. |
| `mappingVersion` | Monotonic version within the stable mapping lineage. |
| `sourceReference` | Official reference endpoint/snapshot identifier or owner-reviewed fixture reference; never a credential-bearing URL. |
| `evidenceStatus` | `VERIFIED_OFFICIAL`, `OWNER_REVIEWED_FIXTURE`, or fail-closed unresolved status. |
| `reviewStatus` | `PENDING`, `APPROVED`, `REJECTED`, or `SUPERSEDED`; only `APPROVED` is usable. |

Rules:

- A provider symbol is never a Canonical Instrument ID, and a display symbol is never assumed to be a provider symbol.
- Symbol-only matching fails closed whenever more than one venue, instrument type, currency, or active reference row can match.
- Snapshots are immutable and mapping history is append-only. Corrections create a new version and may supersede the old snapshot.
- Resolution is exact over the approved snapshot. No fuzzy matching, AI inference, runtime guessing, or live symbol lookup is allowed.
- The first fixture-first adapter needs only one or two owner-reviewed mappings. A general Instrument Repository is not required.

Documentation-only examples:

| Provider | Provider symbol | Exchange/MIC | Provider type | Canonical instrument | Status |
| --- | --- | --- | --- | --- | --- |
| Twelve Data | `AAPL` | `NASDAQ` / `XNAS` | `Common Stock` | example Alpha AAPL instrument ID | Example only; not a runtime record |
| Twelve Data | `SPY` | reviewed exchange/MIC required | `ETF` | example Alpha SPY instrument ID | Example only; unresolved until reviewed |

## 8. Approval Constraints and Blocking Issues

Twelve Data remains approved only while all of these constraints hold:

1. Personal/internal, non-commercial use only under the applicable individual plan.
2. REST and bounded intraday historical Bars only; no streaming or quote path.
3. Explicit caller-selected provider; no routing, ranking, or fallback.
4. Default U.S. intraday coverage is `PARTIAL_MARKET`; never SIP, NBBO, or execution-grade.
5. Regular hours only; P1D and extended hours remain deferred.
6. Explicit UTC, ascending order, and adjustment request parameters.
7. Manually reviewed immutable symbol mapping; no symbol guessing.
8. No provider data persistence until retention rights are clarified.
9. No live canonical acceptance of equity volume until its unit is officially clarified or the canonical quantity policy is separately approved.
10. Credentials remain outside source control and no live endpoint is called before a separately approved implementation task.

Any public product, commercial use, redistribution, persistent dataset, execution consumer, full-market requirement, or materially different endpoint invalidates this approval scope and requires renewed evidence review.

## 9. Architecture Boundary

The approved future dependency direction is:

```text
Owner-approved Provider Symbol Mapping snapshot
  -> Twelve Data fixture or future REST adapter
  -> provider payload parser
  -> Day10-T1 normalization policy
  -> existing Canonical Bar constructor and validator
  -> future read-only consumer
```

Provider-specific payloads, symbols, authentication, plan limits, and error formats remain inside the adapter. Existing Canonical Instrument, Canonical Bar, Market Data, Provider Registry, Evidence, Decision, Risk, Replay, and Portfolio contracts remain provider-independent and authoritative for their own domains.

## 10. Deferred Work

- adapter code, transport, credentials, and live endpoint access;
- provider registry record and runtime composition;
- official equity-volume unit clarification;
- retention/caching permission and persistent storage;
- P1D, confirmed EOD, exchange calendar, and corporate-action reconciliation;
- partial/current interval ingestion;
- extended hours and session merging;
- adjusted Bar variants;
- correction history repository and multi-provider conflict policy;
- WebSocket, streaming, routing, fallback, Paper Trading, broker integration, and execution;
- public display, redistribution, business licensing, and attribution implementation.
