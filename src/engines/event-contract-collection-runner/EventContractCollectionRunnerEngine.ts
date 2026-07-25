import {
  EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
  CollectionRunnerAuthorizationStatus,
  CollectionRunnerIssueCode,
  CollectionRunnerPilotState,
  CollectionRunnerSourceLane,
  CollectionRunnerTaskState,
  EventContractSourceCapability,
  EventContractSourceExecutionMode,
  type CollectionRunnerAdmissionBundle,
  type CollectionRunnerDefinition,
  type CollectionRunnerDefinitionInput,
  type CollectionRunnerIssue,
  type CollectionRunnerPilotActivation,
  type CollectionRunnerPilotActivationInput,
  type CollectionRunnerPilotStateRecord,
  type CollectionRunnerPilotTransitionInput,
  type CollectionRunnerScheduledTask,
  type CollectionRunnerScheduledTaskInput,
  type CollectionRunnerTaskStateRecord,
  type CollectionRunnerTaskTransitionInput,
} from "../../contracts";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const FINGERPRINT = /^fnv1a64:[a-f0-9]{16}$/u;
const MAX_ACTIVATION_MILLISECONDS = 7 * 24 * 60 * 60 * 1_000;

const DEFINITION_INPUT_KEYS = [
  "schemaVersion", "runnerDefinitionId", "version", "buildFingerprint",
  "supportedCapabilities", "maximumActivePilots", "maximumWorkers",
  "maximumInFlightRequests", "maximumRequestsPerSecond",
  "maximumClockOffsetMilliseconds",
] as const;
const DEFINITION_KEYS = [
  ...DEFINITION_INPUT_KEYS, "authorizationStatus", "deterministic",
  "readOnlySourceAccess", "fingerprint",
] as const;
const ACTIVATION_INPUT_KEYS = [
  "schemaVersion", "activationId", "ownerId", "approvedAt", "startsAt",
  "stopsAt", "frozenPlanId", "frozenPlanFingerprint", "runnerDefinition",
  "admittedProviderFingerprints", "admittedMappingFingerprints",
  "maximumEvents", "maximumRequests",
] as const;
const TASK_INPUT_KEYS = [
  "schemaVersion", "taskId", "observationSlot", "scheduledAt", "deadlineAt",
  "runnerDefinitionVersion", "admission",
] as const;
const ADMISSION_KEYS = [
  "frozenPlanId", "frozenPlanFingerprint", "plannedEventId", "evidenceCutoffAt",
  "providerId", "providerFingerprint", "capability", "executionMode",
  "sourceLane", "mappingId", "mappingVersion", "mappingFingerprint",
  "sourceRecordId", "requestPolicyId", "requestPolicyVersion", "bounds",
  "activationId", "activationExpiresAt",
] as const;
const BOUNDS_KEYS = [
  "maximumAttempts", "maximumRawPayloadBytes", "maximumRecordCount",
  "requestDeadlineMilliseconds",
] as const;
const PILOT_STATE_KEYS = ["activationId", "state", "aggregateVersion"] as const;
const TASK_STATE_KEYS = ["taskId", "state", "aggregateVersion"] as const;
const PILOT_TRANSITION_KEYS = ["current", "expectedAggregateVersion", "nextState"] as const;
const TASK_TRANSITION_KEYS = ["current", "expectedAggregateVersion", "nextState"] as const;

const PILOT_TRANSITIONS: Readonly<Record<CollectionRunnerPilotState, readonly CollectionRunnerPilotState[]>> = {
  [CollectionRunnerPilotState.Draft]: [CollectionRunnerPilotState.OwnerApproved],
  [CollectionRunnerPilotState.OwnerApproved]: [CollectionRunnerPilotState.Active, CollectionRunnerPilotState.Revoked],
  [CollectionRunnerPilotState.Active]: [
    CollectionRunnerPilotState.StopRequested,
    CollectionRunnerPilotState.Revoked,
    CollectionRunnerPilotState.Completed,
    CollectionRunnerPilotState.FailedClosed,
  ],
  [CollectionRunnerPilotState.StopRequested]: [CollectionRunnerPilotState.Stopped],
  [CollectionRunnerPilotState.Stopped]: [],
  [CollectionRunnerPilotState.Revoked]: [],
  [CollectionRunnerPilotState.Completed]: [],
  [CollectionRunnerPilotState.FailedClosed]: [],
};

