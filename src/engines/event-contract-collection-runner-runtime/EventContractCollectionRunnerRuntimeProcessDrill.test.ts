import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import process, { cwd, execPath } from "node:process";

import {
  CollectionRunnerRuntimeFoundationErrorCode,
  CollectionRunnerRuntimeHealthStatus,
  CollectionRunnerRuntimeStopMode,
  CollectionRunnerSchedulerAction,
  type CollectionRunnerLocalOwnerAuthorizationEvidence,
  type CollectionRunnerRuntimeStopCommand,
  type CollectionRunnerSchedulerInput,
} from "../../contracts";
import type {
  CollectionRunnerLocalOwnerVerifier,
  VerifyCollectionRunnerLocalOwnerInput,
} from "../event-contract-collection-runner-recovery-control/EventContractCollectionRunnerRecoveryControlOperator";
import { CollectionRunnerProcessStopBarrier } from "../../repositories/SessionGatedEventContractCollectionRunnerRepository";
import {
  EventContractCollectionRunnerRuntimeOperator,
  InMemoryCollectionRunnerRuntimeStopNotificationPort,
  type CollectionRunnerRuntimeDurableStopPort,
} from "./EventContractCollectionRunnerRuntimeOperator";
import { EventContractCollectionRunnerRuntimeFoundationError } from "./EventContractCollectionRunnerRuntimeFoundation";
import { EventContractCollectionRunnerScheduler } from "./EventContractCollectionRunnerScheduler";

const SHA_A =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const CHILD = join(
  cwd(),
  "scripts",
  "fixtures",
  "collection-runner-runtime-child.ts",
);
const TSX = join(cwd(), "node_modules", "tsx", "dist", "cli.mjs");

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}.`);
  }
}

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

async function waitForLine(
  child: ChildProcessWithoutNullStreams,
  expected: string,
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for child output: ${expected}`));
    }, 10_000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
      if (output.includes(expected)) {
        clearTimeout(timeout);
        resolve(output);
      }
    });
    child.once("exit", (code) => {
      if (!output.includes(expected)) {
        clearTimeout(timeout);
        reject(new Error(`Child exited ${String(code)} before ${expected}.`));
      }
    });
  });
}

function schedulerInput(
  changes: Partial<CollectionRunnerSchedulerInput> = {},
): CollectionRunnerSchedulerInput {
  return {
    nowUtc: "2026-07-25T14:00:00.000Z",
    stopBarrierTripped: false,
    lockOwnershipVerified: true,
    configurationIdentityVerified: true,
    clockHealthy: true,
    processSessionAuthorized: true,
    pilotState: "ACTIVE",
    emergencyStopObserved: false,
    budgetAvailable: true,
    tasks: [
      {
        taskId: "task:drill",
        sourceLane: "EXCHANGE",
        state: "DUE",
        requiredActionAtUtc: "2026-07-25T13:59:00.000Z",
        evidenceCutoffAtUtc: "2026-07-25T14:05:00.000Z",
        deadlineAtUtc: "2026-07-25T14:06:00.000Z",
        retryEligibleAtUtc: null,
      },
    ],
    ...changes,
  };
}

function stopCommand(
  changes: Partial<CollectionRunnerRuntimeStopCommand> = {},
): CollectionRunnerRuntimeStopCommand {
  return {
    schemaVersion: "1.0",
    commandId: "command:process-drill",
    mode: CollectionRunnerRuntimeStopMode.Emergency,
    ownerId: "owner:process-drill",
    activationId: "activation:process-drill",
    expectedActivationAggregateVersion: 3,
    configurationFingerprint: SHA_A,
    storeIdentity: SHA_B,
    processSessionId: "process-session:drill",
    reasonCode: "OWNER_REQUEST",
    verifiedAtUtc: "2026-07-25T14:00:00.000Z",
    authorizationExpiresAtUtc: "2026-07-25T14:05:00.000Z",
    requestedAtUtc: "2026-07-25T14:00:01.000Z",
    ...changes,
  };
}

