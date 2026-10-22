import { test } from "node:test";
import assert from "node:assert/strict";
import { macroEntry, migrateMacro } from "../src/options/macroLedger.ts";
import { buildDashboard } from "../src/options/readinessDashboard.ts";
import { readiness } from "../src/options/readiness.ts";
import { catOf } from "../src/options/weekly.ts";

const now = new Date("2026-10-22T15:00:00Z");
test("宏观单: macro-open builds a separate, non-formal entry; refuses missing fields", () => {
  assert.ok(macroEntry({ symbol: "GDX", now }, []).refused.length >= 3);
  const r = macroEntry({ symbol: "gdx", strategy: "call_debit_spread", dir: "bullish", maxLoss: 100, thesis: "gold bid", now }, []);
  const e = r.entry!;
  assert.equal(e.category, "macro"); assert.equal(e.kind, "practice"); assert.equal(e.source, "mentor_shadow"); assert.equal(e.symbol, "GDX");
  assert.equal(catOf(e), "mentor");
  const r2 = macroEntry({ symbol: "gdx", strategy: "call_debit_spread", dir: "bullish", maxLoss: 100, thesis: "x", now }, [e]);
  assert.notEqual(r2.entry!.id, e.id);
});
test("宏观单: migration tags mentor_shadow only; excluded from formal 30 / readiness, counted separately", () => {
  const E = [{ id: "m", source: "mentor_shadow", kind: "practice", mode: "paper", openedAt: "2026-10-15T14:00:00Z", closedAt: "2026-10-16T19:00:00Z", pnl: -40, symbol: "GDX" },
    { id: "f", source: "paper_sim", kind: "formal", mode: "paper", openedAt: "2026-10-16T14:00:00Z", closedAt: "2026-10-16T19:00:00Z", pnl: 10, symbol: "QQQ", thesis: "t", stop: "s" },
    { id: "p", source: "paper_sim", kind: "practice", mode: "paper", openedAt: "2026-10-16T14:00:00Z", symbol: "SMH" }] as never[];
  assert.deepEqual(migrateMacro(E), ["m"]); assert.deepEqual(migrateMacro(E), []);
  assert.equal((E[2] as unknown as { kind: string }).kind, "practice"); // existing practice not retagged
  const d = buildDashboard(E, 5000, now);
  assert.equal(d.trades.formal, 1); assert.equal(d.trades.macro, 1); assert.equal(d.trades.macroPnl, -40); assert.equal(d.trades.simulated, 2);
  assert.match(readiness({ journal: E, capital: 5000, shockDates: [] }).criteria[0]!.detail[0]!, /模拟交易 1 笔/);
});
