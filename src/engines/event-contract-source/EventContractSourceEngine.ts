import {
  EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID,
  EVENT_CONTRACT_OBSERVATION_MAX_ATOMIC_DIGITS,
  EVENT_CONTRACT_OBSERVATION_MAX_DECIMAL_SCALE,
  EVENT_CONTRACT_OBSERVATION_OUTCOME_PAIR,
  EVENT_CONTRACT_SOURCE_SCHEMA_VERSION,
  EventContractEvaluationMethod,
  EventContractObservationEventType,
  EventContractSourceAuthorizationStatus,
  EventContractSourceCapability,
  EventContractSourceClass,
  EventContractSourceCredentialMode,
  EventContractSourceExecutionMode,
  EventContractSourceIssueCode,
  EventContractSourceMappingReviewStatus,
  EventContractThresholdOperator,
  type EventContractSourceIssue,
  type EventContractSourceMapping,
  type EventContractSourceMappingInput,
  type EventContractSourcePolicy,
  type EventContractSourceProvider,
  type EventContractSourceProviderInput,
  type EventContractSourceSnapshot,
  type EventContractSourceSnapshotInput,
  type EventContractSourceTerms,
} from "../../contracts";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const FINGERPRINT = /^fnv1a64:[a-f0-9]{16}$/u;
const INTEGER = /^(?:0|[1-9][0-9]*)$/u;
const PROVIDER_INPUT_KEYS = ["schemaVersion", "providerId", "displayName", "sourceClass", "exchangeId", "capabilities", "executionModes", "credentialMode", "documentationReferences", "active"] as const;
const PROVIDER_KEYS = [...PROVIDER_INPUT_KEYS, "fingerprint", "authorizationStatus", "deterministic", "readOnly"] as const;
const MAPPING_INPUT_KEYS = ["schemaVersion", "mappingId", "version", "createdAt", "reviewStatus", "reviewedAt", "reviewerId", "evidenceIds", "provider", "robinhoodIdentity", "externalIdentity", "robinhoodTerms", "externalTerms"] as const;
const MAPPING_KEYS = [...MAPPING_INPUT_KEYS, "eligibleForCollection", "fingerprint", "authorizationStatus", "deterministic", "readOnly"] as const;
const SNAPSHOT_INPUT_KEYS = ["schemaVersion", "snapshotId", "provider", "mapping", "capability", "executionMode", "sourceRecordId", "observedAt", "publishedAt", "receivedAt", "normalizedAt", "payloadFingerprint", "rawPayloadBytes", "recordCount"] as const;
const SNAPSHOT_KEYS = [...SNAPSHOT_INPUT_KEYS, "providerFingerprint", "mappingFingerprint", "fingerprint", "authorizationStatus", "deterministic", "readOnly"] as const;
const ROBINHOOD_IDENTITY_KEYS = ["exchangeId", "marketId", "contractId", "termsId"] as const;
const EXTERNAL_IDENTITY_KEYS = ["providerId", "exchangeId", "eventId", "marketId", "contractId", "nativeTicker"] as const;
const TERMS_KEYS = ["title", "termsVersion", "eventType", "instrumentId", "outcomePair", "windowStartsAt", "tradingClosesAt", "evaluatesAt", "evaluationMethod", "thresholdOperator", "targetPrice", "settlementSourceId"] as const;
const DECIMAL_KEYS = ["atomicValue", "scale"] as const;

const CAPABILITIES: Readonly<Record<EventContractSourceClass, readonly EventContractSourceCapability[]>> = {
  [EventContractSourceClass.Platform]: [EventContractSourceCapability.MarketDiscovery, EventContractSourceCapability.ContractTerms, EventContractSourceCapability.TopOfBook],
  [EventContractSourceClass.Exchange]: [EventContractSourceCapability.MarketDiscovery, EventContractSourceCapability.ContractTerms, EventContractSourceCapability.TopOfBook, EventContractSourceCapability.Trades, EventContractSourceCapability.Settlement],
  [EventContractSourceClass.SettlementReference]: [EventContractSourceCapability.ReferencePrice, EventContractSourceCapability.Settlement],
  [EventContractSourceClass.OperatorEvidence]: [EventContractSourceCapability.ContractTerms, EventContractSourceCapability.TopOfBook],
};

