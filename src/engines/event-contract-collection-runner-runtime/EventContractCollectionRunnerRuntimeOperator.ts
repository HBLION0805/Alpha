import { createHash } from "node:crypto";

import {
  CollectionRunnerRuntimeFoundationErrorCode,
  CollectionRunnerRuntimeHealthStatus,
  CollectionRunnerRuntimeStopMode,
  CollectionRunnerEmergencyStopTrigger,
  CollectionRunnerPilotState,
  type CollectionRunnerRuntimePreflightInput,
  type CollectionRunnerRuntimePreflightReport,
  type CollectionRunnerRuntimeConfiguration,
  type CollectionRunnerRuntimePaths,
  type CollectionRunnerWallClock,
  type CollectionRunnerMonotonicClock,
  type CollectionRunnerClockHealthProbe,
  type CollectionRunnerRuntimeSafetyEvidence,
  type CollectionRunnerRuntimeStatusInput,
  type CollectionRunnerRuntimeStatusReport,
  type CollectionRunnerRuntimeStopCommand,
  type CollectionRunnerRuntimeStopResult,
  type CollectionRunnerRuntimeStopSignal,
} from "../../contracts";
import type { CollectionRunnerLocalOwnerVerifier } from "../event-contract-collection-runner-recovery-control/EventContractCollectionRunnerRecoveryControlOperator";
import type { CollectionRunnerProcessStopBarrier } from "../../repositories/SessionGatedEventContractCollectionRunnerRepository";
import type {
  CollectionRunnerProcessSessionIdentity,
} from "../../repositories/SessionGatedEventContractCollectionRunnerRepository";
import type {
  EventContractCollectionRunnerRecoveryControlRepository,
} from "../../repositories/EventContractCollectionRunnerRecoveryControlRepository";
import type {
  CollectionRunnerClockEvidence,
  EventContractCollectionRunnerRepository,
} from "../../repositories/EventContractCollectionRunnerRepository";
import {
  CollectionRunnerRecoveryIssueCode,
  type CollectionRunnerStartupRecoveryReport,
} from "../../repositories/EventContractCollectionRunnerSqliteRecovery";
import type {
  EventContractCollectionRunnerSqliteReadiness,
} from "../../repositories/EventContractCollectionRunnerSqliteStore";
import type {
  EventContractCollectionRunnerRuntimeProjectionRepository,
} from "../../repositories/EventContractCollectionRunnerRuntimeProjectionRepository";
import {
  CollectionRunnerRuntimeOwnershipHandle,
  EventContractCollectionRunnerRuntimeFoundationError,
  sampleHealthyCollectionRunnerClocks,
} from "./EventContractCollectionRunnerRuntimeFoundation";
import { EventContractCollectionRunnerRecoveryControlEngine } from "../event-contract-collection-runner-recovery-control/EventContractCollectionRunnerRecoveryControlEngine";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u;
const REASON = /^[A-Z][A-Z0-9_]{0,63}$/u;
const FINGERPRINT =
  /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const UTC_MILLISECOND =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const TASK_STATES = new Set([
  "SCHEDULED",
  "BLOCKED",
  "DUE",
  "LEASED",
  "IN_FLIGHT",
  "VALIDATING",
  "RETRY_WAIT",
  "COMMITTED",
  "MISSED",
  "TERMINAL_FAILED",
  "CANCELLED",
]);
const PILOT_STATES = new Set([
  "OWNER_APPROVED",
  "ACTIVE",
  "STOP_REQUESTED",
  "STOPPED",
  "REVOKED",
  "COMPLETED",
  "FAILED_CLOSED",
]);
const SAFETY_KEYS = [
  "blockerCodes",
  "clockHealthy",
  "configurationVerified",
  "integrityVerified",
  "ownershipVerified",
  "sessionAuthorized",
  "stopBarrierTripped",
  "storeReady",
] as const;

export interface CollectionRunnerRuntimeDurableStopReceipt {
  readonly receiptFingerprint: string;
}

export interface CollectionRunnerRuntimeDurableStopPort {
  requestStop(
    command: Readonly<CollectionRunnerRuntimeStopCommand>,
    authorizationReference: string,
  ): CollectionRunnerRuntimeDurableStopReceipt;
}

export interface CollectionRunnerRuntimeStopNotificationPort {
  notify(signal: Readonly<CollectionRunnerRuntimeStopSignal>): boolean;
}

