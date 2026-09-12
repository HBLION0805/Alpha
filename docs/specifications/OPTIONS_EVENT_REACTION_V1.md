# Saved ETF observations around scheduled events

Task: F03 event expectations versus observed market response. Scope is a read-only
addition to Daily guidance and the existing Host brief, using saved sources only.
Reviewed before implementation on September 12, 2026. Existing engines own trade
dispositions, frozen reports, paper fills and risk settings; none change here.

## Contract

- Recover the current saved BLS schedule and FOMC date intervals; show selected
  major events from seven calendar dates before today through seven after today.
  Preserve cancelled/tentative status, calendar receipt and lag. Current schedule
  evidence is retrospective context, not proof a release occurred or its timing
  was known in advance. No actual/consensus or surprise is inferred.
- Recover verified original guidance captures (up to the existing 1,000-record
  bound) with the exact equity receipt, and at most 240 saved analyst notes. Do not
  alter default research frames or issued report fingerprints.
- Only HOST market frames qualify in the Owner view. An explicit synthetic origin
  may be used by isolated tests. Evaluate each ETF separately. A price requires a
  valid positive micro-dollar decimal, source time at/before its equity receipt,
  receipt-to-source age at most 120 seconds, receipt at/before capture, capture
  at/before storage, and all those clocks at/before assessment. Retained source
  prices are last-trade observations, never executable bid/ask or OHLCV.
- Before a precisely timed event, select the latest source observation within
  24 hours, with its complete capture saved strictly before the event. After it,
  show the latest eligible observation strictly after the scheduled instant and
  through each fixed 30-/120-minute horizon. Open windows are provisional. Exact
  nanosecond boundaries, duplicate source observations and contradictory prices
  at a single source instant must not create false comparisons. A conflict blocks
  that asset/event comparison rather than falling back to a favorable value.
- Show exact dollar and rounded percentage changes, actual gaps before/after
  the scheduled time and sample spacing. A wide/overnight baseline is explicit;
  the change is not an isolated event effect, a range, a technical confirmation,
  option PnL, fill, forecast, trading signal or calibrated probability.
- Date-only and cancelled/tentative events have no timed comparison. Missing
  baseline/post observation is unknown, never zero. Future observations cannot
  backfill a past assessment. Additional same-window scheduled events are listed
  as potential confounders; absence does not establish complete coverage.
- Show only an attributed analyst note assessed AND stored strictly before the
  event and no more than 24 hours old at the scheduled time. Its bias is general
  context, not automatically an event-specific hypothesis. Matching price direction
  never validates it: hypothesis remains NOT_TESTED and cause NOT_ESTABLISHED.

## Product and acceptance

Daily guidance displays event time/status, source clocks, both ETFs, pre-event
view, baseline and each post window, numerical change or exact missing reason.
Expandable evidence includes selected capture paths, receipt/storage clocks and
exclusions. The Host brief and an offline `--event-reactions` command share the
same projection. Reader failure is isolated from original guidance and visible.

Test boundary clocks, partial/future/stale/missing sources, repeated/conflicting
observations, both ETFs, signed/zero/micro-dollar changes, retrospective notes,
date-only/cancelled/tentative schedules, open windows, confounders, safe rendering,
old fingerprints and read-only recovery. Inspect actual saved-source output and
browser UI; keep synthetic results outside production. No source reads, retries,
timers, enrollments, account/order routes or lesson writes are added. First real
price paper gates and workstream completion counts do not advance.
