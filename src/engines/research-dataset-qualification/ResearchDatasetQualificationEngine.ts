import {
  RESEARCH_DATASET_QUALIFICATION_SCHEMA_VERSION,
  ResearchDatasetAuthorizationStatus,
  ResearchDatasetEventType,
  ResearchDatasetIssueCode,
  ResearchDatasetOutcomeLabel,
  ResearchDatasetQualificationStatus,
  type ResearchDatasetCollectionPlan,
  type ResearchDatasetIssue,
  type ResearchDatasetMetrics,
  type ResearchDatasetPartition,
  type ResearchDatasetQualificationInput,
  type ResearchDatasetQualificationPolicy,
  type ResearchDatasetQualificationResult,
  type ResearchDatasetSample,
  type ResearchDatasetTemporalSplit,
  type ResearchDatasetValidationResult,
} from "../../contracts/ResearchDatasetQualification";
import {
  RESEARCH_INTEGRITY_SCHEMA_VERSION,
  ResearchIntegrityAuthorizationStatus,
  ResearchIntegrityIssueCode,
  ResearchIntegrityMode,
  ResearchIntegrityStatus,
} from "../../contracts/ResearchIntegrity";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const FINGERPRINT = /^(?:fnv1a64:[a-f0-9]{16}|sha256:[a-f0-9]{64})$/u;
const INPUT_KEYS = ["schemaVersion", "qualificationId", "researchId", "createdAt", "collectionPlan", "samples"] as const;
const PLAN_KEYS = ["planId", "planVersion", "frozenAt", "instrumentId", "eventType", "intervalSeconds", "plannedEvents"] as const;
const PLANNED_EVENT_KEYS = ["eventId", "cutoffAt"] as const;
const SAMPLE_KEYS = [
  "sampleId", "eventId", "observationId", "observationFingerprint", "cutoffAt", "outcomeId",
  "outcomeFingerprint", "outcomeKnownAt", "label", "featureSchemaVersion", "featureSetVersion", "integrityAudit",
] as const;
const AUDIT_KEYS = [
  "schemaVersion", "auditId", "researchId", "mode", "cutoffAt", "evaluatedAt", "datasetId",
  "datasetVersion", "datasetFrozenAt", "datasetFingerprint", "evidenceCount", "status", "issues",
  "policyId", "policyVersion", "ruleSetVersion", "authorizationStatus", "deterministic", "readOnly",
  "fingerprint",
] as const;
const INTEGRITY_ISSUE_KEYS = ["code", "field", "evidenceId", "message"] as const;
const POLICY_KEYS = [
  "policyId", "version", "ruleSetVersion", "minimumCompletedSamples", "minimumDistinctUtcDays",
  "minimumCoverageBasisPoints", "minimumUpSamples", "minimumDownSamples",
  "maximumDominantOutcomeBasisPoints", "maximumOutcomeDelaySeconds", "trainBasisPoints",
  "calibrationBasisPoints", "testBasisPoints", "embargoSampleCount", "maximumSamples",
] as const;
const BTC_INSTRUMENT_ID = "instrument:crypto:btc-usd";
const BTC_INTERVAL_SECONDS = 900;

export const DEFAULT_RESEARCH_DATASET_QUALIFICATION_POLICY: ResearchDatasetQualificationPolicy = deepFreeze({
  policyId: "research-dataset-qualification:btc-15-minute:1",
  version: "1.0",
  ruleSetVersion: "1.0",
  minimumCompletedSamples: 1_000,
  minimumDistinctUtcDays: 30,
  minimumCoverageBasisPoints: 9_000,
  minimumUpSamples: 200,
  minimumDownSamples: 200,
  maximumDominantOutcomeBasisPoints: 8_000,
  maximumOutcomeDelaySeconds: 3_600,
  trainBasisPoints: 6_000,
  calibrationBasisPoints: 2_000,
  testBasisPoints: 2_000,
  embargoSampleCount: 4,
  maximumSamples: 100_000,
});

export class ResearchDatasetQualificationValidationError extends Error {
  public constructor(public readonly issues: readonly ResearchDatasetIssue[]) {
    super("Research dataset qualification input validation failed.");
    this.name = "ResearchDatasetQualificationValidationError";
  }
}

export class ResearchDatasetQualificationEngine {
  readonly #policy: ResearchDatasetQualificationPolicy;

  public constructor(policy: Readonly<ResearchDatasetQualificationPolicy> = DEFAULT_RESEARCH_DATASET_QUALIFICATION_POLICY) {
    const validation = validateResearchDatasetQualificationPolicy(policy);
    if (!validation.valid) throw new ResearchDatasetQualificationValidationError(validation.issues);
    this.#policy = deepFreeze(structuredClone(policy));
  }

