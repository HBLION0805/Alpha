import { join } from "node:path";
import process, { argv, pid, stderr, stdout } from "node:process";

import {
  CollectionRunnerRuntimeMode,
} from "../../src/contracts";
import {
  acquireCollectionRunnerRuntimeOwnership,
  createCollectionRunnerRuntimeConfiguration,
  resolveCollectionRunnerRuntimePaths,
} from "../../src/engines/event-contract-collection-runner-runtime/EventContractCollectionRunnerRuntimeFoundation";

const [mode, root] = argv.slice(2);
if ((mode !== "hold-lock" && mode !== "try-lock") || root === undefined) {
  stderr.write("INVALID_ARGUMENTS\n");
  process.exitCode = 64;
} else {
  const configuration = createCollectionRunnerRuntimeConfiguration({
    schemaVersion: "1.0",
    runtimeId: "runtime:process-drill",
    runtimeMode: CollectionRunnerRuntimeMode.FixtureOnly,
    runtimeControlRoot: join(root, "control"),
    sqliteRoot: join(root, "sqlite"),
    storeId: "process-drill",
    activationId: "activation:process-drill",
    applicationBuildFingerprint: "fnv1a64:1111111111111111",
    runnerDefinitionFingerprint: "fnv1a64:2222222222222222",
    frozenPlanFingerprint: "fnv1a64:3333333333333333",
    fixtureProviderFingerprint: "fnv1a64:4444444444444444",
    maximumClockOffsetMilliseconds: 1_000,
    maximumClockHealthAgeMilliseconds: 60_000,
  });
  try {
    const paths = resolveCollectionRunnerRuntimePaths(configuration);
    const ownership = acquireCollectionRunnerRuntimeOwnership({
      configuration,
      paths,
      bootIdentityPort: {
        readBootIdentity: () => ({
          bootIdentity: "boot:process-drill",
          source: "PROCESS_DRILL",
          sourceVersion: "1.0",
        }),
      },
      processId: pid,
      wallClock: { nowUtc: () => "2026-07-25T14:00:00.000Z" },
    });
    stdout.write(
      `ACQUIRED ${ownership.ownership.fingerprint} ${paths.lockOwnerRecordPath}\n`,
    );
    if (mode === "try-lock") {
      ownership.releaseCleanly();
    } else {
      setInterval(() => undefined, 1_000);
    }
  } catch (error) {
    stderr.write(
      `ERROR ${error instanceof Error ? error.message : "unknown"}\n`,
    );
    stdout.write("BLOCKED\n");
    process.exitCode = 2;
  }
}
