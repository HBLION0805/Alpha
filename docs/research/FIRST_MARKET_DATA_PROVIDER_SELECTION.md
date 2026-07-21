# First Market Data Provider Selection

Version: 1.1

Task: D9-T3A, reconciled by Day10-T1

Decision model: `MARKET-DATA-PROVIDER-SELECTION-1.1`

Status: **APPROVED WITH CONSTRAINTS**

Evidence access date: 2026-07-20

## 1. Executive Summary

Twelve Data is approved as Alpha's first development market-data provider for a fixture-first, REST-only, U.S. stock/ETF intraday Bar adapter. The approval is deliberately narrow: personal/internal non-commercial use, manually reviewed provider-symbol mappings, bounded historical requests, regular hours, conservative quality classifications, and no live call until a separate owner-approved implementation task.

This is not a claim that Twelve Data is the best provider in every market or the permanent sole provider. It is not approval for SIP, NBBO, full-market execution, public display, redistribution, streaming, persistence, Paper Trading, or brokerage. Massive, Alpaca, and Finnhub remain unscored because their official evidence has not been reviewed in this decision cycle.

The authoritative provider evidence, unresolved semantics, normalization policy, and symbol-mapping policy are recorded in [Twelve Data Official Evidence and Bar Semantics](TWELVE_DATA_OFFICIAL_EVIDENCE_AND_BAR_SEMANTICS.md).

## 2. Alpha Requirements

- Alpha is currently a single-owner personal capital-management system with strong cost controls.
- U.S. listed stocks and ETFs are the first market-data priority.
- Short-term analysis requires bounded intraday historical Bars before it requires streaming.
- Deterministic software performs parsing, normalization, validation, ordering, and quality classification.
- AI cannot repair, infer, or validate market data.
- Provider independence, traceability, fail-closed behavior, and credential isolation are mandatory.
- Market data and future brokerage execution remain separate concerns.
- A future public product requires a separate licensing and architecture review.

## 3. Candidate List

The original candidates remain Massive, Alpaca, Finnhub, and Twelve Data. The current task reviewed only the owner-specified official Twelve Data sources. Candidate presence is not evidence of fitness.

| Provider | Current evidence status | Decision status |
| --- | --- | --- |
| Massive | UNVERIFIED — OFFICIAL SOURCE REQUIRED | NOT EVALUATED |
| Alpaca | UNVERIFIED — OFFICIAL SOURCE REQUIRED | NOT EVALUATED |
| Finnhub | UNVERIFIED — OFFICIAL SOURCE REQUIRED | NOT EVALUATED |
| Twelve Data | Required official evidence reviewed for the bounded development scope | APPROVED WITH CONSTRAINTS |

Unofficial Yahoo Finance libraries are not production candidates. Robinhood is not treated as a general market-data API without official developer evidence. Event-contract providers remain a separate domain.

## 4. Evaluation Method

The original deterministic weights remain unchanged and total 100%:

| Criterion | Weight |
| --- | ---: |
| U.S. stock and ETF data fitness | 20% |
| Data quality and feed transparency | 15% |
| Current cost efficiency | 15% |
| Licensing and future-product safety | 15% |
| API and documentation quality | 10% |
| Alpha architecture fit | 10% |
| Intraday and historical capability | 10% |
| Paper Trading strategic value | 5% |
| **Total** | **100%** |

Scores use integers from 0 to 5 and require official evidence. A failed licensing, authentication, coverage, feed-definition, usage-limit, or normalization gate cannot be outweighed by a numeric total. Unknown facts are not silently scored as zero or replaced by assumptions.

The Day10-T1 review authorizes a bounded engineering choice rather than declaring a cross-provider winner. Since the other candidates remain officially unreviewed, a comparative weighted winner is still not calculated. Twelve Data passes the minimum gates for the stated private-development slice; its limitations are explicit constraints.

## 5. Twelve Data Gate Results

