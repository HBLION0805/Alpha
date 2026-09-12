# Saved-quote position exit checks

September 12, 2026. Trade journal now connects recorded open GLD/IBIT positions
to the latest saved option capture and the original stop, target and time exit.
The existing fill ledger, paper models and all stored outcomes remain unchanged.

## What became usable

The read-only checks require an unambiguous matching symbol/expiry/type/strike
and multiplier, the correct source origin, valid receipt/session evidence, current
option and ETF clocks within 60 seconds, a quote after the last reported execution,
a positive bid and enough displayed bid quantity. Old prices are explicitly dated
references; they cannot establish current exit value or a reached price target.
The latest capture cannot fall back to an older favorable quote.

Remaining bid value plus exact recorded net cash flow gives the whole-trade PnL
before future exit costs. This counts buys, partial sales and their reported fees
once. A separate optional total exit-cost assumption subtracts the remaining fees
and adverse execution allowance once. Historical or future unknown fees stay null.
The original whole-trade target is compared only when all required costs are known
under that assumption. No global settings or actual fee records are changed.

Stop, target, time and expiry checks remain independent. Time exit can become due
even with missing, stale or unreadable quote evidence. Expiry-day and past-expiry
positions remain unresolved until genuine reported fills or corrections change
the ledger. A reached reference asks for manual review; it is not a confirmed exit,
a continuously observed path or a guaranteed fill.

The English Trade journal displays source clocks, quote identity, partial-close
accounting and an optional exit-cost preview. Changing its cost clears the old
result. Reload clears calculated previews while retaining cost text. A changed
ledger rejects a pending preview; new quote provenance appears with the resulting
calculation. The existing protected local service handles the preview without
saving a record, refreshing sources or calling a broker.

## Evidence and limitations

The isolated fixture holds two remaining GLD calls after a reported partial sale.
At its synthetic bid, gross remaining value is $300 and whole-trade PnL before
future costs is $119.95. An explicit $1 remaining exit-cost assumption yields
$118.95 estimated whole-trade net PnL; clearing the cost restores an unknown net
target. These are test amounts, not Owner positions or profits.

The Owner ledger is still empty. Actual deployment verifies the empty-state
integration only; no live held position or real-price complete paper run is
claimed. New and existing tests cover both ETFs, calls/puts, partial fees and
micro-dollar boundaries, corrections/voids, price/session/origin gaps, API
protections and UI edit/reload behavior. See the [checkpoint](status/position-watch.json)
for final validation and unchanged-record readback.

All 27 focused checks and 4,452 integrated tests passed across 169 validation
components, including typecheck. Browser checks verified cost preview/edit/reload,
source identity and the actual empty ledger. The matched local service was
restarted with the final code; existing hourly receipts were complete beforehand.
The 171-file historical and 16-file current preservation baselines overlap;
both and all three automation files remained unchanged.

This improves F06 locally; it adds no timer, proactive alert, market call,
observation enrollment, account access or order. Source collection retains its
existing cadence. Real position freshness and timely Owner action are unverified.
The first actual-quote paper lifecycle and F08 strategy evaluation remain open.

See the [reviewed specification](specifications/OPTIONS_POSITION_WATCH_V1.md).
