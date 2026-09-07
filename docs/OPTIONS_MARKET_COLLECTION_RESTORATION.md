# Market collection restored; development stays in conversation

September 7, 2026. The Owner explicitly requested restoring market collection
after cancelling the shared automation, with development only in this conversation.
This supersedes the earlier quarter-hour development and reporting instructions.

The deleted gld-ibit task could not be updated. The app reported that it did not
exist. It was recreated under the same original ID, then updated to the exact
armed fields in [the original phase manifest](OPTIONS_ROBINHOOD_HEARTBEAT_PHASES.json).
The final name, target, prompt, schedule, status and notification preference
match the original market workflow. No second task or new collector was added.

Actual eight-field verification at 23:34:57.397 UTC confirmed ACTIVE. The checked
prompt has no development router or quarter-hour reports. The host file identity
and before/after evidence are in the [checkpoint](status/market-collection-restoration.json).
V3 active, waiting and post-window fields are historical and must not be restored
by a later market wake. At the end of the quote window, restore v6 before reading
collection artifacts and run the original closeout; do not install development.

The original schedule retains daily 09:00 New York news, Treasury, BTC, BLS and
FOMC context, the September 8 09:30-09:50 opening pilot, minute ticks during that
window and daily context afterward. No broader recurring option collection window
was created. The four contracts, two exact quote tools, original plan/window and
runbook bytes remain unchanged. Routine unchanged source results, WAIT and
successful captures are quiet under the original prompt. Significant failures,
recoveries and source changes retain its notification behavior.

Validation: the original host test command
`node node_modules/tsx/dist/cli.mjs scripts/options-robinhood-collection-host.test.mjs`
passed 17/17. The local `options-robinhood-collect.mjs --prepare` command returned
WAIT at 23:34:57.245 UTC with the original study/plan hash, zero attempts, frames
and usable observations, and no requests. Both exact quote tool names are exposed
in the current tool catalog; they were not invoked. A future wake/response is not
proved by stored configuration or this local preflight.

Changed files: README, AGENTS, handoff, roadmap, maintained progress baseline and
checkpoint, this delivery and the new restoration checkpoint. No production code, plan, journal, risk rule or old host
manifest changed. All 523 non-host protected artifacts and six immutable source
hashes matched; the single restored host file changed as authorized. Both current
JSON files parsed, 184 local links resolved and Git whitespace checks passed
before the authorized commit/push. No new feature tests, typecheck or full
aggregate rerun are needed for restoring already-tested fields and documentation;
the prior 3,510-test / 144-component result remains dated at a066ccd.

The failed update was an expected missing-task state after deletion, not an
approval rejection. Create and final update succeeded. No OAuth, account/order
call, market quote, paid step, simulated fill or brokerage transaction occurred.
Application availability and allowance still govern future execution.

Overall scope remains 10 workstreams: 4 local, 3 partial, 3 unvalidated. Restoring
the schedule advances none of the six real-price paper-flow gates. The next
independent development candidate is modeled-account/portfolio-risk integration,
with a focused specification before code. Source-specific adapter acceptance
still needs actual eligible quotes and remaining source/cost/account evidence.