| Mandatory gate | Official result | Gate status | Consequence |
| --- | --- | --- | --- |
| Authentication | API key in query; `Authorization: apikey ...` header recommended | PASS | Future adapter uses a secret-provider boundary and header authentication. |
| U.S. stocks and ETFs | Basic includes real-time U.S. equities/ETFs; listed U.S. universe is represented | PASS WITH COVERAGE CONSTRAINT | OTC excluded; provider mapping must include exchange/MIC and type. |
| Feed definition | Default U.S. real-time feed is about 5% of U.S. trading volume | PASS WITH QUALITY CONSTRAINT | `PARTIAL_MARKET`; never SIP, full market, or NBBO. |
| Intraday historical Bars | `/time_series` supports required 1, 5, 15 minute and 1 hour intervals | PASS | P1D is deferred; requests are bounded and regular-hours only. |
| Usage limits | Basic is 8 API credits/minute and 800/day; `/time_series` is one credit per symbol | PASS | Limits stay in provider policy and must be enforced before live use. |
| Current cost | Basic is free | PASS | No fixed development cost; paid-tier purchase requires owner approval and refreshed evidence. |
| Personal/internal use | Individual plans are personal/internal; Basic is non-commercial | PASS FOR CURRENT STAGE | Public/commercial use is not authorized. |
| Redistribution/public product | Separate business rights/add-ons/attribution apply | FAIL OUTSIDE CURRENT SCOPE | Public-product use requires a new review and license. |
| Provider-independent normalization | Required timestamp, ordering, interval, adjustment, metadata, and error semantics are documented | PASS WITH UNKNOWN DEFAULTS | The adapter must use the Day10-T1 normalization policy and fail closed. |
| Instrument identity | Reference endpoints expose symbol, exchange, currency, and type | PASS WITH MANUAL MAPPING | No symbol guessing or live resolver; use immutable reviewed snapshots. |

## 6. Verified Facts

The full claim-level register is maintained in the Day10-T1 evidence document. The following facts drive this decision:

- Basic costs $0, provides 8 API credits per minute and 800 per day, and has 8 trial WebSocket credits.
- API credits reset each minute; `/time_series` costs one credit per symbol.
- Individual plans are intended for personal/internal use and do not permit redistribution or commercial display to third parties.
- The default real-time U.S. feed covers listed symbols but represents approximately 5% of total U.S. trading volume.
- Historical/EOD U.S. coverage is documented separately from the real-time feed and must not be inherited by intraday records.
- `/time_series` documents OHLCV strings, the Bar-open `datetime`, explicit timezone, ascending/descending order, adjustment modes, exchange, MIC, currency, and asset type.
- The relevant provider intervals include `1min`, `5min`, `15min`, `1h`, and `1day`.
- Extended hours require explicit `prepost=true` and have distinct plan/interval behavior.
- Intraday data is unadjusted; daily/weekly/monthly data is split-adjusted unless an explicit endpoint policy says otherwise.
- Official EOD documentation distinguishes preliminary and confirmed values, and official guidance explains why closes may later differ.

## 7. Evidence Gaps and Constraints

The following facts remain unresolved and cannot be upgraded by inference:

- row-level provider publication timestamp;
- immutable provider Bar record ID;
- record-level duplicate, correction, and partial/final markers;
- exact equity volume unit beyond provider “trading volume” wording;
- permitted persistent cache/retention duration for Alpha's plan;
- correction horizon and immutable-finality guarantee.

Each carries this required status:

**UNRESOLVED — ADAPTER MUST USE CONSERVATIVE UNKNOWN CLASSIFICATION**

The first adapter may be built fixture-first around those gaps. Live canonical acceptance remains blocked for any field whose required Alpha contract cannot be supported without fabrication, particularly equity volume units. Persistent provider-data storage remains blocked until retention rights are clarified.

## 8. Licensing Risk

