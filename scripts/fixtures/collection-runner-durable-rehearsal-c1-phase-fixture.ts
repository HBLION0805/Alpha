import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { DatabaseSync } from "node:sqlite";

import {
  CollectionRunnerPilotState,
  CollectionRunnerRuntimeAssemblyAction,
  CollectionRunnerClockSynchronizationStatus,
  CollectionRunnerRuntimeHealthStatus,
  CollectionRunnerRuntimeMode,
  CollectionRunnerTaskState,
  DURABLE_FIXTURE_REHEARSAL_EVIDENCE_NON_AUTHORITY,
  DURABLE_FIXTURE_REHEARSAL_VALIDATION_POLICY,
  DurableFixtureRehearsalLifecycleState,
  DurableFixtureRehearsalPhase,
  EventContractSourceCapability,
  EventContractSourceExecutionMode,
  CollectionRunnerFixtureAdapterOutcome,
  EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_COORDINATOR_SCHEMA_VERSION,
  EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_SCHEMA_VERSION,
  EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION,
  EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION,
  type DurableFixtureRehearsalPhaseRequest,
  type DurableFixtureRehearsalProcessContext,
  type DurableFixtureRehearsalRegistry,
  type DurableFixtureRehearsalRegistryInput,
  type DurableFixtureRehearsalValidationReceipt,
} from "../../src/contracts";
import {
  acquireCollectionRunnerRuntimeOwnership,
  createCollectionRunnerRuntimeConfiguration,
  createCollectionRunnerRuntimeWorkSnapshot,
  EventContractCollectionRunnerRuntimeAssemblyPlanner,
  EventContractCollectionRunnerFixtureWorker,
  EventContractCollectionRunnerRuntimeForegroundStep,
  resolveCollectionRunnerRuntimePaths,
} from "../../src/engines/event-contract-collection-runner-runtime";
import {
  createDurableFixtureRehearsalEvidencePlan,
  createDurableFixtureRehearsalOperationClaim,
  createDurableFixtureRehearsalRegistry,
  createDurableFixtureRehearsalTransition,
  EventContractCollectionRunnerDurableFixtureRehearsalCoordinator,
  EventContractCollectionRunnerDurableFixtureRehearsalStepAdapter,
} from "../../src/engines/event-contract-collection-runner-durable-fixture-rehearsal";
import {
  DurableFixtureRehearsalEnvelopeBuilder,
  DurableFixtureRehearsalFreshProcessVerifier,
  FixedLocalDurableFixtureRehearsalValidationAdapter,
  createDurableFixtureRehearsalValidationReceipt,
} from "../../src/engines/event-contract-collection-runner-durable-fixture-rehearsal/EventContractCollectionRunnerDurableFixtureRehearsalEvidence";
import {
  createNewCollectionRunnerFixtureRehearsalSqliteProfile,
  createSqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository,
  CollectionRunnerProcessStopBarrier,
  SessionGatedEventContractCollectionRunnerRepository,
} from "../../src/repositories";
import {
  createSqliteEventContractCollectionRunnerRepository,
} from "../../src/repositories/SqliteEventContractCollectionRunnerRepository";
import {
  createCollectionRunnerTransactionDrillDomain,
  createTransactionDrillSnapshot,
  TRANSACTION_DRILL_BUILD,
} from "./collection-runner-transaction-drill-fixture";

const AT = "2026-07-25T20:00:00.000Z";
const FP = (value: string): string =>
  `fnv1a64:${value.repeat(16).slice(0, 16)}`;
const BUILD = TRANSACTION_DRILL_BUILD;
const MANIFEST = FP("1");
const ACTIVATION_ID = "activation:transaction-drill";
const TASK_ID = "task:transaction-drill";
const STOP_FILE = "owner-stop.requested";

export interface C1PhaseState {
  readonly root: string;
  readonly variant: "a" | "b";
  readonly sourceRoot: string;
  readonly sourceStorePath: string;
  readonly schemaCatalogChecksum: string;
  readonly evidenceRoot: string;
  readonly validationRoot: string;
  readonly validationReceiptPath: string;
  readonly repositoryCommit: string;
  readonly validationSuiteFingerprint: string;
  readonly registeredTestTotal: number;
  readonly envelopeFingerprint: string | null;
  readonly scenarioResultFingerprint: string | null;
  readonly executionPackageFingerprint: string | null;
}

function sha(value: string | Uint8Array): string {
  const hash = createHash("sha256");
  if (typeof value === "string") hash.update(value, "utf8");
  else hash.update(value);
  return `sha256:${hash.digest("hex")}`;
}

function openDatabase(path: string, readOnly = false): DatabaseSync {
  const database = new DatabaseSync(path, {
    open: true,
    readOnly,
    defensive: true,
    enableForeignKeyConstraints: true,
  });
  database.exec(
    readOnly
      ? "PRAGMA foreign_keys = ON; PRAGMA query_only = ON;"
      : "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;",
  );
  return database;
}

function statePath(root: string): string {
  return join(root, "c1-phase-state.json");
}

function assertC2StopClear(root: string): void {
  if (existsSync(join(root, STOP_FILE))) {
    throw new Error("C2 Owner Stop blocks the mutable phase.");
  }
}

export function setC2Stop(root: string, active: boolean): void {
  const path = join(root, STOP_FILE);
  if (active) {
    writeFileSync(path, "STOP\n", { encoding: "utf8", flag: "wx" });
  } else if (existsSync(path)) {
    unlinkSync(path);
  }
}

