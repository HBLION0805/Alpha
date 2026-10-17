/**
 * Key price levels from OHLC bars. Bars come from Robinhood historicals (fetched via MCP, saved as JSON),
 * so this module is pure: no network.
 */
export interface Bar {
  t: string; // ISO time
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type LevelKind = "swing_high" | "swing_low" | "ma20" | "ma50" | "ma200" | "volume_node" | "round";

export interface Level {
  price: number;
  kinds: LevelKind[];
  touches: number; // bars whose high/low came within tolerance of the level
  volumeShare: number; // share of total volume traded in the level's price bucket
  score: number; // 0-100
  side: "support" | "resistance";
  distancePct: number; // from last close
}

export { parseBars } from "./adapters/bars.ts";

export { sma } from "./adapters/indicators.ts";
import { sma } from "./adapters/indicators.ts";

/** Fractal swings: bar high/low is the extreme of `k` bars on each side. */
export function swings(bars: Bar[], k = 3): Array<{ price: number; kind: "swing_high" | "swing_low"; i: number }> {
  const out: Array<{ price: number; kind: "swing_high" | "swing_low"; i: number }> = [];
  for (let i = k; i < bars.length - k; i++) {
    let hi = true, lo = true;
    for (let j = i - k; j <= i + k; j++) {
      if (j === i) continue;
      if (bars[j]!.h >= bars[i]!.h) hi = false;
      if (bars[j]!.l <= bars[i]!.l) lo = false;
    }
    if (hi) out.push({ price: bars[i]!.h, kind: "swing_high", i });
    if (lo) out.push({ price: bars[i]!.l, kind: "swing_low", i });
  }
  return out;
}

/** Volume profile: spread each bar's volume uniformly over its range into `buckets` bins; return high-volume nodes. */
export function volumeProfile(bars: Bar[], buckets = 40): { nodes: Array<{ price: number; share: number }>; bin: number; lo: number; hist: number[] } {
  const lo = Math.min(...bars.map((b) => b.l));
  const hi = Math.max(...bars.map((b) => b.h));
  const bin = (hi - lo) / buckets || 1;
  const hist = new Array<number>(buckets).fill(0);
  for (const b of bars) {
    const a = Math.min(buckets - 1, Math.floor((b.l - lo) / bin));
    const z = Math.min(buckets - 1, Math.floor((b.h - lo) / bin));
    for (let i = a; i <= z; i++) hist[i]! += b.v / (z - a + 1);
  }
  const total = hist.reduce((s, x) => s + x, 0) || 1;
  const nodes: Array<{ price: number; share: number }> = [];
  for (let i = 0; i < buckets; i++) {
    const v = hist[i]!;
    if (v > (hist[i - 1] ?? -1) && v >= (hist[i + 1] ?? -1) && v / total >= 1.5 / buckets) nodes.push({ price: lo + (i + 0.5) * bin, share: v / total });
  }
  return { nodes, bin, lo, hist: hist.map((x) => x / total) };
}

/** Psychological round numbers near price: step scales with price (1, 5, 10, 50, 100, 500, 1000...). */
export function roundNumbers(price: number, span = 0.12): number[] {
  const mag = 10 ** Math.floor(Math.log10(price));
  const ratio = price / mag;
  const step = ratio >= 5 ? mag / 2 : ratio >= 2 ? mag / 4 : mag / 10;
  const out: number[] = [];
  for (let p = Math.ceil((price * (1 - span)) / step) * step; p <= price * (1 + span); p += step) out.push(Number(p.toFixed(6)));
  return out;
}

export interface LevelOptions {
  swingK: number;
  maxDistancePct: number;
  tolerancePct: number; // touch / merge tolerance
  maxLevels: number;
}
export const DEFAULT_LEVELS: LevelOptions = { swingK: 3, maxDistancePct: 12, tolerancePct: 0.6, maxLevels: 10 };

export function computeLevels(bars: Bar[], opts: LevelOptions = DEFAULT_LEVELS): { last: number; levels: Level[]; ma: Record<string, number | null> } {
  const closes = bars.map((b) => b.c);
  const last = closes[closes.length - 1]!;
  const ma = { ma20: sma(closes, 20), ma50: sma(closes, 50), ma200: sma(closes, 200) };
  const vp = volumeProfile(bars);
  const raw: Array<{ price: number; kind: LevelKind }> = [
    ...swings(bars, opts.swingK).map((s) => ({ price: s.price, kind: s.kind })),
    ...(Object.entries(ma).filter(([, v]) => v !== null) as Array<[LevelKind, number]>).map(([k, v]) => ({ price: v, kind: k })),
    ...vp.nodes.map((n) => ({ price: n.price, kind: "volume_node" as const })),
    ...roundNumbers(last).map((p) => ({ price: p, kind: "round" as const })),
  ];
  // merge candidates within tolerance into zones
  raw.sort((a, b) => a.price - b.price);
  const zones: Array<{ prices: number[]; kinds: Set<LevelKind>; real: number[] }> = [];
  for (const r of raw) {
    const z = zones[zones.length - 1];
    const mid = z ? z.prices.reduce((s, x) => s + x, 0) / z.prices.length : 0;
    if (z && Math.abs(r.price - mid) / mid <= opts.tolerancePct / 100) {
      z.prices.push(r.price);
      z.kinds.add(r.kind);
      if (r.kind !== "round") z.real.push(r.price);
    } else zones.push({ prices: [r.price], kinds: new Set([r.kind]), real: r.kind === "round" ? [] : [r.price] });
  }
  const tol = opts.tolerancePct / 100;
  const maxTouches = Math.max(1, bars.length / 10);
  const levels: Level[] = zones.map((z) => {
    // a round number in the zone snaps the level to it; otherwise average the real (non-round) candidates
    const roundP = z.kinds.has("round") ? z.prices.find((p) => !z.real.includes(p)) : undefined;
    const price = roundP ?? z.real.reduce((s, x) => s + x, 0) / z.real.length;
    const touches = bars.filter((b) => Math.abs(b.h - price) / price <= tol || Math.abs(b.l - price) / price <= tol || (b.l < price && b.h > price && Math.abs(b.c - price) / price <= tol)).length;
    const idx = Math.min(vp.hist.length - 1, Math.max(0, Math.floor((price - vp.lo) / vp.bin)));
    const inRange = price >= vp.lo && price <= vp.lo + vp.bin * vp.hist.length;
    const volumeShare = inRange ? (vp.hist[idx] ?? 0) : 0;
    const kindPts = (z.kinds.has("swing_high") || z.kinds.has("swing_low") ? 20 : 0) + (z.kinds.has("ma200") ? 18 : 0) + (z.kinds.has("ma50") ? 12 : 0) + (z.kinds.has("ma20") ? 6 : 0) + (z.kinds.has("volume_node") ? 12 : 0) + (z.kinds.has("round") ? 5 : 0);
    const touchPts = Math.min(30, (touches / maxTouches) * 30);
    const volPts = Math.min(20, volumeShare * vp.hist.length * 6);
    const confluence = Math.min(10, (z.kinds.size - 1) * 5);
    const score = Math.round(Math.min(100, kindPts + touchPts + volPts + confluence));
    return { price: Number(price.toFixed(2)), kinds: [...z.kinds], touches, volumeShare: Number(volumeShare.toFixed(4)), score, side: price <= last ? "support" : "resistance", distancePct: Number((((price - last) / last) * 100).toFixed(2)) };
  });
  // per side: strongest levels within maxDistancePct, always including the nearest one. Round numbers above an
  // all-time high (no touches) are kept as untested resistance so the table is never one-sided.
  const near = levels.filter((l) => Math.abs(l.distancePct) <= opts.maxDistancePct && !(l.kinds.length === 1 && l.kinds[0] === "round" && l.touches === 0 && l.side === "support"));
  const pick = (side: Level["side"]) => {
    const xs = near.filter((l) => l.side === side);
    const nearest = [...xs].sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct))[0];
    const top = [...xs].sort((a, b) => b.score - a.score).slice(0, Math.ceil(opts.maxLevels / 2));
    return nearest && !top.includes(nearest) ? [...top.slice(0, -1), nearest] : top;
  };
  const keep = [...pick("resistance"), ...pick("support")].sort((a, b) => b.price - a.price);
  return { last, levels: keep, ma };
}

