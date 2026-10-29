/** Daily risk cap (user rule 2026-10-29, src/options/riskCap.ts) + hard-stop / max-loss rule. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dailyRiskCapPct, dailyRiskCapUsd, hasDefinedRisk, definedRiskUsd, RISK_UNDEFINED_VIOLATION, DAILY_CAP_BASE_PCT, DAILY_CAP_SMALL_ACCOUNT_PCT, DAILY_CAP_SMALL_ACCOUNT_FROM, DAILY_CAP_SMALL_ACCOUNT_MAX_EQUITY } from "../src/options/riskCap.ts";
import { readiness } from "../src/options/readiness.ts";
import { buildDashboard } from "../src/options/readinessDashboard.ts";
import { capFlags } from "../src/options/breach.ts";
import { dailyLossCheck } from "../src/options/discipline.ts";
import { dailyBudget } from "../src/review/card.ts";
import { tradeCap, TIERS } from "../src/options/confidence.ts";
import type { JournalEntry } from "../src/options/journal.ts";

test("constants: 2% base, 10% from 2026-10-30 while equity ≤ $10,000", () => {
  assert.deepEqual([DAILY_CAP_BASE_PCT, DAILY_CAP_SMALL_ACCOUNT_PCT, DAILY_CAP_SMALL_ACCOUNT_FROM, DAILY_CAP_SMALL_ACCOUNT_MAX_EQUITY], [2, 10, "2026-10-30", 10_000]);
});

test("date boundary: 10-29 → 2%, 10-30 → 10% ($500 on $5k); Date objects use the ET date", () => {
  assert.equal(dailyRiskCapPct("2026-10-29", 5000), 2); assert.equal(dailyRiskCapUsd("2026-10-29", 5000), 100);
  assert.equal(dailyRiskCapPct("2026-10-30", 5000), 10); assert.equal(dailyRiskCapUsd("2026-10-30", 5000), 500);
  assert.equal(dailyRiskCapPct("2026-10-30T13:00:00Z", 5000), 10);
  assert.equal(dailyRiskCapPct(new Date("2026-10-30T03:30:00Z"), 5000), 2, "23:30 ET on 10-29 is still 10-29");
  assert.equal(dailyRiskCapPct(new Date("2026-10-30T14:00:00Z"), 5000), 10);
});

test("equity threshold: exactly $10,000 → 10%; just above → 2%", () => {
  assert.equal(dailyRiskCapPct("2026-11-02", 10_000), 10); assert.equal(dailyRiskCapUsd("2026-11-02", 10_000), 1000);
  assert.equal(dailyRiskCapPct("2026-11-02", 10_000.01), 2); assert.equal(dailyRiskCapUsd("2026-11-02", 10_001), 200.02);
  assert.equal(dailyRiskCapPct("2026-10-29", 10_000), 2, "before the start date the size doesn't matter");
});

test("a rule-card override can only lower the cap", () => {
  assert.equal(dailyRiskCapPct("2026-10-30", 5000, { dailyLossLimitPct: 1 }), 1);
  assert.equal(dailyRiskCapPct("2026-10-30", 5000, { dailyLossLimitPct: 2 }), 10, "default 2 is not an override");
  assert.equal(dailyRiskCapPct("2026-10-29", 5000, { dailyLossLimitPct: 5 }), 2);
});

test("per-trade cap unchanged: confidence tiers 0.5–2% of equity", () => {
  assert.deepEqual(Object.values(TIERS), [0.5, 1, 1.5, 2]);
  assert.equal(tradeCap(5000, "medium").usd, 50); assert.equal(tradeCap(5000, "low").usd, 25);
  assert.equal(tradeCap(5000, "highest", { macro: true, scenarioPlan: true, technical: true }).usd, 100);
});

const base = (over: Partial<JournalEntry>): JournalEntry => ({ id: "x", mode: "paper", symbol: "SPY", strategy: "put_debit_spread", openedAt: "2026-10-30T14:00:00Z",
  view: { direction: "x", volatility: "x" }, ivRank: null, greeks: { delta: 0, gamma: 0, theta: 0, vega: 0 }, expectedMove: null, structureRationale: "x",
  maxLoss: 50, invalidation: "x", exitRules: ["x"], ...over } as JournalEntry);

test("missing hard stop AND max loss → violation, risk not counted as defined", () => {
  assert.equal(hasDefinedRisk({ maxLoss: 50 }), true); assert.equal(hasDefinedRisk({ maxLoss: 0, stop: "SPY < 670 平仓" }), true);
  for (const e of [{ maxLoss: 0 }, { maxLoss: NaN, stop: "" }, { stop: "not recorded" }, {}]) assert.equal(hasDefinedRisk(e), false, JSON.stringify(e));
  assert.equal(definedRiskUsd({ maxLoss: 0, stop: "x" }), null); assert.equal(definedRiskUsd({ maxLoss: 50 }), 50); assert.equal(definedRiskUsd({ maxLoss: 0 }), null);
  const bad = base({ id: "nostop", maxLoss: 0, stop: undefined });
  capFlags([bad], 5000, new Date("2026-10-30T15:00:00Z"));
  assert.ok(bad.violations?.includes(RISK_UNDEFINED_VIOLATION));
  const ok = base({ id: "ok" }); capFlags([ok], 5000, new Date("2026-10-30T15:00:00Z")); assert.ok(!(ok.violations ?? []).includes(RISK_UNDEFINED_VIOLATION));
  // readiness discipline counts it as a violation
  const r = readiness({ journal: [{ ...bad, violations: [], closedAt: "2026-10-30T19:00:00Z", pnl: 10 }], capital: 5000, shockDates: [] });
  assert.match(JSON.stringify(r.criteria), new RegExp(`nostop:${RISK_UNDEFINED_VIOLATION}`));
  const paper = readFileSync(new URL("../src/options/paper.ts", import.meta.url), "utf8");
  assert.match(paper, /if \(!hasDefinedRisk\(entry\)\) entry\.violations = \[\.\.\.new Set\(\[\.\.\.\(entry\.violations \?\? \[\]\), RISK_UNDEFINED_VIOLATION\]\)\]/);
});

const closedT = (id: string, day: string, pnl: number) => base({ id, openedAt: `${day}T14:00:00Z`, closedAt: `${day}T19:00:00Z`, pnl, commissions: 0, stop: "x" });

test("readiness + dashboard judge each day against that day's cap", () => {
  const j = [closedT("a", "2026-10-29", -300), closedT("b", "2026-10-30", -300)]; // $300 > $100 on 10-29; $300 < ~$470 on 10-30
  const lc = readiness({ journal: j, capital: 5000, shockDates: [] }).criteria.find((c) => c.id === "loss_caps")!;
  const days = lc.missing.filter((m) => /单日亏/.test(m));
  assert.equal(days.length, 1); assert.match(days[0]!, /^2026-10-29 单日亏 \$300 > 当天上限 \$100$/);
  assert.match(lc.title, /2026-10-30 前 2%；之后权益 ≤\$10k 时 10%/);
  const dash = buildDashboard(j, 5000, new Date("2026-10-31T12:00:00Z"));
  assert.deepEqual(dash.capBreaches.daily.map((b) => b.day), ["2026-10-29"]);
  // equity above $10k: 10-29 2% of 11,000 = $220; 10-30 equity 10,700 > $10k → 2% = $214 → both days breached
  const big = readiness({ journal: j, capital: 11_000, shockDates: [] }).criteria.find((c) => c.id === "loss_caps")!;
  assert.deepEqual(big.missing.filter((m) => /单日亏/.test(m)), ["2026-10-29 单日亏 $300 > 当天上限 $220", "2026-10-30 单日亏 $300 > 当天上限 $214"]);
});

test("pretrade / plan-card budget / live breach use the dated cap", () => {
  const log = [{ source: "paper_sim", closedAt: "2026-10-30T15:00:00Z", pnl: -150 }] as never;
  assert.equal(dailyLossCheck(log, "2026-10-30", 5000, 0, dailyRiskCapPct("2026-10-30", 5000)).severity, "OK");
  assert.equal(dailyLossCheck(log, "2026-10-29", 5000, -150, dailyRiskCapPct("2026-10-29", 5000)).severity, "BLOCK");
  assert.equal(dailyBudget([closedT("c", "2026-10-30", -150)], 5000, new Date("2026-10-30T18:00:00Z")).remaining, 350);
  assert.equal(dailyBudget([closedT("c", "2026-10-29", -50)], 5000, new Date("2026-10-29T18:00:00Z")).remaining, 50);
  const f = capFlags([closedT("d", "2026-10-30", -150)], 5000, new Date("2026-10-30T20:00:00Z"));
  assert.ok(!f.some((x) => /超限 今日/.test(x)), "−$150 is inside the 10-30 cap");
  for (const p of ["src/options/pretrade.ts", "src/options/breach.ts", "src/options/sins.ts", "src/options/reviewreport.ts", "src/review/mentor.ts", "src/review/card.ts", "src/macro/paperGate.ts", "src/options/confidence.ts", "src/options/readiness.ts", "src/options/readinessDashboard.ts"]) {
    const s = readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
    assert.match(s, /dailyRiskCap(Pct|Usd)\(/, p); assert.doesNotMatch(s, /dailyLossLimitPct \/ 100|dailyCapPct \?\? 2\b|perDayPct = 2\b/, p);
  }
});
