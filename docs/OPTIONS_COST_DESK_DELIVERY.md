# Planner fee and exit-allowance comparisons

September 8 evening, New York; implementation and source review recorded on
September 9 UTC. [Specification](specifications/OPTIONS_COST_DESK_V1.md),
[checkpoint](status/cost-desk.json).

## Delivered behavior

Trade planner now compares the same explicit whole-contract position with
0, 1, 2 and 5 quote ticks of adverse exit allowance. The default uses the
planner's declared fees; missing fees stay unknown. An explicit alternative
assumes nonprofessional status and one purchase execution plus one sale
execution under a dated public fee snapshot. It does not verify an account,
establish trade-date applicability or write costs into guidance or the ledger.

Each row shows the fee reserve, planned total loss, net target after tick
rounding, indicative exit price, remaining planned-risk capacity and the original
calculator's blockers. Expand a row for fee components and exact calculations.
The original planner result remains separate. Editing inputs or changing the fee
basis invalidates the comparison; reset clears the tab's temporary assumptions.
No record, fill, lesson, source refresh or schedule operation is created by the
new protected local `/api/cost-desk` calculation endpoint.

## Fee reference and arithmetic

The [Robinhood fee schedule](https://cdn.robinhood.com/assets/robinhood/legal/RHF%20Fee%20Schedule.pdf)
was reviewed at 2026-09-09T02:25:50.000Z, footer
`20260831-5886092-18771991`. The separate snapshot uses $0 commission, combined
ORF/OCC of $0.04 per contract per side, sell SEC of $20.60 per million dollars
rounded up to cents, sell TAF of $0.00329 per contract and CAT of $0.0003 per
contract per side. TAF/CAT apply the sub-cent waiver before nearest-cent
rounding. Quantity is bounded to 100, below the TAF cap.

[Robinhood's support article](https://robinhood.com/us/en/support/articles/trading-fees-on-robinhood/)
confirms stock/ETF option sales incur SEC and TAF regardless of sale value.
Account-specific arrangements and fragmented executions can change actual
charges; the professional-customer fee and index-option charges are outside the
assumed case. The old September 4 historical fee engine remains unchanged.

Integer/rational calculations solve the total fee reserve together with the
existing net-R target, bounded to 32 iterations. The sale-fee basis is at least
entry premium and otherwise the rounded target proceeds. A target crossing a
SEC rounding boundary therefore changes the reserve and recalculates the target.
Costs enter R and the required gross target once. A row replaces the original
exit allowance; it does not add a second spread charge or assume entry slippage.
Continuous premium stops remain hypothetical, without verified stop triggers,
execution increments, fill ordering or any guaranteed maximum loss.

## Saved-quote example and preservation

A development-only artifact was saved at **2026-09-09T02:33:00.269Z**:
`data/runtime/options-workbench-development/cost-desk-example-20260909.json`.
It copies the 36 contracts from the already verified 01:30 candidate snapshot,
retains source clocks and original guidance blockers, and labels the later cost
calculation retrospective. All 144 comparison rows remain blocked. These are
calculations, not trades, realized outcomes or evidence of a win rate.

For the saved IBIT September 23 $45 call, bid/ask were $1.14/$1.20 at
2026-09-08T19:52:06.917657588Z; receipt was 19:52:08Z. One contract has a $120
premium. Under the explicit reviewed-rate assumption:

| Exit allowance | Fee reserve | Planned loss | Indicative exit/share | Rounded net target |
| --- | ---: | ---: | ---: | ---: |
| 0 ticks / $0 | $0.09 | $24.09 | $1.69 | $48.91 |
| 1 tick / $1 | $0.09 | $25.09 | $1.72 | $50.91 |
| 2 ticks / $2 | $0.09 | $26.09 | $1.75 | $52.91 |
| 5 ticks / $5 | $0.09 | $29.09 | $1.84 | $58.91 |

This is not a current quote or recommendation. Every row exceeds the $5 planned
loss and $25 full-premium caps. More generally, the $100 all-in selection minimum
and $25 all-in premium stress ceiling cannot both pass. Allocation changed under
the Owner's prior request; this module does not change independent risk policy.

A separate process recomputed all 36 reports and verified preserved bytes for
both old/new check snapshots, active settings, an issued guidance report and
both frozen PPI plans. The artifact SHA-256 is
`b98976e7cabbfbb698624b00209d186a0b3c35d72c8a5dfd07298553462b82b1`.
The service's later 02:36:14.818Z check retained null guidance costs, the confirmed
$100–$500 range and the original empty owner-ledger head
`a9d04c6517e2143e9d74dac740a1a2fd92511b1324392f4ec0a2816e52784e1c`.
Public context refresh was enabled. Runtime artifacts remain excluded from Git.

## Validation and changed files

- New engine: `src/engines/options-retail-feasibility/OptionsCostDesk.ts`.
- Frontend: new `apps/options-workbench/cost-desk.js`; app, views, API whitelist
  and readable errors. Server asset/POST routes and local data dispatch updated.
- Tests: `scripts/options-cost-desk.test.mjs`, package command and aggregate
  registration. Specification, checkpoint, README, AGENTS, Handoff and current
  operations index document the addition.

`npm run test:options-cost-desk`: **26/26 passed**, including SEC/TAF/CAT rounding,
sale-price convergence, net R across quantities/stops, unknowns, exact original
parity, input rejection, preserved risk blockers, HTTP protection/no writes and
frontend response invalidation. `npm run test:options-workbench`: **57/57 passed**.
`npm run typecheck` passed. `node scripts/alpha-validate.mjs` passed **4,112 tests
in 162 components**, zero failures, with the log at
`data/runtime/options-workbench-development/cost-desk-validation.log`.
After a singular/plural label correction, the 26-case suite passed again.
`git diff --check` passed; Git warned only about expected CRLF normalization.

Actual browser checks verified null-cost comparisons, the sourced assumption,
the IBIT arithmetic above, invalidation after editing, and reset. Desktop and
390x844 mobile were inspected; mobile document width and scroll width both 375px,
with the wide table contained in its own horizontal scroller. No browser errors.
Temporary inputs and viewport overrides were reset. The local service runs at
`http://127.0.0.1:4173` with hourly public context enabled.

## Remaining work and Git

No unresolved implementation failure was found. Fees/slippage are still
assumptions, and no source-specific paper execution path was qualified. First
reconcile the incompatible allocation and independent risk declarations with
the Owner, then require eligible source/contract/session evidence for the paper
adapter. Never relax caps, invent outcomes or use these calculations as proof
of execution. The fixed progress comparison remains **4 local / 3 partial /
3 not validated**; first real-price paper-flow gates remain **3 available /
3 open**. These counts are not a completion percentage.

Change set is on `codex/gld-ibit-options-foundation`, based on `b565550`.
The Owner's standing authorization covers the reviewed commit and push; the
conversation's final Git confirmation records the resulting commit. No pull
request, brokerage action, paid service or scheduling change is included.
