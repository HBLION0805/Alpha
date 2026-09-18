# ETF cross-interval source audit V1

September 17, 2026. ETF-SOURCE-02; current model and reasoning; medium scope.
Owner authorized investigation of missing bar-quality flags before trend-to-contract
validation. Scope: pure audit engine, existing local source storage/CLI and UI,
network-free tests and current delivery records. No new dependency or timer.

## Finding and decision

The connected official schema defines synthesized bars when interpolated is true;
it supplies no default for an omitted optional boolean. The official market-tool
listing also supplies no omitted-value semantics. Do not use unofficial API
examples to infer the current MCP behavior. Keep every unknown flag unchanged.

One bounded diagnostic requests September 17 regular-session raw one-minute GLD
and IBIT bars to compare with the already saved five-minute response. This is a
different-resolution consistency check, not a retry for a convenient response.
No further market reads are part of this increment. Sources are the same provider
at different receipt times; agreement cannot independently authenticate either.

## Deterministic comparison

Keep the existing source report/validator and hashes unchanged. Add a separate
comparison over copied five-minute and one-minute request/response envelopes.
Require identical symbols, range, raw adjustment and regular-session scope,
valid actual request/receipt/assessment clocks, unique result identities and no
contradictory missing identities. Preserve missing results and bars as gaps.

For each expected five-minute interval, require exactly five ascending one-minute
bars with exact micro-USD OHLC, nonnegative integer share volume, regular session
and elapsed end times. Reject invalid OHLC, malformed flags and explicit gap fills
from comparison. Omitted flags remain unknown but permit a labeled structural
comparison, never a qualified trend calculation. Do not silently drop malformed,
duplicate, out-of-window or out-of-order bars, or synthesize absent bars.

Aggregate open = first, close = last, high = maximum, low = minimum and volume =
sum. Compare numerical values exactly, preserving original decimal strings in
evidence. Return per-interval field differences, comparable/matching/conflicting/
unassessable counts and flag counts. Any malformed series blocks comparison;
missing or invalid source data must never look like agreement. Differences have
unknown causes: source revision, filtering or interval construction are possible
questions, not established explanations. Never choose a winning source, average
conflicts or rewrite the original source record.

## Persistence, display and acceptance

Save append-only audit records under the existing ignored ETF setup store. Copy
both inputs and recompute from a lone copied record. Expose the latest saved audit
in Daily guidance, with request clocks, disagreement rows and concrete next steps.
Include an unsent support question explaining omitted flags and exact mismatches.
No external support message is sent. No rule, bar import, recommendation, paper
fill or profit is created; canonical WATCH and old reports remain unchanged.

Test exact comparison, identities, clocks, grids, missing/invalid data, flag
semantics, source-copy recovery, tamper rejection and escaped UI. Verify the actual
response pair, inspect desktop/mobile, run focused/dependent suites, typecheck and
aggregate checks. The result may remain blocked pending provider clarification;
do not call a diagnostic completion a strategy validation.

Reference checked: https://robinhood.com/us/en/support/articles/trading-with-your-agent/
