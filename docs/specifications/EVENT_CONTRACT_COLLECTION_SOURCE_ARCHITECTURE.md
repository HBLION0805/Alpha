# Event Contract Collection Source Architecture v1

Status: Day15-T3B5 owner approved, committed, and pushed as `adf28d24d454d533da8064732aeca381ba7cd0c2`.

Decision date: 2026-07-24

## Purpose

This specification defines how Alpha may obtain real BTC 15-minute event-contract evidence for the existing Day15-T1 through Day15-T3B4 research path.

The immediate problem is operational scale. A qualified Day15-T3B dataset requires at least 1,000 completed samples, while the current console accepts only explicit operator-supplied observations and settlements. Repeating that process manually every 15 minutes is not a credible long-running collection method.

This document does not add a network adapter. It establishes the source, identity, provenance, credential, and release gates that must exist before one is implemented.

## Current external evidence

Robinhood's official documentation states that:

- event contracts are offered through multiple possible exchange partners, including KalshiEX, ForecastEX, and Rothera;
- contract-specific terms and the official settlement source are defined on the event detail surface;
- prediction-market trading is available in the mobile application, while the web surface is view-only.

No reviewed public Robinhood event-contract market-data API was identified in the official material examined for this decision. This is a bounded documentation finding, not proof that no interface can ever exist.

Kalshi publishes official REST, WebSocket, order-book, trade, market, candlestick, lifecycle, and historical-data documentation. Those capabilities make Kalshi a possible exchange-data source only after Alpha proves that a Robinhood contract is the exact Kalshi market being observed. Robinhood's use of multiple exchanges prevents provider-name inference.

## Source classes

### Class A — Platform-authoritative source

A documented Robinhood event-contract data interface would be preferred because it could preserve the platform market identity, displayed quote, contract terms, and observation time closest to the operator's actual venue.

Current status: `UNAVAILABLE_UNTIL_DOCUMENTED_AND_REVIEWED`.

Alpha must not call undocumented mobile endpoints, replay application traffic, scrape private APIs, or reuse account session tokens.

### Class B — Exchange-authoritative source

An official exchange interface may provide market identity, terms, order-book or trade data, lifecycle state, and settlement.

Current candidate: Kalshi official APIs.

An exchange source is eligible only when an exact reviewed mapping proves all of:

- Robinhood-declared exchange identity;
- exchange-native event, market, and contract identity;
- title and binary-side semantics;
- BTC-USD instrument identity;
- 15-minute window start, trading close, and evaluation time;
- threshold value, operator, and evaluation method;
- official settlement source and terms version.

Symbol similarity, matching timestamps, matching target prices, or matching titles are insufficient. A missing or ambiguous field blocks the mapping.

Exchange quotes cannot be silently represented as Robinhood quotes. Venue-specific liquidity, latency, markup, price precision, and order behavior remain distinct.

### Class C — Settlement reference source

The official reference-price source named in the contract terms may supply the evaluation value used for settlement.

It cannot provide contract quotes, Robinhood fees, exchange fees, or proof that the platform listed a particular contract.

### Class D — Operator evidence

Reviewed operator input may provide platform-only facts that no approved source exposes, including:

- the exact Robinhood contract and terms surface;
- Robinhood-displayed bid and ask;
- the exact order preview and Robinhood/exchange fee amounts.

Operator evidence is acceptable for a bounded pilot but is not automatically scalable or authoritative. Screenshots and OCR remain unimplemented; any future OCR output must require human confirmation and retain the original evidence.

## Canonical collection composition

One complete Day15-T1 observation may combine source classes only when every fact retains its own source identity:

```text
reviewed Robinhood contract mapping
  + platform quote evidence
  + platform fee-preview evidence
  + official settlement-reference observation
  -> canonical Day15-T1 observation
  -> append-only Day15-T2 shadow ledger
```

No adapter may fill a missing platform field from a different venue. No source may inherit another source's observation timestamp, record identity, or authority.

## Required provider-neutral boundary

Before any concrete live adapter, Alpha must define:

- provider and exchange capabilities;
- canonical external market and contract identities;
- explicit provider-to-Robinhood mapping evidence and review status;
- source occurrence, publication, receipt, and normalization times;
- raw-response size and record bounds;
- immutable source-record fingerprints;
- sanitized error categories;
- fixture and bounded-live execution modes;
- credential isolation when authentication is required;
- rate, request, symbol, market, and time-window budgets;
- an injected transport port so normalization can be tested without network access.

The provider adapter may discover, retrieve, and normalize evidence. It may not select a trade, choose a side, compute probability, create an order, access portfolio state, or mutate the shadow ledger directly.

## Credential and transport policy

- Public endpoints are preferred when official documentation permits them.
- Authentication must use a dedicated read-only data credential where the provider supports one.
- A Robinhood brokerage credential, mobile session, cookie, device token, or trading credential is never an acceptable collection dependency.
- Secrets may enter only a reviewed transport boundary and must never enter URLs, query strings, logs, serialized adapters, fixtures, errors, or persisted research records.
- The first live request must be an owner-confirmed, one-shot smoke test with an explicit market, record count, time window, request budget, and zero persistence.
- Streaming, polling, retry, scheduling, and continuous persistence require separate owner-reviewed tasks.

## Release sequence

1. **T3B5 — Source architecture and admission decision:** this specification only.
2. **T3B6 — Provider-neutral event-contract source contracts:** deterministic types, validation, capability policy, and fixture-only tests.
3. **T3B7 — First exchange fixture adapter:** one reviewed provider and one exact fixture mapping; no network.
4. **T3B8 — Bounded live-read smoke:** only after official evidence, credential policy, and exact market mapping are reviewed.
5. **T3B9 — Collection runner architecture:** scheduling, retry, storage, clock, recovery, and monitoring design before implementation.
6. **T3B10 — Forward pilot:** owner-selected plan, limited duration, shadow-only collection, and independent progress review.

T3B8 through T3B10 are not authorized by approving this specification.

## Rejected shortcuts

- undocumented Robinhood endpoints or reverse-engineered application traffic;
- browser or mobile automation using an authenticated brokerage session;
- treating Kalshi, ForecastEX, or Rothera data as interchangeable;
- matching markets by display text alone;
- deriving Robinhood fees from exchange fees;
- reconstructing a missed pre-event quote from post-event history;
- backfilling missing planned events with favorable available samples;
- allowing the adapter to append directly to the ledger or create recommendations.

## Acceptance criteria

T3B5 is complete when:

- the source classes and authority boundaries are explicit;
- exact cross-venue mapping is mandatory and fail-closed;
- private Robinhood automation and trading credentials are prohibited;
- future adapter, smoke, runner, and pilot tasks have separate approval gates;
- architecture, roadmap, decisions, changelog, and handoff agree;
- the complete Alpha validation bundle passes without new provider or network code.

## Official references reviewed

- [Robinhood — How event contracts work](https://robinhood.com/us/en/support/articles/how-event-contracts-work/)
- [Robinhood — Event contracts overview](https://robinhood.com/us/en/support/articles/robinhood-event-contracts/)
- [Robinhood — Trading event contracts](https://robinhood.com/us/en/support/articles/trading-event-contracts/)
- [Kalshi — Making your first request](https://docs.kalshi.com/getting_started/making_your_first_request)
- [Kalshi — Orderbook responses](https://docs.kalshi.com/getting_started/orderbook_responses)
- [Kalshi — Historical data](https://docs.kalshi.com/getting_started/historical_data)
- [Kalshi — WebSocket quick start](https://docs.kalshi.com/getting_started/quick_start_websockets)
