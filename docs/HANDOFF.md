# Alpha Handoff

Date: 2026-09-06. Current scope: GLD/IBIT options on Robinhood.

## Latest Owner direction

The latest instruction continues toward real-price testing. The Owner confirmed
they have Robinhood only, with no options API or authorized historical file.
The local lifecycle/review/notebook is implemented; this delivery adds source
import, independent evidence history and a deterministic replay qualification
gate. See [current delivery](OPTIONS_MARKET_EVIDENCE_DELIVERY.md).

The Owner requested a more realistic premium stop, 1.5R-2R exits, broad
historical/news/geopolitical driver coverage and deletion of unrelated code.
The USD 1,000-to-USD 50,000 end-2026 target is recorded as an aspiration only.
Development, commits and pushes remain explicitly authorized.

## Delivered state

- Market evidence: documented Cboe DataShop CSV adapter, exact prices, nullable
  sizes, DST-aware interval times, current ingestion clock, source/usage metadata
  and replay-checked local imports. NO_REPLAY and zero real-data trades: no actual
  file is available and contract/calendar/availability/cost/fill-model gates remain.
- Local lifecycle: GLD/IBIT contract/quote inputs, frozen intraday plans, 14-45 DTE,
  modeled fills/exits, costs, reservations, unsettled proceeds, restart recovery
  and reviews. Quote inputs are synthetic or unverified imports; no strategy
  performance, learned trend weights or brokerage readiness is established.
- Risk v2: 20% research-default premium stop, 10%-25% comparisons, all-in cash R,
  0.5% current-equity planned risk ceiling, 5% allocation maximum and separate
  USD 25 full-premium stress cap. Net target 1.5R-2R; rounded indicative exit;
  unknown costs and uncalibrated 10% escalation blocked.
- Driver catalog: 16 families, 94 indicators, 34 primary-source references.
- Actual read-only refresh: six official feeds tested, 118 initial observations
  saved locally. Headline tags are candidates only; numerical drivers remain
  NOT_CONNECTED and no probability or trading permission is emitted.
- 292 unrelated files removed. Generic calendar validation extracted from the
  removed Daily Scan composition; reusable Twelve Data and history/AI/audit
  modules preserved. See [manifest](OPTIONS_FOCUS_DELETION_MANIFEST.json).

Local headline history lives under `data/runtime/options-driver-monitor/` and
is ignored by Git. The journal stores one linked refresh batch at a time and
rejects damaged history or an existing writer lock. Refresh is a one-shot
command. An external hourly Codex heartbeat (automation id: gld-ibit) is active
for this task; it requires the computer/app and this worktree to be available.
It reports meaningful related changes or source failures, not routine no-change updates.

See [current delivery](OPTIONS_MARKET_EVIDENCE_DELIVERY.md), [lifecycle specification](specifications/OPTIONS_LOCAL_TRADE_LIFECYCLE_V1.md)
and [machine status](status/current.json) for validation and exact boundaries.
Old milestone/test records remain historical; never report 3145 as the current
post-deletion test count.

## Next work

Obtain an authorized local file or read-only data entitlement, then qualify actual
GLD/IBIT option evidence and complete broker-specific risk/settlement,
then quantitative drivers, independent outcome evidence, calibration and UI.
Paper history is in `data/runtime/options-paper/`, excluded from Git. Never
rewrite accepted plans or quotes or report scripted outcomes as a strategy win rate.
No whole contract fitting the constraints means no trade.
Do not chase the 50x aspiration by increasing risk or pretending an AI confidence
score is an 80% option-outcome probability. No brokerage access or execution is
implemented.

Do not scrape Cboe/Nasdaq display pages or silently substitute Alpaca indicative
quotes for OPRA. Do not purchase subscriptions or access account credentials as
part of routine validation. Market imports live in a separate ignored journal;
the old paper journal and v1 output fingerprints must remain reproducible.
