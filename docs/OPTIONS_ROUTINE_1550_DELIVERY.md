# Existing 15:50 routine collection repair — September 19, 2026

**Repair complete, awaiting first natural run.** The actual existing gld-ibit
heartbeat was updated through the app automation tool, then its installed file
was read back. No market tool was invoked during this repair. There is no new
forward capture or first-run page-consumption claim.

## Installed configuration

| Field | Before | After |
| --- | --- | --- |
| Schedule | Daily 09:00 only | Daily 09:00 plus Monday–Friday 15:50 |
| Weekly wakes | 7 | 12 |
| Host timezone | America/New_York | Unchanged; Windows Eastern Standard Time with DST |
| Identity / status | Existing gld-ibit / ACTIVE | Unchanged |
| Task binding | Existing Alpha task; identifier retained privately | Unchanged |
| Notification policy | failed_runs_only | Unchanged |
| Prompt | Named hourly/event work absent from installed schedule | Only preserved 09:00 work and authorized 15:50 routine; explicit acceptance stages |
| 15:50 route | Weekday check only | Existing reviewed calendar also required |

The update tool returned `Updated automation in the app.` and ACTIVE. At
23:38:13.429 UTC the full installed fields matched the private Host V4 snapshot.
The Git Host V4 document is now a sanitized reference, not a deployable backup.
Readback hash:
`63447dc7aa9e4b5d163e8ab303a07abcb9eee8c3a153acb1daa479a967633c33`.
The view tool rendered the automation card but exposed no queue `nextRunAt`.
The following times are therefore **calculated from the installed recurrence and
verified host timezone**, not evidence that a future task is already dispatched:

- Next preserved daily task: **September 20, 09:00 EDT / 13:00 UTC**.
- First eligible market task: **September 21, 15:50 EDT / 19:50 UTC**.
- Existing route ends at 16:00 EDT. A missed window is not backfilled.

The weekly selection was expanded and checked: each weekday has exactly 09:00
and 15:50; each weekend day has only 09:00. No extra 09:50/15:00 Cartesian-product
wakes were installed. Original 26-wake, event-hour and expired-close schedules
were not restored. The existing local public context service was not changed.

