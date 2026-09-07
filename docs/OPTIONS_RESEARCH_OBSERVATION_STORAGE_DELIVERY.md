# Research observation storage and independent recovery

September 7, 2026. OPT-RESEARCH-OBSERVATION-1 storage unit.

The observation command now supports --record <workspace-json> and --verify
<observation-id>. It exclusively saves the original inspection payload followed
by a receipt whose save clock is read after fsync/close. Recovery uses both
original protocol/context pairs through their unchanged verifiers, preserving
original observation clocks and exact evidence identity.

## Changes and validation

The observation CLI gained private dependency/inspection composition helpers and
exclusive storage/recovery. Existing inspection output semantics remain intact.
The new storage tests and package/full-bundle registration cover 16 cases in
addition to the 19 existing inspection cases. Delivery/status and handoff/roadmap
pointers record the resulting bounded local capability.

`node node_modules/tsx/dist/cli.mjs scripts/options-research-observation.test.mjs`
passed 19/19. The matching `scripts/options-research-observation-storage.test.mjs`
passed 16/16. Full bundle command: `node scripts/alpha-validate.mjs`; its final
result and preservation checks are in [the checkpoint](status/research-observation-storage.json).
The first integrated check found a link to the overall-progress checkpoint while
that new file was being prepared; it was added before rerunning.

Actual-clock isolated recording at 21:21:44 UTC used a synthetic protocol/note
and copied existing context. A fresh process recovered exactly six files (three
pairs), matched payload/inspection hashes and retained the original observationAt.
Temporary workspaces were removed. No formal active protocol or research note was
created by the rehearsal. Tests cover partial/duplicate pairs, failed writes,
clock regression, rehashed tampering, missing dependencies, encoding/size limits,
hard links, junctions and recovery without original inputs or source journals.

## Assumptions, limits and next work

The embedded inspection remains an unsaved inspection snapshot; the outer receipt
separately supports its local saved-record claim. Missing dependencies block
recovery. All three pairs must be retained together; old export versions do not
include them. Evidence is not externally timestamp-attested or atomic across
stores. NO_TRADE text is not a completed outcome. Feature/episode/outcome facts
remain unknown; no sample, calibrated probability, approved lesson or trade is
created. No old journal, plan, review, notebook or capture was rewritten.

This closes local storage acceptance for workstream 04 in the
[overall baseline](OPTIONS_DEVELOPMENT_PROGRESS.md). The three open real-price
paper-flow gates remain unchanged: qualified quotes, a source-specific adapter
and the end-to-end run. A subsequent export extension needs its own bounded
specification. Scoped commits/pushes use standing authorization; the completion
report supplies final Git refs and state.
