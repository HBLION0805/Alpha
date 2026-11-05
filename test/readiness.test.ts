import { test } from "node:test";
import assert from "node:assert/strict";
import { readiness, renderReadiness, isPremature } from "../src/options/readiness.ts";
import type { JournalEntry } from "../src/options/journal.ts";

const d = (n: number) => new Date(Date.UTC(2026, 6, 1 + n)).toISOString();
function trade(i: number, pnl: number, over: Partial<JournalEntry> = {}): JournalEntry {
  return { id: `T${i}`, mode: "paper", symbol: "SPY", strategy: "put_debit_spread", openedAt: d(i * 2 + 1), closedAt: d(i * 2 + 2), pnl, commissions: 0,
    thesisRecordedAt: d(i * 2), stopRecordedAt: d(i * 2), view: { direction: "x", volatility: "x" }, ivRank: null, greeks: { delta: 0, gamma: 0, theta: 0, vega: 0 },
    expectedMove: null, structureRationale: "x", maxLoss: 400, invalidation: "x", exitRules: ["x"], exitKind: pnl > 0 ? "take_profit" : "invalidation",
    concurrentAtEntry: 4, motive: "thesis", ...(pnl <= 0 ? { lossReview: { at: d(i * 2 + 3), errorClass: i % 2 ? "judgment" : "execution", errorTags: [] } } : { postMortem: { at: d(i * 2 + 3), outcome: "win", classification: "good", tags: [], lesson: "x", followed: { stop: true, takeProfit: true, size: true } } }), ...over } as JournalEntry;
}
const good = () => Array.from({ length: 32 }, (_, i) => trade(i, i % 3 === 0 ? 300 : -100)); // 11 wins, 21 losses, 64 days
const shock = [d(10).slice(0, 10)];

test("readiness: a clean 32-trade/64-day paper record with a shock day and positive robust EV passes — low win rate is fine", () => {
  const r = readiness({ journal: good(), capital: 50000, shockDates: shock });
  assert.ok(r.criteria.every((c) => c.pass), JSON.stringify(r.criteria.filter((c) => !c.pass)));
  assert.ok(r.ready && Number(r.stats.winRate) < 0.4);
  assert.match(renderReadiness(r), /1\/4 仓位/);
});

test("readiness: each criterion fails on its own and says what is missing", () => {
  const C = (j: JournalEntry[], s = shock) => Object.fromEntries(readiness({ journal: j, capital: 50000, shockDates: s }).criteria.map((c) => [c.id, c]));
  assert.equal(C(good().slice(0, 20)).sample!.pass, false);
  assert.match(C(good(), []).sample!.missing.join(), /冲击/);
  const lucky = good().map((t, i) => ({ ...t, pnl: i === 0 || i === 3 ? 5000 : i % 3 === 0 ? 20 : -100 }));
  const ex = C(lucky).expectancy!; assert.equal(ex.pass, false); assert.match(ex.missing.join(), /去掉最大 2 笔/);
  const big = good(); big[1] = { ...big[1]!, pnl: -600 }; assert.equal(C(big).loss_caps!.pass, false);
  const live = good().map((t) => ({ ...t, mode: "live" as const })); assert.equal(C(live).sample!.pass, false, "live trades never count");
  const v = good(); v[2] = { ...v[2]!, violations: ["chasing"] }; v[4] = { ...v[4]!, motive: "share" }; assert.equal(C(v).discipline!.pass, false);
  const late = good(); late[5] = { ...late[5]!, stopRecordedAt: d(30) }; assert.equal(C(late).discipline!.pass, false, "stop written after entry");
  const unrev = good(); delete (unrev[1] as Partial<JournalEntry>).lossReview; assert.equal(C(unrev).loss_review!.pass, false);
  const rep = good().map((t) => (t.lossReview ? { ...t, lossReview: { ...t.lossReview, errorTags: ["late_entry"] } } : t));
  assert.match(C(rep).loss_review!.detail.join(), /重复错误：late_entry×21/);
});

test("readiness: premature exit = discretionary exit before invalidation and before the time stop", () => {
  const t = trade(1, -50, { exitKind: "discretionary", timeStopAt: d(20) });
  assert.equal(isPremature(t), true);
  assert.equal(isPremature({ ...t, timeStopAt: d(1) }), false);
  assert.equal(isPremature({ ...t, exitKind: "invalidation" }), false);
  const r = readiness({ journal: [...good(), t], capital: 50000, shockDates: shock });
  assert.equal(r.stats.premature, 1);
});

