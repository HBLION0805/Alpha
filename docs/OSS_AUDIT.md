# Alpha OSS audit: build vs reuse (2026-10-14)

**User direction:** don't build commodity infrastructure. Use mature open source where it is the same as what exists. Keep custom code only where Alpha is different: the mentor's rules and knowledge base, risk caps and pre-trade gates, macro-first synthesis, and Chinese briefs and alerts.

**Scope:** audit only, no code changes. The repo metrics below were pulled live on 2026-10-14 (GitHub API: stars and last push; npm: weekly downloads, license and bundled types).

## 1. Inventory of `src/` (4,263 lines, 50 files)

| Area | Module | Lines | What it does | Type |
|---|---|---|---|---|
| News ingest | `ingest/rss.ts` | 127 | RSS/Atom fetch with ETag/Last-Modified, regex XML parse, date clamp | commodity |
| | `ingest/alpacaNewsWs.ts` | 133 | Alpaca news REST backfill + websocket | commodity (thin client) |
| | `ingest/officialCalendar.ts` | 139 | FOMC page parser + FRED/BEA release calendar, static fallback | commodity, but no free OSS equivalent |
| | `sources.ts` | 29 | loads sources.yaml | glue |
| News processing | `normalize.ts` | 88 | title/URL normalization, crude stemming | commodity |
| | `cluster.ts` | 135 | IDF-weighted token clustering of headlines | commodity |
| | `noise.ts` | 20 | wire-boilerplate filter | Alpha-specific list |
| | `score.ts` | 85 | macro/asset topic keywords, cluster score | **Alpha** |
| | `narrative.ts` | 42 | narrative tagging | **Alpha** |
| Storage | `store.ts` | 112 | node:sqlite items/alerts/feed state, title dedupe | commodity (already built-in) |
| | `macro/store.ts` | 31 | macro observations table | commodity |
| Output | `digest.ts` | 73 | markdown digest | **Alpha** (Chinese brief) |
| | `alerts.ts` | 73 | new/escalated alert selection, synthetic alarm sources | **Alpha** |
| Market data | `macro/fetch.ts` | 88 | FRED keyless CSV, Yahoo chart JSON, Coinbase candles parsers + fetch | commodity |
| | `macro/series.ts` | 36 | series list | config |
| | `macro/stats.ts` | 49 | changes, z-scores, MA | commodity (tiny) |
| | `levels.ts` | 168 | swings, SMA, volume profile, round numbers → S/R levels | mixed |
| | `macro/volume.ts` | 91 | RVOL, 20-day breaks, option vol>OI, P/C (+ own Yahoo OHLCV parser) | mixed |
| Macro layer | `macro/regime.ts` | 185 | deterministic regime classifier | **Alpha** |
| | `macro/confirm.ts` | 85 | news vs market-reaction confirmation | **Alpha** |
| | `macro/risk.ts` | 157 | risk-first view, NO_TRADE, checklist, catalog refs | **Alpha** |
| | `macro/build.ts`, `render.ts` | 74 + 69 | assemble and render macro report (Why vs How/When) | **Alpha** |
| | `macro/premarket.ts` | 146 | 【大佬流程】 / 【DK 补充】 premarket brief + alarms | **Alpha** |
| Options math | `options/bs.ts` | 62 | Black-Scholes price/greeks, IV bisection, normCdf | commodity |
| | `options/payoff.ts` | 84 | payoff/max loss/breakevens, defined-risk check | commodity core, used by gates |
| | `options/chain.ts` | 101 | normalized chain, greek fill, term structure, expected move | mixed |
| | `options/ivhistory.ts` | 50 | IV history store, realized vol | commodity (tiny) |
| | `options/robinhood.ts` | 27 | join Robinhood MCP instruments + quotes | glue |
| | `options/events.ts` | 50 | earnings parse, implied vs historical event move | mixed |
| Decision / discipline | `options/rules.ts` | 134 | rule card (1%/3%/2% daily/1 adjustment), stress test | **Alpha** |
| | `options/pretrade.ts` | 163 | pre-trade gate (BLOCK/NO_TRADE) | **Alpha** |
| | `options/adjust.ts` | 91 | INTC playbook, add plans | **Alpha** |
| | `options/discipline.ts` | 132 | 纪律系列 checks | **Alpha** |
| | `options/stops.ts` | 182 | 止损学 checks + technical signals (EMA/RSI/MACD/BB/Vortex/gap) | Alpha rules + commodity indicators |
| | `options/takeprofit.ts` | 100 | 止盈学 curve classifier + TP ladder | **Alpha** |
| | `options/kelly.ts` | 106 | Kelly upper reference + mentor critique | **Alpha** |
| | `options/matrix.ts` | 107 | course strategy matrix | **Alpha** |
| | `options/dashboard.ts` | 78 | SPY options dashboard | **Alpha** |
| | `options/journal.ts` | 89 | D.3 journal schema + mentor fields, stats | **Alpha** schema |
| Misc | `reuse/OptionsContractQuote.ts` | 38 | contract identity type | glue |
| | `cli/*` (9 files) | 398 | thin entry points | glue |
| | `types.ts` | 36 | shared types | glue |

