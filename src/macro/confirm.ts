/** Did the market move the way the headline implies? Deterministic: keyword direction + intraday moves vs noise bands. */
import type { Obs } from "./fetch.ts";

export type Direction = "HAWKISH" | "DOVISH" | "UNKNOWN";
export type Verdict = "CONFIRMED" | "NOT_CONFIRMED" | "UNCLEAR";

const HAWK = /\b(hot(ter)?|rose faster|faster than expected|higher than expected|above (expectations|forecasts?|estimates?)|accelerat\w*|surg\w*|jump\w*|spik\w*|rate[- ]hikes?|hikes?|hawkish|strong(er)? (jobs|payrolls|hiring)|beats? (expectations|estimates)|sticky|rise sharply|rises? more than expected)\b/i;
const DOVE = /\b(cool(er|s|ed|ing)?|slow(er|ed|s|ing)?|below (expectations|forecasts?|estimates?)|lower than expected|eas(es|ed|ing)|rate[- ]cuts?|cuts? rates|dovish|weak(er)? (jobs|payrolls|hiring)|miss(es|ed)? (expectations|estimates)|disinflation|falls? more than expected|unexpectedly (fell|dropped))\b/i;

/** Direction for macro (rates/inflation/jobs) headlines. Mixed signals → UNKNOWN. */
export function headlineDirection(titles: string[]): { dir: Direction; hawk: number; dove: number } {
  let hawk = 0, dove = 0;
  for (const t of titles) {
    if (HAWK.test(t)) hawk++;
    if (DOVE.test(t)) dove++;
  }
  const dir: Direction = hawk > dove * 2 && hawk > 0 ? "HAWKISH" : dove > hawk * 2 && dove > 0 ? "DOVISH" : "UNKNOWN";
  return { dir, hawk, dove };
}

/** Expected sign of each instrument's % move after a HAWKISH surprise (DOVISH = opposite). ZT is a bond-futures PRICE: down = 2Y yield up. */
export const HAWKISH_SIGN: Record<string, 1 | -1> = { ZT: -1, UST10Y_MKT: 1, DXY: 1, GOLD: -1, SPY: -1, BTC: -1 };
/** Moves smaller than this (%) count as noise. */
export const NOISE: Record<string, number> = { ZT: 0.04, UST10Y_MKT: 0.6, DXY: 0.15, GOLD: 0.35, SPY: 0.3, BTC: 1.0 };

export interface Move {
  series: string;
  from: number;
  to: number;
  pct: number;
  expected: 1 | -1;
  result: "CONSISTENT" | "INCONSISTENT" | "FLAT" | "NO_DATA";
}

export interface Confirmation {
  verdict: Verdict;
  direction: Direction;
  reason: string;
  windowFrom: string;
  windowTo: string;
  moves: Move[];
}

function valueAt(obs: Obs[], iso: string, mode: "before" | "after"): Obs | undefined {
  if (mode === "before") {
    let r: Obs | undefined;
    for (const o of obs) if (o.t <= iso) r = o; else break;
    return r;
  }
  return obs.find((o) => o.t >= iso);
}

/**
 * eventTime: when the news first appeared. Window ends at eventTime + horizonHours (or the latest bar).
 * Base is the last bar at/before the event (previous close for pre-market releases like CPI 08:30 ET).
 */
export function confirmReaction(titles: string[], eventTime: string, intraday: Record<string, Obs[]>, horizonHours = 6, now = new Date()): Confirmation {
  const { dir, hawk, dove } = headlineDirection(titles);
  const endIso = new Date(Math.min(Date.parse(eventTime) + horizonHours * 3600_000, now.getTime())).toISOString();
  const moves: Move[] = [];
  for (const [series, sign] of Object.entries(HAWKISH_SIGN)) {
    const obs = intraday[series] ?? [];
    const a = valueAt(obs, eventTime, "before");
    let b = valueAt(obs, endIso, "before");
    if (b && a && b.t <= a.t) b = valueAt(obs, eventTime, "after"); // no bar yet after event
    const expected = (dir === "DOVISH" ? -sign : sign) as 1 | -1;
    if (!a || !b || b.t <= a.t) {
      moves.push({ series, from: a?.v ?? NaN, to: b?.v ?? NaN, pct: 0, expected, result: "NO_DATA" });
      continue;
    }
    const pct = Math.round(((b.v - a.v) / a.v) * 10000) / 100;
    const result = Math.abs(pct) < (NOISE[series] ?? 0.2) ? "FLAT" : Math.sign(pct) === expected ? "CONSISTENT" : "INCONSISTENT";
    moves.push({ series, from: a.v, to: b.v, pct, expected, result });
  }
  const cons = moves.filter((m) => m.result === "CONSISTENT").length;
  const inc = moves.filter((m) => m.result === "INCONSISTENT").length;
  const data = moves.filter((m) => m.result !== "NO_DATA").length;
  let verdict: Verdict, reason: string;
  if (dir === "UNKNOWN") [verdict, reason] = ["UNCLEAR", `headline direction ambiguous (hawkish cues ${hawk}, dovish cues ${dove})`];
  else if (data < 3) [verdict, reason] = ["UNCLEAR", `only ${data} instruments have bars in the window`];
  else if (cons >= 3 && inc <= 1) [verdict, reason] = ["CONFIRMED", `${cons}/${data} instruments moved as a ${dir.toLowerCase()} surprise implies, ${inc} against`];
  else if (inc >= 2 && inc > cons) [verdict, reason] = ["NOT_CONFIRMED", `${inc}/${data} instruments moved against a ${dir.toLowerCase()} reading, ${cons} with it`];
  else [verdict, reason] = ["UNCLEAR", `mixed reaction: ${cons} consistent, ${inc} inconsistent, ${data - cons - inc} flat`];
  return { verdict, direction: dir, reason, windowFrom: eventTime, windowTo: endIso, moves };
}
