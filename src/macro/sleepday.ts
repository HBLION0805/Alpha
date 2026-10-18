/**
 * 今日能不能睡 — the mentor's "不能睡 / 可以睡" day list as a daily label in the brief (premarket + afternoon runs).
 * Flag only / display only: never changes the verdict, never adds a NO_TRADE reason, never suppresses an alert, alarm, brief section or paper mark.
 * 😴 可以睡 = lower-risk day, can relax — NOT "stop watching" (user 2026-10-18). Pure: the CLI passes events, Fed speakers, Trump signals.
 * Source: knowledge/mentor/premarket-routine/sleep-days-2026-10-18.md (verbatim). Rules: docs/SLEEP_DAYS.md.
 * Conflicts: 不能睡 wins over 可以睡; both reasons are shown. Missing data is said, never guessed.
 */
import { NYSE_HOLIDAYS, NYSE_EARLY_CLOSE, NYSE_SOURCE, addDays, dow, covered, isTradingDay, nextTradingDay, thanksgiving, etDate } from "./nyse.ts";
import { opexDate, opexWeek, thirdFriday, isQuadWitching } from "./opex.ts";
import type { FedSpeech, Blackout } from "../ingest/fedSpeakers.ts";

export const SLEEP_FILE = "knowledge/mentor/premarket-routine/sleep-days-2026-10-18.md";
/** verbatim lines of the mentor's list (test: each is a line of SLEEP_FILE) */
export const Q = { opex: "每个月的OpEx", fed: "美联储讲话", trump: "老川准备拉屎的时候", monday: "周一", summer: "美国大部分暑假", xmas: "美国圣诞节到新年", thanks: "美国感恩节前后几天", longWeekend: "美国长周末公众假期前一天" } as const;
export const NO_SLEEP_Q = [Q.opex, Q.fed, Q.trump], SLEEP_Q = [Q.monday, Q.summer, Q.xmas, Q.thanks, Q.longWeekend];
/** user 2026-10-18: 「可以睡不代表不观察的，不是说直接就一点盘不看了」 → appended wherever 😴 可以睡 is shown */
export const SLEEP_NOT_UNWATCHED = "（可以睡≠不看盘：照常看盘前简报和提醒，止损照设）";
export const NORMAL_TEXT = "不在导师清单的两类里，按平常流程";
export const TRUMP_MIN_SCORE = 70; // same bar as a Trump alert (src/trump.ts)
export const TRUMP_WINDOW_H = 24;
/** news headline says Trump is about to announce / sign / address something */
export const TRUMP_SCHEDULED_RE = /\btrump\b[^.?!]{0,50}\b(to|will|set to|expected to|plans? to|poised to|due to|is scheduled to)\s+(announce|unveil|sign|address|deliver|speak|hold an? (news|press) conference|make an? (major )?announcement)\b|(川普|特朗普)[^。？！]{0,12}(将|预计|计划|拟|即将)(宣布|公布|签署|发表|讲话|举行记者会)/i;

export interface SleepEvent { dateET?: string; series?: string; title: string; timeET?: string }
export interface SleepFed { speeches: FedSpeech[]; blackouts: Blackout[]; coverTo: string | null; status: string }
export interface TrumpSignal { posts: Array<{ at: string; score: number; topics: string[]; url?: string }>; scheduled: Array<{ at: string; headline: string }>; status: string }
export interface SleepInput { date: string; now: Date; events: SleepEvent[]; fed: SleepFed | null; trump: TrumpSignal | null }
export interface Reason { text: string; quote: string | null; by: "mentor" | "user" }
export interface SleepDay { date: string; trading: boolean; label: "no_sleep" | "sleep" | "normal" | "closed"; strong: boolean; noSleep: Reason[]; sleep: Reason[]; flags: string[]; notes: string[] }

const WD = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
export const dayName = (d: string) => `${d} ${WD[dow(d)]}`;

