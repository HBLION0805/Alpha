/**
 * Event follow-ups (knowledge/events/event-followups.json): display-only blocks for the brief and the evening
 * event-alert runs. pre → after (results + after-hours moves) → verdict (next-day premarket basket comparison:
 * expected-down basket down AND expected-up basket up = 应验). Expires after `expires`. Pure: the CLIs pass the
 * Robinhood files (earnings-by-symbol, quotes, optional event-results). No trades, no alerts, no NO_TRADE / sizing input.
 */
import { readFileSync, existsSync } from "node:fs";

export const FOLLOWUPS_FILE = "knowledge/events/event-followups.json";
export interface Basket { label: string; symbols: string[] }
export interface Followup { id: string; symbol: string; kind: string; date: string; timing: string; eventAtET: string; epsEstimate?: number; estimateSource?: string;
  showFrom: string; verdictDate: string; expires: string; title: string; thesis: string; condition?: string; baskets: { down: Basket; up: Basket }; quotes: string[]; source: string }
export interface Quote { last?: number | null; lastExt?: number | null; prevClose?: number | null; spot?: number | null; state?: string }
export interface QuotesFile { asOf?: string; quotes?: Record<string, Quote> }
export interface RhResult { year?: number; quarter?: number; eps?: { estimate?: string | null; actual?: string | null }; report?: { date?: string; timing?: string | null; verified?: boolean } }
export interface ExtraResults { revenue?: number | null; revenueEstimate?: number | null; capex?: number | null; capexGuide?: string | null; fcf?: number | null; fcfPrior?: number | null; note?: string; source?: string }
export interface FollowupInputs { earnings?: { fetchedAt?: string; bySymbol?: Record<string, RhResult[]> } | null; quotes?: QuotesFile | null; extra?: Record<string, ExtraResults> | null }
export type Phase = "pre" | "after" | "verdict";

export function loadFollowups(path = FOLLOWUPS_FILE): { followups: Followup[]; error?: string } {
  if (!existsSync(path)) return { followups: [], error: `${path} missing` };
  try { const j = JSON.parse(readFileSync(path, "utf8")); if (!Array.isArray(j.followups)) throw new Error("followups[] missing"); return { followups: j.followups }; }
  catch (e) { return { followups: [], error: (e as Error).message }; }
}
const rdJson = (p: string) => { try { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null; } catch { return null; } };
export function loadFollowupInputs(dir = "data/in"): FollowupInputs {
  return { earnings: rdJson(`${dir}/earnings-by-symbol.json`), quotes: rdJson(`${dir}/quotes.json`), extra: rdJson(`${dir}/event-results.json`) };
}

const etParts = (now: Date) => { const s = now.toLocaleString("sv-SE", { timeZone: "America/New_York" }); return { day: s.slice(0, 10), hm: s.slice(11, 16) }; };
export function phaseOf(f: Followup, now: Date): Phase | null {
  const { day, hm } = etParts(now);
  if (day < f.showFrom || day > f.expires) return null;
  if (day < f.date || (day === f.date && hm < f.eventAtET)) return "pre";
  if (day === f.date || (day === f.verdictDate && hm < "04:00")) return "after";
  return day >= f.verdictDate ? "verdict" : "after";
}

