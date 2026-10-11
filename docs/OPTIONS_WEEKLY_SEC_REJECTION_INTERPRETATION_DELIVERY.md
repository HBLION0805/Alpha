# ASML historical SEC rejection explanation — October 11, 2026

`WEEKLY_SEC_REJECTION_INTERPRETATION_V1` adds a read-only explanation of the latest
saved ASML SEC receipt's rejected rows. It follows the existing additive news-date
pattern. It changes no legacy parser, original parsed result, rejection reason,
partial flag, recent filing count, acquisition policy, runner, or saved plan.

## What the saved evidence establishes

The original 13:40 receipt has SHA256
`2ae55c12cd6cfa36afcad3eeca97a2baa754a863b44d1167a499f6672eb47f86`.
Its body matches the earlier saved ASML response. The existing parser retained
585 valid older rows, omitted those from the 30-day projection, rejected six rows
and retained zero recent filings. Those original numbers remain unchanged.

| Original index | Accession | Filing date | Original first rejection |
| --- | --- | --- | --- |
| 585 | 0000766524-00-000048 | 2000-02-17 | ISSUER_SEC_DOCUMENT |
| 586 | 0000314965-99-000167 | 1999-02-12 | ISSUER_DATE |
| 587 | 0000315066-95-003022 | 1995-08-10 | ISSUER_DATE |
| 588 | 0000315066-95-003021 | 1995-08-10 | ISSUER_DATE |
| 589 | 0000315066-95-002712 | 1995-05-19 | ISSUER_DATE |
| 590 | 0000315066-95-002711 | 1995-05-19 | ISSUER_DATE |

All six are valid Gregorian filing dates, and their complete, explicitly zoned
acceptance clocks precede the original receipt by far more than 30 days. Five
valid 1995/1999 dates fail the preserved legacy parser's 2000–2099 date range.
All six also have empty `primaryDocument` and `reportDate`; the first-error-only
legacy result masked the document gap for five rows. These are historical rejected
metadata rows, not six missing recent news items.

The overlay retains the exact raw fields and original first error, adds independent
issues, and shows the historical classification against the original receipt's
30-day cutoff. `documentUrl` remains null, `documentBodyObtained` remains false,
`reportDate` remains unknown. `primaryDocDescription` is displayed only as a
source description, never a filename, report date, link or body retrieval.
No rejected row is promoted into validated or recent filing counts.

## Integrity and display boundary

The unchanged issuer reader verifies original fingerprint/raw bytes and exact
legacy replay first. Any reader issue blocks interpretation. The overlay consumes
the already captured snapshot, checks raw hash, ASML identity, column alignment,
rejected-index uniqueness and bounds, and complete Gregorian/explicit-offset
clocks. Future, incomplete or invalid clocks retain UNKNOWN. A recently rejected
row is never blanket-labeled historical. Competing equal-time latest receipts
remain ambiguous. The original status and partial flag remain visible.

The UI separates this explanation from the source's original counters and shows
its version, raw accession/form/dates, missing fields, prior rejection and origin
receipt. It creates no controls, document URL, source calls or filesystem writes.
The snapshot inventory distinguishes saved SEC receipt count from the latest
receipt per source; it does not claim complete SEC historical coverage.

## Offline acceptance and rollout

At **2026-10-11T14:42:22.351Z**, all **95** issuer receipts passed legacy replay.
There were **43 SEC receipts**, **36 latest source receipts**, **34,687 raw rows**
and **six latest rejected rows**. Explanation totals: six historical, zero within
the original 30-day window, five legacy year restrictions, six missing documents
and six missing report dates. **119 source receipt files** and **25,907 protected
files** retained their hashes. Preserved parser/reader/runner files have no Git
change; existing checkout/archive LF/CRLF conversion is recorded separately from
content identity. Loaded archived code was not edited.

Local evidence:
`data/runtime/options-weekly-sources/sec-rejection-offline-20261011/receipt.json`.
SHA256: `759a904cf4e6c72f34a428036b6c66c150bbcec0481ddddf52503ede123150a6`.

Sixteen focused tests cover dates, timezone requirements, original first errors,
missing fields, descriptions, original-window timing, corrupt replay, ambiguous
indices/receipts, snapshot isolation, owner-preview/counter preservation and UI
escaping. Full regression and static desktop/mobile QA are recorded in
[status](status/weekly-sec-rejection-interpretation.json).

The live 4178 remains reviewed **d395281**. This narrow code awaits independent
review before any preview switch. Public/company processes, their next natural
rounds, budgets, source scope and deadlines remain unchanged. No resampling,
restart, new feature scope, frozen-experiment modification or trading permission.

Final equipped validation passes **239 components, 6,029 tests, zero failures**.
Static 1440-pixel desktop and 390-pixel mobile views passed visual and overflow
checks. At **2026-10-11T14:44:13.4260588Z**, live 4178 still served d395281 without this new overlay;
public PID 23512 and company PID 7956 retained their original start times. Both
were WAITING with ten requests each; next eligibility remained 15:38:44.546 UTC
and 19:40:01.359 UTC respectively. No data-source call or process change occurred.

## Independently cleared actual-port rollout

Independent review cleared exact **549fb295b4c29a5730111c5814adf3590c98fc1d**.
The approved **http://127.0.0.1:4178/#weekly-plan** now serves its 1,513-file
hash-pinned archive, PID **29168**, started **2026-10-11T14:50:19.832Z**.
Actual-port checks passed for all eleven original navigation routes, desktop/mobile
ASML explanation/source fields and health cards, client/server read-only guards,
and protected hashes. There were no console, page, HTTP, network or external
request errors, and no outbound attempts. All **25,907** protected files and
**203** source/runner files retained hashes. The archived legacy issuer reader
replayed all **95** receipts; old company parser, issuer reader and both runner
modules are byte-identical to the preceding archived version. Frozen experiment
remains clean at **2dabc114**. Temporary 4180 is closed; preserve **d395281** rollback.
Earlier pending-switch statements above are historical.

At **2026-10-11T14:52:48.0490857Z**, both runner process start times were unchanged. Public and company
runs remained WAITING with ten requests each, next eligibility **15:38:44.546 UTC**
and **19:40:01.359 UTC** respectively. No source was requested and neither runner
was restarted or stopped by this switch. Subsequent natural rounds and terminal
acceptance stay with parent-task monitoring; no additional feature or job.

Local receipt: `data/runtime/options-workbench-development/readonly-preview-sec-rejections-549fb29-20261011/switch-acceptance.json`.
SHA256: `a4428b7dd8a8db875f57d3456d9f9443c7643c3201b28cddb7b8850d6d25c447`.
