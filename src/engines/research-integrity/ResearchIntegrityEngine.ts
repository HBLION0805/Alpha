import {
  RESEARCH_INTEGRITY_SCHEMA_VERSION,
  ResearchEvidenceAvailabilityBasis,
  ResearchEvidenceCompletionStatus,
  ResearchEvidenceKind,
  ResearchIntegrityAuthorizationStatus,
  ResearchIntegrityIssueCode,
  ResearchIntegrityMode,
  ResearchIntegrityStatus,
  type ResearchIntegrityAudit,
  type ResearchIntegrityAuditInput,
  type ResearchIntegrityDatasetManifestInput,
  type ResearchIntegrityEvidenceInput,
  type ResearchIntegrityIssue,
  type ResearchIntegrityPolicy,
  type ResearchIntegrityValidationResult,
} from "../../contracts/ResearchIntegrity";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const FINGERPRINT = /^(?:fnv1a64:[a-f0-9]{16}|sha256:[a-f0-9]{64})$/u;
const INPUT_KEYS = ["schemaVersion", "auditId", "researchId", "mode", "cutoffAt", "evaluatedAt", "dataset", "evidence"] as const;
const DATASET_KEYS = ["datasetId", "datasetVersion", "frozenAt", "evidenceMembers"] as const;
const MEMBER_KEYS = ["evidenceId", "evidenceFingerprint"] as const;
const EVIDENCE_KEYS = [
  "evidenceId", "kind", "sourceId", "sourceRecordId", "occurredAt", "publishedAt", "availableAt",
  "receivedAt", "intervalStartsAt", "intervalEndsAt", "completionStatus", "availabilityBasis",
  "availabilityReference", "outcomeBearing", "fingerprint",
] as const;
const POLICY_KEYS = ["policyId", "version", "ruleSetVersion", "maximumEvidenceRecords"] as const;
const PUBLICATION_REQUIRED = new Set<ResearchEvidenceKind>([
  ResearchEvidenceKind.News,
  ResearchEvidenceKind.Filing,
  ResearchEvidenceKind.Outcome,
  ResearchEvidenceKind.Settlement,
]);
const OUTCOME_KINDS = new Set<ResearchEvidenceKind>([
  ResearchEvidenceKind.Outcome,
  ResearchEvidenceKind.Settlement,
]);

export const DEFAULT_RESEARCH_INTEGRITY_POLICY: ResearchIntegrityPolicy = deepFreeze({
  policyId: "research-integrity:point-in-time:1",
  version: "1.0",
  ruleSetVersion: "1.0",
  maximumEvidenceRecords: 10_000,
});

export class ResearchIntegrityValidationError extends Error {
  public constructor(public readonly issues: readonly ResearchIntegrityIssue[]) {
    super("Research integrity input validation failed.");
    this.name = "ResearchIntegrityValidationError";
  }
}

export class ResearchIntegrityEngine {
  readonly #policy: ResearchIntegrityPolicy;

  public constructor(policy: Readonly<ResearchIntegrityPolicy> = DEFAULT_RESEARCH_INTEGRITY_POLICY) {
    const validation = validateResearchIntegrityPolicy(policy);
    if (!validation.valid) throw new ResearchIntegrityValidationError(validation.issues);
    this.#policy = deepFreeze(structuredClone(policy));
  }

