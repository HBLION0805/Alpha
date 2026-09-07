import { auditOptionsOutcomes, type OutcomeHistories } from "../options-readiness/OptionsOutcomeAudit";
import { readinessFingerprint } from "../options-readiness/OptionsReadinessEngine";
import { exchangeLocalDate } from "../market-calendar/MarketCalendarValidation";
import { freezePaper } from "../options-paper/OptionsPaperTradingEngine";

const REQUIREMENTS = Object.freeze(["FEATURE_WINDOW_NOT_MANIFESTED", "FEATURE_AVAILABILITY_NOT_MANIFESTED", "OUTCOME_KNOWLEDGE_NOT_VERIFIED",
  "DEPENDENCE_GROUP_NOT_REVIEWED", "PARTITION_PROTOCOL_NOT_REGISTERED"]);
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Recompute source outcomes first. Missing sampling facts cannot be inferred from a profitable review. */
export function inventoryOptionsSamples(histories: OutcomeHistories, constructedAt: string) {
  const audit = auditOptionsOutcomes(histories, constructedAt);
  const components = (Object.keys(audit.components) as ("paper" | "historical")[]).map(sourceSystem => {
    const component = audit.components[sourceSystem];
    const cases = (component.audit?.cases ?? []).map(c => {
      const paper = sourceSystem === "paper" ? histories.paper.payload!.find(p => p.scenarioId === c.id) : null;
      const historical = sourceSystem === "historical" ? histories.historical.payload!.find(h => h.config.runId === c.id) : null;
      if (!paper && !historical) throw Error("SAMPLE_INVENTORY_SOURCE_LINK");
      const declaredDecisionAt = paper ? paper.plan.createdAt : historical!.config.plan.decisionAt;
      const path = paper ? paper.quotes : historical!.evidence?.rows ?? null;
      return {
        inventoryId: sourceSystem + ":" + c.id, sourceSystem, sourceCaseId: c.id, origin: c.origin, symbol: c.symbol,
        strategyVersion: c.strategyVersion, setupKey: c.setupKey, originalStatus: c.status, originalBlockers: c.blockers,
        declaredDecisionAt, decisionDateNewYork: exchangeLocalDate(declaredDecisionAt, "America/New_York"),
        originalRecordedAt: c.recordedAt, declaredScenarioAsOf: c.scenarioAsOf,
        modeledExitAt: c.review?.input.exitAt ?? null, outcomeKnownAt: null,
        sourceFingerprint: c.sourceFingerprint, planFingerprint: c.planFingerprint,
        quotePathSha256: path === null || path.length === 0 ? null : readinessFingerprint({ sourceSystem, origin: c.origin, path }),
        quotePathRowCount: path?.length ?? 0,
        closedReviewPresent: c.review !== null, candidateLessonCodes: c.candidateLessonCodes,
        featureWindowStartAt: null, featuresKnownAt: null, reviewedEpisodeId: null,
        partitionInputReady: false, missingRequirements: REQUIREMENTS,
      };
    }).sort((a, b) => compare(a.declaredDecisionAt, b.declaredDecisionAt) || compare(a.inventoryId, b.inventoryId));
    return { sourceSystem, state: component.state, checkedAt: component.checkedAt, errorCode: component.errorCode,
      sourceReportSha256: component.audit?.sourceReportSha256 ?? null,
      caseCount: cases.length, closedReviewCount: cases.filter(c => c.closedReviewPresent).length, cases };
  });
  const cases = components.flatMap(c => c.cases), paths = new Map<string, string[]>(), dates = new Map<string, string[]>();
  for (const c of cases) {
    if (c.quotePathSha256 !== null) paths.set(c.quotePathSha256, [...(paths.get(c.quotePathSha256) ?? []), c.inventoryId]);
    dates.set(c.decisionDateNewYork, [...(dates.get(c.decisionDateNewYork) ?? []), c.inventoryId]);
  }
  const groups = (map: Map<string, string[]>) => [...map].filter(([, ids]) => ids.length > 1).sort(([a], [b]) => compare(a, b))
    .map(([key, inventoryIds]) => ({ key, inventoryIds: inventoryIds.sort(compare) }));
  const body = { version: "OPTIONS_SAMPLE_INVENTORY_V1", constructedAt, sourceOutcomeAuditSha256: audit.artifactSha256,
    status: audit.blockedStores.length ? "SAMPLE_INVENTORY_SOURCE_BLOCKED" : "SAMPLE_INVENTORY_REQUIRES_EVIDENCE",
    blockedStores: audit.blockedStores, missingStores: audit.missingStores, components,
    totalCases: cases.length, closedReviews: cases.filter(c => c.closedReviewPresent).length,
    completePartitionInputCount: 0, independentSampleCount: null,
    repeatedQuotePaths: groups(paths), sharedDecisionDates: groups(dates),
    partitionInputGenerated: false, splitSelected: false, heldOutAccessSealed: false,
    winProbability: null, calibrated: false, marketValidated: false, executionAllowed: false, automaticStrategyChanges: false,
    limitations: ["Inventory retains current reconstructed cases; journal revisions do not create extra outcomes.",
      "Declared decisions, simulated exits, import times and actual recording times have different meanings. None supplies a missing feature receipt or historical outcome-knowledge clock.",
      "Repeated exact paths and shared New York dates expose possible dependence. Non-matching hashes do not prove different or statistically independent information.",
      "All source cases lack a complete separately manifested sampling protocol. No train/validation/holdout input or model evaluation is manufactured.",
      "Original reviews and candidate lessons are retained through their source hashes; this inventory does not alter any learning record or risk policy."] };
  return freezePaper({ ...body, artifactSha256: readinessFingerprint(body) });
}
