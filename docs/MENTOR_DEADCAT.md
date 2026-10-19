# 大佬 2026-10-19「死猫反弹，还是市场见底？」in Alpha

The post is stored byte-for-byte in [knowledge/mentor/market-calls/dead-cat-2026-10-19/](../knowledge/mentor/market-calls/dead-cat-2026-10-19/README.md), with 10 figures and a sha256 manifest. Author names are stripped from all text. fig1 is a Discord screenshot that shows the handle; it is stored unedited.

**Everything here is display-only.** It never feeds `briefVerdict`, alarms, the alert flow, sizing, plan qualification, card verdicts or the 能不能睡 label. `test/deadcat.test.ts` checks this two ways:
- statically: only `cli/brief.ts` and `macro/brief.ts` use the module, and only `review/card.ts` reads `brief-latest.json → deadCat`, for reminders;
- by rendering: the brief and card produce the same output with and without the block.

Code: `src/macro/deadcat.ts` (pure). It appears as brief **§1.3**, after 【大佬情景对照】, on every `npm run brief` (both the premarket and the afternoon run.sh passes).

## A) 【大佬经济情景表】 (fig8)
- **Inputs:** each value is the change over 5 trading days.
  - WTI (CL=F): %
  - DXY: %
  - 30Y (^TYX, falling back to FRED DGS30): bp
  - Stocks: SPY % plus the defensive spread, defined as avg(XLP, XLV, XLU) minus avg(QQQ, SMH).
- **"Flat" dead-bands:**
  - oil ±1%
  - DXY ±0.3%
  - 30Y ±5bp
  - SPY ±0.5%
  - defensive spread ±1pp
- **Stock state:**

  | State | Condition | Row it matches |
  |---|---|---|
  | defensive_lead | spread > +1pp, defensives up, SPY not up | stagflation |
  | broad_up | SPY up, spread ≤ 1pp | growth |
  | broad_down | SPY down, defensives also down | recession |
  | mixed | anything else | inflation ("pricing power up / others down" cannot be measured directly) |

- **Rows** (oil / DXY / 30Y / stocks):

  | Row | Oil | DXY | 30Y | Stocks |
  |---|---|---|---|---|
  | growth | ↓ or — | ↑ | ↑ | broad_up |
  | inflation | ↑ | ↑ | ↑ | mixed |
  | stagflation | ↑ | ↓ | ↓ | defensive_lead |
  | recession | ↓ | ↓ | ↓ | broad_down |

- **Score:** the number of matching dimensions out of 4. Unknown dimensions never count. Ties list every tied row. A best score below 3 is noted as "no clear row".
- **Comparison with the older 【大佬情景对照】** (`matrix.ts`): both are shown, plus an agree/disagree line. The correspondence is DK's own: growth ≈ 牛市, inflation ≈ 熊市一, stagflation ≈ 熊市二, recession ≈ 熊市三.

## B) 死猫 vs 见底 checklist
🔴 means it leans dead-cat, 🟢 leans bottom, 🟡 neutral, ➖ n/a.

| Item | Source | 🔴 | 🟢 | 🟡 |
|---|---|---|---|---|
| WTI vs 100 (fig6) | CL=F | ≥ 100 (re-broke 100 → NQ likely falls further) | < 100 and 1-day change < 0 (selling may be over short-term) | < 100 but rising |
| KOSPI vs 5266.12 (fig4) | ^KS11; **proxy EWY** (direction only, no level) | below the support | holds, 1-day change ≥ +1.5% | holds, weak bounce (the mentor called +0.6% 「没什么说服力」) |
| Equal-weight EWF (fig5) | EWF=F when it has ≥2 daily bars; **otherwise proxy RSP** | 1-day change < −0.2% (rotation reversing) | > +0.2% | within ±0.2% |
| VIX rhythm (fig9/10) | ^VIX; spike = close on 2026-10-16 | closes above the 10/16 close or above 20 after the spike day (re-spike) | < 17 | cooling off |
| NQ vs 30000 / 28500 (fig3) | NQ=F; **proxy QQQ** with the levels scaled by QQQ/NDX | < 28500 | ≥ 30000 | in between |

The VIX row also shows the trading days since the 10/16 spike.

**DK devil's advocate (not the mentor's)** — four bottom conditions:
- WTI < 95
- VIX < 17
- KOSPI ≥ 5266.12
- NQ ≥ 30000

