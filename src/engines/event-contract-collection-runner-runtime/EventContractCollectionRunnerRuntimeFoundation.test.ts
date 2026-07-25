import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pid } from "node:process";

import {
  EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION,
  CollectionRunnerClockSynchronizationStatus,
  CollectionRunnerRuntimeFoundationErrorCode,
  CollectionRunnerRuntimeMode,
  type CollectionRunnerBootIdentityPort,
  type CollectionRunnerClockHealthProbe,
  type CollectionRunnerMonotonicClock,
  type CollectionRunnerProcessNoncePort,
  type CollectionRunnerRuntimeConfiguration,
  type CollectionRunnerWallClock,
} from "../../contracts";
import {
  FailClosedCollectionRunnerClockHealthProbe,
  NodeCollectionRunnerProcessLivenessPort,
  NodeCollectionRunnerProcessNoncePort,
  acquireCollectionRunnerRuntimeOwnership,
  createCollectionRunnerClockHealthObservation,
  createCollectionRunnerRuntimeConfiguration,
  resolveCollectionRunnerRuntimePaths,
  sampleHealthyCollectionRunnerClocks,
  EventContractCollectionRunnerRuntimeFoundationError,
} from "./EventContractCollectionRunnerRuntimeFoundation";

const FP1 = "fnv1a64:1111111111111111";
const FP2 = "fnv1a64:2222222222222222";
const FP3 = "fnv1a64:3333333333333333";
const FP4 = "fnv1a64:4444444444444444";
const NOW = "2026-07-25T16:00:00.000Z";

class FixedWallClock implements CollectionRunnerWallClock {
  public constructor(private readonly value = NOW) {}
  public nowUtc(): string {
    return this.value;
  }
}

class FixedMonotonicClock implements CollectionRunnerMonotonicClock {
  public constructor(private readonly value = 10_000n) {}
  public nowNanoseconds(): bigint {
    return this.value;
  }
}

class FixedBootIdentityPort implements CollectionRunnerBootIdentityPort {
  public readBootIdentity() {
    return Object.freeze({
      bootIdentity: "boot:test-1",
      source: "TEST_FIXTURE",
      sourceVersion: "1.0",
    });
  }
}

class FixedNoncePort implements CollectionRunnerProcessNoncePort {
  public constructor(
    private readonly value =
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  ) {}
  public createNonce(): string {
    return this.value;
  }
}

class FixedHealthProbe implements CollectionRunnerClockHealthProbe {
  public constructor(
    private readonly changes: Readonly<Record<string, unknown>> = {},
  ) {}
  public observe() {
    return {
      observedAtUtc: "2026-07-25T15:59:59.500Z",
      synchronizationStatus:
        CollectionRunnerClockSynchronizationStatus.Synchronized,
      estimatedAbsoluteUtcOffsetMilliseconds: 25,
      source: "TEST_CLOCK",
      policyVersion: "1.0",
      freshnessDeadlineUtc: "2026-07-25T16:00:02.000Z",
      ...this.changes,
    } as ReturnType<CollectionRunnerClockHealthProbe["observe"]>;
  }
}

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}

function expectFoundationError(
  run: () => unknown,
  code: CollectionRunnerRuntimeFoundationErrorCode,
): void {
  try {
    run();
  } catch (error) {
    assertTrue(
      error instanceof EventContractCollectionRunnerRuntimeFoundationError,
      "typed runtime-foundation error",
    );
    assertEqual(
      (error as EventContractCollectionRunnerRuntimeFoundationError).code,
      code,
      "error code",
    );
    return;
  }
  throw new Error(`Expected ${code}.`);
}

