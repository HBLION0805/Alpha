# Daily guidance and continuous public context

Task OPT-DAILY-GUIDANCE-1, September 8, 2026.

## Behavior and scope

The seventh English page, Daily guidance, is the default landing page. It joins
an attributed analyst interpretation with a descriptive price trend, official
event windows and a bounded long-call/put screen. Existing retail economics
supply indicative premium stops and cost-aware net targets. Unknown costs,
insufficient history, stale/missing quotes, conflicting news and budget failures
remain explicit WATCH/NO_TRADE. No probability, guaranteed exit, size escalation,
account access, order route or profitable strategy is claimed.

The public context service refreshes the six fixed headline feeds and Coinbase
BTC once per UTC hour, every day, and Treasury/BLS/FOMC once per New York date
after 09:00. It runs while the local workbench process is running, including when
the browser tab is closed. Shared exclusive slot claims prevent duplicate Host
and service reads. Restarts do not backfill missed hours. Fixed subprocesses have
deadlines, bounded output and independent sanitized source receipts. It does not
start with Windows; open Start Alpha again after a reboot. It has no broker credentials.

The existing gld-ibit heartbeat is active with the reviewed
[runbook](OPTIONS_DAILY_GUIDANCE_RUNBOOK.md) and
[field snapshot](OPTIONS_DAILY_GUIDANCE_HOST_V1.json). Hourly context wakes plus
09:00, 09:50, 12:50 and 15:50 retain the 16:20 close slot. Regular market samples
run at 09:50/12:50/15:50; major-event days permit additional hourly market checks.
The seven existing full-chain closes and frozen activity cohort remain intact.
The final close restores v6 first, installs ongoing guidance fields second and
then reads final evidence. No cancelled opening/development job is resumed.
Independent on-disk readback at 05:51:04 UTC matched all eight configured fields,
including the active state, exact prompt, schedule and target task. Routine
development reports are disabled under the Owner's newer instruction.

## Actual evidence

- Live Host smoke at 05:10:46 UTC: 15 authorized market calls, 36 selected existing
  contracts, zero tool-call failures. Only 24 quotes returned; 12 requested
  contracts lack quotes. Both missing and returned contracts remain in the
  current view. Returned quotes have September 4 clocks and are not live entries.
- Both ETFs currently show WATCH and INSUFFICIENT_HISTORY. No declared cost
  assumptions were manufactured; no strategy win probability exists.
- Actual public service once-run at 05:15:54 UTC returned headlines OK and BTC OK,
  with exclusive claim/receipt files. The running workbench independently completed
  the next hourly slot at 06:00:46–06:00:47 UTC, again with both sources OK, and
  issued an updated saved view. These are actual bounded reads, not future uptime.
- An attributed English analyst note records support, opposition, invalidation,
  event posture and original-source links. Issued views preserve exact inputs and
  recompute independently; current reassessment remains separate.
- The owner manual ledger remains the source of actual reported trades. Development
  tests use isolated temporary workspaces and do not invent owner executions.

## Validation

Focused guidance engine, Host, storage, settings security and UI: 65/65.
Public context service cadence, concurrency, receipts and failure handling: 8/8.
Existing workbench regression: 57/57. Strict TypeScript passes.
`node scripts/alpha-validate.mjs` passed 3,882 tests across 156 components, with
zero failures, in 78,931 ms. Warnings covered the uncommitted working tree and
configured Windows line endings. Final activation evidence is recorded in
[the status checkpoint](status/daily-guidance.json).

Commands: `npm run test:options-guidance`, `npm run test:options-context-service`,
`npm run test:options-workbench`, the aggregate validation command, the guidance
record/analysis/publish/verify CLIs, the public service once-run, the guarded
workbench launcher and `git diff --check`. Actual Host market reads used only
the four authorized market tools listed in the runbook.

The initial bundle found a Markdown code example mistaken for a local link and
three new runtime namespaces absent from the ignore rules; both were corrected
before staging. All runtime records remain excluded from Git. Added regression
cases also preserve missing quote identities, final-close restoration ordering,
the 28-wake schedule, exact trend-threshold equality and rejection of future
quote/issued-assessment clocks. No earlier immutable capture was rewritten.
The first staged whitespace check found three extra EOF blank lines in new
files; removing them changed no behavior, and the staged check was repeated.

Actual browser inspection covered seven pages, a 390-by-844 responsive viewport,
source clocks, candidate blockers, analyst links, and unsaved cost-draft retention
across navigation followed by discard. No application console errors were observed.
The initial screenshot caught the sidebar's resize transition; settled DOM bounds
confirmed no horizontal overflow and the sidebar fully outside the mobile viewport.
The running page shows all 36 selected contracts, including 12 without returned
quotes. Candidate-to-planner transfer retains the exact bid, ask, tick, unknown
costs and original source clock; the existing engine still blocks the sample.

The first native process-stop command failed. Automatic approval then rejected an
attempt lacking a newly checked process creation time. A fresh read confirmed the
PID, port, full command line, creation time and workspace health fingerprint;
repeating those checks in the restart command allowed the verified Alpha process
to restart. The new service health confirms contextRefreshEnabled=true.
An initial browser selector used an unsupported level filter; it was corrected to
the inspected h1 locator. These were execution/QA issues, not ignored product failures.

## Files, assumptions and next check

Changes are confined to the new guidance contracts/engine, Host/storage/CLI,
public refresh service and tests, existing frontend/service integration,
validation registration and relevant operational documentation. Runtime captures,
notes, service receipts and issued reports stay under ignored data/runtime.
No dependency, credential, paid provider, account/order capability or original
journal format changed.

The fixed ten-workstream baseline remains 4 LOCAL_VALIDATED, 3 PARTIAL and
3 NOT_VALIDATED; the six first-real-price-paper-flow gates retain three available
local components and three open external/adapter/flow dependencies. This delivery
adds bounded local acceptance rather than an invented overall completion percent.

Remaining limits: qualified regular-session observations and at least five recent
official session closes; declared costs; broader numerical/BEA-calendar coverage;
independent prospective strategy validation; actual reported outcomes. The current
screen covers long calls/puts, not every option structure. Analyst interpretations
can block a candidate, never bypass deterministic checks. Continue the daily
source/suggestion workflow and inspect the first eligible source evidence.

Git scope: one focused commit on codex/gld-ibit-options-foundation, followed by
the already authorized push. Git history records the resulting commit; the final
working-tree and remote-head checks are retained in the ignored delivery evidence.
