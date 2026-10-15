# Standing decisions (memory-like notes)

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
