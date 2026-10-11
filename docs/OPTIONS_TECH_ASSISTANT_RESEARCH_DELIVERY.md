# Assistant research diagnostic adapter — October 11, 2026

## Delivered capability

The separate `scripts/options-tech-assistant-research.mjs` CLI accepts explicit
ASSISTANT research revisions and non-executing preparation requests. It reuses
the existing bounded `techresearch` comparison store and exact candidate/source
replay. It does not change the execution origin whitelist or the original
candidate handoff. `ASSISTANT_RESEARCH` has only
`DIAGNOSTIC_PREPARATION_ONLY` capability, never Owner confirmation, research PASS,
quote review admission, Paper admission or execution permission.

Commands: `--preview INPUT`, `--append INPUT --preview-fingerprint HASH`,
`--recover ID`, `--prepare ID`. There is no caller-supplied save clock or `--at`.
Preview/recover/prepare are read-only. Append is explicit and exclusive; unchanged
retries preserve original bytes. The shared 500-record / 16 KiB record limits
remain intact. Chains are bounded to 16 records including the original root.

Revision input has exact `version: TECH36_ASSISTANT_REVISION_V1`, `id`,
`parent: {id, fingerprint}`, `request` (the existing explicit registration input)
and `reason`. The parent must be a recovered ASSISTANT registration or revision;
the new input retains the exact candidate binding and validates selected source
blocks again. Request input has exact
`version: TECH36_ASSISTANT_PREPARATION_REQUEST_V1`, `id`, `parent`, `purpose`.
It requires a revision parent; an original registration alone is insufficient.

Original registrations are never rewritten. Revision content cutoff is after
its parent save time, and at or before its own service save time. New assessment
`asOf` and new `researchPlan.registeredAt` both use the new revision save time;
the original input cutoff remains separately retained. The request must be
saved strictly afterward. No new clock establishes when an idea first arose or
refreshes old sources. Each child binds the complete `sha256:` parent fingerprint.
Recovery replays the exact historical candidate and complete source chain,
recomputes each derived payload and rejects missing parents, changed references,
invalid clocks or rehashed derived-field tampering. Local hashes do not establish
identity authentication or protect against replacement of an entire local history
and every external reference by a privileged writer.

## Meaning of preparation results

`diagnosticRequest` is accepted only by this new diagnostic adapter. It binds the
new revision/hash, research conditions and actual request clock. Decision time,
account, quantity and execution structure remain null. No executable strategy
request or plan is created. Real saved-source and fixture contexts remain explicit.

`independentResearchAssessment` separately runs the unchanged research evaluator.
Fundamental/news support, direction basis, technical evidence and six risk checks
remain UNKNOWN. Source references are unqualified citations; publication nulls
are preserved. Facet validity is a zero-duration assessment placeholder, not a
claim that evidence covers the holding window. No consensus or trading-price
thesis is inferred from an operating result.

`originalPreparation` remains the unchanged preparation engine's response to
inapplicable ASSISTANT envelopes. Its field inventory can describe supplied
fields, but its `requestDraft` remains null and the request is not accepted.
The corrected isolated call is BLOCKED / EVIDENCE_INTEGRITY. The earlier
44991ca call omitted the required `TECH_SPREAD_PLAN_INPUT_V1` version and stopped
at INPUT_SCOPE before evidence validation. That was an adapter defect, not proof
that the original engine had checked assistant origin. This also corrects the earlier
private experiment report: its 17 research blockers came from a separate research
assessment; field presence did not demonstrate original handoff acceptance.
The earlier SYNTHETIC_FIXTURE rejection was correct and has not been bypassed.

## Isolated historical TSM acceptance

Ignored local run: `tsm-assistant-adapter-2026-10-11t22-06-54-803z` under
`data/runtime/options-weekly-sources/assistant-adapter-20261011/`.

