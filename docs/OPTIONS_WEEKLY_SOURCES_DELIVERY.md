Current follow-ups: [independent-review corrections](OPTIONS_WEEKLY_SOURCE_REVIEW_FIXES.md) supersede the original scope/freshness counts below; [finite process mode](OPTIONS_WEEKLY_RUNNER_DELIVERY.md) is a separate optional extension.

# Weekly source integration

## Stage 1 — October 11, 2026

Independent development branch `codex/weekly-source-integration-20261011` starts
from `2dabc114`. No deployment or change to the existing 4178 preview.

The weekly desk now adds current unsaved source coverage beside its original
immutable plan snapshot. Explicit ignored root configuration avoids silently
choosing another checkout. BLS/FOMC journals are verified without a writer lock.
The projection retains all six official and three focused feed scopes, source
health, receipt paths/fingerprints and original clocks. Technology/SEC research
appears as attributed background; it creates no earnings date or trading authority.
Publication after original receipt is rejected even at a later assessment time.

Read-only local acceptance at `2026-10-11T03:32:16.179Z` found four BLS events for
October 12–16 but stale October 3 receipts; FOMC had zero matching meetings on
the same stale basis. Thirty-one non-fixture research records covered sixteen
symbols, with no verified current-week event count inferred. Other categories
retain explicit incomplete scope. Private original view is ignored locally.

Validation: TypeScript typecheck; existing weekly tests 5/5; new source tests 6/6;
workbench tests 61/61. Initial restricted-loopback test failed with EACCES, then
passed with authorized local test access. No production source or ledger writes.

`test:options-tech-status` also passed 51/51 with the required local test permissions.

## Stage 2 — bounded public refresh

`npm run options:weekly-sources -- --refresh` explicitly reads the existing BLS
and FOMC endpoints once. Optional `--sources` accepts only the existing six
official feeds and official Fed speeches/EIA feeds in addition to those two
calendars. CoinDesk remains readable as historical context; this new command
does not fetch it. `--workspace` selects the isolated destination. `--view` and
all page GET/reload operations read saved evidence only. No service or timer is
installed, and there is no automatic retry.

Every attempted endpoint retains HTTP status/selected headers, actual request
and receipt clocks, raw bytes/hash and deterministic parse result. Bodies above
512 KiB retain a bounded prefix explicitly marked incomplete and cannot qualify.
The local reader is bounded to 500 receipts/64 MiB. Per-source exclusive claims
and a one-hour minimum interval prevent concurrent/repeated attempts. An
unfinished claim requires review and is never automatically deleted or retried.
Source errors retain the previous event's original successful receipt, while
latest health remains failed. Exact display duplicates retain all receipt links;
changed content stays separately visible. No publication clock becomes event time.

Actual run `weekly-sources-20261011T033844Z` requested ten existing official
endpoints between `2026-10-11T03:38:44.254Z` and
`2026-10-11T03:38:45.588Z` (October 10, 23:38 EDT). All ten returned HTTP 200
and passed their existing parsers. This is a successful bounded retrieval,
not proof of future availability, comprehensive scope or source-content accuracy.
Fresh BLS material yielded four October 12–16 events; FOMC was successfully
checked with no meeting matching that week. There was no source retry.

The actual-source view and desktop/mobile browser receipts are ignored locally
under `data/runtime/options-weekly-sources/`. The existing page displayed current
coverage, original response hashes, HTTP results and exact receipt references,
with zero page/console errors and no horizontal overflow. Thirty-one non-fixture
technology references still represent historical background, not current-week
earnings coverage. Opt-in relative original paths/hashes are available to the
local weekly projection; the default technology view keeps its privacy contract.

Validation: full bundle passed 229 components / 5,890 counted tests, zero failures.
After final provenance/failure-bound checks, focused weekly/source tests passed
20/20, technology privacy/status 51/51, typecheck and desktop/mobile verification
passed again. The bundle counter does not include node:test-only source counts;
the focused counts are reported separately, not added to claim market acceptance.
All 25,907 files in the existing preview preservation baseline still match. The
frozen checkout remains clean at `2dabc114`, and the original technology workspace
still has its original 23 dirty entries. Existing 4178 and all schedules remain
unchanged. No Paper/account/order/capital gate advanced.

Remaining limitations: complete company earnings/conference/options calendars
are not integrated; existing research has uncertain weekly applicability;
headline feeds are bounded context, not comprehensive news coverage. Owner plan
review and any later preview deployment remain separate.
