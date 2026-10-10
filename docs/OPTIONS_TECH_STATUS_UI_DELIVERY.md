# Technology research and Paper status in the existing workbench

The Event research page now includes a read-only technology status panel. It
connects the existing candidate, feasibility, spread preflight, plan-preview and
isolated spread-journal outputs to the existing UI. The same sanitized projection
is available at GET `/api/tech-status` and as `techResearch` in `/api/state`.
There are no new mutation endpoints or trade controls.

## Meaning of the displayed evidence

Research, quote/preflight, account evidence, plan and Paper states are separate.
MOCK, TEST_FIXTURE, attributed real evidence, saved-source replay and UNKNOWN
remain distinct. All real acceptance remains NOT_TESTED. The capability label
describes the existing one-contract-per-leg, same-day CDS/PDS implementation;
it does not assert a real-data run, account qualification or strategy benefit.

Saved reports are labeled SAVED_RECEIPT_NOT_REVALIDATED. Old PASS, READY and
historical implementation blocker codes describe their original assessment,
not current admission. Receipt, assessment and preflight clocks are distinguished
and displayed in original UTC precision with an Eastern-time rendering. Unknown
clocks are never inferred from filesystem modification time. Unknown evidence
does not become PASS; no recorded blocker does not mean no blocker exists.

Spread journals use the existing pure journal verification and replay functions.
The mutating recovery entrypoint is deliberately not called: it may create
directories or clean pending publication links. The UI performs no repair,
initialization, append or pending-file cleanup. A plan with no observations shows
NO_ENTRY and zero modeled orders; a modeled order is never a broker order.

## Local read and privacy boundaries

Only immediate directories in the existing ignored workbench-development store
are considered. Supported receipt filename families and spread journals are
bounded to 100 directories, 2,100 names per directory, 100 receipt candidates per
directory, files below 2 MB and 32 MiB total bytes. Nested test directories and
single-leg MOCK journals are outside this panel's scope. This is a local saved
file inventory, not a market scan or source collector.

The reader rejects symlinks, junctions, hardlinked files, unsafe roots, oversized
files, changed reads and future receipt clocks. Missing stores remain absent.
Invalid neighbors produce PARTIAL with explicit issues; a store-level failure
produces BLOCKED. Neither is a successful evidence gate.

The API constructs a field allowlist: known enums, original clocks, known reason
codes, symbols and fingerprints. It excludes raw envelopes, source prose,
credentials, original account identifiers and balances, contract IDs, local
paths and arbitrary error text. Unknown reason strings are replaced by a local
review marker. The existing loopback, Origin/Host, no-store and CSP protections
remain active. No public upload or deployment was performed.

## Verification

The dedicated status suite covers missing/stale/future/malformed data, mode
separation, privacy canaries, hardlinks/junctions, candidate/account separation,
immutable read-only journal replay, tampering and HTTP boundaries. Existing UI,
localization and type checks are also required. A scoped release checkout is
used for aggregate validation, excluding unrelated pre-existing working changes.
Private browser evidence covers saved local data, an empty workspace and a
TEST_FIXTURE journal plus malformed neighbor, each at desktop and mobile widths.
Screenshots and validation receipts remain ignored and local.

No CPI workspace, challenge ledger, collection schedule, risk threshold or
execution authority is changed by this delivery.
