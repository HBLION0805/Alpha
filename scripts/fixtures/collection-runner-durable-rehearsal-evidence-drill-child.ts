import { writeFileSync } from "node:fs";
import { dirname } from "node:path";
import process, { cwd } from "node:process";

import { createDurableEvidenceDrillFixture } from "./collection-runner-durable-rehearsal-evidence-drill-fixture";
import {
  DurableFixtureRehearsalFreshProcessVerifier,
  type DurableFixtureRehearsalEnvelopeBuildObserver,
} from "../../src/engines/event-contract-collection-runner-durable-fixture-rehearsal/EventContractCollectionRunnerDurableFixtureRehearsalEvidence";
import {
  EventContractCollectionRunnerFixtureRehearsalSqliteStore,
} from "../../src/repositories";

const [
  mode, root, variant, resultPath, checkpointPath, envelopeFingerprint,
  manifestFingerprint, validationAuthorityJson,
] =
  process.argv.slice(2);

function write(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
}

async function main(): Promise<void> {
  if (
    mode === "build" ||
    mode === "crash-after-backup" ||
    mode === "crash-before-publication" ||
    mode === "crash-after-publication"
  ) {
    const target =
      mode === "crash-after-backup" ? "BACKUP_DURABLE" :
      mode === "crash-before-publication" ? "ENVELOPE_STAGED" :
      mode === "crash-after-publication" ? "ENVELOPE_PUBLISHED" :
      null;
    const observer: DurableFixtureRehearsalEnvelopeBuildObserver | undefined =
      target === null ? undefined : {
        reached(checkpoint) {
          if (checkpoint !== target) return;
          write(checkpointPath!, { checkpoint });
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60_000);
        },
      };
    const result = await createDurableEvidenceDrillFixture(
      cwd(),
      root!,
      variant === "b" ? "b" : "a",
      observer,
    );
    write(resultPath!, result);
    return;
  }
  if (mode === "verify") {
    const result = new DurableFixtureRehearsalFreshProcessVerifier([
      { evidenceRootId: "evidence-root-1", path: root! },
    ], [JSON.parse(validationAuthorityJson!) as {
      readonly manifestFingerprint: string;
      readonly repositoryCommit: string;
      readonly validationPolicyVersion:
        "ALPHA_FIXED_LOCAL_VALIDATION_V1";
      readonly validationSuiteFingerprint: string;
      readonly registeredTestTotal: number;
    }]).verify(
      "evidence-root-1",
      envelopeFingerprint!,
      manifestFingerprint!,
    );
    write(resultPath!, result);
    return;
  }
  if (mode === "mutate-frozen") {
    const store = EventContractCollectionRunnerFixtureRehearsalSqliteStore.open({
      rootDirectory: dirname(root!),
      storeId: "runner",
      applicationBuildFingerprint: "fnv1a64:2222222222222222",
      appliedAtUtc: "2026-07-25T20:00:00.000Z",
    });
    try {
      let runnerRejected = false;
      let rehearsalRejected = false;
      try { store.createRunnerRepository(); } catch { runnerRejected = true; }
      try {
        store.createDurableRehearsalRepository();
      } catch { rehearsalRejected = true; }
      write(resultPath!, {
        evidenceFrozen: store.isEvidenceFrozen(),
        runnerRejected,
        rehearsalRejected,
      });
    } finally {
      store.close();
    }
    return;
  }
  throw new Error("Unknown durable rehearsal evidence drill mode.");
}

void main();
