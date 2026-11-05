/** P2 alert recall: 2026-10-14 Hormuz ship sinkings + Aramco attacks (4+ outlets) never alerted under the old scorer. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clusterItems } from "../src/cluster.ts";
import { rank, TOPICS } from "../src/score.ts";
import type { StoredItem } from "../src/types.ts";

const j = (f: string) => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8"));
const golden = j("cluster-golden-2026-10-14.json") as { items: StoredItem[] };
const hormuz = j("hormuz-2026-10-14.json") as StoredItem[];
const ids = new Set(golden.items.map((i) => i.id));
const ranked = rank(clusterItems([...golden.items, ...hormuz.filter((x) => !ids.has(x.id))]), new Date("2026-10-14T21:00:00Z"));
const find = (re: RegExp) => ranked.find((r) => r.cluster.items.some((i) => re.test(i.title)))!;

test("Hormuz/Aramco headlines land in ONE cluster that scores ≥60", () => {
  const c = find(/Container ship sinks in Strait of Hormuz/);
  for (const re of [/hit by projectile sinks in Strait of Hormuz/, /Attacks on Ships in Strait of Hormuz/, /Saudi Aramco facilities attacked/, /ships sink in Hormuz/])
    assert.ok(c.cluster.items.some((i) => re.test(i.title)), `missing ${re}`);
  assert.ok(c.score >= 60, `score ${c.score}`);
  assert.ok(c.topics.some((t) => t.id === "shipping") && c.topics.some((t) => t.id === "geopolitics"));
});

test("precision: unrelated 'ship' stories stay out and stay low", () => {
  const wreck = find(/oldest shipwreck/);
  assert.ok(wreck.score < 60 && !wreck.topics.some((t) => t.id === "shipping"));
  assert.ok(!find(/Romania’s waters/).cluster.items.some((i) => /Hormuz/.test(i.title)));
  const geo = TOPICS.find((t) => t.id === "geopolitics")!.pattern, ship = TOPICS.find((t) => t.id === "shipping")!.pattern;
  for (const t of ["Iran steps up attacks", "US weighs new strikes", "Drone hits refinery", "Tanker seized off Oman"]) assert.ok(geo.test(t) || ship.test(t), t);
  for (const t of ["Nvidia stock sinks 3%", "Shipwreck found off Turkey", "Apple ships new iPhone"]) assert.ok(!geo.test(t) && !ship.test(t), t);
  // alert count on the golden day stays small: CPI x2, Hormuz, one borderline
  assert.ok(ranked.filter((r) => r.score >= 60).length <= 5);
});
