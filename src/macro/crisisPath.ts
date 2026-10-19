/**
 * 危机路径追踪 (crisis path tracker). Semi-monthly standalone report (src/cli/crisisPath.ts, npm run crisis-path) —
 * display only: never generates trades and never feeds NO_TRADE, sizing, 48h/72h or 能不能睡; not part of the daily
 * brief and sends no alerts. Signals: knowledge/macro/crisis-signals.json (from the 2026-10-19 crisis comparison report §8).
 * Pure: the CLI passes fetched series; a missing / failed / stale series is 无数据 and NEVER changes the persisted state
 * (a proxy TLS outage must not look like a regime switch).
 */
import { readFileSync, existsSync } from "node:fs";
import { isTradingDay, nextTradingDay } from "./nyse.ts";
import type { Obs } from "./fetch.ts";

export const SIGNALS_FILE = "knowledge/macro/crisis-signals.json";
export type Status = "untriggered" | "near" | "triggered";
export const STATUS_ZH: Record<Status | "nodata", string> = { untriggered: "未触发", near: "接近", triggered: "触发", nodata: "无数据" };
export interface SignalDef { id: string; path: string; label: string; kind: string; series?: string; symbols?: string[]; n?: number; threshold?: number; near?: number; unit?: string;
  maxAgeDays?: number; requires?: string; readings?: Array<{ date: string; v: number; source: string }>; ref?: string; reportRef: string }
export interface SignalsFile { report: string; paths: Record<string, { label: string; short: string }>; signals: SignalDef[] }
export interface Eval { id: string; path: string; label: string; status: Status | "nodata"; value: number | null; display: string; threshold: string; asOf: string | null; note?: string }
export interface SigState { status: Status | null; firstTriggered: string | null; lastTriggered: string | null; clearedAt: string | null; lastValue: number | null; lastAsOf: string | null; lastGoodRun: string | null }
export interface CrisisState { version: 1; runs: Array<{ date: string; noData: string[] }>; signals: Record<string, SigState> }

export function loadSignals(path = SIGNALS_FILE): SignalsFile {
  const f = JSON.parse(readFileSync(path, "utf8")) as SignalsFile;
  for (const s of f.signals) if (!f.paths[s.path] || !s.id || !s.kind) throw new Error(`crisis-signals: bad signal ${s.id}`);
  return f;
}
export const emptyState = (): CrisisState => ({ version: 1, runs: [], signals: {} });
export function loadState(path: string): CrisisState {
  if (!existsSync(path)) return emptyState();
  const s = JSON.parse(readFileSync(path, "utf8")) as CrisisState; return s?.version === 1 && s.signals ? s : emptyState();
}

