# Event expectations and observed ETF prices

September 12, 2026. Daily guidance now displays saved GLD/IBIT last-trade
observations around selected BLS scheduled times and FOMC dates. The same view
is available in the existing Host brief and `options:guidance -- --event-reactions`.
This extends F03 interpretation without changing a recommendation or paper fill.

The current saved calendars supply recent events that the upcoming-only calendar
brief intentionally leaves out. Calendar receipt, failure and lag remain visible;
a later calendar snapshot is retrospective context. FOMC date-only listings,
cancelled and tentative events do not receive an invented timed reaction.

For each ETF, the comparison selects its latest eligible observation saved before
the scheduled event within 24 hours, then its latest observed price within each
30-/120-minute window. Exact source, equity-receipt, capture and storage clocks
are retained. Nanosecond boundaries, 120-second receipt freshness, duplicate
observations, conflicts and assessment cutoffs are checked. An overnight baseline
and late-stored post observation remain disclosed. Missing evidence stays unknown.

An attributed general outlook must be assessed and stored before the event to
appear beside its observed changes. Agreement is only same-direction evidence;
the hypothesis remains NOT_TESTED, cause NOT_ESTABLISHED, and option PnL unknown.
No release actual, consensus, surprise, qualified OHLCV, forecast or probability
is inferred. A current retrospective view cannot backfill a frozen paper plan.

## Actual saved-source result

Seven saved captures and eleven analyst notes were read without a source refresh.
The present schedules supply PPI September 10, CPI September 11 and date-only FOMC
September 15–16. Thirteen distinct ETF observations pass receipt checks across
the saved captures; one stale-at-receipt GLD observation is excluded. This does
not mean thirteen observations exist around each event.

For PPI, IBIT has a prior-evening baseline but no eligible post-event price. GLD
has no qualifying pre-event baseline. CPI has no eligible baseline for either
ETF. FOMC has no qualified intraday schedule. All twelve asset/window rows remain
without a numerical comparison; none establishes an event effect or paper fill.
The exact dated readback is in [the checkpoint](status/event-reaction.json).

The prior daily review recorded source recovery failures. This turn's current
workbench read recovers headlines, Treasury, BTC and both calendars successfully;
the earlier failure cause is not established or relabeled as repaired by this
feature. The latest brokerage capture is still September 10 00:44 UTC (September
9 evening New York). Both guidance assets remain WATCH and the Owner ledger empty.

## Validation and boundaries

The 29 focused tests cover signed and micro-dollar arithmetic, exact clocks,
partial/future/stale data, late receipts, duplicates/conflicts, prior-note selection,
date-only/cancelled/tentative events, UI escaping, old frame shapes, immutable
calendar recovery, Host/CLI parity and local module/state serving. Desktop browser
inspection verifies actual PPI/CPI/FOMC rows, missing observations and the wide
IBIT baseline without horizontal document overflow. All 4,481 tests passed across
170 validation components, including typecheck. The matched local service was
updated and its new event view verified; original background refresh remains
enabled. Exact validation and deployment clocks are recorded in the checkpoint.

Both overlapping preservation baselines (171 historical files and 16 current
files) and all three automation files are unchanged. Original guidance/rationale,
paper results, Owner ledger, fees, policies, schedules and source claims retain
their authority. No new market acquisition, retry, timer, enrollment, order, account access or
stored lesson is added. Ten workstreams remain 4 locally validated / 4 partial /
2 unvalidated, and all three real-price gates remain open.

See the [reviewed design](specifications/OPTIONS_EVENT_REACTION_V1.md).
