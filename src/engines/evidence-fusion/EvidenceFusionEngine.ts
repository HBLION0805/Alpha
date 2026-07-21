import {
  BROAD_MARKET_EVIDENCE_SCHEMA_VERSION,
  BroadMarketEvidenceIssueCode,
  BroadMarketEvidenceQuality,
  BroadMarketEvidenceStrength,
  type BroadMarketEvidenceAssessment,
} from "../../contracts/BroadMarketEvidence";
import {
  EVIDENCE_FUSION_SCHEMA_VERSION,
  EvidenceFusionAssessmentStatus,
  EvidenceFusionCompleteness,
  EvidenceFusionFreshness,
  EvidenceFusionIssueCode,
  EvidenceFusionIssueSeverity,
  EvidenceFusionQuality,
  EvidenceFusionSourceState,
  EvidenceFusionSourceType,
  type EvidenceFusionAssessment,
  type EvidenceFusionAssessmentRequest,
  type EvidenceFusionContradiction,
  type EvidenceFusionInput,
  type EvidenceFusionIssue,
  type EvidenceFusionPolicy,
  type EvidenceFusionProvenance,
  type EvidenceFusionSnapshot,
  type EvidenceFusionSourceIssue,
  type EvidenceFusionValidationResult,
} from "../../contracts/EvidenceFusion";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const FINGERPRINT = /^fnv1a64:[a-f0-9]{16}$/u;

export class EvidenceFusionValidationError extends Error {
  public constructor(public readonly issues: readonly EvidenceFusionIssue[]) {
    super("Evidence fusion validation failed.");
    this.name = "EvidenceFusionValidationError";
  }
}

/** Maps one authoritative Broad Market Evidence assessment into the provider-neutral fusion input boundary. */
export function evidenceFusionInputFromBroadMarketEvidence(value: unknown): EvidenceFusionInput {
  const source = validateBroadMarketAssessment(value);
  return createEvidenceFusionInput({
    schemaVersion: EVIDENCE_FUSION_SCHEMA_VERSION,
    inputId: `fusion-input:${source.assessmentId}`,
    sourceType: EvidenceFusionSourceType.BroadMarketEvidence,
    sourceState: mapBroadMarketState(source.quality),
    evidenceReferences: source.evidenceReferences,
    sourceIssues: source.issues.map((entry) => ({ code: entry.code, field: entry.field, message: entry.message })),
    sourceWarnings: source.warnings.map((entry) => ({ code: entry.code, field: entry.field, message: entry.message })),
    provenance: {
      sourceType: EvidenceFusionSourceType.BroadMarketEvidence,
      sourceAssessmentId: source.assessmentId,
      sourceSchemaVersion: source.schemaVersion,
      sourceSnapshotId: source.inputSnapshotId,
      sourceSnapshotFingerprint: source.inputSnapshotFingerprint,
      sourcePolicyId: source.policyId,
      sourcePolicyVersion: source.policyVersion,
      sourceRuleSetVersion: source.ruleSetVersion,
      sourceFeatureVersion: source.featureCalculationVersion,
      sourceAssessedAt: source.assessedAt,
      sourceCreatedAt: source.createdAt,
      sourceAuditReferenceIds: source.trace.auditReferenceIds,
    },
  });
}

export function createEvidenceFusionInput(value: unknown): EvidenceFusionInput {
  const validation = validateEvidenceFusionInput(value);
  if (!validation.valid) throw new EvidenceFusionValidationError(validation.issues);
  return canonicalInput(value as EvidenceFusionInput);
}

export function validateEvidenceFusionInput(value: unknown): EvidenceFusionValidationResult {
  return frozenValidation(validateInput(value));
}

