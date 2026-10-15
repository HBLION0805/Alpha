/**
 * Naive dealer gamma exposure (GEX) from CBOE delayed option quotes. Ported from /workspace/feas/gex.py.
 * Convention (naive): dealers are long calls and short puts from customer flow →
 *   call GEX = +γ·OI·100·S²·1%, put GEX = −γ·OI·100·S²·1%  ($ per 1% move)
 * Positive net → dealers hedge against the move (dampens volatility). Negative → they hedge with the move (amplifies it).
 * TIMING ONLY, never direction. Real dealer positioning is unknown; this is an estimate.
 */
import { execFile } from "node:child_process";
import { normPdf } from "./bs.ts";
export interface GexResult {
  symbol: string; ok: true; spot: number; asOfUtc: string; net: number; flip: number | null; callWall: number | null; putWall: number | null;
  nextExpiry: string; maxPain: number | null; nextExpiryShare: number; expiries: number;
}
export type GexOut = GexResult | { symbol: string; ok: false; error: string };
interface Row { exp: string; cp: "C" | "P"; K: number; oi: number; g: number; iv: number }
const RE = /^(\w+?)(\d{6})([CP])(\d{8})$/;
export function parseCboe(json: unknown, days = 45): { spot: number; asOfUtc: string; rows: Row[] } {
  const j = json as { timestamp: string; data: { current_price?: number; close?: number; options: Array<{ option: string; open_interest: number; gamma: number; iv: number }> } };
  if (!j?.data?.options?.length) throw new Error("CBOE: no options in response");
  const spot = Number(j.data.current_price ?? j.data.close);
  if (!(spot > 0)) throw new Error("CBOE: no spot price");
  const asOfUtc = j.timestamp.replace(" ", "T") + "Z";
  const d = new Date(asOfUtc), today = d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const afterClose = Number(d.toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit" }).replace(":", "")) >= 1615;
  const last = new Date(Date.parse(today) + days * 86400_000).toISOString().slice(0, 10);
  const rows: Row[] = [];
  for (const o of j.data.options) {
    const m = RE.exec(o.option); if (!m) continue;
    const exp = `20${m[2]!.slice(0, 2)}-${m[2]!.slice(2, 4)}-${m[2]!.slice(4, 6)}`;
    if (exp < today || (afterClose && exp === today) || exp > last || !(o.open_interest > 0)) continue;
    rows.push({ exp, cp: m[3] as "C" | "P", K: Number(m[4]) / 1000, oi: o.open_interest, g: o.gamma ?? 0, iv: o.iv ?? 0 });
  }
  if (!rows.length) throw new Error("CBOE: no contracts with open interest in window");
  return { spot, asOfUtc, rows };
}
const gamma = (S: number, K: number, T: number, iv: number, r = 0.04) => { const d1 = (Math.log(S / K) + (r + iv * iv / 2) * T) / (iv * Math.sqrt(T)); return normPdf(d1) / (S * iv * Math.sqrt(T)); };
export function computeGex(symbol: string, p: { spot: number; asOfUtc: string; rows: Row[] }): GexResult {
  const S = p.spot, sgn = (r: Row) => (r.cp === "C" ? 1 : -1);
  const gex = (r: Row) => sgn(r) * r.g * r.oi * 100 * S * S * 0.01;
  const net = p.rows.reduce((s, r) => s + gex(r), 0);
  const nextExpiry = p.rows.map((r) => r.exp).sort()[0]!;
  const byK = new Map<number, { C: number; P: number }>();
  for (const r of p.rows) { const b = byK.get(r.K) ?? { C: 0, P: 0 }; b[r.cp] += gex(r); byK.set(r.K, b); }
  let callWall: number | null = null, putWall: number | null = null, cMax = 0, pMin = 0;
  for (const [K, b] of byK) { if (b.C > cMax) { cMax = b.C; callWall = K; } if (b.P < pMin) { pMin = b.P; putWall = K; } }
  // flip: re-price gamma on a ±20% spot grid with each contract's IV; nearest zero crossing to spot
  const now = Date.parse(p.asOfUtc), live = p.rows.filter((r) => r.iv > 0);
  const T = live.map((r) => Math.max((Date.parse(`${r.exp}T20:00:00Z`) - now) / (365 * 86400_000), 1 / (365 * 24)));
  const grid = Array.from({ length: 161 }, (_, i) => S * (0.8 + 0.4 * i / 160));
  const G = grid.map((x) => live.reduce((s, r, i) => s + sgn(r) * gamma(x, r.K, T[i]!, r.iv) * r.oi * 100 * x * x * 0.01, 0));
  const flips: number[] = [];
  for (let i = 0; i < grid.length - 1; i++) if (Math.sign(G[i]!) !== Math.sign(G[i + 1]!) && G[i] !== 0) flips.push(grid[i]! - G[i]! * (grid[i + 1]! - grid[i]!) / (G[i + 1]! - G[i]!));
  const flip = flips.length ? flips.reduce((a, b) => (Math.abs(b - S) < Math.abs(a - S) ? b : a)) : null;
  // max pain (next expiry): strike minimising total intrinsic payout
  const n1 = p.rows.filter((r) => r.exp === nextExpiry), Ks = [...new Set(n1.map((r) => r.K))].sort((a, b) => a - b);
  let maxPain: number | null = null, best = Infinity;
  for (const k of Ks) { const pay = n1.reduce((s, r) => s + r.oi * (r.cp === "C" ? Math.max(k - r.K, 0) : Math.max(r.K - k, 0)), 0); if (pay < best) { best = pay; maxPain = k; } }
  const abs = p.rows.reduce((s, r) => s + Math.abs(gex(r)), 0), abs1 = n1.reduce((s, r) => s + Math.abs(gex(r)), 0);
  return { symbol, ok: true, spot: S, asOfUtc: p.asOfUtc, net, flip, callWall, putWall, nextExpiry, maxPain, nextExpiryShare: abs ? abs1 / abs : 0, expiries: new Set(p.rows.map((r) => r.exp)).size };
}
function curl(url: string): Promise<string> {
  return new Promise((res, rej) => execFile("curl", ["-sL", "-A", "Mozilla/5.0", "--max-time", "25", url], { maxBuffer: 64e6 }, (e, out) => (e ? rej(e) : res(out))));
}
export async function fetchGex(symbol: string, days = 45): Promise<GexOut> {
  let last = "";
  for (const s of [symbol, `_${symbol}`]) {
    try { return computeGex(symbol, parseCboe(JSON.parse(await curl(`https://cdn.cboe.com/api/global/delayed_quotes/options/${s}.json`)), days)); }
    catch (e) { last = (e as Error).message; }
  }
  return { symbol, ok: false, error: last || "fetch failed" };
}
const fmtB = (x: number) => { const a = Math.abs(x); return `${x < 0 ? "−" : "+"}$${a >= 1e9 ? (a / 1e9).toFixed(2) + "B" : (a / 1e6).toFixed(0) + "M"}`; };
const px = (x: number | null) => (x == null ? "—" : x >= 100 ? x.toFixed(0) : x.toFixed(2));
export function renderGex(rs: GexOut[]): string[] {
  const ok = rs.filter((r): r is GexResult => r.ok);
  const ts = ok.map((r) => r.asOfUtc).sort().at(-1);
  const L = ["## 5.1 做市商 Gamma（GEX，粗略估算）", "",
    "- 正 gamma：做市商逆势对冲 → **压波动**，价格容易被\"钉\"在大持仓行权价附近；负 gamma：顺势对冲 → **放大波动**，突破/下跌更容易走远。",
    "- 只用于判断**节奏/波动**，不判断方向。假设做市商持有客户卖出的 call、买入的 put（粗略约定），真实持仓未知。", ""];
  if (ok.length) {
    L.push("| 标的 | 现价 | 净 GEX（每 1%） | 状态 | 翻转位 | Call 墙 | Put 墙 | 最大痛点（" + ok[0]!.nextExpiry.slice(5) + "） | 最近到期占比 |", "|---|---|---|---|---|---|---|---|---|");
    for (const r of ok) L.push(`| ${r.symbol} | ${px(r.spot)} | ${fmtB(r.net)} | ${r.net >= 0 ? "正 gamma（压波动）" : "负 gamma（放大波动）"}${r.flip != null ? (r.spot >= r.flip ? "，在翻转位上方" : "，在翻转位下方") : ""} | ${px(r.flip)} | ${px(r.callWall)} | ${px(r.putWall)} | ${px(r.maxPain)}${r.nextExpiry !== ok[0]!.nextExpiry ? `（${r.nextExpiry.slice(5)}）` : ""} | ${(r.nextExpiryShare * 100).toFixed(0)}% |`);
    const hi = ok.filter((r) => r.nextExpiryShare >= 0.35).map((r) => r.symbol);
    if (hi.length) L.push("", `- 最近一次到期占 gamma ≥35%：${hi.join("、")} → 到期后 gamma 释放，波动可能变大。`);
  }
  const bad = rs.filter((r) => !r.ok);
  if (bad.length) L.push("", `- 不可用（不编造）：${bad.map((r) => `${r.symbol}（${(r as { error: string }).error}）`).join("；")}`);
  L.push("", `- 数据：CBOE 延时报价${ts ? `，时间 ${new Date(ts).toLocaleString("zh-CN", { timeZone: "America/New_York", hour12: false })} ET` : ""}；窗口 45 天内到期。`, "");
  return L;
}
