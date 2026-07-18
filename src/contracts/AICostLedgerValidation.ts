import {
  AICostLedgerBusinessOrderStatus,
  AICostLedgerEntryType,
  AICostLedgerSourceSubsystem,
  type AICostLedgerEntry,
  type AICostLedgerEntryInput,
  type AICostLedgerPolicy,
  type AICostLedgerQuery,
} from "./AICostLedger";
import { AIReservationState } from "./AIReservationManager";
import { AITaskType } from "./AIRouter";

const SECRET_KEY_PATTERN = /(api.?key|secret|password|credential|authorization|bearer|private.?key|access.?token)/i;
const CURRENCY_PATTERN = /^[A-Z][A-Z0-9]{2,7}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

export function canonicalizeAICostLedgerValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return JSON.stringify(`[${String(value)}]`);
    return JSON.stringify(value);
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (value === undefined) return '"[Undefined]"';
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeAICostLedgerValue).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, entry]) =>
          `${JSON.stringify(key)}:${canonicalizeAICostLedgerValue(entry)}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function nonEmpty(name: string, value: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${name}: expected a non-empty string.`);
  }
}

function identifier(name: string, value: string): void {
  nonEmpty(name, value);
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`Invalid ${name}: unsupported identifier characters.`);
  }
}

function timestamp(name: string, value: string): void {
  nonEmpty(name, value);
  if (
    !Number.isFinite(Date.parse(value)) ||
    !/(Z|[+-]\d{2}:\d{2})$/.test(value)
  ) {
    throw new Error(
      `Invalid ${name}: expected an ISO-8601 timestamp with an explicit timezone.`,
    );
  }
}

function nonNegativeSafeInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid ${name}: expected a non-negative safe integer.`);
  }
}

function positiveSafeInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Invalid ${name}: expected a positive safe integer.`);
  }
}

function validateCurrency(name: string, value: string): void {
  if (!CURRENCY_PATTERN.test(value)) {
    throw new Error(`Invalid ${name}: expected an uppercase currency identifier.`);
  }
}

function validateMetadata(
  metadata: AICostLedgerEntryInput["metadata"],
  rejectSecretKeys: boolean,
): void {
  if (metadata === null || Array.isArray(metadata) || typeof metadata !== "object") {
    throw new Error("Invalid entry.metadata: expected a scalar-value object.");
  }
  for (const [key, value] of Object.entries(metadata)) {
    identifier("entry.metadata key", key);
    if (rejectSecretKeys && SECRET_KEY_PATTERN.test(key)) {
      throw new Error("Invalid entry.metadata: secret-bearing keys are forbidden.");
    }
    if (
      value !== null &&
      typeof value !== "string" &&
      typeof value !== "boolean" &&
      !(typeof value === "number" && Number.isSafeInteger(value))
    ) {
      throw new Error(
        "Invalid entry.metadata: values must be strings, booleans, null, or safe integers.",
      );
    }
  }
}

function isReservationEntry(type: AICostLedgerEntryType): boolean {
  return ![
    AICostLedgerEntryType.CriticalOverrideUsed,
    AICostLedgerEntryType.ManualAdjustment,
  ].includes(type);
}

function isUsageEntry(type: AICostLedgerEntryType): boolean {
  return [
    AICostLedgerEntryType.UsagePartiallyCommitted,
    AICostLedgerEntryType.UsageCommitted,
  ].includes(type);
}

export function validateAICostLedgerPolicy(policy: AICostLedgerPolicy): void {
  identifier("policy.policyId", policy.policyId);
  identifier("policy.version", policy.version);
  for (const authorization of policy.authorizedManualAdjustmentReferences) {
    identifier("policy.authorizedManualAdjustmentReferences", authorization);
  }
  if (
    new Set(policy.authorizedManualAdjustmentReferences).size !==
    policy.authorizedManualAdjustmentReferences.length
  ) {
    throw new Error(
      "Invalid policy.authorizedManualAdjustmentReferences: duplicate values are forbidden.",
    );
  }
}

