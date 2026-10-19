/**
 * Front-month NYMEX WTI (CL) contract by date — the contract CNBC quotes as @CL.1. Yahoo's CL=F rolls to the next month
 * a few days before expiry and splices the previous contract's close, so on roll days its 1-day change is a roll gap
 * (2026-10-19: CL=F 97.69 = Dec vs prev 101.41 = Nov → "-3.7%", while Nov itself was 100.70, -0.7%).
 * Rule (CME): trading terminates 3 business days before the 25th of the month before the contract month; if the 25th
 * is not a business day, 3 business days before the business day preceding the 25th. Business days ≈ NYSE days (nyse.ts).
 */
import { isTradingDay, prevTradingDay } from "./nyse.ts";

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
