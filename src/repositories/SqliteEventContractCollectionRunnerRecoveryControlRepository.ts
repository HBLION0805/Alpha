import type { DatabaseSync } from "node:sqlite";

import {
  CollectionRunnerEmergencyStopDirective,
  CollectionRunnerOwnerDecisionAction,
  CollectionRunnerPilotState,
  CollectionRunnerRecoveryDisposition,
  type CollectionRunnerOwnerRecoveryDecision,
  type CollectionRunnerRecoveryAssessment,
} from "../contracts";
import { EventContractCollectionRunnerRecoveryControlEngine } from "../engines/event-contract-collection-runner-recovery-control/EventContractCollectionRunnerRecoveryControlEngine";
import {
  CollectionRunnerRecoveryControlRepositoryError,
  CollectionRunnerRecoveryControlRepositoryErrorCode,
  type CollectionRunnerControlExecutionReceipt,
  type CollectionRunnerRecoverySessionAuthorization,
  type EventContractCollectionRunnerRecoveryControlRepository,
  type ExecuteEmergencyStopTransaction,
  type ExecuteOwnerRecoveryDecisionTransaction,
  type PersistOwnerRecoveryDecisionTransaction,
  type PersistRecoveryAssessmentTransaction,
  type ValidateRecoverySessionGateInput,
} from "./EventContractCollectionRunnerRecoveryControlRepository";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u;
const FINGERPRINT =
  /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const UTC_MILLISECOND =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

type Row = Readonly<Record<string, unknown>>;

export interface CollectionRunnerRecoveryControlStoreContext {
  readonly storeId: string;
  readonly storePathIdentity: string;
  readonly schemaCatalogChecksum: string;
  readonly recoveryReportFingerprint: string;
  readonly recoveryInspectedAtUtc: string;
}

interface PilotRow extends Row {
  readonly activation_id: string;
  readonly owner_id: string;
  readonly activation_fingerprint: string;
  readonly current_state: CollectionRunnerPilotState;
  readonly aggregate_version: number;
  readonly starts_at_utc: string;
  readonly stops_at_utc: string;
}

interface AssessmentRow extends Row {
  readonly assessment_id: string;
  readonly assessment_fingerprint: string;
  readonly canonical_record_json: string;
}

interface DecisionRow extends Row {
  readonly decision_id: string;
  readonly decision_fingerprint: string;
  readonly canonical_record_json: string;
  readonly consumed_at_utc: string | null;
  readonly invalidated_at_utc: string | null;
}

function error(
  code: CollectionRunnerRecoveryControlRepositoryErrorCode,
  message: string,
  cause?: unknown,
): CollectionRunnerRecoveryControlRepositoryError {
  return new CollectionRunnerRecoveryControlRepositoryError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: unknown,
  keys: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw error(
      CollectionRunnerRecoveryControlRepositoryErrorCode.InvalidInput,
      `${label} must be a record.`,
    );
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw error(
      CollectionRunnerRecoveryControlRepositoryErrorCode.InvalidInput,
      `${label} contains missing or unknown fields.`,
    );
  }
}

function identifier(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    throw error(
      CollectionRunnerRecoveryControlRepositoryErrorCode.InvalidInput,
      `${label} must be a bounded canonical identifier.`,
    );
  }
}

function fingerprintValue(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== "string" || !FINGERPRINT.test(value)) {
    throw error(
      CollectionRunnerRecoveryControlRepositoryErrorCode.InvalidInput,
      `${label} must be a canonical fingerprint.`,
    );
  }
}

function utc(value: unknown, label: string): number {
  if (typeof value !== "string") {
    throw error(
      CollectionRunnerRecoveryControlRepositoryErrorCode.InvalidInput,
      `${label} must be canonical UTC.`,
    );
  }
  const parsed = Date.parse(value);
  if (
    !UTC_MILLISECOND.test(value) ||
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString() !== value
  ) {
    throw error(
      CollectionRunnerRecoveryControlRepositoryErrorCode.InvalidInput,
      `${label} must be canonical UTC.`,
    );
  }
  return parsed;
}

function positiveInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw error(
      CollectionRunnerRecoveryControlRepositoryErrorCode.InvalidInput,
      `${label} must be a positive safe integer.`,
    );
  }
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
    .join(",")}}`;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const character of new TextEncoder().encode(value)) {
    hash ^= BigInt(character);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function fingerprint(value: unknown): string {
  return `fnv1a64:${fnv1a64(canonicalize(value))}`;
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      freeze(nested);
    }
  }
  return value;
}

function parseJson<T>(value: unknown, label: string): T {
  if (typeof value !== "string") {
    throw error(
      CollectionRunnerRecoveryControlRepositoryErrorCode.IdentityConflict,
      `${label} canonical record is unavailable.`,
    );
  }
  try {
    return JSON.parse(value) as T;
  } catch (cause) {
    throw error(
      CollectionRunnerRecoveryControlRepositoryErrorCode.IdentityConflict,
      `${label} canonical record is invalid.`,
      cause,
    );
  }
}

function changes(value: Readonly<{ readonly changes: number | bigint }>): number {
  return Number(value.changes);
}

const PERSIST_ASSESSMENT_KEYS = ["assessment", "recordedAtUtc"] as const;
const PERSIST_DECISION_KEYS = ["decision", "recordedAtUtc"] as const;
const EXECUTE_DECISION_KEYS = [
  "decisionId",
  "expectedDecisionFingerprint",
  "currentRecoveryReportFingerprint",
  "currentStorePathIdentity",
  "currentSchemaCatalogChecksum",
  "executedAtUtc",
] as const;
const EMERGENCY_STOP_KEYS = [
  "stopEventId",
  "idempotencyKey",
  "activationId",
  "expectedActivationAggregateVersion",
  "assessment",
  "executedAtUtc",
] as const;
const SESSION_GATE_KEYS = [
  "sessionAuthorizationId",
  "authorizationFingerprint",
  "activationId",
  "bootIdentity",
  "processSessionId",
  "observedAtUtc",
  "taskId",
] as const;

export class SqliteEventContractCollectionRunnerRecoveryControlRepository
  implements EventContractCollectionRunnerRecoveryControlRepository
{
  readonly #engine =
    new EventContractCollectionRunnerRecoveryControlEngine();

  public constructor(
    private readonly database: DatabaseSync,
    private readonly context: CollectionRunnerRecoveryControlStoreContext,
  ) {}

  public persistRecoveryAssessment(
    transaction: PersistRecoveryAssessmentTransaction,
  ): CollectionRunnerRecoveryAssessment {
    exactKeys(transaction, PERSIST_ASSESSMENT_KEYS, "assessment transaction");
    utc(transaction.recordedAtUtc, "recordedAtUtc");
    let assessment: CollectionRunnerRecoveryAssessment;
    try {
      assessment = this.#engine.verifyRecoveryAssessment(
        transaction.assessment,
      );
    } catch (cause) {
      throw error(
        CollectionRunnerRecoveryControlRepositoryErrorCode.InvalidInput,
        "Recovery assessment failed deterministic verification.",
        cause,
      );
    }
    this.#assertAssessmentContext(assessment);
    return this.#transaction(() => {
      this.#assertAssessmentDurableState(assessment);
      const existing = this.#assessmentRow(assessment.assessmentId);
      if (existing !== undefined) {
        if (existing.assessment_fingerprint !== assessment.fingerprint) {
          throw error(
            CollectionRunnerRecoveryControlRepositoryErrorCode.IdentityConflict,
            "Assessment identity already has a different fingerprint.",
          );
        }
        return this.#decodeAssessment(existing);
      }
      this.database
        .prepare(`
