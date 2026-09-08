# Daily options guidance v1

Task OPT-DAILY-GUIDANCE-1. Owner authorization September 8, 2026: implement the
module and frontend together, refresh news every day, read GLD/IBIT market data,
and provide event-aware advisory plans with stops and targets. No automatic
orders, account reads, paid data, new login, or automatic development reports.

## Reviewed design

A separate market-only Host collector samples up to three listed expirations
14–45 calendar days away and the nearest three strikes per side per expiry.
The selection uses returned instruments, never fabricated identifiers. Bound
pagination, calls and runtime, retain partial coverage and sanitized failures.
Preserve exact response/request/receipt clocks. An off-hours smoke is retained
as old option evidence, never a live entry. Existing full-chain close collection
and frozen activity cohorts remain unchanged.

A pure TypeScript engine composes these snapshots, saved official calendars,
headline source health, separately connected Treasury/BTC context and optional
attributed analyst notes. Five distinct official completed-session equity closes
support a descriptive 3-versus-5-session trend; require chronological, recent
weekday observations without conflicting same-date prices. Fewer observations
mean INSUFFICIENT_HISTORY, never an inferred trend from a single overnight quote.
A 0.3% separation and latest-close confirmation describe direction, not a tested
edge. Month-scale trend is explicitly unavailable.

Candidate checks include market session, same-day quotes no older than 120 seconds,
underlying alignment, listed standard 100-share contracts, positive bid/ask sizes,
spread <=10% of ask, abs(delta) 0.35–0.70, expiry 14–45 days away, and existing
unchanged normal-mode retail feasibility. Costs remain unknown until declared.
A candidate may be CONDITIONAL_RESEARCH only; unknown trend, event windows, source
failures or stale/partial inputs produce WATCH or NO_TRADE with specific reasons.
No calibrated probability, 10% allocation, brokerage eligibility or account
enforcement is implied. Do not force a cheap far-OTM selection.

Use existing economics for the 20% illustrative premium stop and net 1.5R–2R
targets. Show whole-contract cash risk, full-premium stress and cost uncertainty.
Stop triggers are indicative, never guaranteed fills or loss ceilings. Before an
official major event (24h) wait; for timed releases also wait 30 minutes afterward.
Date-only FOMC entries remain gated through their final calendar day; do not invent
a release time. Unknown calendar coverage blocks an event-qualified plan.

Keep market captures, analyst interpretations, settings and issued recommendations
in separate exclusive bounded files under ignored runtime storage. Hash the exact
inputs and recompute every issued report. Reading the UI must not issue recommendations
or fetch providers. Show current recomputation separately from immutable issued history.
Use original manual ledger reviews for actual owner-reported results; recommendation
records are not fills. Do not convert hypothetical gains into verified lessons.

The seventh English frontend page shows GLD/IBIT direction, event posture, fresh/old
clocks, a bounded shortlist, indicative stops/targets, every blocker, analyst
support/opposition/invalidation, source coverage and saved recommendation history.
Cost assumptions can be explicitly declared through a protected same-origin endpoint.
Auto-read local evidence every 60 seconds only while visible and no drafts/dialogs
are active, preserving the existing ledger workflow.

## Recurrence and scope

Reviewed implementation refinement: public sources also run through a fixed
local service in the workbench process, with an hourly/day exclusive claim shared
with the Host. This avoids requiring model usage for each public refresh, without
introducing a broker connector or credentials. It has bounded subprocess output,
timeouts and independent receipts. It stops with the process and does not install
an operating-system startup task. The existing Host remains necessary for market
tool access and attributed analyst updates. Preserve all missing quote IDs in
current views even when a source returns null; original raw capture/normalization
records and the initial pre-analysis smoke remain independently recoverable.

Update only the existing gld-ibit heartbeat after local acceptance. Public headlines
refresh hourly, every day; retain the five original 09:00 context flows. Bounded
market reads at 09:50, 12:50 and 15:50 New York on eligible sessions. Keep 16:20
full-chain closes through September 16. Hourly context issues an event-aware view;
market-time views include fresh quotes when available. No claim of an always-on
broker socket, exact scheduler timing, or operation without an awake online host
and available account allowance. Mark missed slots, do not backfill.
At final close restore v6 first as previously required, then install the new
ongoing guidance fields; preserve original restore snapshots and study artifacts.
Notification preferences belong in the automation fields, not its prompt.

## Acceptance

Pure engine: direction/insufficient history, stale and mismatched quotes, unknown
costs, event boundaries, long-option cash arithmetic, budget and uncertainty gates.
Storage: exclusive saves, strict bounded JSON, unsafe paths, hash/recompute failure,
current-versus-issued clocks and restart recovery. Host: only allowed tools, bounded
calls/pagination, unmodified source replies and visible failures. UI: all seven
pages, responsive layout, source freshness, draft-safe auto-read and no order route.
Run focused tests, strict typecheck, aggregate validation and actual browser QA.
Record live smoke honestly; no completed market-session outcome is required or invented.
