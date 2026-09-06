# GLD/IBIT Historical Replay Delivery

Date: 2026-09-06. Baseline: `4db85e97db53b104191b1e097cf47624f77de9f6`.
Specification: [sampled replay v1](specifications/OPTIONS_HISTORICAL_REPLAY_V1.md).

## Outcome and boundaries

Alpha now runs independent, persistent GLD/IBIT snapshot research trials with
explicit contract, session, fee, slippage and size assumptions. Each trial
starts with USD 1,000. It models subsequent-snapshot entry and exit, applies
existing allocation/R/stress limits, and reviews every outcome, including
blocked, unfilled and unresolved attempts. This is a counterfactual research
model, not historical exchange execution reconstruction or a broker account.

No authorized GLD/IBIT quote file has been acquired. Actual target-price replay
has not run. The original market-evidence `NO_REPLAY` qualification is unchanged;
this separate model does not certify that gate's missing evidence. The older
paper engine, review engine and evidence results remain reproducible. No live
order, calibrated win rate, automatic risk escalation or approved strategy is
produced.

## Actual data acquisition research

The [Cboe Option Quote Intervals product](https://datashop.cboe.com/option-quote-intervals)
provides a [public sample archive](https://datashop.cboe.com/download/sample/215).
The downloaded archive contains five CSV samples, covering AAPL and/or SPX;
inspection found **zero GLD/IBIT rows in all five**. Archive size is 2,628,937
bytes, SHA-256 `7645a6cc94f1a984e98264a4b494f748e373c30ecde85de25ceadb83a5c56782`.
Those observations are not relabeled or imported as target-market evidence.

The actual extractor was also run against the official basic CSV
`UnderlyingOptionsIntervals_3600sec_2023-09-21.csv` (1,981,015 bytes; SHA-256
`2d15017f6511657039129dcd5f542983e5b5bf0905d43eb33fc522450d0d3466`). It scanned
22,610 rows: 19,111 SPX and 3,499 AAPL, with zero target rows. It saved a NO_MATCH
manifest at `data/runtime/options-historical-replay/extracts/official-sample-target-coverage-check/manifest.json`,
created no quotes file and returned unchanged on repeat. Source and manifest
hashes remained identical. The illustrative contract probes are not claims that
those contracts existed; coverage was also checked by underlying symbol.

On 2026-09-06, the product's nonbinding price-calculation response quoted the
following for GLD and IBIT, session 2026-09-04, one-minute historical intervals,
individual internal use:

| Requested content | Quoted subtotal |
| --- | ---: |
| Basic quotes and sizes, without calculations or open interest | USD 48 |
| Quotes with calculations/Greeks and open interest | USD 80 |

Responses excluded neither symbol and returned no attribute warning. They do
not establish final checkout cost, delivered coverage, rights or access. Nothing
was purchased; no account, credentials, subscription or payment was used. The
raw responses and official archive are local ignored acquisition evidence under
`data/runtime/options-historical-replay/source-research/`.

Basic quotes are enough to begin a price-path/process test once supplied and
reviewed. Greeks/open interest can support later selection research; paying for
them does not establish an edge. Neither package alone proves contract terms,
Robinhood costs, account eligibility, historical feed availability or fills.

## Reproducible local workflow

Run the engineering scenarios without persistence:

```text
npm run options:historical-replay -- --demo
```

Save them separately, then recompute after restart:

```text
npm run options:historical-replay -- --record-demo
npm run options:historical-replay -- --report
```

The seven independent synthetic cases are:

| Case | Result | Net modeled P&L |
| --- | --- | ---: |
| GLD target and later exit | CLOSED | +USD 10.80 |
| GLD stop followed by a gap | CLOSED | -USD 10.20 |
| GLD target followed by reversal | CLOSED | -USD 5.20 |
| GLD time exit without completing liquidity | EXIT_PENDING | Unknown |
| GLD premium outside limits | NO_TRADE | No trade |
| Missing dataset | BLOCKED | No trade |
| IBIT put time exit | CLOSED | +USD 0.80 |

These are scripted engineering examples, not seven observations of a strategy.
Closed-case results must not be combined into account growth or a win rate.
The target-reversal case demonstrates that a market-style target trigger can
still lead to a loss at a later price. A stop is a planned threshold, not a
guaranteed maximum fill loss.

Once an authorized local CSV is supplied, select one to four documented contract
identities and one session using a copy of
[selection.example.json](../fixtures/options-historical-replay/selection.example.json).
Illustrative strikes/contracts in examples are not verified available contracts
or trading recommendations. If the parent file exceeds the importer limits:

```text
npm run options:market-extract -- --input <provider.csv> --selection <selection.json>
```

The extractor streams up to 64 MiB / 250,000 rows, retains original selected cell
text, normalizes record separators to LF, and bounds the child to 4 MiB / 10,000
rows. It rejects malformed/conflicting selected records, source changes and
unsafe or partial output directories. No match produces a manifest, not invented
quotes. A complete repeat preserves original clocks. Keep the manifest with the
parent and child: it links hashes, selection, counts and actual extraction times;
it is not publisher authentication or proof of pre-registration. The import
journal binds the child hash; automatic manifest ingestion is not implemented.

Then use the existing import command and explicit usage metadata:

```text
npm run options:market-data -- --import <quotes.csv> --metadata <metadata.json>
npm run options:historical-replay -- --input <research-config.json>
```

Start from [config.example.json](../fixtures/options-historical-replay/config.example.json).
Its source and assumptions are deliberately incomplete, so running it as supplied
records a blocked research attempt. For a research trial, document the actual
contract/session/cost references and acknowledge the counterfactual model.
Historical-file delivery and one- to fifteen-minute intervals are required.
Contemporaneous size is unproven for DataShop records on/after 2026-06-22;
using positive recorded sizes requires the explicit assumed-size model. Unknown
or zero sizes are never replaced with invented availability.

## Persistence, review and limitations

The new ignored journal is
`data/runtime/options-historical-replay/runs.ndjson`, bounded at 16 MiB / 1,000
batches with an exclusive writer. Each immutable batch contains the original
config, evidence or absence, actual recording time, result and review. Recovery
recomputes outcomes and fingerprints. A repeated identical run ID preserves its
first record; changed evidence or assumptions require a new ID. Uncertain writes,
corruption and partial history fail visibly instead of being repaired silently.

Import time, actual research discovery time and hypothetical historical decision
time remain distinct. Observed event times do not precede their source snapshots;
scheduled exit thresholds are recorded separately. Selection is retrospective.
Entry/exit prices are explicitly assumed; incomplete paths retain exposure,
pending orders and unknown marks rather than fabricating liquidation. Sale
proceeds remain unsettled. Trials do not share capital or impose the older paper
account's session/drawdown history on independent datasets.

Every run receives facts, unresolved questions and candidate lessons. Normal
planned losses are not automatically mistakes, and profitable outcomes do not
prove correct causal reasoning. Gaps, delayed exit liquidity and unresolved paths
remain visible before a position closes. Prior candidates are grouped by source
origin, symbol, strategy and setup, and become visible only in actual research
recording order. They cannot become approved knowledge, historical foresight or
automatic changes to a frozen plan. Trend/news causation still requires separately
timed evidence; no numerical trend-versus-candle weights are learned here.

## Changed files and verification

- New contract, engine and fixtures implement the independent snapshot model.
- New research review and local repository preserve outcomes and candidate lessons.
- New replay CLI and extraction utility make local source preparation and recovery
  executable; examples expose required source and assumption inputs.
- Focused tests cover economics, observations, clocks, incomplete execution,
  integrity, idempotence, size bounds, extraction fidelity and preserved old journals.
- Package scripts, exports and the aggregate validator register these capabilities.
- Current status schema 1.19 and project documentation describe implemented
  research separately from unavailable actual-data validation and execution.

Executed against the reviewed implementation:

| Command/check | Observed result |
| --- | --- |
| `npm.cmd run alpha:validate` | PASSED: 86 components, 2,302 tests, 2,302 passed, 0 failed; summed component duration 43,373 ms |
| `npm.cmd run typecheck` | Passed separately and in the aggregate |
| Historical engine / review / I/O / extraction suites | 54 / 15 / 32 / 17 passed; included in the aggregate |
| `options:historical-replay -- --demo` | Seven engineering cases, four assumed closed outcomes as tabulated above |
| `options:historical-replay -- --record-demo`, repeated | First appended seven; repeat appended zero and preserved exact journal bytes |
| `options:historical-replay -- --input fixtures/options-historical-replay/config.example.json` | Saved an additional BLOCKED attempt for missing dataset and assumptions |
| `options:historical-replay -- --report` in a new process | Recovered eight runs, four closed, 15 candidate notebook entries; six synthetic-source runs and two missing-data runs, zero owner-file runs |
| Actual official-sample extraction, repeated | NO_MATCH, zero selected, 22,610 excluded; repeat unchanged |
| `options:paper -- --report` | Older history recovered without changes: five closed reviews, four notebook entries and USD 990 modeled equity |
| Existing engine diff and paper journal hash | No old engine changes; identical paper journal SHA-256 before/after |

The additional blocked attempt lists DATASET_MISSING, CONTRACT_TERMS_MISSING,
SESSION_ASSUMPTION_MISSING, COST_ASSUMPTION_MISSING and
COUNTERFACTUAL_ACKNOWLEDGEMENT_MISSING. It is not a real-market test. Candidate
notebook entries include process limitations; they are not 15 proven trade mistakes.

Research records were actually written on 2026-09-06 from 23:01:57Z to 23:02:18Z.
Recovered report: `data/runtime/options-historical-replay/recovered-report.json`.
Final research journal SHA-256:
`f34d16cf9852cfcaadd84e716172b1359beb139ece976ae5109ff6cdf4395b62`.
Preserved paper journal SHA-256:
`3e4f4e3bc453e69f64987a1ab0c2e3dc3fd743f082ca6bf5fae0bdff0cfd549b`.
No market import journal was created. The aggregate log is the ignored
`alpha-historical-replay-validation.log`; Windows line-ending notices and the
expected uncommitted working-tree notice were the only warnings. Status counters
were filled from this result, then status and whitespace checks were rerun.
No historical validation count is treated as the current result.

## Remaining work and publication

The immediate dependency is an authorized GLD/IBIT source file. Review source
rights, contract identity, trading session, costs and the explicit size/fill
assumptions, then extract/import and run a new real-price research trial. A
one-day sample tests the process, not strategy reliability. Subsequent work needs
independent samples and forward/holdout evaluation, quantitative drivers,
complete account/portfolio enforcement and Robinhood eligibility/operational
validation before any live readiness claim.

The Owner's standing authorization covers development, saving, commits and
pushes for this scope. It does not confer brokerage transaction authority or
provide paid data access. Raw market data and runtime journals remain outside Git.
