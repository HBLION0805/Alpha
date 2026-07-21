# First Market Data Provider Selection

Version: 1.0
Task: D9-T3A
Decision model: `MARKET-DATA-PROVIDER-SELECTION-1.0`
Status: **PENDING OFFICIAL EVIDENCE REVIEW**
Date: 2026-07-20

## 1. Executive Summary

Alpha is not yet authorized to select or implement its first live market-data provider. No official provider sources were supplied with D9-T3A or already registered in the repository, so every current provider-specific claim remains:

**UNVERIFIED — OFFICIAL SOURCE REQUIRED**

This document establishes a deterministic, evidence-gated comparison method for Massive, Alpaca, Finnhub, and Twelve Data. It separates owner requirements, verified repository facts, provider facts, assumptions, unknowns, architecture implications, and recommendation criteria. Missing evidence is not scored as zero and is not replaced by memory, popularity, inference, or an unofficial source.

The first provider must pass every mandatory gate before it can be recommended. Among providers that pass, Alpha will calculate a transparent weighted score out of 100. An unresolved licensing, authentication, coverage, feed-definition, pricing, or usage-limit gate disqualifies a provider from recommendation regardless of its provisional score.

The first implementation should use a small REST boundary. Market data and brokerage execution remain separate concerns. Streaming, failover, provider routing, Paper Trading orders, and multi-provider reconciliation remain deferred.

## 2. Alpha Requirements

### Owner Requirements

- Alpha is currently a personal capital-management system with small starting capital and strong cost controls.
- U.S. stocks and ETFs are the first market-data priority.
- Intraday bars may be required for short-term analysis.
- Deterministic software performs normalization, validation, and calculations.
- AI is advisory and cannot repair, calculate, normalize, or validate market data.
- Provider independence is mandatory.
- Credentials remain outside source control.
- Paper Trading is a future requirement, not part of this task.
- Event markets remain a separate future provider domain.
- A possible future public product must not be blocked by an undocumented license restriction.
- The first adapter must be small, reversible, and inexpensive to operate.

### Mandatory Functional Gate

A provider must have officially documented compatibility with all of the following before recommendation:

- latest quote or latest trade;
- historical bars suitable for the approved Alpha use case;
- deterministic instrument identity or resolution for U.S. stocks and ETFs.

### Mandatory Evidence Gate

The following must be resolved from current official sources:

- authentication method;
- REST rate limits and relevant concurrency limits;
- U.S. stock and ETF coverage;
- real-time or delayed feed definition and feed source;
- personal-use permission;
- restrictions relevant to internal automated analysis;
- current free and paid pricing relevant to Alpha;
- redistribution and public-product restrictions, even if those rights are not purchased now.

### Assumptions Requiring Owner Confirmation

- The first adapter serves Alpha's current single-owner personal-use stage only.
- Callers continue to request one provider explicitly; automatic selection and fallback remain absent.
- REST can satisfy the first approved implementation slice unless official capability evidence proves otherwise.
- A possible public product is a migration-planning concern, not evidence that current licensing grants public display or redistribution rights.
- Initial request volume, required bar intervals, minimum lookback, tolerated delay, and budget ceiling remain unknown until the owner supplies them.

These assumptions may shape scope but cannot substitute for provider evidence or clear a mandatory gate.

## 3. Candidate List

The owner-required candidates are:

1. Massive
2. Alpaca
3. Finnhub
4. Twelve Data

No additional candidate is added in version 1.0 because no repository architecture requirement currently justifies expanding the research set. Unofficial Yahoo Finance libraries are excluded from production candidacy. Robinhood is not treated as a general-purpose market-data provider without verified official developer access. Event-contract providers are not substitutes for the U.S. stock and ETF provider.

Candidate inclusion is not evidence of fitness, availability, coverage, price, licensing, or technical capability.

## 4. Evaluation Methodology

### Evidence Classes

