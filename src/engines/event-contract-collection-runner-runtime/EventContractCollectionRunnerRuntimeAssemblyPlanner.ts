import { createHash } from "node:crypto";

import {
  COLLECTION_RUNNER_RUNTIME_MAXIMUM_WORK_SNAPSHOT_TASKS,
  CollectionRunnerPilotState,
  CollectionRunnerRuntimeAssemblyAction,
  CollectionRunnerRuntimeCleanupDisposition,
  CollectionRunnerRuntimeFoundationErrorCode,
  CollectionRunnerRuntimeHealthStatus,
  CollectionRunnerRuntimeInvocationState,
  CollectionRunnerRuntimeMode,
  CollectionRunnerRuntimeStepOutcome,
  CollectionRunnerSourceLane,
  CollectionRunnerTaskState,
  EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION,
  type CollectionRunnerRuntimeAssemblyDecision,
  type CollectionRunnerRuntimeAssemblyPlannerInput,
  type CollectionRunnerRuntimeT6ExecutionRequest,
  type CollectionRunnerRuntimeTerminalReport,
  type CollectionRunnerRuntimeTerminalReportInput,
  type CollectionRunnerRuntimeWorkSnapshot,
  type CollectionRunnerRuntimeWorkSnapshotInput,
  type CollectionRunnerRuntimeWorkSnapshotTask,
  type CollectionRunnerRuntimeWorkSnapshotTaskInput,
} from "../../contracts";
import { EventContractCollectionRunnerRuntimeFoundationError } from "./EventContractCollectionRunnerRuntimeFoundation";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const REASON_CODE = /^[A-Z][A-Z0-9_]{0,63}$/u;
const UTC_MILLISECOND =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const FINGERPRINT =
  /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const TERMINAL_TASK_STATES = new Set<CollectionRunnerTaskState>([
  CollectionRunnerTaskState.Committed,
  CollectionRunnerTaskState.Missed,
  CollectionRunnerTaskState.TerminalFailed,
  CollectionRunnerTaskState.Cancelled,
]);
const RECONCILIATION_TASK_STATES = new Set<CollectionRunnerTaskState>([
  CollectionRunnerTaskState.Leased,
  CollectionRunnerTaskState.InFlight,
  CollectionRunnerTaskState.Validating,
  CollectionRunnerTaskState.Blocked,
]);
const TERMINAL_INVOCATION_STATES = new Set<CollectionRunnerRuntimeInvocationState>([
  CollectionRunnerRuntimeInvocationState.Closed,
  CollectionRunnerRuntimeInvocationState.StartBlocked,
  CollectionRunnerRuntimeInvocationState.RecoveryBlocked,
  CollectionRunnerRuntimeInvocationState.FailedClosed,
]);

const LIFECYCLE_TRANSITIONS = new Map<
  CollectionRunnerRuntimeInvocationState,
  ReadonlySet<CollectionRunnerRuntimeInvocationState>
>([
  [
    CollectionRunnerRuntimeInvocationState.Created,
    new Set([
      CollectionRunnerRuntimeInvocationState.ConfigurationVerified,
      CollectionRunnerRuntimeInvocationState.StartBlocked,
      CollectionRunnerRuntimeInvocationState.Stopping,
    ]),
  ],
  [
    CollectionRunnerRuntimeInvocationState.ConfigurationVerified,
    new Set([
      CollectionRunnerRuntimeInvocationState.OwnershipAcquired,
      CollectionRunnerRuntimeInvocationState.StartBlocked,
      CollectionRunnerRuntimeInvocationState.Stopping,
    ]),
  ],
  [
    CollectionRunnerRuntimeInvocationState.OwnershipAcquired,
    new Set([
      CollectionRunnerRuntimeInvocationState.StoreInspected,
      CollectionRunnerRuntimeInvocationState.RecoveryBlocked,
      CollectionRunnerRuntimeInvocationState.FailedClosed,
      CollectionRunnerRuntimeInvocationState.Stopping,
    ]),
  ],
  [
    CollectionRunnerRuntimeInvocationState.StoreInspected,
    new Set([
      CollectionRunnerRuntimeInvocationState.SessionAuthorized,
      CollectionRunnerRuntimeInvocationState.RecoveryBlocked,
      CollectionRunnerRuntimeInvocationState.FailedClosed,
      CollectionRunnerRuntimeInvocationState.Stopping,
    ]),
  ],
  [
    CollectionRunnerRuntimeInvocationState.SessionAuthorized,
    new Set([
      CollectionRunnerRuntimeInvocationState.PreflightReady,
      CollectionRunnerRuntimeInvocationState.FailedClosed,
      CollectionRunnerRuntimeInvocationState.Stopping,
    ]),
  ],
  [
    CollectionRunnerRuntimeInvocationState.PreflightReady,
    new Set([
      CollectionRunnerRuntimeInvocationState.ActionSelected,
      CollectionRunnerRuntimeInvocationState.FailedClosed,
      CollectionRunnerRuntimeInvocationState.Stopping,
    ]),
  ],
  [
    CollectionRunnerRuntimeInvocationState.ActionSelected,
    new Set([
      CollectionRunnerRuntimeInvocationState.ActionExecuting,
      CollectionRunnerRuntimeInvocationState.Reporting,
      CollectionRunnerRuntimeInvocationState.FailedClosed,
      CollectionRunnerRuntimeInvocationState.Stopping,
    ]),
  ],
  [
    CollectionRunnerRuntimeInvocationState.ActionExecuting,
    new Set([
      CollectionRunnerRuntimeInvocationState.Reporting,
      CollectionRunnerRuntimeInvocationState.FailedClosed,
      CollectionRunnerRuntimeInvocationState.Stopping,
    ]),
  ],
  [
    CollectionRunnerRuntimeInvocationState.Reporting,
    new Set([
      CollectionRunnerRuntimeInvocationState.Closing,
      CollectionRunnerRuntimeInvocationState.FailedClosed,
      CollectionRunnerRuntimeInvocationState.Stopping,
    ]),
  ],
  [
    CollectionRunnerRuntimeInvocationState.Stopping,
    new Set([
      CollectionRunnerRuntimeInvocationState.Closing,
      CollectionRunnerRuntimeInvocationState.FailedClosed,
    ]),
  ],
  [
    CollectionRunnerRuntimeInvocationState.Closing,
    new Set([
      CollectionRunnerRuntimeInvocationState.Closed,
      CollectionRunnerRuntimeInvocationState.FailedClosed,
    ]),
  ],
]);

