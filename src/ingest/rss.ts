import type { FeedItem, Source } from "../types.ts";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function text(raw: string | undefined): string {
  if (!raw) return "";
  let s = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  s = decodeEntities(s); // entity-encoded HTML first, then strip tags
  s = s.replace(/<[^>]+>/g, " ");
  return decodeEntities(s).replace(/\s+/g, " ").trim();
}

function tag(block: string, names: string[]): string | undefined {
  for (const n of names) {
    const re = new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, "i");
    const m = block.match(re);
    if (m) return m[1];
  }
  return undefined;
}

function atomLink(block: string): string | undefined {
  const links = [...block.matchAll(/<link\b([^>]*?)\/?>/gi)].map((m) => m[1] ?? "");
  const pick = links.find((a) => /rel=["']alternate["']/i.test(a)) ?? links.find((a) => !/rel=/i.test(a)) ?? links[0];
  return pick?.match(/href=["']([^"']+)["']/i)?.[1];
}

function toIso(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  let s = text(raw);
  // Barchart-style 2-digit years: "Wed, 14 Oct 26 23:30:02 +0000"
  s = s.replace(/^(\w{3},?\s+\d{1,2}\s+\w{3}\s+)(\d{2})(\s)/, "$120$2$3");
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : fallback;
}

/** Some feeds (Investing.com) emit local time without a zone, landing hours in the future: clamp to fetch time. */
export function clampFuture(iso: string, now: string): string {
  return Date.parse(iso) > Date.parse(now) + 10 * 60_000 ? now : iso;
}

/** Parse RSS 2.0 / RSS 1.0 (RDF) / Atom into FeedItems. Never throws on bad items; skips them. */
export function parseFeed(xml: string, sourceId: string, now = new Date().toISOString()): FeedItem[] {
  const blocks = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => m[2] ?? "");
  const out: FeedItem[] = [];
  for (const b of blocks) {
    const title = text(tag(b, ["title"]));
    let url = text(tag(b, ["link"])) || atomLink(b) || "";
    const guid = text(tag(b, ["guid", "id"])) || undefined;
    if (!url && guid && /^https?:/.test(guid)) url = guid;
    if (!title || !url) continue;
    const item: FeedItem = {
      sourceId,
      title,
      url: decodeEntities(url.trim()),
      publishedAt: clampFuture(toIso(tag(b, ["pubDate", "published", "updated", "dc:date"]), now), now),
      summary: text(tag(b, ["description", "summary", "content:encoded", "content"])).slice(0, 500),
    };
    if (guid) item.guid = guid;
    out.push(item);
  }
  if (!blocks.length) out.push(...parseNewsSitemap(xml, sourceId, now));
  return out;
}

/** Google News sitemap (<urlset><url><loc/><news:news><news:title/>...) — used for CNN, which retired RSS. */
export function parseNewsSitemap(xml: string, sourceId: string, now = new Date().toISOString()): FeedItem[] {
  const out: FeedItem[] = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
    const b = m[1] ?? "";
    const title = text(tag(b, ["news:title"]));
    const url = text(tag(b, ["loc"]));
    if (!title || !url) continue;
    out.push({ sourceId, title, url, publishedAt: clampFuture(toIso(tag(b, ["news:publication_date", "lastmod"]), now), now), summary: text(tag(b, ["news:keywords"])).slice(0, 300) });
  }
  return out;
}

export interface FeedState {
  etag?: string | null;
  lastModified?: string | null;
}

export interface FetchResult {
  sourceId: string;
  status: number | "error" | "timeout";
  notModified: boolean;
  items: FeedItem[];
  etag?: string | null;
  lastModified?: string | null;
  error?: string;
  ms: number;
}

export const USER_AGENT = "Mozilla/5.0 (compatible; AlphaNews/0.1; personal research; +https://github.com/HBLION0805/Alpha)";

export async function fetchFeed(src: Source, state: FeedState = {}, timeoutMs = 10_000, fetchImpl: typeof fetch = fetch): Promise<FetchResult> {
  const t0 = Date.now();
  const headers: Record<string, string> = { "user-agent": USER_AGENT, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5" };
  if (state.etag) headers["if-none-match"] = state.etag;
  if (state.lastModified) headers["if-modified-since"] = state.lastModified;
  try {
    const res = await fetchImpl(src.url, { headers, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    const base = { sourceId: src.id, status: res.status, etag: res.headers.get("etag"), lastModified: res.headers.get("last-modified") };
    if (res.status === 304) return { ...base, etag: state.etag ?? null, lastModified: state.lastModified ?? null, notModified: true, items: [], ms: Date.now() - t0 };
    if (!res.ok) return { ...base, notModified: false, items: [], error: `HTTP ${res.status}`, ms: Date.now() - t0 };
    const body = await res.text();
    const items = parseFeed(body, src.id);
    const r: FetchResult = { ...base, notModified: false, items, ms: Date.now() - t0 };
    if (!items.length) r.error = "no items parsed";
    return r;
  } catch (e) {
    const err = e as Error;
    const timeout = err.name === "TimeoutError" || err.name === "AbortError";
    return { sourceId: src.id, status: timeout ? "timeout" : "error", notModified: false, items: [], error: err.message, ms: Date.now() - t0 };
  }
}