export interface CollectionRunnerRuntimeStopClockPort {
  evidence(observedAtUtc: string): CollectionRunnerClockEvidence;
}

export class CollectionRunnerRuntimeRepositoryStopPort
  implements CollectionRunnerRuntimeDurableStopPort
{
  readonly #recoveryEngine =
    new EventContractCollectionRunnerRecoveryControlEngine();

  public constructor(
    private readonly runner: EventContractCollectionRunnerRepository,
    private readonly recovery:
      EventContractCollectionRunnerRecoveryControlRepository,
    private readonly clock: CollectionRunnerRuntimeStopClockPort,
  ) {}

  public requestStop(
    command: Readonly<CollectionRunnerRuntimeStopCommand>,
    _authorizationReference: string,
  ): CollectionRunnerRuntimeDurableStopReceipt {
    const pilot = this.runner.getPilotState(command.activationId);
    if (
      pilot === null ||
      pilot.aggregateVersion !== command.expectedActivationAggregateVersion
    ) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.StopPersistenceFailed,
        "Durable Stop target changed before persistence.",
      );
    }
    if (command.mode === CollectionRunnerRuntimeStopMode.Graceful) {
      const result = this.runner.transitionPilot({
        activationId: command.activationId,
        expectedAggregateVersion: command.expectedActivationAggregateVersion,
        nextState: CollectionRunnerPilotState.StopRequested,
        clock: this.clock.evidence(command.requestedAtUtc),
        recoveryBlockerCount: 0,
        evidence: {
          occurredAtUtc: command.requestedAtUtc,
          reasonCode: command.reasonCode,
        },
      });
      return deepFreeze({
        receiptFingerprint: fingerprint({
          commandId: command.commandId,
          activationId: result.activationId,
          state: result.state,
          aggregateVersion: result.aggregateVersion,
        }),
      });
    }
    const commandDigest = createHash("sha256")
      .update(canonicalize(command), "utf8")
      .digest("hex");
    const receipt = this.recovery.executeEmergencyStop({
      stopEventId: `stop:${commandDigest.slice(0, 32)}`,
      idempotencyKey: `sha256:${commandDigest}`,
      activationId: command.activationId,
      expectedActivationAggregateVersion:
        command.expectedActivationAggregateVersion,
      assessment: this.#recoveryEngine.evaluateEmergencyStop({
        activationState: pilot.state,
        triggers: [CollectionRunnerEmergencyStopTrigger.OwnerRequest],
        evaluatedAtUtc: command.requestedAtUtc,
      }),
      executedAtUtc: command.requestedAtUtc,
    });
    return deepFreeze({ receiptFingerprint: receipt.fingerprint });
  }
}

export class InMemoryCollectionRunnerRuntimeStopNotificationPort
  implements CollectionRunnerRuntimeStopNotificationPort
{
  #signal: CollectionRunnerRuntimeStopSignal | null = null;

  public notify(signal: Readonly<CollectionRunnerRuntimeStopSignal>): boolean {
    if (
      this.#signal !== null &&
      this.#signal.fingerprint !== signal.fingerprint
    ) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
        "A different Stop signal already owns the process-local notification slot.",
      );
    }
    this.#signal = deepFreeze(structuredClone(signal));
    return true;
  }

  public read(): CollectionRunnerRuntimeStopSignal | null {
    return this.#signal === null
      ? null
      : deepFreeze(structuredClone(this.#signal));
  }
}

function fail(
  code: CollectionRunnerRuntimeFoundationErrorCode,
  message: string,
  cause?: unknown,
): never {
  throw new EventContractCollectionRunnerRuntimeFoundationError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: unknown,
  expected: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
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
      CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
      `${label} fields do not match the closed contract.`,
    );
  }
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
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

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

function utc(value: unknown, label: string): number {
  if (
    typeof value !== "string" ||
    !UTC_MILLISECOND.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(Date.parse(value)).toISOString() !== value
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
      `${label} must be canonical millisecond UTC.`,
    );
  }
  return Date.parse(value);
}

function identifier(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
      `${label} must be a bounded identifier.`,
    );
  }
}

function checkedFingerprint(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !FINGERPRINT.test(value)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
      `${label} must be a supported fingerprint.`,
    );
  }
}

