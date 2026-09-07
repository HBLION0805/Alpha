# GLD/IBIT declared portfolio risk delivery

Task **OPT-PORTFOLIO-RISK-1**, September 7, 2026. The Owner authorized the next
portfolio-risk module and its development, saving, commit and push. Design was
reviewed before implementation in the [specification](specifications/OPTIONS_PORTFOLIO_RISK_V1.md).
The configured model was retained; no agent delegation was used.

## Result and purpose

Alpha can now assess **one complete declared $1,000 cash portfolio scenario**,
combining GLD/IBIT holdings, pending entries and a proposed candidate. Previously
the retained risk checks described individual paper plans or independent
historical trials. Those accounts cannot be added together to manufacture an
actual portfolio. This separate module leaves their original engines and ledgers
unchanged while making combined cash and loss constraints reviewable.

It computes settled/unsettled cash, reservations, current modeled equity,
full-premium exposure, original planned R, loss from current marks back to the
planned stop, daily net realized losses and high-water drawdown. Missing marks
make equity unknown while preserving original cash debits and premium exposure.
GLD and IBIT receive no assumed diversification offset. Reached stop, target,
time-exit and expiry conditions flag unresolved exposure rather than fabricate
an exit. Simultaneous mixed closed outcomes retain an unknown loss-streak order.

The module retains existing simulation limits: one holding or pending order,
normal 5% allocation, planned risk of 0.5% current equity, $25 pre-exercise
full-premium-and-fees stress, $10 net daily loss and 5% high-water drawdown.
These limits are not a guarantee that an actual stop can execute at its price.
The seven fixtures use a 20% premium stop with existing modeled costs; they do
not select an optimal stop or alter the user's active trading configuration.