const TASK_FAILURE_EDGES = [
  CollectionRunnerTaskState.Missed,
  CollectionRunnerTaskState.TerminalFailed,
  CollectionRunnerTaskState.Cancelled,
] as const;

const TASK_TRANSITIONS: Readonly<Record<CollectionRunnerTaskState, readonly CollectionRunnerTaskState[]>> = {
  [CollectionRunnerTaskState.Scheduled]: [
    CollectionRunnerTaskState.Blocked,
    CollectionRunnerTaskState.Due,
    ...TASK_FAILURE_EDGES,
  ],
  [CollectionRunnerTaskState.Blocked]: [
    CollectionRunnerTaskState.Due,
    ...TASK_FAILURE_EDGES,
  ],
  [CollectionRunnerTaskState.Due]: [
    CollectionRunnerTaskState.Leased,
    ...TASK_FAILURE_EDGES,
  ],
  [CollectionRunnerTaskState.Leased]: [
    CollectionRunnerTaskState.InFlight,
    ...TASK_FAILURE_EDGES,
  ],
  [CollectionRunnerTaskState.InFlight]: [
    CollectionRunnerTaskState.Validating,
    CollectionRunnerTaskState.RetryWait,
    ...TASK_FAILURE_EDGES,
  ],
  [CollectionRunnerTaskState.Validating]: [
    CollectionRunnerTaskState.Committed,
    CollectionRunnerTaskState.RetryWait,
    ...TASK_FAILURE_EDGES,
  ],
  [CollectionRunnerTaskState.RetryWait]: [
    CollectionRunnerTaskState.Due,
    ...TASK_FAILURE_EDGES,
  ],
  [CollectionRunnerTaskState.Committed]: [],
  [CollectionRunnerTaskState.Missed]: [],
  [CollectionRunnerTaskState.TerminalFailed]: [],
  [CollectionRunnerTaskState.Cancelled]: [],
};

export class EventContractCollectionRunnerValidationError extends Error {
  public constructor(public readonly issues: readonly CollectionRunnerIssue[]) {
    super("Event contract collection runner validation failed.");
    this.name = "EventContractCollectionRunnerValidationError";
  }
}

export class EventContractCollectionRunnerEngine {
  public createRunnerDefinition(value: unknown): CollectionRunnerDefinition {
    const issues: CollectionRunnerIssue[] = [];
    validateDefinitionInput(value, DEFINITION_INPUT_KEYS, issues);
    fail(issues);
    const input = structuredClone(value) as CollectionRunnerDefinitionInput;
    const base = {
      ...input,
      supportedCapabilities: [...input.supportedCapabilities].sort(),
      authorizationStatus: CollectionRunnerAuthorizationStatus.ResearchOnly,
      deterministic: true as const,
      readOnlySourceAccess: true as const,
    };
    return deepFreeze({ ...base, fingerprint: fingerprint(base) });
  }

  public verifyRunnerDefinition(value: unknown): CollectionRunnerDefinition {
    const issues: CollectionRunnerIssue[] = [];
    validateDefinitionInput(value, DEFINITION_KEYS, issues);
    if (isRecord(value)) {
      exact(value.authorizationStatus, CollectionRunnerAuthorizationStatus.ResearchOnly, issues, CollectionRunnerIssueCode.InvalidAuthority, "runnerDefinition.authorizationStatus");
      exact(value.deterministic, true, issues, CollectionRunnerIssueCode.InvalidAuthority, "runnerDefinition.deterministic");
      exact(value.readOnlySourceAccess, true, issues, CollectionRunnerIssueCode.InvalidAuthority, "runnerDefinition.readOnlySourceAccess");
      validateDeclaredFingerprint(value, issues, "runnerDefinition.fingerprint");
    }
    fail(issues);
    return deepFreeze(structuredClone(value) as unknown as CollectionRunnerDefinition);
  }

