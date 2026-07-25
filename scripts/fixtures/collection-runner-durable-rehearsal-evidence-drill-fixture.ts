import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  CollectionRunnerPilotState,
  CollectionRunnerTaskState,
  DURABLE_FIXTURE_REHEARSAL_EVIDENCE_NON_AUTHORITY,
  DURABLE_FIXTURE_REHEARSAL_VALIDATION_POLICY,
  DurableFixtureRehearsalLifecycleState,
  DurableFixtureRehearsalPhase,
} from "../../src/contracts";
import {
  CollectionRunnerRuntimeAssemblyAction,
  CollectionRunnerRuntimeStepOutcome,
} from "../../src/contracts/EventContractCollectionRunnerRuntimeAssembly";
import {
  createDurableFixtureRehearsalEvidencePlan,
  createDurableFixtureRehearsalInvocationReceipt,
  createDurableFixtureRehearsalOperationClaim,
  createDurableFixtureRehearsalRegistry,
  createDurableFixtureRehearsalTransition,
} from "../../src/engines/event-contract-collection-runner-durable-fixture-rehearsal";
import {
  createDurableFixtureRehearsalValidationReceipt,
  DurableFixtureRehearsalEnvelopeBuilder,
  type DurableFixtureRehearsalEnvelopeBuildObserver,
} from "../../src/engines/event-contract-collection-runner-durable-fixture-rehearsal/EventContractCollectionRunnerDurableFixtureRehearsalEvidence";
import {
  createNewCollectionRunnerFixtureRehearsalSqliteProfile,
  createSqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository,
} from "../../src/repositories";

const AT = "2026-07-25T20:00:00.000Z";
const FP = (value: string): string =>
  `fnv1a64:${value.repeat(16).slice(0, 16)}`;

export interface DurableEvidenceDrillFixture {
  readonly evidenceRoot: string;
  readonly sourceRoot: string;
  readonly sourceStorePath: string;
  readonly envelopeId: string;
  readonly manifestFingerprint: string;
  readonly scenarioResultFingerprint: string;
  readonly executionPackageFingerprint: string;
  readonly envelopeFingerprint: string;
}

function registryInput(
  variant: string,
  lifecycleState: DurableFixtureRehearsalLifecycleState,
  lifecycleVersion: number,
  nextInvocationOrdinal: number,
  scenarioResultFingerprint: string | null,
  executionPackageFingerprint: string | null,
) {
  return {
    schemaVersion: "1.0" as const,
    rehearsalId: "rehearsal-1",
    manifestFingerprint: FP("1"),
    buildFingerprint: FP("2"),
    runnerFingerprint: FP("3"),
    frozenPlanFingerprint: FP("4"),
    catalogFingerprint: FP("5"),
    providerFingerprint: FP("6"),
    mappingFingerprint: FP("7"),
    activationId: "activation-1",
    taskSetFingerprint: FP("8"),
    workspaceIdentity: FP(variant === "a" ? "9" : "a"),
    storeIdentity: FP(variant === "a" ? "b" : "c"),
    lifecycleState,
    lifecycleVersion,
    nextInvocationOrdinal,
    recoveryFingerprint: FP("d"),
    maximumInvocations: 1,
    scenarioResultFingerprint,
    executionPackageFingerprint,
    nonAuthorityDeclaration: DURABLE_FIXTURE_REHEARSAL_EVIDENCE_NON_AUTHORITY,
    createdAtUtc: AT,
  };
}

