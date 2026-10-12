# Same-account option engineering continuation

The closed one-share stock simulation previously had no safe way to fund an
option segment without creating another initial-capital record. The new explicit
continuation reads and verifies the original stock start and two events, replays
the closed position, and binds a single option segment to that account and exact
parent tip. It does not reset capital, credit settlement, borrow, or change the
original three files. The current real option attempt remains blocked.

## Persistence and funds

All writes and recovery use the original parent account's
`.spy-engineering-writer.lock`. A permanent exclusive claim binds the input hash,
parent files and parent tip to `option-engineering-01` in the same account
directory. It is never released, even after NO_ENTRY or a closed fixture. A
different input cannot claim the same parent again. A crash after the claim can
resume only the identical frozen input. Atomic publication and journal ordering
reuse the existing isolated-journal primitives. Recovery repairs only matching
staging links for this segment; it does not rewrite the parent stock records.

Parent micro-USD amounts must be exactly cent-representable. Settled and
unsettled amounts are inherited independently, and unsettled proceeds cannot fund
entry. Reports separate parent P&L, segment P&L and cumulative account P&L. Unknown
residual exposure makes current funds and cumulative P&L unknown and keeps the
claim occupied. This is one bounded continuation, not a portfolio allocator.

## Frozen evidence and later quotes

The new version explicitly declares ENGINEERING_ONLY and research/strategy N/A;
it does not fabricate qualifying research or bypass the existing research path.
The plan contains no entry quote. The start must precede source acquisition;
events preserve their original batch, hashes, receipt, publication and application
clocks. Each event retains the original request, collector, prompt, raw Host JSONL,
stderr, capture and Host run record. The verifier checks all five ordered source
calls, exact arguments/responses, origin/run identity and persistence clocks;
relabeling a capture without its original execution bundle is rejected. A new real
start/application uses wall-clock freshness. The existing spread
window is retained: entry through T0+120 seconds, independent timed exit at or
after **T0+420 seconds**, not seven minutes after entry.

Contract, data entitlement, simulated product permission, costs and risk envelopes
must match the exact legs, account and clocks. Contract evidence must establish
standard unadjusted applicability; missing fields or an UNKNOWN adjustment status
reject start before claiming funds. A properly evidenced rule mapping is allowed
and stays attributed as such. Hashes do not authenticate a provider or broker.

The implementation reuses saved-batch preflight, snapshot freshness/session/size
checks and the spread economics engine. Debit must remain positive and less than
strike width; costs, spread limits and settled-cash checks remain. Saved-input-only
SPY normalization accepts its zero tick cutoff; the live collector's original
symbol scope is unchanged. The generic spread journal rejects continuation plans.
Missing exit quotes leave exposure open; a single-leg execution report latches an
unknown residual and never releases funds.

## Entry point and acceptance boundary

`npm run options:engineering-continuation -- --help` documents explicit start,
append and recover operations. This command does not collect data or send orders.
The development stage runs only TEST_FIXTURE_ONLY accounts under temporary roots.
It must not create the real account's claim or segment, update the pinned 4178
service, or obtain replacement contracts or quotes. A real attempt still needs
its unresolved external evidence and reviewed prospective protocol.

See [status](status/engineering-continuation.json) for implementation validation.
Fixture completion is not real option lifecycle acceptance. No source schedule,
strategy/risk threshold, CPI/15:50 task, challenge ledger, or public-push authority
is changed.

The dedicated acceptance suite contains 36 passing cases, including complete CDS
and PDS fixture lifecycles, a real two-process claim race, interrupted publication,
idempotent recovery, parent changes, unsettled-funds spending, missing contract
evidence, stale or incomplete quotes, and unresolved residual exposure. Independent
review passed after tightening the full Host bundle and every MCP event identity.
The preserved fixture originals replay exactly; they do not replace the stopped
real preflight. Full regression counts and evidence hashes are recorded in status.
