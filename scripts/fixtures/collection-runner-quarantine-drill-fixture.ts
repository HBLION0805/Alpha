import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import {
  CollectionRunnerPilotState,
  CollectionRunnerRuntimeMode,
  CollectionRunnerRuntimeOwnershipLiveness,
  CollectionRunnerRuntimeOwnershipRecoveryAction,
  EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_OWNERSHIP_RECOVERY_SCHEMA_VERSION,
  EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION,
  type CollectionRunnerBootIdentityPort,
  type CollectionRunnerLocalOwnerAuthorizationEvidence,
  type CollectionRunnerProcessNoncePort,
  type CollectionRunnerRuntimeOwnershipRecoveryAssessment,
  type CollectionRunnerRuntimeOwnershipRecoveryDecision,
  type CollectionRunnerWallClock,
} from "../../src/contracts";
import type {
  CollectionRunnerLocalOwnerVerifier,
  VerifyCollectionRunnerLocalOwnerInput,
} from "../../src/engines/event-contract-collection-runner-recovery-control/EventContractCollectionRunnerRecoveryControlOperator";
import {
  acquireCollectionRunnerRuntimeOwnership,
  createCollectionRunnerRuntimeConfiguration,
  resolveCollectionRunnerRuntimePaths,
} from "../../src/engines/event-contract-collection-runner-runtime/EventContractCollectionRunnerRuntimeFoundation";
import {
  authorizeCollectionRunnerRuntimeOwnershipRecovery,
  executeCollectionRunnerRuntimeOwnershipQuarantine,
  inspectCollectionRunnerRuntimeOwnershipRecovery,
} from "../../src/engines/event-contract-collection-runner-runtime/EventContractCollectionRunnerRuntimeOwnershipQuarantine";

const SHA_A =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SHA_C =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const NOW = "2026-07-25T16:00:00.000Z";
const EXPIRES = "2026-07-25T16:04:00.000Z";

class DrillOwnerVerifier implements CollectionRunnerLocalOwnerVerifier {
  public verify(
    input: VerifyCollectionRunnerLocalOwnerInput,
  ): CollectionRunnerLocalOwnerAuthorizationEvidence {
    return Object.freeze({
      authorityKind: "LOCAL_OWNER_VERIFIED" as const,
      ownerId: input.ownerId,
      verifierId: "verifier:transaction-drill",
      verifierVersion: "1.0",
      authorizationReference: SHA_B,
      challengeFingerprint: input.challengeFingerprint,
      verifiedAtUtc: input.verifiedAtUtc,
      expiresAtUtc: input.expiresAtUtc,
    });
  }
}

function configuration(root: string) {
  const runtimeControlRoot = join(root, "control");
  const sqliteRoot = join(root, "sqlite");
  if (!existsSync(runtimeControlRoot)) mkdirSync(runtimeControlRoot);
  if (!existsSync(sqliteRoot)) mkdirSync(sqliteRoot);
  return createCollectionRunnerRuntimeConfiguration({
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION,
    runtimeId: "runtime:quarantine-transaction-drill",
    runtimeMode: CollectionRunnerRuntimeMode.FixtureOnly,
    runtimeControlRoot,
    sqliteRoot,
    storeId: "collection-runner",
    activationId: "activation:quarantine-transaction-drill",
    applicationBuildFingerprint: SHA_A,
    runnerDefinitionFingerprint: SHA_B,
    frozenPlanFingerprint: SHA_C,
    fixtureProviderFingerprint: SHA_A,
    maximumClockOffsetMilliseconds: 1_000,
    maximumClockHealthAgeMilliseconds: 5_000,
  });
}

function bootIdentityPort(): CollectionRunnerBootIdentityPort {
  return {
    readBootIdentity: () => ({
      bootIdentity: "boot:transaction-drill",
      source: "TRANSACTION_DRILL",
      sourceVersion: "1.0",
    }),
  };
}

