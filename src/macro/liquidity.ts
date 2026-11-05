/**
 * 流动性观察 (weekly liquidity watch; Howell 2026-10-16 framework + mentor review, knowledge/mentor/macro-liquidity/).
 * FLAG ONLY: one status label, never a trade signal, never changes the brief verdict. Rules: docs/LIQUIDITY_WATCH.md.
 * Pure part: liquidityWatch(data, now) / renderLiquidity(). Fetch part: fetchLiquidity() (FRED / Yahoo / Coinbase, cached, failures → 数据不可用).
 */
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { parseFredCsv, type Obs } from "./fetch.ts";
import { yahooDaily } from "../adapters/yahoo.ts";
import { USER_AGENT } from "../ingest/rss.ts";

export const LIQ = {
  dangerSofrIorbPp: 0.10,   // SOFR − IORB above +0.10pp = repo stress (Howell fig3: late-2025 spike)
  btcLine: 70_000,          // Howell: 「它需要守住7万美元上方」
  btcSmaDays: 200,
  resLookbackDays: 91,      // 13 weeks
  sustainWeeks: 4,          // 顺风确认: 逆风减弱 held at 4 consecutive weekly checkpoints
  trendDays: 28,            // SOFR−2Y / MOVE compared with 4 weeks earlier
} as const;
export type LiqId = "SOFR" | "IORB" | "DGS2" | "WRESBAL" | "MOVE" | "BTC";
export type LiqData = Partial<Record<LiqId, Obs[]>>;
export type LiqStatus = "tailwind" | "weakening" | "none" | "insufficient";
export const STATUS_ZH: Record<LiqStatus, string> = { tailwind: "顺风确认", weakening: "逆风减弱（观察）", none: "无信号（中性）", insufficient: "无信号（数据不足）" };
export const MENTOR_LINE = "“逆风可能正在减弱”，和“顺风已经到来”，是两个不同的交易逻辑。";
export const MENTOR_FILE = "knowledge/mentor/macro-liquidity/mentor-review-howell-2026-10-16.md";

