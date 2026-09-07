# Synthetic collection-window rehearsal v1

Task: OPT-COLLECT-REHEARSE-1. Reviewed design: 2026-09-07.
Model/effort: current task settings. Complexity: medium. Paid cost: none.

## Purpose and isolation

Exercise the checked-in Host tick through real local observation, collector and
closeout repositories across twenty simulated minute slots. This fills the gap
between separate host-port tests and collector/recovery tests. It is an offline
engineering rehearsal, not a live host scheduling test, market dataset, order,
strategy backtest or proof of execution readiness.

Use only the existing checked-in SYNTHETIC capture/calendar fixtures, expanded
deterministically to two GLD and two IBIT synthetic contracts. Keep original
fixture bytes unchanged. A new twenty-minute September 4 scenario window and
freeze clock are explicitly simulated. Each run retains actual start/end clocks
separately from simulated request, receipt, recording and assessment clocks.

Every run creates a fresh directory under the operating-system temporary root;
never target the active runtime workspace or a caller-selected path. Do not
copy existing source journals, credentials, account data or owner evidence.
The fixed command is `options:collection-rehearsal -- --run`, plus help. It
returns a bounded JSON receipt and retains the temporary evidence directory;
it does not create a task, automation, background process or real market call.

## Host program boundary

Read only the checked-in Host tick and require its known normalized SHA-256.
Execute it with isolated in-process ports. Rebind only its workspace, study ID,
frozen plan fingerprint and four contract IDs to each synthetic scenario.
Verify each literal is replaced exactly once and retain original/derived hashes
plus a declaration of those substitutions. Do not change control flow, request
tool names, GLD/IBIT symbols, outcome handling or the live runbook/heartbeat.

The fake local-command port recognizes only the exact prepare and accept-base64
command shapes and routes them to the actual local functions with the scenario
clock. It never invokes a shell. The only fake market ports are the two scoped
quote tools. No provider guide or exception text enters local records.

The simulated timer advances scenario time without sleeping. Parallel requests
retain their start clocks before simulated completion latency. If a prior tick
is still busy at a scheduled wake, the harness records a skipped wake rather
than moving the clock backward. This is a declared scheduler model, not measured
Codex host behavior. A source that never settles remains an untested live risk.

## Fixed scenarios and acceptance

- Healthy: twenty fresh complete quote batches.
- Mixed: one omitted wake, two tool failures, stale quotes, one zero-size quote,
  one missing quote and a final response received after the scenario window.
- Slow: seventy-second responses cause alternate scheduled wakes to be skipped;
  saved quote ages remain stale under existing validation.

Each scenario saves a pre-window closeout, runs the window, saves final closeout,
reopens every input/report and checks same-clock save idempotency. Original
pre-window bytes must stay unchanged. The receipt retains source errors, coverage,
gap intervals, candidate operational lessons, all outcome counts and source/plan/
report fingerprints. Candidate first-known clocks remain simulated and cannot
become actual learning knowledge. No actual trade or journal lesson is added.

Acceptance uses independently declared expected counts, failure classes, zero
network/shell/host-mutation calls, source origin, immutable pre-window report,
reopen/idempotency and explicit no-replay/no-orders boundaries. Tests run in
isolated temporary roots and may safely clean only their own verified paths.
One actual rehearsal artifact is retained, protected active file/host hashes
are checked, and focused/full validation precedes authorized commit/push.

Allowed changes: the new rehearsal script and focused tests, command/validation
registration, this specification and focused delivery/current documentation.
Existing production engines, scripts, fixtures, plans, journals and host program
remain byte-identical. No network/library dependency or pricing assumption is added.
