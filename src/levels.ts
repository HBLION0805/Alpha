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

/** Accepts Robinhood get_equity_historicals output ({historicals|data_points|bars: [...]}) or a plain array. */
export function parseBars(json: unknown): Bar[] {
  // unwrap MCP envelopes: {data:{results:[{symbol,bars:[...]}]}} / {results:[...]} / {bars|historicals|data_points}
  let root: unknown = json;
  for (let i = 0; i < 4 && root && !Array.isArray(root); i++) {
    const r = root as Record<string, unknown>;
    root = r.bars ?? r.historicals ?? r.data_points ?? (Array.isArray(r.results) ? (r.results[0] as unknown) : undefined) ?? r.data;
  }
  const arr = root;
  if (!Array.isArray(arr)) throw new Error("bars: expected an array or {bars|historicals|data_points}");
  const num = (x: unknown) => (typeof x === "number" ? x : Number.parseFloat(String(x)));
  const bars = (arr as Array<Record<string, unknown>>).map((b) => ({
    t: String(b.t ?? b.begins_at ?? b.timestamp ?? b.date ?? ""),
    o: num(b.o ?? b.open ?? b.open_price),
    h: num(b.h ?? b.high ?? b.high_price),
    l: num(b.l ?? b.low ?? b.low_price),
    c: num(b.c ?? b.close ?? b.close_price),
    v: num(b.v ?? b.volume ?? 0) || 0,
  }));
  const ok = bars.filter((b) => [b.o, b.h, b.l, b.c].every(Number.isFinite) && b.h >= b.l);
  if (!ok.length) throw new Error("bars: no valid OHLC rows");
  return ok.sort((a, b) => a.t.localeCompare(b.t));
}

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