const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const r = (x: number, k = 2) => Math.round(x * 10 ** k) / 10 ** k;
/** last observation on or before date */
export function asOf(o: Obs[] | undefined, date: string): Obs | null {
  if (!o?.length) return null;
  let best: Obs | null = null; for (const x of o) { if (x.t.slice(0, 10) <= date) best = x; else break; }
  return best;
}
export function smaAsOf(o: Obs[] | undefined, date: string, n: number): number | null {
  const xs = (o ?? []).filter((x) => x.t.slice(0, 10) <= date); if (xs.length < n) return null;
  return xs.slice(-n).reduce((s, x) => s + x.v, 0) / n;
}
export interface LiqPoint { date: string; sofrIorb: number | null; sofr2y: number | null; reserves: number | null; res13w: number | null; btc: number | null; btcSma: number | null; move: number | null }
export function pointAt(d: LiqData, date: string): LiqPoint {
  const v = (id: LiqId) => asOf(d[id], date)?.v ?? null;
  const sofr = v("SOFR"), iorb = v("IORB"), two = v("DGS2"), res = v("WRESBAL"), res0 = asOf(d.WRESBAL, addDays(date, -LIQ.resLookbackDays))?.v ?? null;
  return { date, sofrIorb: sofr != null && iorb != null ? r(sofr - iorb, 3) : null, sofr2y: sofr != null && two != null ? r(sofr - two, 3) : null,
    reserves: res, res13w: res != null && res0 != null ? res - res0 : null, btc: v("BTC"), btcSma: smaAsOf(d.BTC, date, LIQ.btcSmaDays), move: v("MOVE") };
}
/** 逆风减弱 at one point: repo calm (SOFR ≤ IORB) AND reserves up over 13 weeks AND BTC above $70k. null = a core input missing */
export function weakeningAt(p: LiqPoint): boolean | null {
  if (p.sofrIorb == null || p.res13w == null || p.btc == null) return null;
  return p.sofrIorb <= 0 && p.res13w > 0 && p.btc > LIQ.btcLine;
}
export interface LiqResult { status: LiqStatus; label: string; why: string[]; alerts: string[]; now: LiqPoint; ago: LiqPoint; checkpoints: Array<{ date: string; ok: boolean | null }>; missing: LiqId[] }
export function liquidityWatch(d: LiqData, today: string): LiqResult {
  // the reference date = latest date all daily core series have reached (FRED is T-1); weekly checkpoints = the last 4 reserve (Wednesday) dates
  const last = (id: LiqId) => d[id]?.filter((x) => x.t.slice(0, 10) <= today).at(-1)?.t.slice(0, 10) ?? null;
  const missing = (["SOFR", "IORB", "DGS2", "WRESBAL", "MOVE", "BTC"] as LiqId[]).filter((id) => !last(id));
  const ref = [last("SOFR"), last("BTC")].filter(Boolean).sort()[0] ?? today;
  const now = pointAt(d, ref), ago = pointAt(d, addDays(ref, -LIQ.trendDays));
  const wk = (d.WRESBAL ?? []).filter((x) => x.t <= ref).slice(-LIQ.sustainWeeks).map((x) => x.t.slice(0, 10));
  const checkpoints = wk.map((date) => ({ date, ok: weakeningAt(pointAt(d, date)) }));
  const alerts: string[] = [], why: string[] = [];
  const btcLast = d.BTC?.filter((x) => x.t.slice(0, 10) <= today).at(-1);
  if (btcLast && btcLast.v < LIQ.btcLine) alerts.push(`🚨 BTC 日收盘 $${Math.round(btcLast.v).toLocaleString("en-US")}（${btcLast.t.slice(0, 10)}）跌破 $70,000 → Howell 自己的检验失败（「它需要守住7万美元上方」）`);
  if (now.sofrIorb != null && now.sofrIorb > LIQ.dangerSofrIorbPp) alerts.push(`🚨 SOFR − IORB = +${now.sofrIorb.toFixed(2)}pp > +${LIQ.dangerSofrIorbPp.toFixed(2)}pp → 回购市场紧张（2025 年末那种情况）`);
  const w = weakeningAt(now);
  let status: LiqStatus;
  if (w == null) { status = "insufficient"; why.push(`核心数据缺：${(["SOFR", "IORB", "WRESBAL", "BTC"] as LiqId[]).filter((id) => missing.includes(id) || (id === "WRESBAL" && now.res13w == null)).join("、") || "—"}`); }
  else if (!w) { status = "none"; why.push(...[now.sofrIorb! > 0 ? `SOFR − IORB = ${now.sofrIorb!.toFixed(2)}pp > 0` : "", now.res13w! <= 0 ? "准备金 13 周变化 ≤ 0" : "", now.btc! <= LIQ.btcLine ? "BTC ≤ $70k" : ""].filter(Boolean)); }
  else {
    status = "weakening"; why.push("SOFR ≤ IORB、准备金 13 周增加、BTC > $70k 同时成立");
    const held = checkpoints.length >= LIQ.sustainWeeks && checkpoints.every((c) => c.ok === true);
    const sofr2yUp = now.sofr2y != null && ago.sofr2y != null && now.sofr2y > ago.sofr2y;
    const aboveSma = now.btc != null && now.btcSma != null && now.btc > now.btcSma;
    const moveOk = now.move != null && ago.move != null && now.move <= ago.move;
    const need = [held ? "" : `连续 ${LIQ.sustainWeeks} 周成立（目前 ${checkpoints.filter((c) => c.ok).length}/${checkpoints.length}）`, sofr2yUp ? "" : "SOFR − 2Y 比 4 周前上升",
      aboveSma ? "" : "BTC 在 200 日均线上方", moveOk ? "" : now.move == null || ago.move == null ? "MOVE 数据（不可用就不能确认）" : "MOVE 不高于 4 周前", alerts.length ? "无报警" : ""].filter(Boolean);
    if (!need.length) { status = "tailwind"; why.push(`连续 ${LIQ.sustainWeeks} 周成立 + SOFR − 2Y 上升 + BTC 在 200 日均线上方 + MOVE 回落`); }
    else why.push(`「顺风确认」还差：${need.join("；")}`);
  }
  if (alerts.length && status === "tailwind") status = "weakening";
  return { status, label: STATUS_ZH[status], why, alerts, now, ago, checkpoints, missing };
}

