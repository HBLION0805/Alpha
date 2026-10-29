/**
 * Same-contract changes for every Yahoo `=F` futures series (generalizes PR #15's oil method; docs/FUTURES_SAME_CONTRACT.md).
 * Yahoo continuous symbols (ES=F, NQ=F, GC=F, CL=F …) roll before expiry and their daily bars splice the old contract's close
 * onto the new contract's price, so a close-to-close change on a roll day is partly the calendar spread.
 * Rule: front = `underlyingSymbol` of the continuous quote; 1d % = that contract's price ÷ the SAME contract's previous close − 1.
 * History = that contract's own bars (frontContinuous; older part ratio back-adjusted). Missing → price only / nothing → n/a, no alarm.
 * Roll label 「已换月至 X」 only from the saved state (data/out/futures-front.json). Pure functions; the CLI fetches.
 */
import type { Obs } from "./fetch.ts";
import { frontContinuous } from "./wtiFront.ts";

const MONTHS = "FGHJKMNQUVXZ", EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "BZF27.NYM" / "RTYZ26.CME" / "EWFZ26.CME" / "ZTZ26.CBT" → { code, root, month }; null if not a dated futures symbol */
export function parseContract(sym: string | null | undefined): { code: string; root: string; month: string } | null {
  const m = /^([A-Z]{1,4}?)([FGHJKMNQUVXZ])(\d{2})(\.[A-Z]+)?$/.exec(sym ?? ""); if (!m || !m[1]) return null;
  return { code: `${m[1]}${m[2]}${m[3]}`, root: m[1], month: `${EN[MONTHS.indexOf(m[2]!)]} ${m[3]}` };
}
/** Yahoo continuous futures symbol (ends in =F) */
export const isFutures = (ref: string) => /^[A-Z0-9]{1,5}=F$/.test(ref);

/** last known front contract per series id: `since` = ET date it became front, `from` = previous contract */
export type FrontState = Partial<Record<string, { contract: string; since: string; from: string | null }>>;
/** futures-front.json wins; entries only in the legacy oil-front.json (PR #15) are carried over */
export const mergeFrontState = (cur: FrontState | null | undefined, legacyOil: FrontState | null | undefined): FrontState => ({ ...(legacyOil ?? {}), ...(cur ?? {}) });

export interface SameContract { id: string; cont: string; contract: string; code: string; month: string; price: number; prevClose: number; pct1: number;
  rolled: boolean; rolledFrom: string | null; label: string; at: string }
export interface ContractQuote { symbol: string; returnedSymbol: string | null; price: number; prevClose: number | null; at: string }

/**
 * @param contQuote continuous quote (only underlyingSymbol is used); null = Yahoo gave no quote (e.g. VX=F)
 * @param contractQuote quote of that contract; its returnedSymbol (Yahoo's own `symbol`) must be the requested contract
 */
export function futSameChange(id: string, cont: string, contQuote: { underlyingSymbol: string | null } | null, contractQuote: ContractQuote | null,
  opts: { today: string; state?: FrontState }): { sc: SameContract | null; state: FrontState; note: string } {
  const state: FrontState = { ...(opts.state ?? {}) };
  if (!contQuote) return { sc: null, state, note: `${cont} Yahoo 无报价（无 underlyingSymbol）→ 1日涨跌 n/a，不触发警报（不用连续合约日线）` };
  const c = parseContract(contQuote.underlyingSymbol);
  if (!c) return { sc: null, state, note: `${cont} 未返回 underlyingSymbol → 无法确认限月，1日涨跌不计算（不用连续合约日线）` };
  if (!contractQuote || contractQuote.prevClose == null || !(contractQuote.prevClose > 0))
    return { sc: null, state, note: `${c.code} 无同合约昨收 → 1日涨跌不计算（不用连续合约日线）` };
  if (parseContract(contractQuote.returnedSymbol)?.code !== c.code)
    return { sc: null, state, note: `${c.code} 报价返回的合约为 ${contractQuote.returnedSymbol ?? "空"}，与 ${c.code} 不符 → 1日涨跌不计算` };
  const prev = state[id];
  if (!prev || prev.contract !== c.code) state[id] = { contract: c.code, since: opts.today, from: prev?.contract ?? null };
  const cur = state[id]!, rolled = cur.since === opts.today && cur.from != null; // label from saved state only, never from a price gap
  const pct1 = (contractQuote.price / contractQuote.prevClose - 1) * 100;
  return { state, note: "", sc: { id, cont, contract: contractQuote.symbol, code: c.code, month: c.month, price: contractQuote.price, prevClose: contractQuote.prevClose, pct1,
    rolled, rolledFrom: rolled ? cur.from : null, label: rolled ? `已换月至 ${c.code}（${c.month}）` : c.code, at: contractQuote.at } };
}

const etDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
/** strict mode, no same-contract history → only the live contract price (5日 / 均线 / 52周 → n/a, no 5d alarm) */
export const priceOnly = (sc: SameContract | null | undefined): Obs[] => (sc ? [{ t: etDay(sc.at), v: sc.price }] : []);

/**
 * Series for every downstream consumer: contract bars (≥6, frontContinuous with the continuous series for older history),
 * last point pinned to the contract quote and the point before it to the SAME contract's previous close, so the series 1d
 * equals sc.pct1 exactly. No sc → [] (n/a). Bars missing / short → price only.
 */
export function contractSeries(cont: Obs[] | undefined, bars: Obs[] | undefined, sc: SameContract | null | undefined): { series: Obs[]; full: boolean } {
  if (!sc) return { series: [], full: false };
  const F = (bars ?? []).filter((o) => Number.isFinite(o.v) && o.v > 0);
  if (F.length < 6) return { series: priceOnly(sc), full: false };
  const s = frontContinuous(cont, F, sc.code).series.map((o) => ({ ...o })), d = etDay(sc.at);
  while (s.length && s.at(-1)!.t.slice(0, 10) > d) s.pop();
  if (s.length && s.at(-1)!.t.slice(0, 10) === d) s.at(-1)!.v = sc.price; else s.push({ t: d, v: sc.price });
  if (s.length >= 2) s[s.length - 2] = { ...s[s.length - 2]!, v: sc.prevClose };
  return { series: s, full: true };
}

/** one-line note: formula, roll label, the fake % a spliced continuous series would show */
export function futNote(name: string, sc: SameContract, contPrevBar?: number | null): string {
  const naive = contPrevBar ? (sc.price / contPrevBar - 1) * 100 : null, p = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(2)}%`;
  return `${name} = ${sc.rolled ? `**${sc.label}**` : sc.label}：1日 = ${sc.code} ${sc.price.toFixed(2)} ÷ 同合约昨收 ${sc.prevClose.toFixed(2)} − 1 = ${p(sc.pct1)}`
    + (sc.rolled && naive != null ? `（${sc.cont} 日线拼接会显示 ${p(naive)}，为换月假变动，不用）` : "");
}
export const OFFLINE_FUT_NOTE = "⚠️ 离线/无同合约数据：期货（ES/NQ/RTY/黄金/铜/汽油/EWF 等 =F）沿用旧的连续合约方法（连续合约日线计算涨跌），换月日可能出现假变动";
