import { buildOptionsReadiness, readinessClock, readinessFingerprint } from "./OptionsReadinessEngine";
import { BTC_CONTEXT_ERRORS, btcSourceNanoseconds, reportBtcContext, type BtcContextInput } from "../options-btc-context/BtcSpotContextEngine";

type CoreReport = ReturnType<typeof buildOptionsReadiness>;
function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function fail(code: string): never { throw Error("OPTIONS_CONTEXT_READINESS_" + code); }
function exact(value: unknown, keys: string[]) { if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== [...keys].sort().join()) fail("SHAPE"); }
function count(value: unknown) { if (!Number.isSafeInteger(value) || (value as number) < 0) fail("COUNT"); }
function sha(value: unknown) { if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) fail("HASH"); }
const allowedIssues = ["SOURCE_TIME_UNKNOWN", "SOURCE_TIME_AFTER_RECEIPT", "SOURCE_STALE_AT_RECEIPT", "AUCTION_STATE_UNKNOWN", "AUCTION_INDICATIVE", "AUCTION_DETAILS_PRESENT", "BID_MISSING", "ASK_MISSING", "BID_ZERO_LIQUIDITY", "ASK_ZERO_LIQUIDITY", "LOCKED_OR_CROSSED_BOOK"];
const comparisonIssues = ["TWO_OBSERVATIONS_REQUIRED", "CONSECUTIVE_USABLE_OBSERVATIONS_REQUIRED", "SOURCE_TIME_NOT_INCREASING", "SEQUENCE_NOT_INCREASING"];
function codes(value: unknown, allowed: readonly string[]) { if (!Array.isArray(value) || value.some(c => typeof c !== "string" || !allowed.includes(c)) || new Set(value).size !== value.length) fail("ISSUES"); }

/** Only the existing source engine computes BTC report facts. No raw source text enters readiness. */
export function createBtcReadinessEvidence(inputs: readonly BtcContextInput[], checkedAt: string) {
  const report = reportBtcContext(inputs, checkedAt), latest = report.latestRetrieval;
  return freeze({ state: "AVAILABLE", checkedAt, reportSha256: readinessFingerprint(report), errorCode: null,
    summary: { source: "COINBASE_EXCHANGE", product: "BTC-USD", contextFor: ["IBIT"],
      retrievalCount: report.retrievalCount, usableAtReceiptCount: report.usableAtReceiptCount,
      status: latest?.status ?? "NOT_REFRESHED", receivedAt: latest?.receivedAt ?? null,
      sourceTime: latest?.book?.sourceTime ?? null, sequence: latest?.book?.sequence ?? null,
      sourceSha256: latest?.sourceSha256 ?? null, errorCode: latest?.errorCode ?? null,
      midpointUsd: latest?.midpointUsd ?? null, issues: [...(latest?.issues ?? [])],
      sourceAgeAtReceiptNs: latest?.sourceAgeAtReceiptNs ?? null, ageAtCheckNs: report.ageNowNs,
      displayFreshAtCheck: report.displayFresh, comparisonAvailable: report.comparison.midpointChangeUsd !== null,
      comparisonIssues: [...report.comparison.issues], continuousCoverage: false, ibitPriceConversionAvailable: false } } as const);
}
export type BtcReadinessEvidence = ReturnType<typeof createBtcReadinessEvidence> |
  { state: "MISSING" | "BLOCKED"; checkedAt: string; reportSha256: null; summary: null; errorCode: "STORE_MISSING" | "STORE_BUSY" | "STORE_UNSAFE" | "RECOVERY_FAILED" };

