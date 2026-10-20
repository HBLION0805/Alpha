/**
 * 利率 / 油价 / 美元 联动 (user 2026-10-20; the oil–yields–USD regime is the user's mentor framework). Display only —
 * never feeds the verdict / NO_TRADE / 48h·72h / sizing / 能不能睡.
 *  1) 30Y yield + 2Y vs 30Y co-movement (daily bp change, |chg| < 1bp = flat) on the latest date both series have.
 *  2) Regime: WTI front month (after the front's expiry day → next contract) + 10Y + DXY daily changes.
 *  3) MOVE / collateral multiplier: manual values in data/rates-manual.json (from the forwarded Howell weekly).
 */
import { existsSync, readFileSync } from "node:fs";
import type { Obs } from "./fetch.ts";
import { wtiFront } from "./wtiFront.ts";

export type Dir = "up" | "down" | "flat";
const day = (o: Obs) => o.t.slice(0, 10);
export const dirOf = (x: number | null, band: number): Dir | null => (x == null ? null : x > band ? "up" : x < -band ? "down" : "flat");
const fx = (x: number | null, d = 1, u = "") => (x == null ? "n/a" : `${x >= 0 ? "+" : ""}${x.toFixed(d)}${u}`);

/** last-two-obs change on/before `upTo`: bp (yields, in %) or % (prices) */
export function dailyChg(s: Obs[] | undefined, kind: "bp" | "pct", upTo?: string): { v: number | null; chg: number | null; date: string | null } {
  const x = (s ?? []).filter((o) => Number.isFinite(o.v) && (!upTo || day(o) <= upTo));
  const a = x.at(-1), b = x.at(-2);
  if (!a || !b) return { v: a?.v ?? null, chg: null, date: a ? day(a) : null };
  return { v: a.v, chg: kind === "bp" ? Math.round((a.v - b.v) * 1000) / 10 : Math.round((a.v / b.v - 1) * 10000) / 100, date: day(a) };
}
/** Yahoo ^TYX/^TNX occasionally come ×10 (e.g. 46.5) → normalize to % */
export const normYield = (s: Obs[] | undefined) => (s ?? []).map((o) => (o.v > 20 ? { ...o, v: o.v / 10 } : o));

