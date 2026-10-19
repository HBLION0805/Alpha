# Standing decisions (memory-like notes)

## 2026-10-19 — 大佬 market dailies: key levels as dated data, display only
- The daily is archived verbatim with the author stripped. Its levels go in `knowledge/mentor/market-calls/levels.json`, one entry per date with verbatim quotes, so new dailies need no code.
- Brief §1.3 「大佬今日价位」:
  - each level's value, above/below and distance, plus the DXY / oil / 30Y line;
  - the afternoon run (≥16:00 ET) reports the closes;
  - the next morning gives a recap.
- CRWV 65 is also a dead-cat checklist row and a tech-long plan-card quote.
- Oil levels use the **front-month CL contract** (the same contract as CNBC @CL.1), because Yahoo CL=F rolls early and splices closes. The dead-cat checklist and the economic table switched to the front contract too. 2026-10-19 (user-approved): the oil block, the oil alarms, the 快速变动 flag and the USDCAD line followed (same thresholds; the last 10 days come from one contract, older history is ratio-adjusted). Scenarios / matrix / trade plan / Brent are unchanged.
- Never changes NO_TRADE, 48h/72h, alerts, sizing or 能不能睡.

## 2026-10-19 — 大佬「死猫反弹，还是市场见底？」: active, display only
- The post is archived byte-for-byte under knowledge/mentor/market-calls/dead-cat-2026-10-19/. Author name stripped; fig1's Discord handle is noted and the image left unedited.
- Brief §1.3 shows two blocks on every brief (premarket and afternoon):
  - 【大佬经济情景表】 (fig8): 5-day directions with small dead-bands, best row plus match score, and an agree/disagree line against the older 【大佬情景对照】.
  - 死猫 vs 见底 checklist.
- DK's devil's-advocate bottom check: WTI < 95, VIX < 17, KOSPI holds 5266, NQ ≥ 30000. Meeting 3 of 4 shows 「死猫判断可能错了」. These are DK's conditions, labeled as such.
- Proxies, each labeled where it is used:
  - RSP for EWF1! (Yahoo has no EWF=F history);
  - EWY for KOSPI if ^KS11 fails;
  - QQQ-equivalent levels for NQ if NQ=F fails.
- Plan cards and losing closes get two reminders:
  - long tech or rebound → 「大佬：如果是死猫反弹，每一次反弹都是卖掉破玩意儿的机会」;
  - long defensive or staples when WTI > 95 → 「大佬：油价继续上涨，连防御股也得遭殃」.
- None of this changes the verdict, alerts, sizing, card verdicts or 能不能睡. Tests check this both statically and on rendered output. Any promotion to a rule needs the user's confirmation.

## 2026-10-19 — Trump: watch X AND Truth Social
- Truth Social is fetched by Alpha itself, read-only and without login. The official public API is tried first; the trumpstruth.org mirror is the fallback (the API returns a Cloudflare 403 from the box). No Truth connector is needed, and nothing is ever posted, liked or replied to.
- If a platform fails, we continue with what we have (X only), print one warning line, and never crash the run.
- Cross-posts count as one post (similar text within 6h). Both platforms and both URLs are kept.
- Late-delivered posts (fetched ≤36h after publication) still alert, with a delay note, so they are not silently dropped.

