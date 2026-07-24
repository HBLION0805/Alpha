import {
  RESEARCH_DATASET_QUALIFICATION_SCHEMA_VERSION,
  ResearchDatasetAuthorizationStatus,
  ResearchDatasetEventType,
  ResearchDatasetIssueCode,
  ResearchDatasetOutcomeLabel,
  ResearchDatasetQualificationStatus,
  type ResearchDatasetQualificationInput,
  type ResearchDatasetQualificationPolicy,
} from "../../contracts/ResearchDatasetQualification";
import {
  RESEARCH_INTEGRITY_SCHEMA_VERSION,
  ResearchIntegrityAuthorizationStatus,
  ResearchIntegrityMode,
  ResearchIntegrityStatus,
} from "../../contracts/ResearchIntegrity";
import {
  DEFAULT_RESEARCH_DATASET_QUALIFICATION_POLICY,
  ResearchDatasetQualificationEngine,
  ResearchDatasetQualificationValidationError,
  createResearchCollectionPlanFingerprint,
  validateResearchDatasetQualificationInput,
  validateResearchDatasetQualificationPolicy,
} from "./ResearchDatasetQualificationEngine";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`);
}
function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}
function expectThrow(run: () => unknown): void {
  try {
    run();
  } catch (error: unknown) {
    assertTrue(error instanceof ResearchDatasetQualificationValidationError, "typed validation error");
    return;
  }
  throw new Error("Expected validation error.");
}

const TEST_POLICY: ResearchDatasetQualificationPolicy = {
  policyId: "research-dataset-qualification:test:1",
  version: "1.0",
  ruleSetVersion: "1.0",
  minimumCompletedSamples: 12,
  minimumDistinctUtcDays: 1,
  minimumCoverageBasisPoints: 8_000,
  minimumUpSamples: 3,
  minimumDownSamples: 3,
  maximumDominantOutcomeBasisPoints: 7_500,
  maximumOutcomeDelaySeconds: 1_200,
  trainBasisPoints: 5_000,
  calibrationBasisPoints: 2_500,
  testBasisPoints: 2_500,
  embargoSampleCount: 1,
  maximumSamples: 100,
};

function iso(milliseconds: number): string {
  return new Date(milliseconds).toISOString();
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function validInput(count = 12): ResearchDatasetQualificationInput {
  const firstCutoff = Date.parse("2026-07-01T00:15:00.000Z");
  const researchId = "research:btc-15m:calibration:001";
  const plannedEvents = Array.from({ length: count }, (_, index) => ({
    eventId: `event:btc-15m:${String(index).padStart(3, "0")}`,
    cutoffAt: iso(firstCutoff + index * 900_000),
  }));
  const samples = plannedEvents.map((event, index) => {
    const auditBase = {
      schemaVersion: RESEARCH_INTEGRITY_SCHEMA_VERSION,
      auditId: `audit:integrity:${String(index).padStart(3, "0")}`,
      researchId,
      mode: ResearchIntegrityMode.Forward,
      cutoffAt: event.cutoffAt,
      evaluatedAt: iso(Date.parse(event.cutoffAt) + 60_000),
      datasetId: `integrity-dataset:${String(index).padStart(3, "0")}`,
      datasetVersion: "1.0",
      datasetFrozenAt: iso(Date.parse(event.cutoffAt) - 60_000),
      datasetFingerprint: `fnv1a64:${(index + 301).toString(16).padStart(16, "0")}`,
      evidenceCount: 1,
      status: ResearchIntegrityStatus.Eligible,
      issues: [],
      policyId: "research-integrity:point-in-time:1",
      policyVersion: "1.0",
      ruleSetVersion: "1.0",
      authorizationStatus: ResearchIntegrityAuthorizationStatus.ResearchOnly,
      deterministic: true as const,
      readOnly: true as const,
    };
    return {
      sampleId: `sample:btc-15m:${String(index).padStart(3, "0")}`,
      eventId: event.eventId,
      observationId: `observation:btc-15m:${String(index).padStart(3, "0")}`,
      observationFingerprint: `fnv1a64:${(index + 1).toString(16).padStart(16, "0")}`,
      cutoffAt: event.cutoffAt,
      outcomeId: `outcome:btc-15m:${String(index).padStart(3, "0")}`,
      outcomeFingerprint: `fnv1a64:${(index + 101).toString(16).padStart(16, "0")}`,
      outcomeKnownAt: iso(Date.parse(event.cutoffAt) + 300_000),
      label: index % 2 === 0 ? ResearchDatasetOutcomeLabel.Up : ResearchDatasetOutcomeLabel.Down,
      featureSchemaVersion: "1.0",
      featureSetVersion: "btc-15m-features-1.0",
      integrityAudit: {
        ...auditBase,
        fingerprint: `fnv1a64:${fnv1a64(canonicalize(auditBase))}`,
      },
    };
  });
  return {
    schemaVersion: RESEARCH_DATASET_QUALIFICATION_SCHEMA_VERSION,
    qualificationId: "qualification:btc-15m:001",
    researchId,
    createdAt: iso(Date.parse(plannedEvents.at(-1)!.cutoffAt) + 600_000),
    collectionPlan: {
      planId: "collection-plan:btc-15m:001",
      planVersion: "1.0",
      frozenAt: "2026-07-01T00:00:00.000Z",
      instrumentId: "instrument:crypto:btc-usd",
      eventType: ResearchDatasetEventType.BtcFifteenMinute,
      intervalSeconds: 900,
      plannedEvents,
    },
    samples,
  };
}

function changed(mutator: (draft: Record<string, unknown>) => void): unknown {
  const draft = structuredClone(validInput()) as unknown as Record<string, unknown>;
  mutator(draft);
  return draft;
}

const engine = new ResearchDatasetQualificationEngine(TEST_POLICY);

function expectBlocked(value: unknown, code: ResearchDatasetIssueCode, customEngine = engine): void {
  const result = customEngine.qualify(value);
  assertEqual(result.status, ResearchDatasetQualificationStatus.Blocked, "blocked status");
  assertEqual(result.split, null, "blocked split");
  assertTrue(result.issues.some((entry) => entry.code === code), `issue ${code}`);
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["valid dataset qualifies", () => assertEqual(engine.qualify(validInput()).status, ResearchDatasetQualificationStatus.Qualified, "status")],
  ["metrics preserve coverage and balance", () => {
    const metrics = engine.qualify(validInput()).metrics;
    assertEqual(metrics.plannedCount, 12, "planned");
    assertEqual(metrics.completedCount, 12, "completed");
    assertEqual(metrics.coverageBasisPoints, 10_000, "coverage");
    assertEqual(metrics.upCount, 6, "up");
    assertEqual(metrics.downCount, 6, "down");
    assertEqual(metrics.dominantOutcomeBasisPoints, 5_000, "dominance");
  }],
  ["temporal split is deterministic and embargoed", () => {
    const split = engine.qualify(validInput()).split!;
    assertEqual(split.train.count, 5, "train");
    assertEqual(split.calibration.count, 2, "calibration");
    assertEqual(split.test.count, 3, "test");
    assertEqual(split.embargoedSampleIds.length, 2, "embargo");
    assertEqual(split.train.sampleIds[0], "sample:btc-15m:000", "first train");
    assertEqual(split.calibration.sampleIds[0], "sample:btc-15m:006", "first calibration");
    assertEqual(split.test.sampleIds[0], "sample:btc-15m:009", "first test");
  }],
  ["sample input order cannot change output", () => {
    const first = engine.qualify(validInput());
    const input = validInput();
    const second = engine.qualify({ ...input, samples: [...input.samples].reverse() });
    assertEqual(first.fingerprint, second.fingerprint, "fingerprint");
  }],
  ["result is deeply immutable and research-only", () => {
    const result = engine.qualify(validInput());
    assertTrue(Object.isFrozen(result), "result frozen");
    assertTrue(Object.isFrozen(result.split!), "split frozen");
    assertTrue(Object.isFrozen(result.split!.train.sampleIds), "ids frozen");
    assertEqual(result.authorizationStatus, ResearchDatasetAuthorizationStatus.ResearchOnly, "authorization");
  }],
  ["collection plan fingerprint is deterministic", () => {
    const plan = validInput().collectionPlan;
    assertEqual(createResearchCollectionPlanFingerprint(plan), createResearchCollectionPlanFingerprint(structuredClone(plan)), "plan fingerprint");
  }],
  ["default policy is conservative", () => {
    assertEqual(DEFAULT_RESEARCH_DATASET_QUALIFICATION_POLICY.minimumCompletedSamples, 1_000, "samples");
    assertEqual(DEFAULT_RESEARCH_DATASET_QUALIFICATION_POLICY.minimumDistinctUtcDays, 30, "days");
    assertEqual(DEFAULT_RESEARCH_DATASET_QUALIFICATION_POLICY.minimumCoverageBasisPoints, 9_000, "coverage");
  }],
  ["unknown root field fails closed", () => expectThrow(() => engine.qualify(changed((draft) => { draft["model"] = "xgboost"; })))],
  ["unknown sample field fails closed", () => expectThrow(() => engine.qualify(changed((draft) => {
    ((draft["samples"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["probability"] = 0.9;
  })))],
  ["unknown integrity field fails closed", () => expectThrow(() => engine.qualify(changed((draft) => {
    const sample = (draft["samples"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
    (sample["integrityAudit"] as Record<string, unknown>)["override"] = true;
  })))],
  ["invalid timestamp fails closed", () => expectThrow(() => engine.qualify(changed((draft) => { draft["createdAt"] = "2026-07-01"; })))],
  ["invalid fingerprint fails closed", () => expectThrow(() => engine.qualify(changed((draft) => {
    ((draft["samples"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["outcomeFingerprint"] = "bad";
  })))],
  ["empty samples fail closed", () => expectThrow(() => engine.qualify(changed((draft) => { draft["samples"] = []; })))],
  ["invalid policy ratio fails closed", () => {
    const policy = { ...TEST_POLICY, testBasisPoints: 2_499 };
    assertTrue(!validateResearchDatasetQualificationPolicy(policy).valid, "invalid policy");
    expectThrow(() => new ResearchDatasetQualificationEngine(policy));
  }],
  ["shape validator reports malformed input", () => assertTrue(!validateResearchDatasetQualificationInput({}, TEST_POLICY).valid, "shape")],
  ["wrong instrument fails closed", () => expectThrow(() => engine.qualify(changed((draft) => {
    (draft["collectionPlan"] as Record<string, unknown>)["instrumentId"] = "instrument:crypto:eth-usd";
  })))],
  ["wrong event interval fails closed", () => expectThrow(() => engine.qualify(changed((draft) => {
    (draft["collectionPlan"] as Record<string, unknown>)["intervalSeconds"] = 300;
  })))],
  ["discontinuous plan blocks", () => expectBlocked(changed((draft) => {
    const events = (draft["collectionPlan"] as Record<string, unknown>)["plannedEvents"] as Array<Record<string, unknown>>;
    events[3]!["cutoffAt"] = iso(Date.parse(events[3]!["cutoffAt"] as string) + 1_000);
  }), ResearchDatasetIssueCode.InvalidPlan)],
  ["late plan freeze blocks", () => expectBlocked(changed((draft) => {
    (draft["collectionPlan"] as Record<string, unknown>)["frozenAt"] = "2026-07-01T00:15:01.000Z";
  }), ResearchDatasetIssueCode.PlanFrozenTooLate)],
  ["plan frozen exactly at first cutoff blocks", () => expectBlocked(changed((draft) => {
    (draft["collectionPlan"] as Record<string, unknown>)["frozenAt"] = "2026-07-01T00:15:00.000Z";
  }), ResearchDatasetIssueCode.PlanFrozenTooLate)],
  ["duplicate planned event blocks", () => expectBlocked(changed((draft) => {
    const events = (draft["collectionPlan"] as Record<string, unknown>)["plannedEvents"] as Array<Record<string, unknown>>;
    events[1]!["eventId"] = events[0]!["eventId"];
  }), ResearchDatasetIssueCode.DuplicateIdentity)],
  ["duplicate sample identity blocks", () => expectBlocked(changed((draft) => {
    const samples = draft["samples"] as Array<Record<string, unknown>>;
    samples[1]!["sampleId"] = samples[0]!["sampleId"];
  }), ResearchDatasetIssueCode.DuplicateIdentity)],
  ["duplicate observation identity blocks", () => expectBlocked(changed((draft) => {
    const samples = draft["samples"] as Array<Record<string, unknown>>;
    samples[1]!["observationId"] = samples[0]!["observationId"];
  }), ResearchDatasetIssueCode.DuplicateIdentity)],
  ["duplicate outcome identity blocks", () => expectBlocked(changed((draft) => {
    const samples = draft["samples"] as Array<Record<string, unknown>>;
    samples[1]!["outcomeId"] = samples[0]!["outcomeId"];
  }), ResearchDatasetIssueCode.DuplicateIdentity)],
  ["duplicate audit identity blocks", () => expectBlocked(changed((draft) => {
    const samples = draft["samples"] as Array<Record<string, unknown>>;
    (samples[1]!["integrityAudit"] as Record<string, unknown>)["auditId"] = (samples[0]!["integrityAudit"] as Record<string, unknown>)["auditId"];
  }), ResearchDatasetIssueCode.DuplicateIdentity)],
  ["unplanned event blocks", () => expectBlocked(changed((draft) => {
    ((draft["samples"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["eventId"] = "event:unplanned";
  }), ResearchDatasetIssueCode.UnplannedEvent)],
  ["planned cutoff mismatch blocks", () => expectBlocked(changed((draft) => {
    const sample = (draft["samples"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
    sample["cutoffAt"] = iso(Date.parse(sample["cutoffAt"] as string) + 1_000);
    (sample["integrityAudit"] as Record<string, unknown>)["cutoffAt"] = sample["cutoffAt"];
  }), ResearchDatasetIssueCode.EventCutoffMismatch)],
  ["insufficient samples block", () => {
    const input = validInput();
    expectBlocked({ ...input, samples: input.samples.slice(0, 11) }, ResearchDatasetIssueCode.InsufficientSamples);
  }],
  ["insufficient distinct dates block", () => {
    const customEngine = new ResearchDatasetQualificationEngine({ ...TEST_POLICY, minimumDistinctUtcDays: 2 });
    expectBlocked(validInput(), ResearchDatasetIssueCode.InsufficientDateCoverage, customEngine);
  }],
  ["insufficient plan coverage blocks", () => {
    const input = validInput(15);
    const customEngine = new ResearchDatasetQualificationEngine({ ...TEST_POLICY, minimumCompletedSamples: 10, minimumCoverageBasisPoints: 9_000 });
    expectBlocked({ ...input, samples: input.samples.slice(0, 12) }, ResearchDatasetIssueCode.InsufficientPlanCoverage, customEngine);
  }],
  ["insufficient outcome coverage blocks", () => expectBlocked(changed((draft) => {
    const samples = draft["samples"] as Array<Record<string, unknown>>;
    samples.forEach((entry, index) => { entry["label"] = index < 10 ? ResearchDatasetOutcomeLabel.Up : ResearchDatasetOutcomeLabel.Down; });
  }), ResearchDatasetIssueCode.InsufficientOutcomeCoverage)],
  ["dominant outcome blocks", () => {
    const customEngine = new ResearchDatasetQualificationEngine({ ...TEST_POLICY, minimumDownSamples: 2, maximumDominantOutcomeBasisPoints: 7_000 });
    expectBlocked(changed((draft) => {
      const samples = draft["samples"] as Array<Record<string, unknown>>;
      samples.forEach((entry, index) => { entry["label"] = index < 9 ? ResearchDatasetOutcomeLabel.Up : ResearchDatasetOutcomeLabel.Down; });
    }), ResearchDatasetIssueCode.OutcomeImbalance, customEngine);
  }],
  ["outcome at cutoff blocks", () => expectBlocked(changed((draft) => {
    const sample = (draft["samples"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
    sample["outcomeKnownAt"] = sample["cutoffAt"];
  }), ResearchDatasetIssueCode.InvalidOutcomeChronology)],
  ["outcome after qualification creation blocks", () => expectBlocked(changed((draft) => {
    ((draft["samples"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["outcomeKnownAt"] = "2026-07-02T00:00:00.000Z";
  }), ResearchDatasetIssueCode.InvalidOutcomeChronology)],
  ["outcome delay above policy blocks", () => expectBlocked(changed((draft) => {
    const sample = (draft["samples"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
    sample["outcomeKnownAt"] = iso(Date.parse(sample["cutoffAt"] as string) + 1_201_000);
  }), ResearchDatasetIssueCode.OutcomeDelayExceeded)],
  ["blocked integrity audit blocks sample", () => expectBlocked(changed((draft) => {
    const sample = (draft["samples"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
    (sample["integrityAudit"] as Record<string, unknown>)["status"] = ResearchIntegrityStatus.Blocked;
  }), ResearchDatasetIssueCode.IntegrityAuditBlocked)],
  ["tampered integrity audit proof blocks sample", () => expectBlocked(changed((draft) => {
    const sample = (draft["samples"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
    (sample["integrityAudit"] as Record<string, unknown>)["datasetFingerprint"] = "fnv1a64:ffffffffffffffff";
  }), ResearchDatasetIssueCode.IntegrityAuditMismatch)],
  ["integrity cutoff mismatch blocks", () => expectBlocked(changed((draft) => {
    const sample = (draft["samples"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
    (sample["integrityAudit"] as Record<string, unknown>)["cutoffAt"] = iso(Date.parse(sample["cutoffAt"] as string) - 1_000);
  }), ResearchDatasetIssueCode.IntegrityAuditMismatch)],
  ["integrity authority mismatch blocks", () => expectThrow(() => engine.qualify(changed((draft) => {
    const sample = (draft["samples"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
    (sample["integrityAudit"] as Record<string, unknown>)["authorizationStatus"] = "TRADE_AUTHORITY";
  })))],
  ["mixed integrity policy versions block", () => expectBlocked(changed((draft) => {
    const sample = (draft["samples"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
    (sample["integrityAudit"] as Record<string, unknown>)["policyVersion"] = "2.0";
  }), ResearchDatasetIssueCode.IntegrityPolicyMismatch)],
  ["feature schema mismatch blocks", () => expectBlocked(changed((draft) => {
    ((draft["samples"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["featureSchemaVersion"] = "2.0";
  }), ResearchDatasetIssueCode.FeatureVersionMismatch)],
  ["feature-set mismatch blocks", () => expectBlocked(changed((draft) => {
    ((draft["samples"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["featureSetVersion"] = "btc-15m-features-2.0";
  }), ResearchDatasetIssueCode.FeatureVersionMismatch)],
  ["partition label overlap blocks", () => {
    const customEngine = new ResearchDatasetQualificationEngine({ ...TEST_POLICY, maximumOutcomeDelaySeconds: 3_600 });
    expectBlocked(changed((draft) => {
      const sample = (draft["samples"] as Array<Record<string, unknown>>)[4] as Record<string, unknown>;
      sample["outcomeKnownAt"] = iso(Date.parse(sample["cutoffAt"] as string) + 2_100_000);
    }), ResearchDatasetIssueCode.PartitionLabelOverlap, customEngine);
  }],
  ["too few samples for embargoed partitions blocks", () => {
    const policy = { ...TEST_POLICY, minimumCompletedSamples: 7, minimumUpSamples: 2, minimumDownSamples: 2, embargoSampleCount: 2 };
    const customEngine = new ResearchDatasetQualificationEngine(policy);
    const input = validInput(6);
    expectBlocked(input, ResearchDatasetIssueCode.InsufficientPartitionSize, customEngine);
  }],
  ["output contains no model probability return or trade fields", () => {
    const serialized = JSON.stringify(engine.qualify(validInput()));
    assertTrue(!serialized.includes("\"model\""), "no model");
    assertTrue(!serialized.includes("\"probability\""), "no probability");
    assertTrue(!serialized.includes("\"return\""), "no return");
    assertTrue(!serialized.includes("\"recommendation\""), "no recommendation");
    assertTrue(!serialized.includes("\"positionSize\""), "no position sizing");
  }],
];

function main(): void {
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
  console.log(`Research Dataset Qualification tests passed: ${String(passed)}/${String(tests.length)}.`);
}

main();