function fail(
  code: CollectionRunnerRuntimeFoundationErrorCode,
  message: string,
): never {
  throw new EventContractCollectionRunnerRuntimeFoundationError(code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (!isRecord(value)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      `${label} must be an object.`,
    );
  }
  const actual = Object.keys(value).sort();
  const closed = [...expected].sort();
  if (
    actual.length !== closed.length ||
    actual.some((key, index) => key !== closed[index])
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      `${label} fields do not match the closed contract.`,
    );
  }
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
    .join(",")}}`;
}

function fingerprint(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(canonicalize(value), "utf8")
    .digest("hex")}`;
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

function identifier(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      `${field} must be a canonical identifier.`,
    );
  }
}

function fingerprintValue(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== "string" || !FINGERPRINT.test(value)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      `${field} must be a canonical fingerprint.`,
    );
  }
}

function utc(value: unknown, field: string): number {
  if (typeof value !== "string" || !UTC_MILLISECOND.test(value)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      `${field} must be canonical millisecond UTC.`,
    );
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      `${field} must be a real canonical UTC timestamp.`,
    );
  }
  return parsed;
}

function safeInteger(
  value: unknown,
  field: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): asserts value is number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < minimum ||
    (value as number) > maximum
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      `${field} must be a safe integer inside its reviewed bounds.`,
    );
  }
}

function validateTaskInput(
  task: CollectionRunnerRuntimeWorkSnapshotTaskInput,
  seen: Set<string>,
): void {
  exactKeys(
    task,
    [
      "aggregateVersion",
      "attemptsStarted",
      "deadlineAtUtc",
      "evidenceCutoffAtUtc",
      "requiredActionAtUtc",
      "retryEligibleAtUtc",
      "sourceLane",
      "state",
      "taskFingerprint",
      "taskId",
    ],
    "work snapshot task",
  );
  identifier(task.taskId, "task.taskId");
  if (seen.has(task.taskId)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
      "Work snapshot task IDs must be unique.",
    );
  }
  seen.add(task.taskId);
  if (!Object.values(CollectionRunnerSourceLane).includes(task.sourceLane)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
      "Work snapshot task source lane is invalid.",
    );
  }
  if (!Object.values(CollectionRunnerTaskState).includes(task.state)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
      "Work snapshot task state is invalid.",
    );
  }
  safeInteger(task.aggregateVersion, "task.aggregateVersion", 1);
  safeInteger(task.attemptsStarted, "task.attemptsStarted", 0, 2);
  fingerprintValue(task.taskFingerprint, "task.taskFingerprint");
  const required = utc(task.requiredActionAtUtc, "task.requiredActionAtUtc");
  const cutoff = utc(task.evidenceCutoffAtUtc, "task.evidenceCutoffAtUtc");
  const deadline = utc(task.deadlineAtUtc, "task.deadlineAtUtc");
  if (required > cutoff || cutoff > deadline) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
      "Work snapshot task chronology is invalid.",
    );
  }
  if (task.retryEligibleAtUtc !== null) {
    const retry = utc(task.retryEligibleAtUtc, "task.retryEligibleAtUtc");
    if (
      task.state !== CollectionRunnerTaskState.RetryWait ||
      retry < required ||
      retry >= cutoff
    ) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
        "Work snapshot retry chronology or state is invalid.",
      );
    }
  } else if (task.state === CollectionRunnerTaskState.RetryWait) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
      "RETRY_WAIT task requires retry eligibility.",
    );
  }
}

