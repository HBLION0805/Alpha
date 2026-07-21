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
  BroadMarketEvidenceIssueCode,
  BroadMarketEvidenceIssueSeverity,
  BroadMarketEvidenceQuality,
  BroadMarketEvidenceStrength,
  BroadMarketObservationQuality,
  EVIDENCE_FUSION_SCHEMA_VERSION,
  EvidenceFusionAssessmentStatus,
  EvidenceFusionCompleteness,
  EvidenceFusionFreshness,
  EvidenceFusionIssueCode,
  EvidenceFusionQuality,
  EvidenceFusionSourceState,
  EvidenceFusionSourceType,
  InstrumentAssetClass,
  PrivacyLevel,
  type BroadMarketBenchmarkReference,
  type BroadMarketBenchmarkSeries,
  type BroadMarketEvidenceAssessment,
  type BroadMarketEvidencePolicy,
  type BroadMarketEvidenceSnapshotInput,
  type EvidenceFusionAssessmentRequest,
  type EvidenceFusionInput,
  type EvidenceFusionPolicy,
} from "../../contracts";
import { validateAIAuditRecordInput } from "../../contracts/AIAuditRepositoryValidation";
import { BroadMarketEvidenceEngine, createBroadMarketEvidenceSnapshot } from "../broad-market-evidence";
import { auditRecordFromEvidenceFusionAssessment } from "./EvidenceFusionAuditTranslations";
import {
  EvidenceFusionEngine,
  EvidenceFusionValidationError,
  createEvidenceFusionInput,
  evidenceFusionInputFromBroadMarketEvidence,
  validateEvidenceFusionPolicy,
} from "./EvidenceFusionEngine";

function assertEqual<T>(actual: T, expected: T, label: string): void { if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`); }
function assertTrue(value: boolean, label: string): void { if (!value) throw new Error(`${label}: expected true.`); }
function assertDeepEqual(actual: unknown, expected: unknown, label: string): void { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: values differ.`); }
function expectError(run: () => unknown, code: EvidenceFusionIssueCode): void {
  try { run(); } catch (error: unknown) { if (error instanceof EvidenceFusionValidationError && error.issues.some((entry) => entry.code === code)) return; throw error; }
  throw new Error(`Expected ${code}.`);
}

const benchmarkOne: BroadMarketBenchmarkReference = {
  instrumentId: "instrument:fusion_fixture_market_one",
  assetClass: InstrumentAssetClass.Etf,
  classification: BroadMarketBenchmarkClassification.BroadMarket,
  metadataVersion: "1.0",
  reviewReference: "benchmark-review:fusion-one",
};
const benchmarkTwo: BroadMarketBenchmarkReference = {
  instrumentId: "instrument:fusion_fixture_market_two",
  assetClass: InstrumentAssetClass.Etf,
  classification: BroadMarketBenchmarkClassification.GrowthMarket,
  metadataVersion: "1.0",
  reviewReference: "benchmark-review:fusion-two",
};
const optionalBenchmark: BroadMarketBenchmarkReference = {
  instrumentId: "instrument:fusion_fixture_optional",
  assetClass: InstrumentAssetClass.Index,
  classification: BroadMarketBenchmarkClassification.SectorMarket,
  metadataVersion: "1.0",
  reviewReference: "benchmark-review:fusion-optional",
};