  public createPilotActivation(value: unknown): CollectionRunnerPilotActivation {
    const issues: CollectionRunnerIssue[] = [];
    validateActivationInput(value, issues, this);
    fail(issues);
    const input = structuredClone(value) as CollectionRunnerPilotActivationInput;
    const base = {
      ...input,
      admittedProviderFingerprints: [...input.admittedProviderFingerprints].sort(),
      admittedMappingFingerprints: [...input.admittedMappingFingerprints].sort(),
      state: CollectionRunnerPilotState.OwnerApproved as const,
      aggregateVersion: 1 as const,
      authorizationStatus: CollectionRunnerAuthorizationStatus.ResearchOnly,
      deterministic: true as const,
    };
    return deepFreeze({ ...base, fingerprint: fingerprint(base) });
  }

  public createScheduledTask(
    value: unknown,
    activation: unknown,
  ): CollectionRunnerScheduledTask {
    const issues: CollectionRunnerIssue[] = [];
    validateActivationArtifact(activation, issues, this);
    validateTaskInput(value, issues);
    if (isRecord(value) && isRecord(value.admission) && isActivation(activation)) {
      validateTaskAgainstActivation(value, value.admission, activation, issues);
    }
    fail(issues);
    const input = structuredClone(value) as CollectionRunnerScheduledTaskInput;
    const admission = structuredClone(input.admission) as CollectionRunnerAdmissionBundle;
    const idempotencyKey = fingerprint({
      frozenPlanFingerprint: admission.frozenPlanFingerprint,
      plannedEventId: admission.plannedEventId,
      providerFingerprint: admission.providerFingerprint,
      mappingFingerprint: admission.mappingFingerprint ?? "NONE",
      capability: admission.capability,
      sourceRecordId: admission.sourceRecordId,
      observationSlot: input.observationSlot,
      runnerDefinitionVersion: input.runnerDefinitionVersion,
    });
    const base = {
      ...input,
      admission,
      idempotencyKey,
      state: CollectionRunnerTaskState.Scheduled as const,
      aggregateVersion: 1 as const,
      authorizationStatus: CollectionRunnerAuthorizationStatus.ResearchOnly,
      deterministic: true as const,
    };
    return deepFreeze({ ...base, fingerprint: fingerprint(base) });
  }

  public transitionPilot(value: unknown): CollectionRunnerPilotStateRecord {
    const issues: CollectionRunnerIssue[] = [];
    allowRecord(value, PILOT_TRANSITION_KEYS, "transition", issues);
    if (isRecord(value)) {
      validatePilotStateRecord(value.current, issues);
      safePositiveInteger(value.expectedAggregateVersion, issues, "expectedAggregateVersion");
      enumValue(CollectionRunnerPilotState, value.nextState, issues, "nextState");
      if (isPilotStateRecord(value.current)
        && isSafePositiveInteger(value.expectedAggregateVersion)
        && enumContains(CollectionRunnerPilotState, value.nextState)) {
        validateTransition(
          value.current.state,
          value.nextState,
          value.current.aggregateVersion,
          value.expectedAggregateVersion,
          PILOT_TRANSITIONS,
          issues,
        );
      }
    }
    fail(issues);
    const input = structuredClone(value) as CollectionRunnerPilotTransitionInput;
    return deepFreeze({
      activationId: input.current.activationId,
      state: input.nextState,
      aggregateVersion: input.current.aggregateVersion + 1,
    });
  }

  public transitionTask(value: unknown): CollectionRunnerTaskStateRecord {
    const issues: CollectionRunnerIssue[] = [];
    allowRecord(value, TASK_TRANSITION_KEYS, "transition", issues);
    if (isRecord(value)) {
      validateTaskStateRecord(value.current, issues);
      safePositiveInteger(value.expectedAggregateVersion, issues, "expectedAggregateVersion");
      enumValue(CollectionRunnerTaskState, value.nextState, issues, "nextState");
      if (isTaskStateRecord(value.current)
        && isSafePositiveInteger(value.expectedAggregateVersion)
        && enumContains(CollectionRunnerTaskState, value.nextState)) {
        validateTransition(
          value.current.state,
          value.nextState,
          value.current.aggregateVersion,
          value.expectedAggregateVersion,
          TASK_TRANSITIONS,
          issues,
        );
      }
    }
    fail(issues);
    const input = structuredClone(value) as CollectionRunnerTaskTransitionInput;
    return deepFreeze({
      taskId: input.current.taskId,
      state: input.nextState,
      aggregateVersion: input.current.aggregateVersion + 1,
    });
  }
}

