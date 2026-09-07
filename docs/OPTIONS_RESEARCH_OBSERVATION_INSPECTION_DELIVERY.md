# Research observation reference inspection delivery

September 7, 2026. OPT-RESEARCH-OBSERVATION-1, first implementation unit.

`npm run options:research-observation -- --inspect <workspace-json>` now validates
one exact GLD/IBIT observation or no-trade declaration and independently recovers
its saved protocol and context pairs. Both completed verification clocks must
strictly precede the newly observed local clock. Equal or regressing clocks fail;
there is no supplied historical time, wait or fabricated clock increment.

## Changes and purpose

- `src/contracts/OptionsResearchObservation.ts` declares the bounded input.
- `scripts/options-research-observation.mjs` validates input, calls both original
  verifiers, checks dependency byte identities and preserves the full original
  context report. It rechecks input and dependency bytes before returning.
- `scripts/options-research-observation.test.mjs` adds 19 acceptance tests.
- `package.json` exposes inspection/test commands; `scripts/alpha-validate.mjs`
  includes the new tests in the existing complete validation bundle.
- This delivery, the [checkpoint](status/research-observation-inspection.json),
  handoff and roadmap record current capabilities and the next bounded unit.

The original protocol/capture implementations and their stored artifacts are
unchanged. Typed input validation rejects unrelated instruments, supplied clocks,
authority fields, unsafe IDs, malformed JSON and invalid text. Exact UTF-8 input
bytes, including a BOM, remain recoverable in the inspection result.

## Evidence

- `node node_modules/tsx/dist/cli.mjs scripts/options-research-observation.test.mjs`:
  19/19 passed, including rehashed tampering, changing dependencies, no-trade
  semantics, unknown source coverage, late registration, immutable inputs, unsafe
  paths/hard links and fresh-process inspection without original protocol input.
- `node scripts/alpha-validate.mjs`: 3,478/3,478 passed across 141 components,
  zero failures. Expected uncommitted-worktree and Windows line-ending warnings
  were reviewed; full output remains in the ignored local validation log.
- An actual-clock rehearsal at 21:08:00 UTC used an isolated synthetic protocol
  and a copy of `context-first-local-20260907`. A fresh process matched protocol
  and context identities and retained all 174 context members. It did not read
  source journals or save an observation. The temporary workspace was removed.
- 524 protected existing files, including original journals, the context pair
  and active shared host configuration, matched their accepted byte hashes.
- `git diff --check` passed. Scoped changes are committed/pushed under the
  standing Owner authorization; the completion report supplies the final commit.

## Limitations and next unit

Inspection is not durable observation storage: recordSaved is false and
payloadSavedAt is null. Protocol/context verification identifies saved local
evidence without external timestamp attestation or an atomic cross-store snapshot.
The context age at inspection is separate from its original freshness assessment;
recovery never refreshes data or proves current freshness. Window membership is
only a point-clock diagnostic, not assignment of a whole sample interval.

Feature availability, episode and outcome facts remain null. NO_TRADE text does
not become a completed NO_ENTRY paper outcome, successful review or approved
mistake guard. No sample, probability, strategy change, formal active protocol,
source refresh, scheduler change or trade was created by this unit.

Next implement exclusive observation payload/receipt storage and recovery with
both original dependency pairs, following the
[reviewed design](specifications/OPTIONS_RESEARCH_OBSERVATION_V1.md). Preservation
of exact dependencies is required; current evidence export versions do not yet
include these stores. Actual formal research inputs and independently qualified
GLD/IBIT option quotes remain separate requirements for a real-price paper flow.
