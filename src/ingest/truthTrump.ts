/**
 * Trump on Truth Social → data/in/truth-trump.json (same normalized shape as data/in/x-trump.json, plus source "truth").
 * Read-only, no login. Order: the official public API (Mastodon-compatible; account 107780257626128497) → the
 * trumpstruth.org RSS mirror. Verified from the box 2026-10-19 10:30 ET: the official API (statuses AND
 * /accounts/lookup) returns a Cloudflare "Just a moment…" 403 to curl; the mirror returns 200 with 100 items.
 * Never posts, likes or replies anywhere.
 */
import { execFile } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { htmlText } from "./rss.ts";
import type { FeedItem } from "../types.ts";

export const TRUTH_ACCOUNT_ID = "107780257626128497";
export const TRUTH_API = `https://truthsocial.com/api/v1/accounts/${TRUTH_ACCOUNT_ID}/statuses`;
export const TRUTH_MIRROR = "https://www.trumpstruth.org/feed";
export const TRUTH_FILE = "data/in/truth-trump.json";

/** one post, normalized (both platforms) */
export interface TrumpPost { id: string; text: string; created_at: string; url: string; source: "truth" | "x"; repost: boolean; postType?: string; mirrorUrl?: string }
export interface TruthFile { source: "truth"; fetchedAt: string; via: "official" | "mirror" | "none"; errors: string[]; data: TrumpPost[] }

const tag = (b: string, n: string) => b.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, "i"))?.[1];
const cdata = (s?: string) => (s ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
/** strip the mirror's "RT: url" prefix, media links and the quoted block's attribution noise */
export function cleanText(html: string): string {
  return htmlText(html.replace(/<a [^>]*>\s*View (image|video)\s*<\/a>/gi, " ")).replace(/^RT:\s*https?:\/\/\S+\s*/, "").replace(/^RT @ ?\w+:?\s*/, "").replace(/^Quoted Donald J\. Trump\s*/, "").replace(/\s+/g, " ").trim();
}

/** trumpstruth.org RSS: each item carries truth:originalUrl / originalId and archive:postType (original | quote | repost). */
export function parseMirrorFeed(xml: string): TrumpPost[] {
  const out: TrumpPost[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1]!, id = cdata(tag(b, "truth:originalId")), url = cdata(tag(b, "truth:originalUrl")), mirror = cdata(tag(b, "link"));
    const pub = Date.parse(cdata(tag(b, "pubDate"))); if (!id || !Number.isFinite(pub)) continue;
    if (cdata(tag(b, "archive:removed")) === "true") continue;
    const postType = cdata(tag(b, "archive:postType")) || "original", desc = cleanText(cdata(tag(b, "description")));
    const title = cdata(tag(b, "title")), media = /^(Image|Video|Quote) post from /i.test(title);
    out.push({ id, text: desc || (media ? title : htmlText(title)), created_at: new Date(pub).toISOString(), url: url || `https://truthsocial.com/@realDonaldTrump/${id}`, source: "truth", repost: postType === "repost", postType, mirrorUrl: mirror || undefined });
  }
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
interface Status { id: string; created_at: string; url?: string; content?: string; reblog?: Status | null; media_attachments?: unknown[] }
/** official API (Mastodon statuses) */
export function parseOfficialStatuses(json: unknown): TrumpPost[] {
  if (!Array.isArray(json)) throw new Error("truthsocial: expected an array of statuses");
  return (json as Status[]).map((p) => {
    const text = cleanText((p.reblog?.content ?? p.content ?? "").replace(/<span class="quote-inline">[\s\S]*?<\/span>/g, " "));
    return { id: p.id, text: text || `${p.media_attachments?.length ? "Image" : "Media"} post from Truth Social`, created_at: new Date(p.created_at).toISOString(), url: p.url ?? `https://truthsocial.com/@realDonaldTrump/${p.id}`, source: "truth" as const, repost: !!p.reblog, postType: p.reblog ? "repost" : "original" };
  });
}

export type Fetcher = (url: string, timeoutMs: number) => Promise<{ status: number; body: string }>;
/** curl (Cloudflare treats Node fetch worse than curl); normal UA, hard timeout */
export const curlFetch: Fetcher = (url, timeoutMs) => new Promise((res, rej) => execFile("curl", ["-s", "-L", "-A", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36", "-H", "Accept: application/json, application/rss+xml, */*", "--max-time", String(Math.ceil(timeoutMs / 1000)), "-w", "\n%{http_code}", url], { maxBuffer: 16e6 }, (err, out) => {
  if (err) return rej(err); const i = out.lastIndexOf("\n"); res({ status: Number(out.slice(i + 1)), body: out.slice(0, i) });
}));

/** official API first, mirror fallback; never throws — failures land in `errors` with via "none" */
export async function fetchTruth(opts: { fetcher?: Fetcher; timeoutMs?: number; now?: Date } = {}): Promise<TruthFile> {
  const f = opts.fetcher ?? curlFetch, t = opts.timeoutMs ?? 15_000, errors: string[] = [], fetchedAt = (opts.now ?? new Date()).toISOString();
  try {
    const r = await f(TRUTH_API, t);
    if (r.status === 200) { const data = parseOfficialStatuses(JSON.parse(r.body)); if (data.length) return { source: "truth", fetchedAt, via: "official", errors, data }; errors.push("official: 0 statuses"); }
    else errors.push(`official: HTTP ${r.status}${/Just a moment/.test(r.body) ? " (Cloudflare challenge)" : ""}`);
  } catch (e) { errors.push(`official: ${(e as Error).message.split("\n")[0]}`); }
  try {
    const r = await f(TRUTH_MIRROR, t);
    if (r.status === 200) { const data = parseMirrorFeed(r.body); if (data.length) return { source: "truth", fetchedAt, via: "mirror", errors, data }; errors.push("mirror: 0 items"); }
    else errors.push(`mirror: HTTP ${r.status}`);
  } catch (e) { errors.push(`mirror: ${(e as Error).message.split("\n")[0]}`); }
  return { source: "truth", fetchedAt, via: "none", errors, data: [] };
}

/** FeedItems for the store (sourceId trump_truth). Reposts keep the "RT: url" summary prefix that trump.ts isRepost reads. */
export function truthItems(f: Pick<TruthFile, "data">, sourceId = "trump_truth"): FeedItem[] {
  return f.data.map((p) => ({ sourceId, title: p.text.slice(0, 300), summary: (p.repost ? `RT: ${p.url} ` : "") + p.text.slice(0, 4000), url: p.url, publishedAt: p.created_at, guid: `truth:${p.id}` }));
}

export function readTruthFile(path: string, sourceId = "trump_truth"): { items: FeedItem[]; error?: string; ageMin?: number; via?: string } {
  if (!existsSync(path)) return { items: [], error: `${path} missing (npm run trump has not run)` };
  try {
    const f = JSON.parse(readFileSync(path, "utf8")) as TruthFile;
    if (!Array.isArray(f.data)) throw new Error("truth-trump.json: no data array");
    return { items: truthItems(f, sourceId), ageMin: Math.round((Date.now() - statSync(path).mtimeMs) / 60000), via: f.via };
  } catch (e) { return { items: [], error: (e as Error).message }; }
}
