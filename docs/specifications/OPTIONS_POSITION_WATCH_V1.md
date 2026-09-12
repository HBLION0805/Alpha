# Saved-quote position exit checks V1

September 12, 2026. Reviewed design for F06: reported fills can be reconciled,
but the Trade journal does not compare open positions with saved option bids
or show whether an original stop, target or time exit needs manual attention.

## Boundary and behavior

Add a read-only projection over the unchanged, independently reconciled manual
ledger and the latest saved snapshot capture. Only GLD/IBIT standard long options
are supported. Match symbol, expiry, option type, exact decimal strike and 100
multiplier; multiple matching instrument IDs are ambiguous. Never fall back to an
older favorable quote, merge origins, fabricate an Owner position or close one.

Owner-reported ledgers require HOST_MARKET_TOOL_RESPONSES; isolated synthetic
ledgers require SYNTHETIC_FIXTURE. Preserve capture path/hash, source and receipt
clocks. Use existing snapshot receipt checks plus current 60-second source and
underlying freshness, reviewed current session and a quote no earlier than the
last reported execution. Missing, stale, future, zero-bid or insufficient bid-size
evidence cannot establish an executable exit. Old bids may be displayed only as
dated reference prices; do not report current PnL from them.

For a usable reference, bid times remaining contracts times 100 is an illustrative
liquidation value. Total-trade PnL before future exit costs equals that value plus
the ledger's exact net cash flow, which already accounts for all reported buys,
partial sells and known fees. Unknown historical fees preserve null. An optional,
explicit total exit-cost assumption includes fees and adverse execution allowance
for selling the remaining quantity; subtract it once. It defaults to unknown,
is local preview only and is never a recorded fill, brokerage fee or global setting.

Compare the original per-share stop with the usable bid; compare the original
whole-trade net target only with the complete estimated full-liquidation net PnL.
Time exit can become due independently of quotes. Expiry-day/past-expiry unresolved
positions require manual review, never inferred exercise, settlement or loss.
Keep each check independent so stale prices cannot hide a due time exit. A price
or time threshold indicates manual review, not proof of a fill or guaranteed loss.

## Integration

Trade journal displays the projection, explicit unknowns and a per-position
cost-preview form. Edits clear only that preview; data reload and a newer response
cannot preserve a quote/cost result as if it were current. Use the existing
session/origin-protected local service for read-only calculation. No new polling,
background alert, Host identity, source call, enrollment or order is added.
Original ledger reports, paper results, lessons and automations are unchanged.

## Acceptance

Exercise full and partial positions, fees counted once, micro-dollar allocations,
unknown historical/future costs, stop/target/time conditions, no plan, expiry,
missing/ambiguous/wrong-origin quotes, same strike in different decimal notation,
put/call and expiry mismatches, current/source/receipt clock boundaries, sessions,
bid liquidity, corrections/voids and no mutations. Verify protected API and English
UI with isolated fixtures. The actual Owner ledger is empty; do not claim live
position monitoring acceptance or advance a real-price paper gate.
