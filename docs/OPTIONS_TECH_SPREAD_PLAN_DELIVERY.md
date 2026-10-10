# Evidence-bound isolated spread plans

The spread preflight now feeds the existing isolated MOCK debit-spread lifecycle.
`npm run options:tech-spread-plan -- --preview INPUT` reads one complete saved V2
batch and eight explicit evidence envelopes. `--start INPUT --run-id mock-ID`
saves the reviewed plan through the existing exclusive, hash-chained journal.
Neither command appends entry. Subsequent explicit events use the existing
`appendMockSpread` / `recoverMockSpread` lifecycle. No market reads are added.

## Evidence and account boundary

The input `TECH_SPREAD_PLAN_INPUT_V1` carries `at`, mode, `records`, and exactly
one original `{id,path,sha256}`. Library callers supply original raw JSON instead
of path. Record kinds are STRATEGY_REQUEST, RESEARCH, COST_MODEL, CONTRACT,
DATA_ENTITLEMENT, PRODUCT_PERMISSION, ACCOUNT_FUNDS and RISK_LIMITS. They reuse
the existing raw bytes/hash, attributed origin/source/reviewer, receipt/review,
valid-through and verdict checks. Missing and invalid records remain explicit
blockers. Hashes establish local consistency, not provider authentication.

The prior request pins research, selection, cost, contract and account hashes;
it supplies IDs, parent IDs, conditions, timing, quantity and budget. Costs need
a pre-decision source and version. Contract multiplier, deliverable, exercise
style and tradability are explicit evidence, never fallback defaults. The only
supported lifecycle remains synthetic, quantity-one CDS/PDS, standard 100-share
American contracts, same-day entry/exit and ATOMIC_TWO_LEG_ASSUMPTION. A coherent
batch with nonzero leg source skew cannot enter this stricter existing model.

`TECH_MOCK_DEBIT_SPREAD_V2` binds original raw bytes, all evidence, four per-leg
open/close actions, cost version, parents and manual conditions to the plan.
`TECH_MOCK_SPREAD_BATCH_EVENT_V1` binds later quotes to exact saved source fields
and the plan. No clocks are rewritten and no separate captures are stitched.
Condition text is retained for manual review; only the existing explicit-close
and time-exit mechanisms evaluate exits. Terminal maximum loss is a payoff/cost
model, not a guarantee for early close, assignment or residual exposure.

Only settled cash minus existing reserves funds entry. Initial unsettled cash
is separately retained and excluded from buying power and modeled P&L gains.
MOCK permissions never populate real account confirmations: real funds,
permissions and entitlement stay UNKNOWN. REAL_SAVED_SOURCE_REPLAY cannot create
a lifecycle. The pure preview checks hypothetical economics without recording
fills; starting still requires a later explicit append to model entry.

## Validation and retained limits

The isolated synthetic CDS and PDS demonstrations exercise batch normalization,
preflight, evidence-bound plan, explicit entry, independent later batch exit and
journal recovery. Each models -$9.20 net P&L; neither is a market observation.
Old real AAPL/TSLA same-strike call/put originals remain blocked, unchanged and
local. No real strategy request, account evidence or new source batch is invented.

The focused suite covers evidence omissions, clocks/hashes, costs, account
shortfalls, unknown contract details, tampering, source synchrony and persistence.
Existing V1 lifecycle behavior remains separate. Private originals, generated
plans and recovery receipts remain ignored. No overnight/assignment validation,
residual disposal, production Paper, two-week win-rate or live execution claim
is made. The existing Host still has no hard per-run call-count budget: its
collector's five-call bound and post-completion excess-call rejection differ.

The next engineering step is to review this bounded bridge independently and
specify an authorized real evidence route; genuine account/funds/permission and
fresh two-strike evidence remain prerequisites for any separately authorized
real Paper work. No strategy, risk, schedule, CPI workspace or challenge ledger
changes are included. See [status](status/tech-spread-plan.json).

## Event replay integrity correction

Creation and replay now reuse complete saved-original preflight, including intent
version, request/acquisition ordering and publication visibility. Recomputed hashes
do not bypass these checks. A bound journal evaluates at original recordedAt,
without rewriting the earlier quote receipt. Replay before publication fails;
invalid exits do not publish an event, calculate a close or release modeled funds.
The shared journal retains quote-time behavior for all existing unbound events.
The regression suite includes creation/replay consistency for future publication,
malformed intent and permissions, with retained open exposure and unknown P&L.
Independent audit remains pending; this correction adds no real source authority.

## Time roles and retry correction

Bound event validation now always receives the actual frozen plan. A provider
source time may be after the decision and before the collection request; request
time is never substituted for decision time. Freshness, acquisition ordering and
complete-original publication checks remain independent.

| Time | Role |
| --- | --- |
| Research / decision | Prior frozen plan and quote-after-decision boundary |
| Collection request | Acquisition ordering only, not a quote lower bound |
| Provider source | Individual freshness and independent later observation |
| Quote received | Original quote clock and strict journal observation ordering |
| Original recorded | Earliest visibility of the complete saved original |
| Journal recorded | Persistence audit metadata, not simulated quote time |
| Explicit evaluation | Visibility upper bound; earlier recovery still rejects later originals |
| Duplicate retry | No new event; verify the full chain and return its latest evaluated state |

Append loads and verifies the complete hash chain before duplicate handling. An
identical historical event returns a fresh calculation over the full verified
history at its latest original-availability time. Conflicting content fails;
duplicate requests cannot bypass semantic validation of later records. New events
still require increasing quote receipts and valid originals. No source clocks are
rewritten. The matrix covers early/middle/latest retries, hash conflicts, corrupt
start/chain records, rehashed invalid later originals, out-of-order new events and
explicit early recovery. This is bounded engineering evidence, pending independent
audit. REAL_QUOTE_PAPER development is paused and excluded from this repair.
