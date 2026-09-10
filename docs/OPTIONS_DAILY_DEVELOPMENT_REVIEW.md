# Daily development goals and alignment review

Owner instruction received September 9, 2026 New York. This is the current
development-control reference. It records the product objective, complete workflow,
observed gaps, and two daily reviews. Older bans on all scheduled progress reports
are superseded only for these 08:00 and 21:00 reviews. Automatic implementation
and quarter-hour development loops remain disabled; development stays in this task.

The Owner explicitly approved two standalone scheduled reviews on September 10.
Both are active: alpha (08:00) and alpha-2 (21:00), New York, including weekends.
The earlier one-heartbeat-per-task rejection remains recorded; the authorized
standalone jobs resolve it without changing gld-ibit. Actual configuration was
read back, but no future scheduled run is claimed. See the
[activation checkpoint](status/development-governance.json).

The saved Alpha project is C:/projects/Alpha. Each standalone prompt explicitly
reads and writes the active development workspace
C:/Users/liuha/.codex/worktrees/8f09/Alpha, using absolute working directories.
Never replace its actual runtime evidence with an automatic checkout or another
project path. Read recent Owner steering from the original task when available;
otherwise disclose the missing conversation access and follow saved directions.

## Product objective and scope

Deliver a usable daily GLD/IBIT options decision-support system on Robinhood.
First demonstrate a complete actual-quote paper lifecycle with attributable inputs,
explicit assumptions and a recoverable review. Then evaluate the quality of the
decision process across independent observations. Software acceptance and a profitable
example cannot establish a repeatable edge or an 80% win probability.

The Owner executes real orders. Automatic public context reads, authorized Host
market-data reads, local analysis and records support that decision. The active
allocation is $100–$500 per trade / $1,000 declared equity, OWNER_ALLOCATION_ONLY_V2.
The obsolete allocation and loss caps remain removed. Current saved 20% premium
stop and net-2R settings are model assumptions; costs, liquidity, full premium
exposure and actual exits must remain explicit. The $50,000 year-end aspiration
is not an acceptance criterion or a promised result. SPY 0DTE was discussed but
is not in the current implemented trading universe.

## Complete workflow: retain this order

| Stage | Required behavior and acceptance | Baseline state |
| --- | --- | --- |
| F01 Context | Refresh relevant news, official calendars and macro inputs; retain source, event and receipt times, failures and missing coverage | PARTIAL |
| F02 Market evidence | Acquire GLD/IBIT underlying prices, usable OHLCV and option-chain quotes with liquidity, contract and freshness checks | PARTIAL |
| F03 Interpretation | Combine direction, magnitude, horizon, volatility, path and risk; distinguish event expectations from observed post-event reactions | PARTIAL |
| F04 Actionable plan | Explain selected expiry, strike and structure; entry conditions, allocation, costs, stop, target, time exit, invalidation and no-trade conditions | PARTIAL |
| F05 Prospective paper validation | Freeze the plan before observations; model later entry and exit, reconcile cash/costs, save and independently recover a complete actual-data result | PARTIAL |
| F06 Owner execution and tracking | Owner places orders; record genuine reported fills, track positions, exposure and exit conditions with timely actionable reminders | PARTIAL |
| F07 Review and candidate lessons | Retain every win, loss, non-entry and unresolved position; assess process deviations and candidate explanations without inventing causes | LOCAL_VALIDATED |
| F08 Evaluate and feed back | Compare outcomes and controls without hindsight, validate candidate lessons on later independent cases, then version supported changes | NOT_VALIDATED |

F01 and F02 can collect concurrently; both support F03 and F04. F05 is the near-term
engineering gate before relying on a new decision process. F06 never means automatic
orders. Every completed paper or Owner-reported trade returns through F07 and F08
to future F03/F04 decisions. Every stage must appear in both daily reports, including
unchanged or unavailable stages. A new document/test/module is supporting evidence,
not by itself a completed product stage.

Report product stages separately from the existing ten engineering workstreams
and six first-paper gates. Preserve each denominator and meaning; do not turn
4 locally validated / 4 partial / 2 unvalidated workstreams into a percentage.

## Recorded alignment findings

The September 9 evening audit found the correct GLD/IBIT universe and manual-order
boundary, but disproportionately advanced persistence, verification and research
infrastructure compared with the daily decision workflow:

1. The 16-family / 94-indicator catalog is not 94 live data connections. Only three
   of 21 gold checklist areas have partial numerical context; current regime and
   fitted weights are undetermined.
2. Daily guidance uses a descriptive 3-versus-5-session close comparison. Each ETF
   currently contributes only one eligible official close to that input. The four
   saved option-bar series have unknown interpolation provenance and no qualified
   underlying OHLCV/VWAP signal.
3. Guidance currently screens 14–45 DTE single-leg contracts, sorts mainly by
   feasibility/cash exposure and waits around major events. View-specific expiry,
   strike, structure, price-range and pre/post-event recommendations are incomplete.
4. BLS/FOMC last successful saved receipts are September 8 and overdue at this audit.
   The activity study has one observed close session and zero primary evaluable
   candidate outcomes. The two frozen PPI plans missed their PRE observations.
   These are operational gaps, not merely waiting for a future market opening.
