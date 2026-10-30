/**
 * Mentor premarket video 原油与 VIX (knowledge/mentor/premarket-routine/oil-vix-2026-10-18.md; transcript not checked word-by-word).
 * Extends the user's own oil block (【用户要求】原油, oil.ts) and the VIX block. FLAG ONLY: nothing here changes the verdict or alarms.
 * Rules and thresholds: docs/OIL_VIX.md. Pure functions over the brief's daily series (Yahoo closes).
 */
import type { Obs } from "./fetch.ts";

export const OV = {
  fast1dPct: 3, fast5dPct: 8,          // 快速变动 flag (the existing OIL_SPIKE alarm stays at +4% / +10%, OIL_CRASH at −5%)
  driverMinOil5dPct: 2,                // |WTI 5d| below this → no driver judgement
  spxBandPct: 0.5, hgBandPct: 1, vixBandPct: 5, // dead bands: "up" / "down" only beyond these 5-day moves
  idxBandPct: 0.5, vixTrendBandPct: 3, // VIX vs index confirmation (5 trading days)
  window: 5,
} as const;
/**
 * VIX 分档 (user-shared infographic 如何用VIX观察市场情绪, knowledge/vix-regimes.md). Boundaries: 20 and 30 go to the higher
 * band, exactly 40 stays in 30–40. Speed matters more than level (user): ⚡ 急升 / ↘ 回落. DISPLAY ONLY — no verdict,
 * alarm, sizing or 能不能睡-label effect.
 */
export const VIX_REGIME = { spike1dPct: 20, spike5dPct: 35, drop1dPct: -15, drop5dPct: -25 } as const;
export const VIX_REGIME_FILE = "knowledge/vix-regimes.md";
export const VIX_FOOTER = "VIX 是情绪与波动指标，不是独立买卖信号";
export type VixBand = "low" | "elevated" | "fear" | "panic";
export const VIX_BANDS: Record<VixBand, { icon: string; zh: string; short: string; note: string }> = {
  low: { icon: "🟢", zh: "波动较低", short: "警惕自满", note: "警惕自满，检查风险敞口；保护便宜时可考虑买对冲" },
  elevated: { icon: "🟡", zh: "波动升高", short: "结合趋势，管理仓位", note: "结合趋势，管理仓位；单笔更小、止损更严" },
  fear: { icon: "🟠", zh: "市场恐惧", short: "谨慎观察", note: "谨慎观察；第一阶段优先减仓/NO_TRADE" },
  panic: { icon: "🔴", zh: "极度恐慌", short: "第一阶段不抄底", note: "极度恐慌——第一阶段不抄底，少亏优先，NO_TRADE 合理（信息图写「分批布局」，不适用于第一阶段：先积累本金、少亏优先）" },
};
export function vixBand(v: number): VixBand { return v < 20 ? "low" : v < 30 ? "elevated" : v <= 40 ? "fear" : "panic"; }
export interface VixRegime { level: number | null; date: string | null; band: VixBand | null; d1: number | null; d5: number | null; speed: "spike" | "drop" | null; lines: string[] }
export function vixRegime(data: Record<string, Obs[]>): VixRegime {
  const o = data.VIX, level = o?.at(-1)?.v ?? null, date = lastDate(o);
  if (level == null) return { level, date, band: null, d1: null, d5: null, speed: null, lines: ["- **VIX 分档**：VIX 数据不可用 → 不分档", `- _${VIX_FOOTER}。分档来自用户分享的信息图（${VIX_REGIME_FILE}），只标记。_`] };
  const r2 = (x: number | null) => (x == null ? null : Math.round(x * 100) / 100); // compare at 0.01% so exact thresholds hit
  const band = vixBand(level), b = VIX_BANDS[band], d1 = r2(pct(o, 1)), d5 = r2(pct(o, OV.window)), R = VIX_REGIME;
  const spike = (d1 != null && d1 >= R.spike1dPct) || (d5 != null && d5 >= R.spike5dPct), drop = !spike && ((d1 != null && d1 <= R.drop1dPct) || (d5 != null && d5 <= R.drop5dPct));
  const p0 = (x: number) => `${x > 0 ? "+" : ""}${x.toFixed(0)}%`;
  const hits = (up: boolean) => [d1 != null && (up ? d1 >= R.spike1dPct : d1 <= R.drop1dPct) ? `${p0(d1)} 1d` : "", d5 != null && (up ? d5 >= R.spike5dPct : d5 <= R.drop5dPct) ? `${p0(d5)} 5d` : ""].filter(Boolean).join(" · ");
  const speedTxt = spike ? ` ⚡ 急升 ${hits(true)}` : drop ? ` ↘ 回落 ${hits(false)}` : "";
  const ctx = d1 == null && d5 == null ? "速度：历史不足，略过" : `1日 ${f(d1, 1)} · 5日 ${f(d5, 1)}；⚡ 急升 = 1日 ≥ +${R.spike1dPct}% 或 5日 ≥ +${R.spike5dPct}%，↘ 回落 = 1日 ≤ ${R.drop1dPct}% 或 5日 ≤ ${R.drop5dPct}%`;
  return { level, date, band, d1, d5, speed: spike ? "spike" : drop ? "drop" : null, lines: [
    `- **VIX 分档**（${date}）：VIX ${level.toFixed(2)} · ${b.icon} ${b.zh}（${b.short}）${speedTxt}`,
    `  - ${b.note}`, `  - ${ctx}`,
    `- _${VIX_FOOTER}。分档来自用户分享的信息图（[vix-regimes.md](${VIX_REGIME_FILE})；20、30 归上一档，40 归 30–40），只标记，不改变结论、警报、仓位或「能不能睡」。_`,
  ] };
}
export const PM_FILE = "knowledge/mentor/premarket-routine/oil-vix-2026-10-18.md";
export const OIL_QUOTE = "我看原油，会同时看价格、变化速度以及背后的原因。";
export const VIX_QUOTE = "结合VIX的变化趋势和指数走势，判断市场方向是否得到确认，而不是单凭一个高低数值下结论。";
export const SQUEEZE_QUOTE = "航空公司就是很直接的例子。燃油是他们的重要成本。油价上涨会挤压利润，如果提高票价，又可能削弱出行需求。";

