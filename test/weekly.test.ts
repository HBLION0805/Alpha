import { test } from "node:test";
import assert from "node:assert/strict";
import { weeklyReport, catOf } from "../src/options/weekly.ts";
import { readiness } from "../src/options/readiness.ts";
import type { JournalEntry } from "../src/options/journal.ts";

const T = (o: Partial<JournalEntry>): JournalEntry => ({ id: "x", symbol: "NVDA", strategy: "put_debit_spread", mode: "paper", kind: "practice", openedAt: "2026-10-13T14:00:00Z", legs: [], ...o } as JournalEntry);
const E: JournalEntry[] = [
  T({ id: "r1", source: "real_practice", closedAt: "2026-10-14T19:00:00Z", pnl: -40, violations: ["no_pre_written_plan", "exceeds_1pct_cap"], lossReview: { at: "t", errorClass: "execution", errorTags: ["position_over_cap"] } as never, lesson: "≤$50" }),
  T({ id: "r2", source: "real_practice", closedAt: "2026-10-15T19:00:00Z", pnl: -3, violations: ["no_pre_written_plan"], postMortem: { at: "t", outcome: "loss", classification: "judgment", tags: ["strikes_too_far_otm"], lesson: "ATM", followed: { stop: null, takeProfit: null, size: null } } }),
  T({ id: "p0", source: "real_practice", openedAt: "2026-10-06T14:00:00Z", closedAt: "2026-10-07T19:00:00Z", pnl: -5, violations: ["no_pre_written_plan"] }),
  T({ id: "m1", source: "mentor_shadow", violations: ["exceeds_1pct_cap"], marks: [{ at: "t", pnl: 10 } as never] }),
  T({ id: "f1", kind: "formal", source: "paper_sim", closedAt: "2026-10-15T19:00:00Z", pnl: 20 }),
];
const run = () => weeklyReport({ entries: E, capital: 5000, from: "2026-10-09", to: "2026-10-15", readiness: readiness({ journal: E, capital: 5000, shockDates: [] }) });

test("categories", () => assert.deepEqual(E.map(catOf), ["real", "real", "real", "mentor", "formal"]));
test("weekly: all sections present, plain Chinese", () => {
  const md = run().md;
  for (const h of ["正式模拟单", "模拟练习单", "真实账户练习单", "大佬影子单", "实盘准备度进度", "本周 vs 上周", "本周教训", "下周 3 个重点"]) assert.match(md, new RegExp(h));
  assert.match(md, /正式样本：1\/30/); assert.match(md, /冲击时段：否/); assert.match(md, /上限 6% = \$300/);
  assert.match(md, /大佬实际：未记录/);
});
test("weekly: tags week-over-week; mentor oversize not counted as user's breach", () => {
  const w = run();
  assert.deepEqual(w.tagsThis.find(([t]) => t === "no_pre_written_plan"), ["no_pre_written_plan", 2]);
  assert.deepEqual(w.tagsPrev, [["no_pre_written_plan", 1]]);
  assert.match(w.md, /你自己的单）：本周 1 笔/); assert.match(w.md, /大佬影子单按 Alpha 上限超限 1 笔/);
});
test("weekly: exactly ≤3 data-derived focus items, top tag first", () => {
  const f = run().focus;
  assert.ok(f.length >= 1 && f.length <= 3); assert.match(f[0]!, /^no_pre_written_plan（本周 2 次）/);
});
