# Additive saved-news date interpretation — October 11, 2026

The unchanged legacy feed parser leaves BEA EDT/EST and EIA EST publication fields
unknown. This delivery adds `WEEKLY_NEWS_TIME_INTERPRETATION_V1` to the current
Weekly plan source view. It interprets the original field alongside the original
parsed result, without rewriting receipts, old parsed values, freshness/coverage
counts, owner plans, historical reports, or any acquisition path.

## Scope and uncertainty

Only latest saved BEA, EIA energy and OFAC receipts are explained. The existing
reader first verifies receipt fingerprints, original bytes and exact legacy
`REFRESH_REPLAY`. Its parser and integrity checks are unchanged. Any reader issue
blocks the overlay. The snapshot already captured for the response supplies the
interpretation; no additional filesystem read, lock, write or network call is
introduced by the projection. Repeated GETs cannot alter stored interpretations
or original evidence; this version is an explicit derived display, not a newly
saved source assertion.

The strict interpreter requires a four-digit year, month, valid day, hour, minute,
second and explicit offset. EDT means UTC−4 and EST means UTC−5 literally, including
summer dates. It does not use permissive `Date.parse`, infer a year, repair weekday
conflicts, infer DST or borrow a receipt/body date. Invalid dates, duplicate or
conflicting fields, duplicate identities, equal-time competing latest receipts,
future publication and reversed update clocks stay unresolved. Comments, CDATA
body text and nested markup cannot manufacture publication fields. Unsupported
XML blocks the overlay without weakening the old reader.

OFAC item `pubDate` is treated as creation time, independently of content updates.
The body may contain newer information. The old creation clock cannot establish
that the entire body is stale, and body dates never replace it. Content update
clock remains UNKNOWN. Old publication-based coverage remains visible with this
explicit qualification and does not become fresh-news coverage.

## Offline replay of preserved originals

At **2026-10-11T09:52:11.967Z**, all **20** saved public receipts passed unchanged
legacy replay. **105** public/issuer receipt files and **25,907** protected files
retained their hashes. No source request was made.

- BEA: 47 original retained items now have explicit derived dates, all historical
  under the existing 72-hour context window. Latest literal
  `Tue, 06 Oct 2026 08:30:00 EDT` means `2026-10-06T12:30:00.000Z`.
  Original `publishedAt: null` remains. The separate missing-scheme link rejection
  is retained: 47 parsed, one rejected, original partial=true.
- EIA: 14 full dates interpret with literal EST, all historical. The retained
  `Fri, 09 Oct  09:00:00 EST` lacks a year and stays UNKNOWN; no 2001 default.
- OFAC: ten original creation dates are explicit, all content-update clocks
  remain UNKNOWN. No updated-body recency is inferred.

Local receipt:
`data/runtime/options-weekly-sources/news-time-offline-20261011/receipt.json`.
SHA256: `7126f728a54c9c8a73ee51b4cb231334a36c5d3257c1d3d9a01950c714f88b4d`.
Raw source files and operational receipts stay ignored/local.

## Validation and review boundary

Sixteen focused tests cover strict offsets/date components, missing years,
ambiguous/conflicting identities and dates, XML decoys, legacy corruption,
unchanged owner preview and coverage, snapshot isolation and HTML escaping.
Existing weekly-source (22) and refresh-health (14) tests pass. Full regression
passes **238 components, 6,013 tests, zero failures**. Static desktop/mobile
visual QA passes with exact 1440/390 viewport checks and no horizontal overflow.
See [status](status/weekly-news-time-interpretation.json) for hashes and host evidence.

The new UI renders the interpretation version, original literal field, original
parsed value, derived UTC/date-window classification, original receipt clocks,
hash and parsing gaps. It has no acquisition or runner controls. Static local
HTML is used for visual QA; no new preview server is started for this change.
The actual **4178 remains reviewed 15f9125** pending independent review of this
new code. Public and company processes retain their loaded implementations,
configuration, source sets, budgets, due times and identities. No resampling,
runner restart, frozen-experiment change or new feature scope is included.

Final host readback at **2026-10-11T09:55:20.8810975Z** confirmed unchanged process start times
for public PID 23512, company PID 7956 and 4178 PID 32464. Public remains WAITING
with eight requests, next eligibility 11:27:42.885 UTC; company remains WAITING
with zero requests, first eligibility 13:40 UTC. The live page does not expose the
new interpretation yet. These are separate operational facts, not date-parser
validation or a reason to restart either process.

## Independently cleared 4178 switch

Independent review cleared exact **d395281b7d1a65947ad695cb93c719c39f1aa398**
with no P2. The approved **http://127.0.0.1:4178/#weekly-plan** now serves its
1,509-file hash-pinned archive, PID **11476**, started **2026-10-11T10:02:00.36Z**.
All eleven original navigation routes, desktop/mobile dates and health panels,
read-only client/server guards and protected hashes passed actual-port acceptance.
No console, page, HTTP, network or external-origin errors were observed. Outbound
attempts remained zero. **25,907** protected files and **165** source/runner files
retained hashes. The archived legacy reader replayed all **20** public receipts;
old parser, refresh/replay and both runner modules match the preceding archive.
Frozen workspace remains clean at **2dabc114**. Temporary 4180 is closed and exact
15f9125 rollback remains available. Earlier pending-switch statements are history.

At **2026-10-11T10:04:43.3010440Z**, both runner start times were unchanged. Public remained WAITING
with eight requests and 11:27:42.885 UTC next eligibility; company remained WAITING
with zero requests and 13:40 UTC first eligibility. No source was requested or
runner restarted by this switch. Further natural rounds and terminal acceptance
remain parent-task observation; this delivery adds no feature or monitoring job.

Local switch receipt: `data/runtime/options-workbench-development/readonly-preview-news-time-d395281-20261011/switch-acceptance.json`.
SHA256: `4dc1637db2e7b6822a9974efd2195b2a9cc4e0071c986c6d35c742dec1b1ea88`.
