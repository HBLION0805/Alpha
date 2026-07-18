import {
  AIAuditActorType,
  AIAuditExportDestination,
  AIAuditExportFormat,
  AIAuditImportOrderStatus,
  AIAuditRecordType,
  AIAuditRetentionClassification,
  AIAuditSourceSubsystem,
  type AIAuditPolicy,
  type AIAuditQuery,
  type AIAuditRecord,
  type AIAuditRecordInput,
} from "./AIAuditRepository";
import { AITaskType, PrivacyLevel } from "./AIRouter";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const SECRET_KEY_PATTERN = /(api.?key|secret|password|credential|authorization|bearer|private.?key|access.?token)/i;

export function canonicalizeAIAuditValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return JSON.stringify(`[${String(value)}]`);
    return JSON.stringify(value);
  }
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (value === undefined) return '"[Undefined]"';
  if (Array.isArray(value)) return `[${value.map(canonicalizeAIAuditValue).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalizeAIAuditValue(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function nonEmpty(name: string, value: string): void {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`Invalid ${name}: expected a non-empty string.`);
}

function identifier(name: string, value: string): void {
  nonEmpty(name, value);
  if (!ID_PATTERN.test(value)) throw new Error(`Invalid ${name}: unsupported identifier characters.`);
}

function timestamp(name: string, value: string): void {
  nonEmpty(name, value);
  if (!Number.isFinite(Date.parse(value)) || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error(`Invalid ${name}: expected an ISO-8601 timestamp with explicit timezone.`);
  }
}

function positive(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid ${name}: expected a positive safe integer.`);
}

function uniqueIds(name: string, values: ReadonlyArray<string>): void {
  for (const value of values) identifier(name, value);
  if (new Set(values).size !== values.length) throw new Error(`Invalid ${name}: duplicate values are forbidden.`);
}

function validateMetadata(record: AIAuditRecordInput, rejectSecrets: boolean): void {
  if (record.metadata === null || Array.isArray(record.metadata) || typeof record.metadata !== "object") {
    throw new Error("Invalid record.metadata: expected a scalar-value object.");
  }
  for (const [key, value] of Object.entries(record.metadata)) {
    identifier("record.metadata key", key);
    if (rejectSecrets && SECRET_KEY_PATTERN.test(key)) throw new Error("Invalid record.metadata: secret-bearing key is forbidden.");
    if (value !== null && typeof value !== "string" && typeof value !== "boolean" && !(typeof value === "number" && Number.isSafeInteger(value))) {
      throw new Error("Invalid record.metadata: values must be scalar and finite.");
    }
  }
}

function validateError(record: AIAuditRecordInput): void {
  if (record.error === undefined) return;
  identifier("record.error.category", record.error.category);
  identifier("record.error.code", record.error.code);
  nonEmpty("record.error.safeMessage", record.error.safeMessage);
  timestamp("record.error.occurredAt", record.error.occurredAt);
}

export function validateAIAuditPolicy(policy: AIAuditPolicy): void {
  identifier("policy.policyId", policy.policyId);
  identifier("policy.version", policy.version);
  uniqueIds("policy.sensitiveExportAuthorizationReferences", policy.sensitiveExportAuthorizationReferences);
}

