import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyMatrix, renderMatrix, jobsState } from "../src/macro/matrix.ts";
import type { Obs } from "../src/macro/fetch.ts";

const ser = (a: number, b: number, n = 30): Obs[] => Array.from({ length: n }, (_, i) => ({ t: new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10), v: a + ((b - a) * i) / (n - 1) }));
const flat = (v: number, n = 30) => ser(v, v, n);
const goodJobs = { ICSA: flat(220, 20), PAYEMS: ser(159000, 159600, 6) };
const base = (o: Record<string, Obs[]>) => ({ NDX: flat(100), ...goodJobs, ...o });

test("matrix: each stage is recognized 4/4 from its own pattern", () => {
  const up = { UST10Y: ser(4.0, 4.4), WTI: ser(80, 95), SMH: ser(100, 110) }, dn = { UST10Y: ser(4.4, 4.0), WTI: ser(95, 80), SMH: ser(110, 100) };
  const cases: Array<[string, Record<string, Obs[]>]> = [
    ["bull", base({ UST10Y: dn.UST10Y, WTI: dn.WTI, SMH: up.SMH })],
    ["rotation", base({ UST10Y: dn.UST10Y, WTI: dn.WTI, SMH: dn.SMH })],
    ["bear1", base({ UST10Y: up.UST10Y, WTI: up.WTI, SMH: up.SMH })],
    ["bear2", base({ UST10Y: dn.UST10Y, WTI: up.WTI, SMH: up.SMH, ICSA: [...flat(220, 10), ...flat(260, 4)] })],
    ["bear3", base({ UST10Y: dn.UST10Y, WTI: dn.WTI, SMH: dn.SMH, ICSA: [...flat(220, 10), ...flat(300, 4)], PAYEMS: ser(159600, 159400, 6) })],
  ];
  for (const [id, d] of cases) { const r = classifyMatrix(d); assert.deepEqual(r.best.map((s) => s.id), [id], id); assert.equal(r.matches, 4, id); }
});

test("matrix: unknown jobs never counts; tech is labeled a proxy; disagreement with the leading scenario is flagged", () => {
  assert.equal(jobsState().state, "unknown");
  const r = classifyMatrix({ UST10Y: ser(4.0, 4.4), WTI: ser(80, 95), SMH: ser(100, 110), NDX: flat(100) });
  assert.deepEqual(r.unknown, ["就业"]); assert.equal(r.known, 3); assert.equal(r.best[0]!.id, "bear1"); assert.equal(r.matches, 3);
  const md = renderMatrix(r, "risk_off").join("\n");
  assert.match(md, /【大佬情景对照】.*熊市·第一阶段.*3\/4.*未知：就业/);
  assert.match(md, /代理指标/); assert.match(md, /与领先情景（risk_off）不一致/);
  assert.doesNotMatch(renderMatrix(r, "hawkish").join("\n"), /不一致/);
});