  public assess(value: unknown): ResearchIntegrityAudit {
    const validation = validateResearchIntegrityAuditInput(value, this.#policy);
    if (!validation.valid) throw new ResearchIntegrityValidationError(validation.issues);
    const input = canonicalInput(value as ResearchIntegrityAuditInput);
    const issues = deepFreeze(evaluateIntegrity(input).sort(compareIssues));
    const datasetFingerprint = createResearchDatasetFingerprint(input.dataset);
    const base = {
      schemaVersion: RESEARCH_INTEGRITY_SCHEMA_VERSION,
      auditId: input.auditId,
      researchId: input.researchId,
      mode: input.mode,
      cutoffAt: input.cutoffAt,
      evaluatedAt: input.evaluatedAt,
      datasetId: input.dataset.datasetId,
      datasetVersion: input.dataset.datasetVersion,
      datasetFrozenAt: input.dataset.frozenAt,
      datasetFingerprint,
      evidenceCount: input.evidence.length,
      status: issues.length === 0 ? ResearchIntegrityStatus.Eligible : ResearchIntegrityStatus.Blocked,
      issues,
      policyId: this.#policy.policyId,
      policyVersion: this.#policy.version,
      ruleSetVersion: this.#policy.ruleSetVersion,
      authorizationStatus: ResearchIntegrityAuthorizationStatus.ResearchOnly,
      deterministic: true as const,
      readOnly: true as const,
    };
    return deepFreeze({ ...base, fingerprint: `fnv1a64:${fnv1a64(canonicalize(base))}` });
  }
}

export function validateResearchIntegrityAuditInput(
  value: unknown,
  policy: Readonly<ResearchIntegrityPolicy> = DEFAULT_RESEARCH_INTEGRITY_POLICY,
): ResearchIntegrityValidationResult {
  const issues: ResearchIntegrityIssue[] = [];
  const policyValidation = validateResearchIntegrityPolicy(policy);
  if (!policyValidation.valid) issues.push(...policyValidation.issues);
  if (!isRecord(value)) return result([...issues, issue(ResearchIntegrityIssueCode.InvalidRecord, "$", null, "Audit input must be an object.")]);
  exactKeys(issues, value, INPUT_KEYS, "$");
  if (value.schemaVersion !== RESEARCH_INTEGRITY_SCHEMA_VERSION) add(issues, ResearchIntegrityIssueCode.InvalidSchemaVersion, "schemaVersion", null, "Schema version is unsupported.");
  identifier(issues, value.auditId, "auditId", null);
  identifier(issues, value.researchId, "researchId", null);
  enumValue(issues, ResearchIntegrityMode, value.mode, "mode", null);
  timestamp(issues, value.cutoffAt, "cutoffAt", null);
  timestamp(issues, value.evaluatedAt, "evaluatedAt", null);
  validateDatasetShape(issues, value.dataset, policy);
  validateEvidenceShape(issues, value.evidence, policy);
  return result(issues);
}

export function validateResearchIntegrityPolicy(value: unknown): ResearchIntegrityValidationResult {
  const issues: ResearchIntegrityIssue[] = [];
  if (!isRecord(value)) return result([issue(ResearchIntegrityIssueCode.InvalidPolicy, "policy", null, "Policy must be an object.")]);
  exactKeys(issues, value, POLICY_KEYS, "policy", ResearchIntegrityIssueCode.InvalidPolicy);
  identifier(issues, value.policyId, "policy.policyId", null, ResearchIntegrityIssueCode.InvalidPolicy);
  version(issues, value.version, "policy.version", ResearchIntegrityIssueCode.InvalidPolicy);
  version(issues, value.ruleSetVersion, "policy.ruleSetVersion", ResearchIntegrityIssueCode.InvalidPolicy);
  if (!Number.isSafeInteger(value.maximumEvidenceRecords) || (value.maximumEvidenceRecords as number) < 1 || (value.maximumEvidenceRecords as number) > 100_000) {
    add(issues, ResearchIntegrityIssueCode.InvalidPolicy, "policy.maximumEvidenceRecords", null, "Maximum evidence records must be a positive safe integer no greater than 100,000.");
  }
  return result(issues);
}

export function createResearchDatasetFingerprint(value: ResearchIntegrityDatasetManifestInput): string {
  const canonical = canonicalDataset(value);
  return `fnv1a64:${fnv1a64(canonicalize(canonical))}`;
}

function validateDatasetShape(issues: ResearchIntegrityIssue[], value: unknown, policy: Readonly<ResearchIntegrityPolicy>): void {
  if (!isRecord(value)) {
    add(issues, ResearchIntegrityIssueCode.InvalidRecord, "dataset", null, "Dataset manifest must be an object.");
    return;
  }
  exactKeys(issues, value, DATASET_KEYS, "dataset");
  identifier(issues, value.datasetId, "dataset.datasetId", null);
  version(issues, value.datasetVersion, "dataset.datasetVersion");
  timestamp(issues, value.frozenAt, "dataset.frozenAt", null);
  if (!Array.isArray(value.evidenceMembers) || value.evidenceMembers.length === 0 || value.evidenceMembers.length > policy.maximumEvidenceRecords) {
    add(issues, ResearchIntegrityIssueCode.InvalidRecord, "dataset.evidenceMembers", null, "Dataset members must be a non-empty array within policy.");
    return;
  }
  value.evidenceMembers.forEach((member, index) => {
    const field = `dataset.evidenceMembers.${String(index)}`;
    if (!isRecord(member)) {
      add(issues, ResearchIntegrityIssueCode.InvalidRecord, field, null, "Dataset member must be an object.");
      return;
    }
    exactKeys(issues, member, MEMBER_KEYS, field);
    identifier(issues, member.evidenceId, `${field}.evidenceId`, typeof member.evidenceId === "string" ? member.evidenceId : null);
    fingerprint(issues, member.evidenceFingerprint, `${field}.evidenceFingerprint`, typeof member.evidenceId === "string" ? member.evidenceId : null);
  });
}

function validateEvidenceShape(issues: ResearchIntegrityIssue[], value: unknown, policy: Readonly<ResearchIntegrityPolicy>): void {
  if (!Array.isArray(value) || value.length === 0 || value.length > policy.maximumEvidenceRecords) {
    add(issues, ResearchIntegrityIssueCode.InvalidRecord, "evidence", null, "Evidence must be a non-empty array within policy.");
    return;
  }
  value.forEach((entry, index) => {
    const field = `evidence.${String(index)}`;
    if (!isRecord(entry)) {
      add(issues, ResearchIntegrityIssueCode.InvalidRecord, field, null, "Evidence must be an object.");
      return;
    }
    const evidenceId = typeof entry.evidenceId === "string" ? entry.evidenceId : null;
    exactKeys(issues, entry, EVIDENCE_KEYS, field);
    identifier(issues, entry.evidenceId, `${field}.evidenceId`, evidenceId);
    enumValue(issues, ResearchEvidenceKind, entry.kind, `${field}.kind`, evidenceId);
    identifier(issues, entry.sourceId, `${field}.sourceId`, evidenceId);
    identifier(issues, entry.sourceRecordId, `${field}.sourceRecordId`, evidenceId);
    timestamp(issues, entry.occurredAt, `${field}.occurredAt`, evidenceId);
    nullableTimestamp(issues, entry.publishedAt, `${field}.publishedAt`, evidenceId);
    timestamp(issues, entry.availableAt, `${field}.availableAt`, evidenceId);
    timestamp(issues, entry.receivedAt, `${field}.receivedAt`, evidenceId);
    nullableTimestamp(issues, entry.intervalStartsAt, `${field}.intervalStartsAt`, evidenceId);
    nullableTimestamp(issues, entry.intervalEndsAt, `${field}.intervalEndsAt`, evidenceId);
    enumValue(issues, ResearchEvidenceCompletionStatus, entry.completionStatus, `${field}.completionStatus`, evidenceId);
    enumValue(issues, ResearchEvidenceAvailabilityBasis, entry.availabilityBasis, `${field}.availabilityBasis`, evidenceId);
    identifier(issues, entry.availabilityReference, `${field}.availabilityReference`, evidenceId);
    if (typeof entry.outcomeBearing !== "boolean") add(issues, ResearchIntegrityIssueCode.InvalidRecord, `${field}.outcomeBearing`, evidenceId, "Outcome-bearing flag must be boolean.");
    fingerprint(issues, entry.fingerprint, `${field}.fingerprint`, evidenceId);
  });
}

function evaluateIntegrity(input: ResearchIntegrityAuditInput): ResearchIntegrityIssue[] {
  const issues: ResearchIntegrityIssue[] = [];
  const cutoff = Date.parse(input.cutoffAt);
  const evaluated = Date.parse(input.evaluatedAt);
  const frozen = Date.parse(input.dataset.frozenAt);
  if (cutoff > evaluated) add(issues, ResearchIntegrityIssueCode.CutoffAfterEvaluation, "cutoffAt", null, "Research cutoff cannot follow audit evaluation.");
  if (frozen > evaluated) add(issues, ResearchIntegrityIssueCode.DatasetNotFrozen, "dataset.frozenAt", null, "Dataset must be frozen before audit evaluation.");
  if (input.mode === ResearchIntegrityMode.Forward && frozen > cutoff) add(issues, ResearchIntegrityIssueCode.DatasetNotFrozen, "dataset.frozenAt", null, "Forward-mode dataset must be frozen by the research cutoff.");

  const evidenceById = new Map<string, ResearchIntegrityEvidenceInput>();
  for (const entry of input.evidence) {
    if (evidenceById.has(entry.evidenceId)) add(issues, ResearchIntegrityIssueCode.DuplicateEvidence, "evidence", entry.evidenceId, "Evidence IDs must be unique.");
    else evidenceById.set(entry.evidenceId, entry);
    evaluateEvidence(issues, entry, input);
  }

  const memberById = new Map<string, string>();
  for (const member of input.dataset.evidenceMembers) {
    if (memberById.has(member.evidenceId)) add(issues, ResearchIntegrityIssueCode.DuplicateEvidence, "dataset.evidenceMembers", member.evidenceId, "Dataset member IDs must be unique.");
    else memberById.set(member.evidenceId, member.evidenceFingerprint);
  }
  for (const [evidenceId, entry] of evidenceById) {
    const memberFingerprint = memberById.get(evidenceId);
    if (memberFingerprint === undefined) add(issues, ResearchIntegrityIssueCode.DatasetMembershipMismatch, "dataset.evidenceMembers", evidenceId, "Evidence is missing from the frozen dataset manifest.");
    else if (memberFingerprint !== entry.fingerprint) add(issues, ResearchIntegrityIssueCode.DatasetFingerprintMismatch, "dataset.evidenceMembers", evidenceId, "Dataset member fingerprint does not match the exact evidence record.");
  }
  for (const evidenceId of memberById.keys()) {
    if (!evidenceById.has(evidenceId)) add(issues, ResearchIntegrityIssueCode.DatasetMembershipMismatch, "dataset.evidenceMembers", evidenceId, "Dataset manifest references evidence not supplied to the audit.");
  }
  return issues;
}

function evaluateEvidence(issues: ResearchIntegrityIssue[], entry: ResearchIntegrityEvidenceInput, input: ResearchIntegrityAuditInput): void {
  const occurred = Date.parse(entry.occurredAt);
  const published = entry.publishedAt === null ? null : Date.parse(entry.publishedAt);
  const available = Date.parse(entry.availableAt);
  const received = Date.parse(entry.receivedAt);
  const cutoff = Date.parse(input.cutoffAt);
  const evaluated = Date.parse(input.evaluatedAt);

  if (published !== null && occurred > published) add(issues, ResearchIntegrityIssueCode.InvalidTemporalOrder, "publishedAt", entry.evidenceId, "Publication cannot predate occurrence.");
  if (occurred > available || (published !== null && published > available) || available > received) {
    add(issues, ResearchIntegrityIssueCode.InvalidTemporalOrder, "availableAt", entry.evidenceId, "Occurrence/publication/availability/receipt order is invalid.");
  }
  if (occurred > cutoff) add(issues, ResearchIntegrityIssueCode.OccurrenceAfterCutoff, "occurredAt", entry.evidenceId, "Evidence occurrence follows the research cutoff.");
  if (published !== null && published > cutoff) add(issues, ResearchIntegrityIssueCode.PublicationAfterCutoff, "publishedAt", entry.evidenceId, "This exact source version was published after the research cutoff.");
  if (available > cutoff) add(issues, ResearchIntegrityIssueCode.EvidenceUnavailableAtCutoff, "availableAt", entry.evidenceId, "Evidence was not available at the research cutoff.");
  if (received > evaluated) add(issues, ResearchIntegrityIssueCode.ReceiptAfterEvaluation, "receivedAt", entry.evidenceId, "Evidence receipt follows the audit evaluation.");
  if (input.mode === ResearchIntegrityMode.Forward && received > cutoff) add(issues, ResearchIntegrityIssueCode.ForwardReceiptAfterCutoff, "receivedAt", entry.evidenceId, "Forward research had not received this evidence by the cutoff.");
  if (PUBLICATION_REQUIRED.has(entry.kind) && entry.publishedAt === null) add(issues, ResearchIntegrityIssueCode.MissingPublicationTime, "publishedAt", entry.evidenceId, "This evidence kind requires an explicit publication time.");
  if (OUTCOME_KINDS.has(entry.kind) || entry.outcomeBearing) add(issues, ResearchIntegrityIssueCode.OutcomeLeakage, "kind", entry.evidenceId, "Outcome-bearing evidence is forbidden in pre-outcome research.");
  if (entry.availabilityBasis === ResearchEvidenceAvailabilityBasis.SourcePublication && entry.publishedAt === null) {
    add(issues, ResearchIntegrityIssueCode.InvalidAvailabilityBasis, "availabilityBasis", entry.evidenceId, "SOURCE_PUBLICATION requires an explicit publication time.");
  }
  if (entry.availabilityBasis === ResearchEvidenceAvailabilityBasis.ProviderReceipt && available !== received) {
    add(issues, ResearchIntegrityIssueCode.InvalidAvailabilityBasis, "availableAt", entry.evidenceId, "PROVIDER_RECEIPT availability must equal the exact receipt time.");
  }
  if (entry.availabilityBasis === ResearchEvidenceAvailabilityBasis.ExchangeIntervalClose && entry.kind !== ResearchEvidenceKind.CanonicalBar) {
    add(issues, ResearchIntegrityIssueCode.InvalidAvailabilityBasis, "availabilityBasis", entry.evidenceId, "EXCHANGE_INTERVAL_CLOSE applies only to Canonical Bar evidence.");
  }

  if (entry.kind === ResearchEvidenceKind.CanonicalBar) {
    if (entry.intervalStartsAt === null || entry.intervalEndsAt === null) {
      add(issues, ResearchIntegrityIssueCode.InvalidInterval, "intervalStartsAt", entry.evidenceId, "Canonical Bar evidence requires exact interval boundaries.");
    } else {
      const starts = Date.parse(entry.intervalStartsAt);
      const ends = Date.parse(entry.intervalEndsAt);
      if (starts >= ends || occurred < ends) add(issues, ResearchIntegrityIssueCode.InvalidInterval, "intervalEndsAt", entry.evidenceId, "Bar interval must end after it starts and no later than occurrence.");
      if (ends > cutoff) add(issues, ResearchIntegrityIssueCode.IntervalEndsAfterCutoff, "intervalEndsAt", entry.evidenceId, "Bar interval was not complete at the research cutoff.");
    }
    if (entry.completionStatus !== ResearchEvidenceCompletionStatus.Final) add(issues, ResearchIntegrityIssueCode.IncompleteInterval, "completionStatus", entry.evidenceId, "Canonical Bar evidence must be final.");
  } else {
    if (entry.intervalStartsAt !== null || entry.intervalEndsAt !== null) add(issues, ResearchIntegrityIssueCode.InvalidInterval, "intervalStartsAt", entry.evidenceId, "Point-in-time evidence cannot declare interval boundaries.");
    if (entry.completionStatus !== ResearchEvidenceCompletionStatus.PointInTime) add(issues, ResearchIntegrityIssueCode.InvalidInterval, "completionStatus", entry.evidenceId, "Non-Bar evidence must use POINT_IN_TIME completion status.");
  }
}

function canonicalInput(value: ResearchIntegrityAuditInput): ResearchIntegrityAuditInput {
  return {
    schemaVersion: RESEARCH_INTEGRITY_SCHEMA_VERSION,
    auditId: value.auditId,
    researchId: value.researchId,
    mode: value.mode,
    cutoffAt: value.cutoffAt,
    evaluatedAt: value.evaluatedAt,
    dataset: canonicalDataset(value.dataset),
    evidence: value.evidence.map(canonicalEvidence).sort((left, right) => left.evidenceId.localeCompare(right.evidenceId)),
  };
}

function canonicalDataset(value: ResearchIntegrityDatasetManifestInput): ResearchIntegrityDatasetManifestInput {
  return {
    datasetId: value.datasetId,
    datasetVersion: value.datasetVersion,
    frozenAt: value.frozenAt,
    evidenceMembers: value.evidenceMembers
      .map((entry) => ({ evidenceId: entry.evidenceId, evidenceFingerprint: entry.evidenceFingerprint }))
      .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId)),
  };
}

