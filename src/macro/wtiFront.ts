/**
 * Front-month NYMEX WTI (CL) contract by date — the contract CNBC quotes as @CL.1. Yahoo's CL=F rolls to the next month
 * a few days before expiry and splices the previous contract's close, so on roll days its 1-day change is a roll gap
 * (2026-10-19: CL=F 97.69 = Dec vs prev 101.41 = Nov → "-3.7%", while Nov itself was 100.70, -0.7%).
 * Rule (CME): trading terminates 3 business days before the 25th of the month before the contract month; if the 25th
 * is not a business day, 3 business days before the business day preceding the 25th. Business days ≈ NYSE days (nyse.ts).
 */
import { isTradingDay, prevTradingDay } from "./nyse.ts";
import type { Obs } from "./fetch.ts";

const CODES = "FGHJKMNQUVXZ";
/** last trading day of the CL contract for delivery month m (1–12) of year y */
export function clExpiry(y: number, m: number): string {
  const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
  let d = `${py}-${String(pm).padStart(2, "0")}-25`;
  if (!isTradingDay(d)) d = prevTradingDay(d);
  for (let i = 0; i < 3; i++) d = prevTradingDay(d);
  return d;
}
/** front contract on ET date d (still front on its own expiry day) → { code: "CLX26", yahoo: "CLX26.NYM", expiry } */
export function wtiFront(d: string): { code: string; yahoo: string; expiry: string; month: string } {
  let y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7));
  for (let k = 0; k < 4; k++) {
    m++; if (m > 12) { m = 1; y++; }
    const exp = clExpiry(y, m);
    if (exp >= d) { const code = `CL${CODES[m - 1]}${String(y).slice(2)}`; return { code, yahoo: `${code}.NYM`, expiry: exp, month: `${y}-${String(m).padStart(2, "0")}` }; }
  }
  throw new Error(`no CL front contract for ${d}`);
}

export interface FrontSeries { series: Obs[]; code: string; junction: string | null; ratio: number | null; note: string }
/**
 * Continuous WTI for the oil block / alarms / 快速变动 flag: the last `window` trading days (enough for 1d and 5d changes)
 * come from the front contract itself, so every recent change is same-contract — no roll gap, neither on Yahoo's early
 * CL=F roll nor on our own switch at expiry. Older history (50-day SMA, 52-week high) is Yahoo CL=F scaled by
 * front/CL=F on the junction day (ratio back-adjustment). Front missing or too short → CL=F unchanged (note says so).
 */
export function frontContinuous(cl: Obs[] | undefined, front: Obs[] | undefined, code: string, window = 10): FrontSeries {
  const C = cl ?? [], F = (front ?? []).filter((o) => Number.isFinite(o.v) && o.v > 0);
  if (F.length < 6) return { series: C, code, junction: null, ratio: null, note: `近月 ${code} 数据不足 → 仍用 Yahoo CL=F（换月日可能有假变动）` };
  const tail = F.slice(-(window + 1)), j = tail[0]!.t.slice(0, 10);
  const cAt = C.find((o) => o.t.slice(0, 10) === j);
  const ratio = cAt ? tail[0]!.v / cAt.v : null;
  const older = ratio == null ? [] : C.filter((o) => o.t.slice(0, 10) < j).map((o) => ({ t: o.t, v: o.v * ratio }));
  const clLast = C.at(-1)?.v, fLast = F.at(-1)!.v;
  const rolled = clLast != null && Math.abs(clLast / fLast - 1) > 0.005;
  return { series: [...older, ...tail], code, junction: j, ratio,
    note: `WTI = 近月 ${code}（= CNBC @CL.1）；近 ${tail.length - 1} 个交易日用同一合约计算 1日/5日${ratio != null && Math.abs(ratio - 1) > 0.0005 ? `，更早的历史按 ${j} 比例 ${ratio.toFixed(4)} 调整` : ""}${rolled ? `；Yahoo CL=F ${clLast!.toFixed(2)} 已提前换到下月合约，不用` : ""}` };
}
