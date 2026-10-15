# Alpha — 新闻事件提醒 · news & event alerts

## 核心原则 / Core principle

**中文：** 我在积累本金。**少亏比多赚更重要。** 今后每一个功能都必须风险优先：
- 任何想法之前，先定义**最大亏损**和**失效条件**（什么情况证明我错了）。
- 优先**有限风险**结构；**不做裸卖期权**。
- 设定**单笔仓位上限**和**亏损上限**（单笔 / 每日 / 账户）。
- **NO_TRADE（不交易）是合法、常见的结果。**
- 复盘**先看亏损**，再看盈利。

**English:** I am accumulating capital. **Losing less matters more than making more.** Every feature must put risk first:
- Define **max loss** and **invalidation** before any idea.
- Prefer **defined-risk** structures; **no naked short options**.
- Enforce **position and loss caps** (per trade / per day / account).
- **NO_TRADE is a valid outcome.**
- Reviews look at **losses first**.

The owner's trading experience (playbook, psychology, bias questions, phase prompts, worksheet, macro research) lives verbatim in [`knowledge/`](knowledge/README.md).
老交易员的经验（手册、心理、偏误问题、阶段提示、工作表、宏观研究）逐字保存在 [`knowledge/`](knowledge/README.md)。

## 是什么 / What it is

**中文：** 面向美股、美股期权、加密货币和黄金的低延迟新闻管线：多立场来源 → 去重 → 事件聚类 → 打分 → 左/中/右/中国官方/美国官方叙事对比 → 提醒与摘要；外加官方经济日历和关键价位计算。需要 **Node 24+**。

**English:** Low-latency news pipeline for US stocks/options, crypto and gold: stance-tagged sources → dedupe → event clustering → scoring → cross-stance narrative comparison → alerts & digest; plus an official release calendar and key-level calculator. Requires **Node 24+** (`node:sqlite`, native TS).

```
npm install
npm run poll                       # fetch enabled feeds (+ Alpaca REST backfill if ALPACA_KEY/ALPACA_SECRET)
npm run stream -- --seconds 600    # Alpaca/Benzinga websocket → SQLite (lowest latency)
npm run alerts                     # only NEW / escalated clusters since last run (state in SQLite); --format json
npm run digest -- --out d.md       # 24h markdown digest (atomic write) with FOMC/CPI/NFP/PPI/PCE/GDP calendar
npm run brief                      # 统一中文日报 daily brief (macro + premarket + scenarios + levels, ONE verdict) → data/out/brief-latest.{md,json} (+ macro-latest.json, scenarios-latest.json); --no-alarms
npm run paper -- open|close|list|mark  # 模拟交易 only (no order path): 唱反调 critique first, --ack for WARNs → data/journal/paper.json
npm run readiness                  # 实盘准备度评分卡 from the paper journal (5 criteria)
npm run options -- chain.json --direction bull --bars spy-daily.json --earnings earnings.json --book positions.json --journal journal.json --proposal trade.json
                                   # 期权工具箱 → data/out/options-latest.{md,json}; saves daily IV30 to SQLite for IV rank
npm run levels -- bars.json        # key levels from Robinhood historicals JSON (MCP output saved to a file)
npm run run                        # scheduled entry: poll → alerts → digest (scripts/run.sh, flock-protected)
npm run calendar:snapshot          # refresh calendar/releases-<year>.json fallback
npm test && npm run typecheck
```

## 结构 / Layout

