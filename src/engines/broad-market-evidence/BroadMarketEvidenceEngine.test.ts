import {
  AIAuditActorType,
  AIAuditRecordType,
  AIAuditRetentionClassification,
  AIAuditSourceSubsystem,
  BROAD_MARKET_EVIDENCE_SCHEMA_VERSION,
  BarInterval,
  BroadMarketBenchmarkAvailability,
  BroadMarketBenchmarkClassification,
  BroadMarketBenchmarkRequirement,
  BroadMarketBenchmarkStatus,
  BroadMarketEvidenceIssueCode,
  BroadMarketEvidenceQuality,
  BroadMarketEvidenceStrength,
  BroadMarketObservationQuality,
  BroadMarketTrendDirection,
  InstrumentAssetClass,
  PrivacyLevel,
  type BroadMarketBenchmarkReference,
  type BroadMarketBenchmarkSeries,
  type BroadMarketEvidenceAssessmentRequest,
  type BroadMarketEvidencePolicy,
  type BroadMarketEvidenceSnapshotInput,
} from "../../contracts";
import { validateAIAuditRecordInput } from "../../contracts/AIAuditRepositoryValidation";
import { auditRecordFromBroadMarketEvidenceAssessment } from "./BroadMarketEvidenceAuditTranslations";
import {
  BroadMarketEvidenceEngine,
  BroadMarketEvidenceValidationError,
  createBroadMarketEvidenceSnapshot,
  validateBroadMarketEvidencePolicy,
} from "./BroadMarketEvidenceEngine";

function assertEqual<T>(actual: T, expected: T, label: string): void { if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`); }
function assertTrue(value: boolean, label: string): void { if (!value) throw new Error(`${label}: expected true.`); }
function assertDeepEqual(actual: unknown, expected: unknown, label: string): void { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: values differ.`); }
function expectError(run: () => unknown, code: BroadMarketEvidenceIssueCode): void {
  try { run(); } catch (error: unknown) { if (error instanceof BroadMarketEvidenceValidationError && error.issues.some((entry) => entry.code === code)) return; throw error; }
  throw new Error(`Expected ${code}.`);
}

const spy: BroadMarketBenchmarkReference = {
  instrumentId: "instrument:fixture_spy_broad_market",
  assetClass: InstrumentAssetClass.Etf,
  classification: BroadMarketBenchmarkClassification.BroadMarket,
  metadataVersion: "1.0",
  reviewReference: "benchmark-review:spy-fixture",
};
const qqq: BroadMarketBenchmarkReference = {
  instrumentId: "instrument:fixture_qqq_growth_market",
  assetClass: InstrumentAssetClass.Etf,
  classification: BroadMarketBenchmarkClassification.GrowthMarket,
  metadataVersion: "1.0",
  reviewReference: "benchmark-review:qqq-fixture",
};
const soxx: BroadMarketBenchmarkReference = {
  instrumentId: "instrument:fixture_soxx_sector_market",
  assetClass: InstrumentAssetClass.Etf,
  classification: BroadMarketBenchmarkClassification.SectorMarket,
  metadataVersion: "1.0",
  reviewReference: "benchmark-review:soxx-fixture",
};

const policy: BroadMarketEvidencePolicy = {
  policyId: "broad-market-evidence-policy:foundation",
  version: "1.0",
  ruleSetVersion: "1.0",
  featureCalculationVersion: "1.0",
  expectedInterval: BarInterval.FiveMinutes,
  benchmarkRequirements: [
    { benchmark: spy, requirement: BroadMarketBenchmarkRequirement.Required },
    { benchmark: qqq, requirement: BroadMarketBenchmarkRequirement.Required },
    { benchmark: soxx, requirement: BroadMarketBenchmarkRequirement.Optional },
  ],
  shortWindow: 3,
  mediumWindow: 5,
  minimumObservationsPerBenchmark: 5,
  freshnessThresholdSeconds: 3_600,
  positiveTrendThresholdBasisPoints: 100,
  negativeTrendThresholdBasisPoints: 100,
  drawdownThresholdBasisPoints: 300,
  reboundThresholdBasisPoints: 300,
  highVolatilityThresholdBasisPoints: 300,
  minimumRequiredBenchmarks: 2,
  contradictionMinimumOpposingCount: 1,
  moderateAgreementCount: 2,
  strongAgreementCount: 3,
};