function nonNegativeInteger(value: unknown, label: string): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
      `${label} must be a non-negative safe integer.`,
    );
  }
}

function validateSafety(
  value: CollectionRunnerRuntimeSafetyEvidence,
): CollectionRunnerRuntimeSafetyEvidence {
  exactKeys(value, SAFETY_KEYS, "Safety evidence");
  for (const key of SAFETY_KEYS.filter((key) => key !== "blockerCodes")) {
    if (typeof value[key] !== "boolean") {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
        `Safety ${key} must be boolean.`,
      );
    }
  }
  if (
    !Array.isArray(value.blockerCodes) ||
    value.blockerCodes.some(
      (code) => typeof code !== "string" || !REASON.test(code),
    ) ||
    new Set(value.blockerCodes).size !== value.blockerCodes.length
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
      "Safety blocker codes must be unique closed reason codes.",
    );
  }
  return deepFreeze({
    ...value,
    blockerCodes: [...value.blockerCodes].sort(),
  });
}

function health(
  safety: CollectionRunnerRuntimeSafetyEvidence,
): CollectionRunnerRuntimeHealthStatus {
  if (
    !safety.configurationVerified ||
    !safety.ownershipVerified ||
    !safety.integrityVerified ||
    !safety.sessionAuthorized ||
    safety.stopBarrierTripped
  ) {
    return CollectionRunnerRuntimeHealthStatus.FailClosed;
  }
  if (!safety.storeReady || !safety.clockHealthy || safety.blockerCodes.length > 0) {
    return CollectionRunnerRuntimeHealthStatus.Degraded;
  }
  return CollectionRunnerRuntimeHealthStatus.Healthy;
}

function validatePreflight(
  input: CollectionRunnerRuntimePreflightInput,
): CollectionRunnerRuntimePreflightInput {
  exactKeys(
    input,
    [
      "configurationFingerprint",
      "observedAtUtc",
      "pathFingerprint",
      "recoveryReportFingerprint",
      "safety",
      "schemaCatalogChecksum",
      "storeIdentity",
    ],
    "Preflight input",
  );
  utc(input.observedAtUtc, "preflight.observedAtUtc");
  checkedFingerprint(
    input.configurationFingerprint,
    "preflight.configurationFingerprint",
  );
  checkedFingerprint(input.pathFingerprint, "preflight.pathFingerprint");
  checkedFingerprint(
    input.recoveryReportFingerprint,
    "preflight.recoveryReportFingerprint",
  );
  checkedFingerprint(
    input.schemaCatalogChecksum,
    "preflight.schemaCatalogChecksum",
  );
  checkedFingerprint(input.storeIdentity, "preflight.storeIdentity");
  return deepFreeze({
    ...structuredClone(input),
    safety: validateSafety(input.safety),
  });
}