function taskRecord(
  input: CollectionRunnerRuntimeWorkSnapshotTaskInput,
): CollectionRunnerRuntimeWorkSnapshotTask {
  const base = structuredClone(input);
  return deepFreeze({
    ...base,
    deterministic: true as const,
    fingerprint: fingerprint(base),
  }) as CollectionRunnerRuntimeWorkSnapshotTask;
}

function validateBudget(
  value: CollectionRunnerRuntimeWorkSnapshotInput["budget"],
): void {
  exactKeys(
    value,
    [
      "aggregateVersion",
      "eventsScheduled",
      "maximumEvents",
      "maximumRequests",
      "maximumRetries",
      "requestsStarted",
      "retriesStarted",
      "tasksMissed",
    ],
    "work snapshot budget",
  );
  safeInteger(value.aggregateVersion, "budget.aggregateVersion", 1);
  safeInteger(
    value.maximumEvents,
    "budget.maximumEvents",
    1,
    COLLECTION_RUNNER_RUNTIME_MAXIMUM_WORK_SNAPSHOT_TASKS,
  );
  safeInteger(value.eventsScheduled, "budget.eventsScheduled");
  safeInteger(value.tasksMissed, "budget.tasksMissed");
  safeInteger(value.maximumRequests, "budget.maximumRequests", 1);
  safeInteger(value.requestsStarted, "budget.requestsStarted");
  safeInteger(value.maximumRetries, "budget.maximumRetries");
  safeInteger(value.retriesStarted, "budget.retriesStarted");
  if (
    value.eventsScheduled > value.maximumEvents ||
    value.tasksMissed > value.eventsScheduled ||
    value.requestsStarted > value.maximumRequests ||
    value.retriesStarted > value.maximumRetries
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
      "Work snapshot budget counters exceed their reviewed limits.",
    );
  }
}

function validateLease(
  value: NonNullable<CollectionRunnerRuntimeWorkSnapshotInput["currentLease"]>,
  taskIds: ReadonlySet<string>,
): void {
  exactKeys(
    value,
    [
      "acquiredAtUtc",
      "bootIdentity",
      "expiresAtUtc",
      "leaseToken",
      "processSessionId",
      "taskId",
    ],
    "work snapshot lease",
  );
  identifier(value.taskId, "lease.taskId");
  identifier(value.leaseToken, "lease.leaseToken");
  identifier(value.bootIdentity, "lease.bootIdentity");
  identifier(value.processSessionId, "lease.processSessionId");
  if (!taskIds.has(value.taskId)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
      "Work snapshot lease task is absent from the bounded task set.",
    );
  }
  const acquired = utc(value.acquiredAtUtc, "lease.acquiredAtUtc");
  const expires = utc(value.expiresAtUtc, "lease.expiresAtUtc");
  if (acquired >= expires) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
      "Work snapshot lease chronology is invalid.",
    );
  }
}