function series(reference: BroadMarketBenchmarkReference, values: readonly string[], overrides: Partial<BroadMarketBenchmarkSeries> = {}): BroadMarketBenchmarkSeries {
  const prefix = reference.instrumentId.includes("spy") ? 1 : reference.instrumentId.includes("qqq") ? 2 : 3;
  return {
    benchmark: reference,
    availability: BroadMarketBenchmarkAvailability.Available,
    observations: values.map((atomicValue, index) => ({
      observationId: `broad-market-observation:${String(prefix)}:${String(index + 1)}`,
      canonicalBarId: `bar:${(prefix * 100 + index).toString(16).padStart(16, "0")}`,
      canonicalBarFingerprint: `fnv1a64:${(prefix * 1_000 + index).toString(16).padStart(16, "0")}`,
      instrumentId: reference.instrumentId,
      observedAt: `2026-07-21T${String(10 + index).padStart(2, "0")}:00:00.000Z`,
      close: { atomicValue, scale: 2 },
      qualityStatus: BroadMarketObservationQuality.Accepted,
      evidenceReferences: [`evidence:bar:${String(prefix)}:${String(index + 1)}`],
    })),
    ...overrides,
  };
}

function missing(reference: BroadMarketBenchmarkReference): BroadMarketBenchmarkSeries {
  return { benchmark: reference, availability: BroadMarketBenchmarkAvailability.Missing, observations: [] };
}

function snapshotInput(
  benchmarkSeries: readonly BroadMarketBenchmarkSeries[] = [series(spy, ["10000", "10200", "10400", "10600", "10800"]), series(qqq, ["20000", "20200", "20400", "20600", "20800"]), missing(soxx)],
  overrides: Partial<BroadMarketEvidenceSnapshotInput> = {},
): BroadMarketEvidenceSnapshotInput {
  return {
    schemaVersion: BROAD_MARKET_EVIDENCE_SCHEMA_VERSION,
    snapshotId: "broad-market-snapshot:foundation",
    asOf: "2026-07-21T14:05:00.000Z",
    evidenceWindow: { start: "2026-07-21T09:55:00.000Z", end: "2026-07-21T14:00:00.000Z" },
    interval: BarInterval.FiveMinutes,
    benchmarkSeries,
    trace: { correlationId: "correlation:broad-market", traceId: "trace:broad-market", auditReferenceIds: ["audit:canonical-bars"] },
    createdAt: "2026-07-21T14:04:00.000Z",
    ...overrides,
  };
}

function request(
  benchmarkSeries?: readonly BroadMarketBenchmarkSeries[],
  overrides: Partial<BroadMarketEvidenceAssessmentRequest> = {},
): BroadMarketEvidenceAssessmentRequest {
  return {
    schemaVersion: BROAD_MARKET_EVIDENCE_SCHEMA_VERSION,
    assessmentId: "broad-market-assessment:foundation",
    assessedAt: "2026-07-21T14:05:00.000Z",
    createdAt: "2026-07-21T14:05:00.000Z",
    snapshot: createBroadMarketEvidenceSnapshot(snapshotInput(benchmarkSeries)),
    policy,
    ...overrides,
  };
}

function assess(benchmarkSeries?: readonly BroadMarketBenchmarkSeries[], overrides: Partial<BroadMarketEvidenceAssessmentRequest> = {}) {
  return new BroadMarketEvidenceEngine().assess(request(benchmarkSeries, overrides));
}

type Test = readonly [string, () => void];
const tests: Test[] = [];
function test(name: string, run: Test[1]): void { tests.push([name, run]); }

test("immutable snapshot construction deeply freezes membership", () => {
  const snapshot = createBroadMarketEvidenceSnapshot(snapshotInput());
  assertTrue(Object.isFrozen(snapshot), "snapshot frozen");
  assertTrue(Object.isFrozen(snapshot.benchmarkSeries[0]!.observations[0]!.close), "nested close frozen");
});

test("snapshot serialization is deterministic", () => {
  const first = createBroadMarketEvidenceSnapshot(snapshotInput());
  const second = createBroadMarketEvidenceSnapshot(snapshotInput());
  assertEqual(JSON.stringify(first), JSON.stringify(second), "serialization");
  assertEqual(first.fingerprint, second.fingerprint, "fingerprint");
});

