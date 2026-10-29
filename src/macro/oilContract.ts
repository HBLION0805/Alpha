/**
 * Same-contract oil changes (docs/brent_roll: Yahoo BZ=F / CL=F roll early and their daily bars splice the old contract's
 * close onto the new contract's price — 2026-10-29: BZ=F "−4.7%" while BZF27 itself was −1.6%).
 * Rule: identify the front contract from the continuous symbol's `underlyingSymbol` (BZ=F → BZF27.NYM), then
 *   1d % = that contract's current price ÷ that SAME contract's previous close − 1.
 * Never from the continuous contract's daily bars. Pure functions; the CLI fetches (adapters/yahoo.ts yahooFutQuote).
 */
export type OilId = "WTI" | "BRENT";
export const OIL_CONT: Record<OilId, string> = { WTI: "CL=F", BRENT: "BZ=F" };
const MONTHS = "FGHJKMNQUVXZ", EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "BZF27.NYM" → { code: "BZF27", root: "BZ", month: "Jan 27" }; null if not a dated futures symbol */
export function parseContract(sym: string | null | undefined): { code: string; root: string; month: string } | null {
  const m = /^([A-Z]{2})([FGHJKMNQUVXZ])(\d{2})(\.[A-Z]+)?$/.exec(sym ?? ""); if (!m) return null;
  return { code: `${m[1]}${m[2]}${m[3]}`, root: m[1]!, month: `${EN[MONTHS.indexOf(m[2]!)]} ${m[3]}` };
}

/** last known front contract per series (data/out/oil-front.json): `since` = ET date the contract became front */
export type FrontState = Partial<Record<OilId, { contract: string; since: string; from: string | null }>>;

export interface SameContract { id: OilId; cont: string; contract: string; code: string; month: string; price: number; prevClose: number; pct1: number;
  rolled: boolean; rolledFrom: string | null; label: string; at: string }

/**
 * @param contQuote the continuous quote (only its underlyingSymbol is used)
 * @param contractQuote quote of that specific contract (price + previous close of the SAME contract)
 * @param contPrevBar previous daily close of the continuous series (only to DETECT a splice; never used for the change)
 */
export function sameContractChange(id: OilId, contQuote: { underlyingSymbol: string | null } | null, contractQuote: { symbol: string; price: number; prevClose: number | null; at: string } | null,
  opts: { today: string; state?: FrontState; contPrevBar?: number | null }): { sc: SameContract | null; state: FrontState; note: string } {
  const state: FrontState = { ...(opts.state ?? {}) }, cont = OIL_CONT[id];
  const c = parseContract(contQuote?.underlyingSymbol);
  if (!c) return { sc: null, state, note: `${cont} 未返回 underlyingSymbol → 无法确认限月，1日涨跌不计算（不用连续合约日线）` };
  if (!contractQuote || contractQuote.prevClose == null || !(contractQuote.prevClose > 0) || parseContract(contractQuote.symbol)?.code !== c.code)
    return { sc: null, state, note: `${c.code} 无同合约昨收 → 1日涨跌不计算（不用连续合约日线）` };
  const prev = state[id];
  if (!prev || prev.contract !== c.code) state[id] = { contract: c.code, since: opts.today, from: prev?.contract ?? null };
  const cur = state[id]!;
  const splice = opts.contPrevBar != null && Math.abs(opts.contPrevBar / contractQuote.prevClose - 1) > 0.005; // continuous prev bar ≠ this contract's prev close
  const rolledToday = cur.since === opts.today && cur.from != null;
  const rolled = rolledToday || splice;
  const pct1 = (contractQuote.price / contractQuote.prevClose - 1) * 100;
  return { state, note: "", sc: { id, cont, contract: contractQuote.symbol, code: c.code, month: c.month, price: contractQuote.price, prevClose: contractQuote.prevClose, pct1,
    rolled, rolledFrom: rolledToday ? cur.from : null, label: rolled ? `已换月至 ${c.code}（${c.month}）` : c.code, at: contractQuote.at } };
}

/** one-line note for the oil block */
export function sameContractNote(sc: SameContract, contPrevBar?: number | null): string {
  const naive = contPrevBar ? (sc.price / contPrevBar - 1) * 100 : null;
  return `${sc.id === "WTI" ? "WTI" : "Brent"} = ${sc.rolled ? `**${sc.label}**` : sc.label}：1日 = ${sc.code} ${sc.price.toFixed(2)} ÷ 同合约昨收 ${sc.prevClose.toFixed(2)} − 1 = ${sc.pct1 >= 0 ? "+" : ""}${sc.pct1.toFixed(2)}%`
    + (sc.rolled && naive != null ? `（${sc.cont} 日线拼接会显示 ${naive >= 0 ? "+" : ""}${naive.toFixed(2)}%，为换月假变动，不用）` : "");
}
