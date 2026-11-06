# Wire 【宏观盯盘】+【资金流】 into daily brief

User ask (2026-11-05): every Alpha daily brief must include two fixed Chinese sections from `knowledge/macro/fixed-watchlist-and-flows.md`. Page「宏观板块关联图」is the correlation/flow map (canvas efddf175-2a29-48e5-844b-05b1b4125a60).

## Goal
Ship before next premarket brief (weekday ~7:30 AM ET).

## Sections (Chinese)
1. **【宏观盯盘】** — short table or bullet list of the fixed ETF watchlist groups in the knowledge file (大盘/广度, 利率/美元/信用, 商品, 板块, 地区/领先). Day change % when bars available; no single-stock deep dive.
2. **【资金流】** — 3–6 lines using relative strength (not ETF primary-flow APIs):
   - 板块轮动: SMH / XLE / XLF / XLU (+ XLY vs XLP)
   - 广度: RSP、IWM vs SPY
   - 风险 vs 避险: HYG vs TLT/GLD
   - 成交量确认 when available
   - Close with exactly one of: 偏进攻 / 偏防守 / 混乱并列 + one evidence sentence

## Implementation sketch (for claude工具人)
- Add `src/macro/fixedWatchlist.ts` that reads Yahoo/bars already fetched for brief, builds `watchLines` + `flowLines`.
- Extend `BriefInput` in `src/macro/brief.ts` with optional `fixedWatchLines?: string[]` and `fundFlowLines?: string[]`.
- Insert after §1.3 mentor signals (or before §2 警报): `## 【宏观盯盘】` then `## 【资金流】`.
- Wire from `src/cli/brief.ts` the same way liquidity/mentorSignal lines are passed.
- Unit test: empty bars → sections still render with "数据不足"; with fixtures → conclusion one of the three labels.
- Do not change NO_TRADE verdict logic.

## Out of scope
Exact ETF create/redeem net-flow vendors; single-stock research.

## Implemented (2026-11-05)
- `src/macro/fixedWatchlist.ts`: `WATCH_GROUPS`, `ALIAS` (VIX/DXY/CL→WTI/BZ→BRENT), `FW_EXTRA_SERIES` (Yahoo, symbols not in PM_SERIES / dead-cat), `buildFixedWatchlist(data, { volume, aux })` → `watchLines` / `flowLines` / `label`.
- Vote (1d, ±0.3pp dead-band): SMH vs XLU · XLY vs XLP · avg(RSP, IWM) − SPY · HYG − avg(TLT, GLD). 进攻 ≥ 防守 + 2 → 偏进攻; mirror → 偏防守; else 混乱并列; < 2 comparable pairs → 数据不足.
- 成交量确认: yahooDaily OHLCV for SPY / QQQ, last bar vs 20-day average (≥1.2× 放量, ≤0.8× 缩量); missing → 数据不足. Aux = SPY GEX sign only when §5 GEX fetched.
- `buildBrief` always renders both sections after §1.3 / 死猫 and before `## 2. 警报`; missing/empty lines → empty-data render (headings + 数据不足). Display only; verdict unchanged.
