import { inventoryOptionsSamples as inventory } from "./OptionsSampleInventory";
import { auditOptionsOutcomes, type OutcomeHistories } from "../options-readiness/OptionsOutcomeAudit";
import type { ContextHistory } from "../options-readiness/OptionsContextCutoff";
import { optionsPaperDemoScenarios, paperFixture } from "../options-paper/OptionsPaperFixtures";
import { appendOptionsPaperScenario } from "../options-paper/OptionsPaperTradingEngine";
import { fixtureHistoricalReplayCases, historicalReplayFixture } from "../options-historical-replay/OptionsHistoricalReplayFixtures";
import { createHistoricalReplayRun } from "../options-historical-replay/OptionsHistoricalReplayReview";
import { readinessFingerprint } from "../options-readiness/OptionsReadinessEngine";
const at = "2026-09-07T19:00:00.000Z";
const available = <T>(payload: T): ContextHistory<T> => ({ state: "AVAILABLE", payload, checkedAt: at, errorCode: null });
const eq = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(`Expected ${JSON.stringify(b)}, received ${JSON.stringify(a)}`); };
const ok = (value: unknown) => { if (!value) throw Error("Expected truthy"); };
function throws(work: () => unknown) { let caught = false; try { work(); } catch { caught = true; } ok(caught); }
function histories(): OutcomeHistories {
  let paper = [] as ReturnType<typeof paperFixture>[];
  for (const s of optionsPaperDemoScenarios()) paper = [...appendOptionsPaperScenario(paper, s).scenarios];
  return { paper: available(paper), historical: available(fixtureHistoricalReplayCases().map(c => createHistoricalReplayRun(c.config, c.evidence, c.recordedAt))) };
}
let passed = 0; function test(name: string, work: () => void) { work(); passed++; console.log("PASS " + name); }
test("all current source cases are inventoried without counting revisions", () => {
  const h = histories(), r = inventory(h, at), original = auditOptionsOutcomes(h, at);
  eq(r.totalCases, 14); eq(r.closedReviews, 9); eq(r.sourceOutcomeAuditSha256, original.artifactSha256);
  for (const c of r.components) { eq(c.caseCount, original.components[c.sourceSystem].audit!.metrics.caseCount); eq(c.closedReviewCount, original.components[c.sourceSystem].audit!.metrics.closedCount); }
});
test("no-trade blocked pending and unresolved cases retain their original status", () => {
  const h = histories(), r = inventory(h, at), original = auditOptionsOutcomes(h, at);
  for (const c of r.components) for (const entry of c.cases) {
    const source = original.components[c.sourceSystem].audit!.cases.find(s => s.id === entry.sourceCaseId)!;
    eq(entry.originalStatus, source.status); eq(entry.originalBlockers, source.blockers); eq(entry.candidateLessonCodes, source.candidateLessonCodes);
  }
  ok(r.components[1]!.cases.some(c => c.origin === "MISSING_DATA")); ok(r.components[1]!.cases.some(c => ["OPEN", "EXIT_PENDING"].includes(c.originalStatus)));
});
test("declared decisions come from plans and never from inventory or exit clocks", () => {
  const h = histories(), r = inventory(h, at);
  for (const c of r.components[0]!.cases) { const s = h.paper.payload!.find(s => s.scenarioId === c.sourceCaseId)!; eq(c.declaredDecisionAt, s.plan.createdAt); eq(c.declaredScenarioAsOf, s.asOf); eq(c.originalRecordedAt, null); eq(c.outcomeKnownAt, null); }
  for (const c of r.components[1]!.cases) { const s = h.historical.payload!.find(s => s.config.runId === c.sourceCaseId)!; eq(c.declaredDecisionAt, s.config.plan.decisionAt); eq(c.originalRecordedAt, s.recordedAt); eq(c.outcomeKnownAt, null); }
});
test("profitable closed reviews cannot fill missing sampling metadata", () => {
  const r = inventory(histories(), at); eq(r.completePartitionInputCount, 0);
  for (const c of r.components.flatMap(c => c.cases)) { eq(c.featureWindowStartAt, null); eq(c.featuresKnownAt, null); eq(c.reviewedEpisodeId, null); eq(c.partitionInputReady, false); eq(c.missingRequirements.length, 5); }
});
test("different research plans sharing the same exact path expose dependence", () => {
  const f = historicalReplayFixture(), second = structuredClone(f.config); (second as any).runId = "different-research-plan"; (second.plan as any).entryLimitPerShareCents = 1;
  const h = { paper: available([]), historical: available([createHistoricalReplayRun(f.config, f.evidence, f.recordedAt), createHistoricalReplayRun(second, f.evidence, f.recordedAt)]) };
  const r = inventory(h, at); eq(r.repeatedQuotePaths.length, 1); eq(r.repeatedQuotePaths[0]!.inventoryIds.length, 2);
  ok(r.components[1]!.cases[0]!.planFingerprint !== r.components[1]!.cases[1]!.planFingerprint); eq(r.independentSampleCount, null);
});
test("missing evidence cannot produce an invented empty quote path identity", () => {
  const c = inventory(histories(), at).components[1]!.cases.find(c => c.origin === "MISSING_DATA")!;
  eq(c.quotePathSha256, null); eq(c.quotePathRowCount, 0); eq(c.symbol, null);
});
test("shared decision dates keep distinct source identities", () => {
  const r = inventory(histories(), at); ok(r.sharedDecisionDates.length > 0);
  const ids = r.components.flatMap(c => c.cases.map(s => s.inventoryId)); eq(new Set(ids).size, r.totalCases);
  for (const group of r.sharedDecisionDates) for (const id of group.inventoryIds) ok(ids.includes(id));
});
test("corrupt source results cannot enter the inventory", () => {
  const h = JSON.parse(JSON.stringify(histories())); h.historical.payload[0].result.netPnlCents = 999999;
  const r = inventory(h, at); eq(r.blockedStores, ["historical"]); eq(r.components[1]!.cases, []); eq(r.totalCases, 7); eq(r.status, "SAMPLE_INVENTORY_SOURCE_BLOCKED");
});
test("future actual recording blocks history while future paper scenarios remain declarations", () => {
  const h = histories(), f = historicalReplayFixture(); h.historical = available([createHistoricalReplayRun(f.config, f.evidence, "2026-09-08T00:00:00.000Z")]);
  const r = inventory(h, at); eq(r.blockedStores, ["historical"]); ok(r.components[0]!.cases.every(c => c.declaredDecisionAt > at && c.originalRecordedAt === null));
});
test("missing busy and empty stores remain distinct", () => {
  const h: OutcomeHistories = { paper: { state: "MISSING", checkedAt: at, payload: null, errorCode: "STORE_MISSING" }, historical: { state: "BLOCKED", checkedAt: at, payload: null, errorCode: "STORE_BUSY" } };
  const r = inventory(h, at); eq(r.totalCases, 0); eq(r.missingStores, ["paper"]); eq(r.blockedStores, ["historical"]);
  const empty = inventory({ paper: available([]), historical: available([]) }, at); eq(empty.totalCases, 0); eq(empty.missingStores, []); eq(empty.blockedStores, []);
});
test("immutable recomputation preserves histories and source fingerprints", () => {
  const h = histories(), before = readinessFingerprint(h), r = inventory(h, at); eq(readinessFingerprint(h), before); eq(inventory(h, at), r);
  const { artifactSha256, ...body } = r; eq(readinessFingerprint(body), artifactSha256); ok(Object.isFrozen(r.components[0]!.cases[0]!.missingRequirements));
});
test("no split or model authority is produced and bad clocks still throw", () => {
  const r = inventory(histories(), at); for (const key of ["partitionInputGenerated", "splitSelected", "heldOutAccessSealed", "calibrated", "marketValidated", "executionAllowed", "automaticStrategyChanges"] as const) eq(r[key], false);
  eq(r.winProbability, null); throws(() => inventory(histories(), "2026-09-01T00:00:00.000Z"));
});
console.log(`${passed}/${passed} tests passed.`);