function canonicalEvidence(value: ResearchIntegrityEvidenceInput): ResearchIntegrityEvidenceInput {
  return {
    evidenceId: value.evidenceId, kind: value.kind, sourceId: value.sourceId, sourceRecordId: value.sourceRecordId,
    occurredAt: value.occurredAt, publishedAt: value.publishedAt, availableAt: value.availableAt,
    receivedAt: value.receivedAt, intervalStartsAt: value.intervalStartsAt, intervalEndsAt: value.intervalEndsAt,
    completionStatus: value.completionStatus, availabilityBasis: value.availabilityBasis,
    availabilityReference: value.availabilityReference, outcomeBearing: value.outcomeBearing, fingerprint: value.fingerprint,
  };
}

function exactKeys(
  issues: ResearchIntegrityIssue[],
  value: Record<string, unknown>,
  expected: readonly string[],
  field: string,
  code = ResearchIntegrityIssueCode.InvalidRecord,
): void {
  const expectedSet = new Set(expected);
  for (const key of Object.keys(value)) if (!expectedSet.has(key)) add(issues, code, `${field}.${key}`, null, "Undeclared field is forbidden.");
  for (const key of expected) if (!Object.prototype.hasOwnProperty.call(value, key)) add(issues, code, `${field}.${key}`, null, "Required field is missing.");
}

