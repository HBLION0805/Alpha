# Local operator brief v1

Task: OPT-BRIEF-1. Reviewed design: 2026-09-07.
Model/effort: current task settings. Complexity: medium. Paid cost: none.

Provide one readable English text report for the Owner to inspect the opening
test without combining independent accounts or reading large JSON responses.
The current CLI/readiness v1/v2, journals, host timer and export format remain
unchanged. This is a new read-only consumer, not readiness v3 or a new decision gate.

Inputs are the existing recovered readiness v2 and independently recovered BLS
calendar journal. Recompute v1/v2 exactly before projecting their facts; derive
calendar facts through its existing engine. Bind both report hashes and actual
check clocks. Missing/busy/unsafe/corrupt calendar storage remains independent
of the other seven components. No HTTP, host inspection, source append, saved
trade, review creation, repair, order, cost change or numerical risk score.

Text must show selected study and actual assessment time; window with explicit
New York timezone and UTC, collection stage/counts, all storage states, closed
paper review coverage, separate candidate notebooks, actual source/receipt times,
headline status/refresh age, five Treasury tenors, stale BTC context and upcoming
BLS releases. Empty or failed components never reuse old values as current.
List the unchanged core test dependencies and distinguish context next steps.
Always state NO_REPLAY, no execution, unknown win probability and no live-account
inspection. Candidate lessons are not established causes or approved knowledge.

Plain text contains no ANSI/control/bidi sequences from provider titles; escape
them visibly. Titles remain data and are not used as paths, commands or URLs.
Limit displayed upcoming events to twenty with explicit total/shown counts.
Never invent a trade result or claim zero missing reviews when paper storage is
unavailable. Keep report time separate from each component's recovery time.

CLI: options:brief -- --report <study-id> [--json], plus --help. Default prints
plain text; JSON includes the text and bound report hashes. Output may be saved
by an explicit local shell redirect; the command itself creates no report files.
Absent source stores must stay absent. Existing recovery locks may be acquired
and released without appending data. No arbitrary root/source/date CLI options.

Allowed changes: new TypeScript formatter/composition and tests; new script and
I/O tests; package/validation registration; focused documentation/delivery/status.
Reuse existing recovery and bounded file helpers without refactoring old engines.

Acceptance: verify identity/fingerprint/clock tampering rejection, missing/failing
source isolation, fresh/stale distinction, timezone labels, title escaping,
bounded event display, fixed CLI scope, no network/source writes and immutable
prior outputs. Generate one actual local brief, check it against recovered counts
and preserve journals/host bytes. Run relevant tests and validation before the
standing-authorized commit/push. No user action or permission is required.
