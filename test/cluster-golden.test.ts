/** Regression gate for clustering changes: 730 real headlines (36h to 2026-10-14) and the multi-item clusters the pre-natural clusterer produced. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clusterItems } from "../src/cluster.ts";
import type { StoredItem } from "../src/types.ts";

const fx = JSON.parse(readFileSync(new URL("./fixtures/cluster-golden-2026-10-14.json", import.meta.url), "utf8")) as { items: StoredItem[]; golden: number[][] };
const pairs = (cs: number[][]) => new Set(cs.flatMap((c) => c.flatMap((a, i) => c.slice(i + 1).map((b) => `${a}-${b}`))));

export function agreement(): { precision: number; recall: number; got: number[][] } {
  const got = clusterItems(fx.items).filter((c) => c.items.length > 1).map((c) => c.items.map((i) => i.id).sort((a, b) => a - b));
  const g = pairs(fx.golden), n = pairs(got);
  const hit = [...n].filter((p) => g.has(p)).length;
  return { precision: n.size ? hit / n.size : 1, recall: g.size ? hit / g.size : 1, got };
}

test("golden clusters: co-clustered pairs match the frozen baseline", () => {
  const a = agreement();
  assert.ok(a.precision >= 0.95 && a.recall >= 0.95, `precision ${a.precision.toFixed(3)} recall ${a.recall.toFixed(3)}`);
});
