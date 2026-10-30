/**
 * Low-latency Benzinga news via Alpaca market data.
 *  - WebSocket stream: wss://stream.data.alpaca.markets/v1beta1/news (auth → subscribe news ["*"])
 *  - REST backfill:    https://data.alpaca.markets/v1beta1/news (used by poll and after (re)connect)
 * Credentials are read only from env ALPACA_KEY / ALPACA_SECRET and never logged.
 */
import type { FeedItem } from "../types.ts";

export const ALPACA_NEWS_WS = "wss://stream.data.alpaca.markets/v1beta1/news";
export const ALPACA_NEWS_REST = "https://data.alpaca.markets/v1beta1/news";
export const ALPACA_SOURCE_ID = "alpaca_benzinga";

type Env = Record<string, string | undefined>;

export function alpacaEnabled(env: Env = process.env): boolean {
  return Boolean(env.ALPACA_KEY && env.ALPACA_SECRET);
}

function toItem(m: Record<string, unknown>): FeedItem | null {
  const title = String(m.headline ?? "").trim();
  const url = String(m.url ?? "").trim();
  if (!title || !url) return null;
  const symbols = Array.isArray(m.symbols) ? (m.symbols as unknown[]).map(String) : [];
  const summary = [String(m.summary ?? "").replace(/<[^>]+>/g, " ").trim(), symbols.length ? `Symbols: ${symbols.join(", ")}` : ""].filter(Boolean).join(" · ");
  return {
    sourceId: ALPACA_SOURCE_ID,
    title,
    url,
    publishedAt: new Date(String(m.created_at ?? m.updated_at ?? Date.now())).toISOString(),
    summary: summary.slice(0, 500),
    guid: `alpaca:${String(m.id ?? "")}`,
  };
}

/** Parse a websocket frame (array of messages; news has T:"n"). */
export function parseAlpacaStream(msg: unknown): FeedItem[] {
  if (!Array.isArray(msg)) return [];
  return msg.filter((m) => m && typeof m === "object" && (m as Record<string, unknown>).T === "n").map((m) => toItem(m as Record<string, unknown>)).filter((x): x is FeedItem => !!x);
}

/** Parse a REST /v1beta1/news response body ({ news: [...], next_page_token }). */
export function parseAlpacaRest(body: unknown): FeedItem[] {
  const news = (body as { news?: unknown[] } | null)?.news;
  if (!Array.isArray(news)) return [];
  return news.map((m) => toItem(m as Record<string, unknown>)).filter((x): x is FeedItem => !!x);
}

function authHeaders(env: Env): Record<string, string> {
  return { "APCA-API-KEY-ID": env.ALPACA_KEY ?? "", "APCA-API-SECRET-KEY": env.ALPACA_SECRET ?? "" };
}

/** REST backfill: newest-first up to `max` items since `startIso`. */
export async function backfillAlpacaNews(startIso: string, max = 200, env: Env = process.env, timeoutMs = 10_000): Promise<{ status: number; items: FeedItem[]; ms: number }> {
  const t0 = Date.now();
  const items: FeedItem[] = [];
  let token: string | undefined;
  let status = 0;
  do {
    const u = new URL(ALPACA_NEWS_REST);
    u.searchParams.set("start", startIso);
    u.searchParams.set("limit", "50");
    u.searchParams.set("sort", "desc");
    if (token) u.searchParams.set("page_token", token);
    const res = await fetch(u, { headers: authHeaders(env), signal: AbortSignal.timeout(timeoutMs) });
    status = res.status;
    if (!res.ok) break;
    const body = (await res.json()) as { next_page_token?: string | null };
    items.push(...parseAlpacaRest(body));
    token = body.next_page_token ?? undefined;
  } while (token && items.length < max);
  return { status, items, ms: Date.now() - t0 };
}

export interface StreamHandle {
  close(): void;
}

/**
 * Connect to the websocket, call onItems per news batch. Reconnects with backoff and
 * runs a REST backfill for the gap after every (re)connect. Returns null if not configured.
 */
export function startAlpacaNews(onItems: (items: FeedItem[], via: "ws" | "rest") => void, opts: { env?: Env; log?: (s: string) => void } = {}): StreamHandle | null {
  const env = opts.env ?? process.env;
  const log = opts.log ?? ((s: string) => console.error(`[alpaca] ${s}`));
  if (!alpacaEnabled(env)) return null;
  let closed = false;
  let ws: WebSocket | undefined;
  let backoff = 1000;
  let lastSeen = new Date(Date.now() - 3600_000).toISOString();
  const emit = (items: FeedItem[], via: "ws" | "rest") => {
    if (!items.length) return;
    for (const i of items) if (i.publishedAt > lastSeen) lastSeen = i.publishedAt;
    onItems(items, via);
  };
  const connect = () => {
    if (closed) return;
    ws = new WebSocket(ALPACA_NEWS_WS);
    ws.onopen = () => ws?.send(JSON.stringify({ action: "auth", key: env.ALPACA_KEY, secret: env.ALPACA_SECRET }));
    ws.onmessage = (ev) => {
      let msg: unknown;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (!Array.isArray(msg)) return;
      for (const m of msg as Array<Record<string, unknown>>) {
        if (m.T === "success" && m.msg === "authenticated") {
          log("authenticated; subscribing news *");
          ws?.send(JSON.stringify({ action: "subscribe", news: ["*"] }));
          backoff = 1000;
          backfillAlpacaNews(lastSeen, 200, env).then((r) => emit(r.items, "rest"), (e: Error) => log(`backfill failed: ${e.message}`));
        } else if (m.T === "subscription") log("subscribed");
        else if (m.T === "error") log(`error ${String(m.code)} ${String(m.msg)}`);
      }
      emit(parseAlpacaStream(msg), "ws");
    };
    ws.onclose = () => {
      if (closed) return;
      log(`closed; reconnecting in ${backoff}ms`);
      setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 60_000);
    };
    ws.onerror = () => log("socket error");
  };
  connect();
  return {
    close() {
      closed = true;
      ws?.close();
    },
  };
}
