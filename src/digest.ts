import { CASH_NOTE } from "./options/discipline.ts";
import { ACTORS } from "./macro/risk.ts";
import type { Source } from "./types.ts";
import type { ScoredCluster } from "./score.ts";
import { compareNarratives, STANCE_LABEL } from "./narrative.ts";
import type { CalendarEvent } from "./ingest/officialCalendar.ts";

export function et(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) + " ET";
}

export interface DigestInput {
  ranked: ScoredCluster[];
  sources: Source[];
  generatedAt: Date;
  hours: number;
  top?: number;
  alertThreshold?: number;
  calendar?: CalendarEvent[];
  feedReport?: Array<Record<string, unknown>>;
  /** pre-rendered macro section (from data/out/macro-latest.json) */
  macroSection?: string;
}

export function renderDigest(d: DigestInput): string {
  const top = d.top ?? 15;
  const alertAt = d.alertThreshold ?? 60;
  const name = new Map(d.sources.map((s) => [s.id, s.name]));
  const L: string[] = [];
  const totalItems = d.ranked.reduce((n, r) => n + r.cluster.items.length, 0);
  L.push(`# Alpha news digest — ${et(d.generatedAt.toISOString())}`, "");
  L.push(`Window: last ${d.hours}h · ${totalItems} items · ${d.ranked.length} event clusters · alert threshold ${alertAt}`, "");

  const alerts = d.ranked.filter((r) => r.score >= alertAt);
  L.push(`## 🚨 Alerts (${alerts.length})`, "");
  if (!alerts.length) L.push("_None above threshold._", "");
  for (const r of alerts.slice(0, 10)) L.push(`- **${r.score}** ${r.headline} — ${r.topics.map((t) => t.label).join(", ") || "general"} · ${r.sources.length} sources`);
  L.push("");

  L.push(`> ${CASH_NOTE}`, "");

  if (d.macroSection) L.push("## 🌐 宏观 / Macro", "", d.macroSection);

  if (d.calendar?.length) {
    L.push("## 📅 Upcoming official events", "");
    for (const e of d.calendar) L.push(`- ${e.date} ${e.timeEt} ET — ${e.title}`);
    L.push("");
  }

  L.push(`## Top ${Math.min(top, d.ranked.length)} events`, "");
  d.ranked.slice(0, top).forEach((r, i) => {
    const c = r.cluster;
    L.push(`### ${i + 1}. ${r.headline}`);
    L.push(`**Score ${r.score}** (${Object.entries(r.breakdown).map(([k, v]) => `${k} ${v}`).join(", ")}) · first ${et(c.firstSeen)} · ${c.items.length} reports / ${r.sources.length} sources`);
    if (r.topics.length) L.push(`Topics: ${r.topics.map((t) => t.label).join(", ")} · Watch: ${r.assets.join(", ")}`);
    const n = compareNarratives(c);
    L.push("");
    for (const v of n.views) {
      const hs = v.headlines.slice(0, 3).map((h) => `[${name.get(h.sourceId) ?? h.sourceId}](${h.url}): ${h.title}`);
      L.push(`- **${STANCE_LABEL[v.stance]}** — ${hs.join(" · ")}${v.distinctive.length ? ` _(distinct framing: ${v.distinctive.join(", ")})_` : ""}`);
    }
    if (n.crossStance) L.push(`- _Not covered by: ${n.missing.map((s) => STANCE_LABEL[s]).join(", ") || "—"}_`);
    if (i < 3) L.push(`- _参与者 / Actors: 谁在制定规则？谁在承担代价？谁拥有选择？各方的激励与恐惧？（${ACTORS.source}）_`);
    L.push("");
  });

  if (d.feedReport?.length) {
    L.push("## Feed health", "", "| source | status | items | ms | error |", "|---|---|---|---|---|");
    for (const f of d.feedReport) L.push(`| ${String(f.source_id)} | ${String(f.last_status)} | ${String(f.last_count)} | ${String(f.last_ms)} | ${String(f.last_error ?? "")} |`);
    L.push("");
  }
  return L.join("\n");
}