**Rough split:** about 2,100 lines are Alpha-specific decision, discipline and synthesis code, about 1,300 are commodity, and about 850 are glue.

## 2. Candidates checked

| Need | Candidate | Stars | Last push | License | TS | npm/wk | Verdict |
|---|---|---|---|---|---|---|---|
| Yahoo market data | **yahoo-finance2** (gadicc) | 803 | 2026-10-14 | MIT | yes | 195k | best JS option; schema-validated |
| | yfinance (Python) | 25.5k | 2026-10-12 | Apache-2.0 | – | – | not worth a Python runtime |
| FRED | node-fred | – | – | MIT | yes | 621 | needs API key; small |
| | fredapi (Python) | 1.7k | 2026-01-28 | Apache-2.0 | – | – | needs key |
| Crypto | **ccxt** | 44.4k | 2026-10-14 | MIT | yes | 113k | mature; heavy for one BTC series |
| RSS/Atom | **rss-parser** | 1.5k | 2026-08-25 | MIT | yes | 868k | de-facto standard |
| | feedparser (node) | 2.0k | 2026-05-18 | MIT (NOASSERTION on GH) | no | – | stream API, older |
| | **fast-xml-parser** | – | – | MIT | yes | 83M | lower-level option |
| Indicators | **trading-signals** (bennycode) | 1.0k | 2026-10-09 | MIT (npm) | yes | 13k | TS-native, streaming, exact math |
| | **indicatorts** (cinar) | 481 | 2026-10-12 | MIT | yes | 20k | broad set incl. Vortex |
| | technicalindicators | 2.5k | **2022-11-03** | MIT | yes | 45k | unmaintained, avoid |
| | TA-Lib (python) | 12.3k | 2026-10-14 | BSD-2 | – | – | C dependency; overkill |
| | ta (bukosabino) | 5.2k | 2026-03-18 | MIT | – | – | Python |
| Option pricing | black-scholes / greeks / implied-volatility (MattL922) | 74/58/45 | 2014–2019 | MIT | no | ~1k | **stale, worse than ours** |
| | **py_vollib** | 441 | 2026-05-29 | MIT | – | – | gold-standard IV (Let's Be Rational); use as test oracle |
| | QuantLib | 7.7k | 2026-10-14 | BSD-like | (SWIG) | – | overkill for European BS on equity options |
| Payoff | optionlab (Python) | 580 | 2026-09-09 | **GPL-3.0** | – | – | license incompatible with easy reuse |
| Clustering/NLP | natural | 10.9k | 2026-02-22 | MIT | yes | – | tokenizers, stemmers, TF-IDF |
| | BERTopic (Python) | 7.9k | 2026-10-14 | MIT | – | – | embeddings; heavy for headline dedupe |
| | news-please (Python) | 2.5k | 2026-04-14 | Apache-2.0 | – | – | article extraction, not needed |
| Storage | node:sqlite (built-in) | – | – | – | yes | – | **already used, zero deps** |
| | better-sqlite3 | 7.5k | 2026-08-10 | MIT | yes | 11.5M | no gain over built-in |
| | drizzle-orm | 36k | 2026-10-14 | Apache-2.0 | yes | – | migrations/types if schema grows |
| | DuckDB | 42k | 2026-10-14 | MIT | yes | – | analytics later (journal stats) |
| Validation | **zod** | 44k | 2026-10-13 | MIT | yes | 347M | schemas for data/in, catalog, journal |
| Charts | lightweight-charts (TradingView) | 17.6k | 2026-10-13 | Apache-2.0 | yes | – | if HTML payoff/levels charts are wanted |
| Backtesting | vectorbt | 9.4k | 2026-10-14 | custom (NOASSERTION) | – | – | check license before use |
| | backtesting.py | 9.1k | 2026-08-05 | **AGPL-3.0** | – | – | avoid unless kept private |
| | nautilus_trader | 30k | 2026-10-15 | LGPL-3.0 | – | – | far beyond need |
| Econ calendar | (none free and maintained) | – | – | – | – | – | investpy is dead; Finnhub/TradingEconomics need keys or payment. Official sources are better |
| Robinhood | robin_stocks | 2.1k | 2026-02-11 | MIT | – | – | unofficial auth; the read-only MCP is safer. Keep MCP |

## 3. Recommendations per module

| Module | Rec | Replacement | Why | Effort | Risk |
|---|---|---|---|---|---|
| `macro/fetch.ts` Yahoo part (+ Yahoo fetch in `cli/volume.ts`) | **REPLACE** | yahoo-finance2 `chart()` | removes UA hack and hand parsing; typed and validated; maintained against Yahoo changes | S–M | Yahoo is unofficial either way; lib adds a dependency and ~breaking majors |
| `macro/fetch.ts` FRED part | **KEEP** (wrap) | – | keyless fredgraph.csv needs no key; node-fred needs a key and is tiny | – | FRED CSV URL change (low) |
| `macro/fetch.ts` Coinbase part | **REPLACE** | yahoo-finance2 `BTC-USD` (or ccxt if more crypto) | one fewer provider path | S | Yahoo crypto timestamps (UTC) differ slightly |
| `ingest/rss.ts` | **WRAP** | rss-parser `parseString()` after our conditional GET | regex XML is the most fragile code here; keep ETag/304 and the date clamp | S | parser differences on odd feeds; fixture tests cover it |
| `ingest/alpacaNewsWs.ts` | KEEP | – | thin, works; Alpaca SDK adds a lot for little | – | – |
| `ingest/officialCalendar.ts` | KEEP | – | no free maintained OSS calendar; official sources are the authority | – | page format changes (static fallback exists) |
| `normalize.ts` + `cluster.ts` | **WRAP** | natural (PorterStemmer, TfIdf, tokenizer) | replace the crude stemmer/IDF and keep Alpha's clustering thresholds and tests | M | cluster boundaries shift; regression tests in `test/cluster.test.ts`/`regression.test.ts` must pass |
| `noise.ts`, `score.ts`, `narrative.ts` | KEEP | – | Alpha-specific topic/asset weighting | – | – |
| `store.ts`, `macro/store.ts` | KEEP | (drizzle only if schema grows) | node:sqlite is built in; zero-dep | – | – |
| `macro/stats.ts` | KEEP | – | 49 lines, tested; a stats lib adds nothing | – | – |
| `levels.ts` | **WRAP** | trading-signals / indicatorts for SMA | swing and volume-profile logic is Alpha's level scoring | S | – |
| `options/stops.ts` technical part (EMA/RSI/MACD/Bollinger/Vortex) | **REPLACE** | indicatorts (has Vortex) or trading-signals | hand-rolled indicators are classic commodity code; keep the "count deteriorating signals" rule | S–M | RSI/MACD seeding conventions differ, so thresholds need re-checking |
| `options/bs.ts` | **KEEP + verify** | py_vollib as offline test oracle | the JS libs are stale (2014–2019) and weaker; QuantLib is overkill. 62 lines with textbook tests | S (oracle fixtures) | low |
| `options/payoff.ts` | KEEP | – | it is the max-loss engine behind the gates; optionlab is GPL-3 | – | – |
| `options/chain.ts`, `robinhood.ts`, `events.ts`, `ivhistory.ts` | KEEP (+ zod schemas) | zod | Robinhood normalization is Alpha-specific; validate inputs instead | S | – |
| `macro/volume.ts` | KEEP logic, REPLACE fetch | yahoo-finance2 | rules are Alpha's | S | – |
| `options/journal.ts` | KEEP schema, **WRAP** validation | zod | the schema (course D.3 + mentor fields) is the product; zod replaces hand checks | S | error messages change |
| rules, pretrade, adjust, discipline, stops (rules), takeprofit, kelly, matrix, dashboard | **KEEP** | – | the differentiator: the mentor's rules, caps and gates | – | – |
| macro regime/confirm/risk/build/render/premarket, digest, alerts | **KEEP** | – | macro-first synthesis and Chinese briefs and alerts | – | – |
| Backtesting | not now | (later: vectorbt or a DuckDB study) | no backtests in scope; check licenses first | – | – |

## 4. Target architecture: Alpha as a thin decision/discipline layer

```
┌──────────────────────────── Alpha (custom, ~2.5k lines) ───────────────────────────┐
│ knowledge/ (mentor verbatim, catalog, courses)  → cited by every rule               │
│ decision layer: rules · pretrade gate · adjust · discipline · stops · takeprofit ·  │
│                 kelly (reference only) · matrix · journal schema                    │
│ synthesis: macro regime · confirm · risk/NO_TRADE · premarket · volume rules        │
│ output: Chinese briefs (digest, premarket, macro), alerts + scoring                 │
├──────────────────────────── adapters (thin, typed with zod) ───────────────────────┤
│ market: yahoo-finance2 (prices/OHLCV/BTC) · FRED keyless CSV · Robinhood MCP files  │
│ news: conditional GET + rss-parser · Alpaca client · official calendar scrapers    │
│ nlp: natural (tokenize/stem/TF-IDF) → Alpha clustering thresholds                   │
│ indicators: indicatorts / trading-signals                                           │
│ pricing: bs.ts (oracle-tested vs py_vollib) · payoff.ts                             │
├──────────────────────────── platform ──────────────────────────────────────────────┤
│ Node 24 · node:sqlite · cron/routine → scripts/run.sh                               │
└────────────────────────────────────────────────────────────────────────────────────┘
```

Rules for the boundary:
- Adapters return plain typed data (zod-validated). No library type leaks into the decision layer. A replacement swaps one adapter file.
- The decision layer stays pure and dependency-free, so all the mentor/discipline tests keep running offline.
- Each adapter is pinned with fixture tests (already present for RSS, Yahoo, FRED, Robinhood).

## 5. Top 5 to do first

1. **yahoo-finance2 for every Yahoo call** (`macro/fetch.ts`, `cli/volume.ts`, premarket series). It is the largest fragile surface, and BTC moves here too, dropping the Coinbase path. Effort S–M.
2. **rss-parser behind our conditional GET** (`ingest/rss.ts`). Removes regex XML parsing. Effort S.
3. **indicatorts or trading-signals for EMA/RSI/MACD/Bollinger/Vortex/SMA** (`stops.ts`, `levels.ts`). Effort S–M; re-check thresholds.
4. **zod schemas for all external inputs** (`data/in` chains, earnings, watchlist, proposals, journal, catalog). Turns silent bad data into explicit "provide X" errors. Effort S.
5. **natural for tokenizing, stemming and TF-IDF in clustering** (`normalize.ts`, `cluster.ts`). Effort M; the regression tests gate it.

Also cheap: add py_vollib-generated oracle fixtures to `test/options.test.ts` to pin `bs.ts`, rather than replacing it.

Net effect: about 600–700 lines of commodity code move to maintained libraries. All decision, discipline, knowledge and Chinese-output code stays custom.