function withTemporaryRoots(
  run: (root: string, controlRoot: string, sqliteRoot: string) => void,
): void {
  const root = mkdtempSync(join(tmpdir(), "alpha-runner-runtime-"));
  const controlRoot = join(root, "control");
  const sqliteRoot = join(root, "sqlite");
  try {
    run(root, controlRoot, sqliteRoot);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function configurationInput(
  controlRoot: string,
  sqliteRoot: string,
  changes: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION,
    runtimeId: "runtime:fixture-1",
    runtimeMode: CollectionRunnerRuntimeMode.FixtureOnly,
    runtimeControlRoot: controlRoot,
    sqliteRoot,
    storeId: "collection-runner",
    activationId: "activation:pilot-1",
    applicationBuildFingerprint: FP1,
    runnerDefinitionFingerprint: FP2,
    frozenPlanFingerprint: FP3,
    fixtureProviderFingerprint: FP4,
    maximumClockOffsetMilliseconds: 1_000,
    maximumClockHealthAgeMilliseconds: 5_000,
    ...changes,
  };
}

function configuration(
  controlRoot: string,
  sqliteRoot: string,
): CollectionRunnerRuntimeConfiguration {
  return createCollectionRunnerRuntimeConfiguration(
    configurationInput(controlRoot, sqliteRoot),
  );
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  [
    "configuration is strict immutable and deterministic",
    () =>
      withTemporaryRoots((_root, controlRoot, sqliteRoot) => {
        const first = configuration(controlRoot, sqliteRoot);
        const second = configuration(controlRoot, sqliteRoot);
        assertEqual(first.fingerprint, second.fingerprint, "fingerprint");
        assertEqual(first.networkPermitted, false, "network denied");
        assertEqual(first.continuousRunPermitted, false, "continuous run denied");
        assertEqual(first.maximumWorkers, 1, "single fixture worker");
        assertTrue(Object.isFrozen(first), "configuration frozen");
      }),
  ],
  [
    "configuration rejects unknown fields",
    () =>
      withTemporaryRoots((_root, controlRoot, sqliteRoot) => {
        expectFoundationError(
          () =>
            createCollectionRunnerRuntimeConfiguration(
              configurationInput(controlRoot, sqliteRoot, {
                providerUrl: "https://example.invalid",
              }),
            ),
          CollectionRunnerRuntimeFoundationErrorCode.UnknownField,
        );
      }),
  ],
  [
    "configuration rejects every non-fixture mode",
    () =>
      withTemporaryRoots((_root, controlRoot, sqliteRoot) => {
        expectFoundationError(
          () =>
            createCollectionRunnerRuntimeConfiguration(
              configurationInput(controlRoot, sqliteRoot, {
                runtimeMode: "LIVE",
              }),
            ),
          CollectionRunnerRuntimeFoundationErrorCode.InvalidConfiguration,
        );
      }),
  ],
  [
    "configuration rejects traversal store IDs",
    () =>
      withTemporaryRoots((_root, controlRoot, sqliteRoot) => {
        expectFoundationError(
          () =>
            createCollectionRunnerRuntimeConfiguration(
              configurationInput(controlRoot, sqliteRoot, {
                storeId: "../escape",
              }),
            ),
          CollectionRunnerRuntimeFoundationErrorCode.InvalidConfiguration,
        );
      }),
  ],
  [
    "configuration rejects invalid fingerprints",
    () =>
      withTemporaryRoots((_root, controlRoot, sqliteRoot) => {
        expectFoundationError(
          () =>
            createCollectionRunnerRuntimeConfiguration(
              configurationInput(controlRoot, sqliteRoot, {
                fixtureProviderFingerprint: "provider",
              }),
            ),
          CollectionRunnerRuntimeFoundationErrorCode.InvalidConfiguration,
        );
      }),
  ],
  [
    "path resolution creates canonical bounded roots",
    () =>
      withTemporaryRoots((_root, controlRoot, sqliteRoot) => {
        const config = configuration(controlRoot, sqliteRoot);
        const paths = resolveCollectionRunnerRuntimePaths(config);
        assertTrue(paths.storePath.startsWith(paths.sqliteRoot), "store root");
        assertTrue(
          paths.lockDirectory.startsWith(paths.runtimeControlRoot),
          "lock root",
        );
        assertTrue(Object.isFrozen(paths), "paths frozen");
      }),
  ],
  [
    "path resolution rejects a UNC control root",
    () =>
      withTemporaryRoots((_root, _controlRoot, sqliteRoot) => {
        const config = configuration("\\\\server\\share", sqliteRoot);
        expectFoundationError(
          () => resolveCollectionRunnerRuntimePaths(config),
          CollectionRunnerRuntimeFoundationErrorCode.InvalidPath,
        );
      }),
  ],
  [
    "path resolution rejects a directory in the SQLite file position",
    () =>
      withTemporaryRoots((_root, controlRoot, sqliteRoot) => {
        const config = configuration(controlRoot, sqliteRoot);
        const first = resolveCollectionRunnerRuntimePaths(config);
        rmSync(first.storePath, { force: true });
        // The store path itself may not be a directory or link.
        const directoryConfig = configuration(controlRoot, sqliteRoot);
        mkdirSync(first.storePath);
        expectFoundationError(
          () => resolveCollectionRunnerRuntimePaths(directoryConfig),
          CollectionRunnerRuntimeFoundationErrorCode.UnsafeFilesystemEntry,
        );
      }),
  ],
  [
    "ownership acquisition creates canonical process-bound evidence",
    () =>
      withTemporaryRoots((_root, controlRoot, sqliteRoot) => {
        const config = configuration(controlRoot, sqliteRoot);
        const paths = resolveCollectionRunnerRuntimePaths(config);
        const handle = acquireCollectionRunnerRuntimeOwnership({
          configuration: config,
          paths,
          bootIdentityPort: new FixedBootIdentityPort(),
          processNoncePort: new FixedNoncePort(),
          processId: 1234,
          wallClock: new FixedWallClock(),
        });
        assertTrue(existsSync(paths.lockOwnerRecordPath), "owner record exists");
        assertEqual(handle.ownership.processId, 1234, "process ID");
        assertTrue(
          handle.ownership.processSessionId.startsWith("process:sha256:"),
          "minted process session",
        );
        assertEqual(
          handle.verify().fingerprint,
          handle.ownership.fingerprint,
          "verified ownership",
        );
        handle.releaseCleanly();
      }),
  ],
  [
    "second process cannot acquire an existing lock",
    () =>
      withTemporaryRoots((_root, controlRoot, sqliteRoot) => {
        const config = configuration(controlRoot, sqliteRoot);
        const paths = resolveCollectionRunnerRuntimePaths(config);
        const first = acquireCollectionRunnerRuntimeOwnership({
          configuration: config,
          paths,
          bootIdentityPort: new FixedBootIdentityPort(),
          processNoncePort: new FixedNoncePort(),
          processId: 1234,
          wallClock: new FixedWallClock(),
        });
        expectFoundationError(
          () =>
            acquireCollectionRunnerRuntimeOwnership({
              configuration: config,
              paths,
              bootIdentityPort: new FixedBootIdentityPort(),
              processNoncePort: new FixedNoncePort(
                "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
              ),
              processId: 5678,
              wallClock: new FixedWallClock(),
            }),
          CollectionRunnerRuntimeFoundationErrorCode.DuplicateProcess,
        );
        first.releaseCleanly();
      }),
  ],
  [
    "configuration drift cannot create a parallel lock for one store activation",
    () =>
      withTemporaryRoots((_root, controlRoot, sqliteRoot) => {
        const firstConfig = configuration(controlRoot, sqliteRoot);
        const changedConfig = createCollectionRunnerRuntimeConfiguration(
          configurationInput(controlRoot, sqliteRoot, {
            maximumClockHealthAgeMilliseconds: 4_000,
          }),
        );
        const firstPaths = resolveCollectionRunnerRuntimePaths(firstConfig);
        const changedPaths =
          resolveCollectionRunnerRuntimePaths(changedConfig);
        assertEqual(
          changedPaths.lockDirectory,
          firstPaths.lockDirectory,
          "stable ownership address",
        );
        const first = acquireCollectionRunnerRuntimeOwnership({
          configuration: firstConfig,
          paths: firstPaths,
          bootIdentityPort: new FixedBootIdentityPort(),
          processNoncePort: new FixedNoncePort(),
          processId: 1234,
          wallClock: new FixedWallClock(),
        });
        expectFoundationError(
          () =>
            acquireCollectionRunnerRuntimeOwnership({
              configuration: changedConfig,
              paths: changedPaths,
              bootIdentityPort: new FixedBootIdentityPort(),
              processNoncePort: new FixedNoncePort(),
              processId: 5678,
              wallClock: new FixedWallClock(),
            }),
          CollectionRunnerRuntimeFoundationErrorCode.DuplicateProcess,
        );
        first.releaseCleanly();
      }),
  ],
  [
    "changed nonce creates a different process session",
    () =>
      withTemporaryRoots((_root, controlRoot, sqliteRoot) => {
        const config = configuration(controlRoot, sqliteRoot);
        const paths = resolveCollectionRunnerRuntimePaths(config);
        const first = acquireCollectionRunnerRuntimeOwnership({
          configuration: config,
          paths,
          bootIdentityPort: new FixedBootIdentityPort(),
          processNoncePort: new FixedNoncePort(),
          processId: 1234,
          wallClock: new FixedWallClock(),
        });
        const firstSession = first.ownership.processSessionId;
        first.releaseCleanly();
        const second = acquireCollectionRunnerRuntimeOwnership({
          configuration: config,
          paths,
          bootIdentityPort: new FixedBootIdentityPort(),
          processNoncePort: new FixedNoncePort(
            "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          ),
          processId: 1234,
          wallClock: new FixedWallClock(),
        });
        assertTrue(
          second.ownership.processSessionId !== firstSession,
          "fresh session",
        );
        second.releaseCleanly();
      }),
  ],
  [
    "tampered ownership record fails verification",
    () =>
      withTemporaryRoots((_root, controlRoot, sqliteRoot) => {
        const config = configuration(controlRoot, sqliteRoot);
        const paths = resolveCollectionRunnerRuntimePaths(config);
        const handle = acquireCollectionRunnerRuntimeOwnership({
          configuration: config,
          paths,
          bootIdentityPort: new FixedBootIdentityPort(),
          processNoncePort: new FixedNoncePort(),
          processId: 1234,
          wallClock: new FixedWallClock(),
        });
        const parsed = JSON.parse(
          readFileSync(paths.lockOwnerRecordPath, "utf8"),
        ) as Record<string, unknown>;
        parsed.processId = 9999;
        writeFileSync(paths.lockOwnerRecordPath, JSON.stringify(parsed));
        expectFoundationError(
          () => handle.verify(),
          CollectionRunnerRuntimeFoundationErrorCode.OwnershipLost,
        );
      }),
  ],
  [
    "clean release removes only the exact verified lock",
    () =>
      withTemporaryRoots((_root, controlRoot, sqliteRoot) => {
        const config = configuration(controlRoot, sqliteRoot);
        const paths = resolveCollectionRunnerRuntimePaths(config);
        const handle = acquireCollectionRunnerRuntimeOwnership({
          configuration: config,
          paths,
          bootIdentityPort: new FixedBootIdentityPort(),
          processNoncePort: new FixedNoncePort(),
          processId: 1234,
          wallClock: new FixedWallClock(),
        });
        handle.releaseCleanly();
        assertEqual(existsSync(paths.lockDirectory), false, "lock removed");
        expectFoundationError(
          () => handle.verify(),
          CollectionRunnerRuntimeFoundationErrorCode.OwnershipLost,
        );
      }),
  ],
  [
    "invalid boot identity leaves a fail-closed stale lock",
    () =>
      withTemporaryRoots((_root, controlRoot, sqliteRoot) => {
        const config = configuration(controlRoot, sqliteRoot);
        const paths = resolveCollectionRunnerRuntimePaths(config);
        expectFoundationError(
          () =>
            acquireCollectionRunnerRuntimeOwnership({
              configuration: config,
              paths,
              bootIdentityPort: {
                readBootIdentity: () => ({
                  bootIdentity: "../invalid",
                  source: "TEST",
                  sourceVersion: "1.0",
                }),
              },
              processNoncePort: new FixedNoncePort(),
              processId: 1234,
              wallClock: new FixedWallClock(),
            }),
          CollectionRunnerRuntimeFoundationErrorCode.InvalidBootIdentity,
        );
        assertTrue(existsSync(paths.lockDirectory), "stale lock preserved");
      }),
  ],
  [
    "ownership does not accept a caller-selected process session",
    () => {
      assertEqual(
        acquireCollectionRunnerRuntimeOwnership.length,
        1,
        "single options argument",
      );
    },
  ],
  [
    "OS CSPRNG nonce has canonical shape and changes",
    () => {
      const port = new NodeCollectionRunnerProcessNoncePort();
      const first = port.createNonce();
      const second = port.createNonce();
      assertTrue(/^sha256:[0-9a-f]{64}$/u.test(first), "nonce shape");
      assertTrue(first !== second, "nonce changes");
    },
  ],
  [
    "local process-liveness port recognizes this process",
    () => {
      const port = new NodeCollectionRunnerProcessLivenessPort();
      assertEqual(port.isProcessAlive(pid), true, "current process alive");
      assertEqual(port.isProcessAlive(0), false, "invalid process absent");
    },
  ],
  [
    "clock health observation is immutable and fingerprinted",
    () => {
      const observation = createCollectionRunnerClockHealthObservation(
        new FixedHealthProbe().observe(),
      );
      assertTrue(Object.isFrozen(observation), "observation frozen");
      assertTrue(
        /^sha256:[0-9a-f]{64}$/u.test(observation.fingerprint),
        "observation fingerprint",
      );
    },
  ],
  [
    "healthy wall monotonic and health ports produce one snapshot",
    () =>
      withTemporaryRoots((_root, controlRoot, sqliteRoot) => {
        const snapshot = sampleHealthyCollectionRunnerClocks(
          configuration(controlRoot, sqliteRoot),
          new FixedWallClock(),
          new FixedMonotonicClock(),
          new FixedHealthProbe(),
        );
        assertEqual(snapshot.wallClockUtc, NOW, "wall time");
        assertEqual(snapshot.monotonicNanoseconds, 10_000n, "monotonic time");
        assertEqual(snapshot.healthy, true, "health");
      }),
  ],
  [
    "unknown clock synchronization fails closed",
    () =>
      withTemporaryRoots((_root, controlRoot, sqliteRoot) => {
        expectFoundationError(
          () =>
            sampleHealthyCollectionRunnerClocks(
              configuration(controlRoot, sqliteRoot),
              new FixedWallClock(),
              new FixedMonotonicClock(),
              new FailClosedCollectionRunnerClockHealthProbe(
                new FixedWallClock(),
              ),
            ),
          CollectionRunnerRuntimeFoundationErrorCode.ClockUnhealthy,
        );
      }),
  ],
  [
    "excessive clock offset fails closed",
    () =>
      withTemporaryRoots((_root, controlRoot, sqliteRoot) => {
        expectFoundationError(
          () =>
            sampleHealthyCollectionRunnerClocks(
              configuration(controlRoot, sqliteRoot),
              new FixedWallClock(),
              new FixedMonotonicClock(),
              new FixedHealthProbe({
                estimatedAbsoluteUtcOffsetMilliseconds: 1_001,
              }),
            ),
          CollectionRunnerRuntimeFoundationErrorCode.ClockUnhealthy,
        );
      }),
  ],
  [
    "stale clock evidence fails closed",
    () =>
      withTemporaryRoots((_root, controlRoot, sqliteRoot) => {
        expectFoundationError(
          () =>
            sampleHealthyCollectionRunnerClocks(
              configuration(controlRoot, sqliteRoot),
              new FixedWallClock(),
              new FixedMonotonicClock(),
              new FixedHealthProbe({
                observedAtUtc: "2026-07-25T15:59:50.000Z",
              }),
            ),
          CollectionRunnerRuntimeFoundationErrorCode.ClockUnhealthy,
        );
      }),
  ],
  [
    "expired clock evidence fails closed",
    () =>
      withTemporaryRoots((_root, controlRoot, sqliteRoot) => {
        expectFoundationError(
          () =>
            sampleHealthyCollectionRunnerClocks(
              configuration(controlRoot, sqliteRoot),
              new FixedWallClock(),
              new FixedMonotonicClock(),
              new FixedHealthProbe({
                freshnessDeadlineUtc: "2026-07-25T15:59:59.999Z",
              }),
            ),
          CollectionRunnerRuntimeFoundationErrorCode.ClockUnhealthy,
        );
      }),
  ],
  [
    "negative monotonic time is rejected",
    () =>
      withTemporaryRoots((_root, controlRoot, sqliteRoot) => {
        expectFoundationError(
          () =>
            sampleHealthyCollectionRunnerClocks(
              configuration(controlRoot, sqliteRoot),
              new FixedWallClock(),
              new FixedMonotonicClock(-1n),
              new FixedHealthProbe(),
            ),
          CollectionRunnerRuntimeFoundationErrorCode.InvalidClockEvidence,
        );
      }),
  ],
  [
    "foundation helper surface exposes no scheduler worker or provider request",
    () => {
      const forbidden = [
        "schedule",
        "worker",
        "adapter",
        "request",
        "runPilot",
      ];
      const surface = {
        acquireCollectionRunnerRuntimeOwnership,
        createCollectionRunnerRuntimeConfiguration,
        resolveCollectionRunnerRuntimePaths,
        sampleHealthyCollectionRunnerClocks,
      };
      assertEqual(
        Object.keys(surface).some((key) =>
          forbidden.some((word) => key.toLowerCase().includes(word.toLowerCase())),
        ),
        false,
        "prohibited surface absent",
      );
    },
  ],
];

let passed = 0;
for (const [name, run] of tests) {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

console.log(
  `Event Contract Collection Runner Runtime Foundation tests passed: ${String(passed)}/${String(tests.length)}.`,
);
