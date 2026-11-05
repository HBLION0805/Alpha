import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { kellyFraction, kellyReference } from "../src/options/kelly.ts";
const AP = { price: 32, qty: 1, maxAdds: 1, totalCapQty: 2, maxLoss: 300 };
import { adjustmentPlaybookChecks, suggestNextStep } from "../src/options/adjust.ts";
import { preTradeChecks, type Proposal } from "../src/options/pretrade.ts";

test("kellyFraction basic and article example (50/50, +50%/-40% → 25%)", () => {
  assert.equal(kellyFraction(0.5, 1), 0);
  assert.ok(Math.abs(kellyFraction(0.5, 0.5 / 0.4) - 0.1) < 1e-9); // fraction of capital at risk: 0.25 bet × 0.4 loss
  assert.equal(kellyFraction(0.3, 1), 0);
});

test("Kelly is capped by 1%/trade and 3%/underlying, ≤0.25 fraction, with sensitivity", () => {
  const r = kellyReference({ capital: 100000, p: 0.6, winPerContract: 300, maxLossPerContract: 200, kellyFraction: 1, cash: 50000, openInterest: 5000, bid: 1.9, ask: 2.0 });
  assert.equal(r.usedFraction, 0.25);
  assert.ok(r.warnings.some((w) => w.id === "kelly_fraction_clamped"));
  assert.equal(r.maxContracts, 5); // 1% of 100k = $1000 / $200
  assert.equal(r.binding, "per_trade_1pct");
  assert.deepEqual(r.sensitivity.map((s) => s.dp), [-10, -5, 0, 5, 10]);
  assert.ok(r.sensitivity[0]!.fullKelly < r.sensitivity[4]!.fullKelly);
  const u = kellyReference({ capital: 100000, p: 0.6, winPerContract: 300, maxLossPerContract: 200, existingUnderlyingRisk: 2800, cash: 50000 });
  assert.equal(u.maxContracts, 1); assert.equal(u.binding, "per_underlying_3pct");
});

test("Kelly: p-sensitivity, no-edge, correlation stress, cash, undefined risk", () => {
  const thin = kellyReference({ capital: 10000, p: 0.55, winPerContract: 100, maxLossPerContract: 100, cash: 1000 });
  assert.ok(thin.warnings.some((w) => w.id === "p_sensitivity"));
  assert.equal(kellyReference({ capital: 10000, p: 0.4, winPerContract: 100, maxLossPerContract: 100, cash: 1000 }).warnings.find((w) => w.id === "no_edge")?.severity, "BLOCK");
  const c = kellyReference({ capital: 100000, p: 0.6, winPerContract: 300, maxLossPerContract: 200, cash: 50000, correlatedRisk: [1500, 1000] });
  assert.equal(c.warnings.find((w) => w.id === "correlation_stress")?.severity, "WARN");
  const cash = kellyReference({ capital: 100000, p: 0.6, winPerContract: 300, maxLossPerContract: 200, cash: 100 });
  assert.equal(cash.maxContracts, 0); assert.equal(cash.binding, "cash");
  assert.ok(kellyReference({ capital: 1e5, p: 0.6, winPerContract: 1, maxLossPerContract: 0 }).warnings.some((w) => w.id === "undefined_risk" && w.severity === "BLOCK"));
  assert.ok(kellyReference({ capital: 1e5, p: 0.6, winPerContract: 300, maxLossPerContract: 200 }).warnings.some((w) => w.id === "liquidity"));
});

const lp = (strike: number, qty = 1) => ({ type: "put" as const, strike, qty, premium: 1, expiration: "2026-12-18" });
const sev = (cs: { id: string; severity: string }[], id: string) => cs.find((c) => c.id === id)?.severity;

test("INTC playbook: add only after confirmation, never because cheaper", () => {
  assert.equal(sev(adjustmentPlaybookChecks([lp(30)], 32, { action: "add", direction: "bearish", addPlan: AP }), "add_needs_confirmation"), "BLOCK");
  assert.equal(sev(adjustmentPlaybookChecks([lp(30)], 32, { action: "add", direction: "bearish", addPlan: AP, confirmation: { confirmed: true, evidence: "x" }, reason: "price is cheaper now" }), "no_add_because_cheaper"), "BLOCK");
  const ok = adjustmentPlaybookChecks([lp(30)], 32, { action: "add", direction: "bearish", addPlan: AP, confirmation: { confirmed: true, evidence: "daily close below 33 on volume" } });
  assert.ok(!ok.some((c) => c.severity === "BLOCK"));
});