export const DEFAULT_EVENT_CONTRACT_SOURCE_POLICY: EventContractSourcePolicy = deepFreeze({
  policyId: "event-contract-source:fixture-only:1",
  version: "1.0",
  ruleSetVersion: "1.0",
  allowedSnapshotExecutionModes: [EventContractSourceExecutionMode.Fixture],
  maximumRawPayloadBytes: 1_000_000,
  maximumRecordCount: 1_000,
});

/** The only non-fixture source policy authorized by the T3B8 implementation. */
export const INITIAL_BOUNDED_EVENT_CONTRACT_LIVE_READ_POLICY: EventContractSourcePolicy = deepFreeze({
  policyId: "event-contract-source:bounded-live-read-smoke:1",
  version: "1.0",
  ruleSetVersion: "1.0",
  allowedSnapshotExecutionModes: [EventContractSourceExecutionMode.BoundedLiveRead],
  maximumRawPayloadBytes: 100_000,
  maximumRecordCount: 1,
});

export class EventContractSourceValidationError extends Error {
  public constructor(public readonly issues: readonly EventContractSourceIssue[]) {
    super("Event contract source validation failed.");
    this.name = "EventContractSourceValidationError";
  }
}

export class EventContractSourceEngine {
  readonly #policy: EventContractSourcePolicy;

  public constructor(policy: Readonly<EventContractSourcePolicy> = DEFAULT_EVENT_CONTRACT_SOURCE_POLICY) {
    const issues = validatePolicy(policy);
    if (issues.length > 0) throw new EventContractSourceValidationError(issues);
    this.#policy = deepFreeze(structuredClone(policy));
  }

  public createProvider(value: unknown): EventContractSourceProvider {
    const issues = validateProviderInput(value, PROVIDER_INPUT_KEYS);
    fail(issues);
    const input = structuredClone(value) as EventContractSourceProviderInput;
    const base = {
      ...input,
      capabilities: [...input.capabilities].sort(),
      executionModes: [...input.executionModes].sort(),
      documentationReferences: [...input.documentationReferences].sort(),
      authorizationStatus: EventContractSourceAuthorizationStatus.ResearchSourceOnly,
      deterministic: true as const,
      readOnly: true as const,
    };
    return deepFreeze({ ...base, fingerprint: fingerprint(base) });
  }

  public verifyProvider(value: unknown): EventContractSourceProvider {
    const issues = validateProviderInput(value, PROVIDER_KEYS);
    validateRecordAuthority(value, issues);
    if (isRecord(value) && typeof value.fingerprint === "string") {
      const { fingerprint: declared, ...base } = value;
      if (!FINGERPRINT.test(declared) || fingerprint(base) !== declared) add(issues, EventContractSourceIssueCode.InvalidFingerprint, "provider.fingerprint", "Provider fingerprint is invalid.");
    }
    fail(issues);
    return deepFreeze(structuredClone(value) as unknown as EventContractSourceProvider);
  }

  public createMapping(value: unknown): EventContractSourceMapping {
    const issues = validateMappingInput(value, MAPPING_INPUT_KEYS, this);
    fail(issues);
    const input = structuredClone(value) as EventContractSourceMappingInput;
    const eligibleForCollection = input.reviewStatus === EventContractSourceMappingReviewStatus.ReviewedExact;
    const base = {
      ...input,
      evidenceIds: [...input.evidenceIds].sort(),
      eligibleForCollection,
      authorizationStatus: EventContractSourceAuthorizationStatus.ResearchSourceOnly,
      deterministic: true as const,
      readOnly: true as const,
    };
    return deepFreeze({ ...base, fingerprint: fingerprint(base) });
  }