export function validateEvidenceFusionPolicy(value: unknown): EvidenceFusionValidationResult {
  const issues: EvidenceFusionIssue[] = [];
  if (!isRecord(value)) return frozenValidation([blocker(EvidenceFusionIssueCode.InvalidRecord, "Policy must be an object.")]);
  if (!validIdentifier(value.policyId)) issues.push(blocker(EvidenceFusionIssueCode.InvalidPolicy, "Policy ID is invalid."));
  if (!validVersion(value.version)) issues.push(blocker(EvidenceFusionIssueCode.InvalidPolicy, "Policy version is invalid."));
  if (!validVersion(value.ruleSetVersion)) issues.push(blocker(EvidenceFusionIssueCode.InvalidPolicy, "Rule-set version is invalid."));
  if (!Array.isArray(value.sourcePolicies) || value.sourcePolicies.length === 0) {
    issues.push(blocker(EvidenceFusionIssueCode.InvalidPolicy, "At least one explicit source policy is required."));
  } else {
    const seen = new Set<string>();
    value.sourcePolicies.forEach((source, index) => {
      if (!isRecord(source)) { issues.push(blocker(EvidenceFusionIssueCode.InvalidPolicy, `Source policy ${String(index)} must be an object.`)); return; }
      if (source.sourceType !== EvidenceFusionSourceType.BroadMarketEvidence) issues.push(blocker(EvidenceFusionIssueCode.UnsupportedSource, "Only Broad Market Evidence is supported by the foundation."));
      if (typeof source.sourceType === "string" && seen.has(source.sourceType)) issues.push(blocker(EvidenceFusionIssueCode.InvalidPolicy, "Source policy types must be unique."));
      if (typeof source.sourceType === "string") seen.add(source.sourceType);
      if (source.required !== true) issues.push(blocker(EvidenceFusionIssueCode.InvalidPolicy, "The foundation source must be explicitly required."));
      if (source.acceptedSchemaVersion !== BROAD_MARKET_EVIDENCE_SCHEMA_VERSION) issues.push(blocker(EvidenceFusionIssueCode.InvalidPolicy, "Accepted Broad Market Evidence schema version is unsupported."));
      if (source.requiredState !== EvidenceFusionSourceState.Complete) issues.push(blocker(EvidenceFusionIssueCode.InvalidPolicy, "Required source state must be COMPLETE."));
      if (!positiveSafeInteger(source.maximumAgeSeconds)) issues.push(blocker(EvidenceFusionIssueCode.InvalidPolicy, "Maximum source age must be a positive safe integer."));
      if (!positiveSafeInteger(source.minimumEvidenceReferences)) issues.push(blocker(EvidenceFusionIssueCode.InvalidPolicy, "Minimum evidence references must be a positive safe integer."));
    });
    if (!seen.has(EvidenceFusionSourceType.BroadMarketEvidence)) issues.push(blocker(EvidenceFusionIssueCode.InvalidPolicy, "Broad Market Evidence policy is required."));
  }
  return frozenValidation(issues);
}

