# Small-premium cost sensitivity: illustrative diagnostic

Actual calculation: **2026-09-07T08:24:04.735Z**. Fifteen explicit manual scenarios
were evaluated by the unchanged retail feasibility engine. Inputs and full
results are saved in `data/runtime/options-readiness/cost-sensitivity-20260907.json`;
the [checkpoint](status/cost-sensitivity.json) binds its bytes and summary.

These are hypothetical prices and cost assumptions, not live offers, broker fee
estimates, recommended stops or trades. The fixed example uses one standard
IBIT long put, a $0.19 bid/$0.21 ask per unit, one-cent grid, $1,000 hypothetical
equity/cash, the existing 20% research stop and a net 2R target. It creates no
position, order, trade-review entry or strategy change.

## Result

A $21 premium has a $4.20 planned premium decline at the assumed stop. Under the
existing $5 planned-risk budget, only $0.80 remains for the declared round-trip
fees and exit reserve. Arithmetic feasibility still leaves source quality,
actual costs, fill assumptions and account eligibility unresolved.

| Hypothetical premium | Assumed round-trip fees | Assumed exit reserve | Planned all-in R | Engine result |
| --- | ---: | ---: | ---: | --- |
| $21 | Unknown | Unknown | Unknown | Blocked: costs unknown |
| $21 | $0.00 | $0.00 | $4.20 | Economically feasible scenario only |
| $21 | $0.25 | $0.50 | $4.95 | Economically feasible scenario only |
| $21 | $0.50 | $0.50 | $5.20 | Blocked: planned risk exceeds $5 |
| $25 | $0.00 | $0.00 | $5.00 | Economically feasible scenario only |
| $25 | $0.25 | $0.00 | $5.25 | Blocked: planned risk and full-premium stress limits |

The complete grid contains nine economically feasible scenarios and six blocked
ones. This count is not a probability or a strategy-success statistic. Zero fees
are an explicit illustrative case, not a default for unknown fees.

Target prices retain whole-contract price-grid rounding. For the $21 premium
with $0.25 fees and $0.50 reserve, the engine gives $4.95 R and an indicative
$0.32 per-unit exit. The $11 gross premium gain leaves $10.25 after those assumed
costs, exceeding the mathematical $9.90 net 2R target because of the grid. Neither
the price nor the fill is guaranteed. The target is an input to a future reviewed
assumed-fill test, not permission to exit or place an order.

The diagnostic supports keeping unknown costs blocked and evaluating all-in R
before accepting a cheap contract. A premium below the $50 allocation ceiling
alone does not satisfy the separate planned-risk and stress limits. No risk
limit, stop percentage or conditional allocation setting was changed.

## Validation and delivery

Changed files: this document, its new checkpoint and a focused handoff link.
No production/test code changed. The existing engine evaluated all fifteen
declared cases, unknown costs remained blocked and every result retained
`executionAllowed: false`. Independent artifact hash, protected-file, JSON,
local-link and Git whitespace checks accompany the receipt. The current engine
test baseline is unchanged; no additional aggregate run was needed.

Twenty-seven protected files and the active host matched. No source/market tool,
account/order access, journal append, trade or paid step occurred. The grid does
not establish real fee levels, liquidity, stop execution or win probability.
After the opening capture, retain actual quote/cost provenance before any
source-specific paper test. The existing NO_REPLAY and no-order scope remain.

This analysis is committed and pushed under standing Owner authorization. The
actual next source collection stays in its existing frozen window.