INSERT INTO recovery_assessments (
  assessment_id, assessment_fingerprint, policy_version, store_id,
  store_path_identity, schema_catalog_checksum, recovery_report_fingerprint,
  activation_id, activation_aggregate_version, owner_id, disposition,
  proposed_boot_identity, proposed_process_session_id, assessed_at_utc,
  expires_at_utc, canonical_record_json, created_at_utc
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
        .run(
          assessment.assessmentId,
          assessment.fingerprint,
          assessment.policyVersion,
          assessment.storeId,
          assessment.storePathIdentity,
          assessment.schemaCatalogChecksum,
          assessment.recoveryReportFingerprint,
          assessment.activation?.activationId ?? null,
          assessment.activation?.aggregateVersion ?? null,
          assessment.activation?.ownerId ?? null,
          assessment.disposition,
          assessment.proposedBootIdentity,
          assessment.proposedProcessSessionId,
          assessment.assessedAtUtc,
          assessment.expiresAtUtc,
          canonicalize(assessment),
          transaction.recordedAtUtc,
        );
      return assessment;
    });
  }

  public persistOwnerRecoveryDecision(
    transaction: PersistOwnerRecoveryDecisionTransaction,
  ): CollectionRunnerOwnerRecoveryDecision {
    exactKeys(transaction, PERSIST_DECISION_KEYS, "decision transaction");
    utc(transaction.recordedAtUtc, "recordedAtUtc");
    let decision: CollectionRunnerOwnerRecoveryDecision;
    try {
      decision = this.#engine.verifyOwnerRecoveryDecision(transaction.decision);
    } catch (cause) {
      throw error(
        CollectionRunnerRecoveryControlRepositoryErrorCode.InvalidInput,
        "Owner recovery decision failed deterministic verification.",
        cause,
      );
    }
    const activation = decision.assessment.activation;
    if (activation === null) {
      throw error(
        CollectionRunnerRecoveryControlRepositoryErrorCode.InvalidInput,
        "Owner recovery decisions require an exact activation.",
      );
    }
    return this.#transaction(() => {
      const storedAssessment = this.#requireAssessment(
        decision.assessment.assessmentId,
      );
      if (
        storedAssessment.assessment_fingerprint !==
        decision.assessment.fingerprint
      ) {
        throw error(
          CollectionRunnerRecoveryControlRepositoryErrorCode.IdentityConflict,
          "Decision assessment fingerprint does not match persisted evidence.",
        );
      }
      const pilot = this.#requirePilot(activation.activationId);
      if (
        pilot.owner_id !== decision.ownerAuthorization.ownerId ||
        pilot.owner_id !== activation.ownerId ||
        pilot.aggregate_version !== decision.expectedActivationAggregateVersion
      ) {
        throw error(
          CollectionRunnerRecoveryControlRepositoryErrorCode.AuthorityMismatch,
          "Decision does not bind the exact durable owner and activation version.",
        );
      }
      const existing = this.#decisionRow(decision.decisionId);
      if (existing !== undefined) {
        if (existing.decision_fingerprint !== decision.fingerprint) {
          throw error(
            CollectionRunnerRecoveryControlRepositoryErrorCode.IdentityConflict,
            "Decision identity already has a different fingerprint.",
          );
        }
        return this.#decodeDecision(existing);
      }
      this.database
        .prepare(`
INSERT INTO owner_recovery_decisions (
  decision_id, decision_fingerprint, idempotency_key, assessment_id,
  assessment_fingerprint, activation_id,
  expected_activation_aggregate_version, owner_id, action,
  proposed_boot_identity, proposed_process_session_id, decided_at_utc,
  expires_at_utc, canonical_record_json, created_at_utc
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
        .run(
          decision.decisionId,
          decision.fingerprint,
          decision.idempotencyKey,
          decision.assessment.assessmentId,
          decision.assessment.fingerprint,
          activation.activationId,
          decision.expectedActivationAggregateVersion,
          decision.ownerAuthorization.ownerId,
          decision.action,
          decision.proposedBootIdentity,
          decision.proposedProcessSessionId,
          decision.decidedAtUtc,
          decision.expiresAtUtc,
          canonicalize(decision),
          transaction.recordedAtUtc,
        );
      return decision;
    });
  }

  public executeOwnerRecoveryDecision(
    transaction: ExecuteOwnerRecoveryDecisionTransaction,
  ): CollectionRunnerControlExecutionReceipt {
    exactKeys(transaction, EXECUTE_DECISION_KEYS, "execute decision transaction");
    identifier(transaction.decisionId, "decisionId");
    fingerprintValue(
      transaction.expectedDecisionFingerprint,
      "expectedDecisionFingerprint",
    );
    fingerprintValue(
      transaction.currentRecoveryReportFingerprint,
      "currentRecoveryReportFingerprint",
    );
    fingerprintValue(
      transaction.currentStorePathIdentity,
      "currentStorePathIdentity",
    );
    fingerprintValue(
      transaction.currentSchemaCatalogChecksum,
      "currentSchemaCatalogChecksum",
    );
    const executedAt = utc(transaction.executedAtUtc, "executedAtUtc");
    this.#assertCurrentContext(transaction);
    return this.#transaction(() => {
      const row = this.#requireDecision(transaction.decisionId);
      if (row.decision_fingerprint !== transaction.expectedDecisionFingerprint) {
        throw error(
          CollectionRunnerRecoveryControlRepositoryErrorCode.IdentityConflict,
          "Decision fingerprint changed before execution.",
        );
      }
      const existingReceipt = this.#receiptByDecision(transaction.decisionId);
      if (existingReceipt !== null) return existingReceipt;
      if (row.consumed_at_utc !== null) {
        throw error(
          CollectionRunnerRecoveryControlRepositoryErrorCode.DecisionConsumed,
          "Owner recovery decision was already consumed.",
        );
      }
      if (row.invalidated_at_utc !== null) {
        throw error(
          CollectionRunnerRecoveryControlRepositoryErrorCode.DecisionInvalidated,
          "Owner recovery decision was invalidated.",
        );
      }
      const decision = this.#decodeDecision(row);
      if (executedAt >= utc(decision.expiresAtUtc, "decision.expiresAtUtc")) {
        throw error(
          CollectionRunnerRecoveryControlRepositoryErrorCode.DecisionExpired,
          "Owner recovery decision has expired.",
        );
      }
      const activation = decision.assessment.activation;
      if (activation === null) {
        throw error(
          CollectionRunnerRecoveryControlRepositoryErrorCode.InvalidState,
          "Decision has no activation.",
        );
      }
      const pilot = this.#requirePilot(activation.activationId);
      if (
        pilot.aggregate_version !== decision.expectedActivationAggregateVersion ||
        pilot.owner_id !== decision.ownerAuthorization.ownerId
      ) {
        throw error(
          CollectionRunnerRecoveryControlRepositoryErrorCode.VersionConflict,
          "Pilot owner or aggregate version changed before decision execution.",
        );
      }
      if (
        this.#hasEmergencyStopAtOrAfter(
          activation.activationId,
          decision.decidedAtUtc,
        ) &&
        decision.action === CollectionRunnerOwnerDecisionAction.ApproveResume
      ) {
        throw error(
          CollectionRunnerRecoveryControlRepositoryErrorCode.EmergencyStopPrecedence,
          "Emergency Stop invalidates unconsumed resume authority.",
        );
      }
      return this.#executeDecision(transaction.executedAtUtc, decision, pilot);
    });
  }

  public executeEmergencyStop(
    transaction: ExecuteEmergencyStopTransaction,
  ): CollectionRunnerControlExecutionReceipt {
    exactKeys(transaction, EMERGENCY_STOP_KEYS, "emergency stop transaction");
    identifier(transaction.stopEventId, "stopEventId");
    fingerprintValue(transaction.idempotencyKey, "idempotencyKey");
    identifier(transaction.activationId, "activationId");
    positiveInteger(
      transaction.expectedActivationAggregateVersion,
      "expectedActivationAggregateVersion",
    );
    utc(transaction.executedAtUtc, "executedAtUtc");
    let assessment;
    try {
      assessment = this.#engine.verifyEmergencyStopAssessment(
        transaction.assessment,
      );
    } catch (cause) {
      throw error(
        CollectionRunnerRecoveryControlRepositoryErrorCode.InvalidInput,
        "Emergency Stop assessment failed deterministic verification.",
        cause,
      );
    }
    if (
      assessment.directive === CollectionRunnerEmergencyStopDirective.NoStop
    ) {
      throw error(
        CollectionRunnerRecoveryControlRepositoryErrorCode.InvalidInput,
        "NO_STOP assessments do not authorize a control transaction.",
      );
    }
    return this.#transaction(() => {
      const existing = this.database
        .prepare(
          "SELECT stop_fingerprint FROM emergency_stop_events WHERE stop_event_id = ?",
        )
        .get(transaction.stopEventId) as
        | { readonly stop_fingerprint: unknown }
        | undefined;
      const stopRecord = {
        stopEventId: transaction.stopEventId,
        idempotencyKey: transaction.idempotencyKey,
        activationId: transaction.activationId,
        expectedActivationAggregateVersion:
          transaction.expectedActivationAggregateVersion,
        assessment,
        executedAtUtc: transaction.executedAtUtc,
      };
      const stopFingerprint = fingerprint(stopRecord);
      if (existing !== undefined) {
        if (existing.stop_fingerprint !== stopFingerprint) {
          throw error(
            CollectionRunnerRecoveryControlRepositoryErrorCode.IdentityConflict,
            "Emergency Stop identity already has different evidence.",
          );
        }
        const receipt = this.#receiptByStopEvent(transaction.stopEventId);
        if (receipt === null) {
          throw error(
            CollectionRunnerRecoveryControlRepositoryErrorCode.IdentityConflict,
            "Emergency Stop exists without its atomic receipt.",
          );
        }
        return receipt;
      }
      const pilot = this.#requirePilot(transaction.activationId);
      if (
        pilot.aggregate_version !==
          transaction.expectedActivationAggregateVersion ||
        assessment.activationState !== pilot.current_state
      ) {
        throw error(
          CollectionRunnerRecoveryControlRepositoryErrorCode.VersionConflict,
          "Emergency Stop does not bind the current Pilot state and version.",
        );
      }
      if (pilot.current_state !== CollectionRunnerPilotState.Active) {
        throw error(
          CollectionRunnerRecoveryControlRepositoryErrorCode.InvalidState,
          "A new Emergency Stop transaction requires an ACTIVE Pilot.",
        );
      }
      this.database
        .prepare(`
INSERT INTO emergency_stop_events (
  stop_event_id, stop_fingerprint, idempotency_key, activation_id,
  expected_activation_aggregate_version, directive, trigger_codes_json,
  evaluated_at_utc, executed_at_utc, canonical_record_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
        .run(
          transaction.stopEventId,
          stopFingerprint,
          transaction.idempotencyKey,
          transaction.activationId,
          transaction.expectedActivationAggregateVersion,
          assessment.directive,
          canonicalize([...assessment.triggers].sort()),
          assessment.evaluatedAtUtc,
          transaction.executedAtUtc,
          canonicalize({ ...stopRecord, fingerprint: stopFingerprint }),
        );
      const target =
        assessment.directive === CollectionRunnerEmergencyStopDirective.FailClosed
          ? CollectionRunnerPilotState.FailedClosed
          : CollectionRunnerPilotState.StopRequested;
      const nextVersion = pilot.aggregate_version + 1;
      this.#transitionPilot(
        pilot,
        target,
        nextVersion,
        transaction.executedAtUtc,
        assessment.directive === CollectionRunnerEmergencyStopDirective.FailClosed
          ? "EMERGENCY_FAIL_CLOSED"
          : "EMERGENCY_STOP_REQUESTED",
      );
      this.#invalidateControlAuthority(
        transaction.activationId,
        transaction.executedAtUtc,
        "EMERGENCY_STOP",
      );
      return this.#appendReceipt({
        decisionId: null,
        stopEventId: transaction.stopEventId,
        assessmentId: null,
        activationId: transaction.activationId,
        action:
          assessment.directive === CollectionRunnerEmergencyStopDirective.FailClosed
            ? "EMERGENCY_FAIL_CLOSED"
            : "EMERGENCY_STOP_REQUESTED",
        fromState: pilot.current_state,
        toState: target,
        fromAggregateVersion: pilot.aggregate_version,
        toAggregateVersion: nextVersion,
        sessionAuthorizationId: null,
        executedAtUtc: transaction.executedAtUtc,
      });
    });
  }

  public getRecoveryAssessment(
    assessmentId: string,
  ): CollectionRunnerRecoveryAssessment | null {
    identifier(assessmentId, "assessmentId");
    const row = this.#assessmentRow(assessmentId);
    return row === undefined ? null : this.#decodeAssessment(row);
  }

  public validateRecoverySessionGate(
    input: ValidateRecoverySessionGateInput,
  ): CollectionRunnerRecoverySessionAuthorization {
    exactKeys(input, SESSION_GATE_KEYS, "session gate");
    identifier(input.sessionAuthorizationId, "sessionAuthorizationId");
    fingerprintValue(
      input.authorizationFingerprint,
      "authorizationFingerprint",
    );
    identifier(input.activationId, "activationId");
    identifier(input.bootIdentity, "bootIdentity");
    identifier(input.processSessionId, "processSessionId");
    const observedAt = utc(input.observedAtUtc, "observedAtUtc");
    if (input.taskId !== null) identifier(input.taskId, "taskId");
    const row = this.database
      .prepare(`
SELECT s.*
FROM recovery_session_authorizations s
JOIN owner_recovery_decisions d ON d.decision_id = s.decision_id
JOIN recovery_assessments a ON a.assessment_id = s.assessment_id
JOIN pilot_activations p ON p.activation_id = s.activation_id
WHERE s.session_authorization_id = ?
  AND s.authorization_fingerprint = ?
  AND s.activation_id = ?
  AND s.boot_identity = ?
  AND s.process_session_id = ?
  AND s.revoked_at_utc IS NULL
  AND s.authorized_at_utc <= ?
  AND s.expires_at_utc > ?
  AND d.action = 'APPROVE_RESUME'
  AND d.consumed_at_utc IS NOT NULL
  AND d.invalidated_at_utc IS NULL
  AND a.store_id = ?
  AND a.store_path_identity = ?
  AND a.schema_catalog_checksum = ?
  AND a.recovery_report_fingerprint = ?
  AND p.current_state = 'ACTIVE'
  AND p.aggregate_version = s.expected_activation_aggregate_version
  AND NOT EXISTS (
    SELECT 1 FROM emergency_stop_events e
    WHERE e.activation_id = s.activation_id
      AND e.evaluated_at_utc >= s.authorized_at_utc
  )
  AND (
    ? IS NULL OR EXISTS (
      SELECT 1 FROM scheduled_tasks t
      WHERE t.task_id = ? AND t.activation_id = s.activation_id
    )
  )
`)
      .get(
        input.sessionAuthorizationId,
        input.authorizationFingerprint,
        input.activationId,
        input.bootIdentity,
        input.processSessionId,
        input.observedAtUtc,
        input.observedAtUtc,
        this.context.storeId,
        this.context.storePathIdentity,
        this.context.schemaCatalogChecksum,
        this.context.recoveryReportFingerprint,
        input.taskId,
        input.taskId,
      );
    if (row === undefined) {
      throw error(
        CollectionRunnerRecoveryControlRepositoryErrorCode.AuthorityMismatch,
        "Recovery session gate is absent, expired, revoked, stopped, stale, or bound to different work.",
      );
    }
    const authorization = this.#sessionFromRow(row);
    if (
      authorization.authorizationFingerprint !==
        input.authorizationFingerprint ||
      observedAt < utc(authorization.authorizedAtUtc, "authorizedAtUtc")
    ) {
      throw error(
        CollectionRunnerRecoveryControlRepositoryErrorCode.AuthorityMismatch,
        "Recovery session authorization is not valid at the observation time.",
      );
    }
    return authorization;
  }

  public getOwnerRecoveryDecision(
    decisionId: string,
  ): CollectionRunnerOwnerRecoveryDecision | null {
    identifier(decisionId, "decisionId");
    const row = this.#decisionRow(decisionId);
    return row === undefined ? null : this.#decodeDecision(row);
  }

  public getSessionAuthorization(
    processSessionId: string,
  ): CollectionRunnerRecoverySessionAuthorization | null {
    identifier(processSessionId, "processSessionId");
    const row = this.database
      .prepare(
        "SELECT * FROM recovery_session_authorizations WHERE process_session_id = ?",
      )
      .get(processSessionId);
    return row === undefined ? null : this.#sessionFromRow(row);
  }

  public getControlExecutionReceipt(
    receiptId: string,
  ): CollectionRunnerControlExecutionReceipt | null {
    identifier(receiptId, "receiptId");
    const row = this.database
      .prepare(
        "SELECT canonical_record_json FROM control_execution_receipts WHERE receipt_id = ?",
      )
      .get(receiptId) as { readonly canonical_record_json?: unknown } | undefined;
    return row === undefined ? null : this.#decodeReceipt(row.canonical_record_json);
  }

  #executeDecision(
    executedAtUtc: string,
    decision: CollectionRunnerOwnerRecoveryDecision,
    pilot: PilotRow,
  ): CollectionRunnerControlExecutionReceipt {
    let target = pilot.current_state;
    let nextVersion = pilot.aggregate_version;
    let session: CollectionRunnerRecoverySessionAuthorization | null = null;
    switch (decision.action) {
      case CollectionRunnerOwnerDecisionAction.ApproveResume:
        if (
          decision.assessment.disposition !==
            CollectionRunnerRecoveryDisposition.ResumeEligible ||
          pilot.current_state !== CollectionRunnerPilotState.Active ||
          utc(executedAtUtc, "executedAtUtc") >=
            utc(pilot.stops_at_utc, "pilot.stopsAtUtc") ||
          this.#openLeaseCount(pilot.activation_id) !== 0 ||
          this.#unresolvedAttemptCount(pilot.activation_id) !== 0
        ) {
          throw error(
            CollectionRunnerRecoveryControlRepositoryErrorCode.ReconciliationRequired,
            "Resume preconditions no longer match an eligible clean Pilot.",
          );
        }
        session = this.#insertSessionAuthorization(decision, executedAtUtc);
        break;
      case CollectionRunnerOwnerDecisionAction.CompleteStop:
        if (
          pilot.current_state !== CollectionRunnerPilotState.StopRequested ||
          this.#openLeaseCount(pilot.activation_id) !== 0 ||
          this.#unresolvedAttemptCount(pilot.activation_id) !== 0
        ) {
          throw error(
            CollectionRunnerRecoveryControlRepositoryErrorCode.ReconciliationRequired,
            "Stop completion requires STOP_REQUESTED with no open work.",
          );
        }
        target = CollectionRunnerPilotState.Stopped;
        nextVersion += 1;
        this.#transitionPilot(
          pilot,
          target,
          nextVersion,
          executedAtUtc,
          decision.reasonCode,
        );
        this.#invalidateControlAuthority(
          pilot.activation_id,
          executedAtUtc,
          "STOP_COMPLETED",
          decision.decisionId,
        );
        break;
      case CollectionRunnerOwnerDecisionAction.Revoke:
        if (
          ![
            CollectionRunnerPilotState.Active,
            CollectionRunnerPilotState.StopRequested,
          ].includes(pilot.current_state)
        ) {
          throw error(
            CollectionRunnerRecoveryControlRepositoryErrorCode.InvalidState,
            "Only an operational Pilot can be revoked by recovery control.",
          );
        }
        target = CollectionRunnerPilotState.Revoked;
        nextVersion += 1;
        this.#transitionPilot(
          pilot,
          target,
          nextVersion,
          executedAtUtc,
          decision.reasonCode,
        );
        this.#invalidateControlAuthority(
          pilot.activation_id,
          executedAtUtc,
          "ACTIVATION_REVOKED",
          decision.decisionId,
        );
        break;
      case CollectionRunnerOwnerDecisionAction.FailClosed:
        if (
          ![
            CollectionRunnerPilotState.Active,
            CollectionRunnerPilotState.StopRequested,
          ].includes(pilot.current_state)
        ) {
          throw error(
            CollectionRunnerRecoveryControlRepositoryErrorCode.InvalidState,
            "Only an operational Pilot can fail closed.",
          );
        }
        target = CollectionRunnerPilotState.FailedClosed;
        nextVersion += 1;
        this.#transitionPilot(
          pilot,
          target,
          nextVersion,
          executedAtUtc,
          decision.reasonCode,
        );
        this.#invalidateControlAuthority(
          pilot.activation_id,
          executedAtUtc,
          "FAILED_CLOSED",
          decision.decisionId,
        );
        break;
      case CollectionRunnerOwnerDecisionAction.RejectNoMutation:
        break;
    }
    const consumed = this.database
      .prepare(`
UPDATE owner_recovery_decisions
SET consumed_at_utc = ?
WHERE decision_id = ? AND consumed_at_utc IS NULL AND invalidated_at_utc IS NULL
`)
      .run(executedAtUtc, decision.decisionId);
    if (changes(consumed) !== 1) {
      throw error(
        CollectionRunnerRecoveryControlRepositoryErrorCode.DecisionConsumed,
        "Owner recovery decision could not be consumed exactly once.",
      );
    }
    return this.#appendReceipt({
      decisionId: decision.decisionId,
      stopEventId: null,
      assessmentId: decision.assessment.assessmentId,
      activationId: pilot.activation_id,
      action: decision.action,
      fromState: pilot.current_state,
      toState: target,
      fromAggregateVersion: pilot.aggregate_version,
      toAggregateVersion: nextVersion,
      sessionAuthorizationId: session?.sessionAuthorizationId ?? null,
      executedAtUtc,
    });
  }

  #insertSessionAuthorization(
    decision: CollectionRunnerOwnerRecoveryDecision,
    authorizedAtUtc: string,
  ): CollectionRunnerRecoverySessionAuthorization {
    const activation = decision.assessment.activation;
    if (activation === null) {
      throw error(
        CollectionRunnerRecoveryControlRepositoryErrorCode.InvalidState,
        "Resume decision has no activation.",
      );
    }
    const base = {
      sessionAuthorizationId: `session-auth:${decision.decisionId}`,
      decisionId: decision.decisionId,
      assessmentId: decision.assessment.assessmentId,
      activationId: activation.activationId,
      expectedActivationAggregateVersion:
        decision.expectedActivationAggregateVersion as number,
      bootIdentity: decision.proposedBootIdentity,
      processSessionId: decision.proposedProcessSessionId,
      authorizedAtUtc,
      expiresAtUtc: decision.expiresAtUtc,
      revokedAtUtc: null,
      revocationReasonCode: null,
    };
    const authorization = freeze({
      ...base,
      authorizationFingerprint: fingerprint(base),
    });
    this.database
      .prepare(`
INSERT INTO recovery_session_authorizations (
  session_authorization_id, authorization_fingerprint, decision_id,
  assessment_id, activation_id, expected_activation_aggregate_version,
  boot_identity, process_session_id, authorized_at_utc, expires_at_utc
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
      .run(
        authorization.sessionAuthorizationId,
        authorization.authorizationFingerprint,
        authorization.decisionId,
        authorization.assessmentId,
        authorization.activationId,
        authorization.expectedActivationAggregateVersion,
        authorization.bootIdentity,
        authorization.processSessionId,
        authorization.authorizedAtUtc,
        authorization.expiresAtUtc,
      );
    return authorization;
  }

  #appendReceipt(
    value: Omit<CollectionRunnerControlExecutionReceipt, "receiptId" | "fingerprint" | "outboxId">,
  ): CollectionRunnerControlExecutionReceipt {
    const identity = fingerprint(value);
    const receiptId = `receipt:${identity}`;
    const outboxId = `outbox:${fingerprint({
      receiptId,
      activationId: value.activationId,
      action: value.action,
      toAggregateVersion: value.toAggregateVersion,
    })}`;
    const base = { receiptId, ...value, outboxId };
    const receipt = freeze({ ...base, fingerprint: fingerprint(base) });
    const outboxEvent = {
      aggregateType: "RECOVERY_CONTROL",
      aggregateId: value.activationId,
      aggregateVersion: value.toAggregateVersion,
      eventType: value.action,
      createdAtUtc: value.executedAtUtc,
      payload: {
        receiptId,
        receiptFingerprint: receipt.fingerprint,
        decisionId: value.decisionId,
        stopEventId: value.stopEventId,
        sessionAuthorizationId: value.sessionAuthorizationId,
      },
    };
    const outboxFingerprint = fingerprint(outboxEvent);
    this.database
      .prepare(`
INSERT INTO transactional_outbox (
  outbox_id, aggregate_type, aggregate_id, aggregate_version,
  event_type, event_fingerprint, sanitized_event_json, created_at_utc
) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)
      .run(
        outboxId,
        outboxEvent.aggregateType,
        outboxEvent.aggregateId,
        outboxEvent.aggregateVersion,
        outboxEvent.eventType,
        outboxFingerprint,
        canonicalize(outboxEvent),
        outboxEvent.createdAtUtc,
      );
    this.database
      .prepare(`
INSERT INTO control_execution_receipts (
  receipt_id, receipt_fingerprint, decision_id, stop_event_id,
  assessment_id, activation_id, action, from_state, to_state,
  from_aggregate_version, to_aggregate_version, session_authorization_id,
  outbox_id, executed_at_utc, canonical_record_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
      .run(
        receipt.receiptId,
        receipt.fingerprint,
        receipt.decisionId,
        receipt.stopEventId,
        receipt.assessmentId,
        receipt.activationId,
        receipt.action,
        receipt.fromState,
        receipt.toState,
        receipt.fromAggregateVersion,
        receipt.toAggregateVersion,
        receipt.sessionAuthorizationId,
        receipt.outboxId,
        receipt.executedAtUtc,
        canonicalize(receipt),
      );
    return receipt;
  }

  #transitionPilot(
    pilot: PilotRow,
    target: CollectionRunnerPilotState,
    nextVersion: number,
    occurredAtUtc: string,
    reasonCode: string,
  ): void {
    const updated = this.database
      .prepare(`
UPDATE pilot_activations
SET current_state = ?, aggregate_version = ?
WHERE activation_id = ? AND current_state = ? AND aggregate_version = ?
`)
      .run(
        target,
        nextVersion,
        pilot.activation_id,
        pilot.current_state,
        pilot.aggregate_version,
      );
    if (changes(updated) !== 1) {
      throw error(
        CollectionRunnerRecoveryControlRepositoryErrorCode.VersionConflict,
        "Pilot compare-and-swap transition failed.",
      );
    }
    const transition = {
      activationId: pilot.activation_id,
      fromState: pilot.current_state,
      toState: target,
      fromVersion: pilot.aggregate_version,
      toVersion: nextVersion,
      occurredAtUtc,
      reasonCode,
    };
    this.database
      .prepare(`
INSERT INTO pilot_transitions (
  activation_id, from_state, to_state, from_aggregate_version,
  to_aggregate_version, occurred_at_utc, reason_code,
  transition_fingerprint
) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)
      .run(
        pilot.activation_id,
        pilot.current_state,
        target,
        pilot.aggregate_version,
        nextVersion,
        occurredAtUtc,
        reasonCode,
        fingerprint(transition),
      );
  }

  #invalidateControlAuthority(
    activationId: string,
    invalidatedAtUtc: string,
    reasonCode: string,
    excludingDecisionId?: string,
  ): void {
    this.database
      .prepare(`
UPDATE owner_recovery_decisions
SET invalidated_at_utc = ?, invalidation_reason_code = ?
WHERE activation_id = ?
  AND consumed_at_utc IS NULL
  AND invalidated_at_utc IS NULL
  AND decision_id != ?
`)
      .run(
        invalidatedAtUtc,
        reasonCode,
        activationId,
        excludingDecisionId ?? "",
      );
    const activeSessions = this.database
      .prepare(`
SELECT *
FROM recovery_session_authorizations
WHERE activation_id = ? AND revoked_at_utc IS NULL
ORDER BY session_authorization_id
`)
      .all(activationId) as readonly Row[];
    const revoke = this.database.prepare(`
UPDATE recovery_session_authorizations
SET authorization_fingerprint = ?,
    revoked_at_utc = ?,
    revocation_reason_code = ?
WHERE session_authorization_id = ?
  AND authorization_fingerprint = ?
  AND revoked_at_utc IS NULL
`);
    for (const row of activeSessions) {
      const current = this.#sessionFromRow(row);
      const revokedBase = {
        sessionAuthorizationId: current.sessionAuthorizationId,
        decisionId: current.decisionId,
        assessmentId: current.assessmentId,
        activationId: current.activationId,
        expectedActivationAggregateVersion:
          current.expectedActivationAggregateVersion,
        bootIdentity: current.bootIdentity,
        processSessionId: current.processSessionId,
        authorizedAtUtc: current.authorizedAtUtc,
        expiresAtUtc: current.expiresAtUtc,
        revokedAtUtc: invalidatedAtUtc,
        revocationReasonCode: reasonCode,
      };
      const result = revoke.run(
        fingerprint(revokedBase),
        invalidatedAtUtc,
        reasonCode,
        current.sessionAuthorizationId,
        current.authorizationFingerprint,
      );
      if (result.changes !== 1) {
        throw error(
          CollectionRunnerRecoveryControlRepositoryErrorCode.VersionConflict,
          "Recovery session authorization changed during revocation.",
        );
      }
    }
  }

  #assertCurrentContext(
    value: ExecuteOwnerRecoveryDecisionTransaction,
  ): void {
    if (
      value.currentRecoveryReportFingerprint !==
        this.context.recoveryReportFingerprint ||
      value.currentStorePathIdentity !== this.context.storePathIdentity ||
      value.currentSchemaCatalogChecksum !== this.context.schemaCatalogChecksum
    ) {
      throw error(
        CollectionRunnerRecoveryControlRepositoryErrorCode.RecoveryContextMismatch,
        "Recovery report, store path, or schema identity changed.",
      );
    }
  }

  #assertAssessmentContext(
    assessment: CollectionRunnerRecoveryAssessment,
  ): void {
    if (
      assessment.storeId !== this.context.storeId ||
      assessment.storePathIdentity !== this.context.storePathIdentity ||
      assessment.schemaCatalogChecksum !== this.context.schemaCatalogChecksum ||
      assessment.recoveryReportFingerprint !==
        this.context.recoveryReportFingerprint ||
      assessment.inspectedAtUtc !== this.context.recoveryInspectedAtUtc
    ) {
      throw error(
        CollectionRunnerRecoveryControlRepositoryErrorCode.RecoveryContextMismatch,
        "Assessment does not bind the exact open-store recovery context.",
      );
    }
  }

  #assertAssessmentDurableState(
    assessment: CollectionRunnerRecoveryAssessment,
  ): void {
    if (assessment.activation === null) {
      const row = this.database
        .prepare(`
SELECT count(*) AS count FROM pilot_activations
WHERE current_state IN ('ACTIVE','STOP_REQUESTED')
`)
        .get() as { readonly count?: unknown } | undefined;
      if (row?.count !== 0) {
        throw error(
          CollectionRunnerRecoveryControlRepositoryErrorCode.VersionConflict,
          "Assessment omitted an operational Pilot.",
        );
      }
      return;
    }
    const pilot = this.#requirePilot(assessment.activation.activationId);
    if (
      pilot.owner_id !== assessment.activation.ownerId ||
      pilot.current_state !== assessment.activation.state ||
      pilot.aggregate_version !== assessment.activation.aggregateVersion ||
      pilot.activation_fingerprint !== assessment.activation.fingerprint ||
      pilot.starts_at_utc !== assessment.activation.startsAtUtc ||
      pilot.stops_at_utc !== assessment.activation.stopsAtUtc ||
      this.#openLeaseCount(pilot.activation_id) !== assessment.openLeaseCount ||
      this.#unresolvedAttemptCount(pilot.activation_id) !==
        assessment.unresolvedAttemptCount
    ) {
      throw error(
        CollectionRunnerRecoveryControlRepositoryErrorCode.VersionConflict,
        "Assessment no longer matches durable Pilot, lease, or attempt state.",
      );
    }
  }

  #openLeaseCount(activationId: string): number {
    const row = this.database
      .prepare(`
SELECT count(*) AS count
FROM task_leases l
JOIN scheduled_tasks t ON t.task_id = l.task_id
WHERE t.activation_id = ?
`)
      .get(activationId) as { readonly count?: unknown } | undefined;
    return typeof row?.count === "number" ? row.count : 0;
  }

  #unresolvedAttemptCount(activationId: string): number {
    const row = this.database
      .prepare(`
SELECT count(*) AS count
FROM attempt_records a
JOIN scheduled_tasks t ON t.task_id = a.task_id
LEFT JOIN attempt_results r ON r.attempt_id = a.attempt_id
WHERE t.activation_id = ? AND r.attempt_id IS NULL
`)
      .get(activationId) as { readonly count?: unknown } | undefined;
    return typeof row?.count === "number" ? row.count : 0;
  }

  #hasEmergencyStopAtOrAfter(
    activationId: string,
    decidedAtUtc: string,
  ): boolean {
    return (
      this.database
        .prepare(`
SELECT 1 AS found FROM emergency_stop_events
WHERE activation_id = ? AND evaluated_at_utc >= ?
LIMIT 1
`)
        .get(activationId, decidedAtUtc) !== undefined
    );
  }

  #assessmentRow(id: string): AssessmentRow | undefined {
    return this.database
      .prepare("SELECT * FROM recovery_assessments WHERE assessment_id = ?")
      .get(id) as unknown as AssessmentRow | undefined;
  }

  #requireAssessment(id: string): AssessmentRow {
    const row = this.#assessmentRow(id);
    if (row === undefined) {
      throw error(
        CollectionRunnerRecoveryControlRepositoryErrorCode.NotFound,
        "Recovery assessment was not found.",
      );
    }
    return row;
  }

  #decisionRow(id: string): DecisionRow | undefined {
    return this.database
      .prepare("SELECT * FROM owner_recovery_decisions WHERE decision_id = ?")
      .get(id) as unknown as DecisionRow | undefined;
  }

  #requireDecision(id: string): DecisionRow {
    const row = this.#decisionRow(id);
    if (row === undefined) {
      throw error(
        CollectionRunnerRecoveryControlRepositoryErrorCode.NotFound,
        "Owner recovery decision was not found.",
      );
    }
    return row;
  }

  #requirePilot(id: string): PilotRow {
    const row = this.database
      .prepare(`
SELECT activation_id, owner_id, activation_fingerprint, current_state,
       aggregate_version, starts_at_utc, stops_at_utc
FROM pilot_activations WHERE activation_id = ?
`)
      .get(id) as unknown as PilotRow | undefined;
    if (row === undefined) {
      throw error(
        CollectionRunnerRecoveryControlRepositoryErrorCode.NotFound,
        "Pilot activation was not found.",
      );
    }
    return row;
  }

  #decodeAssessment(row: AssessmentRow): CollectionRunnerRecoveryAssessment {
    const value = parseJson<CollectionRunnerRecoveryAssessment>(
      row.canonical_record_json,
      "recovery assessment",
    );
    try {
      return this.#engine.verifyRecoveryAssessment(value);
    } catch (cause) {
      throw error(
        CollectionRunnerRecoveryControlRepositoryErrorCode.IdentityConflict,
        "Stored recovery assessment failed deterministic verification.",
        cause,
      );
    }
  }

  #decodeDecision(row: DecisionRow): CollectionRunnerOwnerRecoveryDecision {
    const value = parseJson<CollectionRunnerOwnerRecoveryDecision>(
      row.canonical_record_json,
      "owner recovery decision",
    );
    try {
      return this.#engine.verifyOwnerRecoveryDecision(value);
    } catch (cause) {
      throw error(
        CollectionRunnerRecoveryControlRepositoryErrorCode.IdentityConflict,
        "Stored owner recovery decision failed deterministic verification.",
        cause,
      );
    }
  }

  #sessionFromRow(row: Row): CollectionRunnerRecoverySessionAuthorization {
    const base = {
      sessionAuthorizationId: String(row.session_authorization_id),
      decisionId: String(row.decision_id),
      assessmentId: String(row.assessment_id),
      activationId: String(row.activation_id),
      expectedActivationAggregateVersion: Number(
        row.expected_activation_aggregate_version,
      ),
      bootIdentity: String(row.boot_identity),
      processSessionId: String(row.process_session_id),
      authorizedAtUtc: String(row.authorized_at_utc),
      expiresAtUtc: String(row.expires_at_utc),
      revokedAtUtc:
        row.revoked_at_utc === null ? null : String(row.revoked_at_utc),
      revocationReasonCode:
        row.revocation_reason_code === null
          ? null
          : String(row.revocation_reason_code),
    };
    const value = freeze({
      ...base,
      authorizationFingerprint: String(row.authorization_fingerprint),
    });
    if (value.authorizationFingerprint !== fingerprint(base)) {
      throw error(
        CollectionRunnerRecoveryControlRepositoryErrorCode.IdentityConflict,
        "Stored session authorization fingerprint is invalid.",
      );
    }
    return value;
  }

  #receiptByDecision(
    decisionId: string,
  ): CollectionRunnerControlExecutionReceipt | null {
    const row = this.database
      .prepare(`
SELECT canonical_record_json FROM control_execution_receipts
WHERE decision_id = ?
`)
      .get(decisionId) as { readonly canonical_record_json?: unknown } | undefined;
    return row === undefined ? null : this.#decodeReceipt(row.canonical_record_json);
  }

  #receiptByStopEvent(
    stopEventId: string,
  ): CollectionRunnerControlExecutionReceipt | null {
    const row = this.database
      .prepare(`
SELECT canonical_record_json FROM control_execution_receipts
WHERE stop_event_id = ?
`)
      .get(stopEventId) as
      | { readonly canonical_record_json?: unknown }
      | undefined;
    return row === undefined ? null : this.#decodeReceipt(row.canonical_record_json);
  }

  #decodeReceipt(value: unknown): CollectionRunnerControlExecutionReceipt {
    const receipt = parseJson<CollectionRunnerControlExecutionReceipt>(
      value,
      "control execution receipt",
    );
    const unsigned = { ...receipt } as Record<string, unknown>;
    delete unsigned.fingerprint;
    if (receipt.fingerprint !== fingerprint(unsigned)) {
      throw error(
        CollectionRunnerRecoveryControlRepositoryErrorCode.IdentityConflict,
        "Stored control receipt fingerprint is invalid.",
      );
    }
    return freeze(receipt);
  }

  #transaction<T>(run: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const value = run();
      this.database.exec("COMMIT");
      return value;
    } catch (cause) {
      try {
        this.database.exec("ROLLBACK");
      } catch {
        // Preserve the original failure.
      }
      if (cause instanceof CollectionRunnerRecoveryControlRepositoryError) {
        throw cause;
      }
      throw error(
        CollectionRunnerRecoveryControlRepositoryErrorCode.TransactionFailed,
        "Recovery-control transaction failed and was rolled back.",
        cause,
      );
    }
  }
}

export function createSqliteEventContractCollectionRunnerRecoveryControlRepository(
  database: DatabaseSync,
  context: CollectionRunnerRecoveryControlStoreContext,
): EventContractCollectionRunnerRecoveryControlRepository {
  return new SqliteEventContractCollectionRunnerRecoveryControlRepository(
    database,
    context,
  );
}
