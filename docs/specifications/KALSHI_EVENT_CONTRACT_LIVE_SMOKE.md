# Kalshi Event Contract Bounded Live-Read Smoke v1

## Status

Day15-T3B8 implements the smallest owner-triggered public Kalshi live-read foundation. Automated validation uses injected transports and performs no network request. The first real request remains a separate owner-authorized operation.

This milestone adds no Robinhood authentication, private endpoint, credential, account session, persistence, polling, scheduling, model, recommendation, sizing, order, or execution behavior.

## Fixed boundary

The only permitted request is:

```text
GET https://external-api.kalshi.com/trade-api/v2/markets/KXBTC15M-26JUL232045-45
```

The ticker is the single Day15-T3B7 market with reviewed exact Robinhood mapping evidence. The smoke reads its finalized settlement record. It does not discover markets and does not treat Kalshi quotes or fees as Robinhood facts.

Policy `kalshi-live-read:KXBTC15M-26JUL232045-45:1` permits:

- one public HTTPS GET;
- exactly one fixed market and endpoint;
- one request per invocation;
- at most 100,000 response bytes;
- exactly one normalized source record;
- a 10-second timeout, bounded by a 15-second hard maximum;
- credential mode `NONE`;
- execution mode `MANUAL_ONE_SHOT`;
- zero retries, redirects, polling, streaming, background work, or persistence.

Any alternate protocol, host, port, path, ticker, query, fragment, credential, method, timeout, response size, schema, identity, terms, mapping, or chronology fails closed.

## Transport

`KalshiPublicHttpsTransport` is the only approved Kalshi network boundary. It uses the platform `fetch` capability directly, rejects redirects, applies bounded cancellation and timeout behavior, and returns a body only to the adapter in memory.

Errors retain only a safe category and optional HTTP status. Provider narratives, URLs, headers, bodies, and credentials are not retained in error output. No credential exists in this path.

Automated tests inject a request executor or transport. The platform transport is never called by `npm test` or `npm run alpha:validate`.

## Dry run and manual command

The command is:

```text
npm run live-smoke:kalshi-event-contract
```

Without a flag it performs a network-free dry run. Dry run validates the fixed request and reports budgets, credential mode, zero network requests, and zero persistence.

After separate owner authorization, the one-request form is:

```text
npm run live-smoke:kalshi-event-contract -- --confirm-live-read
```

The command always states `LIVE READ ONLY — NO TRADING OR DECISION AUTHORIZATION`. Confirmed output is sanitized: provider, ticker, budget use, mapping and normalization states, immutable source-snapshot metadata, settlement side, warnings, and elapsed time. It does not print the raw response, rules, quote values, reference-price value, URL, headers, or any trading instruction.

## Normalization and authority

The received market body must pass the strict T3B7 exact-market adapter together with the already reviewed static series and Robinhood evidence. Unknown or changed fields fail closed.

Only after exact normalization does T3B8 construct:

- a provider descriptor that explicitly declares `BOUNDED_LIVE_READ`;
- a new mapping fingerprint bound to that provider descriptor;
- one `SETTLEMENT` source snapshot under a T3B8 policy that permits bounded live read.

The output remains `RESEARCH_SOURCE_ONLY_NOT_OBSERVATION_OR_TRADE_AUTHORITY`. It cannot become a Day15-T1 observation, append to the Day15-T2 ledger, calculate probability or expected value, recommend a side, size capital, or place an order.

## Safety and rollback

Before the first real request:

1. review the complete T3B8 diff and green validation report;
2. run the command without confirmation and verify `DRY_RUN`, zero requests, and zero writes;
3. separately authorize one confirmed request;
4. stop after the sanitized result;
5. run Git status and safety scans to confirm no response artifact exists.

Rollback removes the manual script, transport export, policy, and package commands. No data cleanup is required because the smoke writes nothing.

## Deferred

- execution of the first public request;
- a currently open market or repeated event selection;
- market discovery, order books, trades, candlesticks, or reference-price feeds;
- Robinhood quotes, fee previews, or platform observations;
- retries, polling, scheduling, streaming, caching, or persistence;
- T3B9 collection-runner architecture and T3B10 forward pilot;
- probability research, backtesting, recommendation, risk, portfolio, broker, order, or execution integration.

## Official references

- [Kalshi Get Market](https://docs.kalshi.com/api-reference/market/get-market)
- [Kalshi API changelog](https://docs.kalshi.com/changelog)
- [Event Contract Collection Source Architecture](EVENT_CONTRACT_COLLECTION_SOURCE_ARCHITECTURE.md)
- [Event Contract Source Contracts](EVENT_CONTRACT_SOURCE_CONTRACTS.md)
- [Kalshi Event Contract Fixture Adapter](KALSHI_EVENT_CONTRACT_FIXTURE_ADAPTER.md)
