# 今日能不能睡 — the mentor's day list as a brief label (flag only)

Source: knowledge/mentor/premarket-routine/sleep-days-2026-10-18.md (the mentor's post, verbatim; 老川 = Trump). Code: `src/macro/sleepday.ts`, NYSE calendar `src/macro/nyse.ts`, OpEx `src/macro/opex.ts`. User-approved 2026-10-18.
Shown in brief §1 under the verdict, on every `npm run brief` (premarket and afternoon runs). **It never changes the verdict and never adds a NO_TRADE reason.** Each reason cites the mentor line it maps to; CPI / NFP are marked 用户补充.

**What 😴 可以睡 means (用户补充, 2026-10-18):** 「可以睡不代表不观察的，不是说直接就一点盘不看了」. It marks a lower-risk day where you can relax; it does **not** mean stop watching. Every 可以睡 line ends with 「（可以睡≠不看盘：照常看盘前简报和提醒，止损照设）」. 普通 is neutral: 「不在导师清单的两类里，按平常流程」.

**Display only:** the label is computed in `src/cli/brief.ts` and used only for the brief text (`sleepLines`) and the `sleep` field of brief-latest.json, which nothing reads. It never suppresses or skips an alert, alarm, brief section, event alert, or paper mark (test/sleepday.test.ts checks this both statically and on the rendered brief).

Labels: 🚨 不能睡 · 🚨🚨 不能睡（加强）(quad witching) · 😴 可以睡 · 普通 · 休市. **不能睡 wins over 可以睡**; both sets of reasons are printed.
Today is always shown; the next trading day is added when the run is at/after 12:00 ET (afternoon brief) or when today is closed.

## 不能睡
| Trigger | Rule | Data |
|---|---|---|
| 「每个月的OpEx」 | monthly OpEx = 3rd Friday, or the previous trading day if that Friday is an NYSE holiday (2026-06-18, 2027-06-17). Mar/Jun/Sep/Dec = quad witching → 加强. Other days of the OpEx week only get a ⚠️ OpEx 周 flag (label unchanged). | computed; holidays from nyse.ts |
| 「美联储讲话」 | FOMC decision day (14:00 ET statement + 14:30 Chair press conference) | knowledge/calendar/major-events (federalreserve.gov FOMC calendar) + FOMC meetings in the Fed speakers cache |
| 「美联储讲话」 | any Fed official's listed speech / discussion / testimony that day | `data/in/fed-speakers.json` (npm run fedspeak / brief): Board calendar JSON federalreserve.gov/json/calendar.json + the 12 Reserve Bank pages + a secondary calendar. Covers ~14 days from the fetch; beyond that the label says 讲话未知 and judges FOMC days only. Missing cache → 讲话数据不可用. FOMC blackout days are noted. |
| 「老川准备拉屎的时候」 | today / next trading day only: a Trump post in the last 24h scoring ≥ 70 (the same bar as a Trump alert, src/trump.ts) from Truth Social / X in the news store, or a headline in the last 24h matching "Trump to/will/expected to announce/sign/address…" (`TRUMP_SCHEDULED_RE`) | news store (data/alpha-news.sqlite); the status line shows the newest Trump post time and warns when it is > 24h old |
| CPI / 非农（用户补充） | release day 08:30 ET | knowledge/calendar/major-events (bls.gov schedules) |

## 可以睡
| Mentor line | Rule |
|---|---|
| 「周一」 | Monday |
| 「美国大部分暑假」 | July 1 – August 31 |
| 「美国圣诞节到新年」 | Dec 24 – Jan 1 |
| 「美国感恩节前后几天」 | Mon–Fri of Thanksgiving week (Black Friday 13:00 early close noted) |
| 「美国长周末公众假期前一天」 | the trading day before an NYSE holiday that makes a ≥ 3-day break (next trading day ≥ 4 calendar days later) |

NYSE holidays and early closes are hard-coded from https://www.nyse.com/markets/hours-calendars (fetched 2026-10-18; 2026–2028). Outside those years the label says the holiday-based rules are unavailable. Update the list when NYSE publishes 2029.