export function createCollectionRunnerRuntimeWorkSnapshot(
  input: CollectionRunnerRuntimeWorkSnapshotInput,
): CollectionRunnerRuntimeWorkSnapshot {
  exactKeys(
    input,
    [
      "activationId",
      "activationStopsAtUtc",
      "budget",
      "currentLease",
      "emergencyStopObserved",
      "observedAtUtc",
      "openAttemptId",
      "pilotAggregateVersion",
      "pilotState",
      "schemaVersion",
      "sessionAuthorizationExpiresAtUtc",
      "sessionAuthorizationId",
      "tasks",
    ],
    "work snapshot input",
  );
  if (
    input.schemaVersion !==
    EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
      "Work snapshot schema version is unsupported.",
    );
  }
  identifier(input.activationId, "snapshot.activationId");
  identifier(
    input.sessionAuthorizationId,
    "snapshot.sessionAuthorizationId",
  );
  if (!Object.values(CollectionRunnerPilotState).includes(input.pilotState)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
      "Work snapshot Pilot state is invalid.",
    );
  }
  safeInteger(input.pilotAggregateVersion, "snapshot.pilotAggregateVersion", 1);
  const observed = utc(input.observedAtUtc, "snapshot.observedAtUtc");
  const stops = utc(input.activationStopsAtUtc, "snapshot.activationStopsAtUtc");
  const sessionExpires = utc(
    input.sessionAuthorizationExpiresAtUtc,
    "snapshot.sessionAuthorizationExpiresAtUtc",
  );
  if (typeof input.emergencyStopObserved !== "boolean") {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
      "Work snapshot Emergency Stop state must be boolean.",
    );
  }
  if (!Array.isArray(input.tasks)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
      "Work snapshot tasks must be an array.",
    );
  }
  validateBudget(input.budget);
  if (
    input.tasks.length > input.budget.maximumEvents ||
    input.tasks.length >
      COLLECTION_RUNNER_RUNTIME_MAXIMUM_WORK_SNAPSHOT_TASKS
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
      "Work snapshot task count exceeds its reviewed bound.",
    );
  }
  const seen = new Set<string>();
  for (const task of input.tasks) validateTaskInput(task, seen);
  if (input.currentLease !== null) validateLease(input.currentLease, seen);
  if (input.openAttemptId !== null) {
    identifier(input.openAttemptId, "snapshot.openAttemptId");
    if (input.currentLease === null) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
        "Open attempt requires an exact current lease.",
      );
    }
  }
  if (
    input.pilotState === CollectionRunnerPilotState.Active &&
    observed > stops &&
    !input.emergencyStopObserved
  ) {
    // Expired ACTIVE state is valid recovery evidence; planner must stop it.
  }
  if (sessionExpires < observed && input.currentLease !== null) {
    // An expired session with a lease is preserved for recovery classification.
  }
  const tasks = input.tasks.map((task) => taskRecord(task));
  const base = {
    ...structuredClone(input),
    tasks,
  };
  return deepFreeze({
    ...base,
    deterministic: true as const,
    fingerprint: fingerprint(base),
  }) as CollectionRunnerRuntimeWorkSnapshot;
}

export function verifyCollectionRunnerRuntimeWorkSnapshot(
  value: CollectionRunnerRuntimeWorkSnapshot,
): CollectionRunnerRuntimeWorkSnapshot {
  exactKeys(
    value,
    [
      "activationId",
      "activationStopsAtUtc",
      "budget",
      "currentLease",
      "deterministic",
      "emergencyStopObserved",
      "fingerprint",
      "observedAtUtc",
      "openAttemptId",
      "pilotAggregateVersion",
      "pilotState",
      "schemaVersion",
      "sessionAuthorizationExpiresAtUtc",
      "sessionAuthorizationId",
      "tasks",
    ],
    "work snapshot",
  );
  if (value.deterministic !== true) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
      "Work snapshot must declare deterministic construction.",
    );
  }
  fingerprintValue(value.fingerprint, "snapshot.fingerprint");
  const rebuilt = createCollectionRunnerRuntimeWorkSnapshot({
    schemaVersion: value.schemaVersion,
    activationId: value.activationId,
    pilotState: value.pilotState,
    pilotAggregateVersion: value.pilotAggregateVersion,
    activationStopsAtUtc: value.activationStopsAtUtc,
    sessionAuthorizationId: value.sessionAuthorizationId,
    sessionAuthorizationExpiresAtUtc:
      value.sessionAuthorizationExpiresAtUtc,
    emergencyStopObserved: value.emergencyStopObserved,
    budget: value.budget,
    currentLease: value.currentLease,
    openAttemptId: value.openAttemptId,
    tasks: value.tasks.map((task) => {
      exactKeys(
        task,
        [
          "aggregateVersion",
          "attemptsStarted",
          "deadlineAtUtc",
          "deterministic",
          "evidenceCutoffAtUtc",
          "fingerprint",
          "requiredActionAtUtc",
          "retryEligibleAtUtc",
          "sourceLane",
          "state",
          "taskFingerprint",
          "taskId",
        ],
        "work snapshot task record",
      );
      if (
        task.deterministic !== true ||
        fingerprint({
          taskId: task.taskId,
          sourceLane: task.sourceLane,
          state: task.state,
          aggregateVersion: task.aggregateVersion,
          requiredActionAtUtc: task.requiredActionAtUtc,
          evidenceCutoffAtUtc: task.evidenceCutoffAtUtc,
          deadlineAtUtc: task.deadlineAtUtc,
          retryEligibleAtUtc: task.retryEligibleAtUtc,
          attemptsStarted: task.attemptsStarted,
          taskFingerprint: task.taskFingerprint,
        }) !== task.fingerprint
      ) {
        fail(
          CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
          "Work snapshot task record fingerprint is invalid.",
        );
      }
      return {
        taskId: task.taskId,
        sourceLane: task.sourceLane,
        state: task.state,
        aggregateVersion: task.aggregateVersion,
        requiredActionAtUtc: task.requiredActionAtUtc,
        evidenceCutoffAtUtc: task.evidenceCutoffAtUtc,
        deadlineAtUtc: task.deadlineAtUtc,
        retryEligibleAtUtc: task.retryEligibleAtUtc,
        attemptsStarted: task.attemptsStarted,
        taskFingerprint: task.taskFingerprint,
      };
    }),
    observedAtUtc: value.observedAtUtc,
  });
  if (rebuilt.fingerprint !== value.fingerprint) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
      "Work snapshot fingerprint does not match its content.",
    );
  }
  return value;
}