export function validateAICostLedgerEntryInput(
  entry: AICostLedgerEntryInput,
  policy?: AICostLedgerPolicy,
): void {
  if (entry.schemaVersion !== "1.0") {
    throw new Error("Invalid entry.schemaVersion: expected 1.0.");
  }
  if (entry.integrityVersion !== "1.0") {
    throw new Error("Invalid entry.integrityVersion: expected 1.0.");
  }
  identifier("entry.entryId", entry.entryId);
  identifier("entry.requestId", entry.requestId);
  identifier("entry.operationId", entry.operationId);
  identifier("entry.idempotencyKey", entry.idempotencyKey);
  identifier("entry.policyVersion", entry.policyVersion);
  identifier("entry.reasonCode", entry.reasonCode);
  identifier("entry.sourceAuditRecordId", entry.sourceAuditRecordId);
  identifier("entry.correlationId", entry.correlationId);
  if (entry.reservationId !== undefined) identifier("entry.reservationId", entry.reservationId);
  if (entry.executionId !== undefined) identifier("entry.executionId", entry.executionId);
  if (entry.providerId !== undefined) identifier("entry.providerId", entry.providerId);
  if (entry.modelId !== undefined) identifier("entry.modelId", entry.modelId);
  if (entry.traceId !== undefined) identifier("entry.traceId", entry.traceId);
  timestamp("entry.timestamp", entry.timestamp);
  if (!Object.values(AICostLedgerEntryType).includes(entry.entryType)) {
    throw new Error(`Invalid entry.entryType: received ${String(entry.entryType)}.`);
  }
  if (!Object.values(AICostLedgerSourceSubsystem).includes(entry.sourceSubsystem)) {
    throw new Error(
      `Invalid entry.sourceSubsystem: received ${String(entry.sourceSubsystem)}.`,
    );
  }
  nonNegativeSafeInteger("entry.amount.minorUnits", entry.amount.minorUnits);
  validateCurrency("entry.amount.currency", entry.amount.currency);
  if (isReservationEntry(entry.entryType)) {
    if (entry.reservationId === undefined) {
      throw new Error("Invalid entry.reservationId: required for reservation events.");
    }
    if (
      entry.reservationStateBefore === undefined ||
      entry.reservationStateAfter === undefined ||
      entry.reservationVersion === undefined
    ) {
      throw new Error(
        "Invalid entry reservation transition: states and version are required.",
      );
    }
    if (
      !Object.values(AIReservationState).includes(entry.reservationStateBefore) ||
      !Object.values(AIReservationState).includes(entry.reservationStateAfter)
    ) {
      throw new Error("Invalid entry reservation state.");
    }
    positiveSafeInteger("entry.reservationVersion", entry.reservationVersion);
  }
  if (isUsageEntry(entry.entryType) && entry.executionId === undefined) {
    throw new Error("Invalid entry.executionId: required for usage commitment.");
  }
  if (entry.taskType !== undefined && !Object.values(AITaskType).includes(entry.taskType)) {
    throw new Error(`Invalid entry.taskType: received ${String(entry.taskType)}.`);
  }
  validateMetadata(entry.metadata, policy?.rejectSecretMetadataKeys ?? true);

  if (entry.entryType === AICostLedgerEntryType.ManualAdjustment) {
    if (entry.manualAdjustment === undefined) {
      throw new Error("Invalid entry.manualAdjustment: required for manual adjustment.");
    }
    if (entry.sourceSubsystem !== AICostLedgerSourceSubsystem.OwnerAdjustment) {
      throw new Error(
        "Invalid entry.sourceSubsystem: manual adjustments require OWNER_ADJUSTMENT.",
      );
    }
    if (!Number.isSafeInteger(entry.manualAdjustment.deltaMinorUnits)) {
      throw new Error(
        "Invalid entry.manualAdjustment.deltaMinorUnits: expected a signed safe integer.",
      );
    }
    if (entry.manualAdjustment.deltaMinorUnits === 0) {
      throw new Error(
        "Invalid entry.manualAdjustment.deltaMinorUnits: zero adjustment is forbidden.",
      );
    }
    if (Math.abs(entry.manualAdjustment.deltaMinorUnits) !== entry.amount.minorUnits) {
      throw new Error(
        "Invalid entry.manualAdjustment: amount must equal the absolute signed delta.",
      );
    }
    identifier(
      "entry.manualAdjustment.authorizationReference",
      entry.manualAdjustment.authorizationReference,
    );
    nonEmpty("entry.manualAdjustment.ownerReason", entry.manualAdjustment.ownerReason);
    identifier("entry.manualAdjustment.targetScope", entry.manualAdjustment.targetScope);
    if (policy !== undefined) {
      if (!policy.allowManualAdjustments) {
        throw new Error("Invalid entry.manualAdjustment: policy does not allow adjustments.");
      }
      if (
        !policy.authorizedManualAdjustmentReferences.includes(
          entry.manualAdjustment.authorizationReference,
        )
      ) {
        throw new Error(
          "Invalid entry.manualAdjustment: authorization reference is not permitted.",
        );
      }
    }
  } else if (entry.manualAdjustment !== undefined) {
    throw new Error(
      "Invalid entry.manualAdjustment: allowed only for MANUAL_ADJUSTMENT.",
    );
  }
}