| Evidence status | Meaning | Scoring treatment |
| --- | --- | --- |
| `VERIFIED_OFFICIAL` | A current official provider source directly supports the claim, with title, URL, access date, and relevant section recorded. | Eligible for scoring. |
| `PARTIALLY_VERIFIED_OFFICIAL` | Official evidence exists but is incomplete, ambiguous, internally scoped, or does not resolve every claim required by the criterion. | Score only the supported sub-criterion; a mandatory gate remains blocked. |
| `UNVERIFIED — OFFICIAL SOURCE REQUIRED` | No current official source is recorded. | Do not score and do not infer. |
| `CONFLICTING_OFFICIAL_EVIDENCE` | Current official sources materially disagree or apply to unclear plans, feeds, or use cases. | Do not score until resolved; mandatory conflicts block recommendation. |

### Confidence Classes

| Confidence | Deterministic meaning |
| --- | --- |
| `HIGH` | Current official source directly addresses the exact plan, feed, region, use, and capability being scored. |
| `MEDIUM` | Current official evidence is direct but leaves a non-gating implementation detail unresolved. |
| `LOW` | Evidence is partial, conditional, or ambiguous; it cannot clear a mandatory gate. |
| `NONE` | No official evidence is recorded. |

Confidence describes evidence quality. It is not provider reliability, market-data confidence, or a probability.

### Score Scale

Each criterion receives an integer score from 0 through 5 only after its required evidence is verified:

- `0`: documented failure to meet Alpha's minimum requirement;
- `1`: materially weak fit with high upgrade, restriction, or engineering burden;
- `2`: below-preferred fit but potentially usable with explicit owner acceptance;
- `3`: meets the practical initial requirement;
- `4`: strong fit with limited material drawbacks;
- `5`: exceptional fit for the stated requirement, supported by current official evidence.

Missing evidence is represented by `—`, not zero. No total is calculated while a mandatory criterion is unverified.

### Weighted Calculation

For an eligible provider:

```text
weighted contribution = criterion weight * criterion score / 5
total score = sum of all weighted contributions
```

The maximum is 100. Every input score, evidence status, confidence, source, and disqualifying condition remains visible. Numeric totals never override a failed gate.

### Deterministic Recommendation Rule

1. Exclude every provider with a failed or unresolved mandatory gate.
2. Calculate totals only for providers whose required evidence is complete.
3. Prefer the highest total.
4. If totals tie, compare the tied providers in this order: licensing and future-product safety; U.S. stock/ETF fitness; feed transparency; current cost efficiency; API/documentation quality; architecture fit; intraday/historical capability; Paper Trading strategic value.
5. If the ordered comparison still ties, report a tie for owner decision. Do not manufacture a winner.

## 5. Weighted Decision Matrix

The owner-proposed weights are retained because they balance the present personal-use stage with future licensing safety and total 100%.

| Criterion | Weight | Score definition | Required evidence | Disqualifying condition |
| --- | ---: | --- | --- | --- |
| U.S. stock and ETF data fitness | 20% | 0 = required instruments unavailable; 3 = officially sufficient coverage for initial scope; 5 = broad, clearly documented coverage with suitable identity support. | Official coverage, instrument identity, venue/feed scope, and exclusions. | U.S. stocks or ETFs are unsupported or coverage remains unverified. |
| Data quality and feed transparency | 15% | 0 = feed/timing cannot be identified; 3 = source, delay, timestamps, and correction behavior are adequate; 5 = unusually clear and complete provenance. | Official feed source, consolidated/single-venue status, delay, timestamp semantics, corrections/late trades, corporate actions. | Real-time/delayed definition or feed source remains unresolved. |
| Current cost efficiency | 15% | 0 = initial use is economically impractical; 3 = sustainable for current development; 5 = low-cost with limited upgrade pressure. | Current official pricing, included capabilities, limits, cancellation/renewal terms, expected usage assumptions. | Current applicable price or required-plan mapping remains unverified. |
| Licensing and future product safety | 15% | 0 = intended personal/internal use is prohibited; 3 = current use is permitted with documented future restrictions; 5 = clear path for both current use and future product review. | Official personal, internal non-display, display, commercial, and redistribution terms. | Personal/internal automated analysis permission is unresolved or prohibited. |
| API and documentation quality | 10% | 0 = required behavior cannot be implemented safely; 3 = versioned, documented API with usable errors; 5 = strong schemas, lifecycle guidance, test support, and change controls. | Official API docs, versioning, errors, authentication, sandbox/test support, change policy. | Authentication or required endpoint behavior remains unverified. |
| Alpha architecture fit | 10% | 0 = provider-native behavior would leak into domain systems; 3 = adapter mapping is bounded; 5 = clean mapping with strong provenance and replacement characteristics. | Verified schemas and semantics compared with Alpha canonical contracts. | Required data cannot be normalized deterministically without fabrication or provider leakage. |
| Intraday and historical capability | 10% | 0 = required bars unavailable; 3 = required intervals/lookback are supported; 5 = clear, flexible history with timestamp/correction semantics. | Official intervals, lookback, adjustments, pagination, limits, and timestamp semantics. | Historical bars or required intraday interval remains unverified or unsupported. |
| Paper Trading strategic value | 5% | 0 = no relevant benefit; 3 = useful later integration path; 5 = unusually strong future benefit without coupling data and execution. | Official paper environment and its relationship to market data, subject to separate execution review. | Never independently disqualifying; it cannot cure another failed gate. |
| **Total** | **100%** |  |  |  |

