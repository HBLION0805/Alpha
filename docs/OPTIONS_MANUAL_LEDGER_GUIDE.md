# Registering and reviewing your completed option trades

This local ledger records information you provide. It does not access your
Robinhood account, submit an order or authenticate a broker confirmation.
The current owner ledger is `owner-manual-gld-ibit`; it initially contains zero
trades. Keep synthetic examples in a separate fixture ledger.

Tell the assistant the ETF, call/put, expiry, strike, quantity, actual execution
time with timezone, per-share execution price and total fee for each fill. Supply
the broker execution reference if available, not an account number or password.
An order ID shared by several partial fills is not a unique execution reference.
Unknown fees stay null. Supply the original plan if one exists; a plan entered
after a reported trade remains a retrospective declaration.

The assistant can prepare UTF-8 JSON without a byte-order mark under
`data/runtime/options-manual-ledger-inputs/`. Review the concrete record before
using it as evidence. An attached document hash is a local reference; its presence
does not mean the broker or the document contents have been authenticated.

## Registration and entry format

The following values are **format examples only**, not actual fills or a trade
recommendation. Replace them with your information before adding to an owner
ledger. You may set plan and activityReference to null rather than invent them.

```json
{
  "type": "REGISTER_TRADE",
  "requestId": "register-example-001",
  "tradeId": "example-001",
  "contract": {
    "symbol": "GLD",
    "expiry": "2026-09-18",
    "optionType": "CALL",
    "strikeUsd": "410.00",
    "multiplier": 100
  },
  "plan": null,
  "activityReference": null
}
```

```json
{
  "type": "RECORD_FILL",
  "requestId": "record-example-fill-001",
  "tradeId": "example-001",
  "fillId": "example-fill-001",
  "fill": {
    "executionSequence": 1,
    "executedAt": "2026-09-01T14:01:00.000Z",
    "action": "BUY_TO_OPEN",
    "quantity": 1,
    "pricePerShareUsd": "0.20",
    "feesUsd": null,
    "externalExecutionRef": null,
    "evidence": null,
    "exitReason": "NOT_APPLICABLE"
  }
}
```

The execution sequence gives the reported order within this trade; timestamps
must agree with that order. A later closing fill uses SELL_TO_CLOSE, its actual
quantity, price and fee, and an owner-reported exit reason STOP, TARGET, TIME,
MANUAL or UNKNOWN. Keep every partial fill. The system cannot infer an intraday
stop trigger from a sale price or daily close.

For a declared plan, provide declaredAt, maxContracts, maxEntryDebitUsd,
plannedRiskUsd, targetNetProfitUsd, nullable stopPremiumUsd, nullable
entryDeadlineAt/timeExitAt and thesis. All timestamps are UTC. The entry debit
diagnostic sums opening premiums and known opening fees within the trade; it
does not represent available brokerage buying power. Max contracts compares
peak concurrent reported quantity. The separate $50 diagnostic does not authorize
the trade. Plans and contract identity are immutable in v1.

An optional activityReference requires studyId, studyFingerprint and candidateId.
The append command verifies the original saved study and exact contract identity
before accepting the link. Missing research context does not prevent registration
with a null link.

## Corrections and duplicates

CORRECT_FILL takes a new requestId, the same tradeId/fillId, expectedRevision,
reason, and replacement containing the complete fill object, or null to void.
The first fill revision is 1. Every correction increments it; stale revisions are
rejected. All earlier payloads remain present and all later FIFO results are
recalculated. To fix a wrong contract identity, void its closing fills first and
then its opening fills, and register the correct trade separately with new IDs;
retain the original trade as an empty corrected record. Do not delete history.

Reusing a request ID with identical content is a no-op. Changing content under
that ID is a conflict. Active duplicate external execution references are
rejected. Identical-looking fills without distinct references are retained and
flagged for checking: real partial executions can look identical.

## Local commands

```text
npm run options:manual-ledger -- --verify owner-manual-gld-ibit
npm run options:manual-ledger -- --append owner-manual-gld-ibit data/runtime/options-manual-ledger-inputs/your-record.json
npm run options:manual-ledger -- --inspect owner-manual-gld-ibit
npm run options:review-desk -- --build owner-manual-gld-ibit your-new-snapshot-id
npm run options:review-desk -- --verify your-new-snapshot-id
```

The desk accepts optional `--chain <saved-board-id>` and
`--activity <study-id> <saved-report-id>` to show the original evidence together.
Each desk is an immutable snapshot. Build a new ID after entering new records;
old views do not silently refresh. The detailed JSON keeps FIFO matches, unknown
fees, all candidate lessons and corrections. Red flags require review, not an
automatic strategy change. If a saved event is incomplete or a writer lock
remains, preserve the files and investigate before entering further records.

Only single standard 100-share long GLD/IBIT options are supported. Expiration,
exercise, assignment, short positions, multi-leg trades, tax-lot accounting and
settlement cannot be reconstructed automatically. Open cost basis is not a market
value. Stop adherence, slippage, market causes and account balances remain unknown
without the corresponding evidence. A profitable recorded trade is not a measured
strategy win probability.
