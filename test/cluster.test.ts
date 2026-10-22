import { test } from "node:test";
import assert from "node:assert/strict";
import { clusterItems } from "../src/cluster.ts";
import { compareNarratives } from "../src/narrative.ts";
import { item } from "./helpers.ts";

test("same story from different outlets clusters; unrelated stays apart; time window respected", () => {
  const items = [
    item("Fed holds interest rates steady as Powell signals patience", "wsj", "right", 1, "2026-10-14T18:00:00Z"),
    item("Powell: Fed holds rates steady, patience on cuts", "cnbc", "center", 2, "2026-10-14T18:05:00Z"),
    item("Federal Reserve holds rates steady", "fed", "us_official", 1, "2026-10-14T18:00:30Z"),
    item("Apple unveils new iPhone lineup", "bbc", "left", 2, "2026-10-14T18:10:00Z"),
    item("Fed holds rates steady again", "bbc", "left", 2, "2026-10-16T18:00:00Z"),
  ];
  const cs = clusterItems(items);
  const fed = cs.find((c) => c.items.some((i) => i.sourceId === "wsj"))!;
  assert.deepEqual(fed.items.map((i) => i.sourceId).sort(), ["cnbc", "fed", "wsj"]);
  assert.equal(cs.length, 3);
  const n = compareNarratives(fed);
  assert.equal(n.crossStance, true);
  assert.ok(n.missing.includes("left"));
});
