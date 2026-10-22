import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/store.ts";
import { clusterItems } from "../src/cluster.ts";
import { rank } from "../src/score.ts";
import { selectNewAlerts, toAlert, renderAlertsMarkdown } from "../src/alerts.ts";

test("alerts fire once per event, re-fire only on escalation", () => {
  const s = new Store(":memory:");
  const now = new Date("2026-10-14T19:00:00Z");
  const add = (src: string, stance: "left" | "right" | "center" | "us_official", tier: 1 | 2 | 3, title: string, t: string) =>
    s.insert([{ sourceId: src, title, url: `https://${src}.test/${encodeURIComponent(title)}`, publishedAt: t, summary: "" }], { stance, tier });
  add("wsj", "right", 1, "Fed holds rates steady; Powell sees inflation easing", "2026-10-14T18:00:00Z");
  add("bbc", "left", 2, "Fed holds rates steady, Powell says inflation easing", "2026-10-14T18:03:00Z");
  const run = () => {
    const ranked = rank(clusterItems(s.since("2026-10-14T00:00:00Z")), now);
    const picked = selectNewAlerts(ranked, s, 60);
    picked.forEach(({ r }) => s.recordAlert(r.score, r.headline, r.cluster.items.map((i) => i.id), {}, now));
    return picked;
  };
  const first = run();
  assert.equal(first.length, 1);
  assert.match(renderAlertsMarkdown([toAlert(first[0]!.r, false, [])], now), /Fed holds rates/);
  assert.equal(run().length, 0, "no repeat");
  add("fed", "us_official", 1, "Federal Reserve holds rates steady", "2026-10-14T18:01:00Z");
  add("cnbc", "center", 2, "Powell: Fed holds rates steady as inflation eases", "2026-10-14T18:05:00Z");
  const third = run();
  assert.equal(third.length, 1);
  assert.equal(third[0]!.escalation, true);
  s.close();
});
