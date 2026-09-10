# Owner allocation policy: remove legacy loss caps

September 9, 2026. The Owner explicitly directs removal of the old risk rules,
following cancellation of the old capital plan with a retained $100 minimum.
No further loss-limit clarification or approval is required for this change.

## Active behavior

Append a new saved setting with budget version OWNER_ALLOCATION_ONLY_V2,
$100 minimum / $500 maximum per trade and $1,000 declared total equity. Preserve
the latest declared cash, costs, premium-stop and net-R assumptions. Remove the
legacy 0.5% planned-loss and $25 full-premium caps from current guidance,
candidate checks, planning, cost comparisons and newly registered event studies.
The old probability-based 5%/10% allocation and event loss/stress thresholds do
not apply under the new version. Never infer an 80% win probability or increase
quantity to satisfy the minimum. Do not change the retained premium stop / net-R
scenario calculations or the configured target ceiling.

Limits removed means null/not enforced, not zero, unknown, infinity, or a hidden
replacement cap. Keep planned loss, full-premium exposure, fees/slippage and
whole-contract calculations visible. Retain allocation, declared cash/equity,
price/tick/size, cost, data freshness, session, direction and event-evidence
checks. This is an advisory configuration change, not a broker transaction,
source qualification, calibrated signal or automatic order authorization.

## Versioning and integration

Inputs without a budget and OWNER_TRADE_BUDGET_V1 inputs keep byte-equivalent
original outputs. Preserve old settings, reports, candidate snapshots, frozen
research plans, original paper journals and manual-ledger records. Legacy
calculators remain available solely where their original input version requires
them; their retained code must not silently enforce a cancelled cap on V2.

New settings and active forms propagate V2 through save/preview, candidate-to-
planner transfer, resets, cost comparisons and new event declarations. Blank
budget fields in V2 are invalid and cannot fall back to legacy rules. V2 minimum
cannot be below $100. Older saved inputs continue to reconstruct their original
policy without upgrading. New event comparisons retain explicit shared loss
accounting and non-recycled cash, but have no legacy event loss/stress threshold.

Update the frontend and Host guidance wording with the policy version. Historical
analysis may mention old caps; preserve it as dated interpretation and explicitly
label the current policy so old prose cannot be mistaken for active settings.
Do not change source routes, scheduler fields, market/account access or charges.

## Acceptance

- $100/$500 boundary and costs/whole-contract checks; a valid $100/$200 scenario
  can pass arithmetic without the removed caps, while independent blockers stay.
- Null costs, bad quotes, cash/equity shortfalls and unsupported inputs still fail.
- Version propagation, saved settings/restart, all frontend paths, new event
  comparisons, candidate snapshots and old-version recomputation.
- Preserve hashes of prior settings, issued reports, frozen studies and ledger.
- Desktop/mobile UI, focused suites, strict typecheck and aggregate validation.
- Activate once at actual time, issue and verify a current view, commit and push
  under the Owner's standing authority. Actual source gates may still yield WATCH.
