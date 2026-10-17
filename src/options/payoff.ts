import { bs, type Right } from "./bs.ts";

/** qty > 0 long, < 0 short; premium per share (positive number paid/received). Stock leg: type "stock", strike=entry. */
export interface Leg { type: Right | "stock"; strike: number; qty: number; premium: number; expiration?: string; iv?: number }
export interface PayoffSummary { maxGain: number | null; maxLoss: number | null; breakevens: number[]; netDebit: number; unboundedUp: boolean; unboundedDown: boolean }
const MULT = 100;

export function legValueAtExpiry(l: Leg, S: number): number {
  if (l.type === "stock") return S;
  return l.type === "call" ? Math.max(0, S - l.strike) : Math.max(0, l.strike - S);
}
/** P&L in dollars at expiry (all legs same expiry). */
export function pnlAtExpiry(legs: Leg[], S: number): number {
  return legs.reduce((s, l) => s + l.qty * (legValueAtExpiry(l, S) - l.premium) * (l.type === "stock" ? 1 : MULT) * (l.type === "stock" ? 1 : 1), 0);
}

/** Exact analysis: payoff is piecewise-linear with kinks at strikes, so checking kinks + slopes at the ends is exact. */
export function analyze(legs: Leg[]): PayoffSummary {
  const ks = [...new Set(legs.map((l) => l.strike))].sort((a, b) => a - b);
  const pts = [0, ...ks, ks[ks.length - 1]! * 3];
  const f = (S: number) => pnlAtExpiry(legs, S);
  const slopeUp = legs.reduce((s, l) => s + (l.type === "put" ? 0 : l.qty * (l.type === "stock" ? 1 : MULT)), 0);
  const vals = pts.map(f);
  const unboundedUp = slopeUp > 1e-9, unboundedDownLoss = false;
  const breakevens: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = vals[i]!, b = vals[i + 1]!;
    if (a === 0 && i > 0) breakevens.push(pts[i]!);
    else if ((a < 0 && b > 0) || (a > 0 && b < 0)) breakevens.push(Number((pts[i]! + ((0 - a) / (b - a)) * (pts[i + 1]! - pts[i]!)).toFixed(2)));
  }
  const netDebit = legs.reduce((s, l) => s + l.qty * l.premium * (l.type === "stock" ? 1 : MULT), 0);
  const maxGain = unboundedUp ? null : Math.max(...vals);
  const maxLoss = slopeUp < -1e-9 ? null : Math.min(...vals); // short calls beyond cover → unbounded loss
  return { maxGain: maxGain == null ? null : round(maxGain), maxLoss: maxLoss == null ? null : round(maxLoss), breakevens: [...new Set(breakevens)], netDebit: round(netDebit), unboundedUp, unboundedDown: unboundedDownLoss };
}
const round = (x: number) => Math.round(x * 100) / 100;

/** Short option contracts not covered by a long option of the same right (or shares, for calls). */
export function nakedShorts(legs: Array<Pick<Leg, "type" | "qty">>): { calls: number; puts: number } {
  const sum = (t: string, sign: 1 | -1) => legs.filter((l) => l.type === t && Math.sign(l.qty) === sign).reduce((s, l) => s + Math.abs(l.qty), 0);
  const shares = legs.filter((l) => l.type === "stock").reduce((s, l) => s + l.qty, 0);
  return { calls: Math.max(0, sum("call", -1) - sum("call", 1) - Math.floor(Math.max(shares, 0) / 100)), puts: Math.max(0, sum("put", -1) - sum("put", 1)) };
}
/** Defined-risk (owner's rule): finite max loss AND no uncovered short option. CSP is handled by the caller as an explicit opt-in. */
export const isDefinedRisk = (legs: Leg[]) => { const n = nakedShorts(legs); return analyze(legs).maxLoss !== null && n.calls === 0 && n.puts === 0; };