function validateDefinitionInput(
  value: unknown,
  keys: readonly string[],
  issues: CollectionRunnerIssue[],
): void {
  allowRecord(value, keys, "runnerDefinition", issues);
  if (!isRecord(value)) return;
  exact(value.schemaVersion, EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION, issues, CollectionRunnerIssueCode.InvalidSchemaVersion, "runnerDefinition.schemaVersion");
  identifier(value.runnerDefinitionId, issues, "runnerDefinition.runnerDefinitionId");
  version(value.version, issues, "runnerDefinition.version");
  fingerprintValue(value.buildFingerprint, issues, "runnerDefinition.buildFingerprint");
  enumArray(EventContractSourceCapability, value.supportedCapabilities, issues, "runnerDefinition.supportedCapabilities", true);
  exact(value.maximumActivePilots, 1, issues, CollectionRunnerIssueCode.InvalidBound, "runnerDefinition.maximumActivePilots");
  exact(value.maximumWorkers, 1, issues, CollectionRunnerIssueCode.InvalidBound, "runnerDefinition.maximumWorkers");
  exact(value.maximumInFlightRequests, 1, issues, CollectionRunnerIssueCode.InvalidBound, "runnerDefinition.maximumInFlightRequests");
  exact(value.maximumRequestsPerSecond, 1, issues, CollectionRunnerIssueCode.InvalidBound, "runnerDefinition.maximumRequestsPerSecond");
  exact(value.maximumClockOffsetMilliseconds, 1000, issues, CollectionRunnerIssueCode.InvalidBound, "runnerDefinition.maximumClockOffsetMilliseconds");
}

function validateActivationInput(
  value: unknown,
  issues: CollectionRunnerIssue[],
  engine: EventContractCollectionRunnerEngine,
): void {
  allowRecord(value, ACTIVATION_INPUT_KEYS, "activation", issues);
  if (!isRecord(value)) return;
  exact(value.schemaVersion, EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION, issues, CollectionRunnerIssueCode.InvalidSchemaVersion, "activation.schemaVersion");
  identifier(value.activationId, issues, "activation.activationId");
  identifier(value.ownerId, issues, "activation.ownerId");
  const approved = timestamp(value.approvedAt, issues, "activation.approvedAt");
  const starts = timestamp(value.startsAt, issues, "activation.startsAt");
  const stops = timestamp(value.stopsAt, issues, "activation.stopsAt");
  identifier(value.frozenPlanId, issues, "activation.frozenPlanId");
  fingerprintValue(value.frozenPlanFingerprint, issues, "activation.frozenPlanFingerprint");
  try {
    engine.verifyRunnerDefinition(value.runnerDefinition);
  } catch (error) {
    appendNestedIssues(error, issues, "activation.");
  }
  fingerprintArray(value.admittedProviderFingerprints, issues, "activation.admittedProviderFingerprints", true);
  fingerprintArray(value.admittedMappingFingerprints, issues, "activation.admittedMappingFingerprints", false);
  safePositiveInteger(value.maximumEvents, issues, "activation.maximumEvents");
  safePositiveInteger(value.maximumRequests, issues, "activation.maximumRequests");
  if (approved !== null && starts !== null && approved > starts) chronology(issues, "activation.approvedAt", "Approval must not follow activation start.");
  if (starts !== null && stops !== null) {
    if (starts >= stops) chronology(issues, "activation.stopsAt", "Activation stop must follow start.");
    if (stops - starts > MAX_ACTIVATION_MILLISECONDS) bound(issues, "activation.stopsAt", "Activation window must not exceed seven days.");
  }
  if (isSafePositiveInteger(value.maximumEvents)
    && isSafePositiveInteger(value.maximumRequests)
    && value.maximumRequests < value.maximumEvents) {
    bound(issues, "activation.maximumRequests", "Request budget must not be smaller than event budget.");
  }
}

