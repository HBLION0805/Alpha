import type { OptionsClosedTradeReview } from "../../contracts/OptionsTradeReview";
import type { OptionsMarketEvidence } from "../options-market-evidence/OptionsMarketEvidenceEngine";
import { marketEvidenceFingerprint, validateOptionsMarketEvidence } from "../options-market-evidence/OptionsMarketEvidenceEngine";
import { reviewClosedOptionTrade } from "../options-trade-review/OptionsTradeReviewEngine";
import { runOptionsHistoricalReplay } from "./OptionsHistoricalReplayEngine";

type Result = ReturnType<typeof runOptionsHistoricalReplay>;
export interface HistoricalResearchLesson {
  readonly code: string;
  readonly observation: string;
  readonly nextCheck: string;
  readonly classification: "RESEARCH_LIMITATION" | "EXECUTION_RISK_TO_REVIEW";
  readonly approvedKnowledge: false;
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function compare(left: string, right: string) { return left < right ? -1 : left > right ? 1 : 0; }

/** Called only with freshly recomputed engine outputs by the research composition. */
function review(result: Result) {
  let closedTradeReview: OptionsClosedTradeReview | null = null;
  if (result.status === "CLOSED") {
    if (!result.entry || !result.exit || !result.exitReason || result.plannedRiskCents === null
      || result.entrySpreadCents === null || result.netPnlCents === null || result.symbol === null || result.origin === "MISSING_DATA") throw new Error("HISTORICAL_CLOSED_REVIEW_INCOMPLETE");
    closedTradeReview = reviewClosedOptionTrade({
      tradeId: `hist:${result.runId}`, symbol: result.symbol,
      strategyVersion: result.config.plan.strategyVersion, setupKey: result.config.plan.setupKey,
      origin: result.origin === "SYNTHETIC_FIXTURE" ? "SYNTHETIC_FIXTURE" : "UNVERIFIED_IMPORT",
      planFingerprint: result.planFingerprint, entryAt: result.entry.snapshotAt, exitAt: result.exit.snapshotAt,
      exitReason: result.exitReason, entryPremiumCents: result.entry.premiumCents,
      exitProceedsCents: result.exit.premiumCents, feesCents: result.entry.feeCents + result.exit.feeCents,
      netPnlCents: result.netPnlCents, plannedRiskCents: result.plannedRiskCents,
      entrySpreadCents: result.entrySpreadCents, exitLiquidityDelayed: result.exitLiquidityDelayed,
      quoteGapObserved: result.quoteGapObserved, planViolations: [],
    });
  }
  const lessons: HistoricalResearchLesson[] = (closedTradeReview?.candidateLessons ?? []).map((lesson) => ({
    code: lesson.code, observation: lesson.observation, nextCheck: lesson.nextCheck,
    classification: "EXECUTION_RISK_TO_REVIEW", approvedKnowledge: false,
  }));
  for (const blocker of result.blockers) lessons.push({
    code: blocker, classification: "RESEARCH_LIMITATION", approvedKnowledge: false,
    observation: `This research run could not meet: ${blocker}. This is not automatically a trading mistake.`,
    nextCheck: "Resolve the recorded data, model or risk condition before a new research attempt; retain the original attempt.",
  });
  for (const [observed, code, observation, nextCheck] of [
    [result.quoteGapObserved, "QUOTE_GAP_OBSERVED", "The supplied quote path has a gap beyond its declared interval.", "Inspect missing observations and compare a separately identified denser path before drawing execution conclusions."],
    [result.exitLiquidityDelayed, "EXIT_LIQUIDITY_DELAYED", "An exit remained pending because a subsequent observation lacked usable price or assumed size.", "Review exit liquidity and retain the unresolved exposure; do not invent a fill."],
  ] as const) {
    if (observed && !lessons.some((lesson) => lesson.code === code)) lessons.push({
      code, observation, nextCheck, classification: "EXECUTION_RISK_TO_REVIEW", approvedKnowledge: false,
    });
  }
  if (result.status === "OPEN" || result.status === "EXIT_PENDING" || result.status === "ENTRY_PENDING") lessons.push({
    code: "INCOMPLETE_QUOTE_PATH", classification: "RESEARCH_LIMITATION", approvedKnowledge: false,
    observation: `The supplied path ended with status ${result.status}; no completing price or settlement was invented.`,
    nextCheck: "Use a separately identified dataset with enough subsequent observations; preserve unresolved attempts and frozen assumptions.",
  });
  if (result.exitReason === "TARGET" && result.netPnlCents !== null && result.netTargetCents !== null && result.netPnlCents < result.netTargetCents) lessons.push({
    code: "TARGET_TRIGGER_NOT_GUARANTEED_PROFIT", classification: "EXECUTION_RISK_TO_REVIEW", approvedKnowledge: false,
    observation: "The target triggered a market-style exit, but its later modeled proceeds fell below the target.",
    nextCheck: "Evaluate later-quote execution risk; do not equate a target trigger with a guaranteed target-price fill.",
  });
  const candidateLessons = [...new Map(lessons.map((lesson) => [lesson.code, lesson])).values()].sort((a, b) => compare(a.code, b.code));
  return freeze({
    schemaVersion: "1.0" as const, status: result.status, origin: result.origin,
    recordedAt: result.recordedAt, datasetId: result.config.datasetId,
    evidenceFingerprint: result.evidenceFingerprint, sourceFileSha256: result.sourceFileSha256,
    planFingerprint: result.planFingerprint, researchMode: result.researchMode, selectionStatus: result.selectionStatus,
    facts: [
      `Research outcome: ${result.status}; source classification: ${result.origin}.`,
      "Original import time and actual research-recording time are separate from the hypothetical historical decision clock.",
      "All modeled fills are assumptions. This result does not establish historical feed availability, pre-registration or a broker execution.",
      ...(closedTradeReview?.facts ?? ["There is no closed trade from which to calculate realized trading performance."]),
    ],
    hypotheses: ["Market causes are not established by this record; news, trend and volatility explanations need independently timed evidence."],
    candidateLessons, closedTradeReview, executionAllowed: false as const, winProbability: null,
    approvedKnowledge: false as const, automaticStrategyChanges: false as const,
  });
}

export function createHistoricalReplayRun(config: unknown, evidence: OptionsMarketEvidence | null, recordedAt: string) {
  const normalized = evidence === null ? null : validateOptionsMarketEvidence(evidence);
  const result = runOptionsHistoricalReplay(config, normalized, recordedAt);
  return freeze({ config: result.config, evidence: normalized, recordedAt, result, review: review(result) });
}
export type HistoricalReplayRun = ReturnType<typeof createHistoricalReplayRun>;

export function buildHistoricalReplayReport(inputs: readonly HistoricalReplayRun[]) {
  if (!Array.isArray(inputs) || inputs.length > 1000) throw new Error("HISTORICAL_REPORT_RUN_LIMIT");
  const ids = new Set<string>();
  const runs = inputs.map((run, index) => {
    if (index > 0 && run.recordedAt < inputs[index - 1]!.recordedAt) throw new Error("HISTORICAL_RUN_CLOCK_REGRESSION");
    const recomputed = createHistoricalReplayRun(run.config, run.evidence, run.recordedAt);
    if (marketEvidenceFingerprint(run) !== marketEvidenceFingerprint(recomputed)) throw new Error("HISTORICAL_RUN_REPLAY_MISMATCH");
    if (ids.has(recomputed.config.runId)) throw new Error("HISTORICAL_DUPLICATE_REPORT_RUN");
    ids.add(recomputed.config.runId); return recomputed;
  });
  const entries = new Map<string, { lessonId: string; origin: Result["origin"]; symbol: string | null; strategyVersion: string; setupKey: string;
    code: string; observation: string; nextCheck: string; classification: HistoricalResearchLesson["classification"];
    firstRecordedAt: string; lastRecordedAt: string; supportingRunIds: string[]; occurrenceCount: number; approvedKnowledge: false }>();
  const annotated = runs.map((run) => {
    const context = { origin: run.result.origin, symbol: run.result.symbol, strategyVersion: run.config.plan.strategyVersion, setupKey: run.config.plan.setupKey };
    const priorResearchLessonIds = [...entries.values()].filter((entry) => entry.origin === context.origin && entry.symbol === context.symbol
      && entry.strategyVersion === context.strategyVersion && entry.setupKey === context.setupKey && entry.lastRecordedAt <= run.recordedAt).map((entry) => entry.lessonId).sort();
    for (const lesson of run.review.candidateLessons) {
      const lessonId = marketEvidenceFingerprint({ ...context, code: lesson.code });
      const entry = entries.get(lessonId);
      if (entry) { entry.supportingRunIds.push(run.config.runId); entry.occurrenceCount++; entry.lastRecordedAt = run.recordedAt; }
      else entries.set(lessonId, { lessonId, ...context, ...lesson, firstRecordedAt: run.recordedAt,
        lastRecordedAt: run.recordedAt, supportingRunIds: [run.config.runId], occurrenceCount: 1 });
    }
    return { ...run, priorResearchLessonIds };
  });
  return freeze({ schemaVersion: "1.0" as const, runCount: runs.length, runs: annotated,
    closedTradeCount: runs.filter((run) => run.result.status === "CLOSED").length,
    sourceCounts: { SYNTHETIC_FIXTURE: runs.filter((run) => run.result.origin === "SYNTHETIC_FIXTURE").length,
      OWNER_PROVIDED_FILE: runs.filter((run) => run.result.origin === "OWNER_PROVIDED_FILE").length,
      MISSING_DATA: runs.filter((run) => run.result.origin === "MISSING_DATA").length },
    mistakeNotebook: { entries: [...entries.values()].sort((a, b) => compare(a.lessonId, b.lessonId)),
      learningClock: "ACTUAL_RESEARCH_RECORDING_TIME_NOT_HISTORICAL_MARKET_TIME", approvedKnowledge: false, automaticStrategyChanges: false },
    accountAggregation: "INDEPENDENT_1000_USD_RUNS_NO_SHARED_COMPOUNDING", executionAllowed: false, marketValidated: false, winProbability: null,
  });
}
