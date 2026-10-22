/**
 * 大佬今日价位 — key levels from the mentor's market dailies, data-driven from knowledge/mentor/market-calls/levels.json
 * (one dated entry per daily; quotes verbatim from the archived article). Brief §1.3 block, dead-cat checklist item,
 * tech-long plan-card quote. DISPLAY ONLY: never feeds the verdict, NO_TRADE, 48h/72h, alerts, sizing or 能不能睡.
 * Phases (ET): pre (< 09:30) · intraday · closed (≥ 16:00 on that trading day = afternoon run reports the close) ·
 * next trading day with no new entry → recap of the previous entry against that day's close.
 */
import { readFileSync, existsSync } from "node:fs";
import type { Obs } from "./fetch.ts";
import type { SeriesDef } from "./series.ts";
import { etDate, prevTradingDay, isTradingDay } from "./nyse.ts";
import { wtiFront } from "./wtiFront.ts";

export const LEVELS_FILE = "knowledge/mentor/market-calls/levels.json";
export interface MentorLevel { id: string; label: string; series: string; level: number; rule: "close_above" | "stay_below"; unit: string; meaning: string; quote: string; cardHook?: "tech_long"; checklist?: boolean }
export interface LevelEntry { date: string; source: string; watch?: { series: string[]; quote: string }; levels: MentorLevel[] }

export function parseLevels(json: unknown): LevelEntry[] {
  const j = json as { entries?: unknown };
  if (!j || !Array.isArray(j.entries)) throw new Error("levels.json: no entries array");
  return j.entries.map((e: LevelEntry, i: number) => {
    if (!/^\d{4}-\d\d-\d\d$/.test(e.date) || !Array.isArray(e.levels) || typeof e.source !== "string") throw new Error(`levels.json entry ${i}: bad date/levels/source`);
    for (const l of e.levels) if (!l.id || !l.series || !Number.isFinite(l.level) || !["close_above", "stay_below"].includes(l.rule) || !l.quote) throw new Error(`levels.json ${e.date}: bad level ${l.id}`);
    return e;
  });
}
export function loadLevels(path = LEVELS_FILE): { entries: LevelEntry[]; error?: string } {
  if (!existsSync(path)) return { entries: [], error: `${path} missing` };
  try { return { entries: parseLevels(JSON.parse(readFileSync(path, "utf8"))) }; } catch (e) { return { entries: [], error: (e as Error).message }; }
}
/** today's entry, else the previous trading day's (recap) */
export function activeEntry(entries: LevelEntry[], now: Date): { entry: LevelEntry; recap: boolean } | null {
  const d = etDate(now), t = entries.find((e) => e.date === d);
  if (t) return { entry: t, recap: false };
  const p = entries.find((e) => e.date === (isTradingDay(d) ? prevTradingDay(d) : prevTradingDay(d)));
  return p ? { entry: p, recap: true } : null;
}
/** Yahoo series to fetch for an entry; @WTI_FRONT resolves to the front CL contract on the entry date */
export function levelSeries(e: LevelEntry): Array<{ key: string; def: SeriesDef }> {
  const ref = (s: string) => (s === "@WTI_FRONT" ? wtiFront(e.date).yahoo : s);
  return [...new Set(e.levels.map((l) => l.series))].map((s) => ({ key: s, def: { id: `ML_${s}`, provider: "yahoo", ref: ref(s), label: s, unit: "price", frequency: "daily" } }));
}

