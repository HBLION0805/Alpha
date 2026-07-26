import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  CollectionRunnerPilotState,
  CollectionRunnerFixtureWorkerOutcome,
  CollectionRunnerRuntimeAssemblyAction,
  CollectionRunnerRuntimeHealthStatus,
  CollectionRunnerRuntimeMode,
  CollectionRunnerSourceLane,
  CollectionRunnerTaskState,
  DURABLE_FIXTURE_REHEARSAL_EVIDENCE_NON_AUTHORITY,
  DURABLE_FIXTURE_REHEARSAL_VALIDATION_POLICY,
  DurableFixtureRehearsalLifecycleState,
  DurableFixtureRehearsalPhase,
  EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_COORDINATOR_SCHEMA_VERSION,
  EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_SCHEMA_VERSION,
  EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION,
  type DurableFixtureRehearsalPhaseRequest,
  type DurableFixtureRehearsalProcessContext,
  type DurableFixtureRehearsalRegistry,
  type DurableFixtureRehearsalRegistryInput,
  type DurableFixtureRehearsalValidationReceipt,
} from "../../src/contracts";
import {
  createCollectionRunnerRuntimeWorkSnapshot,
  EventContractCollectionRunnerRuntimeAssemblyPlanner,
  EventContractCollectionRunnerRuntimeForegroundStep,
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
} from "../../src/repositories";
import {
  createSqliteEventContractCollectionRunnerRepository,
} from "../../src/repositories/SqliteEventContractCollectionRunnerRepository";

const AT = "2026-07-25T20:00:00.000Z";
const FP = (value: string): string =>
  `fnv1a64:${value.repeat(16).slice(0, 16)}`;
const BUILD = FP("2");
const MANIFEST = FP("1");

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
  database.prepare(`
INSERT INTO runner_definitions (
 runner_definition_id, version, fingerprint, build_fingerprint,
 canonical_record_json, created_at_utc
) VALUES (?, ?, ?, ?, '{}', ?)
`).run("runner-1", "1.0", FP("3"), BUILD, AT);
  database.prepare(`
INSERT INTO pilot_activations (
 activation_id, activation_fingerprint, owner_id, approved_at_utc,
 starts_at_utc, stops_at_utc, frozen_plan_id, frozen_plan_fingerprint,
 runner_definition_id, runner_definition_version, maximum_events,
 maximum_requests, current_state, aggregate_version,
 canonical_record_json, created_at_utc
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 'ACTIVE', 1, '{}', ?)
`).run(
    "activation-1", FP("e"), "owner-1",
    "2026-07-25T19:00:00.000Z", "2026-07-25T19:30:00.000Z",
    "2026-07-25T21:00:00.000Z", "plan-1", FP("4"),
    "runner-1", "1.0", AT,
  );
  database.prepare(
    "INSERT INTO pilot_activation_providers (activation_id, provider_fingerprint) VALUES (?, ?)",
  ).run("activation-1", FP("6"));
  database.prepare(
    "INSERT INTO pilot_activation_mappings (activation_id, mapping_fingerprint) VALUES (?, ?)",
  ).run("activation-1", FP("7"));
  database.prepare(`
INSERT INTO scheduled_tasks (
 task_id, task_fingerprint, idempotency_key, activation_id, frozen_plan_id,
 frozen_plan_fingerprint, planned_event_id, observation_slot, source_lane,
 provider_id, provider_fingerprint, mapping_id, mapping_version,
 mapping_fingerprint, capability, execution_mode, source_record_id,
 request_policy_id, request_policy_version, scheduled_at_utc,
 evidence_cutoff_at_utc, deadline_at_utc, activation_expires_at_utc,
 maximum_attempts, maximum_raw_payload_bytes, maximum_record_count,
 request_deadline_milliseconds, current_state, aggregate_version,
 canonical_record_json, created_at_utc
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'EXCHANGE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1000, 10, 1000, 'SCHEDULED', 1, '{}', ?)
`).run(
    "task-1", FP("1"), FP("2"), "activation-1", "plan-1", FP("4"),
    "event-1", "slot-1", "fixture-provider", FP("6"), "mapping-1",
    "1.0", FP("7"), "EVENT_CONTRACT", "FIXTURE", "source-1",
    "request-policy-1", "1.0", AT, AT, AT,
    "2026-07-25T21:00:00.000Z", AT,
  );
  database.prepare(`
INSERT INTO activation_budget_counters (
 activation_id, aggregate_version, events_scheduled, requests_started,
 bytes_received, records_received, retries_started, evidence_committed,
 tasks_missed, updated_at_utc
) VALUES (?, 1, 1, 0, 0, 0, 0, 0, 0, ?)
`).run("activation-1", AT);
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
    activationId: "activation-1",
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