function identifier(issues: ResearchIntegrityIssue[], value: unknown, field: string, evidenceId: string | null, code = ResearchIntegrityIssueCode.InvalidIdentifier): void {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) add(issues, code, field, evidenceId, "Identifier is invalid.");
}
function version(issues: ResearchIntegrityIssue[], value: unknown, field: string, code = ResearchIntegrityIssueCode.InvalidVersion): void {
  if (typeof value !== "string" || !VERSION.test(value)) add(issues, code, field, null, "Version is invalid.");
}
function fingerprint(issues: ResearchIntegrityIssue[], value: unknown, field: string, evidenceId: string | null): void {
  if (typeof value !== "string" || !FINGERPRINT.test(value)) add(issues, ResearchIntegrityIssueCode.InvalidFingerprint, field, evidenceId, "Fingerprint must be a supported bounded content fingerprint.");
}
function timestamp(issues: ResearchIntegrityIssue[], value: unknown, field: string, evidenceId: string | null): void {
  if (!isTimestamp(value)) add(issues, ResearchIntegrityIssueCode.InvalidTimestamp, field, evidenceId, "Timestamp must be canonical UTC with millisecond precision.");
}
function nullableTimestamp(issues: ResearchIntegrityIssue[], value: unknown, field: string, evidenceId: string | null): void {
  if (value !== null) timestamp(issues, value, field, evidenceId);
}
function enumValue(issues: ResearchIntegrityIssue[], values: object, value: unknown, field: string, evidenceId: string | null): void {
  if (!Object.values(values).includes(value)) add(issues, ResearchIntegrityIssueCode.InvalidEnum, field, evidenceId, "Enum value is unsupported.");
}
function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}
function add(issues: ResearchIntegrityIssue[], code: ResearchIntegrityIssueCode, field: string, evidenceId: string | null, message: string): void {
  issues.push(issue(code, field, evidenceId, message));
}
function issue(code: ResearchIntegrityIssueCode, field: string, evidenceId: string | null, message: string): ResearchIntegrityIssue {
  return { code, field, evidenceId, message };
}
function compareIssues(left: ResearchIntegrityIssue, right: ResearchIntegrityIssue): number {
  return left.code.localeCompare(right.code) || (left.evidenceId ?? "").localeCompare(right.evidenceId ?? "") || left.field.localeCompare(right.field) || left.message.localeCompare(right.message);
}
function result(issues: ResearchIntegrityIssue[]): ResearchIntegrityValidationResult {
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