5. The new IBIT October 9 $44.50 call plan is an engineering rehearsal with no
   directional recommendation. It awaits September 10 intraday evidence, has no
   fills, and cannot substitute for a daily advice engine. The actual Owner ledger
   is empty. Continuous position monitoring and demonstrated beneficial feedback
   from the mistake notebook are still incomplete.
6. Schedule readback is evidence at a time, not permanent activation proof. A
   previously verified correction of `gld-ibit` was followed by another observed
   30-minute recurrence. Cause is unestablished. Audit actual configuration and
   receipts against intended slots; do not claim success from a prior checkpoint.
7. Historical entry documents contain superseded caps, counts and next steps.
   Follow the latest dated Owner policy and actual evidence. Preserve historical
   reports; correct live summaries when they conflict with current behavior.

See [the fixed audit baseline](status/development-alignment-baseline-20260909.json)
and [the engineering checkpoint](status/development-progress.json).

## 08:00 New York: plan the development day

Read this reference, the latest Owner steering, AGENTS, HANDOFF, current progress,
the most recent evening review, actual Git changes and compact read-only runtime
evidence. Prefer existing readers; this review does not acquire new brokerage data.
Choose three to five concrete deliverables in morning/afternoon/validation blocks.
For each, state priority, workflow stage, current gap, backend change and matching
frontend behavior when applicable, acceptance evidence, dependencies and fallback
work if the source is unavailable. Use stable goal IDs for the evening comparison.

Prioritize: repair broken existing data/processing paths; complete an actual-quote
paper result; strengthen F03/F04 daily recommendations; improve position tracking;
validate outcomes. Data waits must be distinguished from unfinished local code.
Do not add unrelated engines or another evidence wrapper while a direct workflow
gap can be closed. Do not force a trade, shrink checks or restore obsolete caps
merely to make a test pass.

Record the baseline status and observable acceptance for all eight stages, ten
workstreams and six gates. Save the plan with actual creation time and the current
commit; goals are planned work, not claims that development is running continuously.

## 21:00 New York: review progress and deviation

Read today's actual morning plan and inspect actual code/diffs, relevant test or
UI receipts, runtime/source clocks, paper results, ledger and notebooks. Compare
each goal with its original acceptance: completed, partial, blocked, not started
or regressed. Identify what became usable since morning, what evidence proves it,
what failed, and the exact remaining gap. Report zero progress when warranted.

For each F01–F08 stage give morning status, evening status, added capability,
evidence, remaining work and deviation. Also compare all ten workstreams and six
gates using unchanged denominators. A missed receipt, stale calendar, source
disconnect, unobserved stop, missing review, unvalidated explanation or premature
progress promotion must remain visible. Separate software defects, source/host
availability, implementation backlog and strategy-evidence limitations.

Check the entire path from news/quotes through recommendation, Owner execution,
tracking and feedback; both paper and actual records must retain their origins.
Classify alignment as ON_TRACK, DRIFT_RISK, CONFIRMED_DRIFT or UNABLE_TO_ASSESS,
with reasons and a prioritized correction for the next day. No increase in file,
test or module count can replace a usable capability or acceptance result.

## Durable records and reporting

Use `docs/development-daily/YYYY-MM-DD/`, with the date in America/New_York.
Save English Markdown records as `morning-<actual-UTC-filename-clock>.md` or
`evening-<actual-UTC-filename-clock>.md`. Include: phase, actual time, intended local
date/time, current commit, baseline references, goals/results, eight-stage table,
ten-workstream counts and before/after rows, six gates, deviations, remaining work
and next actions. Paths, hashes or dated receipts must support factual progress.
Do not copy raw quotes, account data, credentials or unredacted tool dumps into Git.

Never overwrite the morning plan or a completed prior review. A rerun first checks
for today's same-phase record and reuses a completed report. Corrections are new
dated records linking the superseded record. Use actual clocks: a late morning run
is labeled late; after 21:00 do not manufacture an 08:00 baseline. If the morning
plan is missing, compare with the last verified baseline, explicitly mark it missing,
and do not invent planned achievements. Unknown current state stays unknown.

Return a concise Chinese morning plan and evening comparison in each standalone run.
The original development task reads the shared saved records when continuing.
The Owner explicitly requested these two routine daily reports, including no-progress
days. Handle task notifications in automation configuration, not in its prompt.
The two review schedules remain separate from `gld-ibit`; do not mutate that task,
restart sources, fetch paid data, log in, call accounts/orders or run development
loops during a planning/review wake. Product changes continue under the Owner's
ordinary development authorization in the current task.

Persist only review artifacts and evidence-backed current summaries during these
wakes. Keep unrelated changes intact; never stage another active change simply to
commit a report. Existing Owner save/commit/push authorization remains valid for
review artifacts after inspecting exactly what will be published.

The requested schedules are daily, including weekends, at 08:00 and 21:00 New York.
Both schedules were enabled and verified on September 10; inspect actual execution
receipts before claiming a scheduled review ran.
Local files require the computer and desktop app to be running; scheduled execution
still depends on available access and allowance. Record missed runs honestly.
[Official scheduled-task reference](https://learn.chatgpt.com/docs/automations?surface=app).
