# Scenario Expected Value and Contract Fit v1

This stage connects saved plan versions and expectation snapshots to explicit
scenario assumptions and a descriptive contract comparison. It does not grant
trade permission, choose size, alter exits or create a pricing model.

## Use

In **Trade planner → Scenario & EV**, select an existing saved plan version,
prepare a set, add the required scenarios, preview and save. Probability inputs
are percentages, with up to four decimal places; no probability is prefilled.
All rows belong to the required scenario set. An incomplete set remains saveable
research and displays the missing inputs. Details contain event interpretation,
source attribution, clocks, whole-position proceeds, costs and limitations.

The saved-version list can reopen the original or prepare an appended revision.
An explicit link can attach the immutable reference to the matching unfrozen
thesis draft. Save that draft and use the original preview/Confirm & freeze flow.
Changing its terms requires a new scenario version. Frozen plans cannot acquire
a replacement reference. Later research never rewrites original decisions.

**Candidate comparison → Contract Fit** is collapsed inside the same section.
Existing Candidate checks also has an entry to it. Select a saved plan, an
existing quote and an explicit quantity; the comparison reads local evidence.
Blank quantity remains unknown. No market request occurs on preview or refresh.

## Calculation and evidence contract

- `ASSUMPTION_EV = sum(probability × net payoff)`. Validated EV stays `UNKNOWN`.
  No calibration is inferred from either a source label or a profitable trade.
- Probability provenance supports Owner assumptions, uncalibrated analyst views,
  historical estimates, calibrated-model labels and unknown. The calibrated
  label currently blocks calculation because no approved model is connected.
- Required probabilities must sum to exactly 100%; no normalization, prose
  conversion, equal weighting or remainder filling is performed.
- Gross payoff means USD proceeds for the entire explicitly declared quantity
  at the saved plan's time exit. It is not net profit or an ETF price. Net payoff
  subtracts premium, known fees and explicit slippage once. Missing cost/source
  evidence prevents displaying a net amount. Decimal arithmetic preserves exact
  contributions to twelve USD decimal places without floating-point summation.
- Owner-supplied and attributed historical payoff assumptions are supported.
  Unknown payoffs cannot produce EV. The existing Greek shock illustrations are
  not option-exit pricing: the deterministic-calculator label stays unavailable.
  Expiration proceeds cannot stand in for an earlier planned exit.
- The record binds plan ID/version, expectation snapshot ID/fingerprint,
  scenario-set version, selected saved quote (if any), copied source references
  and actual save time. Each row retains its probability clock and provenance.
- The existing bounded comparison store is reused: 500 records / 16 KiB per
  record, at most twelve scenario rows, no capacity increase. Exclusive saves
  and exact retries preserve originals. Recovery verifies fingerprints,
  references, plan basis and deterministic EV. A frozen reference is checked
  inside the existing ledger writer lock using its already verified snapshot.

## Contract Fit

Fifteen dimensions expose value, source time, status and reason: direction,
event/thesis horizon, DTE, delta, gamma, theta, vega, IV context, spread,
liquidity, quote freshness, premium/maximum loss, fees, event gap risk and exit
observability. There is no combined score or ranking.

Expiry coverage uses the existing reviewed calendar, including its close and
unknown-year boundary. Direction comes only from the saved single-leg plan.
Missing or mismatched contract identity cannot become a current comparison.
The current guidance evaluator supplies original freshness, event and candidate
blockers; no second freshness threshold is introduced. Stale quotes are labeled
`STALE_REFERENCE`; reported model Greeks remain historical references with
unknown independent Greek timestamps. Unavailable volume/open-interest context
is not filled from a different sample. Zero/crossed quotes produce no midpoint.

The unchanged risk engine receives the exact requested quantity. Guidance cost
declarations are per contract and are converted once to whole-position totals.
Plan quantity and debit ceilings are additional checks. Current-policy stop
economics are a comparison, never a replacement of the frozen plan's independent
stop/target/time/fact exits. No quantity is reduced to make a contract fit.

Original candidate/risk blockers, invalid quotes and an uncovered horizon remain
blocking. Greeks, IV, spread context without a newly approved threshold, and
uncertain future observation coverage remain informational/unknown. Existing
candidate spread/DTE/delta rules are still shown separately; the educational
image thresholds have not been enabled. PRE_EVENT retains gap exposure and the
closed-option-market warning. Calendar reopening is not a promised quote/fill.
On-demand review remains manual, conditional on a real eligible position and
explicit request; no continuous or opening monitoring was added.

## Actual use and validation

The existing employment research draft v3 and its existing expectation snapshot
were restored on the formal port 4173 workbench. The privately saved compatibility
record is `gld-employment-20261002-scenarios-v1`, saved at
`2026-09-20T22:16:44.813Z`; fingerprint
`sha256:43021e7c4c73be9a527883ffa4b15f9a1ee37d78a02ff1eca77ce18d547ac66b`.
It is `NOT_CALCULABLE`: probabilities, payoffs, explicit quantity and planned
exit are missing. No probabilities, prices, contracts or trades were manufactured.
Fit is `NOT_READY_FOR_CURRENT_COMPARISON`. A separate inspection of an existing
September 17 quote retained stale-reference and original event/risk blockers.
The ledger still contains zero registered trades.

The formal page saved, reopened and recovered the same fingerprint after the
backend restart. Desktop 1280 and mobile 390 px checks found no page overflow or
console errors. The same workspace and context-refresh setting were retained;
current public-refresh slots were already claimed before restart. No Host schedule
or source cadence changed. Private acceptance reference:
`data/runtime/options-workbench-development/scenario-ev-formal-receipt.json`.

The isolated arithmetic example uses probabilities 50/30/20%, proceeds
$200/$100/$0, premium $100, fees $2 and slippage $3. Net outcomes are
$95/−$5/−$105 and Assumption EV is **$25**. This is isolated test data only.
Forty focused cases cover missing probabilities/payoffs/costs, exact totals,
provenance, eight fit cases, cost scaling, protected API, recovery, immutable
references and browser request routing. Existing candidate, risk, thesis and
expectation regressions were also run. The final product-code verification
passed 5,003 checks with zero failures, including TypeScript, in 127,240 ms.
These are this stage's executed results, recorded in
[the stage status](status/scenario-research.json).

Failures encountered and corrected: nested ledger read under the existing writer
lock; omitted frontend route registration; a validation transcript initially
placed outside the ignored private log directory. The transcript was preserved
in the existing ignored development-log directory. Review also tightened net
payoff display when evidence is unknown and verified per-contract cost scaling.

## Scope, limitations and version save

Changes are limited to the deterministic projection, bounded store/API wiring,
planner/candidate UI, optional thesis reference validation and tests. No source,
model, pricing, sizing, account or order service was added. Stage-triggered market
calls, public reads and external model API calls are zero; USD cost is `UNKNOWN`.

Routine acceptance stays `PENDING_NATURAL_RUN`; first real targeted quotes remain
unverified. Frozen trend V1, historical conflicts, education status and capital
settings are unchanged. Future evidence and explicit Owner assumptions remain
necessary before this real draft can be a complete plan. Positive assumption EV
and Contract Fit do **not** create trade permission.

Rollback is a normal scoped revert of this stage, never a history rewrite. Keep
private scenario records and all original ledger evidence; older code will not
understand newly linked scenario references and must not be used to edit them.
No scheduler restore is implied by Git.