function save(state: C1PhaseState): void {
  writeFileSync(
    statePath(state.root),
    `${JSON.stringify(state)}\n`,
    { encoding: "utf8" },
  );
}

export function readC1PhaseState(root: string): C1PhaseState {
  return JSON.parse(readFileSync(statePath(root), "utf8")) as C1PhaseState;
}

function seedInitialRunner(database: DatabaseSync): void {
  const repository =
    createSqliteEventContractCollectionRunnerRepository(database);
  const { definition, activation, task } =
    createCollectionRunnerTransactionDrillDomain();
  repository.registerRunnerDefinition({
    definition,
    evidence: {
      occurredAtUtc: "2026-07-25T12:31:00.000Z",
      reasonCode: "DEFINITION_REVIEWED",
    },
  });
  repository.createPilotArtifact({
    activation,
    evidence: {
      occurredAtUtc: "2026-07-25T12:32:00.000Z",
      reasonCode: "OWNER_APPROVAL_RECORDED",
    },
  });
  repository.materializeTasks({
    activationId: activation.activationId,
    expectedBudgetVersion: 1,
    tasks: [task],
    evidence: {
      occurredAtUtc: "2026-07-25T12:33:00.000Z",
      reasonCode: "TASK_SET_FROZEN",
    },
  });
  repository.transitionPilot({
    activationId: activation.activationId,
    expectedAggregateVersion: 1,
    nextState: CollectionRunnerPilotState.Active,
    clock: {
      observedAtUtc: "2026-07-25T13:00:00.000Z",
      absoluteOffsetMilliseconds: 10,
      healthy: true,
    },
    recoveryBlockerCount: 0,
    evidence: {
      occurredAtUtc: "2026-07-25T13:00:00.000Z",
      reasonCode: "OWNER_ACTIVATED",
    },
  });
}

function createValidationRepository(root: string): {
  readonly commit: string;
  readonly suite: string;
} {
  const scripts = join(root, "scripts");
  mkdirSync(scripts, { recursive: true });
  const packageText = `${JSON.stringify({
    private: true,
    scripts: { "alpha:validate": "node scripts/alpha-validate.mjs" },
  }, null, 2)}\n`;
  const validationText =
    "console.log(JSON.stringify({overall:{testsExecuted:1,passed:1,failed:0}}));\n";
  writeFileSync(
    join(root, "package.json"),
    packageText,
    { encoding: "utf8" },
  );
  writeFileSync(
    join(scripts, "alpha-validate.mjs"),
    validationText,
    { encoding: "utf8" },
  );
  const run = (args: readonly string[]): string => {
    const result = spawnSync("git", args, {
      cwd: root,
      input: "",
      encoding: "utf8",
      shell: false,
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
      killSignal: "SIGTERM",
    });
    if (result.status !== 0) throw new Error("C1 validation repository setup failed.");
    return result.stdout.trim();
  };
  run(["init", "--quiet"]);
  run(["config", "user.name", "Alpha Fixture"]);
  run(["config", "user.email", "fixture@alpha.invalid"]);
  run(["add", "--", "package.json", "scripts/alpha-validate.mjs"]);
  run(["commit", "--quiet", "-m", "fixture validation authority"]);
  const suiteHash = createHash("sha256");
  suiteHash.update(readFileSync(join(scripts, "alpha-validate.mjs")));
  suiteHash.update(readFileSync(join(root, "package.json")));
  return {
    commit: run(["rev-parse", "HEAD"]),
    suite: `sha256:${suiteHash.digest("hex")}`,
  };
}

function registryInput(
  variant: "a" | "b",
): DurableFixtureRehearsalRegistryInput {
  return {
    schemaVersion:
      EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_SCHEMA_VERSION,
    rehearsalId: "rehearsal-1",
    manifestFingerprint: MANIFEST,
    buildFingerprint: BUILD,
    runnerFingerprint: FP("3"),
    frozenPlanFingerprint: FP("4"),
    catalogFingerprint: FP("5"),
    providerFingerprint: FP("6"),
    mappingFingerprint: FP("7"),
    activationId: ACTIVATION_ID,
    taskSetFingerprint: FP("8"),
    workspaceIdentity: FP(variant === "a" ? "9" : "a"),
    storeIdentity: FP(variant === "a" ? "b" : "c"),
    lifecycleState: DurableFixtureRehearsalLifecycleState.Prepared,
    lifecycleVersion: 3,
    nextInvocationOrdinal: 1,
    recoveryFingerprint: FP("d"),
    maximumInvocations: 3,
    scenarioResultFingerprint: null,
    executionPackageFingerprint: null,
    nonAuthorityDeclaration: DURABLE_FIXTURE_REHEARSAL_EVIDENCE_NON_AUTHORITY,
    createdAtUtc: AT,
  };
}

function request(
  phase: DurableFixtureRehearsalPhase,
  registry?: DurableFixtureRehearsalRegistry,
  ordinal: number | null = null,
): DurableFixtureRehearsalPhaseRequest {
  return {
    schemaVersion:
      EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_COORDINATOR_SCHEMA_VERSION,
    registeredManifestId: "manifest-c1",
    registeredPhaseId: `phase-${phase.toLocaleLowerCase()}`,
    rehearsalId: "rehearsal-1",
    manifestFingerprint: MANIFEST,
    phase,
    expectedLifecycleVersion: registry?.lifecycleVersion ?? 1,
    expectedInvocationOrdinal: ordinal,
    expectedRecoveryFingerprint: registry?.recoveryFingerprint ?? FP("d"),
    invocationId: `invocation-${phase.toLocaleLowerCase()}-${String(ordinal ?? 0)}`,
    ownerAuthorizationId:
      phase === DurableFixtureRehearsalPhase.Recover
        ? "authorization-c1"
        : null,
  };
}