The ongoing route now reuses `paperSession` with no late-close extension.
Regular-session daylight/standard-time cases permit collection; holidays,
13:00 early closes and unreviewed calendar years block it with an explicit reason.
Early closes do not acquire a new 12:50 window. Historical non-ongoing routing
remains unchanged. Current-year calendar knowledge does not verify unscheduled
halts. Windows/node timezone was checked at 23:36:54.134 UTC; the Host must stop
market reads if its timezone changes. Local automation still requires the host
and app to be running; configuration cannot prove a wake will execute.
See [OpenAI's local automation requirements](https://learn.chatgpt.com/docs/automations?surface=app).

## Storage and current data-flow evidence

At 23:35:19.884 UTC the existing primary capture store held **16 records /
12,930,979 bytes**. A copy of the latest normal actual capture (original source
clock September 17, 19:51:53 UTC) passed the existing record/verify, snapshot-source
reader, guidance projection and renderer in an **isolated ignored directory**.
All original input and source clocks were retained; no production record was added.

| Check | Observed result |
| --- | --- |
| Copied normal capture | 869,576 bytes; 16 historical tool calls, 36/36 option quotes, no missing IDs |
| After one equally sized capture | 17 records / 13,800,555 bytes |
| Aggregate snapshot-source limit | 67,108,864 bytes; 53,308,309 bytes left after that capture |
| Per-record / per-date limits | 8 MiB / 200 captures; next September 21 date currently has zero |
| Research source record limit | 1,000; no limit increased |
| Free disk | Sufficient at check; exact host measurement retained privately |

This establishes room for one observed normal-sized capture, not unlimited
retention or guaranteed future response size. No database rebuild or deletion
was needed. Each normal run saves one raw input and one verified capture, plus
its exclusive slot, analysis/report and any eligible local observation records.
Actual write counts must be measured at the natural run: **16 tool calls do not
mean 16 capture records; 36 returned quotes do not mean 36 calls**.

The existing live `/api/state` was read at 23:39:00.490–23:39:10.424 UTC. Its
guidance input matched the September 17 capture clock and all 36 selected IDs.
The existing browser Daily guidance page was opened and Reload saved data was
used. It displayed that same September 17 03:51 PM EDT capture, 36/36 returned,
zero missing, and stale-clock warnings. Its local file-check clock was September
19 07:37 PM EDT. This proves consumption of **existing historical evidence**;
it does not prove consumption of next Monday's data. Browser content export was
unsupported; the actual accessibility observations are recorded instead.

## Natural-run acceptance remains open

| Stage for September 21 window | Status |
| --- | --- |
| Installed schedule and market branch | Read back; local branch regression passed |
| Actual task start / exclusive claim | NOT OBSERVED |
| Real requests, responses, calls, rows and missing IDs | NOT OBSERVED |
| Source age, reception clocks and clock anomalies | NOT OBSERVED |
| Raw persistence and verified capture | NOT OBSERVED |
| New guidance/API data and publication linkage | NOT OBSERVED |
| Existing page displaying the new capture | NOT OBSERVED |

The current runbook specifies one append-only operational receipt for these
stages. Source staleness, partial responses, future source clocks, late responses,
local processing errors and missing wakes remain distinguishable. Successful
collection does not imply fresh data. No signal, paper entry or exit is required
or manufactured by this operational check.

## Changes and validation

Product code: `scripts/lib/options-guidance-host.mjs` adds the existing calendar
gate and skip evidence to the ongoing route. `scripts/options-daily-guidance.test.mjs`
adds five cases for normal/DST sessions, holidays/early closes, unknown year,
preserved 09:00 work and original-window boundaries. Collector, storage and UI
code were not changed this turn.

Documentation/configuration: sanitized Host V4 reference and recovery guidance, this delivery,
`docs/status/routine-1550.json`, top runbook section and top AGENTS instruction.
Prior feasibility/focused-improvement changes remain in the uncommitted workspace.

- Targeted: `node --import tsx scripts/options-daily-guidance.test.mjs` — **106/106 passed**.
- Full existing command: `node scripts/alpha-validate.mjs` — **4,786 passed,
  zero failed, 179 components**, including strict TypeScript; 122,152 ms,
  completed **23:31:59.352 UTC** after the final product-code edit.
- Isolated real-input storage/read/render preflight, installed-field comparison,
  recurrence expansion and historical live API/browser read all passed.
- The initial targeted attempt exposed the existing calendar parser's required
  ISO milliseconds. The adapter now canonicalizes the same instant before calling
  it; the failed log is retained beside the passing rerun. No source clock changes.
- Subsequent changes were documentation/configuration only; no repeated full
  validation was used as a substitute for natural-run evidence.

Private evidence is under `data/runtime/options-workbench-development/`:
`routine-1550-automation-before.toml`, `routine-1550-automation-after.toml`,
`routine-1550-configuration-readback.json`, `routine-1550-preflight.json`,
`routine-1550-page-baseline.json`, `routine-1550-targeted-final.log` and
`routine-1550-full-validation.log`. These contain actual receipt clocks, hashes
and isolated-copy location. Source evidence and earlier feasibility report remain.

## Calls, boundaries and recovery

This repair made **zero new brokerage market calls**. Relative to installed
09:00-only scheduling, a normal eligible weekday adds one bounded market capture:
**at most 24 tool calls and 36 selected option quotes**, plus two ETF quote rows
from the batched equity read. The historical normal sample used 16 calls; future
pagination, tracked expiries, omissions and source latency can change the actual
number without changing the cap. At most five eligible weekdays gives 120 calls /
180 selected option quotes per week; holidays reduce this. Calls to public context
at 09:00 are unchanged. Source dollar fees and Codex dollar cost remain **UNKNOWN**;
no paid source was added. Returned instrument metadata is not an extra quote or a
separate primary capture record.

Rollback requires a separately authorized development action through the same
app `automation_update` tool. Read the complete current/private original fields,
preserve task binding and notification settings, restore daily 09:00 only and
explicitly disable routine brokerage reads, then read back the installed result.
The sanitized Git reference cannot be applied as an automation backup. Actual
TOML snapshots and original full Host V4/rollback fields remain privately stored;
never edit TOML directly, recreate the task or restore Host V3. The calendar guard can safely remain; if code rollback is needed,
revert only this turn's host-route import/hunk and five tests. Do not reset the
whole workspace or erase earlier uncommitted repairs, captures or frozen plans.

**One next task:** at the first natural eligible September 21 15:50 wake, follow
the existing collector through raw save, verification and Daily guidance page
consumption, then record each acceptance stage. Host sleep/app closure/allowance,
upstream failure or late arrival can still prevent that result. No new source
authorization is required for this repaired routine. Frozen trend V1 remains
unqualified; unknown interpolation flags, four historical conflicts, original
cohort, capital/risk settings and completed engineering rehearsals are unchanged.
No commit, push, PR or merge was performed.


## Stage-save authorization and pending natural acceptance

The Owner subsequently authorized one stage commit/push of the three related
repairs, and a separate result commit only after a natural run has evidence.
Earlier no-commit statements describe the original delivery scope. Git operations
are development-session work only and are never added to daily automation.

At the September 19 stage-save check the first candidate September 21 15:50 EDT
window is still in the future: **PENDING_NATURAL_RUN**. No run-slot/capture receipt
exists for it. The installed Host prompt already requires separate stage receipts;
its actual configuration and daily 09:00/weekday 15:50 recurrence are unchanged.
No market request, production capture write or result commit is justified now.

The nine changed implementation/test files were checked against the saved
validation hashes: seven retained from the earlier final-code audit, plus the
two final routine-route files. The final 4,786-pass log and its hash were checked;
this is reuse of the September 19 23:31:59.352 UTC result, **not a new test run**.
Only documentation sanitization and pending-state clarification followed.
Both worktree and staged whitespace/content checks are required before commit.
Private evidence, raw inputs, host bindings and logs are excluded from Git;
relative evidence references do not copy their contents into the repository.
The unrelated September 16 evening review is preserved outside the stage commit.

After a natural run, assess the existing routine rules (not frozen V1's 60-second
rule), record VERIFIED / PARTIAL / FAILED / MISSED with independent stage evidence,
and inspect the existing page from an equipped development session. Unknown fees
and undefined thresholds remain UNKNOWN. Then separately commit/push only the
sanitized real result and any necessary local fix. Current natural-run call, row
and write totals are not observed; this stage-save session adds zero market calls
and zero production capture/quote records. Frozen V1 remains unqualified.
