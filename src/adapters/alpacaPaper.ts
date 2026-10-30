/** Alpaca PAPER trading REST (orders/positions). Hard-wired to paper-api — there is no live endpoint here.
 *  Keys come from env ALPACA_KEY / ALPACA_SECRET (never logged). Tests inject a fake `AlpacaHttp`. */
export const ALPACA_PAPER_BASE = "https://paper-api.alpaca.markets/v2/";

export interface AlpacaOrder { id: string; symbol: string; side?: string; type?: string; status?: string; order_class?: string; legs?: AlpacaOrder[] | null; client_order_id?: string; qty?: string; filled_qty?: string; filled_avg_price?: string | null; filled_at?: string | null }
export interface AlpacaPosition { symbol: string; qty: string; side?: string; market_value?: string; unrealized_pl?: string }
export interface AlpacaHttp { (method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<{ status: number; body: unknown }> }

export function alpacaPaperHttp(env: NodeJS.ProcessEnv = process.env, timeoutMs = 10_000): AlpacaHttp {
  const key = env.ALPACA_KEY, secret = env.ALPACA_SECRET;
  if (!key || !secret) throw new Error("ALPACA_KEY / ALPACA_SECRET not set (paper account)");
  return async (method, path, body) => {
    const res = await fetch(ALPACA_PAPER_BASE + path, { method, signal: AbortSignal.timeout(timeoutMs),
      headers: { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret, "content-type": "application/json" }, body: body == null ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let parsed: unknown = null; try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    return { status: res.status, body: parsed };
  };
}

/** Alpaca market data (read-only GET, same env keys). 5-minute bars for the plan executor; feed via ALPACA_DATA_FEED (default iex = free plan). */
export const ALPACA_DATA_BASE = "https://data.alpaca.markets/v2/";
export interface Bar5 { t: string; o: number; h: number; l: number; c: number; v?: number }
export type BarsFetcher = (symbol: string, startIso: string, endIso: string) => Promise<Bar5[]>;
export function alpacaBars(env: NodeJS.ProcessEnv = process.env, timeoutMs = 10_000): BarsFetcher {
  const key = env.ALPACA_KEY, secret = env.ALPACA_SECRET, feed = env.ALPACA_DATA_FEED || "iex";
  if (!key || !secret) throw new Error("ALPACA_KEY / ALPACA_SECRET not set (market data)");
  return async (symbol, start, end) => {
    const q = new URLSearchParams({ timeframe: "5Min", start, end, feed, adjustment: "raw", limit: "1000" });
    const res = await fetch(`${ALPACA_DATA_BASE}stocks/${encodeURIComponent(symbol)}/bars?${q}`, { signal: AbortSignal.timeout(timeoutMs), headers: { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret } });
    if (!res.ok) throw new Error(`bars ${symbol} HTTP ${res.status}`);
    const j = (await res.json()) as { bars?: Bar5[] | null };
    return (j.bars ?? []).map((b) => ({ t: b.t, o: +b.o, h: +b.h, l: +b.l, c: +b.c, v: b.v }));
  };
}
