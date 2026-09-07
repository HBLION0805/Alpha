# Research protocol registration and isolated recovery

September 7, 2026. OPT-RESEARCH-PROTOCOL-1 storage unit, base `0fce960`.
The first scheduled wake under reporting v2 routed at
`2026-09-07T20:33:43.115Z`, with deadline `2026-09-07T20:43:43.115Z`.

## Behavior and purpose

`npm run options:research-protocol -- --inspect <workspace-json>` reviews a local
declaration without registering it. `--register <workspace-json>` freezes the
complete input and original pure assessment under its protocol ID. An exclusive
directory reserves the entire payload/receipt pair. After payload fsync/close,
the actual local save clock is read and a separate receipt binds exact bytes,
definition hashes and registration timing. `--verify <protocol-id>` independently
recomputes the saved pair without reading the original input or source journals.

Payload freezing and receipt preparation have separate clocks and separate
before-first-window flags. Equality with the first window start is late. A receipt
prepared after the window cannot inherit the earlier payload's clock. The result
does not assert that a complete registration was available to a past decision.
Later decision binding must verify both prerequisite pairs before a new decision.

Empty, payload-only and receipt-only attempts remain incomplete; the same protocol
ID cannot be reused or revised. Strict existing path/JSON helpers reject links,
extra entries, oversized data, ambiguous keys, corrupt bytes and clock regression.
Input is capped at 256 KiB, payload at 2 MiB and receipt at 64 KiB. Storage protocol
IDs use the existing lowercase filesystem-safe export-ID contract. Exact source
bytes, including a UTF-8 BOM and whitespace, are preserved in the frozen text and
source hash. The original declaration engine remains unchanged.

## Evidence and validation

The 18 focused cases cover current-clock saving, late and partial registration,
separate preparation timing, duplicate IDs, exact encoding, rebound tampering,
unsafe files/paths, strict inputs and fresh-process recovery. A synthetic fixture
was registered in a temporary workspace at `2026-09-07T20:40:33.758Z`, then verified
by another process at `20:40:33.870Z` after its original input was replaced with
unusable text. Hashes matched. The checked temporary workspace was removed; zero
protocols were registered in the active workspace. Fixture dates are test data,
not a selected research split or strategy for the Owner.

Changed files: the new registration command/tests and clearly labeled synthetic
fixture, package/test registration, runtime ignore, this delivery/checkpoint and
HANDOFF/ROADMAP notes. Commands: focused tests through tsx, full
`node scripts/alpha-validate.mjs`, actual-clock isolated storage rehearsal,
preserved-file hashes, JSON/link checks and `git diff --check`. Review identified
and fixed BOM stripping before final validation. Final measured totals and
preservation evidence are in [the checkpoint](status/research-protocol-registration.json).

## Limits and next unit

No official research protocol, model, dataset or decision was created. Empty
partitions, zero samples and incomplete feature evidence remain explicit. The
receipt verifies local consistency, not external timestamps, provider identity,
sealed holdout access or historical decision authority. No source refresh,
scheduler edit, old-journal change, risk-policy change or order occurred.

Next bounded unit: compose independently verified context/protocol receipts into
an actual-time research observation or no-trade decision record, preserving
missing features and all original cases. Use the existing reviewed design, refine
the decision schema before implementation, and do not bind new receipts to old
plans. The frozen opening quote study remains the dependency for qualified
real-price paper execution. Commit/push follows standing Owner authorization;
final refs and clean status are checked after commit.
