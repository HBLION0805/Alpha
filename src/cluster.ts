import type { Cluster, StoredItem } from "./types.ts";
import { mainClause, tokens } from "./normalize.ts";
import { isTemplated } from "./noise.ts";

export interface ClusterOptions {
  windowHours: number; // item must be within this many hours of the cluster's latest item
  threshold: number; // weighted similarity needed to join
  sameSourceThreshold: number; // stricter bar when the match is only with the same outlet (kills templated wires)
  mergeThreshold: number; // second pass: merge whole clusters
}
export const DEFAULT_CLUSTER: ClusterOptions = { windowHours: 18, threshold: 0.4, sameSourceThreshold: 0.75, mergeThreshold: 0.45 };

const isNumber = (t: string) => /\d/.test(t);

/** IDF over the batch: template words ("maintains", "price", "target") get low weight. */
export function idfTable(docs: Set<string>[]): (t: string) => number {
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d) df.set(t, (df.get(t) ?? 0) + 1);
  const n = Math.max(docs.length, 1);
  return (t) => {
    const w = Math.log(1 + n / (df.get(t) ?? 1));
    return /%$/.test(t) ? w * 1.5 : isNumber(t) ? w * 0.5 : w; // percentages anchor events; bare numbers/years are noisy
  };
}

/** Scheduled macro releases: two reports sharing one of these keys on the same day are very likely the same event. */
export const EVENT_KEYS = new Set(["cpi", "inflation", "ppi", "pce", "payrolls", "nonfarm", "gdp", "fed", "jobless", "unemployment", "retail"]);
const EVENT_ALIAS: Record<string, string> = { inflation: "cpi", nonfarm: "payrolls", unemployment: "payrolls" };
export const EVENT_BONUS = 0.2;

function eventKeys(a: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const t of a) if (EVENT_KEYS.has(t)) out.add(EVENT_ALIAS[t] ?? t);
  return out;
}

/** Weighted blend of overlap and jaccard; requires >=2 shared tokens or one shared number + one shared word. */
export function weightedSim(a: Set<string>, b: Set<string>, idf: (t: string) => number): number {
  let inter = 0, wa = 0, wb = 0, shared = 0;
  for (const t of a) wa += idf(t);
  for (const t of b) {
    const w = idf(t);
    wb += w;
    if (a.has(t)) { inter += w; shared++; }
  }
  if (!wa || !wb) return 0;
  if (shared < 2) {
    // allow a single shared token only when both carry the same macro event key plus another shared anchor via aliasing
    const ka = eventKeys(a), kb = eventKeys(b);
    if (!(shared === 1 && [...ka].some((k) => kb.has(k)) && ka.size + kb.size >= 3)) return 0;
  }
  const overlap = inter / Math.min(wa, wb);
  const jac = inter / (wa + wb - inter);
  let sim = 0.6 * overlap + 0.4 * jac;
  const ka = eventKeys(a);
  for (const k of eventKeys(b)) if (ka.has(k)) { sim += EVENT_BONUS; break; }
  return sim;
}

/** Seed tokens plus tokens shared by >=2 members: stops the union from snowballing. */
function centroid(c: { members: Array<{ tk: Set<string> }> }): Set<string> {
  if (c.members.length < 3) return c.members[0]!.tk;
  const n = new Map<string, number>();
  for (const m of c.members) for (const t of m.tk) n.set(t, (n.get(t) ?? 0) + 1);
  return new Set([...c.members[0]!.tk, ...[...n].filter(([, k]) => k >= 2).map(([t]) => t)]);
}

type Work = Cluster & { members: Array<{ src: string; tk: Set<string> }> };

export function clusterTokens(it: Pick<StoredItem, "title">): Set<string> {
  return tokens(mainClause(it.title));
}

/** Greedy time-ordered clustering, then an agglomerative merge pass over cluster token unions. */
export function clusterItems(items: StoredItem[], opts: ClusterOptions = DEFAULT_CLUSTER): Cluster[] {
  const sorted = [...items].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.id - b.id);
  const tks = sorted.map(clusterTokens);
  const idf = idfTable(tks);
  const win = opts.windowHours * 3600_000;
  const clusters: Work[] = [];
  sorted.forEach((it, idx) => {
    const tk = tks[idx]!;
    const t = Date.parse(it.publishedAt);
    let best: Work | undefined;
    let bestSim = 0;
    const templ = isTemplated(it.title);
    for (const c of templ ? [] : clusters) {
      if (t - Date.parse(c.lastSeen) > win) continue;
      let sim = 0;
      for (const m of c.members) {
        const s = weightedSim(tk, m.tk, idf);
        const need = m.src === it.sourceId ? opts.sameSourceThreshold : opts.threshold;
        if (s >= need) sim = Math.max(sim, s);
      }
      if (sim && c.members.length >= 3 && weightedSim(tk, centroid(c), idf) < opts.threshold * 0.6) sim = 0;
      if (sim > bestSim) [best, bestSim] = [c, sim];
    }
    if (best) {
      best.items.push(it);
      best.members.push({ src: it.sourceId, tk });
      for (const x of tk) best.tokens.add(x);
      if (it.publishedAt > best.lastSeen) best.lastSeen = it.publishedAt;
    } else {
      clusters.push({ id: `c${it.id}`, items: [it], tokens: new Set(tk), members: [{ src: it.sourceId, tk }], firstSeen: it.publishedAt, lastSeen: it.publishedAt });
    }
  });

  // merge pass: two multi-source clusters about the same event (e.g. CPI split by phrasing)
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const a = clusters[i]!, b = clusters[j]!;
        if (Math.abs(Date.parse(a.firstSeen) - Date.parse(b.firstSeen)) > win) continue;
        const srcs = new Set([...a.members, ...b.members].map((m) => m.src));
        if (srcs.size < 2) continue;
        if (weightedSim(centroid(a), centroid(b), idf) < opts.mergeThreshold) continue;
        // also require one direct member-to-member link above the join threshold minus slack
        let link = 0;
        for (const x of a.members) for (const y of b.members) if (x.src !== y.src) link = Math.max(link, weightedSim(x.tk, y.tk, idf));
        if (link < opts.threshold) continue;
        a.items.push(...b.items);
        a.members.push(...b.members);
        for (const x of b.tokens) a.tokens.add(x);
        if (b.firstSeen < a.firstSeen) a.firstSeen = b.firstSeen;
        if (b.lastSeen > a.lastSeen) a.lastSeen = b.lastSeen;
        clusters.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }
  return clusters.map(({ members: _m, ...c }) => ({ ...c, items: c.items.sort((x, y) => x.publishedAt.localeCompare(y.publishedAt)) }));
}
