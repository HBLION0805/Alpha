# Public macro context and prospective inflation benchmarks v1

Owner continuation, September 9, 2026: implement the next rates/USD/event-evidence
step with frontend parity. This is a dedicated source expansion under that
request. It does not resume opening collection or automated development.

## Source contracts

Three fixed anonymous HTTPS GETs, each <=512 KiB and 12 seconds total, no redirect,
credentials, registration or paid API: Treasury current-month nominal par yield
XML (2/5/10/30Y); Fed H.10 current weekly table (broad dollar, USD/EUR, JPY/USD);
Cleveland Fed inflation-nowcasting page (monthly and annual CPI/core CPI/PCE/
core PCE). Keep exact fetched source, actual request/receipt/record clocks,
source hashes and deterministic parsed results. An old source period remains
old even after a fresh read; no source publication time is fabricated.

Retain original Treasury real-yield parser outputs. Export its unchanged bounded
XML tree helper for the new nominal schema; no rewriting real-yield history.
H.10 release date is date-only; daily columns precede it and the table has weekly
publication lag. Broad USD is not DXY. Cleveland values are model estimates,
not official actuals or survey consensus; blank cells stay null, not zero or an
actual release. MM/DD update labels have no independently known year/time.

Store each independent batch exclusively under a new runtime namespace. On
recovery reparse raw source and verify hashes. Failed source attempts preserve
the last successful snapshot as historical evidence, with failed latest health.
Bound directory scans and reject symlinks, path escapes, corrupted and ambiguous
records. As-of selection uses actual recorded/received clocks, not source dates.

## Collection and integration

Add independent `macro-daily-<New York date>` context claims after 17:00 New York,
including catch-up later that date. Preserve all old slot names/source sets and
Host scheduler fields. This timing can include end-of-day yields and that day's
nowcasts; it is not release-time or intraday monitoring. Existing claims prevent
duplicate attempts. Sources also have an explicit one-shot CLI for an authorized
source check; do not silently retry failed scheduler claims.

The workbench, context export, Host brief and gold framework read the new data.
Show source dates, current/latest-attempt health and previous known data. Do not
subtract mismatched-date real/nominal yields. A same-date par-yield difference is
only a descriptive par-curve spread, not a fitted breakeven or pure expectation.

## Event benchmark evidence

Provide deterministic comparison of a saved nowcast cell with an Owner-reported
official actual after release. Require matching period/metric/unit, a benchmark
record saved strictly before the release, a nonfuture release time, and a BLS or
BEA HTTPS source URL consistent with metric. Save exclusive comparisons with
copied source references and actual recording time. Recompute on read. Owner
reported actuals remain unverified; no official number is invented. This is
model forecast error in percentage points, never survey-consensus surprise.
PPI is unsupported by this model. Preserve previously saved comparisons.

The frontend can preview then save the exact comparison with idempotent request
identity. No benchmark value, current time or authority comes from a caller's
assertion that a forecast was known earlier. Fees, original settings, order
authority and qualification gates remain unchanged; the preceding capital-plan
cancellation remains a separate pending implementation.

## Acceptance

Test schema/units/nulls, duplicates, year rollover, release/receipt clocks,
malformed/oversized sources, bounded transport, independent failures and restart,
as-of and prospective comparisons, tamper/path/idempotency boundaries, scheduler
claim preservation, API safety and desktop/mobile UI. Verify actual new source
reads and original frozen artifacts, run relevant tests/typecheck/aggregate,
commit and push under standing authorization. Document remaining DXY/intraday,
consensus, actual-release automation and qualified option-data gaps.