export class EvidenceFusionEngine {
  public assess(value: unknown): EvidenceFusionAssessment {
    const request = validateAssessmentRequest(value);
    const inputs = [...request.inputs].sort((left, right) => `${left.sourceType}|${left.inputId}`.localeCompare(`${right.sourceType}|${right.inputId}`));
    const bySource = new Map(inputs.map((input) => [input.sourceType, input]));
    const blockers: EvidenceFusionIssue[] = [];
    const warnings: EvidenceFusionIssue[] = [];
    const contradictions: EvidenceFusionContradiction[] = [];
    const provenance: EvidenceFusionProvenance[] = [];
    const evidenceReferences: string[] = [];
    let missingRequired = false;
    let incomplete = false;
    let stale = false;
    let freshnessUnknown = false;

    for (const sourcePolicy of [...request.policy.sourcePolicies].sort((a, b) => a.sourceType.localeCompare(b.sourceType))) {
      const input = bySource.get(sourcePolicy.sourceType);
      if (input === undefined) {
        missingRequired = true;
        freshnessUnknown = true;
        blockers.push(blocker(EvidenceFusionIssueCode.MissingRequiredSource, `Required ${sourcePolicy.sourceType} input is missing.`, sourcePolicy.sourceType));
        continue;
      }
      provenance.push(structuredClone(input.provenance));
      evidenceReferences.push(...input.evidenceReferences);
      warnings.push(...input.sourceWarnings.map((entry) => warningFromSource(input, entry)));

      const ageSeconds = Math.floor((Date.parse(request.evaluatedAt) - Date.parse(input.provenance.sourceAssessedAt)) / 1_000);
      if (ageSeconds < 0) {
        freshnessUnknown = true;
        blockers.push(blocker(EvidenceFusionIssueCode.SourceFutureDated, "Source assessment is future-dated relative to fusion evaluation.", input.sourceType, input.inputId));
      } else if (ageSeconds > sourcePolicy.maximumAgeSeconds || input.sourceState === EvidenceFusionSourceState.Stale) {
        stale = true;
        blockers.push(blocker(EvidenceFusionIssueCode.SourceStale, "Source evidence exceeds the explicit freshness policy or is already classified stale.", input.sourceType, input.inputId));
      }

      if (input.provenance.sourceSchemaVersion !== sourcePolicy.acceptedSchemaVersion) {
        incomplete = true;
        blockers.push(blocker(EvidenceFusionIssueCode.SourceRejected, "Source schema version is not accepted by policy.", input.sourceType, input.inputId));
      }
      if (input.evidenceReferences.length < sourcePolicy.minimumEvidenceReferences) {
        incomplete = true;
        blockers.push(blocker(EvidenceFusionIssueCode.EvidenceReferencesInsufficient, "Source does not meet the explicit evidence-reference requirement.", input.sourceType, input.inputId));
      }
      if (input.sourceState === EvidenceFusionSourceState.Partial || input.sourceState === EvidenceFusionSourceState.Insufficient) {
        incomplete = true;
        blockers.push(blocker(EvidenceFusionIssueCode.SourceIncomplete, `Source state ${input.sourceState} is not complete.`, input.sourceType, input.inputId));
      } else if (input.sourceState === EvidenceFusionSourceState.Contradictory) {
        const sourceContradictions = input.sourceIssues.length > 0 ? input.sourceIssues : [{ code: EvidenceFusionIssueCode.SourceContradictory, field: "sourceState", message: "Source evidence is contradictory." }];
        contradictions.push(...sourceContradictions.map((entry) => ({ sourceType: input.sourceType, inputId: input.inputId, sourceCode: entry.code, message: entry.message })));
        blockers.push(blocker(EvidenceFusionIssueCode.SourceContradictory, "Source evidence contains unresolved contradictions.", input.sourceType, input.inputId));
      }
      if (input.sourceState !== EvidenceFusionSourceState.Complete) {
        blockers.push(...input.sourceIssues.map((entry) => blocker(EvidenceFusionIssueCode.SourceRejected, entry.message, input.sourceType, input.inputId, entry.code)));
      }
    }

    const sortedBlockers = sortIssues(uniqueIssues(blockers));
    const sortedWarnings = sortIssues(uniqueIssues(warnings));
    const sortedContradictions = contradictions.map((entry) => ({ ...entry })).sort((a, b) => `${a.sourceType}|${a.inputId}|${a.sourceCode}|${a.message}`.localeCompare(`${b.sourceType}|${b.inputId}|${b.sourceCode}|${b.message}`));
    const completeness = missingRequired ? EvidenceFusionCompleteness.MissingRequired : incomplete ? EvidenceFusionCompleteness.Incomplete : EvidenceFusionCompleteness.Complete;
    const freshness = freshnessUnknown ? EvidenceFusionFreshness.Unknown : stale ? EvidenceFusionFreshness.Stale : EvidenceFusionFreshness.Current;
    const quality = sortedContradictions.length > 0 ? EvidenceFusionQuality.Contradictory : sortedBlockers.length > 0 ? EvidenceFusionQuality.Rejected : EvidenceFusionQuality.Accepted;
    const status = quality === EvidenceFusionQuality.Accepted && completeness === EvidenceFusionCompleteness.Complete && freshness === EvidenceFusionFreshness.Current
      ? EvidenceFusionAssessmentStatus.Ready
      : EvidenceFusionAssessmentStatus.Blocked;

    const snapshotBase = {
      schemaVersion: EVIDENCE_FUSION_SCHEMA_VERSION,
      snapshotId: request.snapshotId,
      evaluatedAt: request.evaluatedAt,
      createdAt: request.createdAt,
      policyId: request.policy.policyId,
      policyVersion: request.policy.version,
      ruleSetVersion: request.policy.ruleSetVersion,
      evidenceReferences: uniqueSorted(evidenceReferences),
      completeness,
      freshness,
      quality,
      contradictions: sortedContradictions,
      blockers: sortedBlockers,
      warnings: sortedWarnings,
      provenance: provenance.sort((a, b) => `${a.sourceType}|${a.sourceAssessmentId}`.localeCompare(`${b.sourceType}|${b.sourceAssessmentId}`)),
      trace: structuredClone(request.trace),
      deterministic: true as const,
      readOnly: true as const,
    };
    const snapshot: EvidenceFusionSnapshot = deepFreeze({ ...snapshotBase, fingerprint: `fnv1a64:${fnv1a64(canonicalize(snapshotBase))}` });
    return deepFreeze({
      schemaVersion: EVIDENCE_FUSION_SCHEMA_VERSION,
      assessmentId: request.assessmentId,
      evaluatedAt: request.evaluatedAt,
      createdAt: request.createdAt,
      status,
      snapshot,
    });
  }
}

