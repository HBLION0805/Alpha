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

## Saved-format compatibility and source relationships

The published candidate CLI returns `{receiptPath, assessment}`, while its saved
receipt has version `TECH36_CANDIDATE_RECEIPT_V1`. The reader now accepts that exact
CLI outer shape with a validated `TECH36_CANDIDATE_ASSESSMENT_V1` inner assessment.
It never dereferences or displays `receiptPath`. The UI explicitly labels the
unversioned outer return value, the actual inner version and historical assessment
clock. It does not invent a version or claim source authentication.

An unversioned demo/audit wrapper around `TECH_MOCK_RESIDUAL_PREVIEW_V1` remains
rejected with a specific explanation. Residual arithmetic is not Paper completion,
account reconstruction, released funds or evidence of a flat position. Arbitrary
unknown/private formats do not become readable merely by nesting a known object.
Malformed JSON, invalid CLI contracts, unknown formats, unsafe files and conflicts
have separate bounded error codes and plain-language explanations.

Source-byte, storage-location and container fingerprints remain separate. The
container fingerprint identifies only the saved directory, not a verified run.
Candidate claim identity uses the declared scan, candidate, event and assessment
clock. Equal canonical assessment content is labeled a duplicate; different content
under the same claim identity is a conflict and leaves the inventory PARTIAL.
Every source remains visible independently, with counterpart location fingerprints.
No winner is selected, no duplicate is silently discarded and no cross-run stages
are assembled into a successful pipeline. Different assessment clocks remain
independent historical records.

Research, quote, account, plan and Paper states have separate allowlists. A generic
PASS or a preflight result cannot populate a different layer. Only a plan preview
or verified journal replay can describe a plan; a saved candidate assessment retains
its published NOT_ADMITTED contract. Missing layers remain unknown/not assessed.

For this compatibility increment, a new pre-change hash manifest was recorded
before edits. It covers all tracked/nonignored working files and private development
originals, with dependency, Git metadata, cloned review and browser-profile directory
exclusions explicitly enumerated. This is evidence for this increment only; it does
not retroactively establish a complete hash baseline for the earlier UI delivery.
