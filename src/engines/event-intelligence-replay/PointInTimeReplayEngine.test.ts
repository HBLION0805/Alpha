import type {
  EventIntelligenceCase,
  EventIntelligenceEvidence,
  HistoricalDecisionArtifact,
  RecomputedDecisionArtifact,
} from "../../contracts/EventIntelligenceReplay";
import {
  PointInTimeReplayEngine,
  evaluateNumericInvalidationRule,
} from "./PointInTimeReplayEngine";

const equal = (actual: unknown, expected: unknown, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
};
const deepEqual = (actual: unknown, expected: unknown, message: string): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
};
const throws = (fn: () => void, expected: string): void => {
  try { fn(); } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(expected)) throw error;
    return;
  }
  throw new Error(`Expected error containing ${expected}`);
};

const evidence = (
  evidenceId: string,
  kind: EventIntelligenceEvidence["kind"],
  receivedAt: string,
  availability: EventIntelligenceEvidence["availability"] = "CURRENT",
  supersedesEvidenceId: string | null = null,
): EventIntelligenceEvidence => ({
  evidenceId,
  eventId: "cpi-2026-10",
  kind,
  sourceId: kind === "MARKET_OBSERVATION" ? "market-feed" : "bls",
  sourceUrl: null,
  occurredAt: null,
  sourcePublishedAt: null,
  vendorReceivedAt: null,
  receivedAt,
  parsedAt: receivedAt,
  availability,
  summary: evidenceId,
  supersedesEvidenceId,
  expectationSnapshot: kind === "EXPECTATION_SNAPSHOT" ? {
    stage: "RESEARCH", ownerConfirmed: false, rows: [{
      id: "consensus-test", metric: "TEST_METRIC", period: "2026-09", unit: "COUNT", adjustment: "SA",
      releaseVersion: "INITIAL", valueMeaning: "LEVEL", expectationType: "CONSENSUS", value: "1", selected: true,
      source: "test", sourcePublishedAt: null, sourceReceivedAt: receivedAt, methodology: "test", sampleInfo: null,
    }],
  } : null,
  marketObservation: kind === "MARKET_OBSERVATION" ? {
    detectedMovement: { detectedAt: receivedAt, ruleVersion: "SYNTHETIC_TEST_DETECTOR_NOT_LIVE" },
    instrument: "GLD",
    quoteObservedAt: receivedAt,
    declaredDelayMs: null,
    session: "REGULAR",
    comparability: "LIMITED",
    comparabilityReason: "Test observation keeps provider delay unknown.",
  } : null,
});
const historical = (
  decisionId: string,
  generatedAt: string,
  evidenceCutoffAt: string,
  inputEvidenceIds: readonly string[],
  thesisState: HistoricalDecisionArtifact["thesisState"],
  evidenceCompleteness: HistoricalDecisionArtifact["evidenceCompleteness"],
): HistoricalDecisionArtifact => ({
  decisionId,
  eventId: "cpi-2026-10",
  generatedAt,
  evidenceCutoffAt,
  inputEvidenceIds,
  decisionVersion: "decision-v1",
  ruleVersion: "rules-v1",
  modelVersion: "model-v1",
  thesisVersion: "gold-cpi-v3",
  thesisState,
  evidenceCompleteness,
  reason: decisionId,
  blockers: [],
});

const recomputed: RecomputedDecisionArtifact = {
  ...historical("recomputed-v2", "2026-10-01T12:30:03.000Z", "2026-10-01T12:30:02.500Z", ["expectation", "first-source", "correction"], "DEGRADE", "COMPLETE"),
  recomputedAt: "2026-10-02T00:00:00.000Z",
  replacesHistoricalDecision: false,
};
const scheduled: EventIntelligenceCase = {
  eventId: "cpi-2026-10",
  caseType: "SCHEDULED",
  title: "CPI scheduled release",
  eventTime: "2026-10-01T12:30:00.000Z",
  createdAt: "2026-10-01T12:00:00.000Z",
  evidence: [
    evidence("expectation", "EXPECTATION_SNAPSHOT", "2026-10-01T12:20:00.000Z"),
    evidence("market-leads", "MARKET_OBSERVATION", "2026-10-01T12:30:00.200Z"),
    evidence("first-source", "SOURCE_OBSERVATION", "2026-10-01T12:30:00.400Z"),
    evidence("correction", "CORRECTION", "2026-10-01T12:30:02.000Z", "CURRENT", "first-source"),
  ],
  historicalDecisions: [
    historical("decision-1", "2026-10-01T12:30:01.000Z", "2026-10-01T12:30:00.500Z", ["expectation", "first-source"], "MAINTAIN", "PARTIAL"),
    historical("decision-2", "2026-10-01T12:30:03.000Z", "2026-10-01T12:30:02.500Z", ["expectation", "first-source", "correction"], "DEGRADE", "COMPLETE"),
  ],
  recomputedDecisions: [recomputed],
  invalidationRules: [],
  requiredEvidenceIds: ["expectation", "first-source"],
};