test("benchmark membership is deterministically ordered", () => {
  const input = snapshotInput([missing(soxx), series(qqq, ["20000", "20200", "20400", "20600", "20800"]), series(spy, ["10000", "10200", "10400", "10600", "10800"])]);
  const snapshot = createBroadMarketEvidenceSnapshot(input);
  assertDeepEqual(snapshot.benchmarkSeries.map((entry) => entry.benchmark.instrumentId), [qqq.instrumentId, soxx.instrumentId, spy.instrumentId].sort(), "membership ordering");
});

test("fixed-decimal short return is calculated without floating point", () => {
  assertEqual(assess().benchmarkSummaries.find((entry) => entry.benchmark.instrumentId === spy.instrumentId)!.features!.shortReturnBasisPoints, 384, "short return");
});

test("fixed-decimal medium return is calculated", () => {
  assertEqual(assess().benchmarkSummaries.find((entry) => entry.benchmark.instrumentId === spy.instrumentId)!.features!.mediumReturnBasisPoints, 800, "medium return");
});

test("drawdown from window high is calculated", () => {
  const result = assess([series(spy, ["10000", "11000", "10800", "10500", "10000"]), series(qqq, ["20000", "20200", "20400", "20600", "20800"]), missing(soxx)]);
  assertEqual(result.benchmarkSummaries.find((entry) => entry.benchmark.instrumentId === spy.instrumentId)!.features!.drawdownFromWindowHighBasisPoints, 909, "drawdown");
});

test("rebound from window low is calculated", () => {
  const result = assess([series(spy, ["10000", "9000", "9200", "9500", "9900"]), series(qqq, ["20000", "20200", "20400", "20600", "20800"]), missing(soxx)]);
  assertEqual(result.benchmarkSummaries.find((entry) => entry.benchmark.instrumentId === spy.instrumentId)!.features!.reboundFromWindowLowBasisPoints, 1000, "rebound");
});

test("bounded rolling volatility proxy uses maximum adjacent absolute return", () => {
  const result = assess([series(spy, ["10000", "10500", "10000", "11000", "10800"]), series(qqq, ["20000", "20200", "20400", "20600", "20800"]), missing(soxx)]);
  assertEqual(result.benchmarkSummaries.find((entry) => entry.benchmark.instrumentId === spy.instrumentId)!.features!.maximumAbsoluteReturnBasisPoints, 1000, "volatility proxy");
});

test("window range is calculated", () => {
  const result = assess([series(spy, ["10000", "11000", "10500", "10200", "10800"]), series(qqq, ["20000", "20200", "20400", "20600", "20800"]), missing(soxx)]);
  assertEqual(result.benchmarkSummaries.find((entry) => entry.benchmark.instrumentId === spy.instrumentId)!.features!.windowRangeBasisPoints, 1000, "range");
});

test("recovery percentage is bounded against window range", () => {
  const result = assess([series(spy, ["10000", "11000", "10500", "10200", "10500"]), series(qqq, ["20000", "20200", "20400", "20600", "20800"]), missing(soxx)]);
  assertEqual(result.benchmarkSummaries.find((entry) => entry.benchmark.instrumentId === spy.instrumentId)!.features!.recoveryPercentageBasisPoints, 5000, "recovery percentage");
});

test("flat window has explicit zero recovery percentage", () => {
  const result = assess([series(spy, ["10000", "10000", "10000", "10000", "10000"]), series(qqq, ["20000", "20200", "20400", "20600", "20800"]), missing(soxx)]);
  assertEqual(result.benchmarkSummaries.find((entry) => entry.benchmark.instrumentId === spy.instrumentId)!.features!.recoveryPercentageBasisPoints, 0, "flat recovery");
});

test("valid chronological observations are accepted", () => { assertEqual(assess().quality, BroadMarketEvidenceQuality.Complete, "quality"); });

test("invalid chronology is rejected", () => {
  const invalid = series(spy, ["10000", "10200", "10400", "10600", "10800"]);
  const observations = [...invalid.observations]; [observations[1], observations[2]] = [observations[2]!, observations[1]!];
  expectError(() => createBroadMarketEvidenceSnapshot(snapshotInput([{ ...invalid, observations }, series(qqq, ["20000", "20200", "20400", "20600", "20800"]), missing(soxx)])), BroadMarketEvidenceIssueCode.InvalidChronology);
});

test("duplicate timestamps are rejected", () => {
  const invalid = series(spy, ["10000", "10200", "10400", "10600", "10800"]);
  const observations = invalid.observations.map((entry, index) => index === 2 ? { ...entry, observedAt: invalid.observations[1]!.observedAt } : entry);
  expectError(() => createBroadMarketEvidenceSnapshot(snapshotInput([{ ...invalid, observations }, series(qqq, ["20000", "20200", "20400", "20600", "20800"]), missing(soxx)])), BroadMarketEvidenceIssueCode.DuplicateTimestamp);
});

