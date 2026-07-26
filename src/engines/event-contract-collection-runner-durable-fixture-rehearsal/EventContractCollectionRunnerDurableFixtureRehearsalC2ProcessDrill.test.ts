import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process, { cwd, execPath } from "node:process";

import {
  DurableFixtureRehearsalLifecycleState,
  DurableFixtureRehearsalPhaseOutcome,
} from "../../contracts";
import type {
  C2DurableInspection,
} from "../../../scripts/fixtures/collection-runner-durable-rehearsal-c1-phase-fixture";

const CHILD = join(
  cwd(),
  "scripts",
  "fixtures",
  "collection-runner-durable-rehearsal-c1-phase-child.ts",
);
const TSX = join(cwd(), "node_modules", "tsx", "dist", "cli.mjs");

function truth(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function equal<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${String(expected)}, got ${String(actual)}.`,
    );
  }
}

function canonical(value: unknown): string {
  return JSON.stringify(value);
}

function invoke<T>(
  root: string,
  mode: string,
  sequence: number,
  argument = "a",
  expectedSuccess = true,
): T | null {
  const resultPath = join(root, `${String(sequence)}-${mode}-result.json`);
  const result = spawnSync(
    execPath,
    [TSX, CHILD, mode, root, argument, resultPath],
    {
      cwd: cwd(),
      input: "",
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 16 * 1024 * 1024,
      killSignal: "SIGTERM",
    },
  );
  if (expectedSuccess && result.status !== 0) {
    throw new Error(
      `C2 ${mode} failed: ${result.stderr || result.stdout}`,
    );
  }
  if (!expectedSuccess) {
    truth(result.status !== 0, `${mode} must fail closed`);
    truth(!existsSync(resultPath), `${mode} must publish no result`);
    return null;
  }
  return JSON.parse(readFileSync(resultPath, "utf8")) as T;
}

const roots: string[] = [];

function root(label: string): string {
  const value = mkdtempSync(join(tmpdir(), `alpha-c2-${label}-`));
  roots.push(value);
  return value;
}

try {
  {
    const value = root("worker");
    invoke(value, "prepare", 0);
    invoke(value, "step", 1);
    invoke(value, "step", 2);
    invoke(value, "step", 3);
    const inspected = invoke<C2DurableInspection>(
      value,
      "inspect",
      4,
    )!;
    equal(
      inspected.taskTransitions.join(","),
      "SCHEDULED,DUE,LEASED,IN_FLIGHT,VALIDATING,COMMITTED",
      "reviewed Worker transaction sequence",
    );
    equal(inspected.attemptCount, 1, "attempt");
    equal(inspected.attemptResultCount, 1, "attempt result");
    equal(inspected.evidenceCount, 1, "normalized evidence");
    equal(inspected.liveLeaseCount, 0, "lease cleanup");
    equal(inspected.invocationReceiptCount, 3, "step receipts");
    console.log("PASS clean C2 STEP composes T7 T8 T8B T10 in fresh processes");
  }

  {
    const value = root("replay");
    invoke(value, "prepare", 0);
    invoke(value, "step", 1);
    const before = invoke<C2DurableInspection>(value, "inspect", 2)!;
    const replay = invoke<{
      outcome: DurableFixtureRehearsalPhaseOutcome;
    }>(value, "replay-step", 3, "1")!;
    equal(
      replay.outcome,
      DurableFixtureRehearsalPhaseOutcome.Replayed,
      "exact replay",
    );
    const afterReplay = invoke<C2DurableInspection>(
      value,
      "inspect",
      4,
    )!;
    equal(canonical(afterReplay), canonical(before), "replay mutation");
    invoke(value, "changed-replay-step", 5, "1", false);
    const afterConflict = invoke<C2DurableInspection>(
      value,
      "inspect",
      6,
    )!;
    equal(canonical(afterConflict), canonical(before), "conflict mutation");
    console.log("PASS fresh-process exact replay is idempotent and changed replay fails closed");
  }

  {
    const value = root("claim-crash");
    invoke(value, "prepare", 0);
    invoke(value, "crash-after-claim", 1, "a", false);
    const inspected = invoke<C2DurableInspection>(
      value,
      "inspect",
      2,
    )!;
    equal(
      inspected.lifecycleState,
      DurableFixtureRehearsalLifecycleState.Stepping,
      "crash lifecycle",
    );
    equal(inspected.claimCount, 1, "crash durable claim");
    equal(inspected.invocationReceiptCount, 0, "crash no receipt");
    equal(inspected.unresolvedClaimCount, 1, "crash unresolved claim");
    console.log("PASS process crash after claim preserves durable unresolved ambiguity");
  }

  {
    const value = root("claim-stop");
    invoke(value, "prepare", 0);
    invoke(value, "stop-after-claim", 1, "a", false);
    const inspected = invoke<C2DurableInspection>(
      value,
      "inspect",
      2,
    )!;
    equal(
      inspected.lifecycleState,
      DurableFixtureRehearsalLifecycleState.Stepping,
      "ambiguous lifecycle",
    );
    equal(inspected.claimCount, 1, "durable claim");
    equal(inspected.invocationReceiptCount, 0, "no receipt");
    equal(inspected.unresolvedClaimCount, 1, "unresolved claim");
    equal(
      inspected.taskTransitions.join(","),
      "SCHEDULED",
      "no foreground mutation",
    );
    console.log("PASS fresh process observes Stop after claim as durable unresolved ambiguity");
  }

  {
    const value = root("stop-boundaries");
    invoke(value, "stop-on", 0);
    invoke(value, "prepare", 1, "a", false);
    truth(!existsSync(join(value, "source")), "Stop before PREPARE");
    invoke(value, "stop-off", 2);
    invoke(value, "prepare", 3);

    invoke(value, "stop-on", 4);
    invoke(value, "step", 5, "a", false);
    equal(
      invoke<C2DurableInspection>(value, "inspect", 6)!.claimCount,
      0,
      "Stop before STEP",
    );
    invoke(value, "stop-off", 7);
    invoke(value, "step", 8);
    invoke(value, "step", 9);
    invoke(value, "step", 10);

    invoke(value, "stop-on", 11);
    invoke(value, "validate", 12, "a", false);
    truth(
      !existsSync(join(value, "validation-receipt.json")),
      "Stop before VALIDATE",
    );
    invoke(value, "stop-off", 13);
    invoke(value, "validate", 14);

    invoke(value, "stop-on", 15);
    invoke(value, "freeze", 16, "a", false);
    equal(
      invoke<C2DurableInspection>(value, "inspect", 17)!.lifecycleState,
      DurableFixtureRehearsalLifecycleState.Completed,
      "Stop before FREEZE",
    );
    invoke(value, "stop-off", 18);
    invoke(value, "freeze", 19);

    invoke(value, "stop-on", 20);
    invoke(value, "package", 21, "a", false);
    equal(
      readdirSync(join(value, "evidence")).length,
      0,
      "Stop before PACKAGE",
    );
    invoke(value, "stop-off", 22);
    invoke(value, "package", 23);
    console.log("PASS Owner Stop precedes every mutable phase in fresh processes");
  }

  console.log("C2 process tests passed: 5/5.");
} finally {
  for (const value of roots) {
    rmSync(value, { recursive: true, force: true });
  }
}