function validateAssessmentRequest(value: unknown): EvidenceFusionAssessmentRequest {
  const issues: EvidenceFusionIssue[] = [];
  if (!isRecord(value)) throw new EvidenceFusionValidationError([blocker(EvidenceFusionIssueCode.InvalidRecord, "Assessment request must be an object.")]);
  if (value.schemaVersion !== EVIDENCE_FUSION_SCHEMA_VERSION) issues.push(blocker(EvidenceFusionIssueCode.InvalidSchemaVersion, "Assessment schema version is unsupported."));
  if (!validIdentifier(value.assessmentId)) issues.push(blocker(EvidenceFusionIssueCode.InvalidIdentifier, "Assessment ID is invalid."));
  if (!validIdentifier(value.snapshotId)) issues.push(blocker(EvidenceFusionIssueCode.InvalidIdentifier, "Snapshot ID is invalid."));
  if (!isTimestamp(value.evaluatedAt)) issues.push(blocker(EvidenceFusionIssueCode.InvalidTimestamp, "Evaluation timestamp must be canonical UTC."));
  if (!isTimestamp(value.createdAt)) issues.push(blocker(EvidenceFusionIssueCode.InvalidTimestamp, "Creation timestamp must be canonical UTC."));
  if (isTimestamp(value.evaluatedAt) && isTimestamp(value.createdAt) && Date.parse(value.createdAt) < Date.parse(value.evaluatedAt)) issues.push(blocker(EvidenceFusionIssueCode.InvalidTimestamp, "Creation timestamp cannot precede evaluation."));
  const policyValidation = validateEvidenceFusionPolicy(value.policy);
  issues.push(...policyValidation.issues);
  if (!Array.isArray(value.inputs)) issues.push(blocker(EvidenceFusionIssueCode.InvalidRecord, "Inputs must be an array."));
  else {
    const seenInputIds = new Set<string>();
    const seenSources = new Set<string>();
    value.inputs.forEach((input) => {
      const result = validateEvidenceFusionInput(input);
      issues.push(...result.issues);
      if (isRecord(input) && typeof input.inputId === "string") {
        if (seenInputIds.has(input.inputId)) issues.push(blocker(EvidenceFusionIssueCode.DuplicateSource, "Input IDs must be unique."));
        seenInputIds.add(input.inputId);
      }
      if (isRecord(input) && typeof input.sourceType === "string") {
        if (seenSources.has(input.sourceType)) issues.push(blocker(EvidenceFusionIssueCode.DuplicateSource, "Only one input per source type is allowed."));
        seenSources.add(input.sourceType);
      }
    });
  }
  if (!validTrace(value.trace)) issues.push(blocker(EvidenceFusionIssueCode.InvalidIdentifier, "Fusion trace metadata is invalid."));
  if (issues.length > 0) throw new EvidenceFusionValidationError(sortIssues(issues));
  return value as unknown as EvidenceFusionAssessmentRequest;
}

