# Exact underlying prices in snapshot paper V3

Reviewed September 17, 2026, following the Owner's request to continue the daily
decision milestone. A new actual capture reproduced the unresolved exit and code
inspection identified a source-conversion defect: fractional-cent ETF last trades
become null in the legacy integer-cent adapter. UNDERLYING_UNALIGNED combines that
failure with clock failures. A six-second source difference is not its threshold;
the existing age limit is sixty seconds from the option receipt.

## Bounded implementation

- Add an explicitly versioned V3 paper plan/report. Preserve the exact source USD
  string for the underlying, validated to six decimal places with integer micro-USD
  arithmetic and the original positive/max-price bounds. Do not round the ETF,
  substitute its bid/ask, or relax source clocks.
- Keep option premiums, strike/tick checks, fees, cash, allocation, entry/exit
  conditions and the sixty-second freshness checks unchanged. Distinguish invalid
  underlying prices from missing/future/stale underlying clocks in V3 diagnostics.
- Dispatch source mapping, registration, observation and recovery by frozen plan
  version. V1/V2 outputs and original files must recover unchanged, including the
  September 17 rehearsal. Never relabel a corrected retrospective replay as its
  original prospective result.
- New frontend drafts use V3; show the model version and exact underlying price.
  Existing V2 drafts/plans remain V2. Expose a read-only precision explanation for
  legacy source failures, alongside original generic blockers.
- Existing event attachment and enrolled Host identity bounds apply to V3. No new
  recurrence, account/order capability, market tool or continuous poll is added.

## Acceptance

Test fractional-cent underlying input without changing cent-only option prices;
invalid/missing/zero/over-bound prices, independent clock failures, legacy output
identity, copied-source recovery, V3 observation/enrollment and frontend labels.
Verify current real-source diagnosis separately. A future V3 rehearsal must be
registered before new entry and independent exit observations. No synthetic or
retrospective result satisfies the active real-quote milestone.

## Prospective verification registration

The Owner's continuation registered `pipeline-precision-ibit-20260917` at 14:01
New York, before its 14:05–14:10 entry window and 14:14 time exit. It uses the
already tracked IBIT October 16 $43 put, one contract, $2.10 entry limit, $0.10
maximum spread, $0.01 exit allowance and the unchanged dated fee/20%/net-2R
assumptions. Two bounded user-triggered captures in this conversation provide
entry and independent exit opportunities; no recurrence or frozen V2 plan is
changed. An ineligible quote remains a failure, never an invented fill.