test("insufficient observations fail closed", () => {
  const result = assess([series(spy, ["10000", "10100"]), series(qqq, ["20000", "20200", "20400", "20600", "20800"]), missing(soxx)]);
  assertEqual(result.quality, BroadMarketEvidenceQuality.Insufficient, "quality");
  assertTrue(result.issues.some((entry) => entry.code === BroadMarketEvidenceIssueCode.InsufficientObservations), "issue");
});

test("missing required benchmark fails closed when minimum is not met", () => {
  const result = assess([missing(spy), series(qqq, ["20000", "20200", "20400", "20600", "20800"]), missing(soxx)]);
  assertEqual(result.quality, BroadMarketEvidenceQuality.Insufficient, "quality");
  assertEqual(result.evidenceStrength, BroadMarketEvidenceStrength.Insufficient, "strength");
});

test("missing required benchmark is PARTIAL when explicit minimum remains satisfied", () => {
  const relaxed = { ...policy, minimumRequiredBenchmarks: 1 };
  const result = assess([missing(spy), series(qqq, ["20000", "20200", "20400", "20600", "20800"]), missing(soxx)], { policy: relaxed });
  assertEqual(result.quality, BroadMarketEvidenceQuality.Partial, "quality");
});

test("optional benchmark absence does not downgrade complete required evidence", () => {
  const result = assess();
  assertEqual(result.quality, BroadMarketEvidenceQuality.Complete, "quality");
  assertTrue(result.warnings.some((entry) => entry.code === BroadMarketEvidenceIssueCode.MissingOptionalBenchmark), "warning");
});

test("optional rejected evidence remains an explicit warning without hiding required completeness", () => {
  const optional = series(soxx, ["30000", "30200", "30400", "30600", "30800"]);
  const observations = optional.observations.map((entry, index) => index === 4 ? { ...entry, qualityStatus: BroadMarketObservationQuality.Rejected } : entry);
  const result = assess([series(spy, ["10000", "10200", "10400", "10600", "10800"]), series(qqq, ["20000", "20200", "20400", "20600", "20800"]), { ...optional, observations }]);
  assertEqual(result.quality, BroadMarketEvidenceQuality.Complete, "quality");
  assertTrue(result.warnings.some((entry) => entry.code === BroadMarketEvidenceIssueCode.DataQualityRejected), "warning");
  assertEqual(result.issues.length, 0, "blockers");
});

test("all required stale evidence is explicitly STALE", () => {
  const result = assess(undefined, { assessedAt: "2026-07-22T14:05:00.000Z", createdAt: "2026-07-22T14:05:00.000Z" });
  assertEqual(result.quality, BroadMarketEvidenceQuality.Stale, "quality");
});

test("one stale required benchmark produces PARTIAL when minimum remains met", () => {
  const staleSpy = series(spy, ["10000", "10200", "10400", "10600", "10800"]);
  const freshQqq = series(qqq, ["20000", "20200", "20400", "20600", "20800"]);
  const shifted = freshQqq.observations.map((entry, index) => ({ ...entry, observedAt: `2026-07-21T${String(14 + index).padStart(2, "0")}:00:00.000Z` }));
  const input = snapshotInput([staleSpy, { ...freshQqq, observations: shifted }, missing(soxx)], { asOf: "2026-07-21T18:05:00.000Z", evidenceWindow: { start: "2026-07-21T09:55:00.000Z", end: "2026-07-21T18:00:00.000Z" }, createdAt: "2026-07-21T18:04:00.000Z" });
  const relaxed = { ...policy, minimumRequiredBenchmarks: 1 };
  const result = new BroadMarketEvidenceEngine().assess(request(undefined, { assessedAt: "2026-07-21T18:05:00.000Z", createdAt: "2026-07-21T18:05:00.000Z", snapshot: createBroadMarketEvidenceSnapshot(input), policy: relaxed }));
  assertEqual(result.quality, BroadMarketEvidenceQuality.Partial, "quality");
});

test("opposing required benchmark trends are CONTRADICTORY", () => {
  const result = assess([series(spy, ["10000", "10200", "10400", "10600", "10800"]), series(qqq, ["20800", "20600", "20400", "20200", "20000"]), missing(soxx)]);
  assertEqual(result.quality, BroadMarketEvidenceQuality.Contradictory, "quality");
  assertTrue(result.issues.some((entry) => entry.code === BroadMarketEvidenceIssueCode.StrongBenchmarkDisagreement), "contradiction issue");
});

