# Exact candidate research to spread preparation — October 11, 2026

The fixed-36 trace could identify an original reviewed candidate, while an
independent spread request could only identify its own research payload. Nothing
in that preparation entrypoint checked that the declared research belonged to
the selected scan/review version. The new optional read-only entrypoint joins
these two explicit references before calling the unchanged spread preparation
engine. Existing trace, rankings, course catalog, archive and older plan workflows
retain their behavior.

```
cmd /d /c scripts\options-tech-mock-residual-readonly.cmd --prepare-from-candidate INPUT.json --run-id EXISTING_RESEARCH_RUN
```

Run from the workspace containing the named existing research run. The ordinary
`options-tech-spread-plan.mjs` CLI accepts the same arguments. The strict launcher
continues to deny filesystem writes, child/worker processes and native add-ons;
the command returns JSON on stdout only. Neither entrypoint acquires sources,
creates a request envelope, writes a plan or appends a modeled fill. This feature
is a CLI preparation path; it has not been added to the pinned 4178 browser UI.

The result supplies exact candidate references and existing missing-field
inventories. For an explicitly prepared future research record, its
`researchPlan.candidateResearchBinding` must contain exactly:

- `version: TECH36_PLAN_RESEARCH_BINDING_V1`
- `runId`, `scanId`, `baseReceiptSha256`, `reviewHeadSha256`
- `traceId`, `researchRecordId`, `eventRef`

The strategy request must name and hash that exact RESEARCH payload and include
both the trace ID and original reviewed research-record ID in `parentIds`. No
reference, direction, structure, quantity, account, budget or condition is copied
automatically into a request. Do not rewrite old envelopes or clocks to attach a
new reference. New declared research must follow the available reviewed version.
The latest named run is replayed before and after preview; stale references or a
changed head fail closed instead of following another version or ticker.

New handoff chronology requires review availability <= research as-of <= research
registration <= research observation <= receipt <= review <= request observation
<= receipt <= review <= decision, using the existing nanosecond clock parser.
The original envelope validity and engine timing checks still apply. These are
consistency checks on attributed records, not independent proof of when a person
formed an opinion or authentication of their assertions. Fixture/real context
cannot cross this boundary.

`BOUND_ENGINE_BLOCKED` means references match but existing engine requirements
fail. `BOUND_PREVIEW_ONLY` means the existing pure preview returned its original
ready state; no admission, plan or fill is written. Course assessment remains
separate, and exact lineage does not validate semantic research claims. Only the
existing two-leg bull-call/bear-put debit-spread workflows are passed through;
the course's other catalog entries do not gain execution support.

## Actual saved-source acceptance

At 2026-10-11T19:27:20.555Z (15:27:20.555 EDT), the strict launcher replayed a new
isolated copy of all 96 files from `tech36-fresh-research-20261010-203633`. The
original fixed-36 ranking still selected TSM. The result retained the exact
October 10 scan, base and review head and rejected the empty plan input with
`CANDIDATE_HANDOFF_RESEARCH_MISSING_OR_DUPLICATE`. Directional plan, technical
evidence, strategy request, exact contract, post-decision quote and comparable
pre-event consensus remained missing. Course assessment was
`INSUFFICIENT_EVIDENCE`; fills stayed zero and P&L unknown. No research was
manufactured to obtain a success result. This is an offline development replay,
not a fresh market observation or retrospective entry.

The isolated synthetic positive cases exercise both existing CDS/PDS previews;
they remain fixtures and create no fills. Independent review identified an
envelope chronology gap, corrected in this new adapter without changing the old
engine. Final test, copied-only replay and protected-file results are recorded in
`docs/status/tech-candidate-plan-handoff.json`; private originals remain ignored.

4178 remains pinned to reviewed course version 9727668. October 12 frozen
2dabc114, CPI/15:50, the challenge ledger, risk settings and all other worktrees
remain unchanged. Both isolated continuations retained f88f4da, their original
budgets and deadlines through natural termination, as recorded below. Engineering
did not trigger or restart either continuation. No main merge or production deployment.

Final regression passed 248 components / 6,181 tests / zero failures, including all 29 new handoff tests. The original spread/strict-launch regression passed 114/114; independent review found no remaining P1/P2. Final-code strict and copied-only replay at 19:31:26.304Z / 19:31:27.548Z retained the same refusal and exact references. All 288 copy comparisons, 25,907 protected files and 252 old source/runner originals matched. The first full reports did not count the native Node test summary; the new test adopted the existing counted-summary format and the final bundle includes all 29. The application code did not change for this reporting correction.

## Independently verified bounded-run terminal supplement

The parent task supplied the following independently verified terminal evidence
on October 11. This delivery records that attributed verification; it does not
copy private originals, perform another acquisition or claim a new local audit.
The earlier 19:39 status readback remains a dated historical snapshot.

- Public child `65585f6f-d412-4412-8151-f46ecdb5d5fa` ended at
  `2026-10-11T17:27:43.380Z` with `BUDGET_EXHAUSTED`. Parent ten plus child ten
  requests total twenty. Last Treasury/Fed requests were respectively
  `2026-10-11T17:27:42.996Z` and `2026-10-11T17:27:43.225Z`; the six-hour minimum
  passed and no new content was found. Original deadline remained
  `2026-10-11T17:46:05.993Z`.
- Company child `7afd3987-4e09-456e-ae43-5ba34d9bc3a9` ended at
  `2026-10-11T19:40:15.579Z` with `BUDGET_EXHAUSTED`. Parent ten plus child ten
  requests total twenty. Its ten actual requests from
  `2026-10-11T19:40:02.745Z` through `2026-10-11T19:40:15.068Z` returned HTTP 200,
  each exceeding its previous-source six-hour floor by 1.386–2.247 seconds.
  Original deadline remained `2026-10-11T20:00:00Z`. Eight response originals
  were unchanged; AMAT/MSFT changes were limited to scripts/tracking and similar
  content, while all parsed results were unchanged.

For both groups, parent and child PIDs had exited, chains and claims passed
verification, and no runner lifecycle issue remained unresolved. These terminal
checks do not complete source-content review: `OBTAINED_PENDING_REVIEW`, original
partial coverage and all existing gaps remain. HTTP 200 and unchanged parsed
results do not establish that all materials have been verified, or admit Paper.
