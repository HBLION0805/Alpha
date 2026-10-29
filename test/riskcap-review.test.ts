// PR #21 review follow-ups: daily NEW-risk cap, override min, dashboard override, ET dates, per-day equity, placeholder stops
import { test } from "node:test";
import assert from "node:assert/strict";
import { etDate, dailyRiskCapPct, hasDefinedRisk, definedRiskUsd, newRiskOpened, newRiskCheck, equityAtStartOf } from "../src/options/riskCap.ts";
import { disciplineChecks } from "../src/options/pretrade.ts";
import { capFlags } from "../src/options/breach.ts";
import { dailyBudget } from "../src/review/card.ts";
import { readiness } from "../src/options/readiness.ts";
import { buildDashboard } from "../src/options/readinessDashboard.ts";
import { autoSins } from "../src/options/sins.ts";
import { renderReview } from "../src/options/reviewreport.ts";
import { selectReminders } from "../src/review/mentor.ts";
import type { JournalEntry } from "../src/options/journal.ts";

const E = (o: Partial<JournalEntry> & { id: string; openedAt: string }) => ({ mode: "paper", kind: "formal", source: "paper_sim", symbol: "SPY", strategy: "pds", stop: "−50% of debit", maxLoss: 100, thesis: "t", invalidation: "i",
  thesisRecordedAt: o.openedAt, stopRecordedAt: o.openedAt, commissions: 0, ...o }) as JournalEntry;

test("etDate: bare dates pass through; ISO timestamps convert to ET (near midnight UTC)", () => {
  assert.equal(etDate("2026-10-30"), "2026-10-30");
  assert.equal(etDate("2026-10-30T02:30:00Z"), "2026-10-29", "22:30 ET on 10-29");
  assert.equal(etDate("2026-10-31T03:59:00Z"), "2026-10-30");
  assert.equal(etDate("2026-10-31T04:01:00Z"), "2026-10-31");
  assert.equal(etDate("2026-10-30T23:30:00-04:00"), "2026-10-30");
  assert.equal(dailyRiskCapPct("2026-10-30T02:30:00Z", 5000), 2, "still 10-29 in ET → 2%");
  assert.equal(dailyRiskCapPct("2026-10-30T04:30:00Z", 5000), 10);
});

test("hasDefinedRisk: placeholder stops are not a hard stop", () => {
  for (const s of ["", "  ", "无", "没有", "none", "None", "N/A", "n/a", "na", "-", "—", "--", "?", "tbd", "not recorded (backfill)"]) {
    assert.equal(hasDefinedRisk({ stop: s }), false, JSON.stringify(s)); assert.equal(definedRiskUsd({ stop: s, maxLoss: null }), null);
  }
  assert.equal(hasDefinedRisk({ stop: "收盘跌破 580" }), true);
  assert.equal(hasDefinedRisk({ stop: "无", maxLoss: 120 }), true, "fixed max loss still defines the risk");
  assert.equal(definedRiskUsd({ stop: "none", maxLoss: 120 }), 120);
});

test("new risk: summed across several entries in one ET day; a near-midnight-UTC open lands on its ET day; real_practice / undefined risk excluded", () => {
  const xs = [E({ id: "a", openedAt: "2026-10-30T13:45:00Z", maxLoss: 150 }), E({ id: "b", openedAt: "2026-10-30T17:00:00Z", maxLoss: 120 }),
    E({ id: "c", openedAt: "2026-10-31T02:30:00Z", maxLoss: 100 }), // 22:30 ET on 10-30
    E({ id: "d", openedAt: "2026-10-30T02:30:00Z", maxLoss: 999 }), // 22:30 ET on 10-29
    E({ id: "r", openedAt: "2026-10-30T15:00:00Z", maxLoss: 500, source: "real_practice" }),
    E({ id: "u", openedAt: "2026-10-30T15:30:00Z", maxLoss: undefined, stop: "无" })];
  const n = newRiskOpened(xs, "2026-10-30");
  assert.equal(n.usd, 370); assert.deepEqual(n.ids, ["a", "b", "c"]); assert.deepEqual(n.undefinedIds, ["u"]);
  assert.equal(newRiskOpened(xs, "2026-10-29").usd, 999);
  // 10-30 cap on $5k = $500: 370 + 130 = 500 OK; + 131 → over
  assert.equal(newRiskCheck({ entries: xs, day: "2026-10-30", equity: 5000, proposedUsd: 130 }).ok, true);
  const over = newRiskCheck({ entries: xs, day: "2026-10-30", equity: 5000, proposedUsd: 131 });
  assert.equal(over.ok, false); assert.equal(over.total, 501); assert.equal(over.cap, 500); assert.equal(over.remaining, 130);
  assert.equal(newRiskCheck({ entries: xs, day: "2026-10-30", equity: 5000, proposedUsd: null }).ok, false, "no defined max loss → cannot fit");
  assert.equal(newRiskCheck({ entries: xs, day: "2026-10-30", equity: 5000, proposedUsd: 100, rules: { dailyLossLimitPct: 5 } }).ok, false, "5% card → $250 < 470");
});

