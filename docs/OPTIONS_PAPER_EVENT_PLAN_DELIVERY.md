# Event-linked paper plans

September 12, 2026. Paper validation can now attach a major event from an issued
guidance record, its PRE_EVENT/POST_EVENT phase, an original hypothesis, required
entry confirmation and invalidation to the existing explicit entry/time-exit plan.
This connects F03/F04 declarations to F05 and later reviews without changing the
option quote/fill engine or inventing a current trade recommendation.

## Behavior

The optional registration V2 envelope copies the exact issued guidance bytes and
recomputes its original report. The selected contract, capture, active settings,
event identity and prior source clocks must match. Old registration V1 and paper
plan/report V1/V2 results remain unchanged when the attachment is absent. New
reports retain event context and an untested-hypothesis candidate notebook note.
Isolated recovery does not need the original guidance or source directories.

New attached plans must be prospective. PRE_EVENT closes strictly before the
event; a date-only meeting uses its earliest named New York date conservatively.
POST_EVENT requires an exact calendar time and entry strictly more than 30 minutes
after it, matching the existing stabilization boundary. It does not prove that
the release actually occurred. Other known major events within the holding window
block the attachment. Existing session, expiry, allocation and cost checks remain.

In Event research → Paper validation → Create an assumption-only paper plan,
expand **Attach the event hypothesis and original guidance**. Select the event
and phase, complete the three declarations and explicit UTC entry/exit times,
then preview. The UI shows New York times, original guidance blockers and source
dates. Edits invalidate the preview. Freezing retains the copied context; it
neither enrolls observation nor creates an order. Existing fixed capture windows
are displayed, and delivery remains subject to actual Host operation.

Browser verification found that the plan's input named `id` shadowed the native
form ID property, preventing draft updates and preview clearing. Paper input and
submit routing now read the HTML ID attribute. Field changes disable freezing,
clear the old preview and survive a saved-data reload. This was verified in the
browser and covered by a regression exercising the actual draft handler.

The quote-only model does not evaluate qualitative entry/invalidation text,
market reactions, event causality or a trading edge. Every result explicitly says
**hypothesis validation NOT_TESTED**, including modeled profits. Its PnL tests
only the already declared quote-and-time mechanics. The mistake notebook carries
that limitation as a candidate process note, not an approved strategy rule.

## Actual evidence and remaining work

An isolated synthetic linked lifecycle completed entry, exit, review and recovery,
retaining NOT_TESTED. A separate read-only preview used the existing IBIT October
9 $44.50 call and date-only September 15–16 FOMC guidance with hypothetical
September 14 09:50–10:00 entry and 15:45 time exit, all New York. That preview is
an engineering example, not a bullish view or an enrolled plan. It has zero fills,
NO_ENTRY / WAITING_FOR_COST_ASSUMPTIONS, and original NO_TRADE guidance. Its stale
reference prices remain stale; no fresh brokerage read was made.

Validation: 90 focused paper tests and all 4,425 integrated tests passed across
168 validation components, including typecheck. The production UI displayed the
event/source linkage, unknown-cost/no-fill result and NOT_TESTED; changing the
invalidation disabled freezing. Reload retained the draft, and discard cleared it.
No production Freeze or Enroll action was performed. Two preservation baselines
(171 historical files and 16 current files, with overlap) and all three automation
hashes remain unchanged.

No production registration/enrollment, actual trade, source or automation change
occurred. The three real-price gates remain open and workstream totals remain
4 local / 4 partial / 2 unvalidated. Next work is eligible future data and a current
attributed decision, followed by a prospectively chosen observation plan. Prose
conditions still need independently observed confirmation before they can be
tested as a signal. Do not backfill the expired September 10 entry.

See [specification](specifications/OPTIONS_PAPER_EVENT_PLAN_V1.md) and the
[validation and operational checkpoint](status/paper-event-plan.json).
