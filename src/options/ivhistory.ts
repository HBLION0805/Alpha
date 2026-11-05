import type { DatabaseSync } from "node:sqlite";

export function initIv(db: DatabaseSync): void {
  db.exec(`CREATE TABLE IF NOT EXISTS options_iv (symbol TEXT NOT NULL, date TEXT NOT NULL, iv30 REAL NOT NULL, front_iv REAL, back_iv REAL, skew25 REAL, source TEXT, PRIMARY KEY (symbol, date));`);
}
export function saveIv(db: DatabaseSync, row: { symbol: string; date: string; iv30: number; frontIv: number | null; backIv: number | null; skew25: number | null; source: string }): void {
  db.prepare("INSERT OR REPLACE INTO options_iv VALUES (?,?,?,?,?,?,?)").run(row.symbol, row.date, row.iv30, row.frontIv, row.backIv, row.skew25, row.source);
}
export function loadIv(db: DatabaseSync, symbol: string): Array<{ date: string; iv30: number }> {
  return (db.prepare("SELECT date, iv30 FROM options_iv WHERE symbol = ? ORDER BY date").all(symbol) as Array<{ date: string; iv30: number }>).map((r) => ({ date: r.date, iv30: r.iv30 }));
}

export interface IvEnv { ivRank: number | null; ivPercentile: number | null; n: number; level: "HIGH" | "MID" | "LOW" | "UNKNOWN"; note: string; realized20: number | null; impliedVsRealized: "BELOW" | "NEAR" | "ABOVE" | null }
export const MIN_IV_HISTORY = 20;

/** 20-day close-to-close realized vol, annualised with √252 (期权课 6 章). */
export function realizedVol(closes: number[], n = 20): number | null {
  if (closes.length < n + 1) return null;
  const xs = closes.slice(-(n + 1));
  const r = xs.slice(1).map((c, i) => Math.log(c / xs[i]!));
  const m = r.reduce((s, x) => s + x, 0) / r.length;
  const v = r.reduce((s, x) => s + (x - m) ** 2, 0) / (r.length - 1);
  return Number((Math.sqrt(v * 252)).toFixed(4));
}

/**
 * IV environment (期权课 14.3 / 附录 D.1 第二步): 低 = IV Rank < 25 且隐含 ≤ 实际；高 = IV Rank > 50 且隐含 > 实际；
 * 冲突时以"隐含 vs 实际"为准. IV Rank = (cur − min)/(max − min) over ≤252 obs; Percentile = share of days below.
 * Without 20 days of own history, VIX bands are used as an explicitly labelled proxy.
 */
export function ivEnvironment(history: number[], current: number, proxy?: { vix: number | null }, realized20: number | null = null): IvEnv {
  const h = history.slice(-252);
  const ivr = realized20 == null ? null : current > realized20 * 1.1 ? "ABOVE" : current < realized20 * 0.95 ? "BELOW" : "NEAR";
  const byIvr = (fallback: IvEnv["level"]): IvEnv["level"] => (ivr === "ABOVE" && fallback === "LOW" ? "MID" : ivr === "BELOW" && fallback === "HIGH" ? "MID" : fallback);
  if (h.length >= MIN_IV_HISTORY) {
    const lo = Math.min(...h, current), hi = Math.max(...h, current);
    const rank = hi > lo ? ((current - lo) / (hi - lo)) * 100 : 50;
    const pct = (h.filter((x) => x < current).length / h.length) * 100;
    const raw = rank > 50 ? "HIGH" : rank < 25 ? "LOW" : "MID";
    const level = byIvr(raw);
    return { ivRank: Math.round(rank), ivPercentile: Math.round(pct), n: h.length, level, realized20, impliedVsRealized: ivr, note: `IV rank over ${h.length} saved days${level !== raw ? ` (rank says ${raw}; implied vs realized ${ivr} wins — 14.3)` : ""}` };
  }
  if (proxy?.vix != null) {
    const v = Number(proxy.vix.toFixed(2));
    const raw = v >= 22 ? "HIGH" : v <= 14 ? "LOW" : "MID";
    const level = byIvr(raw);
    return { ivRank: null, ivPercentile: null, n: h.length, level, realized20, impliedVsRealized: ivr, note: `only ${h.length}/${MIN_IV_HISTORY} saved IV days — level from VIX ${v} proxy (≤14 low, ≥22 high)${level !== raw ? `; implied vs realized ${ivr} adjusts it (14.3)` : ""}` };
  }
  return { ivRank: null, ivPercentile: null, n: h.length, level: "UNKNOWN", realized20, impliedVsRealized: ivr, note: `only ${h.length}/${MIN_IV_HISTORY} saved IV days` };
}
