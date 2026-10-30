/**
 * Market phase for the plan card's stock-protection reminder (display only; never feeds NO_TRADE, sizing,
 * 48h/72h or 能不能睡). Two independent inputs:
 *  - mentor-declared phase: knowledge/mentor/market-calls/phases.json, latest entry dated <= today;
 *  - data check: ^NDX net change over SIDEWAYS_DAYS trading days (≈5 months) within ±SIDEWAYS_PCT = 横盘.
 */
import { readFileSync, existsSync } from "node:fs";

export const PHASES_FILE = "knowledge/mentor/market-calls/phases.json";
export const SIDEWAYS_DAYS = 105, SIDEWAYS_PCT = 5;
export type PhaseKind = "junk" | "sideways" | "normal";
export interface PhaseEntry { date: string; phase: PhaseKind; label: string; source: string; quotes: string[] }
export interface Sideways { sideways: boolean | null; chgPct: number | null; from: string | null; to: string | null; days: number }
export interface MarketPhase { active: boolean; why: string[]; declared: PhaseEntry | null; ndx: Sideways }

export function parsePhases(json: unknown): PhaseEntry[] {
  const e = (json as { entries?: unknown })?.entries;
  if (!Array.isArray(e)) throw new Error("phases.json: entries[] missing");
  return e.map((x, k) => {
    const p = x as PhaseEntry;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date ?? "") || !["junk", "sideways", "normal"].includes(p.phase) || typeof p.source !== "string" || !Array.isArray(p.quotes)) throw new Error(`phases.json entry ${k} invalid`);
    return p;
  }).sort((a, b) => a.date.localeCompare(b.date));
}
export function loadPhases(path = PHASES_FILE): { entries: PhaseEntry[]; error?: string } {
  if (!existsSync(path)) return { entries: [], error: `${path} missing` };
  try { return { entries: parsePhases(JSON.parse(readFileSync(path, "utf8"))) }; } catch (e) { return { entries: [], error: (e as Error).message }; }
}
/** latest entry dated on or before today (ET date string) */
export function declaredPhase(entries: PhaseEntry[], today: string): PhaseEntry | null {
  return entries.filter((e) => e.date <= today).at(-1) ?? null;
}
export function ndxSideways(bars: Array<{ t: string; c: number }>, days = SIDEWAYS_DAYS, pct = SIDEWAYS_PCT): Sideways {
  const b = bars.filter((x) => Number.isFinite(x.c) && x.c > 0);
  if (b.length < days + 1) return { sideways: null, chgPct: null, from: null, to: null, days };
  const a = b.at(-days - 1)!, z = b.at(-1)!, chg = (z.c / a.c - 1) * 100;
  return { sideways: Math.abs(chg) <= pct, chgPct: chg, from: a.t, to: z.t, days };
}
const sgn = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(2)}%`;
export function marketPhase(today: string, ndxBars: Array<{ t: string; c: number }>, entries: PhaseEntry[]): MarketPhase {
  const declared = declaredPhase(entries, today), ndx = ndxSideways(ndxBars), why: string[] = [];
  if (declared && declared.phase !== "normal") why.push(`大佬 ${declared.date} 判断：${declared.label}`);
  if (ndx.sideways) why.push(`纳指 ^NDX ${ndx.days} 个交易日 ${sgn(ndx.chgPct!)}（${ndx.from} → ${ndx.to}，±${SIDEWAYS_PCT}% 以内 = 横盘）`);
  return { active: why.length > 0, why, declared, ndx };
}