test("pretrade: daily_new_risk BLOCK is separate from the realized-loss daily_loss_limit", () => {
  const journal = [{ id: "a", openedAt: "2026-10-30T14:00:00Z", maxLoss: 250, stop: "s" }, { id: "b", openedAt: "2026-10-30T15:00:00Z", maxLoss: 200, stop: "s" }, { id: "y", openedAt: "2026-10-29T15:00:00Z", maxLoss: 400, stop: "s" }];
  const p = (proposed: number) => disciplineChecks({ symbol: "SPY", strategy: "pds", asOf: "2026-10-30", legs: [], capital: 5000, discipline: { journal, todayEt: "2026-10-30", openPnlToday: 0 } } as never, proposed);
  const ok = p(50), bad = p(51);
  assert.equal(ok.find((c) => c.id === "daily_new_risk")!.severity, "OK");
  assert.equal(bad.find((c) => c.id === "daily_new_risk")!.severity, "BLOCK"); assert.match(bad.find((c) => c.id === "daily_new_risk")!.detail, /\$450 \+ this \$51 = \$501 > daily cap \$500/);
  assert.equal(bad.find((c) => c.id === "daily_loss_limit")!.severity, "OK", "no realized loss → the loss stop is untouched");
});

test("live breach + plan-card budget + mentor reminder see today's NEW risk", () => {
  const now = new Date("2026-10-30T18:00:00Z"), xs = [E({ id: "a", openedAt: "2026-10-30T14:00:00Z", maxLoss: 300 }), E({ id: "b", openedAt: "2026-10-30T15:00:00Z", maxLoss: 250 })];
  assert.ok(capFlags(xs.map((x) => ({ ...x, maxLoss: x.maxLoss, confidence: { tier: "highest", pct: 2, capUsd: 1000, equity: 5000 } })) as never, 5000, now).some((x) => /今日新开风险 \$550（a, b）> 日上限 \$500/.test(x)));
  const b = dailyBudget(xs, 5000, now); assert.equal(b.newRisk, 550); assert.equal(b.newRiskRemaining, 0); assert.equal(b.remaining, 500, "no realized loss");
  assert.equal(dailyBudget(xs, 5000, now, 2).newRiskRemaining, 0); assert.equal(dailyBudget([], 5000, now, 2).remaining, 100, "explicit pct lowers");
  assert.equal(dailyBudget([], 5000, now, 20).remaining, 500, "explicit pct cannot raise the dated cap");
  const rem = selectReminders({ now: new Date("2026-10-30T19:00:00Z"), verdict: "RESEARCH_OK", leader: "base", previousLeader: "base", regime: "MIXED", previousRegime: "MIXED", events: [], journal: xs, capital: 5000 });
  assert.match(rem.find((r) => r.id === "wrath_stop")!.why, /今日新开风险 \$550 已到日上限 \$500/);
});