export const CO_MOVE: Record<string, string> = {
  "down/down": "定价衰退/降息（长债机会得到确认）",
  "down/up": "长端担忧：通胀/财政供给/期限溢价 → 回避长债",
  "up/up": "鹰派 / 更高更久",
  "up/down": "熊平：收紧",
};
export function coMove(d2: number | null, d30: number | null, band = 1): string {
  const a = dirOf(d2, band), b = dirOf(d30, band);
  if (a == null || b == null) return "数据不足";
  if (a === "flat" || b === "flat") return a === "flat" && b === "flat" ? "两端都平（<1bp）→ 无信号" : `${a === "flat" ? "2Y 平" : "30Y 平"} → 无明确联动`;
  return CO_MOVE[`${a}/${b}`]!;
}
export const REGIME = { stag: "滞胀/衰退压力，对科技股最不利", rebound: "有利于科技股反弹", mixed: "混合" } as const;
/** oil up + yields down + USD up = stag; all three down = rebound; else mixed (bands: oil 0.3%, 10Y 1bp, DXY 0.1%) */
export function regime(oilPct: number | null, y10bp: number | null, dxyPct: number | null): { tag: keyof typeof REGIME | null; text: string } {
  const o = dirOf(oilPct, 0.3), y = dirOf(y10bp, 1), u = dirOf(dxyPct, 0.1);
  if (o == null || y == null || u == null) return { tag: null, text: "数据不足" };
  if (o === "up" && y === "down" && u === "up") return { tag: "stag", text: REGIME.stag };
  if (o === "down" && y === "down" && u === "down") return { tag: "rebound", text: REGIME.rebound };
  return { tag: "mixed", text: REGIME.mixed };
}
/** regime oil contract: the CNBC front, except on/after its expiry day → the next contract (2026-10-20: CLX26 expires → CLZ26) */
export function regimeOilContract(d: string) {
  const f = wtiFront(d); if (d < f.expiry) return f;
  const n = new Date(`${f.expiry}T12:00:00Z`); n.setUTCDate(n.getUTCDate() + 1); return wtiFront(n.toISOString().slice(0, 10));
}
export interface RatesManual { collateralMultiplier?: { value: number; asOf: string; trend?: Dir }; move?: { text: string; asOf?: string; trend?: Dir; value?: number } }
export const MANUAL_FILE = "data/rates-manual.json";
export const DEFAULT_MANUAL: RatesManual = { collateralMultiplier: { value: 1.83, asOf: "2026-10-16", trend: "down" }, move: { text: "MOVE avg 100+ since late Sep", asOf: "2026-10-16", trend: "up" } };
export function loadManual(f = MANUAL_FILE): RatesManual { try { return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : DEFAULT_MANUAL; } catch { return DEFAULT_MANUAL; } }
export function manualLines(m: RatesManual): string[] {
  const cm = m.collateralMultiplier, mv = m.move;
  const danger = mv?.trend === "up" && cm?.trend === "down";
  return [`- MOVE / 抵押品乘数（手动 — 来自用户转发的 Howell 周报，编辑 ${MANUAL_FILE}）：最新抵押品乘数 ${cm ? `${cm.value}（${cm.asOf.slice(5).replace("-", "/")}${cm.trend ? `，${cm.trend === "down" ? "下降" : cm.trend === "up" ? "上升" : "持平"}` : ""}）` : "n/a"}；${mv?.text ?? "MOVE n/a"}`,
    danger ? "  - 🚨 **MOVE 上升 + 抵押品乘数下降 = 最危险组合**（债市波动抬高抵押品折扣 → 流动性收缩）" : "  - MOVE 上升 + 乘数下降 才是最危险组合；目前未同时出现"];
}

export interface RatesInput { y2?: Obs[]; y10?: Obs[]; y30?: Obs[]; dxy?: Obs[]; oil?: Obs[]; oilCode: string; manual: RatesManual }
export function ratesLines(i: RatesInput): string[] {
  const y30 = normYield(i.y30), y10 = normYield(i.y10), y2 = normYield(i.y2);
  // co-movement on the latest date BOTH have (2Y is FRED, usually T-1)
  const common = [...new Set(y2.map(day))].filter((d) => y30.some((o) => day(o) === d)).sort().at(-1);
  const c2 = dailyChg(y2, "bp", common), c30 = dailyChg(y30, "bp", common), l30 = dailyChg(y30, "bp");
  const o = dailyChg(i.oil, "pct"), t = dailyChg(y10, "bp"), u = dailyChg(i.dxy, "pct"), rg = regime(o.chg, t.chg, u.chg);
  return ["### 利率 / 油价 / 美元 联动（只显示）", "",
    `- 30Y 美债收益率 ${l30.v?.toFixed(3) ?? "n/a"}%（${l30.date ?? "?"}，1日 ${fx(l30.chg, 1, "bp")}）`,
    `- 2Y vs 30Y 联动（${common ?? "无共同日期"}）：2Y ${fx(c2.chg, 1, "bp")} · 30Y ${fx(c30.chg, 1, "bp")} → **${coMove(c2.chg, c30.chg)}**（|变动|<1bp 视为平）`,
    `- 油价/利率/美元 组合（导师框架）：WTI ${i.oilCode} ${fx(o.chg, 2, "%")}（${o.date ?? "?"}）· 10Y ${fx(t.chg, 1, "bp")} · DXY ${fx(u.chg, 2, "%")} → **${rg.text}**`,
    ...manualLines(i.manual), ""];
}