test("complete three-benchmark agreement produces strong evidence", () => {
  const result = assess([series(spy, ["10000", "10200", "10400", "10600", "10800"]), series(qqq, ["20000", "20200", "20400", "20600", "20800"]), series(soxx, ["30000", "30200", "30400", "30600", "30800"])]);
  assertEqual(result.quality, BroadMarketEvidenceQuality.Complete, "quality");
  assertEqual(result.evidenceStrength, BroadMarketEvidenceStrength.Strong, "strength");
});

test("aggregate counts remain descriptive and deterministic", () => {
  const result = assess();
  assertEqual(result.aggregateFacts.positiveTrendCount, 2, "positive count");
  assertEqual(result.aggregateFacts.missingBenchmarkCount, 1, "missing count");
  assertEqual(result.aggregateFacts.agreementCount, 2, "agreement");
});

test("rebound drawdown and volatility counts use explicit policy thresholds", () => {
  const result = assess([series(spy, ["10000", "11000", "9000", "9500", "10000"]), series(qqq, ["20000", "20200", "20400", "20600", "20800"]), missing(soxx)]);
  assertTrue(result.aggregateFacts.reboundCount >= 1, "rebound count");
  assertTrue(result.aggregateFacts.drawdownCount >= 1, "drawdown count");
  assertTrue(result.aggregateFacts.highVolatilityCount >= 1, "volatility count");
});

test("individual equity identity is rejected as a broad benchmark", () => {
  const equity = { ...spy, instrumentId: "instrument:fixture_individual_equity", assetClass: InstrumentAssetClass.Equity } as unknown as BroadMarketBenchmarkReference;
  expectError(() => createBroadMarketEvidenceSnapshot(snapshotInput([series(equity, ["10000", "10200", "10400", "10600", "10800"]), series(qqq, ["20000", "20200", "20400", "20600", "20800"]), missing(soxx)])), BroadMarketEvidenceIssueCode.UnsupportedBenchmarkAssetClass);
});

test("unknown canonical identity is rejected", () => {
  const unknown = { ...spy, instrumentId: "AAPL" };
  expectError(() => createBroadMarketEvidenceSnapshot(snapshotInput([series(unknown, ["10000", "10200", "10400", "10600", "10800"]), series(qqq, ["20000", "20200", "20400", "20600", "20800"]), missing(soxx)])), BroadMarketEvidenceIssueCode.InvalidBenchmark);
});

test("policy and snapshot membership must match exactly", () => {
  const snapshot = createBroadMarketEvidenceSnapshot(snapshotInput([series(spy, ["10000", "10200", "10400", "10600", "10800"]), series(qqq, ["20000", "20200", "20400", "20600", "20800"])]));
  expectError(() => new BroadMarketEvidenceEngine().assess({ ...request(), snapshot }), BroadMarketEvidenceIssueCode.PolicyBenchmarkMismatch);
});

test("provider-native fields are excluded at the canonical snapshot boundary", () => {
  const input = snapshotInput() as BroadMarketEvidenceSnapshotInput & { providerPayload: unknown };
  input.providerPayload = { symbol: "SPY", apiKey: "forbidden" };
  const snapshot = createBroadMarketEvidenceSnapshot(input);
  const serialized = JSON.stringify(snapshot);
  assertTrue(!serialized.includes("providerPayload"), "payload excluded");
  assertTrue(!serialized.includes("apiKey"), "secret-shaped field excluded");
});

test("provenance references are preserved and ordered", () => {
  const result = assess();
  assertTrue(result.evidenceReferences.includes("evidence:bar:1:1"), "evidence ref");
  assertDeepEqual(result.trace.auditReferenceIds, ["audit:canonical-bars"], "audit refs");
});

test("policy rule-set and feature versions are preserved", () => {
  const result = assess();
  assertEqual(result.policyVersion, "1.0", "policy version");
  assertEqual(result.ruleSetVersion, "1.0", "rule version");
  assertEqual(result.featureCalculationVersion, "1.0", "feature version");
});

test("issues have deterministic ordering", () => {
  const result = assess([missing(spy), missing(qqq), missing(soxx)]);
  const keys = result.issues.map((entry) => `${entry.code}|${entry.benchmarkInstrumentId ?? ""}`);
  assertDeepEqual(keys, [...keys].sort(), "issue ordering");
});