function validateStatus(
  input: CollectionRunnerRuntimeStatusInput,
): CollectionRunnerRuntimeStatusInput {
  exactKeys(
    input,
    [
      "activationId",
      "activationStopsAtUtc",
      "bootIdentity",
      "budget",
      "buildFingerprint",
      "clockOffsetMilliseconds",
      "configurationFingerprint",
      "currentLease",
      "lastCommitAtUtc",
      "lastReceiptAtUtc",
      "lockFingerprint",
      "observedAtUtc",
      "outbox",
      "outboxBacklog",
      "pilotState",
      "processSessionId",
      "processStartedAtUtc",
      "recoveryDisposition",
      "safety",
      "taskCounts",
    ],
    "Status input",
  );
  const now = utc(input.observedAtUtc, "status.observedAtUtc");
  utc(input.processStartedAtUtc, "status.processStartedAtUtc");
  utc(input.activationStopsAtUtc, "status.activationStopsAtUtc");
  if (Date.parse(input.processStartedAtUtc) > now) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
      "Process start cannot follow status observation.",
    );
  }
  for (const [value, label] of [
    [input.configurationFingerprint, "configurationFingerprint"],
    [input.buildFingerprint, "buildFingerprint"],
    [input.lockFingerprint, "lockFingerprint"],
  ] as const) {
    checkedFingerprint(value, `status.${label}`);
  }
  for (const [value, label] of [
    [input.bootIdentity, "bootIdentity"],
    [input.processSessionId, "processSessionId"],
    [input.activationId, "activationId"],
    [input.recoveryDisposition, "recoveryDisposition"],
  ] as const) {
    identifier(value, `status.${label}`);
  }
  if (!PILOT_STATES.has(input.pilotState)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
      "Status Pilot state is invalid.",
    );
  }
  if (!Array.isArray(input.taskCounts)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
      "Status task counts must be an array.",
    );
  }
  const countKeys = new Set<string>();
  for (const count of input.taskCounts) {
    exactKeys(count, ["count", "sourceLane", "state"], "Task count");
    if (
      (count.sourceLane !== "PLATFORM" &&
        count.sourceLane !== "EXCHANGE") ||
      typeof count.state !== "string" ||
      !TASK_STATES.has(count.state)
    ) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
        "Task count lane or state is invalid.",
      );
    }
    nonNegativeInteger(count.count, "taskCount.count");
    const key = `${count.sourceLane}:${count.state}`;
    if (countKeys.has(key)) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
        "Task count keys must be unique.",
      );
    }
    countKeys.add(key);
  }
  exactKeys(
    input.budget,
    [
      "eventsScheduled",
      "evidenceCommitted",
      "maximumEvents",
      "maximumRequests",
      "requestsStarted",
      "retriesStarted",
      "tasksMissed",
    ],
    "Budget projection",
  );
  for (const [key, value] of Object.entries(input.budget)) {
    nonNegativeInteger(value, `budget.${key}`);
  }
  if (
    input.budget.eventsScheduled > input.budget.maximumEvents ||
    input.budget.evidenceCommitted > input.budget.maximumEvents ||
    input.budget.requestsStarted > input.budget.maximumRequests
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
      "Status budget exceeds immutable activation limits.",
    );
  }
  if (input.currentLease !== null) {
    exactKeys(
      input.currentLease,
      [
        "acquiredAtUtc",
        "expiresAtUtc",
        "heartbeatAtUtc",
        "taskId",
        "workerId",
      ],
      "Lease projection",
    );
    identifier(input.currentLease.taskId, "lease.taskId");
    identifier(input.currentLease.workerId, "lease.workerId");
    const acquired = utc(input.currentLease.acquiredAtUtc, "lease.acquiredAtUtc");
    const heartbeat = utc(input.currentLease.heartbeatAtUtc, "lease.heartbeatAtUtc");
    const expires = utc(input.currentLease.expiresAtUtc, "lease.expiresAtUtc");
    if (acquired > heartbeat || heartbeat >= expires) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
        "Lease projection chronology is invalid.",
      );
    }
  }
  for (const [value, label] of [
    [input.lastReceiptAtUtc, "lastReceiptAtUtc"],
    [input.lastCommitAtUtc, "lastCommitAtUtc"],
  ] as const) {
    if (value !== null && utc(value, `status.${label}`) > now) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
        `Status ${label} cannot be future-dated.`,
      );
    }
  }
  if (
    input.clockOffsetMilliseconds !== null &&
    (!Number.isSafeInteger(input.clockOffsetMilliseconds) ||
      input.clockOffsetMilliseconds < 0)
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
      "Clock offset must be null or a non-negative safe integer.",
    );
  }
  nonNegativeInteger(input.outboxBacklog, "status.outboxBacklog");
  if (!Array.isArray(input.outbox) || input.outbox.length > 100) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
      "Status outbox projection must contain at most 100 entries.",
    );
  }
  let previousSequence = 0;
  for (const entry of input.outbox) {
    exactKeys(
      entry,
      [
        "aggregateId",
        "aggregateType",
        "aggregateVersion",
        "createdAtUtc",
        "eventFingerprint",
        "eventType",
        "lastFailureCode",
        "outboxId",
        "publishAttempts",
        "publishedAtUtc",
        "sequence",
      ],
      "Outbox projection",
    );
    nonNegativeInteger(entry.sequence, "outbox.sequence");
    nonNegativeInteger(entry.aggregateVersion, "outbox.aggregateVersion");
    nonNegativeInteger(entry.publishAttempts, "outbox.publishAttempts");
    if (entry.sequence <= previousSequence) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
        "Outbox projection sequence must be strictly increasing.",
      );
    }
    previousSequence = entry.sequence;
    for (const [value, label] of [
      [entry.outboxId, "outboxId"],
      [entry.aggregateType, "aggregateType"],
      [entry.aggregateId, "aggregateId"],
      [entry.eventType, "eventType"],
    ] as const) {
      identifier(value, `outbox.${label}`);
    }
    checkedFingerprint(entry.eventFingerprint, "outbox.eventFingerprint");
    utc(entry.createdAtUtc, "outbox.createdAtUtc");
    if (entry.publishedAtUtc !== null) {
      utc(entry.publishedAtUtc, "outbox.publishedAtUtc");
    }
    if (
      entry.lastFailureCode !== null &&
      typeof entry.lastFailureCode !== "string"
    ) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
        "Outbox failure code must be null or a string.",
      );
    }
    if (
      typeof entry.lastFailureCode === "string" &&
      !REASON.test(entry.lastFailureCode)
    ) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
        "Outbox failure code is invalid.",
      );
    }
  }
  return deepFreeze({
    ...structuredClone(input),
    safety: validateSafety(input.safety),
    taskCounts: [...input.taskCounts].sort(
      (left, right) =>
        left.sourceLane.localeCompare(right.sourceLane) ||
        left.state.localeCompare(right.state),
    ),
    outbox: [...input.outbox],
  });
}