Settlement is an explicit declaration with settlement and receipt clocks.
Only a received declaration credits cash; no elapsed-day assumption does so.
Robinhood's [settlement reference](https://robinhood.com/us/en/support/articles/T1-settlements/)
describes one-trading-day settlement for stocks, ETFs and options; its
[buying-power reference](https://robinhood.com/us/en/support/articles/360001226946/)
distinguishes unsettled-fund access by account type. These public references
were read September 7. This engine neither computes the broker's settlement
calendar nor verifies the Owner's account type, balances or restrictions.

Event coverage is a dated manual declaration. Explicit blackout intervals and
date-only overlaps remain distinct. No BLS/FOMC calendar record silently becomes
a trading prohibition, and absence of a reviewed event window blocks a favorable
assessment. No numerical event-impact score or win probability is invented.

## Run and inspect

```powershell
npm run options:portfolio-risk -- --demo
npm run options:portfolio-risk -- --input fixtures/options-portfolio-risk/portfolio.synthetic.json
npm run options:portfolio-risk -- --demo --save my-portfolio-scenario
npm run options:portfolio-risk -- --verify my-portfolio-scenario
```

Use a new save ID: existing or incomplete artifacts cannot be overwritten.
Saved JSON contains the exact scenario, recomputed report, English operator
brief, actual recording clock, input-byte hash for file imports and artifact
hash. UTF-8, duplicate decoded keys, bounds, path containment and link checks
precede use. A separate process can recompute every result. Hashes demonstrate
local consistency, not broker or publisher authenticity.

Actual local rehearsal: `data/runtime/options-portfolio-risk/portfolio-rehearsal-20260907.json`,
recorded **2026-09-07T17:44:47.002Z**, artifact hash
`6ef571cf6997889887c26e710b29651d5dd7af07643d6e11af0d33d4c9857906`.
The independent CLI process recomputed it at **17:44:47.705Z**.
The local-file path was also exercised and saved as `portfolio-input-20260907`,
recorded **17:44:47.019Z**, hash
`e47315de05be7527d031f7b98a41e8efc4ae56ea1db284fb204b6a1c1837dc30`.
Scenario dates are hypothetical September 8 clocks; recording times are actual.

| Synthetic scenario | Result | Reason or measured amount |
| --- | --- | --- |
| One candidate with complete declarations | Within declared limits | $20.20 premium and fees, $4.20 planned R |
| Open IBIT holding plus GLD candidate | Blocked | Two exposures, $40.40 gross capital and $8.40 planned R |
| Missing open-position mark | Blocked | Equity unknown; $20.20 committed exposure retained |
| Closed sale without settlement declaration | Within declared limits | $28.90 remains unsettled; candidate fits other settled cash |
| Overlapping date-only event | Blocked | Requires manual review; no intraday time invented |
| Expired pending-entry deadline | Blocked | $20.20 remains reserved; no cancellation invented |
| Unknown account/history/high-water/event review | Blocked | Missing declarations remain explicit |

These are **seven diagnostic scenarios, not seven executed trades**. Five are
blocked, two meet declared limits. Those counts cannot establish strategy
success, historical win rate or probability. No new trade, causal claim or
approved mistake-notebook lesson was generated. Closed scenario inputs use the
existing review engine; original five paper reviews and all retained notebooks
remain unchanged.

## Files, review and validation

- New contract: `src/contracts/OptionsPortfolioRisk.ts`.
- New engine and scenario builders under `src/engines/options-portfolio-risk/`.
- New offline CLI and I/O tests: `scripts/options-portfolio-risk.mjs` and
  `scripts/options-portfolio-risk.test.mjs`; new engine test file alongside engine.
- Local JSON example: `fixtures/options-portfolio-risk/portfolio.synthetic.json`.
- Narrow runtime ignore, package commands, aggregate validation registration,
  specification, this delivery, checkpoint and focused project navigation notes.

Focused engine coverage has **41 cases**; focused CLI/I/O has **18 cases**. Coverage includes
receipt-time settlement equality and delays, weekend passage, negative net sale
fees, historical cash deficits, reserves, mixed-asset exposure, daily/drawdown
boundaries, unknown/stale/future/zero-size quotes, reached exits, New York dates,
simultaneous outcomes, duplicate plan reuse, origin isolation, invalid inputs,
immutable reports, corrupt/rehash-modified artifacts and independent processes.

Development issues resolved before delivery: TypeScript narrowing required a
function declaration for the always-throwing validator; the Windows child test
needed package `tsx` instead of an absolute drive path in `--import`. Neither
failure involved a source write, broker action or lost artifact. Focused tests
and typecheck passed after correction. Final review also aligned fractional-cent
stop triggers with the existing paper engine's earlier-tick rounding and added
a regression case. The first aggregate run found two links to the not-yet-written
delivery checkpoint; creating that record resolved the documentation failures.
The full validation result and source/
host preservation check are recorded in [the checkpoint](status/portfolio-risk.json).

## Boundaries and remaining work

History completeness, modeled costs, account mode, high-water equity, fills,
settlements and event windows are assertions. This is not a connected broker
account or active portfolio enforcer. External cash flows, partial fills, shorts,
multi-leg structures, exercises and resulting stock positions are unsupported.
Marks, stop execution and historical unrealized peaks retain explicit limits.
No source-specific replay adapter, strategy calibration or size increase was added.

The September 8 **09:30-09:50 New York** frozen opening collection and v6 daily
restoration remain unchanged. Next useful independent work is a bounded
structure/cost/risk comparison; source quality and actual quote paths must still
be assessed before a separate Robinhood paper adapter. All automatic orders
remain off. No brokerage/account tool, paid data, source refresh or host mutation
occurred. Two official public settlement documentation pages were inspected.

Runtime artifacts remain ignored. Git delivery contains only the reviewed code,
tests, configuration and documentation; the final conversation records the
authorized commit/push revision and repository status.

Final full-bundle validation passed **3,238/3,238 tests across 127 components**,
zero failures, **63,149 ms**. The 41 engine and 18 CLI/I/O cases all passed;
TypeScript typecheck and link/configuration checks passed. Remaining warnings
were the expected uncommitted-change and Windows line-ending notices. All
**488 protected file hashes** and the actual stored v6 host hash matched after
validation. Both previously saved portfolio artifacts independently recomputed
after the stop-rounding correction with their original hashes intact.
