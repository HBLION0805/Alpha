# Prospective option activity study v1

Status: implementation specification reviewed before coding, September 7, 2026.
Owner approved developing candidate follow-up and reviews as possible future
research evidence. No trade, account access or automatic strategy change.

## Question and boundary

Do the already observed ACTIVITY_REVIEW_FILTER_V1 candidates have more favorable
subsequent long-option reference returns than nearby below-filter contracts,
after explicit assumed costs? This is a prospective follow-up of retrospectively
selected September 4 activity, observed on September 7. It is not a historical
backtest, institution detector, execution simulation or proof of an edge.

Reuse the unchanged chain parser/recomputation, fingerprints and safe exclusive
storage. Keep the original observation-only protocol, 14–45 DTE paper engine,
paper account, reviews and notebooks unchanged. This separate study supports the
short-dated contracts descriptively; it does not qualify them for paper trading.

## Frozen design

- Register against one verified baseline board before September 8 15:45 New York.
  Actual registration and durable receipt clocks must both precede this cutoff.
  Preserve exact baseline bytes and its assessment clock. Recompute on recovery.
- Retain every flagged baseline contract, including September 18 comparison
  expirations, expired/unaffordable/unmatched cases. Do not add later winners.
- Select controls without replacement, visiting candidates in the chain engine's
  stable symbol/expiry/type/strike/ID order. Require same symbol, expiry, type,
  quote-refresh date and ITM/ATM/OTM category relative to a valid same-date,
  noninterpolated underlying close. Nearest strike wins, then lower strike, then
  ID; distance at most 3% of candidate strike. Require complete peer-screen
  eligibility and known positive two-sided prices/sizes for control selection.
  Missing underlying reference or no eligible control remains explicit. This
  does not match implied volatility, spread, participant identity or all risks.
- Entry reference: September 8 close only. Primary exit reference: September 9
  close. Secondary exits: September 10, 11, 14, 15, 16, declared in advance, with
  each measured independently from the same entry (not a compounded account).
- Require source quote on the declared date, 15:45–16:15 New York inclusive;
  actual capture/receipt after 16:20 and before 18:00 on that date, nonfuture
  source clocks, standard active tradable 100-share identity, positive uncrossed
  bid/ask and at least one displayed contract on both sides. Require expiry
  strictly after each reference date. Thus no invented expiry settlement or
  same-day-expiry fills. This is a closing-reference window, not synchronized
  official closes or a real-time quote freshness qualification.
- One hypothetical long contract: entry Ask, exit Bid. Exact decimal arithmetic.
  Zero-extra-cost spread-only benchmark; illustrative base costs of $0.50 fee
  plus $0.01/share adverse price allowance per side; stress costs of $1 fee plus
  $0.02/share allowance per side. These are sensitivity assumptions, not verified
  Robinhood fees/fills. A nonpositive exit after allowance is unavailable.
  Show separate $50 all-in entry affordability against the Owner's $1,000/5%
  limit. Preserve all cases and predefined affordable-pair subset separately.
- No daily-high/low fills, intraday stops, 1.5R/2R targets, Greek attribution or
  causal success explanations can be inferred from daily snapshots.

## Outputs and persistence

Pure engine returns every candidate/control and date/cost outcome, exact USD
reference changes, return basis points, missing reasons, paired differences,
per-case symbol/expiry identities, separate symbol/expiry-cohort summaries and
descriptive positive/negative/flat counts.
Denominators and all gaps stay visible. Multiple contracts and horizons share
market shocks; contract count is not independent sample size. September 18 is
reported separately from the requested through-September-16 expiry cohort.

CLI freezes an exclusive study payload and post-write receipt; verifies hashes,
clocks and complete recomputation; reads only canonical close board IDs from
the existing saved close store; persists immutable, independently verifiable
report packages with copied source bytes, input hashes and candidate lessons.
No-input reports are valid waiting states. Repeated identical input state is a
verified no-op; newly available evidence produces a new artifact. Missing
scheduled boards stay missing; malformed or tampered boards fail rather than
being silently removed. A previously absent board supplied late is labeled late
recording and cannot masquerade as contemporaneous knowledge.

Candidate lessons describe evidence gaps, adverse outcomes, costs and comparison
limits. They never approve rules or alter existing trade lessons. The scheduled
runbook may invoke only this offline analysis after its normal close capture,
and after final-day v6 restoration. No new schedule or market request.

## Acceptance and decision rule

Test known wins/losses/cost erosion, unmatched controls, expired/missing/stale/
future/zero-size/crossed prices, identity changes, source ordering, forbidden
future registration, exact cents, output integrity, safe paths, partial writes,
restart reconstruction and repeated updates. Run the full existing validation
bundle and verify protected artifacts unchanged. Save the actual frozen cohort
before the first window; zero future closes means zero actual outcomes.

Even a positive primary comparison remains a candidate finding. Independent
future samples, execution/cost qualification, dependence-aware evaluation and
out-of-sample validation are still required. Always emit validatedEdge=false,
winProbability=null and executionAllowed=false. The three open real-price paper
gates and ten-workstream acceptance totals do not advance from this subsystem.
