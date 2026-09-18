# Robinhood observations and conditional contract comparison

September 17, 2026 New York. [Specification](specifications/OPTIONS_ETF_OBSERVATION_V1.md),
[checkpoint](status/etf-observation.json).

The Owner asked to use Robinhood charts directly and continue development. Daily
guidance now displays saved regular-session candles, descriptive late-window
momentum, future watch conditions and the matching call/put sample in one panel.
Alpaca is optional. Missing source semantics still prevent strict qualification,
but no longer prevent descriptive observation and conditional comparison.

## Actual saved observations

The new panel uses the unchanged September 17 09:30–16:00 New York five-minute
capture: 78 candles per ETF, received at 19:49:18. The existing one-minute audit
retains four differing intervals / 13 fields; all paired closes match. Unknown
interpolation flags stay unknown. Neither interval is selected as correct.

| Saved observation | GLD | IBIT |
| --- | ---: | ---: |
| First open → last bar close | $400.320000 → $398.280000 | $43.240000 → $43.315000 |
| Trailing 3 / 12 close means | $398.365000 / $398.564166 | $43.315000 / $43.314975 |
| Late-window comparison | Falling | Mixed |
| Last 30-minute low–high reference | $398.040000–$398.670000 | $43.270000–$43.380000 |

These describe the returned historical window, not official closing prices or a
forecast. The fixed 15/60-minute means and 30-minute range are untested assumptions.
The bullish/bearish discussion asks for two future completed five-minute closes
outside the relevant range, with re-entry into the range invalidating the idea.
No condition is registered, evaluated as an entry, or added to canonical guidance.
Matching close conflicts suppress momentum; relevant high/low conflicts suppress
watch levels. Missing or unrelated audits explicitly remain unverified.

Each side compares nine saved contracts per ETF, retaining at most three
references. Mechanical fit precedes distance to absolute delta 0.50, then DTE,
spread and ID. This deterministic ordering is not a profitability ranking.
The IBIT first references are October 2 $43.50 call and put, with historical asks
$1.10 / $1.18 per share ($110 / $118 for one contract before costs). GLD references
nearest the delta assumption exceed the $500 allocation ceiling. All original
blockers remain; unknown costs leave zero complete sample-fit passes. The quotes
are from approximately 15:51, before the bar window ends, and are stale. Neither
ETF has a confirmed entry; both canonical decisions remain WATCH. Original
premium stops are disclosed assumptions; unknown net targets remain unknown.

## What the website visit established

Read-only visits to the public [GLD page](https://robinhood.com/us/en/stocks/GLD/)
and [IBIT page](https://robinhood.com/us/en/stocks/IBIT/) displayed one-day line
charts, Today/Overnight labels and separate stock snapshots. No authenticated
candlestick controls were observed or account/order controls used. GLD's headline
was $399.29 while its separate snapshot was $398.44; IBIT's corresponding values
were $43.27 and $43.28. Per-value market clocks and scope were not established.
These webpage values are retained separately and never replace API candles.
The local chart explicitly says it renders the saved API response, not the website.
The private dated visual note records that its exact observation clock is unknown.

## Recovery and verification

`npm run options:etf-setup -- --observe` projects saved inputs without source calls.
`--save-observation` appends a copied-input record; `--verify <record>` recomputes
it. No GET writes, extra source tool, timer or HTTP mutation were introduced.

Actual record:
`data/runtime/options-etf-setup/observations/2026-09-18T00-56-57-951Z-9d22a03a-6be1-4df7-bce4-c438adaab6cd.json`.
Report fingerprint:
`sha256:396790c0da191aff7b0dc8cf021e2024a251dbdc0c925310666eb96878e41c31`.
The 782,575-byte record alone recovered under
`data/runtime/options-etf-observation-recovery-20260917` without source stores.
Original source/audit report fingerprints are unchanged. Private inputs are not
committed to Git.

Validation: 23 focused observation checks passed; the aggregate run passed 4,688
tests with zero failures across 177 components, including strict typecheck and
existing setup/source/audit suites. Desktop and 390-pixel mobile views displayed
both charts and expandable contract reasons without page overflow. The planner
handoff retained the selected quote, one contract and unknown costs; browser
console errors were zero. The workbench
was restarted only after matching its workspace command and loopback listener.

Remaining: fresh session observations, explicit prospective setup/exit parameters,
cost and account reconciliation, and independent option outcomes. Strict source
qualification and strategy evidence remain open. The earlier engineering paper
milestone stays complete. Workstream totals remain 4 local / 4 partial / 2
unvalidated; this delivery improves interpretation, not proven returns. Source
schedules, reported trades, capital declarations and all frozen studies remain.
