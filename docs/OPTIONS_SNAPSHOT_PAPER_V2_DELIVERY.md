# Practical Robinhood paper workflow V2

September 9 evening, New York / September 10, 2026 UTC. New paper plans now
separate practical snapshot testing from strict execution qualification.

The local engine models later eligible ask entries, bid exits, net fees, cash,
unresolved exposure, reviews and candidate lessons under explicit assumptions.
Its waiting states distinguish a future window, unknown costs, missing eligible
quotes and a finished entry window. Strict execution qualification stays separate;
it does not veto the declared snapshot model merely because independent option
side clocks are absent. Quotes still need valid prices, sizes, timing and costs.

## Session and cost corrections

V2 links the raw chain ID and late-close flag to each contract. The latest saved
GLD and IBIT chains both report late close enabled, so their normal modeled close
is **16:15 New York**. The reviewed 2026 calendar excludes holidays and handles
13:00/13:15 early closes. Unknown years are unsupported and unknown late-close
flags use standard hours conservatively. Quote, underlying and receipt clocks
must be within the supported session. Expiration-day plans remain unsupported.

New plans choose manual fees or the **September 10 Robinhood fee estimate**,
assuming nonprofessional status and one execution per side. The published-rate
model converges entry and target-exit fee reserve with net R; the final modeled
sale fee uses its own proceeds. Slippage is a separate declared amount. Unknown
manual costs remain unknown; actual account fees are not verified. The active
$100–$500 allocation policy and global null fee settings are unchanged.

The new Event research form defaults to the visibly labeled estimate. Preview
shows practical state, session close, fees, slippage and modeled accounting.
The preview's market-session field is distinct from the server authentication
session; a two-preview browser-client regression checks this boundary.

## Actual evidence and remaining work

The original 36-request capture still contains 34 returned quotes and two missing
quotes. **Zero pass receipt-time entry checks.** Correcting the session model
does not make a late-evening source read fresh. Both original V1 NO_ENTRY reports
recompute to their original fingerprints, and 108 earlier file hashes match.

A development-only preview of the previously saved IBIT $110 premium example
returns AWAITING_WINDOW, zero fills and a 16:15 session close. It illustrates
$0.04 entry and $0.05 target-exit fee reserve under the model. It is not registered,
not a directional recommendation and not a fresh-price approval. Original owner
records, frozen studies, Host schedules and source journals are preserved.

Next operational input is a sequence of timely intraday captures for an explicitly
frozen plan. This desk reads the existing capture store; it does not automatically
add contracts to Host tracking or run continuous quote polling. Until eligible
entry and exit observations arrive, no completed real-price result is claimed.
Candidate review notes do not establish a profitable edge or cause of market moves.

## Validation and operation

See [checkpoint](status/snapshot-paper-v2.json) for final validation counts and
local evidence hashes. The expanded test suite covers V1 compatibility, complete
synthetic V2 wins/losses, late and early closes, holidays/DST, source alignment,
fee rounding, latched exits, API authorization and copied-source recovery.
Desktop browser QA verifies a future late-session preview and its retained draft;
the preview is discarded without creating an owner plan or order.

Use Event research → Paper validation, or the unchanged local CLI:

```text
npm run options:snapshot-paper -- --report
npm run options:snapshot-paper -- --preview <workspace-relative-request.json>
npm run options:snapshot-paper -- --register <workspace-relative-request.json>
npm run options:snapshot-paper -- --save-report <plan-id>
npm run options:snapshot-paper -- --verify <workspace-relative-report.json>
```

V2 requests add `modelVersion: "V2"` and `feeBasis` (`DECLARED_FEES` or
`ROBINHOOD_REVIEWED_20260910`). Published-rate mode requires both manual fee
fields to be null. Old requests and frozen V1 records retain their original model.
The storage envelope remains V1; its explicit plan version selects reconstruction.
Future calendar/rate changes require new frozen model versions.

Source references and design review: [V2 specification](specifications/OPTIONS_SNAPSHOT_PAPER_V2.md),
[Robinhood fees](https://robinhood.com/us/en/support/articles/trading-fees-on-robinhood/),
[Robinhood hours](https://robinhood.com/us/en/support/articles/options-trading-hours/),
[NYSE calendar](https://ir.theice.com/press/news-details/2025/NYSE-Group-Announces-2026-2027-and-2028-Holiday-and-Early-Closings-Calendar/default.aspx).
