import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import * as nodeFs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process, { cwd, execPath } from "node:process";

import { CollectionRunnerRehearsalVerificationDisposition } from "../../contracts";
import {
  EventContractCollectionRunnerFixtureRehearsalPackageBuilder,
  EventContractCollectionRunnerFixtureRehearsalPackageVerifier,
} from "./EventContractCollectionRunnerFixtureRehearsalPackage";
import {
  createPackageTestRequest,
  packageTestManifest,
} from "./EventContractCollectionRunnerFixtureRehearsalPackage.test";

const CHILD = join(
  cwd(),
  "scripts",
  "fixtures",
  "collection-runner-rehearsal-package-drill-child.ts",
);
const TSX = join(cwd(), "node_modules", "tsx", "dist", "cli.mjs");

type DrillMode =
  | "after-artifacts"
  | "after-commit"
  | "stop-before-package"
  | "leakage-before-package";

function equal<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}.`);
}

function truth(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

async function waitForCheckpoint(
  child: ChildProcessWithoutNullStreams,
  marker: string,
): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!existsSync(marker)) {
    if (child.exitCode !== null) throw new Error(`Package drill child exited ${String(child.exitCode)} before checkpoint.`);
    if (Date.now() > deadline) throw new Error("Timed out waiting for package drill checkpoint.");
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
}

async function runCrash(mode: DrillMode): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), `alpha-rehearsal-${mode}-`));
  const requestPath = join(root, "request.json");
  const marker = join(root, `checkpoint-${mode}`);
  const request = createPackageTestRequest();
  writeFileSync(requestPath, `${JSON.stringify(request)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  const child = spawn(execPath, [TSX, CHILD, mode, root, requestPath], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let exited = false;
  try {
    await waitForCheckpoint(child, marker);
    const exit = once(child, "exit");
    truth(child.kill(), `${mode} kill accepted`);
    await exit;
    exited = true;
    const suffix = packageTestManifest.fingerprint.slice(7, 31);
    const packageDirectory = join(root, `rehearsal-${suffix}-evidence`);
    const builder = new EventContractCollectionRunnerFixtureRehearsalPackageBuilder(cwd(), [
      { packageRootId: request.packageRootId, path: root },
    ], { verifyBoundEvidence: () => true });
    if (mode === "after-artifacts") {
      equal(existsSync(packageDirectory), false, "uncommitted package absent");
      const result = builder.build(request);
      equal(result.replayed, false, "rebuilt after partial staging");
      const names = (nodeFs as unknown as { readdirSync(path: string): string[] }).readdirSync(root);
      truth(names.some((name) => name.includes(".quarantine-")), "partial staging quarantined");
      equal(
        new EventContractCollectionRunnerFixtureRehearsalPackageVerifier()
          .verify(result.packageDirectory).disposition,
        CollectionRunnerRehearsalVerificationDisposition.Pass,
        "rebuilt package",
      );
    } else if (mode === "after-commit") {
      truth(existsSync(packageDirectory), "committed package survives crash");
      const envelopeBefore = readFileSync(join(packageDirectory, "evidence-package.json"), "utf8");
      const replay = builder.build(request);
      equal(replay.replayed, true, "post-commit exact replay");
      equal(
        readFileSync(join(packageDirectory, "evidence-package.json"), "utf8"),
        envelopeBefore,
        "post-commit package unchanged",
      );
    } else {
      equal(existsSync(packageDirectory), false, `${mode} package absent`);
      const code = readFileSync(marker, "utf8").trim();
      equal(
        code,
        mode === "stop-before-package" ? "STATE_CONFLICT" : "LEAKAGE_DETECTED",
        `${mode} result`,
      );
    }
  } finally {
    if (!exited && child.exitCode === null) {
      const exit = once(child, "exit");
      child.kill();
      await exit;
    }
    rmSync(root, { recursive: true, force: true });
  }
}

const tests: ReadonlyArray<readonly [string, () => Promise<void>]> = [
  ["process crash after durable artifacts leaves no valid package and quarantines partial state", async () => {
    await runCrash("after-artifacts");
  }],
  ["process crash after atomic package commit replays without overwrite", async () => {
    await runCrash("after-commit");
  }],
  ["fresh process observes Stop before package mutation", async () => {
    await runCrash("stop-before-package");
  }],
  ["fresh process rejects excluded evidence before package commit", async () => {
    await runCrash("leakage-before-package");
  }],
];

async function main(): Promise<void> {
  let passed = 0;
  for (const [name, run] of tests) {
    await run();
    passed += 1;
    console.log(`PASS ${name}`);
  }
  console.log(`Event Contract Collection Runner fixture rehearsal package process drill: ${passed}/${tests.length} passed.`);
}

void main();
