# Paper account and portfolio integration delivery

September 7, 2026. Task OPT-PAPER-PORTFOLIO-1. Base commit `d2b160c`.
Reviewed [specification](specifications/OPTIONS_PAPER_PORTFOLIO_V1.md);
dated [machine checkpoint](status/paper-portfolio.json).

## Behavior and purpose

The new deterministic bridge recovers the original single modeled account,
retains every disposition and projects closed, open and pending states into the
existing portfolio engine. An optional initial-quote candidate also passes the
original paper entry and candidate-mistake checks without recording a plan or fill.
This closes the manual copying gap between those two local components.

Combined GLD/IBIT exposure, pending reservations, daily loss, drawdown and manual
event checks reuse existing limits. Original engines and journals are unchanged.
Passing assessment time does not settle sale proceeds, release a pending order,
close a position or turn stale/zero-size quotes into usable marks.

Paper deducts exit fees from settled cash; portfolio nets them from unsettled
sales. The bridge reconciles this classification exactly, retains open exit-fee
reserves and uses the lesser available settled cash. It does not alter balances
to force individual bucket equality. Paper's prior/slippage-adjusted equity and
portfolio's current qualified gross-bid equity remain distinctly labeled.

## Commands and local evidence

```sh
npm run options:paper-portfolio -- --demo
npm run options:paper-portfolio -- --input <workspace-json> --save <new-id>
npm run options:paper-portfolio -- --paper <settings-without-history-json> --save <new-id>
npm run options:paper-portfolio -- --verify <saved-id>
```

Full input follows `OptionsPaperPortfolioInput`; repository settings contain the
same fields except `history`, which must be absent. For a journal-only diagnostic,
set `candidate` and `eventReview` to null and explicitly declare whether modeled
history/costs have been reviewed. Do not invent reviewed events or fees to clear
a blocker. `asOf` is a declared simulation clock, separate from actual recording.
The pure engine is appropriate for application callers; CLI inputs must be local
workspace JSON. No remote URL, broker account or historical research store is read.

The existing active paper journal was recovered into a new exclusive snapshot:
`data/runtime/options-paper-portfolio/current-paper-account-20260907.json`.
It was constructed at **2026-09-07T23:59:07.076Z** and independently recomputed in
a fresh process at **23:59:07.813Z**. Seven original cases retain five closed
reviews and four candidate lessons. The new candidate is null; no new trade,
review or approved mistake rule was created.

The original modeled account has $990 total economic cash and $899 available
settled cash. The two engines' $0.50 fee classification difference reconciles.
These are existing synthetic results, not the Owner's Robinhood balances.
Unknown current cost/event review and the modeled $10 daily loss remain explicit
blockers. The separate demo's new IBIT candidate is blocked by both engines'
daily loss/risk guards; it is not inserted into the journal.

Saved artifacts include original input, deterministic reports, journal/request
byte hashes and actual construction clocks. Verification recomputes the saved
snapshot without claiming it matches a later journal or authenticates imported
market data. Existing missing, busy, corrupt, linked or changing stores fail
explicitly instead of being replaced with a funded empty model.

## Validation and review

- New projection engine: 29/29 tests passed.
- New CLI/recovery boundary: 20/20 tests passed, including a fresh process.
- TypeScript compilation passed during implementation.
- `node scripts/alpha-validate.mjs`: 3,559/3,559 tests passed across 146 components,
  zero failures, including original paper, repository, portfolio and review suites.
  The final bundle also passed type, documentation, credential, runtime-data and
  Git whitespace checks. Its actual log hash is recorded in the checkpoint.

Tests include the subtle case where portfolio fee netting suggests $15.10 is
available but the original paper account has only $10.20: a $14.20 candidate is
blocked. They also cover across-ETF exposure, rejected and non-advancing marks,
unsettled profits, pending deadlines, zero proceeds, exit fees above proceeds,
all-case preservation, unknown metadata and source/clock/identity constraints.
Storage tests cover immutable writes, rehashed result tampering, UTF-8/duplicate
keys, size bounds, links/path escapes, missing/busy/corrupt stores and no network.

During implementation a CLI summary referenced `items` instead of the original
notebook's `entries`; this was corrected without rewriting the saved artifact.
One test initially expected a different name for the existing overdue-order code;
it now asserts the original `PENDING_ORDER_EXPIRY_UNCONFIRMED` behavior. No original
engine policy or accepted trade was changed to make a test pass.
The initial full bundle caught the new runtime directory missing from `.gitignore`;
the dedicated directory is now excluded. Review also added independent projection
copies so freezing a result cannot freeze caller-owned candidate/event objects.

## Scope, risks and next step

Files added: typed input contract, `OptionsPaperPortfolio` engine and tests,
`options-paper-portfolio.mjs` CLI and tests, specification, delivery and checkpoint.
Package and validation registration expose the module; `.gitignore` excludes its
local artifacts. Architecture, README,
handoff, roadmap, operations/progress and AGENTS reflect the delivered module and
separately authorized [quote-pilot cancellation](OPTIONS_OPENING_COLLECTION_CANCELLATION.md).

The result is a local diagnostic integration, not journal entry enforcement or
broker risk control. Single long options only; no live settlement, exercise,
multi-leg portfolio ledger or account permissions are inferred. Full latest
modeled history is not full brokerage history. Costs/events/high-water values
remain modeled declarations; fill assumptions remain unqualified for Robinhood.
ETF opening-price screenshots cannot supply missing option-market evidence.

Workstream 07 advances within PARTIAL. Overall bounded counts remain
**4 LOCAL_VALIDATED / 3 PARTIAL / 3 NOT_VALIDATED**. The first actual-price paper
flow still has three local components available and three open gates: qualified
option quotes, source adapter and actual-data end-to-end acceptance. No win rate
or execution authority is added. Next connect saved diagnostics to local operator
candidate review while preserving these unknowns and original records.

Git delivery uses the Owner's standing authorization for focused commits/pushes.
Final validation and clean/synchronized Git state are reported in the task.