const engine = new PointInTimeReplayEngine();
{
  const view = engine.replay(scheduled, "2026-10-01T12:30:00.300Z");
  deepEqual(view.visibleEvidence.map((item) => item.evidenceId), ["expectation", "market-leads"], "future evidence hidden");
  equal(view.visibleHistoricalDecisions.length, 0, "future decisions hidden");
  equal(view.hiddenFutureEvidenceCount, 2, "future evidence count");
  equal(view.evidenceCompleteness, "PARTIAL", "partial evidence");
  equal(view.unseenRequiredEvidenceCount, 1, "future requirement is counted without revealing its id");
  equal(view.thesisState, null, "no early thesis");
  equal(view.arrivalOrder, "ORDER_UNKNOWN", "arrival order stays unknown until both market and news are visible");
}

{
  const view = engine.replay(scheduled, "2026-10-01T12:30:01.500Z");
  deepEqual(view.visibleEvidence.map((item) => item.evidenceId), ["expectation", "market-leads", "first-source"], "as-of evidence");
  deepEqual(view.visibleHistoricalDecisions.map((item) => item.decisionId), ["decision-1"], "as-of historical decision");
  equal(view.latestHistoricalDecision?.thesisState, "MAINTAIN", "historical thesis");
  equal(view.evidenceCompleteness, "COMPLETE", "complete evidence");
  equal(view.recomputedDecisions.length, 0, "future recomputation stays hidden");
  equal(view.hiddenFutureRecomputedDecisionCount, 1, "future recomputation counted without disclosure");
  equal(view.arrivalOrder, "PRICE_LEADS_NEWS", "market observation before received news is preserved without causality");
}

{
  const view = engine.replay(scheduled, "2026-10-02T00:00:01.000Z");
  equal(view.recomputedDecisions[0]?.replacesHistoricalDecision, false, "recomputed stays separate");
  equal(view.recomputedDecisions[0]?.decisionId, "recomputed-v2", "recomputed identity");
  equal(view.hiddenFutureRecomputedDecisionCount, 0, "recomputed appears only after recomputedAt");
}
{
  const incomplete: EventIntelligenceCase = {
    ...scheduled,
    evidence: scheduled.evidence.map((item) =>
      item.evidenceId === "first-source" ? { ...item, availability: "MISSING" as const } : item),
    historicalDecisions: [
      historical("decision-insufficient", "2026-10-01T12:30:01.000Z", "2026-10-01T12:30:00.500Z", ["expectation"], "MAINTAIN", "INSUFFICIENT"),
    ],
  };
  const view = engine.replay(incomplete, "2026-10-01T12:30:01.500Z");
  equal(view.evidenceCompleteness, "PARTIAL", "missing evidence lowers completeness");
  equal(view.thesisState, "MAINTAIN", "missing evidence does not rewrite historical thesis");
  deepEqual(view.unavailableRequiredEvidenceIds, ["first-source"], "visible unavailable evidence reported");
  equal(view.unseenRequiredEvidenceCount, 0, "no unseen requirement after source record exists");
}

