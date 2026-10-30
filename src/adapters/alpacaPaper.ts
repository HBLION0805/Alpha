/** Alpaca PAPER trading REST (orders/positions). Hard-wired to paper-api — there is no live endpoint here.
 *  Keys come from env ALPACA_KEY / ALPACA_SECRET (never logged). Tests inject a fake `AlpacaHttp`. */
export const ALPACA_PAPER_BASE = "https://paper-api.alpaca.markets/v2/";

export interface AlpacaOrder { id: string; symbol: string; side?: string; type?: string; status?: string; order_class?: string; legs?: AlpacaOrder[] | null }
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
