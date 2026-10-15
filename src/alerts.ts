import type { Store } from "./store.ts";
import type { ScoredCluster } from "./score.ts";
import type { Source } from "./types.ts";
import { et } from "./digest.ts";

export interface Alert {
  score: number;
  headline: string;
  topics: string[];
  watch: string[];
  sources: string[];
  stances: string[];
  firstSeen: string;
  lastSeen: string;
  escalation: boolean; // already alerted before, score rose by >= ESCALATION
  links: Array<{ source: string; title: string; url: string }>;
}

export const ESCALATION = 15;

/** Pick clusters at/above threshold that were never alerted, or that escalated since their last alert. */
export function selectNewAlerts(ranked: ScoredCluster[], store: Pick<Store, "priorAlertScore">, threshold: number): Array<{ r: ScoredCluster; escalation: boolean }> {
  const out: Array<{ r: ScoredCluster; escalation: boolean }> = [];
  for (const r of ranked) {
    if (r.score < threshold) continue;
    const prior = store.priorAlertScore(r.cluster.items.map((i) => i.id));
    if (prior === null) out.push({ r, escalation: false });
    else if (r.score >= prior + ESCALATION) out.push({ r, escalation: true });
  }
  return out;
}

export function toAlert(r: ScoredCluster, escalation: boolean, sources: Source[]): Alert {
  const name = new Map(sources.map((s) => [s.id, s.name]));
  return {
    score: r.score,
    headline: r.headline,
    topics: r.topics.map((t) => t.label),
    watch: r.assets,
    sources: r.sources.map((s) => name.get(s) ?? s),
    stances: r.stances,
    firstSeen: r.cluster.firstSeen,
    lastSeen: r.cluster.lastSeen,
    escalation,
    links: r.cluster.items.slice(0, 4).map((i) => ({ source: name.get(i.sourceId) ?? i.sourceId, title: i.title, url: i.url })),
  };
}

export function renderAlertsMarkdown(alerts: Alert[], now: Date): string {
  if (!alerts.length) return "";
  const L = [`## 🚨 Alpha alerts — ${et(now.toISOString())}`, ""];
  for (const a of alerts) {
    L.push(`- **${a.score}**${a.escalation ? " ⬆️" : ""} ${a.headline}`);
    L.push(`  ${a.topics.join(", ") || "general"} · watch ${a.watch.join(", ") || "—"} · ${a.sources.length} src (${a.sources.slice(0, 4).join(", ")}) · first ${et(a.firstSeen)}`);
    if (a.links[0]) L.push(`  ${a.links[0].url}`);
  }
  return L.join("\n") + "\n";
}
