import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRiskPlan, tightenOnly, renderRiskPlan } from "../src/options/riskplan.ts";
import { readiness } from "../src/options/readiness.ts";
import type { JournalEntry } from "../src/options/journal.ts";

const base = { capital: 50000, asOf: "2026-10-15", invalidation: "IWM 收盘 > 256", hedge: "built_in_spread", hedgeDetail: "short 235 put caps the cost" };
const pds = [{ type: "put" as const, strike: 245, qty: 1, premium: 4, expiration: "2026-12-14" }, { type: "put" as const, strike: 235, qty: -1, premium: 1.5, expiration: "2026-12-14" }];

test("risk plan: missing hedge / detail / invalidation → rejected, options suggest built_in_spread", () => {
  const r = buildRiskPlan(pds, { capital: 50000, asOf: "2026-10-15" });
  assert.equal(r.plan, null);
  assert.match(r.errors.join(), /--hedge.*建议 built_in_spread/);
  assert.match(r.errors.join(), /hedge-detail/); assert.match(r.errors.join(), /invalidation/);
  assert.match(buildRiskPlan(pds, { ...base, hedge: "hope" }).errors.join(), /无效/);
  assert.match(buildRiskPlan([pds[0]!], base).errors.join(), /没有卖出腿/);
});

test("risk plan (option): structure max loss, 30/30 date = 30% of remaining DTE, −30% value level; ≤1% hard cap", () => {
  const p = buildRiskPlan(pds, base).plan!;
  assert.equal(p.maxLoss, 250); assert.equal(p.option!.dteAtEntry, 60);
  assert.equal(p.option!.rule3030Date, "2026-11-02"); assert.equal(p.option!.loss30Value, 175); assert.equal(p.option!.loss30Pnl, -75);
  assert.match(renderRiskPlan(p), /哪个止损先触发.*永不放宽/);
  const big = pds.map((l) => ({ ...l, qty: l.qty * 3 }));
  assert.match(buildRiskPlan(big, base).errors.join(), /硬上限 1%/);
  assert.match(buildRiskPlan(pds, { ...base, rules: { sellerMaxLossPerTradePct: 5 } }).plan!.capPct.toString(), /^1$/, "cap never loosened");
});

test("risk plan (stock): mechanical −7% default + invalidation; built_in_spread not allowed; never widen", () => {
  const st = [{ type: "stock" as const, strike: 0, qty: 60, premium: 100 }];
  assert.match(buildRiskPlan(st, base).errors.join(), /股票不能用 built_in_spread/);
  const p = buildRiskPlan(st, { ...base, hedge: "direct", hedgeDetail: "protective 90 put" }).plan!;
  assert.equal(p.stock!.stopPct, 7); assert.equal(p.stock!.stopPrice, 93); assert.equal(p.maxLoss, 420);
  assert.match(buildRiskPlan([{ ...st[0]!, qty: 100 }], { ...base, hedge: "direct", hedgeDetail: "x" }).errors.join(), /硬上限/);
  assert.ok(tightenOnly(p, { stopPrice: 90 }), "lower stop on a long = widening");
  assert.equal(tightenOnly(p, { stopPrice: 95 }), null);
  assert.ok(tightenOnly(p, { maxLoss: 500 }));
});

test("practice trades are excluded from readiness and shown separately", () => {
  const t = (id: string, kind: "formal" | "practice", pnl: number) => ({ id, kind, mode: "paper", symbol: "SPY", strategy: "x", openedAt: "2026-10-01T14:00:00Z", closedAt: "2026-10-02T14:00:00Z", pnl, commissions: 0, maxLoss: 300, lossReview: { at: "x", errorClass: "judgment", errorTags: [] } }) as unknown as JournalEntry;
  const r = readiness({ journal: [t("A", "formal", 100), t("B", "practice", -400), t("C", "practice", 50)], capital: 50000, shockDates: [] });
  assert.equal(r.stats.paperClosed, 1); assert.equal(r.stats.ev, 100);
  const { bySource, ...pr } = r.practice; assert.deepEqual(pr, { n: 2, closed: 2, ev: -175, total: -350 }); assert.equal(bySource!.paper_sim!.n, 2);
});
