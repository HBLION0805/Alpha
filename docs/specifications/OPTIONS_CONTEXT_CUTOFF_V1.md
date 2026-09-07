# Journal receipt-time context reconstruction v1

Task: OPT-CONTEXT-CUT-1. Reviewed design: 2026-09-07.
Model/effort: current task settings. Complexity: medium. Paid cost: none.

## Purpose

Reconstruct GLD/IBIT background context at an explicit historical UTC cutoff
using only observations present in the local journals by their stored receipt
or discovery clocks. This prepares future replay consumers without changing
current readiness, source engines, trade plans, journals, costs or permissions.

This is a reconstruction performed now, not proof that a historical plan used
the data, proof of an actual decision then, original publisher-vintage evidence
or a claim that the journals capture all information the Owner/agent knew.
Stored receipt/discovery clocks do not record the exact durable journal append
time; the result explicitly retains journalAppendTimesKnown=false.

## Selection and integrity

Four independent components: six-feed headline history, Treasury real yields,
Coinbase BTC-USD and BLS release calendars. Use existing repository recovery
and source report engines. Validate each complete current history first; later
corrupt records cannot be silently ignored merely because their times are after
the selected cutoff. Missing/busy/unsafe/corrupt sources remain independent.

After recovery, select numerical/calendar retrievals with receivedAt <= cutoff,
never by their economic source date or source publication metadata. A request
started before the cutoff but completed after it is excluded. Headline records
and health use observedAt <= cutoff; undated health cannot be placed earlier.
Retain selected append order and failures. Do not skip a failure to promote an
earlier success or collapse A-to-B-to-A revisions. Build reports at the cutoff
through unchanged engines, including their stale/unknown/future-date rules.

Bind each selected prefix hash and source report hash. A context fingerprint
excludes construction/check clocks and later unselected records, so appending
valid later observations cannot change earlier reconstructed context. A separate
artifact fingerprint includes actual construction and component recovery clocks.
Both meanings are explicit; checksums do not authenticate publisher assertions.

Require canonical UTC clocks, cutoff <= each component check <= construction,
ordered component checks and exact input shapes. Keep existing journal size/
history limits. Additional headline selection cap: 20,000 observations and
20,000 health records; oversized reconstruction fails visibly without truncation.
Headline clock ordering is checked per source because independent feeds can
complete in a different order from the catalog. Recovery compares bounded file
bytes before and after each reader; changed input is blocked for that component.

No real-time source calls, source writes, host changes, credentials, account/order
calls, simulated trades, model predictions or calibrated probabilities. The
result always retains executionAllowed=false, replayAllowed=false and
winProbability=null. Empty selected history means unknown local context, not a
neutral economic value or a successful event-free trading test.

## Command and acceptance

CLI: options:context-cutoff -- --at <canonical-UTC-time>, plus --help. The CLI
checks actual current time before recovery and rejects future cutoffs. No root,
source, URL or date override beyond the explicit reconstruction cutoff. It emits
JSON only; optional artifact saving is a separate explicit local shell operation.
Absent stores must stay absent; temporary recovery locks are permitted.

Allowed files: new TypeScript composition/tests, local script/tests, package and
validation registration, focused specification/delivery/current documentation.
Existing source/report/collector/host/export implementations remain unchanged.

Tests: delayed receipt exclusion, publication-date non-substitution, cutoff
equality, preserved failure/unknown semantics, valid future-append invariance,
invalid future-history rejection, correction order, sequential clocks, missing
and blocked source isolation, fixed command scope and no network/source writes.
Run one actual reconstruction and verify selected counts/hashes against existing
journals, then the relevant suites and validation bundle. Commit/push under the
Owner's standing authorization after review. No actual trade replay is run.