function phaseObservedAt(ordinal: number): string {
  return [
    "2026-07-25T13:00:00.000Z",
    "2026-07-25T13:05:00.000Z",
    "2026-07-25T13:06:00.000Z",
    "2026-07-25T13:07:00.000Z",
  ][ordinal] ?? "2026-07-25T13:08:00.000Z";
}

function coordinator(
  database: DatabaseSync,
  root: string,
  variant: "a" | "b",
  ordinal: number,
  afterClaimFault: "STOP" | "CRASH" | null = null,
): EventContractCollectionRunnerDurableFixtureRehearsalCoordinator {
  const durable =
    createSqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository(
      database,
    );
  const runner = createSqliteEventContractCollectionRunnerRepository(database);
  const domain = createCollectionRunnerTransactionDrillDomain();
  mkdirSync(join(root, "runtime-control"), { recursive: true });
  const configuration = createCollectionRunnerRuntimeConfiguration({
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION,
    runtimeId: "runtime:c2-rehearsal",
    runtimeMode: CollectionRunnerRuntimeMode.FixtureOnly,
    runtimeControlRoot: join(root, "runtime-control"),
    sqliteRoot: join(root, "source"),
    storeId: "runner",
    activationId: domain.activation.activationId,
    applicationBuildFingerprint:
      domain.activation.runnerDefinition.buildFingerprint,
    runnerDefinitionFingerprint: domain.activation.runnerDefinition.fingerprint,
    frozenPlanFingerprint: domain.activation.frozenPlanFingerprint,
    fixtureProviderFingerprint: domain.provider.fingerprint,
    maximumClockOffsetMilliseconds: 1_000,
    maximumClockHealthAgeMilliseconds: 300_000,
  });
  const paths = resolveCollectionRunnerRuntimePaths(configuration);
  let runtimeOwnership:
    ReturnType<typeof acquireCollectionRunnerRuntimeOwnership> | null = null;
  const runtimeStopBarrier = new CollectionRunnerProcessStopBarrier();
  const observedAtUtc = phaseObservedAt(ordinal);
  let stopChecks = 0;
  const sampleBase = Date.parse(observedAtUtc);
  let sampleIndex = 0;
  const foreground = new EventContractCollectionRunnerRuntimeForegroundStep({
    clock: {
      sample: () => ({
        observedAtUtc: new Date(sampleBase + sampleIndex).toISOString(),
        monotonicMilliseconds: sampleIndex++,
        healthy: true,
      }),
    },
    planner: new EventContractCollectionRunnerRuntimeAssemblyPlanner(),
    startup: {
      start: () => {
        if (runtimeOwnership === null) {
          throw new Error("C2 runtime ownership must precede foreground work.");
        }
        const ownership = runtimeOwnership;
        const session = {
          sessionAuthorizationId: `authorization-c2-${String(ordinal)}`,
          authorizationFingerprint: FP("c"),
          activationId: ACTIVATION_ID,
          bootIdentity: ownership.ownership.bootIdentity,
          processSessionId: ownership.ownership.processSessionId,
        };
        const gatedRepository =
          new SessionGatedEventContractCollectionRunnerRepository(
            runner,
            {
              persistRecoveryAssessment: () => {
                throw new Error("C2 recovery assessment is outside clean run.");
              },
              persistOwnerRecoveryDecision: () => {
                throw new Error("C2 recovery decision is outside clean run.");
              },
              executeOwnerRecoveryDecision: () => {
                throw new Error("C2 recovery execution is outside clean run.");
              },
              executeEmergencyStop: () => {
                throw new Error("C2 Emergency Stop is outside clean run.");
              },
              validateRecoverySessionGate: (input) => {
                if (
                  input.activationId !== session.activationId ||
                  input.bootIdentity !== session.bootIdentity ||
                  input.processSessionId !== session.processSessionId ||
                  input.sessionAuthorizationId !==
                    session.sessionAuthorizationId ||
                  input.authorizationFingerprint !==
                    session.authorizationFingerprint
                ) {
                  throw new Error("C2 recovery-session gate rejected identity.");
                }
                return Object.freeze({
                  sessionAuthorizationId: session.sessionAuthorizationId,
                  authorizationFingerprint: session.authorizationFingerprint,
                  decisionId: "decision:c2",
                  assessmentId: "assessment:c2",
                  activationId: session.activationId,
                  expectedActivationAggregateVersion: 2,
                  bootIdentity: session.bootIdentity,
                  processSessionId: session.processSessionId,
                  authorizedAtUtc: "2026-07-25T13:00:00.000Z",
                  expiresAtUtc: "2026-07-25T14:00:00.000Z",
                  revokedAtUtc: null,
                  revocationReasonCode: null,
                });
              },
              getRecoveryAssessment: () => null,
              getOwnerRecoveryDecision: () => null,
              getSessionAuthorization: () => null,
              getControlExecutionReceipt: () => null,
            },
            session,
            runtimeStopBarrier,
          );
        const workerWallTimes = [
          "2026-07-25T13:06:00.000Z",
          "2026-07-25T13:06:00.100Z",
          "2026-07-25T13:06:00.500Z",
          "2026-07-25T13:06:00.600Z",
        ];
        let wallIndex = 0;
        const workerMonotonic = [
          0n,
          1_000_000_000n,
          1_100_000_000n,
          1_500_000_000n,
          1_600_000_000n,
        ];
        let monotonicIndex = 0;
        const snapshot = createTransactionDrillSnapshot({
          repository: runner,
          provider: domain.provider,
          mapping: domain.mapping,
          task: domain.task,
        });
        const worker = new EventContractCollectionRunnerFixtureWorker(
          gatedRepository,
          ownership,
          runtimeStopBarrier,
          configuration,
          {
            nowUtc: () =>
              workerWallTimes[wallIndex++] ??
              workerWallTimes[workerWallTimes.length - 1]!,
          },
          {
            nowNanoseconds: () =>
              workerMonotonic[monotonicIndex++] ??
              workerMonotonic[workerMonotonic.length - 1]!,
          },
          {
            observe: () => ({
              observedAtUtc: "2026-07-25T13:05:59.000Z",
              synchronizationStatus:
                CollectionRunnerClockSynchronizationStatus.Synchronized,
              estimatedAbsoluteUtcOffsetMilliseconds: 10,
              source: "C2_TEST_CLOCK",
              policyVersion: "1.0",
              freshnessDeadlineUtc: "2026-07-25T13:10:00.000Z",
            }),
          },
          {
            adapterId: "adapter:c2-fixture",
            adapterVersion: "1.0",
            policyVersion: domain.task.admission.requestPolicyVersion,
            executionMode: EventContractSourceExecutionMode.Fixture,
            providerFingerprint: domain.provider.fingerprint,
            mappingFingerprint: domain.mapping.fingerprint,
            capability: EventContractSourceCapability.TopOfBook,
            sourceRecordId: domain.task.admission.sourceRecordId,
            collect: () => ({
              outcome: CollectionRunnerFixtureAdapterOutcome.Snapshot,
              snapshot,
              finishedAtUtc: "2026-07-25T13:06:00.500Z",
            }),
          },
          { isCancellationRequested: () => false },
        );
        return {
        identity: {
          configurationFingerprint: configuration.fingerprint,
          pathFingerprint: paths.pathFingerprint,
          storeIdentity: sha(paths.storePath),
          lockFingerprint: ownership.ownership.fingerprint,
          bootIdentity: ownership.ownership.bootIdentity,
          processSessionId: ownership.ownership.processSessionId,
          activationId: ACTIVATION_ID,
          buildFingerprint: BUILD,
          runtimeMode: CollectionRunnerRuntimeMode.FixtureOnly,
        },
        createPreflight: (observedAtUtc) => ({
          observedAtUtc,
          configurationFingerprint: configuration.fingerprint,
          pathFingerprint: paths.pathFingerprint,
          storeIdentity: sha(paths.storePath),
          schemaCatalogChecksum: FP("d"),
          recoveryReportFingerprint: FP("e"),
          safety: {
            configurationVerified: true,
            ownershipVerified: true,
            storeReady: true,
            integrityVerified: true,
            clockHealthy: true,
            sessionAuthorized: true,
            stopBarrierTripped: false,
            blockerCodes: [],
          },
          ready: true,
          health: CollectionRunnerRuntimeHealthStatus.Healthy,
          deterministic: true,
          fingerprint: FP("f"),
        }),
        workSnapshots: {
          readWorkSnapshot: ({ observedAtUtc }) => {
            const pilot = runner.getPilotState(ACTIVATION_ID)!;
            const task = runner.getTaskState(TASK_ID)!;
            const budget = runner.getBudgetCounters(ACTIVATION_ID)!;
            const terminal = [
              CollectionRunnerTaskState.Committed,
              CollectionRunnerTaskState.Missed,
              CollectionRunnerTaskState.TerminalFailed,
              CollectionRunnerTaskState.Cancelled,
            ].includes(task.state);
            return createCollectionRunnerRuntimeWorkSnapshot({
              schemaVersion:
                EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION,
              activationId: ACTIVATION_ID,
              pilotState: pilot.state,
              pilotAggregateVersion: pilot.aggregateVersion,
              activationStopsAtUtc: domain.activation.stopsAt,
              sessionAuthorizationId: `authorization-c1-${String(ordinal)}`,
              sessionAuthorizationExpiresAtUtc: domain.activation.stopsAt,
              emergencyStopObserved: false,
              budget: {
                aggregateVersion: budget.aggregateVersion,
                maximumEvents: 1,
                eventsScheduled: budget.eventsScheduled,
                tasksMissed: budget.tasksMissed,
                maximumRequests: 2,
                requestsStarted: budget.requestsStarted,
                maximumRetries: 0,
                retriesStarted: budget.retriesStarted,
              },
              currentLease: null,
              openAttemptId: null,
              tasks: terminal ? [] : [{
                taskId: TASK_ID,
                sourceLane: domain.task.admission.sourceLane,
                state: task.state,
                aggregateVersion: task.aggregateVersion,
                requiredActionAtUtc: domain.task.scheduledAt,
                evidenceCutoffAtUtc: domain.task.admission.evidenceCutoffAt,
                deadlineAtUtc: domain.task.deadlineAt,
                retryEligibleAtUtc: null,
                attemptsStarted: budget.requestsStarted,
                taskFingerprint: domain.task.fingerprint,
              }],
              observedAtUtc,
            });
          },
        },
        t6Executor: {
          execute: (input) => {
            const resultingState =
              input.action ===
                CollectionRunnerRuntimeAssemblyAction.TransitionExactTaskDue
                ? CollectionRunnerTaskState.Due
                : CollectionRunnerTaskState.Missed;
            const next = gatedRepository.transitionTask({
              taskId: input.taskId,
              expectedAggregateVersion: input.expectedTaskVersion,
              nextState: resultingState,
              clock: {
                observedAtUtc: input.observedAtUtc,
                absoluteOffsetMilliseconds: 10,
                healthy: true,
              },
              expectedBudgetVersion: input.expectedBudgetVersion,
              evidence: {
                occurredAtUtc: input.observedAtUtc,
                reasonCode: input.reasonCode,
              },
            });
            return {
              taskId: input.taskId,
              resultingState,
              resultingAggregateVersion: next.aggregateVersion,
              transitionReceiptFingerprint: sha(JSON.stringify(next)),
              deterministic: true,
              fingerprint: FP("b"),
            };
          },
        },
        fixtureExecutor: {
          execute: (decision) => {
            const task = runner.getTaskState(TASK_ID)!;
            const budget = runner.getBudgetCounters(ACTIVATION_ID)!;
            const workerResult = worker.runOneCycle({
              activation: domain.activation,
              task: domain.task,
              expectedTaskVersion: task.aggregateVersion,
              expectedBudgetVersion: budget.aggregateVersion,
              completedAttemptCount: budget.requestsStarted,
              workerId: "worker:c2-fixture",
              leaseDurationMilliseconds: 5_000,
            });
            return {
              workerResult,
              receiptFingerprint: sha(JSON.stringify({
                decisionFingerprint: decision.fingerprint,
                workerResult,
              })),
            };
          },
        },
        completionExecutor: {
          execute: (_reason, observedAtUtc, expectedPilotVersion) => {
            const result = gatedRepository.transitionPilot({
              activationId: ACTIVATION_ID,
              expectedAggregateVersion: expectedPilotVersion,
              nextState: CollectionRunnerPilotState.Completed,
              clock: {
                observedAtUtc,
                absoluteOffsetMilliseconds: 10,
                healthy: true,
              },
              recoveryBlockerCount: 0,
              evidence: {
                occurredAtUtc: observedAtUtc,
                reasonCode: "C2_FIXTURE_COMPLETED",
              },
            });
            return {
              taskId: null,
              receiptFingerprint: sha(JSON.stringify(result)),
            };
          },
        },
        stopExecutor: {
          execute: () => {
            throw new Error("Stop is not part of the clean C1 scenario.");
          },
        },
        terminalState: {
          read: () => ({
            healthStatus: CollectionRunnerRuntimeHealthStatus.Healthy,
            blockerCodes: [],
            stopBarrierTripped: runtimeStopBarrier.isTripped(),
          }),
        },
        resources: { close() {}, releaseOwnership() {} },
      };
      },
    },
  });
  const step = new EventContractCollectionRunnerDurableFixtureRehearsalStepAdapter(
    {
      run: (value) => {
        const report = foreground.run(value);
        if (
          report.healthStatus !==
            CollectionRunnerRuntimeHealthStatus.Healthy ||
          report.recoveryRequired ||
          report.action === null
        ) {
          throw new Error(`C1 foreground report: ${JSON.stringify(report)}`);
        }
        return report;
      },
    },
    {
      resolve: (phaseRequest) => ({
        schemaVersion:
          EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION,
        invocationId: phaseRequest.invocationId,
        activationId: ACTIVATION_ID,
        maximumTasks: 1,
      }),
    },
    {
      read: () => {
        const pilot = runner.getPilotState(ACTIVATION_ID)!;
        const task = runner.getTaskState(TASK_ID)!;
        return {
          resultingPilotState: pilot.state,
          resultingTaskState: task.state,
          outboxChronologyFingerprint: FP("c"),
          recoveryFingerprint: sha(JSON.stringify({ pilot, task })),
        };
      },
    },
  );
  return new EventContractCollectionRunnerDurableFixtureRehearsalCoordinator({
    repositories: {
      resolveExisting: () => durable,
      resolvePrepared: () => durable,
    },
    stop: {
      assertClear: () => {
        stopChecks += 1;
        if (afterClaimFault !== null && stopChecks === 3) {
          if (afterClaimFault === "CRASH") {
            (process as unknown as { exit(code: number): never }).exit(91);
          }
          throw new Error("C2 injected Stop after durable phase claim.");
        }
      },
    },
    ownerAuthorization: { verify: () => true },
    ownership: {
      acquire: () => {
        runtimeOwnership = acquireCollectionRunnerRuntimeOwnership({
          configuration,
          paths,
          bootIdentityPort: {
            readBootIdentity: () => ({
              bootIdentity: `boot:c2:${String(ordinal)}`,
              source: "C2_TEST_BOOT",
              sourceVersion: "1.0",
            }),
          },
          processNoncePort: {
            createNonce: () => sha(
              `${variant}:${String(ordinal)}:${paths.pathFingerprint}`,
            ),
          },
          processId: 20_000 + ordinal,
          wallClock: { nowUtc: () => observedAtUtc },
        });
        return {
          context: {
            processSessionId: runtimeOwnership.ownership.processSessionId,
            bootIdentity: runtimeOwnership.ownership.bootIdentity,
            observedAtUtc,
          },
          releaseClean: () => runtimeOwnership?.releaseCleanly(),
          preserveAmbiguity() {},
        };
      },
    },
    preparation: {
      prepare: () => ({
        registry: registryInput(variant),
        preparingReasonCode: "PREPARATION_STARTED",
        preparedReasonCode: "PREPARATION_COMMITTED",
      }),
    },
    step,
    reconciliation: {
      reconcile: () => {
        throw new Error("Clean C1 sequence requires no recovery.");
      },
    },
    scenarioPolicy: {
      expectedAction: (phaseRequest) => [
        CollectionRunnerRuntimeAssemblyAction.TransitionExactTaskDue,
        CollectionRunnerRuntimeAssemblyAction.ExecuteExactFixtureTask,
        CollectionRunnerRuntimeAssemblyAction.CompleteAndExit,
      ][phaseRequest.expectedInvocationOrdinal! - 1]!,
      isFinalOrdinal: (phaseRequest) =>
        phaseRequest.expectedInvocationOrdinal === 3,
    },
  });
}