function seedActivation(database: DatabaseSync): void {
  database.prepare(`
INSERT INTO runner_definitions (
 runner_definition_id, version, fingerprint, build_fingerprint,
 canonical_record_json, created_at_utc
) VALUES (?, ?, ?, ?, '{}', ?)
`).run("runner-1", "1.0", FP("3"), FP("2"), AT);
  database.prepare(`
INSERT INTO pilot_activations (
 activation_id, activation_fingerprint, owner_id, approved_at_utc,
 starts_at_utc, stops_at_utc, frozen_plan_id, frozen_plan_fingerprint,
 runner_definition_id, runner_definition_version, maximum_events,
 maximum_requests, current_state, aggregate_version,
 canonical_record_json, created_at_utc
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 'COMPLETED', 1, '{}', ?)
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
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'EXCHANGE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1000, 10, 1000, 'COMMITTED', 1, '{}', ?)
`).run(
    "task-1", FP("1"), FP("2"), "activation-1", "plan-1", FP("4"),
    "event-1", "slot-1", "fixture-provider", FP("6"), "mapping-1",
    "1.0", FP("7"), "EVENT_CONTRACT", "FIXTURE", "source-1",
    "request-policy-1", "1.0", AT, AT, AT,
    "2026-07-25T21:00:00.000Z", AT,
  );
  database.prepare(`
INSERT INTO attempt_records (
 attempt_id, task_id, attempt_number, lease_token, scheduled_at_utc,
 started_at_utc, request_count, adapter_version, policy_version,
 attempt_fingerprint, created_at_utc
) VALUES (?, ?, 1, ?, ?, ?, 1, ?, ?, ?, ?)
`).run("attempt-1", "task-1", "lease-completed", AT, AT, "fixture-1", "1.0", FP("3"), AT);
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
    "evidence-1", "task-1", FP("2"), "attempt-1", FP("6"), FP("7"),
    FP("8"), FP("9"), "EVENT_CONTRACT", AT, AT, AT, AT,
  );
  database.prepare(`
INSERT INTO activation_budget_counters (
 activation_id, aggregate_version, events_scheduled, requests_started,
 bytes_received, records_received, retries_started, evidence_committed,
 tasks_missed, updated_at_utc
) VALUES (?, 1, 1, 1, 10, 1, 0, 1, 0, ?)
`).run("activation-1", AT);
  database.prepare(`
INSERT INTO transactional_outbox (
 outbox_id, aggregate_type, aggregate_id, aggregate_version, event_type,
 event_fingerprint, sanitized_event_json, created_at_utc
) VALUES (?, 'TASK', ?, 1, 'EVIDENCE_COMMITTED', ?, '{}', ?)
`).run("outbox-1", "task-1", FP("a"), AT);
}

