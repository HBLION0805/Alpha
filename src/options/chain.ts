import { bs, impliedVol, yearFrac, daysTo, expectedMove, STRADDLE_TO_EM, type Right } from "./bs.ts";

export interface Contract {
  expiration: string; strike: number; type: Right;
  bid: number | null; ask: number | null; mark: number | null;
  iv: number | null; delta: number | null; gamma: number | null; theta: number | null; vega: number | null;
  openInterest?: number | null; volume?: number | null;
  greeksSource?: "robinhood" | "black_scholes";
}
export interface Chain { symbol: string; underlyingPrice: number; asOf: string; contracts: Contract[]; source?: string }

/** Accepts our normalized chain JSON. (Raw Robinhood quotes lack strike/expiry — join instruments first; see README.) */
export function parseChain(json: unknown): Chain {
  const c = json as Chain;
  if (!c || typeof c.underlyingPrice !== "number" || !Array.isArray(c.contracts)) throw new Error("chain: need {symbol, underlyingPrice, asOf, contracts[]}");
  return { ...c, contracts: c.contracts.map((x) => ({ ...x, strike: Number(x.strike) })) };
}

/** Fill null IV (from mark) and null greeks (Black-Scholes). Never overwrites Robinhood values. */
export function fillGreeks(ch: Chain, r = 0.04, q = 0.012): Chain {
  const S = ch.underlyingPrice;
  return {
    ...ch,
    contracts: ch.contracts.map((c) => {
      if (c.delta != null && c.iv != null && c.gamma != null && c.theta != null && c.vega != null) return { ...c, greeksSource: "robinhood" };
      const T = yearFrac(ch.asOf, c.expiration);
      const mid = c.mark ?? (c.bid != null && c.ask != null ? (c.bid + c.ask) / 2 : null);
      const iv = c.iv ?? (mid != null ? impliedVol(mid, { S, K: c.strike, T, r, q, right: c.type }) : null);
      if (iv == null) return c;
      const g = bs({ S, K: c.strike, T, sigma: iv, r, q, right: c.type });
      return { ...c, iv, delta: c.delta ?? g.delta, gamma: c.gamma ?? g.gamma, theta: c.theta ?? g.theta, vega: c.vega ?? g.vega, greeksSource: "black_scholes" };
    }),
  };
}

export const expirations = (ch: Chain) => [...new Set(ch.contracts.map((c) => c.expiration))].sort();

export interface ExpirySummary {
  expiration: string; days: number; atmStrike: number; atmIv: number | null;
  straddle: number | null; expectedMove: number | null; expectedMovePct: number | null;
  straddleImpliedMove: number | null; // straddle / 0.8
  skew25: number | null; // 25Δ put IV − 25Δ call IV (vol points)
}

function interpIvAtDelta(cs: Contract[], target: number): number | null {
  const pts = cs.filter((c) => c.delta != null && c.iv != null).map((c) => ({ d: Math.abs(c.delta!), iv: c.iv! })).sort((a, b) => a.d - b.d);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    if (a.d <= target && b.d >= target) return a.iv + ((target - a.d) / (b.d - a.d || 1)) * (b.iv - a.iv);
  }
  return null;
}

export function summarizeExpiry(ch: Chain, expiration: string): ExpirySummary {
  const S = ch.underlyingPrice;
  const cs = ch.contracts.filter((c) => c.expiration === expiration);
  const strikes = [...new Set(cs.map((c) => c.strike))];
  const atmStrike = strikes.reduce((a, b) => (Math.abs(b - S) < Math.abs(a - S) ? b : a), strikes[0] ?? S);
  const call = cs.find((c) => c.strike === atmStrike && c.type === "call");
  const put = cs.find((c) => c.strike === atmStrike && c.type === "put");
  const ivs = [call?.iv, put?.iv].filter((x): x is number => x != null);
  const atmIv = ivs.length ? ivs.reduce((s, x) => s + x, 0) / ivs.length : null;
  const days = daysTo(ch.asOf, expiration);
  const straddle = call?.mark != null && put?.mark != null ? call.mark + put.mark : null;
  const em = atmIv != null ? expectedMove(S, atmIv, days) : null;
  const pIv = interpIvAtDelta(cs.filter((c) => c.type === "put"), 0.25);
  const cIv = interpIvAtDelta(cs.filter((c) => c.type === "call"), 0.25);
  const r2 = (x: number | null, k = 2) => (x == null ? null : Number(x.toFixed(k)));
  return {
    expiration, days: r2(days, 1)!, atmStrike, atmIv: r2(atmIv, 4), straddle: r2(straddle), expectedMove: r2(em),
    expectedMovePct: em != null ? r2((em / S) * 100) : null, straddleImpliedMove: straddle != null ? r2(straddle / STRADDLE_TO_EM) : null,
    skew25: pIv != null && cIv != null ? r2((pIv - cIv) * 100) : null,
  };
}

export type TermShape = "CONTANGO" | "FLAT" | "INVERTED" | "UNKNOWN";
/** Front vs back ATM IV: back > front by >0.5 vol pt = contango (normal); front > back = inverted (fear or event). */
export function termStructure(sums: ExpirySummary[]): { shape: TermShape; frontIv: number | null; backIv: number | null; slopePts: number | null } {
  const xs = sums.filter((s) => s.atmIv != null && s.days >= 1).sort((a, b) => a.days - b.days);
  if (xs.length < 2) return { shape: "UNKNOWN", frontIv: xs[0]?.atmIv ?? null, backIv: null, slopePts: null };
  const f = xs[0]!.atmIv!, b = xs[xs.length - 1]!.atmIv!;
  const slope = Number(((b - f) * 100).toFixed(2));
  return { shape: slope > 0.5 ? "CONTANGO" : slope < -0.5 ? "INVERTED" : "FLAT", frontIv: f, backIv: b, slopePts: slope };
}

/** ATM IV interpolated to a constant 30-day maturity (for IV-rank history). */
export function constantMaturityIv(sums: ExpirySummary[], days = 30): number | null {
  const xs = sums.filter((s) => s.atmIv != null).sort((a, b) => a.days - b.days);
  if (!xs.length) return null;
  if (xs.length === 1) return xs[0]!.atmIv;
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i]!, b = xs[i + 1]!;
    if (a.days <= days && b.days >= days) {
      // interpolate total variance
      const va = a.atmIv! ** 2 * a.days, vb = b.atmIv! ** 2 * b.days;
      const v = va + ((days - a.days) / (b.days - a.days)) * (vb - va);
      return Number(Math.sqrt(v / days).toFixed(4));
    }
  }
  return days < xs[0]!.days ? xs[0]!.atmIv : xs[xs.length - 1]!.atmIv;
}