function validateStopCommand(
  command: CollectionRunnerRuntimeStopCommand,
): CollectionRunnerRuntimeStopCommand {
  exactKeys(
    command,
    [
      "activationId",
      "authorizationExpiresAtUtc",
      "commandId",
      "configurationFingerprint",
      "expectedActivationAggregateVersion",
      "mode",
      "ownerId",
      "processSessionId",
      "reasonCode",
      "requestedAtUtc",
      "schemaVersion",
      "storeIdentity",
      "verifiedAtUtc",
    ],
    "Stop command",
  );
  if (
    command.schemaVersion !== "1.0" ||
    (command.mode !== CollectionRunnerRuntimeStopMode.Graceful &&
      command.mode !== CollectionRunnerRuntimeStopMode.Emergency)
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
      "Stop command version or mode is invalid.",
    );
  }
  for (const [value, label] of [
    [command.commandId, "commandId"],
    [command.ownerId, "ownerId"],
    [command.activationId, "activationId"],
    [command.processSessionId, "processSessionId"],
  ] as const) {
    identifier(value, `stop.${label}`);
  }
  checkedFingerprint(
    command.configurationFingerprint,
    "stop.configurationFingerprint",
  );
  checkedFingerprint(command.storeIdentity, "stop.storeIdentity");
  if (!REASON.test(command.reasonCode)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
      "Stop reason code is invalid.",
    );
  }
  nonNegativeInteger(
    command.expectedActivationAggregateVersion,
    "stop.expectedActivationAggregateVersion",
  );
  if (command.expectedActivationAggregateVersion === 0) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
      "Stop expected activation version must be positive.",
    );
  }
  const verified = utc(command.verifiedAtUtc, "stop.verifiedAtUtc");
  const expires = utc(
    command.authorizationExpiresAtUtc,
    "stop.authorizationExpiresAtUtc",
  );
  const requested = utc(command.requestedAtUtc, "stop.requestedAtUtc");
  if (verified > requested || requested > expires) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
      "Stop authorization chronology is invalid.",
    );
  }
  return deepFreeze(structuredClone(command));
}

export class EventContractCollectionRunnerRuntimeOperator {
  public createPreflightReport(
    inputValue: CollectionRunnerRuntimePreflightInput,
  ): CollectionRunnerRuntimePreflightReport {
    const input = validatePreflight(inputValue);
    const status = health(input.safety);
    const base = {
      ...input,
      ready: status === CollectionRunnerRuntimeHealthStatus.Healthy,
      health: status,
      deterministic: true as const,
    };
    return deepFreeze({ ...base, fingerprint: fingerprint(base) });
  }

  public createStatusReport(
    inputValue: CollectionRunnerRuntimeStatusInput,
  ): CollectionRunnerRuntimeStatusReport {
    const input = validateStatus(inputValue);
    const base = {
      ...input,
      remainingActivationMilliseconds: Math.max(
        0,
        Date.parse(input.activationStopsAtUtc) - Date.parse(input.observedAtUtc),
      ),
      health: health(input.safety),
      deterministic: true as const,
    };
    return deepFreeze({ ...base, fingerprint: fingerprint(base) });
  }

