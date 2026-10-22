/**
 * Official Truth Social public API (no login). Verified from the box on 2026-10-15: HTTP 200 JSON, 20 newest statuses.
 * GET https://truthsocial.com/api/v1/accounts/107780257626128497/statuses
 * The trumpstruth.org mirror (trump_truth) stays as a fallback. Cross-source dedupe is trump.ts postKey (same text → one alert).
 */
import type { FeedItem } from "../types.ts";
import type { FetchResult } from "./rss.ts";
import { htmlText } from "./rss.ts";
import { execFile } from "node:child_process";
/** Node fetch gets HTTP 403 from Cloudflare (verified 2026-10-15) while plain curl gets 200, so the client is curl. */
function curlJson(url: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  return new Promise((res, rej) => execFile("curl", ["-s", "-A", "Mozilla/5.0", "--max-time", String(Math.ceil(timeoutMs / 1000)), "-w", "\n%{http_code}", url], { maxBuffer: 8e6 }, (err, out) => {
    if (err) return rej(err); const i = out.lastIndexOf("\n"); res({ status: Number(out.slice(i + 1)), body: out.slice(0, i) });
  }));
}
interface Status { id: string; created_at: string; url?: string; content?: string; reblog?: Status | null; media_attachments?: unknown[] }
export function parseTruthStatuses(json: unknown, sourceId = "trump_truth_official"): FeedItem[] {
  if (!Array.isArray(json)) throw new Error("truthsocial: expected an array of statuses");
  return (json as Status[]).map((p) => {
    const body = htmlText((p.reblog?.content ?? p.content ?? "").replace(/<span class="quote-inline">[\s\S]*?<\/span>/g, " "));
    const t = body || `${p.media_attachments?.length ? "Image" : "Media"} post from Truth Social`;
    return { sourceId, title: t.slice(0, 300), summary: t.slice(0, 4000), url: p.url ?? `https://truthsocial.com/@realDonaldTrump/${p.id}`, publishedAt: new Date(p.created_at).toISOString(), guid: `truth:${p.id}` };
  });
}
export async function fetchTruthApi(sourceId: string, url: string, timeoutMs = 15000): Promise<FetchResult> {
  const t = Date.now();
  try {
    let status: number, body = "";
    try { const c = await curlJson(url, timeoutMs); status = c.status; body = c.body; }
    catch { const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0", accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) }); status = r.status; body = await r.text(); }
    if (status !== 200) return { sourceId, status, notModified: false, items: [], ms: Date.now() - t, error: `HTTP ${status} (blocked? mirror trump_truth is the fallback)` };
    return { sourceId, status, notModified: false, items: parseTruthStatuses(JSON.parse(body), sourceId), ms: Date.now() - t };
  } catch (e) { return { sourceId, status: "error", notModified: false, items: [], ms: Date.now() - t, error: (e as Error).message }; }
}