Approval is limited to the current private, single-owner, internal non-commercial system. The owner must not treat a free or individual plan as permission for public display, third-party access, redistribution, commercial use, or permanent storage.

Before Alpha becomes a public product, the owner must obtain and review the applicable business tier, U.S. Equities or redistribution add-ons, attribution rules, exchange terms, retention rights, and any professional-subscriber obligations. Provider replacement remains a valid outcome.

## 9. Architecture Conclusions

1. Market data and execution remain separate; the first data provider does not become Alpha's broker by default.
2. Paper Trading cannot justify a weaker provider and is not part of the adapter decision.
3. Alpha need not use one provider for every asset class; Provider Registry supports domain-specific providers.
4. Free-tier limits remain provider policy and never leak into canonical contracts.
5. Raw provider objects, symbols, credentials, headers, and errors stay inside the adapter boundary.
6. The first integration begins with REST, not streaming.
7. Canonical Instrument and Canonical Bar are now implemented and authoritative. MarketDataService remains quote-only; the adapter task should add only the smallest Bar request/result operation needed to delegate provider parsing into the existing Canonical Bar constructor. It must not duplicate the model or redesign the service.
8. Provider selection remains explicit composition. The registry does not route, rank, instantiate, or fail over providers.

## 10. Disqualifying Conditions

The Twelve Data approval is suspended if any of these becomes true:

- Alpha's use becomes public, commercial, redistributive, or multi-user without renewed licensing approval;
- the adapter claims SIP, NBBO, full-market, execution-grade, or immutable-final data;
- a provider symbol is used as canonical identity;
- the adapter accepts ambiguous timestamps, identity, units, adjustment, coverage, or provenance;
- a received timestamp substitutes for observation time;
- the API key enters source control, URLs, logs, fixtures, errors, or audit payloads;
- the adapter persists provider data without reviewed retention permission;
- implementation requires provider-native objects outside the adapter, AI repair, hidden fallback, or silent correction overwrite.

## 11. Owner Decisions

Before any bounded live smoke test, the owner must explicitly approve:

1. creation and secret-storage method for the Twelve Data API key;
2. the exact free or paid plan and an operating credit budget;
3. one or two immutable symbol-mapping fixtures;
4. the initial interval subset (`PT1M`, `PT5M`, `PT15M`, or `PT1H`);
5. the request-window and closure-buffer policy;
6. whether official clarification on equity volume units has been obtained;
7. confirmation that no provider data will be persistently retained until retention rights are clarified.

## 12. Proposed Next Adapter Scope

The next task may implement, without calling a live endpoint:

- one Twelve Data registry record and adapter identity;
- one credential-name/configuration contract with no secret value;
- one HTTP transport port and fixture transport;
- `/time_series` intraday Bars only;
- `PT1M`, `PT5M`, `PT15M`, and/or `PT1H` as explicitly approved;
- one or two manually reviewed immutable symbol mappings;
- explicit UTC, ascending order, regular hours, and raw-adjustment request parameters;
- deterministic parsing into the existing Canonical Bar contract;
- safe provider-error translation and fixture tests;
- no streaming, live call, persistence, routing, fallback, quote, execution, or Paper Trading.

## 13. Deferred Work

- official review and comparison of Massive, Alpaca, and Finnhub;
- public-product licensing and redistribution;
- live smoke test and production secret management;
- equity-volume unit resolution;
- provider-data retention and persistence;
- daily/EOD, exchange calendars, extended hours, partial Bars, and adjustment variants;
- correction repository, multi-provider reconciliation, routing, failover, streaming, Paper Trading, and execution.

## 14. Source Register

The complete official source register, claim status, Alpha interpretation, and implementation consequence are maintained in [Twelve Data Official Evidence and Bar Semantics](TWELVE_DATA_OFFICIAL_EVIDENCE_AND_BAR_SEMANTICS.md). No unofficial source is authoritative for this decision.
