import {
  RESEARCH_INTEGRITY_SCHEMA_VERSION,
  ResearchEvidenceAvailabilityBasis,
  ResearchEvidenceCompletionStatus,
  ResearchEvidenceKind,
  ResearchIntegrityAuthorizationStatus,
  ResearchIntegrityIssueCode,
  ResearchIntegrityMode,
  ResearchIntegrityStatus,
  type ResearchIntegrityAuditInput,
} from "../../contracts/ResearchIntegrity";
import {
  DEFAULT_RESEARCH_INTEGRITY_POLICY,
  ResearchIntegrityEngine,
  ResearchIntegrityValidationError,
  createResearchDatasetFingerprint,
  validateResearchIntegrityAuditInput,
  validateResearchIntegrityPolicy,
} from "./ResearchIntegrityEngine";

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
    assertTrue(error instanceof ResearchIntegrityValidationError, "typed validation error");
    return;
  }
  throw new Error("Expected validation error.");
}

function validHistoricalInput(): ResearchIntegrityAuditInput {
  return {
    schemaVersion: RESEARCH_INTEGRITY_SCHEMA_VERSION,
    auditId: "audit:research-integrity:btc:001",
    researchId: "research:btc-15m:calibration:001",
    mode: ResearchIntegrityMode.HistoricalReplay,
    cutoffAt: "2026-07-23T20:45:00.000Z",
    evaluatedAt: "2026-07-24T12:00:00.000Z",
    dataset: {
      datasetId: "dataset:btc-15m:001",
      datasetVersion: "1.0",
      frozenAt: "2026-07-24T11:00:00.000Z",
      evidenceMembers: [
        { evidenceId: "evidence:bar:001", evidenceFingerprint: "fnv1a64:1111111111111111" },
        { evidenceId: "evidence:contract:001", evidenceFingerprint: "fnv1a64:2222222222222222" },
      ],
    },
    evidence: [
      {
        evidenceId: "evidence:bar:001",
        kind: ResearchEvidenceKind.CanonicalBar,
        sourceId: "source:canonical-bar",
        sourceRecordId: "bar:btc:001",
        occurredAt: "2026-07-23T20:44:00.000Z",
        publishedAt: "2026-07-23T20:44:00.000Z",
        availableAt: "2026-07-23T20:44:00.000Z",
        receivedAt: "2026-07-24T10:00:00.000Z",
        intervalStartsAt: "2026-07-23T20:43:00.000Z",
        intervalEndsAt: "2026-07-23T20:44:00.000Z",
        completionStatus: ResearchEvidenceCompletionStatus.Final,
        availabilityBasis: ResearchEvidenceAvailabilityBasis.ReviewedPointInTimeArchive,
        availabilityReference: "archive:provider:bar:001",
        outcomeBearing: false,
        fingerprint: "fnv1a64:1111111111111111",
      },
      {
        evidenceId: "evidence:contract:001",
        kind: ResearchEvidenceKind.EventContractObservation,
        sourceId: "source:event-contract-shadow",
        sourceRecordId: "observation:btc:001",
        occurredAt: "2026-07-23T20:44:30.000Z",
        publishedAt: null,
        availableAt: "2026-07-23T20:44:30.000Z",
        receivedAt: "2026-07-24T10:00:00.000Z",
        intervalStartsAt: null,
        intervalEndsAt: null,
        completionStatus: ResearchEvidenceCompletionStatus.PointInTime,
        availabilityBasis: ResearchEvidenceAvailabilityBasis.ReviewedPointInTimeArchive,
        availabilityReference: "archive:shadow:observation:001",
        outcomeBearing: false,
        fingerprint: "fnv1a64:2222222222222222",
      },
    ],
  };
}

function validForwardInput(): ResearchIntegrityAuditInput {
  const input = validHistoricalInput();
  return {
    ...input,
    auditId: "audit:research-integrity:btc:forward:001",
    mode: ResearchIntegrityMode.Forward,
    evaluatedAt: "2026-07-23T20:46:00.000Z",
    dataset: { ...input.dataset, frozenAt: "2026-07-23T20:44:45.000Z" },
    evidence: input.evidence.map((entry) => ({
      ...entry,
      receivedAt: entry.availableAt,
      availabilityBasis: ResearchEvidenceAvailabilityBasis.ProviderReceipt,
      availabilityReference: `receipt:${entry.evidenceId}`,
    })),
  };
}

