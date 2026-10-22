/** Regressions from real feed data captured 2026-10-14 (CPI day). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clusterItems } from "../src/cluster.ts";
import { rank } from "../src/score.ts";
import { isBoilerplate } from "../src/noise.ts";
import type { StoredItem } from "../src/types.ts";

const items = JSON.parse(readFileSync(new URL("./fixtures/real-2026-10-14.json", import.meta.url), "utf8")) as StoredItem[];
const now = new Date("2026-10-15T01:00:00Z");
const clusters = clusterItems(items);
const find = (re: RegExp) => clusters.find((c) => c.items.some((i) => re.test(i.title)));

test("CPI release reports from Fox, CNBC, BBC, Breitbart land in ONE cluster", () => {
  const c = find(/Consumer inflation rose faster than expected/)!;
  for (const re of [/Consumer prices rose 3.7% annually/, /US inflation rises more than expected/, /^Consumer Prices Rise Sharply$/, /inflation breakdown for September/])
    assert.ok(c.items.some((i) => re.test(i.title)), `missing ${re}`);
  assert.ok(new Set(c.items.map((i) => i.sourceId)).size >= 4);
});

test("Epoch Times Taiwan/Alaska gas story is not merged into the CPI cluster", () => {
  const cpi = find(/Consumer inflation rose faster than expected/)!;
  assert.ok(!cpi.items.some((i) => /Taiwan Agrees/.test(i.title)));
});

test("CPI cluster is not tagged Geopolitics/war; it is tagged inflation + top alert", () => {
  const r = rank(clusters, now);
  const cpi = r.find((x) => x.cluster.items.some((i) => /Consumer inflation rose faster/.test(i.title)))!;
  assert.ok(!cpi.topics.some((t) => t.id === "geopolitics"), cpi.topics.map((t) => t.id).join());
  assert.ok(cpi.topics.some((t) => t.id === "inflation"));
  assert.equal(r[0], cpi);
});

test("templated Benzinga analyst notes do not form a cluster; boilerplate is dropped from ranking", () => {
  for (const c of clusters) {
    const pt = c.items.filter((i) => /Maintains .* Price Target/.test(i.title));
    assert.ok(pt.length <= 1, "analyst-note cluster: " + pt.map((i) => i.title).join(" | "));
  }
  assert.ok(isBoilerplate("$100 Invested In Illumina 15 Years Ago Would Be Worth This Much Today"));
  assert.ok(!rank(clusters, now).some((r) => r.cluster.items.some((i) => /Invested In/.test(i.title))));
});

test("unrelated inflation story (Philippines) stays out of US CPI cluster", () => {
  const cpi = find(/Consumer inflation rose faster than expected/)!;
  assert.ok(!cpi.items.some((i) => /Philippine/.test(i.title)));
});
