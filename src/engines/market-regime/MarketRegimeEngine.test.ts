import {
  AIAuditActorType,
  AIAuditRecordType,
  AIAuditRetentionClassification,
  AIAuditSourceSubsystem,
  MARKET_REGIME_SCHEMA_VERSION,
  MarketRegimeCondition,
  MarketRegimeDataQualityStatus,
  MarketRegimeEvidenceStrength,
  MarketRegimePrimary,
  MarketRegimeReasonCode,
  MarketRegimeValidationIssueCode,
  MarketRegimeVolatilityMetric,
  InstrumentAssetClass,
  PrivacyLevel,
  RegimeBreadthSignal,
  RegimeBenchmarkScope,
  RegimeCanonicalIdentityStatus,
  RegimeObservationQualityStatus,
  RegimeSupplementalEvidenceStatus,
  RegimeVolumeSignal,
  type MarketRegimeAssessmentRequest,
  type MarketRegimePolicy,
  type RegimeInputSnapshot,
  type RegimeInputSnapshotInput,
} from "../../contracts";
import { validateAIAuditRecordInput } from "../../contracts/AIAuditRepositoryValidation";
import { auditRecordFromMarketRegimeAssessment } from "./MarketRegimeAuditTranslations";
import {
  MarketRegimeEngine,
  MarketRegimeValidationError,
  createRegimeInputSnapshot,
} from "./MarketRegimeEngine";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`);
}

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function assertDeepEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: values differ.`);
}

function expectError(run: () => unknown, code: MarketRegimeValidationIssueCode): void {
  try {
    run();
  } catch (error: unknown) {
    if (error instanceof MarketRegimeValidationError && error.issues.some((entry) => entry.code === code)) return;
    throw error;
  }
  throw new Error(`Expected ${code}.`);
}

const policy: MarketRegimePolicy = {
  policyId: "market-regime-policy:foundation",
  version: "1.0",
  ruleSetVersion: "1.0",
  shortTrendWindow: 3,
  mediumTrendWindow: 5,
  correctionDrawdownThresholdBasisPoints: 500,
  reliefRallyReboundThresholdBasisPoints: 300,
  highVolatilityThresholdBasisPoints: 400,
  rangeBoundThresholdBasisPoints: 150,
  freshnessThresholdSeconds: 3_600,
  minimumRequiredObservations: 5,
  strongEvidenceMinimumObservations: 10,
  volatilityMetric: MarketRegimeVolatilityMetric.MaximumAbsoluteReturnBasisPoints,
};

function observations(values: readonly string[]): RegimeInputSnapshotInput["observations"] {
  return values.map((atomicValue, index) => ({
    observationId: `regime-observation:${String(index + 1)}`,
    observedAt: `2026-07-21T${String(10 + index).padStart(2, "0")}:00:00.000Z`,
    close: { atomicValue, scale: 2 },
    qualityStatus: RegimeObservationQualityStatus.Accepted,
    evidenceReferences: [`canonical-bar:${String(index + 1)}`],
  }));
}

function snapshotInput(
  values: readonly string[] = ["10000", "10200", "10400", "10600", "10800"],
  overrides: Partial<RegimeInputSnapshotInput> = {},
): RegimeInputSnapshotInput {
  return {
    schemaVersion: MARKET_REGIME_SCHEMA_VERSION,
    snapshotId: "regime-snapshot:foundation",
    benchmark: {
      status: RegimeCanonicalIdentityStatus.Resolved,
      instrumentId: "instrument:00000000000000000000000001",
      assetClass: InstrumentAssetClass.Etf,
      scope: RegimeBenchmarkScope.BroadMarket,
    },
    observationWindow: {
      start: "2026-07-21T09:59:00.000Z",
      end: "2026-07-21T14:00:00.000Z",
    },
    observations: observations(values),
    dataQualityStatus: MarketRegimeDataQualityStatus.Accepted,
    requestedSecondaryConditions: [],
    evidenceReferences: ["evidence-assessment:market-regime"],
    trace: {
      correlationId: "correlation:market-regime",
      traceId: "trace:market-regime",
      auditReferenceIds: ["audit:canonical-market-data"],
    },
    createdAt: "2026-07-21T14:04:00.000Z",
    ...overrides,
  };
}

