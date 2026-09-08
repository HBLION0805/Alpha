# Event phase research v1

Status: reviewed for implementation, September 8, 2026.

Owner request: continue the proposed before/after event comparison, using the
working GLD/IBIT Robinhood market reads and developing the frontend together.
This first implementation uses the existing GLD/IBIT universe, the recommended
scope in the optional unanswered clarification. SPY, 0DTE execution and schedule
changes are not inferred.

## Ownership and purpose

An independent, prospective research desk consumes verified saved guidance
captures. It compares PRE_ONLY, POST_ONLY and COMBINED for one declared event.
These are quote-reference experiments, not actual fills, a stop-path replay,
daily guidance overrides or permission to trade. Existing paper, manual, activity,
market-evidence and schedule stores remain unchanged.

## Frozen experiment

The server supplies the actual registration clock and resolves one future timed
event from the existing calendar. The owner declares a name, PRE contract,
POST call/put alternatives on one underlying, four future observation windows,
and a minimum post-event underlying move in basis points. Settings are frozen
from current local declarations; contract identities are copied from one
verified saved guidance capture. Each phase uses
one standard long contract. All windows are frozen before PRE entry starts.
PRE entry and exit finish before the release. POST entry begins at least 30
minutes after release and after PRE exit, with a later exit window. Both phase
exit windows must finish before their selected contract expiry date. Entries
outside the current 14-45 DTE research policy remain blocked.

Each target window lasts 20 minutes. The first usable saved snapshot in that
window is selected deterministically, with source and actual receipt/recording
clocks inside the window. Registration and receipt cutoffs prevent later imports
from being treated as timely observations. Conflicting equal-clock observations
block the window. Missing intervals stay WAITING or MISSED. No interpolation,
backdating, future selection or replacement of an earlier usable snapshot.
Quotes later than the recorded receipt instant remain unusable, including within
an ambiguously rounded Host second. This is more conservative than capture
retention and does not resolve the original independent side-time evidence gap.

The POST rule compares its underlying with that same underlying in the selected
PRE-exit snapshot: above the frozen threshold selects the frozen call, below it
selects the frozen put, otherwise NO_SIGNAL. This is a sparse-price reaction
rule, explicitly not a VWAP, candle trend, surprise-value or calibrated model.

## Risk and outcomes

Reuse the original retail-feasibility engine and frozen settings, preserving
whole-contract, fee, spread, cash, allocation and full-premium stress checks.
Freeze an event loss allowance of 0.5% of declared equity and an event full-loss
stress allowance of 2.5%, matching current baseline limits without expanding them.
In COMBINED, prior modeled losses consume the event allowance; gains do not
increase it. An unresolved first phase blocks the second. Prior reference exits
do not establish settled cash; do not credit sale proceeds to buying power.
The three modes are separate counterfactual accounts, never three concurrent
positions or enforced brokerage limits.

Reference P&L uses entry ask and later exit bid, multiplier 100, and frozen
declared round-trip costs. Unknown costs retain unknown net results. Blocked
phases may display price evidence, but do not contribute fabricated accepted
profits. Stops/targets are diagnostic thresholds only: sparse samples cannot
establish the first crossing, an exit fill or a missed stop. Every phase, skip,
missing observation and data/risk failure remains in the report. Candidate
lessons concern observable process facts; no institutional cause, trade win,
approved knowledge or automatic strategy change is created.

## Persistence and UI

Use exclusive checksummed registration records and report snapshots beneath
ignored data/runtime/options-event-research. Recovery validates and recomputes
the copied plan and copied observations; source changes cannot rewrite a saved
report. GET is read-only; POST uses existing loopback/session/body protections.
Research frame recovery includes all saved dates up to its 1,000-capture limit;
it does not inherit the guidance display's 60-day cutoff. Exceeding a bound is an
explicit failure, not permission to silently discard earlier evidence.
Create requests carry stable IDs for repeat-save recovery. No source refresh,
external request or brokerage operation occurs in a frontend route.

The existing Host source reserves priority for up to six distinct active-study
contracts. It rechecks their metadata in current instrument responses and retains
at most 18 IDs per ETF, 36 total, 24 calls and eight instrument pages per ETF.
Extra tracked expiry dates share those existing bounds; exhaustion or unavailable
metadata remain explicit gaps. Registration refuses a seventh active identity.
Tracking ends after the POST exit window. No schedule is added or modified.

Add an English Event research page with a registration form, original event and
quote clocks, PRE/POST observation status, three-mode comparison, shared risk
diagnostics and candidate lessons. Preserve drafts during reloads and show
missing components explicitly. Existing routes and mutation forms remain intact.

## Acceptance

- Meaningful deterministic tests: time/identity/expiry validation, unknown costs,
  stale/future/late-import/conflicting quotes, no-signal, missing endpoints,
  first-observation selection, shared-loss exhaustion, non-recycled proceeds,
  reference arithmetic and candidate-only lessons.
- Storage and HTTP tests: corruption, repeat IDs, changed requests, original
  copies, no-write reads, origin/session guards, UI escaping and draft handling.
- Fresh authorized GLD/IBIT capture and independently verified local recording.
  Register at least one future event experiment from actual saved contracts;
  never invent its future result or relax budget gates to obtain a trade.
- Browser desktop/mobile inspection, focused suites and aggregate validation.
- Save delivery evidence and limitations, then commit/push under standing Owner
  authorization. Keep the ten workstreams and six real-price gates unchanged.
