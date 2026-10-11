# Explicit candidate-bound research registration

Engineering delivery on the weekly development branch. A caller can preview an authored research request, explicitly register it against the exact selected fixed-36 candidate review, then recover the original record. This closes the missing persistence interface; it does not close the real TSM research/admission gap.

## Minimal interface

Use the repository root explicitly. The following commands are an interface description, not authorization to create real records in this delivery:

```text
node --import tsx scripts/options-tech-research-registration.mjs --preview INPUT
node --import tsx scripts/options-tech-research-registration.mjs --register INPUT --preview-fingerprint FINGERPRINT
node --import tsx scripts/options-tech-research-registration.mjs --recover ID
```

`TECH36_EXPLICIT_RESEARCH_REQUEST_V1` requires `id`, exact `candidateBinding`, `evidenceContext`, `authorship`, `asOf`, `holdingFrom`, `holdingThrough`, fundamental/news `direction`, `hypothesis`, `trialCondition`, `confirmationCondition`, `invalidationCondition`, `exitCondition`, and exact source document hashes/block indexes. See the module's strict schema and isolated test fixture for a complete executable example. Binding includes run/scan/base receipt/review head/trace/research record/event references; ticker alone is insufficient. Sources must belong to that candidate's reviewed original body blocks.

Authorship is a declaration (`ASSISTANT` or `HUMAN`, name and source reference), explicitly not identity authentication. Both `humanReview` and `ownerConfirmation` remain `NOT_RECORDED`. No caller can submit an Owner-confirmed flag, PASS envelope or registration timestamp. Service time supplies `registeredAt`; CLI has no `--at`. Nanosecond checks require source receipt/review before research, research before registration, and registration no later than the start of a positive holding window. This clock proves service persistence, not the author's first thought.

## Persistence and recovery

Reuse the original bounded comparison record protocol as kind `techresearch`: 16 KiB per record, 500 total shared records, exclusive append and original fingerprint validation. No parallel ledger or changed capacity. Requests are bounded to 8 KiB; an oversized final envelope still fails the unchanged storage limit.

New registration requires the current exact review version and unchanged preview. An unchanged retry retains the old bytes and clock, including after later review revisions or the holding window. Changed content under the same ID fails. Recovery replays the exact historical review plus the entire currently retained source/revision chain and recomputes the registration payload. A corrupt/missing source or partial record blocks; recovery never repairs or synthesizes it. Two pre-write checks do not constitute a cross-store atomic lock: a concurrent later review may exist, while the saved registration remains bound to its exact original head.

The recovered `researchPayloadDraft` is explicitly unreviewed, has UNKNOWN evidence statuses and no evidence envelope. It is a minimal future preparation input, not an automatic handoff or saved trading plan. Human review, Owner confirmation and the existing eight-envelope admission path remain separate work.

## Validation and unchanged scope

Independent review found no remaining P1/P2 and independently passed 136 candidate/registration tests. Coverage includes required fields, every binding reference, source provenance, author roles, fixture separation, reversed/submillisecond clocks, stale reviews, changed preview, duplicate retries, copied-only historical recovery, rehashed tampering and partial records. The interrupted first attempts remain local: an incorrect import and a fixture cleanup-prefix failure were repaired before acceptance.

Full regression and final readback are recorded in [status](status/tech-research-registration.json). No real registration, Owner record, source call, quote, strategy request, fill or P&L was created. No browser input/write endpoint was added. 4178 stays pinned to `3e0809d8078724072facbc5a5853bde69e014169`; frozen October 12 stays `2dabc11486f0217fe001a6102ead13a8fa539f51`. Original CPI/15:50, bounded runner terminals, account/risk settings and the challenge ledger are unchanged. The separate [October 12 read-only checklist](OPTIONS_TECH_OCT12_READONLY_CHECKLIST.md) does not replace or edit the frozen runbook.