test("readiness: each day's NEW risk against that day's cap (separate from realized loss)", () => {
  const j = [E({ id: "a", openedAt: "2026-10-29T14:00:00Z", closedAt: "2026-10-29T19:00:00Z", pnl: 10, maxLoss: 90 }),
    E({ id: "b", openedAt: "2026-10-29T15:00:00Z", closedAt: "2026-10-29T19:00:00Z", pnl: 10, maxLoss: 20 }), // 10-29: $110 > 2% of $5k
    E({ id: "c", openedAt: "2026-10-30T14:00:00Z", closedAt: "2026-10-30T19:00:00Z", pnl: 5, maxLoss: 300 }),
    E({ id: "d", openedAt: "2026-10-30T15:00:00Z", closedAt: "2026-10-30T19:00:00Z", pnl: 5, maxLoss: 200 })]; // 10-30: $500 ≤ 10% of $5,020
  const lc = readiness({ journal: j, capital: 5000, shockDates: [] }).criteria.find((c) => c.id === "loss_caps")!;
  assert.deepEqual(lc.missing.filter((m) => /新开风险/.test(m)), ["2026-10-29 当日新开风险 $110 > 当天上限 $100"]);
  assert.ok(!lc.pass); assert.ok(!lc.missing.some((m) => /单日亏/.test(m)), "all winners: no realized-loss breach");
});

test("dashboard: explicit dailyCapPct = min(dated cap on that day's equity, override); new-risk breaches listed", () => {
  const j = [E({ id: "w", openedAt: "2026-10-28T14:00:00Z", closedAt: "2026-10-28T19:00:00Z", pnl: 1000, maxLoss: 80 }),
    E({ id: "l", openedAt: "2026-10-30T14:00:00Z", closedAt: "2026-10-30T19:00:00Z", pnl: -400, maxLoss: 450 })];
  // 10-30 equity before = $6,000 → dated 10% = $600; override 5% → min → $300 (was: 5% of starting capital $250)
  assert.deepEqual(buildDashboard(j, 5000, new Date("2026-10-31T12:00:00Z"), { dailyCapPct: 5 }).capBreaches.daily, [{ day: "2026-10-30", loss: 400 }]);
  assert.deepEqual(buildDashboard(j, 5000, new Date("2026-10-31T12:00:00Z"), { dailyCapPct: 7 }).capBreaches.daily, [], "7% of $6,000 = $420 > $400");
  assert.deepEqual(buildDashboard(j, 5000, new Date("2026-10-31T12:00:00Z"), { dailyCapPct: 50 }).capBreaches.daily, [], "override never raises");
  assert.deepEqual(buildDashboard(j, 5000, new Date("2026-10-31T12:00:00Z"), { dailyCapPct: 5 }).capBreaches.newRisk, [{ day: "2026-10-30", risk: 450, cap: 300 }]);
  assert.deepEqual(buildDashboard(j, 5000, new Date("2026-10-31T12:00:00Z")).capBreaches.newRisk, []);
});

test("sins + review report use that day's equity and that day's cap", () => {
  const win = E({ id: "w", openedAt: "2026-10-28T14:00:00Z", closedAt: "2026-10-28T19:00:00Z", pnl: 2000 });
  assert.equal(equityAtStartOf([win], 5000, "2026-10-30"), 7000); assert.equal(equityAtStartOf([win], 5000, "2026-10-28"), 5000);
  const md = renderReview([win, E({ id: "x", openedAt: "2026-10-30T14:00:00Z", maxLoss: 100 })], 5000, "2026-10-30", "2026-10-30");
  assert.match(md, /2026-10-30 日上限 \$700/, "10% of $7,000, not of starting $5,000");
  // 色欲: the open that pushes the day's new risk over the cap (10-30, equity $7,000 → $700)
  const a = E({ id: "a", openedAt: "2026-10-30T14:00:00Z", maxLoss: 400 }), b = E({ id: "b", openedAt: "2026-10-30T15:00:00Z", maxLoss: 350 });
  assert.ok(!autoSins(a, [win, a, b]).some((s) => s.sin === "lust" && /新开风险/.test(s.reason)));
  assert.match(autoSins(b, [win, a, b]).find((s) => s.sin === "lust")!.reason, /当天新开风险 \$750 > 日上限 \$700/);
  // wrath-after-breach on that day's equity: −$600 realized on 10-30 is under $700 (would breach $500 on starting capital)
  const loss = E({ id: "L", openedAt: "2026-10-30T13:35:00Z", closedAt: "2026-10-30T13:50:00Z", pnl: -600 }), later = E({ id: "z", openedAt: "2026-10-30T19:00:00Z", maxLoss: 50 });
  assert.ok(!(autoSins(later, [win, loss, later]).find((s) => s.sin === "wrath")?.reason ?? "").includes("已超日亏上限"));
});