test("real_practice NVDA entry is excluded from readiness, counted under practice", async () => {
  const { readFileSync } = await import("node:fs");
  const e = JSON.parse(readFileSync(new URL("../examples/journal/nvda-practice-2026-10-14.json", import.meta.url), "utf8")) as JournalEntry;
  assert.equal(e.kind, "practice"); assert.equal(e.source, "real_practice");
  const base = readiness({ journal: good(), capital: 50000, shockDates: shock });
  const r = readiness({ journal: [...good(), e], capital: 50000, shockDates: shock });
  assert.deepEqual(r.stats, base.stats); assert.equal(r.ready, base.ready); assert.equal(r.practice.n, base.practice.n + 1);
});

test("mentor_shadow practice entries are excluded from readiness", () => {
  const e = { ...good()[0]!, id: "shadow", kind: "practice", source: "mentor_shadow", pnl: -160 } as JournalEntry;
  const base = readiness({ journal: good(), capital: 5000, shockDates: shock });
  const r = readiness({ journal: [...good(), e], capital: 5000, shockDates: shock });
  assert.deepEqual(r.stats, base.stats); assert.equal(r.practice.n, base.practice.n + 1);
});

test("post-mortem: wins need one too; luck can't excuse a loss; repeated tags feed the next critique; mentor compare", async () => {
  const { writePostMortem, pastMistakes, mentorCompare } = await import("../src/options/postmortem.ts");
  const now = new Date("2026-10-16T21:00:00Z");
  const win = { ...good()[0]!, postMortem: undefined } as JournalEntry;
  const r = readiness({ journal: [...good().slice(1), win], capital: 50000, shockDates: shock });
  assert.ok(r.criteria.find((c) => c.id === "loss_review")!.missing.some((m) => /盈利也要复盘/.test(m)));
  assert.ok(writePostMortem({ ...win, closedAt: undefined }, { classification: "good", lesson: "x", now }).refused.length, "not closed yet");
  const loss = trade(99, -20, { lossReview: undefined });
  assert.ok(writePostMortem(loss, { classification: "luck", lesson: "x", now }).refused.some((x) => /luck/.test(x)));
  const ok = writePostMortem(loss, { classification: "execution", tags: ["no_pre_set_take_profit"], lesson: "止盈必须开仓时写死。", now }).entry!;
  assert.equal(ok.lossReview!.errorClass, "execution"); assert.equal(ok.postMortem!.outcome, "loss");
  assert.deepEqual(pastMistakes([ok], "SPY").tags, [["no_pre_set_take_profit", 1]]);
  const m = { ...trade(5, 40), source: "mentor_shadow", entryPrice: 1.6, mentorOutcome: { at: "x", result: "win", pnlPct: 80 } } as JournalEntry;
  const L = mentorCompare(m).join("\n");
  assert.match(L, /\$40（25%）/); assert.match(L, /大佬实际：win（80%）/); assert.match(L, /方向一致：是/);
});

test("readiness P2: 6% max drawdown, top-2 outlier share, 90-day window", () => {
  const C = (j: JournalEntry[], cap = 50000) => Object.fromEntries(readiness({ journal: j, capital: cap, shockDates: shock }).criteria.map((c) => [c.id, c]));
  // 5k capital: a −$100 losing streak of 4 = $400 drawdown > $300 (6%)
  const dd = C(good().map((t, i) => (i >= 4 && i < 8 ? { ...t, pnl: -100, maxLoss: 40, lossReview: { at: "x", errorClass: "execution", errorTags: [] } } : { ...t, maxLoss: 40 })) as JournalEntry[], 5000).loss_caps!;
  assert.ok(dd.missing.some((m) => /最大回撤/.test(m)));
  const big = good(); big[0] = { ...big[0]!, pnl: 5000 };
  assert.ok(C(big).expectancy!.missing.some((m) => /离群值/.test(m)));
  const old = trade(-100, 300, { openedAt: "2026-01-01T00:00:00Z", closedAt: "2026-01-02T00:00:00Z" });
  assert.match(C([old, ...good()]).sample!.detail[0]!, /全部 33/);
});