const days = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a.slice(0, 10) + "T12:00:00Z")) / 864e5);
const f2 = (x: number, d = 2) => x.toFixed(d), pc = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(1)}%`;
const ok = (o: Obs[] | undefined) => (o ?? []).filter((x) => Number.isFinite(x.v) && x.v > -1e9);
const ddOf = (o: Obs[]) => { const w = o.slice(-252), hi = Math.max(...w.map((x) => x.v)); return (o.at(-1)!.v / hi - 1) * 100; };
const sma = (o: Obs[], n: number) => o.length >= n ? o.slice(-n).reduce((a, x) => a + x.v, 0) / n : null;

/** one signal from the fetched series (keys: "fred:ID", "yahoo:SYM", "wti_front") */
export function evaluate(s: SignalDef, data: Record<string, Obs[]>, today: string, done: Record<string, Eval> = {}): Eval {
  const base = { id: s.id, path: s.path, label: s.label }, th = s.threshold ?? 0, nr = s.near ?? th, u = s.unit ?? "";
  const none = (note: string, asOf: string | null = null): Eval => ({ ...base, status: "nodata", value: null, display: "n/a", threshold: thText(s), asOf, note });
  const stale = (asOf: string) => s.maxAgeDays != null && days(asOf, today) > s.maxAgeDays;
  const st = (trig: boolean, near: boolean): Status => trig ? "triggered" : near ? "near" : "untriggered";
  if (s.kind === "ref") { const r = done[s.ref!]; return r ? { ...r, ...base, threshold: `同 ${r.label}：${r.threshold}`, note: `跟随 ${s.ref}` } : none(`缺 ${s.ref}`); }
  if (s.kind === "manual_rising") {
    const R = (s.readings ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)), z = R.at(-1), p = R.at(-2);
    if (!z) return none("没有手工读数");
    if (stale(z.date)) return none(`手工读数 ${z.date} 已过期（> ${s.maxAgeDays} 天）→ 请更新 crisis-signals.json`, z.date);
    const rising = p ? z.v > p.v : false;
    return { ...base, status: st(z.v > th, z.v >= nr && rising), value: z.v, display: `${f2(z.v)}${u}${p ? `（上次 ${f2(p.v)}${u}，${rising ? "上升" : "未上升"}）` : ""}`, threshold: thText(s), asOf: z.date, note: z.source };
  }
  const sym = (x: string) => ok(data[`yahoo:${x}`]);
  if (s.kind === "break_200dma_or_dd" || s.kind === "dd_any") {
    const parts: string[] = []; let trig = false, near = false, worst: number | null = null, asOf = "", miss: string[] = [];
    for (const x of s.symbols ?? []) {
      const o = sym(x); if (o.length < (s.kind === "dd_any" ? 60 : 200) || stale(o.at(-1)!.t)) { miss.push(x); continue; }
      const dd = ddOf(o), last = o.at(-1)!.v; worst = worst == null ? dd : Math.min(worst, dd); const t = o.at(-1)!.t.slice(0, 10); asOf = asOf && asOf < t ? asOf : t;
      if (s.kind === "dd_any") { trig ||= dd <= th; near ||= dd <= nr; parts.push(`${x} ${pc(dd)}`); continue; }
      const m = sma(o, 200)!, vs = (last / m - 1) * 100;
      trig ||= last < m || dd <= th; near ||= vs < 2 || dd <= nr; parts.push(`${x} 距高点 ${pc(dd)} · 距 200 日线 ${pc(vs)}`);
    }
    if (worst == null) return none(`缺 ${miss.join("/")} 行情`);
    const notes = miss.length ? [`缺 ${miss.join("/")}（只用了其余）`] : [];
    if (s.requires && trig) { const r = done[s.requires];
      if (r?.status !== "triggered") { trig = false; near = true; notes.push(r && r.status !== "nodata" ? `主题已破位，但 ${r.label} ${r.display} 未触发 → 只算接近` : `主题已破位，${s.requires} 无数据 → 只算接近`); } else notes.push(`且 ${r.label} 已触发`); }
    return { ...base, status: st(trig, near), value: worst, display: parts.join("；"), threshold: thText(s) + (s.requires ? `，且 ${s.requires} 触发` : ""), asOf, note: notes.length ? notes.join("；") : undefined };
  }
  if (s.kind === "both_down") {
    const r: Array<[string, number]> = []; let asOf: string | null = null;
    for (const x of s.symbols ?? []) { const o = sym(x); const n = s.n ?? 20; if (o.length < n + 1 || stale(o.at(-1)!.t)) return none(`缺 ${x} 行情`); r.push([x, (o.at(-1)!.v / o.at(-n - 1)!.v - 1) * 100]); asOf = o.at(-1)!.t.slice(0, 10); }
    const neg = r.filter(([, v]) => v < 0).length, trig = neg === r.length, near = neg >= 1 && r.every(([, v]) => v < nr);
    return { ...base, status: st(trig, near), value: Math.max(...r.map(([, v]) => v)), display: r.map(([x, v]) => `${x} ${pc(v)}`).join("；"), threshold: thText(s), asOf };
  }
  const o = ok(data[s.series!]);
  if (!o.length) return none(`${s.series} 抓取失败或无数据`);
  const z = o.at(-1)!; if (stale(z.t)) return none(`${s.series} 最新 ${z.t.slice(0, 10)}，已过期（> ${s.maxAgeDays} 天）`, z.t.slice(0, 10));
  const asOf = z.t.slice(0, 10), mk = (v: number, trig: boolean, near: boolean, display: string, note?: string): Eval => ({ ...base, status: st(trig, near), value: v, display, threshold: thText(s), asOf, note });
  switch (s.kind) {
    case "last_gt": return mk(z.v, z.v > th, z.v >= nr, `${f2(z.v)}${u}`);
    case "last_gte": return mk(z.v, z.v >= th, z.v >= nr, `${f2(z.v)}${u}`);
    case "last_lt": return mk(z.v, z.v < th, z.v < nr, `${f2(z.v)}${u}`);
    case "avg_gt": { const n = s.n ?? 4; if (o.length < n) return none("数据不足"); const a = o.slice(-n).reduce((x, y) => x + y.v, 0) / n; return mk(a, a > th, a >= nr, `${Math.round(a).toLocaleString("en-US")}（最新一周 ${Math.round(z.v).toLocaleString("en-US")}）`); }
    case "ann3m_gt": { if (o.length < 4) return none("数据不足"); const a = (Math.pow(z.v / o.at(-4)!.v, 4) - 1) * 100; return mk(a, a > th, a >= nr, `${f2(a)}%（${o.at(-4)!.t.slice(0, 7)} → ${asOf.slice(0, 7)}）`); }
    case "sustained_gt": { const n = s.n ?? 5; if (o.length < n) return none("数据不足"); const w = o.slice(-n); const all = w.every((x) => x.v > th);
      return mk(z.v, all, z.v >= nr || w.some((x) => x.v > th), `${f2(z.v)}（最近 ${n} 个收盘 ${f2(Math.min(...w.map((x) => x.v)))}–${f2(Math.max(...w.map((x) => x.v)))}）`); }
    case "vix_spike": { const n = s.n ?? 10; if (o.length < 2 * n + 1) return none("数据不足");
      let trig = false; for (let i = o.length - n; i < o.length; i++) if (o[i]!.v > th && Math.min(...o.slice(Math.max(0, i - n), i).map((x) => x.v)) < 20) trig = true;
      const lo = Math.min(...o.slice(-n - 1).map((x) => x.v)); return mk(z.v, trig, z.v >= nr, `${f2(z.v)}（近 ${n} 日最低 ${f2(lo)}）`); }
  }
  return none(`未知 kind ${s.kind}`);
}
export function thText(s: SignalDef): string {
  const u = s.unit ?? "";
  switch (s.kind) {
    case "last_gt": case "avg_gt": case "ann3m_gt": return `> ${s.threshold}${u === "人" ? "" : u}（接近 ≥ ${s.near}）`;
    case "last_gte": return `≥ ${s.threshold}（接近 ≥ ${s.near}）`;
    case "last_lt": return `< ${s.threshold}（接近 < ${s.near}）`;
    case "sustained_gt": return `最近 ${s.n} 个收盘都 > ${s.threshold}（接近：现价 ≥ ${s.near} 或其中一天 > ${s.threshold}）`;
    case "break_200dma_or_dd": return `跌破 200 日线，或距 52 周高点 ≤ ${s.threshold}%（接近：离 200 日线 < 2% 或 ≤ ${s.near}%）`;
    case "dd_any": return `任一距 52 周高点 ≤ ${s.threshold}%（接近 ≤ ${s.near}%）`;
    case "both_down": return `${s.symbols?.join(" 与 ")} ${s.n} 日都 < 0（接近：一个 < 0、另一个 < +${s.near}%）`;
    case "manual_rising": return `> ${s.threshold}%（接近：≥ ${s.near}% 且比上次上升）`;
    case "vix_spike": return `${s.n} 个交易日内从 < 20 升到 > ${s.threshold}（接近 ≥ ${s.near}）`;
    default: return "";
  }
}
export function evaluateAll(f: SignalsFile, data: Record<string, Obs[]>, today: string): Eval[] {
  const done: Record<string, Eval> = {};
  const dep = (x: SignalDef) => x.kind === "ref" || !!x.requires;
  for (const s of [...f.signals.filter((x) => !dep(x)), ...f.signals.filter(dep)]) done[s.id] = evaluate(s, data, today, done);
  return f.signals.map((s) => done[s.id]!);
}

export interface Transition { id: string; from: Status | null; to: Status }
/** no data → state untouched; first 触发 records the data date (asOf) once and keeps it */
export function updateState(prev: CrisisState, evals: Eval[], runDate: string): { state: CrisisState; transitions: Transition[]; newlyTriggered: string[] } {
  const state: CrisisState = JSON.parse(JSON.stringify(prev)), transitions: Transition[] = [], newly: string[] = [];
  for (const e of evals) {
    const p = state.signals[e.id] ?? { status: null, firstTriggered: null, lastTriggered: null, clearedAt: null, lastValue: null, lastAsOf: null, lastGoodRun: null };
    if (e.status === "nodata") { state.signals[e.id] = p; continue; }
    const day = e.asOf ?? runDate;
    if (p.status !== e.status) transitions.push({ id: e.id, from: p.status, to: e.status });
    if (e.status === "triggered") { if (p.status !== "triggered") { newly.push(e.id); p.lastTriggered = day; } p.firstTriggered ??= day; }
    else if (p.status === "triggered") p.clearedAt = day;
    Object.assign(p, { status: e.status, lastValue: e.value, lastAsOf: e.asOf, lastGoodRun: runDate });
    state.signals[e.id] = p;
  }
  state.runs = [...state.runs.filter((r) => r.date !== runDate), { date: runDate, noData: evals.filter((e) => e.status === "nodata").map((e) => e.id) }].slice(-48);
  return { state, transitions, newlyTriggered: newly };
}

export interface PathScore { path: string; label: string; triggered: number; near: number; n: number; score: number; first: string | null }
/** effective status = this run's, or the last known one when this run had no data */
export function scorePaths(f: SignalsFile, evals: Eval[], state: CrisisState): { scores: PathScore[]; order: Array<{ id: string; path: string; label: string; date: string }>; lead: string; leadWhy: string } {
  const eff = (e: Eval) => e.status === "nodata" ? state.signals[e.id]?.status ?? null : e.status;
  const order = f.signals.map((s) => ({ id: s.id, path: s.path, label: s.label, date: state.signals[s.id]?.firstTriggered ?? "" })).filter((x) => x.date).sort((a, b) => a.date.localeCompare(b.date) || f.signals.findIndex((s) => s.id === a.id) - f.signals.findIndex((s) => s.id === b.id));
  const scores = Object.entries(f.paths).map(([path, p]) => { const E = evals.filter((e) => e.path === path), t = E.filter((e) => eff(e) === "triggered").length, nr = E.filter((e) => eff(e) === "near").length;
    return { path, label: p.label, triggered: t, near: nr, n: E.length, score: (2 * t + nr) / (2 * E.length), first: order.find((o) => o.path === path)?.date ?? null }; });
  const byScore = (a: PathScore, b: PathScore) => b.score - a.score || b.triggered - a.triggered;
  let lead: string, why: string;
  if (order.length) { const d0 = order[0]!.date, firsts = scores.filter((s) => s.first === d0).sort(byScore);
    lead = firsts[0]!.path; why = `最早触发的信号（${order.filter((o) => o.date === d0).map((o) => o.label).join("、")}，${d0}）属于 ${f.paths[lead]!.label}`; }
  else { const s = scores.slice().sort(byScore)[0]!; lead = s.score > 0 ? s.path : "none"; why = s.score > 0 ? `还没有信号触发；按「接近」数量，${s.label} 最多（${s.near} 个接近）` : "还没有信号触发或接近"; }
  return { scores, order, lead, leadWhy: why };
}

/** semi-monthly schedule: the 1st and the 15th, or the next NYSE trading day; due also when a scheduled run was missed */
export function dueDates(year: number, month: number): string[] {
  return [1, 15].map((d) => { const x = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`; return isTradingDay(x) ? x : nextTradingDay(x); });
}
export function isDue(today: string, lastRun: string | null): { due: boolean; slot: string | null } {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7)), py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
  const slot = [...dueDates(py, pm), ...dueDates(y, m)].filter((d) => d <= today).at(-1) ?? null;
  return { due: slot != null && (lastRun == null || lastRun < slot), slot };
}

