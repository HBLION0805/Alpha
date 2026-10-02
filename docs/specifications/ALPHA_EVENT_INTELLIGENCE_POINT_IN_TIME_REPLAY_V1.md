# Alpha Event Intelligence & Point-in-Time Replay V1

## Scope

V1 has exactly three product deliverables:

1. One scheduled-event case.
2. One unscheduled-event case.
3. One Replay Console that can reconstruct what Alpha could know at any selected time.

A narrow pre-event state recorder is supporting infrastructure for the unscheduled case, not a fourth product surface. Option-structure expansion is paused during this milestone.

## Core principle

Analysis order and collection order are different. Professional news, official sources, market data, calendars and pre-event state are collected in parallel. The analysis layer may then compare observations with frozen expectations, verify or correct facts, inspect market reaction and update a thesis.
## Point-in-time invariants

- Evidence is visible at replay time T only when Alpha's own `receivedAt <= T`.
- A historical decision is visible only when `generatedAt <= T`.
- Every historical decision binds `evidenceCutoffAt`, input evidence IDs, decision version, rule version, model version and thesis version.
- Every input evidence record used by a decision must have been received no later than that decision's evidence cutoff.
- A decision generated after T is hidden even if all of its inputs were already known before T.
- A decision recomputed today is a separate artifact and never replaces a historical decision.
- Replay must remain reconstructable from frozen artifacts without rerunning today's model.

Provider timestamps are evidence, not the replay authority clock. `sourcePublishedAt` and optional `vendorReceivedAt` may use a different clock or precision. Missing vendor timestamps remain null rather than being inferred.
## Evidence semantics

Observation, interpretation, hypothesis and market observation remain separate records. Corrections supersede prior evidence without rewriting it.

Supported evidence kinds in the first foundation are:

- EXPECTATION_SNAPSHOT
- PRE_EVENT_STATE
- SOURCE_OBSERVATION
- CORRECTION
- INTERPRETATION
- HYPOTHESIS
- MARKET_OBSERVATION
- SOURCE_STATUS

For scheduled events, consensus, single forecasts, model estimates, market-implied expectations and owner expectations remain distinct. Revisions first observed at release time are new evidence and cannot mutate the frozen pre-event expectation snapshot.
## Evidence completeness versus thesis state

Evidence completeness and thesis state are independent dimensions.

Evidence completeness:
- COMPLETE
- PARTIAL
- INSUFFICIENT

Thesis state:
- MAINTAIN
- DEGRADE
- INVALIDATE
- UNEVALUABLE

Missing or stale evidence must not automatically produce MAINTAIN or INVALIDATE. The UI must be able to show a prior valid thesis state while the current evidence is insufficient to evaluate a new change.
## Invalidation rules

Narrative invalidation conditions are not sufficient for V1. A numeric invalidation rule must bind:

- rule ID and thesis version
- definition time
- metric
- exact source
- comparison operator and threshold
- observation window
- required observation count
- observation interval
- each numeric observation's `observedAt` and Alpha `receivedAt`

A numeric observation cannot enter an as-of evaluation before its own `receivedAt`. The required observations must satisfy the declared cadence exactly in V1; gaps or off-cadence samples return `INSUFFICIENT_DATA` rather than being silently treated as persistence.

Changing a condition creates a new rule/thesis version. Historical acceptance criteria are immutable.

The first engine returns TRIGGERED, NOT_TRIGGERED or INSUFFICIENT_DATA. It never converts a rule result directly into a trade.
## Market reaction and causality

Replay preserves ordering without claiming causality.

If price movement is observed before Alpha's first received headline, the page must show that ordering. The replay view uses `PRICE_LEADS_NEWS`, `NEWS_LEADS_PRICE`, `SIMULTANEOUS_WITHIN_CLOCK_RESOLUTION` or `ORDER_UNKNOWN` only as chronology labels. A later headline must not be described as the cause unless separate evidence supports attribution.

Cross-asset observations must retain source time, session and data-quality context. Stale real yields, sparse premarket equity prints and live 24/7 crypto data must not be merged into a falsely precise composite score.
## Acceptance cases

### Scheduled case

A real prospective scheduled event must have a pre-event expectation snapshot frozen before release. Replay must demonstrate:

- no future evidence leakage
- release observations and corrections remain separate
- original decisions appear only after their generation time
- market observations are ordered by Alpha receipt time
- missing fields stay missing
- thesis changes point to pre-declared conditions and evidence

Synthetic data may test software but cannot satisfy market acceptance.
### Unscheduled case

A real prospective unscheduled event requires a pre-existing state record captured before the event. A snapshot reconstructed after the event is not accepted as pre-event evidence. V1 stores these observations independently under `data/runtime/options-event-intelligence/pre-event-state/`; recording time is the actual save clock and never refreshes older source clocks.

Replay must demonstrate:

- pre-event thesis/scenarios existed before the shock
- first market move and first received news preserve their actual order
- official verification or later correction does not overwrite earlier observations
- insufficient source coverage is explicit
- no numerical consensus is invented for an event that had none

Historical material without prospective pre-event state may be labeled LIMITED_RETROSPECTIVE_REPLAY only.
## Replay Console

Without reading a technical report, the page must answer:

1. Before — what was known beforehand?
2. First Seen — what did Alpha receive first?
3. Verified / Corrected — what was later confirmed or changed?
4. Market — how did observed assets react and what data was missing or stale?
5. Decision — what historical decision actually existed at this time?
6. Why — which evidence and rule/model/thesis versions produced it?
7. State Change — why was a thesis maintained, degraded, invalidated or unevaluable?
8. Missing — what could not be assessed?

The time slider is an as-of visibility control, not a backtest convenience.
## Explicit non-goals

V1 does not:
- add new option strategies
- auto-place orders
- infer absent expectations
- claim a news headline caused a price move
- label PRICED_IN or SELL_THE_NEWS as objective facts
- manufacture vendor timestamps
- compare paid-feed speed without synchronized same-event collection
- use a consumer web subscription as a machine API without permission

Execution authority remains false.