export function prepareC1Phase(root: string, variant: "a" | "b"): C1PhaseState {
  assertC2StopClear(root);
  const sourceRoot = join(root, "source");
  const evidenceRoot = join(root, "evidence");
  const validationRoot = join(root, "validation-authority");
  mkdirSync(sourceRoot, { recursive: true });
  mkdirSync(evidenceRoot, { recursive: true });
  mkdirSync(validationRoot, { recursive: true });
  const readiness = createNewCollectionRunnerFixtureRehearsalSqliteProfile({
    rootDirectory: sourceRoot,
    storeId: "runner",
    applicationBuildFingerprint: BUILD,
    appliedAtUtc: AT,
  });
  const validation = createValidationRepository(validationRoot);
  const database = openDatabase(readiness.storePath);
  try {
    seedInitialRunner(database);
    coordinator(database, root, variant, 0).execute(
      request(DurableFixtureRehearsalPhase.Prepare),
    );
  } finally {
    database.close();
  }
  const state: C1PhaseState = {
    root,
    variant,
    sourceRoot,
    sourceStorePath: readiness.storePath,
    schemaCatalogChecksum: readiness.schemaCatalogChecksum,
    evidenceRoot,
    validationRoot,
    validationReceiptPath: join(root, "validation-receipt.json"),
    repositoryCommit: validation.commit,
    validationSuiteFingerprint: validation.suite,
    registeredTestTotal: 1,
    envelopeFingerprint: null,
    scenarioResultFingerprint: null,
    executionPackageFingerprint: null,
  };
  save(state);
  return state;
}