export interface LiqMeta { source: Partial<Record<LiqId, string>>; errors: Partial<Record<LiqId, string>> }
const NA = (id: LiqId, m?: LiqMeta) => `数据不可用${m?.errors[id] ? `（${m.errors[id]}）` : ""}`;
const pp = (x: number | null) => (x == null ? null : `${x >= 0 ? "+" : ""}${x.toFixed(2)}pp`);
export function renderLiquidity(res: LiqResult, d: LiqData, meta?: LiqMeta): string[] {
  const n = res.now, a = res.ago, lastT = (id: LiqId) => asOf(d[id], n.date)?.t.slice(0, 10) ?? "—";
  const src = (id: LiqId) => meta?.source[id] ?? "";
  const row = (name: string, id: LiqId | null, val: string | null, chg: string, read: string, date: string) => `| ${name} | ${val ?? NA(id!, meta)} | ${val == null ? "—" : date} | ${val == null ? "—" : chg} | ${read} |`;
  const T = (x: number | null) => (x == null ? null : `$${r(x / 1e6, 3)}T`);
  return [
    "## 1.2 流动性观察（每周 · Howell 框架 · 只标记，不是交易信号）",
    `_来源：knowledge/mentor/macro-liquidity/（Michael Howell 2026-10-16 + 导师读后感）。规则：docs/LIQUIDITY_WATCH.md。数据：FRED（T-1；准备金为周三值、周四发布）、${src("MOVE") || "Yahoo ^MOVE"}、${src("BTC") || "FRED CBBTCUSD"}。不改变上面的结论。_`, "",
    `- 状态：**${res.label}** — ${res.why.join("；")}`,
    ...res.alerts.map((x) => `- ${x}`),
    "", "| 指标 | 最新 | 日期 | 对比 4 周前 / 13 周 | 读法 |", "|---|---|---|---|---|",
    row("SOFR − IORB", n.sofrIorb == null ? (d.SOFR?.length ? "IORB" : "SOFR") : null, pp(n.sofrIorb), a.sofrIorb != null ? `4 周前 ${pp(a.sofrIorb)}` : "—", `> +${LIQ.dangerSofrIorbPp.toFixed(2)}pp 危险；≤ 0 = 回购平稳`, lastT("SOFR")),
    row("SOFR − 2Y", n.sofr2y == null ? (d.SOFR?.length ? "DGS2" : "SOFR") : null, pp(n.sofr2y), a.sofr2y != null ? `4 周前 ${pp(a.sofr2y)}（${n.sofr2y! > a.sofr2y ? "上升 = 收紧放缓" : n.sofr2y! < a.sofr2y ? "下降 = 更紧" : "持平"}）` : "—", "越负越紧", lastT("SOFR")),
    row("银行准备金 WRESBAL", "WRESBAL", T(n.reserves), n.res13w != null ? `13 周 ${n.res13w >= 0 ? "+" : "−"}$${r(Math.abs(n.res13w) / 1e3, 0)}B` : "13 周变化不可用", "13 周增加 = 准备金改善", lastT("WRESBAL")),
    row("MOVE（美债波动率）", "MOVE", n.move == null ? null : n.move.toFixed(1), a.move != null ? `4 周前 ${a.move.toFixed(1)}` : "—", "回落 = 抵押品更好用", lastT("MOVE")),
    // BTC trades 7 days a week: show the latest daily close (the status itself is evaluated at the common reference date ${n.date})
    ...(() => { const b = d.BTC?.at(-1), sma = b ? smaAsOf(d.BTC, b.t.slice(0, 10), LIQ.btcSmaDays) : null;
      return [row("BTC（日收盘）", "BTC", b ? `$${Math.round(b.v).toLocaleString("en-US")}` : null, b ? `vs $70k ${b.v > LIQ.btcLine ? "上方" : "下方"} · 200 日均线 ${sma != null ? `$${Math.round(sma).toLocaleString("en-US")}（${b.v > sma ? "上方" : "下方"}）` : "不可用（不足 200 天）"}` : "—", "Howell 的检验：守住 $70k", b?.t.slice(0, 10) ?? "—")]; })(),
    "",
    `- 状态按共同基准日 ${n.date} 计算（FRED 为 T-1）。`,
    `- 每周检查点（准备金日期，逆风减弱是否成立）：${res.checkpoints.length ? res.checkpoints.map((c) => `${c.date} ${c.ok == null ? "❔" : c.ok ? "✅" : "—"}`).join(" · ") : "无"}`,
    `- 导师：「${MENTOR_LINE}」 → [macro-liquidity/mentor-review-howell-2026-10-16.md](${MENTOR_FILE})`, "",
  ];
}

