import { createHash } from "node:crypto";
import { canonicalizeDeterministicValue } from "../../contracts/DeterministicFingerprint";
import { exchangeLocalDate } from "../market-calendar/MarketCalendarValidation";

export const READINESS_VERSION = "OPTIONS_OPERATIONAL_READINESS_V1";
export const READINESS_COMPONENTS = ["collection", "paper", "historical", "imports", "headlines", "treasury"] as const;
export type ReadinessComponent = typeof READINESS_COMPONENTS[number];
export interface ReadinessSummaries {
  collection: { studyId: string; stage: "WAITING_FOR_WINDOW" | "WINDOW_IN_PROGRESS" | "WINDOW_ENDED"; windowStartAt: string; windowEndAt: string;
    declaredSlots: number; elapsedSlots: number; completeUsableSlots: number; automaticAttempts: number; sourceFailures: number;
    savedFrames: number; usableObservations: number; operationalLessons: number; quoteQualityLessons: number; blockerCodes: string[] };
  paper: { origin: "SYNTHETIC_FIXTURE" | "UNVERIFIED_IMPORT" | null; tradeCount: number; closedTradeCount: number; reviewCount: number;
    missingReviewCount: number; openPositionCount: number; pendingOrderCount: number; candidateLessonCount: number; notebookFingerprint: string };
  historical: { runCount: number; closedTradeCount: number; reviewedRunCount: number; candidateLessonCount: number;
    syntheticRuns: number; importedRuns: number; missingDataRuns: number };
  imports: { datasetCount: number; rowCount: number; syntheticDatasets: number; ownerProvidedDatasets: number; decision: "NO_REPLAY" };
  headlines: { observationsInHistory: number; sources: { id: string; status: "NOT_REFRESHED" | "OK" | "EMPTY" | "FAILED"; observedAt: string | null; refreshOverdue: boolean }[] };
  treasury: { retrievalCount: number; status: "OK" | "EMPTY" | "FAILED" | "NOT_REFRESHED"; receivedAt: string | null; sourceDate: string | null;
    ratesBps: Record<5 | 7 | 10 | 20 | 30, number | null> | null; dateLagDays: number | null; missingTenors: number[]; versionCount: number };
}
export type ReadinessEvidence<K extends ReadinessComponent> =
  { state: "AVAILABLE"; checkedAt: string; reportSha256: string; summary: ReadinessSummaries[K]; errorCode: null } |
  { state: "MISSING" | "BLOCKED"; checkedAt: string; reportSha256: null; summary: null; errorCode: "STORE_MISSING" | "STORE_BUSY" | "STORE_UNSAFE" | "RECOVERY_FAILED" };