export function sleepDay(i: SleepInput): SleepDay {
  const d = i.date, out: SleepDay = { date: d, trading: true, label: "normal", strong: false, noSleep: [], sleep: [], flags: [], notes: [] };
  if (!covered(d)) out.notes.push(`NYSE 假日表只覆盖 2026–2028（${NYSE_SOURCE}），${d.slice(0, 4)} 年的休市/长周末/OpEx 顺延判断不可用`);
  if (!isTradingDay(d)) { out.trading = false; out.label = "closed"; out.notes.unshift(`休市（${NYSE_HOLIDAYS[d] ?? "周末"}）`); return out; }
  const y = Number(d.slice(0, 4)), m0 = Number(d.slice(5, 7)) - 1, today = etDate(i.now);
  // ── 不能睡 ──
  const ox = opexDate(y, m0);
  if (ox === d) {
    const moved = ox !== thirdFriday(y, m0) ? `（第三个周五 ${md(thirdFriday(y, m0))} 休市，提前一天）` : "";
    if (isQuadWitching(m0)) { out.strong = true; out.noSleep.push({ text: `季度四巫日 quad witching（3/6/9/12 月 OpEx，比普通 OpEx 更强）${moved}`, quote: Q.opex, by: "mentor" }); }
    else out.noSleep.push({ text: `月度 OpEx（期权到期日）${moved}`, quote: Q.opex, by: "mentor" });
  } else { const w = opexWeek(d); if (w) out.flags.push(`⚠️ 本周是 OpEx 周（${md(w.opex)} ${WD[dow(w.opex)]}${w.quad ? "，季度四巫日" : ""}到期）`); }
  const ev = i.events.filter((e) => e.dateET === d);
  const fomcDays = new Set([...ev.filter((e) => e.series === "FOMC").map((e) => e.dateET!), ...(i.fed?.blackouts.map((b) => b.meetingEnd) ?? []).filter((x) => x === d)]);
  if (fomcDays.has(d)) out.noSleep.push({ text: "FOMC 利率决议 14:00 ET + 主席记者会 14:30 ET", quote: Q.fed, by: "mentor" });
  for (const e of ev.filter((x) => x.series === "CPI" || x.series === "NFP")) out.noSleep.push({ text: `${e.series === "CPI" ? "CPI" : "非农 NFP"} ${e.timeET ?? "08:30"} ET`, quote: null, by: "user" });
  if (!i.fed) out.notes.push("联储官员讲话数据不可用 → 只按 FOMC 决议/主席记者会日判断（未猜测）");
  else if (!i.fed.coverTo || d > i.fed.coverTo) out.notes.push(`联储官员讲话数据只覆盖到 ${i.fed.coverTo ?? "—"}（${i.fed.status}）→ ${md(d)} 的讲话未知，只按 FOMC 日判断`);
  else {
    const sp = i.fed.speeches.filter((s) => s.date === d && s.speaker);
    if (sp.length) out.noSleep.push({ text: `联储官员讲话：${sp.map((s) => `${s.role ? s.role + " " : ""}${s.speaker}${s.timeEt ? ` ${s.timeEt} ET` : ""}${s.kind === "testimony" ? "（国会作证）" : ""}${s.suspicious ? "（⚠️ 在静默期内，可疑）" : ""}`).join("、")}`, quote: Q.fed, by: "mentor" });
  }
  const bo = i.fed?.blackouts.find((b) => d >= b.from && d < b.to);
  if (bo && !fomcDays.has(d)) out.notes.push(`FOMC 静默期（${bo.from}～${addDays(bo.to, -1)}）：官员一般不谈货币政策`);
  // Trump: recent posts/news only — meaningful for today and the next trading day
  if (d === today || d === nextTradingDay(today)) {
    if (!i.trump) out.notes.push("川普信号不可用（未读到帖子/新闻库）");
    else {
      const since = i.now.getTime() - TRUMP_WINDOW_H * 3600_000, posts = i.trump.posts.filter((p) => Date.parse(p.at) >= since && Date.parse(p.at) <= i.now.getTime() && p.score >= TRUMP_MIN_SCORE);
      if (posts.length) { const top = [...posts].sort((a, b) => b.score - a.score)[0]!; out.noSleep.push({ text: `川普 ${TRUMP_WINDOW_H}h 内发了 ${posts.length} 条市场相关帖（最高 ${top.score} 分：${top.topics.join("、")}）`, quote: Q.trump, by: "mentor" }); }
      const sch = i.trump.scheduled.filter((s) => Date.parse(s.at) >= since);
      if (sch.length) out.noSleep.push({ text: `新闻：川普预计有宣布/讲话（「${sch[0]!.headline.slice(0, 80)}」${sch.length > 1 ? ` 等 ${sch.length} 条` : ""}）`, quote: Q.trump, by: "mentor" });
      out.notes.push(`川普：${i.trump.status}`);
    }
  } else out.notes.push("川普：只看最近 24 小时的帖子/新闻，无法预知");
  // ── 可以睡 ──
  if (dow(d) === 1) out.sleep.push({ text: "周一", quote: Q.monday, by: "mentor" });
  if (m0 === 6 || m0 === 7) out.sleep.push({ text: "7–8 月（美国大部分暑假）", quote: Q.summer, by: "mentor" });
  if ((m0 === 11 && Number(d.slice(8)) >= 24) || d.slice(5) === "01-01") out.sleep.push({ text: "圣诞到新年（12/24–1/1）", quote: Q.xmas, by: "mentor" });
  const tg = thanksgiving(y), tgMon = addDays(tg, -3);
  if (d >= tgMon && d <= addDays(tg, 1)) out.sleep.push({ text: `感恩节当周（感恩节 ${md(tg)}${NYSE_EARLY_CLOSE[addDays(tg, 1)] ? `；${md(addDays(tg, 1))} 黑色星期五半天` : ""}）`, quote: Q.thanks, by: "mentor" });
  if (covered(d)) {
    const n = nextTradingDay(d), gap = (Date.parse(n) - Date.parse(d)) / 86400_000;
    const hol = Array.from({ length: gap - 1 }, (_, k) => addDays(d, k + 1)).find((x) => NYSE_HOLIDAYS[x]);
    if (gap >= 4 && hol) out.sleep.push({ text: `长周末前一天（${md(hol)} ${NYSE_HOLIDAYS[hol]!.replace(/\s*[A-Za-z].*$/, "")} 休市，${md(addDays(d, 1))}–${md(addDays(n, -1))} 连休）`, quote: Q.longWeekend, by: "mentor" });
  }
  if (NYSE_EARLY_CLOSE[d]) out.notes.push(`NYSE 提前收盘：${NYSE_EARLY_CLOSE[d]}（期权 13:15）`);
  out.label = out.noSleep.length ? "no_sleep" : out.sleep.length ? "sleep" : "normal";
  return out;
}