If ≥3 are met, the checklist shows 「死猫判断可能错了」. Unknown conditions never count as met.

## C) Mentor hooks (info only; quotes are verbatim from article.md, checked by test/mentor.test.ts)
- **Plan card, long tech or rebound:** shows 「大佬：如果是死猫反弹，每一次反弹都是卖掉破玩意儿的机会」 plus the original sentence. A card qualifies if it is a bull card on a tech ticker (QQQ/SMH/NVDA/…) or its thesis mentions 反弹 / 抄底 / 超跌 / 见底 / bounce / rebound / oversold / dip. Rule `dead_cat_rebound`.
- **Plan card, long defensive or staples, when the brief's WTI > 95:** shows 「大佬：油价继续上涨，连防御股也得遭殃」. A card qualifies on XLP/XLV/XLU/PG/KO/… or a thesis mentioning 防御 / 必需消费 / staples / defensive. Rule `oil_hurts_defensives`. The WTI value comes from `brief-latest.json → deadCat.wti` and is used only if the brief is less than 24h old.
- **Losing close of a bullish trade on tech or with a rebound thesis:** the 亏损归因 prompt adds the dead-cat reminder (`lossPrompt.mentor`, also shown in the review report).

## Data and proxies
New series are fetched by the brief into their own record, so the premarket, matrix and scenario inputs are unchanged:
- SPY, QQQ, XLP, XLV, XLU
- RSP (EWF proxy)
- EWF=F (Yahoo returns only today's bar, so RSP is used for now)

KOSPI, EWY, NQ, NDX, VIX, WTI, DXY and 30Y already came from the premarket series. `--offline` runs have no market data, so every item shows n/a.

## D) 大佬今日价位 — the mentor's market dailies (from 2026-10-19)
- **Archive:** each daily is stored byte-for-byte under `knowledge/mentor/market-calls/daily-YYYY-MM-DD/` (article.md, manifest.json, README.md). The first one is 2026-10-19.
- **Levels are data, not code.** `knowledge/mentor/market-calls/levels.json` holds one entry per date. Each entry has `levels[]` and an optional `watch` field.
  - Each level has `{id, label, series, level, rule, unit, meaning, quote, cardHook?, checklist?}`. `rule` is either `close_above` (it must close at or above the level) or `stay_below` (being above the level is the danger).
  - `series` is a Yahoo ref. The special value `@WTI_FRONT` means the front-month CL contract (`src/macro/wtiFront.ts`, the same contract CNBC shows as @CL.1).
  - **Adding a daily needs no code change:** archive the article and add an entry. `test/mentorlevels.test.ts` checks that every quote is a verbatim substring of its source.
- **Brief §1.3** (`src/macro/mentorLevels.ts`, shown above the economic table): each level's value, above/below, distance in points and %, and the mentor's quote, plus the DXY / oil / 30Y 1-day direction line. The block follows the time of day (ET):
  - **Before 09:30:** shows the previous close.
  - **Intraday:** a close_above level that is below reads 🟡 「收盘前必须站回」.
  - **From 16:00 (the afternoon run):** reads ✅ or ❌ on the close, plus a 「下午场：CRWV 65 … · NQ 30,000 …」 line. NQ futures settle at 17:00, so the line is labeled as the latest daily value.
  - **Next trading day, if there is no new daily:** a recap against that day's close.
  - **Extra flag:** if oil is above 100 while the 30Y falls, it shows the mentor's recession-signal combination.
- **Dead-cat checklist:** levels with `checklist:true` (CRWV 65) are added as a row. DK's four bottom conditions are unchanged.
- **Plan cards:** levels with `cardHook:"tech_long"` (CRWV 65) appear on any tech long card that day. A card qualifies on a tech ticker or a thesis mentioning 科技 / 半导体 / 芯片 / AI / tech / semis / nasdaq. The card also shows the state from the brief when the brief is for the same day.
- **WTI front month:** the dead-cat checklist and the economic table now prefer the front contract. Yahoo `CL=F` rolls to the next month early and splices the previous contract's close. On 2026-10-19 it showed 97.69 (Dec) against a previous close of 101.41 (Nov), a fake −3.7%, while Nov itself was 100.70, −0.7%. When the two differ, the checklist row says so.
- **Display only:** it never feeds the verdict, NO_TRADE, 48h/72h, alerts, sizing or 能不能睡. Static and rendered tests check this.