export function stepC1Phase(root: string): DurableFixtureRehearsalRegistry {
  assertC2StopClear(root);
  const state = readC1PhaseState(root);
  const database = openDatabase(state.sourceStorePath);
  try {
    const repository =
      createSqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository(
        database,
      );
    const current = repository.readSnapshot("rehearsal-1")!.registry;
    const ordinal = current.nextInvocationOrdinal;
    coordinator(database, root, state.variant, ordinal).execute(
      request(DurableFixtureRehearsalPhase.Step, current, ordinal),
    );
    return repository.readSnapshot("rehearsal-1")!.registry;
  } finally {
    database.close();
  }
}

export function replayC2Step(
  root: string,
  ordinal: number,
  changed: boolean,
) {
  assertC2StopClear(root);
  const state = readC1PhaseState(root);
  const database = openDatabase(state.sourceStorePath);
  try {
    const repository =
      createSqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository(
        database,
      );
    const snapshot = repository.readSnapshot("rehearsal-1")!;
    const claim = snapshot.claims.find(
      (item) =>
        item.phase === DurableFixtureRehearsalPhase.Step &&
        item.invocationOrdinal === ordinal,
    );
    if (claim === undefined) {
      throw new Error("C2 replay requires the exact prior STEP claim.");
    }
    const replayRequest = request(
      DurableFixtureRehearsalPhase.Step,
      {
        lifecycleVersion: claim.expectedLifecycleVersion,
        recoveryFingerprint: claim.expectedRecoveryFingerprint,
      } as DurableFixtureRehearsalRegistry,
      ordinal,
    );
    return coordinator(database, root, state.variant, ordinal + 20).execute({
      ...replayRequest,
      invocationId: changed
        ? `${replayRequest.invocationId}-changed`
        : replayRequest.invocationId,
    });
  } finally {
    database.close();
  }
}