const broadMarketPolicy: BroadMarketEvidencePolicy = {
  policyId: "broad-market-policy:fusion-fixture",
  version: "1.0",
  ruleSetVersion: "1.0",
  featureCalculationVersion: "1.0",
  expectedInterval: BarInterval.FiveMinutes,
  benchmarkRequirements: [
    { benchmark: benchmarkOne, requirement: BroadMarketBenchmarkRequirement.Required },
    { benchmark: benchmarkTwo, requirement: BroadMarketBenchmarkRequirement.Required },
    { benchmark: optionalBenchmark, requirement: BroadMarketBenchmarkRequirement.Optional },
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

const fusionPolicy: EvidenceFusionPolicy = {
  policyId: "evidence-fusion-policy:foundation",
  version: "1.0",
  ruleSetVersion: "1.0",
  sourcePolicies: [{
    sourceType: EvidenceFusionSourceType.BroadMarketEvidence,
    required: true,
    acceptedSchemaVersion: BROAD_MARKET_EVIDENCE_SCHEMA_VERSION,
    requiredState: EvidenceFusionSourceState.Complete,
    maximumAgeSeconds: 600,
    minimumEvidenceReferences: 1,
  }],
};

function series(reference: BroadMarketBenchmarkReference, values: readonly string[]): BroadMarketBenchmarkSeries {
  const prefix = reference === benchmarkOne ? 1 : 2;
  return {
    benchmark: reference,
    availability: BroadMarketBenchmarkAvailability.Available,
    observations: values.map((atomicValue, index) => ({
      observationId: `fusion-source-observation:${String(prefix)}:${String(index + 1)}`,
      canonicalBarId: `bar:${(prefix * 100 + index).toString(16).padStart(16, "0")}`,
      canonicalBarFingerprint: `fnv1a64:${(prefix * 1_000 + index).toString(16).padStart(16, "0")}`,
      instrumentId: reference.instrumentId,
      observedAt: `2026-07-21T${String(10 + index).padStart(2, "0")}:00:00.000Z`,
      close: { atomicValue, scale: 2 },
      qualityStatus: BroadMarketObservationQuality.Accepted,
      evidenceReferences: [`evidence:fusion-source:${String(prefix)}:${String(index + 1)}`],
    })),
  };
}

function sourceAssessment(mode: "complete" | "contradictory" | "insufficient" = "complete"): BroadMarketEvidenceAssessment {
  const first = mode === "insufficient"
    ? { benchmark: benchmarkOne, availability: BroadMarketBenchmarkAvailability.Missing, observations: [] } as BroadMarketBenchmarkSeries
    : series(benchmarkOne, ["10000", "10200", "10400", "10600", "10800"]);
  const second = series(benchmarkTwo, mode === "contradictory" ? ["20800", "20600", "20400", "20200", "20000"] : ["20000", "20200", "20400", "20600", "20800"]);
  const snapshotInput: BroadMarketEvidenceSnapshotInput = {
    schemaVersion: BROAD_MARKET_EVIDENCE_SCHEMA_VERSION,
    snapshotId: "broad-market-snapshot:fusion-source",
    asOf: "2026-07-21T14:05:00.000Z",
    evidenceWindow: { start: "2026-07-21T09:55:00.000Z", end: "2026-07-21T14:00:00.000Z" },
    interval: BarInterval.FiveMinutes,
    benchmarkSeries: [first, second, { benchmark: optionalBenchmark, availability: BroadMarketBenchmarkAvailability.Missing, observations: [] }],
    trace: { correlationId: "correlation:fusion-source", traceId: "trace:fusion-source", auditReferenceIds: ["audit:broad-market-source"] },
    createdAt: "2026-07-21T14:04:00.000Z",
  };
  return new BroadMarketEvidenceEngine().assess({
    schemaVersion: BROAD_MARKET_EVIDENCE_SCHEMA_VERSION,
    assessmentId: "broad-market-assessment:fusion-source",
    assessedAt: "2026-07-21T14:05:00.000Z",
    createdAt: "2026-07-21T14:05:00.000Z",
    snapshot: createBroadMarketEvidenceSnapshot(snapshotInput),
    policy: broadMarketPolicy,
  });
}

function request(inputs: readonly EvidenceFusionInput[] = [evidenceFusionInputFromBroadMarketEvidence(sourceAssessment())], overrides: Partial<EvidenceFusionAssessmentRequest> = {}): EvidenceFusionAssessmentRequest {
  return {
    schemaVersion: EVIDENCE_FUSION_SCHEMA_VERSION,
    assessmentId: "evidence-fusion-assessment:foundation",
    snapshotId: "evidence-fusion-snapshot:foundation",
    evaluatedAt: "2026-07-21T14:10:00.000Z",
    createdAt: "2026-07-21T14:10:00.000Z",
    inputs,
    policy: fusionPolicy,
    trace: { correlationId: "correlation:evidence-fusion", traceId: "trace:evidence-fusion", auditReferenceIds: ["audit:fusion-request"] },
    ...overrides,
  };
}

function assess(inputs?: readonly EvidenceFusionInput[], overrides: Partial<EvidenceFusionAssessmentRequest> = {}) { return new EvidenceFusionEngine().assess(request(inputs, overrides)); }

type Test = readonly [string, () => void];
const tests: Test[] = [];
function test(name: string, run: Test[1]): void { tests.push([name, run]); }

test("Broad Market assessment maps to an immutable provider-neutral input", () => {
  const input = evidenceFusionInputFromBroadMarketEvidence(sourceAssessment());
  assertTrue(Object.isFrozen(input), "input frozen");
  assertTrue(Object.isFrozen(input.provenance), "provenance frozen");
  assertEqual(input.sourceType, EvidenceFusionSourceType.BroadMarketEvidence, "source type");
});

test("complete current evidence produces a READY fusion snapshot", () => {
  const result = assess();
  assertEqual(result.status, EvidenceFusionAssessmentStatus.Ready, "status");
  assertEqual(result.snapshot.completeness, EvidenceFusionCompleteness.Complete, "completeness");
  assertEqual(result.snapshot.freshness, EvidenceFusionFreshness.Current, "freshness");
  assertEqual(result.snapshot.quality, EvidenceFusionQuality.Accepted, "quality");
});

test("missing required evidence fails closed", () => {
  const result = assess([]);
  assertEqual(result.status, EvidenceFusionAssessmentStatus.Blocked, "status");
  assertEqual(result.snapshot.completeness, EvidenceFusionCompleteness.MissingRequired, "completeness");
  assertEqual(result.snapshot.freshness, EvidenceFusionFreshness.Unknown, "freshness");
  assertTrue(result.snapshot.blockers.some((entry) => entry.code === EvidenceFusionIssueCode.MissingRequiredSource), "blocker");
});

test("insufficient source evidence fails closed", () => {
  const input = evidenceFusionInputFromBroadMarketEvidence(sourceAssessment("insufficient"));
  const result = assess([input]);
  assertEqual(result.snapshot.completeness, EvidenceFusionCompleteness.Incomplete, "completeness");
  assertEqual(result.snapshot.quality, EvidenceFusionQuality.Rejected, "quality");
});

test("explicit partial source evidence fails closed", () => {
  const source = sourceAssessment();
  const partial = { ...source, quality: BroadMarketEvidenceQuality.Partial, evidenceStrength: BroadMarketEvidenceStrength.Weak, issues: [{ code: BroadMarketEvidenceIssueCode.MissingRequiredBenchmark, severity: BroadMarketEvidenceIssueSeverity.Blocker, field: "benchmark", message: "Required benchmark missing." }] };
  const result = assess([evidenceFusionInputFromBroadMarketEvidence(partial)]);
  assertEqual(result.status, EvidenceFusionAssessmentStatus.Blocked, "status");
  assertTrue(result.snapshot.blockers.some((entry) => entry.code === EvidenceFusionIssueCode.SourceIncomplete), "incomplete blocker");
});

test("source-classified stale evidence fails closed", () => {
  const source = { ...sourceAssessment(), quality: BroadMarketEvidenceQuality.Stale, evidenceStrength: BroadMarketEvidenceStrength.Insufficient };
  const result = assess([evidenceFusionInputFromBroadMarketEvidence(source)]);
  assertEqual(result.snapshot.freshness, EvidenceFusionFreshness.Stale, "freshness");
  assertEqual(result.status, EvidenceFusionAssessmentStatus.Blocked, "status");
});

test("age-expired complete evidence fails closed", () => {
  const result = assess(undefined, { evaluatedAt: "2026-07-21T15:00:00.000Z", createdAt: "2026-07-21T15:00:00.000Z" });
  assertEqual(result.snapshot.freshness, EvidenceFusionFreshness.Stale, "freshness");
  assertTrue(result.snapshot.blockers.some((entry) => entry.code === EvidenceFusionIssueCode.SourceStale), "stale blocker");
});

test("future-dated source assessment fails closed", () => {
  const result = assess(undefined, { evaluatedAt: "2026-07-21T14:00:00.000Z", createdAt: "2026-07-21T14:00:00.000Z" });
  assertEqual(result.snapshot.freshness, EvidenceFusionFreshness.Unknown, "freshness");
  assertTrue(result.snapshot.blockers.some((entry) => entry.code === EvidenceFusionIssueCode.SourceFutureDated), "future blocker");
});

test("contradictory Broad Market evidence remains explicit and blocked", () => {
  const result = assess([evidenceFusionInputFromBroadMarketEvidence(sourceAssessment("contradictory"))]);
  assertEqual(result.snapshot.quality, EvidenceFusionQuality.Contradictory, "quality");
  assertEqual(result.status, EvidenceFusionAssessmentStatus.Blocked, "status");
  assertTrue(result.snapshot.contradictions.some((entry) => entry.sourceCode === BroadMarketEvidenceIssueCode.StrongBenchmarkDisagreement), "contradiction");
});

test("warnings are preserved without overriding complete evidence", () => {
  const result = assess();
  assertEqual(result.status, EvidenceFusionAssessmentStatus.Ready, "status");
  assertTrue(result.snapshot.warnings.some((entry) => entry.sourceCode === BroadMarketEvidenceIssueCode.MissingOptionalBenchmark), "warning");
});

test("missing evidence references fail policy", () => {
  const input = evidenceFusionInputFromBroadMarketEvidence(sourceAssessment());
  const result = assess([{ ...input, evidenceReferences: [] }]);
  assertEqual(result.snapshot.completeness, EvidenceFusionCompleteness.Incomplete, "completeness");
  assertTrue(result.snapshot.blockers.some((entry) => entry.code === EvidenceFusionIssueCode.EvidenceReferencesInsufficient), "reference blocker");
});

test("evidence references are unique and deterministically ordered", () => {
  const result = assess(); const refs = result.snapshot.evidenceReferences;
  assertDeepEqual(refs, [...refs].sort(), "ordering");
  assertEqual(new Set(refs).size, refs.length, "uniqueness");
});

test("provenance preserves source assessment snapshot and policy identity", () => {
  const source = sourceAssessment(); const provenance = assess().snapshot.provenance[0]!;
  assertEqual(provenance.sourceAssessmentId, source.assessmentId, "assessment ID");
  assertEqual(provenance.sourceSnapshotFingerprint, source.inputSnapshotFingerprint, "fingerprint");
  assertEqual(provenance.sourcePolicyVersion, source.policyVersion, "policy version");
});

test("fusion policy and rule-set versions are preserved", () => {
  const snapshot = assess().snapshot;
  assertEqual(snapshot.policyVersion, fusionPolicy.version, "policy version");
  assertEqual(snapshot.ruleSetVersion, fusionPolicy.ruleSetVersion, "rule version");
});

test("snapshot and assessment are deeply immutable", () => {
  const result = assess();
  assertTrue(Object.isFrozen(result), "assessment frozen");
  assertTrue(Object.isFrozen(result.snapshot), "snapshot frozen");
  assertTrue(Object.isFrozen(result.snapshot.provenance[0]), "provenance frozen");
});

test("source assessment remains unchanged", () => {
  const source = sourceAssessment(); const before = JSON.stringify(source);
  assess([evidenceFusionInputFromBroadMarketEvidence(source)]);
  assertEqual(JSON.stringify(source), before, "source unchanged");
});

test("repeated identical evaluation is deterministic", () => {
  const value = request();
  assertDeepEqual(new EvidenceFusionEngine().assess(value), new EvidenceFusionEngine().assess(value), "assessment");
});

test("snapshot fingerprint is deterministic", () => {
  const value = request();
  assertEqual(new EvidenceFusionEngine().assess(value).snapshot.fingerprint, new EvidenceFusionEngine().assess(value).snapshot.fingerprint, "fingerprint");
});

test("assessment is serializable", () => { assertTrue(JSON.stringify(assess()).includes("evidence-fusion-snapshot:foundation"), "serialized"); });

test("provider-native fields cannot cross the Broad Market adapter", () => {
  const source = { ...sourceAssessment(), providerPayload: { apiKey: "forbidden", symbol: "SPY" } } as BroadMarketEvidenceAssessment & { providerPayload: unknown };
  const serialized = JSON.stringify(assess([evidenceFusionInputFromBroadMarketEvidence(source)]));
  assertTrue(!serialized.includes("providerPayload"), "payload absent");
  assertTrue(!serialized.includes("apiKey"), "secret-shaped field absent");
});

test("fusion output contains no regime recommendation signal score or probability", () => {
  const serialized = JSON.stringify(assess());
  for (const forbidden of ["BULL_TREND", "BEAR_TREND", "RELIEF_RALLY", "recommendation", "positionSize", "signal", "score", "probability", "BUY", "SELL"]) assertTrue(!serialized.includes(forbidden), `${forbidden} absent`);
});

test("duplicate source inputs are rejected", () => {
  const input = evidenceFusionInputFromBroadMarketEvidence(sourceAssessment());
  expectError(() => assess([input, { ...input, inputId: "fusion-input:duplicate" }]), EvidenceFusionIssueCode.DuplicateSource);
});

test("unsupported source type is rejected", () => {
  const input = evidenceFusionInputFromBroadMarketEvidence(sourceAssessment());
  expectError(() => createEvidenceFusionInput({ ...input, sourceType: "NEWS_EVIDENCE", provenance: { ...input.provenance, sourceType: "NEWS_EVIDENCE" } }), EvidenceFusionIssueCode.UnsupportedSource);
});

test("malformed source fingerprint is rejected by the adapter", () => {
  expectError(() => evidenceFusionInputFromBroadMarketEvidence({ ...sourceAssessment(), inputSnapshotFingerprint: "bad" }), EvidenceFusionIssueCode.InvalidIdentifier);
});

test("unsupported source schema is rejected by the adapter", () => {
  expectError(() => evidenceFusionInputFromBroadMarketEvidence({ ...sourceAssessment(), schemaVersion: "2.0" }), EvidenceFusionIssueCode.InvalidSchemaVersion);
});

test("complete source cannot hide blockers", () => {
  const source = sourceAssessment();
  expectError(() => evidenceFusionInputFromBroadMarketEvidence({ ...source, issues: [{ code: BroadMarketEvidenceIssueCode.DataQualityRejected, severity: BroadMarketEvidenceIssueSeverity.Blocker, field: "quality", message: "Rejected." }] }), EvidenceFusionIssueCode.InvalidSource);
});

test("contradictory source cannot omit contradiction evidence", () => {
  const source = sourceAssessment();
  expectError(() => evidenceFusionInputFromBroadMarketEvidence({ ...source, quality: BroadMarketEvidenceQuality.Contradictory, evidenceStrength: BroadMarketEvidenceStrength.Weak, issues: [] }), EvidenceFusionIssueCode.InvalidSource);
});

test("invalid fusion policy fails closed", () => {
  const invalid = { ...fusionPolicy, sourcePolicies: [{ ...fusionPolicy.sourcePolicies[0]!, maximumAgeSeconds: 0 }] };
  assertTrue(!validateEvidenceFusionPolicy(invalid).valid, "invalid policy");
  expectError(() => assess(undefined, { policy: invalid }), EvidenceFusionIssueCode.InvalidPolicy);
});

test("input issue ordering is deterministic", () => {
  const source = sourceAssessment("insufficient");
  const input = evidenceFusionInputFromBroadMarketEvidence(source);
  const keys = input.sourceIssues.map((entry) => `${entry.code}|${entry.field}|${entry.message}`);
  assertDeepEqual(keys, [...keys].sort(), "issue ordering");
});

test("blocker and contradiction ordering is deterministic", () => {
  const result = assess([evidenceFusionInputFromBroadMarketEvidence(sourceAssessment("contradictory"))]);
  const blockerKeys = result.snapshot.blockers.map((entry) => `${entry.code}|${entry.sourceCode ?? ""}|${entry.message}`);
  assertDeepEqual(blockerKeys, [...blockerKeys].sort(), "blocker ordering");
});

test("audit translation is deterministic and valid", () => {
  const assessment = assess();
  const context = {
    recordId: "audit:evidence-fusion:1",
    idempotencyKey: "idempotency:evidence-fusion:1",
    parentAuditRecordIds: [], relatedAuditRecordIds: [],
    actor: { type: AIAuditActorType.AlphaSubsystem, actorId: "evidence-fusion" },
    privacyLevel: PrivacyLevel.Internal,
    retention: AIAuditRetentionClassification.LongTerm,
  } as const;
  const first = auditRecordFromEvidenceFusionAssessment(assessment, context);
  validateAIAuditRecordInput(first);
  assertDeepEqual(first, auditRecordFromEvidenceFusionAssessment(assessment, context), "translation");
  assertEqual(first.recordType, AIAuditRecordType.EvidenceFusionAssessment, "record type");
  assertEqual(first.sourceSubsystem, AIAuditSourceSubsystem.EvidenceFusion, "source subsystem");
});

test("engine exposes no AI network provider persistence or mutation path", () => {
  assertDeepEqual(Object.getOwnPropertyNames(EvidenceFusionEngine.prototype), ["constructor", "assess"], "public methods");
});

let passed = 0;
for (const [name, run] of tests) {
  try { run(); passed += 1; console.log(`PASS ${name}`); }
  catch (error: unknown) { console.error(`FAIL ${name}`); throw error; }
}
console.log(`Evidence Fusion tests passed: ${String(passed)}/${String(tests.length)}.`);
