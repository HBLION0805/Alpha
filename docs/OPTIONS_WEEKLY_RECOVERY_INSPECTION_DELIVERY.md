# Read-only finite-run recovery inspection — October 11, 2026

The independent inspection command reads the existing public/company owner,
manifest, hash-linked journal and verified source receipts without operating the
runner. It separates confirmed requests, unfinished requests and candidate
receipts whose attribution cannot be proven. An unfinished request conservatively
occupies one slot; this is accounting, never permission to resume or retry.
Original scope, interval, budget and deadline remain visible and immutable.

```powershell
npm run options:weekly-recovery-inspect -- --inspect --family public --run-id <UUID>
npm run options:weekly-recovery-inspect -- --inspect --family company --run-id <UUID>
```

`--workspace` can select an explicit local root. There are no recover, unlock,
restart, retry or start options. The CLI does not probe PIDs. An injected read-only
presence observation in the library never establishes process identity or grants
control authority. Local output includes evidence paths/hashes and remains private.

## Failure behavior and validation

The isolated matrix covers owner-before-manifest initialization, partial JSON,
truncated/invalid journals, live/unknown/absent PID observations, empty source
locks, unknown source-claim ownership, receipt-without-finish ambiguity, duplicate
request accounting, existing terminals, changed evidence, expired original
windows and original budget bounds. `resumeAllowed`, `takeoverAllowed`,
`unlockAllowed` and `retryAllowed` remain false for every outcome.

Independent review found a cross-timezone comparison error. It was repaired to
compare parsed source instants while retaining original offset strings. Equal
instants in different zones, pre-attempt and post-finish receipts, original
cutoffs and invalid clocks are covered. Core tests passed 44/44; the read-only
CLI test makes 45/45. All tests use temporary synthetic files. No actual crash,
restart, source lock removal, acquisition or live recovery was performed.

## Remaining local engineering gaps

- Existing recover terminates/releases an old owner; it is not budget-preserving
  resume. New runs still have independent manifests, budgets and deadlines.
- Partial initialization and source-lock ownership cannot be repaired safely from
  missing evidence. The inspector preserves UNKNOWN and the original files.
- Requests have no durable cross-store run/attempt identity. Nearby timestamps
  cannot authenticate a receipt as the unfinished request.
- Long-term retention still has the existing reader bounds. No automatic archive,
  deletion, raised storage limit, system startup or persistent service was added.

These are local engineering constraints, not requests for paid data, login or new
credentials. They remain distinct from natural-run acquisition/terminal acceptance.
The 18 IR HTTP 403 outcomes do not authorize bypass or repeated acquisition.

A separate minimal terminal-preservation repair is tracked independently. This
inspection does not create a resume path or operate either current run.

At 2026-10-11T15:20:42.355Z, actual read-only inspection verified both original
manifest/journal sets at 10 confirmed requests of 20, no unfinished attempts or
inspection issues. Owner bytes were unchanged. Process presence intentionally
remained UNKNOWN because no probe was requested. Private results are retained
under data/runtime/options-weekly-sources/recovery-inspection-20261011/.
