/** Emit only NEW (or escalated) high-score clusters since the last run. State lives in SQLite (alerts tables). */
import { writeFileSync, renameSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { loadSources } from "../sources.ts";
import { Store } from "../store.ts";
import { clusterItems } from "../cluster.ts";
import { rank } from "../score.ts";
import { trumpAlerts, TRUMP_SOURCES } from "../trump.ts";
import { loadFollowups, loadFollowupInputs, followupLines } from "../macro/eventFollowup.ts";
import { renderAlertsMarkdown, selectNewAlerts, toAlert, premarketAlarmAlerts, ALARM_SOURCES } from "../alerts.ts";

const { values } = parseArgs({
  options: {
    threshold: { type: "string", default: process.env.ALPHA_ALERT_THRESHOLD ?? "60" },
    hours: { type: "string", default: "12" },
    format: { type: "string", default: "md" }, // md | json
    out: { type: "string" },
    jsonl: { type: "string" }, // append each alert as one JSON line
    "dry-run": { type: "boolean" },
  },
});
const now = new Date();
const store = new Store(process.env.ALPHA_DB ?? "data/alpha-news.sqlite");
const sources = loadSources();
// cluster over a wider window than we alert on, so late follow-ups attach to earlier items
const hours = Number(values.hours);
const windowItems = store.since(new Date(now.getTime() - (hours + 24) * 3600_000).toISOString());
const ranked = rank(clusterItems(windowItems.filter((i) => !ALARM_SOURCES.has(i.sourceId) && !TRUMP_SOURCES.has(i.sourceId))), now)
  .filter((r) => Date.parse(r.cluster.lastSeen) >= now.getTime() - hours * 3600_000);
const picked = selectNewAlerts(ranked, store, Number(values.threshold));
const alerts = picked.map(({ r, escalation }) => toAlert(r, escalation, sources));
if (!values["dry-run"]) picked.forEach(({ r }, i) => store.recordAlert(r.score, r.headline, r.cluster.items.map((x) => x.id), alerts[i], now));
const pm = premarketAlarmAlerts(windowItems.filter((i) => Date.parse(i.publishedAt) >= now.getTime() - hours * 3600_000), store, Number(values.threshold));
if (!values["dry-run"]) for (const a of pm) store.recordAlert(a.alert.score, a.alert.headline, a.itemIds, a.alert, now);
alerts.unshift(...pm.map((a) => a.alert));
// Trump posts: own scorer, no clustering/confirmation; 48h grouping window so a Truth post alerted earlier dedupes its later X copy
const tr = trumpAlerts(store.since(new Date(now.getTime() - 48 * 3600_000).toISOString()), store, Number(values.threshold), now.getTime() - hours * 3600_000);
if (!values["dry-run"]) for (const a of tr) store.recordAlert(a.alert.score, a.alert.headline, a.itemIds, a.alert, now);
alerts.unshift(...tr.map((a) => a.alert));
store.close();

// 事件跟进 (knowledge/events/event-followups.json): display-only block appended to the markdown output; not an alert, never recorded
const fuLines = values.format === "json" ? [] : followupLines(loadFollowups().followups, loadFollowupInputs(), now);
const body = values.format === "json" ? JSON.stringify({ generatedAt: now.toISOString(), count: alerts.length, alerts }, null, 2) + "\n" : renderAlertsMarkdown(alerts, now) + (fuLines.length ? `\n${fuLines.join("\n")}\n` : "");
if (values.jsonl && alerts.length) {
  mkdirSync(dirname(values.jsonl), { recursive: true });
  appendFileSync(values.jsonl, alerts.map((a) => JSON.stringify({ at: now.toISOString(), ...a })).join("\n") + "\n");
}
if (values.out) {
  mkdirSync(dirname(values.out), { recursive: true });
  writeFileSync(values.out + ".tmp", body);
  renameSync(values.out + ".tmp", values.out);
}
if (body) process.stdout.write(body);
console.error(`[alerts] ${alerts.length} new (threshold ${values.threshold}, ${ranked.length} clusters in last ${hours}h)`);
