import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { buildMacroReport } from "../src/macro/build.ts";
import { buildPremarket } from "../src/macro/premarket.ts";
import { buildScenarios } from "../src/macro/scenarios.ts";
import { buildBrief, briefVerdict } from "../src/macro/brief.ts";
import { SESSION_QUESTIONS } from "../src/options/discipline.ts";
import { proposalPlan, renderPlan } from "../src/options/plan.ts";
import { ADD_RULE, managementPlan, DEFAULT_RULES } from "../src/options/rules.ts";

const now = new Date("2026-10-15T11:30:00Z");
function parts(over: { pmNo?: string[]; scNo?: string[] } = {}) {
  const macro = buildMacroReport(new DatabaseSync(":memory:"), [], [], now);
  const pm = buildPremarket({ now, data: {}, calendar: [], earnings: null, headlines: [], regimeLabel: macro.regime.label });
  const sc = buildScenarios({ now, data: {}, calendar: [] });
  if (over.pmNo) pm.noTrade = over.pmNo;
  if (over.scNo) sc.noTrade = over.scNo;
  return { macro, pm, sc };
}

test("brief: ONE verdict = union of macro/premarket/scenario NO_TRADE reasons", () => {
  const p = parts({ pmNo: ["A"], scNo: ["A", "B"] });
  const v = briefVerdict(p);
  assert.equal(v.verdict, "NO_TRADE");
  for (const r of ["A", "B"]) assert.ok(v.reasons.includes(r));
  assert.equal(v.reasons.filter((r) => r === "A").length, 1, "deduped");
});

test("brief: sections 1–7 in order, single verdict line, SESSION_QUESTIONS as self-check", () => {
  const r = buildBrief({ now, ...parts(), calendar: [] });
  const heads = [...r.md.matchAll(/^## (\d(\.\d)?)/gm)].map((m) => m[1]);
  assert.deepEqual(heads, ["1", "2", "3", "3.1", "3.2", "4", "5", "6", "7"]);
  const s3 = r.md.split("## 3.1")[0]!.split("## 3.")[1]!;
  assert.match(s3, /国债/); assert.doesNotMatch(s3, /HYG 信用确认/, "only bonds before the oil block");
  assert.match(r.md, /## 3\.1 【用户要求】原油\n_用户本人的要求.*不是大佬流程，也不是 DK 补充/);
  assert.ok(r.md.indexOf("【大佬流程】") < r.md.indexOf("【DK 补充】"));
  assert.equal((r.md.match(/NO_TRADE 不交易|CAUTION 谨慎|RESEARCH_OK 可研究/g) ?? []).length >= 1, true);
  for (const q of SESSION_QUESTIONS) assert.ok(r.md.includes(q));
});

test("managementPlan: at most one add, only after thesis reconfirmed, never a guessed bottom", () => {
  assert.match(ADD_RULE, /最多 1 次/);
  assert.match(ADD_RULE, /重新确认/);
  assert.match(ADD_RULE, /绝不在猜测的底部/);
  for (const k of ["credit", "debit"] as const) {
    const m = managementPlan(k, 300, 30, DEFAULT_RULES).join("\n");
    assert.ok(m.includes(ADD_RULE));
    assert.doesNotMatch(m, /average down|摊低/i);
  }
});

const lp = { symbol: "INTC", strategy: "long_put", asOf: "2026-10-14", underlyingPrice: 32, thesisHorizonDays: 20, capital: 50000, buyingPower: 20000,
  legs: [{ type: "put", strike: 30, qty: 2, premium: 0.8, expiration: "2026-11-20", openInterest: 5000, bid: 0.78, ask: 0.82 }] } as never;

test("proposal plan: TP ladder always; Kelly only with an explicit pAssumed and only as a cap", () => {
  const a = proposalPlan(lp);
  assert.equal(a.kind, "debit");
  assert.equal(a.kelly, null);
  assert.deepEqual(a.takeProfit.map((t) => t.at), ["+30%", "+50%", "+80%", "+100%", "+200%"]);
  const b = proposalPlan({ ...(lp as object), pAssumed: 0.45, winPerContract: 200 } as never);
  assert.ok(b.kelly && b.kelly.maxContracts <= Math.floor(50000 * 0.01 / 80));
  const md = renderPlan(b).join("\n");
  assert.match(md, /上限参考/);
  assert.match(md, /止盈计划/);
});

test("brief timing: past releases don't block an evening run; the 48h event warning prints once", async () => {
  const { buildPremarket: bp } = await import("../src/macro/premarket.ts");
  const cpi = { kind: "CPI", title: "CPI", date: "2026-10-14", timeEt: "08:30", source: "x" } as never;
  const morning = bp({ now: new Date("2026-10-14T11:00:00Z"), data: {}, calendar: [cpi], earnings: null, headlines: [] });
  const evening = bp({ now: new Date("2026-10-15T02:30:00Z"), data: {}, calendar: [cpi], earnings: null, headlines: [] });
  assert.ok(morning.noTrade.some((r) => /CPI 08:30/.test(r)));
  assert.ok(!evening.noTrade.some((r) => /CPI 08:30/.test(r)));
  const p = parts({ scNo: ["48h 内高影响事件：PPI 2026-10-15 → 不开新仓（risk.ts）"] });
  p.macro.risk.overall = "NO_TRADE"; p.macro.risk.noTradeReasons = ["高影响事件 48 小时内 / high-impact event within 48h: PPI 2026-10-15 08:30 ET"];
  const v = briefVerdict(p);
  assert.equal(v.reasons.filter((r) => /PPI/.test(r)).length, 1);
});
