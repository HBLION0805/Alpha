import type { DatabaseSync } from "node:sqlite";

import {
  DurableFixtureRehearsalLifecycleState,
  DurableFixtureRehearsalPhase,
  type DurableFixtureRehearsalEvidencePlan,
  type DurableFixtureRehearsalFailureReceipt,
  type DurableFixtureRehearsalInvocationReceipt,
  type DurableFixtureRehearsalOperationClaim,
  type DurableFixtureRehearsalRegistry,
  type DurableFixtureRehearsalSnapshot,
  type DurableFixtureRehearsalTransition,
} from "../contracts";
import {
  createDurableFixtureRehearsalEvidencePlan,
  createDurableFixtureRehearsalFailureReceipt,
  createDurableFixtureRehearsalInvocationReceipt,
  createDurableFixtureRehearsalOperationClaim,
  createDurableFixtureRehearsalRegistry,
  createDurableFixtureRehearsalTransition,
  verifyDurableFixtureRehearsalSnapshot,
} from "../engines/event-contract-collection-runner-durable-fixture-rehearsal";

type Row = Readonly<Record<string, unknown>>;

export enum DurableFixtureRehearsalRepositoryErrorCode {
  InvalidRecord = "INVALID_RECORD",
  NotFound = "NOT_FOUND",
  StateConflict = "STATE_CONFLICT",
  ReplayConflict = "REPLAY_CONFLICT",
  IntegrityFailure = "INTEGRITY_FAILURE",
  TransactionFailure = "TRANSACTION_FAILURE",
}

export class DurableFixtureRehearsalRepositoryError extends Error {
  public constructor(
    public readonly code: DurableFixtureRehearsalRepositoryErrorCode,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = "DurableFixtureRehearsalRepositoryError";
  }
}

export interface DurableFixtureRehearsalRepository {
  readSnapshot(rehearsalId: string): DurableFixtureRehearsalSnapshot | null;
  findClaimByRequestFingerprint(
    rehearsalId: string,
    requestFingerprint: string,
  ): DurableFixtureRehearsalOperationClaim | null;
  initializePrepared(
    registry: DurableFixtureRehearsalRegistry,
    transitions: readonly DurableFixtureRehearsalTransition[],
  ): DurableFixtureRehearsalSnapshot;
  claimStep(
    expectedLifecycleVersion: number,
    claim: DurableFixtureRehearsalOperationClaim,
    transitions: readonly DurableFixtureRehearsalTransition[],
    registry: DurableFixtureRehearsalRegistry,
  ): DurableFixtureRehearsalSnapshot;
  completeStep(
    expectedLifecycleVersion: number,
    receipt: DurableFixtureRehearsalInvocationReceipt,
    transitions: readonly DurableFixtureRehearsalTransition[],
    registry: DurableFixtureRehearsalRegistry,
  ): DurableFixtureRehearsalSnapshot;
  claimRecovery(
    expectedLifecycleVersion: number,
    claim: DurableFixtureRehearsalOperationClaim,
  ): DurableFixtureRehearsalSnapshot;
  completeRecovery(
    expectedLifecycleVersion: number,
    originalReceipt: DurableFixtureRehearsalInvocationReceipt,
    recoveryReceipt: DurableFixtureRehearsalFailureReceipt,
    transitions: readonly DurableFixtureRehearsalTransition[],
    registry: DurableFixtureRehearsalRegistry,
  ): DurableFixtureRehearsalSnapshot;
  failRecovery(
    expectedLifecycleVersion: number,
    receipts: readonly DurableFixtureRehearsalFailureReceipt[],
    transition: DurableFixtureRehearsalTransition,
    registry: DurableFixtureRehearsalRegistry,
  ): DurableFixtureRehearsalSnapshot;
  freezeEvidence(
    expectedLifecycleVersion: number,
    claim: DurableFixtureRehearsalOperationClaim,
    evidencePlan: DurableFixtureRehearsalEvidencePlan,
    transitions: readonly DurableFixtureRehearsalTransition[],
    registry: DurableFixtureRehearsalRegistry,
  ): DurableFixtureRehearsalSnapshot;
}

