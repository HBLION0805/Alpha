# Reviewed news storyline links

Status: READY_FOR_REVIEWED_STORYLINE_USE. This is manual/assisted reading context, not automatic news classification or trading evidence.

## Use and boundaries

Open **News & calendar → Macro storyline**, or a saved headline's **Macro storyline** button. Select saved material, enter an explicit search/filter, manually select zero or more themes/approved knowledge, write the reason and limitations, confirm human review, preview, then save. Suggestions remain `SUGGESTED_NOT_CONFIRMED`; only explicit human-confirmed saving creates `MANUAL_REVIEWED_LINK`. Append revision starts an unconfirmed draft and preserves the original record.

The existing deterministic lookup, approved World Model reader, provenance display, protected local API and exclusive bounded file writer are reused. `/api/storyline` supports preview/save under the original Origin/session protection. The new projection is appended after trading projections and is not passed to guidance, candidate, plan, expectation, position or exit calculations.

`MACRO_STORYLINE_LINK_V1` keeps news ID, exact source reference and fingerprints; original source/publication/receipt clocks and coverage; explicit themes; knowledge ID/version/fingerprint/type/evidence grade; reviewer, actual save clock, reason, manually selected change type, limitations; link/lineage/version/supersedes and record fingerprint. Headline/body and entire knowledge catalogs are not copied. The separate private reference store is necessary because a general news-context link need not be an event comparison or a plan assertion. It is Git-ignored, exclusive-create, bounded to 500 records of at most 16,384 bytes each. Existing stores and limits are unchanged.

Unknown, conditional, hypothesis and conflict grades survive selection and recovery. Edges do not add themes automatically. Missing or changed referenced material is explicitly unavailable rather than replaced. An identical save retry returns the original record; changed retries and already-advanced revisions fail. Reviewer identity is an explicit local attestation, not machine authentication of the person, news meaning or causal validity. Free text is not semantically verified. No current-state knowledge or trade permission is created.

## Actual Owner-reviewed acceptance

The Owner explicitly accepted the four selections and their reasons in this conversation, then reiterated that approval is limited to relevance. Codex performed the local UI saves on the Owner's behalf. Review clocks below are actual server save times, not backdated message/publication times. All four remain `HEADLINE_ONLY` and `NOT_CLASSIFIED`.

| Saved case | Explicit selection | Actual saved ID / UTC time | Retained limitation |
| --- | --- | --- | --- |
| Hormuz report | M05; ME07, W05 | `story-89cb509c-668b-4ac4-bc18-33be3a026298` / 2026-09-20T19:08:15.802Z | Delivery impact unknown; headline allegation unverified; no supply-loss inference |
| EIA report | M01; ME01 | `story-b4d90fa8-1be5-4bf9-9c90-cd4e0100f02c` / 2026-09-20T19:09:25.585Z | Conditional mechanism only; publication clock and actual downstream transmission unknown |
| BOJ / Bitcoin report | M04; F07, F08, W04, Q04, T02 | `story-8adc5411-8c56-49fe-a729-86f965cb8c01` / 2026-09-20T19:10:26.913Z | Q04 UNKNOWN; T02 HYPOTHESIS_ONLY_CONTEXT / ALPHA_INFERENCE; no verified carry unwind |
| Bitcoin Core report | Zero themes, zero knowledge | `story-6fe21204-1f23-4343-8185-d625d17b8cad` / 2026-09-20T19:11:13.493Z | NO_RELEVANT_APPROVED_STORYLINE / NOT_CLASSIFIED; no inferred macro impact |

All are v1, reviewer `OWNER: Owner`, recovery `AVAILABLE`, retained under `data/runtime/options-storyline-links/<id>.json`. Four writes total 14,565 bytes. Private originals stay in their existing source stores; no article body was fetched for this stage. Three selected receipts were already saved by the existing source service at 19:00 UTC; the software item retains its September 17 receipt. Linking did not acquire those sources or upgrade their coverage.

Formal loopback workbench 4173 was loaded from the current workspace using its existing launcher, with context refresh preserved and no second long-running instance. All four links were saved through the formal page, then recovered after browser reload and by a separate fresh-process reader. Desktop and 390px mobile review checked the saved reviewer, clock, coverage, knowledge detail/provenance and zero-link outcome. Mobile fingerprint wrapping was corrected. Isolated API tests additionally close/restart the server and recover the identical fingerprint. A stale browser session after the controlled workbench restart correctly rejected a preview; reloading the local session resolved it without bypassing the guard.

## Validation and issues found

Fourteen focused cases cover explicit confirmation, zero-link, multiple themes, edge behavior, original evidence grades and conflict values, append-only revision, idempotency, source fingerprints, rejected/unknown knowledge, time/path/size bounds, source-package references, legacy recovery, UI escaping, metadata tampering and protected HTTP save/restart. Fixed-clock comparisons verify unchanged guidance/candidates/manual ledger/position watch/expectations/event-entry/capital outputs and unchanged source bytes. No fixture is written to production.

The final validation result and private log digest are recorded in [status](status/storyline-links.json). The standard complete validation includes strict TypeScript and this focused suite. No new test framework was introduced. During development, one incorrect test assumption about calendar-day retention was corrected to test the actual bounded selector and exact-reference recovery. The first full run after real saves exposed the missing Git-ignore rule: those private files were **untracked, never staged or committed** (the validator's generic message calls runtime files tracked). A scoped ignore entry fixes this boundary. The suite summary was also aligned with the existing aggregate counter; the earlier zero count was reporting format, not skipped tests. Line-ending and dirty-worktree warnings are recorded separately from test failures.

## Scope, cost and remaining limits

Changed files: `.gitignore`; workbench `storyline.js`, `storyline-model.js`, `app.js`, `api.js`, `focused-news.js`, `world-model.js`, `styles.css`; `scripts/lib/options-storyline.mjs`, `options-focused-news-io.mjs`, `options-workbench-data.mjs`; `scripts/options-workbench.mjs`, `options-storyline.test.mjs`, `alpha-validate.mjs`; this delivery and status. The focused reader's optional exact-reference projection leaves its original default return unchanged. Existing approved knowledge and original source-comparison semantics are not rewritten.

Stage-initiated public reads: **0**. Market calls: **0**. New external model/API calls: **0**. USD cost: **UNKNOWN** without billing evidence; Codex development usage is not claimed free. Existing independently scheduled public service activity is not a linking call. No new schedule, subscription, source, model service, account/order use, position or trading-output change.

Routine 15:50 remains `PENDING_NATURAL_RUN`; first real targeted quote remains `NOT_VERIFIED_NO_OPEN_POSITIONS_WEEKEND`. This stage does not validate them. The only next use is manual review of saved context as needed; automatic classification and later research phases are outside this delivery. Reverting this scoped code commit would remove the UI/API feature but would not delete private link evidence or restore/change an installed schedule.
