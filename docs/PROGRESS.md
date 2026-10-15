# Alpha progress

**Goal:** a macro-trading decision aid for one user. In priority order:
1. News and event alerts (the core feature).
2. Daily macro brief with a macro-first conclusion.
3. Risk and discipline gates: defined risk, caps, NO_TRADE.
4. Mentor knowledge base feeding 1–3.

Technicals are for timing only. Update this file after every task.

_Last updated 2026-10-15 09:45 ET (risk plan on paper open, formal/practice, 今日交易计划)._

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