function request(snapshot: RegimeInputSnapshot, overrides: Partial<MarketRegimeAssessmentRequest> = {}): MarketRegimeAssessmentRequest {
  return {
    schemaVersion: MARKET_REGIME_SCHEMA_VERSION,
    assessmentId: "market-regime-assessment:foundation",
    assessedAt: "2026-07-21T14:05:00.000Z",
    createdAt: "2026-07-21T14:05:00.000Z",
    snapshot,
    policy,
    ...overrides,
  };
}

function assess(
  values: readonly string[] = ["10000", "10200", "10400", "10600", "10800"],
  overrides: Partial<RegimeInputSnapshotInput> = {},
) {
  return new MarketRegimeEngine().assess(request(createRegimeInputSnapshot(snapshotInput(values, overrides))));
}

type Test = readonly [string, () => void];
const tests: Test[] = [];
function test(name: string, run: Test[1]): void { tests.push([name, run]); }

test("positive short and medium structure produces BULL_TREND", () => {
  const result = assess();
  assertEqual(result.primaryRegime, MarketRegimePrimary.BullTrend, "primary regime");
  assertTrue(result.reasonCodes.includes(MarketRegimeReasonCode.ShortTrendPositive), "short reason");
  assertTrue(result.reasonCodes.includes(MarketRegimeReasonCode.MediumTrendPositive), "medium reason");
});

test("negative short and medium structure produces BEAR_TREND", () => {
  const result = assess(["10800", "10600", "10400", "10200", "10000"]);
  assertEqual(result.primaryRegime, MarketRegimePrimary.BearTrend, "primary regime");
});

test("non-bearish medium structure with threshold drawdown produces CORRECTION", () => {
  const result = assess(["10000", "11000", "11200", "10800", "10400"]);
  assertEqual(result.primaryRegime, MarketRegimePrimary.Correction, "primary regime");
  assertTrue(result.reasonCodes.includes(MarketRegimeReasonCode.DrawdownThresholdExceeded), "drawdown reason");
});

test("rebound inside an unrepaired medium decline produces RELIEF_RALLY", () => {
  const result = assess(["11000", "10000", "9000", "9400", "9800"]);
  assertEqual(result.primaryRegime, MarketRegimePrimary.ReliefRally, "primary regime");
  assertTrue(result.primaryRegime !== MarketRegimePrimary.BullTrend, "not bull trend");
});

test("low-direction bounded movement produces RANGE_BOUND", () => {
  const result = assess(["10000", "10050", "9980", "10040", "10010"]);
  assertEqual(result.primaryRegime, MarketRegimePrimary.RangeBound, "primary regime");
});

test("HIGH_VOLATILITY coexists with a primary regime", () => {
  const result = assess(["10000", "11000", "10500", "11500", "12000"]);
  assertEqual(result.primaryRegime, MarketRegimePrimary.BullTrend, "primary regime");
  assertTrue(result.secondaryConditions.includes(MarketRegimeCondition.HighVolatility), "high volatility condition");
});

test("missing observations fail closed", () => {
  const result = assess(["10000", "10100", "10200"]);
  assertEqual(result.primaryRegime, MarketRegimePrimary.InsufficientEvidence, "primary regime");
  assertEqual(result.evidenceStrength, MarketRegimeEvidenceStrength.Insufficient, "evidence strength");
});

test("stale data fails closed", () => {
  const snapshot = createRegimeInputSnapshot(snapshotInput());
  const result = new MarketRegimeEngine().assess(request(snapshot, {
    assessedAt: "2026-07-21T16:00:01.000Z",
    createdAt: "2026-07-21T16:00:01.000Z",
  }));
  assertEqual(result.primaryRegime, MarketRegimePrimary.InsufficientEvidence, "primary regime");
  assertEqual(result.dataQualityStatus, MarketRegimeDataQualityStatus.Stale, "data quality");
});

