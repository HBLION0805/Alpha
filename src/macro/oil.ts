/**
 * 【用户要求】原油 — the USER's own requirement (2026-10-15): oil is a core premarket indicator.
 * Not the mentor's routine and not a DK addition. Rendered right after the bonds block in the brief.
 * Alarms (feed the 30-min alert flow): OIL_SPIKE 80 (WTI or Brent +4% 1d / +10% 5d), OIL_CRASH 70 (−5% 1d),
 * BRENT_WTI_WIDEN 65 (spread +$3 in 5d). Shipping/Hormuz headlines in the window add +5 to spike/widen and are cited.
 */
import type { Obs } from "./fetch.ts";
import { eventUtcMs } from "./risk.ts";
import type { CalendarEvent } from "../ingest/officialCalendar.ts";

export const OIL_IDS = ["WTI", "BRENT", "RBOB", "XLE", "USDCAD", "UST10Y"];
export const OIL_ALARM_SCORE: Record<string, number> = { OIL_SPIKE: 80, OIL_CRASH: 70, BRENT_WTI_WIDEN: 65 };
export const SHIPPING_RE = /\b(hormuz|tankers?|shipping lanes?|aramco|refiner(y|ies)|pipelines?|red sea|suez|blockades?|houthis?|strait of)\b/i;
export interface OilAlarm { kind: "OIL_SPIKE" | "OIL_CRASH" | "BRENT_WTI_WIDEN"; level: "ALARM" | "WARNING"; title: string; detail: string; by: "user"; score: number }
export interface OilResult { lines: string[]; alarms: OilAlarm[]; spread: number | null; spread5dChg: number | null }

const lastV = (o?: Obs[]) => (o?.length ? o.at(-1)!.v : null);
const pct = (o: Obs[] | undefined, k: number) => (!o || o.length <= k ? null : ((o.at(-1)!.v - o[o.length - 1 - k]!.v) / o[o.length - 1 - k]!.v) * 100);
const sma = (o: Obs[] | undefined, n: number) => (!o || o.length < n ? null : o.slice(-n).reduce((s, x) => s + x.v, 0) / n);
const hi52 = (o: Obs[] | undefined) => (!o || o.length < 200 ? null : Math.max(...o.slice(-252).map((x) => x.v)));
const f = (x: number | null, u = "%", d = 2) => (x == null ? "n/a" : u === "$" ? `${x >= 0 ? "+" : "−"}$${Math.abs(x).toFixed(d)}` : `${x > 0 ? "+" : ""}${x.toFixed(d)}${u}`);
/** spread series aligned on dates */
function spreadSeries(b?: Obs[], w?: Obs[]): Obs[] {
  if (!b || !w) return [];
  const wm = new Map(w.map((o) => [o.t.slice(0, 10), o.v]));
  return b.filter((o) => wm.has(o.t.slice(0, 10))).map((o) => ({ t: o.t, v: o.v - wm.get(o.t.slice(0, 10))! }));
}