### Current Candidate Matrix

No provider-specific official evidence was supplied, so scoring is intentionally withheld.

| Provider | Score | Evidence status | Confidence | Mandatory gate | Weighted total |
| --- | ---: | --- | --- | --- | --- |
| Massive | — | UNVERIFIED — OFFICIAL SOURCE REQUIRED | NONE | BLOCKED | NOT CALCULATED |
| Alpaca | — | UNVERIFIED — OFFICIAL SOURCE REQUIRED | NONE | BLOCKED | NOT CALCULATED |
| Finnhub | — | UNVERIFIED — OFFICIAL SOURCE REQUIRED | NONE | BLOCKED | NOT CALCULATED |
| Twelve Data | — | UNVERIFIED — OFFICIAL SOURCE REQUIRED | NONE | BLOCKED | NOT CALCULATED |

## 6. Verified Facts Table

### Verified Repository Facts

| Claim | Evidence | Implication |
| --- | --- | --- |
| Alpha has a provider-independent, quote-first Market Data Layer. | `docs/specifications/MARKET_DATA_LAYER.md` and `src/contracts/MarketData.ts` | The first adapter must normalize into Alpha contracts rather than expose provider objects. |
| The current canonical operation and data type support latest quotes only. | `src/contracts/MarketData.ts` | Historical bars require a reviewed bounded canonical contract and validator before provider bar data can enter Alpha. |
| The Provider Registry declares quote, trade, bars, instrument resolution, market status, and health capabilities as metadata. | `src/contracts/MarketData.ts` and `docs/specifications/PROVIDER_REGISTRY.md` | A declared capability does not mean a canonical operation or adapter is already implemented. |
| The Provider Registry is immutable metadata and discovery authority; it does not instantiate, route, rank, or call adapters. | `docs/specifications/PROVIDER_REGISTRY.md` | Provider selection remains an owner-reviewed composition decision outside the registry. |
| No provider record is predeclared. | `docs/specifications/PROVIDER_REGISTRY.md` | The selected provider's metadata must be verified before registration. |
| No live market-data provider, network transport, credential, or Paper Trading path is implemented. | Current repository inspection at baseline `79c4b1fb5f5b6cc7c9988f84df0479bcce87af27` | D9-T3B must remain a narrow, separately approved integration task. |

### Verified External Provider Facts

| Provider | Verified fact | Evidence status |
| --- | --- | --- |
| Massive | No provider-specific fact is recorded in this decision version. | UNVERIFIED — OFFICIAL SOURCE REQUIRED |
| Alpaca | No provider-specific fact is recorded in this decision version. | UNVERIFIED — OFFICIAL SOURCE REQUIRED |
| Finnhub | No provider-specific fact is recorded in this decision version. | UNVERIFIED — OFFICIAL SOURCE REQUIRED |
| Twelve Data | No provider-specific fact is recorded in this decision version. | UNVERIFIED — OFFICIAL SOURCE REQUIRED |

## 7. Unverified Facts Table

Every cell below requires a current official source that applies to the exact plan and use case.

| Provider | Authentication | U.S. stocks/ETFs and identity | Feed source and delay | Quotes/trades/bars | Limits and history | Pricing | Personal/internal use | Commercial/redistribution |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Massive | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED |
| Alpaca | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED |
| Finnhub | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED |
| Twelve Data | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED | UNVERIFIED — OFFICIAL SOURCE REQUIRED |

