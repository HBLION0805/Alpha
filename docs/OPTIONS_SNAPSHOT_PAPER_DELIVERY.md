# Robinhood snapshot paper workflow

September 9, 2026, New York. The missing local adapter and review workflow are
implemented. The three **qualified real-price** gates have not all passed.
The adapter is locally testable under explicit assumptions; source certification
and a qualified completed real-price lifecycle remain open.

## What now works

- Read and independently verify original guidance captures, retain exact source
  bytes and SHA-256 lineage, and preserve nanosecond option refresh clocks.
- Separate receipt-time numerical checks from current freshness, missing quotes,
  source qualification and the provenance of synthetic fixtures.
- Preview and freeze an independent single-contract-identity GLD/IBIT long-option
  plan under the active allocation-only policy. Settings fingerprints prevent a
  policy change between preview and registration. A plan's fees and slippage are
  separate explicit assumptions; blanks remain unknown.
- Model a later eligible ask entry and later bid exit, with whole quantities,
  bid/ask sizes, entry limit/spread, cash/equity and cost checks. Exit slippage is
  rounded down to the applicable price tick. Stops and time exits remain latched
  while liquidity is missing. No zero-bid fill or forced terminal exit is added.
- Reconcile cash, fees, unresolved exposure and unsettled sale proceeds. A later
  stop can lose more than planned R. Sparse observations do not establish which
  threshold was reached first in the missing path.
- Save original plan, copied source records, modeled events, review and candidate
  lessons. Recovery recomputes without the source directory. Owner fills stay in
  their separate ledger. Saved candidate lessons also appear in Reviews & lessons.
- Event research now contains **Paper validation**, precise quote-quality tables,
  a preview/freeze form and immutable outcome history on desktop and mobile.

The fixed `RH_SNAPSHOT_ASSUMPTIONS_V1` profile is a snapshot model, not a qualified
execution adapter. Source-side clocks, contract deliverable/exercise/session
certification and MCP-specific usage/execution evidence remain incomplete. The
reviewed five-tool schema does not provide independent option-side/quantity clocks.
No editable “all requirements approved” flags bypass those gaps. The regular-day
model uses 09:30–16:00 New York, excludes expiry day and weekends, and does not
certify holidays or exchange-specific late sessions. It is not an exchange calendar.

## Actual source attempt

The authorized bounded market reader made 16 calls at
2026-09-10T00:44:05.823Z–00:44:10.432Z (September 9 evening in New York).
It requested 36 selected contracts and returned **34 option quotes; two were
missing**. All 34 failed receipt-time freshness/session checks. GLD also lacked
a sufficiently aligned underlying observation. These are new actual source
receipts, not fresh executable prices.

Two explicit retrospective September 9 session audits were frozen at the actual
September 10 UTC recording time and saved as **NO_ENTRY**. Each selects the lowest
returned ask within $100–$500 for one contract, or the lowest returned ask solely
for a blocked audit if none fits. This is a deterministic audit selection, not a
directional idea or an exhaustive search for an affordable contract. The selected
GLD ask was $760 per contract; the IBIT ask was $110 before unknown costs. Neither
created a fill. The audited source sample is bounded, not the entire option chain.

- Source capture:
  `data/runtime/options-daily-guidance/captures/2026-09-10/2026-09-10T00-44-50-412Z-46fae72f-3985-47af-93c1-4e7404d957d3.json`.
- Real attempt proof:
  `data/runtime/options-workbench-development/snapshot-paper-real-attempt-20260909.json`.
  SHA-256 `371d56c2643d869c9f7aa4d09ce196c7c6792e0e9d3e84e07bc703cc88061d5d`.
- Frozen local IDs: `source-audit-gld-20260909` and
  `source-audit-ibit-20260909`; both have independently verified saved reports.
- The proof retains 108 original-file hash comparisons. All matched. The owner
  ledger still has zero events/trades and head
  `a9d04c6517e2143e9d74dac740a1a2fd92511b1324392f4ec0a2816e52784e1c`.

The two audits retain source/cost gaps as candidate process lessons. They are
neither winning/losing trades nor evidence of an edge. Unknown costs were not
changed to zero. Original paper journals, frozen event studies and source gates
remain unchanged. Runtime source data and reports are excluded from Git.

## Validation and operation

`npm run test:options-snapshot-paper` checks target, stop, time exit, delayed
liquidity, loss beyond R, tick boundaries, unknown costs, stale and missing data,
nanoseconds, duplicate/conflicting/regressing clocks, hindsight, cash, source
mutation, immutable registration, isolated recovery, API authorization and UI
rendering. The full validation result is recorded in
[the checkpoint](status/snapshot-paper.json).

Actual desktop and 390×844 mobile checks verified the gate cards, saved NO_ENTRY
record, review text and form preview. The preview retained unknown fees, made no
save and was discarded. No browser console errors or horizontal page overflow
were observed. The existing exact-workspace loopback service was restarted with
its supported network launch permission; this does not itself prove a new source
refresh. Collection schedules and brokerage authority are unchanged.

Commands, run from the workspace:

```text
npm run options:snapshot-paper -- --report
npm run options:snapshot-paper -- --preview <workspace-relative-request.json>
npm run options:snapshot-paper -- --register <workspace-relative-request.json>
npm run options:snapshot-paper -- --save-report <plan-id>
npm run options:snapshot-paper -- --verify <workspace-relative-saved-record.json>
```

These commands read local captures; they cannot request a broker quote or place
an order. New paper plans are not silently added to Host tracking or scheduled
collection. A first qualified run still needs an eligible sequence for a frozen
contract and entry/exit window, explicit costs, and resolved source qualification.

Public source context reviewed on September 9 includes Robinhood's
[market-data explanation](https://robinhood.com/us/en/support/articles/using-market-data/).
That stock-platform article does not certify the MCP option feed. The
[customer agreement with a July 2022 filename](https://cdn.robinhood.com/assets/robinhood/legal/Robinhood-Customer-Agreement-July-2022.pdf)
was reviewed only as context; its current applicability and MCP retention scope
remain unverified. Neither page is used as a quote-side timestamp certificate.
