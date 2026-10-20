import { test } from "node:test";
import assert from "node:assert/strict";
import { runScenarios, suggestHedge, renderScenarioTable, renderWithHedge, forbiddenGuard, parsePlan, planProblems, planFromResult, type EngineInput } from "../src/options/scenarioEngine.ts";
import { tradeCap, paperEquity, capLabel, dayCapUsd, entryCapUsd } from "../src/options/confidence.ts";
import { FORBIDDEN } from "../src/options/matrix.ts";

const asOf = "2026-10-20T17:00:00Z";
const PDS: EngineInput = { legs: [{ type: "put", strike: 530, qty: 1, premium: 1.0, expiration: "2026-11-20" }, { type: "put", strike: 527.5, qty: -1, premium: 0.5, expiration: "2026-11-20" }],
  spot: 548, asOf, iv: 0.3, capUsd: 50, levels: { supports: [500], resistances: [590] }, label: "SMH PDS" };
const CALL: EngineInput = { legs: [{ type: "call", strike: 90, qty: 1, premium: 2.6, expiration: "2026-11-20" }], spot: 87, asOf, iv: 0.4, capUsd: 50, label: "GDX" };

test("engine: 4 scenarios, EM from IV, key levels as targets, expiry + mid P&L, actions", () => {
  const r = runScenarios(PDS);
  assert.deepEqual(r.rows.map((x) => x.zh), ["大跌", "慢跌", "横盘", "上涨"]);
  assert.match(r.emSource, /IV/);
  assert.equal(r.rows[0]!.price, 500, "crash → support"); assert.equal(r.rows[3]!.price, 590, "rally → resistance");
  assert.equal(r.rows[2]!.price, 548); assert.equal(r.maxLoss, 50);
  assert.ok(r.rows[0]!.pnlExpiry > 0 && /止盈/.test(r.rows[0]!.action)); assert.equal(r.rows[3]!.pnlExpiry, -50);
  for (const x of r.rows) assert.ok(/止盈|止损|持有|调整/.test(x.action) && Number.isFinite(x.pnlMid));
  const t = renderScenarioTable(r).join("\n"); assert.match(t, /\| 情景 \| 标的价 \|/); assert.match(t, /大跌/);
});
test("engine: EM falls back to ATR, then a flagged 5%", () => {
  assert.match(runScenarios({ ...CALL, iv: null, atr: 2 }).emSource, /ATR/);
  assert.match(runScenarios({ ...CALL, iv: null, atr: null }).emSource, /5%/);
});
test("hedge: refused when the position already exceeds the cap; ok when within cap; never naked", () => {
  const big = suggestHedge(CALL); assert.equal(big.ok, false); assert.match(big.text, /对冲成本超出上限 → 缩小仓位或 NO_TRADE/);
  const h = suggestHedge({ ...PDS, capUsd: 100000 });
  if (h.ok) { assert.ok(h.after! <= 100000); assert.equal(forbiddenGuard([...PDS.legs, ...h.legs]), null); assert.ok(h.table); }
  else assert.match(h.text, /对冲|不/);
  const tight = suggestHedge({ ...PDS, capUsd: 51 }); assert.ok(!tight.ok || tight.after! <= 51);
  const out = renderWithHedge(PDS).join("\n"); assert.match(out, /对冲建议/); assert.match(out, /第二阶段/);
});
test("forbidden guard: naked short is refused, FORBIDDEN list intact", () => {
  assert.deepEqual([...FORBIDDEN].sort(), ["naked_call", "naked_put", "ratio_spread_uncovered", "short_straddle", "short_strangle"]);
  assert.match(forbiddenGuard([{ type: "call", strike: 600, qty: -1, premium: 2 }])!, /FORBIDDEN|裸/);
  const naked: EngineInput = { ...CALL, legs: [{ type: "put", strike: 80, qty: -1, premium: 1, expiration: "2026-11-20" }], capUsd: 1e6 };
  assert.equal(suggestHedge(naked).ok, false);
});
test("scenario plan: parse, problems, written before entry", () => {
  const p = parsePlan("大跌:止损;慢跌:持有;横盘:时间止损;上涨:止盈", asOf)!;
  assert.equal(p.rows.length, 4); assert.deepEqual(planProblems(p, "2026-10-21T00:00:00Z"), []);
  assert.ok(planProblems(null, asOf).length); assert.ok(planProblems(parsePlan("上涨:止盈", asOf), asOf).length);
  assert.ok(planProblems(p, "2026-10-19T00:00:00Z").length, "plan written after entry");
  assert.equal(planFromResult(runScenarios(PDS), asOf, "card").rows.length, 4);
});
test("confidence cap: 0.5–2% of live equity, high/highest need all three aligned, daily 2%", () => {
  assert.equal(tradeCap(5000, "low").usd, 25); assert.equal(tradeCap(5000).usd, 50); assert.equal(tradeCap(5000, "medium").tier, "medium");
  const h = tradeCap(5000, "highest", { macro: true, scenarioPlan: true, technical: false }); assert.equal(h.tier, "medium"); assert.ok(h.downgraded);
  assert.equal(tradeCap(5000, "highest", { macro: true, scenarioPlan: true, technical: true }).usd, 100);
  assert.equal(tradeCap(5000, "high", { macro: true, scenarioPlan: true, technical: true }).usd, 75);
  assert.equal(dayCapUsd(4831), 96.62);
  const eq = paperEquity([{ mode: "paper", source: "practice", closedAt: "x", pnl: -200 } as never], 5000); assert.equal(eq, 4800);
  assert.equal(tradeCap(eq).usd, 48); assert.match(capLabel(tradeCap(eq)), /置信度「中」1% × 权益 \$4,800 = 单笔上限 \$48/);
  assert.equal(entryCapUsd({ capitalAtEntry: 5000 } as never, 5000), 50); assert.equal(entryCapUsd({ confidence: { capUsd: 75 } } as never, 5000), 75);
});
test("no hardcoded $50 per-trade text left in plan-card cap line", async () => {
  const { readFileSync } = await import("node:fs");
  const s = readFileSync(new URL("../src/review/card.ts", import.meta.url), "utf8");
  assert.ok(!/capital \* 0\.01/.test(s)); assert.match(s, /capLabel\(cap\)/); assert.match(s, /情景推演/);
});