class DrillVerifier implements CollectionRunnerLocalOwnerVerifier {
  public verify(
    input: VerifyCollectionRunnerLocalOwnerInput,
  ): CollectionRunnerLocalOwnerAuthorizationEvidence {
    if (input.secret !== "owner-secret") throw new Error("authentication failed");
    return Object.freeze({
      authorityKind: "LOCAL_OWNER_VERIFIED",
      ownerId: input.ownerId,
      verifierId: "verifier:drill",
      verifierVersion: "1.0",
      authorizationReference: "authorization:drill",
      challengeFingerprint: input.challengeFingerprint,
      verifiedAtUtc: input.verifiedAtUtc,
      expiresAtUtc: input.expiresAtUtc,
    });
  }
}

class ReplayDurableStop implements CollectionRunnerRuntimeDurableStopPort {
  #command: string | null = null;
  public calls = 0;
  public requestStop(command: Readonly<CollectionRunnerRuntimeStopCommand>) {
    const encoded = JSON.stringify(command);
    if (this.#command !== null && this.#command !== encoded) {
      throw new Error("conflicting replay");
    }
    this.#command = encoded;
    this.calls += 1;
    return { receiptFingerprint: SHA_A };
  }
}

async function duplicateAndCrashDrill(): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), "alpha-runtime-process-drill-"));
  const child = spawn(execPath, [TSX, CHILD, "hold-lock", root], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let childExited = false;
  try {
    const acquiredOutput = await waitForLine(child, "ACQUIRED");
    const acquiredLine = acquiredOutput
      .split(/\r?\n/u)
      .find((line) => line.startsWith("ACQUIRED "));
    const lockRecord = acquiredLine?.replace(/^ACQUIRED \S+ /u, "");
    if (lockRecord === undefined || lockRecord.length === 0) {
      throw new Error("Child did not report its exact lock record.");
    }
    console.log("DRILL holder acquired ownership");
    assertTrue(existsSync(lockRecord), "owner record exists");
    const beforeCrash = readFileSync(lockRecord, "utf8");

    const duplicate = spawnSync(
      execPath,
      [TSX, CHILD, "try-lock", root],
      {
        cwd: cwd(),
        input: "",
        encoding: "utf8",
        shell: false,
        timeout: 10_000,
        maxBuffer: 1_000_000,
        windowsHide: true,
        killSignal: "SIGTERM",
      },
    );
    assertEqual(duplicate.status, 2, "duplicate exit");
    assertTrue(duplicate.stdout.includes("BLOCKED"), "duplicate blocked");
    assertEqual(readFileSync(lockRecord, "utf8"), beforeCrash, "no lock mutation");
    console.log("DRILL duplicate instance blocked");

    const crashObserved = once(child, "exit");
    child.kill();
    await crashObserved;
    childExited = true;
    console.log("DRILL holder forced to exit");

    const restart = spawnSync(
      execPath,
      [TSX, CHILD, "try-lock", root],
      {
        cwd: cwd(),
        input: "",
        encoding: "utf8",
        shell: false,
        timeout: 10_000,
        maxBuffer: 1_000_000,
        windowsHide: true,
        killSignal: "SIGTERM",
      },
    );
    assertEqual(restart.status, 2, "restart exit");
    assertTrue(restart.stdout.includes("BLOCKED"), "stale lock blocks restart");
    assertEqual(readFileSync(lockRecord, "utf8"), beforeCrash, "stale evidence");
    console.log("DRILL restart blocked by stale ownership evidence");
  } finally {
    if (!childExited) {
      const cleanupExitObserved = once(child, "exit");
      child.kill();
      await cleanupExitObserved;
    }
    rmSync(root, { recursive: true, force: true });
  }
}

const scheduler = new EventContractCollectionRunnerScheduler();
const operator = new EventContractCollectionRunnerRuntimeOperator();

