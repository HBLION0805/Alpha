import { test } from "node:test";
import assert from "node:assert/strict";
import { legIv, chainsFromQuotes, paperMark, IV_MIN } from "../src/options/paper.ts";
import { expireEntry, settleable, weekendRule } from "../src/options/expire.ts";
import type { JournalEntry } from "../src/options/journal.ts";

const E = (o: Partial<JournalEntry>): JournalEntry => ({ id: "t", openedAt: "2026-10-15T14:35:00Z", symbol: "NVDA", strategy: "call_debit_spread", mode: "paper", kind: "practice",
  view: { direction: "", volatility: "" }, ivRank: null, greeks: { delta: 0, gamma: 0, theta: 0, vega: 0 }, expectedMove: null, structureRationale: "", maxLoss: 160, invalidation: "", exitRules: [],
  underlyingAtEntry: 216, legs: [{ underlying: "NVDA", type: "call", strike: 220, qty: 1, premium: 1.6, expiration: "2026-10-23" }, { underlying: "NVDA", type: "call", strike: 225, qty: -1, premium: 0, expiration: "2026-10-23" }], ...o });

test("BS fallback IV is sane: never solved from a 0 premium, clamped, prefers quote IV", () => {
  const e = E({});
  const short = legIv(e, e.legs![1]!, null, 217);
  assert.equal(short.from, "default"); assert.ok(short.iv >= IV_MIN);
  assert.equal(legIv(e, e.legs![0]!, 0.36, 217).from, "quote");
  assert.equal(legIv(e, e.legs![0]!, 0.01, 217).iv, IV_MIN);
});

test("paper mark prefers Robinhood quotes; BS-only marks are flagged estimated; unknown entry price refuses", async () => {
  const chains = chainsFromQuotes({ fetchedAt: "x", quotes: [{ underlying: "NVDA", type: "call", strike: 220, expiration: "2026-10-23", mark: 3.5, bid: 3.45, ask: 3.55, iv: 0.36 }, { underlying: "NVDA", type: "call", strike: 225, expiration: "2026-10-23", mark: 1.82, bid: 1.8, ask: 1.84, iv: 0.36 }] });
  const now = new Date("2026-10-15T20:00:00Z"), spot = async () => 217.23;
  const m = await paperMark(E({}), { spot, chains }, now);
  assert.equal(m.pnl, 8); assert.equal(m.estimated, false);
  const b = await paperMark(E({}), { spot, chains: [] }, now);
  assert.equal(b.estimated, true); assert.ok(b.sources.every((s) => /BS估算/.test(s)));
  assert.ok(b.pnl < 45, "the short leg is no longer priced at ~0 (old bug: +$45)");
  await assert.rejects(paperMark(E({ legs: [{ type: "put", strike: 55, qty: 1, premium: null as never, expiration: "2026-10-16" }] }), { spot, chains: [] }, now), /entry price unknown/);
});

test("paper expire: PM close after 16:00 ET on expiry; VIX AM needs explicit VRO", () => {
  const crwv = E({ symbol: "CRWV", legs: [{ underlying: "CRWV", type: "put", strike: 55, qty: 1, premium: 0.17, expiration: "2026-10-16" }, { underlying: "CRWV", type: "put", strike: 50, qty: -1, premium: 0.05, expiration: "2026-10-16" }] });
  assert.equal(settleable(crwv, new Date("2026-10-16T19:59:00Z")), null);
  const r = expireEntry(crwv, { CRWV: 63.5 }, new Date("2026-10-16T20:05:00Z"));
  assert.equal(r.entry!.pnl, -12); assert.equal(r.entry!.exitKind, "expiry"); assert.equal(r.entry!.settlement!.kind, "PM_close");
  assert.equal(expireEntry(crwv, { CRWV: 52 }, new Date("2026-10-16T20:05:00Z")).entry!.pnl, 288);
  const vix = E({ symbol: "VIX", legs: [{ underlying: "VIX", type: "call", strike: 20, qty: 1, premium: 0.32, expiration: "2026-10-21" }, { underlying: "VIX", type: "call", strike: 25, qty: -1, premium: 0.11, expiration: "2026-10-21" }] });
  assert.equal(settleable(vix, new Date("2026-10-20T21:00:00Z")), null);
  assert.equal(settleable(vix, new Date("2026-10-21T14:00:00Z")), "AM_VRO");
  assert.match(expireEntry(vix, {}, new Date("2026-10-21T14:00:00Z")).error!, /VRO/);
  assert.equal(expireEntry(vix, { VIX: 22 }, new Date("2026-10-21T14:00:00Z")).entry!.pnl, 179);
});

test("weekend rule: losing mentor_shadow at Fri ≥15:45 ET closes at today's mark; winners and others kept", () => {
  const fri = new Date("2026-10-16T19:50:00Z"); // Fri 15:50 ET
  const mk = (pnl: number, at = "2026-10-16T19:46:00Z") => [{ at, value: 0, pnl, spot: null, sources: [] }];
  const w = weekendRule(E({ source: "mentor_shadow", marks: mk(-20) }), fri);
  assert.equal(w!.exitKind, "weekend_rule"); assert.equal(w!.pnl, -20);
  assert.equal(weekendRule(E({ source: "mentor_shadow", marks: mk(15) }), fri), null);
  assert.equal(weekendRule(E({ source: "real_practice", marks: mk(-20) }), fri), null);
  assert.equal(weekendRule(E({ source: "mentor_shadow", marks: mk(-20) }), new Date("2026-10-16T19:30:00Z")), null, "before 15:45");
  assert.equal(weekendRule(E({ source: "mentor_shadow", marks: mk(-20, "2026-10-15T19:46:00Z") }), fri), null, "stale mark");
});