function laneOrder(value: CollectionRunnerSourceLane): number {
  return value === CollectionRunnerSourceLane.Platform ? 0 : 1;
}

function orderTasks(
  left: CollectionRunnerRuntimeWorkSnapshotTask,
  right: CollectionRunnerRuntimeWorkSnapshotTask,
): number {
  return (
    Date.parse(left.requiredActionAtUtc) -
      Date.parse(right.requiredActionAtUtc) ||
    Date.parse(left.evidenceCutoffAtUtc) -
      Date.parse(right.evidenceCutoffAtUtc) ||
    Date.parse(left.deadlineAtUtc) - Date.parse(right.deadlineAtUtc) ||
    laneOrder(left.sourceLane) - laneOrder(right.sourceLane) ||
    left.taskId.localeCompare(right.taskId)
  );
}

function decision(
  action: CollectionRunnerRuntimeAssemblyAction,
  reasonCode: string,
  task: CollectionRunnerRuntimeWorkSnapshotTask | null = null,
  budgetVersion: number | null = null,
  waitUntilUtc: string | null = null,
): CollectionRunnerRuntimeAssemblyDecision {
  const base = {
    action,
    taskId: task?.taskId ?? null,
    expectedTaskVersion: task?.aggregateVersion ?? null,
    expectedBudgetVersion: budgetVersion,
    waitUntilUtc,
    reasonCode,
    deterministic: true as const,
  };
  return deepFreeze({
    ...base,
    fingerprint: fingerprint(base),
  }) as CollectionRunnerRuntimeAssemblyDecision;
}

function validatePlannerInput(
  input: CollectionRunnerRuntimeAssemblyPlannerInput,
): number {
  exactKeys(
    input,
    [
      "clockHealthy",
      "configurationIdentityVerified",
      "lockOwnershipVerified",
      "nowUtc",
      "processSessionAuthorized",
      "runtimeMode",
      "schemaVersion",
      "snapshot",
      "stopBarrierTripped",
    ],
    "assembly planner input",
  );
  if (
    input.schemaVersion !==
      EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION ||
    input.runtimeMode !== CollectionRunnerRuntimeMode.FixtureOnly
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      "Assembly planner requires the reviewed schema and FIXTURE_ONLY mode.",
    );
  }
  for (const key of [
    "clockHealthy",
    "configurationIdentityVerified",
    "lockOwnershipVerified",
    "processSessionAuthorized",
    "stopBarrierTripped",
  ] as const) {
    if (typeof input[key] !== "boolean") {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
        `Assembly planner ${key} must be boolean.`,
      );
    }
  }
  const now = utc(input.nowUtc, "planner.nowUtc");
  verifyCollectionRunnerRuntimeWorkSnapshot(input.snapshot);
  if (input.snapshot.observedAtUtc !== input.nowUtc) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      "Planner time must exactly match the work snapshot observation.",
    );
  }
  return now;
}

