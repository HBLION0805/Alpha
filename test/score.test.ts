import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreCluster, rank } from "../src/score.ts";
import { clusterItems } from "../src/cluster.ts";
import { renderDigest } from "../src/digest.ts";
import { item } from "./helpers.ts";

const now = new Date("2026-10-14T19:00:00Z");

test("macro + official + multi-source outranks single-source fluff", () => {
  const cs = clusterItems([
    item("Fed holds rates steady; Powell sees inflation easing", "wsj", "right", 1, "2026-10-14T18:00:00Z"),
    item("Fed holds rates steady, Powell says inflation easing", "bbc", "left", 2, "2026-10-14T18:03:00Z"),
    item("FOMC statement: Federal Reserve holds rates steady", "fed", "us_official", 1, "2026-10-14T18:00:00Z"),
    item("Celebrity chef opens restaurant", "fox", "center", 3, "2026-10-14T18:30:00Z"),
  ]);
  const r = rank(cs, now);
  assert.match(r[0]!.headline, /Fed/);
  assert.ok(r[0]!.score >= 70, `fed score ${r[0]!.score}`);
  assert.ok(r[0]!.topics.some((t) => t.id === "fed") && r[0]!.topics.some((t) => t.id === "inflation"));
  assert.ok(r[1]!.score < 30, `fluff score ${r[1]!.score}`);
  assert.ok(renderDigest({ ranked: r, sources: [], generatedAt: now, hours: 24 }).includes("Alerts (1)"));
});

test("topics detect crypto, gold, tariffs; recency decays", () => {
  const [c] = clusterItems([item("Bitcoin and gold rally as new tariffs hit China", "x", "center", 2, "2026-10-14T18:00:00Z")]);
  const fresh = scoreCluster(c!, now);
  assert.deepEqual(["crypto", "gold", "tariffs", "china"].every((t) => fresh.topics.some((x) => x.id === t)), true);
  const old = scoreCluster(c!, new Date("2026-10-15T20:00:00Z"));
  assert.ok(old.score < fresh.score);
});
