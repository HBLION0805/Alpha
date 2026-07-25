# Kalshi Event Contract Fixture Adapter v1

Status: Day15-T3B7 official Robinhood evidence correction implemented locally and pending owner review.

Schema: `1.1`

## Purpose

This boundary introduces Alpha's first concrete event-contract source adapter using:

- market `KXBTC15M-26JUL232045-45`;
- series `KXBTC15M`.
- one sanitized evidence record derived from the exact public Robinhood event page.

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

## Reviewed Robinhood evidence

The exact public Robinhood event page supplies:

- canonical event-page URL and slug;
- page title, displayed contract title, contract label, and contract question;
- the routable `event_contracts?id=` UUID exposed by Robinhood's own deep link;
- the separately preserved `ec_id` UUID without assigning undocumented semantics to it;
- complete primary and secondary rule text;
- a direct `contract terms and conditions` link to Kalshi's `CRYPTO15M.pdf`.

The reviewed Kalshi terms PDF has SHA-256:

`418c225a3c45c7ddef028f12a4755652c456658f54ec27c5d365d5489ce5e874`

The digest is the content-addressed terms version. It does not claim that Kalshi printed a separate human-readable version number.

## Mapping decision

The Robinhood page and Kalshi payload agree exactly on the interval, target, BRTI source, primary rule, secondary rule, and Kalshi terms link. The page slug is retained as platform market identity; the documented deep-link UUID is retained as platform contract identity; the exact terms link is retained as platform terms identity. The separate `ec_id` remains opaque evidence and is not promoted to an undocumented identity meaning.

Native Robinhood and Kalshi display titles remain distinct evidence. The T3B6 mapping uses one deterministic canonical title derived from the shared contract semantics, so `REVIEWED_EXACT` does not falsely claim that native labels are byte-identical.

The adapter emits `NORMALIZED_EXACT_MAPPING`, records the technical reviewer separately from owner release approval, creates one immutable `EventContractSourceMapping`, and creates one fixture-only settlement snapshot. Both remain research-source evidence and have no observation or trade authority. The milestone remains unapproved until the owner accepts the diff.

## Validation and normalization

The adapter:

- limits each of the three fixture bodies to 100,000 bytes;
- requires valid JSON object roots;
- rejects unknown and missing fields at the market, series, Robinhood-event, and response roots;
- requires the exact reviewed series, event, and market tickers;
- verifies public Robinhood identities, binary BTC 15-minute identity, target, complete rule text, BRTI source, Kalshi terms URL and digest, and finalized settlement;
- requires a fifteen-minute UTC interval and valid settlement chronology;
- records separate content fingerprints for all three evidence records;
- emits no raw provider payload;
- returns immutable, deterministic, research-only output.

Provider timestamps with fractional precision are normalized to canonical UTC only after validity is established. The adapter does not reinterpret `occurrence_datetime` as the evaluation time: the contract rule and market close establish the 8:45 PM EDT evaluation, while the provider field represents later lifecycle timing.

## Authority and exclusions

The output is `RESEARCH_FIXTURE_ONLY_NOT_OBSERVATION_OR_TRADE_AUTHORITY`.

Day15-T3B7 and its mapping correction add no:

- HTTP client, network request, transport, credential, API key, authentication, signing, session, cookie, or secret;
- live-read authorization, polling, scheduler, retry, streaming, persistence, or ledger mutation;
- runtime Robinhood endpoint, authenticated browser/mobile automation, OCR, or screenshot parser;
- T1 observation, T2 append, probability, recommendation, ranking, sizing, broker, order, or execution;
- claim that Kalshi quotes or fees are Robinhood quotes or fees.

## Acceptance status

Completed locally:

- one concrete Kalshi provider descriptor;
- one official BTC 15-minute market fixture and its series fixture;
- one reviewed, sanitized official Robinhood public-page evidence fixture;
- content-addressed Kalshi terms version;
- exact T3B6 mapping and fixture settlement snapshot;
- strict parsing, identity, terms, settlement, chronology, fingerprint, immutability, and adversarial tests.

Still blocked:

- T3B8 bounded live-read execution until its policy, request budget, transport, zero-persistence behavior, and owner-confirmed smoke command are separately specified and reviewed;
- Robinhood quote or fee claims, because this fixture proves contract identity and settlement only.

## Official references

- [Kalshi Get Market](https://docs.kalshi.com/api-reference/market/get-market)
- [Kalshi Get Series](https://docs.kalshi.com/api-reference/market/get-series)
- [Kalshi market endpoint used for the fixture](https://external-api.kalshi.com/trade-api/v2/markets/KXBTC15M-26JUL232045-45)
- [Kalshi series endpoint used for the fixture](https://external-api.kalshi.com/trade-api/v2/series/KXBTC15M)
- [Kalshi CRYPTO15M contract terms](https://assets.kalshi.com/contract_terms/CRYPTO15M.pdf)
- [Robinhood exact BTC 15-minute event page](https://robinhood.com/us/en/prediction-markets/crypto/events/btc-15-min-64-83926-target-jul-23-2026/)