// ---- builders (premiums per share) ----
const c = (strike: number, qty: number, premium: number): Leg => ({ type: "call", strike, qty, premium });
const p = (strike: number, qty: number, premium: number): Leg => ({ type: "put", strike, qty, premium });
export const build = {
  ironCondor: (pL: number, pS: number, cS: number, cL: number, px: { pL: number; pS: number; cS: number; cL: number }) => [p(pL, 1, px.pL), p(pS, -1, px.pS), c(cS, -1, px.cS), c(cL, 1, px.cL)],
  reverseIronCondor: (pL: number, pS: number, cS: number, cL: number, px: { pL: number; pS: number; cS: number; cL: number }) => [p(pL, -1, px.pL), p(pS, 1, px.pS), c(cS, 1, px.cS), c(cL, -1, px.cL)],
  ironFly: (pL: number, mid: number, cL: number, px: { pL: number; pM: number; cM: number; cL: number }) => [p(pL, 1, px.pL), p(mid, -1, px.pM), c(mid, -1, px.cM), c(cL, 1, px.cL)],
  callButterfly: (lo: number, mid: number, hi: number, px: { lo: number; mid: number; hi: number }) => [c(lo, 1, px.lo), c(mid, -2, px.mid), c(hi, 1, px.hi)],
  collar: (stock: number, putK: number, callK: number, px: { put: number; call: number }) => [{ type: "stock", strike: stock, qty: 100, premium: stock } as Leg, p(putK, 1, px.put), c(callK, -1, px.call)],
  protectivePut: (stock: number, putK: number, putPx: number) => [{ type: "stock", strike: stock, qty: 100, premium: stock } as Leg, p(putK, 1, putPx)],
};

/**
 * Time spreads (calendar / diagonal / PMCC): long leg expires later, so value at the FRONT expiry with
 * Black-Scholes for the remaining back leg. Scans a price grid; max loss bounded by net debit when debit structure.
 */
export interface TimeSpread { right: Right; frontStrike: number; backStrike: number; frontPremium: number; backPremium: number; backIv: number; yearsLeftAtFront: number; r?: number; q?: number }
export function timeSpreadAtFront(t: TimeSpread, S: number): number {
  const back = bs({ S, K: t.backStrike, T: t.yearsLeftAtFront, sigma: t.backIv, r: t.r, q: t.q, right: t.right }).price;
  const front = t.right === "call" ? Math.max(0, S - t.frontStrike) : Math.max(0, t.frontStrike - S);
  return ((back - t.backPremium) - (front - t.frontPremium)) * MULT;
}
export function analyzeTimeSpread(t: TimeSpread, spot: number): PayoffSummary & { assumption: string } {
  const lo = spot * 0.5, hi = spot * 1.5, n = 2000;
  let maxG = -Infinity, maxL = Infinity; const be: number[] = [];
  let prev: number | null = null, prevS = lo;
  for (let i = 0; i <= n; i++) {
    const S = lo + ((hi - lo) * i) / n, v = timeSpreadAtFront(t, S);
    maxG = Math.max(maxG, v); maxL = Math.min(maxL, v);
    if (prev != null && Math.sign(prev) !== Math.sign(v) && v !== 0) be.push(Number((prevS + (S - prevS) * (-prev / (v - prev))).toFixed(2)));
    prev = v; prevS = S;
  }
  const debit = (t.backPremium - t.frontPremium) * MULT;
  // with back strike <= front strike (call) the structure is covered: loss can't exceed debit (+ strike gap for diagonals)
  const gap = t.right === "call" ? Math.max(0, t.frontStrike - t.backStrike) : Math.max(0, t.backStrike - t.frontStrike);
  return { maxGain: round(maxG), maxLoss: round(maxL), breakevens: be, netDebit: round(debit), unboundedUp: false, unboundedDown: false,
    assumption: `back leg valued by Black-Scholes at front expiry with IV ${t.backIv} unchanged; grid ±50% of spot; strike gap ${gap}` };
}
