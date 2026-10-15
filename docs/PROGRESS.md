# Alpha progress

**Goal:** a macro-trading decision aid for one user. In priority order:
1. News and event alerts (the core feature).
2. Daily macro brief with a macro-first conclusion.
3. Risk and discipline gates: defined risk, caps, NO_TRADE.
4. Mentor knowledge base feeding 1–3.

Technicals are for timing only. Update this file after every task.

_Last updated 2026-10-14 22:40 ET (P2 alert recall, P3 unified brief, plan wiring, mentor win-rate review, readiness scorecard)._

**Delivery is handled:** the 30-minute weekday routine `alpha-2` (08:00–18:30 ET) runs the alerts and messages the user, starting 2026-10-15. The CPI lag on 10/14 happened only because routines had not started yet.

## Status

| Goal | Modules | Wired into run.sh | Actually ran | Status |
|---|---|---|---|---|
| (1) Alerts | ingest/rss, adapters/rss, sources, store, normalize, adapters/nlp, cluster, noise, score, alerts, cli/poll, cli/alerts | yes, every run | 2 manual runs; routine alpha-2 from 10/15 | ✅ scheduled + delivered (alpha-2) |
| (1) recall | score `shipping` topic + stemmed war terms; cluster Gulf/chokepoint event family | yes | Hormuz/Aramco fixture: one 6-outlet cluster, score **90** (was 43) | ✅ P2 done; golden recall 1.0, precision 0.897 (gate 0.88) |
| (1) | ingest/alpacaNewsWs, cli/stream | no | REST backfill only | optional |
| (2) Brief | macro/brief + cli/brief (`npm run brief`): macro + premarket + scenarios + levels + calendar, ONE verdict, 7 sections | yes, every run (macro-latest.json still feeds the digest) | live 10/14 22:33 ET: NO_TRADE, leader hawkish, 35 series fetched once, 0 failed | ✅ P3 done; old cli/macro, premarket, scenarios deleted |
| (2) timing | macro/volume, levels, adapters/bars, adapters/indicators | volume in its windows; levels inside the brief | levels live in the brief (SPY/QQQ/IWM) | ok / volume still needs `data/in/` chains |
| (3) Gates | options/rules, pretrade, discipline, stops, adjust, payoff, bs | via `options --proposal` (manual) | tests + examples | ✅ logic |
| (3) | options/plan (managementPlan + Kelly cap + take-profit ladder), printed with every proposal | `options --proposal` | examples | ✅ wired (Kelly only when `pAssumed` is given) |
| (3) | rules.effectiveRules: user overrides may only lower caps (1%, 3%, 1 adjustment, 2% daily, maxConcurrentPositions 10) | everywhere checkBook is used | tests | ✅ new |
| (3) | discipline: motive check (share/entertain/excitement → BLOCK), concurrent cap, ownership + premature-exit prompts | pretrade | tests | ✅ new (mentor-winrate-review) |
| (3) | options/journal (+ paper fields), options/readiness, cli/readiness (`npm run readiness`) | manual | example journal only | ✅ built / ⚠️ no paper trades logged yet |
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
- **Gaps still open:**
  - No paper entry tool yet. Trades are hand-written JSON in `data/journal/paper.json`. There is no "open paper trade from a proposal" command and no mark-to-market from real quotes.
  - Violations are self-reported, except motive and concurrent count.
  - Daily loss uses realized P&L on the close day; unrealized intraday loss is not tracked for paper trades.
  - `strategyStats` / `journalHealth` do not yet separate paper from live.

## Mentor win-rate review (2026-10-14)

Saved verbatim: `knowledge/mentor/reviews/winrate-drop-review.md` and `defensive-portfolio-2026-10.md` (+ png). Source id `mentor-winrate-review`.
- Already covered, citation added: thesis-stop, time-stop, psych-entry-comfort (premature exits), psych-responsibility (ownership), psych-loss-attribution.
- New items: max-concurrent-positions, psych-no-performance-trades, psych-winrate-not-failure.
- BAC "add to all positions" is NOT encoded. Adds stay at most one, only after the thesis is reconfirmed (ADD_RULE); never adding to a loser because it is cheaper.

## Next 3 priorities

1. Log paper trades daily from the brief + `options --proposal`. Build a small `paper open/close` CLI that writes journal entries with the timestamps the scorecard needs.
2. Watch alpha-2's first week for alert noise and timing; tune thresholds only with fixtures.
3. Make the brief time-aware: after the release, premarket "CPI 08:30" lines should not show in an evening run. Dedupe the PPI reason that macro risk and premarket both report.