export function buildOil(data: Record<string, Obs[]>, opts: { now: Date; headlines?: string[]; calendar?: CalendarEvent[]; wtiLabel?: string }): OilResult {
  const L: string[] = []; const alarms: OilAlarm[] = [];
  const ship = (opts.headlines ?? []).filter((h) => SHIPPING_RE.test(h));
  const row = (id: string, name: string) => {
    const o = data[id], v = lastV(o), s50 = sma(o, 50), h = hi52(o);
    return `| ${name} | ${v?.toFixed(2) ?? "n/a"} | ${f(pct(o, 1))} | ${f(pct(o, 5))} | ${s50 && v ? f(((v - s50) / s50) * 100) : "n/a"} | ${h && v ? f(((v - h) / h) * 100) : "n/a"} |`;
  };
  L.push("| 品种 | 价格 | 1日 | 5日 | 距 50 日均线 | 距 52 周高点 |", "|---|---|---|---|---|---|", row("WTI", opts.wtiLabel ?? "WTI (CL=F)"), row("BRENT", "Brent (BZ=F)"), row("RBOB", "汽油 RBOB (RB=F)"), row("XLE", "XLE 能源股"));

  const sp = spreadSeries(data.BRENT, data.WTI), spNow = lastV(sp), sp5 = sp.length > 5 ? spNow! - sp[sp.length - 6]!.v : null;
  L.push("", `- **Brent–WTI 价差** $${spNow?.toFixed(2) ?? "n/a"}（5日 ${f(sp5, "$")}）→ ${spNow == null ? "n/a" : sp5 != null && sp5 > 1 ? "走阔：海运 / 中东供应风险溢价上升" : sp5 != null && sp5 < -1 ? "收窄：海运风险溢价回落" : "大致稳定"}${spNow != null && spNow >= 8 ? "（价差处于高位 ≥$8：海运/中东风险已在定价）" : ""}`);
  const w5 = pct(data.WTI, 5), r5 = pct(data.RBOB, 5), x5 = pct(data.XLE, 5);
  L.push(`- **汽油 vs 原油（5日）** RBOB ${f(r5)} vs WTI ${f(w5)} → ${r5 == null || w5 == null ? "n/a" : r5 - w5 > 2 ? "汽油更强：裂解价差扩大（炼厂/成品油紧张，CPI 能源分项上行风险）" : r5 - w5 < -2 ? "汽油更弱：需求偏软" : "同步"}`);
  L.push(`- **XLE vs 原油（5日）** XLE ${f(x5)} vs WTI ${f(w5)} → ${x5 == null || w5 == null ? "n/a" : w5 > 2 && x5 < w5 / 3 ? "股票不跟油价：市场认为油价上涨不持久（或增长担忧）" : w5 < -2 && x5 > w5 / 3 ? "能源股抗跌：市场认为油价下跌是暂时的" : "大致确认"}`);
  const cad1 = pct(data.USDCAD, 1), wti1 = pct(data.WTI, 1);
  L.push(`- **USDCAD 联动** USDCAD 1日 ${f(cad1)} · WTI 1日 ${f(wti1)} → ${cad1 == null || wti1 == null ? "n/a" : Math.sign(cad1) === -Math.sign(wti1) ? "一致（油涨 CAD 强 = USDCAD 跌）：油价变动有外汇确认" : "不一致：油价变动未得到 CAD 确认"}`);

  // transmission: oil → headline inflation (PPI/CPI) → yields
  const t = data.UST10Y, y5 = t && t.length > 5 ? (t.at(-1)!.v - t[t.length - 6]!.v) * 100 : null;
  const next = (opts.calendar ?? []).filter((e) => /CPI|PPI/.test(e.kind) && eventUtcMs(e) > opts.now.getTime()).sort((a, b) => a.date.localeCompare(b.date))[0];
  const read = w5 == null || y5 == null ? "n/a" : w5 > 3 && y5 > 5 ? "**通胀传导**：油涨 + 长端收益率上行 → 市场在定价更高的整体通胀（PPI/CPI）→ 利空长债、估值" :
    w5 > 3 && y5 < -5 ? "**增长恐慌读法**：油涨但长端收益率下行 → 市场把油价当成增长税（供应冲击压需求），偏避险" :
    w5 < -3 && y5 < -5 ? "通缩/需求走弱：油跌 + 收益率下行" : w5 < -3 && y5 > 5 ? "油跌但收益率上行：利率由油以外因素驱动（财政/期限溢价）" : "油价与收益率无明显传导信号";
  L.push(`- **传导** 原油 → 整体通胀（PPI/CPI）→ 收益率：WTI 5日 ${f(w5)} · 10Y 5日 ${f(y5, "bp", 1)} → ${read}${next ? `。下一次 ${next.kind}：${next.date} ${next.timeEt} ET` : ""}`);
  L.push("", `- **海运 / 霍尔木兹新闻**（alert 的 shipping 主题）：${ship.length ? "" : "近 48h 无"}`, ...ship.slice(0, 4).map((h) => `  - ${h}`));

  // alarms
  const shipNote = ship.length ? `；同期海运/霍尔木兹新闻：${ship[0]!.slice(0, 80)}` : "";
  for (const [id, name] of [["WTI", "WTI"], ["BRENT", "Brent"]] as const) {
    const d1 = pct(data[id], 1), d5 = pct(data[id], 5);
    if ((d1 != null && d1 >= 4) || (d5 != null && d5 >= 10)) { alarms.push({ kind: "OIL_SPIKE", level: "ALARM", title: `${name} 急涨 1日 ${f(d1)} / 5日 ${f(d5)}`, detail: `阈值 1日 +4% 或 5日 +10%${shipNote}`, by: "user", score: OIL_ALARM_SCORE.OIL_SPIKE! + (ship.length ? 5 : 0) }); break; }
  }
  for (const [id, name] of [["WTI", "WTI"], ["BRENT", "Brent"]] as const) {
    const d1 = pct(data[id], 1);
    if (d1 != null && d1 <= -5) { alarms.push({ kind: "OIL_CRASH", level: "WARNING", title: `${name} 暴跌 1日 ${f(d1)}`, detail: "阈值 1日 −5%（需求/增长担忧或供应恢复）", by: "user", score: OIL_ALARM_SCORE.OIL_CRASH! }); break; }
  }
  if (sp5 != null && sp5 > 3) alarms.push({ kind: "BRENT_WTI_WIDEN", level: "WARNING", title: `Brent–WTI 价差 5日走阔 ${f(sp5, "$")} 至 $${spNow!.toFixed(2)}`, detail: `阈值 5日 +$3：海运/中东风险${shipNote}`, by: "user", score: OIL_ALARM_SCORE.BRENT_WTI_WIDEN! + (ship.length ? 5 : 0) });
  return { lines: L, alarms, spread: spNow, spread5dChg: sp5 };
}
