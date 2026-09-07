# Options sample partition and existing-journal inventory delivery

September 7, 2026. Tasks OPT-SAMPLE-PARTITION-1 and OPT-SAMPLE-INVENTORY-1.
Base revision `a9fab64`; the initial working tree was clean. The Owner requested
automatic continuation after reports and authorized saving, commits and pushes.

## Result and purpose

The declared partition engine audits chronological TRAIN, VALIDATION and HOLDOUT
windows, explicit separation gaps, feature/outcome clock boundaries and reused
evidence. Samples remain visible when blocked, purged, unresolved or outside a
window. Same-day, episode, exact-evidence and observation reuse cannot cross
partitions without blocking every participant. Within-group reuse is disclosed.
No profit value enters partition selection. A passing declaration does not
establish a sealed holdout, verified source, independent sample size or win rate.

The follow-on inventory composes the original paper and historical outcome
engines and identifies missing sampling fields in every existing case. It uses
declared plan decision clocks and preserves actual research recording clocks;
it does not turn a simulated exit into evidence that a historical outcome was
known at that time. Different plans sharing an exact quote path are discoverable
without conflating plans, source semantics or unrelated accounts.

## Actual evidence

- `partition-rehearsal-20260907`, recorded `2026-09-07T18:47:31.582Z`: two
  synthetic declarations. The clean six-sample declaration assigns two cases
  to each window. The second retains one assigned, two purged and three blocked
  cases. These twelve declared examples are not twelve market observations.
- `sample-inventory-20260907`, recorded `2026-09-07T18:53:44.696Z`:
  **15 current cases**, **9 closed reviews**, zero complete partition inputs.
  Seven paper cases retain five closed reviews; eight historical cases retain
  four closed reviews. Cancelled, no-trade, blocked and exit-pending outcomes
  remain present. Two decision-date groups are shared; no exact repeated path
  group was found. Non-matching paths do not prove independence.
- Inventory artifact fingerprint:
  `4c9fb78f893523806a7a71da9603af5aa71d79c0c34bf1b704c32fb8cdb235db`.
- Both saved artifacts recomputed in separate CLI processes. They preserve
  original histories and check clocks without reopening active stores during
  verification. Local hashes prove consistency, not provider authenticity.

The original 15 cases have no complete feature lookback, features-known clock,
verified outcome-knowledge clock, reviewed dependence group and registered
sampling protocol. Those fields remain explicitly missing. The system generates
no automatic partition manifest from incomplete source records.

## Files and validation

New files: `src/contracts/OptionsSamplePartition.ts`; engine, inventory, fixtures
and tests in `src/engines/options-sample-partition/`; two CLI scripts and their
tests; `fixtures/options-sample-partition/partition.synthetic.json`; two task
specifications, this delivery and the checkpoint below.

Modified files: `.gitignore`, package scripts and aggregate registration;
`scripts/options-outcome-audit.mjs` extracts its unchanged history-loader sequence
for both read-only consumers; narrow README, architecture, decisions, changelog,
roadmap, handoff, operations and AGENTS notes. No original calculation engine,
risk gate, trade notebook, quote request or source transport changed.

Commands exercised:

```text
node node_modules/typescript/bin/tsc --project tsconfig.json
node node_modules/tsx/dist/cli.mjs src/engines/options-sample-partition/OptionsSamplePartitionEngine.test.ts
node node_modules/tsx/dist/cli.mjs scripts/options-sample-partition.test.mjs
node node_modules/tsx/dist/cli.mjs src/engines/options-sample-partition/OptionsSampleInventory.test.ts
node node_modules/tsx/dist/cli.mjs scripts/options-sample-inventory.test.mjs
node node_modules/tsx/dist/cli.mjs scripts/options-outcome-audit.test.mjs
node scripts/alpha-validate.mjs
node node_modules/tsx/dist/cli.mjs scripts/options-sample-partition.mjs --verify partition-rehearsal-20260907
node node_modules/tsx/dist/cli.mjs scripts/options-sample-inventory.mjs --verify sample-inventory-20260907
```

Focused tests: partition **29**, partition storage **16**, inventory **12**,
inventory storage **13**; original outcome storage **9**. Full validation:
**3,367/3,367 tests across 133 components**, zero failures, 71,367 ms. Warnings
were the expected dirty working tree and Windows LF/CRLF notices. Two earlier
test-development issues were fixed: a Node assertion import lacked the repository's
restricted TypeScript declarations, and a fixture expected OPEN while the original
engine correctly retained EXIT_PENDING. Existing assertion conventions and the
correct unresolved-state expectation fixed both; no risk logic changed.

The post-validation audit at `2026-09-07T18:59:44.750Z` confirmed **508/508 prior
runtime/runbook/restoration/host files unchanged**. Runtime outputs remain ignored.
The exact source hashes and full validation summary are in
[the delivery checkpoint](status/sample-validation.json).

## Limits and continuation

The gap and exclusion policies are declared research choices, not optimal trading
parameters. Selection completeness and missing dependencies cannot be inferred
from a manifest. No training, preprocessing, sealed evaluation, calibrated
probability, automatic strategy change or broker action is implemented here.
Actual eligible-session quotes and separately manifested point-in-time features
are still needed. Public reference research used
[scikit-learn's evaluation guidance](https://scikit-learn.org/stable/modules/cross_validation.html)
and [leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html);
their principles do not validate Alpha's samples or thresholds.

The next requested operational step is report-to-development continuation. Codex
rejected a second heartbeat because this task already uses `gld-ibit`. A separate
reviewed continuation design must share that automation while protecting its
frozen opening window, exact requests and restoration-first ordering. This
delivery's preservation audit predates any subsequently authorized host update.
Final Git revision and remote synchronization are confirmed after commit.
