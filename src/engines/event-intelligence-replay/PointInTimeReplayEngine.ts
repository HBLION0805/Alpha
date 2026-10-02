import type {
  EvidenceCompleteness,
  EventArrivalOrder,
  EventIntelligenceCase,
  EventIntelligenceEvidence,
  HistoricalDecisionArtifact,
  NumericInvalidationRule,
  NumericObservation,
  PointInTimeReplayView,
} from "../../contracts/EventIntelligenceReplay";

const clock = (value: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("EVENT_INTELLIGENCE_INVALID_CLOCK");
  return parsed;
};

const assertText = (value: string, code: string): void => {
  if (!value.trim()) throw new Error(code);
};

const compareEvidence = (a: EventIntelligenceEvidence, b: EventIntelligenceEvidence): number =>
  clock(a.receivedAt) - clock(b.receivedAt) || a.evidenceId.localeCompare(b.evidenceId);

const compareDecision = (a: HistoricalDecisionArtifact, b: HistoricalDecisionArtifact): number =>
  clock(a.generatedAt) - clock(b.generatedAt) || a.decisionId.localeCompare(b.decisionId);
function validateCase(value: EventIntelligenceCase): void {
  assertText(value.eventId, "EVENT_INTELLIGENCE_EVENT_ID");
  assertText(value.title, "EVENT_INTELLIGENCE_TITLE");
  clock(value.createdAt);
  if (value.eventTime !== null) clock(value.eventTime);

  const evidence = new Map<string, EventIntelligenceEvidence>();
  for (const item of value.evidence) {
    if (item.eventId !== value.eventId || evidence.has(item.evidenceId)) throw new Error("EVENT_INTELLIGENCE_EVIDENCE_ID");
    clock(item.receivedAt);
    if (item.occurredAt !== null) clock(item.occurredAt);
    if (item.sourcePublishedAt !== null) clock(item.sourcePublishedAt);
    if (item.vendorReceivedAt !== null) clock(item.vendorReceivedAt);
    if (item.parsedAt !== null && clock(item.parsedAt) < clock(item.receivedAt)) throw new Error("EVENT_INTELLIGENCE_PARSE_CLOCK");
    if (item.kind === "EXPECTATION_SNAPSHOT") {
      const snapshot = item.expectationSnapshot;
      if (!snapshot || !["RESEARCH","FINAL_PRE_ENTRY"].includes(snapshot.stage) || typeof snapshot.ownerConfirmed !== "boolean" ||
          !Array.isArray(snapshot.rows) || snapshot.rows.length === 0 || snapshot.rows.length > 24) {
        throw new Error("EVENT_INTELLIGENCE_EXPECTATION_SNAPSHOT");
      }
      const ids = new Set<string>();
      const selectedBySubject = new Set<string>();
      for (const row of snapshot.rows) {
        if (ids.has(row.id)) throw new Error("EVENT_INTELLIGENCE_EXPECTATION_ROW_ID");
        ids.add(row.id);
        for (const field of [row.id,row.metric,row.period,row.unit,row.adjustment,row.releaseVersion,row.valueMeaning,row.source,row.methodology]) {
          assertText(field,"EVENT_INTELLIGENCE_EXPECTATION_TEXT");
        }
        if (!["CONSENSUS","SINGLE_FORECAST","MODEL_ESTIMATE","MARKET_IMPLIED","OWNER_EXPECTATION","UNKNOWN"].includes(row.expectationType)) {
          throw new Error("EVENT_INTELLIGENCE_EXPECTATION_TYPE");
        }
        if (row.value !== null && !/^-?(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(row.value)) throw new Error("EVENT_INTELLIGENCE_EXPECTATION_VALUE");
        if (row.expectationType === "UNKNOWN" && row.value !== null) throw new Error("EVENT_INTELLIGENCE_EXPECTATION_UNKNOWN_VALUE");
        if (typeof row.selected !== "boolean" || (row.selected && row.expectationType !== "CONSENSUS")) throw new Error("EVENT_INTELLIGENCE_EXPECTATION_SELECTED");
        const sourceReceived = clock(row.sourceReceivedAt);
        if (sourceReceived > clock(item.receivedAt) || (row.sourcePublishedAt !== null && clock(row.sourcePublishedAt) > sourceReceived)) {
          throw new Error("EVENT_INTELLIGENCE_EXPECTATION_CLOCK");
        }
        if (row.sampleInfo !== null && typeof row.sampleInfo !== "string") throw new Error("EVENT_INTELLIGENCE_EXPECTATION_SAMPLE");
        if (row.selected) {
          const subject=[row.metric,row.period,row.unit,row.adjustment,row.releaseVersion,row.valueMeaning].join("|");
          if (selectedBySubject.has(subject)) throw new Error("EVENT_INTELLIGENCE_EXPECTATION_SELECTED_DUPLICATE");
          selectedBySubject.add(subject);
        }
      }
    } else if (item.expectationSnapshot !== null) {
      throw new Error("EVENT_INTELLIGENCE_NON_EXPECTATION_METADATA");
    }
    if (item.kind === "MARKET_OBSERVATION") {
      const market = item.marketObservation;
      if (!market || !market.instrument.trim() || !market.comparabilityReason.trim()) throw new Error("EVENT_INTELLIGENCE_MARKET_METADATA");
      clock(market.quoteObservedAt);
      if (market.detectedMovement) {
        assertText(market.detectedMovement.ruleVersion,"EVENT_INTELLIGENCE_MOVEMENT_RULE");
        const detectedAt=clock(market.detectedMovement.detectedAt);
        if (detectedAt < clock(market.quoteObservedAt) || detectedAt > clock(item.parsedAt ?? item.receivedAt)) throw new Error("EVENT_INTELLIGENCE_MOVEMENT_CLOCK");
      }
      if (market.declaredDelayMs !== null && (!Number.isSafeInteger(market.declaredDelayMs) || market.declaredDelayMs < 0)) {
        throw new Error("EVENT_INTELLIGENCE_MARKET_DELAY");
      }
      if (!["REGULAR","PREMARKET","AFTER_HOURS","TWENTY_FOUR_SEVEN","UNKNOWN"].includes(market.session) ||
          !["COMPARABLE","LIMITED","NOT_COMPARABLE"].includes(market.comparability)) throw new Error("EVENT_INTELLIGENCE_MARKET_METADATA");
    } else if (item.marketObservation !== null) {
      throw new Error("EVENT_INTELLIGENCE_NON_MARKET_METADATA");
    }
    evidence.set(item.evidenceId, item);
  }

  for (const item of value.evidence) {
    if (item.supersedesEvidenceId === null) continue;
    const prior = evidence.get(item.supersedesEvidenceId);
    if (!prior || clock(prior.receivedAt) > clock(item.receivedAt)) throw new Error("EVENT_INTELLIGENCE_CORRECTION_ORDER");
  }
  const decisions = new Set<string>();
  for (const decision of [...value.historicalDecisions, ...value.recomputedDecisions]) {
    if (decision.eventId !== value.eventId || decisions.has(decision.decisionId)) throw new Error("EVENT_INTELLIGENCE_DECISION_ID");
    decisions.add(decision.decisionId);
    if (clock(decision.evidenceCutoffAt) > clock(decision.generatedAt)) throw new Error("EVENT_INTELLIGENCE_DECISION_CLOCK");
    for (const [field, code] of [[decision.decisionVersion, "DECISION_VERSION"], [decision.ruleVersion, "RULE_VERSION"], [decision.modelVersion, "MODEL_VERSION"], [decision.thesisVersion, "THESIS_VERSION"]] as const) {
      assertText(field, `EVENT_INTELLIGENCE_${code}`);
    }
    for (const evidenceId of decision.inputEvidenceIds) {
      const item = evidence.get(evidenceId);
      if (!item) throw new Error("EVENT_INTELLIGENCE_DECISION_EVIDENCE_MISSING");
      if (clock(item.receivedAt) > clock(decision.evidenceCutoffAt) || (item.parsedAt !== null && clock(item.parsedAt) > clock(decision.evidenceCutoffAt))) throw new Error("EVENT_INTELLIGENCE_DECISION_FUTURE_EVIDENCE");
    }
  }

  for (const decision of value.recomputedDecisions) {
    if (decision.replacesHistoricalDecision !== false || clock(decision.recomputedAt) < clock(decision.generatedAt)) {
      throw new Error("EVENT_INTELLIGENCE_RECOMPUTE_AUTHORITY");
    }
  }

  for (const id of value.requiredEvidenceIds) if (!evidence.has(id)) throw new Error("EVENT_INTELLIGENCE_REQUIRED_EVIDENCE_UNKNOWN");
  for (const rule of value.invalidationRules) {
    clock(rule.definedAt);
    assertText(rule.ruleId, "EVENT_INTELLIGENCE_INVALIDATION_RULE_ID");
    assertText(rule.thesisVersion, "EVENT_INTELLIGENCE_INVALIDATION_THESIS_VERSION");
    assertText(rule.metric, "EVENT_INTELLIGENCE_INVALIDATION_METRIC");
    assertText(rule.sourceId, "EVENT_INTELLIGENCE_INVALIDATION_SOURCE");
    if (!Number.isFinite(rule.threshold) || !Number.isSafeInteger(rule.requiredObservations) || !Number.isSafeInteger(rule.windowSeconds) ||
        !Number.isSafeInteger(rule.observationIntervalSeconds) || rule.requiredObservations <= 0 || rule.windowSeconds <= 0 ||
        rule.observationIntervalSeconds <= 0 || rule.windowSeconds < rule.observationIntervalSeconds * Math.max(0, rule.requiredObservations - 1)) {
      throw new Error("EVENT_INTELLIGENCE_INVALIDATION_RULE");
    }
  }
}
function completeness(
  requiredEvidenceIds: readonly string[],
  visible: readonly EventIntelligenceEvidence[],
): { status: EvidenceCompleteness; unavailable: string[]; unseen: number } {
  if (!requiredEvidenceIds.length) return { status: "COMPLETE", unavailable: [], unseen: 0 };
  const byId = new Map(visible.map((item) => [item.evidenceId, item]));
  const unseen = requiredEvidenceIds.filter((id) => !byId.has(id)).length;
  const unavailable = requiredEvidenceIds.filter((id) => {
    const item = byId.get(id);
    return item !== undefined && item.availability !== "CURRENT";
  });
  const usable = requiredEvidenceIds.length - unseen - unavailable.length;
  return {
    status: usable === requiredEvidenceIds.length ? "COMPLETE" : usable === 0 ? "INSUFFICIENT" : "PARTIAL",
    unavailable,
    unseen,
  };
}

function arrivalOrder(visible: readonly EventIntelligenceEvidence[]): EventArrivalOrder {
  const market = visible.find((item) => item.kind === "MARKET_OBSERVATION" && item.marketObservation?.detectedMovement);
  const news = visible.find((item) => item.kind === "SOURCE_OBSERVATION");
  if (!market || !news) return "ORDER_UNKNOWN";
  const marketAt = clock(market.marketObservation!.detectedMovement!.detectedAt);
  const newsAt = clock(news.receivedAt);
  if (marketAt < newsAt) return "PRICE_LEADS_NEWS";
  if (newsAt < marketAt) return "NEWS_LEADS_PRICE";
  return "SIMULTANEOUS_WITHIN_CLOCK_RESOLUTION";
}

export class PointInTimeReplayEngine {
  replay(value: EventIntelligenceCase, asOf: string): PointInTimeReplayView {
    validateCase(value);
    const cutoff = clock(asOf);
    const visibleEvidence = value.evidence.filter((item) => clock(item.receivedAt) <= cutoff && (item.parsedAt === null || clock(item.parsedAt) <= cutoff)).sort(compareEvidence);
    const visibleHistoricalDecisions = value.historicalDecisions
      .filter((item) => clock(item.generatedAt) <= cutoff)
      .sort(compareDecision);
    const visibleRecomputedDecisions = value.recomputedDecisions
      .filter((item) => clock(item.recomputedAt) <= cutoff)
      .sort((a, b) => clock(a.recomputedAt) - clock(b.recomputedAt) || a.decisionId.localeCompare(b.decisionId));
    const coverage = completeness(value.requiredEvidenceIds, visibleEvidence);
    const latestHistoricalDecision = visibleHistoricalDecisions.at(-1) ?? null;

    return {
      eventId: value.eventId,
      asOf,
      visibleEvidence,
      hiddenFutureEvidenceCount: value.evidence.length - visibleEvidence.length,
      visibleHistoricalDecisions,
      hiddenFutureDecisionCount: value.historicalDecisions.length - visibleHistoricalDecisions.length,
      latestHistoricalDecision,
      lastEvaluableDecision: visibleHistoricalDecisions.filter(d=>d.thesisState!=="UNEVALUABLE").at(-1) ?? null,
      recomputedDecisions: visibleRecomputedDecisions.map((item) => structuredClone(item)),
      hiddenFutureRecomputedDecisionCount: value.recomputedDecisions.length - visibleRecomputedDecisions.length,
      evidenceCompleteness: coverage.status,
      unavailableRequiredEvidenceIds: coverage.unavailable,
      unseenRequiredEvidenceCount: coverage.unseen,
      thesisState: latestHistoricalDecision?.thesisState ?? null,
      arrivalOrder: arrivalOrder(visibleEvidence),
      executionAllowed: false,
    };
  }
}
export type InvalidationEvaluation = "TRIGGERED" | "NOT_TRIGGERED" | "INSUFFICIENT_DATA";

const satisfies = (operator: NumericInvalidationRule["operator"], value: number, threshold: number): boolean => {
  if (operator === "GT") return value > threshold;
  if (operator === "GTE") return value >= threshold;
  if (operator === "LT") return value < threshold;
  return value <= threshold;
};

export function evaluateNumericInvalidationRule(
  rule: NumericInvalidationRule,
  observations: readonly NumericObservation[],
  asOf: string,
): InvalidationEvaluation {
  const cutoff = clock(asOf);
  if (clock(rule.definedAt) > cutoff) return "INSUFFICIENT_DATA";
  const start = cutoff - rule.windowSeconds * 1000;
  const candidates = observations
    .filter((item) =>
      item.metric === rule.metric &&
      item.sourceId === rule.sourceId &&
      clock(item.receivedAt) <= cutoff &&
      clock(item.observedAt) >= start &&
      clock(item.observedAt) <= cutoff)
    .sort((a, b) => clock(a.observedAt) - clock(b.observedAt) || clock(a.receivedAt) - clock(b.receivedAt));

  if (candidates.length < rule.requiredObservations) return "INSUFFICIENT_DATA";
  const sample = candidates.slice(-rule.requiredObservations);
  for (let index = 1; index < sample.length; index += 1) {
    if (clock(sample[index]!.observedAt) - clock(sample[index - 1]!.observedAt) !== rule.observationIntervalSeconds * 1000) {
      return "INSUFFICIENT_DATA";
    }
  }
  return sample.every((item) => satisfies(rule.operator, item.value, rule.threshold))
    ? "TRIGGERED"
    : "NOT_TRIGGERED";
}
