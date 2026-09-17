# Owner-supplied spread review

The Owner's opening screenshots describe debit verticals. The existing actual-fill
ledger accepts long single-leg options, so importing these as ordinary calls/puts
would omit the short legs and overstate their premiums and exposure. A separate
opening-review projection now preserves both legs, equal quantities, source
minutes, context-inferred year and locally copied screenshot hashes.

Trade journal and Reviews & lessons display the opening records. The Mistake
notebook includes combined-debit, opposite-direction/expiry, near-expiry,
closing-evidence, original-exit-plan, capital and actual-fee checks. An Owner
statement that positions were closed does not fabricate their closing executions.
Estimated fees remain estimates; realized PnL and the liquidation mechanism remain
unknown. Price-path examples use separate expiry endpoints and are not observations.

Overview, Daily guidance and Trade planner warn that previously declared planning
funds are not refreshed brokerage balances. Owner-reported buying power is shown
with its basis, not relabeled equity or settled cash. These are review diagnostics
and visible cautions, not an automatic order block or a new allocation policy.

Private cases, financial amounts, notes and screenshot copies live only in ignored
`data/runtime/options-reported-spreads/`. Existing ledger totals, source journals,
issued guidance, paper plans and schedules retain their original meaning.

Validation covers exact leg arithmetic, unknown fees/closing state, mismatched
expiries, invalid inputs, no-overwrite storage, copied-only recovery, tampering and
escaped rendering. The live screenshot-derived review still requires closing
evidence before an outcome or error-cause analysis can be completed.

Validation completed September 17: `node scripts/alpha-validate.mjs` passed its
4,540 counted checks; the focused spread review suite passed all ten checks after
adding the capital-caution assertion. Type checking and the 57 workbench checks
passed. Browser readback confirmed the separate journal table, eight candidate
notes and the Daily guidance capital caution. The existing local service was
restarted after matching its workspace and listener; source schedules were not
changed, and startup itself is not proof of a new successful source collection.
