import type { OptionsClosedTradeReviewInput, OptionsMistakeGuardInput, OptionsTradePlanViolation } from "../../contracts/OptionsTradeReview";
import { evaluateOptionsMistakeGuard as guard, getOptionsMistakeNotebook as notebook, reviewClosedOptionTrade as review } from "./OptionsTradeReviewEngine";

let passed = 0;
function test(label: string, run: () => void): void { run(); passed++; console.log(`PASS ${label}`); }
function equal(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}; got ${JSON.stringify(actual)}`);
}
function truth(value: unknown): asserts value { if (!value) throw new Error("Assertion failed."); }
function throws(run: () => unknown, expected: string): void {
  try { run(); } catch (error) {
    if (error instanceof Error && error.message === expected) return;
    throw new Error(`Expected ${expected}; received ${String(error)}`);
  }
  throw new Error(`Expected ${expected}.`);
}
const base: OptionsClosedTradeReviewInput = {
  tradeId: "trade-target", symbol: "GLD", strategyVersion: "research-v1", setupKey: "daily-trend-pullback",
  origin: "SYNTHETIC_FIXTURE", planFingerprint: `sha256:${"a".repeat(64)}`,
  entryAt: "2026-09-08T14:31:00.000Z", exitAt: "2026-09-08T15:00:00.000Z", exitReason: "TARGET",
  entryPremiumCents: 2000, exitProceedsCents: 2900, feesCents: 20, netPnlCents: 880,
  plannedRiskCents: 440, entrySpreadCents: 100, exitLiquidityDelayed: false, quoteGapObserved: false, planViolations: [],
};
const preflight: OptionsMistakeGuardInput = {
  symbol: "GLD", strategyVersion: "research-v1", setupKey: "daily-trend-pullback", asOf: "2026-09-08T15:01:00.000Z",
  dataValid: true, costsKnown: true, exitLiquidityAvailable: true, entrySpreadCents: 100, maxEntrySpreadCents: 100,
  planUnchanged: true, riskWithinLimits: true,
};
function changed(overrides: Partial<OptionsClosedTradeReviewInput> = {}): OptionsClosedTradeReviewInput { return { ...base, ...overrides }; }
const stop = changed({ tradeId: "trade-stop", exitReason: "STOP", exitProceedsCents: 1580, netPnlCents: -440 });

test("a closed target records reconciled gross/net cash and exactly 2R", () => {
  const result = review(base);
  equal(result.outcome, "WIN"); equal(result.grossPnlCents, 900); equal(result.realizedR, 2);
  equal(result.input.feesCents, 20); equal(result.processAssessment, "NO_VIOLATIONS_REPORTED");
  equal(result.candidateLessons, []); equal(result.evidenceClassification, "LOCAL_ENGINEERING_CASE");
  equal(result.executionAllowed, false); equal(result.approvedKnowledge, false); equal(result.winProbability, null);
});
test("an ordinary planned loss is reviewed without being classified as a mistake", () => {
  const result = review(stop);
  equal(result.outcome, "LOSS"); equal(result.realizedR, -1); equal(result.candidateLessons, []);
  truth(result.facts.some((fact) => fact.includes("alone is not classified as a mistake")));
  equal(notebook([result]).entries, []); equal(notebook([result]).reviewedTradeCount, 1);
});
test("a breakeven trade is reviewed separately from a win or loss", () => {
  const result = review(changed({ exitReason: "TIME_EXIT", exitProceedsCents: 2020, netPnlCents: 0 }));
  equal(result.outcome, "BREAKEVEN"); equal(result.realizedR, 0); equal(result.grossPnlCents, 20);
});
test("time exit may be profitable without claiming the target was reached", () => {
  const result = review(changed({ exitReason: "TIME_EXIT", exitProceedsCents: 2100, netPnlCents: 80 }));
  equal(result.outcome, "WIN"); equal(result.input.exitReason, "TIME_EXIT");
  truth(result.facts[0]?.includes("TIME_EXIT"));
});
test("a lucky winning trade retains its reported process violation", () => {
  const result = review(changed({ planViolations: ["PLAN_CHANGED"] }));
  equal(result.outcome, "WIN"); equal(result.processAssessment, "VIOLATIONS_REPORTED");
  equal(result.candidateLessons[0]?.code, "PLAN_CHANGED");
  truth(result.facts.some((fact) => fact.includes("profitable outcome does not remove")));
});
test("a gap loss records execution risk without inventing a market cause", () => {
  const result = review(changed({ exitReason: "STOP", exitProceedsCents: 1200, netPnlCents: -820, quoteGapObserved: true }));
  truth(result.realizedR < -1); equal(result.candidateLessons[0]?.classification, "EXECUTION_RISK_TO_REVIEW");
  equal(result.candidateLessons[0]?.causalStatus, "NOT_ESTABLISHED");
  truth(result.facts.some((fact) => fact.includes("exceeded planned R")));
  truth(result.hypotheses.some((value) => value.includes("separate point-in-time evidence")));
});
test("delayed exit liquidity produces a candidate even if the trade wins", () => {
  const result = review(changed({ exitLiquidityDelayed: true }));
  equal(result.outcome, "WIN"); equal(result.candidateLessons[0]?.code, "EXIT_LIQUIDITY_DELAYED");
  equal(result.candidateLessons[0]?.guardCode, "EXIT_LIQUIDITY_UNAVAILABLE");
  equal(result.candidateLessons[0]?.approvedKnowledge, false);
});
test("a loss beyond planned R creates an execution-risk candidate without a missing-quote claim", () => {
  const result = review(changed({ exitReason: "STOP", exitProceedsCents: 1200, netPnlCents: -820 }));
  equal(result.input.quoteGapObserved, false); equal(result.processAssessment, "NO_VIOLATIONS_REPORTED");
  equal(result.candidateLessons.length, 1); equal(result.candidateLessons[0]?.code, "LOSS_EXCEEDED_PLANNED_R");
  equal(result.candidateLessons[0]?.classification, "EXECUTION_RISK_TO_REVIEW");
  equal(result.candidateLessons[0]?.causalStatus, "NOT_ESTABLISHED");
  equal(result.candidateLessons[0]?.guardCode, "RISK_LIMIT_EXCEEDED");
  const notes = notebook([result]); equal(notes.entries.length, 1);
  equal(guard(notes, preflight).status, "PASS");
  equal(guard(notes, { ...preflight, riskWithinLimits: false }).blockers[0]?.lessonIds, [notes.entries[0]?.lessonId]);
});
test("both distinct execution risks remain visible", () => {
  const result = review(changed({ quoteGapObserved: true, exitLiquidityDelayed: true }));
  equal(result.candidateLessons.length, 2); equal(notebook([result]).entries.length, 2);
});
test("unverified imported outcomes retain their local unverified origin", () => {
  const result = review(changed({ origin: "UNVERIFIED_IMPORT", symbol: "IBIT" }));
  equal(result.input.origin, "UNVERIFIED_IMPORT"); equal(result.evidenceClassification, "LOCAL_ENGINEERING_CASE");
  equal(result.executionAllowed, false);
});
test("review ids and fingerprints are deterministic and content bound", () => {
  equal(review(base), review(base));
  truth(review(base).reviewId !== review(changed({ exitReason: "TIME_EXIT" })).reviewId);
  truth(review(base).fingerprint !== review(changed({ quoteGapObserved: true })).fingerprint);
});
test("object property order does not alter canonical review identity", () => {
  const reordered = Object.fromEntries(Object.entries(base).reverse());
  equal(review(base).fingerprint, review(reordered).fingerprint);
});
test("review copies and deeply freezes every mutable array", () => {
  const violations: OptionsTradePlanViolation[] = ["PLAN_CHANGED"];
  const result = review(changed({ planViolations: violations }));
  violations.push("COSTS_UNKNOWN"); equal(result.input.planViolations, ["PLAN_CHANGED"]);
  truth(Object.isFrozen(result)); truth(Object.isFrozen(result.input)); truth(Object.isFrozen(result.input.planViolations));
  truth(Object.isFrozen(result.facts)); truth(Object.isFrozen(result.hypotheses)); truth(Object.isFrozen(result.candidateLessons[0]));
});
test("nonobjects, missing fields and extra authority fields are rejected", () => {
  throws(() => review(null), "INVALID_CLOSED_OPTION_TRADE_FIELDS");
  throws(() => review({ ...base, executionAllowed: true }), "INVALID_CLOSED_OPTION_TRADE_FIELDS");
  const { feesCents: ignored, ...missing } = base; void ignored;
  throws(() => review(missing), "INVALID_CLOSED_OPTION_TRADE_FIELDS");
});
test("out-of-scope symbols and live origins cannot become local evidence", () => {
  throws(() => review({ ...base, symbol: "SPY" }), "INVALID_OPTIONS_REVIEW_SCOPE");
  throws(() => review({ ...base, origin: "LIVE_VERIFIED" }), "INVALID_CLOSED_OPTION_TRADE");
});
test("identifiers are bounded, nonempty and free of control characters", () => {
  for (const value of ["", " x", "x\n", "x".repeat(121)]) {
    throws(() => review({ ...base, tradeId: value }), "INVALID_CLOSED_OPTION_TRADE");
  }
  throws(() => review({ ...base, setupKey: "" }), "INVALID_OPTIONS_REVIEW_SCOPE");
});
test("noncanonical, invalid and reversed timestamps fail", () => {
  for (const exitAt of [base.entryAt, "2026-09-08T14:00:00.000Z", "2026-09-08T15:00:00Z", "2026-02-30T15:00:00.000Z"]) {
    throws(() => review({ ...base, exitAt }), "INVALID_CLOSED_OPTION_TRADE");
  }
});
test("fingerprints and unknown exit reasons are rejected", () => {
  throws(() => review({ ...base, planFingerprint: "trusted-plan" }), "INVALID_CLOSED_OPTION_TRADE");
  throws(() => review({ ...base, exitReason: "EXERCISE" }), "INVALID_CLOSED_OPTION_TRADE");
});
test("money is bounded integer cents and risk must be positive", () => {
  for (const feesCents of [-1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER, null]) {
    throws(() => review({ ...base, feesCents }), "INVALID_CLOSED_OPTION_TRADE");
  }
  throws(() => review({ ...base, plannedRiskCents: 0 }), "INVALID_CLOSED_OPTION_TRADE");
  throws(() => review({ ...base, entryPremiumCents: 0 }), "INVALID_CLOSED_OPTION_TRADE");
});
test("cash must reconcile exactly and cannot silently drop fees", () => {
  throws(() => review({ ...base, netPnlCents: 900 }), "CLOSED_OPTION_TRADE_CASH_MISMATCH");
  throws(() => review({ ...base, exitProceedsCents: 2899 }), "CLOSED_OPTION_TRADE_CASH_MISMATCH");
});
test("planned long-option risk cannot exceed premium plus fees", () => {
  throws(() => review({ ...base, plannedRiskCents: 2021 }), "INVALID_CLOSED_OPTION_TRADE_RISK");
});
test("large reconciled numbers remain bounded without intermediate overflow", () => {
  const result = review(changed({ entryPremiumCents: 999_999_999_999, exitProceedsCents: 0, feesCents: 1,
    netPnlCents: -1_000_000_000_000, plannedRiskCents: 1, entrySpreadCents: 0 }));
  equal(result.realizedR, -1_000_000_000_000);
  throws(() => review(changed({ entryPremiumCents: 1_000_000_000_000, exitProceedsCents: 1, feesCents: 1,
    netPnlCents: -1_000_000_000_000 })), "INVALID_CLOSED_OPTION_TRADE_RISK");
});
test("unknown, duplicate and excessive violation entries fail", () => {
  throws(() => review({ ...base, planViolations: ["BAD_LUCK"] }), "INVALID_CLOSED_OPTION_TRADE");
  throws(() => review({ ...base, planViolations: ["PLAN_CHANGED", "PLAN_CHANGED"] }), "INVALID_CLOSED_OPTION_TRADE");
  throws(() => review({ ...base, planViolations: "PLAN_CHANGED" }), "INVALID_CLOSED_OPTION_TRADE");
});
test("all objective process violations have explicit candidate checks", () => {
  const planViolations: OptionsTradePlanViolation[] = ["DATA_INVALID", "COSTS_UNKNOWN", "SPREAD_LIMIT_EXCEEDED", "EXIT_LIQUIDITY_UNAVAILABLE", "PLAN_CHANGED", "RISK_LIMIT_EXCEEDED"];
  const result = review(changed({ planViolations }));
  equal(result.candidateLessons.length, 6);
  truth(result.candidateLessons.every((lesson) => lesson.guardCode === lesson.code && !lesson.approvedKnowledge));
});
test("identical repeated trade reviews never increase notebook counts", () => {
  const result = review(changed({ planViolations: ["PLAN_CHANGED"] }));
  const once = notebook([result]); const duplicate = notebook([result, result]);
  equal(once, duplicate); equal(duplicate.reviewedTradeCount, 1); equal(duplicate.entries[0]?.occurrenceCount, 1);
});
test("same trade id with different closed content fails idempotency", () => {
  throws(() => notebook([review(base), review(changed({ exitReason: "TIME_EXIT" }))]), "OPTIONS_TRADE_ID_CONFLICT");
});
test("repeated scoped mistakes share one stable entry and retain each trade id", () => {
  const first = review(changed({ planViolations: ["PLAN_CHANGED"] }));
  const second = review(changed({ tradeId: "trade-2", exitAt: "2026-09-08T15:30:00.000Z", planViolations: ["PLAN_CHANGED"] }));
  const result = notebook([second, first]);
  equal(result.entries.length, 1); equal(result.entries[0]?.occurrenceCount, 2);
  equal(result.entries[0]?.supportingTradeIds, ["trade-target", "trade-2"]);
  equal(result.entries[0]?.firstRecordedAt, first.input.exitAt); equal(result.entries[0]?.lastRecordedAt, second.input.exitAt);
  equal(notebook([first, second]).fingerprint, result.fingerprint);
});
test("lesson scope separates symbols, setup keys and strategy versions", () => {
  const changes: Partial<OptionsClosedTradeReviewInput>[] = [{}, { symbol: "IBIT" }, { setupKey: "other-setup" }, { strategyVersion: "research-v2" }];
  const result = notebook(changes.map((change, index) => review(changed({ ...change, tradeId: `trade-${index}`, planViolations: ["PLAN_CHANGED"] }))));
  equal(result.entries.length, 4);
});
test("notebook rejects altered review content even if the old fingerprint is retained", () => {
  const original = review(base);
  throws(() => notebook([{ ...original, facts: ["Guaranteed profitable."] }]), "OPTIONS_TRADE_REVIEW_INTEGRITY_FAILURE");
  throws(() => notebook([{ ...original, approvedKnowledge: true } as unknown as typeof original]), "OPTIONS_TRADE_REVIEW_INTEGRITY_FAILURE");
});
test("notebook bounds input and deeply freezes evidence and lesson arrays", () => {
  throws(() => notebook(Array.from({ length: 2001 }, () => review(base))), "INVALID_OPTIONS_REVIEW_COLLECTION");
  const result = notebook([review(changed({ planViolations: ["PLAN_CHANGED"] }))]);
  truth(Object.isFrozen(result)); truth(Object.isFrozen(result.reviews)); truth(Object.isFrozen(result.entries));
  truth(Object.isFrozen(result.entries[0]?.supportingTradeIds));
});
test("a valid first trade passes objective checks without any learned outcomes", () => {
  const result = guard(notebook([]), preflight);
  equal(result.status, "PASS"); equal(result.blockers, []); equal(result.applicableLessonIds, []);
  equal(result.executionAllowed, false); equal(result.strategyWeightsChanged, false); equal(result.futureLiquidityGuaranteed, false);
});
test("baseline checks block objective errors even before the first review", () => {
  const result = guard(notebook([]), { ...preflight, dataValid: false, costsKnown: false, exitLiquidityAvailable: false,
    entrySpreadCents: 101, planUnchanged: false, riskWithinLimits: false });
  equal(result.status, "BLOCKED"); equal(result.blockers.length, 6); truth(result.blockers.every((blocker) => blocker.lessonIds.length === 0));
});
test("an applicable old process mistake links the rejecting guard to its lesson", () => {
  const notes = notebook([review(changed({ planViolations: ["PLAN_CHANGED"] }))]);
  const result = guard(notes, { ...preflight, planUnchanged: false });
  equal(result.status, "BLOCKED"); equal(result.blockers[0]?.code, "PLAN_CHANGED");
  equal(result.blockers[0]?.lessonIds, [notes.entries[0]?.lessonId]);
});
test("fixing the objective condition permits the next local check despite a previous mistake", () => {
  const notes = notebook([review(changed({ planViolations: ["PLAN_CHANGED"] }))]);
  const result = guard(notes, preflight);
  equal(result.status, "PASS"); equal(result.applicableLessonIds.length, 1); equal(result.approvedKnowledge, false);
});
test("lessons from future closed trades do not leak into past decisions", () => {
  const notes = notebook([review(changed({ planViolations: ["PLAN_CHANGED"] }))]);
  const result = guard(notes, { ...preflight, asOf: "2026-09-08T14:59:59.999Z", planUnchanged: false });
  equal(result.applicableLessonIds, []); equal(result.blockers[0]?.lessonIds, []); equal(result.status, "BLOCKED");
});
test("future corroboration cannot change an earlier mistake-guard decision", () => {
  const earlier = review(changed({ planViolations: ["PLAN_CHANGED"] }));
  const later = review(changed({ tradeId: "later-trade", exitAt: "2026-09-08T16:00:00.000Z", planViolations: ["PLAN_CHANGED", "DATA_INVALID"] }));
  const current = { ...preflight, planUnchanged: false, dataValid: false };
  equal(guard(notebook([earlier, later]), current), guard(notebook([earlier]), current));
  equal(guard(notebook([earlier, later]), { ...current, asOf: "2026-09-08T16:00:00.000Z" }).applicableLessonIds.length, 2);
});
test("unrelated symbol, setup or version cannot masquerade as an applicable lesson", () => {
  const notes = notebook([review(changed({ planViolations: ["PLAN_CHANGED"] }))]);
  for (const change of [{ symbol: "IBIT" }, { setupKey: "other" }, { strategyVersion: "v2" }]) {
    const result = guard(notes, { ...preflight, ...change, planUnchanged: false });
    equal(result.applicableLessonIds, []); equal(result.blockers[0]?.lessonIds, []);
  }
});
test("a normal loss cannot create a blanket ban on the next trade", () => {
  equal(guard(notebook([review(stop)]), preflight).status, "PASS");
});
test("a gap lesson checks current data without promising to prevent future gaps", () => {
  const notes = notebook([review(changed({ quoteGapObserved: true }))]);
  equal(guard(notes, preflight).status, "PASS");
  const rejected = guard(notes, { ...preflight, dataValid: false });
  equal(rejected.blockers[0]?.lessonIds, [notes.entries[0]?.lessonId]); equal(rejected.futureLiquidityGuaranteed, false);
});
test("liquidity lesson links a current unavailable bid without blaming strategy direction", () => {
  const notes = notebook([review(changed({ exitLiquidityDelayed: true }))]);
  const result = guard(notes, { ...preflight, exitLiquidityAvailable: false });
  equal(result.blockers[0]?.code, "EXIT_LIQUIDITY_UNAVAILABLE"); equal(result.blockers[0]?.lessonIds, [notes.entries[0]?.lessonId]);
});
test("guard rejects modified notebook entries instead of trusting client approval flags", () => {
  const notes = notebook([review(changed({ planViolations: ["PLAN_CHANGED"] }))]);
  throws(() => guard({ ...notes, entries: [] }, preflight), "OPTIONS_MISTAKE_NOTEBOOK_INTEGRITY_FAILURE");
  throws(() => guard({ ...notes, reviewedTradeCount: 0 }, preflight), "OPTIONS_MISTAKE_NOTEBOOK_INTEGRITY_FAILURE");
});
test("guard rejects ambiguous booleans, unknown inputs and invalid spread or time", () => {
  throws(() => guard(notebook([]), { ...preflight, costsKnown: null }), "INVALID_OPTIONS_MISTAKE_GUARD");
  throws(() => guard(notebook([]), { ...preflight, maxEntrySpreadCents: -1 }), "INVALID_OPTIONS_MISTAKE_GUARD");
  throws(() => guard(notebook([]), { ...preflight, asOf: "now" }), "INVALID_OPTIONS_MISTAKE_GUARD");
  throws(() => guard(notebook([]), { ...preflight, allowTrade: true }), "INVALID_OPTIONS_MISTAKE_GUARD_FIELDS");
});
test("zero spread passes an explicit zero cap and guard results are deeply immutable", () => {
  const result = guard(notebook([]), { ...preflight, entrySpreadCents: 0, maxEntrySpreadCents: 0, costsKnown: false });
  equal(result.blockers.length, 1); equal(result.blockers[0]?.code, "COSTS_UNKNOWN");
  truth(Object.isFrozen(result)); truth(Object.isFrozen(result.blockers)); truth(Object.isFrozen(result.blockers[0]?.lessonIds));
});

console.log(`OptionsTradeReviewEngine: ${passed}/${passed} tests passed.`);