The same status applies to indices, crypto, options, international markets, WebSocket limits, corrections, late trades, corporate actions, reliability commitments, SDK requirements, sandbox support, cancellation terms, and concurrency until official evidence is recorded.

## 8. Licensing Risk

Licensing is a mandatory gate, not a footnote or a score that cost can outweigh.

The evidence review must distinguish:

- personal interactive use;
- internal automated or non-display analysis;
- display to the owner;
- display to future users;
- commercial product use;
- derived data rights;
- caching and retention;
- redistribution of raw or normalized data;
- use in Paper Trading or execution systems;
- exchange-specific agreements or fees.

An inexpensive plan does not imply permission for Alpha's internal automation or a future public product. If official terms are ambiguous, the status remains `UNVERIFIED — OFFICIAL SOURCE REQUIRED`; the owner may need written provider clarification or legal review. Alpha must not design around assumed redistribution rights.

Current personal-use suitability and future public-product suitability are evaluated separately. A provider may be acceptable for a reversible personal-use adapter while requiring replacement or a new license before any public product. That migration condition must be recorded before selection.

## 9. Architecture Implications

### Direct Answers

1. **Should the first market-data provider also become Alpha's future broker?** No. Market data and execution are separate concerns, contracts, credentials, failure modes, and authorities.
2. **Does Paper Trading justify selecting a weaker data provider?** No. Paper Trading is a 5% secondary benefit and cannot override a failed data, licensing, cost, or architecture gate.
3. **Should Alpha use one provider for every asset class?** No. The Provider Registry supports domain-specific providers and explicit capabilities. Event markets remain separate.
4. **Should free-tier limits leak into canonical contracts?** No. Plan limits belong in provider configuration, policy, and operational controls.
5. **Should an adapter expose provider-native objects?** No. Raw payloads remain inside the adapter boundary.
6. **Should Alpha begin with REST or streaming?** Begin with REST unless reviewed official evidence shows that the approved minimum use case cannot be met. REST is the smaller reversible boundary and fits fixture-based deterministic validation. Streaming requires separate lifecycle, reconnection, ordering, backpressure, subscription-limit, and recovery design.

### Contract Gap Before Historical Bars

The Provider Registry can declare `BARS`, but the current Market Data Layer implements only `LATEST_QUOTE` and `QUOTE`. Provider selection must not treat the registry enum as implemented bar support. Before historical bars are exposed to Alpha consumers, D9-T3B must either:

- add a bounded canonical bar contract, bar request/result envelope, explicit adjustment semantics, deterministic validation, and tests; or
- split bar support into a separately approved follow-up and keep the first adapter quote-only.

Provider-native bar objects must never be used as a temporary canonical model.

### Provider Metadata

The selected provider's registry record must be created only from verified metadata. Static priority remains discovery ordering only; it is not the result of this weighted comparison and must not become routing, fallback, quality ranking, confidence, or recommendation authority.

### Credential and Transport Boundaries

D9-T3B may define credential configuration names and a narrow HTTP transport port, but it must not commit a credential value. HTTP behavior, retry limits, timeouts, safe errors, and test fixtures remain adapter infrastructure. Domain systems continue to consume only canonical validated results.

## 10. Disqualifying Conditions

A candidate is not recommendable while any of these conditions applies:

- official authentication is unresolved;
- official current pricing for the required plan is unresolved;
- official rate, concurrency, or historical lookback limits are unresolved;
- official U.S. stock and ETF coverage is unresolved or insufficient;
- official feed source or real-time/delayed definition is unresolved;
- personal use or internal automated analysis permission is unresolved or prohibited;
- required quote/trade, bar, or instrument-identity capability is unresolved or unsupported;
- currency, units, timestamps, corrections, or provenance cannot be normalized deterministically;
- required data would expose provider-native objects outside the adapter;
- a credential or SDK would have to enter domain contracts;
- material official-source conflicts remain unresolved;
- implementation would require automatic routing, failover, streaming, execution, or Paper Trading orders in the first adapter task.

A provider may score well on verified criteria and still be disqualified.

## 11. Recommendation Status

**PENDING OFFICIAL EVIDENCE REVIEW**

