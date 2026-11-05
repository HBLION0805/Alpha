import type { StoredItem, Stance } from "../src/types.ts";
let n = 0;
export function item(title: string, sourceId: string, stance: Stance, tier: number, publishedAt: string, summary = ""): StoredItem {
  n++;
  return { id: n, title, sourceId, stance, tier, publishedAt, summary, url: `https://ex.com/${sourceId}/${n}`, fetchedAt: publishedAt };
}
