# GLD / IBIT market evidence import delivery

Date: 2026-09-06. Implementation baseline: e38e877368893fa5572520f0b3c9141047d62411.

## Result and actual access

The supported local Cboe DataShop Option Quotes CSV importer and replay
qualification gate are implemented. The Owner confirmed they currently have
Robinhood only, with no option-data API or authorized historical file. No actual
market file was acquired, no account/credentials were accessed and no paid data
was purchased. This delivery does not contain a real-price trading result.

The gate returns **NO_REPLAY**, zero trades and no win probability. It describes
what is missing rather than fabricating an executable path. The older synthetic
trade lifecycle, every-closed-trade review and mistake notebook remain separate.

## What changed and why

- `OptionsMarketEvidence` and `CboeOptionQuotesCsv`: strict documented headers,
  bounded UTF-8/RFC4180-style inputs, exact cents, nullable prices/sizes/Greeks,
  Eastern/DST normalization, adjusted roots, dedupe and conflict rejection.
  Missing liquidity cannot be replaced with an invented executable quantity.
- `OptionsMarketEvidenceEngine`: source-file hash, owner/synthetic usage metadata,
  actual import clock, per-contract snapshot/path quality and replay blockers.
  Supported formatting is not verified publisher provenance or data rights.
- `LocalOptionsMarketEvidenceRepository`: a separate 16 MiB / 1,000-batch
  hash-linked journal, writer lock, integrity/recomputation checks, first-seen
  idempotency and correction IDs. Uncertain write/fsync failures poison the handle
  until recovery, preventing retries against stale in-memory sequence state.
- `options-market-data.mjs`: catalog, synthetic demo, local import, report and
  help commands. Strict UTF-8 decoding preserves the exact file-content checksum.
- Registered parser/qualification/I/O tests, exports, metadata example, machine
  status and current architecture/roadmap/handoff documentation.

These changes intentionally leave existing v1 paper-engine output schemas and
stored fingerprints unchanged. No old simulated quote is relabeled as real data.

## Import a supported file

1. Obtain a file you are entitled to use locally. Do not use Cboe/Nasdaq display
   page scraping as a substitute for a licensed data source.
2. Copy `fixtures/options-market-evidence/metadata.example.json` to a local file.
   Set a unique datasetId, actual intervalMinutes and delivery. Keep
   usageDeclaration UNKNOWN until entitlement is established; use
   OWNER_ATTESTED_LOCAL_USE only for your actual declaration. This is a record
   of the declaration, not software verification of a license.
3. Run the command below with real local paths. Never add credentials or raw
   licensed data to Git. Relative paths resolve against the working directory.

```powershell
npm run options:market-data -- --catalog
npm run options:market-data -- --demo
npm run options:market-data -- --import "C:\data\quotes.csv" --metadata "C:\data\metadata.json"
npm run options:market-data -- --report
```

Accepted metadata has exactly six fields: datasetId, origin, source,
usageDeclaration, intervalMinutes and delivery. Import time and checksum are
assigned by the command. Raw CSV is limited to 4 MiB / 10,000 rows; metadata to
16 KiB. Non-GLD/IBIT rows are counted as skipped; target roots with unverified
deliverables remain blockers. Unknown or malformed columns are not guessed.

Same ID with the same source bytes/metadata/normalized observations is a no-op
and preserves first import time. Any changed payload under that ID is a conflict;
use a new ID for a correction. The separate ignored journal lives at
`data/runtime/options-market-evidence/imports.ndjson`. It preserves normalized
observations and the source hash, not a second repository copy of the raw CSV.
A damaged or truncated journal blocks recovery; never delete history or an
existing lock to obtain a passing result.

## Source limitations and assumptions

- The [Cboe DataShop product](https://datashop.cboe.com/option-quote-intervals)
  supplies interval snapshots. Intraday delivery is 15 minutes delayed; quote
  timestamps do not establish when historical files were available to a strategy.
- Effective 2026-06-22, reported size can correspond to the most recent price
  change within the interval. It is not proof of contemporaneous executable size.
- The [file layout](https://datashop.cboe.com/documents/Option_Quotes_Layout.pdf)
  uses Eastern interval-end times. Early closes need independent calendar data.
  Sampled quotes do not establish within-interval target/stop ordering.
- File fields do not verify the multiplier, deliverable, exercise style or price
  grid. Independent contract/calendar evidence, historical availability and
  explicit cost/slippage/fill assumptions are required for a versioned replay.
- Free Alpaca indicative quotes are modified derivatives, according to its
  [official documentation](https://docs.alpaca.markets/us/docs/historical-option-data).
  They cannot silently replace actual OPRA observations in a real-price claim.
- IV zero means unavailable under the source model. Missing values stay unknown.
  Current import time is a local first-seen boundary, not fabricated historical
  availability. The journal is single-process development persistence.

## Validation and remaining work

`npm.cmd run alpha:validate` passed: **82 components, 2,176 tests executed,
2,176 passed, zero failed**, duration **30,907 ms**. This includes strict
TypeScript checking, all registered tests, scope/import checks, documentation,
credential/runtime scans and whitespace checks. New focused suites: CSV parser
49/49, evidence qualification 44/44, repository/CLI 29/29; status 54/54.
The ignored full log is `alpha-market-evidence-validation.log`.

The actual `--catalog`, `--demo` and `--report` commands ran successfully. The
isolated synthetic demo has four rows over three contract paths: one sampled
GLD path, one IBIT snapshot with unknown sizes and one adjusted-root snapshot.
It reports NO_REPLAY and zero trades. The actual saved-data report has **zero
datasets**, matching the absence of an authorized file; no synthetic example
was saved as actual market history. Temporary I/O tests exercise import, repeated
import, restart, correction and failure recovery with labeled test inputs.

`npm run options:paper -- --report` still reproduces the existing scripted
account: USD 990 equity, five closed-trade reviews and four notebook entries.
The paper journal SHA-256 before and after the new work is unchanged:
`3e4f4e3bc453e69f64987a1ab0c2e3dc3fd743f082ca6bf5fae0bdff0cfd549b`.
No existing v1 paper/quote/review engine or its contract/repository was edited.

Independent review corrected conflict detection for discarded OHLC/volume/model
fields, uncertain-write retries and locale-dependent report ordering. Regression
tests cover these defects. Expected uncommitted-tree and Windows line-ending
notices are the only aggregate warnings; no test failures remain.

Changes are published under the Owner's existing authorization on
`codex/gld-ibit-options-foundation`; the containing commit records this delivery.
The task reports the final commit and remote verification after publication.

No new actual option dataset or strategy performance has been verified. The next
external dependency is an entitled option-data source; it can be a separate
read-only provider while the trading platform remains Robinhood. After receiving
qualified observations, complete contract/calendar/availability and execution-cost
evidence, then implement the versioned historical replay bridge. Automatic risk
increases, a claimed 80% win rate and brokerage orders remain unsupported.

Development, saving, commit and push are already authorized by the Owner. This
delivery introduces no additional purchase or account action.