export class EventContractCollectionRunnerRuntimeAssemblyPlanner {
  public plan(
    input: CollectionRunnerRuntimeAssemblyPlannerInput,
  ): CollectionRunnerRuntimeAssemblyDecision {
    const now = validatePlannerInput(input);
    if (!input.configurationIdentityVerified) {
      return decision(
        CollectionRunnerRuntimeAssemblyAction.FailClosed,
        "CONFIGURATION_IDENTITY_DRIFT",
      );
    }
    if (!input.lockOwnershipVerified) {
      return decision(
        CollectionRunnerRuntimeAssemblyAction.FailClosed,
        "LOCK_OWNERSHIP_UNVERIFIED",
      );
    }
    if (!input.processSessionAuthorized) {
      return decision(
        CollectionRunnerRuntimeAssemblyAction.FailClosed,
        "PROCESS_SESSION_UNAUTHORIZED",
      );
    }
    if (!input.clockHealthy || input.snapshot.emergencyStopObserved) {
      return decision(
        CollectionRunnerRuntimeAssemblyAction.TripEmergencyStop,
        input.clockHealthy ? "EMERGENCY_STOP_OBSERVED" : "CLOCK_UNHEALTHY",
      );
    }
    if (
      input.stopBarrierTripped ||
      input.snapshot.pilotState === CollectionRunnerPilotState.StopRequested
    ) {
      return decision(
        CollectionRunnerRuntimeAssemblyAction.RequestGracefulCompletion,
        input.stopBarrierTripped
          ? "PROCESS_STOP_BARRIER_TRIPPED"
          : "DURABLE_STOP_REQUESTED",
      );
    }
    if (
      input.snapshot.pilotState !== CollectionRunnerPilotState.Active
    ) {
      return decision(
        CollectionRunnerRuntimeAssemblyAction.CompleteAndExit,
        "PILOT_NOT_ACTIVE",
      );
    }
    if (now > Date.parse(input.snapshot.activationStopsAtUtc)) {
      return decision(
        CollectionRunnerRuntimeAssemblyAction.RequestGracefulCompletion,
        "ACTIVATION_WINDOW_CLOSED",
      );
    }
    if (
      now > Date.parse(input.snapshot.sessionAuthorizationExpiresAtUtc)
    ) {
      return decision(
        CollectionRunnerRuntimeAssemblyAction.FailClosed,
        "PROCESS_SESSION_EXPIRED",
      );
    }
    if (
      input.snapshot.currentLease !== null ||
      input.snapshot.openAttemptId !== null
    ) {
      return decision(
        CollectionRunnerRuntimeAssemblyAction.FailClosed,
        "RECOVERY_RECONCILIATION_REQUIRED",
      );
    }
    if (
      input.snapshot.budget.requestsStarted >=
        input.snapshot.budget.maximumRequests ||
      input.snapshot.budget.retriesStarted >
        input.snapshot.budget.maximumRetries
    ) {
      return decision(
        CollectionRunnerRuntimeAssemblyAction.RequestGracefulCompletion,
        "BUDGET_EXHAUSTED",
      );
    }
    const openTasks = [...input.snapshot.tasks]
      .filter((task) => !TERMINAL_TASK_STATES.has(task.state))
      .sort(orderTasks);
    if (openTasks.length === 0) {
      return decision(
        CollectionRunnerRuntimeAssemblyAction.CompleteAndExit,
        "NO_OPEN_TASKS",
      );
    }
    const reconciliation = openTasks.find((task) =>
      RECONCILIATION_TASK_STATES.has(task.state),
    );
    if (reconciliation !== undefined) {
      return decision(
        CollectionRunnerRuntimeAssemblyAction.FailClosed,
        "TASK_RECONCILIATION_REQUIRED",
        reconciliation,
      );
    }
    const missed = openTasks.find(
      (task) =>
        now >= Date.parse(task.evidenceCutoffAtUtc) ||
        now >= Date.parse(task.deadlineAtUtc),
    );
    if (missed !== undefined) {
      return decision(
        CollectionRunnerRuntimeAssemblyAction.MarkExactTaskMissed,
        "TASK_EVIDENCE_WINDOW_CLOSED",
        missed,
        input.snapshot.budget.aggregateVersion,
      );
    }
    const due = openTasks.find(
      (task) =>
        task.state === CollectionRunnerTaskState.Due &&
        now >= Date.parse(task.requiredActionAtUtc),
    );
    if (due !== undefined) {
      return decision(
        CollectionRunnerRuntimeAssemblyAction.ExecuteExactFixtureTask,
        "EXACT_DUE_FIXTURE_TASK_SELECTED",
        due,
        input.snapshot.budget.aggregateVersion,
      );
    }
    const transition = openTasks.find(
      (task) =>
        (task.state === CollectionRunnerTaskState.Scheduled &&
          now >= Date.parse(task.requiredActionAtUtc)) ||
        (task.state === CollectionRunnerTaskState.RetryWait &&
          task.retryEligibleAtUtc !== null &&
          now >= Date.parse(task.retryEligibleAtUtc)),
    );
    if (transition !== undefined) {
      return decision(
        CollectionRunnerRuntimeAssemblyAction.TransitionExactTaskDue,
        transition.state === CollectionRunnerTaskState.RetryWait
          ? "EXACT_RETRY_TASK_REQUIRES_DUE_TRANSITION"
          : "EXACT_SCHEDULED_TASK_REQUIRES_DUE_TRANSITION",
        transition,
        input.snapshot.budget.aggregateVersion,
      );
    }
    const nextTimes = openTasks.flatMap((task) => {
      const values = [task.requiredActionAtUtc];
      if (task.retryEligibleAtUtc !== null) values.push(task.retryEligibleAtUtc);
      return values.filter((value) => Date.parse(value) > now);
    });
    if (nextTimes.length === 0) {
      return decision(
        CollectionRunnerRuntimeAssemblyAction.FailClosed,
        "NO_REVIEWED_ACTION_FOR_OPEN_TASK",
      );
    }
    nextTimes.sort((left, right) => Date.parse(left) - Date.parse(right));
    return decision(
      CollectionRunnerRuntimeAssemblyAction.WaitAndExit,
      "NEXT_ACTION_IS_IN_FUTURE",
      null,
      null,
      nextTimes[0]!,
    );
  }
}