export function stopAfterClaimC2Phase(root: string): never {
  assertC2StopClear(root);
  const state = readC1PhaseState(root);
  const database = openDatabase(state.sourceStorePath);
  try {
    const repository =
      createSqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository(
        database,
      );
    const current = repository.readSnapshot("rehearsal-1")!.registry;
    const ordinal = current.nextInvocationOrdinal;
    coordinator(database, root, state.variant, ordinal, "STOP").execute(
      request(DurableFixtureRehearsalPhase.Step, current, ordinal),
    );
    throw new Error("C2 Stop-after-claim drill unexpectedly completed.");
  } finally {
    database.close();
  }
}

export function crashAfterClaimC2Phase(root: string): never {
  assertC2StopClear(root);
  const state = readC1PhaseState(root);
  const database = openDatabase(state.sourceStorePath);
  const repository =
    createSqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository(
      database,
    );
  const current = repository.readSnapshot("rehearsal-1")!.registry;
  const ordinal = current.nextInvocationOrdinal;
  coordinator(database, root, state.variant, ordinal, "CRASH").execute(
    request(DurableFixtureRehearsalPhase.Step, current, ordinal),
  );
  throw new Error("C2 crash-after-claim drill unexpectedly completed.");
}

export interface C2DurableInspection {
  readonly lifecycleState: DurableFixtureRehearsalLifecycleState;
  readonly claimCount: number;
  readonly invocationReceiptCount: number;
  readonly unresolvedClaimCount: number;
  readonly taskTransitions: readonly string[];
  readonly attemptCount: number;
  readonly attemptResultCount: number;
  readonly evidenceCount: number;
  readonly liveLeaseCount: number;
}

