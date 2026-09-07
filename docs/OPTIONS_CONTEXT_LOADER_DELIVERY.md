# Reusable context history loader

September 7, 2026. Follow-up implementation unit in OPT-CONTEXT-MANIFEST-1,
base `f2ff10d`, within the September 7 19:46 development wake.

`scripts/options-context-cutoff.mjs` now exports its existing history-loading
sequence for the capture consumer. Source paths, byte limits, recovery locks,
before/after byte comparisons, error mapping and clock call order are unchanged.
The original CLI invokes this same helper and reconstructs with the same v1/v2
engine. The helper returns source inputs, not an independently validated context;
consumers must compose the original cutoff engine before using them.

This avoids a duplicate loader when adding capture persistence. The existing
23 CLI tests were retained, with two integration tests added for five-source
manifest composition and invalid loader-version rejection. Product commands and
help remain unchanged. Other changed files are this delivery, its checkpoint,
and a narrow HANDOFF continuation note.

Validation uses `node node_modules/tsx/dist/cli.mjs scripts/options-context-cutoff.test.mjs`,
the full `node scripts/alpha-validate.mjs`, an actual read-only local member
inspection, protected-file hash checks and `git diff --check`. The checkpoint
records the measured [results](status/context-loader.json). The actual inspection
uses the current clock and old source journals; it is not a source refresh,
capture receipt or proof that context is sufficiently fresh for a trade.

Review confirmed the original four-source route never opens the fifth store,
the original cutoff engines still perform final validation, and no source bytes,
host fields or stored outcomes change. Assumptions about local clocks, source
authenticity and incomplete sample inputs remain unchanged. No tests establish
strategy accuracy or execution permission.

Next unit is exclusive capture-pair storage and recovery. Do not use this helper
alone to certify a saved payload or historical decision. Preserve the separate
post-payload-fsync clock and all partial-pair failure cases from the design.
The Owner's existing authorization covers this scoped commit/push; no new approval
is required. Detailed final refs remain in Git history.
