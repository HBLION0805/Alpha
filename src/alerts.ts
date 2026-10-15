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

/** Synthetic alarm sources: premarket (src/macro/premarket.ts: ALARM 85 / WARNING 70) and volume (src/macro/volume.ts: 60). */
export const ALARM_SOURCES = new Set(["premarket-alarm", "volume-alarm"]);
const x_score = (i: { sourceId: string; title: string }) => (i.sourceId === "volume-alarm" ? 60 : / ALARM /.test(i.title) ? 85 : 70);
/** Premarket alarms (src/macro/premarket.ts) are stored as items from source "premarket-alarm". They bypass news clustering and get a fixed score, deduped like any alert. */
export function premarketAlarmAlerts(items: Array<{ id: number; sourceId: string; title: string; summary: string; url: string; publishedAt: string }>, store: Pick<Store, "priorAlertScore">, threshold: number): Array<{ alert: Alert; itemIds: number[] }> {
  const out: Array<{ alert: Alert; itemIds: number[] }> = [];
  for (const i of items.filter((x) => ALARM_SOURCES.has(x.sourceId))) {
    const score = x_score(i);
    if (score < threshold || store.priorAlertScore([i.id]) !== null) continue;
    out.push({ itemIds: [i.id], alert: { score, headline: i.title, topics: ["premarket"], watch: [], sources: ["Alpha premarket"], stances: [], firstSeen: i.publishedAt, lastSeen: i.publishedAt, escalation: false, links: [{ source: "Alpha premarket", title: i.summary, url: i.url }] } });
    if (i.sourceId === "volume-alarm") { out.at(-1)!.alert.sources = ["Alpha volume"]; out.at(-1)!.alert.topics = ["volume"]; }
  }
  return out;
}
