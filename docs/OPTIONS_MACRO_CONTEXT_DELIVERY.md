# Public macro context and prospective model comparisons

September 9, 2026 delivery. Three free official public sources now supply dated
numerical context to News & calendar, context export, the gold checklist and the
existing Host brief. No new account, credential, paid source or order route.

## Delivered behavior

- Treasury nominal par yields: daily 2Y/5Y/10Y/30Y, stored in exact basis points.
- Fed H.10: broad dollar index, USD per EUR and JPY per USD. Daily observations
  arrive in a weekly publication. The broad index is not DXY.
- Cleveland Fed: CPI/core CPI/PCE/core PCE model estimates, month-over-month and
  year-over-year. Periods and SA/NSA are explicit. Blanks remain unknown; PPI and
  survey consensus are not supplied. The source's MM/DD update label does not
  establish its year or exact publication time.
- A separate protected local form previews and saves an Owner-reported actual
  against a saved pre-release model. It validates period, measure, seasonal
  adjustment and BLS/BEA source-link domain. Release time and actual value remain
  Owner-reported and unverified. Actual minus model is calculated in percentage
  points; it is not a market-consensus surprise or a trade signal.

Every source has a 12-second total deadline and 512 KiB bound, fixed HTTPS GET,
no redirect or credentials, strict UTF-8 and independent failure status. Exact
source text, SHA-256, request/receipt/recording clocks and deterministic parsed
results are saved exclusively. Readers reparse and verify; historical last-known
data cannot hide a failed latest attempt. The dashboard scans at most 45 saved
date directories and displays source dates separately from receipt freshness.

Model records must precede the declared release strictly; future release times,
missing model cells and mismatched measures are rejected. Same request ID and
inputs are idempotent; changed inputs cannot overwrite a saved comparison.
Positive save tests use an isolated synthetic workspace. No actual was entered
into the Owner's production store, and no future outcome was invented.

## Actual activation

The existing workspace service was restarted through the supported per-command
network approval path after matching its exact command and sole 127.0.0.1:4173
listener. A new independent `macro-daily-2026-09-09` claim completed OK at
2026-09-09T23:29:29.985Z. All three sources were saved at 23:29:29.950Z:

| Source | Latest displayed observation | Actual receipt UTC |
|---|---|---|
| Treasury nominal | September 9: 2Y 4.43%, 5Y 4.61%, 10Y 4.83%, 30Y 5.28% | 23:29:29.810 |
| Fed broad USD / FX | September 4: index 118.0732; USD/EUR 1.1618; JPY/USD 156.1100 | 23:29:29.950 |
| Cleveland model | Update label 09/09; August CPI MoM 0.36%, core CPI MoM 0.20% | 23:29:29.718 |

These are dated source observations, not synchronized current market prices.
The existing real-yield source date is September 4, so the September 9 nominal
minus real comparison stays unknown. Same-date par-yield subtraction, when
available, is only a descriptive spread and is not a fitted breakeven estimate.

The running service now attempts the three new sources once per New York date
at/after 17:00, with later same-date catch-up. The new claim uses its New York
date even after UTC midnight. Existing hourly and daily claims/source sets,
Host automation fields and the cancelled opening/development schedules remain
unchanged. A stopped computer/service does not refresh; a failed daily claim
is preserved and not silently retried. Weekly/daily publication lag remains.

Evidence: `data/runtime/options-workbench-development/macro-context-evidence-20260909.json`,
SHA-256 `78b79fae60e201804a2001236f40b9ecc508d107c65f29a36beb5b20c0623b36`.
The stored raw batch independently verifies; its SHA-256 is
`efbbdee83640039ade11d181515989209959e0e7614f02943a745af513abdb0e`.
All 20 prior frozen artifacts match their saved hashes. The Owner ledger still
has zero events and its original head. No old settings or source files changed.

## Implementation and validation

New `OptionsMacroContext.ts` supplies deterministic parsers. The existing bounded
Treasury XML helper is exported without changing its implementation. New macro
I/O and CLI modules own exclusive storage, transport and comparison recovery.
The workbench state/API/static asset allowlists and frontend integrate the desk;
the gold view preserves separate real/nominal clocks and model/USD coverage.
The context service adds one independent daily claim, including UTC-midnight
and DST checks. Runtime raw data are Git-ignored.

57 new macro tests and the 33 existing gold-framework tests pass. The aggregate
suite passes 4,238 tests with zero failures; strict TypeScript passes. Coverage
includes malformed schemas, nulls, duplicate/future dates, transport deadlines,
oversized/invalid UTF-8 responses, independent failures, recovery/tampering,
prospective clocks, idempotency, concurrent claims and protected API access.
The initial in-cell script parser case and UTC-midnight claim path were corrected
before final validation. No outstanding failing test.

Desktop content/scroll width: 1265/1265. Mobile viewport 390x844 gives content/
scroll width 375/375; wide tables scroll within their own cards. The comparison
form opens with no actual and disabled save. Browser errors: zero. Viewport reset.

## Limits and next work

Coverage remains partial: no intraday DXY/rates, survey consensus, automated
official actual-release values, PPI model, complete oil/flow series or qualified
underlying OHLCV. Nothing here calibrates win probability, qualifies an option
fill or changes stop behavior. Prices and models are context for a later
prospective outcome study, not evidence of profitability.

The ten-workstream comparison stays 4 LOCAL_VALIDATED / 3 PARTIAL /
3 NOT_VALIDATED, and first real-price paper-flow gates stay 3 available / 3 open.
These are local acceptance counts, not a completion percentage or win rate.
Next resolve the already-requested cancellation of the old capital plan with a
$100 minimum as a separate versioned policy change, then qualify underlying
OHLCV and event-time rates/consensus evidence. This source task has not changed
the saved allocation or independent loss caps.

## Source references and local use

- [Treasury XML feed documentation](https://home.treasury.gov/treasury-daily-interest-rate-xml-feed)
- [Fed H.10 current release](https://www.federalreserve.gov/releases/h10/current/)
- [Cleveland Fed inflation nowcasting and methodology](https://www.clevelandfed.org/indicators-and-data/inflation-nowcasting)

References reviewed September 9; actual receipts above establish acquisition.
Use `npm run options:macro-context -- --report` for saved context and `--verify
<saved-batch-path>` for independent recovery. `--refresh` performs the three
fixed public reads and requires an environment with outbound network permission.
Prefer normal daily claims during operation. UI reload only reads local data.
The CLI also accepts `--preview-comparison <input.json>` and `--save-comparison
<input.json>` with the exact fields from the specification; use actual official
values only after release. See [specification](specifications/OPTIONS_MACRO_CONTEXT_V1.md).