test("rejected data quality fails closed", () => {
  const result = assess(undefined, { dataQualityStatus: MarketRegimeDataQualityStatus.Rejected });
  assertEqual(result.primaryRegime, MarketRegimePrimary.InsufficientEvidence, "primary regime");
  assertTrue(result.reasonCodes.includes(MarketRegimeReasonCode.DataQualityRejected), "quality reason");
});

test("unresolved canonical identity fails closed", () => {
  const result = assess(undefined, { benchmark: { status: RegimeCanonicalIdentityStatus.Unresolved } });
  assertEqual(result.primaryRegime, MarketRegimePrimary.InsufficientEvidence, "primary regime");
  assertTrue(result.reasonCodes.includes(MarketRegimeReasonCode.CanonicalIdentityUnresolved), "identity reason");
});

test("a single equity cannot be declared as the market benchmark", () => {
  expectError(() => createRegimeInputSnapshot(snapshotInput(undefined, {
    benchmark: {
      status: RegimeCanonicalIdentityStatus.Resolved,
      instrumentId: "instrument:00000000000000000000000002",
      assetClass: InstrumentAssetClass.Equity as unknown as InstrumentAssetClass.Etf,
      scope: RegimeBenchmarkScope.BroadMarket,
    },
  })), MarketRegimeValidationIssueCode.InvalidCanonicalIdentity);
});

test("identical input produces deterministic output", () => {
  const snapshot = createRegimeInputSnapshot(snapshotInput());
  const engine = new MarketRegimeEngine();
  assertDeepEqual(engine.assess(request(snapshot)), engine.assess(request(snapshot)), "deterministic assessment");
});

test("snapshot and assessment are deeply immutable", () => {
  const snapshot = createRegimeInputSnapshot(snapshotInput());
  const result = new MarketRegimeEngine().assess(request(snapshot));
  assertTrue(Object.isFrozen(snapshot), "snapshot frozen");
  assertTrue(Object.isFrozen(snapshot.observations), "snapshot observations frozen");
  assertTrue(Object.isFrozen(result), "assessment frozen");
  assertTrue(Object.isFrozen(result.reasonCodes), "assessment reasons frozen");
});

test("reason and condition ordering is stable", () => {
  const result = assess(["10000", "11000", "10500", "11500", "12000"]);
  assertDeepEqual(result.reasonCodes, [...result.reasonCodes].sort(), "reason ordering");
  assertDeepEqual(result.secondaryConditions, [...result.secondaryConditions].sort(), "condition ordering");
});

test("policy and rule-set versions are preserved", () => {
  const result = assess();
  assertEqual(result.policyVersion, "1.0", "policy version");
  assertEqual(result.ruleSetVersion, "1.0", "rule-set version");
});

test("distribution is blocked without verified volume and breadth evidence", () => {
  const result = assess(undefined, { requestedSecondaryConditions: [MarketRegimeCondition.DistributionRisk] });
  assertTrue(!result.secondaryConditions.includes(MarketRegimeCondition.DistributionRisk), "distribution absent");
  assertTrue(result.reasonCodes.includes(MarketRegimeReasonCode.VolumeEvidenceUnavailable), "volume blocker");
  assertTrue(result.reasonCodes.includes(MarketRegimeReasonCode.BreadthEvidenceUnavailable), "breadth blocker");
});

test("unverified volume semantics block distribution", () => {
  const result = assess(undefined, {
    requestedSecondaryConditions: [MarketRegimeCondition.DistributionRisk],
    volumeEvidence: { status: RegimeSupplementalEvidenceStatus.Unverified, evidenceReferences: [] },
    breadthEvidence: {
      status: RegimeSupplementalEvidenceStatus.Verified,
      signal: RegimeBreadthSignal.Negative,
      observedAt: "2026-07-21T14:00:00.000Z",
      evidenceReferences: ["breadth-evidence:1"],
    },
  });
  assertTrue(!result.secondaryConditions.includes(MarketRegimeCondition.DistributionRisk), "distribution absent");
});

