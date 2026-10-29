# Oil speed / driver heuristic and VIX-vs-index confirmation — flag only

Source: knowledge/mentor/premarket-routine/oil-vix-2026-10-18.md (mentor premarket video; video-model transcript, **not checked word-by-word**).
Code: `src/macro/oilvix.ts`, rendered in the brief's 【用户要求】原油 block (oil is the user's own must-check block) and in §4 VIX. User-approved 2026-10-18.
**Nothing here changes the verdict, adds a NO_TRADE reason or raises an alarm.** The existing oil alarms (oil.ts) are unchanged: OIL_SPIKE +4% 1d / +10% 5d, OIL_CRASH −5% 1d.

Data: Yahoo daily closes already in the brief — WTI = **front-month contract** (`CLX26.NYM` etc. via `frontContinuous` in src/macro/wtiFront.ts; falls back to `CL=F` if the contract has < 6 bars — Yahoo CL=F rolls early and splices closes, which made a fake −3.7% on 2026-10-19), Brent `BZ=F`, SPX `^GSPC`, NDX `^NDX`, VIX `^VIX`; **new:** copper `HG=F` (series `COPPER`). Changes are over observations (1 = previous close, 5 = five trading days).

## Speed of change
- WTI and Brent: 1-day and 5-day % change.
- ⚡ 快速变动 when **|1d| ≥ 3%** or **|5d| ≥ 8%** for either contract (below the alarm levels on purpose: it is a "look at the reason" prompt, not an alarm).

## Driver hint (HEURISTIC — labelled as such in the brief; may say 无法判断)
5-day moves. No judgement when |WTI 5d| < 2% (「变化不大，不判断」). Dead bands: SPX ±0.5%, copper ±1%, VIX ±5% (relative).
| WTI 5d | Condition | Label |
|---|---|---|
| up | SPX > +0.5% AND copper > +1% AND VIX ≤ 0 | 偏需求（经济较强） |
| up | otherwise, SPX < −0.5% OR VIX > +5% | 偏供应冲击 / 经济负担 → adds 承压板块: 航空（JETS）、可选消费（XLY） |
| up | otherwise | 无法判断 |
| down | SPX > +0.5% AND VIX ≤ 0 | 偏供应缓解（缓解通胀） |
| down | SPX < −0.5% AND copper < −1% | 偏需求走弱（衰退迹象） |
| down | otherwise | 无法判断 |
Missing copper never gets filled in: the demand and demand-weakness cases need it, so without copper they fall to 无法判断 (the row shows 「铜 HG 数据不可用」). Missing WTI or SPX → 无法判断（缺数据）.

## VIX vs index confirmation (5 trading days)
- Index direction = SPX and NDX both beyond ±0.5% in the same direction; otherwise 无法判断（指数无明确方向或分化）.
- VIX direction = beyond ±3%; otherwise 无法判断（VIX 基本持平）.
- **方向确认**: VIX down while indices up, or VIX up while indices down. **背离/未确认**: VIX and indices move the same way.

## Mentor reminders (verbatim quotes from the transcript)
- Oil block always quotes 「我看原油，会同时看价格、变化速度以及背后的原因。」; VIX line always quotes 「结合VIX的变化趋势和指数走势，判断市场方向是否得到确认，而不是单凭一个高低数值下结论。」
- §1.1 导师提醒: `oil_speed` when ⚡ fires; `vix_confirm` when 背离/未确认 fires.
- Plan card: `oil_squeeze` (airline + consumer quotes) when the latest brief (< 24h) says 偏供应冲击 and the plan's symbol (JETS, XLY, XRT, DAL, UAL, AAL, LUV, JBLU, ALK, BKNG, EXPE, ABNB, MAR, HLT, CCL, RCL, NCLH) or thesis (航空 / 机票 / 出行 / 旅游 / 旅行 / 酒店 / 邮轮 / 可选消费 / 消费股 / 零售 / airline / travel / cruise / hotel / consumer / retail / discretionary) involves them.