  public executeStop(
    commandValue: CollectionRunnerRuntimeStopCommand,
    secret: string,
    verifier: CollectionRunnerLocalOwnerVerifier,
    durableStop: CollectionRunnerRuntimeDurableStopPort,
    notification: CollectionRunnerRuntimeStopNotificationPort,
    barrier: CollectionRunnerProcessStopBarrier,
  ): CollectionRunnerRuntimeStopResult {
    const command = validateStopCommand(commandValue);
    const challengeFingerprint = fingerprint(command);
    const authorization = verifier.verify({
      ownerId: command.ownerId,
      secret,
      challengeFingerprint,
      verifiedAtUtc: command.verifiedAtUtc,
      expiresAtUtc: command.authorizationExpiresAtUtc,
    });
    const signalBase = {
      commandId: command.commandId,
      mode: command.mode,
      activationId: command.activationId,
      configurationFingerprint: command.configurationFingerprint,
      storeIdentity: command.storeIdentity,
      processSessionId: command.processSessionId,
      authorizationReference: authorization.authorizationReference,
      reasonCode: command.reasonCode,
      requestedAtUtc: command.requestedAtUtc,
      deterministic: true as const,
    };
    const signal = deepFreeze({
      ...signalBase,
      fingerprint: fingerprint(signalBase),
    });

    barrier.trip(
      command.mode === CollectionRunnerRuntimeStopMode.Emergency
        ? "OWNER_EMERGENCY_STOP"
        : "OWNER_GRACEFUL_STOP",
    );

    let receipt: CollectionRunnerRuntimeDurableStopReceipt;
    try {
      receipt = durableStop.requestStop(
        command,
        authorization.authorizationReference,
      );
      checkedFingerprint(
        receipt.receiptFingerprint,
        "stop.receiptFingerprint",
      );
    } catch (cause) {
      try {
        notification.notify(signal);
      } catch {
        // The process barrier remains authoritative even if notification fails.
      }
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.StopPersistenceFailed,
        "Authenticated Stop tripped the process barrier but durable persistence failed.",
        cause,
      );
    }
    let processNotified = false;
    try {
      processNotified = notification.notify(signal);
    } catch {
      // Durable Stop and the in-memory barrier remain authoritative.
    }
    const base = {
      commandId: command.commandId,
      mode: command.mode,
      barrierTripped: true as const,
      durableStopRecorded: true,
      processNotified,
      receiptFingerprint: receipt.receiptFingerprint,
      reasonCode: command.reasonCode,
      deterministic: true as const,
    };
    return deepFreeze({ ...base, fingerprint: fingerprint(base) });
  }
}

export class EventContractCollectionRunnerRuntimeOperatorService {
  public constructor(
    private readonly configuration: CollectionRunnerRuntimeConfiguration,
    private readonly paths: CollectionRunnerRuntimePaths,
    private readonly ownership: CollectionRunnerRuntimeOwnershipHandle,
    private readonly readiness: EventContractCollectionRunnerSqliteReadiness,
    private readonly recovery: CollectionRunnerStartupRecoveryReport,
    private readonly projection:
      EventContractCollectionRunnerRuntimeProjectionRepository,
    private readonly recoveryControl:
      EventContractCollectionRunnerRecoveryControlRepository,
    private readonly session: CollectionRunnerProcessSessionIdentity,
    private readonly barrier: CollectionRunnerProcessStopBarrier,
    private readonly wallClock: CollectionRunnerWallClock,
    private readonly monotonicClock: CollectionRunnerMonotonicClock,
    private readonly clockHealthProbe: CollectionRunnerClockHealthProbe,
  ) {}

  public preflight(observedAtUtc: string): CollectionRunnerRuntimePreflightReport {
    const evidence = this.#safety(observedAtUtc);
    return new EventContractCollectionRunnerRuntimeOperator()
      .createPreflightReport({
        observedAtUtc,
        configurationFingerprint: this.configuration.fingerprint,
        pathFingerprint: this.paths.pathFingerprint,
        storeIdentity: this.paths.storePathIdentity,
        schemaCatalogChecksum: this.readiness.schemaCatalogChecksum,
        recoveryReportFingerprint: this.recovery.fingerprint,
        safety: evidence.safety,
      });
  }

