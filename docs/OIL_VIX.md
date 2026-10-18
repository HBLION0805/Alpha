# Oil speed / driver heuristic and VIX-vs-index confirmation — flag only

Source: knowledge/mentor/premarket-routine/oil-vix-2026-10-18.md (mentor premarket video; video-model transcript, **not checked word-by-word**).
Code: `src/macro/oilvix.ts`, rendered in the brief's 【用户要求】原油 block (oil is the user's own must-check block) and in §4 VIX. User-approved 2026-10-18.
**Nothing here changes the verdict, adds a NO_TRADE reason or raises an alarm.** The existing oil alarms (oil.ts) are unchanged: OIL_SPIKE +4% 1d / +10% 5d, OIL_CRASH −5% 1d.

Data: Yahoo daily closes already in the brief — WTI `CL=F`, Brent `BZ=F`, SPX `^GSPC`, NDX `^NDX`, VIX `^VIX`; **new:** copper `HG=F` (series `COPPER`). Changes are over observations (1 = previous close, 5 = five trading days).

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

## VIX call hedge
Phase 2 reference only (catalog `phase2-vix-call-hedge`), not enabled, not in the practice rules.
