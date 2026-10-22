import { test } from "node:test";
import assert from "node:assert/strict";
import { entryCapUsd } from "../src/options/confidence.ts";
import { paperClose, paperMark } from "../src/options/paper.ts";
import { chainFromCboe } from "../src/options/gex.ts";
import { macroEntry } from "../src/options/macroLedger.ts";

test("per-trade cap: recorded tier, else the trade's own max-loss tier (0.5–2%), not a fixed $50", () => {
  assert.equal(entryCapUsd({ confidence: { capUsd: 25 } } as never, 5000), 25);
  assert.equal(entryCapUsd({ maxLoss: 20 } as never, 5000), 25);
  assert.equal(entryCapUsd({ maxLoss: 58 } as never, 5000), 75);
  assert.equal(entryCapUsd({ maxLoss: 260 } as never, 5000), 100);
  assert.equal(entryCapUsd({} as never, 5000), 50);
});

test("paper close flags a loss beyond the trade's own cap", () => {
  const e = { id: "g", symbol: "GDX", mode: "paper", openedAt: "2026-10-15T14:00:00Z", maxLoss: 260, legs: [] } as never;
  const r = paperClose(e, { exitKind: "discretionary", pnl: -125, errorClass: "judgment", errorTags: ["no_stop_set"], now: new Date(), capital: 5000 });
  assert.ok(r.entry!.violations!.includes("closed_loss_over_cap"));
  const ok = paperClose({ ...(e as object), maxLoss: 20 } as never, { exitKind: "stop" as never, pnl: -20, errorClass: "variance", errorTags: ["x"], now: new Date(), capital: 5000 });
  assert.ok(!ok.entry || !ok.entry.violations!.includes("closed_loss_over_cap"));
});

test("VIX diagonal: macro-open normalizes legs; CBOE chain marks both legs at mid", async () => {
  const m = macroEntry({ symbol: "VIX", strategy: "reverse_call_diagonal", dir: "vol", maxLoss: 2, thesis: "t", now: new Date("2026-10-22T18:00:00Z"),
    legs: JSON.stringify([{ type: "call", strike: 25, expiry: "2026-11-18", qty: 1, side: "long", premium: 1.115 }, { type: "call", strike: 35, expiry: "2027-01-20", qty: 1, side: "short", premium: 1.095 }]) }, []).entry!;
  assert.deepEqual(m.legs!.map((l) => [l.expiration, l.qty]), [["2026-11-18", 1], ["2027-01-20", -1]]);
  const raw = { timestamp: "2026-10-22 20:00:00", data: { current_price: 19.5, options: [
    { option: "VIX261118C00025000", bid: 1.2, ask: 1.3, iv: 1.3, open_interest: 1 }, { option: "VIX270120C00035000", bid: 1.1, ask: 1.2, iv: 1.1, open_interest: 1 }] } };
  const ch = chainFromCboe("VIX", raw)!;
  assert.equal(ch.contracts[0]!.mark, 1.25);
  const mk = await paperMark(m, { spot: async () => 19.5, chains: [ch] }, new Date("2026-10-22T20:05:00Z"));
  assert.equal(mk.pnl, Math.round(((1.25 - 1.15) - (1.115 - 1.095)) * 100 * 100) / 100); assert.ok(!mk.estimated); assert.match(mk.sources.join(), /25c cboe 1.25/);
});
