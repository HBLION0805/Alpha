import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyCurve, takeProfitAdvice } from "../src/options/takeprofit.ts";

test("curve classifier", () => {
  assert.equal(classifyCurve([0, 120, 140, 130, 125, 120, 110, 100, 95, 90]), "lottery");
  assert.equal(classifyCurve([0, -20, -40, -65, -70, -75]), "catastrophic_loss");
  assert.equal(classifyCurve([0, -10, 5, -25, 0, -30, -10, -40, -20, -45]), "turbulent_loss");
  assert.equal(classifyCurve([0, 10, -20, -30, -10, 5, 30, 60, 80]), "standard");
  assert.equal(classifyCurve([0, 20, 45, 50, 30, 10, 5]), "standard_variant");
  assert.equal(classifyCurve([0, -15, -25, -10, 5, 8, -5]), "bull_trap");
  assert.equal(classifyCurve([0, 5, -5, 3, -2, 4, 10, 25, 40]), "turbulent_gain");
  assert.equal(classifyCurve([0, 10, 20], { dte: 3 }), "near_term_expiry");
  assert.equal(classifyCurve([0, -10, 5, 40], { technicalConfirmations: 3 }), "technical_confirmation");
  assert.equal(classifyCurve([0, 50, 150], { catalystConfirmed: true }), "narrative_catalyst");
});
test("lottery: lock ≥90%, runner ≤10%", () => {
  const a = takeProfitAdvice({ pnlPct: 150, path: [0, 150, 140], contracts: 10, structure: "long_option" });
  assert.equal(a.action, "SELL"); assert.equal(a.sellNow, 9); assert.equal(a.runner, 1);
  assert.equal(takeProfitAdvice({ pnlPct: 150, path: [0, 150], contracts: 1, structure: "long_option" }).runner, 0); // whole contracts: no runner from 1
});
test("general thresholds reconcile with course 50%", () => {
  assert.equal(takeProfitAdvice({ pnlPct: 35, contracts: 4, structure: "long_option" }).action, "CONSIDER_TP");
  const h = takeProfitAdvice({ pnlPct: 55, contracts: 4, structure: "long_option" }); assert.equal(h.sellNow, 2);
  const e = takeProfitAdvice({ pnlPct: 85, contracts: 10, structure: "long_option" }); assert.equal(e.sellNow, 9); assert.equal(e.runner, 1);
  assert.equal(takeProfitAdvice({ pnlPct: 85, contracts: 10, soldContracts: 5, structure: "long_option" }).sellNow, 4);
  assert.equal(takeProfitAdvice({ pnlPct: 10, contracts: 2, structure: "long_option" }).action, "HOLD");
});
test("catalyst ladder is cumulative, runner ≤25%", () => {
  const c = { contracts: 8, structure: "long_option" as const, catalystConfirmed: true };
  assert.equal(takeProfitAdvice({ ...c, pnlPct: 60 }).sellNow, 4);   // course half at +50 still applies
  assert.equal(takeProfitAdvice({ ...c, pnlPct: 110 }).sellNow, 4);
  const t = takeProfitAdvice({ ...c, pnlPct: 210, soldContracts: 4 }); assert.equal(t.sellNow, 2); assert.equal(t.runner, 2);
});
test("technical confirmation needs ≥3 confirmations for extra room", () => {
  assert.equal(takeProfitAdvice({ pnlPct: 90, contracts: 8, structure: "long_option", technicalConfirmations: 3 }).sellNow, 6);
  assert.equal(takeProfitAdvice({ pnlPct: 90, contracts: 8, structure: "long_option", technicalConfirmations: 2 }).sellNow, 8);
});
test("near expiry, bull trap, losses, debit spread", () => {
  assert.equal(takeProfitAdvice({ pnlPct: 20, contracts: 3, structure: "long_option", dte: 2 }).sellNow, 3);
  const bt = takeProfitAdvice({ pnlPct: 5, path: [0, -20, -30, -5, 5], contracts: 3, structure: "long_option" });
  assert.equal(bt.action, "EXIT"); assert.ok(bt.addBlocked); assert.equal(bt.sellNow, 3);
  const conf = takeProfitAdvice({ pnlPct: 5, path: [0, -20, -30, -5, 5], contracts: 3, structure: "long_option", volumeConfirmed: true, holdConfirmed: true });
  assert.notEqual(conf.action, "EXIT");
  assert.equal(takeProfitAdvice({ pnlPct: -70, path: [0, -30, -65, -70], contracts: 2, structure: "long_option" }).action, "EXIT");
  assert.equal(takeProfitAdvice({ pnlPct: -10, contracts: 2, structure: "long_option", thesisIntact: false }).action, "EXIT");
  assert.equal(takeProfitAdvice({ pnlPct: 40, contracts: 2, structure: "debit_spread", spreadMaxProfitCapturedPct: 55 }).sellNow, 2);
});
test("take-profit saved verbatim + images embedded without altering text", () => {
  const a = readFileSync(new URL("../knowledge/mentor/discipline/take-profit.md", import.meta.url), "utf8");
  const v = readFileSync(new URL("../knowledge/mentor/discipline/take-profit.verbatim.md", import.meta.url), "utf8");
  assert.equal(a.replace(/\n\n!\[[^\n]*\]\(take-profit-img\/\d\d\.png\)/g, ""), v);
  assert.equal((a.match(/take-profit-img\/\d\d\.png/g) ?? []).length, 11);
  const cat = JSON.parse(readFileSync(new URL("../knowledge/catalog.json", import.meta.url), "utf8")) as { items: Array<{ id: string; sources: string[] }> };
  assert.ok(cat.items.filter((i) => i.sources.includes("mentor-take-profit")).length >= 8);
});