export function renderCrisis(f: SignalsFile, evals: Eval[], state: CrisisState, now: Date, runDate: string, newly: string[]): string {
  const sc = scorePaths(f, evals, state), icon = (s: Status | "nodata") => ({ triggered: "🔴", near: "🟡", untriggered: "🟢", nodata: "⚪" })[s];
  const L = [`# 危机路径追踪 — ${runDate}`, "",
    `_半月一次（每月 1 日、15 日，遇休市顺延到下一个交易日）。信号和阈值来自 [${f.report.split("/").pop()}](${f.report}) §8，是经验警戒线，不是交易规则。只显示：不产生交易，不改 NO_TRADE、仓位、48h/72h 或「能不能睡」，不发警报。⚪ 无数据 = 抓取失败或数据过期，沿用上次状态，不算状态变化。_`, "",
    `**最像哪条路径：** ${sc.lead === "none" ? "暂无" : f.paths[sc.lead]!.label} — ${sc.leadWhy}`, "",
    `**首次触发顺序：** ${sc.order.length ? sc.order.map((o, k) => `${k + 1}. ${o.label}（${f.paths[o.path]!.short}，${o.date}）`).join(" → ") : "还没有信号触发过"}`,
    ...(sc.order.some((o) => o.date === state.runs[0]?.date) ? [`_${state.runs[0]!.date} 是第一次运行（基线）：当天已经触发的信号都记成这一天，它们之间的先后没有意义；同一天并列时按路径得分排。_`] : []), "",
    ...(newly.length ? [`**本次新触发：** ${newly.map((id) => evals.find((e) => e.id === id)!.label).join("、")}`, ""] : []),
    "| 路径 | 触发 | 接近 | 信号数 | 得分 |", "|---|---|---|---|---|",
    ...sc.scores.map((s) => `| ${s.label} | ${s.triggered} | ${s.near} | ${s.n} | ${(s.score * 100).toFixed(0)}% |`), "",
    "_得分 = (2 × 触发 + 1 × 接近) / (2 × 信号数)；无数据的信号按上次状态计。_", ""];
  for (const [path, p] of Object.entries(f.paths)) {
    L.push(`## ${p.label}`, "", "| 信号 | 当前值 | 阈值 | 状态 | 首次触发 | 数据日期 |", "|---|---|---|---|---|---|");
    for (const e of evals.filter((x) => x.path === path)) {
      const s = state.signals[e.id], prev = e.status === "nodata" && s?.status ? `（沿用上次：${STATUS_ZH[s.status]}）` : "";
      L.push(`| ${e.label} | ${e.display}${e.note ? `<br>_${e.note}_` : ""} | ${e.threshold} | ${icon(e.status)} ${STATUS_ZH[e.status]}${prev} | ${s?.firstTriggered ?? "—"} | ${e.asOf ?? "—"} |`);
    }
    L.push("");
  }
  L.push(`_生成于 ${now.toLocaleString("sv-SE", { timeZone: "America/New_York" }).slice(0, 16)} ET。状态文件 data/crisis-path-state.json。_`);
  return L.join("\n");
}
