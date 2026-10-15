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
npm run levels -- bars.json        # key levels from Robinhood historicals JSON (MCP output saved to a file)
npm run run                        # scheduled entry: poll → alerts → digest (scripts/run.sh, flock-protected)
npm run calendar:snapshot          # refresh calendar/releases-<year>.json fallback
npm test && npm run typecheck
```

## 结构 / Layout

- `sources.yaml` — sources with stance / tier / verified status (dead feeds kept with notes).
- `src/ingest/` — `rss.ts` (RSS/Atom/Google-News sitemap, timeouts, ETag/If-Modified-Since), `alpacaNewsWs.ts`, `officialCalendar.ts` (Fed FOMC page, FRED release calendars, BEA schedule; static fallback in `calendar/`).
- `src/store.ts` SQLite + dedupe + alert state · `src/cluster.ts` IDF-weighted, number/event-aware similarity + merge pass · `src/noise.ts` wire boilerplate · `src/score.ts` · `src/narrative.ts` · `src/alerts.ts` · `src/digest.ts` · `src/levels.ts`.
- Outputs of `scripts/run.sh`: `data/out/alerts-latest.md`, `data/out/alerts.jsonl`, `data/out/digest-latest.md`, logs in `data/logs/`.

旧的 Codex 代码已删除，可从 `codex/weekly-source-integration-20261011` 分支恢复。 / The legacy Codex tree was removed and is recoverable from `codex/weekly-source-integration-20261011`.