function changed(mutator: (draft: Record<string, unknown>) => void): unknown {
  const draft = structuredClone(validHistoricalInput()) as unknown as Record<string, unknown>;
  mutator(draft);
  return draft;
}

const engine = new ResearchIntegrityEngine();

function expectBlocked(value: unknown, code: ResearchIntegrityIssueCode): void {
  const audit = engine.assess(value);
  assertEqual(audit.status, ResearchIntegrityStatus.Blocked, "blocked status");
  assertTrue(audit.issues.some((entry) => entry.code === code), `issue ${code}`);
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["historical replay permits later receipt and freeze", () => {
    const audit = engine.assess(validHistoricalInput());
    assertEqual(audit.status, ResearchIntegrityStatus.Eligible, "status");
    assertEqual(audit.evidenceCount, 2, "evidence count");
  }],
  ["forward mode accepts only pre-cutoff receipt and freeze", () => assertEqual(engine.assess(validForwardInput()).status, ResearchIntegrityStatus.Eligible, "status")],
  ["output is immutable and research-only", () => {
    const audit = engine.assess(validHistoricalInput());
    assertTrue(Object.isFrozen(audit), "audit frozen");
    assertTrue(Object.isFrozen(audit.issues), "issues frozen");
    assertEqual(audit.authorizationStatus, ResearchIntegrityAuthorizationStatus.ResearchOnly, "authorization");
  }],
  ["dataset order is fingerprint independent", () => {
    const input = validHistoricalInput();
    assertEqual(createResearchDatasetFingerprint(input.dataset), createResearchDatasetFingerprint({ ...input.dataset, evidenceMembers: [...input.dataset.evidenceMembers].reverse() }), "dataset fingerprint");
  }],
  ["evidence order is audit fingerprint independent", () => {
    const first = engine.assess(validHistoricalInput());
    const input = validHistoricalInput();
    const second = engine.assess({ ...input, evidence: [...input.evidence].reverse(), dataset: { ...input.dataset, evidenceMembers: [...input.dataset.evidenceMembers].reverse() } });
    assertEqual(first.fingerprint, second.fingerprint, "audit fingerprint");
  }],
  ["unknown top-level field fails closed", () => expectThrow(() => engine.assess(changed((draft) => { draft["recommendation"] = "BUY"; })))],
  ["unknown nested field fails closed", () => expectThrow(() => engine.assess(changed((draft) => {
    ((draft["evidence"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["futurePrice"] = 99;
  })))],
  ["invalid timestamp fails closed", () => expectThrow(() => engine.assess(changed((draft) => { draft["cutoffAt"] = "2026-07-23"; })))],
  ["invalid fingerprint fails closed", () => expectThrow(() => engine.assess(changed((draft) => {
    ((draft["evidence"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["fingerprint"] = "not-a-fingerprint";
  })))],
  ["unsupported mode fails closed", () => expectThrow(() => engine.assess(changed((draft) => { draft["mode"] = "BACKTEST"; })))],
  ["empty evidence fails closed", () => expectThrow(() => engine.assess(changed((draft) => { draft["evidence"] = []; })))],
  ["invalid policy fails at construction", () => {
    const policy = { ...DEFAULT_RESEARCH_INTEGRITY_POLICY, maximumEvidenceRecords: 0 };
    assertTrue(!validateResearchIntegrityPolicy(policy).valid, "invalid policy");
    expectThrow(() => new ResearchIntegrityEngine(policy));
  }],
  ["shape validator reports invalid input", () => assertTrue(!validateResearchIntegrityAuditInput({}).valid, "invalid shape")],
  ["cutoff after evaluation blocks", () => expectBlocked(changed((draft) => { draft["evaluatedAt"] = "2026-07-23T20:44:59.000Z"; }), ResearchIntegrityIssueCode.CutoffAfterEvaluation)],
  ["dataset frozen after evaluation blocks", () => expectBlocked(changed((draft) => {
    (draft["dataset"] as Record<string, unknown>)["frozenAt"] = "2026-07-24T12:00:01.000Z";
  }), ResearchIntegrityIssueCode.DatasetNotFrozen)],
  ["forward dataset frozen after cutoff blocks", () => {
    const input = validForwardInput();
    expectBlocked({ ...input, dataset: { ...input.dataset, frozenAt: "2026-07-23T20:45:01.000Z" } }, ResearchIntegrityIssueCode.DatasetNotFrozen);
  }],
  ["occurrence after cutoff blocks", () => expectBlocked(changed((draft) => {
    const entry = (draft["evidence"] as Array<Record<string, unknown>>)[1] as Record<string, unknown>;
    entry["occurredAt"] = "2026-07-23T20:45:01.000Z"; entry["availableAt"] = "2026-07-23T20:45:01.000Z";
  }), ResearchIntegrityIssueCode.OccurrenceAfterCutoff)],
  ["publication after cutoff blocks", () => expectBlocked(changed((draft) => {
    const entry = (draft["evidence"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
    entry["publishedAt"] = "2026-07-23T20:45:01.000Z"; entry["availableAt"] = "2026-07-23T20:45:01.000Z";
  }), ResearchIntegrityIssueCode.PublicationAfterCutoff)],
  ["availability after cutoff blocks", () => expectBlocked(changed((draft) => {
    ((draft["evidence"] as Array<Record<string, unknown>>)[1] as Record<string, unknown>)["availableAt"] = "2026-07-23T20:45:01.000Z";
  }), ResearchIntegrityIssueCode.EvidenceUnavailableAtCutoff)],
  ["historical replay allows post-cutoff receipt", () => assertEqual(engine.assess(validHistoricalInput()).status, ResearchIntegrityStatus.Eligible, "historical receipt")],
  ["forward receipt after cutoff blocks", () => {
    const input = validForwardInput();
    const evidence = input.evidence.map((entry, index) => index === 0 ? { ...entry, receivedAt: "2026-07-23T20:45:01.000Z" } : entry);
    expectBlocked({ ...input, evidence }, ResearchIntegrityIssueCode.ForwardReceiptAfterCutoff);
  }],
  ["receipt after evaluation blocks", () => expectBlocked(changed((draft) => {
    ((draft["evidence"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["receivedAt"] = "2026-07-24T12:00:01.000Z";
  }), ResearchIntegrityIssueCode.ReceiptAfterEvaluation)],
  ["news without publication time blocks", () => expectBlocked(changed((draft) => {
    ((draft["evidence"] as Array<Record<string, unknown>>)[1] as Record<string, unknown>)["kind"] = ResearchEvidenceKind.News;
  }), ResearchIntegrityIssueCode.MissingPublicationTime)],
  ["source-publication basis requires publication time", () => expectBlocked(changed((draft) => {
    ((draft["evidence"] as Array<Record<string, unknown>>)[1] as Record<string, unknown>)["availabilityBasis"] = ResearchEvidenceAvailabilityBasis.SourcePublication;
  }), ResearchIntegrityIssueCode.InvalidAvailabilityBasis)],
  ["provider-receipt basis binds availability to receipt", () => expectBlocked(changed((draft) => {
    ((draft["evidence"] as Array<Record<string, unknown>>)[1] as Record<string, unknown>)["availabilityBasis"] = ResearchEvidenceAvailabilityBasis.ProviderReceipt;
  }), ResearchIntegrityIssueCode.InvalidAvailabilityBasis)],
  ["exchange-close basis applies only to bars", () => expectBlocked(changed((draft) => {
    ((draft["evidence"] as Array<Record<string, unknown>>)[1] as Record<string, unknown>)["availabilityBasis"] = ResearchEvidenceAvailabilityBasis.ExchangeIntervalClose;
  }), ResearchIntegrityIssueCode.InvalidAvailabilityBasis)],
  ["publication before occurrence blocks", () => expectBlocked(changed((draft) => {
    ((draft["evidence"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["publishedAt"] = "2026-07-23T20:43:59.000Z";
  }), ResearchIntegrityIssueCode.InvalidTemporalOrder)],
  ["availability after receipt blocks", () => expectBlocked(changed((draft) => {
    const entry = (draft["evidence"] as Array<Record<string, unknown>>)[1] as Record<string, unknown>;
    entry["availableAt"] = "2026-07-24T10:00:01.000Z";
  }), ResearchIntegrityIssueCode.InvalidTemporalOrder)],
  ["partial bar blocks", () => expectBlocked(changed((draft) => {
    ((draft["evidence"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["completionStatus"] = ResearchEvidenceCompletionStatus.Partial;
  }), ResearchIntegrityIssueCode.IncompleteInterval)],
  ["bar ending after cutoff blocks", () => expectBlocked(changed((draft) => {
    const entry = (draft["evidence"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
    entry["intervalEndsAt"] = "2026-07-23T20:46:00.000Z"; entry["occurredAt"] = "2026-07-23T20:46:00.000Z";
    entry["publishedAt"] = "2026-07-23T20:46:00.000Z"; entry["availableAt"] = "2026-07-23T20:46:00.000Z";
  }), ResearchIntegrityIssueCode.IntervalEndsAfterCutoff)],
  ["bar without interval blocks", () => expectBlocked(changed((draft) => {
    ((draft["evidence"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["intervalEndsAt"] = null;
  }), ResearchIntegrityIssueCode.InvalidInterval)],
  ["point-in-time evidence with interval blocks", () => expectBlocked(changed((draft) => {
    ((draft["evidence"] as Array<Record<string, unknown>>)[1] as Record<string, unknown>)["intervalStartsAt"] = "2026-07-23T20:44:00.000Z";
  }), ResearchIntegrityIssueCode.InvalidInterval)],
  ["settlement kind always blocks", () => expectBlocked(changed((draft) => {
    const entry = (draft["evidence"] as Array<Record<string, unknown>>)[1] as Record<string, unknown>;
    entry["kind"] = ResearchEvidenceKind.Settlement; entry["publishedAt"] = entry["occurredAt"];
  }), ResearchIntegrityIssueCode.OutcomeLeakage)],
  ["outcome-bearing flag blocks", () => expectBlocked(changed((draft) => {
    ((draft["evidence"] as Array<Record<string, unknown>>)[1] as Record<string, unknown>)["outcomeBearing"] = true;
  }), ResearchIntegrityIssueCode.OutcomeLeakage)],
  ["duplicate evidence ID blocks", () => expectBlocked(changed((draft) => {
    const evidence = draft["evidence"] as Array<Record<string, unknown>>;
    evidence[1] = { ...evidence[1], evidenceId: evidence[0]?.["evidenceId"] };
  }), ResearchIntegrityIssueCode.DuplicateEvidence)],
  ["duplicate dataset member blocks", () => expectBlocked(changed((draft) => {
    const members = (draft["dataset"] as Record<string, unknown>)["evidenceMembers"] as Array<Record<string, unknown>>;
    members[1] = { ...members[0] };
  }), ResearchIntegrityIssueCode.DuplicateEvidence)],
  ["manifest missing evidence blocks", () => expectBlocked(changed((draft) => {
    ((draft["dataset"] as Record<string, unknown>)["evidenceMembers"] as Array<Record<string, unknown>>).pop();
  }), ResearchIntegrityIssueCode.DatasetMembershipMismatch)],
  ["manifest extra evidence blocks", () => expectBlocked(changed((draft) => {
    ((draft["dataset"] as Record<string, unknown>)["evidenceMembers"] as Array<Record<string, unknown>>).push({
      evidenceId: "evidence:extra:001", evidenceFingerprint: "fnv1a64:3333333333333333",
    });
  }), ResearchIntegrityIssueCode.DatasetMembershipMismatch)],
  ["manifest fingerprint mismatch blocks", () => expectBlocked(changed((draft) => {
    (((draft["dataset"] as Record<string, unknown>)["evidenceMembers"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["evidenceFingerprint"] = "fnv1a64:9999999999999999";
  }), ResearchIntegrityIssueCode.DatasetFingerprintMismatch)],
  ["result contains no recommendation probability or sizing", () => {
    const serialized = JSON.stringify(engine.assess(validHistoricalInput()));
    assertTrue(!serialized.includes("\"recommendation\""), "no recommendation");
    assertTrue(!serialized.includes("\"probability\""), "no probability");
    assertTrue(!serialized.includes("\"positionSize\""), "no sizing");
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
  console.log(`Research Integrity tests passed: ${String(passed)}/${String(tests.length)}.`);
}

main();