export type ReadinessEvidenceMap = { [K in ReadinessComponent]: ReadinessEvidence<K> };
const fail = (code: string): never => { throw Error("OPTIONS_READINESS_" + code); };
export const readinessFingerprint = (value: unknown): string => createHash("sha256").update(canonicalizeDeterministicValue(value), "utf8").digest("hex");
export function readinessClock(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail("CLOCK");
}
export function readinessStudyId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9-]{2,79}$/.test(value)) fail("STUDY_ID");
}
function exact(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== [...keys].sort().join()) fail("SHAPE");
}
function count(value: unknown): asserts value is number { if (!Number.isSafeInteger(value) || (value as number) < 0) fail("COUNT"); }
function counts(value: object, keys: string[]) { for (const key of keys) count((value as Record<string, unknown>)[key]); }
function sha(value: unknown) { if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) fail("HASH"); }
function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function validate(map: ReadinessEvidenceMap, studyId: string, assessedAt: string) {
  exact(map, [...READINESS_COMPONENTS]);
  let previousCheck: string | null = null;
  for (const id of READINESS_COMPONENTS) {
    const e = map[id]; exact(e, ["state", "checkedAt", "reportSha256", "summary", "errorCode"]); readinessClock(e.checkedAt);
    if (e.checkedAt > assessedAt) fail("FUTURE_CHECK");
    if (previousCheck !== null && e.checkedAt < previousCheck) fail("CHECK_CLOCK_REGRESSION");
    previousCheck = e.checkedAt;
    if (e.state !== "AVAILABLE") {
      if (!["MISSING", "BLOCKED"].includes(e.state) || e.reportSha256 !== null || e.summary !== null ||
        (e.state === "MISSING" ? e.errorCode !== "STORE_MISSING" : !["STORE_BUSY", "STORE_UNSAFE", "RECOVERY_FAILED"].includes(e.errorCode))) fail("EVIDENCE_STATE");
      continue;
    }
    sha(e.reportSha256); if (e.errorCode !== null) fail("EVIDENCE_STATE");
  }
  if (map.collection.state === "AVAILABLE") {
    const s = map.collection.summary;
    const numbers = ["declaredSlots", "elapsedSlots", "completeUsableSlots", "automaticAttempts", "sourceFailures", "savedFrames", "usableObservations", "operationalLessons", "quoteQualityLessons"];
    exact(s, ["studyId", "stage", "windowStartAt", "windowEndAt", "blockerCodes", ...numbers]); counts(s, numbers);
    if (s.studyId !== studyId) fail("STUDY_SCOPE"); readinessClock(s.windowStartAt); readinessClock(s.windowEndAt);
    if (s.windowStartAt >= s.windowEndAt || s.declaredSlots < 1 || s.declaredSlots > 120 || s.elapsedSlots > s.declaredSlots || s.completeUsableSlots > s.elapsedSlots ||
      s.sourceFailures > s.automaticAttempts || s.automaticAttempts > 120 || s.savedFrames > 120 || s.usableObservations > s.savedFrames * 4 || s.completeUsableSlots > s.savedFrames || s.completeUsableSlots > s.usableObservations) fail("COLLECTION_COUNTS");
    const stage = map.collection.checkedAt < s.windowStartAt ? "WAITING_FOR_WINDOW" : map.collection.checkedAt < s.windowEndAt ? "WINDOW_IN_PROGRESS" : "WINDOW_ENDED";
    if (s.stage !== stage || stage === "WAITING_FOR_WINDOW" && s.elapsedSlots !== 0 || stage === "WINDOW_ENDED" && s.elapsedSlots !== s.declaredSlots) fail("COLLECTION_STAGE");
    if (!Array.isArray(s.blockerCodes) || s.blockerCodes.length > 200 || s.blockerCodes.some(c => !/^[A-Z][A-Z0-9_]{1,119}$/.test(c)) || new Set(s.blockerCodes).size !== s.blockerCodes.length) fail("BLOCKER_CODES");
  }
  if (map.paper.state === "AVAILABLE") {
    const s = map.paper.summary, numbers = ["tradeCount", "closedTradeCount", "reviewCount", "missingReviewCount", "openPositionCount", "pendingOrderCount", "candidateLessonCount"];
    exact(s, ["origin", "notebookFingerprint", ...numbers]); counts(s, numbers);
    if (!["SYNTHETIC_FIXTURE", "UNVERIFIED_IMPORT", null].includes(s.origin) || typeof s.notebookFingerprint !== "string" || !/^sha256:[0-9a-f]{64}$/.test(s.notebookFingerprint)) fail("PAPER_ORIGIN_OR_HASH");
    if (s.closedTradeCount > s.tradeCount || s.missingReviewCount > s.closedTradeCount || s.openPositionCount > 1 || s.pendingOrderCount > 1 || s.reviewCount > s.tradeCount || (s.tradeCount === 0) !== (s.origin === null)) fail("PAPER_COUNTS");
  }
  if (map.historical.state === "AVAILABLE") {
    const s = map.historical.summary, numbers = ["runCount", "closedTradeCount", "reviewedRunCount", "candidateLessonCount", "syntheticRuns", "importedRuns", "missingDataRuns"];
    exact(s, numbers); counts(s, numbers);
    if (s.syntheticRuns + s.importedRuns + s.missingDataRuns !== s.runCount || s.closedTradeCount > s.runCount || s.reviewedRunCount > s.runCount) fail("HISTORICAL_COUNTS");
  }
  if (map.imports.state === "AVAILABLE") {
    const s = map.imports.summary, numbers = ["datasetCount", "rowCount", "syntheticDatasets", "ownerProvidedDatasets"];
    exact(s, ["decision", ...numbers]); counts(s, numbers);
    if (s.decision !== "NO_REPLAY" || s.syntheticDatasets + s.ownerProvidedDatasets !== s.datasetCount) fail("IMPORT_BOUNDARY");
  }
  if (map.headlines.state === "AVAILABLE") {
    const s = map.headlines.summary; exact(s, ["observationsInHistory", "sources"]); count(s.observationsInHistory);
    if (!Array.isArray(s.sources) || s.sources.map(v => v.id).sort().join() !== "bea,bls,ecb,fed,ofac,sec") fail("HEADLINE_SCOPE");
    for (const source of s.sources) {
      exact(source, ["id", "status", "observedAt", "refreshOverdue"]);
      if (!["NOT_REFRESHED", "OK", "EMPTY", "FAILED"].includes(source.status) || typeof source.refreshOverdue !== "boolean") fail("HEADLINE_HEALTH");
      if (source.observedAt !== null) { readinessClock(source.observedAt); if (source.observedAt > map.headlines.checkedAt) fail("FUTURE_SOURCE"); }
      if ((source.status === "NOT_REFRESHED") !== (source.observedAt === null)) fail("HEADLINE_HEALTH");
    }
  }
  if (map.treasury.state === "AVAILABLE") {
    const s = map.treasury.summary; exact(s, ["retrievalCount", "status", "receivedAt", "sourceDate", "ratesBps", "dateLagDays", "missingTenors", "versionCount"]);
    count(s.retrievalCount); count(s.versionCount);
    if (!["NOT_REFRESHED", "OK", "EMPTY", "FAILED"].includes(s.status) || (s.status === "NOT_REFRESHED") !== (s.retrievalCount === 0)) fail("TREASURY_HEALTH");
    if (s.receivedAt !== null) { readinessClock(s.receivedAt); if (s.receivedAt > map.treasury.checkedAt) fail("FUTURE_SOURCE"); }
    if ((s.receivedAt === null) !== (s.retrievalCount === 0)) fail("TREASURY_HEALTH");
    if (s.sourceDate !== null) { readinessClock(s.sourceDate + "T00:00:00.000Z"); if (!/^\d{4}-\d{2}-\d{2}$/.test(s.sourceDate)) fail("TREASURY_DATE"); count(s.dateLagDays); }
    if ((s.status === "OK") !== (s.sourceDate !== null) || s.sourceDate === null && s.dateLagDays !== null) fail("TREASURY_CURRENT_VALUE");
    if (!Array.isArray(s.missingTenors) || s.missingTenors.some(t => ![5, 7, 10, 20, 30].includes(t)) || new Set(s.missingTenors).size !== s.missingTenors.length) fail("TREASURY_TENORS");
    if (s.sourceDate !== null) {
      if (!s.receivedAt || s.sourceDate > exchangeLocalDate(s.receivedAt, "America/New_York") || s.dateLagDays !== Math.floor((Date.parse(exchangeLocalDate(map.treasury.checkedAt, "America/New_York")) - Date.parse(s.sourceDate)) / 86400000)) fail("TREASURY_DATE_LAG");
      exact(s.ratesBps, ["5", "7", "10", "20", "30"]);
      if (Object.values(s.ratesBps!).some(v => v !== null && !Number.isSafeInteger(v))) fail("TREASURY_RATES");
      const missing = Object.entries(s.ratesBps!).filter(([, v]) => v === null).map(([t]) => Number(t));
      if (missing.sort((a, b) => a - b).join() !== [...s.missingTenors].sort((a, b) => a - b).join()) fail("TREASURY_TENORS");
    } else if (s.ratesBps !== null || [...s.missingTenors].sort((a, b) => a - b).join() !== "5,7,10,20,30") fail("TREASURY_CURRENT_VALUE");
  }
}

