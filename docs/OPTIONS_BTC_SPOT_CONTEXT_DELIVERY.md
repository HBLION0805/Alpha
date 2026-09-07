# Public BTC spot context delivery

Task OPT-BTC-1, September 7, 2026 UTC. This closes one public numerical-source
gap for IBIT context. It does not establish a trading signal or option fill.

## Changes and rationale

Added `BtcSpotContextEngine.ts` and tests under
`src/engines/options-btc-context/`, a synthetic fixture, standalone
`scripts/options-btc-context.mjs`, guarded `scripts/lib/options-btc-context-io.mjs`
and I/O tests. Registered three npm commands and aggregate test files, ignored
the separate runtime directory, and updated the README, architecture, roadmap,
decision, changelog and handoff documents. The
[pre-implementation specification](specifications/OPTIONS_BTC_SPOT_CONTEXT_V1.md)
records the reviewed source and exact boundaries.

The official [Coinbase level 1 book documentation](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-book)
defines best bid/ask, already-aggregated size, sequence and book time. Alpha
preserves their meaning with exact decimal and nanosecond arithmetic. Duplicate
JSON keys, unsafe numeric representations, invalid source clocks and schema
changes fail. Empty sides, zero liquidity, auction/unknown state, crossed books
and source age are retained as diagnostics. Data older than ten seconds at receipt
cannot enter the comparison; current display freshness is separately limited to
sixty seconds. These are conservative research checks, not executable-price rules.

Only consecutive usable observations with increasing source time and sequence
can yield an exact midpoint change with observed intervals. There is no
interpolation, calendar-return label or claim about intervening prices. Failures
cannot promote an earlier price as latest. The anonymous HTTP boundary follows
one fixed endpoint, forbids redirects and credentials, and bounds total response
time and decoded size. Invalid bodies stay out of error output and the journal.

## Actual verification

- Independent inspection: one public GET at 04:46:42.464Z, 172 bytes; kept in a
  temporary source-inspection directory, separate from runtime observations.
- Runtime command: `node node_modules/tsx/dist/cli.mjs scripts/options-btc-context.mjs --refresh`.
  Requested 04:55:22.620Z; received **04:55:22.743Z**. Source book clock:
  **04:55:20.377548941Z**. One retrieval, `OBSERVED_CONTEXT`, no quality issues.
- Source SHA-256:
  `7fc96f9e960a81ac3a9c5842cc5a7111da410fac1ad997e90281e9d4374e1113`.
  Journal record fingerprint:
  `8c636d39e7951c1703f0d415133ab3814410edfb6e83c6f1f437ea2d367a1f93`.
- `--report` in a new process independently recovered the same original source
  clocks, hash and assessment. Its ignored result is
  `data/runtime/options-btc-context/recovery.json`. The first observation is actual
  receipt, not the book's historical publication time. Only one saved observation
  exists, so the price comparison remains unavailable.

## Validation and limits

Focused checks: `npm run typecheck`, `npm run test:options-btc-context` (30/30)
and `npm run test:options-btc-context-io` (25/25) passed. Initial strict typecheck
found local narrowing/global typing errors, corrected without changing project
compiler rules. I/O tests cover independent clocks, total deadlines, streaming
limits, sanitization, locking, expired capabilities, complete/partial write faults,
tampering, links and restart recovery. `npm run alpha:validate` passed all
**2,771 tests across 105 components**, including typecheck, scope and documentation
checks. The [machine checkpoint](status/btc-spot-context.json) records exact
source/recovery hashes and twelve unchanged accepted artifacts. An early attempt
to read the validation summary before the process finished produced no result;
the completed process exited zero and its final report was independently parsed.

The journal is bounded single-process storage, not authenticated market history
or a transactional server database. It blocks after corruption or uncertain
persistence rather than rewriting records. The public endpoint does not require
an account; no new account, credentials, fees or brokerage operations were used.
One venue and one saved snapshot cannot measure IBIT's fair price, weekend gap,
continuous volatility, causality or strategy profitability. Independent quote-side
clocks and retention rights beyond this local research use remain unverified.

All accepted paper/research/news/Treasury and frozen-study artifacts, the original
restoration snapshots and the active host schedule remain unchanged. No new
Robinhood calls, trades, risk changes or strategy permissions occurred. Next
integrate this independently verified source into daily context collection and
read-only readiness reporting. Git changes are reviewed and committed/pushed under
the Owner's standing authorization; the final checkpoint records validation evidence.