  public status(
    observedAtUtc: string,
    outboxLimit = 25,
  ): CollectionRunnerRuntimeStatusReport {
    const evidence = this.#safety(observedAtUtc);
    const projection = this.projection.readRuntimeProjection(
      this.configuration.activationId,
      outboxLimit,
    );
    return new EventContractCollectionRunnerRuntimeOperator()
      .createStatusReport({
        observedAtUtc,
        configurationFingerprint: this.configuration.fingerprint,
        buildFingerprint: this.configuration.applicationBuildFingerprint,
        lockFingerprint: this.ownership.ownership.fingerprint,
        bootIdentity: this.ownership.ownership.bootIdentity,
        processSessionId: this.ownership.ownership.processSessionId,
        processStartedAtUtc: this.ownership.ownership.acquiredAtUtc,
        activationId: projection.activationId,
        pilotState: projection.pilotState,
        activationStopsAtUtc: projection.activationStopsAtUtc,
        taskCounts: projection.taskCounts,
        budget: projection.budget,
        currentLease: projection.currentLease,
        lastReceiptAtUtc: projection.lastReceiptAtUtc,
        lastCommitAtUtc: projection.lastCommitAtUtc,
        clockOffsetMilliseconds: evidence.clockOffsetMilliseconds,
        outboxBacklog: projection.outboxBacklog,
        outbox: projection.outbox,
        recoveryDisposition:
          this.recovery.issueCount === 0
            ? "NO_RECOVERY_BLOCKERS"
            : this.recovery.ownerResumeRequired
              ? evidence.safety.sessionAuthorized
                ? "OWNER_RESUME_AUTHORIZED"
                : "OWNER_RESUME_REQUIRED"
              : "RECOVERY_BLOCKED",
        safety: evidence.safety,
      });
  }

  #safety(observedAtUtc: string): Readonly<{
    safety: CollectionRunnerRuntimeSafetyEvidence;
    clockOffsetMilliseconds: number | null;
  }> {
    utc(observedAtUtc, "operator.observedAtUtc");
    const recoveryBlockerCodes = this.recovery.issues
      .filter(
        (issue) =>
          issue.code !==
          CollectionRunnerRecoveryIssueCode.OperationalPilotRequiresOwnerResume,
      )
      .map((issue) => issue.code);
    const blockerCodes = new Set<string>(recoveryBlockerCodes);
    let ownershipVerified = true;
    try {
      this.ownership.verify();
    } catch {
      ownershipVerified = false;
      blockerCodes.add("LOCK_OWNERSHIP_UNVERIFIED");
    }
    let clockHealthy = true;
    let clockOffsetMilliseconds: number | null = null;
    try {
      const clock = sampleHealthyCollectionRunnerClocks(
        this.configuration,
        this.wallClock,
        this.monotonicClock,
        this.clockHealthProbe,
      );
      clockOffsetMilliseconds =
        clock.health.estimatedAbsoluteUtcOffsetMilliseconds;
    } catch {
      clockHealthy = false;
      blockerCodes.add("CLOCK_UNHEALTHY");
    }
    let sessionAuthorized = true;
    try {
      this.recoveryControl.validateRecoverySessionGate({
        ...this.session,
        observedAtUtc,
        taskId: null,
      });
    } catch {
      sessionAuthorized = false;
      blockerCodes.add("PROCESS_SESSION_UNAUTHORIZED");
    }
    if (this.barrier.isTripped()) {
      blockerCodes.add(
        this.barrier.getReasonCode() ?? "PROCESS_STOP_BARRIER_TRIPPED",
      );
    }
    const integrityVerified = recoveryBlockerCodes.length === 0;
    return deepFreeze({
      safety: {
        configurationVerified:
          this.ownership.ownership.configurationFingerprint ===
            this.configuration.fingerprint &&
          this.ownership.ownership.pathFingerprint ===
            this.paths.pathFingerprint &&
          this.ownership.ownership.storePathIdentity ===
            this.paths.storePathIdentity,
        ownershipVerified,
        storeReady:
          this.readiness.schemaVersion === 2 &&
          this.readiness.foreignKeys === 1 &&
          this.readiness.journalMode === "wal",
        integrityVerified,
        clockHealthy,
        sessionAuthorized,
        stopBarrierTripped: this.barrier.isTripped(),
        blockerCodes: [...blockerCodes].sort(),
      },
      clockOffsetMilliseconds,
    });
  }
}