{
  const invalidFutureDecision: EventIntelligenceCase = {
    ...scheduled,
    historicalDecisions: [
      historical("bad", "2026-10-01T12:30:01.000Z", "2026-10-01T12:30:00.300Z", ["first-source"], "MAINTAIN", "PARTIAL"),
    ],
  };
  throws(() => engine.replay(invalidFutureDecision, "2026-10-01T12:31:00.000Z"), "DECISION_FUTURE_EVIDENCE");
}
{
  const rule = {
    ruleId: "dxy-persistence-v1",
    thesisVersion: "gold-cpi-v3",
    definedAt: "2026-10-01T12:20:00.000Z",
    metric: "DXY",
    sourceId: "market-feed",
    operator: "GT" as const,
    threshold: 103.5,
    windowSeconds: 180,
    requiredObservations: 3,
    observationIntervalSeconds: 60,
  };
  const observations = [
    { observedAt: "2026-10-01T12:30:00.000Z", receivedAt: "2026-10-01T12:30:00.100Z", metric: "DXY", sourceId: "market-feed", value: 103.6 },
    { observedAt: "2026-10-01T12:31:00.000Z", receivedAt: "2026-10-01T12:31:00.100Z", metric: "DXY", sourceId: "market-feed", value: 103.7 },
    { observedAt: "2026-10-01T12:32:00.000Z", receivedAt: "2026-10-01T12:32:00.100Z", metric: "DXY", sourceId: "market-feed", value: 103.8 },
  ];
  equal(evaluateNumericInvalidationRule(rule, observations, "2026-10-01T12:31:30.000Z"), "INSUFFICIENT_DATA", "needs required observations");
  equal(evaluateNumericInvalidationRule(rule, observations, "2026-10-01T12:32:30.000Z"), "TRIGGERED", "sustained threshold triggers");
  equal(evaluateNumericInvalidationRule(rule, [...observations.slice(0, 2), { ...observations[2]!, value: 103.4 }], "2026-10-01T12:32:30.000Z"), "NOT_TRIGGERED", "counter observation blocks trigger");
  equal(evaluateNumericInvalidationRule(rule, [...observations.slice(0, 2), { ...observations[2]!, receivedAt: "2026-10-01T12:33:00.000Z" }], "2026-10-01T12:32:30.000Z"), "INSUFFICIENT_DATA", "late receipt cannot leak into an earlier rule evaluation");
  equal(evaluateNumericInvalidationRule(rule, [observations[0]!, { ...observations[1]!, observedAt: "2026-10-01T12:30:30.000Z", receivedAt: "2026-10-01T12:30:30.100Z" }, observations[2]!], "2026-10-01T12:32:30.000Z"), "INSUFFICIENT_DATA", "off-cadence samples cannot satisfy a declared persistence interval");
}

{
  const unscheduledEvidence = [
    { ...evidence("pre-state", "PRE_EVENT_STATE", "2026-10-01T18:00:00.000Z"), eventId: "geo-shock-1", sourceId: "state-recorder" },
    { ...evidence("price-move", "MARKET_OBSERVATION", "2026-10-01T18:17:31.000Z"), eventId: "geo-shock-1", sourceId: "market-feed" },
    { ...evidence("headline", "SOURCE_OBSERVATION", "2026-10-01T18:17:35.000Z"), eventId: "geo-shock-1", sourceId: "squawk", sourcePublishedAt: "2026-10-01T18:17:36.000Z" },
  ];
  const unscheduled: EventIntelligenceCase = {
    eventId: "geo-shock-1",
    caseType: "UNSCHEDULED",
    title: "Unscheduled geopolitical shock",
    eventTime: null,
    createdAt: "2026-10-01T18:00:00.000Z",
    evidence: unscheduledEvidence,
    historicalDecisions: [],
    recomputedDecisions: [],
    invalidationRules: [],
    requiredEvidenceIds: ["pre-state", "headline"],
  };
  const view = engine.replay(unscheduled, "2026-10-01T18:17:33.000Z");
  deepEqual(view.visibleEvidence.map((item) => item.evidenceId), ["pre-state", "price-move"], "price may lead first received headline");
  equal(view.hiddenFutureEvidenceCount, 1, "later headline remains hidden");
  equal(view.evidenceCompleteness, "PARTIAL", "unverified shock remains partial");
  equal(view.unseenRequiredEvidenceCount, 1, "future headline identity remains undisclosed");
  equal(view.thesisState, null, "no thesis state invented before a decision");
  equal(view.arrivalOrder, "ORDER_UNKNOWN", "headline still hidden means causal order stays unknown");
  const afterHeadline = engine.replay(unscheduled, "2026-10-01T18:17:36.000Z");
  equal(afterHeadline.arrivalOrder, "PRICE_LEADS_NEWS", "price-first ordering becomes explicit only after the headline is received");
}

console.log("PointInTimeReplayEngine tests passed");
