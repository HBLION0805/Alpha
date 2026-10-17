# Standing decisions (memory-like notes)

## 2026-10-17 — 股市七宗罪 = per-trade behaviour tags (warn-only)
- Source: mentor article 股市七宗罪 (knowledge/mentor/discipline/seven-sins.md, verbatim) → catalog `behavior-seven-sins`; code src/options/sins.ts.
- Each closed own trade can carry sins: 懒惰 sloth, 暴怒 wrath, 贪婪 greed, 嫉妒 envy, 暴食 gluttony, 傲慢 pride, 色欲 lust (JournalEntry.behaviorSins).
  Manual: `npm run paper -- sin --id <id> --sin wrath,pride [--note …]`, reject an auto candidate with `--remove <sin>`. Auto candidates come only from ledger data:
  sloth = no_pre_written_plan · wrath = opened the same ET day after a losing close AND (≤60 min / same symbol / bigger max loss / daily cap already breached) ·
  greed = net debit < $0.25 with ≤7 DTE (lottery) or TP alert hit then closed at a loss · envy = chasing / outside entryRange · gluttony = 4th+ own open of the ET day, unplanned_add ·
  pride = ≥2 stop hesitations then a loss · lust = own cap breaches. Mentor-shadow trades are never tagged.
- Weekly review §八之三: counts per sin (week auto/manual, 30 days); the most frequent 30-day sin = next month's behaviour focus.
- Practice gates stay warn-only: practice opens add `warn_sin_wrath` / `warn_sin_gluttony` / `warn_sin_greed`; no hard block was added. Thresholds are review thresholds, changeable in `SIN_LIMITS`.

## 2026-10-15 — Practice trades are for making mistakes and turning them into discipline
- **Practice** (`paper open --kind practice`, card 🟢/🟡): the ONLY hard requirement is a saved plan card
  (`npm run card -- … --thesis "…" --save`, then `--card <id>`) with direction, thesis, a stop (mechanical or invalidation) and a take-profit plan.
  Defined risk stays hard (no naked shorts; max loss must be defined).
- Everything else is recorded on the trade as a warn tag, not a block: warn_off_plan, warn_no_hedge, warn_over_cap, warn_position_cap,
  warn_daily_cap, warn_far_otm, warn_trend_unconfirmed, warn_<critique id>. Cap breaches are still written to `violations` and shown in reviews.
- **Formal** trades: unchanged, strict.
- Card verdicts: ✅ 可做（正式） · 🟢 可练习（有提示） · 🟡 仅练习 · 🛑 不做 (practice: only when plan fields are missing or risk is undefined).
- Every two weeks the weekly review's 门槛校准 table checks each warn tag (min 10 closed trades): promote to a hard rule / keep / drop.
  Any rule change needs the user's confirmation.

## Earlier standing rules
- Never push; never touch main; no secrets. Robinhood MCP read-only. Sim capital $5,000: $50/trade, $100/day, 6% max drawdown.