export function createCollectionRunnerRuntimeT6ExecutionRequest(
  decisionValue: CollectionRunnerRuntimeAssemblyDecision,
  snapshotValue: CollectionRunnerRuntimeWorkSnapshot,
): CollectionRunnerRuntimeT6ExecutionRequest {
  const snapshot = verifyCollectionRunnerRuntimeWorkSnapshot(snapshotValue);
  const expectedDecisionFingerprint = fingerprint({
    action: decisionValue.action,
    taskId: decisionValue.taskId,
    expectedTaskVersion: decisionValue.expectedTaskVersion,
    expectedBudgetVersion: decisionValue.expectedBudgetVersion,
    waitUntilUtc: decisionValue.waitUntilUtc,
    reasonCode: decisionValue.reasonCode,
    deterministic: decisionValue.deterministic,
  });
  if (
    decisionValue.deterministic !== true ||
    expectedDecisionFingerprint !== decisionValue.fingerprint ||
    (decisionValue.action !==
      CollectionRunnerRuntimeAssemblyAction.TransitionExactTaskDue &&
      decisionValue.action !==
        CollectionRunnerRuntimeAssemblyAction.MarkExactTaskMissed) ||
    decisionValue.taskId === null ||
    decisionValue.expectedTaskVersion === null ||
    decisionValue.expectedBudgetVersion === null ||
    decisionValue.waitUntilUtc !== null ||
    !REASON_CODE.test(decisionValue.reasonCode)
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      "T6 request requires an exact verified T6 planner decision.",
    );
  }
  const task = snapshot.tasks.find(
    (candidate) => candidate.taskId === decisionValue.taskId,
  );
  if (
    task === undefined ||
    task.aggregateVersion !== decisionValue.expectedTaskVersion ||
    snapshot.budget.aggregateVersion !==
      decisionValue.expectedBudgetVersion
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      "T6 decision versions do not match the exact work snapshot.",
    );
  }
  const base = {
    schemaVersion:
      EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION,
    activationId: snapshot.activationId,
    action: decisionValue.action,
    taskId: task.taskId,
    expectedTaskVersion: task.aggregateVersion,
    expectedBudgetVersion: snapshot.budget.aggregateVersion,
    observedAtUtc: snapshot.observedAtUtc,
    workSnapshotFingerprint: snapshot.fingerprint,
    plannerDecisionFingerprint: decisionValue.fingerprint,
    reasonCode: decisionValue.reasonCode,
    deterministic: true as const,
  };
  return deepFreeze({
    ...base,
    fingerprint: fingerprint(base),
  }) as CollectionRunnerRuntimeT6ExecutionRequest;
}

export function transitionCollectionRunnerRuntimeInvocation(
  current: CollectionRunnerRuntimeInvocationState,
  next: CollectionRunnerRuntimeInvocationState,
): CollectionRunnerRuntimeInvocationState {
  if (
    !Object.values(CollectionRunnerRuntimeInvocationState).includes(current) ||
    !Object.values(CollectionRunnerRuntimeInvocationState).includes(next) ||
    TERMINAL_INVOCATION_STATES.has(current) ||
    !LIFECYCLE_TRANSITIONS.get(current)?.has(next)
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidLifecycleTransition,
      "Runtime invocation lifecycle transition is not allowed.",
    );
  }
  return next;
}

