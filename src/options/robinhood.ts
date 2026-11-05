import type { Chain, Contract } from "./chain.ts";

/** Saved MCP output may carry a text wrapper around the JSON; take the outermost object. */
export function unwrapJson(text: string): unknown {
  try { return JSON.parse(text); } catch { /* wrapped MCP output */ }
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("no JSON object found");
  return JSON.parse(text.slice(a, b + 1));
}
type Inst = { id: string; expiration_date: string; strike_price: string; type: "call" | "put" };
type Q = { instrument_id: string; bid_price?: string; ask_price?: string; mark_price?: string; implied_volatility?: string | null; delta?: string | null; gamma?: string | null; theta?: string | null; vega?: string | null; open_interest?: number; volume?: number; updated_at?: string };

/** Join Robinhood get_option_instruments pages + get_option_quotes into the normalized chain. */
export function chainFromRobinhood(instrumentPages: unknown[], quotePages: unknown[], symbol: string, underlyingPrice: number, asOf?: string): Chain {
  const inst = new Map<string, Inst>();
  for (const p of instrumentPages) for (const i of ((p as { data?: { instruments?: Inst[] } }).data?.instruments ?? (p as { instruments?: Inst[] }).instruments ?? [])) inst.set(i.id, i);
  const num = (x: string | null | undefined) => (x == null || x === "" ? null : Number(x));
  const contracts: Contract[] = []; let latest = "";
  for (const p of quotePages) for (const r of ((p as { data?: { results?: Array<{ quote: Q }> } }).data?.results ?? (p as { results?: Array<{ quote: Q }> }).results ?? [])) {
    const q = r.quote, m = inst.get(q.instrument_id);
    if (!m) continue;
    if (q.updated_at && q.updated_at > latest) latest = q.updated_at;
    contracts.push({ expiration: m.expiration_date, strike: Number(m.strike_price), type: m.type, bid: num(q.bid_price), ask: num(q.ask_price), mark: num(q.mark_price), iv: num(q.implied_volatility), delta: num(q.delta), gamma: num(q.gamma), theta: num(q.theta), vega: num(q.vega), openInterest: q.open_interest ?? null, volume: q.volume ?? null });
  }
  contracts.sort((a, b) => a.expiration.localeCompare(b.expiration) || a.type.localeCompare(b.type) || a.strike - b.strike);
  return { symbol, underlyingPrice, asOf: asOf ?? (latest || new Date().toISOString()), contracts, source: "Robinhood MCP instruments+quotes" };
}