export function inspectC2Durable(root: string): C2DurableInspection {
  const state = readC1PhaseState(root);
  const database = openDatabase(state.sourceStorePath, true);
  try {
    const snapshot =
      createSqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository(
        database,
      ).readSnapshot("rehearsal-1")!;
    const receipts = new Set(
      snapshot.invocationReceipts.map(({ claimId }) => claimId),
    );
    const failures = new Set(
      snapshot.failureReceipts.map(({ claimId }) => claimId),
    );
    const taskTransitions = database.prepare(`
SELECT to_state
FROM task_transitions
WHERE task_id = ?
ORDER BY transition_sequence
`).all(TASK_ID).map((row) => String(row.to_state));
    const scalar = (table: string): number =>
      Number(Object.values(database.prepare(
        `SELECT COUNT(*) FROM ${table}`,
      ).get() ?? {})[0]);
    return {
      lifecycleState: snapshot.registry.lifecycleState,
      claimCount: snapshot.claims.length,
      invocationReceiptCount: snapshot.invocationReceipts.length,
      unresolvedClaimCount: snapshot.claims.filter(
        ({ claimId }) => !receipts.has(claimId) && !failures.has(claimId),
      ).length,
      taskTransitions,
      attemptCount: scalar("attempt_records"),
      attemptResultCount: scalar("attempt_results"),
      evidenceCount: scalar("normalized_source_evidence"),
      liveLeaseCount: scalar("task_leases"),
    };
  } finally {
    database.close();
  }
}

