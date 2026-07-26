import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cwd, execPath } from "node:process";

import {
  DurableFixtureRehearsalEvidenceDisposition,
  DurableFixtureRehearsalLifecycleState,
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
      `C3 ${mode} failed: ${result.stderr || result.stdout}`,
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
  const value = mkdtempSync(join(tmpdir(), `alpha-c3-${label}-`));
  roots.push(value);
  return value;
}

try {
  {
    const value = root("pre-claim");
    invoke(value, "prepare", 0);
    invoke(value, "crash-before-claim", 1, "a", false);
    const inspected = invoke<C2DurableInspection>(value, "inspect", 2)!;
    equal(
      inspected.lifecycleState,
      DurableFixtureRehearsalLifecycleState.Prepared,
      "pre-claim lifecycle",
    );
    equal(inspected.claimCount, 0, "pre-claim claims");
    equal(inspected.invocationReceiptCount, 0, "pre-claim receipts");
    equal(inspected.unresolvedClaimCount, 0, "pre-claim unresolved");
    equal(
      inspected.taskTransitions.join(","),
      "SCHEDULED",
      "pre-claim Runner mutation",
    );
    console.log(
      "PASS process crash before rehearsal phase claim commits no claim or action",
    );
  }

  {
    const value = root("post-t6");
    invoke(value, "prepare", 0);
    invoke(value, "crash-after-foreground", 1, "a", false);
    const inspected = invoke<C2DurableInspection>(value, "inspect", 2)!;
    equal(
      inspected.lifecycleState,
      DurableFixtureRehearsalLifecycleState.Stepping,
      "post-T6 lifecycle",
    );
    equal(inspected.claimCount, 1, "post-T6 claim");
    equal(inspected.invocationReceiptCount, 0, "post-T6 receipt");
    equal(inspected.unresolvedClaimCount, 1, "post-T6 unresolved");
    equal(
      inspected.taskTransitions.join(","),
      "SCHEDULED,DUE",
      "post-T6 Runner truth",
    );
    equal(inspected.attemptCount, 0, "post-T6 attempts");
    console.log(
      "PASS process crash after T6 precedes rehearsal receipt and preserves dual-store truth",
    );
  }

  {
    const value = root("post-t10");
    invoke(value, "prepare", 0);
    invoke(value, "step", 1);
    invoke(value, "crash-after-foreground", 2, "a", false);
    const inspected = invoke<C2DurableInspection>(value, "inspect", 3)!;
    equal(
      inspected.lifecycleState,
      DurableFixtureRehearsalLifecycleState.Stepping,
      "post-T10 lifecycle",
    );
    equal(inspected.claimCount, 2, "post-T10 claims");
    equal(inspected.invocationReceiptCount, 1, "post-T10 prior receipt only");
    equal(inspected.unresolvedClaimCount, 1, "post-T10 unresolved");
    equal(
      inspected.taskTransitions.join(","),
      "SCHEDULED,DUE,LEASED,IN_FLIGHT,VALIDATING,COMMITTED",
      "post-T10 Runner truth",
    );
    equal(inspected.attemptCount, 1, "post-T10 attempt");
    equal(inspected.attemptResultCount, 1, "post-T10 result");
    equal(inspected.evidenceCount, 1, "post-T10 evidence");
    equal(inspected.liveLeaseCount, 0, "post-T10 lease cleanup");
    console.log(
      "PASS process crash after T10 precedes rehearsal receipt and preserves dual-store truth",
    );
  }

  {
    const value = root("changed-replays");
    invoke(value, "prepare", 0);
    invoke(value, "step", 1);
    const before = invoke<C2DurableInspection>(value, "inspect", 2)!;
    const modes = [
      "changed-phase-replay",
      "changed-ordinal-replay",
      "changed-recovery-replay",
      "changed-manifest-replay",
    ] as const;
    for (const [index, mode] of modes.entries()) {
      invoke(value, mode, index + 3, "a", false);
      const after = invoke<C2DurableInspection>(
        value,
        `inspect`,
        index + 10,
      )!;
      equal(
        canonical(after),
        canonical(before),
        `${mode} durable mutation`,
      );
    }
    console.log(
      "PASS fresh processes reject changed phase ordinal recovery and manifest replays",
    );
  }

  {
    const value = root("artifact-substitution");
    invoke(value, "prepare", 0);
    invoke(value, "step", 1);
    invoke(value, "step", 2);
    invoke(value, "step", 3);
    invoke(value, "validate", 4);
    invoke(value, "freeze", 5);
    invoke(value, "package", 6);
    invoke(value, "substitute-package-artifact", 7);
    const verified = invoke<{
      disposition: DurableFixtureRehearsalEvidenceDisposition;
    }>(value, "verify", 8)!;
    equal(
      verified.disposition,
      DurableFixtureRehearsalEvidenceDisposition.FailClosed,
      "package artifact substitution",
    );
    console.log(
      "PASS fresh verifier rejects substituted package artifact",
    );
  }

  console.log("C3 exact process-boundary tests passed: 5/5.");
} finally {
  for (const value of roots) {
    rmSync(value, { recursive: true, force: true });
  }
}