/** Recovered diagnostic evidence only. Never promotes data coverage or simulation results into trade authority. */
export function buildOptionsReadiness(studyId: string, evidence: ReadinessEvidenceMap, assessedAt: string) {
  readinessStudyId(studyId); readinessClock(assessedAt); validate(evidence, studyId, assessedAt);
  const map = structuredClone(evidence), collection = map.collection.state === "AVAILABLE" ? map.collection.summary : null;
  const paper = map.paper.state === "AVAILABLE" ? map.paper.summary : null, historical = map.historical.state === "AVAILABLE" ? map.historical.summary : null;
  const blockedStores = READINESS_COMPONENTS.filter(k => map[k].state === "BLOCKED"), missingStores = READINESS_COMPONENTS.filter(k => map[k].state === "MISSING");
  const reviewComplete = paper !== null && paper.closedTradeCount === paper.reviewCount && paper.missingReviewCount === 0;
  const researchReviewComplete = historical !== null && historical.reviewedRunCount === historical.runCount;
  const collectionState = !collection ? "EVIDENCE_UNAVAILABLE" : collection.stage !== "WINDOW_ENDED" ? collection.stage :
    collection.usableObservations === 0 ? "NO_USABLE_OBSERVATIONS" : collection.completeUsableSlots < collection.declaredSlots ? "PARTIAL_DIAGNOSTIC_COVERAGE" : "DIAGNOSTIC_COVERAGE_COMPLETE";
  const dependencies = [
    { code: "RECOVER_LOCAL_STORES", state: blockedStores.length ? "NEEDS_ATTENTION" : "CHECKED", detail: "Recoverable local integrity is distinct from successful source data. Missing optional histories are listed separately." },
    { code: "RETAIN_EVERY_CLOSED_TRADE_REVIEW", state: !paper ? "EVIDENCE_UNAVAILABLE" : reviewComplete ? "CHECKED" : "NEEDS_ATTENTION", detail: "Counts refer only to the local simulated account; no brokerage trades are inspected." },
    { code: "RETAIN_EVERY_HISTORICAL_RUN_REVIEW", state: !historical ? "EVIDENCE_UNAVAILABLE" : researchReviewComplete ? "CHECKED" : "NEEDS_ATTENTION", detail: "Independent counterfactual runs include missing-data and unresolved outcomes; their accounts are never combined." },
    { code: "COLLECT_FROZEN_OPTION_WINDOW", state: collectionState, detail: "Pending windows are not failed source calls; recorded coverage is a diagnostic." },
    { code: "QUALIFY_ROBINHOOD_SOURCE_SEMANTICS", state: "UNVERIFIED", detail: "Independent quote-side and size clocks, source/calendar declarations and usage semantics remain unresolved." },
    { code: "FREEZE_COSTS_AND_PAPER_FILL_ASSUMPTIONS", state: "UNVERIFIED", detail: "Verify fees, price grids, whole-contract affordability and adverse fills without altering accepted plans." },
    { code: "IMPLEMENT_QUALIFIED_ROBINHOOD_PAPER_ADAPTER", state: "NOT_IMPLEMENTED", detail: "The existing generic local lifecycle and historical research do not qualify a Robinhood replay adapter." },
    { code: "VALIDATE_REAL_PRICE_OUTCOMES_AND_CALIBRATION", state: "NOT_ESTABLISHED", detail: "Synthetic or imported assumed fills cannot establish a target-before-stop probability or authorize size escalation." },
  ];
  const nextStep = blockedStores.length ? "REVIEW_BLOCKED_LOCAL_STORAGE" : paper && !reviewComplete ? "REPAIR_MISSING_SIMULATED_TRADE_REVIEWS" :
    historical && !researchReviewComplete ? "REPAIR_MISSING_RESEARCH_REVIEWS" :
    !collection ? "LOCATE_SELECTED_STUDY_EVIDENCE" : collection.stage === "WAITING_FOR_WINDOW" ? "WAIT_FOR_FROZEN_OPENING_WINDOW" :
    collection.stage === "WINDOW_IN_PROGRESS" ? "CONTINUE_AUTHORIZED_WINDOW_COLLECTION" : collection.usableObservations === 0 ? "REVIEW_EMPTY_OR_UNUSABLE_COLLECTION" : "REVIEW_SOURCE_SEMANTICS_AND_EXECUTION_ASSUMPTIONS";
  const body = { version: READINESS_VERSION, assessedAt, studyId, tradeUniverse: ["GLD", "IBIT"], evidence: map, blockedStores, missingStores,
    collectionState, dependencies, nextStep, closedPaperReviewCoverage: paper ? { closed: paper.closedTradeCount, reviewed: paper.reviewCount, missing: paper.missingReviewCount, consistent: reviewComplete } : null,
    candidateNotebooks: { paper: paper?.candidateLessonCount ?? null, historical: historical?.candidateLessonCount ?? null,
      collectionOperations: collection?.operationalLessons ?? null, quoteQuality: collection?.quoteQualityLessons ?? null,
      approvedKnowledge: false, causalSuccessOrFailureEstablished: false, automaticStrategyChanges: false },
    accountAggregation: "LOCAL_SIMULATION_AND_INDEPENDENT_RESEARCH_ARE_SEPARATE", paperClockBasis: "SCENARIO_CLOCKS_NOT_BROKER_OR_ACTUAL_RECORDING_TIMES",
    status: "NO_REPLAY", realPriceTestReady: false, realPriceTradeCount: 0, liveAccountInspected: false, executionAllowed: false,
    automaticOrdersEnabled: false, riskLimitsChanged: false, winProbability: null, sizeEscalationAllowed: false, networkAccess: false,
    hostSchedule: "NOT_INSPECTED", snapshotAtomicAcrossStores: false,
    limitations: ["Sequential local recovery is not an atomic live system snapshot.", "A missing or blocked component stays unknown and does not hide the other components.",
      "Headline health, Treasury daily observations, quote diagnostics and assumed paper fills have different evidence meanings.",
      "Optional numerical coverage gaps do not create a requirement to connect every imaginable factor before testing.",
      "No combined readiness percentage, calibrated success probability or real brokerage balance is inferred."] };
  return freeze({ ...body, reportSha256: readinessFingerprint(body) });
}
