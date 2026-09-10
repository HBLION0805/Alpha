# Robinhood snapshot paper workflow

September 9, 2026. The Owner requests completion of the three remaining
real-price paper gates. This unit implements the missing local adapter and
end-to-end audit path; it cannot certify evidence that the source does not expose.
It supersedes the cancelled opening-window assumptions in the earlier
OPTIONS_ROBINHOOD_PAPER_QUALIFICATION_V1 design. No source schedule or orders change.

## Scope and model

Read original verified guidance capture artifacts. Bind raw capture hashes,
instrument/chain identity, quote-refresh/receipt/record clocks and selected equity
price/clock. Preserve nanosecond quote precision in the outer record; never
manufacture independent side or quantity timestamps. Keep the original capture,
paper-account and market-evidence NO_REPLAY records unchanged.

The new fixed RH_SNAPSHOT_ASSUMPTIONS_V1 profile models a single purchased GLD or
IBIT option only. It uses a later received valid ask for entry, a later valid bid
minus declared slippage, rounded down to the applicable legal tick, for exit, explicit entry/exit fees, whole quantities and
the saved owner allocation-only policy. No partial fills, margin, exercise,
settlement inference, probability or quantity increase. A stop is evaluated only
at observed snapshots and fills at the modeled available bid, not the stop price.
Missing data leaves an open position unresolved; no terminal forced fill is added.

Plans freeze actual declaration time and a separate declared decision time. A
historical decision is retrospective and cannot become a prospective trade.
Entry must follow the decision and source clocks, not merely a later file import.
Use chronological receive-time order; repeated/contradictory source clocks and
gaps are diagnostics, never interpolation. Request fingerprints bind the preview to the active settings. Only cent-exact raw prices and
tick-aligned calculations are supported. Require fresh source observations and
aligned underlying at each historical receipt. Current staleness is separate
from historical usability. This is a bounded regular-session model, not exchange
calendar or contract-deliverable certification.

## Three separate gates

1. **Source qualification** checks contract identity, clocks, prices, quantities,
   underlying alignment, costs and remaining external evidence. The reviewed
   current MCP schema lacks independent option-side/size clocks, full deliverable
   and source-specific retention/entitlement certification. Public platform
   articles are context, not evidence that those fields exist in MCP. These
   gaps are fixed reviewed profile facts, not user-entered approval booleans.
2. **Adapter** may be implemented and locally tested while source qualification
   remains open. Explicit assumption-only simulation can exercise mapped data
   without being labeled a qualified execution model.
3. **End-to-end** saves frozen plan, copied source lineage, event/cash ledger,
   outcome and candidate review, then independently recomputes on recovery.
   NO_ENTRY and OPEN_UNRESOLVED are valid results, never completed trades. A
   synthetic or assumption-only closed result does not close the qualified gate.

The frontend shows all three statuses, exact missing inputs, raw clocks, modeled
fills and outcome/review history. Paper records are separate from owner fills;
candidate lessons describe evidence/process, not proven market causation.

## Acceptance

Test entry/target/stop/time exits, losses beyond stops, no-entry, unresolved exits,
unknown costs, stale/unmatched/zero-size data, nanoseconds, duplicate/conflicting
source updates, provenance mutation, future observations, retrospective timing,
cash reconciliation, immutable save/restart, original-record preservation and
desktop/mobile frontend. Assess current real captures through the same adapter.
Report actual-data gates honestly; never substitute test counts for qualification.
