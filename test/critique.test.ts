import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { critique, proposalSide } from "../src/review/critique.ts";
import type { YBar } from "../src/adapters/yahoo.ts";

const now = new Date("2026-10-15T14:00:00Z");
const P = (over: object = {}) => ({ symbol: "IWM", strategy: "put_debit_spread", asOf: "2026-10-15", underlyingPrice: 250, thesisHorizonDays: 20, capital: 50000, buyingPower: 20000,
  legs: [{ type: "put", strike: 245, qty: 1, premium: 4, expiration: "2026-12-18" }, { type: "put", strike: 235, qty: -1, premium: 1.5, expiration: "2026-12-18" }], ...over }) as never;
const bars = (n = 25, hi = 252, lo = 240, lastV = 50): YBar[] => Array.from({ length: n }, (_, i) => ({ t: `2026-09-${String(i + 1).padStart(2, "0")}`, o: 246, h: i === 5 ? hi : 248, l: i === 7 ? lo : 244, c: 246, v: i === n - 1 ? lastV : 100 }));
const good = { verdict: "RESEARCH_OK", side: "short" as const, thesis: "2Y 上行 → 小盘融资成本上升，所以 IWM 跑输", invalidation: "IWM 收盘 > 256 或 11/10 CPI 降温", stop: "IWM 收盘 > 256.4", motive: "thesis", open: [], now, capital: 50000 };

test("critique: a clean, macro-aligned proposal has no objections", () => {
  const c = critique({ ...good, proposal: P(), leader: "hawkish", bars: bars() });
  assert.deepEqual(c.objections.map((o) => o.id), []);
});

test("critique: each objection fires, BLOCK only on existing hard rules, and every cite names a real catalog item", () => {
  const cpi = { kind: "CPI", title: "CPI", date: "2026-10-16", timeEt: "08:30", source: "x" } as never;
  const c = critique({ ...good, proposal: P({ legs: [{ type: "call", strike: 250, qty: 1, premium: 5, expiration: "2026-10-30" }, { type: "call", strike: 255, qty: -1, premium: 2, expiration: "2026-10-30" }], pAssumed: 0.2 }), side: "long", leader: "hawkish",
    thesis: "感觉要涨", invalidation: "跌了就走", stop: "250", motive: "excitement", futuresGapPct: 2.1, verdict: "NO_TRADE", verdictReasons: ["x"],
    open: [{ symbol: "QQQ", maxLoss: 300, legs: [{ type: "call", strike: 500, qty: 1, premium: 1 }] } as never, { symbol: "IWM", maxLoss: 1400, legs: [] } as never],
    bars: bars(25, 251, 240, 50), calendar: [cpi] });
  const ids = new Set(c.objections.map((o) => o.id));
  for (const k of ["scenario", "brief_verdict", "invalidation_vague", "stop_obvious", "stack_underlying", "stack_correlated", "fomo_gap", "fomo_breakout", "event_48h", "ev", "motive", "thesis_weak", "horizon_short"]) assert.ok(ids.has(k), k);
  assert.deepEqual(c.objections.filter((o) => o.severity === "BLOCK").map((o) => o.id).sort(), ["event_48h", "motive", "stack_underlying"]);
  const cat = new Set((JSON.parse(readFileSync("knowledge/catalog.json", "utf8")).items as Array<{ id: string }>).map((i) => i.id));
  for (const o of c.objections) for (const m of o.cite.matchAll(/catalog: ([^;（]+)/g)) for (const id of m[1]!.split(/,\s*/)) assert.ok(cat.has(id.trim()), `unknown catalog id ${id}`);
});

test("critique: side inference", () => {
  assert.equal(proposalSide(P()), "short");
  assert.equal(proposalSide(P({ legs: [{ type: "call", strike: 1, qty: 1, premium: 1 }] })), "long");
});
