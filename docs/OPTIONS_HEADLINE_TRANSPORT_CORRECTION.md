# Headline transport and journal boundary correction

Task: OPT-NEWS-GUARDS-2. Date: 2026-09-07.

## Reviewed change scope

The existing as-of headline engine already filters observations by actual
discovery time; later discoveries cannot become earlier known headlines.
No change to its semantics or accepted fingerprints is needed.

Inspection found three boundary issues in the older script transport: only the
fetch signal bounded the operation, awaited reader cancellation could delay
completion, and Buffer UTF-8 decoding silently replaced invalid bytes. Also,
direct journal refresh did not reject hard-linked journal files, although newer
readiness checks did. These are implementation gaps found by inspection, not
claims of a recorded source failure or corrupted actual history.

Correct only script-owned public transport, journal file checks and sanitized CLI
failure mapping. Preserve fixed source URLs, commands, six-source fan-out, all
valid parser/engine outputs, journal format and existing evidence. Add a total
12-second header/body deadline; cancellation must not hold completion hostage.
Reject malformed UTF-8 and unsupported metadata explicitly. Do not add source
calls, retries, providers, credentials, schedulers or order authority.

Before direct journal reading and appending, verify a regular non-symlink,
single-link file within the existing size bound. This retains the existing
single-writer model and does not claim protection from arbitrary concurrent
filesystem mutation. Keep uncertain-write and callback-lifetime guards intact.
CLI failures must retain fixed codes rather than copying arbitrary error text.

## Validation and delivery

Acceptance: retain all prior tests; add stalled-header/body/cancel, malformed
UTF-8/metadata, sanitized failures and hard-link tests. Verify existing journal
hashes and host fields unchanged. Run focused source/I/O checks and the aggregate
bundle before the standing-authorized commit/push. Record actual measured
results in [the delivery checkpoint](status/headline-transport-guards.json).
Changed files are the driver I/O script, CLI and existing I/O tests, plus focused
architecture, decisions, changelog, handoff and this delivery/checkpoint.
No new live source request is required;
the endpoints and successful response semantics are unchanged.

The focused suite passes 32/32 tests, retaining the prior twenty checks and
adding twelve boundary cases. An isolated Windows test initially passed a plain
path to Node's ESM preload; converting that test argument to a file URL corrected
the test setup. No actual source/history failure was introduced. The actual
`--report` recovery output is retained as
`data/runtime/options-driver-monitor/transport-guard-recovery.json`.

Commands include the focused driver I/O suite, actual read-only report recovery,
protected-artifact/host comparisons, Git diff review and aggregate validation.
Final counts and hash verification are in the checkpoint. Git is committed and
pushed under the Owner's standing authorization after those checks pass.

The complete bundle passed **2,955/2,955 tests**, 113 components, zero failures
in 52,139 ms. Twenty-one preserved artifacts and the active host file retain
their exact hashes. Actual local recovery still reads 118 observations and six
previously successful source states, with zero new observations appended.

Risks/assumptions: previously tolerated invalid encodings now fail visibly;
publisher metadata changes may require a reviewed adapter update. The public
headline parser remains a bounded subset and does not establish verified facts,
numerical signals or calibrated outcomes. Source quality and local storage
integrity remain distinct. Next: retain daily monitoring and inspect the frozen
opening-window quote evidence when available.