/** extended-hours move vs the regular-session close (lastExt / last); falls back to last / prevClose */
export function extMove(q: Quote | undefined): { pct: number | null; text: string } {
  const ext = q?.lastExt ?? null, base = q?.last ?? null;
  if (ext != null && base != null && base > 0) { const p = (ext / base - 1) * 100; return { pct: p, text: `${p >= 0 ? "+" : ""}${p.toFixed(2)}%（${ext.toFixed(2)} vs 收盘 ${base.toFixed(2)}）` }; }
  return { pct: null, text: "无报价" };
}
const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const sg = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(2)}%`;
export function basketMove(b: Basket, q: QuotesFile | null | undefined): { avg: number | null; parts: string[]; missing: string[] } {
  const parts: string[] = [], vals: number[] = [], missing: string[] = [];
  for (const s of b.symbols) { const m = extMove(q?.quotes?.[s]); if (m.pct == null) missing.push(s); else { vals.push(m.pct); parts.push(`${s} ${sg(m.pct)}`); } }
  return { avg: avg(vals), parts, missing };
}
export type Verdict = "应验" | "未应验" | "混合" | "无法判断";
export function verdictOf(down: number | null, up: number | null): Verdict {
  if (down == null || up == null) return "无法判断";
  if (down < 0 && up > 0) return "应验";
  if (down > 0 && up < 0) return "未应验";
  return "混合";
}
export function resultOf(f: Followup, inp: FollowupInputs): RhResult | null {
  const rs = inp.earnings?.bySymbol?.[f.symbol] ?? [];
  return rs.find((r) => r.report?.date === f.date && r.eps?.actual != null && r.eps.actual !== "") ?? null;
}
/** ET wall-clock → epoch ms (probes the EDT/EST offset) */
export function etToMs(day: string, hm: string): number {
  const guess = Date.parse(`${day}T${hm}:00Z`), et = new Date(guess).toLocaleString("sv-SE", { timeZone: "America/New_York" });
  return guess + (guess - Date.parse(et.replace(" ", "T") + "Z"));
}
/** quotes usable for this phase: taken after the phase began (event time / 04:00 on the verdict day) and ≤ 90 min old */
export function quotesUsable(f: Followup, ph: Phase, q: QuotesFile | null | undefined, now: Date): { ok: boolean; why: string } {
  if (!q?.asOf || !q.quotes) return { ok: false, why: "没有 data/in/quotes.json" };
  const at = Date.parse(q.asOf), age = Math.round((now.getTime() - at) / 60_000), from = ph === "verdict" ? etToMs(f.verdictDate, "04:00") : etToMs(f.date, f.eventAtET);
  if (at < from) return { ok: false, why: `报价时间 ${new Date(at).toLocaleString("sv-SE", { timeZone: "America/New_York" }).slice(5, 16)} ET 早于${ph === "verdict" ? "今天盘前" : "财报公布"}，不能用` };
  if (age > 90) return { ok: false, why: `报价已 ${age} 分钟未更新` };
  return { ok: true, why: `Robinhood 报价，${age} 分钟前` };
}
const money = (x: number) => Math.abs(x) >= 1e9 ? `$${(x / 1e9).toFixed(2)}B` : `$${x.toLocaleString("en-US")}`;

export function followupLines(fs: Followup[], inp: FollowupInputs, now: Date): string[] {
  const out: string[] = [];
  for (const f of fs) {
    const ph = phaseOf(f, now); if (!ph) continue;
    const src = f.source.replace(/^knowledge\/mentor\//, "");
    const L = [`### 📅 事件跟进：${f.title}`, "", `_只显示，不产生交易，不改 NO_TRADE、仓位或「能不能睡」；${f.expires} 之后自动消失。_`, "",
      `- **大佬判断**：${f.thesis}`, ...f.quotes.map((q) => `  - 原文：「${q}」 → [${src}](${f.source})`)];
    if (f.condition) L.push(`  - ${f.condition}`);
    const res = resultOf(f, inp), x = inp.extra?.[f.id];
    if (ph === "pre") {
      L.push(`- **预估**：EPS ${f.epsEstimate ?? "n/a"}（${f.estimateSource ?? "来源未知"}）· 公布：${f.date} ${f.timing === "pm" ? "盘后" : f.timing === "am" ? "盘前" : ""}`,
        `- **盯**：${f.baskets.down.label}（${f.baskets.down.symbols.join(" / ")}）vs ${f.baskets.up.label}（${f.baskets.up.symbols.join(" / ")}）。结果出来后这里显示实际数字和盘后涨跌；${f.verdictDate} 盘前简报判断方向是否应验。`);
    } else {
      if (res) { const a = Number(res.eps!.actual), e = f.epsEstimate ?? Number(res.eps?.estimate ?? NaN);
        L.push(`- **实际 EPS**：${a.toFixed(2)} vs 预估 ${Number.isFinite(e) ? e.toFixed(2) : "n/a"}${Number.isFinite(e) ? `（${a >= e ? "超预期" : "低于预期"} ${sg((a / e - 1) * 100)}）` : ""}（Robinhood get_earnings_results，获取于 ${inp.earnings?.fetchedAt ?? "未知"}）`); }
      else L.push(`- **实际 EPS**：还没有（Robinhood get_earnings_results 尚未返回 ${f.date} 的实际值；例行任务刷新 data/in/earnings-by-symbol.json）`);
      if (x) {
        const r = [x.revenue != null ? `营收 ${money(x.revenue)}${x.revenueEstimate != null ? `（预估 ${money(x.revenueEstimate)}）` : ""}` : null,
          x.capex != null ? `capex ${money(x.capex)}` : null, x.capexGuide ? `capex 指引 ${x.capexGuide}` : null,
          x.fcf != null ? `自由现金流 ${money(x.fcf)}${x.fcfPrior != null ? `（上一期 ${money(x.fcfPrior)}）` : ""}` : null].filter(Boolean);
        L.push(`- **营收 / capex / 现金流**：${r.length ? r.join(" · ") : "未提供"}${x.source ? `（${x.source}）` : ""}${x.note ? ` — ${x.note}` : ""}`);
      } else L.push("- **营收 / capex / 现金流**：未提供（Robinhood 只给 EPS；有了写入 data/in/event-results.json）");
      const lbl = ph === "after" ? "盘后" : "盘前", qu = quotesUsable(f, ph, inp.quotes, now), Q = qu.ok ? inp.quotes : null, m = extMove(Q?.quotes?.[f.symbol]);
      const d = basketMove(f.baskets.down, Q), u = basketMove(f.baskets.up, Q);
      if (!qu.ok) L.push(`- **${lbl}涨跌**：⚠️ ${qu.why} → 不显示涨跌、不判断方向（例行任务先刷新 Robinhood 报价：${[f.symbol, ...f.baskets.down.symbols, ...f.baskets.up.symbols].join(",")} → data/in/quotes.json）`);
      else L.push(`- **${lbl}涨跌**（${qu.why}）：${f.symbol} ${m.text}`,
        `  - ${f.baskets.down.label}：${d.parts.join("，") || "无"}${d.avg != null ? ` → 平均 ${sg(d.avg)}` : ""}${d.missing.length ? `（缺 ${d.missing.join("/")}）` : ""}`,
        `  - ${f.baskets.up.label}：${u.parts.join("，") || "无"}${u.avg != null ? ` → 平均 ${sg(u.avg)}` : ""}${u.missing.length ? `（缺 ${u.missing.join("/")}）` : ""}`);
      if (ph === "verdict") { const v = verdictOf(d.avg, u.avg);
        L.push(`- **大佬方向是否应验（${f.verdictDate} 盘前）**：**${v}** — ${v === "应验" ? `${f.baskets.down.label}跌、${f.baskets.up.label}涨` : v === "未应验" ? `方向相反：${f.baskets.down.label}涨、${f.baskets.up.label}跌` : v === "混合" ? "两个篮子没有按「一跌一涨」走" : "缺报价，无法判断"}（规则：${f.baskets.down.label}平均 < 0 且 ${f.baskets.up.label}平均 > 0 = 应验；反过来 = 未应验；其它 = 混合）`); }
      else L.push(`  - 当前方向（仅参考，正式判断在 ${f.verdictDate} 盘前）：${verdictOf(d.avg, u.avg)}`);
    }
    out.push(...L, "");
  }
  return out;
}