## VIX 分档 (user-shared infographic, display only)
Source: knowledge/vix-regimes.md (public Douyin-style infographic 如何用VIX观察市场情绪 shared by the user; not the mentor's). Code: `vixRegime` in src/macro/oilvix.ts, shown in §4 above the VIX-vs-index check.
- Bands on the latest VIX close: < 20 🟢 波动较低 · 20–<30 🟡 波动升高 · 30–40 🟠 市场恐惧 · > 40 🔴 极度恐慌. 20 and 30 go to the higher band; exactly 40 stays in 30–40.
- > 40: the infographic's 「分批布局」 is NOT used in phase 1 → 「极度恐慌——第一阶段不抄底，少亏优先，NO_TRADE 合理」.
- Speed: ⚡ 急升 when 1d ≥ +20% or 5d ≥ +35%; ↘ 回落 when 1d ≤ −15% or 5d ≤ −25% (drop thresholds DK-chosen). No history → speed skipped.
- Footer once: 「VIX 是情绪与波动指标，不是独立买卖信号」. Display only: no verdict, alarm, sizing or 能不能睡 effect.

## VIX call hedge
Phase 2 reference only (catalog `phase2-vix-call-hedge`), not enabled, not in the practice rules.


## 2026-10-29 — same-contract 1-day change (Brent + WTI)

Yahoo `BZ=F` rolled Dec→Jan on 2026-10-29 (one day before the Dec LTD) and its daily bars spliced Dec's 115.32 close onto Jan's price ("−4.7%/−5%", the false `OIL_CRASH` in alerts.jsonl). Now (`src/macro/oilContract.ts`): the front contract is the `underlyingSymbol` of `BZ=F` / `CL=F` (Yahoo v7 quote); the 1-day change is **that contract's price ÷ the same contract's previous close − 1** and feeds the oil block, the oil alarms (OIL_SPIKE / OIL_CRASH → event alerts), the 快速变动 flag and the USDCAD line. 5-day / SMA history comes from the contract's own bars (`frontContinuous`). No quote / no underlyingSymbol → 1d n/a and no 1d alarm; the continuous daily bars are never used for the change. A roll (state `data/out/oil-front.json` changed today, or the continuous prev bar ≠ the contract's prev close) is labelled `已换月至 BZF27（Jan 27）`. Thresholds unchanged. Tests: test/oilcontract.test.ts (recorded 2026-10-29 data).

Review follow-ups (PR #15):
- **History = the same contract or nothing.** WTI and Brent 5-day change, 50-day average and 52-week high come only from the underlyingSymbol contract's own bars (the calendar front `wtiFront` is reused only when it *is* that contract). If those bars are missing, or there is no same-contract quote, the row shows n/a, no 5-day OIL_SPIKE fires and no ⚡ shows; the spliced `CL=F` / `BZ=F` bars are never used.
- **Derived lines moved too:** the Brent–WTI spread (level + 5-day, BRENT_WTI_WIDEN), 汽油 vs 原油 (RBOB 5-day vs WTI 5-day) and XLE vs 原油 now use the WTI/Brent contract series. RBOB (`RB=F`) and XLE themselves are unchanged.
- **Roll label** 「已换月至 X」 comes only from the saved state `data/out/oil-front.json` (the contract changed today). A price gap is shown in the note as the would-be fake %, but it is not used to label a roll. On the first run with no state file, no label is shown.
- The contract quote must come back with Yahoo's own `symbol` equal to the requested contract, or the 1-day change is n/a.
- **`--offline`:** there are no quotes, so the oil block uses the old continuous method and says so (「离线…沿用旧的连续合约方法」).
- **50-day average and 52-week high = back-adjusted continuous (回溯调整连续合约).** `frontContinuous` uses the contract itself only for the last ~10 trading days; older history is the continuous `CL=F` / `BZ=F` scaled by the junction ratio. The brief labels both columns 「（回溯调整连续合约）」. They are display only: no alarm (OIL_SPIKE / OIL_CRASH / BRENT_WTI_WIDEN), no ⚡ and no NO_TRADE reads them (test/oilcontract.test.ts).