function validateInput(value: unknown): EvidenceFusionIssue[] {
  const issues: EvidenceFusionIssue[] = [];
  if (!isRecord(value)) return [blocker(EvidenceFusionIssueCode.InvalidRecord, "Fusion input must be an object.")];
  if (value.schemaVersion !== EVIDENCE_FUSION_SCHEMA_VERSION) issues.push(blocker(EvidenceFusionIssueCode.InvalidSchemaVersion, "Fusion input schema version is unsupported."));
  if (!validIdentifier(value.inputId)) issues.push(blocker(EvidenceFusionIssueCode.InvalidIdentifier, "Fusion input ID is invalid."));
  if (value.sourceType !== EvidenceFusionSourceType.BroadMarketEvidence) issues.push(blocker(EvidenceFusionIssueCode.UnsupportedSource, "Only Broad Market Evidence input is supported."));
  if (!Object.values(EvidenceFusionSourceState).includes(value.sourceState as EvidenceFusionSourceState)) issues.push(blocker(EvidenceFusionIssueCode.InvalidSource, "Fusion source state is unsupported."));
  if (!validStringArray(value.evidenceReferences)) issues.push(blocker(EvidenceFusionIssueCode.InvalidSource, "Evidence references must be unique valid identifiers."));
  if (!validSourceIssueArray(value.sourceIssues)) issues.push(blocker(EvidenceFusionIssueCode.InvalidSource, "Source issues are invalid."));
  if (!validSourceIssueArray(value.sourceWarnings)) issues.push(blocker(EvidenceFusionIssueCode.InvalidSource, "Source warnings are invalid."));
  if (value.sourceState === EvidenceFusionSourceState.Complete && Array.isArray(value.sourceIssues) && value.sourceIssues.length > 0) issues.push(blocker(EvidenceFusionIssueCode.InvalidSource, "A complete source cannot retain blockers."));
  if (value.sourceState === EvidenceFusionSourceState.Contradictory && Array.isArray(value.sourceIssues) && value.sourceIssues.length === 0) issues.push(blocker(EvidenceFusionIssueCode.InvalidSource, "A contradictory source must preserve contradiction evidence."));
  if (!isRecord(value.provenance)) issues.push(blocker(EvidenceFusionIssueCode.InvalidSource, "Source provenance is required."));
  else {
    const provenance = value.provenance;
    if (provenance.sourceType !== value.sourceType) issues.push(blocker(EvidenceFusionIssueCode.InvalidSource, "Provenance source type must match input source type."));
    for (const field of ["sourceAssessmentId", "sourceSnapshotId", "sourcePolicyId"] as const) if (!validIdentifier(provenance[field])) issues.push(blocker(EvidenceFusionIssueCode.InvalidIdentifier, `${field} is invalid.`));
    for (const field of ["sourceSchemaVersion", "sourcePolicyVersion", "sourceRuleSetVersion"] as const) if (!validVersion(provenance[field])) issues.push(blocker(EvidenceFusionIssueCode.InvalidSource, `${field} is invalid.`));
    if (provenance.sourceFeatureVersion !== undefined && !validVersion(provenance.sourceFeatureVersion)) issues.push(blocker(EvidenceFusionIssueCode.InvalidSource, "Source feature version is invalid."));
    if (typeof provenance.sourceSnapshotFingerprint !== "string" || !FINGERPRINT.test(provenance.sourceSnapshotFingerprint)) issues.push(blocker(EvidenceFusionIssueCode.InvalidIdentifier, "Source snapshot fingerprint is invalid."));
    for (const field of ["sourceAssessedAt", "sourceCreatedAt"] as const) if (!isTimestamp(provenance[field])) issues.push(blocker(EvidenceFusionIssueCode.InvalidTimestamp, `${field} must be canonical UTC.`));
    if (isTimestamp(provenance.sourceAssessedAt) && isTimestamp(provenance.sourceCreatedAt) && Date.parse(provenance.sourceCreatedAt) < Date.parse(provenance.sourceAssessedAt)) issues.push(blocker(EvidenceFusionIssueCode.InvalidTimestamp, "Source creation cannot precede source assessment."));
    if (!validStringArray(provenance.sourceAuditReferenceIds)) issues.push(blocker(EvidenceFusionIssueCode.InvalidSource, "Source audit references are invalid."));
  }
  return issues;
}

