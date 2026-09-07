# Five-source journal context reconstruction v2

Task OPT-CONTEXT-CUT-2, September 7, 2026. Reviewed implementation scope.

## Purpose and ownership

FOMC date calendars are collected but absent from the four-source receipt-time
reconstruction. Add them to an opt-in v2 context so a later review can distinguish
what the local system had received from what was learned after a proposed
decision time. No actual decision, trade, source authenticity or availability at
durable append time is established by this reconstruction.

The existing v1 engine and default command remain unchanged in meaning and
output. A new TypeScript composition reuses v1 for headlines, Treasury, BTC and
BLS, and independently projects FOMC through its existing report engine. Keep
the four original components byte-equivalent for the same inputs/clocks.

## Temporal and integrity rules

Validate the complete current FOMC history before selecting records whose
receivedAt is at or before the cutoff. Preserve order, equal-clock records,
failures and reversions. Never select by request start, meeting date or page
update date. An invalid later record blocks the FOMC component even if the
earlier prefix could parse; other components remain independently available.

The fifth storage check follows the four v1 checks, is no earlier than cutoff,
and is no later than construction. Reuse the bounded existing FOMC journal
reader and compare file bytes before/after recovery. Missing stores stay absent;
busy/unsafe/corrupt stores retain fixed errors. No raw source or error text enters
the output. Date-only meetings stay date-only: do not infer a decision instant,
14:00 release, event cancellation, current values or a trading risk window.

The v2 context has its own version and hash, includes the unchanged v1 context
hash, selected FOMC-prefix/report hashes, and remains stable after valid later
appends or changes of reconstruction clock. A separate artifact hash includes
actual recovery/construction clocks. An empty prefix means no local receipt,
not an event-free or safe trading period. Future cutoffs fail before file reads.

## Command and validation

Extend the existing command with `--at-v2 <canonical UTC timestamp>`; `--at`
still invokes v1 and never opens the FOMC store. Output JSON only. No source
refresh, automatic persistence, host change, quote call, order, simulated fill,
risk adjustment, probability or NO_REPLAY change.

Verify cutoff equality and one-millisecond exclusion, delayed receipts, earlier
page dates, failed/empty prefixes, date-only semantics, corrections, valid
future-append invariance, invalid future-history isolation, schema/clock checks,
read-only restart, corrupt/busy/missing/link handling and v1 compatibility.
Record actual before/at-first-FOMC-receipt reconstructions and compare old v1
context and protected artifacts. Run relevant tests and the aggregate bundle;
save delivery evidence and commit/push under standing Owner authorization.

Allowed changes: new v2 composition/tests; existing cutoff CLI/tests; package
and validation registration; this specification, delivery and focused current
documentation. Source parsers, repositories, original report versions, journals,
quote Host and v6 automation remain unchanged.