function validateActivationArtifact(
  value: unknown,
  issues: CollectionRunnerIssue[],
  engine: EventContractCollectionRunnerEngine,
): void {
  const keys = [
    ...ACTIVATION_INPUT_KEYS, "state", "aggregateVersion",
    "authorizationStatus", "deterministic", "fingerprint",
  ] as const;
  allowRecord(value, keys, "activation", issues);
  if (!isRecord(value)) return;
  const input: Record<string, unknown> = {};
  for (const key of ACTIVATION_INPUT_KEYS) input[key] = value[key];
  validateActivationInput(input, issues, engine);
  exact(value.state, CollectionRunnerPilotState.OwnerApproved, issues, CollectionRunnerIssueCode.InvalidAuthority, "activation.state");
  exact(value.aggregateVersion, 1, issues, CollectionRunnerIssueCode.InvalidAuthority, "activation.aggregateVersion");
  exact(value.authorizationStatus, CollectionRunnerAuthorizationStatus.ResearchOnly, issues, CollectionRunnerIssueCode.InvalidAuthority, "activation.authorizationStatus");
  exact(value.deterministic, true, issues, CollectionRunnerIssueCode.InvalidAuthority, "activation.deterministic");
  validateDeclaredFingerprint(value, issues, "activation.fingerprint");
}

function validateTaskInput(value: unknown, issues: CollectionRunnerIssue[]): void {
  allowRecord(value, TASK_INPUT_KEYS, "task", issues);
  if (!isRecord(value)) return;
  exact(value.schemaVersion, EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION, issues, CollectionRunnerIssueCode.InvalidSchemaVersion, "task.schemaVersion");
  identifier(value.taskId, issues, "task.taskId");
  identifier(value.observationSlot, issues, "task.observationSlot");
  const scheduled = timestamp(value.scheduledAt, issues, "task.scheduledAt");
  const deadline = timestamp(value.deadlineAt, issues, "task.deadlineAt");
  version(value.runnerDefinitionVersion, issues, "task.runnerDefinitionVersion");
  validateAdmission(value.admission, issues);
  if (isRecord(value.admission)) {
    const cutoff = parseTimestamp(value.admission.evidenceCutoffAt);
    const expires = parseTimestamp(value.admission.activationExpiresAt);
    if (scheduled !== null && cutoff !== null && scheduled > cutoff) chronology(issues, "task.scheduledAt", "Task must be scheduled no later than evidence cutoff.");
    if (cutoff !== null && deadline !== null && cutoff > deadline) chronology(issues, "task.deadlineAt", "Task deadline must not precede evidence cutoff.");
    if (deadline !== null && expires !== null && deadline > expires) chronology(issues, "task.deadlineAt", "Task deadline must not exceed activation expiry.");
  }
}

function validateAdmission(value: unknown, issues: CollectionRunnerIssue[]): void {
  allowRecord(value, ADMISSION_KEYS, "task.admission", issues);
  if (!isRecord(value)) return;
  identifier(value.frozenPlanId, issues, "task.admission.frozenPlanId");
  fingerprintValue(value.frozenPlanFingerprint, issues, "task.admission.frozenPlanFingerprint");
  identifier(value.plannedEventId, issues, "task.admission.plannedEventId");
  timestamp(value.evidenceCutoffAt, issues, "task.admission.evidenceCutoffAt");
  identifier(value.providerId, issues, "task.admission.providerId");
  fingerprintValue(value.providerFingerprint, issues, "task.admission.providerFingerprint");
  enumValue(EventContractSourceCapability, value.capability, issues, "task.admission.capability");
  enumValue(EventContractSourceExecutionMode, value.executionMode, issues, "task.admission.executionMode");
  enumValue(CollectionRunnerSourceLane, value.sourceLane, issues, "task.admission.sourceLane");
  identifier(value.sourceRecordId, issues, "task.admission.sourceRecordId");
  identifier(value.requestPolicyId, issues, "task.admission.requestPolicyId");
  version(value.requestPolicyVersion, issues, "task.admission.requestPolicyVersion");
  identifier(value.activationId, issues, "task.admission.activationId");
  timestamp(value.activationExpiresAt, issues, "task.admission.activationExpiresAt");
  validateBounds(value.bounds, issues);

  if (value.sourceLane === CollectionRunnerSourceLane.Exchange) {
    identifier(value.mappingId, issues, "task.admission.mappingId", CollectionRunnerIssueCode.MappingRequired);
    version(value.mappingVersion, issues, "task.admission.mappingVersion", CollectionRunnerIssueCode.MappingRequired);
    fingerprintValue(value.mappingFingerprint, issues, "task.admission.mappingFingerprint", CollectionRunnerIssueCode.MappingRequired);
  } else if (value.sourceLane === CollectionRunnerSourceLane.Platform) {
    if (value.mappingId !== null || value.mappingVersion !== null || value.mappingFingerprint !== null) {
      add(issues, CollectionRunnerIssueCode.InvalidAdmission, "task.admission.mapping", "Platform lane must not contain an exchange mapping.");
    }
  }
}