  public qualify(value: unknown): ResearchDatasetQualificationResult {
    const validation = validateResearchDatasetQualificationInput(value, this.#policy);
    if (!validation.valid) throw new ResearchDatasetQualificationValidationError(validation.issues);
    const input = canonicalInput(value as ResearchDatasetQualificationInput);
    const issues = evaluateQualification(input, this.#policy);
    const metrics = createMetrics(input);
    const splitEvaluation = createTemporalSplit(input.samples, this.#policy);
    issues.push(...splitEvaluation.issues);
    const sortedIssues = deepFreeze(issues.sort(compareIssues));
    const planFingerprint = createResearchCollectionPlanFingerprint(input.collectionPlan);
    const datasetFingerprint = `fnv1a64:${fnv1a64(canonicalize({
      planFingerprint,
      samples: input.samples,
    }))}`;
    const split = sortedIssues.length === 0 ? splitEvaluation.split : null;
    const base = {
      schemaVersion: RESEARCH_DATASET_QUALIFICATION_SCHEMA_VERSION,
      qualificationId: input.qualificationId,
      researchId: input.researchId,
      createdAt: input.createdAt,
      planId: input.collectionPlan.planId,
      planVersion: input.collectionPlan.planVersion,
      planFingerprint,
      datasetFingerprint,
      status: sortedIssues.length === 0 ? ResearchDatasetQualificationStatus.Qualified : ResearchDatasetQualificationStatus.Blocked,
      metrics,
      issues: sortedIssues,
      split,
      policyId: this.#policy.policyId,
      policyVersion: this.#policy.version,
      ruleSetVersion: this.#policy.ruleSetVersion,
      authorizationStatus: ResearchDatasetAuthorizationStatus.ResearchOnly,
      deterministic: true as const,
      readOnly: true as const,
    };
    return deepFreeze({ ...base, fingerprint: `fnv1a64:${fnv1a64(canonicalize(base))}` });
  }
}

export function validateResearchDatasetQualificationInput(
  value: unknown,
  policy: Readonly<ResearchDatasetQualificationPolicy> = DEFAULT_RESEARCH_DATASET_QUALIFICATION_POLICY,
): ResearchDatasetValidationResult {
  const issues: ResearchDatasetIssue[] = [];
  const policyValidation = validateResearchDatasetQualificationPolicy(policy);
  if (!policyValidation.valid) issues.push(...policyValidation.issues);
  if (!isRecord(value)) return result([...issues, issue(ResearchDatasetIssueCode.InvalidRecord, "$", null, "Qualification input must be an object.")]);
  exactKeys(issues, value, INPUT_KEYS, "$");
  if (value.schemaVersion !== RESEARCH_DATASET_QUALIFICATION_SCHEMA_VERSION) add(issues, ResearchDatasetIssueCode.InvalidSchemaVersion, "schemaVersion", null, "Schema version is unsupported.");
  identifier(issues, value.qualificationId, "qualificationId", null);
  identifier(issues, value.researchId, "researchId", null);
  timestamp(issues, value.createdAt, "createdAt", null);
  validatePlanShape(issues, value.collectionPlan, policy);
  validateSamplesShape(issues, value.samples, policy);
  return result(issues);
}

export function validateResearchDatasetQualificationPolicy(value: unknown): ResearchDatasetValidationResult {
  const issues: ResearchDatasetIssue[] = [];
  if (!isRecord(value)) return result([issue(ResearchDatasetIssueCode.InvalidPolicy, "policy", null, "Policy must be an object.")]);
  exactKeys(issues, value, POLICY_KEYS, "policy", ResearchDatasetIssueCode.InvalidPolicy);
  identifier(issues, value.policyId, "policy.policyId", null, ResearchDatasetIssueCode.InvalidPolicy);
  version(issues, value.version, "policy.version", null, ResearchDatasetIssueCode.InvalidPolicy);
  version(issues, value.ruleSetVersion, "policy.ruleSetVersion", null, ResearchDatasetIssueCode.InvalidPolicy);
  const positive = [
    "minimumCompletedSamples", "minimumDistinctUtcDays", "minimumCoverageBasisPoints", "minimumUpSamples",
    "minimumDownSamples", "maximumDominantOutcomeBasisPoints", "maximumOutcomeDelaySeconds",
    "trainBasisPoints", "calibrationBasisPoints", "testBasisPoints", "maximumSamples",
  ] as const;
  for (const field of positive) {
    if (!Number.isSafeInteger(value[field]) || (value[field] as number) <= 0) add(issues, ResearchDatasetIssueCode.InvalidPolicy, `policy.${field}`, null, `${field} must be a positive safe integer.`);
  }
  if (!Number.isSafeInteger(value.embargoSampleCount) || (value.embargoSampleCount as number) < 1) add(issues, ResearchDatasetIssueCode.InvalidPolicy, "policy.embargoSampleCount", null, "Embargo sample count must be a positive safe integer.");
  for (const field of ["minimumCoverageBasisPoints", "maximumDominantOutcomeBasisPoints", "trainBasisPoints", "calibrationBasisPoints", "testBasisPoints"] as const) {
    if (Number.isSafeInteger(value[field]) && ((value[field] as number) < 1 || (value[field] as number) > 10_000)) add(issues, ResearchDatasetIssueCode.InvalidPolicy, `policy.${field}`, null, `${field} must be within 1..10,000.`);
  }
  if (Number.isSafeInteger(value.trainBasisPoints) && Number.isSafeInteger(value.calibrationBasisPoints) && Number.isSafeInteger(value.testBasisPoints)
    && (value.trainBasisPoints as number) + (value.calibrationBasisPoints as number) + (value.testBasisPoints as number) !== 10_000) {
    add(issues, ResearchDatasetIssueCode.InvalidPolicy, "policy.trainBasisPoints", null, "Partition basis points must sum to 10,000.");
  }
  if (Number.isSafeInteger(value.minimumCompletedSamples) && Number.isSafeInteger(value.maximumSamples) && (value.minimumCompletedSamples as number) > (value.maximumSamples as number)) {
    add(issues, ResearchDatasetIssueCode.InvalidPolicy, "policy.minimumCompletedSamples", null, "Minimum samples cannot exceed maximum samples.");
  }
  if (Number.isSafeInteger(value.minimumUpSamples) && Number.isSafeInteger(value.minimumDownSamples) && Number.isSafeInteger(value.minimumCompletedSamples)
    && (value.minimumUpSamples as number) + (value.minimumDownSamples as number) > (value.minimumCompletedSamples as number)) {
    add(issues, ResearchDatasetIssueCode.InvalidPolicy, "policy.minimumUpSamples", null, "Minimum outcome counts cannot exceed the minimum completed sample count.");
  }
  if (Number.isSafeInteger(value.minimumCompletedSamples) && Number.isSafeInteger(value.embargoSampleCount)
    && (value.minimumCompletedSamples as number) <= (value.embargoSampleCount as number) * 2 + 2) {
    add(issues, ResearchDatasetIssueCode.InvalidPolicy, "policy.minimumCompletedSamples", null, "Minimum samples must leave three non-empty partitions after both embargoes.");
  }
  return result(issues);
}

export function createResearchCollectionPlanFingerprint(value: ResearchDatasetCollectionPlan): string {
  return `fnv1a64:${fnv1a64(canonicalize(canonicalPlan(value)))}`;
}

function validatePlanShape(issues: ResearchDatasetIssue[], value: unknown, policy: Readonly<ResearchDatasetQualificationPolicy>): void {
  if (!isRecord(value)) {
    add(issues, ResearchDatasetIssueCode.InvalidRecord, "collectionPlan", null, "Collection plan must be an object.");
    return;
  }
  exactKeys(issues, value, PLAN_KEYS, "collectionPlan");
  identifier(issues, value.planId, "collectionPlan.planId", null);
  version(issues, value.planVersion, "collectionPlan.planVersion", null);
  timestamp(issues, value.frozenAt, "collectionPlan.frozenAt", null);
  if (value.instrumentId !== BTC_INSTRUMENT_ID) add(issues, ResearchDatasetIssueCode.InvalidPlan, "collectionPlan.instrumentId", null, "Instrument must be canonical BTC-USD.");
  if (value.eventType !== ResearchDatasetEventType.BtcFifteenMinute) add(issues, ResearchDatasetIssueCode.InvalidPlan, "collectionPlan.eventType", null, "Event type must be BTC 15-minute.");
  if (value.intervalSeconds !== BTC_INTERVAL_SECONDS) add(issues, ResearchDatasetIssueCode.InvalidPlan, "collectionPlan.intervalSeconds", null, "Interval must be exactly 900 seconds.");
  if (!Array.isArray(value.plannedEvents) || value.plannedEvents.length === 0 || value.plannedEvents.length > policy.maximumSamples) {
    add(issues, ResearchDatasetIssueCode.InvalidPlan, "collectionPlan.plannedEvents", null, "Planned events must be a non-empty array within policy.");
    return;
  }
  value.plannedEvents.forEach((entry, index) => {
    const field = `collectionPlan.plannedEvents.${String(index)}`;
    if (!isRecord(entry)) {
      add(issues, ResearchDatasetIssueCode.InvalidRecord, field, null, "Planned event must be an object.");
      return;
    }
    exactKeys(issues, entry, PLANNED_EVENT_KEYS, field);
    identifier(issues, entry.eventId, `${field}.eventId`, null);
    timestamp(issues, entry.cutoffAt, `${field}.cutoffAt`, null);
  });
}

function validateSamplesShape(issues: ResearchDatasetIssue[], value: unknown, policy: Readonly<ResearchDatasetQualificationPolicy>): void {
  if (!Array.isArray(value) || value.length === 0 || value.length > policy.maximumSamples) {
    add(issues, ResearchDatasetIssueCode.InvalidRecord, "samples", null, "Samples must be a non-empty array within policy.");
    return;
  }
  value.forEach((entry, index) => {
    const field = `samples.${String(index)}`;
    if (!isRecord(entry)) {
      add(issues, ResearchDatasetIssueCode.InvalidRecord, field, null, "Sample must be an object.");
      return;
    }
    const sampleId = typeof entry.sampleId === "string" ? entry.sampleId : null;
    exactKeys(issues, entry, SAMPLE_KEYS, field);
    for (const key of ["sampleId", "eventId", "observationId", "outcomeId"] as const) identifier(issues, entry[key], `${field}.${key}`, sampleId);
    fingerprint(issues, entry.observationFingerprint, `${field}.observationFingerprint`, sampleId);
    timestamp(issues, entry.cutoffAt, `${field}.cutoffAt`, sampleId);
    fingerprint(issues, entry.outcomeFingerprint, `${field}.outcomeFingerprint`, sampleId);
    timestamp(issues, entry.outcomeKnownAt, `${field}.outcomeKnownAt`, sampleId);
    enumValue(issues, ResearchDatasetOutcomeLabel, entry.label, `${field}.label`, sampleId);
    version(issues, entry.featureSchemaVersion, `${field}.featureSchemaVersion`, sampleId);
    version(issues, entry.featureSetVersion, `${field}.featureSetVersion`, sampleId);
    validateAuditShape(issues, entry.integrityAudit, `${field}.integrityAudit`, sampleId);
  });
}

function validateAuditShape(issues: ResearchDatasetIssue[], value: unknown, field: string, sampleId: string | null): void {
  if (!isRecord(value)) {
    add(issues, ResearchDatasetIssueCode.InvalidRecord, field, sampleId, "Integrity audit reference must be an object.");
    return;
  }
  exactKeys(issues, value, AUDIT_KEYS, field);
  if (value.schemaVersion !== RESEARCH_INTEGRITY_SCHEMA_VERSION) add(issues, ResearchDatasetIssueCode.InvalidSchemaVersion, `${field}.schemaVersion`, sampleId, "Integrity audit schema version is unsupported.");
  identifier(issues, value.auditId, `${field}.auditId`, sampleId);
  identifier(issues, value.researchId, `${field}.researchId`, sampleId);
  enumValue(issues, ResearchIntegrityMode, value.mode, `${field}.mode`, sampleId);
  timestamp(issues, value.evaluatedAt, `${field}.evaluatedAt`, sampleId);
  identifier(issues, value.datasetId, `${field}.datasetId`, sampleId);
  version(issues, value.datasetVersion, `${field}.datasetVersion`, sampleId);
  timestamp(issues, value.datasetFrozenAt, `${field}.datasetFrozenAt`, sampleId);
  fingerprint(issues, value.datasetFingerprint, `${field}.datasetFingerprint`, sampleId);
  timestamp(issues, value.cutoffAt, `${field}.cutoffAt`, sampleId);
  if (!Number.isSafeInteger(value.evidenceCount) || (value.evidenceCount as number) < 1) add(issues, ResearchDatasetIssueCode.InvalidRecord, `${field}.evidenceCount`, sampleId, "Integrity audit evidence count must be a positive safe integer.");
  enumValue(issues, ResearchIntegrityStatus, value.status, `${field}.status`, sampleId);
  if (!Array.isArray(value.issues)) add(issues, ResearchDatasetIssueCode.InvalidRecord, `${field}.issues`, sampleId, "Integrity audit issues must be an array.");
  else value.issues.forEach((entry, index) => {
    const issueField = `${field}.issues.${String(index)}`;
    if (!isRecord(entry)) {
      add(issues, ResearchDatasetIssueCode.InvalidRecord, issueField, sampleId, "Integrity audit issue must be an object.");
      return;
    }
    exactKeys(issues, entry, INTEGRITY_ISSUE_KEYS, issueField);
    enumValue(issues, ResearchIntegrityIssueCode, entry.code, `${issueField}.code`, sampleId);
    if (typeof entry.field !== "string" || entry.field.length < 1 || entry.field.length > 256) add(issues, ResearchDatasetIssueCode.InvalidRecord, `${issueField}.field`, sampleId, "Integrity issue field is invalid.");
    if (entry.evidenceId !== null) identifier(issues, entry.evidenceId, `${issueField}.evidenceId`, sampleId);
    if (typeof entry.message !== "string" || entry.message.length < 1 || entry.message.length > 512) add(issues, ResearchDatasetIssueCode.InvalidRecord, `${issueField}.message`, sampleId, "Integrity issue message is invalid.");
  });
  enumValue(issues, ResearchIntegrityAuthorizationStatus, value.authorizationStatus, `${field}.authorizationStatus`, sampleId);
  identifier(issues, value.policyId, `${field}.policyId`, sampleId);
  version(issues, value.policyVersion, `${field}.policyVersion`, sampleId);
  version(issues, value.ruleSetVersion, `${field}.ruleSetVersion`, sampleId);
  if (value.deterministic !== true) add(issues, ResearchDatasetIssueCode.InvalidRecord, `${field}.deterministic`, sampleId, "Integrity audit must be deterministic.");
  if (value.readOnly !== true) add(issues, ResearchDatasetIssueCode.InvalidRecord, `${field}.readOnly`, sampleId, "Integrity audit must be read-only.");
  fingerprint(issues, value.fingerprint, `${field}.fingerprint`, sampleId);
}

function evaluateQualification(input: ResearchDatasetQualificationInput, policy: Readonly<ResearchDatasetQualificationPolicy>): ResearchDatasetIssue[] {
  const issues: ResearchDatasetIssue[] = [];
  const plan = input.collectionPlan;
  const plannedById = new Map<string, string>();
  for (let index = 0; index < plan.plannedEvents.length; index += 1) {
    const entry = plan.plannedEvents[index]!;
    if (plannedById.has(entry.eventId)) add(issues, ResearchDatasetIssueCode.DuplicateIdentity, "collectionPlan.plannedEvents", null, "Planned event IDs must be unique.");
    plannedById.set(entry.eventId, entry.cutoffAt);
    if (index > 0) {
      const previous = plan.plannedEvents[index - 1]!;
      if (Date.parse(entry.cutoffAt) - Date.parse(previous.cutoffAt) !== plan.intervalSeconds * 1_000) {
        add(issues, ResearchDatasetIssueCode.InvalidPlan, `collectionPlan.plannedEvents.${String(index)}.cutoffAt`, null, "Planned events must be one continuous chronological 15-minute sequence.");
      }
    }
  }
  if (Date.parse(plan.frozenAt) >= Date.parse(plan.plannedEvents[0]!.cutoffAt)) add(issues, ResearchDatasetIssueCode.PlanFrozenTooLate, "collectionPlan.frozenAt", null, "Collection plan must be frozen strictly before its first event cutoff.");
  if (Date.parse(input.createdAt) < Date.parse(plan.frozenAt)) add(issues, ResearchDatasetIssueCode.InvalidPlan, "createdAt", null, "Qualification cannot predate the collection-plan freeze.");

  const identities = {
    sample: new Set<string>(), event: new Set<string>(), observation: new Set<string>(),
    outcome: new Set<string>(), audit: new Set<string>(),
  };
  const schemaVersions = new Set<string>();
  const featureVersions = new Set<string>();
  const integrityPolicyVersions = new Set<string>();
  for (const sample of input.samples) {
    unique(issues, identities.sample, sample.sampleId, "samples.sampleId", sample.sampleId);
    unique(issues, identities.event, sample.eventId, "samples.eventId", sample.sampleId);
    unique(issues, identities.observation, sample.observationId, "samples.observationId", sample.sampleId);
    unique(issues, identities.outcome, sample.outcomeId, "samples.outcomeId", sample.sampleId);
    unique(issues, identities.audit, sample.integrityAudit.auditId, "samples.integrityAudit.auditId", sample.sampleId);
    schemaVersions.add(sample.featureSchemaVersion);
    featureVersions.add(sample.featureSetVersion);
    integrityPolicyVersions.add(`${sample.integrityAudit.policyId}|${sample.integrityAudit.policyVersion}|${sample.integrityAudit.ruleSetVersion}`);
    const plannedCutoff = plannedById.get(sample.eventId);
    if (plannedCutoff === undefined) add(issues, ResearchDatasetIssueCode.UnplannedEvent, "samples.eventId", sample.sampleId, "Sample event is absent from the frozen collection plan.");
    else if (plannedCutoff !== sample.cutoffAt) add(issues, ResearchDatasetIssueCode.EventCutoffMismatch, "samples.cutoffAt", sample.sampleId, "Sample cutoff does not match the frozen planned event.");
    const cutoff = Date.parse(sample.cutoffAt);
    const outcomeKnown = Date.parse(sample.outcomeKnownAt);
    if (outcomeKnown <= cutoff || outcomeKnown > Date.parse(input.createdAt)) add(issues, ResearchDatasetIssueCode.InvalidOutcomeChronology, "samples.outcomeKnownAt", sample.sampleId, "Outcome must become known after cutoff and no later than qualification creation.");
    if (outcomeKnown - cutoff > policy.maximumOutcomeDelaySeconds * 1_000) add(issues, ResearchDatasetIssueCode.OutcomeDelayExceeded, "samples.outcomeKnownAt", sample.sampleId, "Outcome-known delay exceeds policy.");
    if (sample.integrityAudit.status !== ResearchIntegrityStatus.Eligible) add(issues, ResearchDatasetIssueCode.IntegrityAuditBlocked, "samples.integrityAudit.status", sample.sampleId, "Every sample requires an ELIGIBLE Research Integrity audit.");
    const { fingerprint: suppliedAuditFingerprint, ...auditBase } = sample.integrityAudit;
    const expectedAuditFingerprint = `fnv1a64:${fnv1a64(canonicalize(auditBase))}`;
    if (suppliedAuditFingerprint !== expectedAuditFingerprint
      || sample.integrityAudit.researchId !== input.researchId
      || Date.parse(sample.integrityAudit.evaluatedAt) > Date.parse(input.createdAt)) {
      add(issues, ResearchDatasetIssueCode.IntegrityAuditMismatch, "samples.integrityAudit", sample.sampleId, "Integrity audit fingerprint, research identity, and evaluation time must form one exact prior proof.");
    }
    if (sample.integrityAudit.authorizationStatus !== ResearchIntegrityAuthorizationStatus.ResearchOnly
      || sample.integrityAudit.cutoffAt !== sample.cutoffAt
      || sample.integrityAudit.issues.length !== 0) {
      add(issues, ResearchDatasetIssueCode.IntegrityAuditMismatch, "samples.integrityAudit", sample.sampleId, "Integrity audit authority and cutoff must match the sample.");
    }
  }
  if (schemaVersions.size !== 1 || featureVersions.size !== 1) add(issues, ResearchDatasetIssueCode.FeatureVersionMismatch, "samples", null, "All samples must use one feature schema and feature-set version.");
  if (integrityPolicyVersions.size !== 1) add(issues, ResearchDatasetIssueCode.IntegrityPolicyMismatch, "samples.integrityAudit", null, "All samples must use one Research Integrity policy and rule-set version.");

  const metrics = createMetrics(input);
  if (metrics.completedCount < policy.minimumCompletedSamples) add(issues, ResearchDatasetIssueCode.InsufficientSamples, "samples", null, "Completed sample count is below policy minimum.");
  if (metrics.distinctUtcDays < policy.minimumDistinctUtcDays) add(issues, ResearchDatasetIssueCode.InsufficientDateCoverage, "samples.cutoffAt", null, "Distinct UTC cutoff dates are below policy minimum.");
  if (metrics.coverageBasisPoints < policy.minimumCoverageBasisPoints) add(issues, ResearchDatasetIssueCode.InsufficientPlanCoverage, "samples", null, "Frozen-plan coverage is below policy minimum.");
  if (metrics.upCount < policy.minimumUpSamples || metrics.downCount < policy.minimumDownSamples) add(issues, ResearchDatasetIssueCode.InsufficientOutcomeCoverage, "samples.label", null, "UP or DOWN sample count is below policy minimum.");
  if (metrics.dominantOutcomeBasisPoints > policy.maximumDominantOutcomeBasisPoints) add(issues, ResearchDatasetIssueCode.OutcomeImbalance, "samples.label", null, "Dominant outcome share exceeds policy maximum.");
  return issues;
}

function createMetrics(input: ResearchDatasetQualificationInput): ResearchDatasetMetrics {
  const sorted = [...input.samples].sort(compareSamples);
  const completed = sorted.length;
  const planned = input.collectionPlan.plannedEvents.length;
  const upCount = sorted.filter((entry) => entry.label === ResearchDatasetOutcomeLabel.Up).length;
  const downCount = completed - upCount;
  const schemaVersions = [...new Set(sorted.map((entry) => entry.featureSchemaVersion))];
  const featureVersions = [...new Set(sorted.map((entry) => entry.featureSetVersion))];
  return deepFreeze({
    plannedCount: planned,
    completedCount: completed,
    missingCount: Math.max(0, planned - new Set(sorted.map((entry) => entry.eventId)).size),
    coverageBasisPoints: planned === 0 ? 0 : Math.floor((new Set(sorted.map((entry) => entry.eventId)).size * 10_000) / planned),
    distinctUtcDays: new Set(sorted.map((entry) => entry.cutoffAt.slice(0, 10))).size,
    upCount,
    downCount,
    dominantOutcomeBasisPoints: completed === 0 ? 0 : Math.ceil((Math.max(upCount, downCount) * 10_000) / completed),
    firstCutoffAt: sorted[0]?.cutoffAt ?? null,
    lastCutoffAt: sorted.at(-1)?.cutoffAt ?? null,
    featureSchemaVersion: schemaVersions.length === 1 ? schemaVersions[0]! : null,
    featureSetVersion: featureVersions.length === 1 ? featureVersions[0]! : null,
  });
}

function createTemporalSplit(
  samples: readonly ResearchDatasetSample[],
  policy: Readonly<ResearchDatasetQualificationPolicy>,
): { readonly split: ResearchDatasetTemporalSplit | null; readonly issues: readonly ResearchDatasetIssue[] } {
  const issues: ResearchDatasetIssue[] = [];
  const sorted = [...samples].sort(compareSamples);
  const usableCount = sorted.length - policy.embargoSampleCount * 2;
  const trainCount = Math.floor((usableCount * policy.trainBasisPoints) / 10_000);
  const calibrationCount = Math.floor((usableCount * policy.calibrationBasisPoints) / 10_000);
  const testCount = usableCount - trainCount - calibrationCount;
  if (usableCount < 3 || trainCount < 1 || calibrationCount < 1 || testCount < 1) {
    add(issues, ResearchDatasetIssueCode.InsufficientPartitionSize, "samples", null, "Samples cannot form three non-empty partitions after embargo.");
    return { split: null, issues };
  }
  const firstEmbargoStart = trainCount;
  const calibrationStart = firstEmbargoStart + policy.embargoSampleCount;
  const secondEmbargoStart = calibrationStart + calibrationCount;
  const testStart = secondEmbargoStart + policy.embargoSampleCount;
  const trainSamples = sorted.slice(0, trainCount);
  const firstEmbargo = sorted.slice(firstEmbargoStart, calibrationStart);
  const calibrationSamples = sorted.slice(calibrationStart, secondEmbargoStart);
  const secondEmbargo = sorted.slice(secondEmbargoStart, testStart);
  const testSamples = sorted.slice(testStart);
  if (latestOutcome(trainSamples) > Date.parse(calibrationSamples[0]!.cutoffAt)) add(issues, ResearchDatasetIssueCode.PartitionLabelOverlap, "split.calibration", null, "Training labels cross the calibration feature boundary.");
  if (latestOutcome(calibrationSamples) > Date.parse(testSamples[0]!.cutoffAt)) add(issues, ResearchDatasetIssueCode.PartitionLabelOverlap, "split.test", null, "Calibration labels cross the final-test feature boundary.");
  const base = {
    train: partition("TRAIN", trainSamples),
    calibration: partition("CALIBRATION", calibrationSamples),
    test: partition("TEST", testSamples),
    embargoedSampleIds: [...firstEmbargo, ...secondEmbargo].map((entry) => entry.sampleId),
  };
  const split = deepFreeze({ ...base, fingerprint: `fnv1a64:${fnv1a64(canonicalize(base))}` });
  return { split, issues };
}

function partition(name: ResearchDatasetPartition["name"], samples: readonly ResearchDatasetSample[]): ResearchDatasetPartition {
  return deepFreeze({
    name,
    sampleIds: samples.map((entry) => entry.sampleId),
    count: samples.length,
    startsAt: samples[0]!.cutoffAt,
    endsAt: samples.at(-1)!.cutoffAt,
  });
}
function latestOutcome(samples: readonly ResearchDatasetSample[]): number {
  return Math.max(...samples.map((entry) => Date.parse(entry.outcomeKnownAt)));
}
function unique(issues: ResearchDatasetIssue[], seen: Set<string>, value: string, field: string, sampleId: string): void {
  if (seen.has(value)) add(issues, ResearchDatasetIssueCode.DuplicateIdentity, field, sampleId, "Identity must be unique within the dataset.");
  seen.add(value);
}

function canonicalInput(value: ResearchDatasetQualificationInput): ResearchDatasetQualificationInput {
  return {
    schemaVersion: RESEARCH_DATASET_QUALIFICATION_SCHEMA_VERSION,
    qualificationId: value.qualificationId,
    researchId: value.researchId,
    createdAt: value.createdAt,
    collectionPlan: canonicalPlan(value.collectionPlan),
    samples: value.samples.map(canonicalSample).sort(compareSamples),
  };
}
function canonicalPlan(value: ResearchDatasetCollectionPlan): ResearchDatasetCollectionPlan {
  return {
    planId: value.planId,
    planVersion: value.planVersion,
    frozenAt: value.frozenAt,
    instrumentId: BTC_INSTRUMENT_ID,
    eventType: ResearchDatasetEventType.BtcFifteenMinute,
    intervalSeconds: BTC_INTERVAL_SECONDS,
    plannedEvents: value.plannedEvents.map((entry) => ({ eventId: entry.eventId, cutoffAt: entry.cutoffAt })),
  };
}
function canonicalSample(value: ResearchDatasetSample): ResearchDatasetSample {
  return {
    sampleId: value.sampleId, eventId: value.eventId, observationId: value.observationId,
    observationFingerprint: value.observationFingerprint, cutoffAt: value.cutoffAt, outcomeId: value.outcomeId,
    outcomeFingerprint: value.outcomeFingerprint, outcomeKnownAt: value.outcomeKnownAt, label: value.label,
    featureSchemaVersion: value.featureSchemaVersion, featureSetVersion: value.featureSetVersion,
    integrityAudit: {
      schemaVersion: value.integrityAudit.schemaVersion, auditId: value.integrityAudit.auditId,
      researchId: value.integrityAudit.researchId, mode: value.integrityAudit.mode,
      cutoffAt: value.integrityAudit.cutoffAt, evaluatedAt: value.integrityAudit.evaluatedAt,
      datasetId: value.integrityAudit.datasetId, datasetVersion: value.integrityAudit.datasetVersion,
      datasetFrozenAt: value.integrityAudit.datasetFrozenAt,
      datasetFingerprint: value.integrityAudit.datasetFingerprint,
      evidenceCount: value.integrityAudit.evidenceCount, status: value.integrityAudit.status,
      issues: value.integrityAudit.issues.map((entry) => ({ ...entry })),
      policyId: value.integrityAudit.policyId, policyVersion: value.integrityAudit.policyVersion,
      ruleSetVersion: value.integrityAudit.ruleSetVersion,
      authorizationStatus: value.integrityAudit.authorizationStatus,
      deterministic: true, readOnly: true, fingerprint: value.integrityAudit.fingerprint,
    },
  };
}
function compareSamples(left: ResearchDatasetSample, right: ResearchDatasetSample): number {
  return left.cutoffAt.localeCompare(right.cutoffAt) || left.eventId.localeCompare(right.eventId) || left.sampleId.localeCompare(right.sampleId);
}

function exactKeys(issues: ResearchDatasetIssue[], value: Record<string, unknown>, expected: readonly string[], field: string, code = ResearchDatasetIssueCode.InvalidRecord): void {
  const expectedSet = new Set(expected);
  for (const key of Object.keys(value)) if (!expectedSet.has(key)) add(issues, code, `${field}.${key}`, null, "Undeclared field is forbidden.");
  for (const key of expected) if (!Object.prototype.hasOwnProperty.call(value, key)) add(issues, code, `${field}.${key}`, null, "Required field is missing.");
}
function identifier(issues: ResearchDatasetIssue[], value: unknown, field: string, sampleId: string | null, code = ResearchDatasetIssueCode.InvalidIdentifier): void {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) add(issues, code, field, sampleId, "Identifier is invalid.");
}
function version(issues: ResearchDatasetIssue[], value: unknown, field: string, sampleId: string | null, code = ResearchDatasetIssueCode.InvalidVersion): void {
  if (typeof value !== "string" || !VERSION.test(value)) add(issues, code, field, sampleId, "Version is invalid.");
}
function fingerprint(issues: ResearchDatasetIssue[], value: unknown, field: string, sampleId: string | null): void {
  if (typeof value !== "string" || !FINGERPRINT.test(value)) add(issues, ResearchDatasetIssueCode.InvalidFingerprint, field, sampleId, "Fingerprint is invalid.");
}
function timestamp(issues: ResearchDatasetIssue[], value: unknown, field: string, sampleId: string | null): void {
  if (!isTimestamp(value)) add(issues, ResearchDatasetIssueCode.InvalidTimestamp, field, sampleId, "Timestamp must be canonical UTC with millisecond precision.");
}
function enumValue(issues: ResearchDatasetIssue[], values: object, value: unknown, field: string, sampleId: string | null): void {
  if (!Object.values(values).includes(value)) add(issues, ResearchDatasetIssueCode.InvalidEnum, field, sampleId, "Enum value is unsupported.");
}
function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}
function add(issues: ResearchDatasetIssue[], code: ResearchDatasetIssueCode, field: string, sampleId: string | null, message: string): void {
  issues.push(issue(code, field, sampleId, message));
}
function issue(code: ResearchDatasetIssueCode, field: string, sampleId: string | null, message: string): ResearchDatasetIssue {
  return { code, field, sampleId, message };
}
function compareIssues(left: ResearchDatasetIssue, right: ResearchDatasetIssue): number {
  return left.code.localeCompare(right.code) || (left.sampleId ?? "").localeCompare(right.sampleId ?? "") || left.field.localeCompare(right.field) || left.message.localeCompare(right.message);
}
function result(issues: ResearchDatasetIssue[]): ResearchDatasetValidationResult {
  const sorted = deepFreeze(issues.sort(compareIssues));
  return deepFreeze({ valid: sorted.length === 0, issues: sorted });
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