test("INTC playbook: re-add long options only; convert to PDS must be covered", () => {
  assert.equal(sev(adjustmentPlaybookChecks([lp(30), lp(25, -1)], 28, { action: "readd_long", direction: "bearish", addPlan: AP, confirmation: { confirmed: true, evidence: "y" } }), "readd_long_only"), "BLOCK");
  const conv = adjustmentPlaybookChecks([lp(30), lp(25, -1)], 26, { action: "convert_to_spread", direction: "bearish", supportLevel: 25.5 });
  assert.equal(sev(conv, "convert_defined_risk"), "OK"); assert.equal(sev(conv, "convert_trigger"), "OK");
  assert.equal(sev(adjustmentPlaybookChecks([lp(25, -1)], 26, { action: "convert_to_spread", direction: "bearish" }), "convert_defined_risk"), "BLOCK");
  assert.equal(sev(adjustmentPlaybookChecks([lp(30)], 26, { action: "add", direction: "bearish", addPlan: AP, confirmation: { confirmed: true, evidence: "z" }, supportLevel: 25.5 }), "room_shrinking"), "WARN");
});

test("suggestNextStep follows long put → wait → add → PDS → re-add long", () => {
  assert.equal(suggestNextStep({ holding: "none", confirmed: false, thesisInvalidated: false, nearSupport: false }).action, "enter_long");
  assert.equal(suggestNextStep({ holding: "long", confirmed: false, thesisInvalidated: false, nearSupport: false }).action, "hold");
  assert.equal(suggestNextStep({ holding: "long", confirmed: true, thesisInvalidated: false, nearSupport: false }).action, "add");
  assert.equal(suggestNextStep({ holding: "long", confirmed: true, thesisInvalidated: false, nearSupport: true }).action, "convert_to_spread");
  assert.equal(suggestNextStep({ holding: "spread", confirmed: true, thesisInvalidated: false, nearSupport: false }).action, "readd_long");
  assert.equal(suggestNextStep({ holding: "spread", confirmed: true, thesisInvalidated: true, nearSupport: false }).action, "exit");
});

test("pretrade wires the playbook; adjustment still needs its own max loss", () => {
  const p: Proposal = { symbol: "INTC", strategy: "long_put", asOf: "2026-10-14", underlyingPrice: 32, thesisHorizonDays: 20, legs: [lp(30)], capital: 50000, buyingPower: 20000, adjustmentOf: "intc-1", adjustment: { action: "add", direction: "bearish", addPlan: AP } };
  const r = preTradeChecks(p);
  assert.ok(r.blocked);
  assert.equal(sev(r.checks, "add_needs_confirmation"), "BLOCK");
  assert.equal(sev(r.checks, "adjustment_is_new_trade"), "BLOCK");
});

test("mentor files saved verbatim", () => {
  const pairs = [["MENTOR_KELLY_INTC_2026-10-14.md", "MENTOR_KELLY_INTC_2026-10-14.md"], ["kelly/kelly-article.pdf", "01M4YJX8QSYYGZDEMRKHHW5J8F.pdf"], ["tradingview/kline-reading-bzzb.pine", "01M4YJYBSYBGCKM054Q926B69D.txt"]];
  for (const [mine] of pairs) assert.ok(statSync(new URL(`../knowledge/mentor/${mine}`, import.meta.url)).size > 0);
  assert.match(readFileSync(new URL("../knowledge/mentor/MENTOR_KELLY_INTC_2026-10-14.md", import.meta.url), "utf8"), /错的时候控制风险，对的时候增加敞口；不抢确认，不死守结构/);
  assert.match(readFileSync(new URL("../knowledge/mentor/world-lines.md", import.meta.url), "utf8"), /20\. \*\*日元 Carry Trade\*\*/);
});