No provider is recommended in version 1.0. No provider has a calculated weighted score, and no provider registry record or adapter implementation is authorized by this document.

The final recommendation must identify:

- every passed gate;
- every source used and its access date;
- criterion scores and weighted contributions;
- evidence status and confidence for each score;
- assumptions and owner-accepted limitations;
- current personal-use license fit;
- future public-product migration or relicensing risk;
- why the selected provider is preferred over every other eligible candidate.

## 12. Required Owner Decisions

Before final selection, the owner must decide or confirm:

1. Expected initial request volume and development schedule.
2. Required intraday bar intervals and minimum historical lookback.
3. Whether delayed data is acceptable during development and, if so, the maximum acceptable delay.
4. Whether current use includes automated internal analysis under the provider's licensing definitions.
5. Maximum acceptable monthly development and early operating cost.
6. Whether a provider requiring future replacement for public-product use is acceptable now.
7. Whether D9-T3B includes the canonical bar contract or the first adapter remains quote-only with bars deferred.
8. Whether written provider clarification or legal review is required for ambiguous licensing terms.

## 13. Required Evidence Before Implementation

For every candidate, obtain and record current official evidence for:

- authentication and credential handling;
- endpoints and schemas for latest quote/trade, historical bars, and instrument identity;
- U.S. stock and ETF coverage;
- feed origin, consolidation, delay, timestamp, correction, and corporate-action behavior;
- free and paid pricing applicable to the required capabilities;
- REST, concurrency, WebSocket, and historical limits;
- personal/internal automated analysis permissions;
- display, commercial, derived-data, caching, retention, and redistribution restrictions;
- versioning, errors, test/sandbox support, and operational notices;
- cancellation, renewal, and upgrade conditions relevant to cost governance.

Evidence must be reviewed against the exact plan, feed, and use case. Search snippets, community posts, blogs, unofficial SDKs, and recollection do not qualify.

## 14. Proposed D9-T3B Scope

D9-T3B remains blocked until one provider passes the evidence gates and receives owner approval.

Once approved, the first-adapter task should contain only:

- one provider and one verified Provider Registry metadata record;
- a credential configuration contract that contains no secret value;
- one bounded HTTP transport boundary;
- latest quote or latest trade support;
- historical bar support only after a canonical bar contract and validator are approved;
- explicit provider-symbol to Alpha-instrument mapping;
- normalization into canonical Market Data contracts;
- deterministic validation and fail-closed results;
- safe provider error translation;
- fixture-based, network-free tests;
- documented official source references used by the adapter.

Explicit exclusions:

- streaming or WebSocket support unless separately approved;
- automatic selection, routing, ranking, fallback, or failover;
- multi-provider merging;
- broker execution or live orders;
- Paper Trading orders;
- Evidence, Decision, Risk, Replay, or Dashboard integration;
- production persistence;
- AI processing or provider selection.

## 15. Deferred Work

- live provider selection until official evidence is complete;
- provider adapter implementation;
- streaming lifecycle and recovery;
- automatic provider routing and failover;
- multi-provider reconciliation and conflict policy;
- market timeline persistence;
- Paper Trading and broker execution;
- event-contract, news, and economic-calendar providers;
- public-product data display and redistribution licensing;
- options, international, and foreign-exchange canonical extensions;
- contextual anomaly detection;
- Dashboard and downstream consumer wiring.

## 16. Source Register

No external URL is recorded in version 1.0 because no official source was supplied or reviewed. The following placeholders must be replaced only with current official provider sources.