  public verifyMapping(value: unknown): EventContractSourceMapping {
    const issues = validateMappingInput(value, MAPPING_KEYS, this);
    validateRecordAuthority(value, issues);
    if (isRecord(value)) {
      const expectedEligibility = value.reviewStatus === EventContractSourceMappingReviewStatus.ReviewedExact;
      if (value.eligibleForCollection !== expectedEligibility) add(issues, EventContractSourceIssueCode.InvalidMapping, "mapping.eligibleForCollection", "Mapping eligibility is inconsistent with review status.");
      if (typeof value.fingerprint === "string") {
        const { fingerprint: declared, ...base } = value;
        if (!FINGERPRINT.test(declared) || fingerprint(base) !== declared) add(issues, EventContractSourceIssueCode.InvalidFingerprint, "mapping.fingerprint", "Mapping fingerprint is invalid.");
      }
    }
    fail(issues);
    return deepFreeze(structuredClone(value) as unknown as EventContractSourceMapping);
  }

  public createSnapshot(value: unknown): EventContractSourceSnapshot {
    const issues = validateSnapshotInput(value, SNAPSHOT_INPUT_KEYS, this, this.#policy);
    fail(issues);
    const input = structuredClone(value) as EventContractSourceSnapshotInput;
    const base = {
      ...input,
      providerFingerprint: input.provider.fingerprint,
      mappingFingerprint: input.mapping?.fingerprint ?? null,
      authorizationStatus: EventContractSourceAuthorizationStatus.ResearchSourceOnly,
      deterministic: true as const,
      readOnly: true as const,
    };
    return deepFreeze({ ...base, fingerprint: fingerprint(base) });
  }

  public verifySnapshot(value: unknown): EventContractSourceSnapshot {
    const issues = validateSnapshotInput(value, SNAPSHOT_KEYS, this, this.#policy);
    validateRecordAuthority(value, issues);
    if (isRecord(value)) {
      const provider = isRecord(value.provider) ? value.provider : undefined;
      const mapping = isRecord(value.mapping) ? value.mapping : undefined;
      if (value.providerFingerprint !== provider?.fingerprint || value.mappingFingerprint !== (mapping?.fingerprint ?? null)) {
        add(issues, EventContractSourceIssueCode.InvalidFingerprint, "snapshot", "Snapshot lineage fingerprints are invalid.");
      }
      if (typeof value.fingerprint === "string") {
        const { fingerprint: declared, ...base } = value;
        if (!FINGERPRINT.test(declared) || fingerprint(base) !== declared) add(issues, EventContractSourceIssueCode.InvalidFingerprint, "snapshot.fingerprint", "Snapshot fingerprint is invalid.");
      }
    }
    fail(issues);
    return deepFreeze(structuredClone(value) as unknown as EventContractSourceSnapshot);
  }
}

function validateProviderInput(value: unknown, keys: readonly string[]): EventContractSourceIssue[] {
  const issues: EventContractSourceIssue[] = [];
  if (!isRecord(value)) return [issue(EventContractSourceIssueCode.InvalidRecord, "provider", "Provider must be an object.")];
  exactKeys(issues, value, keys, "provider");
  if (value.schemaVersion !== EVENT_CONTRACT_SOURCE_SCHEMA_VERSION) add(issues, EventContractSourceIssueCode.InvalidRecord, "provider.schemaVersion", "Provider schema version is unsupported.");
  identifier(issues, value.providerId, "provider.providerId");
  text(issues, value.displayName, "provider.displayName", 120);
  enumValue(issues, EventContractSourceClass, value.sourceClass, "provider.sourceClass", EventContractSourceIssueCode.InvalidProvider);
  if (value.sourceClass === EventContractSourceClass.Exchange) identifier(issues, value.exchangeId, "provider.exchangeId");
  else if (value.exchangeId !== null) add(issues, EventContractSourceIssueCode.InvalidProvider, "provider.exchangeId", "Only exchange-authoritative sources declare an exchange identity.");
  uniqueEnums(issues, value.capabilities, EventContractSourceCapability, "provider.capabilities", EventContractSourceIssueCode.InvalidCapability);
  uniqueEnums(issues, value.executionModes, EventContractSourceExecutionMode, "provider.executionModes", EventContractSourceIssueCode.InvalidExecutionMode);
  if (Array.isArray(value.capabilities) && Object.values(EventContractSourceClass).includes(value.sourceClass as EventContractSourceClass)) {
    const allowed = CAPABILITIES[value.sourceClass as EventContractSourceClass];
    for (const capability of value.capabilities) if (!allowed.includes(capability as EventContractSourceCapability)) add(issues, EventContractSourceIssueCode.InvalidCapability, "provider.capabilities", "Source class cannot claim this capability.");
  }
  enumValue(issues, EventContractSourceCredentialMode, value.credentialMode, "provider.credentialMode", EventContractSourceIssueCode.InvalidCredentialMode);
  if (value.sourceClass === EventContractSourceClass.OperatorEvidence && value.credentialMode !== EventContractSourceCredentialMode.None) {
    add(issues, EventContractSourceIssueCode.InvalidCredentialMode, "provider.credentialMode", "Operator evidence cannot declare a credential.");
  }
  stringArray(issues, value.documentationReferences, "provider.documentationReferences", true, (entry) => /^https:\/\/\S+$/u.test(entry));
  if (typeof value.active !== "boolean") add(issues, EventContractSourceIssueCode.InvalidProvider, "provider.active", "Provider active state must be boolean.");
  return issues.sort(compare);
}

function validateMappingInput(value: unknown, keys: readonly string[], engine: EventContractSourceEngine): EventContractSourceIssue[] {
  const issues: EventContractSourceIssue[] = [];
  if (!isRecord(value)) return [issue(EventContractSourceIssueCode.InvalidRecord, "mapping", "Mapping must be an object.")];
  exactKeys(issues, value, keys, "mapping");
  if (value.schemaVersion !== EVENT_CONTRACT_SOURCE_SCHEMA_VERSION) add(issues, EventContractSourceIssueCode.InvalidRecord, "mapping.schemaVersion", "Mapping schema version is unsupported.");
  identifier(issues, value.mappingId, "mapping.mappingId");
  version(issues, value.version, "mapping.version");
  timestamp(issues, value.createdAt, "mapping.createdAt");
  enumValue(issues, EventContractSourceMappingReviewStatus, value.reviewStatus, "mapping.reviewStatus", EventContractSourceIssueCode.InvalidMapping);
  stringArray(issues, value.evidenceIds, "mapping.evidenceIds", true, (entry) => IDENTIFIER.test(entry));
  try {
    const provider = engine.verifyProvider(value.provider);
    if (provider.sourceClass !== EventContractSourceClass.Exchange) add(issues, EventContractSourceIssueCode.InvalidMapping, "mapping.provider", "Only exchange-authoritative providers use cross-venue mappings.");
  } catch (error) { collect(error, issues, "mapping.provider"); }
  identity(issues, value.robinhoodIdentity, ROBINHOOD_IDENTITY_KEYS, "mapping.robinhoodIdentity");
  identity(issues, value.externalIdentity, EXTERNAL_IDENTITY_KEYS, "mapping.externalIdentity");
  terms(issues, value.robinhoodTerms, "mapping.robinhoodTerms");
  terms(issues, value.externalTerms, "mapping.externalTerms");
  const reviewed = value.reviewStatus === EventContractSourceMappingReviewStatus.ReviewedExact || value.reviewStatus === EventContractSourceMappingReviewStatus.Rejected;
  if (reviewed) {
    timestamp(issues, value.reviewedAt, "mapping.reviewedAt");
    identifier(issues, value.reviewerId, "mapping.reviewerId");
    if (isTimestamp(value.createdAt) && isTimestamp(value.reviewedAt) && Date.parse(value.reviewedAt) < Date.parse(value.createdAt)) add(issues, EventContractSourceIssueCode.InvalidChronology, "mapping.reviewedAt", "Review cannot predate mapping creation.");
  } else if (value.reviewedAt !== null || value.reviewerId !== null) {
    add(issues, EventContractSourceIssueCode.InvalidMapping, "mapping.reviewedAt", "Pending mapping cannot claim review metadata.");
  }
  if (isRecord(value.provider) && isRecord(value.robinhoodIdentity) && isRecord(value.externalIdentity)) {
    if (value.provider.providerId !== value.externalIdentity.providerId
      || value.provider.exchangeId !== value.externalIdentity.exchangeId
      || value.provider.exchangeId !== value.robinhoodIdentity.exchangeId) {
      add(issues, EventContractSourceIssueCode.MappingMismatch, "mapping", "Provider and both venue identities must bind the same exchange.");
    }
  }
  if (value.reviewStatus === EventContractSourceMappingReviewStatus.ReviewedExact
    && (!isRecord(value.robinhoodTerms) || !isRecord(value.externalTerms) || canonicalize(value.robinhoodTerms) !== canonicalize(value.externalTerms))) {
    add(issues, EventContractSourceIssueCode.MappingMismatch, "mapping.terms", "Reviewed-exact mapping terms must match completely.");
  }
  return issues.sort(compare);
}

function validateSnapshotInput(value: unknown, keys: readonly string[], engine: EventContractSourceEngine, policy: EventContractSourcePolicy): EventContractSourceIssue[] {
  const issues: EventContractSourceIssue[] = [];
  if (!isRecord(value)) return [issue(EventContractSourceIssueCode.InvalidRecord, "snapshot", "Snapshot must be an object.")];
  exactKeys(issues, value, keys, "snapshot");
  if (value.schemaVersion !== EVENT_CONTRACT_SOURCE_SCHEMA_VERSION) add(issues, EventContractSourceIssueCode.InvalidRecord, "snapshot.schemaVersion", "Snapshot schema version is unsupported.");
  identifier(issues, value.snapshotId, "snapshot.snapshotId");
  identifier(issues, value.sourceRecordId, "snapshot.sourceRecordId");
  let provider: EventContractSourceProvider | undefined;
  try { provider = engine.verifyProvider(value.provider); } catch (error) { collect(error, issues, "snapshot.provider"); }
  let mapping: EventContractSourceMapping | undefined;
  if (value.mapping !== null) {
    try { mapping = engine.verifyMapping(value.mapping); } catch (error) { collect(error, issues, "snapshot.mapping"); }
  }
  enumValue(issues, EventContractSourceCapability, value.capability, "snapshot.capability", EventContractSourceIssueCode.InvalidCapability);
  enumValue(issues, EventContractSourceExecutionMode, value.executionMode, "snapshot.executionMode", EventContractSourceIssueCode.InvalidExecutionMode);
  if (provider !== undefined) {
    if (!provider.active) add(issues, EventContractSourceIssueCode.InvalidProvider, "snapshot.provider", "Inactive provider cannot produce a snapshot.");
    if (!provider.capabilities.includes(value.capability as EventContractSourceCapability)) add(issues, EventContractSourceIssueCode.InvalidCapability, "snapshot.capability", "Capability was not declared by provider.");
    if (!provider.executionModes.includes(value.executionMode as EventContractSourceExecutionMode)) add(issues, EventContractSourceIssueCode.InvalidExecutionMode, "snapshot.executionMode", "Execution mode was not declared by provider.");
    if (provider.sourceClass === EventContractSourceClass.Exchange) {
      if (mapping === undefined || !mapping.eligibleForCollection || mapping.provider.fingerprint !== provider.fingerprint) add(issues, EventContractSourceIssueCode.MappingNotEligible, "snapshot.mapping", "Exchange snapshot requires the exact eligible provider mapping.");
    } else if (value.mapping !== null) add(issues, EventContractSourceIssueCode.InvalidMapping, "snapshot.mapping", "Non-exchange snapshot cannot claim a cross-venue mapping.");
  }
  if (!policy.allowedSnapshotExecutionModes.includes(value.executionMode as EventContractSourceExecutionMode)) add(issues, EventContractSourceIssueCode.UnauthorizedLiveRead, "snapshot.executionMode", "Execution mode is not authorized by T3B6 policy.");
  for (const field of ["observedAt", "receivedAt", "normalizedAt"] as const) timestamp(issues, value[field], `snapshot.${field}`);
  if (value.publishedAt !== null) timestamp(issues, value.publishedAt, "snapshot.publishedAt");
  if (isTimestamp(value.observedAt) && isTimestamp(value.receivedAt) && isTimestamp(value.normalizedAt)) {
    const observed = Date.parse(value.observedAt);
    const received = Date.parse(value.receivedAt);
    const normalized = Date.parse(value.normalizedAt);
    const published = value.publishedAt === null ? observed : (isTimestamp(value.publishedAt) ? Date.parse(value.publishedAt) : Number.NaN);
    if (observed > published || published > received || received > normalized) add(issues, EventContractSourceIssueCode.InvalidChronology, "snapshot", "Source chronology is invalid.");
  }
  if (typeof value.payloadFingerprint !== "string" || !FINGERPRINT.test(value.payloadFingerprint)) add(issues, EventContractSourceIssueCode.InvalidFingerprint, "snapshot.payloadFingerprint", "Payload fingerprint is invalid.");
  bound(issues, value.rawPayloadBytes, policy.maximumRawPayloadBytes, "snapshot.rawPayloadBytes");
  bound(issues, value.recordCount, policy.maximumRecordCount, "snapshot.recordCount");
  return issues.sort(compare);
}

function validatePolicy(value: unknown): EventContractSourceIssue[] {
  const issues: EventContractSourceIssue[] = [];
  if (!isRecord(value)) return [issue(EventContractSourceIssueCode.InvalidRecord, "policy", "Policy must be an object.")];
  exactKeys(issues, value, ["policyId", "version", "ruleSetVersion", "allowedSnapshotExecutionModes", "maximumRawPayloadBytes", "maximumRecordCount"], "policy");
  identifier(issues, value.policyId, "policy.policyId");
  version(issues, value.version, "policy.version");
  version(issues, value.ruleSetVersion, "policy.ruleSetVersion");
  uniqueEnums(issues, value.allowedSnapshotExecutionModes, EventContractSourceExecutionMode, "policy.allowedSnapshotExecutionModes", EventContractSourceIssueCode.InvalidExecutionMode);
  const fixtureOnly = value.policyId === DEFAULT_EVENT_CONTRACT_SOURCE_POLICY.policyId
    && value.version === DEFAULT_EVENT_CONTRACT_SOURCE_POLICY.version
    && value.ruleSetVersion === DEFAULT_EVENT_CONTRACT_SOURCE_POLICY.ruleSetVersion
    && canonicalize(value.allowedSnapshotExecutionModes) === canonicalize(DEFAULT_EVENT_CONTRACT_SOURCE_POLICY.allowedSnapshotExecutionModes)
    && value.maximumRawPayloadBytes === DEFAULT_EVENT_CONTRACT_SOURCE_POLICY.maximumRawPayloadBytes
    && value.maximumRecordCount === DEFAULT_EVENT_CONTRACT_SOURCE_POLICY.maximumRecordCount;
  const boundedLiveRead = value.policyId === INITIAL_BOUNDED_EVENT_CONTRACT_LIVE_READ_POLICY.policyId
    && value.version === INITIAL_BOUNDED_EVENT_CONTRACT_LIVE_READ_POLICY.version
    && value.ruleSetVersion === INITIAL_BOUNDED_EVENT_CONTRACT_LIVE_READ_POLICY.ruleSetVersion
    && canonicalize(value.allowedSnapshotExecutionModes) === canonicalize(INITIAL_BOUNDED_EVENT_CONTRACT_LIVE_READ_POLICY.allowedSnapshotExecutionModes)
    && value.maximumRawPayloadBytes === INITIAL_BOUNDED_EVENT_CONTRACT_LIVE_READ_POLICY.maximumRawPayloadBytes
    && value.maximumRecordCount === INITIAL_BOUNDED_EVENT_CONTRACT_LIVE_READ_POLICY.maximumRecordCount;
  if (!fixtureOnly && !boundedLiveRead) {
    add(
      issues,
      EventContractSourceIssueCode.UnauthorizedLiveRead,
      "policy.allowedSnapshotExecutionModes",
      "Only the exact fixture policy or exact T3B8 bounded-live-read policy is authorized.",
    );
  }
  bound(issues, value.maximumRawPayloadBytes, 10_000_000, "policy.maximumRawPayloadBytes");
  bound(issues, value.maximumRecordCount, 100_000, "policy.maximumRecordCount");
  return issues.sort(compare);
}

function terms(issues: EventContractSourceIssue[], value: unknown, field: string): void {
  if (!isRecord(value)) { add(issues, EventContractSourceIssueCode.InvalidTerms, field, "Terms must be an object."); return; }
  exactKeys(issues, value, TERMS_KEYS, field);
  text(issues, value.title, `${field}.title`, 300);
  version(issues, value.termsVersion, `${field}.termsVersion`);
  if (value.eventType !== EventContractObservationEventType.BtcFifteenMinute || value.instrumentId !== EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID || value.outcomePair !== EVENT_CONTRACT_OBSERVATION_OUTCOME_PAIR) add(issues, EventContractSourceIssueCode.InvalidTerms, field, "Terms must describe canonical BTC-USD 15-minute UP/DOWN.");
  for (const key of ["windowStartsAt", "tradingClosesAt", "evaluatesAt"] as const) timestamp(issues, value[key], `${field}.${key}`);
  if (isTimestamp(value.windowStartsAt) && isTimestamp(value.tradingClosesAt) && isTimestamp(value.evaluatesAt)) {
    const start = Date.parse(value.windowStartsAt); const close = Date.parse(value.tradingClosesAt); const evaluate = Date.parse(value.evaluatesAt);
    if (evaluate - start !== 900_000 || close < start || close > evaluate) add(issues, EventContractSourceIssueCode.InvalidTerms, field, "Terms window or trading close is invalid.");
  }
  enumValue(issues, EventContractEvaluationMethod, value.evaluationMethod, `${field}.evaluationMethod`, EventContractSourceIssueCode.InvalidTerms);
  enumValue(issues, EventContractThresholdOperator, value.thresholdOperator, `${field}.thresholdOperator`, EventContractSourceIssueCode.InvalidTerms);
  decimal(issues, value.targetPrice, `${field}.targetPrice`);
  identifier(issues, value.settlementSourceId, `${field}.settlementSourceId`);
}

function identity(issues: EventContractSourceIssue[], value: unknown, keys: readonly string[], field: string): void {
  if (!isRecord(value)) { add(issues, EventContractSourceIssueCode.InvalidMapping, field, "Identity must be an object."); return; }
  exactKeys(issues, value, keys, field);
  for (const key of keys) identifier(issues, value[key], `${field}.${key}`);
}

function decimal(issues: EventContractSourceIssue[], value: unknown, field: string): void {
  if (!isRecord(value)) { add(issues, EventContractSourceIssueCode.InvalidTerms, field, "Fixed decimal must be an object."); return; }
  exactKeys(issues, value, DECIMAL_KEYS, field);
  if (typeof value.atomicValue !== "string" || !INTEGER.test(value.atomicValue) || value.atomicValue === "0" || value.atomicValue.length > EVENT_CONTRACT_OBSERVATION_MAX_ATOMIC_DIGITS) add(issues, EventContractSourceIssueCode.InvalidTerms, `${field}.atomicValue`, "Atomic value must be a bounded positive integer string.");
  if (!Number.isSafeInteger(value.scale) || (value.scale as number) < 0 || (value.scale as number) > EVENT_CONTRACT_OBSERVATION_MAX_DECIMAL_SCALE) add(issues, EventContractSourceIssueCode.InvalidTerms, `${field}.scale`, "Decimal scale is invalid.");
}

function validateRecordAuthority(value: unknown, issues: EventContractSourceIssue[]): void {
  if (!isRecord(value) || value.authorizationStatus !== EventContractSourceAuthorizationStatus.ResearchSourceOnly || value.deterministic !== true || value.readOnly !== true) add(issues, EventContractSourceIssueCode.InvalidRecord, "authority", "Record authority is invalid.");
}
function collect(error: unknown, issues: EventContractSourceIssue[], field: string): void {
  if (error instanceof EventContractSourceValidationError) for (const item of error.issues) add(issues, item.code, `${field}.${item.field}`, item.message);
  else add(issues, EventContractSourceIssueCode.InvalidRecord, field, "Nested record is invalid.");
}
function fail(issues: EventContractSourceIssue[]): void {
  if (issues.length > 0) throw new EventContractSourceValidationError(deepFreeze(issues.sort(compare)));
}
function exactKeys(issues: EventContractSourceIssue[], value: Record<string, unknown>, keys: readonly string[], field: string): void {
  const expected = new Set(keys);
  for (const key of Object.keys(value)) if (!expected.has(key)) add(issues, EventContractSourceIssueCode.InvalidRecord, `${field}.${key}`, "Field is not declared.");
  for (const key of keys) if (!(key in value)) add(issues, EventContractSourceIssueCode.InvalidRecord, `${field}.${key}`, "Required field is missing.");
}
function identifier(issues: EventContractSourceIssue[], value: unknown, field: string): void {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) add(issues, EventContractSourceIssueCode.InvalidIdentifier, field, "Identifier is invalid.");
}
function version(issues: EventContractSourceIssue[], value: unknown, field: string): void {
  if (typeof value !== "string" || !VERSION.test(value)) add(issues, EventContractSourceIssueCode.InvalidVersion, field, "Version is invalid.");
}
function timestamp(issues: EventContractSourceIssue[], value: unknown, field: string): void {
  if (!isTimestamp(value)) add(issues, EventContractSourceIssueCode.InvalidTimestamp, field, "Timestamp must be canonical UTC.");
}
function text(issues: EventContractSourceIssue[], value: unknown, field: string, maximum: number): void {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0 || value.length > maximum) add(issues, EventContractSourceIssueCode.InvalidRecord, field, "Text is invalid.");
}
function enumValue(issues: EventContractSourceIssue[], values: object, value: unknown, field: string, code: EventContractSourceIssueCode): void {
  if (!Object.values(values).includes(value)) add(issues, code, field, "Enum value is invalid.");
}
function uniqueEnums(issues: EventContractSourceIssue[], value: unknown, values: object, field: string, code: EventContractSourceIssueCode): void {
  if (!Array.isArray(value) || value.length === 0) { add(issues, code, field, "At least one value is required."); return; }
  const seen = new Set<unknown>();
  for (const entry of value) {
    if (!Object.values(values).includes(entry) || seen.has(entry)) add(issues, code, field, "Values must be supported and unique.");
    seen.add(entry);
  }
}
function stringArray(issues: EventContractSourceIssue[], value: unknown, field: string, required: boolean, valid: (entry: string) => boolean): void {
  if (!Array.isArray(value) || (required && value.length === 0)) { add(issues, EventContractSourceIssueCode.InvalidRecord, field, "Non-empty array is required."); return; }
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string" || !valid(entry) || seen.has(entry)) add(issues, EventContractSourceIssueCode.InvalidRecord, field, "Entries must be valid and unique.");
    if (typeof entry === "string") seen.add(entry);
  }
}
function bound(issues: EventContractSourceIssue[], value: unknown, maximum: number, field: string): void {
  if (!Number.isSafeInteger(value) || (value as number) <= 0 || (value as number) > maximum) add(issues, EventContractSourceIssueCode.InvalidBound, field, "Value must be a bounded positive safe integer.");
}
function add(issues: EventContractSourceIssue[], code: EventContractSourceIssueCode, field: string, message: string): void { issues.push(issue(code, field, message)); }
function issue(code: EventContractSourceIssueCode, field: string, message: string): EventContractSourceIssue { return { code, field, message }; }
function compare(left: EventContractSourceIssue, right: EventContractSourceIssue): number { return left.field.localeCompare(right.field) || left.code.localeCompare(right.code) || left.message.localeCompare(right.message); }
function isTimestamp(value: unknown): value is string { if (typeof value !== "string") return false; const parsed = Date.parse(value); return Number.isFinite(parsed) && new Date(parsed).toISOString() === value; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function fingerprint(value: unknown): string { return `fnv1a64:${fnv1a64(canonicalize(value))}`; }
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`).join(",")}}`;
}
function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) { hash ^= BigInt(byte); hash = BigInt.asUintN(64, hash * 0x100000001b3n); }
  return hash.toString(16).padStart(16, "0");
}
function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