function validateBounds(value: unknown, issues: CollectionRunnerIssue[]): void {
  allowRecord(value, BOUNDS_KEYS, "task.admission.bounds", issues);
  if (!isRecord(value)) return;
  integerRange(value.maximumAttempts, 1, 2, issues, "task.admission.bounds.maximumAttempts");
  integerRange(value.maximumRawPayloadBytes, 1, 1_000_000, issues, "task.admission.bounds.maximumRawPayloadBytes");
  integerRange(value.maximumRecordCount, 1, 1_000, issues, "task.admission.bounds.maximumRecordCount");
  integerRange(value.requestDeadlineMilliseconds, 1, 60_000, issues, "task.admission.bounds.requestDeadlineMilliseconds");
}

function validateTaskAgainstActivation(
  task: Record<string, unknown>,
  admission: Record<string, unknown>,
  activation: CollectionRunnerPilotActivation,
  issues: CollectionRunnerIssue[],
): void {
  exact(admission.activationId, activation.activationId, issues, CollectionRunnerIssueCode.InvalidAdmission, "task.admission.activationId");
  exact(admission.activationExpiresAt, activation.stopsAt, issues, CollectionRunnerIssueCode.InvalidAdmission, "task.admission.activationExpiresAt");
  exact(admission.frozenPlanId, activation.frozenPlanId, issues, CollectionRunnerIssueCode.InvalidAdmission, "task.admission.frozenPlanId");
  exact(admission.frozenPlanFingerprint, activation.frozenPlanFingerprint, issues, CollectionRunnerIssueCode.InvalidAdmission, "task.admission.frozenPlanFingerprint");
  exact(task.runnerDefinitionVersion, activation.runnerDefinition.version, issues, CollectionRunnerIssueCode.InvalidAdmission, "task.runnerDefinitionVersion");
  if (typeof admission.providerFingerprint === "string"
    && !activation.admittedProviderFingerprints.includes(admission.providerFingerprint)) {
    add(issues, CollectionRunnerIssueCode.InvalidAdmission, "task.admission.providerFingerprint", "Provider fingerprint is not admitted by activation.");
  }
  if (admission.sourceLane === CollectionRunnerSourceLane.Exchange
    && typeof admission.mappingFingerprint === "string"
    && !activation.admittedMappingFingerprints.includes(admission.mappingFingerprint)) {
    add(issues, CollectionRunnerIssueCode.InvalidAdmission, "task.admission.mappingFingerprint", "Mapping fingerprint is not admitted by activation.");
  }
  if (enumContains(EventContractSourceCapability, admission.capability)
    && !activation.runnerDefinition.supportedCapabilities.includes(admission.capability)) {
    add(issues, CollectionRunnerIssueCode.InvalidAdmission, "task.admission.capability", "Capability is not supported by runner definition.");
  }
}

function validatePilotStateRecord(value: unknown, issues: CollectionRunnerIssue[]): void {
  allowRecord(value, PILOT_STATE_KEYS, "current", issues);
  if (!isRecord(value)) return;
  identifier(value.activationId, issues, "current.activationId");
  enumValue(CollectionRunnerPilotState, value.state, issues, "current.state");
  safePositiveInteger(value.aggregateVersion, issues, "current.aggregateVersion");
}

function validateTaskStateRecord(value: unknown, issues: CollectionRunnerIssue[]): void {
  allowRecord(value, TASK_STATE_KEYS, "current", issues);
  if (!isRecord(value)) return;
  identifier(value.taskId, issues, "current.taskId");
  enumValue(CollectionRunnerTaskState, value.state, issues, "current.state");
  safePositiveInteger(value.aggregateVersion, issues, "current.aggregateVersion");
}

