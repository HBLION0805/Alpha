# 流动性观察 Liquidity watch (brief §1.2) — flag only

Source: knowledge/mentor/macro-liquidity/ — Michael Howell, 2026-10-16 (liquidity cycle; BTC as the most liquidity-sensitive asset; test = BTC holds $70k)
and the mentor's review: 「“逆风可能正在减弱”，和“顺风已经到来”，是两个不同的交易逻辑。」 Code: `src/macro/liquidity.ts`. User-approved 2026-10-18.

**It only flags. It never produces a trade signal, never changes the brief verdict, never feeds pretrade / readiness.**

## Indicators (all fetched; nothing is ever estimated or filled in)
| Indicator | Source | Read |
|---|---|---|
| SOFR − IORB (pp) | FRED `SOFR`, `IORB` (daily, T-1) | > +0.10pp = repo stress (danger alert); ≤ 0 = repo calm |
| SOFR − 2Y (pp) | FRED `SOFR`, `DGS2` | more negative = tighter; rising vs 4 weeks ago = tightening slowing |
| Bank reserves | FRED `WRESBAL` (weekly, Wednesday level, published Thursday) | 13-week change (as-of value vs value 91 days earlier) |
| MOVE | Yahoo `^MOVE` | lower vs 4 weeks ago = collateral more usable; missing → 「数据不可用」 |
| BTC | FRED `CBBTCUSD`, fallback Coinbase public daily candles (completed UTC days only) | vs $70,000 and vs its 200-day SMA |

All values are taken **as of one reference date** = the earlier of the latest SOFR and BTC observations (FRED is T-1), so the spreads never mix days.

## Status (exactly one)
- **「逆风减弱（观察）」** (weakening) at a date = SOFR − IORB ≤ 0 **AND** reserves' 13-week change > 0 **AND** BTC > $70,000.
- **「顺风确认」** (tailwind) = 逆风减弱 holds now **AND** at each of the last 4 weekly checkpoints (the last 4 WRESBAL Wednesdays, every input taken as of that date)
  **AND** SOFR − 2Y is higher than 4 weeks (28 days) earlier **AND** BTC > its 200-day SMA **AND** MOVE ≤ its value 4 weeks earlier (MOVE unavailable → cannot confirm)
  **AND** no alert is active.
- **「无信号（中性）」** = 逆风减弱 is false. **「无信号（数据不足）」** = SOFR, IORB, WRESBAL (incl. its 13-week change) or BTC is missing.

## Alerts (shown with any status)
- 🚨 BTC's latest daily close < $70,000 → Howell's own invalidation test failed (「它需要守住7万美元上方」).
- 🚨 SOFR − IORB > +0.10pp → repo stress. An active alert downgrades 顺风确认 to 逆风减弱.

## Fetching and failures
Per-series timeout 20 s; cache `data/out/liquidity-cache.json` (gitignored) reused for 6 h so the 30-minute run loop does not hit FRED every time.
A failed fetch falls back to the last cached series (labelled 「缓存 <time>Z」); with no cache the row shows 「数据不可用（reason）」 and the brief's failure footer lists it.
`--offline` uses the cache only. Refresh cadence: computed on every brief; the weekly inputs (reserves) change once a week.

## Mentor reminders
- §1.2 always quotes the mentor line above (verbatim).
- §1.1 导师提醒 adds rule `liquidity_chain` when the watch shows 逆风减弱 / 顺风确认 or an alert (rotating verbatim quotes from the review).
- Plan card: a thesis matching 流动性 / 降息 / 转向 / 宽松 / 放水 / 缩表 / 扩表 / 准备金 / 回购 / 比特币 / 轮动 / liquidity / pivot / rate cut / easing / QE / BTC / bitcoin / rotation
  shows 「宏观逻辑不能跳过中间环节，直接变成买单。」 and 「融资条件改善，可以和盈利疲软、衰退风险同时存在。」 (info only, any verdict).
