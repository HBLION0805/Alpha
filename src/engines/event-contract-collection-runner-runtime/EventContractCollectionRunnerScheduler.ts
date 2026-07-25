import { createHash } from "node:crypto";

import {
  CollectionRunnerRuntimeFoundationErrorCode,
  CollectionRunnerSchedulerAction,
  type CollectionRunnerSchedulerDecision,
  type CollectionRunnerSchedulerInput,
  type CollectionRunnerSchedulerTaskView,
} from "../../contracts";
import { EventContractCollectionRunnerRuntimeFoundationError } from "./EventContractCollectionRunnerRuntimeFoundation";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const UTC_MILLISECOND =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const TASK_STATES = new Set([
  "SCHEDULED",
  "DUE",
  "RETRY_WAIT",
  "COMMITTED",
  "MISSED",
  "TERMINAL_FAILED",
  "CANCELLED",
]);
const PILOT_STATES = new Set([
  "ACTIVE",
  "STOP_REQUESTED",
  "STOPPED",
  "REVOKED",
  "COMPLETED",
  "FAILED_CLOSED",
]);
const TERMINAL_TASK_STATES = new Set([
  "COMMITTED",
  "MISSED",
  "TERMINAL_FAILED",
  "CANCELLED",
]);

function fail(message: string): never {
  throw new EventContractCollectionRunnerRuntimeFoundationError(
    CollectionRunnerRuntimeFoundationErrorCode.InvalidSchedulerInput,
    message,
  );
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function parseUtc(value: unknown, field: string): number {
  if (typeof value !== "string" || !UTC_MILLISECOND.test(value)) {
    fail(`${field} must be canonical millisecond UTC.`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    fail(`${field} must be a real canonical UTC timestamp.`);
  }
  return parsed;
}

function validateTask(
  task: CollectionRunnerSchedulerTaskView,
  seen: Set<string>,
): void {
  if (!isRecord(task)) fail("Scheduler task must be an object.");
  const keys = Object.keys(task).sort();
  const expected = [
    "deadlineAtUtc",
    "evidenceCutoffAtUtc",
    "requiredActionAtUtc",
    "retryEligibleAtUtc",
    "sourceLane",
    "state",
    "taskId",
  ].sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])
  ) {
    fail("Scheduler task fields do not match the closed contract.");
  }
  if (!IDENTIFIER.test(task.taskId) || seen.has(task.taskId)) {
    fail("Scheduler task IDs must be canonical and unique.");
  }
  seen.add(task.taskId);
  if (task.sourceLane !== "PLATFORM" && task.sourceLane !== "EXCHANGE") {
    fail("Scheduler task source lane is invalid.");
  }
  if (!TASK_STATES.has(task.state)) fail("Scheduler task state is invalid.");
  const required = parseUtc(task.requiredActionAtUtc, "requiredActionAtUtc");
  const cutoff = parseUtc(task.evidenceCutoffAtUtc, "evidenceCutoffAtUtc");
  const deadline = parseUtc(task.deadlineAtUtc, "deadlineAtUtc");
  if (required > cutoff || cutoff > deadline) {
    fail("Scheduler task chronology is invalid.");
  }
  if (task.retryEligibleAtUtc !== null) {
    const retry = parseUtc(task.retryEligibleAtUtc, "retryEligibleAtUtc");
    if (retry < required || retry >= cutoff) {
      fail("Scheduler retry chronology is invalid.");
    }
  }
  if (task.state === "RETRY_WAIT" && task.retryEligibleAtUtc === null) {
    fail("RETRY_WAIT task requires retry eligibility time.");
  }
  if (task.state !== "RETRY_WAIT" && task.retryEligibleAtUtc !== null) {
    fail("Only RETRY_WAIT task may declare retry eligibility time.");
  }
}

function validateInput(input: CollectionRunnerSchedulerInput): number {
  if (!isRecord(input)) fail("Scheduler input must be an object.");
  const keys = Object.keys(input).sort();
  const expected = [
    "budgetAvailable",
    "clockHealthy",
    "configurationIdentityVerified",
    "emergencyStopObserved",
    "lockOwnershipVerified",
    "nowUtc",
    "pilotState",
    "processSessionAuthorized",
    "stopBarrierTripped",
    "tasks",
  ].sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])
  ) {
    fail("Scheduler input fields do not match the closed contract.");
  }
  for (const key of [
    "budgetAvailable",
    "clockHealthy",
    "configurationIdentityVerified",
    "emergencyStopObserved",
    "lockOwnershipVerified",
    "processSessionAuthorized",
    "stopBarrierTripped",
  ] as const) {
    if (typeof input[key] !== "boolean") {
      fail(`Scheduler ${key} must be boolean.`);
    }
  }
  if (!PILOT_STATES.has(input.pilotState)) {
    fail("Scheduler Pilot state is invalid.");
  }
  if (!Array.isArray(input.tasks)) fail("Scheduler tasks must be an array.");
  const seen = new Set<string>();
  for (const task of input.tasks) validateTask(task, seen);
  return parseUtc(input.nowUtc, "nowUtc");
}

