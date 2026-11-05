# Shadow tracks A / B — forward (out-of-sample) paper tracking of the pre-registered backtest hypotheses

Source of the rules: /workspace/vibe-trial (round 2, pre-registered 2026-10-17): `report.md`, `results_v2.json`,
`runs/v2a_spy_longonly_event/code/signal_engine.py`, `runs/v2b_spy_longshort_event/code/signal_engine.py` (identical except `LONG_ONLY`).
Nothing was retuned. Code: `src/shadow/engine.ts` (pure), `src/cli/shadow.ts`. Ledger: `data/out/shadow/ledger.json` (gitignored).
**Virtual only. Completely separate from the paper journal (data/journal/paper.json); never counted toward readiness, caps, sins, 门槛校准 or confidence.**

## Common rules (both tracks, exactly as in signal_engine.py)
1. **Leader** — the day's Alpha leading scenario from the post-close brief (`data/out/brief-latest.json`, generated on that ET date at/after 16:00, i.e. the 16:30 run).
   SPY direction: `melt_up` → long (+1); `hawkish`, `risk_off` → short (−1); `base` or no leader (tie) → no trade. No post-close brief for the day → no new entry (logged).
2. **Confirmations** (tradeplan.ts L166-194), measured on the signal day, each on its own Yahoo daily observations (as-of the signal date):
   10Y yield (^TNX) 5-day change ≥ 3 bp, DXY (DX-Y.NYB) 5-day ≥ 0.3%, WTI (CL=F) 5-day ≥ 1.5%, SPY own 5-day ≥ 0.5%.
   Direction: rising yields / USD / oil agree with **shorts** (falling agrees with longs); own 5-day must point the trade's way. **Need ≥ 3 of 4.**
3. **Trigger** — daily close above the prior day's high (long) / below the prior day's low (short).
4. **Stop** — the opposite prior-day extreme, fixed at entry. Exit when a daily close is beyond it.
5. **Time stop** — exit signal at the close of the 10th bar after the signal bar.
6. **Fills** — entries and exits at the **next session's open**, 7 bp per side (5 bp slippage + 2 bp fee; no borrow cost on shorts). One position per track; no entry on a bar that signals an exit (the exit-fill bar may signal a new entry).
7. **Size** — weight = min(1, ($50 / |close − stop|) × close / $5,000); shares = weight × $5,000 / next open (fixed $5,000 notional base, as in the backtest).
8. **48h event gate** — an entry is skipped if any FOMC decision (14:00 ET), CPI or NFP release (08:30 ET) lies in [fill-day 09:30 ET, +48 h].
   Calendar: `src/options/majorEvents.ts` (data/in/major-events.json, else knowledge/calendar/major-events-2026-2027.json), filtered to series FOMC/CPI/NFP only. Exits are never gated.
   The gate is checked on the actual next session's date (same as the backtest's `idx[i+1]`), so exchange holidays are handled by the data.

## Track A = v2a
SPY **long-only**: short-side signals (hawkish / risk_off) are ignored. Everything else = common rules.

## Track B = v2b + one added short condition
Long and short with the common rules, **plus: a short entry is allowed only if the signal-day SPY close is below its 200-day simple moving average of daily closes
(including that day). If fewer than 200 bars are available, no short.** No other filter was added — in particular no leader-type filter
(v2b shorted on both hawkish and risk_off; that stays). This condition comes from the v2b short diagnostics (descriptive, 15 vs 36 trades) and is therefore
an untested hypothesis, not a backtested rule.

## Differences from the backtest (live data, not tuning)
- Leader comes from Alpha's live `scenarios.ts` via the brief: `cpi_hot` (headline-based) can count live; the backtest never counted it. Live FRED/Yahoo vintages differ slightly.
- Prices: Yahoo daily OHLC via `src/adapters/yahoo.ts` (unadjusted); the backtest traded adjusted OHLC. SPY buy-and-hold comparison is price-only (no dividends).
- The brief's NO_TRADE verdict (macro-risk / premarket reasons) is **recorded but not used**, because v2a/v2b did not use it (those gates were "omitted" in the backtest).
- A day without a post-close brief cannot produce an entry (the backtest computed the leader every day). Stops and time stops still run from price data.

## Running
- `npm run shadow` — idempotent: processes every final SPY bar after the last processed one; a bar for today waits until the post-close brief exists.
  Scheduled in `scripts/run.sh` on weekdays 16:30–18:59 ET right after the brief step (later runs that day are no-ops).
- `npm run shadow -- report` — per track: equity, return, trades, win rate, expectancy, t-stat, max drawdown, open position; SPY buy-and-hold since the start date.
- Weekly review (`npm run review -- --week`) §八之五 shows the same table (info only).
- Start date = the first run's last final bar (first run 2026-10-17 → start = 2026-10-16 close). Backtest reference: A t = 1.46 (52 trades), B (no 200DMA rule) t = 0.05 (101).