// ---------- fetch (FRED has timed out before: per-series timeout, cache fallback, never fabricate) ----------
export interface LiqCache { [id: string]: { fetchedAt: string; source: string; obs: Obs[] } }
const FRED: Partial<Record<LiqId, string>> = { SOFR: "SOFR", IORB: "IORB", DGS2: "DGS2", WRESBAL: "WRESBAL", BTC: "CBBTCUSD" };
async function getText(url: string, timeoutMs: number): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}
/** Coinbase daily candles [time, low, high, open, close, volume] (UTC days); the current UTC day is still forming → dropped (only closes count) */
export function parseCoinbaseCandles(j: unknown, now = new Date()): Obs[] {
  if (!Array.isArray(j)) throw new Error("coinbase: not an array");
  const today = now.toISOString().slice(0, 10);
  return (j as number[][]).filter((c) => Array.isArray(c) && Number.isFinite(c[4])).map((c) => ({ t: new Date(c[0]! * 1000).toISOString().slice(0, 10), v: c[4]! })).filter((x) => x.t < today).sort((a, b) => a.t.localeCompare(b.t));
}
export interface FetchOpts { now: Date; offline?: boolean; cachePath?: string; ttlHours?: number; timeoutMs?: number }
export async function fetchLiquidity(o: FetchOpts): Promise<{ data: LiqData; meta: LiqMeta }> {
  const cachePath = o.cachePath ?? "data/out/liquidity-cache.json", ttl = (o.ttlHours ?? 6) * 3600_000, timeout = o.timeoutMs ?? 20_000;
  const cache: LiqCache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
  const since = new Date(o.now.getTime() - 420 * 864e5).toISOString().slice(0, 10);
  const data: LiqData = {}, meta: LiqMeta = { source: {}, errors: {} };
  const tries: Record<LiqId, Array<[string, () => Promise<Obs[]>]>> = {
    SOFR: [], IORB: [], DGS2: [], WRESBAL: [],
    MOVE: [["Yahoo ^MOVE", async () => (await yahooDaily("^MOVE", 420, timeout)).map((b) => ({ t: b.t, v: b.c }))]],
    BTC: [["FRED CBBTCUSD", async () => parseFredCsv(await getText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=CBBTCUSD&cosd=${since}`, timeout))],
      ["Coinbase BTC-USD 日线（UTC）", async () => parseCoinbaseCandles(JSON.parse(await getText("https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400", timeout)), o.now)]],
  };
  for (const id of ["SOFR", "IORB", "DGS2", "WRESBAL"] as LiqId[]) tries[id] = [[`FRED ${FRED[id]}`, async () => parseFredCsv(await getText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${FRED[id]}&cosd=${since}`, timeout))]];
  let dirty = false;
  await Promise.all((Object.keys(tries) as LiqId[]).map(async (id) => {
    const c = cache[id], fresh = c && o.now.getTime() - Date.parse(c.fetchedAt) < ttl;
    if (c && (fresh || o.offline)) { data[id] = c.obs; meta.source[id] = `${c.source}${fresh ? "" : `（缓存 ${c.fetchedAt.slice(0, 16)}Z）`}`; return; }
    if (o.offline) { meta.errors[id] = "离线且无缓存"; return; }
    const errs: string[] = [];
    for (const [name, f] of tries[id]) {
      try { const obs = (await f()).filter((x) => Number.isFinite(x.v)); if (!obs.length) throw new Error("no data"); data[id] = obs; meta.source[id] = name; cache[id] = { fetchedAt: o.now.toISOString(), source: name, obs }; dirty = true; return; }
      catch (e) { errs.push(`${name}: ${(e as Error).message}`); }
    }
    if (c) { data[id] = c.obs; meta.source[id] = `${c.source}（抓取失败，用缓存 ${c.fetchedAt.slice(0, 16)}Z）`; }
    else meta.errors[id] = errs.join("; ").slice(0, 120);
  }));
  if (dirty) { mkdirSync(dirname(cachePath), { recursive: true }); writeFileSync(cachePath + ".tmp", JSON.stringify(cache) + "\n"); renameSync(cachePath + ".tmp", cachePath); }
  return { data, meta };
}