export function renderLevels(symbol: string, r: ReturnType<typeof computeLevels>): string {
  const L = [`# ${symbol} key levels (last ${r.last})`, "", `MA20 ${r.ma.ma20?.toFixed(2) ?? "n/a"} · MA50 ${r.ma.ma50?.toFixed(2) ?? "n/a"} · MA200 ${r.ma.ma200?.toFixed(2) ?? "n/a (need 200 bars)"}`, "", "| price | side | dist % | score | touches | vol share | kinds |", "|---|---|---|---|---|---|---|"];
  for (const l of r.levels) L.push(`| ${l.price} | ${l.side} | ${l.distancePct} | ${l.score} | ${l.touches} | ${(l.volumeShare * 100).toFixed(1)}% | ${l.kinds.join(", ")} |`);
  return L.join("\n") + "\n";
}

// ── Reference levels (user request 2026-10-14): timing only, never direction (macro first) ──────────
export interface RefLevels {
  last: number; asOf: string;
  priorDay: { h: number; l: number; c: number; date: string } | null;
  week: { h: number; l: number; from: string } | null; priorWeek: { h: number; l: number; from: string } | null;
  sma: { ma20: number | null; ma50: number | null; ma200: number | null };
  pivots: Array<{ price: number; kind: "swing_high" | "swing_low"; date: string }>;
  fib: { from: number; to: number; dir: "up" | "down"; levels: Array<{ ratio: number; price: number }> } | null;
}
const isoWeekStart = (d: string) => { const t = new Date(d.slice(0, 10) + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
export const FIB_RATIOS = [0.236, 0.382, 0.5, 0.618, 0.786];
/** Prior day H/L/C = the last completed bar before the latest one; weekly H/L by ISO week; Fib of the latest swing leg. */
export function referenceLevels(bars: Bar[], k = 3): RefLevels {
  const last = bars.at(-1)!, prev = bars.at(-2);
  const byWeek = new Map<string, Bar[]>();
  for (const b of bars) { const w = isoWeekStart(b.t); byWeek.set(w, [...(byWeek.get(w) ?? []), b]); }
  const weeks = [...byWeek].sort(([a], [b]) => a.localeCompare(b));
  const wk = (e?: [string, Bar[]]) => (e ? { h: Math.max(...e[1].map((b) => b.h)), l: Math.min(...e[1].map((b) => b.l)), from: e[0] } : null);
  const closes = bars.map((b) => b.c);
  const sw = swings(bars, k);
  const pivots = sw.slice(-6).map((s) => ({ price: s.price, kind: s.kind, date: bars[s.i]!.t.slice(0, 10) }));
  // latest swing leg: last pivot and the most recent opposite pivot before it
  let fib: RefLevels["fib"] = null;
  const lp = sw.at(-1);
  const op = lp ? [...sw].reverse().find((s) => s.kind !== lp.kind) : undefined;
  if (lp && op) {
    const dir = lp.kind === "swing_high" ? "up" : "down"; // up-leg: low → high, retracements measured down from the high
    const hi = Math.max(lp.price, op.price), lo = Math.min(lp.price, op.price);
    fib = { from: op.price, to: lp.price, dir, levels: FIB_RATIOS.map((r) => ({ ratio: r, price: Number((dir === "up" ? hi - (hi - lo) * r : lo + (hi - lo) * r).toFixed(2)) })) };
  }
  return {
    last: last.c, asOf: last.t.slice(0, 10),
    priorDay: prev ? { h: prev.h, l: prev.l, c: prev.c, date: prev.t.slice(0, 10) } : null,
    week: wk(weeks.at(-1)), priorWeek: wk(weeks.at(-2)),
    sma: { ma20: sma(closes, 20), ma50: sma(closes, 50), ma200: sma(closes, 200) },
    pivots, fib,
  };
}

export function renderReferenceLevels(symbol: string, r: RefLevels, source: string): string {
  const p = (x: number | null | undefined) => (x == null ? "n/a" : x.toFixed(2));
  const L = [`## ${symbol} 参考价位（${r.asOf}，收 ${p(r.last)}，数据：${source}）`, "", "_价位只用于择时（入场/止损位置），不决定方向；方向来自宏观与情景（大佬：宏观先行）。_", "",
    `- 前一日：高 ${p(r.priorDay?.h)} · 低 ${p(r.priorDay?.l)} · 收 ${p(r.priorDay?.c)}${r.priorDay ? `（${r.priorDay.date}）` : ""}`,
    `- 本周：高 ${p(r.week?.h)} · 低 ${p(r.week?.l)} · 上周：高 ${p(r.priorWeek?.h)} · 低 ${p(r.priorWeek?.l)}`,
    `- 均线：SMA20 ${p(r.sma.ma20)} · SMA50 ${p(r.sma.ma50)} · SMA200 ${p(r.sma.ma200)}`,
    `- 摆动点：${r.pivots.map((x) => `${x.kind === "swing_high" ? "高" : "低"} ${p(x.price)}（${x.date}）`).join(" · ") || "n/a"}`,
    r.fib ? `- 斐波那契回撤（最近一段 ${p(r.fib.from)} → ${p(r.fib.to)}，${r.fib.dir === "up" ? "上涨段" : "下跌段"}）：${r.fib.levels.map((x) => `${x.ratio} = ${p(x.price)}`).join(" · ")}` : "- 斐波那契：n/a（摆动点不足）",
    "", "_止损别正好放在整数关口或前高/前低上（止损学 Stop Placement）。_"];
  return L.join("\n") + "\n";
}