| Provider | Claim | Official source title | Official source URL | Access date | Relevant section | Evidence status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Massive | Authentication, REST limits, and concurrency | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | NOT ACCESSED | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | UNVERIFIED — OFFICIAL SOURCE REQUIRED | Exact plan and API version required. |
| Massive | U.S. stock/ETF coverage, feed source, and delay | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | NOT ACCESSED | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | UNVERIFIED — OFFICIAL SOURCE REQUIRED | Record consolidated or single-venue scope. |
| Massive | Quotes/trades, bars, identity, history, and WebSocket limits | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | NOT ACCESSED | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | UNVERIFIED — OFFICIAL SOURCE REQUIRED | Include corrections and corporate actions. |
| Massive | Pricing, cancellation, and upgrade conditions | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | NOT ACCESSED | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | UNVERIFIED — OFFICIAL SOURCE REQUIRED | Map required features to exact plan. |
| Massive | Personal, internal, display, commercial, and redistribution rights | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | NOT ACCESSED | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | UNVERIFIED — OFFICIAL SOURCE REQUIRED | Clarify automated analysis and derived data. |
| Alpaca | Authentication, REST limits, and concurrency | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | NOT ACCESSED | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | UNVERIFIED — OFFICIAL SOURCE REQUIRED | Exact plan and API version required. |
| Alpaca | U.S. stock/ETF coverage, feed source, and delay | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | NOT ACCESSED | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | UNVERIFIED — OFFICIAL SOURCE REQUIRED | Record consolidated or single-venue scope. |
| Alpaca | Quotes/trades, bars, identity, history, and WebSocket limits | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | NOT ACCESSED | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | UNVERIFIED — OFFICIAL SOURCE REQUIRED | Include corrections and corporate actions. |
| Alpaca | Pricing, cancellation, and upgrade conditions | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | NOT ACCESSED | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | UNVERIFIED — OFFICIAL SOURCE REQUIRED | Map required features to exact plan. |
| Alpaca | Personal, internal, display, commercial, and redistribution rights | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | NOT ACCESSED | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | UNVERIFIED — OFFICIAL SOURCE REQUIRED | Clarify automated analysis and derived data. |
| Finnhub | Authentication, REST limits, and concurrency | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | NOT ACCESSED | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | UNVERIFIED — OFFICIAL SOURCE REQUIRED | Exact plan and API version required. |
| Finnhub | U.S. stock/ETF coverage, feed source, and delay | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | NOT ACCESSED | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | UNVERIFIED — OFFICIAL SOURCE REQUIRED | Record consolidated or single-venue scope. |
| Finnhub | Quotes/trades, bars, identity, history, and WebSocket limits | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | NOT ACCESSED | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | UNVERIFIED — OFFICIAL SOURCE REQUIRED | Include corrections and corporate actions. |
| Finnhub | Pricing, cancellation, and upgrade conditions | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | NOT ACCESSED | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | UNVERIFIED — OFFICIAL SOURCE REQUIRED | Map required features to exact plan. |
| Finnhub | Personal, internal, display, commercial, and redistribution rights | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | NOT ACCESSED | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | UNVERIFIED — OFFICIAL SOURCE REQUIRED | Clarify automated analysis and derived data. |
| Twelve Data | Authentication, REST limits, and concurrency | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | NOT ACCESSED | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | UNVERIFIED — OFFICIAL SOURCE REQUIRED | Exact plan and API version required. |
| Twelve Data | U.S. stock/ETF coverage, feed source, and delay | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | NOT ACCESSED | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | UNVERIFIED — OFFICIAL SOURCE REQUIRED | Record consolidated or single-venue scope. |
| Twelve Data | Quotes/trades, bars, identity, history, and WebSocket limits | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | NOT ACCESSED | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | UNVERIFIED — OFFICIAL SOURCE REQUIRED | Include corrections and corporate actions. |
| Twelve Data | Pricing, cancellation, and upgrade conditions | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | NOT ACCESSED | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | UNVERIFIED — OFFICIAL SOURCE REQUIRED | Map required features to exact plan. |
| Twelve Data | Personal, internal, display, commercial, and redistribution rights | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | NOT ACCESSED | OWNER/ARCHITECT TO SUPPLY OFFICIAL SOURCE | UNVERIFIED — OFFICIAL SOURCE REQUIRED | Clarify automated analysis and derived data. |

### Source Acceptance Procedure

For each source:

1. Confirm it is an official provider-controlled page or document.
2. Record the exact URL, title, access date, plan/feed/API version, and relevant section.
3. Extract only the claim directly supported by that section.
4. Record conditions, exclusions, conflicts, and dates.
5. Re-evaluate the applicable score and gate without changing unrelated criteria.
6. Preserve superseded source evidence in decision history rather than silently replacing it.

Official documentation establishes technical claims; official pricing and legal terms establish commercial claims. If an official marketing page conflicts with contractual terms, the conflict remains blocking until resolved.