| Record | Actual UTC | New York EDT |
| --- | --- | --- |
| Original registration, unchanged | 21:41:54.376 | 17:41:54.376 |
| New content cutoff | 22:06:56.171 | 18:06:56.171 |
| New revision save | 22:06:58.598 | 18:06:58.598 |
| New preparation request save | 22:07:08.772 | 18:07:08.772 |
| Assessment | 22:07:16.514 | 18:07:16.514 |

All dates are October 11, 2026. The referenced source is the saved TSM September
revenue disclosure, received October 10 at 20:36:51.004 UTC; precise publication
time remains null. This is historical-source diagnostic acceptance, not a fresh
market test. The prior research horizon/conditions are preserved without new
price thresholds, risk assumptions or an inferred October 15 earnings event.

The new diagnostic adapter accepts the explicit revision/request. Independent
research retains 17 blockers; original preparation still lacks CONTRACT,
COST_MODEL, DATA_ENTITLEMENT, PRODUCT_PERMISSION, ACCOUNT_FUNDS and RISK_LIMITS.
97 copied original files remain byte-identical. Copied-only recovery reproduces
the entire preparation response exactly. Quote: NOT_RUN. Paper: NOT_ADMITTED.
Source calls and fills: zero. P&L: null. No two-week performance claim.

## Required-version repair and appended acceptance

Final independent review of 44991ca found a P2: the original preparation call
omitted its required version. The repair supplies `TECH_SPREAD_PLAN_INPUT_V1`
without changing mode, records, evidence readers, origin whitelist or permissions.
A regression requires EVIDENCE_INTEGRITY and explicitly rejects INPUT_SCOPE as
the observed outcome. The original evidence reader now rejects ASSISTANT_RESEARCH
before validity/PASS checks; no deeper gate is claimed to pass.

New ignored receipt run `tsm-assistant-version-repair-2026-10-11t22-21-53-428z`
assesses the same saved request at October 11 22:21:53.611 UTC / 18:21:53.611 EDT.
No registration/request clock changed and no new source was acquired. The prior
207-file manifest remains intact; each new isolated/recovered copy preserves all
99 saved files, including the original registration and later revision/request.
Both copied roots produce the same corrected preparation. The new actual engine
blocker is EVIDENCE_INTEGRITY; the request draft remains all-null. The 17 separate
research blockers, six missing evidence kinds and zero fills are unchanged.

This repair supersedes the previous no-remaining-P1/P2 statement. Final independent
review of the repair is pending the root task. The approval for exact 44991ca is
on hold; no old or repaired version may be pushed until the root confirms scope
and clearance. Old acceptance files are retained as historical evidence of the
defective call, not silently rewritten as the repaired outcome.

## Validation and boundaries

The original 44991ca validation passed 248 components / 6,243 tests; those tests
did not detect the missing version. Its 18-test independent subset did not cover
the deeper rejection code. The repair adds that regression and passes 248 components / 6,244 tests, zero failed; candidate/research tests pass 154/154 and the assistant subset passes 19/19. Final independent review of the repair remains pending; see
`docs/status/tech-assistant-research.json` for the repair's final validation and
separate pending independent review. The original first full run's file-scan
failure and complete successful rerun remain preserved in local logs.
Tests cover immutable originals, valid forward revision/request clocks, spoofed
authority, changed parents, backdating, rehashed record/request tampering,
missing parents, append retries, copied recovery and UNKNOWN preservation.
Earlier independent review found and verified an initial parent-fingerprint
format repair, but missed the separately identified preparation-version defect.
The existing store's complete `sha256:` format remains preserved.

4178 remains pinned to 3e0809d; October 12 remains frozen at 2dabc114. No browser
write channel, preview switch, deployment, source acquisition, runner restart,
schedule/risk/account/Owner-root/challenge-ledger mutation or public push.
This stage is a local development commit only. Any subsequent public publication
requires root confirmation of the revised scope after independent clearance;
the later exact-44991ca approval is currently on hold. Private originals and
recovery outputs remain ignored and local.