const pct = (o: Obs[] | undefined, k: number) => (!o || o.length <= k ? null : ((o.at(-1)!.v - o[o.length - 1 - k]!.v) / o[o.length - 1 - k]!.v) * 100);
const f = (x: number | null, d = 2) => (x == null ? "n/a" : `${x > 0 ? "+" : ""}${x.toFixed(d)}%`);
const lastDate = (o?: Obs[]) => o?.at(-1)?.t.slice(0, 10) ?? null;

export type Driver = "demand" | "supply_shock" | "supply_relief" | "demand_weak" | "unclear" | "small_move" | "no_data";
export const DRIVER_ZH: Record<Driver, string> = { demand: "偏需求（经济较强）", supply_shock: "偏供应冲击 / 经济负担", supply_relief: "偏供应缓解（缓解通胀）", demand_weak: "偏需求走弱（衰退迹象）", unclear: "无法判断", small_move: "变化不大，不判断", no_data: "无法判断（缺数据）" };
export interface OilSpeed { id: "WTI" | "BRENT"; d1: number | null; d5: number | null; fast: boolean }
export interface OilVixResult {
  speed: OilSpeed[]; fast: boolean;
  driver: Driver; driverWhy: string; inputs: { oil5: number | null; spx5: number | null; hg5: number | null; vix5: number | null };
  vix: { label: "confirm" | "diverge" | "unclear"; zh: string; why: string; vix5: number | null; spx5: number | null; ndx5: number | null };
  /** VIX 分档 (display only) */ regime: VixRegime;
  lines: { oil: string[]; vix: string[]; regime: string[] };
}
export function oilSpeed(data: Record<string, Obs[]>, same?: Partial<Record<"WTI" | "BRENT", { pct1: number } | null>>): OilSpeed[] {
  return (["WTI", "BRENT"] as const).map((id) => { const d1 = same && id in same ? (same[id]?.pct1 ?? null) : pct(data[id], 1), d5 = pct(data[id], OV.window);
    return { id, d1, d5, fast: (d1 != null && Math.abs(d1) >= OV.fast1dPct) || (d5 != null && Math.abs(d5) >= OV.fast5dPct) }; });
}
/** HEURISTIC (not a model): 5-day moves of WTI vs SPX, copper (HG=F) and VIX. Copper missing → the cases that need it become 无法判断. */
export function oilDriver(data: Record<string, Obs[]>): { driver: Driver; why: string; inputs: OilVixResult["inputs"] } {
  const oil5 = pct(data.WTI, OV.window), spx5 = pct(data.SPX, OV.window), hg5 = pct(data.COPPER, OV.window), vix5 = pct(data.VIX, OV.window);
  const inputs = { oil5, spx5, hg5, vix5 };
  if (oil5 == null || spx5 == null) return { driver: "no_data", why: `缺 ${oil5 == null ? "WTI" : "SPX"} 数据`, inputs };
  if (Math.abs(oil5) < OV.driverMinOil5dPct) return { driver: "small_move", why: `WTI 5日 ${f(oil5)}，|变化| < ${OV.driverMinOil5dPct}%`, inputs };
  const spxUp = spx5 > OV.spxBandPct, spxDn = spx5 < -OV.spxBandPct, vixUp = vix5 != null && vix5 > OV.vixBandPct, vixNotUp = vix5 != null && vix5 <= 0;
  const hgUp = hg5 != null && hg5 > OV.hgBandPct, hgDn = hg5 != null && hg5 < -OV.hgBandPct, noHg = hg5 == null ? "（铜 HG 数据不可用）" : "";
  if (oil5 > 0) {
    if (spxUp && hgUp && vixNotUp) return { driver: "demand", why: "油涨 + 标普涨 + 铜涨 + VIX 不升", inputs };
    if (spxDn || vixUp) return { driver: "supply_shock", why: `油涨，但${[spxDn ? "标普跌" : "", vixUp ? "VIX 升" : ""].filter(Boolean).join("、")}`, inputs };
    return { driver: "unclear", why: `油涨，股指/铜/VIX 不一致${noHg}`, inputs };
  }
  if (spxUp && vixNotUp) return { driver: "supply_relief", why: "油跌 + 标普涨 + VIX 不升", inputs };
  if (spxDn && hgDn) return { driver: "demand_weak", why: "油跌 + 标普跌 + 铜跌", inputs };
  return { driver: "unclear", why: `油跌，股指/铜/VIX 不一致${noHg}`, inputs };
}
/** VIX trend vs SPX/NDX trend over the same 5 trading days */
export function vixConfirm(data: Record<string, Obs[]>): OilVixResult["vix"] {
  const vix5 = pct(data.VIX, OV.window), spx5 = pct(data.SPX, OV.window), ndx5 = pct(data.NDX, OV.window);
  const base = { vix5, spx5, ndx5 };
  if (vix5 == null || spx5 == null || ndx5 == null) return { ...base, label: "unclear", zh: "无法判断（缺数据）", why: `缺 ${[vix5 == null ? "VIX" : "", spx5 == null ? "SPX" : "", ndx5 == null ? "NDX" : ""].filter(Boolean).join("、")}` };
  const dir = (x: number, b: number) => (x > b ? 1 : x < -b ? -1 : 0);
  const s = dir(spx5, OV.idxBandPct), n = dir(ndx5, OV.idxBandPct), v = dir(vix5, OV.vixTrendBandPct);
  if (s === 0 || n === 0 || s !== n) return { ...base, label: "unclear", zh: "无法判断（指数无明确方向或分化）", why: `SPX ${f(spx5)} · NDX ${f(ndx5)}` };
  if (v === 0) return { ...base, label: "unclear", zh: "无法判断（VIX 基本持平）", why: `VIX 5日 ${f(vix5)}，|变化| < ${OV.vixTrendBandPct}%` };
  return v === -s ? { ...base, label: "confirm", zh: "方向确认", why: `${s > 0 ? "指数涨、VIX 跌" : "指数跌、VIX 升"}` }
    : { ...base, label: "diverge", zh: "背离/未确认", why: `${s > 0 ? "指数涨，VIX 也涨（上涨未被确认，有人在买保险）" : "指数跌，VIX 也跌（下跌未被恐慌确认）"}` };
}
/** `same`: same-contract 1d changes (oilContract.ts) — see buildOil */
export function buildOilVix(data: Record<string, Obs[]>, same?: Partial<Record<"WTI" | "BRENT", { pct1: number } | null>>): OilVixResult {
  const speed = oilSpeed(data, same), fast = speed.some((s) => s.fast), d = oilDriver(data), vix = vixConfirm(data);
  const dt = lastDate(data.WTI);
  const oil = [
    `- **变化速度**（${dt ?? "n/a"}）：${speed.map((s) => `${s.id === "WTI" ? "WTI" : "Brent"} 1日 ${f(s.d1)} · 5日 ${f(s.d5)}${s.fast ? " ⚡" : ""}`).join("；")} → ${fast ? `⚡ **快速变动**（|1日| ≥ ${OV.fast1dPct}% 或 |5日| ≥ ${OV.fast5dPct}%）` : `不算快（阈值 |1日| ≥ ${OV.fast1dPct}% 或 |5日| ≥ ${OV.fast5dPct}%）`}`,
    `- **驱动判断（启发式，不是结论）**：**${DRIVER_ZH[d.driver]}** — ${d.why}（5日：WTI ${f(d.inputs.oil5)} · 标普 ${f(d.inputs.spx5)} · 铜 HG ${d.inputs.hg5 == null ? "数据不可用" : f(d.inputs.hg5)} · VIX ${f(d.inputs.vix5)}）`,
    ...(d.driver === "supply_shock" ? ["- **承压板块**：航空（JETS）、可选消费（XLY）——燃油/运输成本挤压利润，加油和日常开支占比上升后可自由消费的钱变少"] : []),
    `- 导师：「${OIL_QUOTE}」 → [premarket-routine/oil-vix-2026-10-18.md](${PM_FILE})`,
  ];
  const vixLines = [
    `- **VIX vs 指数（5 个交易日）**：VIX ${f(vix.vix5)} · SPX ${f(vix.spx5)} · NDX ${f(vix.ndx5)} → **${vix.zh}**（${vix.why}）。只标记，不改变结论。`,
    `- 导师：「${VIX_QUOTE}」 → [premarket-routine/oil-vix-2026-10-18.md](${PM_FILE})`,
  ];
  const regime = vixRegime(data);
  return { speed, fast, driver: d.driver, driverWhy: d.why, inputs: d.inputs, vix, regime, lines: { oil, vix: vixLines, regime: regime.lines } };
}