test("verified volume and breadth can produce DISTRIBUTION_RISK", () => {
  const result = assess(undefined, {
    requestedSecondaryConditions: [MarketRegimeCondition.DistributionRisk],
    volumeEvidence: {
      status: RegimeSupplementalEvidenceStatus.Verified,
      signal: RegimeVolumeSignal.Distribution,
      unitSemanticsVersion: "1.0",
      observedAt: "2026-07-21T14:00:00.000Z",
      evidenceReferences: ["volume-evidence:1"],
    },
    breadthEvidence: {
      status: RegimeSupplementalEvidenceStatus.Verified,
      signal: RegimeBreadthSignal.Negative,
      observedAt: "2026-07-21T14:00:00.000Z",
      evidenceReferences: ["breadth-evidence:1"],
    },
  });
  assertTrue(result.secondaryConditions.includes(MarketRegimeCondition.DistributionRisk), "distribution present");
});

test("verified volume and breadth can produce ACCUMULATION_CANDIDATE", () => {
  const result = assess(undefined, {
    requestedSecondaryConditions: [MarketRegimeCondition.AccumulationCandidate],
    volumeEvidence: {
      status: RegimeSupplementalEvidenceStatus.Verified,
      signal: RegimeVolumeSignal.Accumulation,
      unitSemanticsVersion: "1.0",
      observedAt: "2026-07-21T14:00:00.000Z",
      evidenceReferences: ["volume-evidence:2"],
    },
    breadthEvidence: {
      status: RegimeSupplementalEvidenceStatus.Verified,
      signal: RegimeBreadthSignal.Positive,
      observedAt: "2026-07-21T14:00:00.000Z",
      evidenceReferences: ["breadth-evidence:2"],
    },
  });
  assertTrue(result.secondaryConditions.includes(MarketRegimeCondition.AccumulationCandidate), "accumulation present");
});

test("stale supplemental evidence cannot produce a condition", () => {
  const result = assess(undefined, {
    requestedSecondaryConditions: [MarketRegimeCondition.DistributionRisk],
    volumeEvidence: {
      status: RegimeSupplementalEvidenceStatus.Verified,
      signal: RegimeVolumeSignal.Distribution,
      unitSemanticsVersion: "1.0",
      observedAt: "2026-07-21T12:00:00.000Z",
      evidenceReferences: ["volume-evidence:stale"],
    },
    breadthEvidence: {
      status: RegimeSupplementalEvidenceStatus.Verified,
      signal: RegimeBreadthSignal.Negative,
      observedAt: "2026-07-21T12:00:00.000Z",
      evidenceReferences: ["breadth-evidence:stale"],
    },
  });
  assertEqual(result.primaryRegime, MarketRegimePrimary.BullTrend, "price primary retained");
  assertTrue(!result.secondaryConditions.includes(MarketRegimeCondition.DistributionRisk), "stale condition absent");
  assertTrue(result.reasonCodes.includes(MarketRegimeReasonCode.DataStale), "stale reason");
});

test("contradictory core observations fail closed explicitly", () => {
  const values = observations(["10000", "10200", "10400", "10600", "10800"]);
  const contradictory = values.map((entry, index) => index === 4
    ? { ...entry, observedAt: values[3]!.observedAt, close: { atomicValue: "9900", scale: 2 } }
    : entry);
  const result = assess(undefined, { observations: contradictory });
  assertEqual(result.primaryRegime, MarketRegimePrimary.InsufficientEvidence, "primary regime");
  assertTrue(result.reasonCodes.includes(MarketRegimeReasonCode.ContradictoryInputs), "contradiction reason");
});