## 2026-10-19 — Tier-2 08:30 releases in the release calendar (claims, housing starts, durables, trade)
- User-approved. calendar/releases-2026.json gains `tier: 2` events: HOUSING / DURABLES / TRADE from the official Census economic-indicator calendar (census.gov/economic-indicators/calendar-listview-2026.html, fetched 2026-10-19); CLAIMS from DOL's published rule "every Thursday 8:30 ET" (`inferred: true`) plus DOL's official exception list (oui.doleta.gov/unemploy/claims_arch.asp: Wed 2026-11-25 for Thanksgiving; 2027-11-10, 2027-11-24). Holiday Thursday with no listed date (2026-01-01) is skipped, not guessed. Retail sales already came from FRED. Empire State / Philly Fed not added (no official machine-readable schedule fetched).
- Tier 2 = listed only: brief §6 「今天 8:30：…（次要）」, premarket 今日经济日历 （次要）, brief JSON `todayReleases`, plan card 「到期前次要数据」. Never in HIGH_IMPACT / the 48h window / premarket 盘前重大数据 NO_TRADE / critique / 72h rule (major-events file unchanged) / 能不能睡; plan-card §7 status ignores them. Major events behave as before.
- 2027: releases-2027.json does not exist yet (the release calendar is per-year); `npm run calendar:snapshot -- 2027` now also pulls Census + DOL claims. Census 2027 dates are already published.

