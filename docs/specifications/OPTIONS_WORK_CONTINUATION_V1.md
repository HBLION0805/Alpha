# Shared development continuation v1

Task OPT-WORK-CONTINUATION-1, September 7, 2026. The Owner explicitly asked to
continue automatically after reports. Codex permits one heartbeat per task;
the existing `gld-ibit` heartbeat already occupies it. Two attempted creations
failed validation (missing thread destination, then existing heartbeat). No new
automation was created. Use the supported update of that same heartbeat, with
the existing target, name, notification preference and market-data authority.
This is an intentional new host change under the latest Owner direction.

## Reviewed operating design

Preserve the original v6 daily context restoration bytes, original phase file,
runbook Host JavaScript, frozen plan/contracts/window and all previous snapshots.
Add a separate versioned continuation manifest with armed, collection and
post-window fields. Armed/post-window wakes occur on each quarter hour; the
collection interval remains one minute. Use the app tool to update, never write
host TOML by hand or create a workaround cron/task.

A pure routing helper uses actual UTC and New York civil time, accepting only
armed or daily phase. It reads no market files and makes no requests. Armed
routing prioritizes the original 2026-09-08 13:30-13:50 UTC quote window. During
that interval invoke the exact existing runbook Host tick. At/after the end,
first restore v6 fields through the app tool, then install post-window continuation
fields, and only then read/save closeout. If restoration fails, stop without
opening any collection evidence. If continuation installation fails, v6 remains
the safe daily baseline; report the failure without claiming continuation.

Daily context is due only at 09:00 through strictly before 09:15 New York.
Invoke the exact original v6 daily prompt once for that wake; never interpret
each quarter-hour development wake as a source-refresh request. During September
8 09:00-10:00 New York, do no development: daily context/collection/restoration
retain priority. Outside that guard, a development wake has at most ten minutes
of new work and must yield before a guard or the next daily-context period.
Do not begin a new work unit if fewer than ten minutes remain before the next
priority boundary. A late or unavailable host remains a gap, not a backfill.

In daily phase before the frozen window ends, return PHASE_BLOCKED; do not
silently skip the scheduled collection. In daily phase after the opening window,
the same daily-context guard and bounded development rules apply. No collector
or repeated closeout is invoked by the post-window prompt.

Development follows the current handoff and repository standards, retains
uncommitted progress if a bounded unit cannot finish, and reviews/tests before
authorized commits/pushes. Prioritize first qualified GLD/IBIT paper-flow evidence;
do not add low-value modules merely to consume allowance. All trade reviews and
candidate lessons remain immutable. No account/order/transaction, purchase,
quota reset, OAuth restart, second task/service or new market-call authority.
When development is complete/cancelled or only external data remains, remove
the development responsibility by updating this shared task to an appropriate
existing daily/armed baseline. When temporarily waiting for the pending opening,
retain the new wrapper but use the original 09:00/09:30 cadence, so closeout can
still install the post-window continuation. Never delete its continuing news
responsibility or lose the still-pending 09:30 opening wake.

The old runbook phase prose is superseded only for the new shared wrapper's
non-collection cadence. Its exact quote Host code and restore-v6-before-evidence
ordering remain authoritative. The old documents remain immutable evidence.
New host prompt routes through this helper and refers to the new manifest for
phase updates, not the superseded old cadence.

## Acceptance and limits

Tests cover exact boundaries, quarter-hour routing, New York DST, priority guard,
development deadline, invalid phases/clocks/arguments, no source/file side effects,
manifest target/notification/name preservation and unchanged original phase,
v6 and runbook hashes. Validate actual current routing without quote calls.
After app update, read stored host fields and compare all intended fields;
retain before/after evidence. Scheduling and model compliance are not proven by
a synthetic router; the first actual later wake remains unobserved.

Relevant official documentation inspected September 7, 2026:
[scheduled tasks in a chat](https://learn.chatgpt.com/docs/automations?surface=app).
Minute-based in-chat continuation is supported; local work still requires an
available app, computer and allowance. This is not an event-triggered guarantee
of an immediate new turn after a final response.