export function validateAICostLedgerEntry(entry: AICostLedgerEntry): void {
  validateAICostLedgerEntryInput(entry);
  positiveSafeInteger("entry.sequence", entry.sequence);
  if (
    !Object.values(AICostLedgerBusinessOrderStatus).includes(
      entry.businessOrderStatus,
    )
  ) {
    throw new Error("Invalid entry.businessOrderStatus.");
  }
  nonEmpty("entry.payloadFingerprint", entry.payloadFingerprint);
}

export function validateAICostLedgerQuery(query: AICostLedgerQuery): void {
  if (query.fromSequence !== undefined) positiveSafeInteger("query.fromSequence", query.fromSequence);
  if (query.toSequence !== undefined) positiveSafeInteger("query.toSequence", query.toSequence);
  if (
    query.fromSequence !== undefined &&
    query.toSequence !== undefined &&
    query.fromSequence > query.toSequence
  ) {
    throw new Error("Invalid query sequence range.");
  }
  if (query.fromTimestamp !== undefined) timestamp("query.fromTimestamp", query.fromTimestamp);
  if (query.toTimestamp !== undefined) timestamp("query.toTimestamp", query.toTimestamp);
  if (
    query.fromTimestamp !== undefined &&
    query.toTimestamp !== undefined &&
    Date.parse(query.fromTimestamp) > Date.parse(query.toTimestamp)
  ) {
    throw new Error("Invalid query timestamp range.");
  }
  for (const [name, value] of [
    ["query.requestId", query.requestId],
    ["query.reservationId", query.reservationId],
    ["query.executionId", query.executionId],
    ["query.providerId", query.providerId],
    ["query.modelId", query.modelId],
  ] as const) {
    if (value !== undefined) identifier(name, value);
  }
  if (query.currency !== undefined) validateCurrency("query.currency", query.currency);
  if (query.taskType !== undefined && !Object.values(AITaskType).includes(query.taskType)) {
    throw new Error(`Invalid query.taskType: received ${String(query.taskType)}.`);
  }
  if (query.entryTypes !== undefined) {
    for (const type of query.entryTypes) {
      if (!Object.values(AICostLedgerEntryType).includes(type)) {
        throw new Error(`Invalid query.entryTypes: received ${String(type)}.`);
      }
    }
  }
}
