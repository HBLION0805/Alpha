# Scheduled paper observations V1

September 10, 2026 UTC. Scope: connect explicit prospective V2 paper plans to
the existing bounded guidance collector and save their observed outcomes/reviews.
No orders, accounts, new tasks or continuous quote polling.

Enrollment is a separate immutable record, accepted before the decision time.
It binds a verified V2 registration fingerprint and ends five minutes after its
modeled session close. Cancellation appends a separate record; it never closes a
position or rewrites a plan. At most six overlapping enrollments are accepted.
Synthetic sources cannot enter the production Host tracking list.

Existing event-study contracts retain priority. Paper contracts consume remaining
places or share an identical existing identity inside six tracked IDs, 18 per ETF,
36 selected quotes and 24 calls. Capacity and identity conflicts are visible.
Do not silently increase these bounds or substitute an easier contract.

After the CLI records an actual capture, a bounded observation pass saves a
deterministic per-capture paper report for enrolled plans. Missing requested
contracts still preserve the triggering capture and no-entry/gap evidence. An
idempotent retry verifies the prior saved result. Source copies are bounded by
the trigger's recording cutoff, preventing a later retry from adding hindsight.
Every ordinary Host publication also finalizes expired observation windows using
only sources saved by their end. Missing exits stay unresolved. A paper failure
must not erase or prevent verification of the original market capture.

Read-only UI state shows enrollment, capacity, observation deadline and saved
automatic reports beside the existing plan/review notebook. Preview/freeze remains
separate from enrollment. Global fee settings and historical V1 reports stay intact.

Activation review found the existing gld-ibit file set to a 30-minute recurrence,
different from the previously authorized 28 daily wake times. Correct only this
existing task through automation_update, preserve all other fields and verify
the actual saved recurrence. Do not infer successful future runs from configuration.
Official operation reference: https://learn.chatgpt.com/docs/automations?surface=app

Acceptance: future/late/expired/cancelled enrollment, six-ID priority/overflow,
synthetic exclusion, captured/missing quote passes, full synthetic lifecycle,
idempotent retry and source cutoff, independent report recovery, UI and protected
API, original capture preservation, real prospective registration and observed
schedule evidence. First live-price completion remains pending genuine intraday
receipts; no calibrated signal or fill is inferred.