function context(ordinal: number): DurableFixtureRehearsalProcessContext {
  return {
    processSessionId: `session-c1-${String(ordinal)}`,
    bootIdentity: `boot-c1-${String(ordinal)}`,
    observedAtUtc: new Date(Date.parse(AT) + ordinal * 100).toISOString(),
  };
}

function coordinator(
  database: DatabaseSync,
  variant: "a" | "b",
  ordinal: number,
): EventContractCollectionRunnerDurableFixtureRehearsalCoordinator {
  const durable =
    createSqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository(
      database,
    );
  const runner = createSqliteEventContractCollectionRunnerRepository(database);
  const processContext = context(ordinal);
  const sampleBase = Date.parse(processContext.observedAtUtc);
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
      start: () => ({
        identity: {
          configurationFingerprint: FP("a"),
          pathFingerprint: FP("b"),
          storeIdentity: FP("c"),
          lockFingerprint: FP("d"),
          bootIdentity: processContext.bootIdentity,
          processSessionId: processContext.processSessionId,
          activationId: "activation-1",
          buildFingerprint: BUILD,
          runtimeMode: CollectionRunnerRuntimeMode.FixtureOnly,
        },
        createPreflight: (observedAtUtc) => ({
          observedAtUtc,
          configurationFingerprint: FP("a"),
          pathFingerprint: FP("b"),
          storeIdentity: FP("c"),
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
            const pilot = runner.getPilotState("activation-1")!;
            const task = runner.getTaskState("task-1")!;
            const budget = runner.getBudgetCounters("activation-1")!;
            const terminal = [
              CollectionRunnerTaskState.Committed,
              CollectionRunnerTaskState.Missed,
              CollectionRunnerTaskState.TerminalFailed,
              CollectionRunnerTaskState.Cancelled,
            ].includes(task.state);
            return createCollectionRunnerRuntimeWorkSnapshot({
              schemaVersion:
                EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION,
              activationId: "activation-1",
              pilotState: pilot.state,
              pilotAggregateVersion: pilot.aggregateVersion,
              activationStopsAtUtc: "2026-07-25T21:00:00.000Z",
              sessionAuthorizationId: `authorization-c1-${String(ordinal)}`,
              sessionAuthorizationExpiresAtUtc: "2026-07-25T21:00:00.000Z",
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
                taskId: "task-1",
                sourceLane: CollectionRunnerSourceLane.Exchange,
                state: task.state,
                aggregateVersion: task.aggregateVersion,
                requiredActionAtUtc: AT,
                evidenceCutoffAtUtc: "2026-07-25T20:10:00.000Z",
                deadlineAtUtc: "2026-07-25T20:20:00.000Z",
                retryEligibleAtUtc: null,
                attemptsStarted: budget.requestsStarted,
                taskFingerprint: FP("1"),
              }],
              observedAtUtc,
            });
          },
        },
        t6Executor: {
          execute: (input) => {
            database.prepare(
              "UPDATE scheduled_tasks SET current_state = 'DUE', aggregate_version = aggregate_version + 1 WHERE task_id = ? AND current_state = 'SCHEDULED' AND aggregate_version = ?",
            ).run(input.taskId, input.expectedTaskVersion);
            return {
              taskId: input.taskId,
              resultingState: CollectionRunnerTaskState.Due,
              resultingAggregateVersion: input.expectedTaskVersion + 1,
              transitionReceiptFingerprint: FP("a"),
              deterministic: true,
              fingerprint: FP("b"),
            };
          },
        },
        fixtureExecutor: {
          execute: (decision) => {
            database.exec("BEGIN IMMEDIATE");
            try {
              database.prepare(
                "UPDATE scheduled_tasks SET current_state = 'COMMITTED', aggregate_version = aggregate_version + 1 WHERE task_id = 'task-1' AND current_state = 'DUE'",
              ).run();
              database.prepare(`
INSERT INTO attempt_records (
 attempt_id, task_id, attempt_number, lease_token, scheduled_at_utc,
 started_at_utc, request_count, adapter_version, policy_version,
 attempt_fingerprint, created_at_utc
) VALUES (?, ?, 1, ?, ?, ?, 1, ?, ?, ?, ?)
`).run("attempt-1", "task-1", "lease-c1", AT, AT, "fixture-1", "1.0", FP("3"), AT);
              database.prepare(`
INSERT INTO attempt_results (
 attempt_id, finished_at_utc, received_at_utc, normalized_at_utc,
 outcome_code, retry_disposition, raw_payload_bytes, record_count,
 response_fingerprint, normalized_snapshot_fingerprint,
 result_fingerprint, created_at_utc
) VALUES (?, ?, ?, ?, ?, ?, 10, 1, ?, ?, ?, ?)
`).run("attempt-1", AT, AT, AT, "COMMITTED", "NONE", FP("4"), FP("5"), FP("6"), AT);
              database.prepare(`
INSERT INTO normalized_source_evidence (
 evidence_id, task_id, task_idempotency_key, attempt_id,
 provider_fingerprint, mapping_fingerprint, source_snapshot_fingerprint,
 payload_fingerprint, capability, source_lane, observed_at_utc,
 received_at_utc, normalized_at_utc, raw_payload_bytes, record_count,
 canonical_snapshot_json, committed_at_utc
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'EXCHANGE', ?, ?, ?, 10, 1, '{}', ?)
`).run(
                "evidence-1", "task-1", FP("2"), "attempt-1", FP("6"),
                FP("7"), FP("8"), FP("9"), "EVENT_CONTRACT", AT, AT, AT, AT,
              );
              database.prepare(`
UPDATE activation_budget_counters
SET aggregate_version = aggregate_version + 1, requests_started = 1,
    bytes_received = 10, records_received = 1, evidence_committed = 1,
    updated_at_utc = ?
WHERE activation_id = 'activation-1'
`).run(AT);
              database.prepare(`
INSERT INTO transactional_outbox (
 outbox_id, aggregate_type, aggregate_id, aggregate_version, event_type,
 event_fingerprint, sanitized_event_json, created_at_utc
) VALUES (?, 'TASK', ?, 3, 'EVIDENCE_COMMITTED', ?, '{}', ?)
`).run("outbox-1", "task-1", FP("a"), AT);
              database.exec("COMMIT");
            } catch (error) {
              database.exec("ROLLBACK");
              throw error;
            }
            return {
              workerResult: {
                outcome:
                  CollectionRunnerFixtureWorkerOutcome.EvidenceCommitted,
                taskId: decision.taskId!,
                attemptId: "attempt-1",
                evidenceId: "evidence-1",
                reasonCode: "FIXTURE_EVIDENCE_COMMITTED",
                deterministic: true,
              },
              receiptFingerprint: FP("b"),
            };
          },
        },
        completionExecutor: {
          execute: (_reason, observedAtUtc, expectedPilotVersion) => {
            const result = database.prepare(`
UPDATE pilot_activations
SET current_state = 'COMPLETED',
    aggregate_version = aggregate_version + 1
WHERE activation_id = 'activation-1'
  AND current_state = 'ACTIVE'
  AND aggregate_version = ?
`).run(expectedPilotVersion);
            if (result.changes !== 1) {
              throw new Error("C1 Pilot completion compare-and-swap failed.");
            }
            return {
              taskId: null,
              receiptFingerprint: sha(JSON.stringify({
                activationId: "activation-1",
                expectedPilotVersion,
                observedAtUtc,
              })),
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
            stopBarrierTripped: false,
          }),
        },
        resources: { close() {}, releaseOwnership() {} },
      }),
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
        activationId: "activation-1",
        maximumTasks: 1,
      }),
    },
    {
      read: () => {
        const pilot = runner.getPilotState("activation-1")!;
        const task = runner.getTaskState("task-1")!;
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
    stop: { assertClear() {} },
    ownerAuthorization: { verify: () => true },
    ownership: {
      acquire: () => ({
        context: processContext,
        releaseClean() {},
        preserveAmbiguity() {},
      }),
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
    coordinator(database, variant, 0).execute(
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
  const state = readC1PhaseState(root);
  const database = openDatabase(state.sourceStorePath);
  try {
    const repository =
      createSqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository(
        database,
      );
    const current = repository.readSnapshot("rehearsal-1")!.registry;
    const ordinal = current.nextInvocationOrdinal;
    coordinator(database, state.variant, ordinal).execute(
      request(DurableFixtureRehearsalPhase.Step, current, ordinal),
    );
    return repository.readSnapshot("rehearsal-1")!.registry;
  } finally {
    database.close();
  }
}

export function validateC1Phase(root: string): DurableFixtureRehearsalValidationReceipt {
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
WHERE activation_id = 'activation-1'
`).get();
    const task = database.prepare(`
SELECT current_state, aggregate_version
FROM scheduled_tasks
WHERE task_id = 'task-1'
`).get();
    const budget = database.prepare(`
SELECT events_scheduled, requests_started, bytes_received, records_received,
       retries_started, evidence_committed, tasks_missed
FROM activation_budget_counters
WHERE activation_id = 'activation-1'
`).get();
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