- `sources.yaml` — sources with stance / tier / verified status (dead feeds kept with notes).
- `src/ingest/` — `rss.ts` (RSS/Atom/Google-News sitemap, timeouts, ETag/If-Modified-Since), `alpacaNewsWs.ts`, `officialCalendar.ts` (Fed FOMC page, FRED release calendars, BEA schedule; static fallback in `calendar/`).
- `src/store.ts` SQLite + dedupe + alert state · `src/cluster.ts` IDF-weighted, number/event-aware similarity + merge pass · `src/noise.ts` wire boilerplate · `src/score.ts` · `src/narrative.ts` · `src/alerts.ts` · `src/digest.ts` · `src/levels.ts`.
- `src/macro/` — 宏观仪表盘 / macro dashboard: `series.ts` (FRED keyless CSV: DGS2, DGS10, DFII10, T5YIE, T10YIE, DFF, BAMLH0A0HYM2, NFCI, DTWEXBGS, VIXCLS; Yahoo via `src/adapters/yahoo.ts` (yahoo-finance2): SPY, GLD, GC=F, ^VIX, DX-Y.NYB, ^TNX, ZT=F, BTC-USD), `regime.ts` (deterministic thresholds, no AI), `confirm.ts` (news vs market reaction: CONFIRMED / NOT_CONFIRMED / UNCLEAR), `risk.ts` (per-asset risk notes, NO_TRADE rules: conflicting signals, FOMC/CPI/NFP/PCE/PPI within 48h, unconfirmed headlines, credit/vol stress; links verbatim `knowledge/` entries).
- `src/options/` — 期权工具箱 / options toolkit (deterministic, cites the course text in `knowledge/courses/options/`): `bs.ts` (Black-Scholes price/greeks/IV, used only when Robinhood greeks are null; EM = P·IV·√(d/365), straddle ≈ 0.8·EM), `chain.ts` (ATM IV, straddle, 25Δ skew, term structure, IV30), `ivhistory.ts` (daily IV30 in SQLite → IV Rank/Percentile; 14.3 rule: implied vs realized wins conflicts; VIX proxy until 20 days of history), `matrix.ts` (strategy matrix from 14.4/附录 D.1 + event overlay + liquidity exception; defined-risk only, CSP/CC optional, credit spreads ranked last), `payoff.ts` (IC, iron fly, butterfly, reverse IC, collar, protective put exact; calendar/diagonal/PMCC by BS at front expiry), `rules.ts` (rule card defaults from 13.2–13.4/D.2/14.7 + weekly stress −20%&IV+30 / IV×2 / combined), `pretrade.ts` (enforced checks from the mentor's HYG/IWM/TLT/TQQQ review: written assignment plan, per-leg risk, simultaneous adverse moves, buying power for full short notional on Robinhood, time buffer, adjustments = new trades), `journal.ts` (D.3 schema, full-accounting P&L, assigned-share follow-up kept separate, EV per strategy), `events.ts` + `dashboard.ts` (event calendar & IV dashboard, D.4). Robinhood is MCP-only: save `get_option_instruments` + `get_option_quotes` output and join with `--rh-instruments a.json --rh-quotes q.json --spot P --write-chain chain.json`. Examples in `examples/`.
- Outputs of `scripts/run.sh`: `data/out/alerts-latest.md`, `data/out/alerts.jsonl`, `data/out/macro-latest.{md,json}`, `data/out/digest-latest.md` (includes a macro section), logs in `data/logs/`.

旧的 Codex 代码已删除，可从 `codex/weekly-source-integration-20261011` 分支恢复。 / The legacy Codex tree was removed and is recoverable from `codex/weekly-source-integration-20261011`.

## Macro first

The user is a macro trader first. Direction comes from the macro Why (`src/macro`, the thesis and actors). Technicals (K-line, FIB, the mentor's TradingView indicator) are for entry timing and levels only, never direction. The macro output keeps the **宏观 Why** and the **市场机制 How/When** sections separate (`knowledge/mentor/better-macro-trader.md` #9).

## Scenarios and reference levels (DK additions, 2026-10-14)
- `npm run brief` section 1/4.3 (scenarios): 4 scenarios to year-end 2026 (base / hawkish / growth scare / melt-up) from live premarket series + CPI headlines + release calendar. Weights are qualitative ranks from live signals, never probabilities. Re-run at 16:30 ET; a change of leading scenario becomes an alert (score 70). Cites catalog items and verbatim world-lines watch items.
- `npm run levels -- --tickers SPY,QQQ` → prior-day H/L/C, weekly H/L, SMA 20/50/200, swing pivots, Fib retracements of the latest swing. Reads `data/in/<T>-bars.json` (Robinhood `get_equity_historicals`, zod-validated), falls back to Yahoo. Timing only, never direction.
