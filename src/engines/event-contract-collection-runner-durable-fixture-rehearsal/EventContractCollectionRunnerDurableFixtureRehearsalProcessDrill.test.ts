import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process, { cwd, execPath } from "node:process";

import {
  DurableFixtureRehearsalEvidenceDisposition,
  type DurableFixtureRehearsalEnvelopeVerificationResult,
} from "../../contracts";
import type {
  DurableEvidenceDrillFixture,
} from "../../../scripts/fixtures/collection-runner-durable-rehearsal-evidence-drill-fixture";

const CHILD = join(
  cwd(),
  "scripts",
  "fixtures",
  "collection-runner-durable-rehearsal-evidence-drill-child.ts",
);
const TSX = join(cwd(), "node_modules", "tsx", "dist", "cli.mjs");
const WRONG_FP = `sha256:${"9".repeat(64)}`;

function equal<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}.`);
  }
}

function truth(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

async function waitFor(path: string, child: ChildProcessWithoutNullStreams): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (!existsSync(path)) {
    if (child.exitCode !== null) {
      throw new Error(`Drill child exited ${String(child.exitCode)} before producing evidence.`);
    }
    if (Date.now() > deadline) throw new Error("Timed out waiting for drill child.");
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
}

function child(args: readonly string[]): ChildProcessWithoutNullStreams {
  return spawn(execPath, [TSX, CHILD, ...args], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

async function exitCode(childProcess: ChildProcessWithoutNullStreams): Promise<number | null> {
  if (childProcess.exitCode !== null) return childProcess.exitCode;
  const [code] = await once(childProcess, "exit");
  return code;
}

async function build(root: string, variant: "a" | "b" = "a"):
  Promise<DurableEvidenceDrillFixture> {
  const resultPath = join(root, "build-result.json");
  const process = child(["build", root, variant, resultPath, join(root, "unused")]);
  await waitFor(resultPath, process);
  const code = await exitCode(process);
  equal(code, 0, "build exit");
  return JSON.parse(readFileSync(resultPath, "utf8")) as DurableEvidenceDrillFixture;
}

async function verify(
  fixture: DurableEvidenceDrillFixture,
  resultName: string,
  envelopeFingerprint = fixture.envelopeFingerprint,
  manifestFingerprint = fixture.manifestFingerprint,
): Promise<DurableFixtureRehearsalEnvelopeVerificationResult> {
  const resultPath = join(fixture.evidenceRoot, "..", resultName);
  const process = child([
    "verify", fixture.evidenceRoot, "a", resultPath, join(fixture.evidenceRoot, "unused"),
    envelopeFingerprint, manifestFingerprint,
  ]);
  await waitFor(resultPath, process);
  const code = await exitCode(process);
  equal(code, 0, "verify exit");
  return JSON.parse(readFileSync(resultPath, "utf8")) as DurableFixtureRehearsalEnvelopeVerificationResult;
}

async function crash(
  mode: "crash-after-backup" | "crash-before-publication" | "crash-after-publication",
): Promise<{ readonly root: string; readonly finalDirectory: string }> {
  const root = mkdtempSync(join(tmpdir(), `alpha-t5-${mode}-`));
  const marker = join(root, "checkpoint.json");
  const process = child([mode, root, "a", join(root, "result.json"), marker]);
  await waitFor(marker, process);
  const exit = once(process, "exit");
  truth(process.kill(), `${mode} kill accepted`);
  await exit;
  return {
    root,
    finalDirectory: join(root, "evidence", "rehearsal-envelope-1-evidence"),
  };
}

async function removeRoot(root: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      rmSync(root, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    }
  }
}

const tests: ReadonlyArray<readonly [string, () => Promise<void>]> = [
  ["clean build verifies PASS in a separate process", async () => {
    const root = mkdtempSync(join(tmpdir(), "alpha-t5-clean-"));
    try {
      const fixture = await build(root);
      equal((await verify(fixture, "verify-clean.json")).disposition, DurableFixtureRehearsalEvidenceDisposition.Pass, "disposition");
    } finally { await removeRoot(root); }
  }],
  ["two isolated runs preserve scenario identity and vary execution identity", async () => {
    const leftRoot = mkdtempSync(join(tmpdir(), "alpha-t5-left-"));
    const rightRoot = mkdtempSync(join(tmpdir(), "alpha-t5-right-"));
    try {
      const left = await build(leftRoot, "a");
      const right = await build(rightRoot, "b");
      equal(left.scenarioResultFingerprint, right.scenarioResultFingerprint, "scenario");
      truth(left.executionPackageFingerprint !== right.executionPackageFingerprint, "execution differs");
      equal((await verify(left, "verify-left.json")).disposition, DurableFixtureRehearsalEvidenceDisposition.Pass, "left");
      equal((await verify(right, "verify-right.json")).disposition, DurableFixtureRehearsalEvidenceDisposition.Pass, "right");
    } finally {
      await removeRoot(leftRoot);
      await removeRoot(rightRoot);
    }
  }],
  ["crash after backup never publishes a valid envelope", async () => {
    const state = await crash("crash-after-backup");
    try {
      equal(existsSync(state.finalDirectory), false, "final absent");
      const rebuilt = await build(state.root);
      equal((await verify(rebuilt, "verify-rebuilt-backup.json")).disposition, DurableFixtureRehearsalEvidenceDisposition.Pass, "rebuilt");
      truth(readdirSync(rebuilt.evidenceRoot).some((name) => name.includes(".quarantine-")), "quarantine");
    } finally { await removeRoot(state.root); }
  }],
  ["crash before publication quarantines staging and rebuilds", async () => {
    const state = await crash("crash-before-publication");
    try {
      equal(existsSync(state.finalDirectory), false, "final absent");
      const rebuilt = await build(state.root);
      equal((await verify(rebuilt, "verify-rebuilt-stage.json")).disposition, DurableFixtureRehearsalEvidenceDisposition.Pass, "rebuilt");
    } finally { await removeRoot(state.root); }
  }],
  ["crash after atomic publication preserves independently verifiable truth", async () => {
    const state = await crash("crash-after-publication");
    try {
      truth(existsSync(state.finalDirectory), "published envelope");
      const envelope = JSON.parse(readFileSync(join(state.finalDirectory, "envelope-manifest.json"), "utf8")) as { fingerprint: string; manifestFingerprint: string };
      const fixture = {
        evidenceRoot: join(state.root, "evidence"),
        sourceRoot: join(state.root, "source"),
        sourceStorePath: join(state.root, "source", "runner.sqlite3"),
        envelopeId: "envelope-1",
        manifestFingerprint: envelope.manifestFingerprint,
        scenarioResultFingerprint: "",
        executionPackageFingerprint: "",
        envelopeFingerprint: envelope.fingerprint,
      };
      equal((await verify(fixture, "verify-published.json")).disposition, DurableFixtureRehearsalEvidenceDisposition.Pass, "published");
    } finally { await removeRoot(state.root); }
  }],
  ["backup substitution fails closed", async () => {
    const root = mkdtempSync(join(tmpdir(), "alpha-t5-backup-sub-"));
    try {
      const fixture = await build(root);
      const path = join(fixture.evidenceRoot, "rehearsal-envelope-1-evidence", "backup", "runner.sqlite3");
      const bytes = readFileSync(path);
      bytes[0] = (bytes[0] ?? 0) ^ 0xff;
      writeFileSync(path, bytes);
      equal((await verify(fixture, "verify-backup-sub.json")).disposition, DurableFixtureRehearsalEvidenceDisposition.FailClosed, "disposition");
    } finally { await removeRoot(root); }
  }],
  ["backup-manifest substitution fails closed", async () => {
    const root = mkdtempSync(join(tmpdir(), "alpha-t5-manifest-sub-"));
    try {
      const fixture = await build(root);
      const path = join(fixture.evidenceRoot, "rehearsal-envelope-1-evidence", "backup", "backup-manifest.json");
      const value = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
      value.backupBytes = Number(value.backupBytes) + 1;
      writeFileSync(path, `${JSON.stringify(value)}\n`);
      equal((await verify(fixture, "verify-manifest-sub.json")).disposition, DurableFixtureRehearsalEvidenceDisposition.FailClosed, "disposition");
    } finally { await removeRoot(root); }
  }],
  ["validation receipt substitution fails closed", async () => {
    const root = mkdtempSync(join(tmpdir(), "alpha-t5-validation-sub-"));
    try {
      const fixture = await build(root);
      const path = join(fixture.evidenceRoot, "rehearsal-envelope-1-evidence", "package", "validation-receipt.json");
      const value = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
      value.passed = false;
      writeFileSync(path, `${JSON.stringify(value)}\n`);
      equal((await verify(fixture, "verify-validation-sub.json")).disposition, DurableFixtureRehearsalEvidenceDisposition.FailClosed, "disposition");
    } finally { await removeRoot(root); }
  }],
  ["extra evidence file fails closed", async () => {
    const root = mkdtempSync(join(tmpdir(), "alpha-t5-extra-"));
    try {
      const fixture = await build(root);
      writeFileSync(join(fixture.evidenceRoot, "rehearsal-envelope-1-evidence", "package", "secret.json"), "{\"secret\":\"x\"}\n");
      equal((await verify(fixture, "verify-extra.json")).disposition, DurableFixtureRehearsalEvidenceDisposition.FailClosed, "disposition");
    } finally { await removeRoot(root); }
  }],
  ["missing backup is INCOMPLETE and never PASS", async () => {
    const root = mkdtempSync(join(tmpdir(), "alpha-t5-missing-"));
    try {
      const fixture = await build(root);
      unlinkSync(join(fixture.evidenceRoot, "rehearsal-envelope-1-evidence", "backup", "runner.sqlite3"));
      equal((await verify(fixture, "verify-missing.json")).disposition, DurableFixtureRehearsalEvidenceDisposition.Incomplete, "disposition");
    } finally { await removeRoot(root); }
  }],
  ["fresh verifier does not require access to mutable source", async () => {
    const root = mkdtempSync(join(tmpdir(), "alpha-t5-source-isolation-"));
    try {
      const fixture = await build(root);
      renameSync(fixture.sourceRoot, `${fixture.sourceRoot}.unavailable`);
      equal((await verify(fixture, "verify-isolated.json")).disposition, DurableFixtureRehearsalEvidenceDisposition.Pass, "disposition");
    } finally { await removeRoot(root); }
  }],
  ["changed expected envelope or manifest identity cannot pass", async () => {
    const root = mkdtempSync(join(tmpdir(), "alpha-t5-identity-"));
    try {
      const fixture = await build(root);
      truth((await verify(fixture, "verify-envelope-wrong.json", WRONG_FP)).disposition !== DurableFixtureRehearsalEvidenceDisposition.Pass, "envelope");
      truth((await verify(fixture, "verify-manifest-wrong.json", fixture.envelopeFingerprint, WRONG_FP)).disposition !== DurableFixtureRehearsalEvidenceDisposition.Pass, "manifest");
    } finally { await removeRoot(root); }
  }],
];

async function main(): Promise<void> {
  let passed = 0;
  for (const [name, run] of tests) {
    await run();
    passed += 1;
    console.log(`PASS ${name}`);
  }
  console.log(`Durable Fixture Rehearsal process drills passed: ${passed}/${tests.length}.`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
