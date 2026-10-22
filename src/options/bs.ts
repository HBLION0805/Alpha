/** Black-Scholes (European, continuous dividend yield q). Used when Robinhood greeks are null. */
export type Right = "call" | "put";

/** Abramowitz-Stegun 7.1.26 via erf; |error| < 1.5e-7 */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}
export const normPdf = (x: number) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);

export interface BSInput { S: number; K: number; T: number; sigma: number; r?: number; q?: number; right: Right }
export interface Greeks { price: number; delta: number; gamma: number; theta: number; vega: number; rho: number }

/** theta per calendar day, vega per 1 vol point (0.01), rho per 1% rate — same units as Robinhood. */
export function bs(i: BSInput): Greeks {
  const { S, K, sigma, right } = i;
  const r = i.r ?? 0.04, q = i.q ?? 0.012;
  const T = Math.max(i.T, 1e-6);
  if (sigma <= 0) {
    const fwd = right === "call" ? Math.max(0, S * Math.exp(-q * T) - K * Math.exp(-r * T)) : Math.max(0, K * Math.exp(-r * T) - S * Math.exp(-q * T));
    return { price: fwd, delta: right === "call" ? (S > K ? 1 : 0) : S < K ? -1 : 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
  }
  const sq = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + sigma * sigma / 2) * T) / (sigma * sq);
  const d2 = d1 - sigma * sq;
  const dq = Math.exp(-q * T), dr = Math.exp(-r * T);
  const gamma = (dq * normPdf(d1)) / (S * sigma * sq);
  const vega = (S * dq * normPdf(d1) * sq) / 100;
  if (right === "call") {
    const price = S * dq * normCdf(d1) - K * dr * normCdf(d2);
    const theta = (-(S * dq * normPdf(d1) * sigma) / (2 * sq) - r * K * dr * normCdf(d2) + q * S * dq * normCdf(d1)) / 365;
    return { price, delta: dq * normCdf(d1), gamma, theta, vega, rho: (K * T * dr * normCdf(d2)) / 100 };
  }
  const price = K * dr * normCdf(-d2) - S * dq * normCdf(-d1);
  const theta = (-(S * dq * normPdf(d1) * sigma) / (2 * sq) + r * K * dr * normCdf(-d2) - q * S * dq * normCdf(-d1)) / 365;
  return { price, delta: -dq * normCdf(-d1), gamma, theta, vega, rho: (-K * T * dr * normCdf(-d2)) / 100 };
}

/** Implied vol by bisection; null when price is outside no-arbitrage bounds. */
export function impliedVol(price: number, i: Omit<BSInput, "sigma">): number | null {
  let lo = 0.001, hi = 5;
  const f = (s: number) => bs({ ...i, sigma: s }).price - price;
  if (f(lo) > 0 || f(hi) < 0) return null;
  for (let k = 0; k < 100; k++) {
    const m = (lo + hi) / 2;
    if (f(m) > 0) hi = m; else lo = m;
    if (hi - lo < 1e-6) break;
  }
  return (lo + hi) / 2;
}

/** Year fraction from asOf to 16:00 ET on expiration (approx 20:00/21:00 UTC; uses 20:00Z). */
export function yearFrac(asOf: string, expiration: string): number {
  const ms = Date.parse(`${expiration}T20:00:00Z`) - Date.parse(asOf);
  return Math.max(ms, 3600_000) / (365 * 86400_000);
}
export const daysTo = (asOf: string, expiration: string) => yearFrac(asOf, expiration) * 365;

/** 1-sigma expected move = S * IV * sqrt(days/365); ATM straddle ≈ 0.8 * EM (course ch.3). */
export const expectedMove = (S: number, iv: number, days: number) => S * iv * Math.sqrt(days / 365);
export const STRADDLE_TO_EM = 0.8;
