# Options prediction → outcome evidence loop v1

Delivered September 20, 2026 (New York). This connects the existing options
planner, manual ledger, Prediction Log and Alpha Journal. It creates no trading
permission, automatic execution, source request, strategy revision or learning.

## Use the existing workbench

1. In **Trade planner → Trade thesis**, complete the original plan and optionally
   expand **Prediction evidence to be locked with this plan**. Enter an explicit
   ETF direction, author, catalyst and assumptions. The original thesis supplies
   the forecast horizon and invalidation; no confidence or strategy ID is invented.
2. **Preview frozen plan** shows the exact expectation, scenario/Assumption EV,
   original Contract Fit, thesis, forecast, source/receipt clocks and saved-record
   references. Existing **Confirm & freeze plan** authorizes the linked forecast;
   a second confirmation is not required. Saving an ordinary draft creates none.
3. **Trade journal → Evidence loop** shows independent prediction and execution
   states. Fills and corrections still use the existing manual ledger. No actual
   or simulated execution is created by this connection.
4. After the original horizon, preview independent outcome evidence and explicitly
   confirm it. Exact numeric events reuse the original identity/unit/period/vintage
   checker. Qualitative direction and accuracy remain attributed Owner assessments.
   Preview and confirm prediction review separately from ledger profitability.
5. A closed reported trade with a reviewed prediction can preview a
   **Post-trade review**. Only explicit confirmation finalizes the existing Alpha
   Journal entry. Evidence buttons open exact original records; an unavailable
   original is never replaced with a newer favorable version.

## Authorities and recovery

- The small adapter is `scripts/lib/options-evidence-loop.mjs`; it reuses
  Prediction Log create/submit/lock/outcome/review and the existing NDJSON
  repositories. The original AI-based contract could not express a manual plan
  without fabricating a model, confidence, score and strategy. An optional manual
  origin plus explicit nullable fields supplies that minimum gap. Legacy IDs and
  AI validation remain compatible. No Research Lab or Strategy Versioning engine
  was added or changed; saved research references are reused, and the absent
  options strategy-version link remains unavailable.
- The immutable intent references expectation/source comparison/scenario records
  and original thesis. Original Contract Fit is evaluated once from the same
  saved inputs, retained in that intent, and not recomputed as pre-entry evidence
  after the result. Prediction IDs include exact frozen-plan provenance.
- Plan freeze and Prediction append are separate writes. Failure leaves the frozen
  plan intact and shows `PREDICTION_EVIDENCE_PENDING`. **Resume the same prediction
  write** is idempotent and allowed only before reported entry and the original
  result window. Duplicate content returns the existing ID; conflicting content
  fails closed. Complete appends interrupted before lifecycle history can resume.
  Truncated/corrupt files and foreign locks are not automatically repaired.
- Outcome/review/journal previews have no authority. Explicit saves retain a
  bounded immutable intent before the authority append, allowing exact retries.
  Journal previews bind the current ledger head. Later ledger corrections preserve
  the original review and show current profitability separately. Later reported
  entry preceding the prediction lock marks current accuracy unscorable.
- Manual Ledger remains the fill, fees and P&L authority. The adapter reads its
  existing result and candidate diagnostics, without a second P&L engine. Existing
  paper Trade Review and Outcome Audit remain separate and unchanged.
- Accuracy and profitability are independent axes: all four correct/incorrect ×
  profitable/unprofitable combinations are supported. Partial, unknown, break-even
  and no-trade remain mixed/unscorable. No-trade predictions may be reviewed but
  produce no P&L and no closed-trade Journal entry.
- Journal stores observations, interpretations, uncertainty and follow-up with
  references, not copies of whole plans or trades. Candidate attribution remains
  `NOT_ESTABLISHED`, `approvedKnowledge=false`. No lesson, strategy proposal,
  activation, rollback or learning loop is automatically generated.

## Verification and actual compatibility

The saved `gld-employment-20261002` draft remains **DRAFT / NOT_CREATED**, with the
explanation that the plan is not frozen. No production prediction, fill, outcome,
review or journal was created for acceptance. Historical records without a link
remain `PRE_ENTRY_PREDICTION_UNAVAILABLE`; no backfill or migration was performed.

The existing protected local API and isolated synthetic fixtures cover the full
chain, both divergent prediction/P&L cases, no trade, unknown costs, exact event
clocks/identity, duplicate/conflicting requests, partial writes, ledger changes,
legacy recovery and original-reference navigation. See
[machine-readable acceptance](status/evidence-loop.json) for final verification.

Browser checks used the actual workspace at port 4173 in existing saved-data mode
and separate disposable fixture workspaces. Before acceptance no workbench
process was running. External context refresh was disabled only for these test
processes to honor the zero-read requirement; installed Host/configuration was
not changed. The test processes were stopped after verification, restoring the
prior nonrunning state. This does not claim that an ongoing production service or
automatic context refresh has been accepted. Desktop and 390px mobile checks
covered the actual draft, frozen/legacy records, Journal preview/finalization,
reload recovery, both divergent matrices and exact original details.

Failures found and fixed: review confirmation lost on rerender, long references
overflowing mobile layout, and an old snapshot-paper test harness lacking DOM
dataset. A coverage guard was corrected to exempt only the two existing,
independently validated Jev developer-experiment tests; all product tests remain
required. One direct Node test invocation omitted the repository's TS loader;
the supported npm/tsx command passed. Earlier failed logs are retained privately.

## Scope, cost and limitations

Market calls **0**, public-source reads **0**, external model calls **0**. There
were no eligible unresolved Jev decisions: Phase 2 samples/calls **0**. Billed USD
cost remains **UNKNOWN** without billing evidence. No new subscription, timer,
background service, source, database or runtime router was added.

The 09:00/15:50 schedule, source qualification, frozen trend V1, capital/risk and
independent routine/targeted-quote acceptance states are unchanged. Real future
prediction outcomes still require actual evidence and Owner review. This is a
local append-only evidence connection, not broker authentication or a guarantee
against manual filesystem alteration. Unknown confidence/strategy/cause remain
unknown. Prediction accuracy does not imply profitability; profitability does
not validate a prediction; a post-trade review does not change strategy.

Code scope: prediction contracts/validation/statistics/exports, manual-plan
reference and draft fields, the local adapter and protected API, existing
planner/journal UI, focused fixtures/tests and product validation registration.
Private research, raw inputs and runtime logs are excluded from Git. Reversal
requires a normal reviewed revert of this stage; retain all immutable evidence
and references, and never delete records to simulate a rollback.