test("assessment is deeply immutable and source records remain unchanged", () => {
  const source = snapshotInput(); const before = JSON.stringify(source);
  const result = new BroadMarketEvidenceEngine().assess(request(undefined, { snapshot: createBroadMarketEvidenceSnapshot(source) }));
  assertTrue(Object.isFrozen(result.benchmarkSummaries[0]!.features), "features frozen");
  assertEqual(JSON.stringify(source), before, "source unchanged");
});

test("repeated identical evaluation is identical", () => {
  const source = request();
  assertDeepEqual(new BroadMarketEvidenceEngine().assess(source), new BroadMarketEvidenceEngine().assess(source), "assessment");
});

test("rejected canonical observation quality fails closed", () => {
  const rejected = series(spy, ["10000", "10200", "10400", "10600", "10800"]);
  const observations = rejected.observations.map((entry, index) => index === 4 ? { ...entry, qualityStatus: BroadMarketObservationQuality.Rejected } : entry);
  const result = assess([{ ...rejected, observations }, series(qqq, ["20000", "20200", "20400", "20600", "20800"]), missing(soxx)]);
  assertEqual(result.quality, BroadMarketEvidenceQuality.Insufficient, "quality");
  assertEqual(result.benchmarkSummaries.find((entry) => entry.benchmark.instrumentId === spy.instrumentId)!.status, BroadMarketBenchmarkStatus.Rejected, "status");
});

test("trend facts distinguish positive negative and neutral without regime labels", () => {
  const result = assess([series(spy, ["10000", "10200", "10400", "10600", "10800"]), series(qqq, ["20000", "20000", "20000", "20000", "20000"]), missing(soxx)]);
  assertEqual(result.benchmarkSummaries.find((entry) => entry.benchmark.instrumentId === spy.instrumentId)!.trendDirection, BroadMarketTrendDirection.Positive, "positive");
  assertEqual(result.benchmarkSummaries.find((entry) => entry.benchmark.instrumentId === qqq.instrumentId)!.trendDirection, BroadMarketTrendDirection.Neutral, "neutral");
});

test("invalid threshold policy fails closed", () => {
  const invalid = { ...policy, shortWindow: 6 };
  assertTrue(!validateBroadMarketEvidencePolicy(invalid).valid, "invalid policy");
  expectError(() => assess(undefined, { policy: invalid }), BroadMarketEvidenceIssueCode.InvalidPolicy);
});

test("assessment contains no regime signal trade recommendation or probability fields", () => {
  const serialized = JSON.stringify(assess());
  for (const forbidden of ["BULL_TREND", "BEAR_TREND", "RELIEF_RALLY", "CORRECTION", "recommendation", "positionSize", "probability", "BUY", "SELL"]) assertTrue(!serialized.includes(forbidden), `${forbidden} absent`);
});

test("audit translation is deterministic and valid for Unified Audit", () => {
  const assessment = assess();
  const context = {
    recordId: "audit:broad-market-evidence:1",
    idempotencyKey: "idempotency:broad-market-evidence:1",
    parentAuditRecordIds: [], relatedAuditRecordIds: [],
    actor: { type: AIAuditActorType.AlphaSubsystem, actorId: "broad-market-evidence" },
    privacyLevel: PrivacyLevel.Internal,
    retention: AIAuditRetentionClassification.LongTerm,
  } as const;
  const first = auditRecordFromBroadMarketEvidenceAssessment(assessment, context);
  validateAIAuditRecordInput(first);
  assertDeepEqual(first, auditRecordFromBroadMarketEvidenceAssessment(assessment, context), "translation");
  assertEqual(first.recordType, AIAuditRecordType.BroadMarketEvidenceAssessment, "record type");
  assertEqual(first.sourceSubsystem, AIAuditSourceSubsystem.BroadMarketEvidence, "subsystem");
});

test("composition has no provider network AI or mutation methods", () => {
  const names = Object.getOwnPropertyNames(BroadMarketEvidenceEngine.prototype);
  assertDeepEqual(names, ["constructor", "assess"], "public methods");
});

let passed = 0;
for (const [name, run] of tests) {
  try { run(); passed += 1; console.log(`PASS ${name}`); }
  catch (error: unknown) { console.error(`FAIL ${name}`); throw error; }
}
console.log(`Broad Market Evidence tests passed: ${String(passed)}/${String(tests.length)}.`);