function decision(
  action: CollectionRunnerSchedulerAction,
  reasonCode: string,
  taskId: string | null = null,
  waitUntilUtc: string | null = null,
): CollectionRunnerSchedulerDecision {
  const base = {
    action,
    taskId,
    waitUntilUtc,
    reasonCode,
    deterministic: true as const,
  };
  return deepFreeze({
    ...base,
    fingerprint: fingerprint(base),
  }) as CollectionRunnerSchedulerDecision;
}

function laneOrder(lane: "PLATFORM" | "EXCHANGE"): number {
  return lane === "PLATFORM" ? 0 : 1;
}

function orderTasks(
  left: CollectionRunnerSchedulerTaskView,
  right: CollectionRunnerSchedulerTaskView,
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

export class EventContractCollectionRunnerScheduler {
  public plan(input: CollectionRunnerSchedulerInput): CollectionRunnerSchedulerDecision {
    const now = validateInput(input);

    if (!input.lockOwnershipVerified) {
      return decision(
        CollectionRunnerSchedulerAction.FailClosed,
        "LOCK_OWNERSHIP_UNVERIFIED",
      );
    }
    if (!input.configurationIdentityVerified) {
      return decision(
        CollectionRunnerSchedulerAction.FailClosed,
        "CONFIGURATION_IDENTITY_DRIFT",
      );
    }
    if (!input.processSessionAuthorized) {
      return decision(
        CollectionRunnerSchedulerAction.FailClosed,
        "PROCESS_SESSION_UNAUTHORIZED",
      );
    }
    if (input.emergencyStopObserved || !input.clockHealthy) {
      return decision(
        CollectionRunnerSchedulerAction.TripEmergencyStop,
        input.emergencyStopObserved
          ? "EMERGENCY_STOP_OBSERVED"
          : "CLOCK_UNHEALTHY",
      );
    }
    if (input.stopBarrierTripped || input.pilotState === "STOP_REQUESTED") {
      return decision(
        CollectionRunnerSchedulerAction.RequestGracefulCompletion,
        input.stopBarrierTripped
          ? "PROCESS_STOP_BARRIER_TRIPPED"
          : "DURABLE_STOP_REQUESTED",
      );
    }
    if (input.pilotState !== "ACTIVE") {
      return decision(
        CollectionRunnerSchedulerAction.RequestGracefulCompletion,
        "PILOT_NOT_ACTIVE",
      );
    }
    if (!input.budgetAvailable) {
      return decision(
        CollectionRunnerSchedulerAction.RequestGracefulCompletion,
        "BUDGET_EXHAUSTED",
      );
    }

    const openTasks = [...input.tasks]
      .filter((task) => !TERMINAL_TASK_STATES.has(task.state))
      .sort(orderTasks);
    if (openTasks.length === 0) {
      return decision(
        CollectionRunnerSchedulerAction.RequestGracefulCompletion,
        "NO_OPEN_TASKS",
      );
    }

    const missed = openTasks.find(
      (task) =>
        now >= Date.parse(task.evidenceCutoffAtUtc) ||
        now >= Date.parse(task.deadlineAtUtc),
    );
    if (missed !== undefined) {
      return decision(
        CollectionRunnerSchedulerAction.MarkExactTaskMissed,
        "TASK_EVIDENCE_WINDOW_CLOSED",
        missed.taskId,
      );
    }

    const due = openTasks.find(
      (task) =>
        task.state === "DUE" && now >= Date.parse(task.requiredActionAtUtc),
    );
    if (due !== undefined) {
      return decision(
        CollectionRunnerSchedulerAction.AcquireExactTask,
        "EXACT_DUE_TASK_SELECTED",
        due.taskId,
      );
    }

    const retryAwaitingTransition = openTasks.find(
      (task) =>
        task.state === "RETRY_WAIT" &&
        task.retryEligibleAtUtc !== null &&
        now >= Date.parse(task.retryEligibleAtUtc),
    );
    if (retryAwaitingTransition !== undefined) {
      return decision(
        CollectionRunnerSchedulerAction.WaitUntil,
        "RETRY_REQUIRES_DUE_TRANSITION",
        retryAwaitingTransition.taskId,
        input.nowUtc,
      );
    }

    const scheduledButNotDue = openTasks.find(
      (task) =>
        task.state === "SCHEDULED" &&
        now >= Date.parse(task.requiredActionAtUtc),
    );
    if (scheduledButNotDue !== undefined) {
      return decision(
        CollectionRunnerSchedulerAction.WaitUntil,
        "TASK_REQUIRES_DUE_TRANSITION",
        scheduledButNotDue.taskId,
        input.nowUtc,
      );
    }

    const nextTimes = openTasks.flatMap((task) => {
      const values = [task.requiredActionAtUtc];
      if (task.retryEligibleAtUtc !== null) values.push(task.retryEligibleAtUtc);
      return values.filter((value) => Date.parse(value) > now);
    });
    nextTimes.sort(
      (left, right) =>
        Date.parse(left) - Date.parse(right) || left.localeCompare(right),
    );
    if (nextTimes[0] !== undefined) {
      return decision(
        CollectionRunnerSchedulerAction.WaitUntil,
        "NO_TASK_CURRENTLY_ELIGIBLE",
        null,
        nextTimes[0],
      );
    }
    return decision(
      CollectionRunnerSchedulerAction.FailClosed,
      "OPEN_TASK_HAS_NO_VALID_NEXT_ACTION",
    );
  }
}
