import type { Cluster, StoredItem } from "./types.ts";
import { jaccard, overlap, tokens } from "./normalize.ts";

export interface ClusterOptions {
  windowHours: number; // item must be within this many hours of the cluster's latest item
  threshold: number; // similarity needed to join
}
export const DEFAULT_CLUSTER: ClusterOptions = { windowHours: 18, threshold: 0.34 };

function similarity(a: Set<string>, b: Set<string>): number {
  // blend: jaccard is strict, overlap handles short-vs-long headlines; require >=2 shared tokens
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  if (inter < 2) return 0;
  return 0.5 * jaccard(a, b) + 0.5 * overlap(a, b);
}

/** Greedy single-pass clustering in time order. Each item joins the most similar open cluster (max over members). */
export function clusterItems(items: StoredItem[], opts: ClusterOptions = DEFAULT_CLUSTER): Cluster[] {
  const sorted = [...items].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const clusters: Array<Cluster & { memberTokens: Set<string>[] }> = [];
  const win = opts.windowHours * 3600_000;
  for (const it of sorted) {
    const tk = tokens(it.title);
    const t = Date.parse(it.publishedAt);
    let best: (typeof clusters)[number] | undefined;
    let bestSim = 0;
    for (const c of clusters) {
      if (t - Date.parse(c.lastSeen) > win) continue;
      let sim = 0;
      for (const m of c.memberTokens) sim = Math.max(sim, similarity(tk, m));
      if (sim > bestSim) [best, bestSim] = [c, sim];
    }
    if (best && bestSim >= opts.threshold) {
      best.items.push(it);
      best.memberTokens.push(tk);
      for (const x of tk) best.tokens.add(x);
      best.lastSeen = it.publishedAt;
    } else {
      clusters.push({ id: `c${it.id}`, items: [it], tokens: new Set(tk), memberTokens: [tk], firstSeen: it.publishedAt, lastSeen: it.publishedAt });
    }
  }
  return clusters.map(({ memberTokens: _m, ...c }) => c);
}
