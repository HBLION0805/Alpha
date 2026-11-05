import type { Obs } from "./fetch.ts";

export interface SeriesStats {
  id: string;
  last: number | null;
  lastDate: string | null;
  /** changes: bp for yield-like series (unit pct), % for prices/indexes */
  chg1: number | null;
  chg5: number | null;
  chg20: number | null;
  /** z-score of the 20-observation change vs the trailing ~1y of rolling 20-obs changes */
  z20: number | null;
  /** z-score of the level vs trailing ~1y */
  zLevel: number | null;
  ma50: number | null;
  n: number;
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, xs.length - 1));
};

export function change(a: number, b: number, yieldLike: boolean): number {
  return yieldLike ? (b - a) * 100 : ((b - a) / a) * 100;
}

/** For weekly series pass step sizes in observations, e.g. {s1:1,s5:1,s20:4}. */
export function computeStats(id: string, obs: Obs[], yieldLike: boolean, steps = { s1: 1, s5: 5, s20: 20 }, lookback = 252): SeriesStats {
  const v = obs.map((o) => o.v);
  const n = v.length;
  const last = n ? v[n - 1]! : null;
  const at = (k: number) => (n > k ? change(v[n - 1 - k]!, v[n - 1]!, yieldLike) : null);
  const r = (x: number | null) => (x === null ? null : Math.round(x * 100) / 100);
  let z20: number | null = null, zLevel: number | null = null;
  const win = v.slice(-lookback - steps.s20);
  if (win.length > steps.s20 + 20) {
    const chgs: number[] = [];
    for (let i = steps.s20; i < win.length; i++) chgs.push(change(win[i - steps.s20]!, win[i]!, yieldLike));
    const s = sd(chgs);
    if (s > 0) z20 = (chgs[chgs.length - 1]! - mean(chgs)) / s;
    const lv = win.slice(steps.s20);
    const sl = sd(lv);
    if (sl > 0) zLevel = (last! - mean(lv)) / sl;
  }
  const ma50 = n >= 50 ? mean(v.slice(-50)) : null;
  return { id, last: last === null ? null : Math.round(last * 10000) / 10000, lastDate: n ? obs[n - 1]!.t : null, chg1: r(at(steps.s1)), chg5: r(at(steps.s5)), chg20: r(at(steps.s20)), z20: r(z20), zLevel: r(zLevel), ma50: r(ma50), n };
}
