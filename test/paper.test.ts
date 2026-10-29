import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { paperOpen, paperMark, paperClose, type PaperJournal } from "../src/options/paper.ts";
import { readiness } from "../src/options/readiness.ts";

const now = new Date("2026-10-15T14:00:00Z");
const prop = () => ({ symbol: "INTC", strategy: "long_put", asOf: "2026-10-15", underlyingPrice: 32, thesisHorizonDays: 20, capital: 50000, buyingPower: 20000,
  legs: [{ type: "put", strike: 30, qty: 2, premium: 0.8, expiration: "2026-12-18", openInterest: 5000, bid: 0.78, ask: 0.82 }],
  discipline: { journal: [], openPnlToday: 0, session: { emotion: "ok", sleep: "ok", health: "ok", lifeEvents: "ok" }, market: { lowVolume: false, unclearDirection: false, chop: false, poorRR: false }, plannedMaxLoss: 200, entryRange: { low: 31, high: 33 }, side: "short" } }) as never;
const CLEAN = { at: "x", objections: [], blocks: 0, warns: 0 };
const A = { scenarioPlan: { at: "2026-01-01T00:00:00Z", source: "user" as const, rows: [{ id: "crash" as const, action: "止盈" }, { id: "flat" as const, action: "时间止损" }, { id: "rally" as const, action: "止损" }] }, hedge: "portfolio", hedgeDetail: "SPY 30d 5% OTM put spread already held", critique: CLEAN, thesis: "capex slowdown", invalidation: "INTC > 35", stop: "INTC > 35", motive: "thesis" as const, timeStopAt: "2026-11-06", tp: "narrative", planId: "2026-10-15-INTC-short", plan: [{ id: "2026-10-15-INTC-short", ticker: "INTC", side: "short", entryZone: [31, 33] }] as never, now };

test("paper open: requires thesis/invalidation/stop/motive and refuses on BLOCK", () => {
  const j: PaperJournal = { capital: 50000, entries: [] };
  assert.equal(paperOpen(j, prop(), { now }).entry, null);
  assert.equal(paperOpen(j, prop(), { ...A, critique: undefined }).entry, null, "critique required");
  const W = { at: "x", objections: [{ id: "thesis_weak", severity: "WARN" as const, text: "t", cite: "c" }], blocks: 0, warns: 1 };
  assert.ok(paperOpen(j, prop(), { ...A, critique: W }).refused.some((x) => /--ack/.test(x)));
  const acked = paperOpen(j, prop(), { ...A, critique: W, ack: true }).entry!;
  assert.equal(acked.critique!.acked, true);
  assert.equal(paperOpen(j, prop(), { ...A, critique: { ...W, objections: [{ ...W.objections[0]!, severity: "BLOCK" as const }], blocks: 1, warns: 0 }, ack: true }).entry, null, "BLOCK is not ackable");
  assert.equal(paperOpen(j, prop(), { ...A, motive: "share" }).entry, null, "motive BLOCK");
  const r = paperOpen(j, prop(), A);
  assert.ok(r.entry, r.refused.join("; "));
  assert.equal(r.entry!.mode, "paper");
  assert.equal(r.entry!.legs![0]!.premium, 0.8, "mid fill");
  assert.ok(r.entry!.thesisRecordedAt! <= r.entry!.openedAt && r.entry!.maxLoss === 160);
});

test("paper open: position cap from journal (10 open → refused)", () => {
  const j: PaperJournal = { capital: 50000, entries: [] };
  // earlier days, so the daily NEW-risk cap (riskCap.ts) does not trip before the concurrency cap
  for (let i = 0; i < 10; i++) { const r0 = paperOpen(j, prop(), A); assert.ok(r0.entry, r0.refused.join("; ")); j.entries.push({ ...r0.entry!, id: `X${i}`, openedAt: `2026-09-${String(10 + i).padStart(2, "0")}T15:00:00Z` }); }
  const r = paperOpen(j, prop(), A);
  assert.equal(r.entry, null);
  assert.ok(r.refused.some((x) => /max_concurrent_positions/.test(x)));
});