export function validateAIAuditRecordInput(record: AIAuditRecordInput, policy?: AIAuditPolicy): void {
  if (record.schemaVersion !== "1.0") throw new Error("Invalid record.schemaVersion: expected 1.0.");
  identifier("record.recordId", record.recordId);
  identifier("record.idempotencyKey", record.idempotencyKey);
  identifier("record.sourceRecordId", record.sourceRecordId);
  if (record.sourceRecordVersion !== undefined) identifier("record.sourceRecordVersion", record.sourceRecordVersion);
  timestamp("record.timestamp", record.timestamp);
  if (record.requestId !== undefined) identifier("record.requestId", record.requestId);
  identifier("record.correlationId", record.correlationId);
  identifier("record.traceId", record.traceId);
  uniqueIds("record.parentAuditRecordIds", record.parentAuditRecordIds);
  uniqueIds("record.relatedAuditRecordIds", record.relatedAuditRecordIds);
  uniqueIds("record.ledgerEntryIds", record.ledgerEntryIds);
  uniqueIds("record.reasonCodes", record.reasonCodes);
  uniqueIds("record.sourceAuditReferences", record.sourceAuditReferences);
  for (const [name, value] of [
    ["record.routingDecisionId", record.routingDecisionId], ["record.budgetDecisionId", record.budgetDecisionId],
    ["record.reservationId", record.reservationId], ["record.executionId", record.executionId],
    ["record.providerId", record.providerId], ["record.modelId", record.modelId],
    ["record.payloadIntegrityReference", record.payloadIntegrityReference],
  ] as const) if (value !== undefined) identifier(name, value);
  if (!Object.values(AIAuditRecordType).includes(record.recordType)) throw new Error("Invalid record.recordType.");
  if (!Object.values(AIAuditSourceSubsystem).includes(record.sourceSubsystem)) throw new Error("Invalid record.sourceSubsystem.");
  if (!Object.values(PrivacyLevel).includes(record.privacyLevel)) throw new Error("Invalid record.privacyLevel.");
  if (!Object.values(AIAuditRetentionClassification).includes(record.retention)) throw new Error("Invalid record.retention.");
  if (!Object.values(AIAuditActorType).includes(record.actor.type)) throw new Error("Invalid record.actor.type.");
  if (record.actor.actorId !== undefined) identifier("record.actor.actorId", record.actor.actorId);
  if (record.taskType !== undefined && !Object.values(AITaskType).includes(record.taskType)) throw new Error("Invalid record.taskType.");
  nonEmpty("record.status", record.status);
  nonEmpty("record.finalOutcome", record.finalOutcome);
  for (const [key, value] of Object.entries(record.policyVersions)) {
    identifier("record.policyVersions key", key);
    identifier("record.policyVersions value", value);
  }
  validateMetadata(record, policy?.rejectSecretMetadataKeys ?? true);
  validateError(record);
  if (record.recordType === AIAuditRecordType.OwnerApproval) {
    if (record.ownerApproval === undefined) throw new Error("Invalid record.ownerApproval: required for OWNER_APPROVAL.");
    identifier("record.ownerApproval.approvalId", record.ownerApproval.approvalId);
    identifier("record.ownerApproval.ownerReference", record.ownerApproval.ownerReference);
    nonEmpty("record.ownerApproval.approvedSubject", record.ownerApproval.approvedSubject);
    if (!["APPROVED", "REJECTED", "APPROVED_WITH_CONDITIONS"].includes(record.ownerApproval.decision)) {
      throw new Error("Invalid record.ownerApproval.decision.");
    }
    nonEmpty("record.ownerApproval.reason", record.ownerApproval.reason);
    for (const condition of record.ownerApproval.conditions) nonEmpty("record.ownerApproval.conditions", condition);
    if (record.ownerApproval.gitReference !== undefined) nonEmpty("record.ownerApproval.gitReference", record.ownerApproval.gitReference);
    if (record.actor.type !== AIAuditActorType.Owner) throw new Error("Invalid record.actor: OWNER_APPROVAL requires OWNER actor.");
  } else if (record.ownerApproval !== undefined) {
    throw new Error("Invalid record.ownerApproval: allowed only for OWNER_APPROVAL.");
  }
}

export function validateAIAuditRecord(record: AIAuditRecord): void {
  validateAIAuditRecordInput(record);
  positive("record.sequence", record.sequence);
  if (!Object.values(AIAuditImportOrderStatus).includes(record.importOrderStatus)) throw new Error("Invalid record.importOrderStatus.");
  nonEmpty("record.payloadFingerprint", record.payloadFingerprint);
}

export function validateAIAuditQuery(query: AIAuditQuery): void {
  if (query.fromSequence !== undefined) positive("query.fromSequence", query.fromSequence);
  if (query.toSequence !== undefined) positive("query.toSequence", query.toSequence);
  if (query.fromSequence !== undefined && query.toSequence !== undefined && query.fromSequence > query.toSequence) throw new Error("Invalid query sequence range.");
  if (query.fromTimestamp !== undefined) timestamp("query.fromTimestamp", query.fromTimestamp);
  if (query.toTimestamp !== undefined) timestamp("query.toTimestamp", query.toTimestamp);
  if (query.fromTimestamp !== undefined && query.toTimestamp !== undefined && Date.parse(query.fromTimestamp) > Date.parse(query.toTimestamp)) throw new Error("Invalid query timestamp range.");
  for (const [name, value] of [
    ["query.requestId", query.requestId], ["query.correlationId", query.correlationId], ["query.traceId", query.traceId],
    ["query.reservationId", query.reservationId], ["query.executionId", query.executionId], ["query.ledgerEntryId", query.ledgerEntryId],
    ["query.providerId", query.providerId], ["query.modelId", query.modelId],
  ] as const) if (value !== undefined) identifier(name, value);
  for (const value of query.recordTypes ?? []) if (!Object.values(AIAuditRecordType).includes(value)) throw new Error("Invalid query.recordTypes.");
  for (const value of query.sourceSubsystems ?? []) if (!Object.values(AIAuditSourceSubsystem).includes(value)) throw new Error("Invalid query.sourceSubsystems.");
  for (const value of query.privacyLevels ?? []) if (!Object.values(PrivacyLevel).includes(value)) throw new Error("Invalid query.privacyLevels.");
  if (query.taskType !== undefined && !Object.values(AITaskType).includes(query.taskType)) throw new Error("Invalid query.taskType.");
}

export function validateAIAuditExportEnums(format: AIAuditExportFormat, destination: AIAuditExportDestination): void {
  if (!Object.values(AIAuditExportFormat).includes(format)) throw new Error("Invalid export format.");
  if (!Object.values(AIAuditExportDestination).includes(destination)) throw new Error("Invalid export destination.");
}