function validateBroadMarketAssessment(value: unknown): BroadMarketEvidenceAssessment {
  const issues: EvidenceFusionIssue[] = [];
  if (!isRecord(value)) throw new EvidenceFusionValidationError([blocker(EvidenceFusionIssueCode.InvalidSource, "Broad Market Evidence assessment must be an object.")]);
  if (value.schemaVersion !== BROAD_MARKET_EVIDENCE_SCHEMA_VERSION) issues.push(blocker(EvidenceFusionIssueCode.InvalidSchemaVersion, "Broad Market Evidence schema version is unsupported."));
  for (const field of ["assessmentId", "inputSnapshotId", "policyId"] as const) if (!validIdentifier(value[field])) issues.push(blocker(EvidenceFusionIssueCode.InvalidIdentifier, `Broad Market Evidence ${field} is invalid.`));
  for (const field of ["policyVersion", "ruleSetVersion", "featureCalculationVersion"] as const) if (!validVersion(value[field])) issues.push(blocker(EvidenceFusionIssueCode.InvalidSource, `Broad Market Evidence ${field} is invalid.`));
  for (const field of ["assessedAt", "createdAt", "asOf"] as const) if (!isTimestamp(value[field])) issues.push(blocker(EvidenceFusionIssueCode.InvalidTimestamp, `Broad Market Evidence ${field} must be canonical UTC.`));
  if (typeof value.inputSnapshotFingerprint !== "string" || !FINGERPRINT.test(value.inputSnapshotFingerprint)) issues.push(blocker(EvidenceFusionIssueCode.InvalidIdentifier, "Broad Market Evidence snapshot fingerprint is invalid."));
  if (!Object.values(BroadMarketEvidenceQuality).includes(value.quality as BroadMarketEvidenceQuality)) issues.push(blocker(EvidenceFusionIssueCode.InvalidSource, "Broad Market Evidence quality is unsupported."));
  if (!Object.values(BroadMarketEvidenceStrength).includes(value.evidenceStrength as BroadMarketEvidenceStrength)) issues.push(blocker(EvidenceFusionIssueCode.InvalidSource, "Broad Market Evidence strength is unsupported."));
  if (!validStringArray(value.evidenceReferences)) issues.push(blocker(EvidenceFusionIssueCode.InvalidSource, "Broad Market Evidence references are invalid."));
  if (!validBroadMarketIssueArray(value.issues) || !validBroadMarketIssueArray(value.warnings)) issues.push(blocker(EvidenceFusionIssueCode.InvalidSource, "Broad Market Evidence issues or warnings are invalid."));
  if (!Array.isArray(value.benchmarkSummaries) || !isRecord(value.aggregateFacts)) issues.push(blocker(EvidenceFusionIssueCode.InvalidSource, "Broad Market Evidence composition details are missing."));
  if (!validTrace(value.trace)) issues.push(blocker(EvidenceFusionIssueCode.InvalidSource, "Broad Market Evidence trace is invalid."));
  if (value.quality === BroadMarketEvidenceQuality.Complete && Array.isArray(value.issues) && value.issues.length > 0) issues.push(blocker(EvidenceFusionIssueCode.InvalidSource, "Complete Broad Market Evidence cannot retain blockers."));
  if (value.quality === BroadMarketEvidenceQuality.Contradictory && Array.isArray(value.issues) && !value.issues.some((entry) => isRecord(entry) && entry.code === BroadMarketEvidenceIssueCode.StrongBenchmarkDisagreement)) issues.push(blocker(EvidenceFusionIssueCode.InvalidSource, "Contradictory Broad Market Evidence must retain its contradiction reason."));
  if (issues.length > 0) throw new EvidenceFusionValidationError(sortIssues(issues));
  return value as unknown as BroadMarketEvidenceAssessment;
}