export function validateC1Phase(root: string): DurableFixtureRehearsalValidationReceipt {
  assertC2StopClear(root);
  const state = readC1PhaseState(root);
  const receipt = new FixedLocalDurableFixtureRehearsalValidationAdapter(
    state.validationRoot,
    state.repositoryCommit,
    state.registeredTestTotal,
    state.validationSuiteFingerprint,
  ).run({
    receiptId: "validation-c1",
    rehearsalId: "rehearsal-1",
    manifestFingerprint: MANIFEST,
    startedAtUtc: AT,
    endedAtUtc: AT,
  });
  writeFileSync(
    state.validationReceiptPath,
    `${JSON.stringify(receipt)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
  return receipt;
}

function withoutDerived(
  registry: DurableFixtureRehearsalRegistry,
): DurableFixtureRehearsalRegistryInput {
  const {
    schemaProfile: _schemaProfile,
    deterministic: _deterministic,
    fingerprint: _fingerprint,
    ...input
  } = registry;
  return input;
}

export function freezeC1Phase(root: string): DurableFixtureRehearsalRegistry {
  assertC2StopClear(root);
  const state = readC1PhaseState(root);
  const receiptValue = JSON.parse(
    readFileSync(state.validationReceiptPath, "utf8"),
  ) as DurableFixtureRehearsalValidationReceipt;
  const {
    deterministic: _deterministic,
    fingerprint: _fingerprint,
    passed: _passed,
    ...receiptInput
  } = receiptValue;
  const receipt = createDurableFixtureRehearsalValidationReceipt(receiptInput);
  if (!receipt.passed || receipt.fingerprint !== receiptValue.fingerprint) {
    throw new Error("C1 validation receipt is not authoritative.");
  }
  const database = openDatabase(state.sourceStorePath);
  try {
    const repository =
      createSqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository(
        database,
      );
    const completedSnapshot = repository.readSnapshot("rehearsal-1")!;
    const current = completedSnapshot.registry;
    if (current.lifecycleState !== DurableFixtureRehearsalLifecycleState.Completed) {
      throw new Error("C1 cannot freeze before the real STEP sequence completes.");
    }
    const freezeClaim = createDurableFixtureRehearsalOperationClaim({
      claimId: "claim-freeze-c1",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: MANIFEST,
      phase: DurableFixtureRehearsalPhase.Freeze,
      invocationOrdinal: null,
      expectedLifecycleVersion: current.lifecycleVersion,
      expectedRecoveryFingerprint: current.recoveryFingerprint,
      requestFingerprint: FP("e"),
      processSessionId: "session-c1-freeze",
      bootIdentity: "boot-c1-freeze",
      ownerAuthorizationId: null,
      claimedAtUtc: AT,
    });
    const validated = createDurableFixtureRehearsalTransition({
      transitionId: "transition-c1-validated",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: MANIFEST,
      ordinal: 4,
      fromState: DurableFixtureRehearsalLifecycleState.Completed,
      fromVersion: current.lifecycleVersion,
      toState: DurableFixtureRehearsalLifecycleState.Validated,
      reasonCode: "VALIDATION_COMMITTED",
      occurredAtUtc: AT,
    });
    const frozen = createDurableFixtureRehearsalTransition({
      transitionId: "transition-c1-frozen",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: MANIFEST,
      ordinal: 4,
      fromState: DurableFixtureRehearsalLifecycleState.Validated,
      fromVersion: validated.toVersion,
      toState: DurableFixtureRehearsalLifecycleState.EvidenceFrozen,
      reasonCode: "EVIDENCE_FROZEN",
      occurredAtUtc: AT,
    });
    const pilot = database.prepare(`
SELECT current_state, aggregate_version
FROM pilot_activations
WHERE activation_id = ?
`).get(ACTIVATION_ID);
    const task = database.prepare(`
SELECT current_state, aggregate_version
FROM scheduled_tasks
WHERE task_id = ?
`).get(TASK_ID);
    const budget = database.prepare(`
SELECT events_scheduled, requests_started, bytes_received, records_received,
       retries_started, evidence_committed, tasks_missed
FROM activation_budget_counters
WHERE activation_id = ?
`).get(ACTIVATION_ID);
    const scenario = sha(JSON.stringify({
      actions: completedSnapshot.invocationReceipts.map((item) => ({
        ordinal: item.invocationOrdinal,
        action: item.selectedAction,
        pilotState: item.resultingPilotState,
        taskState: item.resultingTaskState,
        outcome: item.outcome,
        outboxChronologyFingerprint: item.outboxChronologyFingerprint,
      })),
      pilot,
      task,
      budget,
    }));
    const execution = sha(JSON.stringify({
      scenario,
      workspaceIdentity: current.workspaceIdentity,
      storeIdentity: current.storeIdentity,
      claimFingerprints: completedSnapshot.claims.map(
        ({ fingerprint }) => fingerprint,
      ),
    }));
    const plan = createDurableFixtureRehearsalEvidencePlan({
      evidencePlanId: "evidence-plan-c1",
      freezeClaimId: freezeClaim.claimId,
      rehearsalId: "rehearsal-1",
      manifestFingerprint: MANIFEST,
      validationReceiptFingerprint: receipt.fingerprint,
      validationSuiteFingerprint: receipt.validationSuiteFingerprint,
      plannedBackupId: "backup-c1",
      plannedPackageId: "package-c1",
      plannedEnvelopeId: "envelope-c1",
      retentionPolicyVersion: "1.0",
      terminalFreezeFingerprint: frozen.fingerprint,
      nonAuthorityDeclaration: DURABLE_FIXTURE_REHEARSAL_EVIDENCE_NON_AUTHORITY,
      frozenAtUtc: AT,
    });
    const next = createDurableFixtureRehearsalRegistry({
      ...withoutDerived(current),
      lifecycleState: DurableFixtureRehearsalLifecycleState.EvidenceFrozen,
      lifecycleVersion: frozen.toVersion,
      scenarioResultFingerprint: scenario,
      executionPackageFingerprint: execution,
    });
    const snapshot = repository.freezeEvidence(
      current.lifecycleVersion,
      freezeClaim,
      plan,
      [validated, frozen],
      next,
    );
    save({
      ...state,
      scenarioResultFingerprint: scenario,
      executionPackageFingerprint: execution,
    });
    return snapshot.registry;
  } finally {
    database.close();
  }
}

export async function packageC1Phase(root: string): Promise<string> {
  assertC2StopClear(root);
  const state = readC1PhaseState(root);
  const database = openDatabase(state.sourceStorePath, true);
  try {
    const repository =
      createSqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository(
        database,
      );
    const snapshot = repository.readSnapshot("rehearsal-1")!;
    const receipt = JSON.parse(
      readFileSync(state.validationReceiptPath, "utf8"),
    ) as DurableFixtureRehearsalValidationReceipt;
    const manifest = await new DurableFixtureRehearsalEnvelopeBuilder(
      state.validationRoot,
      [{ evidenceRootId: "evidence-root-c1", path: state.evidenceRoot }],
      [{
        storeId: "store-c1",
        path: state.sourceStorePath,
        schemaCatalogChecksum: state.schemaCatalogChecksum,
      }],
    ).build({
      evidenceRootId: "evidence-root-c1",
      storeId: "store-c1",
      envelopeId: "envelope-c1",
      publishedAtUtc: AT,
      frozenEvidence: {
        evidencePlan: snapshot.evidencePlan!,
        validationReceipt: receipt,
        snapshot,
      },
    });
    save({ ...state, envelopeFingerprint: manifest.fingerprint });
    return manifest.fingerprint;
  } finally {
    database.close();
  }
}

export function verifyC1Phase(root: string) {
  const state = readC1PhaseState(root);
  if (state.envelopeFingerprint === null) {
    throw new Error("C1 envelope has not been packaged.");
  }
  return new DurableFixtureRehearsalFreshProcessVerifier(
    [{ evidenceRootId: "evidence-root-c1", path: state.evidenceRoot }],
    [{
      manifestFingerprint: MANIFEST,
      repositoryCommit: state.repositoryCommit,
      validationPolicyVersion: DURABLE_FIXTURE_REHEARSAL_VALIDATION_POLICY,
      validationSuiteFingerprint: state.validationSuiteFingerprint,
      registeredTestTotal: state.registeredTestTotal,
    }],
  ).verify("evidence-root-c1", state.envelopeFingerprint, MANIFEST);
}
