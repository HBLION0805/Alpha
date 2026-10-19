# Alpha progress

**Goal:** a macro-trading decision aid for one user. In priority order:
1. News and event alerts (the core feature).
2. Daily macro brief with a macro-first conclusion.
3. Risk and discipline gates: defined risk, caps, NO_TRADE.
4. Mentor knowledge base feeding 1–3.

Technicals are for timing only. Update this file after every task.

_Last updated 2026-10-17 ET (交易心理 batch: verbatim topic files, warn-only psych tags, journal, confidence ratio)._

**Delivery is handled:** the 30-minute weekday routine `alpha-2` (08:00–18:30 ET) runs the alerts and messages the user, starting 2026-10-15. The CPI lag on 10/14 happened only because routines had not started yet.

## Status

| Goal | Modules | Wired into run.sh | Actually ran | Status |
|---|---|---|---|---|
| (1) Alerts | ingest/rss, adapters/rss, sources, store, normalize, adapters/nlp, cluster, noise, score, alerts, cli/poll, cli/alerts | yes, every run | 2 manual runs; routine alpha-2 from 10/15 | ✅ scheduled + delivered (alpha-2) |
| (1) recall | score `shipping` topic + stemmed war terms; cluster Gulf/chokepoint event family | yes | Hormuz/Aramco fixture: one 6-outlet cluster, score **90** (was 43) | ✅ P2 done; golden recall 1.0, precision 0.897 (gate 0.88) |
| (1) Trump | trump.ts, ingest/xTrump.ts; sources `trump_truth` (trumpstruth.org RSS) + `trump_x` (data/in/x-trump.json from the routine's x MCP call) | yes (poll + alerts) | live 10/15: feed 100 items, 5 market posts in 3 days scored 73–76; X file 10 link-only posts (ignored) | ✅ new; X needs the alpha-2 step below |
| (1) | ingest/alpacaNewsWs, cli/stream | no | REST backfill only | optional |
| (2) Brief | macro/brief + cli/brief (`npm run brief`): macro + premarket + scenarios + levels + calendar, ONE verdict, 7 sections | yes, every run (macro-latest.json still feeds the digest) | live 10/14 22:33 ET: NO_TRADE, leader hawkish, 35 series fetched once, 0 failed | ✅ P3 done; old cli/macro, premarket, scenarios deleted |
| (2) plan | macro/tradeplan.ts: brief §2.1 今日交易计划 (if-then candidates, confirmation ≥3/4, explicit no-trade list; only planned triggers intraday) | yes, every brief | live 10/15 09:40: hawkish leader, SPY/QQQ/IWM short 2/4, TLT short 1/4 → NO_TRADE | ✅ new |
| (2) oil | macro/oil.ts: 【用户要求】原油, brief §3.1 right after bonds (user's own requirement, not mentor/DK) | yes, every brief | live 10/15 09:00: WTI 94.00, Brent 104.42, spread $10.42 (5d −$2.37), no alarm | ✅ alarms OIL_SPIKE 80 / OIL_CRASH 70 / BRENT_WTI_WIDEN 65 (+5 with shipping news) → alerts |
| (2) timing | macro/volume, levels, adapters/bars, adapters/indicators | volume in its windows; levels inside the brief | levels live in the brief (SPY/QQQ/IWM) | ok / volume still needs `data/in/` chains |
| (3) Gates | options/rules, pretrade, discipline, stops, adjust, payoff, bs | via `options --proposal` (manual) | tests + examples | ✅ logic |
| (3) | options/plan (managementPlan + Kelly cap + take-profit ladder), printed with every proposal | `options --proposal` | examples | ✅ wired (Kelly only when `pAssumed` is given) |
| (3) | rules.effectiveRules: user overrides may only lower caps (1%, 3%, 1 adjustment, 2% daily, maxConcurrentPositions 10) | everywhere checkBook is used | tests | ✅ new |
| (3) | discipline: motive check (share/entertain/excitement → BLOCK), concurrent cap, ownership + premature-exit prompts | pretrade | tests | ✅ new (mentor-winrate-review) |
| (3) | options/journal (+ paper fields), options/readiness, cli/readiness (`npm run readiness`) | manual | example journal only | ✅ built / ⚠️ no paper trades logged yet |
| (3) | options/paper + cli/paper (`npm run paper -- open\|close\|list\|mark`) → data/journal/paper.json | manual | live smoke test 10/14 (INTC; refused on PPI 48h BLOCK) | ✅ new; no order path |
| (3) | options/riskplan: mandatory on `paper open` (hedge method + detail; stock −7% stop + invalidation; option max loss + invalidation + stored 30/30 date / −30% level; ≤1% hard cap; first stop wins, never widen); journal `kind: formal\|practice` (practice excluded from readiness, shown separately) | via paper open | tests | ✅ new |
| (3) | review/critique (唱反调, deterministic) before every `paper open`; docs/CRITIQUE_PROMPT.md for chat | via paper open | tests + live smoke | ✅ new |
| (3/2) | options/chain, robinhood, dashboard, matrix, ivhistory, events | only if `data/in/spy-chain.json` exists | never | frozen |
| (4) KB | knowledge/*, catalog.json (67 items, 27 sources) | cited by brief, pretrade, readiness | yes | ok |
| (3) tier-2 08:30 releases | calendar: CLAIMS (DOL rule + exceptions), HOUSING / DURABLES / TRADE (Census); tier 2 = listed only | brief §6 今天 8:30 / premarket 今日经济日历 / card §7 | test/releases.test.ts | ✅ 2026-10-19 |
| (3) VIX 分档 (user infographic) | oilvix.ts vixRegime: 🟢/🟡/🟠/🔴 bands + ⚡ 急升 / ↘ 回落; phase-1 override of 分批布局 | brief §4 | test/vixregime.test.ts | ✅ 2026-10-19 |
| (3) 今日能不能睡 (mentor day list) | macro/sleepday.ts + nyse.ts: OpEx / quad witching / FOMC / Fed speakers / Trump 24h / CPI·NFP vs Monday / summer / Xmas–NY / Thanksgiving week / long-weekend eve; 不能睡 wins | brief §1 (premarket + afternoon) | test/sleepday.test.ts | ✅ 2026-10-18 |
| (3) oil / VIX (mentor premarket video) | macro/oilvix.ts: oil 1d/5d speed ⚡, demand-vs-supply heuristic (copper HG=F), JETS/XLY pressure note, VIX vs SPX/NDX 方向确认 / 背离; mentor `oil_speed` / `vix_confirm` / `oil_squeeze`; VIX call hedge = phase-2 reference | brief oil block + §4 | test/oilvix.test.ts | ✅ 2026-10-18 |
| (3) liquidity watch | macro/liquidity.ts: SOFR−IORB, SOFR−2Y, WRESBAL 13w, MOVE, BTC vs $70k/200DMA → 逆风减弱（观察）/ 顺风确认 / 无信号 (flag only); mentor `liquidity_chain` on plan card + §1.1 | brief §1.2 every run (6h cache) | test/liquidity.test.ts | ✅ 2026-10-18 |
| (3) daily cap / covered-call stop | countsTowardDailyCap everywhere (real_practice out of pretrade + 暴怒 breach too); risk plan stock-leg −7% stop + 30/30 for stock+option structures; mark-time stopHits | via paper / brief / readiness | test/stockleg.test.ts | ✅ 2026-10-17 |
| (3) stock legs / daily cap | journal.ts normalizeLeg (stock { qty, price } → premium/strike) in mark / expire / load; expire settles combos with stock; practice hard-refuse only for undefined max loss; mentor_shadow counts toward the $100/day cap (countsTowardDailyCap: brief 暴怒, 暴怒 tag, readiness day check) | via paper / brief / readiness | test/stockleg.test.ts | ✅ 2026-10-17 |
| (3) shadow | shadow/engine.ts + cli/shadow.ts: forward tracking of backtest tracks A (v2a) / B (v2b + 200DMA short block), $5k virtual each, separate ledger; weekly §八之五 | run.sh weekdays 16:30–18:59 ET after the brief | first run 2026-10-17 (start 10/16 close) | ✅ new 2026-10-17; info only |
| (3/4) 导师提醒 | review/mentor.ts: brief §1.1 导师提醒 (state-selected, ≤3, rotating verbatim quotes); plan card / paper open "导师怎么说" per warn tag; losing close → 4 attribution questions + 🔁 repeat error (30 days) | brief every run; card; paper open/close/expire | tests (230 passing); samples in /workspace/mentor-inbox/samples/ | ✅ new 2026-10-17; warn-only |
| (3/4) psych | knowledge/mentor/psychology/ (12 verbatim topic files + video summary + 7 images, manifest-verified); options/psych.ts warn tags (72h, add-to-loser, pyramid, size after wins, day after big win, entry window, put strike, ticker magnetism); `paper journal` 6 问 + 赚钱但做错; loss classes risk/variance; weekly §八之四 交易信心; ROUTINE_WEEKLY 周末清单 | via paper open / review / weekly | tests (225 passing) | ✅ new 2026-10-17; warn-only, defaults untested; 72h rule uses the official FOMC/CPI/NFP calendar (knowledge/calendar/major-events-2026-2027.json) |

## Phase: paper trading (now)

Paper-trade simulated entries on real data. Journal every trade, review every trade, focus on logic and rule-keeping, not P&L.

- **Journal support (added):** `mode: "paper"`, `capitalAtEntry`, `thesisRecordedAt` / `stopRecordedAt` (must be ≤ `openedAt`), `violations[]`, `motive`, `concurrentAtEntry`, `exitKind` + `timeStopAt` (premature-exit detection), `lossReview {errorClass: judgment|execution, errorTags[]}`. Example: `examples/paper-journal.json`.
- **Live-readiness scorecard** (`npm run readiness -- --journal data/journal/paper.json`), Chinese output, paper trades only. All five must pass:
  1. ≥30 paper trades over ≥60 days, including a shock period (VIX > VIX3M from the macro store, or a high-impact release day).
  2. Positive expectancy, still positive without the top 2 winners. Win rate is context only (mentor: a low win rate is fine if losses stay controlled).
  3. No trade lost >1% and no day lost >2%; max drawdown reported.
  4. Violations ≤1 (chasing, unplanned add, emotional sizing, share/entertain motive, over the concurrent cap); thesis and stop recorded before entry on every trade. Also reports peak concurrent positions and premature exits.
  5. Every loss reviewed and classified judgment vs execution; repeated error tags flagged.
  After passing: real money at **quarter size for about 20 trades**, then normal size. Caps never change.
- **Paper CLI (built):** `npm run paper -- open --proposal p.json --thesis … --invalidation … --stop … --motive thesis [--time-stop D] [--ack]`.
  - Refuses without the four fields. Refuses on any preTradeChecks BLOCK/NO_TRADE, on the position cap (counted from open paper trades), and when the proposal price is >3% off live Yahoo.
  - Runs the 唱反调 critique first. A BLOCK refuses. WARNs need `--ack`. The critique is saved in the entry.
  - `mark` uses the Robinhood chain JSON in `data/in/*chain*.json` when the contract is there; otherwise Black-Scholes on the Yahoo spot with the entry-implied IV. Each leg's source is printed.
  - `close --exit-kind … [--pnl] [--error-class judgment|execution --error-tags …]`: a loss cannot close without the review fields.
  - `list` shows positions plus readiness stats.
- **唱反调 objections:** scenario/brief contradiction, vague invalidation/stop, stop at an obvious level (round number, 20-day or prior-day high/low), same-underlying or correlated stacking, FOMO (futures gap ≥1.5%, low-volume 20-day breakout), 48h event, EV or R:R, weak motive or thesis, horizon vs DTE.
  - BLOCK only for existing hard rules: 48h event, non-thesis motive, 3% per underlying.
  - Readiness criterion 5 reports losses that followed `--ack`'ed warnings.
- **Gaps still open:**
  - Violations other than motive, cap and critique are self-reported.
  - Paper daily loss uses realized P&L on the close day plus the last marks (no intraday path).
  - Single stocks map to SPX for the scenario check; the correlation groups are coarse.
  - `strategyStats` / `journalHealth` do not yet separate paper from live.

## Routine (alpha-2) output paths

The premarket and scenarios reports no longer exist. Read:
- `data/out/brief-latest.md`: the Chinese daily brief (send this). `data/out/brief-latest.json` has `{generatedAt, verdict, reasons, leader, previousLeader, scenarioChanged, alarms, failed}`.
- `data/out/scenarios-latest.json`: `{generatedAt, leader, previousLeader, changed}`. **Scenario-changed flag = `changed`** (also `scenarioChanged` in brief-latest.json). It is true only on the run where the leader flipped; the alert itself is also inserted into the store, so it arrives through alerts.
- `data/out/volume-latest.md`: volume anomalies (written 07:00–09:29 and 16:15–16:59 ET only).
- `data/out/alerts-latest.md`, `data/out/alerts.jsonl`: new alerts (also printed on stdout by run.sh).
- `data/out/digest-latest.md`: digest. `data/out/macro-latest.json` is internal (digest input).

## Trump posts (2026-10-15)

- Truth Social through the public mirror `https://www.trumpstruth.org/feed`: full text, 100 latest posts. The bare host only serves an HTML redirect.
- X @realDonaldTrump (id 25073877) through the routine: the `x` MCP response is saved to `data/in/x-trump.json` and read with zod. If the file is more than 90 minutes old, poll flags it as stale.
- Scoring (`src/trump.ts`):
  - No multi-outlet confirmation.
  - ≥70 for a direct market topic: tariffs/trade, China/Taiwan, Fed/rates, oil/Iran/Hormuz, sanctions, crypto, companies/tickers, markets.
  - ≥85 for a tariff, Fed or war action.
  - Ignored: rallies, media attacks, endorsements, media-only posts, and war words without a market link.
- Alert: Chinese headline, the post quoted verbatim (links and whitespace stripped), links, likely assets, and 「宣布≠执行，等市场确认」. The same post on both platforms produces one alert.
- Gaps:
  - Most X posts are bare t.co links (media or crossposts), so X rarely adds text. Truth Social is the primary source.
  - The mirror is third-party. If it breaks, poll shows the error, but there is no second mirror yet.

## Scope check against the core goal

- (1) Alerts: recall fixed, delivery via alpha-2, and Trump posts added as a direct market-event source (on goal: it shortens time-to-alert for policy shocks). Core is covered. Next work there is tuning from real alpha-2 output, not new features.
- (2) Brief: one report, timing fixed. Done.
- (3) Gates: paper CLI + critique + readiness exist so the user practices rule-keeping before real money. This directly serves the goal (discipline gates). It is the last build in (3) for now.
- Not added: no real order path, no new options features (layer stays frozen), no LLM in the critique.
- Watch: the options layer + paper + critique is now the largest code area. Freeze further (3) work until the paper journal has real entries.

## Mentor win-rate review (2026-10-14)

Saved verbatim: `knowledge/mentor/reviews/winrate-drop-review.md` and `defensive-portfolio-2026-10.md` (+ png). Source id `mentor-winrate-review`.
- Already covered, citation added: thesis-stop, time-stop, psych-entry-comfort (premature exits), psych-responsibility (ownership), psych-loss-attribution.
- New items: max-concurrent-positions, psych-no-performance-trades, psych-winrate-not-failure.
- BAC "add to all positions" is NOT encoded. Adds stay at most one, only after the thesis is reconfirmed (ADD_RULE); never adding to a loser because it is cheaper.

## Next 3 priorities

1. Start logging real paper trades (`npm run paper`), with critiques, daily marks, and a review on every close.
2. Watch alpha-2's first week: alert noise and timing, and whether brief-latest.md is the right message. Tune only with fixtures.
3. Separate paper from live in journal stats, and add `paper mark` to the routine once trades exist (cheap, read-only).

## 2026-10-15
- The mentor's 市场情景对照 matrix is saved verbatim (knowledge/mentor/macro/market-scenario-matrix.md, source mentor-scenario-matrix). It is deduped; the original image is in the user's chat.
- New classifier src/macro/matrix.ts covers four dimensions: 10Y, WTI, SMH/QQQ (a proxy for tech earnings), and jobs (ICSA/PAYEMS, otherwise unknown). Its output is in brief §1 as 【大佬情景对照】 and flags disagreement with the leading scenario.
- Journal: new field `source: real_practice`. The NVDA 202.5/200P (exp 10/16) trade is logged as kind=practice; fixture at examples/journal/. It is excluded from readiness. Lesson: for short-window continuation trades, keep the long strike near ATM.
- Mentor daily note (gold + OpEx tech rebound) saved verbatim to knowledge/mentor/daily/. Calendar now has monthly OpEx (3rd Friday; DK addition, src/macro/opex.ts).
- Simulation capital defaults to **$5,000** (src/config.ts; ALPHA_CAPITAL overrides). That gives 1%/trade = $50 and 2%/day = $100. Used by the brief plan, paper open and readiness; data/journal/paper.json capital = 5000. Live money later scales the same caps proportionally.
- Trump: the primary source is now `trump_truth_official`, the official Truth Social public API (no login). From the box, curl gets 200 but Node fetch gets a Cloudflare 403, so it is fetched with curl. The account RSS returns an HTML shell, so it is unusable. The trumpstruth.org mirror stays as the fallback, and the same text is deduped into one alert (trump.ts postKey).
- Journal `source: mentor_shadow` (practice, excluded from readiness). Three 10/15 10:35 ET shadows of mentor calls, thesis verbatim: NVDA 220/225C 10/23 ($1.60, spot 215.93), INTC 95/100C 10/23 ($1.40, spot 91.97), GDX 90C 11/20 ($2.60, spot 85.17). Each max loss ($160/$140/$260) exceeds the $50 1% cap at $5k and is tagged exceeds_1pct_cap_at_5000.
- `paper open` now requires `--tp short_dated|narrative|windfall` (src/options/tpplan.ts, citing take-profit.md):
  - short_dated: +30% sell ≥50%, +50% sell the rest, close by the day before expiry.
  - narrative: +100% sell 50%, +200% sell 25%, 25% runner.
  - windfall: +80% take ≥90% off.
  - ≤14 DTE forces short_dated. `paper mark` prints 「止盈触发：按计划执行」 once per target hit and on the close-by date.
- Real-account practice records (source real_practice, P&L from the 11:40 ET 10/15 Robinhood screenshot; entry costs unknown, kept null with costUnknown):
  - CRWV 55/50P 10/16 −$4 (was ~+$20 earlier).
  - VIX 20/25C 10/21 AM −$6.
  - AAPL 335/325P 10/30 −$44, invalidation: close above 335. DK: AAPL counts as tech, so the rotation thesis is questionable.
  - NVDA updated to −$1, so the $2 debit is uncertain.
  - CRWV, NVDA and VIX are execution errors tagged no_pre_set_take_profit. Lesson: 止盈必须开仓时写死。
  - real_practice records are never marked by `paper mark` and don't count toward the position cap.

## 2026-10-15 evening — paper ledger P0
- Marks: Robinhood read-only option quotes (data/in/rh-option-quotes.json, gitignored) are used first.
  - Black-Scholes fallback uses a sane per-leg IV: quote → leg → entry-implied (only from a real premium ≥$0.05) → 30% default, clamped 10–200%.
  - BS marks are flagged `estimated` (估算). This fixes the 3–7% IV bug on mentor short legs.
- Entry prices backfilled from Robinhood option orders (read-only, `entryPriceSource: robinhood_orders`):
  - NVDA 202.5/200P: debit 0.04, closed 0.01 → −$3.
  - AAPL 335/325P: debit 2.25, closed 1.94 → −$31.
  - CRWV 55/50P: debit 0.12.
  - VIX 20/25C: debit 0.21.
- `paper expire`:
  - Equity/ETF PM-settles at the expiry-day close (Yahoo) from 16:00 ET.
  - VIX AM-settles and requires `--settle VIX=<VRO>`; it is never the close.
  - Mentor weekend rule: a losing mentor_shadow trade at Fri ≥15:45 ET is closed at that day's mark.
- P1:
  - Formal paper trades require `--plan-id` from today's brief §2.1 (`YYYY-MM-DD-TICKER-side`, in brief JSON + §2.1). Ticker, side and entry zone must match, otherwise use `--kind practice`.
  - `paper mark` prints 🚨 超限 for an open loss over $50 or a day (realized + unrealized, simulated only) over $100. Mentor/any entries with max loss over $50 are flagged `exceeds_1pct_cap`.
  - `paper review` writes a post-mortem for every closed trade, wins included (judgment / execution / luck / good; a loss can't be luck).
  - `paper mentor` records the mentor's actual result and prints ours vs the mentor's.
  - Repeated tags and same-symbol lessons → critique WARN past_mistakes / past_lessons.
- P2:
  - Readiness: max drawdown ≤6% ($300 at $5k), top-2 winners ≤50% of net P&L, 90-day rolling window, practice breakdown (simulated / real account / mentor shadow).
  - `npm run review [-- --week]` → data/out/review-<date>.md (summary + per-trade cards).
- GEX in brief §5.1 (src/options/gex.ts, config/gex.json; CBOE delayed; naive; timing only).
- Paper close step in scripts/run.sh (weekdays 15:45–16:59 ET): mark → expire (+ VIX settle.json, weekend rule) → review. Marks are one per trade per ET day. The routine refreshes quotes per docs/ROUTINE_PAPER.md (`paper legs`).

## 2026-10-15 — 入场前计划卡 (pre-trade plan card)
- `npm run card -- --sym NVDA --dir bear [--structure put_spread --legs "+210P,-200P"] --exp 2026-10-23 [--thesis ...] [--save]`
- 8 sections (plan match, macro, hedge, two stops, staged TP, max loss vs $50/$100, GEX/levels/events, devil's advocate + past mistakes) → ✅ 可做(正式) / 🟡 仅练习 / 🛑 不做.
- `--save` → data/journal/pending-cards.json; `paper open --card <id>` links. Tests: test/card.test.ts.

## 2026-10-15 — earnings coverage + Fed speakers
- `src/options/earningsStore.ts`: merges earnings.json + earnings-by-symbol.json (Robinhood get_earnings_results, read-only), confirmed vs estimated. `npm run earnings [-- --need]`. Routine text: docs/ROUTINE_EARNINGS.md.
- `src/ingest/fedSpeakers.ts`: Fed Board official calendar JSON → speaker, role, voter, time ET, topic; FOMC blackout (2nd Saturday before → day after). Regional presidents not on that calendar → marked unavailable. `npm run fedspeak`; brief §今日经济日历 + card §7/§8.
- Card: earnings inside expiry → risk item (§7 warn + §8); voter speech before expiry → warn.

## 2026-10-15 — regional Fed presidents in fedspeak
- `src/ingest/fedRegional.ts`: 12 banks (official speeches/events page scan, nearest-date pairing) + labeled secondary metalsmine weekly calendar (exact UTC→ET time, topic from history page). curl→fetch fallback; JS-only/failed pages = unavailable.
- 2026 voters verified (fomc.htm + Jan 2026 minutes): NY, Cleveland, Philadelphia, Dallas, Minneapolis. Atlanta = interim Venable.
- Merge Board + official + secondary, dedupe (same speaker/date, ≤2h), anything listed inside a blackout flagged suspicious. Per-bank coverage in `npm run fedspeak`, brief and card.

## 2026-10-15 — mentor reading (Milgram) + weekly review
- knowledge/mentor/reading/milgram-experiment.md: mentor assignment verbatim + separate "DK 整理" summary/trading takeaway; catalog source `mentor-reading-milgram`, item `authority-bias`.
- `npm run review -- --week [--print]` → data/out/review-week-<date>.md: 4 categories, readiness progress, tags week-over-week, lessons, mentor vs actual, 3 data-derived focus items (src/options/weekly.ts). Shock dates shared via src/options/shockdates.ts. Routine: docs/ROUTINE_WEEKLY.md.

## 2026-10-15 — practice = learn from mistakes (docs/DECISIONS.md)
- paper open --kind practice: hard = saved plan card (direction, thesis, stop, TP) + defined risk; all other refusals → `warnTags` (+ `violations` for cap breaches). Formal unchanged.
- Card: new verdict 🟢 可练习（有提示） with warn tags; 🛑 for practice only when plan fields are missing.
- Weekly review: 门槛校准 (14-day window, per warn tag: n, win rate, avg P&L, avg loss vs no-warning trades; promote/keep/drop, min 10 closed).

## 2026-10-15 — external: 做交易的正确思路 7 步
- knowledge/external/trading-correct-approach-7-steps.md (+ screenshot): user-collected, verbatim, layer 1 of 3; DK 整理 three-layer foundation mapped to Alpha modules; catalog item `single-trade-flow`.

## 2026-10-15 — knowledge/framework/toolbox-layers.md (DK 整理), catalog `toolbox-layers`

## 2026-10-17 — mentor: 股市七宗罪 → per-trade behaviour tags (warn-only)
- knowledge/mentor/discipline/seven-sins.md: mentor article (Discord 夜雨 [RNMK]) verbatim + DK checklist; catalog source `mentor-seven-sins`, item `behavior-seven-sins`.
- src/options/sins.ts: 7 sins (sloth/wrath/greed/envy/gluttony/pride/lust); auto candidates only from ledger data, manual tags in `JournalEntry.behaviorSins`; mentor-shadow trades excluded.
- `npm run paper -- sin --id … --sin … [--remove …]` (manual) and `paper sins [--backfill]` (list / store auto candidates).
- Weekly review §八之三 七宗罪: per-sin counts (week auto/manual, 30 days), most frequent = next month's focus; daily review cards show sins. Practice opens add warn_sin_wrath/gluttony/greed (warn only, no new block).
- Backfill on data/journal/paper.json (backup /tmp/paper.json.bak-20261017-112238): sloth 12, greed 7, wrath 5, gluttony 2, lust 2, envy 0, pride 0. 10/16: no trade opened after the −$147 sim day (BAC −49.5 + two mentor shadows, realized 16:00–16:05 ET) → no wrath from that breach.
- Tests: test/sins.test.ts.

## 2026-10-17 — mentor: 进阶长期仓位管理策略 → phase-2 reference playbook (not active)
- knowledge/mentor/phase2/long-term-position-management.md: mentor article verbatim + DK phase-2 table (cash-secured put entry, covered OTM calls on ~half, protective puts, ITM covered calls in narrative headwinds, collars) and the phase-2 review check "thesis holds, or won't admit wrong?".
- Catalog: source `mentor-long-term-position-management`, items `phase2-long-term-position-management` (PHASE 2 ONLY), `phase2-thesis-or-ego`.
- DECISIONS 2026-10-17: naked short calls stay blocked; CSP / covered calls are phase 2 only with shares or full cash collateral; not enabled now; no execution logic built. Open item noted: rules.ts already exempts strategy `cash_secured_put` from the uncovered-short check without a cash check (unchanged, needs user confirmation).

## 2026-10-17 — mentor: 做空学 → short-side checklist (warn-only) + machine-readable spec
- knowledge/mentor/discipline/short-selling.md: both mentor texts verbatim (byte-identical to the inbox file, cmp + sha256 verified; no author names/timestamps in the source) + DK 整理. The DK section has a reuse map to 纪律 #05/#07/#08/#18/#19, stop-loss time stop, take-profit, seven-sins and phase2, the checklist table, and an honest covered-put note. README row added.
- src/options/shortside.ts `shortEntryChecks` (pure, daily OHLC + SPY + sector ETF). Tags: short_vs_strength, short_no_relative_weakness, short_chasing, short_squeeze_prone, short_squeeze_risk_unchecked, short_expiry_too_short, short_invalidation_not_above_spot, short_data_insufficient. It also reports a "failed rebound" ✅ and a 6-item manual checklist.
- Wired into: plan card §9 for `--dir bear` (new flags `--sector`, `--squeeze-check`, `--horizon`; card.shortTags; verdict unchanged), `paper open` side=short (`--sector`, `--squeeze-check`; JournalEntry.shortChecklist; practice → warnTags → weekly 门槛校准), and the review trade card (tags + manual questions).
- knowledge/mentor/discipline/short-selling.rules.json: 13 items with thresholds, formulas and `autoFromDailyOHLC` / `liveImplemented` flags. The divergence exit and panic take-profit items are spec-only backtest candidates. test/shortside.test.ts keeps the spec in sync with the code.
- Practice gap closed: short stock / covered put / naked short options are now refused even as practice (`paper.ts nakedShortLegs`). DECISIONS 2026-10-17. Catalog: source `mentor-short-selling`, items `short-side-checklist`, `phase2-short-stock-covered-put`. Cross-links were added to psych-short-weakness, psych-extreme-point-precision, size, psych-thesis-position-separation, phase2-thesis-or-ego, behavior-seven-sins and time-stop.
- Tests: test/shortside.test.ts (12).

## Trump on both platforms (2026-10-19)
- Trigger: the 2026-10-18 16:36 ET Truth Social post on Russia (diesel sanctions; scored 76) produced no Trump alert. It came through only via news.
- Root cause: this was not "X only". The mirror had ingested the post (`trump_truth`), but it was first fetched 15h later (no runs overnight). `trumpAlerts` only took posts *published* in the last 12h, so it was dropped.
- Fixes:
  - `src/cli/trump.ts` (`npm run trump`) runs first in every `scripts/run.sh` pass. It tries the official API (now Cloudflare 403 from the box), then falls back to the trumpstruth.org mirror, and writes `data/in/truth-trump.json` (same core shape as x-trump.json plus `source:"truth"`, `repost`, `postType`, and the original truthsocial.com URL). It merges with x-trump.json into `data/in/trump-posts.json`. If the fetch fails it prints one warning line, keeps the old file, and the run goes on with X only.
  - `trump_truth` is now kind `truthfile`; `trump_truth_official` is disabled.
  - Cross-post dedupe (`src/trumpPosts.ts`): normalized text that is equal, contained, or has token Jaccard ≥ 0.8, within 6h. Mirror placeholders like "Video post from…" never merge.
  - Alerts: one alert per post across platforms, with the platform and both links. A post first *fetched* in the window also alerts if it was published ≤ 36h before, with a 晚到 N 小时 note.
  - 能不能睡 / brief: `trumpSignal` merges both platforms and reports per-platform counts and freshness (a platform with no post in 24h gets a warning). Each post line shows the platform, ET time and link.
- Live 10/19 10:35 ET: official API 403; mirror 99 posts; X 20 posts; 113 merged (5 cross-posts).

## 大佬 死猫反弹 vs 见底 (2026-10-19)
- **Archive:** knowledge/mentor/market-calls/dead-cat-2026-10-19/ (article plus 10 figures, sha256 manifest).
- **Brief §1.3** (`src/macro/deadcat.ts`), shown on every brief, display only:
  - 【大佬经济情景表】 (fig8), compared against the older 【大佬情景对照】;
  - 死猫 vs 见底 checklist with DK's 3-of-4 bottom flag.
- **Plan card / losing close:** reminders `dead_cat_rebound` and `oil_hurts_defensives`.
- **New series** (brief only, kept separate from the premarket data): SPY, QQQ, XLP, XLV, XLU, RSP, EWF=F.
- **Live 10/19 10:47 ET:**
  - Economic table: 滞胀 4/4 (WTI +4.4% 5d, DXY −0.61%, 30Y −14bp, defensives +1.7% vs QQQ/SMH −4.8%). It disagrees with 【大佬情景对照】 (轮动 2/4).
  - Checklist: WTI 🟢 97.88 falling; KOSPI 🟢 5768 (+1.76%); RSP 🔴 −0.32% (rotation reversing); VIX 🟡 17.81, cooling on day 1 after the 19.99 spike; NQ 🟡 29792.
  - Bottom conditions: 1/4 met → the dead-cat call is not overturned.
- Rules: docs/MENTOR_DEADCAT.md.

