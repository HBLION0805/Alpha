# Owner-reported option ledger and review desk v1

Specification reviewed before implementation, September 7, 2026 New York.
Dispatch: OPT-MANUAL-LEDGER-1; current configured model/reasoning, no delegation;
medium/high complexity, one focused implementation and validation session. No
paid service or data cost. Allowed files: new manual-ledger contracts/engine/CLI,
tests, offline review renderer, fixture/template, validation/package registration,
runtime ignore rules and narrowly related architecture/status/operation documents.

## Ownership and scope

Owner approved manual trade registration/reconciliation, plan-versus-execution
reviews and a consolidated saved review surface. No broker calls, order tools,
automatic orders, source refresh or automation change. Preserve old paper,
research, activity and source journals and their original readers/fingerprints.
Reuse safe exclusive storage, deterministic fingerprints, strict JSON/clock
validation and independent existing board/study verifiers. The old trade review
engine requires simulated fills and invented gap/stop facts for this input, so it
must not receive owner-reported fills or be widened silently.

Support only declared standard 100-share GLD/IBIT long calls/puts in USD. Quantity
is whole contracts. No short opening, exercise/assignment, adjusted contracts,
multi-leg allocation, expiration settlement, live marks or account cash balance.
An open position remains open even after expiry until reported closing evidence
exists; expired unresolved exposure is flagged. Empty owner ledger stays empty.
Synthetic demonstrations use a separately identified ledger and workspace.

## Commands and chronology

- REGISTER_TRADE: immutable trade identity, optional declared plan and optional
  activity candidate reference. Plans record actual local registration plus
  owner-declared time. A plan entered after an execution cannot become a locally
  frozen pre-entry plan. Missing plans are retained as a review gap.
- RECORD_FILL: globally unique fill ID, explicit per-trade execution sequence,
  original UTC execution timestamp, BUY_TO_OPEN/SELL_TO_CLOSE, positive integer
  quantity, exact per-share USD price, nullable total fill fees, optional external
  execution reference/evidence description/document hash and owner exit reason.
  No account number or credential is requested. Zero fee is explicit; unknown is
  null. A reported zero-price sale is retained, not inferred from a missing quote.
- CORRECT_FILL: expected current revision plus reason and full replacement or
  null to void. Every earlier record remains immutable. Recompute all later FIFO
  and reviews from the corrected effective record; reject oversells, chronology
  conflicts, active duplicate external references and stale corrections.
- Every request ID is idempotent for identical content and conflicts on changed
  content. Reused fill IDs fail. Identical-looking fills lacking distinct external
  references are retained as possible duplicates with review-required status,
  never silently discarded. Execution sequence resolves equal timestamps;
  inconsistent sequence/time or flat-position reopening requires correction or
  another trade. Execution time cannot exceed actual local recording time.

The CLI uses exclusive numbered event payloads and post-write receipts linked to
the previous event hash. It recovers the entire original prefix before writing.
A partial write blocks new writes; it is never overwritten or silently truncated.
Bound the ledger to 1,000 accepted commands/200 trades and 32 MiB per file. A
single writer lock prevents conflicting CLI appends. A stale lock is explicit
operator recovery work, not permission to delete a lock automatically. Source
JSON bytes and actual recording clocks are retained. Local hashes do not provide
broker authentication, trusted timestamps or protection against full replacement.

## Accounting and reviews

Use BigInt micro-USD for exact premium and fee arithmetic. Per-share price times
100 times contract quantity gives premium. FIFO matches sales against opening
lots. Allocate each lot's total opening fee proportionally with cumulative
integer division, assigning its remainder on final consumption. A closing fill's
fee is charged once. Unknown opening fees propagate only into affected matches
and remaining basis; unknown closing fees make corresponding net results unknown.
No estimate is substituted. Preserve gross realized PnL, allocated fees, net
realized PnL, remaining cost basis and net cash flow separately. When fully known,
net cash flow equals realized net PnL minus remaining cost basis. This is a
reported-trade ledger, not the Robinhood balance, tax-lot calculation or settlement.

Plan comparison reports declared quantity/debit limits, fixed $50 allocation
diagnostic, late entry/time exit, reported exit prices versus a declared premium
stop, closed net PnL versus declared risk/target and retrospective plan evidence.
These facts do not establish whether a stop/target was touched earlier, whether
an early exit was wrong, or what caused a gain/loss. Missing plans/fees/documents,
possible duplicates, corrections and adverse results remain candidate lessons.
No guessed cause, approved rule, win probability or size escalation.

## Saved review surface

Build an immutable offline HTML/JSON desk from the owner ledger and optionally
one existing chain/account board plus one activity-study report. Copy the exact
dependencies into the package and verify them using unchanged original readers;
preserve dated snapshots and all quote clocks. Show actual owner-reported data,
synthetic paper account and hypothetical activity references separately on the
same page, with readable evidence limits and original detailed links. All dynamic
text is escaped; no external script, network request or order form. The view does
not add a scheduled task or claim automatic refresh.

## Acceptance

Exercise partial exits, scale-in while open, unknown fees, fractional fee
allocation/remainders, zero-price sale, losses, duplicate requests/references,
possible duplicates, corrections/voids, stale revision, future time, oversell,
wrong symbol/contract, plan chronology, identity linkage, empty owner state,
fresh-process recovery, partial-write/lock/path/hardlink/tamper failures and linked
desk recovery without original source stores. Run typecheck, focused tests and
the full validation bundle; inspect the rendered desk and verify protected bytes.
Commit/push are covered by standing Owner authorization. No actual fills have
been supplied; engineer demonstrations must never become owner trade history.
