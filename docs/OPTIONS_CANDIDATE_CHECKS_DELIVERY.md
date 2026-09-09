# Candidate quote, cost and risk checks

September 8, 2026 New York. [Specification](specifications/OPTIONS_CANDIDATE_CHECKS_V1.md)
and [dated acceptance evidence](status/candidate-checks.json).

Daily guidance now explains why each sampled GLD/IBIT contract passes, fails or
has unknown local inputs. This is the preparation step before a source-specific
paper adapter. The accepted guidance and feasibility calculations are unchanged.

## Behavior

The 15 groups cover capture scope, session, contract/expiry, clocks, prices/spread,
displayed size, delta, trend/context, events, costs, allocation, planned loss,
full-premium stress, net reward and declared cash. Every original blocker and
economic value is retained; an unmapped blocker cannot disappear.

The table separates premium affordability from total capital, planned loss and
full-premium stress. For the $1,000 scenario, the unchanged ceilings are $50
allocation, $5 planned loss and $25 full-premium stress. A $47 premium can fit
the allocation ceiling yet fail both loss checks. Missing fees/slippage remain
unknown; a declared zero does not mean verified free execution. Known premium
excess stays blocked even with unknown total costs.

Asset and premium-budget filters retain the original sample denominator and
decisions. Inspect checks opens exact source/receipt/assessment clocks, original
blockers and next actions. An unsaved planning-assumption draft disables snapshot
saving and survives page navigation. Discard restores the saved assumptions.

Saving creates an exclusive local check snapshot with actual recording time,
copied normalized inputs, source path references and recomputable fingerprints.
It reassesses at save time and reports that clock; it does not claim the exact
earlier screen assessment was saved. Recovery does not require the live source
stores. Fingerprints establish local consistency, not provider authenticity.
Reading the page writes no check snapshot. History shows the latest 24 entries;
the bounded store refuses new saves after 500 rather than deleting old records.

## Actual saved-data result

The UI saved and the CLI independently verified:
`data/runtime/options-candidate-checks/2026-09-09T01-05-32-047Z-96f5e859-8411-4095-9f8d-7acacad28b1c.json`.

Assessment: 2026-09-09T01:05:29.732Z. Recording: 2026-09-09T01:05:32.047Z.
The latest sampled market capture was September 8 at 19:52:08 UTC.
All 36 contracts in the existing **14–45 DTE guidance sample** exceed the $50
premium ceiling; zero are conditional research candidates. This is not a finding
about every short-expiry contract in the separate full-chain close survey.
Costs remain unknown, source clocks are stale at this after-hours assessment,
and the observed trend lacks five recent distinct official closes.

No contract was registered as an owner trade. The owner ledger remains at zero
events/trades. The frozen PPI studies and old issued guidance still independently
verify. No new brokerage read, account tool, order, provider, schedule or paid
data was used. The local service was restarted with hourly public context
refresh enabled; its existing source workflow remains separate.

## Files and validation

- Engine: `src/engines/options-daily-guidance/OptionsCandidateChecks.ts`.
- Storage/commands: `scripts/lib/options-candidate-checks-io.mjs`,
  `scripts/options-candidate-checks.mjs`, workbench data/server integrations.
- Frontend: `apps/options-workbench/candidate-checks.js`, guidance, app, API
  route allowlist and scoped styles.
- Tests: `scripts/options-candidate-checks.test.mjs`, package commands and
  aggregate validation registration; specification, delivery and status indexes.

```powershell
npm run options:candidate-checks -- --report
npm run options:candidate-checks -- --save
npm run options:candidate-checks -- --verify data/runtime/options-candidate-checks/2026-09-09T01-05-32-047Z-96f5e859-8411-4095-9f8d-7acacad28b1c.json
npm run test:options-candidate-checks
node scripts/alpha-validate.mjs
```

The 35 focused tests cover original-result parity, affordable-but-risk-blocked
contracts, unknown/zero costs, spread friction, missing/stale/future data, exact
blocker retention, hash/recomputation failure, future clocks, path/link attacks,
exclusive recovery, filtering, escaping, draft protection and protected saves.
The full bundle passed 4,057 tests across 160 components, including TypeScript,
Markdown, provider/network boundaries, credentials, runtime exclusion and both
Git whitespace checks. A final detail-view addition exposes full ISO clocks;
the 35 focused tests passed again afterward. The dated checkpoint retains the
exact validation log and the reviewed base commit. This unit is committed and
pushed under the Owner's standing authorization; runtime data remains local.

Browser acceptance checked desktop and 390x844 layouts, 36-to-18 asset filtering,
zero-result budget filtering, all 15 detail groups, draft preservation/discard,
real snapshot save, independent recovery and service-restart recovery. The phone document and dialog fit
the viewport; internal tables scroll. No browser console errors were reported.

During verification, a fixture event clock and real source-path timestamp pattern
were corrected. Browser QA found a missing frontend API allowlist entry; that
was fixed with a request-wrapper regression test. A missing runtime ignore entry
was caught by aggregate validation and added before the successful final bundle;
no runtime snapshot was staged or committed. Snapshot timeouts now instruct
the user to inspect saved history before saving again. These resolved issues did
not change original guidance, risk calculations or issued records.

## Remaining work and limits

Source-side/size timing, full contract/deliverable and exchange-session evidence,
source-use qualification, declared costs and a reviewed source-specific paper
execution model remain open. PASS means only that a named local condition passed.
It does not establish a fill, stop execution, expected profit or win probability.
Cost/account values remain declarations; current source precision and liquidity
do not support intrabar stop-path inference. Persistence is single-process.

The fixed ten workstreams remain 4 locally validated / 3 partial / 3 not validated;
the six first-real-price gates remain 3 available / 3 open. Next resolve the
source qualification requirements before the Robinhood paper adapter, and assess
the already frozen event observations when actual eligible records arrive.
No risk limit is relaxed to force a trade.