function validateBtc(e: BtcReadinessEvidence) {
  exact(e, ["state", "checkedAt", "reportSha256", "summary", "errorCode"]); readinessClock(e.checkedAt);
  if (e.state !== "AVAILABLE") {
    if (!["MISSING", "BLOCKED"].includes(e.state) || e.reportSha256 !== null || e.summary !== null ||
      (e.state === "MISSING" ? e.errorCode !== "STORE_MISSING" : !["STORE_BUSY", "STORE_UNSAFE", "RECOVERY_FAILED"].includes(e.errorCode))) fail("STORAGE_STATE");
    return;
  }
  sha(e.reportSha256); if (e.errorCode !== null) fail("STORAGE_STATE");
  const s = e.summary;
  exact(s, ["source", "product", "contextFor", "retrievalCount", "usableAtReceiptCount", "status", "receivedAt", "sourceTime", "sequence", "sourceSha256", "errorCode", "midpointUsd", "issues", "sourceAgeAtReceiptNs", "ageAtCheckNs", "displayFreshAtCheck", "comparisonAvailable", "comparisonIssues", "continuousCoverage", "ibitPriceConversionAvailable"]);
  if (s.source !== "COINBASE_EXCHANGE" || s.product !== "BTC-USD" || !Array.isArray(s.contextFor) || s.contextFor.join() !== "IBIT" || s.continuousCoverage !== false || s.ibitPriceConversionAvailable !== false) fail("SCOPE");
  count(s.retrievalCount); count(s.usableAtReceiptCount);
  if (s.retrievalCount > 1000 || s.usableAtReceiptCount > s.retrievalCount || !["NOT_REFRESHED", "FAILED", "UNUSABLE_CONTEXT", "OBSERVED_CONTEXT"].includes(s.status)) fail("SOURCE_STATE");
  if ((s.status === "NOT_REFRESHED") !== (s.retrievalCount === 0) || (s.receivedAt === null) !== (s.retrievalCount === 0)) fail("SOURCE_STATE");
  if (s.receivedAt !== null) { readinessClock(s.receivedAt); if (s.receivedAt > e.checkedAt) fail("SOURCE_CLOCK"); }
  if (s.errorCode !== null && !BTC_CONTEXT_ERRORS.includes(s.errorCode) || (s.status === "FAILED") !== (s.errorCode !== null)) fail("SOURCE_ERROR");
  const hasBook = s.status === "OBSERVED_CONTEXT" || s.status === "UNUSABLE_CONTEXT";
  if (hasBook) { count(s.sequence); sha(s.sourceSha256); }
  else if ([s.sequence, s.sourceSha256, s.sourceTime, s.midpointUsd, s.sourceAgeAtReceiptNs, s.ageAtCheckNs].some(value => value !== null)) fail("STALE_PROMOTION");
  codes(s.issues, allowedIssues); codes(s.comparisonIssues, comparisonIssues);
  if ((s.status === "UNUSABLE_CONTEXT") !== (s.issues.length > 0)) fail("SOURCE_ISSUES");
  if (s.status === "OBSERVED_CONTEXT" && (s.usableAtReceiptCount < 1 || s.sourceTime === null || s.midpointUsd === null)) fail("SOURCE_STATE");
  if (s.retrievalCount > 0 && s.status !== "OBSERVED_CONTEXT" && s.usableAtReceiptCount >= s.retrievalCount) fail("SOURCE_STATE");
  if (s.midpointUsd !== null && (typeof s.midpointUsd !== "string" || !/^(?:0|[1-9]\d{0,11})(?:\.\d{1,9})?$/.test(s.midpointUsd))) fail("PRICE");
  if (s.status === "OBSERVED_CONTEXT" && /^0(?:\.0+)?$/.test(s.midpointUsd!)) fail("PRICE");
  if (s.sourceTime === null) {
    if (s.sourceAgeAtReceiptNs !== null || s.ageAtCheckNs !== null || hasBook && !s.issues.includes("SOURCE_TIME_UNKNOWN")) fail("SOURCE_CLOCK");
  } else {
    const source = btcSourceNanoseconds(s.sourceTime), receiptAge = btcSourceNanoseconds(s.receivedAt!) - source, checkAge = btcSourceNanoseconds(e.checkedAt) - source;
    if (s.sourceAgeAtReceiptNs !== receiptAge.toString() || s.ageAtCheckNs !== checkAge.toString()) fail("SOURCE_CLOCK");
    if (s.issues.includes("SOURCE_TIME_UNKNOWN") || s.issues.includes("SOURCE_TIME_AFTER_RECEIPT") !== (receiptAge < 0n) || s.issues.includes("SOURCE_STALE_AT_RECEIPT") !== (receiptAge > 10000000000n)) fail("SOURCE_ISSUES");
  }
  const fresh = s.status === "OBSERVED_CONTEXT" && s.ageAtCheckNs !== null && BigInt(s.ageAtCheckNs) >= 0n && BigInt(s.ageAtCheckNs) <= 60000000000n;
  if (s.displayFreshAtCheck !== fresh || typeof s.comparisonAvailable !== "boolean" || s.comparisonAvailable !== (s.comparisonIssues.length === 0) || s.comparisonAvailable && (s.retrievalCount < 2 || s.usableAtReceiptCount < 2 || s.status !== "OBSERVED_CONTEXT")) fail("CURRENT_OR_COMPARISON");
  if (s.retrievalCount < 2 && s.comparisonIssues.join() !== "TWO_OBSERVATIONS_REQUIRED") fail("CURRENT_OR_COMPARISON");
  if (s.retrievalCount >= 2 && s.status !== "OBSERVED_CONTEXT" && s.comparisonIssues.join() !== "CONSECUTIVE_USABLE_OBSERVATIONS_REQUIRED") fail("CURRENT_OR_COMPARISON");
}

/** Versioned composition leaves the original six-component report and all its trade gates unchanged. */
export function buildOptionsContextReadiness(core: CoreReport, btc: BtcReadinessEvidence, assessedAt: string) {
  readinessClock(assessedAt);
  const recoveredCore = buildOptionsReadiness(core.studyId, core.evidence, core.assessedAt);
  if (readinessFingerprint(core) !== readinessFingerprint(recoveredCore)) fail("CORE_REPORT_CHANGED");
  validateBtc(btc);
  if (btc.checkedAt < core.assessedAt || assessedAt < btc.checkedAt) fail("CHECK_CLOCK_ORDER");
  const { reportSha256, ...coreBody } = core;
  const body = { ...coreBody, version: "OPTIONS_OPERATIONAL_READINESS_V2", assessedAt,
    coreAssessedAt: core.assessedAt, coreReportSha256: reportSha256,
    evidence: { ...core.evidence, btc: structuredClone(btc) },
    blockedStores: [...core.blockedStores, ...(btc.state === "BLOCKED" ? ["btc"] : [])],
    missingStores: [...core.missingStores, ...(btc.state === "MISSING" ? ["btc"] : [])],
    contextNextStep: btc.state !== "AVAILABLE" ? (btc.state === "BLOCKED" ? "REVIEW_BTC_CONTEXT_STORAGE" : "AWAIT_DAILY_BTC_CONTEXT") :
      btc.summary.status === "FAILED" ? "REVIEW_BTC_SOURCE_FAILURE" : "CONTINUE_DAILY_CONTEXT_OBSERVATIONS",
    dependenciesScope: "UNCHANGED_CORE_SIX_COMPONENTS_WITH_SEPARATE_OPTIONAL_BTC_CONTEXT",
    contextClockBasis: "SOURCE_AND_RECEIPT_CLOCKS_WITH_FRESHNESS_AT_COMPONENT_CHECK", btcContextRequiredForReplay: false } as const;
  return freeze({ ...body, reportSha256: readinessFingerprint(body) });
}