test("paper mark: Robinhood chain mark when present, else BS on Yahoo spot; close demands exit kind + loss review; feeds readiness", async () => {
  const j: PaperJournal = { capital: 50000, entries: [] };
  const e = paperOpen(j, prop(), A).entry!; j.entries.push(e);
  const chain = { symbol: "INTC", underlyingPrice: 31, asOf: "2026-10-16", contracts: [{ expiration: "2026-12-18", strike: 30, type: "put", bid: 1.1, ask: 1.3, mark: 1.2, iv: 0.4, delta: null, gamma: null, theta: null, vega: null, openInterest: 1, volume: 1 }] } as never;
  const m1 = await paperMark(e, { spot: async () => 31, chains: [chain] }, new Date("2026-10-16T15:00:00Z"));
  assert.equal(m1.pnl, 80); assert.match(m1.sources[0]!, /robinhood/);
  const m2 = await paperMark(e, { spot: async () => 32, chains: [] }, now);
  assert.match(m2.sources[0]!, /BS估算\(yahoo/); assert.ok(Math.abs(m2.pnl) < 5, "same spot+day ≈ entry value");
  assert.ok(paperClose(e, { now, pnl: -50 }).refused.some((x) => /exit-kind/.test(x)));
  assert.ok(paperClose(e, { now, pnl: -50, exitKind: "discretionary" }).refused.some((x) => /复盘/.test(x)));
  const c = paperClose(e, { now: new Date("2026-10-20T15:00:00Z"), pnl: -50, exitKind: "discretionary", errorClass: "execution", errorTags: ["early_exit"] }).entry!;
  const r = readiness({ journal: [c], capital: 50000, shockDates: [] });
  assert.equal(r.stats.paperClosed, 1); assert.equal(r.stats.premature, 1);
  assert.doesNotMatch(readFileSync("src/cli/paper.ts", "utf8") + readFileSync("src/options/paper.ts", "utf8"), /place_|order\(|Robinhood\.|cancel_/, "no order path");
});

test("readiness counts losses that followed --ack'ed critique warnings", () => {
  const j: PaperJournal = { capital: 50000, entries: [] };
  const W = { at: "x", objections: [{ id: "fomo_gap", severity: "WARN" as const, text: "t", cite: "c" }], blocks: 0, warns: 1 };
  const e = paperOpen(j, prop(), { ...A, critique: W, ack: true }).entry!;
  const c = paperClose(e, { now: new Date("2026-10-20T15:00:00Z"), pnl: -80, exitKind: "invalidation", errorClass: "judgment", errorTags: ["ignored_warning"] }).entry!;
  const r = readiness({ journal: [c], capital: 50000, shockDates: [] });
  assert.equal(r.stats.ignoredWarnLosses, 1);
  assert.match(r.criteria.find((x) => x.id === "loss_review")!.detail.join(), /fomo_gap/);
});

test("formal paper trades must come from today's brief §2.1 plan; practice is exempt", async () => {
  const { checkPlanLink } = await import("../src/options/planlink.ts");
  const plan = [{ id: "2026-10-15-INTC-short", ticker: "INTC", side: "short", entryZone: [31, 33] }] as never;
  const base = { kind: "formal" as const, plan, symbol: "INTC", side: "short" as const, spot: 32, todayEt: "2026-10-15" };
  assert.deepEqual(checkPlanLink({ ...base, planId: "2026-10-15-INTC-short" }), []);
  assert.match(checkPlanLink(base)[0]!, /--plan-id/);
  assert.match(checkPlanLink({ ...base, planId: "2026-10-14-INTC-short" })[0]!, /不是今天/);
  assert.match(checkPlanLink({ ...base, planId: "2026-10-15-SPY-long" })[0]!, /没有/);
  assert.match(checkPlanLink({ ...base, planId: "2026-10-15-INTC-short", spot: 35 })[0]!, /进场区间/);
  assert.match(checkPlanLink({ ...base, planId: "2026-10-15-INTC-short", side: "long" })[0]!, /方向/);
  assert.deepEqual(checkPlanLink({ ...base, kind: "practice" }), []);
  const j = { capital: 50000, entries: [] };
  assert.ok(paperOpen(j, prop(), { ...A, planId: undefined }).refused.some((x) => /--plan-id/.test(x)));
  assert.equal(paperOpen(j, prop(), { ...A, planId: undefined, kind: "practice" }).entry, null, "practice needs a saved card");
  const e = paperOpen(j, prop(), { ...A, planId: undefined, kind: "practice", card: CARD }).entry!;
  assert.ok(e); assert.ok(!e.warnTags?.includes("warn_off_plan")); // practice is exempt from plan link entirely
});

const CARD = { id: "card-1", sym: "INTC", dir: "bear" as const, thesis: "capex slowdown", trade: { mechanical: "30/30", invalidationLevel: 35, tpKind: "narrative" } };
test("practice: only the plan card is hard; caps/hedge/critique become warn tags; formal stays strict", () => {
  const j: PaperJournal = { capital: 5000, entries: [] }; // 2×$80 = $160 > $50 cap
  const BLK = { at: "x", objections: [{ id: "trend_unconfirmed", severity: "BLOCK" as const, text: "t", cite: "c" }], blocks: 1, warns: 0 };
  const strict = paperOpen(j, prop(), { ...A, hedge: undefined, critique: BLK });
  assert.equal(strict.entry, null); assert.ok(strict.refused.some((x) => /硬上限/.test(x)));
  const pr = paperOpen(j, prop(), { now, kind: "practice", card: CARD, critique: BLK });
  assert.ok(pr.entry, pr.refused.join("|"));
  for (const t of ["warn_over_cap", "warn_no_hedge", "warn_trend_unconfirmed"]) assert.ok(pr.entry!.warnTags!.includes(t), `${t} in ${pr.entry!.warnTags}`);
  assert.ok(pr.entry!.violations!.includes("exceeds_1pct_cap")); // cap breach still recorded for reviews
  assert.equal(pr.entry!.thesis, "capex slowdown"); assert.equal(pr.entry!.cardId, "card-1");
  const bad = paperOpen(j, prop(), { now, kind: "practice", card: { ...CARD, thesis: "", trade: { mechanical: null, invalidationLevel: null, tpKind: null } }, critique: CLEAN });
  assert.equal(bad.entry, null); assert.ok(bad.refused.some((x) => /论点/.test(x)) && bad.refused.some((x) => /止损/.test(x)) && bad.refused.some((x) => /止盈/.test(x)));
  assert.equal(paperOpen(j, prop(), { now, kind: "practice", card: { ...CARD, sym: "NVDA" }, critique: CLEAN }).entry, null);
});
test("warnTag mapping", async () => {
  const { warnTag } = await import("../src/options/paper.ts");
  assert.equal(warnTag("唱反调 BLOCK strikes_far_otm: 计划外"), "warn_far_otm");
  assert.equal(warnTag("BLOCK max_concurrent_positions: 10"), "warn_position_cap");
  assert.equal(warnTag("缺少 --hedge（…）"), "warn_no_hedge");
  assert.equal(warnTag("单笔最大亏损 $160（3.2%）> 硬上限 1%（$50）→ 减少数量"), "warn_over_cap");
  assert.equal(warnTag("现价 35 不在计划进场区间 31–33（纪律 #07 不追）"), "warn_off_plan");
});
test("scenario plan required at entry: formal BLOCK, practice → violation + warn tag; confidence cap recorded", () => {
  const j: PaperJournal = { capital: 5000, entries: [] };
  const noPlan = { ...A, scenarioPlan: undefined };
  assert.ok(paperOpen(j, prop(), noPlan).refused.some((x) => /情景计划/.test(x)));
  const pr = paperOpen(j, prop(), { now, kind: "practice", card: CARD, critique: CLEAN }).entry!;
  assert.ok(pr.violations?.includes("no_scenario_plan_at_entry")); assert.ok(pr.warnTags?.includes("warn_no_scenario_plan"));
  const ok = paperOpen(j, prop(), A).entry; if (ok) assert.equal(ok.confidence?.capUsd, 50);
});

test("paper open: daily NEW risk — Σ defined max loss of today's opens + this trade ≤ today's cap (review #21)", () => {
  const j: PaperJournal = { capital: 50000, entries: [] };
  for (let i = 0; i < 2; i++) { const r0 = paperOpen(j, prop(), A); assert.ok(r0.entry, r0.refused.join("; ")); j.entries.push({ ...r0.entry!, id: `N${i}`, maxLoss: 450 }); }
  // 2026-10-15 is before 10-30 → 2% of $50k = $1,000; opened $900 + this $160 = $1,060 → refused
  const r = paperOpen(j, prop(), A);
  assert.equal(r.entry, null); assert.ok(r.refused.some((x) => /daily_new_risk.*\$900 \+ this \$160 = \$1060 > daily cap \$1000/.test(x)), r.refused.join("|"));
  // same two trades opened the previous ET day → today's new risk is just this trade
  for (const e of j.entries) e.openedAt = "2026-10-14T15:00:00Z";
  assert.ok(paperOpen(j, prop(), A).entry);
});
