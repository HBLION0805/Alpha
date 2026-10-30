/** Reads data/in/x-trump.json (written by the routine from the x MCP: get_users_posts id 25073877) into FeedItems. */
import { readFileSync, existsSync, statSync } from "node:fs";
import { parseInput, XPostsFileSchema } from "../adapters/schemas.ts";
import { unwrapJson } from "../options/robinhood.ts";
import type { FeedItem } from "../types.ts";

export function parseXPosts(json: unknown, sourceId = "trump_x"): FeedItem[] {
  const f = parseInput(XPostsFileSchema, json, "x-trump.json");
  return f.data.map((p) => ({ sourceId, title: p.text, summary: p.text, url: p.url ?? `https://x.com/realDonaldTrump/status/${p.id}`, publishedAt: new Date(p.created_at).toISOString(), guid: `x:${p.id}` }));
}

export function readXFile(path: string, sourceId = "trump_x"): { items: FeedItem[]; error?: string; ageMin?: number } {
  if (!existsSync(path)) return { items: [], error: `${path} missing (routine has not run the X fetch)` };
  try {
    const ageMin = Math.round((Date.now() - statSync(path).mtimeMs) / 60000);
    return { items: parseXPosts(unwrapJson(readFileSync(path, "utf8")), sourceId), ageMin };
  } catch (e) { return { items: [], error: (e as Error).message }; }
}
