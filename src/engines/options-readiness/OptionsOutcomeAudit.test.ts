import { auditOptionsOutcomes as audit, type OutcomeHistories } from "./OptionsOutcomeAudit";
import type { ContextHistory } from "./OptionsContextCutoff";
import { readinessFingerprint } from "./OptionsReadinessEngine";
import { paperFixture, optionsPaperDemoScenarios } from "../options-paper/OptionsPaperFixtures";
import { appendOptionsPaperScenario, replayOptionsPaperAccount } from "../options-paper/OptionsPaperTradingEngine";
import { historicalReplayFixture, fixtureHistoricalReplayCases } from "../options-historical-replay/OptionsHistoricalReplayFixtures";
import { createHistoricalReplayRun } from "../options-historical-replay/OptionsHistoricalReplayReview";
const at = "2026-09-07T17:00:00.000Z";
const available = <T>(payload: T): ContextHistory<T> => ({ state: "AVAILABLE", payload, checkedAt: at, errorCode: null });
const eq = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(`Expected ${JSON.stringify(b)}, received ${JSON.stringify(a)}`); };
const ok = (a: unknown) => { if (!a) throw Error("Expected truthy"); };
function throws(work: () => unknown) { let caught = false; try { work(); } catch { caught = true; } ok(caught); }
function histories(): OutcomeHistories {
  let paper = [] as ReturnType<typeof paperFixture>[];
  for (const s of optionsPaperDemoScenarios()) paper = [...appendOptionsPaperScenario(paper, s).scenarios];
  return { paper: available(paper), historical: available(fixtureHistoricalReplayCases().map(c => createHistoricalReplayRun(c.config, c.evidence, c.recordedAt))) };
}
let passed = 0; function test(name: string, work: () => void) { work(); passed++; console.log(`PASS ${name}`); }
test("recomputed paper net, costs, drawdown and reviews reconcile without counting revisions twice", () => {
  const h = histories(), r = audit(h, at).components.paper.audit!, original = replayOptionsPaperAccount(h.paper.payload!);
  eq(r.metrics.caseCount, 7); eq(r.metrics.closedCount, 5); eq(r.metrics.netPositiveCount, 2); eq(r.metrics.netNegativeCount, 3);
  eq(r.metrics.netPnlCents, original.account.realizedPnlCents); eq(r.metrics.grossPnlCents - r.metrics.feesCents, r.metrics.netPnlCents);
  eq(r.realizedClosedCurve.finalEquityCents, 100000 + r.metrics.netPnlCents); eq(r.realizedClosedCurve.maxDrawdownCents, 1880);
  eq(r.candidateNotebook, original.mistakeNotebook); eq(r.metrics.closedCaseNetPositiveShareBps, 4000);
});
test("all research dispositions are retained and independent accounts have no portfolio curve", () => {
  const r = audit(histories(), at).components.historical.audit!;
  eq(r.metrics.caseCount, 7); eq(r.metrics.closedCount, 4); eq(r.metrics.openExposureCount, 1); eq(r.realizedClosedCurve, null);
  eq(r.basis, "INDEPENDENT_1000_USD_RUNS_NO_SHARED_COMPOUNDING"); ok(r.cases.some(c => c.origin === "MISSING_DATA"));
});
test("target reversal is counted as target exit but losing outcome", () => {
  const r = audit(histories(), at).components.historical.audit!, c = r.cases.find(c => c.id === "historical-target-reversal")!;
  eq(c.review!.input.exitReason, "TARGET"); ok(c.review!.input.netPnlCents < 0);
  ok(c.candidateLessonCodes.includes("TARGET_TRIGGER_NOT_GUARANTEED_PROFIT")); eq(r.metrics.targetExitCount, 2); eq(r.metrics.netPositiveCount, 2);
});
test("empty histories have null ratios and zero counts", () => {
  const r = audit({ paper: available([]), historical: available([]) }, at);
  for (const c of Object.values(r.components)) { eq(c.audit!.metrics.closedCount, 0); eq(c.audit!.metrics.profitFactorMilli, null); eq(c.audit!.metrics.meanNetPnl, null); }
});
test("no losing closed cases never produces infinity", () => {
  const r = audit({ paper: available([paperFixture()]), historical: available([]) }, at).components.paper.audit!;
  eq(r.metrics.profitFactorMilli, null); eq(r.metrics.closedCaseNetPositiveShareBps, 10000); eq(r.metrics.meanNetPnl, { numeratorCents: 880, denominatorClosedCases: 1 });
});
test("paper scenarios with future hypothetical clocks are not real recordings", () => {
  const r = audit(histories(), at).components.paper.audit!; ok(r.cases.every(c => c.recordedAt === null && c.scenarioAsOf! > at));
});
test("future actual research recordings fail only that component", () => {
  const f = historicalReplayFixture(), h = histories(); h.historical = available([createHistoricalReplayRun(f.config, f.evidence, "2026-09-08T00:00:00.000Z")]);
  const r = audit(h, at); eq(r.blockedStores, ["historical"]); eq(r.components.paper.state, "AVAILABLE");
});
test("tampered profitable research output cannot influence aggregates", () => {
  const h = histories(), raw = JSON.parse(JSON.stringify(h)); raw.historical.payload[0].result.netPnlCents = 999999;
  const r = audit(raw, at); eq(r.components.historical.errorCode, "HISTORY_VALIDATION_FAILED"); eq(r.components.historical.audit, null);
});
test("invalid paper quotes fail only paper while history stays visible", () => {
  const raw = JSON.parse(JSON.stringify(histories())); raw.paper.payload[0].quotes[0].bidPerShareCents = -1;
  const r = audit(raw, at); eq(r.blockedStores, ["paper"]); eq(r.components.historical.state, "AVAILABLE");
});
test("group totals reconcile without mixing origin asset strategy or setup", () => {
  const r = audit(histories(), at);
  for (const c of Object.values(r.components)) { const a = c.audit!; eq(a.groups.reduce((s, g) => s + g.metrics.caseCount, 0), a.metrics.caseCount); eq(a.groups.reduce((s, g) => s + g.metrics.netPnlCents, 0), a.metrics.netPnlCents); }
});
test("missing and busy are distinct from valid empty histories", () => {
  const h: OutcomeHistories = { paper: { state: "MISSING", payload: null, checkedAt: at, errorCode: "STORE_MISSING" }, historical: { state: "BLOCKED", payload: null, checkedAt: at, errorCode: "STORE_BUSY" } };
  const r = audit(h, at); eq(r.missingStores, ["paper"]); eq(r.blockedStores, ["historical"]); eq(r.components.paper.audit, null);
});
test("invalid storage envelopes and regressing construction clocks throw", () => {
  const h = histories(); throws(() => audit(h, "2026-09-06T00:00:00.000Z"));
  throws(() => audit({ ...h, paper: { ...h.paper, errorCode: "STORE_MISSING" } } as OutcomeHistories, at));
  throws(() => audit({ ...h, extra: true } as OutcomeHistories, at));
});
test("stable immutable fingerprint contains no authority or calibration", () => {
  const h = histories(), before = readinessFingerprint(h), r = audit(h, at), { artifactSha256, ...payload } = r;
  eq(artifactSha256, readinessFingerprint(payload)); eq(r, audit(h, at)); eq(readinessFingerprint(h), before);
  eq(r.winProbability, null); eq(r.calibrated, false); eq(r.marketValidated, false); eq(r.executionAllowed, false); ok(Object.isFrozen(r.components.paper.audit!.cases));
});
console.log(`${passed}/${passed} tests passed.`);
