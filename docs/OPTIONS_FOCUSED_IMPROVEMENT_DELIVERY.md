# Focused repair of the existing observation loop

September 19, 2026. Implemented locally from the Owner's
`Alpha_Codex_Focused_Improvement_Task.md`, with explicit **no commit or push**.

## Baseline and reproduced issues

- Workspace: `<workspace>`.
- Branch: `codex/gld-ibit-options-foundation`; starting HEAD:
  `50d9ac7babe637603b1915f65ca063eaea4d9e53`.
- The only pre-existing worktree item was the untracked September 16 evening
  review; it is preserved. No branch switch or changes to frozen registrations.
- Existing entry: `scripts/options-workbench.mjs`, local port 4173; public context
  runs through its existing service. Brokerage market tools run only through the
  bounded Host collector. The local trend tick reads saved files only.
- Fresh baseline: trend 40/40, Position watch 27/27, source audit 45/45 passed.
- Reproduced: a single opening-hour baseline followed by no later data produced
  frozen `NO_ENTRY`, without a distinct coverage classification in the UI.
- Reproduced: the panel labelled the modeled entry quote itself "Independent
  quote", even when no later exit observation existed.
- Code inspection: frozen trend selections were absent from Host tracking; only
  event research and explicitly enrolled paper plans supplied tracked identities.
- Isolated reproduction: a position still open after its session could not receive
  a later-session exit through the saved-source observer because its market-frame
  filter required the original date. Only already-open positions now admit later
  sessions; their modeled exit uses the new receipt and retains the path gap.
  Closed reports and missing old entries are not reopened.

Already correct: unknown interpolation stays unknown, four cross-interval
conflicts remain visible, first signals cannot be replaced, no exit quote leaves
open exposure, delayed exits use later receipts, and modeled fees stay estimated.
The twelve-question worksheet, counterevidence, alternate explanations, voluntary
FOMO/recovery prompts, no-position question, original references and server receipt
times already cover this task. Those features were tested and left unchanged.

## Changes and cost

| Existing surface | Change and practical value | Complexity / running cost |
| --- | --- | --- |
| Trend study diagnostics | Count timely usable five-minute close observations; separate full no-signal coverage, insufficient evidence, blocked signal, unobserved entry, unresolved entry and modeled closure. Prevents missing data entering no-opportunity or win/loss denominators. | Medium; local replay only, no model or network call. |
| Trend exit panel | Show last selected quote separately from accepted post-entry quote, current staleness, rejection, overdue exit, actual modeled receipt and delay/path gaps. Prevents a late quote looking like a timely exit. | Low; reuses paper diagnostics and exact source clocks. |
| Existing Host tracking | Append active actual-source trend identities after existing priorities, using the existing combination function and six-ID cap. Preserve capacity waits/conflicts; exclude synthetic, closed, expired and missed-entry cases. | Low; no added wake or request type; same 24-call/36-quote ceiling. Actual calls within the ceiling may depend on tracked expiries. |
| Existing contract details | Expose sampled rank, filter/selection distinction, DTE/delta/spread, age at decision, full premium, estimated fees and exit allowance. Target/IV pre-expiry scenario stays NOT ASSESSED. | Low; deterministic saved-input calculations only. |
| Existing schedule preview | Reuse dated routine/event schedule; show next nominal quote and a disabled requirements preview derived from frozen rule clocks. Configuration does not claim receipts. | Low; no new timer or collection enabled. |

Modified implementation: `OptionsTrendStudy.ts`, `OptionsPaperCollectionPlan.ts`,
`options-trend-study-io.mjs`, `options-workbench-data.mjs`,
`options-daily-guidance.mjs`, `trend-study.js`, and the existing trend test file.
Operational notes are limited to this delivery, the runbook and AGENTS.md.

The stored V1 report and its fingerprints remain the historical result. The new
projection is evaluated at the current view clock and never written over that
report. Session record counts remain distinct from per-ETF observation counts.
A closed modeled result can still have an unknown intervening path; it does not
qualify execution, causation or strategy returns. This experiment tests price
confirmation, not pre-event anticipation. No terminal payoff is presented as an
early-exit valuation.

## Actual state and external conditions

Read-only inspection at `2026-09-19T21:54:04.001Z` found one recorded session,
September 18, with both ETFs `DATA_MISSING`, zero signals, entries and closures.
This is a preserved missed session, not a successful no-signal day. Historical
engineering paper rehearsals are complete and were not reopened.

The supplied source audit still has all 156 five-minute interpolation flags
omitted, and four one-minute/five-minute differences across 13 fields. The copied
audit and provider questions remain in `OPTIONS_ETF_SOURCE_AUDIT_DELIVERY.md` and
the existing desk. No local parser fault was established; no winning interval or
default-false interpretation was introduced. No new brokerage call was made for
this task. No fees, subscriptions, accounts, orders or allocation changes.

