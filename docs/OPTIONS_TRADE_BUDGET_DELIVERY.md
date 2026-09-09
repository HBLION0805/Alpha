# Per-trade allocation update

September 8, 2026 New York. The Owner confirmed **$100–$500 per trade** while
total capital remains **$1,000**. [Specification](specifications/OPTIONS_TRADE_BUDGET_V1.md)
and [activation evidence](status/trade-budget.json).

## Active behavior

The new range is saved as `OWNER_TRADE_BUDGET_V1` and applies to whole-position
premium plus the declared round-trip fee reserve. Daily guidance, Candidate
checks, Overview and Trade planner display the same declaration. Candidates
transferred to the planner retain the range. The settings and planner expose
editable minimum/maximum fields; both blank mean the historical 5% policy.

The minimum is a selection constraint. The system never buys additional
contracts to reach it. Premium filters show below/within/over separately; their
counts exclude fees and do not establish all-in affordability. Missing costs
remain unknown. Fees can push a contract above the maximum or bring total
capital to the minimum, using exact integer cents.

Only allocation changed. The independent planned-loss ceiling remains 0.5% of
equity ($5 here), full-premium stress remains $25, and settled cash is still a
declaration. Current premium stop is 20%, target 2R and costs are unknown.
A $150 illustrative position with explicitly assumed zero costs has a $30
planned loss and $150 premium stress: it fits the range but fails both loss caps.
The browser used this unsaved scenario only; no owner trade or fill was created.

## Actual activation and preservation

Settings were saved at 2026-09-09T01:28:40.613Z:
`data/runtime/options-daily-guidance/settings/2026-09-09/2026-09-09T01-28-40-613Z-77597bbd-9ff0-4930-a187-0fa48e78f63a.json`.

The new independently verified check snapshot was assessed at
2026-09-09T01:30:10.092Z and saved at 01:30:12.199Z:
`data/runtime/options-candidate-checks/2026-09-09T01-30-12-199Z-b29b7564-22fd-46f3-bab0-786f1dc64992.json`.

In the existing 36-contract, 14–45 DTE sample, 17 premiums are within the new
range, 18 above and one below. All 36 remain NO_TRADE. This does not describe
every listed expiry/strike; the source sample and acquisition schedule did not
change. Current fees, trend and after-hours source freshness remain unresolved.

The original candidate snapshot still recovers with its original zero-affordable
result and identical fingerprint. The old issued recommendation, both frozen
PPI plans and empty owner ledger independently verify. New daily guidance and
candidate projections use v2 output labels; only explicit budget scenarios use
retail adapter schema 3.0. Legacy inputs still use the unchanged v2 calculator.

## Changed files and validation

- Added `src/contracts/OptionsTradeBudget.ts` and the allocation adapter in
  `src/engines/options-retail-feasibility/OptionsTradeBudget.ts`.
- Updated guidance settings/contracts, candidate checks, event-research dispatch
  and the workbench calculator route to use the explicit declaration.
- Updated frontend app/forms/guidance/candidate/overview/planner views, package
  and aggregate test registration. Added `scripts/options-trade-budget.test.mjs`.
- Updated this specification/delivery/checkpoint and current-state indexes.

29 new tests passed: legacy parity, exact range boundaries, fee crossings,
unknown costs, explicit quantities, independent risk/cash/friction/probability,
invalid/accessor inputs, versioned recovery, frontend range/filter/transfer and
protected HTTP settings with service restart. Existing guidance (65), candidate
checks (35), event research (64) and workbench (57) suites passed.

The aggregate command `node scripts/alpha-validate.mjs` passed 4,086 tests across
161 components, including TypeScript and repository checks; the dated checkpoint
retains the log. Desktop and 390x844 browser
checks confirmed 17 within-range rows, one below-range row, synchronized settings,
planner transfer, risk arithmetic and no page overflow or console errors.
Draft-only illustrative costs were reset. An actual service restart recovered the
new range, both check snapshots and empty owner ledger with no blocked components;
hourly public refresh remained enabled. Runtime data remains excluded from Git.

No unresolved implementation failure was found. Assumptions remain a standard
100-share contract, declared costs and no execution guarantee. This request
does not change source qualification, frozen outcomes, trade authority or the
three open real-price gates. No account/order calls or schedule changes were made.
Next resolve source/cost evidence and the separately retained risk constraints
before any real-price paper flow; increasing allocation alone cannot qualify it.
