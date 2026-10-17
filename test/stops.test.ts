import { test } from "node:test";
import assert from "node:assert/strict";
import { mechanicalStop, rule3030, multiLegChecklist, thesisStop, timeStop, volStop, overnightCheck, technicalStop, technicalSignals, costAndStopChecks, stopMoveCheck } from "../src/options/stops.ts";
const AP = { price: 32, qty: 1, maxAdds: 1, totalCapQty: 2, maxLoss: 300 };
import { adjustmentPlaybookChecks } from "../src/options/adjust.ts";
import { readFileSync } from "node:fs";
import type { Bar } from "../src/levels.ts";

test("mechanical -7% for stocks only", () => {
  assert.equal(mechanicalStop({ instrument: "stock", entry: 100, last: 92.9 }).severity, "EXIT");
  assert.equal(mechanicalStop({ instrument: "stock", entry: 100, last: 94 }).severity, "OK");
  assert.equal(mechanicalStop({ instrument: "stock", entry: 100, last: 107.5, side: "short" }).severity, "EXIT");
  assert.equal(mechanicalStop({ instrument: "option", entry: 1, last: 0.5 }).severity, "INFO");
});
test("30/30: clock from thesis break; time or value, whichever first", () => {
  const base = { thesisBrokenAt: "2026-10-01", expiration: "2026-10-31", valueAtBreak: 2 };
  assert.equal(rule3030({ ...base, asOf: "2026-10-05", valueNow: 1.9 }).severity, "WARN");
  assert.equal(rule3030({ ...base, asOf: "2026-10-10", valueNow: 1.9 }).severity, "EXIT"); // 9/30 days
  assert.equal(rule3030({ ...base, asOf: "2026-10-02", valueNow: 1.4 }).severity, "EXIT"); // −30% day 2
  assert.equal(rule3030({ ...base, thesisBrokenAt: null, asOf: "2026-10-20", valueNow: 0.5 }).severity, "INFO");
});
test("multi-leg checklist blocks if anything is missing", () => {
  assert.equal(multiLegChecklist(1, undefined), null);
  assert.equal(multiLegChecklist(2, { maxLoss: 100, maxProfit: 400, breakevens: [101] })!.severity, "BLOCK");
  assert.equal(multiLegChecklist(2, { maxLoss: 100, maxProfit: 400, breakevens: [101], maxLossConditions: "≤100 at expiry", beforeExpiryPlan: "close at 21 DTE" })!.severity, "OK");
});
test("thesis stop: record required, rewrite blocked, invalidation exits", () => {
  const rec = { thesis: "FDA approval", invalidation: "CRL issued", recordedAt: "2026-10-01" };
  assert.equal(thesisStop(undefined, { invalidated: false })[0]!.severity, "BLOCK");
  assert.ok(thesisStop(rec, { thesis: "now it's a takeover play", invalidated: false }).some((s) => s.id === "thesis_changed" && s.severity === "BLOCK"));
  assert.ok(thesisStop(rec, { invalidated: true }).some((s) => s.severity === "EXIT"));
});
test("time and vol stops", () => {
  assert.equal(timeStop({ entryDate: "2026-10-01", windowDays: 5, asOf: "2026-10-08", followThrough: false }).severity, "WARN");
  assert.equal(timeStop({ entryDate: "2026-10-01", windowDays: 5, asOf: "2026-10-08", followThrough: true }).severity, "OK");
  assert.equal(timeStop({ entryDate: "2026-10-01", windowDays: 0, asOf: "2026-10-08", followThrough: true }).severity, "BLOCK");
  assert.equal(volStop({ premium: "long", ivEntry: 0.6, ivNow: 0.4, volThesis: "earnings" }).severity, "WARN");
  assert.equal(volStop({ premium: "short", ivEntry: 0.2, ivNow: 0.3, volThesis: "calm" }).severity, "WARN");
  assert.equal(volStop({ premium: "long", ivEntry: 0.3, ivNow: 0.29, volThesis: "x" }).severity, "OK");
});
test("overnight: near close, events, survivability, hedge suggestions", () => {
  const cal = [{ kind: "CPI", title: "CPI (BLS)", date: "2026-10-15", timeEt: "08:30" }];
  const r = overnightCheck({ nowEt: "2026-10-14T15:30", symbol: "INTC", capital: 10000, worstGapLoss: 500, macro: cal, earnings: [{ symbol: "INTC", date: "2026-10-14", timing: "AMC" }] });
  assert.equal(r.severity, "WARN"); assert.match(r.detail, /CPI/); assert.match(r.detail, /earnings/); assert.match(r.detail, /NOT survivable/);
  assert.ok(r.suggestions!.some((s) => /SPY/.test(s)));
  assert.equal(overnightCheck({ nowEt: "2026-10-14T11:00", symbol: "X", capital: 1e4, worstGapLoss: 1 }).severity, "INFO");
  assert.equal(overnightCheck({ nowEt: "2026-10-16T15:45", symbol: "X", capital: 1e4, worstGapLoss: 100 }).severity, "OK"); // Fri → Mon, no events
});
test("technical stop counts deteriorating signals", () => {
  const bars: Bar[] = []; for (let i = 0; i < 220; i++) { const c = i < 180 ? 50 + i * 0.3 : 104 - (i - 180) * 1.2; bars.push({ t: String(i), o: c, h: c + 0.5, l: c - 0.5, c, v: 1e6 }); }
  const r = technicalStop(bars); assert.equal(r.severity, "WARN", r.detail);
  assert.ok(technicalSignals(bars).filter((s) => s.deteriorating).length >= 3);
  const up: Bar[] = bars.slice(0, 180); assert.equal(technicalStop(up).severity, "INFO");
});
test("cost control and stop placement", () => {
  const cs = costAndStopChecks({ side: "long", entry: 100, structuralStop: 95, orderType: "market", capital: 10000, qty: 10, isOptionBuyer: true, ivRank: 90, recentRunPct: 30 });
  for (const id of ["limit_order", "chasing", "high_iv_buyer", "stop_hunting"]) assert.ok(cs.some((c) => c.id === id), id);
  assert.equal(cs.find((c) => c.id === "entry_risk")!.severity, "INFO");
  assert.equal(costAndStopChecks({ side: "long", entry: 100, structuralStop: 96.3, plannedStop: 93, orderType: "limit", capital: 1e5, qty: 1 }).find((c) => c.id === "stop_widened")!.severity, "BLOCK");
  assert.equal(stopMoveCheck("long", 95, 92).severity, "BLOCK"); assert.equal(stopMoveCheck("long", 95, 97).severity, "OK");
});
test("adding: one disciplined add on a loser, needs reason + thesis intact; never a second", () => {
  const lp = [{ type: "put" as const, strike: 30, qty: 1, premium: 1 }];
  const conf = { confirmed: true, evidence: "close below 31" };
  assert.equal(adjustmentPlaybookChecks(lp, 32, { action: "add", direction: "bearish", addPlan: AP, confirmation: conf, positionPnl: -100 }).find((c) => c.id === "losing_add_limit")!.severity, "BLOCK");
  const ok = adjustmentPlaybookChecks(lp, 32, { action: "add", direction: "bearish", addPlan: AP, confirmation: conf, positionPnl: -100, reason: "held key resistance; thesis intact", thesisIntact: true });
  assert.ok(!ok.some((c) => c.severity === "BLOCK"));
  assert.equal(adjustmentPlaybookChecks(lp, 32, { action: "add", direction: "bearish", addPlan: AP, confirmation: conf, positionPnl: -100, reason: "r", thesisIntact: true, losingAddsUsed: 1 }).find((c) => c.id === "losing_add_limit")!.severity, "BLOCK");
});
test("catalog cites the canonical stop-loss text; psych-30-30 resolved, no duplicate items", () => {
  const cat = JSON.parse(readFileSync(new URL("../knowledge/catalog.json", import.meta.url), "utf8")) as { items: Array<{ id: string; status: string; sources: string[] }> };
  const p = cat.items.find((i) => i.id === "psych-30-30")!; assert.equal(p.status, "RESOLVED_FROM_SOURCE"); assert.ok(p.sources.includes("mentor-stop-loss"));
  assert.equal(new Set(cat.items.map((i) => i.id)).size, cat.items.length);
  assert.equal(readFileSync(new URL("../knowledge/mentor/discipline/stop-loss.md", import.meta.url)).length, 15628);
});
