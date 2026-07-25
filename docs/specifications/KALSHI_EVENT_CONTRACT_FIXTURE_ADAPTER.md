# Kalshi Event Contract Fixture Adapter v1

Status: Day15-T3B7 fixture normalization implemented locally; exact Robinhood mapping remains blocked and the milestone is pending owner review.

Schema: `1.0`

## Purpose

This boundary introduces Alpha's first concrete event-contract source adapter using two static payloads retrieved from official Kalshi public API endpoints:

- market `KXBTC15M-26JUL232045-45`;
- series `KXBTC15M`.

The reviewed market corresponds to the operator screenshot displaying the July 23, 2026 8:30–8:45 PM EDT BTC 15-minute interval, target price `$64,839.26`, and BRTI source.

The adapter performs no network request. It parses only caller-supplied fixture text, validates the exact reviewed payload shape and identity, and emits an immutable normalized research fixture.

## Official fixture facts

The official Kalshi market payload states:

- series: `KXBTC15M`;
- event: `KXBTC15M-26JUL232045`;
- market: `KXBTC15M-26JUL232045-45`;
- title: `BTC price up in next 15 mins?`;
- window: `2026-07-24T00:30:00.000Z` through `2026-07-24T00:45:00.000Z`;
- target: `$64,839.26`;
- rule: the sixty-second BRTI average before the end is at least the sixty-second BRTI average before the start;
- result: `no`;
- expiration value: `$64,809.04`;
- settlement time: `2026-07-24T00:45:06.036714Z`.

The series payload identifies CF Benchmarks as the settlement source and links the `CRYPTO15M` contract terms and certification documents.

## Mapping decision

The reviewed Robinhood screenshot and Kalshi payload have three exact displayed facts in common:

1. the BTC 15-minute interval;
2. target price `$64,839.26`;
3. BRTI settlement-source display.

That evidence is strong market-candidate evidence, but it is not an exact cross-venue identity under the approved T3B5/T3B6 policy. The available Robinhood evidence does not expose:

- Robinhood-declared exchange identity;
- platform market ID;
- platform contract ID;
- platform terms ID;
- platform terms version;
- the complete exact title and rule text.

The adapter therefore emits `NORMALIZED_PENDING_MAPPING`, `eligibleForCollection: false`, and a deterministic blocker for every missing field. It does not construct an `EventContractSourceMapping` or `EventContractSourceSnapshot`.

Alpha must not infer these fields from the matching interval, target, or settlement source. A later owner-reviewed Robinhood terms artifact is required to close the mapping.

## Validation and normalization

The adapter:

- limits each fixture body to 100,000 bytes;
- requires valid JSON object roots;
- rejects unknown and missing fields at the market, series, and response roots;
- requires the exact reviewed series, event, and market tickers;
- verifies binary BTC 15-minute identity, target, rule text, BRTI source, terms URLs, and finalized settlement;
- requires a fifteen-minute UTC interval and valid settlement chronology;
- records separate content fingerprints for the two payloads;
- emits no raw provider payload;
- returns immutable, deterministic, research-only output.

Provider timestamps with fractional precision are normalized to canonical UTC only after validity is established. The adapter does not reinterpret `occurrence_datetime` as the evaluation time: the contract rule and market close establish the 8:45 PM EDT evaluation, while the provider field represents later lifecycle timing.

## Authority and exclusions

The output is `RESEARCH_FIXTURE_ONLY_NOT_OBSERVATION_OR_TRADE_AUTHORITY`.

Day15-T3B7 adds no:

- HTTP client, network request, transport, credential, API key, authentication, signing, session, cookie, or secret;
- live-read authorization, polling, scheduler, retry, streaming, persistence, or ledger mutation;
- Robinhood endpoint, browser/mobile automation, OCR, or screenshot parser;
- T1 observation, T2 append, probability, recommendation, ranking, sizing, broker, order, or execution;
- claim that Kalshi quotes or fees are Robinhood quotes or fees.

## Acceptance status

Completed:

- one concrete Kalshi provider descriptor;
- one official BTC 15-minute market fixture and its series fixture;
- strict parsing, identity, terms, settlement, chronology, fingerprint, immutability, and adversarial tests;
- explicit machine-readable Robinhood mapping blockers.

Blocked:

- the T3B7 exact-mapping exit criterion;
- exchange snapshot eligibility;
- any T3B8 live-read work.

The blocker can be resolved only with a reviewed Robinhood contract-terms artifact containing the missing authoritative identity and version fields.

## Official references

- [Kalshi Get Market](https://docs.kalshi.com/api-reference/market/get-market)
- [Kalshi Get Series](https://docs.kalshi.com/api-reference/market/get-series)
- [Kalshi market endpoint used for the fixture](https://external-api.kalshi.com/trade-api/v2/markets/KXBTC15M-26JUL232045-45)
- [Kalshi series endpoint used for the fixture](https://external-api.kalshi.com/trade-api/v2/series/KXBTC15M)
- [Kalshi CRYPTO15M contract terms](https://assets.kalshi.com/contract_terms/CRYPTO15M.pdf)
