# Owner allocation policy delivery

The Owner explicitly removed the old risk caps on September 9, 2026. Current
guidance, candidate checks, planner, fee comparisons and new event studies use
OWNER_ALLOCATION_ONLY_V2: **$100–$500 all-in per trade, $1,000 declared equity**.
The $5 / 0.5% planned-loss cap, $25 full-premium cap, probability-based allocation
and legacy shared event caps no longer block this version. Removed caps are
null / Not capped, not zero or a passed risk test. See the
[specification](specifications/OPTIONS_OWNER_ALLOCATION_ONLY_V2.md) and
[activation checkpoint](status/owner-allocation.json).

The saved 20% premium-stop and net-2R assumptions remain, with the existing
configured target ceiling. Fees and exit allowance remain unknown in production.
Planned loss and full-premium exposure are still displayed; stops do not cap
actual losses. In a **temporary zero-cost $200 example**, arithmetic gives $40
planned loss, $80 net target and $200 full-premium exposure. This example is not
a saved recommendation, reported fill or claim about available execution.

Whole contracts, the declared capital interval, cash/equity, costs, spread/tick,
source clocks, direction and event-evidence checks remain. There is no automatic
quantity increase to reach $100. New event studies still account for prior
reference losses and do not recycle unsettled sale proceeds; their loss caps
are unset. Existing frozen studies reconstruct their original versions.

## Implementation and activation

The planning adapter dispatches by the saved budget version. Original no-budget
and OWNER_TRADE_BUDGET_V1 inputs retain their original results. Guidance V3,
candidate checks V3, preflight V2, cost desk V2 and event report V2 expose the new
policy. Frontend inheritance, candidate transfer, resets and assumptions preview
preserve it. Blank V2 bounds or a minimum below $100 are invalid. A stale settings
form cannot silently save a legacy policy over the active version.

The existing Host brief now includes current capitalPolicy. The runbook and
frontend distinguish it from earlier analyst text; original analyst notes,
issued views, journals and source/Host field snapshots remain intact. No market,
account or order calls, new data purchases or schedule edits were made.

Actual setting save: **2026-09-10T00:07:30.024Z**, September 9 at 20:07 New York.
The new issued view and candidate snapshot were saved and verified at actual
time. The local workbench was restarted after exact command/listener matching,
through the approved network launch path for its existing public collector.

At activation the retained September 8 sample has **36 contracts**: 17 premiums
within the range, 18 above and one below. Both assets remain **WATCH**, with zero
conditional candidates. Unknown costs, old prices, insufficient close history,
calendar/source qualification and event posture are independent of removed caps.
These sample counts do not establish affordability after fees or a win rate.

## Validation and preservation

The new focused suite passed **34/34**; the prior budget suite passed **29/29**.
Coverage includes inclusive boundaries, fees, unknowns, cash/equity, scenario
math, retained evidence blockers, versioned event accounting, protected APIs,
restart, saved snapshots and rejection of stale-policy rollback. Full integrated
validation passed **4,272 tests / 166 components**, zero failures, including strict TypeScript.
Final preservation evidence is recorded in the checkpoint.

Browser checks verified candidate-to-planner transfer, the temporary $200
calculation, 0/1/2/5 exit-tick costs and an unsaved $1 fee / $2 exit-reserve
preflight ($22.80 loss at $100 capital). Drafts were discarded. Desktop document
width/scroll width were 1257/1257; at 390x844 mobile they were 375/375, with no
browser errors. The temporary viewport override was reset.

Before activation, 108 prior files were hashed and 85 saved guidance, candidate
and event records independently recovered. The final checkpoint checks all
108 hashes again. Owner ledger remains empty; there were no actual trades.
The dated previous capital-policy and macro deliveries remain historical.

## Overall scope

The fixed ten workstreams remain **4 LOCAL_VALIDATED / 3 PARTIAL /
3 NOT_VALIDATED**. Workstream 01 now implements the Owner's cancellation; no
real-price gate advanced. The six first-paper-flow gates still have three local
components available and three open: qualified quotes, the source-specific
adapter and the qualified end-to-end run. See
[progress](OPTIONS_DEVELOPMENT_PROGRESS.md).