export type Phase = "pre" | "intraday" | "closed";
export function phaseOf(now: Date): Phase {
  const hm = Number(now.toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", ""));
  return hm < 930 ? "pre" : hm < 1600 ? "intraday" : "closed";
}
export type LvStatus = "ok" | "warn" | "fail" | "na";
export interface LevelState { id: string; label: string; value: number | null; asOf: string | null; level: number; above: boolean | null; dist: number | null; distPct: number | null; status: LvStatus; text: string; final: boolean }
const n2 = (x: number, u: string) => `${u}${x.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: x >= 1000 ? 0 : 2 })}`;
const sgn = (x: number, d = 2) => `${x >= 0 ? "+" : ""}${x.toFixed(d)}`;

/** one level vs its series. recap/closed → judged on the entry date's daily close (final) */
export function levelState(l: MentorLevel, o: Obs[] | undefined, entryDate: string, phase: Phase, recap: boolean): LevelState {
  const bar = recap ? o?.find((x) => x.t.slice(0, 10) === entryDate) : o?.at(-1);
  const base = { id: l.id, label: l.label, level: l.level };
  if (!bar || (!recap && bar.t.slice(0, 10) < entryDate && phase !== "pre")) return { ...base, value: null, asOf: bar?.t ?? null, above: null, dist: null, distPct: null, status: "na", text: `n/a（没有 ${entryDate} 的数据）`, final: false };
  const v = bar.v, above = v >= l.level, dist = v - l.level, distPct = (dist / l.level) * 100, final = recap || phase === "closed";
  const where = `${n2(v, l.unit)}，${above ? "在上方" : "在下方"} ${sgn(dist, l.level >= 1000 ? 0 : 2)}（${sgn(distPct)}%）`;
  let status: LvStatus, call: string;
  if (l.rule === "close_above") {
    status = above ? "ok" : final ? "fail" : "warn";
    call = final ? (above ? `✅ 收盘守住 ${n2(l.level, l.unit)}` : `❌ 收盘失守 ${n2(l.level, l.unit)}`) : above ? `目前守住，要看收盘` : `目前在下方，收盘前必须站回 ${n2(l.level, l.unit)}`;
  } else {
    status = above ? "fail" : "ok";
    call = above ? `🔴 站上 ${n2(l.level, l.unit)}` : `在 ${n2(l.level, l.unit)} 下方`;
  }
  return { ...base, value: v, asOf: bar.t, above, dist, distPct, status, text: `${where} — ${call}`, final };
}
const ICON: Record<LvStatus, string> = { ok: "🟢", warn: "🟡", fail: "🔴", na: "➖" };
const DIR = (x: number | null, band: number) => (x == null ? "?" : x > band ? "↑" : x < -band ? "↓" : "—");
const c1 = (o?: Obs[], bp = false) => (!o || o.length < 2 ? null : bp ? (o.at(-1)!.v - o.at(-2)!.v) * 100 : (o.at(-1)!.v / o.at(-2)!.v - 1) * 100);

export interface LevelsResult { lines: string[]; states: LevelState[]; entry: LevelEntry | null; recap: boolean; phase: Phase }
/** data: premarket series (DXY, UST30Y, …) plus level series keyed by their `series` string (CRWV, NQ=F, @WTI_FRONT) */
export function renderMentorLevels(entries: LevelEntry[], data: Record<string, Obs[]>, now: Date, loadError?: string): LevelsResult {
  const a = activeEntry(entries, now), phase = phaseOf(now);
  if (!a) return { lines: loadError ? [`- **大佬今日价位**：不可用（${loadError}）`, ""] : [], states: [], entry: null, recap: false, phase };
  const { entry, recap } = a, src = entry.source;
  const states = entry.levels.map((l) => levelState(l, data[l.series], entry.date, phase, recap));
  const front = entry.levels.some((l) => l.series === "@WTI_FRONT") ? wtiFront(entry.date) : null;
  const head = recap ? `- **大佬价位回顾（${entry.date} 日报，按当天收盘）**` : `- **大佬今日价位（${entry.date} 日报）**${phase === "closed" ? " — 收盘结果" : phase === "pre" ? " — 盘前" : " — 盘中（未收盘）"}`;
  const L = [head];
  for (const [i, s] of states.entries()) {
    const l = entry.levels[i]!;
    const note = l.series === "@WTI_FRONT" && front ? `（近月 ${front.code}，${front.expiry} 到期；= CNBC @CL.1）` : l.series === "NQ=F" && (recap || phase === "closed") ? "（期货 17:00 ET 才结算，这里是日线最新值）" : "";
    L.push(`  - ${ICON[s.status]} ${l.label}：${s.text}${note}`, `    - 大佬：「${l.quote}」`);
  }
  if (entry.watch && !recap) {
    const w = entry.watch, oil = data["@WTI_FRONT"] ?? data.WTI_FRONT ?? data.WTI;
    const dxy = c1(data.DXY), y30 = c1(data.UST30Y?.length ? data.UST30Y : data.UST30Y_FRED, true), o1 = c1(oil);
    L.push(`  - 看这三个找答案：DXY ${DIR(dxy, 0.1)} ${dxy == null ? "n/a" : `${sgn(dxy)}%`} · 油价 ${DIR(o1, 0.5)} ${o1 == null ? "n/a" : `${sgn(o1)}%`}${oil === data["@WTI_FRONT"] && front ? `（${front.code}）` : ""} · 30Y ${DIR(y30, 2)} ${y30 == null ? "n/a" : `${sgn(y30, 1)}bp`}（1 日）`,
      `    - 大佬：「${w.quote}」`);
    const wti = states.find((s) => s.id.startsWith("wti")), recess = wti?.above && y30 != null && y30 < -2;
    if (recess) L.push("  - ⚠️ 油价站上 100、30Y 同时下跌 = 大佬说的衰退信号组合（算法抛售指数）");
  }
  if ((phase === "closed" || recap) && states.some((s) => s.final)) {
    const fin = states.filter((s) => s.final && entry.levels.find((l) => l.id === s.id)!.rule === "close_above");
    if (fin.length) L.push(`  - ${recap ? "回顾" : "下午场"}：${fin.map((s) => `${s.label} ${s.above ? "✅ 收在上方" : "❌ 收在下方"}`).join(" · ")}`);
  }
  L.push(`  - _原文：${src}；价位数据：${LEVELS_FILE}（只显示，不改结论 / 48h·72h / 能不能睡）_`, "");
  return { lines: L, states, entry, recap, phase };
}
/** dead-cat checklist rows for levels flagged checklist:true (same shape as the dead-cat checklist CheckItem) */
export function checklistItems(r: LevelsResult): Array<{ id: string; label: string; value: string; status: "dead_cat" | "bottom" | "neutral" | "na"; note: string }> {
  if (!r.entry) return [];
  return r.entry.levels.filter((l) => l.checklist).map((l) => {
    const s = r.states.find((x) => x.id === l.id)!;
    return { id: l.id, label: `${l.label}（大佬 ${r.entry!.date} 日报）`, value: s.value == null ? "n/a" : s.text.split(" — ")[0]!, status: s.status === "na" ? "na" : s.status === "ok" ? "bottom" : s.status === "fail" ? "dead_cat" : "neutral", note: s.text.split(" — ")[1] ?? "无数据" };
  });
}
export const levelsJson = (r: LevelsResult) => r.entry ? { date: r.entry.date, recap: r.recap, phase: r.phase, levels: r.states.map((s) => ({ id: s.id, value: s.value, level: s.level, above: s.above, status: s.status, final: s.final })) } : null;