function mapBroadMarketState(value: BroadMarketEvidenceQuality): EvidenceFusionSourceState {
  switch (value) {
    case BroadMarketEvidenceQuality.Complete: return EvidenceFusionSourceState.Complete;
    case BroadMarketEvidenceQuality.Partial: return EvidenceFusionSourceState.Partial;
    case BroadMarketEvidenceQuality.Stale: return EvidenceFusionSourceState.Stale;
    case BroadMarketEvidenceQuality.Contradictory: return EvidenceFusionSourceState.Contradictory;
    case BroadMarketEvidenceQuality.Insufficient: return EvidenceFusionSourceState.Insufficient;
  }
}

function canonicalInput(value: EvidenceFusionInput): EvidenceFusionInput {
  return deepFreeze({
    schemaVersion: EVIDENCE_FUSION_SCHEMA_VERSION,
    inputId: value.inputId,
    sourceType: EvidenceFusionSourceType.BroadMarketEvidence,
    sourceState: value.sourceState,
    evidenceReferences: uniqueSorted(value.evidenceReferences),
    sourceIssues: canonicalSourceIssues(value.sourceIssues),
    sourceWarnings: canonicalSourceIssues(value.sourceWarnings),
    provenance: {
      sourceType: value.provenance.sourceType,
      sourceAssessmentId: value.provenance.sourceAssessmentId,
      sourceSchemaVersion: value.provenance.sourceSchemaVersion,
      sourceSnapshotId: value.provenance.sourceSnapshotId,
      sourceSnapshotFingerprint: value.provenance.sourceSnapshotFingerprint,
      sourcePolicyId: value.provenance.sourcePolicyId,
      sourcePolicyVersion: value.provenance.sourcePolicyVersion,
      sourceRuleSetVersion: value.provenance.sourceRuleSetVersion,
      ...(value.provenance.sourceFeatureVersion === undefined ? {} : { sourceFeatureVersion: value.provenance.sourceFeatureVersion }),
      sourceAssessedAt: value.provenance.sourceAssessedAt,
      sourceCreatedAt: value.provenance.sourceCreatedAt,
      sourceAuditReferenceIds: uniqueSorted(value.provenance.sourceAuditReferenceIds),
    },
  });
}

