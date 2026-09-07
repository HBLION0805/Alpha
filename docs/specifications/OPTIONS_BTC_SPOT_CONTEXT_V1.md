# Public BTC spot context v1

Task OPT-BTC-1. Design reviewed before implementation on September 7, 2026 UTC.
Use the current agent settings; bounded source integration, medium complexity.
No paid dependency, account access or execution. The Owner's standing development,
public factor collection, saving and Git authorization applies.

## Purpose and source review

Observe one public BTC-USD venue as context for IBIT, including changes between
saved observations while ETF markets are closed. The trading universe remains
GLD/IBIT options on Robinhood. A venue snapshot is not an IBIT price, consolidated
NBBO, continuous path, ETF opening gap or evidence of an executable option fill.

The [Coinbase Exchange product book](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-book)
documents anonymous GET, level 1 best bid/ask, aggregate sizes, order counts,
sequence, source time and optional auction state. Size is already aggregated;
never multiply it by order count. Auction values are indicative. Its
[public rate limits](https://docs.cdp.coinbase.com/exchange/rest-api/rate-limits)
are distinct from authenticated private endpoints. Use exactly
`https://api.exchange.coinbase.com/products/BTC-USD/book?level=1`.

One bounded inspection at 2026-09-07T04:46:42.464Z returned HTTP 200 and 172 bytes,
SHA-256 bd4e77daff9aa77538e0f0fcc43c1dfc55a1eb0ca8f27453c99c394d8674b034.
The source time contains nine fractional digits; preserve it exactly and compare
using integer nanoseconds. It is a book timestamp, not an independently verified
clock for either side or size. The probe remains separate from runtime history.

## Contract and architecture

- Pure TypeScript engine parses bounded JSON; script-only network/filesystem I/O.
- Fixed product and URL, one anonymous GET, no redirects, credentials, retries,
  pagination, sockets or URL overrides. Total deadline 12 seconds, body 16 KiB,
  strict UTF-8 and JSON content type. Errors retain fixed codes without bodies.
- Price and BTC size strings permit up to eight decimal places and bounded digits;
  exact BigInt arithmetic emits serializable decimal strings. Sequence/order
  counts must be nonnegative safe integers. At most one level on each side.
- Preserve absent/null source time and auction state as unknown; malformed present
  fields fail. Retain empty sides and zero sizes, but mark them unusable. Optional
  auction objects are only flagged as present, never interpreted as firm prices.
- At-receipt diagnostic checks: both positive sides/sizes, positive order counts,
  uncrossed spread, known false auction state, no auction object, source time not
  after receipt and no older than 10 seconds. These conservative research limits
  do not establish tradability. Current age is separate; 60 seconds is only a
  display-staleness threshold. Never silently treat an old success as latest after
  failure. No claim of independent side clocks or publisher authentication.
- Compare only consecutive retrieved, diagnostically usable books with strictly
  increasing source time AND sequence. Report exact midpoint change, source and
  receipt intervals; no interpolation, calendar return label or causality. Repeated
  or regressing snapshots retain evidence and explicit comparison blockers.
- Every retrieval is independent observed evidence. Preserve original clocks,
  exact accepted source text, source hash and checksum-linked local ordering.
  First observation is actual receipt, never retrospective knowledge.
- Separate local journal under ignored `data/runtime/options-btc-context/`,
  16 MiB / 1,000 records, writer lock, path/link checks, bounded recovery,
  deterministic reassessment, expiring append capability and uncertain-write
  poisoning. Corrupt/partial data stays intact and blocks recovery.

## Delivery and acceptance

Add standalone `options:btc-context --refresh/--report/--help`, network-free
engine and I/O tests, English docs and a dated actual-retrieval checkpoint.
Test precision, nanosecond boundaries, nulls/auction/empty/crossed/stale data,
ordering and failure transitions, transport limits and journal fault recovery.
Run strict typecheck and full project validation. Verify accepted artifact hashes.

This first change does not change the shared heartbeat, unified readiness schema,
frozen September 8 study, risk/fee/strategy rules, NO_REPLAY or accepted journals.
Integrating the independently verified source into daily collection is subsequent
work. Missing source semantics cannot be repaired by adding more indicators.