export async function createDurableEvidenceDrillFixture(
  repositoryRoot: string,
  root: string,
  variant: "a" | "b",
  observer?: DurableFixtureRehearsalEnvelopeBuildObserver,
): Promise<DurableEvidenceDrillFixture> {
  const sourceRoot = join(root, "source");
  const evidenceRoot = join(root, "evidence");
  if (existsSync(sourceRoot)) {
    rmSync(sourceRoot, { recursive: true, force: true });
  }
  mkdirSync(sourceRoot, { recursive: true });
  if (!existsSync(evidenceRoot)) mkdirSync(evidenceRoot);
  const readiness = createNewCollectionRunnerFixtureRehearsalSqliteProfile({
    rootDirectory: sourceRoot,
    storeId: "runner",
    applicationBuildFingerprint: "fnv1a64:2222222222222222",
    appliedAtUtc: AT,
  });
  const database = new DatabaseSync(readiness.storePath, {
    open: true, readOnly: false, defensive: true,
    enableForeignKeyConstraints: true,
  });
  const scenario = FP("f");
  const execution = FP(variant === "a" ? "0" : "a");
  let frozenEvidence;
  try {
    database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;");
    seedActivation(database);
    const repository =
      createSqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository(
        database,
      );
    const preparing = createDurableFixtureRehearsalTransition({
      transitionId: "transition-preparing",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: FP("1"),
      ordinal: 0,
      fromState: DurableFixtureRehearsalLifecycleState.Planned,
      fromVersion: 1,
      toState: DurableFixtureRehearsalLifecycleState.Preparing,
      reasonCode: "PREPARATION_STARTED",
      occurredAtUtc: AT,
    });
    const prepared = createDurableFixtureRehearsalTransition({
      transitionId: "transition-prepared",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: FP("1"),
      ordinal: 0,
      fromState: DurableFixtureRehearsalLifecycleState.Preparing,
      fromVersion: preparing.toVersion,
      toState: DurableFixtureRehearsalLifecycleState.Prepared,
      reasonCode: "PREPARATION_COMMITTED",
      occurredAtUtc: AT,
    });
    repository.initializePrepared(
      createDurableFixtureRehearsalRegistry(
        registryInput(variant, DurableFixtureRehearsalLifecycleState.Prepared, 3, 1, null, null),
      ),
      [preparing, prepared],
    );
    const stepClaim = createDurableFixtureRehearsalOperationClaim({
      claimId: "claim-step-1",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: FP("1"),
      phase: DurableFixtureRehearsalPhase.Step,
      invocationOrdinal: 1,
      expectedLifecycleVersion: 3,
      expectedRecoveryFingerprint: FP("d"),
      requestFingerprint: FP("2"),
      processSessionId: `session-${variant}`,
      bootIdentity: `boot-${variant}`,
      ownerAuthorizationId: null,
      claimedAtUtc: AT,
    });
    const ready = createDurableFixtureRehearsalTransition({
      transitionId: "transition-ready",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: FP("1"),
      ordinal: 1,
      fromState: DurableFixtureRehearsalLifecycleState.Prepared,
      fromVersion: 3,
      toState: DurableFixtureRehearsalLifecycleState.Ready,
      reasonCode: "READY_FOR_STEP",
      occurredAtUtc: AT,
    });
    const stepping = createDurableFixtureRehearsalTransition({
      transitionId: "transition-stepping",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: FP("1"),
      ordinal: 1,
      fromState: DurableFixtureRehearsalLifecycleState.Ready,
      fromVersion: ready.toVersion,
      toState: DurableFixtureRehearsalLifecycleState.Stepping,
      reasonCode: "STEP_CLAIMED",
      occurredAtUtc: AT,
    });
    repository.claimStep(
      3, stepClaim, [ready, stepping],
      createDurableFixtureRehearsalRegistry(
        registryInput(variant, DurableFixtureRehearsalLifecycleState.Stepping, 5, 1, null, null),
      ),
    );
    const stepReady = createDurableFixtureRehearsalTransition({
      transitionId: "transition-step-ready",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: FP("1"),
      ordinal: 1,
      fromState: DurableFixtureRehearsalLifecycleState.Stepping,
      fromVersion: 5,
      toState: DurableFixtureRehearsalLifecycleState.Ready,
      reasonCode: "STEP_RECEIPT_COMMITTED",
      occurredAtUtc: AT,
    });
    const completed = createDurableFixtureRehearsalTransition({
      transitionId: "transition-completed",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: FP("1"),
      ordinal: 1,
      fromState: DurableFixtureRehearsalLifecycleState.Ready,
      fromVersion: stepReady.toVersion,
      toState: DurableFixtureRehearsalLifecycleState.Completed,
      reasonCode: "SCENARIO_COMPLETED",
      occurredAtUtc: AT,
    });
    repository.completeStep(
      5,
      createDurableFixtureRehearsalInvocationReceipt({
        receiptId: "receipt-step-1",
        claimId: stepClaim.claimId,
        rehearsalId: "rehearsal-1",
        manifestFingerprint: FP("1"),
        invocationOrdinal: 1,
        selectedAction: CollectionRunnerRuntimeAssemblyAction.CompleteAndExit,
        resultingPilotState: CollectionRunnerPilotState.Completed,
        resultingTaskState: CollectionRunnerTaskState.Committed,
        outcome: CollectionRunnerRuntimeStepOutcome.Completed,
        terminalReportFingerprint: FP("3"),
        durableTransitionFingerprint: FP("4"),
        outboxChronologyFingerprint: FP("5"),
        recoveryFingerprint: FP("d"),
        observedAtUtc: AT,
      }),
      [stepReady, completed],
      createDurableFixtureRehearsalRegistry(
        registryInput(variant, DurableFixtureRehearsalLifecycleState.Completed, 7, 2, scenario, execution),
      ),
    );
    const freezeClaim = createDurableFixtureRehearsalOperationClaim({
      claimId: "claim-freeze-1",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: FP("1"),
      phase: DurableFixtureRehearsalPhase.Freeze,
      invocationOrdinal: null,
      expectedLifecycleVersion: 7,
      expectedRecoveryFingerprint: FP("d"),
      requestFingerprint: FP("6"),
      processSessionId: `session-${variant}`,
      bootIdentity: `boot-${variant}`,
      ownerAuthorizationId: null,
      claimedAtUtc: AT,
    });
    const validated = createDurableFixtureRehearsalTransition({
      transitionId: "transition-validated",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: FP("1"),
      ordinal: 1,
      fromState: DurableFixtureRehearsalLifecycleState.Completed,
      fromVersion: 7,
      toState: DurableFixtureRehearsalLifecycleState.Validated,
      reasonCode: "VALIDATION_COMMITTED",
      occurredAtUtc: AT,
    });
    const frozen = createDurableFixtureRehearsalTransition({
      transitionId: "transition-frozen",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: FP("1"),
      ordinal: 1,
      fromState: DurableFixtureRehearsalLifecycleState.Validated,
      fromVersion: validated.toVersion,
      toState: DurableFixtureRehearsalLifecycleState.EvidenceFrozen,
      reasonCode: "EVIDENCE_FROZEN",
      occurredAtUtc: AT,
    });
    const validationReceipt =
      createDurableFixtureRehearsalValidationReceipt({
        receiptId: "validation-1",
        rehearsalId: "rehearsal-1",
        manifestFingerprint: FP("1"),
        repositoryCommit: "a".repeat(40),
        validationPolicyVersion: DURABLE_FIXTURE_REHEARSAL_VALIDATION_POLICY,
        validationSuiteFingerprint: FP("7"),
        registeredTestTotal: 2343,
        exitStatus: 0,
        startedAtUtc: AT,
        endedAtUtc: AT,
        sanitizedOutputDigest: FP("8"),
      });
    const evidencePlan = createDurableFixtureRehearsalEvidencePlan({
      evidencePlanId: "evidence-plan-1",
      freezeClaimId: freezeClaim.claimId,
      rehearsalId: "rehearsal-1",
      manifestFingerprint: FP("1"),
      validationReceiptFingerprint: validationReceipt.fingerprint,
      validationSuiteFingerprint: validationReceipt.validationSuiteFingerprint,
      plannedBackupId: "backup-1",
      plannedPackageId: "package-1",
      plannedEnvelopeId: "envelope-1",
      retentionPolicyVersion: "1.0",
      terminalFreezeFingerprint: frozen.fingerprint,
      nonAuthorityDeclaration: DURABLE_FIXTURE_REHEARSAL_EVIDENCE_NON_AUTHORITY,
      frozenAtUtc: AT,
    });
    const snapshot = repository.freezeEvidence(
      7, freezeClaim, evidencePlan, [validated, frozen],
      createDurableFixtureRehearsalRegistry(
        registryInput(variant, DurableFixtureRehearsalLifecycleState.EvidenceFrozen, 9, 2, scenario, execution),
      ),
    );
    frozenEvidence = { evidencePlan, validationReceipt, snapshot };
  } finally {
    database.close();
  }
  const manifest = await new DurableFixtureRehearsalEnvelopeBuilder(
    repositoryRoot,
    [{ evidenceRootId: "evidence-root-1", path: evidenceRoot }],
    [{
      storeId: "store-1",
      path: readiness.storePath,
      schemaCatalogChecksum: readiness.schemaCatalogChecksum,
    }],
    observer,
  ).build({
    evidenceRootId: "evidence-root-1",
    storeId: "store-1",
    envelopeId: "envelope-1",
    publishedAtUtc: AT,
    frozenEvidence,
  });
  return {
    evidenceRoot,
    sourceRoot,
    sourceStorePath: readiness.storePath,
    envelopeId: "envelope-1",
    manifestFingerprint: FP("1"),
    scenarioResultFingerprint: scenario,
    executionPackageFingerprint: execution,
    envelopeFingerprint: manifest.fingerprint,
  };
}
