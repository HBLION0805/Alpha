import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_RULES } from "../src/options/rules.ts";
import * as D from "../src/options/discipline.ts";
import { adjustmentPlaybookChecks } from "../src/options/adjust.ts";
import { validateEntry, type JournalEntry } from "../src/options/journal.ts";

const T = (id: string, openedAt: string, extra: Partial<D.TradeLog> = {}): D.TradeLog => ({ id, openedAt, ...extra });

test("#4 one 0DTE per day", () => {
  assert.equal(D.zeroDteCheck([], "2026-10-14").severity, "OK");
  assert.equal(D.zeroDteCheck([T("a", "2026-10-14T10:00", { is0dte: true })], "2026-10-14").severity, "BLOCK");
  assert.equal(D.zeroDteCheck([T("a", "2026-10-13T10:00", { is0dte: true })], "2026-10-14").severity, "OK");
});
test("#11 daily loss limit, confirmed 2% rule-card value", () => {
  assert.equal(DEFAULT_RULES.dailyLossLimitPct, 10, "ceiling; the dated cap is riskCap.ts (2% before 2026-10-30)");
  const log = [T("a", "2026-10-14T10:00", { closedAt: "2026-10-14T11:00", pnl: -150 })];
  const ok = D.dailyLossCheck(log, "2026-10-14", 10000); assert.equal(ok.severity, "OK"); assert.match(ok.detail, /\(2%\)/); assert.doesNotMatch(ok.detail, /PROVISIONAL/);
  assert.equal(D.dailyLossCheck(log, "2026-10-14", 10000, -60).severity, "BLOCK");
  assert.equal(D.dailyLossCheck(log, "2026-10-14", 10000, 0, 1).severity, "BLOCK");
});
test("#5 same-direction exposure", () => {
  const r = D.sameDirectionExposure([{ symbol: "SMH", direction: "long", maxLoss: 100, beta: 1.5 }, { symbol: "IWM", direction: "long", maxLoss: 100 }, { symbol: "QQQ", direction: "long", maxLoss: 100 }], 10000);
  assert.equal(r[0]!.severity, "WARN");
  assert.equal(D.sameDirectionExposure([{ symbol: "SPY", direction: "short", maxLoss: 100 }], 10000)[0]!.severity, "INFO");
});
test("#10 planned adds only; reconciled with losing ≤1 and 1-adjustment cap", () => {
  const plan = { price: 30, qty: 1, maxAdds: 3, totalCapQty: 3, maxLoss: 600 };
  const s = { addsDone: 0, currentQty: 1, addQty: 1, price: 30, side: "long" as const, losing: false, newTotalMaxLoss: 400 };
  assert.equal(D.addPlanCheck(undefined, s).severity, "BLOCK");
  assert.equal(D.addPlanCheck(plan, s).severity, "OK");
  assert.equal(D.addPlanCheck(plan, { ...s, addsDone: 1 }).severity, "BLOCK"); // rule-card cap 1 wins over plan's 3
  assert.equal(D.addPlanCheck(plan, { ...s, addQty: 2 }).severity, "BLOCK");
  assert.equal(D.addPlanCheck(plan, { ...s, price: 33 }).severity, "BLOCK");
  assert.equal(D.addPlanCheck(plan, { ...s, newTotalMaxLoss: 700 }).severity, "BLOCK");
  const lp = [{ type: "put" as const, strike: 30, qty: 1, premium: 1 }];
  assert.ok(adjustmentPlaybookChecks(lp, 32, { action: "add", direction: "bearish", confirmation: { confirmed: true, evidence: "x" } }).some((c) => c.id === "add_plan" && c.severity === "BLOCK"));
});
test("#13 two hesitations → exit / take profit", () => {
  assert.equal(D.hesitationCheck(1, -5).severity, "WARN");
  assert.equal(D.hesitationCheck(2, -5).severity, "EXIT");
  assert.match(D.hesitationCheck(2, 50).detail, /take the profit/);
});
test("#9/#15 size vs plan after loss or streak", () => {
  const loss = [T("a", "2026-10-13", { closedAt: "2026-10-13", pnl: -100, maxLoss: 100 })];
  assert.equal(D.sizeDisciplineCheck({ plannedMaxLoss: 100, proposedMaxLoss: 150, recent: loss }).severity, "BLOCK");
  const wins = [1, 2, 3].map((i) => T(String(i), `2026-10-0${i}`, { closedAt: `2026-10-0${i}`, pnl: 50, maxLoss: 100 }));
  assert.equal(D.sizeDisciplineCheck({ plannedMaxLoss: 200, proposedMaxLoss: 150, recent: wins }).severity, "WARN");
  assert.equal(D.sizeDisciplineCheck({ plannedMaxLoss: 200, proposedMaxLoss: 100, recent: wins }).severity, "OK");
});
test("#16 rescue complexity", () => {
  assert.equal(D.complexityCheck({ action: "roll", losing: true, plannedAtEntry: false }).severity, "BLOCK");
  assert.equal(D.complexityCheck({ action: "hedge", losing: true, plannedAtEntry: true }).severity, "OK");
  const lp = [{ type: "put" as const, strike: 30, qty: 1, premium: 1 }];
  assert.ok(adjustmentPlaybookChecks(lp, 32, { action: "hold", direction: "bearish", positionPnl: -50, complexity: { action: "add_leg", plannedAtEntry: false } }).some((c) => c.id === "rescue_complexity" && c.severity === "BLOCK"));
});
test("#19 thesis vs position, journal reviews", () => {
  assert.equal(D.thesisPositionVerdict(true, false).severity, "EXIT");
  assert.equal(D.thesisPositionVerdict(false, true).severity, "EXIT");
  assert.equal(D.thesisPositionVerdict(true, true).severity, "OK");
  const errs = validateEntry({ reviews: [{ at: "x", thesisValid: true } as unknown as { at: string; thesisValid: boolean; positionValid: boolean }] } as Partial<JournalEntry>);
  assert.ok(errs.some((e) => /纪律 #19/.test(e)));
});
test("#2/#20 session gate and market check → NO_TRADE", () => {
  const ok = { emotion: "ok", sleep: "ok", health: "ok", lifeEvents: "ok" } as const;
  assert.equal(D.sessionGate(ok).severity, "OK");
  assert.equal(D.sessionGate({ ...ok, sleep: "bad" }).severity, "NO_TRADE");
  assert.equal(D.sessionGate({ emotion: "ok" }).severity, "NO_TRADE");
  assert.equal(D.sessionGate(ok, { chop: true }).severity, "NO_TRADE");
});
test("#3 euphoria gate, #7 entry range, #12 cash note", () => {
  assert.equal(D.euphoriaGate({ todayWins: 1, streak: 0, bigWinPctToday: 0.2 }).severity, "OK");
  assert.equal(D.euphoriaGate({ todayWins: 3, streak: 3, bigWinPctToday: 0.5 }).severity, "BLOCK");
  assert.equal(D.euphoriaGate({ todayWins: 3, streak: 3, bigWinPctToday: 0.5, answer: "want_more" }).severity, "BLOCK");
  assert.equal(D.euphoriaGate({ todayWins: 3, streak: 3, bigWinPctToday: 0.5, answer: "real_opportunity" }).severity, "WARN");
  assert.equal(D.entryRangeCheck(105, { low: 98, high: 101 }, "long").severity, "BLOCK");
  assert.equal(D.entryRangeCheck(100, { low: 98, high: 101 }, "long").severity, "OK");
  assert.equal(D.entryRangeCheck(100, undefined, "long").severity, "BLOCK");
  assert.match(D.CASH_NOTE, /现金也是一种仓位/);
});
test("catalog: mentor-discipline cited, candidates resolved, no duplicate ids", () => {
  const cat = JSON.parse(readFileSync(new URL("../knowledge/catalog.json", import.meta.url), "utf8")) as { items: Array<{ id: string; status: string; sources: string[] }>; psychology: { prompts: Array<{ id: string; status?: string }> } };
  for (const id of ["psych-0dte-one-and-done", "psych-two-hesitations", "psych-daily-loss-limit", "adding"]) assert.equal(cat.items.find((i) => i.id === id)!.status, "RESOLVED_FROM_SOURCE", id);
  assert.equal(cat.items.filter((i) => i.sources.includes("mentor-discipline")).length, 21);
  assert.equal(new Set(cat.items.map((i) => i.id)).size, cat.items.length);
  assert.equal(cat.psychology.prompts.find((p) => p.id === "entry-euphoria-gate")!.status, "ENFORCED_GATE");
  assert.equal(readFileSync(new URL("../knowledge/mentor/discipline/discipline-01-20.md", import.meta.url)).length, 31110);
});

test("pretrade wires discipline checks; missing inputs → provide X (NO_TRADE/BLOCK)", async () => {
  const { preTradeChecks } = await import("../src/options/pretrade.ts");
  const base = { scenarioPlan: { at: "2026-01-01T00:00:00Z", source: "user" as const, rows: [{ id: "crash" as const, action: "止盈" }, { id: "flat" as const, action: "时间止损" }, { id: "rally" as const, action: "止损" }] }, symbol: "SPY", strategy: "long_call", asOf: "2026-10-14", underlyingPrice: 600, thesisHorizonDays: 10, capital: 50000, buyingPower: 50000,
    legs: [{ type: "call" as const, strike: 610, qty: 1, premium: 3, expiration: "2026-12-18" }] };
  const none = preTradeChecks(base);
  for (const id of ["session_gate", "journal_inputs", "entry_range"]) assert.match(none.checks.find((c) => c.id === id)!.detail, /^provide /, id);
  assert.equal(none.checks.find((c) => c.id === "session_gate")!.severity, "NO_TRADE"); assert.ok(none.blocked);
  const disc = { motive: "thesis" as const, openPositions: 3, journal: [] as D.TradeLog[], openPnlToday: 0, session: { emotion: "ok", sleep: "ok", health: "ok", lifeEvents: "ok" } as const, market: {}, plannedMaxLoss: 400, entryRange: { low: 595, high: 605 }, side: "long" as const };
  const ok = preTradeChecks({ ...base, discipline: disc });
  assert.ok(!ok.checks.some((c) => c.severity === "BLOCK" || c.severity === "NO_TRADE"), JSON.stringify(ok.checks.filter((c) => c.severity !== "OK" && c.severity !== "INFO")));
  assert.equal(preTradeChecks({ ...base, discipline: { ...disc, plannedMaxLoss: 100 } }).checks.find((c) => c.id === "size_vs_plan")!.severity, "BLOCK");
  assert.equal(preTradeChecks({ ...base, discipline: { ...disc, openPnlToday: -1000 } }).checks.find((c) => c.id === "daily_loss_limit")!.severity, "BLOCK");
  assert.equal(preTradeChecks({ ...base, discipline: { ...disc, market: { chop: true } } }).checks.find((c) => c.id === "session_gate")!.severity, "NO_TRADE");
  assert.equal(preTradeChecks({ ...base, discipline: { ...disc, entryRange: { low: 580, high: 590 } } }).checks.find((c) => c.id === "entry_range")!.severity, "BLOCK");
  const zero = { ...base, legs: [{ ...base.legs[0]!, expiration: "2026-10-14" }], discipline: { ...disc, journal: [{ id: "x", openedAt: "2026-10-14T10:00", is0dte: true }] } };
  assert.equal(preTradeChecks(zero).checks.find((c) => c.id === "0dte_one_per_day")!.severity, "BLOCK");
  const wins = [1, 2, 3].map((i) => ({ id: String(i), openedAt: "2026-10-14T09:4" + i, closedAt: "2026-10-14T10:0" + i, pnl: 300, maxLoss: 300 }));
  assert.equal(preTradeChecks({ ...base, discipline: { ...disc, journal: wins } }).checks.find((c) => c.id === "euphoria_gate")!.severity, "BLOCK");
});

test("mentor-winrate-review: motive must be thesis; concurrent cap 10 can only be lowered", async () => {
  const R = await import("../src/options/rules.ts");
  assert.equal(D.motiveCheck("thesis").severity, "OK");
  for (const m of ["share", "entertain", "excitement"] as const) assert.equal(D.motiveCheck(m).severity, "BLOCK");
  assert.equal(D.motiveCheck(undefined).severity, "BLOCK");
  assert.equal(R.DEFAULT_RULES.maxConcurrentPositions, 10);
  assert.equal(D.concurrentCheck(9, 10).severity, "OK");
  assert.equal(D.concurrentCheck(10, 10).severity, "BLOCK");
  assert.equal(R.effectiveRules({ maxConcurrentPositions: 30 }).maxConcurrentPositions, 10, "never loosened");
  assert.equal(R.effectiveRules({ maxConcurrentPositions: 6 }).maxConcurrentPositions, 6, "user may lower");
  assert.equal(R.effectiveRules({ sellerMaxLossPerTradePct: 2, dailyLossLimitPct: 5 }).sellerMaxLossPerTradePct, 1);
  assert.equal(R.effectiveRules({ dailyLossLimitPct: 5 }).dailyLossLimitPct, 5); assert.equal(R.effectiveRules({ dailyLossLimitPct: 20 }).dailyLossLimitPct, 10);
});
