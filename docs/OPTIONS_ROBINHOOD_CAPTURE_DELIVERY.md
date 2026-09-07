# Robinhood option capture: first real-response assessment

On 2026-09-07 UTC (September 6 in New York), the configured five-tool connection
returned actual GLD/IBIT chains, instruments, equity quotes, option quotes and
option historical bars. The runtime-loading blocker is resolved. No account,
order, onboarding or paid-data call was made.

## Result

The bounded sample uses September 25 expirations: GLD strike 407 and IBIT strike
45, one call and one put each. These are near-ATM schema probes, not trade picks
or a complete affordability search. All four are active, tradable equity options
with a reported multiplier of 100. Instrument responses also provide per-contract
sellout timestamps. That metadata does not authorize entry or exercise exposure.

The returned quote timestamps are September 4, about 16:14:49-16:15:00 New York.
They are stale at the actual September 7 UTC receipt time. Values below are
source snapshots and exclude fees; displayed quantities do not guarantee fills.

| Sample contract | Bid / ask per unit | Bid / ask size | Ask cost for one contract | Bid-ask difference per contract |
| --- | --- | --- | --- | --- |
| GLD 407 Call | $9.45 / $9.70 | 20 / 65 | $970 | $25 |
| GLD 407 Put | $9.10 / $9.40 | 29 / 32 | $940 | $30 |
| IBIT 45 Call | $1.78 / $1.81 | 29 / 21 | $181 | $3 |
| IBIT 45 Put | $1.45 / $1.48 | 37 / 54 | $148 | $3 |

Every sample exceeds both the existing USD 50 allocation budget and separate
USD 25 full-premium stress cap for the hypothetical USD 1,000 account. The
deterministic diagnostic rejects them without assuming fees are zero or raising
limits. This finding applies only to these four samples.

Historical inspection requested one-minute regular-session bars for
`2026-09-04T19:00:00Z` through `2026-09-04T19:30:00Z` (15:00-15:30 New York).
It returned 30 bars per contract, 120 total. All 120 have `interpolated=true`;
explicitly non-interpolated observations: zero. This window provides no usable
observed price path. Neither the schema nor these bars contains historical bid,
ask, sizes or bar volume. The result does not establish history coverage for
other contracts or windows.

## Implemented assessment and persistence

New files are the [engine](../src/engines/options-robinhood-data/RobinhoodCaptureEngine.ts),
[engine tests](../src/engines/options-robinhood-data/RobinhoodCaptureEngine.test.ts),
[CLI](../scripts/options-robinhood-capture.mjs),
[CLI tests](../scripts/options-robinhood-capture.test.mjs),
[synthetic fixture](../fixtures/options-robinhood-data/capture.synthetic.json),
[specification](specifications/OPTIONS_ROBINHOOD_CAPTURE_V1.md), this receipt and
[operational status](status/robinhood-capture.json). Package/validation registration
and current project summaries were updated. Old pricing, replay and journal
engines were not changed.

`npm run options:robinhood-capture -- --inspect <workspace JSON>` validates a
bounded export and reassesses its source clocks at actual time. Add `--save` to
record it once. The CLI has no network transport, credential access or order path.
It validates request scope and UUID/OCC linkage, exposes stale/missing/zero data,
counts observed versus interpolated bars and reuses existing retail economics.
Its 60-second freshness threshold is diagnostic, not a production execution rule.
Output always returns `NO_REPLAY`, zero trades and no outcome probability.

The live input is a reserialized structured MCP data export kept only beneath
ignored `data/runtime/options-robinhood-data/`. Local hashes prove integrity, not
publisher authentication or entitlement. No live payload, credentials or account
identifiers are committed.

- Capture ID: `rh-gld-ibit-20260907-0112`; seven calls across all five allowed tools.
- Source SHA-256: `0e0cd5dfaf08f810184ae09c2e7357ecae079f2af1d3bf0983b909a84f178e46`.
- Recorded at: `2026-09-07T01:27:39.498Z`.
- Artifact SHA-256: `82348d0e5dbebcacca711f70d1d144e3117db97ca7b0f4587b3ccd5dfb831a4c`.
- A second save verified/reused the first artifact and recording clock while
  recalculating current data age. It did not overwrite source evidence.

Four candidate data-quality lessons are stored with the assessment: source time
versus receipt time; interpolated bars versus observations; multiplier before
affordability; and expiry-profit model versus target-before-stop probability.
They are not closed trades, approved knowledge or automatic strategy changes.
Original paper/review and historical research hashes remain respectively
`3e4f4e3bc453e69f64987a1ab0c2e3dc3fd743f082ca6bf5fae0bdff0cfd549b`
and `f34d16cf9852cfcaadd84e716172b1359beb139ece976ae5109ff6cdf4395b62`.

## Validation and remaining work

Typecheck and aggregate `npm run alpha:validate` passed: 2,469/2,469 tests,
93 components, zero failures, 42,912 ms, including 30 new engine tests and 10 new
CLI/storage tests. Tests are synthetic and network-free. The
real smoke test and immutable-save/recovery checks are separate operational
evidence, not a strategy backtest. Initial assertion-import and Windows subprocess
test issues were corrected; there is no remaining code/test failure. New test
summaries use the existing reporter's fraction format. Git's LF-to-CRLF notices
are environment warnings; whitespace checks pass. No repeated full suite is
needed for the final documentation-only insertion of these measured totals.

Next: bounded contract screening within the unchanged risk limits, followed by
prospective quote capture during an eligible session. Preserve separate source,
request and receipt clocks. Establish underlying alignment, independent side/size
timing, deliverables, calendar, costs, retention terms and account eligibility
before a source-specific paper adapter. The chain response's underlying-symbol
field was empty; its chain and instrument symbols matched, but that missing link
cannot be invented. Do not relabel Robinhood data as Cboe or use OHLC to fabricate
historical executions. Complete real-price trade replay remains NOT_RUN.

The older [current.json](status/current.json) is the dated pre-connection build
checkpoint. This delivery and its operational status supersede its Robinhood
installation, runtime, quote-response and latest-module/test facts; historical
engines, accepted journals and old validation evidence remain unchanged.
