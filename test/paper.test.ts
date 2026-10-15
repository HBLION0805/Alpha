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
const A = { critique: CLEAN, thesis: "capex slowdown", invalidation: "INTC > 35", stop: "INTC > 35", motive: "thesis" as const, timeStopAt: "2026-11-06", now };

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
  for (let i = 0; i < 10; i++) j.entries.push({ ...paperOpen(j, prop(), A).entry!, id: `X${i}` });
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
  assert.match(m2.sources[0]!, /BS\(yahoo/); assert.ok(Math.abs(m2.pnl) < 5, "same spot+day ≈ entry value");
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
