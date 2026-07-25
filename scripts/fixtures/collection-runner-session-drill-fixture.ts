import { createHash } from "node:crypto";
import { resolve } from "node:path";

import {
  COLLECTION_RUNNER_RECOVERY_CONTROL_SCHEMA_VERSION,
  CollectionRunnerClockHealth,
  CollectionRunnerOwnerDecisionAction,
  CollectionRunnerPilotState,
} from "../../src/contracts";
import { EventContractCollectionRunnerRecoveryControlEngine } from "../../src/engines/event-contract-collection-runner-recovery-control";
import type { CollectionRunnerRecoverySessionAuthorization } from "../../src/repositories/EventContractCollectionRunnerRecoveryControlRepository";
import {
  createCollectionRunnerTransactionDrillFixture,
  type CollectionRunnerTransactionDrillFixture,
} from "./collection-runner-transaction-drill-fixture";

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

export interface AuthenticatedSessionTransactionDrillCheckpoint {
  readonly storePath: string;
  readonly session: CollectionRunnerRecoverySessionAuthorization;
}

export function createAuthenticatedSessionTransactionDrill(
  root: string,
): {
  readonly fixture: CollectionRunnerTransactionDrillFixture;
  readonly checkpoint: AuthenticatedSessionTransactionDrillCheckpoint;
} {
  const fixture = createCollectionRunnerTransactionDrillFixture(root);
  const store = fixture.store;
  const readiness = store.getReadiness();
  const recovery = store.getStartupRecoveryReport();
  const engine = new EventContractCollectionRunnerRecoveryControlEngine();
  const assessment = engine.createRecoveryAssessment({
    schemaVersion: COLLECTION_RUNNER_RECOVERY_CONTROL_SCHEMA_VERSION,
    assessmentId: "assessment:session-transaction-drill",
    policyVersion: "1.0",
    storeId: "collection-runner",
    storePathIdentity: sha256(resolve(store.getStorePath())),
    schemaCatalogChecksum: readiness.schemaCatalogChecksum,
    recoveryReportFingerprint: recovery.fingerprint,
    inspectedAtUtc: recovery.inspectedAtUtc,
    activation: {
      activationId: fixture.activation.activationId,
      ownerId: fixture.activation.ownerId,
      state: CollectionRunnerPilotState.Active,
      aggregateVersion: 2,
      fingerprint: fixture.activation.fingerprint,
      startsAtUtc: fixture.activation.startsAt,
      stopsAtUtc: fixture.activation.stopsAt,
    },
    priorBootIdentity: null,
    proposedBootIdentity: "boot:session-transaction-drill",
    proposedProcessSessionId: "process:session-transaction-drill",
    clockHealth: CollectionRunnerClockHealth.Healthy,
    absoluteClockOffsetMilliseconds: 0,
    maximumClockOffsetMilliseconds: 1_000,
    openLeaseCount: 0,
    unresolvedAttemptCount: 0,
    integrityBlockerCodes: [],
    restoredStorePendingSwitch: false,
    assessedAtUtc: "2026-07-25T13:00:01.000Z",
    expiresAtUtc: "2026-07-25T13:10:00.000Z",
  });
  const decision = engine.createOwnerRecoveryDecision({
    schemaVersion: COLLECTION_RUNNER_RECOVERY_CONTROL_SCHEMA_VERSION,
    decisionId: "decision:session-transaction-drill",
    assessment,
    expectedActivationAggregateVersion: 2,
    ownerAuthorization: {
      authorityKind: "LOCAL_OWNER_VERIFIED",
      ownerId: fixture.activation.ownerId,
      verifierId: "verifier:session-transaction-drill",
      verifierVersion: "1.0",
      authorizationReference: "authorization:session-transaction-drill",
      challengeFingerprint: fixture.activation.fingerprint,
      verifiedAtUtc: "2026-07-25T13:00:02.000Z",
      expiresAtUtc: "2026-07-25T13:09:00.000Z",
    },
    action: CollectionRunnerOwnerDecisionAction.ApproveResume,
    reasonCode: "OWNER_REVIEWED_RECOVERY",
    decidedAtUtc: "2026-07-25T13:00:03.000Z",
    expiresAtUtc: "2026-07-25T13:08:00.000Z",
    proposedBootIdentity: "boot:session-transaction-drill",
    proposedProcessSessionId: "process:session-transaction-drill",
    emergencyStopObserved: false,
  });
  const repository = store.createRecoveryControlRepository();
  repository.persistRecoveryAssessment({
    assessment,
    recordedAtUtc: "2026-07-25T13:00:01.000Z",
  });
  repository.persistOwnerRecoveryDecision({
    decision,
    recordedAtUtc: "2026-07-25T13:00:03.000Z",
  });
  repository.executeOwnerRecoveryDecision({
    decisionId: decision.decisionId,
    expectedDecisionFingerprint: decision.fingerprint,
    currentRecoveryReportFingerprint: recovery.fingerprint,
    currentStorePathIdentity: sha256(resolve(store.getStorePath())),
    currentSchemaCatalogChecksum: readiness.schemaCatalogChecksum,
    executedAtUtc: "2026-07-25T13:00:04.000Z",
  });
  const session = repository.getSessionAuthorization(
    "process:session-transaction-drill",
  );
  if (session === null) throw new Error("Resume session was not persisted.");
  return {
    fixture,
    checkpoint: {
      storePath: store.getStorePath(),
      session,
    },
  };
}
