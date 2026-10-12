# Saved weekly receipts into existing TECH36 research

Weekly source refreshes previously reached the weekly source page but not the
existing pending-event research store. The existing `options:tech-candidate`
entrypoint now accepts those saved envelopes and prepares bounded research batches
in a newly created private workspace. This is an offline conversion, not a new
source refresh, current forecast, company qualification or Paper acceptance.

## Operation and identity

Run from the development checkout:

```text
npm run options:tech-candidate -- --weekly-research-inputs --source-root SOURCE_WORKSPACE --run-id NEW_ID
```

The returned `workspace` contains the unchanged existing TECH36 research receipt
and append-only event-review format. From that workspace, use the absolute existing
CLI with `--event-reviews --run-id weekly-batch-001`; subsequent explicit reviews
use its existing `--append-event-review` command. The existing `readTechResearchView`
also reads the batches. The live website's configured research root is unchanged.
This does not install automatic conversion on source refresh or any schedule.

Every original receipt is copied byte-for-byte into the new intake archive.
Existing receipt validation rechecks source ID/URL, raw hash, copied acquisition
envelope, parsed output and clocks. Company, CIK and accession remain bound to the
parser's actual issuer row. An accession prefix may identify a filing agent and is
not assumed to equal the issuer CIK. Descriptors bind exact event IDs and original
file hashes, then the ordinary research reader repeats validation on recovery.

SEC identity is issuer plus accession. Repeated acquisitions of identical parsed
metadata deduplicate into one event while retaining all originals and clocks.
Changed metadata appends a version with previous-version references, including
when its versions fall in different batches. Changed raw bytes with identical
metadata retain separate original hashes without inventing a metadata revision.
IR retains the parser's source-specific event identity. Same company/title/date
does not prove that IR and SEC records describe the same event; cross-source
association remains unresolved until the existing explicit review process. IR
date changes therefore remain separate pending identities, not silent overwrites.

Publication time, filing acceptance, request/receipt time, review time and local
conversion time are distinct. SEC acceptance is not document publication time.
Unknown publication/review times remain null. A SEC submissions receipt is metadata,
not an obtained filing body; parsing an IR calendar does not verify an event.
All initial reviews are NOT_REVIEWED, coverage UNRESOLVED and ranking MISSING_DATA.
No source Boolean or successful transport creates verified facts or admission.

The inherited limits remain eight research runs, 80 events per run and the existing
bounded file/byte readers. Larger inputs stop instead of silently dropping events.
All failed/empty source receipts are included in the first batch, with other batches
explicitly reporting NOT_IN_THIS_BATCH where appropriate. The intake archive retains
the full source-health history. A later failed attempt remains failed even if an
earlier calendar parsed; mixed history is PARTIAL_SOURCE, never complete coverage.

## Actual offline acceptance

Final run: `weekly-research-intake-20261012-02`, converted at
**2026-10-12 22:52:44.078 UTC / 18:52:44.078 America/New_York**. Source receipt
clocks remain October 11, 05:52:28.294–19:40:15.565 UTC. They are not refreshed by
the October 12 conversion or recovery. The earlier `-01` trial is retained.

| Measure | Result |
| --- | ---: |
| Saved receipts archived | 105 |
| Company / non-company receipts | 101 / 4 |
| Parsed event/filing rows | 768 |
| Duplicate rows consolidated | 223 |
| Pending events in seven batches | 545 (six × 80 + 65) |
| Filing bodies still missing | 533 |
| Actual changed metadata versions | 0 |
| Failed latest IR source IDs | 31 |
| Companies with a parseable IR source | 11 |
| Companies with failed IR and no parseable alternative | 25 |
| Automatically reviewed / selected | 0 / 0 |

The ordinary research inventory returns all 545 records and seven trace scans,
with no inventory or trace issues. Each event's lineage matches the intake archive.
All seven batches recover identically from a copied workspace. The real existing
CLI reads a copied batch successfully. A complete AAPL trace binds original file
hash, embedded acquisition envelope/raw hash, issuer/accession, parsed version,
batch receipt/review head and pending research input; publication/review remain
unknown and its missing-body blocker remains visible.

Acceptance originals are local and ignored under
`data/runtime/options-workbench-development/weekly-research-intake-acceptance-20261012-01`:
`final-acceptance.json`, `complete-trace.json`, `existing-cli-copied-review.json`,
`final-research-view-r2.json`, copied workspace and test logs. The final acceptance
receipt SHA-256 is
`1a5a2e4e7300ebc912b1c5d5c8bc73a41ab14e7bd9efe0b8e0f8fb59605b1cdd`.

Focused validation: 21 adapter tests plus 219 existing candidate, trace, handoff
and company-source tests pass (240 total; full suite not rerun). Tests exercise
duplicates, changed versions/raw bytes, source/company/accession mismatch rejection,
failed IR, bounded batching, copied recovery, existing explicit reviews and refusal
to promote metadata without body citations. The initial Windows CLI acceptance
harness needed a file URL for the tsx loader; the corrected real CLI replay passed.
Protected hashes: 105/105 saved receipts and 25,910/25,910 existing protected files
unchanged. Both sites retain code `38d532e` and their original process start times.

The next research blocker is obtaining/reviewing cited filing bodies and resolving
source/company-event meaning through the existing explicit review path. Direction,
horizon, technical conditions and later executable quotes remain separate work.
No new external source or quote call, account/ledger write, Paper admission,
schedule change, CPI change, deployment or push occurred. This delivery is a local
development commit after `939c1a1c911dc61764c4148d89e1ab18963722a2`.
