# Collection coverage and budget exclusions

Date: 2026-09-07. Follow-up to the
[first-opening handoff](OPTIONS_FIRST_OPENING_HANDOFF.md).

Review identified a reporting interpretation risk: the existing closeout's
complete-usable metric includes premium allocation/stress exclusions. A reader
could mistake zero complete-usable coverage for failed collection. The separate
request/frame coverage and fixed blocker codes already retain the distinction;
no production calculation or historical report needed to change.

Changed files: one additional regression in `RobinhoodCloseoutEngine.test.ts`,
the runbook's explanatory prose, the first-opening handoff, this delivery and its
[checkpoint](status/coverage-interpretation.json). The exact Host JavaScript,
phase fields, stored heartbeat, source engines, denominators and risk limits are
unchanged. This is a focused test/documentation clarification, not a new subsystem.

The added scenario uses the existing synthetic contract/quote fixture with a
$1.00 ask and $0.98 bid per unit. One contract's $100 ask premium exceeds both
existing budget limits. The real assessment and closeout functions correctly
produce one successful automatic attempt and frame, zero failed source calls,
100% request/frame coverage, zero complete-usable coverage and the two explicit
premium exclusion codes. The test asserts no source-error or operational-failure
lesson is invented, and no trade or win probability is produced.

The legacy `sourceBlockerCounts` counts affected frames per code, including budget
codes. Summing these counts can count the same frame multiple times. Review code
identity and units before interpreting this field. Never remove a frozen contract,
lower a risk limit or manufacture another source call to improve the usable metric.

Commands: `npm run test:options-robinhood-closeout` passed **24/24**,
`npm run test:options-robinhood-collection-host` passed **16/16**, and
`npm run typecheck` passed. Preservation hashes, local links and Git diff were
checked. No check failed. The previous full 3,107-test bundle remains the last
aggregate execution; it was not repeated for this test/prose-only change and is
not relabeled as a newly executed 3,108-test result.

Twenty-seven protected files and the stored host matched. No market tool, source
append, account/order call or trade occurred. The new test's prices and times
are synthetic, not refreshed quotes for any actual selected contract. The actual
opening window remains pending; inspect its recorded source failures, frame
coverage, per-contract blockers and candidate lessons together after collection.

The changes are reviewed and committed/pushed under standing Owner authorization.
No runtime/strategy change or new scheduling permission is introduced.
