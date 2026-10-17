# Standing decisions (memory-like notes)

## 2026-10-17 — 做空学 → short-side checklist (warn-only); short stock / covered put NOT enabled
- Source: mentor texts 做空学 + 做空赚钱 (knowledge/mentor/discipline/short-selling.md, verbatim) → catalog `short-side-checklist`, `phase2-short-stock-covered-put`; code src/options/shortside.ts; spec knowledge/mentor/discipline/short-selling.rules.json.
- **Short-side checklist is warn-only.** Bearish plan cards (§9) and short-side paper opens get `short_*` tags (vs_strength, no_relative_weakness, chasing, squeeze_prone, squeeze_risk_unchecked, expiry_too_short, invalidation_not_above_spot, data_insufficient). Practice: warn tags only; card verdicts unchanged. The only hard requirement for practice stays the written plan card. Thresholds are DK review thresholds (untested) and go through 门槛校准.
- **Short stock has unlimited upside risk** (plus borrow cost, recall, squeeze gaps). **Short puts add an obligation** (assignment, early exercise, margin).
- **Naked shorts are blocked.** Formal trades were already blocked (pretrade `per_leg_risk`, rules.ts `defined_risk` / `forbidden`). Practice opens had a gap: short stock and naked short puts got through as warn tags. Now `paper.ts nakedShortLegs` refuses them even for practice. This is the same rule as the plan card's 定义风险（裸卖）, which already treats naked as "plan missing". Naked short calls were already refused (undefined max loss).
- **Phase 1 expresses bearish views only through defined-risk structures: long puts / put debit spreads.**
- **Short stock and the covered put (short stock + short put to offset borrow) are recorded as phase-2 reference only, not enabled.** A covered put caps profit at the put strike and does not protect against an upside squeeze (premium is the only buffer). No execution, sizing or assignment logic was built. Enabling it is the user's decision.
- Not changed: covered calls (long stock ≥ 100 × short calls) still pass the practice naked check. Per the 2026-10-17 phase-2 decision they are phase 2 only. Blocking them in practice would be a separate rule change.

## 2026-10-17 — Phase-2 option overlays are reference only; naked short calls stay blocked
- Source: mentor article 进阶长期仓位管理策略 (knowledge/mentor/phase2/long-term-position-management.md, verbatim) → catalog `phase2-long-term-position-management`, `phase2-thesis-or-ego`.
- **Naked (uncovered) short calls remain BLOCKED in every phase** (unlimited loss; rules.ts `forbidden`, `defined_risk` check, pretrade `adjustment_naked`). Naked short puts stay blocked too.
- **Cash-secured puts and covered calls (OTM on ~half the shares, ITM in narrative headwinds), protective puts and collars are PHASE 2 ONLY** (phase 2 = long-term stock holding, options for hedging).
  They require real collateral: shares held for every short call (100 per contract), strike × 100 × contracts cash fully reserved for every short put, and only on stocks you are willing to own.
- **Not enabled now (phase 1 = capital accumulation, lose less first).** No execution, sizing, payoff or assignment logic was built for them; turning phase 2 on is the user's decision.
- Phase-2 review check (when phase 2 starts): "holding because the thesis holds, or because I won't admit I was wrong?" — thesis broken → exit; premium does not fix a bad company.
- Open item (not changed, needs the user's confirmation): `rules.ts checkBook` already lets a position whose strategy is labelled `cash_secured_put` pass the uncovered-short check without verifying cash, and `matrix.ts` lists CSP / covered call as optional candidates. Phase 1 has no such trades; a phase gate would be a rule change.

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
