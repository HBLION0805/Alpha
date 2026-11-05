/** Adapter: indicatorts (MIT) — the only file that imports it. Returns plain numbers; callers own the thresholds. */
import { sma as smaSeries, rsi as rsiSeries, macd as macdLib, vortex as vortexLib } from "indicatorts";

/** Last simple moving average over n values; null if fewer than n. */
export function sma(values: number[], n: number): number | null {
  if (values.length < n) return null;
  return smaSeries(values.slice(-n), { period: n }).at(-1)!;
}
/** RSI series (period n), aligned to the input; first n values are warm-up and dropped. */
export const rsi = (closes: number[], n = 14): number[] => rsiSeries(closes, { period: n }).slice(n);
/** MACD histogram (12/26/9). */
export function macdHist(closes: number[]): number[] {
  const { macdLine, signalLine } = macdLib(closes, { fast: 12, slow: 26, signal: 9 });
  return macdLine.map((m, i) => m - signalLine[i]!);
}
/** Vortex VI+ / VI- (period n), last value. */
export function vortexLast(h: number[], l: number[], c: number[], n = 14): { plus: number; minus: number } {
  const v = vortexLib(h, l, c, { period: n });
  return { plus: v.plus.at(-1)!, minus: v.minus.at(-1)! };
}
