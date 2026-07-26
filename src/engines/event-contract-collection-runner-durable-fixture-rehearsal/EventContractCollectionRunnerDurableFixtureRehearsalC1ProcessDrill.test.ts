import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process, { cwd, execPath } from "node:process";

import {
  CollectionRunnerPilotState,
  CollectionRunnerTaskState,
  DurableFixtureRehearsalEvidenceDisposition,
  DurableFixtureRehearsalLifecycleState,
} from "../../contracts";
import type {
  C1PhaseState,
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

function phase<T>(
  root: string,
  mode: string,
  ordinal: number,
  variant: "a" | "b" = "a",
): T {
  const resultPath = join(root, `${String(ordinal)}-${mode}-result.json`);
  const result = spawnSync(
    execPath,
    [TSX, CHILD, mode, root, variant, resultPath],
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
  if (result.status !== 0) {
    throw new Error(
      `C1 ${mode} phase failed: ${result.stderr || result.stdout}`,
    );
  }
  return JSON.parse(readFileSync(resultPath, "utf8")) as T;
}

const roots: string[] = [];

function cleanRun(variant: "a" | "b"): C1PhaseState {
  const root = mkdtempSync(join(tmpdir(), `alpha-c1-${variant}-`));
  roots.push(root);
  phase(root, "prepare", 0, variant);
  const first = phase<{
    lifecycleState: DurableFixtureRehearsalLifecycleState;
    nextInvocationOrdinal: number;
  }>(root, "step", 1);
  equal(first.lifecycleState, DurableFixtureRehearsalLifecycleState.Ready, "step 1 state");
  equal(first.nextInvocationOrdinal, 2, "step 1 ordinal");
  const second = phase<{
    lifecycleState: DurableFixtureRehearsalLifecycleState;
    nextInvocationOrdinal: number;
  }>(root, "step", 2);
  equal(second.lifecycleState, DurableFixtureRehearsalLifecycleState.Ready, "step 2 state");
  equal(second.nextInvocationOrdinal, 3, "step 2 ordinal");
  const third = phase<{
    lifecycleState: DurableFixtureRehearsalLifecycleState;
    nextInvocationOrdinal: number;
  }>(root, "step", 3);
  equal(third.lifecycleState, DurableFixtureRehearsalLifecycleState.Completed, "step 3 state");
  equal(third.nextInvocationOrdinal, 4, "step 3 ordinal");
  phase(root, "validate", 4);
  const frozen = phase<{
    lifecycleState: DurableFixtureRehearsalLifecycleState;
  }>(root, "freeze", 5);
  equal(
    frozen.lifecycleState,
    DurableFixtureRehearsalLifecycleState.EvidenceFrozen,
    "frozen state",
  );
  phase(root, "package", 6);
  const verified = phase<{
    disposition: DurableFixtureRehearsalEvidenceDisposition;
  }>(root, "verify", 7);
  equal(
    verified.disposition,
    DurableFixtureRehearsalEvidenceDisposition.Pass,
    "verification",
  );
  const state = JSON.parse(
    readFileSync(join(root, "c1-phase-state.json"), "utf8"),
  ) as C1PhaseState;
  truth(state.envelopeFingerprint !== null, "envelope");
  return state;
}

try {
  const left = cleanRun("a");
  console.log("PASS clean C1 run executes one phase per fresh process");
  const right = cleanRun("b");
  equal(
    left.scenarioResultFingerprint,
    right.scenarioResultFingerprint,
    "scenario identity",
  );
  truth(
    left.executionPackageFingerprint !==
      right.executionPackageFingerprint,
    "execution identity differs",
  );
  console.log("PASS two C1 runs preserve scenario truth and separate execution identity");
  console.log(
    `PASS terminal truth is ${CollectionRunnerPilotState.Completed}/${CollectionRunnerTaskState.Committed}`,
  );
  console.log("C1 phase-composition tests passed: 3/3.");
} finally {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
}
