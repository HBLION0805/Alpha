# Personal Market Data Composition v1.0

## Purpose

The Personal Market Data Composition module converts already validated
provider-independent market observations into the exact input accepted by the
Personal Candidate Scan.

It is a deterministic evidence boundary. It does not retrieve market data,
choose a provider, estimate probability, recommend a trade, calculate position
size, access a broker, or submit an order.

## Owner-approved mapping set

On 2026-07-26 the Owner approved the complete eight-relationship MVP mapping
set defined by `PERSONAL_WATCHLIST_MAPPING.md`:

- MU to MULL; no inverse MU vehicle is active;
- TSLA to TSLL and TSLQ;
- SPCX to SPCH and SSPC;
- SKHY to SKUU and SKDD.

Runtime activation still requires a structured Owner approval command that
binds all eight exact mapping identities, the Owner identity, decision time,
and decision reference. A partial or substituted approval fails closed.

## Required observations per candidate

Each candidate requires:

1. one approved immutable mapping;
2. two completed Canonical Bars for each exact interval:
   - `P1D`;
   - `PT1H`;
   - `PT15M`;
   - `PT5M`;
3. one Canonical Quote for the mapped ETF vehicle;
4. one deterministic liquidity assessment bound to the exact quote ID and
   fingerprint.

The two bars are endpoints used to calculate direction for that timeframe.
They must be ordered, completed before evaluation, and belong to the analysis
instrument. The quote must belong to the trade vehicle, not the underlying.

## Identity and provenance gates

Composition fails closed when:

- a candidate mapping differs from the registered mapping;
- authority research or Owner approval is missing;
- a required timeframe is missing or duplicated;
- a Canonical Bar or Quote fails its native validator;
- a bar belongs to another analysis instrument;
- a quote belongs to another trade vehicle;
- a bar endpoint is incomplete or future-dated;
- a quote is future-dated;
- the liquidity assessment references another quote;
- the liquidity evaluation predates the quote or follows scan evaluation;
- an undeclared field attempts to cross the boundary.

Evidence carried into the result includes mapping authority references,
Canonical Bar IDs and fingerprints, Canonical Quote ID and fingerprint, and
liquidity-policy evidence.

## Spread calculation

The top-of-book spread is calculated deterministically from fixed-decimal bid
and ask prices:

`spread bps = ceil((ask - bid) / midpoint * 10,000)`

The conservative upward rounding prevents a fractional spread from being
reported as cheaper than it is. The Candidate Scan remains responsible for
comparing the result with the configured maximum.

## Freshness behavior

Canonical observations preserve their native current or stale status. The
composition boundary proves identity, chronology, and provenance; the
Candidate Scan applies its explicit maximum-age policies and excludes stale or
old observations. No component silently refreshes, repairs, or infers missing
data.

## Authority boundary

The output is:

- advisory only;
- read only;
- deterministic;
- unranked at the downstream Candidate Scan;
- explicitly unauthorized for automated execution.

## Deferred provider work

The current Twelve Data adapter does not yet cover this complete watchlist or
the required daily interval. Before real collection, Alpha still needs:

- provider-specific symbol and exchange mappings for all eleven instruments;
- reviewed P1D support;
- official volume-unit verification;
- quote capability and top-of-book source review;
- rate-limit and cost policy;
- bounded live smoke tests before continuous personal collection.