test("invalid thresholds are rejected fail closed", () => {
  const snapshot = createRegimeInputSnapshot(snapshotInput());
  expectError(() => new MarketRegimeEngine().assess(request(snapshot, {
    policy: { ...policy, highVolatilityThresholdBasisPoints: 0 },
  })), MarketRegimeValidationIssueCode.InvalidThreshold);
});

test("invalid assessment timestamp ordering is rejected", () => {
  const snapshot = createRegimeInputSnapshot(snapshotInput());
  expectError(() => new MarketRegimeEngine().assess(request(snapshot, {
    createdAt: "2026-07-21T14:04:30.000Z",
  })), MarketRegimeValidationIssueCode.InvalidTimestamp);
});

test("provider-native fields do not cross snapshot or assessment boundaries", () => {
  const input = {
    ...snapshotInput(),
    providerId: "provider:forbidden",
    providerSymbol: "AAPL",
    rawPayload: { native: true },
  };
  const snapshot = createRegimeInputSnapshot(input);
  const serialized = JSON.stringify(new MarketRegimeEngine().assess(request(snapshot)));
  for (const forbidden of ["providerId", "providerSymbol", "rawPayload"]) assertTrue(!serialized.includes(forbidden), `${forbidden} absent`);
});

test("engine exposes no AI, network, trading, portfolio, or execution path", () => {
  const engine = new MarketRegimeEngine() as unknown as Record<string, unknown>;
  for (const forbidden of ["fetch", "network", "ai", "trade", "buy", "sell", "portfolio", "execute"]) {
    assertTrue(!(forbidden in engine), `${forbidden} absent`);
  }
});

test("source records and unrelated trading state remain unchanged", () => {
  const input = snapshotInput();
  const before = JSON.stringify(input);
  const frozenPlan = Object.freeze({ planId: "plan:frozen", status: "FROZEN" });
  new MarketRegimeEngine().assess(request(createRegimeInputSnapshot(input)));
  assertEqual(JSON.stringify(input), before, "source input unchanged");
  assertEqual(frozenPlan.status, "FROZEN", "plan unchanged");
});

test("assessment is serializable and contains no recommendation field", () => {
  const serialized = JSON.stringify(assess());
  assertTrue(serialized.includes("BULL_TREND"), "serialized regime");
  for (const forbidden of ["recommendation", "positionSize", "expectedProfit", "BUY", "SELL"]) assertTrue(!serialized.includes(forbidden), `${forbidden} absent`);
});

test("audit translation is deterministic and valid for Unified Audit", () => {
  const assessment = assess();
  const context = {
    recordId: "audit:market-regime:1",
    idempotencyKey: "idempotency:market-regime:1",
    parentAuditRecordIds: [],
    relatedAuditRecordIds: [],
    actor: { type: AIAuditActorType.AlphaSubsystem, actorId: "market-regime-engine" },
    privacyLevel: PrivacyLevel.Internal,
    retention: AIAuditRetentionClassification.LongTerm,
  } as const;
  const first = auditRecordFromMarketRegimeAssessment(assessment, context);
  const second = auditRecordFromMarketRegimeAssessment(assessment, context);
  validateAIAuditRecordInput(first);
  assertDeepEqual(first, second, "audit translation");
  assertEqual(first.recordType, AIAuditRecordType.MarketRegimeAssessment, "audit type");
  assertEqual(first.sourceSubsystem, AIAuditSourceSubsystem.MarketRegimeEngine, "audit subsystem");
});

test("primary vocabulary excludes distribution and accumulation claims", () => {
  assertTrue(!Object.values(MarketRegimePrimary).includes(MarketRegimeCondition.DistributionRisk as unknown as MarketRegimePrimary), "distribution not primary");
  assertTrue(!Object.values(MarketRegimePrimary).includes(MarketRegimeCondition.AccumulationCandidate as unknown as MarketRegimePrimary), "accumulation not primary");
});

let passed = 0;
for (const [name, run] of tests) {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error: unknown) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

console.log(`Market Regime tests passed: ${String(passed)}/${String(tests.length)}.`);