function validateTransition<T extends string>(
  current: T,
  next: T,
  actualVersion: number,
  expectedVersion: number,
  transitions: Readonly<Record<T, readonly T[]>>,
  issues: CollectionRunnerIssue[],
): void {
  if (actualVersion !== expectedVersion) {
    add(issues, CollectionRunnerIssueCode.VersionConflict, "expectedAggregateVersion", "Expected aggregate version does not match current version.");
    return;
  }
  const allowed = transitions[current];
  if (allowed.length === 0) {
    add(issues, CollectionRunnerIssueCode.TerminalState, "nextState", "Terminal state cannot transition.");
    return;
  }
  if (!allowed.includes(next)) {
    add(issues, CollectionRunnerIssueCode.InvalidTransition, "nextState", "State transition is not allowed.");
  }
}

function validateDeclaredFingerprint(
  value: Record<string, unknown>,
  issues: CollectionRunnerIssue[],
  field: string,
): void {
  const declared = value.fingerprint;
  if (typeof declared !== "string" || !FINGERPRINT.test(declared)) {
    add(issues, CollectionRunnerIssueCode.InvalidFingerprint, field, "Fingerprint is invalid.");
    return;
  }
  const { fingerprint: _discarded, ...base } = value;
  if (fingerprint(base) !== declared) add(issues, CollectionRunnerIssueCode.InvalidFingerprint, field, "Fingerprint does not match record.");
}

function appendNestedIssues(error: unknown, issues: CollectionRunnerIssue[], prefix: string): void {
  if (error instanceof EventContractCollectionRunnerValidationError) {
    for (const issue of error.issues) issues.push({ ...issue, field: `${prefix}${issue.field}` });
    return;
  }
  add(issues, CollectionRunnerIssueCode.InvalidRecord, prefix.slice(0, -1), "Nested record is invalid.");
}

function allowRecord(
  value: unknown,
  keys: readonly string[],
  field: string,
  issues: CollectionRunnerIssue[],
): void {
  if (!isRecord(value)) {
    add(issues, CollectionRunnerIssueCode.InvalidRecord, field, "Value must be a record.");
    return;
  }
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) add(issues, CollectionRunnerIssueCode.UnknownField, `${field}.${key}`, "Unknown field is not allowed.");
  }
  for (const key of keys) {
    if (!(key in value)) add(issues, CollectionRunnerIssueCode.InvalidRecord, `${field}.${key}`, "Required field is missing.");
  }
}

function identifier(
  value: unknown,
  issues: CollectionRunnerIssue[],
  field: string,
  code = CollectionRunnerIssueCode.InvalidIdentifier,
): void {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) add(issues, code, field, "Identifier is invalid.");
}

function version(
  value: unknown,
  issues: CollectionRunnerIssue[],
  field: string,
  code = CollectionRunnerIssueCode.InvalidVersion,
): void {
  if (typeof value !== "string" || !VERSION.test(value)) add(issues, code, field, "Version is invalid.");
}

function fingerprintValue(
  value: unknown,
  issues: CollectionRunnerIssue[],
  field: string,
  code = CollectionRunnerIssueCode.InvalidFingerprint,
): void {
  if (typeof value !== "string" || !FINGERPRINT.test(value)) add(issues, code, field, "Fingerprint is invalid.");
}

function fingerprintArray(
  value: unknown,
  issues: CollectionRunnerIssue[],
  field: string,
  requireOne: boolean,
): void {
  if (!Array.isArray(value) || (requireOne && value.length === 0)) {
    add(issues, CollectionRunnerIssueCode.InvalidAdmission, field, requireOne ? "At least one fingerprint is required." : "Fingerprints must be an array.");
    return;
  }
  const seen = new Set<string>();
  value.forEach((item, index) => {
    fingerprintValue(item, issues, `${field}[${index}]`);
    if (typeof item === "string" && seen.has(item)) add(issues, CollectionRunnerIssueCode.InvalidAdmission, `${field}[${index}]`, "Duplicate fingerprint is not allowed.");
    if (typeof item === "string") seen.add(item);
  });
}