function inspectionOptions(root: string) {
  const runtimeConfiguration = configuration(root);
  const paths = resolveCollectionRunnerRuntimePaths(runtimeConfiguration);
  return {
    runtimeConfiguration,
    paths,
    inspection: {
      configuration: runtimeConfiguration,
      paths,
      bootIdentityPort: bootIdentityPort(),
      processLivenessPort: {
        observe: () => CollectionRunnerRuntimeOwnershipLiveness.NotLive,
      },
      storeEvidence: {
        storePathIdentity: paths.storePathIdentity,
        recoveryReportFingerprint: SHA_C,
        storeIdentityVerified: true,
        integrityVerified: true,
        pilotState: CollectionRunnerPilotState.Active,
        openLeaseCount: 0,
        openAttemptCount: 0,
        durableEmergencyStopObserved: false,
      },
      inspectedAtUtc: NOW,
      expiresAtUtc: EXPIRES,
      policyVersion: "1.0",
    } as const,
  };
}

export interface QuarantineTransactionDrillCheckpoint {
  readonly assessment: CollectionRunnerRuntimeOwnershipRecoveryAssessment;
  readonly decision: CollectionRunnerRuntimeOwnershipRecoveryDecision;
  readonly receiptFingerprint: string;
  readonly lockDirectory: string;
}

export function executeQuarantineTransactionDrill(
  root: string,
): QuarantineTransactionDrillCheckpoint {
  const initial = inspectionOptions(root);
  const noncePort: CollectionRunnerProcessNoncePort = {
    createNonce: () => SHA_A,
  };
  const wallClock: CollectionRunnerWallClock = {
    nowUtc: () => "2026-07-25T15:55:00.000Z",
  };
  acquireCollectionRunnerRuntimeOwnership({
    configuration: initial.runtimeConfiguration,
    paths: initial.paths,
    bootIdentityPort: bootIdentityPort(),
    processNoncePort: noncePort,
    processId: 12_345,
    wallClock,
  });
  const assessment = inspectCollectionRunnerRuntimeOwnershipRecovery(
    initial.inspection,
  );
  const command = {
    schemaVersion:
      EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_OWNERSHIP_RECOVERY_SCHEMA_VERSION,
    commandId: "command:quarantine-transaction-drill",
    ownerId: "owner:transaction-drill",
    expectedAssessmentFingerprint: assessment.fingerprint,
    action:
      CollectionRunnerRuntimeOwnershipRecoveryAction.QuarantineStaleOwnership,
    reasonCode: "OWNER_CONFIRMED_STALE",
    decidedAtUtc: NOW,
    expiresAtUtc: EXPIRES,
  } as const;
  const decision = authorizeCollectionRunnerRuntimeOwnershipRecovery({
    assessment,
    command,
    secret: "transaction-drill-owner-secret",
    verifier: new DrillOwnerVerifier(),
  });
  const receipt = executeCollectionRunnerRuntimeOwnershipQuarantine({
    configuration: initial.runtimeConfiguration,
    paths: initial.paths,
    assessment,
    decision,
    executedAtUtc: NOW,
    reinspect: () =>
      inspectCollectionRunnerRuntimeOwnershipRecovery(initial.inspection),
  });
  return {
    assessment,
    decision,
    receiptFingerprint: receipt.fingerprint,
    lockDirectory: initial.paths.lockDirectory,
  };
}

export function replayQuarantineTransactionDrill(
  root: string,
  checkpoint: QuarantineTransactionDrillCheckpoint,
) {
  const replay = inspectionOptions(root);
  return executeCollectionRunnerRuntimeOwnershipQuarantine({
    configuration: replay.runtimeConfiguration,
    paths: replay.paths,
    assessment: checkpoint.assessment,
    decision: checkpoint.decision,
    executedAtUtc: NOW,
    reinspect: () => checkpoint.assessment,
  });
}