function canonicalSourceIssues(values: readonly EvidenceFusionSourceIssue[]): EvidenceFusionSourceIssue[] { return values.map((entry) => ({ code: entry.code, field: entry.field, message: entry.message })).sort((a, b) => `${a.code}|${a.field}|${a.message}`.localeCompare(`${b.code}|${b.field}|${b.message}`)); }
function warningFromSource(input: EvidenceFusionInput, source: EvidenceFusionSourceIssue): EvidenceFusionIssue { return { code: EvidenceFusionIssueCode.SourceWarning, severity: EvidenceFusionIssueSeverity.Warning, sourceType: input.sourceType, inputId: input.inputId, sourceCode: source.code, message: source.message }; }
function blocker(code: EvidenceFusionIssueCode, message: string, sourceType?: EvidenceFusionSourceType, inputId?: string, sourceCode?: string): EvidenceFusionIssue { return { code, severity: EvidenceFusionIssueSeverity.Blocker, ...(sourceType === undefined ? {} : { sourceType }), ...(inputId === undefined ? {} : { inputId }), ...(sourceCode === undefined ? {} : { sourceCode }), message }; }
function frozenValidation(values: readonly EvidenceFusionIssue[]): EvidenceFusionValidationResult { const issues = sortIssues(values); return deepFreeze({ valid: issues.length === 0, issues }); }
function sortIssues(values: readonly EvidenceFusionIssue[]): EvidenceFusionIssue[] { return values.map((entry) => ({ ...entry })).sort((a, b) => `${a.code}|${a.sourceType ?? ""}|${a.inputId ?? ""}|${a.sourceCode ?? ""}|${a.message}`.localeCompare(`${b.code}|${b.sourceType ?? ""}|${b.inputId ?? ""}|${b.sourceCode ?? ""}|${b.message}`)); }
function uniqueIssues(values: readonly EvidenceFusionIssue[]): EvidenceFusionIssue[] { const seen = new Set<string>(); return values.filter((entry) => { const key = canonicalize(entry); if (seen.has(key)) return false; seen.add(key); return true; }); }
function validSourceIssueArray(value: unknown): value is EvidenceFusionSourceIssue[] { return Array.isArray(value) && value.every((entry) => isRecord(entry) && validIdentifier(entry.code) && typeof entry.field === "string" && entry.field.length > 0 && entry.field.length <= 240 && typeof entry.message === "string" && entry.message.length > 0 && entry.message.length <= 500); }
function validBroadMarketIssueArray(value: unknown): boolean { return Array.isArray(value) && value.every((entry) => isRecord(entry) && Object.values(BroadMarketEvidenceIssueCode).includes(entry.code as BroadMarketEvidenceIssueCode) && typeof entry.field === "string" && typeof entry.message === "string"); }
function validTrace(value: unknown): boolean { return isRecord(value) && validIdentifier(value.correlationId) && validIdentifier(value.traceId) && validStringArray(value.auditReferenceIds); }
function validStringArray(value: unknown): value is string[] { return Array.isArray(value) && value.every(validIdentifier) && new Set(value).size === value.length; }
function validIdentifier(value: unknown): value is string { return typeof value === "string" && IDENTIFIER.test(value); }
function validVersion(value: unknown): value is string { return typeof value === "string" && VERSION.test(value); }
function positiveSafeInteger(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) > 0; }
function isTimestamp(value: unknown): value is string { if (typeof value !== "string") return false; const parsed = Date.parse(value); return Number.isFinite(parsed) && new Date(parsed).toISOString() === value; }
function uniqueSorted(values: readonly string[]): string[] { return [...new Set(values)].sort((a, b) => a.localeCompare(b)); }
function fnv1a64(value: string): string { let hash = 0xcbf29ce484222325n; for (let index = 0; index < value.length; index += 1) { hash ^= BigInt(value.charCodeAt(index)); hash = BigInt.asUintN(64, hash * 0x100000001b3n); } return hash.toString(16).padStart(16, "0"); }
function canonicalize(value: unknown): string { if (value === null || typeof value !== "object") return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`; return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`).join(",")}}`; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function deepFreeze<T>(value: T): T { if (typeof value === "object" && value !== null && !Object.isFrozen(value)) { Object.freeze(value); for (const nested of Object.values(value)) deepFreeze(nested); } return value; }
