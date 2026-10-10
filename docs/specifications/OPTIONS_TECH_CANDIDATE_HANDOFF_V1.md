# Technology candidate handoff V1

## Commands and authority

```text
npm run options:tech-candidate -- --prepare --source-root DIRECTORY --research FILE --run-id ID
npm run options:tech-candidate -- --assess --run-id ID [--quote FILE] [--evidence FILE]
```

The source root is the existing scan delivery, containing `runs/`, the frozen
v1.2 rules and review input, `derived-review-v1.2/`, and the corrected original
verification batch. No source code in that directory is executed. The original
ranking functions are reused in `options-tech-review-ranking.mjs` with their
impact/catalyst/evidence thresholds and tie order unchanged. Valuation null stays
unknown; ranking is retrospective event priority, never profit probability.

Preparation checks the exact fixed pool, 72 company/source coverage records,
original response hashes and clocks, rule/input/event lineage, all 36 saved ranks,
selected-event originals/exhibit and later selected-company review. It rejects
rank mismatches, tampered bytes and unresolved later candidate disqualification.
The full scan's completeness remains unknown; later selected-headline exclusions
do not retroactively exclude entire companies. Copied hashes do not authenticate
the source service or analyst judgments.

Research input binds `parentRunId`, `candidateId`, `eventId`, `threeFacet`,
`quoteSelection` and `windows`. Six-month outlook, event window, conditional
research interval, planned holding period and probe expiry remain distinct.
The existing ThreeFacet registration must retain the research and source IDs.
UNKNOWN direction is valid research; no numerical technical level or account
permission is manufactured. A probe selection is not an option recommendation.

Preparation creates a new ignored directory, copies the input bytes and hashes,
and freezes actual preparation time. It refuses overwrite and unsafe paths.
Assessment checks all frozen bytes and replays selection from the copied inputs.
Each new assessment is an exclusive timestamped file referencing the preparation
hash and exact external input bytes. Corrections use a new preparation and retain
the earlier version, rather than overwriting a forecast or source.

## Quotes and account checks

The optional quote input is a saved `TECH_QUOTES_RECEIPT_V1` from the existing
bounded adapter. It must match the frozen symbol/expiry/strike, intent, capture
hash and actual clocks. Synthetic captures cannot become real-source evidence.
The normalizer retains source, receipt and assessment clocks and every original
blocker. Capture before preparation is explicitly replay-only; a source clock
before the research cannot qualify post-decision evidence. Closed sessions remain
closed; old prices are never reassigned a fresh timestamp.

Optional full account evidence is evaluated by the unchanged feasibility engine,
with matching symbol, a later decision and an exact normalized quote binding.
Missing entitlement, product permission, funds and risk records are individually
UNKNOWN and affect Paper admission only. Present records are not automatically
PASS; the existing complete feasibility checks still own qualification.

This adapter always reports NOT_ADMITTED and zero fills because the technology
lifecycle is not integrated. This is an honest connection to existing research,
quote and feasibility checks, not an implementation of trading or a substitute
for account evidence. Missing fees, independent technical confirmation, product
terms and hedge costs cannot be inferred. The GLD/IBIT engineering spread reference
is preserved with its origin and pending technology applicability.

## Validation

Tests use isolated MOCK inputs and injected callbacks, separately from real local
receipts. Cover original/ranking integrity, five-company substitution, coverage
gaps, later conflicts, path traversal, future research, exclusive preparation,
input mutation, missing account evidence, unsupported symbols, synthetic capture
rejection, exact quote binding and closed-session pre-research quotes.
Full validation is run against the exact clean publishing combination.
