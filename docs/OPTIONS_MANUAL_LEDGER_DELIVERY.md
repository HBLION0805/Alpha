# Owner-reported fills and consolidated review delivery

Implemented September 7, 2026 New York after the Owner approved this local batch.
The system can now retain supplied GLD/IBIT long-option fills, reconcile partial
exits and corrections, compare recorded execution with a declared plan, and show
these reviews alongside existing activity and paper evidence. The Owner supplied
no actual fills: the new owner ledger contains **zero trades and zero events**.

## Saved local outputs

- Ledger: `data/runtime/options-manual-ledger/owner-manual-gld-ibit/`, created
  `2026-09-08T03:00:58.291Z`, origin `OWNER_REPORTED_UNVERIFIED`.
- Desk: `data/runtime/options-review-desk/owner-review-20260907/index.html`, saved
  `2026-09-08T03:00:59.694Z`, report fingerprint
  `sha256:21a7036c8ba92ec0ec0550c29c65e8fac704a12412b562d84891dabbcb32bf24`.
- The desk preserves all 224 activity candidates, 167 distinct controls and 57
  unmatched cases from the frozen study. Future close boards and evaluable primary
  outcomes remain zero. Original synthetic paper-account diagnostics are copied
  separately; neither those balances nor reference returns become owner trades.

See the [recording guide](OPTIONS_MANUAL_LEDGER_GUIDE.md),
[reviewed specification](specifications/OPTIONS_MANUAL_LEDGER_V1.md) and
[dated validation evidence](status/manual-ledger.json). Runtime records stay
local and Git-ignored; commits include implementation and dated evidence only.

## Files and behavior

- `src/contracts/OptionsManualLedger.ts` and the new
  `src/engines/options-manual-ledger/` engine, fixture and tests define bounded
  reported events and deterministic reviews. BigInt micro-USD FIFO matching
  preserves every premium and fee remainder. Unknown costs stay unknown.
- `scripts/options-manual-ledger.mjs` and its tests add exclusive event payloads,
  post-write receipts, hash-linked history, request idempotency, expected-revision
  corrections, duplicate diagnostics and full-prefix restart recovery. Incomplete
  writes or foreign writer locks block further writes without deleting history.
- `scripts/options-review-desk.mjs`, its tests and
  `scripts/lib/options-review-desk-render.mjs` create a static English HTML/JSON
  package. Copied dependencies recover through their original readers, without
  the original stores. Existing paper, chain and activity engines are unchanged.
- `.gitignore`, `package.json` and `scripts/alpha-validate.mjs` register storage
  exclusions, commands and tests. README, architecture, decisions, changelog,
  roadmap, handoff, AGENTS and current operations/progress documents describe the
  new capability and correct the stale operations-index schedule summary.

Declared budget/quantity, entry and exit timing, missing documents/fees,
retrospective plans, corrections and negative outcomes create candidate notes.
A sale below the declared stop is explicitly not proof of a stop violation.
Cause, intraday path and slippage remain unknown without relevant evidence.
Fee allocations reconcile on partial closes and assign the final remainder when
the lot closes. A synthetic three-contract example yields $14.96 net before an
exit correction and $4.96 afterward; original records remain present. These are
engineering examples, not investment outcomes.

## Validation

Executed focused engine, persistence and desk tests, TypeScript checking, actual
empty-ledger creation and desk build/recovery. The browser rendered the saved desk
at its default viewport; the summary, section navigation and expandable original
paper diagnostics were inspected. The recording-guide link is a local Markdown
file. No mobile-layout acceptance is claimed. The final bundle passed
**3,752/3,752 tests across 153 components**, including 41 engine, 23 persistence
and 16 desk tests added in this batch. TypeScript, runtime-data tracking, Markdown
links and Git whitespace checks passed. All **545 protected files** retained
their hashes, including the active host and v6 restoration artifact. Fresh
processes recomputed the empty owner ledger and saved desk successfully.

The initial bundle passed its 3,751 tests but the static network scan mistook
the local request-ID Set name for a networking library. The variable was renamed
without changing the scan. Final review also tightened document-hash types and
added a coercion rejection test; the complete bundle then passed. Initial and
final logs remain local. There are no unresolved implementation test failures.

Reproduction commands:

```text
npm run test:options-manual-ledger
npm run test:options-manual-ledger-storage
npm run test:options-review-desk
npm run typecheck
npm run alpha:validate
npm run options:manual-ledger -- --verify owner-manual-gld-ibit
npm run options:review-desk -- --verify owner-review-20260907
git diff --check
```

## Limits and next evidence

Only reported standard 100-share long GLD/IBIT calls/puts in USD are supported.
Amounts accept up to eight integer and six fractional digits; one fill supports
up to 1,000 whole contracts. Each ledger is limited to 1,000 events and 200 trades.
There is no exercise, assignment, short/multi-leg, tax-lot or settlement adapter.
Open exposure remains unresolved after expiry. Input times and document hashes
are owner declarations, not authenticated broker evidence or trusted timestamps.
Local hashes cannot prevent a privileged party from replacing an entire store.

Known fees and reported prices permit arithmetic reconciliation, not a verified
broker balance. Candidate lessons require review; no causal certainty, winning
probability, strategy promotion or position-size increase is produced. No source
refresh, automatic order, account call or automation change was added.

Against the fixed ten-workstream baseline, counts stay **4 local validated /
3 partial / 3 not validated**. This batch advances manual reconciliation within
workstream 07 and extends reviews in 06. The first-real-price-paper flow still
has **three available local components and three open gates**: eligible option
quotes, a source-specific adapter and the actual-data end-to-end run. Next record
genuine fills when supplied and inspect September 8 close evidence, followed by
the frozen September 9 activity comparison. Retain missing and unsuccessful cases.
