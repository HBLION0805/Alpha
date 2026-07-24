# BTC Event Contract Observation v1

Status: Day15-T1 implemented locally and pending owner review.

Schema: `1.0`

Policy: `event-contract-observation:btc-15-minute:1` version `1.0`

## Purpose

The BTC Event Contract Observation boundary converts one owner-supplied Robinhood BTC 15-minute market capture into an immutable, deterministic record. It preserves the exact contract terms, settlement semantics, reference price, both UP/DOWN quotes, both fee previews, and the evidence identities needed to reproduce the observation.

The boundary calculates fee-inclusive break-even probability and maximum profit from the supplied order previews. It does not estimate event probability, recommend a side, size a position, mutate a portfolio, place an order, or authorize a trade.

## Authority

- The exchange contract terms remain settlement truth.
- The declared settlement source remains reference-price truth.
- Robinhood and the exchange remain fee and execution truth.
- The observation record owns only the normalized point-in-time capture and its deterministic arithmetic.
- Event Analyzer remains an uncalibrated analytical prototype and does not own contract facts.
- Future Prediction, Decision, Risk, Portfolio, and execution systems retain their existing authority.

Every output is `OBSERVATION_ONLY_NOT_TRADE_AUTHORITY`.

## Required input

One input contains:

- a bounded observation ID and canonical capture time;
- one BTC 15-minute contract definition;
- exact window, trading-close, and evaluation timestamps;
- explicit `AT_SCHEDULED_TIME` or `TOUCH_DURING_WINDOW` evaluation semantics;
- an explicit threshold operator;
- a positive fixed-decimal target price;
- the exchange, market, contract, platform, and settlement-source identities;
- one reference-price observation;
- exactly one UP quote and one DOWN quote;
- exactly one UP order preview and one DOWN order preview;
- immutable evidence references for terms, reference price, quotes, and fee previews.

No title, screenshot, chart, symbol, or market price may substitute for the exact settlement rule.

## Quote and fee semantics

Contract prices are integer basis points of the one-dollar settlement value:

- `350` means `$0.0350`;
- `9660` means `$0.9660`;
- valid tradable prices are strictly between `0` and `10,000`.

Each side records an ask and an optional bid. UP and DOWN prices are independent observations and are not forced to sum to one dollar.

Each order preview records:

- side and referenced quote observation;
- whole-contract quantity;
- exact contract price;
- contract subtotal;
- Robinhood commission;
- exchange fee;
- other fee;
- all-in total cost;
- maximum settlement payout;
- fee evidence identity.

The validator requires:

- preview price equals the referenced side's ask;
- subtotal equals `quantity * contract price`;
- total cost equals subtotal plus all fees;
- maximum payout equals `quantity * $1`;
- total cost is below maximum payout;
- all arithmetic is exact after fixed-decimal scale normalization.

The output derives:

- maximum profit as `maximum payout - total cost`;
- fee-inclusive break-even probability as the ceiling of `total cost / maximum payout`;
- exact source quote and fee evidence references.

The actual Robinhood order-review screen remains authoritative. Day15-T1 does not hard-code a mutable commission schedule or infer fees from a screenshot headline.

## Freshness and chronology

The default policy requires:

- a contract window of exactly 900 seconds;
- capture within the contract window and no later than trading close;
- trading close no later than evaluation;
- reference price no more than two seconds old;
- quotes no more than two seconds old;
- fee previews no more than five seconds old;
- no source observation or evidence timestamp after the record capture;
- fee previews to reference the exact quote records preserved by the observation.

All timestamps are canonical UTC with millisecond precision.

## Evidence

Evidence records preserve only bounded identity and timing metadata:

- `TERMS`;
- `REFERENCE_PRICE`;
- `QUOTE`;
- `FEE_PREVIEW`.

Every referenced evidence ID must exist exactly once and have the expected type. Runtime objects and nested records use strict allow lists. Undeclared provider payloads, credentials, ranking fields, leverage, position size, order instructions, and arbitrary extensions fail closed.

Evidence identity proves internal traceability only. It does not prove that an owner-entered value is externally correct. A future adapter must establish authoritative Robinhood, exchange, and BRTI provenance separately.

## Deterministic output

The constructed record is deeply immutable and contains:

- canonical contract and settlement facts;
- canonical reference price, quotes, previews, and evidence;
- UP and DOWN all-in economics;
- remaining seconds at capture;
- deterministic FNV-1a content fingerprint;
- schema and policy versions;
- observation-only authorization.

FNV-1a is local change detection, not cryptographic integrity.

## Fail-closed conditions

Construction is rejected for:

- missing or unknown fields;
- unsupported instrument, event, platform, outcome pair, evaluation method, or threshold;
- missing UP/DOWN symmetry;
- invalid fixed decimals or unsafe numeric bounds;
- invalid contract chronology or duration;
- stale, future, or unrelated reference price, quote, preview, or evidence;
- mismatched quote and fee-preview identity;
- inconsistent subtotal, fee total, payout, or break-even inputs;
- missing or incorrectly typed evidence.

## Explicit exclusions

Day15-T1 adds no:

- probability estimate or calibration;
- BUY, HOLD, NO_TRADE, or opposite-side selection;
- expected-value estimate;
- position sizing or Kelly calculation;
- Prediction Log or Trade Outcome Log persistence;
- live Robinhood, exchange, BRTI, provider, API, network, credential, OCR, or screenshot ingestion;
- polling, scheduling, Dashboard, Paper Trading, broker, order, or execution behavior.

## Next milestone

Day15-T2 may add a local fixture/console capture workflow and append-only shadow-observation storage after owner review. A later probability milestone may consume only validated observations and must keep model probability, market probability, execution cost, profitability, and capital risk separate.
