# Event Contract Source Contracts v1

Status: Day15-T3B6 implemented locally and pending owner review.

Schema: `1.0`

## Purpose

This boundary turns the Day15-T3B5 source architecture into provider-neutral deterministic contracts. It defines:

- source-provider identity and declared capabilities;
- execution and credential modes;
- exact Robinhood-to-exchange market mappings;
- canonical BTC 15-minute source terms;
- immutable source snapshots with provenance chronology and bounded payload metadata.

It contains no provider adapter, SDK, credential loader, transport, network request, persistence, scheduler, polling, model, recommendation, or trading behavior.

## Provider descriptor

A provider declares:

- stable provider identity and display name;
- source class: platform, exchange, settlement reference, or reviewed operator evidence;
- one exchange identity when the source is exchange-authoritative;
- unique capabilities and supported execution modes;
- either no credential or a dedicated read-only data credential;
- official documentation references;
- active or inactive state.

Brokerage, trading, session, cookie, device-token, and write-capable credential modes do not exist in the contract.

Capabilities are restricted by source class. For example, a settlement-reference provider cannot claim platform top-of-book or market-discovery authority.

## Exact market mapping

An exchange mapping binds:

- one immutable provider descriptor;
- Robinhood-declared exchange, market, contract, and terms identities;
- exchange-native event, market, contract, and ticker identities;
- complete Robinhood terms and complete external terms;
- explicit evidence, review status, reviewer, and review time.

`REVIEWED_EXACT` requires equality across:

- exchange identity;
- title and UP/DOWN side semantics;
- BTC-USD instrument and BTC 15-minute event type;
- window start, trading close, and evaluation time;
- evaluation method;
- threshold operator and exact fixed-decimal target;
- settlement-source identity;
- terms version.

`PENDING` mappings are immutable but not eligible. `REJECTED` mappings remain explicit negative evidence. Missing, ambiguous, or mismatched mappings cannot be marked exact.

## Source snapshot

A snapshot binds one provider, one declared capability, one supported execution mode, one provider source-record identity, and:

- occurrence/observation time;
- optional publication time;
- local receipt time;
- normalization time;
- immutable raw-payload fingerprint;
- bounded raw byte and record counts;
- an exact mapping when the source is exchange-authoritative.

Chronology is fail-closed:

```text
observedAt <= publishedAt <= receivedAt <= normalizedAt
```

When publication time is unavailable, observation must still not follow receipt.

T3B6 policy authorizes fixture snapshots only. The type reserves `BOUNDED_LIVE_READ` for the separately reviewed T3B8 policy; declaring the mode does not authorize its use.

## Output and authority

Provider, mapping, and snapshot outputs are deeply immutable and carry deterministic content fingerprints.

Every snapshot remains `RESEARCH_SOURCE_ONLY_NOT_OBSERVATION_OR_TRADE_AUTHORITY`. It is not a Day15-T1 observation, cannot append to Day15-T2, and cannot create a recommendation or order.

## Explicit exclusions

Day15-T3B6 adds no:

- Kalshi, ForecastEx, Rothera, Robinhood, BRTI, or other concrete provider;
- provider SDK, endpoint, URL, HTTP, WebSocket, network, authentication, key loading, signing, or secret handling;
- raw provider payload persistence;
- live-read authorization;
- market discovery, routing, polling, scheduling, retry, streaming, background execution, or ledger mutation;
- OCR, screenshot parsing, browser automation, or mobile automation;
- probability, model, expected value, recommendation, ranking, sizing, broker, order, or execution.

## Acceptance criteria

- unknown and undeclared fields fail closed at every nesting level;
- identifiers, versions, timestamps, fingerprints, fixed decimals, bounds, and enum values are validated;
- capability/source-class and credential boundaries are enforced;
- exact mappings cannot conceal a single terms mismatch;
- pending and rejected mappings cannot qualify an exchange snapshot;
- provider, mapping, and snapshot fingerprint tampering fails closed;
- fixture results are deterministic and deeply immutable;
- bounded-live snapshots remain unauthorized;
- focused and complete validation pass.
