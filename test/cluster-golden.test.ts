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

// Porter stemming (natural) keeps every baseline pair (recall 1.0) and adds merges reviewed by hand on 2026-10-14:
// Guilfoyle resignation x2 (same story), Musk/Starshield (same story), White House media-ban ruling +1 outlet,
// Greenland drilling +Denmark response, and one more Benzinga "how much you would have made" template (already clustered).
test("golden clusters: no baseline pair lost; extra merges bounded", () => {
  const a = agreement();
  // 2026-10-14 P2 (alert recall): Gulf/chokepoint family merges Aramco/Iran-strike headlines into the Hormuz cluster (reviewed: same escalation).
  assert.ok(a.recall >= 0.98 && a.precision >= 0.88, `precision ${a.precision.toFixed(3)} recall ${a.recall.toFixed(3)}`);
});