## 2026-10-19 — VIX 分档 label in brief §4 (user-shared infographic); display only
- Bands from the user-shared infographic 如何用VIX观察市场情绪 (knowledge/vix-regimes.md; public, not the mentor's): < 20 🟢 / 20–<30 🟡 / 30–40 🟠 / > 40 🔴; 20 and 30 → higher band, 40 → 30–40.
- > 40: the infographic's 「分批布局」 does not apply in phase 1 → 「第一阶段不抄底，少亏优先，NO_TRADE 合理」 (text only — the verdict is not changed).
- Speed over level (user agreed): ⚡ 急升 1d ≥ +20% or 5d ≥ +35%; ↘ 回落 1d ≤ −15% or 5d ≤ −25% (DK-chosen drop thresholds).
- Display only: no verdict, alarm, sizing or sleep-label effect (test/vixregime.test.ts checks statically and on the brief).

## 2026-10-18 — 今日能不能睡 (mentor's 不能睡 / 可以睡 list) as a brief label; flag only
- **用户补充:** 「可以睡不代表不观察的，不是说直接就一点盘不看了」 → 😴 可以睡 = lower-risk / can relax, NOT stop watching; every 可以睡 line says 「（可以睡≠不看盘：照常看盘前简报和提醒，止损照设）」. Display only: nothing keys off the label.
- User-approved. Post archived verbatim in knowledge/mentor/premarket-routine/sleep-days-2026-10-18.md (sha256 test). 老川 = Trump.
- Brief §1 label every run (today; + next trading day in the afternoon run or when today is closed): 🚨 不能睡 / 🚨🚨 加强 / 😴 可以睡 / 普通 / 休市. Never changes the verdict.
- 不能睡: OpEx (quad witching = 加强; holiday Friday → previous trading day; other OpEx-week days only get a ⚠️ flag), FOMC decision + Chair press conference, Fed officials' speeches from the existing Fed speakers cache (~14-day window; beyond it: 讲话未知, FOMC only), Trump post ≥ 70 in the last 24h or a "Trump to announce…" headline, CPI / NFP (user addition). 可以睡: Monday, Jul–Aug, Dec 24–Jan 1, Thanksgiving week, day before a long-weekend NYSE holiday. 不能睡 wins; both reasons shown.
- NYSE holidays/early closes hard-coded from nyse.com (2026–2028) in src/macro/nyse.ts; opexEvents now moves a holiday 3rd Friday to the previous trading day (June 2026 → Thu 6/18, June 2027 → Thu 6/17). Rules: docs/SLEEP_DAYS.md.

## 2026-10-18 — Mentor premarket video (原油与 VIX): oil speed + driver heuristic, VIX-vs-index confirmation; VIX call hedge = Phase 2 only
- User-approved. Transcript archived byte-for-byte in knowledge/mentor/premarket-routine/ (not checked word-by-word; the ~70 MB video is not committed).
- Brief oil block (user's own requirement) adds speed (⚡ |1d| ≥ 3% or |5d| ≥ 8%), a HEURISTIC demand-vs-supply driver (may be 无法判断; copper HG=F added, never filled in) and, for supply shocks, the JETS / XLY pressure note. VIX vs SPX/NDX over 5 days → 方向确认 / 背离/未确认. Flag only; existing oil alarms unchanged. Rules: docs/OIL_VIX.md.
- Mentor rules `oil_speed`, `vix_confirm` (§1.1) and `oil_squeeze` (plan card, supply shock + airline/travel/consumer plan).
- **VIX call options as a hedge: PHASE 2 REFERENCE ONLY, not enabled** (catalog `phase2-vix-call-hedge`), same treatment as short stock + covered put. Not added to the practice rules; no sizing/roll/exit logic built.

## 2026-10-18 — Macro-liquidity theme (Howell 2026-10-16 + mentor review): archive, brief §1.2 watch, plan-card reminder
- User-approved. Archive knowledge/mentor/macro-liquidity/ byte-for-byte (manifest sha256); Howell attribution kept (published article); mentor review anonymous.
- Brief §1.2 流动性观察 (docs/LIQUIDITY_WATCH.md): one label 逆风减弱（观察） / 顺风确认 / 无信号, BTC < $70k and SOFR−IORB > +0.10pp alerts. **Flag only — no trade signal, no verdict change.** Conservative: 顺风确认 needs 4 consecutive weekly checkpoints + SOFR−2Y rising + BTC > 200DMA + MOVE lower (MOVE missing → no confirmation).
- Mentor rule `liquidity_chain` (verbatim quotes from the review): plan card when the thesis is liquidity/pivot/rotation-themed; §1.1 when the watch flags something.

## 2026-10-17 (later) — real_practice never counts toward the sim daily cap; covered-call stock stop
- User decision (both open items closed). **Daily loss sum = formal + practice + mentor_shadow simulated trades only — everywhere**: live 🚨 (breach.ts), brief 暴怒 / 今天结束 (mentor.ts),
  plan-card budget (card.ts), pretrade daily_loss_limit (discipline.ts dailyLossCheck now skips `source: real_practice` logs), 暴怒-after-breach tag (sins.ts), readiness day check. One predicate: `journal.ts countsTowardDailyCap`.
  real_practice still gets the other 暴怒 reasons (opening minutes after one's own losing close / same symbol / bigger size) — those are behavior, not the cap.
- **Covered call / any stock + option structure**: the risk plan now carries the stock-leg mechanical stop (default −7% from the stock leg's entry, `--stop-pct` overrides) alongside the option 30/30 rule.
  Max loss stays stock-to-zero (structure payoff). Exit rules and `renderRiskPlan` show both; at mark time `riskplan.ts stopHits` prints every triggered stop (stock stop on spot, 30/30 date, −30% value for debit structures) — the first to trigger applies. Warn-only output; nothing is auto-closed.
- Ledger-day impact: none. Sim-only day totals are unchanged (10/16 −$147 breach stays; real_practice was already outside breach.ts / brief / card); no stored or derived 暴怒-after-breach reason changes (none was triggered by real_practice closes).

## 2026-10-17 — mentor_shadow trades COUNT toward the daily loss cap ($100/day = 2% of $5k)
- User decision. One definition: `journal.ts countsTowardDailyCap` = every simulated trade (formal + practice + mentor_shadow); real_practice (real-account trades logged for review) stays out.
- Applied to: live 🚨 day breach at mark (breach.ts, already included shadow), plan-card daily budget (card.ts, already included), pretrade daily_loss_limit (already included),
  brief §1.1 暴怒 / 今天结束 reminder (mentor.ts — **changed**, was own trades only; win streak / big-day "pride" stays own trades),
  暴怒 tag "opened after the daily cap was breached" (sins.ts — **changed**: shadow closes now count, and a breach alone triggers it even with no own losing close),
  readiness loss_caps day check (readiness.ts — **changed**: a day's loss = formal + mentor_shadow closes that day; shadow trades are still never readiness trades for sample / expectancy / per-trade / drawdown).
- Per-trade $50 cap for mentor_shadow: unchanged and consistent — flagged (exceeds_1pct_cap / open_loss_over_cap / "超出 Alpha 风控") but never refused; not a readiness criterion (shadow trades aren't readiness trades).
- ~~Open question~~ closed (see "later" entry above): real_practice is out of every daily-loss consumer, including the 暴怒-after-breach tag.
- Existing ledger impact: 2026-10-16 becomes a breach day (paper_sim −49.50 + mentor_shadow −41 −56.50 = −$147 > $100). Both shadow trades closed 16:05 ET; no own open after that → no new 暴怒 tags. The Mon 10/19 brief will show 暴怒 / 今天结束 for 10/16 (3-day window). Readiness unchanged (no formal trades yet).

## 2026-10-17 — Stock-leg valuation fix + practice false hard-refuse
- Root cause: stock legs logged by hand / routine as `{ type: "stock", qty, price }` (BAC 10/16) had no `premium`/`strike`; every valuer reads those, so paperMark threw "entry price unknown", analyze/costBasis gave NaN ("Close-run valuer could not price stock leg (bug)").
  Fix: `journal.ts normalizeLeg` (premium = price, else entryPrice for all-stock entries only; strike = premium), applied in paperMark, expireEntry and on journal load in cli/paper.ts. Stock = qty × price (×1), options = qty × price × 100, sign from qty.
- `paper expire` fetched the settlement close per leg and a stock leg (no expiration) poisoned it with NaN → combos with stock could never settle. Now the settlement date = the entry's last option expiration; stock legs are valued at the same close.
- Covered-call max loss already includes the stock going to 0 (payoff.ts kinks start at S=0): +100 @50 / −1 55C @1.20 → max loss $4,880, practice gets warn_over_cap. Regression tests pin this.
- Practice hard-refuse regex matched the bare word "maxLoss", which appears in the multi-leg checklist text → every practice spread without a written checklist was hard-refused. Now only "最大亏损未定义" and an invalid --kind stay hard (`paper.ts isHardRefusal`).
- Ledger: only bac-long-2026-10-16-paper changed (premium/strike 52.16 added). P&L −49.50 unchanged (= 75 × (51.50 − 52.16), stop fill); marks none. Backup data/out/backup-20261017-203117.json.

## 2026-10-17 — Shadow tracks A/B: forward paper test of the backtest hypotheses (virtual, separate ledger)
- User-approved. Spec docs/SHADOW_TRACKS.md; code src/shadow/engine.ts, src/cli/shadow.ts (`npm run shadow`, `npm run shadow -- report`); ledger data/out/shadow/ledger.json.
- Track A = v2a exactly (SPY long-only + leader/≥3-of-4 confirmations + prior-day breakout + 48h FOMC/CPI/NFP gate, next-open fills, 7 bp/side, $50 risk sizing on $5,000, 10-bar time stop).
- Track B = v2b + ONE added condition: shorts only while the signal-day SPY close < its 200-day SMA. No other filter (both hawkish and risk_off shorts stay, as in v2b).
- Not retuned. Brief NO_TRADE verdict recorded, not used (the backtest omitted it). Never touches the paper journal; not counted toward readiness, caps, sins, 门槛校准 or confidence. Weekly §八之五 shows it as info.

## 2026-10-17 — Mentor material shapes daily use (导师提醒), not just the knowledge base
- User feedback: "don't just add it to the knowledge base." Code: src/review/mentor.ts (rules = name + one-line rule + verbatim quotes + topic file; every quote is checked to be a verbatim substring of the mentor's original text, not the DK sections — test/mentor.test.ts).
- **Brief §1.1 导师提醒** (every run.sh brief, premarket and afternoon): 1–3 reminders chosen from real state, in priority order: daily loss limit hit in the last 3 days → 暴怒/今天结束 (always first); major event within ±72 h (majorEvents loader: official FOMC/CPI/NFP + flagged) → 72 小时原则; ≥3 straight wins or a ≥1% day in the last 3 days → 骄兵必败; macro regime change or leader flip → 图表背后的逻辑还成立吗; bearish leader (hawkish / risk_off) → 柿子挑软的捏 / 不空强; NO_TRADE → 少交易 / 现金也是仓位; most frequent sin in 30 days (same count as weekly §八之三) → this month's focus. Cap 3; nothing triggered → one rotating general reminder. Quotes rotate deterministically by ET day; no quote repeats within a brief.
- **Plan card + paper open:** every fired warn/info/short tag prints the mentor rule name + verbatim quote + topic link ("导师怎么说"); tags sharing a rule are grouped; tags without a mentor source say so (no guessed quote).
- **Losing close (paper close / expire):** prints and stores (`JournalEntry.lossPrompt`) the four attribution questions (judgment / execution / risk / variance; the chosen class ticked) and a 🔁 repeat-error callout when the same errorClass, error tag or 七宗罪 occurred in the previous 30 days. Review card shows both.
- Warn-only: no verdict, gate or readiness rule changed; the written plan card remains the only hard requirement.

## 2026-10-17 — Covered calls stay ALLOWED in practice trades (user decision; open item closed)
- User decision: practice opens keep allowing covered calls (long stock ≥ 100 × short calls passes `nakedShortLegs`). No code change. **The covered-call open item below is closed.**
- Unchanged: naked short calls / naked short puts / short stock stay refused in practice; formal trades follow rules.ts / pretrade as before; covered calls as a strategy are still phase 2 per the phase-2 note (practice only, not formal readiness).

## 2026-10-17 — 72-hour rule event calendar = official FOMC / CPI / NFP schedules
- knowledge/calendar/major-events-2026-2027.json (tracked) + identical local copy data/in/major-events.json (gitignored). Loader `src/options/majorEvents.ts`: data/in first, else the tracked file.
- Window 2026-10-17 → 2027-12-31, fetched 2026-10-17 from federalreserve.gov/monetarypolicy/fomccalendars.htm and bls.gov/schedule/news_release/cpi.htm, empsit.htm. FOMC = decision day (2nd meeting day) 14:00 ET, 10 dates (2027 dates are marked tentative by the Fed); CPI 14 and NFP 14 releases at 08:30 ET. No gaps inside the window (Dec 2027 reference-month releases fall in Jan 2028). All entries `symbol: null` (market-wide) → `warn_72h_event` for every ticker within 72 h after. Re-check if a schedule changes (shutdown delays, unscheduled FOMC meetings are not included).

## 2026-10-17 — Keep nakedShortLegs; covered calls ~~stay an open item~~ (closed above: allowed)
- **KEEP `paper.ts nakedShortLegs`** (practice opens refuse short stock / naked short puts / naked short calls). User confirmed by default (they didn't object; will confirm before push).
- **Covered calls: left as-is** (long stock ≥ 100 × short calls still passes the practice naked check). ~~Open item~~ closed: user decided they stay allowed (see above) — phase 2 only per the phase-2 decision below; blocking them in practice would be a separate rule change the user has not asked for.

## 2026-10-17 — 交易心理 batch → warn-only tags, journal, loss attribution, confidence ratio
- Source: mentor psychology batch 1 + 2 (knowledge/mentor/psychology/, verbatim segments; author → [导师], member → [群友]; batch-1 provenance note and batch-2 「认知」 completed from the user's resend 2026-10-17; the narrower 【缺失】 marker for the missing opening of the group-rules post kept, nothing filled in) + DK's video summary 《The Trading Game》 (not verbatim). Catalog sources `mentor-psych-batch`, `mentor-video-trading-game`; items `psych-entry-warn-tags`, `psych-put-price-call-time`, `psych-video-trading-game`; existing psych-* items linked (not copied). `manifest.json` + test/psych.test.ts verify byte-exact reconstruction.
- **Practice gates stay warn-only. The written plan card remains the only hard requirement.** No new block anywhere. Code: src/options/psych.ts. Practice opens get these as warnTags (so 门槛校准 picks them up); every own entry stores them as `psychTags`; formal opens print them but verdicts are unchanged.
- Tags and **defaults (all UNTESTED, `PSYCH_LIMITS`)**:
  - `warn_72h_event` — opened < 72 h after the ticker's earnings (earnings book incl. past rows; am = 09:30 ET, pm = 16:05 ET, unknown = 16:00) or an event in data/in/major-events.json (official FOMC/CPI/NFP calendar, fallback knowledge/calendar/major-events-2026-2027.json; `symbol: null` = market-wide).
  - `warn_add_to_loser_unconfirmed` — same symbol + strategy while an own open position on it has last mark < 0 and no `--confirm "…"` note. `warn_second_add_to_loser` — ≥2 such open positions with combined mark < 0 (max one planned add, only after confirmation).
  - `warn_pyramid_add_larger` — follow-on unit within 10 days after a same symbol + strategy winner (open mark > 0 or closed > 0) with a larger max loss (1.00 → 0.50 → 0.30 → 0.20 illustration).
  - `warn_size_up_after_wins` — ≥3 straight own wins or last trading day realized ≥ 1% of capital, and max loss > average of the last 5 closed. `warn_day_after_big_win` — first trading day after a ≥ 1% day.
  - `info_midday_entry` — opened outside 09:30–10:30 / 15:00–16:00 ET (informational).
  - `warn_put_strike_unrealistic` — long put strike below `--target`, or (no target) below spot × (1 − 1 × IV × √(DTE/365)); IV from the leg, else 35%; thesis containing 彩票/lottery exempt. **Call respects time** is already covered by pretrade `time_buffer` / critique `horizon_short` — not duplicated.
  - `info_ticker_magnetism` — ≥2nd re-entry into a ticker after an own trade whose peak mark was > 0 closed ≤ 0 (informational).
- **Loss attribution:** `lossReview.errorClass` = judgment | execution | **risk** | **variance** (validated on close). Suggested tags: late_entry, oversized, ignored_follow_up, copied_one_leg, wrong_instrument, changed_script (free text still allowed). Readiness shows the four counts; the post-mortem `--class` vocabulary (judgment/execution/luck/good) is unchanged.
- **Journal:** `npm run paper -- journal --id … --why --thesis --right --wrong --violated --redo [--profitable-but-wrong yes|no]`. Review card shows answers / unanswered questions; **profitable-but-wrong auto candidate** = closed winner with violations or non-info warn tags (confirm or reject with the flag).
- **Confidence ratio** (weekly §八之四, week + 30 days): successes ÷ failures; failure = violations, errorClass judgment/execution/risk, or profitable-but-wrong; success = other closed own winners and variance losses; unclassified losses are counted separately, not in either. Mentor shadow excluded.
- **Manual review questions (no data):** did the size cause anxiety / bad sleep → shrink next; FOMO vs plan; outcome bias ("same decision with the opposite result?"); big news in the 72 h before entry when no event data exists. Weekend checklist (manual) in docs/ROUTINE_WEEKLY.md. Bias chart → signal mapping is documentation only (journal-and-outcome-bias.md).

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

## 2026-10-19 — Stock-protection reminder (mentor note 11:12 ET)
- Trigger = stock long card (`--structure long_stock|stock|shares|正股`) AND (mentor-declared junk/sideways phase in phases.json OR ^NDX |105-day change| ≤ 5%). Either input alone is enough; NDX fetch failure → declared phase only.
- Covered call is offered only with ≥ 100 shares held (`--shares`); unknown shares = not allowed. Naked options are never suggested. Display only: no effect on verdict, sizing, NO_TRADE or 能不能睡.

## 2026-10-19 — Geopolitical / election events are display + reminder only
- Separate tracked file knowledge/calendar/geo-events-2026.json, rendered only into brief text. Not merged into the release calendar or major events, so NO_TRADE, the 48h window, the 72h post-event tag and 能不能睡 for US trades don't change. Promoting an event to a gate needs the user's explicit OK.