const r = (x: Reason) => `${x.text}${x.quote ? `（导师：「${x.quote}」）` : "（用户补充）"}`;
export function sleepLine(s: SleepDay, head: string): string {
  const h = `**${head}（${dayName(s.date)}）：`;
  const flags = s.flags.length ? ` · ${s.flags.join(" · ")}` : "";
  if (s.label === "closed") return `${h}休市**${flags}`;
  if (s.label === "no_sleep") return `${h}${s.strong ? "🚨🚨 不能睡（加强）" : "🚨 不能睡"}** — ${s.noSleep.map(r).join("；")}${s.sleep.length ? ` · 可以睡的理由也成立，但不能睡优先：${s.sleep.map(r).join("；")}` : ""}${flags}`;
  if (s.label === "sleep") return `${h}😴 可以睡** — ${s.sleep.map(r).join("；")}${flags} ${SLEEP_NOT_UNWATCHED}`;
  return `${h}普通** — ${NORMAL_TEXT}${flags}`;
}

/** Brief section: today; plus the next trading day in the afternoon run (ET ≥ 12:00) or when today is closed. */
export function renderSleep(base: Omit<SleepInput, "date">): { lines: string[]; today: SleepDay; next: SleepDay | null } {
  const d = etDate(base.now), hour = Number(base.now.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false }));
  const t = sleepDay({ ...base, date: d }), n = !t.trading || hour >= 12 ? sleepDay({ ...base, date: nextTradingDay(d) }) : null;
  const L = ["### 今日能不能睡（导师清单 · 只标记，不改变结论）", ""];
  for (const [s, head] of [[t, "今日"], ...(n ? [[n, "下一个交易日"]] : [])] as Array<[SleepDay, string]>) {
    L.push(`- ${sleepLine(s, head)}`, ...[...new Set(s.notes)].map((x) => `  - ${x}`));
  }
  L.push(`- 导师清单（原文）→ [sleep-days-2026-10-18.md](${SLEEP_FILE})：不能睡 ${NO_SLEEP_Q.map((q) => `「${q}」`).join("")}；可以睡 ${SLEEP_Q.map((q) => `「${q}」`).join("")}`,
    "- _CPI / 非农是用户补充；OpEx 周和季度四巫日是用户要求的加注。规则：docs/SLEEP_DAYS.md_", "");
  return { lines: L, today: t, next: n };
}

/** brief-latest.json `sleep` field — informational only; nothing reads it back. */
export function sleepJson(r: { today: SleepDay; next: SleepDay | null }) {
  const j = (s: SleepDay) => ({ date: s.date, label: s.label, strong: s.strong, noSleep: s.noSleep.map((x) => x.text), sleep: s.sleep.map((x) => x.text), meaning: s.label === "sleep" ? SLEEP_NOT_UNWATCHED : undefined });
  return { today: j(r.today), next: r.next ? j(r.next) : null };
}