const tests: ReadonlyArray<readonly [string, () => void | Promise<void>]> = [
  [
    "duplicate process is rejected and forced exit leaves restart blocker",
    duplicateAndCrashDrill,
  ],
  [
    "provider timeout cannot bypass durable retry transition",
    () => {
      const decision = scheduler.plan(
        schedulerInput({
          tasks: [
            {
              ...schedulerInput().tasks[0]!,
              state: "RETRY_WAIT",
              retryEligibleAtUtc: "2026-07-25T13:59:30.000Z",
            },
          ],
        }),
      );
      assertEqual(decision.action, CollectionRunnerSchedulerAction.WaitUntil, "action");
      assertEqual(decision.reasonCode, "RETRY_REQUIRES_DUE_TRANSITION", "reason");
    },
  ],
  [
    "cutoff wins over task acquisition",
    () => {
      const decision = scheduler.plan(
        schedulerInput({ nowUtc: "2026-07-25T14:05:00.000Z" }),
      );
      assertEqual(
        decision.action,
        CollectionRunnerSchedulerAction.MarkExactTaskMissed,
        "action",
      );
    },
  ],
  [
    "deadline cannot reopen a task already blocked at cutoff",
    () => {
      const decision = scheduler.plan(
        schedulerInput({ nowUtc: "2026-07-25T14:06:00.000Z" }),
      );
      assertEqual(
        decision.action,
        CollectionRunnerSchedulerAction.MarkExactTaskMissed,
        "action",
      );
    },
  ],
  [
    "process Stop wins before task acquisition",
    () => {
      const decision = scheduler.plan(
        schedulerInput({ stopBarrierTripped: true }),
      );
      assertEqual(
        decision.action,
        CollectionRunnerSchedulerAction.RequestGracefulCompletion,
        "action",
      );
    },
  ],
  [
    "exact Stop replay is deterministic and notification is idempotent",
    () => {
      const durable = new ReplayDurableStop();
      const notification =
        new InMemoryCollectionRunnerRuntimeStopNotificationPort();
      const barrier = new CollectionRunnerProcessStopBarrier();
      const first = operator.executeStop(
        stopCommand(),
        "owner-secret",
        new DrillVerifier(),
        durable,
        notification,
        barrier,
      );
      const firstNotificationFingerprint = notification.read()?.fingerprint;
      const second = operator.executeStop(
        stopCommand(),
        "owner-secret",
        new DrillVerifier(),
        durable,
        notification,
        barrier,
      );
      assertEqual(first.fingerprint, second.fingerprint, "replay");
      assertEqual(durable.calls, 2, "idempotent durable calls");
      assertEqual(
        notification.read()?.fingerprint,
        firstNotificationFingerprint,
        "idempotent notification",
      );
    },
  ],
  [
    "changed Stop replay fails closed and barrier remains active",
    () => {
      const durable = new ReplayDurableStop();
      const barrier = new CollectionRunnerProcessStopBarrier();
      const notification =
        new InMemoryCollectionRunnerRuntimeStopNotificationPort();
      operator.executeStop(
        stopCommand(),
        "owner-secret",
        new DrillVerifier(),
        durable,
        notification,
        barrier,
      );
      let code: CollectionRunnerRuntimeFoundationErrorCode | null = null;
      try {
        operator.executeStop(
          stopCommand({ reasonCode: "INTEGRITY_FAILURE" }),
          "owner-secret",
          new DrillVerifier(),
          durable,
          notification,
          barrier,
        );
      } catch (error) {
        if (error instanceof EventContractCollectionRunnerRuntimeFoundationError) {
          code = error.code;
        }
      }
      assertEqual(
        code,
        CollectionRunnerRuntimeFoundationErrorCode.StopPersistenceFailed,
        "conflict",
      );
      assertEqual(barrier.isTripped(), true, "barrier");
    },
  ],
  [
    "stopped process health cannot be reported healthy",
    () => {
      const report = operator.createPreflightReport({
        observedAtUtc: "2026-07-25T14:00:00.000Z",
        configurationFingerprint: SHA_A,
        pathFingerprint: SHA_B,
        storeIdentity: SHA_A,
        schemaCatalogChecksum: SHA_B,
        recoveryReportFingerprint: SHA_A,
        safety: {
          configurationVerified: true,
          ownershipVerified: true,
          storeReady: true,
          integrityVerified: true,
          clockHealthy: true,
          sessionAuthorized: false,
          stopBarrierTripped: true,
          blockerCodes: ["OWNER_EMERGENCY_STOP"],
        },
      });
      assertEqual(report.ready, false, "ready");
      assertEqual(report.health, CollectionRunnerRuntimeHealthStatus.FailClosed, "health");
    },
  ],
];

async function main(): Promise<void> {
  console.log("Starting Event Contract Collection Runner Runtime Process Drills.");
  let passed = 0;
  for (const [name, run] of tests) {
    try {
      await run();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}`);
      throw error;
    }
  }
  console.log(
    `Event Contract Collection Runner Runtime Process Drill tests passed: ${String(passed)}/${String(tests.length)}.`,
  );
}

const keepAlive = setInterval(() => undefined, 1_000);
main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    clearInterval(keepAlive);
  });