export function createCollectionRunnerRuntimeTerminalReport(
  input: CollectionRunnerRuntimeTerminalReportInput,
): CollectionRunnerRuntimeTerminalReport {
  exactKeys(
    input,
    [
      "action",
      "activationId",
      "ambiguityPreserved",
      "blockerCodes",
      "bootIdentity",
      "buildFingerprint",
      "cleanupDisposition",
      "configurationFingerprint",
      "durableMutationAttempted",
      "durableReceiptFingerprint",
      "elapsedMonotonicMilliseconds",
      "endedAtUtc",
      "finalState",
      "healthStatus",
      "invocationId",
      "lockFingerprint",
      "outcome",
      "pathFingerprint",
      "processSessionId",
      "reasonCode",
      "recoveryRequired",
      "schemaVersion",
      "startedAtUtc",
      "stopBarrierTripped",
      "storeIdentity",
      "taskId",
    ],
    "terminal report input",
  );
  if (
    input.schemaVersion !==
    EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      "Terminal report schema version is unsupported.",
    );
  }
  for (const [field, value] of [
    ["configurationFingerprint", input.configurationFingerprint],
    ["pathFingerprint", input.pathFingerprint],
    ["storeIdentity", input.storeIdentity],
    ["buildFingerprint", input.buildFingerprint],
  ] as const) {
    fingerprintValue(value, `report.${field}`);
  }
  if (input.lockFingerprint !== null) {
    fingerprintValue(input.lockFingerprint, "report.lockFingerprint");
  }
  if (input.durableReceiptFingerprint !== null) {
    fingerprintValue(
      input.durableReceiptFingerprint,
      "report.durableReceiptFingerprint",
    );
  }
  for (const [field, value] of [
    ["activationId", input.activationId],
    ["invocationId", input.invocationId],
  ] as const) {
    identifier(value, `report.${field}`);
  }
  if (input.bootIdentity !== null) {
    identifier(input.bootIdentity, "report.bootIdentity");
  }
  if (input.processSessionId !== null) {
    identifier(input.processSessionId, "report.processSessionId");
  }
  if (input.taskId !== null) identifier(input.taskId, "report.taskId");
  if (!REASON_CODE.test(input.reasonCode)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      "Terminal report reason code is invalid.",
    );
  }
  const started = utc(input.startedAtUtc, "report.startedAtUtc");
  const ended = utc(input.endedAtUtc, "report.endedAtUtc");
  if (ended < started) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      "Terminal report cannot end before it starts.",
    );
  }
  safeInteger(
    input.elapsedMonotonicMilliseconds,
    "report.elapsedMonotonicMilliseconds",
  );
  if (
    !TERMINAL_INVOCATION_STATES.has(input.finalState) ||
    !Object.values(CollectionRunnerRuntimeStepOutcome).includes(input.outcome) ||
    !Object.values(CollectionRunnerRuntimeCleanupDisposition).includes(
      input.cleanupDisposition,
    ) ||
    !Object.values(CollectionRunnerRuntimeHealthStatus).includes(
      input.healthStatus as CollectionRunnerRuntimeHealthStatus,
    ) ||
    (input.action !== null &&
      !Object.values(CollectionRunnerRuntimeAssemblyAction).includes(
        input.action,
      ))
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      "Terminal report enum value is invalid.",
    );
  }
  for (const key of [
    "ambiguityPreserved",
    "durableMutationAttempted",
    "recoveryRequired",
    "stopBarrierTripped",
  ] as const) {
    if (typeof input[key] !== "boolean") {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
        `Terminal report ${key} must be boolean.`,
      );
    }
  }
  if (!Array.isArray(input.blockerCodes)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      "Terminal report blocker codes must be an array.",
    );
  }
  const blockers = [...input.blockerCodes];
  if (
    blockers.some((code) => !REASON_CODE.test(code)) ||
    new Set(blockers).size !== blockers.length ||
    blockers.some((code, index) => index > 0 && blockers[index - 1]! > code)
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      "Terminal report blocker codes must be canonical, unique, and ordered.",
    );
  }
  if (
    input.ambiguityPreserved !== input.recoveryRequired ||
    (input.cleanupDisposition ===
      CollectionRunnerRuntimeCleanupDisposition.VerifiedCleanRelease &&
      input.recoveryRequired) ||
    (input.outcome === CollectionRunnerRuntimeStepOutcome.Ambiguous &&
      !input.ambiguityPreserved)
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      "Terminal report cleanup and recovery semantics conflict.",
    );
  }
  if (
    input.healthStatus === CollectionRunnerRuntimeHealthStatus.Healthy &&
    (input.finalState !== CollectionRunnerRuntimeInvocationState.Closed ||
      blockers.length > 0 ||
      input.recoveryRequired ||
      input.cleanupDisposition !==
        CollectionRunnerRuntimeCleanupDisposition.VerifiedCleanRelease ||
      (input.outcome !== CollectionRunnerRuntimeStepOutcome.Completed &&
        input.outcome !== CollectionRunnerRuntimeStepOutcome.NoWork &&
        input.outcome !== CollectionRunnerRuntimeStepOutcome.Stopped))
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      "A healthy terminal report requires an unblocked verified clean close.",
    );
  }
  if (
    (input.finalState === CollectionRunnerRuntimeInvocationState.FailedClosed ||
      input.outcome === CollectionRunnerRuntimeStepOutcome.FailedClosed) &&
    input.healthStatus !== CollectionRunnerRuntimeHealthStatus.FailClosed
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      "A fail-closed terminal state or outcome requires fail-closed health.",
    );
  }
  if (
    (input.outcome === CollectionRunnerRuntimeStepOutcome.Blocked ||
      input.finalState ===
        CollectionRunnerRuntimeInvocationState.StartBlocked ||
      input.finalState ===
        CollectionRunnerRuntimeInvocationState.RecoveryBlocked) &&
    blockers.length === 0
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      "A blocked terminal report requires at least one blocker code.",
    );
  }
  if (
    (!input.durableMutationAttempted &&
      input.durableReceiptFingerprint !== null) ||
    (input.durableMutationAttempted &&
      !input.recoveryRequired &&
      input.durableReceiptFingerprint === null)
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
      "Terminal report durable mutation and receipt evidence conflict.",
    );
  }
  const base = structuredClone(input);
  return deepFreeze({
    ...base,
    deterministic: true as const,
    fingerprint: fingerprint(base),
  }) as CollectionRunnerRuntimeTerminalReport;
}