function enumArray<T extends Record<string, string>>(
  enumObject: T,
  value: unknown,
  issues: CollectionRunnerIssue[],
  field: string,
  requireOne: boolean,
): void {
  if (!Array.isArray(value) || (requireOne && value.length === 0)) {
    add(issues, CollectionRunnerIssueCode.InvalidEnum, field, "A non-empty enum array is required.");
    return;
  }
  const seen = new Set<string>();
  value.forEach((item, index) => {
    enumValue(enumObject, item, issues, `${field}[${index}]`);
    if (typeof item === "string" && seen.has(item)) add(issues, CollectionRunnerIssueCode.InvalidEnum, `${field}[${index}]`, "Duplicate enum value is not allowed.");
    if (typeof item === "string") seen.add(item);
  });
}

function enumValue<T extends Record<string, string>>(
  enumObject: T,
  value: unknown,
  issues: CollectionRunnerIssue[],
  field: string,
): void {
  if (!enumContains(enumObject, value)) add(issues, CollectionRunnerIssueCode.InvalidEnum, field, "Enum value is invalid.");
}

function enumContains<T extends Record<string, string>>(enumObject: T, value: unknown): value is T[keyof T] {
  return typeof value === "string" && Object.values(enumObject).includes(value);
}

function timestamp(value: unknown, issues: CollectionRunnerIssue[], field: string): number | null {
  const parsed = parseTimestamp(value);
  if (parsed === null) add(issues, CollectionRunnerIssueCode.InvalidTimestamp, field, "Timestamp must be canonical UTC ISO-8601.");
  return parsed;
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

function safePositiveInteger(value: unknown, issues: CollectionRunnerIssue[], field: string): void {
  if (!isSafePositiveInteger(value)) bound(issues, field, "Value must be a positive safe integer.");
}

function isSafePositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function integerRange(
  value: unknown,
  minimum: number,
  maximum: number,
  issues: CollectionRunnerIssue[],
  field: string,
): void {
  if (!isSafePositiveInteger(value) || value < minimum || value > maximum) bound(issues, field, `Value must be a safe integer from ${minimum} through ${maximum}.`);
}

function exact(
  actual: unknown,
  expected: unknown,
  issues: CollectionRunnerIssue[],
  code: CollectionRunnerIssueCode,
  field: string,
): void {
  if (actual !== expected) add(issues, code, field, "Value does not match the required constant.");
}

function bound(issues: CollectionRunnerIssue[], field: string, message: string): void {
  add(issues, CollectionRunnerIssueCode.InvalidBound, field, message);
}

function chronology(issues: CollectionRunnerIssue[], field: string, message: string): void {
  add(issues, CollectionRunnerIssueCode.InvalidChronology, field, message);
}

function add(
  issues: CollectionRunnerIssue[],
  code: CollectionRunnerIssueCode,
  field: string,
  message: string,
): void {
  issues.push({ code, field, message });
}

function fail(issues: CollectionRunnerIssue[]): void {
  if (issues.length > 0) throw new EventContractCollectionRunnerValidationError(deepFreeze(issues));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isActivation(value: unknown): value is CollectionRunnerPilotActivation {
  return isRecord(value)
    && typeof value.activationId === "string"
    && typeof value.stopsAt === "string"
    && isRecord(value.runnerDefinition)
    && Array.isArray(value.admittedProviderFingerprints)
    && Array.isArray(value.admittedMappingFingerprints);
}

function isPilotStateRecord(value: unknown): value is CollectionRunnerPilotStateRecord {
  return isRecord(value)
    && typeof value.activationId === "string"
    && enumContains(CollectionRunnerPilotState, value.state)
    && isSafePositiveInteger(value.aggregateVersion);
}

function isTaskStateRecord(value: unknown): value is CollectionRunnerTaskStateRecord {
  return isRecord(value)
    && typeof value.taskId === "string"
    && enumContains(CollectionRunnerTaskState, value.state)
    && isSafePositiveInteger(value.aggregateVersion);
}

function fingerprint(value: unknown): string {
  return `fnv1a64:${fnv1a64(canonicalize(value))}`;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
    .join(",")}}`;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const character of new TextEncoder().encode(value)) {
    hash ^= BigInt(character);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const entry of Object.values(value as Record<string, unknown>)) deepFreeze(entry);
  }
  return value;
}
