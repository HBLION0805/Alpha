# Context member manifest: pure engine delivery

September 7, 2026. Task OPT-CONTEXT-MANIFEST-1, first implementation unit.
Design base `ce1b8c7`. The automatic wake routed at
`2026-09-07T19:46:12.511Z` with deadline `2026-09-07T19:56:12.511Z`.

## Change and purpose

`src/engines/options-readiness/OptionsContextManifest.ts` composes the original
cutoff v2 reconstruction and lists its exact selected source members. Each member
retains its source, category, original history index, canonical record SHA-256
and original receipt/discovery clock. This provides explicit references for the
later capture receipt without changing the existing context or source engines.

The original engine validates each complete history before membership selection.
Corrupt later records still block their component. Missing, blocked and available
empty histories remain distinct. Null-clock health rows are excluded; failed
retrievals with known receipt times remain members. Equal-clock duplicate records
are retained by index. Later valid appends preserve earlier manifest identity.

The member bound is 42,732, derived from the existing source validators: 20,000
headline observations, 20,000 health records, 1,000 Treasury and BTC retrievals
each, and 366 BLS and FOMC retrievals each. Oversized source histories retain the
existing BLOCKED result; no truncation manufactures a valid prefix. The manifest
uses canonical structured-record hashes. Byte-exact payload hashes belong to the
subsequent capture protocol, not this engine.

Changed files are the engine, its focused tests, one full-validation registration,
this delivery and checkpoint, and narrow HANDOFF/ROADMAP continuation notes.
Existing cutoff/source/risk engines and CLI behavior remain unchanged.

## Validation and review

Commands: the new test file through `node node_modules/tsx/dist/cli.mjs`,
`node node_modules/typescript/bin/tsc --project tsconfig.json`, the full
`node scripts/alpha-validate.mjs`, protected-file hash comparison, JSON/link
checks, and `git diff --check`. Measured results and preservation evidence are
recorded in [the checkpoint](status/context-manifest-engine.json).

Review checked complete-history validation before membership, inclusive cutoff
semantics, original index/category identity, independent unavailable states,
fixed diagnostics, unchanged original reconstruction and deterministic hashes.
The tests exercise all five source types, clock boundaries, duplicates, later
corruption/appends, failures, limits and immutable output.

## Remaining scope and assumptions

This unit has no CLI, capture pair, durable save-clock observation or recovery
receipt. No actual prospective capture has occurred. It does not complete the
existing sample inputs, produce predictive features or qualify a paper fill.
Clock and checksum claims remain local, without provider authentication.
Trading, market calls, source appends and host edits are absent.

Next bounded unit: extract the existing cutoff history loader without changing
v1/v2 behavior, then add inspect/capture/recovery with exclusive payload and
receipt files. Preserve post-payload fsync clock ordering and partial-pair errors.
Use the reviewed [specification](specifications/OPTIONS_CONTEXT_MANIFEST_V1.md).
The first-wake design commit `ce1b8c7` was pushed during this wake; this verified
unit follows the Owner's existing commit/push authorization. Final Git refs are
checked after commit. No user input is needed to continue local implementation.