The current cadence is still insufficient. Routine 15:50 and conditional event
hours do not provide a five-minute independent entry or continuous exits. The
disabled requirements preview requests only GLD/IBIT and selected contracts:

- Opening history from 09:30; baseline ends 10:30 New York. Each applicable
  five-minute close from 10:40 through 14:30 needs timely source receipt and local
  processing within the frozen 60-second limit. Early-close boundaries shorten
  the window. There are 47 close slots on a regular day.
- Selection needs its contemporaneous bounded contract sample. An independent
  eligible quote must arrive within the frozen 300-second entry deadline.
  Once entered, same-contract later quotes are needed through the planned exit
  (normally 15:40); the frozen model marks gaps over 60 seconds. No guaranteed
  continuity or fill is implied by a polling interval.
- Enabling this requires separate frequency authorization, provider flag and
  aggregation clarification, verified tool throughput, a running Host and local
  process, and enough source/processing budget. The existing 200-event daily
  storage bound also needs review before any continuous collection proposal is
  activated. There is no documented provider rate-limit allowance for such a
  run. The preview is **not** a ready-to-enable collector or a permission grant.

This task improves the existing path but cannot validate it with absent future
market receipts. No historic signal or fill is manufactured. Broader collection,
new providers, pricing models and new psychology subsystems remain deferred.

## Run, verification and rollback

- Open Daily guidance → Prospective trend study. Expand the observation coverage,
  session evidence and contract screening details. Refreshing reads local files.
- `npm run options:trend-study -- --desk` reads the projection. The browser supplies
  the current saved calendar; the bare CLI conservatively marks event timing
  unconfirmed when no calendar brief is supplied.
- `npm run options:guidance -- --host-source` produces the bounded collector and
  tracking readback; generating it does not execute market tools.
- `npm run test:options-trend-study` exercises isolated normal entry/exit,
  complete no-signal, partial/unknown/conflicted coverage, repeated quote,
  overdue/late exit, capacity and synthetic-exclusion cases. Temporary fixtures
  are not production observations.

Fresh validation:

- Focused trend tests: **51/51**, including 11 additions to the 40-test baseline.
  Snapshot paper, guidance, source audit, Position watch and Macro playbook checks
  also pass in this task's validation run.
- `node scripts/alpha-validate.mjs`: **4,781 passed, zero failed, 179 components**.
  After the final monitoring-grace boundary adjustment, the 51 focused tests,
  `npm run typecheck` and `git diff --check` were run again and passed.
- No baseline failures or environment blockers were observed. Warnings are the
  expected uncommitted worktree and Git's Windows line-ending notices.
- Existing production evidence: **2 trend records and 18 snapshot-paper records**
  verified by their existing fingerprint/recomputation readers. No old outcome
  was replaced. Isolated tests also verify byte preservation and no reopening.
- Browser: desktop and 390-pixel checks show the new classifications, current
  receipt gaps, disabled proposal and nominal next wake, with no page overflow
  and no browser warnings/errors. Temporary viewport and tab were cleaned up.
- Local workbench was restarted only after checking its exact workspace command
  and port owner. The recovered view retains one session record, two insufficient
  ETF observations, and zero signals/entries/closures. Process identity is retained privately;
  state receipt `2026-09-19T22:12:37.673Z`, local check
  `2026-09-19T22:12:07.590Z`, status OK and zero source reads. Host tracking is
  currently empty because no actual trend plan exists. Next nominal routine
  quote is September 21 at 15:50 New York; the frequency preview remains disabled.

Private logs: `data/runtime/options-workbench-development/` contains
`focused-improvement-final-validation.log`, `focused-improvement-targeted-final.log`
and `focused-improvement-final-server.stdout.log` / `.stderr.log`. These are local
engineering checks, not new market observations or trading validation.

Rollback: reverse only this task's diff in the seven implementation/test files
and the three documentation files; restart the exact-workspace local process.
Do not delete runtime stores or revert the unrelated evening review. Since no
new record schema or registration was written, original V1 records remain
readable. No commit, push, pull request or merge is part of this delivery.

Follow-up verification, September 19: full validation was rerun after the final
monitoring-grace adjustment (4,781 passed, zero failed). Read
[source and sampling feasibility](OPTIONS_SOURCE_FEASIBILITY_DELIVERY.md) for the
C conclusion. Installed automation was found at 09:00 daily only, so the nominal
September 21 15:50 reference above is not verified actual scheduling. Source
conflicts remain; per-event copies and storage limits cannot support the frozen
cadence. The single prospective diagnostic proposal is disabled. No frequency
change or new cohort was made.