function fail(
  code: DurableFixtureRehearsalRepositoryErrorCode,
  message: string,
  cause?: unknown,
): never {
  throw new DurableFixtureRehearsalRepositoryError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function parseRecord<T>(row: Row | undefined, create: (input: never) => T): T {
  if (typeof row?.canonical_record_json !== "string") {
    fail(
      DurableFixtureRehearsalRepositoryErrorCode.IntegrityFailure,
      "Durable rehearsal canonical record is missing.",
    );
  }
  try {
    const stored = JSON.parse(row.canonical_record_json) as Record<string, unknown>;
    const { deterministic, fingerprint, ...input } = stored;
    const candidate = create(input as never) as T & {
      readonly deterministic?: unknown;
      readonly fingerprint?: unknown;
    };
    if (
      deterministic !== true ||
      candidate.fingerprint !== fingerprint
    ) {
      fail(
        DurableFixtureRehearsalRepositoryErrorCode.IntegrityFailure,
        "Durable rehearsal record fingerprint is invalid.",
      );
    }
    return candidate;
  } catch (error) {
    if (error instanceof DurableFixtureRehearsalRepositoryError) throw error;
    fail(
      DurableFixtureRehearsalRepositoryErrorCode.IntegrityFailure,
      "Durable rehearsal canonical record cannot be reconstructed.",
      error,
    );
  }
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

function assertColumns(
  row: Row,
  expected: Readonly<Record<string, unknown>>,
): void {
  for (const [column, value] of Object.entries(expected)) {
    if (row[column] !== value) {
      fail(
        DurableFixtureRehearsalRepositoryErrorCode.IntegrityFailure,
        `Durable rehearsal column ${column} conflicts with its canonical record.`,
      );
    }
  }
}

export class SqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository
  implements DurableFixtureRehearsalRepository {
  public constructor(private readonly database: DatabaseSync) {}

  public readSnapshot(rehearsalId: string): DurableFixtureRehearsalSnapshot | null {
    const registryRow = this.database.prepare(
      "SELECT * FROM fixture_rehearsals WHERE rehearsal_id = ?",
    ).get(rehearsalId) as Row | undefined;
    if (registryRow === undefined) return null;
    const registry = this.#registry(registryRow);
    const transitions = this.#many(
      "SELECT * FROM fixture_rehearsal_transitions WHERE rehearsal_id = ? ORDER BY to_version",
      rehearsalId,
      (row) => this.#transition(row),
    );
    const claims = this.#many<DurableFixtureRehearsalOperationClaim>(
      "SELECT * FROM fixture_rehearsal_operation_claims WHERE rehearsal_id = ? ORDER BY expected_lifecycle_version, claim_id",
      rehearsalId,
      (row) => this.#claim(row),
    );
    const invocationReceipts =
      this.#many<DurableFixtureRehearsalInvocationReceipt>(
      "SELECT * FROM fixture_rehearsal_invocation_receipts WHERE rehearsal_id = ? ORDER BY invocation_ordinal",
      rehearsalId,
      (row) => this.#invocationReceipt(row),
    );
    const failureReceipts = this.#many<DurableFixtureRehearsalFailureReceipt>(
      "SELECT * FROM fixture_rehearsal_failure_receipts WHERE rehearsal_id = ? ORDER BY occurred_at_utc, failure_id",
      rehearsalId,
      (row) => this.#failureReceipt(row),
    );
    const evidenceRow = this.database.prepare(
      "SELECT * FROM fixture_rehearsal_evidence_plans WHERE rehearsal_id = ?",
    ).get(rehearsalId) as Row | undefined;
    const evidencePlan = evidenceRow === undefined
      ? null
      : this.#evidencePlan(evidenceRow);
    const snapshot = Object.freeze({
      registry,
      transitions: Object.freeze(transitions),
      claims: Object.freeze(claims),
      invocationReceipts: Object.freeze(invocationReceipts),
      failureReceipts: Object.freeze(failureReceipts),
      evidencePlan,
    });
    const verification = verifyDurableFixtureRehearsalSnapshot(snapshot);
    if (!verification.valid) {
      fail(
        DurableFixtureRehearsalRepositoryErrorCode.IntegrityFailure,
        `Durable rehearsal snapshot failed verification: ${verification.issueCodes.join(",")}.`,
      );
    }
    return snapshot;
  }

  public findClaimByRequestFingerprint(
    rehearsalId: string,
    requestFingerprint: string,
  ): DurableFixtureRehearsalOperationClaim | null {
    const row = this.database.prepare(`
SELECT *
FROM fixture_rehearsal_operation_claims
WHERE rehearsal_id = ? AND request_fingerprint = ?
`).get(rehearsalId, requestFingerprint) as Row | undefined;
    return row === undefined
      ? null
      : this.#claim(row);
  }

  public initializePrepared(
    registry: DurableFixtureRehearsalRegistry,
    transitions: readonly DurableFixtureRehearsalTransition[],
  ): DurableFixtureRehearsalSnapshot {
    if (
      registry.lifecycleState !== DurableFixtureRehearsalLifecycleState.Prepared ||
      registry.lifecycleVersion !== 3 ||
      transitions.length !== 2
    ) {
      fail(
        DurableFixtureRehearsalRepositoryErrorCode.InvalidRecord,
        "Prepared initialization requires the exact PLANNED-PREPARING-PREPARED history.",
      );
    }
    return this.#transaction(() => {
      const existing = this.database.prepare(
        "SELECT * FROM fixture_rehearsals WHERE rehearsal_id = ?",
      ).get(registry.rehearsalId) as Row | undefined;
      if (existing !== undefined) {
        const snapshot = this.readSnapshot(registry.rehearsalId);
        if (
          snapshot?.registry.fingerprint === registry.fingerprint &&
          snapshot.transitions.map(({ fingerprint }) => fingerprint).join(",") ===
            transitions.map(({ fingerprint }) => fingerprint).join(",")
        ) return snapshot;
        fail(
          DurableFixtureRehearsalRepositoryErrorCode.ReplayConflict,
          "Changed durable preparation replay is forbidden.",
        );
      }
      this.#insertRegistry(registry);
      transitions.forEach((transition) => this.#insertTransition(transition));
      return this.#requireSnapshot(registry.rehearsalId);
    });
  }

  public claimStep(
    expectedLifecycleVersion: number,
    claim: DurableFixtureRehearsalOperationClaim,
    transitions: readonly DurableFixtureRehearsalTransition[],
    registry: DurableFixtureRehearsalRegistry,
  ): DurableFixtureRehearsalSnapshot {
    return this.#transaction(() => {
      const current = this.#requireSnapshot(claim.rehearsalId);
      if (
        current.registry.lifecycleVersion !== expectedLifecycleVersion ||
        current.registry.nextInvocationOrdinal !== claim.invocationOrdinal ||
        ![
          DurableFixtureRehearsalLifecycleState.Prepared,
          DurableFixtureRehearsalLifecycleState.Ready,
        ].includes(current.registry.lifecycleState) ||
        registry.lifecycleState !== DurableFixtureRehearsalLifecycleState.Stepping
      ) {
        fail(
          DurableFixtureRehearsalRepositoryErrorCode.StateConflict,
          "Step claim lost its lifecycle compare-and-swap boundary.",
        );
      }
      this.#insertClaim(claim);
      transitions.forEach((transition) => this.#insertTransition(transition));
      this.#updateRegistry(expectedLifecycleVersion, registry);
      return this.#requireSnapshot(claim.rehearsalId);
    });
  }

  public completeStep(
    expectedLifecycleVersion: number,
    receipt: DurableFixtureRehearsalInvocationReceipt,
    transitions: readonly DurableFixtureRehearsalTransition[],
    registry: DurableFixtureRehearsalRegistry,
  ): DurableFixtureRehearsalSnapshot {
    return this.#transaction(() => {
      this.#assertStepping(expectedLifecycleVersion, registry.rehearsalId);
      this.#insertInvocationReceipt(receipt);
      transitions.forEach((transition) => this.#insertTransition(transition));
      this.#updateRegistry(expectedLifecycleVersion, registry);
      return this.#requireSnapshot(registry.rehearsalId);
    });
  }

  public claimRecovery(
    expectedLifecycleVersion: number,
    claim: DurableFixtureRehearsalOperationClaim,
  ): DurableFixtureRehearsalSnapshot {
    return this.#transaction(() => {
      this.#assertStepping(expectedLifecycleVersion, claim.rehearsalId);
      this.#insertClaim(claim);
      return this.#requireSnapshot(claim.rehearsalId);
    });
  }

  public completeRecovery(
    expectedLifecycleVersion: number,
    originalReceipt: DurableFixtureRehearsalInvocationReceipt,
    recoveryReceipt: DurableFixtureRehearsalFailureReceipt,
    transitions: readonly DurableFixtureRehearsalTransition[],
    registry: DurableFixtureRehearsalRegistry,
  ): DurableFixtureRehearsalSnapshot {
    return this.#transaction(() => {
      this.#assertStepping(expectedLifecycleVersion, registry.rehearsalId);
      this.#insertInvocationReceipt(originalReceipt);
      this.#insertFailureReceipt(recoveryReceipt);
      transitions.forEach((transition) => this.#insertTransition(transition));
      this.#updateRegistry(expectedLifecycleVersion, registry);
      return this.#requireSnapshot(registry.rehearsalId);
    });
  }

  public failRecovery(
    expectedLifecycleVersion: number,
    receipts: readonly DurableFixtureRehearsalFailureReceipt[],
    transition: DurableFixtureRehearsalTransition,
    registry: DurableFixtureRehearsalRegistry,
  ): DurableFixtureRehearsalSnapshot {
    return this.#transaction(() => {
      this.#assertStepping(expectedLifecycleVersion, registry.rehearsalId);
      receipts.forEach((receipt) => this.#insertFailureReceipt(receipt));
      this.#insertTransition(transition);
      this.#updateRegistry(expectedLifecycleVersion, registry);
      return this.#requireSnapshot(registry.rehearsalId);
    });
  }

  public freezeEvidence(
    expectedLifecycleVersion: number,
    claim: DurableFixtureRehearsalOperationClaim,
    evidencePlan: DurableFixtureRehearsalEvidencePlan,
    transitions: readonly DurableFixtureRehearsalTransition[],
    registry: DurableFixtureRehearsalRegistry,
  ): DurableFixtureRehearsalSnapshot {
    return this.#transaction(() => {
      const current = this.#requireSnapshot(registry.rehearsalId);
      if (
        current.registry.lifecycleVersion !== expectedLifecycleVersion ||
        current.registry.lifecycleState !==
          DurableFixtureRehearsalLifecycleState.Completed ||
        claim.phase !== DurableFixtureRehearsalPhase.Freeze ||
        claim.expectedLifecycleVersion !== expectedLifecycleVersion ||
        evidencePlan.freezeClaimId !== claim.claimId ||
        evidencePlan.rehearsalId !== registry.rehearsalId
      ) {
        fail(
          DurableFixtureRehearsalRepositoryErrorCode.StateConflict,
          "Durable rehearsal is not at the exact terminal-freeze boundary.",
        );
      }
      this.#insertClaim(claim);
      transitions.forEach((item) => this.#insertTransition(item));
      this.#insertEvidencePlan(evidencePlan);
      this.#updateRegistry(expectedLifecycleVersion, registry);
      return this.#requireSnapshot(registry.rehearsalId);
    });
  }

  #assertStepping(expectedVersion: number, rehearsalId: string): void {
    const current = this.#requireSnapshot(rehearsalId);
    if (
      current.registry.lifecycleVersion !== expectedVersion ||
      current.registry.lifecycleState !==
        DurableFixtureRehearsalLifecycleState.Stepping
    ) {
      fail(
        DurableFixtureRehearsalRepositoryErrorCode.StateConflict,
        "Durable rehearsal is not at the expected STEPPING boundary.",
      );
    }
  }

  #registry(row: Row): DurableFixtureRehearsalRegistry {
    if (typeof row.canonical_record_json !== "string") {
      fail(
        DurableFixtureRehearsalRepositoryErrorCode.IntegrityFailure,
        "Durable rehearsal registry record is missing.",
      );
    }
    try {
      const stored = JSON.parse(row.canonical_record_json) as Record<string, unknown>;
      const { deterministic, fingerprint, schemaProfile, ...input } = stored;
      const registry = createDurableFixtureRehearsalRegistry(input as never);
      if (
        deterministic !== true ||
        registry.schemaProfile !== schemaProfile ||
        registry.fingerprint !== fingerprint
      ) {
        fail(
          DurableFixtureRehearsalRepositoryErrorCode.IntegrityFailure,
          "Durable rehearsal registry fingerprint is invalid.",
        );
      }
      assertColumns(row, {
        rehearsal_id: registry.rehearsalId,
        manifest_fingerprint: registry.manifestFingerprint,
        lifecycle_state: registry.lifecycleState,
        lifecycle_version: registry.lifecycleVersion,
        next_invocation_ordinal: registry.nextInvocationOrdinal,
        recovery_fingerprint: registry.recoveryFingerprint,
        record_fingerprint: registry.fingerprint,
      });
      return registry;
    } catch (error) {
      if (error instanceof DurableFixtureRehearsalRepositoryError) throw error;
      fail(
        DurableFixtureRehearsalRepositoryErrorCode.IntegrityFailure,
        "Durable rehearsal registry cannot be reconstructed.",
        error,
      );
    }
  }

  #transition(row: Row): DurableFixtureRehearsalTransition {
    if (typeof row.canonical_record_json !== "string") {
      fail(
        DurableFixtureRehearsalRepositoryErrorCode.IntegrityFailure,
        "Durable rehearsal transition record is missing.",
      );
    }
    try {
      const stored = JSON.parse(row.canonical_record_json) as Record<string, unknown>;
      const { deterministic, fingerprint, toVersion, ...input } = stored;
      const transition = createDurableFixtureRehearsalTransition(input as never);
      if (
        deterministic !== true ||
        transition.toVersion !== toVersion ||
        transition.fingerprint !== fingerprint
      ) {
        fail(
          DurableFixtureRehearsalRepositoryErrorCode.IntegrityFailure,
          "Durable rehearsal transition fingerprint is invalid.",
        );
      }
      assertColumns(row, {
        transition_id: transition.transitionId,
        rehearsal_id: transition.rehearsalId,
        manifest_fingerprint: transition.manifestFingerprint,
        from_state: transition.fromState,
        to_state: transition.toState,
        from_version: transition.fromVersion,
        to_version: transition.toVersion,
        transition_fingerprint: transition.fingerprint,
      });
      return transition;
    } catch (error) {
      if (error instanceof DurableFixtureRehearsalRepositoryError) throw error;
      fail(
        DurableFixtureRehearsalRepositoryErrorCode.IntegrityFailure,
        "Durable rehearsal transition cannot be reconstructed.",
        error,
      );
    }
  }

  #claim(row: Row): DurableFixtureRehearsalOperationClaim {
    const claim = parseRecord(
      row,
      createDurableFixtureRehearsalOperationClaim as never,
    ) as DurableFixtureRehearsalOperationClaim;
    assertColumns(row, {
      claim_id: claim.claimId,
      rehearsal_id: claim.rehearsalId,
      manifest_fingerprint: claim.manifestFingerprint,
      phase: claim.phase,
      invocation_ordinal: claim.invocationOrdinal,
      expected_lifecycle_version: claim.expectedLifecycleVersion,
      expected_recovery_fingerprint: claim.expectedRecoveryFingerprint,
      request_fingerprint: claim.requestFingerprint,
      claim_fingerprint: claim.fingerprint,
    });
    return claim;
  }

  #invocationReceipt(row: Row): DurableFixtureRehearsalInvocationReceipt {
    const receipt = parseRecord(
      row,
      createDurableFixtureRehearsalInvocationReceipt as never,
    ) as DurableFixtureRehearsalInvocationReceipt;
    assertColumns(row, {
      receipt_id: receipt.receiptId,
      claim_id: receipt.claimId,
      rehearsal_id: receipt.rehearsalId,
      manifest_fingerprint: receipt.manifestFingerprint,
      invocation_ordinal: receipt.invocationOrdinal,
      terminal_report_fingerprint: receipt.terminalReportFingerprint,
      recovery_fingerprint: receipt.recoveryFingerprint,
      receipt_fingerprint: receipt.fingerprint,
    });
    return receipt;
  }

  #failureReceipt(row: Row): DurableFixtureRehearsalFailureReceipt {
    const receipt = parseRecord(
      row,
      createDurableFixtureRehearsalFailureReceipt as never,
    ) as DurableFixtureRehearsalFailureReceipt;
    assertColumns(row, {
      failure_id: receipt.failureId,
      claim_id: receipt.claimId,
      rehearsal_id: receipt.rehearsalId,
      manifest_fingerprint: receipt.manifestFingerprint,
      phase: receipt.phase,
      disposition: receipt.disposition,
      observed_recovery_fingerprint: receipt.observedRecoveryFingerprint,
      failure_fingerprint: receipt.fingerprint,
    });
    return receipt;
  }

  #evidencePlan(row: Row): DurableFixtureRehearsalEvidencePlan {
    const plan = parseRecord(
      row,
      createDurableFixtureRehearsalEvidencePlan as never,
    ) as DurableFixtureRehearsalEvidencePlan;
    assertColumns(row, {
      evidence_plan_id: plan.evidencePlanId,
      rehearsal_id: plan.rehearsalId,
      manifest_fingerprint: plan.manifestFingerprint,
      validation_receipt_fingerprint: plan.validationReceiptFingerprint,
      terminal_freeze_fingerprint: plan.terminalFreezeFingerprint,
      evidence_plan_fingerprint: plan.fingerprint,
    });
    return plan;
  }

  #many<T>(
    sql: string,
    rehearsalId: string,
    map: (row: Row) => T,
  ): T[] {
    return (this.database.prepare(sql).all(rehearsalId) as Row[]).map(map);
  }

  #requireSnapshot(rehearsalId: string): DurableFixtureRehearsalSnapshot {
    const snapshot = this.readSnapshot(rehearsalId);
    if (snapshot === null) {
      fail(
        DurableFixtureRehearsalRepositoryErrorCode.NotFound,
        "Durable rehearsal was not found.",
      );
    }
    return snapshot;
  }

  #insertRegistry(registry: DurableFixtureRehearsalRegistry): void {
    this.database.prepare(`
INSERT INTO fixture_rehearsals (
 rehearsal_id, manifest_fingerprint, schema_version, schema_profile,
 build_fingerprint, runner_fingerprint, frozen_plan_fingerprint,
 catalog_fingerprint, provider_fingerprint, mapping_fingerprint,
 activation_id, task_set_fingerprint, workspace_identity, store_identity,
 lifecycle_state, lifecycle_version, next_invocation_ordinal,
 recovery_fingerprint, maximum_invocations, scenario_result_fingerprint,
 execution_package_fingerprint, non_authority_declaration,
 canonical_record_json, record_fingerprint, created_at_utc
) VALUES (
 ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
)
`).run(
      registry.rehearsalId,
      registry.manifestFingerprint,
      registry.schemaVersion,
      registry.schemaProfile,
      registry.buildFingerprint,
      registry.runnerFingerprint,
      registry.frozenPlanFingerprint,
      registry.catalogFingerprint,
      registry.providerFingerprint,
      registry.mappingFingerprint,
      registry.activationId,
      registry.taskSetFingerprint,
      registry.workspaceIdentity,
      registry.storeIdentity,
      registry.lifecycleState,
      registry.lifecycleVersion,
      registry.nextInvocationOrdinal,
      registry.recoveryFingerprint,
      registry.maximumInvocations,
      registry.scenarioResultFingerprint,
      registry.executionPackageFingerprint,
      registry.nonAuthorityDeclaration,
      json(registry),
      registry.fingerprint,
      registry.createdAtUtc,
    );
  }

  #updateRegistry(
    expectedLifecycleVersion: number,
    registry: DurableFixtureRehearsalRegistry,
  ): void {
    const result = this.database.prepare(`
UPDATE fixture_rehearsals SET
 lifecycle_state = ?,
 lifecycle_version = ?,
 next_invocation_ordinal = ?,
 recovery_fingerprint = ?,
 scenario_result_fingerprint = ?,
 execution_package_fingerprint = ?,
 canonical_record_json = ?,
 record_fingerprint = ?
WHERE rehearsal_id = ? AND lifecycle_version = ?
`).run(
      registry.lifecycleState,
      registry.lifecycleVersion,
      registry.nextInvocationOrdinal,
      registry.recoveryFingerprint,
      registry.scenarioResultFingerprint,
      registry.executionPackageFingerprint,
      json(registry),
      registry.fingerprint,
      registry.rehearsalId,
      expectedLifecycleVersion,
    );
    if (result.changes !== 1) {
      fail(
        DurableFixtureRehearsalRepositoryErrorCode.StateConflict,
        "Durable rehearsal registry compare-and-swap failed.",
      );
    }
  }

  #insertTransition(transition: DurableFixtureRehearsalTransition): void {
    this.database.prepare(`
INSERT INTO fixture_rehearsal_transitions (
 transition_id, rehearsal_id, manifest_fingerprint, ordinal, from_state,
 to_state, from_version, to_version, reason_code, transition_fingerprint,
 occurred_at_utc, canonical_record_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
      transition.transitionId,
      transition.rehearsalId,
      transition.manifestFingerprint,
      transition.ordinal,
      transition.fromState,
      transition.toState,
      transition.fromVersion,
      transition.toVersion,
      transition.reasonCode,
      transition.fingerprint,
      transition.occurredAtUtc,
      json(transition),
    );
  }

  #insertClaim(claim: DurableFixtureRehearsalOperationClaim): void {
    this.database.prepare(`
INSERT INTO fixture_rehearsal_operation_claims (
 claim_id, rehearsal_id, manifest_fingerprint, phase, invocation_ordinal,
 expected_lifecycle_version, expected_recovery_fingerprint,
 request_fingerprint, process_session_id, boot_identity,
 owner_authorization_id, claim_fingerprint, claimed_at_utc,
 canonical_record_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
      claim.claimId,
      claim.rehearsalId,
      claim.manifestFingerprint,
      claim.phase,
      claim.invocationOrdinal,
      claim.expectedLifecycleVersion,
      claim.expectedRecoveryFingerprint,
      claim.requestFingerprint,
      claim.processSessionId,
      claim.bootIdentity,
      claim.ownerAuthorizationId,
      claim.fingerprint,
      claim.claimedAtUtc,
      json(claim),
    );
  }

  #insertInvocationReceipt(
    receipt: DurableFixtureRehearsalInvocationReceipt,
  ): void {
    this.database.prepare(`
INSERT INTO fixture_rehearsal_invocation_receipts (
 receipt_id, claim_id, rehearsal_id, manifest_fingerprint,
 invocation_ordinal, selected_action, resulting_pilot_state,
 resulting_task_state, outcome, terminal_report_fingerprint,
 durable_transition_fingerprint, outbox_chronology_fingerprint,
 recovery_fingerprint, receipt_fingerprint, observed_at_utc,
 canonical_record_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
      receipt.receiptId,
      receipt.claimId,
      receipt.rehearsalId,
      receipt.manifestFingerprint,
      receipt.invocationOrdinal,
      receipt.selectedAction,
      receipt.resultingPilotState,
      receipt.resultingTaskState,
      receipt.outcome,
      receipt.terminalReportFingerprint,
      receipt.durableTransitionFingerprint,
      receipt.outboxChronologyFingerprint,
      receipt.recoveryFingerprint,
      receipt.fingerprint,
      receipt.observedAtUtc,
      json(receipt),
    );
  }

  #insertFailureReceipt(receipt: DurableFixtureRehearsalFailureReceipt): void {
    this.database.prepare(`
INSERT INTO fixture_rehearsal_failure_receipts (
 failure_id, claim_id, rehearsal_id, manifest_fingerprint, phase,
 disposition, reason_code, terminal_report_fingerprint,
 observed_recovery_fingerprint, failure_fingerprint, occurred_at_utc,
 canonical_record_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
      receipt.failureId,
      receipt.claimId,
      receipt.rehearsalId,
      receipt.manifestFingerprint,
      receipt.phase,
      receipt.disposition,
      receipt.reasonCode,
      receipt.terminalReportFingerprint,
      receipt.observedRecoveryFingerprint,
      receipt.fingerprint,
      receipt.occurredAtUtc,
      json(receipt),
    );
  }

  #insertEvidencePlan(plan: DurableFixtureRehearsalEvidencePlan): void {
    this.database.prepare(`
INSERT INTO fixture_rehearsal_evidence_plans (
 evidence_plan_id, rehearsal_id, manifest_fingerprint,
 validation_receipt_fingerprint, validation_suite_fingerprint,
 planned_backup_id, planned_package_id, planned_envelope_id,
 retention_policy_version, terminal_freeze_fingerprint,
 non_authority_declaration, evidence_plan_fingerprint, frozen_at_utc,
 canonical_record_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
      plan.evidencePlanId,
      plan.rehearsalId,
      plan.manifestFingerprint,
      plan.validationReceiptFingerprint,
      plan.validationSuiteFingerprint,
      plan.plannedBackupId,
      plan.plannedPackageId,
      plan.plannedEnvelopeId,
      plan.retentionPolicyVersion,
      plan.terminalFreezeFingerprint,
      plan.nonAuthorityDeclaration,
      plan.fingerprint,
      plan.frozenAtUtc,
      json(plan),
    );
  }

  #transaction<T>(run: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = run();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        this.database.exec("ROLLBACK");
      } catch {
        // Preserve the original transaction failure.
      }
      if (error instanceof DurableFixtureRehearsalRepositoryError) throw error;
      fail(
        DurableFixtureRehearsalRepositoryErrorCode.TransactionFailure,
        "Durable rehearsal SQLite transaction failed and rolled back.",
        error,
      );
    }
  }
}

export function createSqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository(
  database: DatabaseSync,
): DurableFixtureRehearsalRepository {
  return new SqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository(
    database,
  );
}
