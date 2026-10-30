/**
 * Same-contract oil changes (docs/brent_roll: Yahoo BZ=F / CL=F roll early and their daily bars splice the old contract's
 * close onto the new contract's price — 2026-10-29: BZ=F "−4.7%" while BZF27 itself was −1.6%).
 * Rule: identify the front contract from the continuous symbol's `underlyingSymbol` (BZ=F → BZF27.NYM), then
 *   1d % = that contract's current price ÷ that SAME contract's previous close − 1.
 * Never from the continuous contract's daily bars. Pure functions; the CLI fetches (adapters/yahoo.ts yahooFutQuote).
 */
export type OilId = "WTI" | "BRENT";
export const OIL_CONT: Record<OilId, string> = { WTI: "CL=F", BRENT: "BZ=F" };
export { parseContract, priceOnly, type FrontState, type SameContract } from "./futContract.ts";
import { futSameChange, futNote, type ContractQuote, type FrontState, type SameContract } from "./futContract.ts";

/** oil client of the generic futures code (futContract.ts) */
export function sameContractChange(id: OilId, contQuote: { underlyingSymbol: string | null } | null, contractQuote: ContractQuote | null,
  opts: { today: string; state?: FrontState; contPrevBar?: number | null }): { sc: SameContract | null; state: FrontState; note: string } {
  return futSameChange(id, OIL_CONT[id], contQuote, contractQuote, opts);
}

/** one-line note for the oil block */
export function sameContractNote(sc: SameContract, contPrevBar?: number | null): string {
  return futNote(sc.id === "WTI" ? "WTI" : "Brent", sc, contPrevBar);
}

/** Brent/WTI-specific note for a frontContinuous series (no regex-rewriting of the WTI note) */
export function contractSeriesNote(name: "WTI" | "Brent", cont: string, fs: { code: string; junction: string | null; ratio: number | null; series: { v: number }[] }, contLast?: number | null): string {
  const adj = fs.ratio != null && Math.abs(fs.ratio - 1) > 0.0005 ? `，更早的历史按 ${fs.junction} 比例 ${fs.ratio.toFixed(4)} 调整` : "";
  const last = fs.series.at(-1)?.v, rolled = contLast != null && last != null && Math.abs(contLast / last - 1) > 0.005;
  return `${name} = 合约 ${fs.code}（${cont} 的 underlyingSymbol）；近期 1日/5日用同一合约计算${adj}${rolled ? `；${cont} 日线 ${contLast!.toFixed(2)} 与该合约不同，不用` : ""}`;
}
export const OFFLINE_OIL_NOTE = "⚠️ 离线/无同合约数据：原油沿用旧的连续合约方法（CL=F / BZ=F 日线计算 1日/5日），换月日可能出现假变动和假警报";
/** 50-day / 52-week columns: only the last ~10 days are the contract itself; older bars are the continuous series ratio-adjusted (wtiFront.ts frontContinuous). Display only. */
export const HIST_LABEL = "回溯调整连续合约";
