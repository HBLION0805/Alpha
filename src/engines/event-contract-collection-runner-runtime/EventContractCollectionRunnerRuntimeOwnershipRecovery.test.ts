import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  CollectionRunnerPilotState,
  CollectionRunnerRuntimeFoundationErrorCode,
  CollectionRunnerRuntimeMode,
  CollectionRunnerRuntimeOwnershipLiveness,
  CollectionRunnerRuntimeOwnershipRecoveryAction,
  CollectionRunnerRuntimeOwnershipRecoveryDisposition,
  EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_OWNERSHIP_RECOVERY_SCHEMA_VERSION,
  EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION,
  type CollectionRunnerBootIdentity,
  type CollectionRunnerBootIdentityPort,
  type CollectionRunnerLocalOwnerAuthorizationEvidence,
  type CollectionRunnerProcessNoncePort,
  type CollectionRunnerRuntimeConfiguration,
  type CollectionRunnerRuntimeOwnershipRecoveryAssessment,
  type CollectionRunnerRuntimeOwnershipRecoveryCommand,
  type CollectionRunnerRuntimeOwnershipRecoveryStoreEvidence,
  type CollectionRunnerRuntimePaths,
  type CollectionRunnerWallClock,
} from "../../contracts";
import type {
  CollectionRunnerLocalOwnerVerifier,
  VerifyCollectionRunnerLocalOwnerInput,
} from "../event-contract-collection-runner-recovery-control/EventContractCollectionRunnerRecoveryControlOperator";
import {
  acquireCollectionRunnerRuntimeOwnership,
  createCollectionRunnerRuntimeConfiguration,
  EventContractCollectionRunnerRuntimeFoundationError,
  resolveCollectionRunnerRuntimePaths,
} from "./EventContractCollectionRunnerRuntimeFoundation";
import {
  authorizeCollectionRunnerRuntimeOwnershipRecovery,
  executeCollectionRunnerRuntimeOwnershipQuarantine,
  inspectCollectionRunnerRuntimeOwnershipRecovery,
  NodeCollectionRunnerRuntimeProcessLivenessObservationPort,
  type InspectCollectionRunnerRuntimeOwnershipRecoveryOptions,
} from "./EventContractCollectionRunnerRuntimeOwnershipQuarantine";
import {
  EventContractCollectionRunnerRuntimeOwnershipRecoveryEngine,
  fingerprintCollectionRunnerRuntimeOwnershipRecovery,
} from "./EventContractCollectionRunnerRuntimeOwnershipRecovery";

const SHA_A =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SHA_C =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const NOW = "2026-07-25T16:00:00.000Z";
const EXPIRES = "2026-07-25T16:04:00.000Z";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${String(expected)}, got ${String(actual)}.`,
    );
  }
}

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function expectError(
  run: () => unknown,
  code: CollectionRunnerRuntimeFoundationErrorCode,
  label: string,
): void {
  try {
    run();
  } catch (error) {
    if (
      error instanceof EventContractCollectionRunnerRuntimeFoundationError &&
      error.code === code
    ) {
      return;
    }
    throw error;
  }
  throw new Error(`${label}: expected ${code}.`);
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
    .join(",")}}`;
}

class FixedBootIdentityPort implements CollectionRunnerBootIdentityPort {
  public constructor(private readonly bootIdentity = "boot:current") {}

  public readBootIdentity(): CollectionRunnerBootIdentity {
    return {
      bootIdentity: this.bootIdentity,
      source: "TEST_BOOT",
      sourceVersion: "1.0",
    };
  }
}

class FixedNoncePort implements CollectionRunnerProcessNoncePort {
  public createNonce(): string {
    return SHA_A;
  }
}

class FixedWallClock implements CollectionRunnerWallClock {
  public nowUtc(): string {
    return "2026-07-25T15:55:00.000Z";
  }
}

class FakeOwnerVerifier implements CollectionRunnerLocalOwnerVerifier {
  public lastInput: VerifyCollectionRunnerLocalOwnerInput | null = null;

  public verify(
    input: VerifyCollectionRunnerLocalOwnerInput,
  ): CollectionRunnerLocalOwnerAuthorizationEvidence {
    this.lastInput = structuredClone(input);
    if (input.secret !== "correct-owner-secret") {
      throw new Error("Authentication failed.");
    }
    return Object.freeze({
      authorityKind: "LOCAL_OWNER_VERIFIED" as const,
      ownerId: input.ownerId,
      verifierId: "verifier:local",
      verifierVersion: "1.0",
      authorizationReference: SHA_B,
      challengeFingerprint: input.challengeFingerprint,
      verifiedAtUtc: input.verifiedAtUtc,
      expiresAtUtc: input.expiresAtUtc,
    });
  }
}

interface Fixture {
  readonly root: string;
  readonly configuration: CollectionRunnerRuntimeConfiguration;
  readonly paths: CollectionRunnerRuntimePaths;
  readonly options: InspectCollectionRunnerRuntimeOwnershipRecoveryOptions;
  readonly close: () => void;
}

function storeEvidence(
  paths: CollectionRunnerRuntimePaths,
  changes: Partial<CollectionRunnerRuntimeOwnershipRecoveryStoreEvidence> = {},
): CollectionRunnerRuntimeOwnershipRecoveryStoreEvidence {
  return {
    storePathIdentity: paths.storePathIdentity,
    recoveryReportFingerprint: SHA_C,
    storeIdentityVerified: true,
    integrityVerified: true,
    pilotState: CollectionRunnerPilotState.Active,
    openLeaseCount: 0,
    openAttemptCount: 0,
    durableEmergencyStopObserved: false,
    ...changes,
  };
}

function fixture(
  changes: {
    readonly recordedBoot?: string;
    readonly currentBoot?: string;
    readonly liveness?: CollectionRunnerRuntimeOwnershipLiveness;
    readonly store?: Partial<CollectionRunnerRuntimeOwnershipRecoveryStoreEvidence>;
  } = {},
): Fixture {
  const root = mkdtempSync(join(tmpdir(), "alpha-ownership-recovery-"));
  const controlRoot = resolve(root, "control");
  const sqliteRoot = resolve(root, "sqlite");
  mkdirSync(controlRoot);
  mkdirSync(sqliteRoot);
  const configuration = createCollectionRunnerRuntimeConfiguration({
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION,
    runtimeId: "runtime:ownership-recovery",
    runtimeMode: CollectionRunnerRuntimeMode.FixtureOnly,
    runtimeControlRoot: controlRoot,
    sqliteRoot,
    storeId: "runner-store",
    activationId: "activation:ownership-recovery",
    applicationBuildFingerprint: SHA_A,
    runnerDefinitionFingerprint: SHA_B,
    frozenPlanFingerprint: SHA_C,
    fixtureProviderFingerprint: SHA_A,
    maximumClockOffsetMilliseconds: 1_000,
    maximumClockHealthAgeMilliseconds: 5_000,
  });
  const paths = resolveCollectionRunnerRuntimePaths(configuration);
  acquireCollectionRunnerRuntimeOwnership({
    configuration,
    paths,
    bootIdentityPort: new FixedBootIdentityPort(
      changes.recordedBoot ?? "boot:current",
    ),
    processNoncePort: new FixedNoncePort(),
    processId: 12_345,
    wallClock: new FixedWallClock(),
  });
  const options: InspectCollectionRunnerRuntimeOwnershipRecoveryOptions = {
    configuration,
    paths,
    bootIdentityPort: new FixedBootIdentityPort(
      changes.currentBoot ?? "boot:current",
    ),
    processLivenessPort: {
      observe: () =>
        changes.liveness ??
        CollectionRunnerRuntimeOwnershipLiveness.NotLive,
    },
    storeEvidence: storeEvidence(paths, changes.store),
    inspectedAtUtc: NOW,
    expiresAtUtc: EXPIRES,
    policyVersion: "1.0",
  };
  return {
    root,
    configuration,
    paths,
    options,
    close: () => rmSync(root, { recursive: true, force: true }),
  };
}

function withFixture(
  run: (value: Fixture) => void,
  changes: Parameters<typeof fixture>[0] = {},
): void {
  const value = fixture(changes);
  try {
    run(value);
  } finally {
    value.close();
  }
}

function command(
  assessment: CollectionRunnerRuntimeOwnershipRecoveryAssessment,
  changes: Partial<CollectionRunnerRuntimeOwnershipRecoveryCommand> = {},
): CollectionRunnerRuntimeOwnershipRecoveryCommand {
  return {
    schemaVersion:
      EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_OWNERSHIP_RECOVERY_SCHEMA_VERSION,
    commandId: "command:quarantine",
    ownerId: "owner:alpha",
    expectedAssessmentFingerprint: assessment.fingerprint,
    action:
      CollectionRunnerRuntimeOwnershipRecoveryAction.QuarantineStaleOwnership,
    reasonCode: "OWNER_CONFIRMED_STALE",
    decidedAtUtc: NOW,
    expiresAtUtc: EXPIRES,
    ...changes,
  };
}

function authorize(
  assessment: CollectionRunnerRuntimeOwnershipRecoveryAssessment,
  verifier = new FakeOwnerVerifier(),
  commandValue = command(assessment),
) {
  return authorizeCollectionRunnerRuntimeOwnershipRecovery({
    assessment,
    command: commandValue,
    secret: "correct-owner-secret",
    verifier,
  });
}

function inspectionInput(
  assessment: CollectionRunnerRuntimeOwnershipRecoveryAssessment,
) {
  return {
    schemaVersion: assessment.schemaVersion,
    configurationFingerprint: assessment.configurationFingerprint,
    pathFingerprint: assessment.pathFingerprint,
    lockDirectoryIdentity: assessment.lockDirectoryIdentity,
    lockEvidenceFingerprint: assessment.lockEvidenceFingerprint,
    ownership: assessment.ownership,
    currentBootIdentity: assessment.currentBootIdentity,
    processLiveness: assessment.processLiveness,
    storeEvidence: assessment.storeEvidence,
    inspectedAtUtc: assessment.inspectedAtUtc,
    expiresAtUtc: assessment.expiresAtUtc,
    policyVersion: assessment.policyVersion,
  };
}

function quarantinePath(
  value: Fixture,
  assessment: CollectionRunnerRuntimeOwnershipRecoveryAssessment,
  decisionFingerprint: string,
): string {
  if (assessment.ownership === null) {
    throw new Error("Test fixture requires valid ownership.");
  }
  return resolve(
    value.paths.runtimeControlRoot,
    "ownership-quarantine",
    `${assessment.ownership.lockId.slice("sha256:".length)}-${decisionFingerprint.slice("sha256:".length)}.quarantine`,
  );
}

const engine =
  new EventContractCollectionRunnerRuntimeOwnershipRecoveryEngine();

const tests: ReadonlyArray<readonly [string, () => void]> = [
  [
    "Node liveness observation distinguishes live not-live and uncertain",
    () => {
      assertEqual(
        new NodeCollectionRunnerRuntimeProcessLivenessObservationPort(() => undefined)
          .observe(123),
        CollectionRunnerRuntimeOwnershipLiveness.Live,
        "live",
      );
      assertEqual(
        new NodeCollectionRunnerRuntimeProcessLivenessObservationPort(() => {
          throw Object.assign(new Error("missing"), { code: "ESRCH" });
        }).observe(123),
        CollectionRunnerRuntimeOwnershipLiveness.NotLive,
        "not live",
      );
      assertEqual(
        new NodeCollectionRunnerRuntimeProcessLivenessObservationPort(() => {
          throw Object.assign(new Error("denied"), { code: "EPERM" });
        }).observe(123),
        CollectionRunnerRuntimeOwnershipLiveness.Live,
        "permission means live",
      );
      assertEqual(
        new NodeCollectionRunnerRuntimeProcessLivenessObservationPort(() => {
          throw new Error("unknown");
        }).observe(123),
        CollectionRunnerRuntimeOwnershipLiveness.Unknown,
        "unknown",
      );
    },
  ],
  [
    "same-boot non-live ownership is an immutable stale candidate",
    () =>
      withFixture((value) => {
        const assessment =
          inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
        assertEqual(
          assessment.disposition,
          CollectionRunnerRuntimeOwnershipRecoveryDisposition.StaleCandidate,
          "disposition",
        );
        assertEqual(assessment.eligibleForOwnerReview, true, "eligible");
        assertTrue(Object.isFrozen(assessment), "frozen");
        assertEqual(
          engine.verifyAssessment(assessment).fingerprint,
          assessment.fingerprint,
          "verified",
        );
      }),
  ],
  [
    "same-boot live ownership cannot reach Owner review",
    () =>
      withFixture(
        (value) => {
          const assessment =
            inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
          assertEqual(
            assessment.disposition,
            CollectionRunnerRuntimeOwnershipRecoveryDisposition.OwnershipActive,
            "active",
          );
          expectError(
            () =>
              engine.createDecision(
                command(assessment),
                assessment,
                new FakeOwnerVerifier().verify({
                  ownerId: "owner:alpha",
                  secret: "correct-owner-secret",
                  challengeFingerprint: engine.createChallengeFingerprint(
                    command(assessment),
                    assessment,
                  ),
                  verifiedAtUtc: NOW,
                  expiresAtUtc: EXPIRES,
                }),
              ),
            CollectionRunnerRuntimeFoundationErrorCode.OwnershipRecoveryBlocked,
            "live blocked",
          );
        },
        { liveness: CollectionRunnerRuntimeOwnershipLiveness.Live },
      ),
  ],
  [
    "unknown liveness fails closed",
    () =>
      withFixture(
        (value) => {
          const assessment =
            inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
          assertEqual(
            assessment.disposition,
            CollectionRunnerRuntimeOwnershipRecoveryDisposition
              .LivenessUncertain,
            "uncertain",
          );
          assertEqual(assessment.eligibleForOwnerReview, false, "ineligible");
        },
        { liveness: CollectionRunnerRuntimeOwnershipLiveness.Unknown },
      ),
  ],
  [
    "different verified boot is a prior-boot stale candidate",
    () =>
      withFixture(
        (value) => {
          const assessment =
            inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
          assertEqual(
            assessment.disposition,
            CollectionRunnerRuntimeOwnershipRecoveryDisposition
              .PriorBootStaleCandidate,
            "prior boot",
          );
          assertEqual(assessment.eligibleForOwnerReview, true, "eligible");
        },
        { currentBoot: "boot:new" },
      ),
  ],
  [
    "store integrity failure blocks quarantine eligibility",
    () =>
      withFixture(
        (value) => {
          const assessment =
            inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
          assertEqual(
            assessment.disposition,
            CollectionRunnerRuntimeOwnershipRecoveryDisposition
              .StoreRecoveryBlocked,
            "store blocked",
          );
        },
        { store: { integrityVerified: false } },
      ),
  ],
  [
    "durable Emergency Stop restricts recovery to stopped recovery",
    () =>
      withFixture(
        (value) => {
          const assessment =
            inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
          assertEqual(
            assessment.disposition,
            CollectionRunnerRuntimeOwnershipRecoveryDisposition
              .StoppedRecoveryOnly,
            "stopped",
          );
        },
        { store: { durableEmergencyStopObserved: true } },
      ),
  ],
  [
    "configuration drift is classified as invalid lock evidence",
    () =>
      withFixture((value) => {
        const assessment = engine.createAssessment({
          ...inspectionInput(
            inspectCollectionRunnerRuntimeOwnershipRecovery(value.options),
          ),
          configurationFingerprint: SHA_C,
        });
        assertEqual(
          assessment.disposition,
          CollectionRunnerRuntimeOwnershipRecoveryDisposition
            .LockEvidenceInvalid,
          "lock evidence",
        );
      }),
  ],
  [
    "malformed owner record is classified and cannot reach Owner review",
    () =>
      withFixture((value) => {
        writeFileSync(value.paths.lockOwnerRecordPath, "{\"processId\":999}");
        const assessment =
          inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
        assertEqual(
          assessment.disposition,
          CollectionRunnerRuntimeOwnershipRecoveryDisposition
            .LockEvidenceInvalid,
          "invalid lock",
        );
        assertEqual(assessment.ownership, null, "no trusted ownership");
        assertEqual(assessment.eligibleForOwnerReview, false, "ineligible");
        expectError(
          () =>
            engine.createChallengeFingerprint(
              command(assessment),
              assessment,
            ),
          CollectionRunnerRuntimeFoundationErrorCode.OwnershipRecoveryBlocked,
          "invalid lock authority",
        );
      }),
  ],
  [
    "assessment rejects unknown fields",
    () =>
      withFixture((value) => {
        const assessment =
          inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
        expectError(
          () =>
            engine.createAssessment({
              ...assessment,
              secret: "forbidden",
            } as unknown as Parameters<typeof engine.createAssessment>[0]),
          CollectionRunnerRuntimeFoundationErrorCode
            .InvalidOwnershipRecoveryInput,
          "unknown",
        );
      }),
  ],
  [
    "tampered assessment fingerprint fails verification",
    () =>
      withFixture((value) => {
        const assessment =
          inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
        expectError(
          () =>
            engine.verifyAssessment({
              ...assessment,
              fingerprint: SHA_A,
            }),
          CollectionRunnerRuntimeFoundationErrorCode
            .InvalidOwnershipRecoveryInput,
          "tamper",
        );
      }),
  ],
  [
    "Owner authorization binds the exact challenge without retaining secret",
    () =>
      withFixture((value) => {
        const assessment =
          inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
        const verifier = new FakeOwnerVerifier();
        const decision = authorize(assessment, verifier);
        assertTrue(verifier.lastInput !== null, "verifier called");
        assertEqual(
          decision.ownerAuthorization.challengeFingerprint,
          verifier.lastInput!.challengeFingerprint,
          "challenge",
        );
        assertEqual("secret" in decision, false, "no secret");
        assertEqual(decision.action,
          CollectionRunnerRuntimeOwnershipRecoveryAction.QuarantineStaleOwnership,
          "action");
      }),
  ],
  [
    "changed assessment fingerprint invalidates Owner command",
    () =>
      withFixture((value) => {
        const assessment =
          inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
        expectError(
          () =>
            engine.createChallengeFingerprint(
              command(assessment, {
                expectedAssessmentFingerprint: SHA_A,
              }),
              assessment,
            ),
          CollectionRunnerRuntimeFoundationErrorCode
            .InvalidOwnershipRecoveryInput,
          "binding",
        );
      }),
  ],
  [
    "expired Owner command is rejected",
    () =>
      withFixture((value) => {
        const assessment =
          inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
        expectError(
          () =>
            engine.createChallengeFingerprint(
              command(assessment, {
                decidedAtUtc: EXPIRES,
                expiresAtUtc: EXPIRES,
              }),
              assessment,
            ),
          CollectionRunnerRuntimeFoundationErrorCode
            .InvalidOwnershipRecoveryInput,
          "expiry",
        );
      }),
  ],
  [
    "quarantine atomically preserves owner record and recovery receipt",
    () =>
      withFixture((value) => {
        const assessment =
          inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
        const decision = authorize(assessment);
        const receipt = executeCollectionRunnerRuntimeOwnershipQuarantine({
          configuration: value.configuration,
          paths: value.paths,
          assessment,
          decision,
          executedAtUtc: NOW,
          reinspect: () =>
            inspectCollectionRunnerRuntimeOwnershipRecovery(value.options),
        });
        assertEqual(existsSync(value.paths.lockDirectory), false, "lock moved");
        const quarantineRoot = resolve(
          value.paths.runtimeControlRoot,
          "ownership-quarantine",
        );
        const quarantined = quarantinePath(
          value,
          assessment,
          decision.fingerprint,
        );
        assertTrue(existsSync(quarantined), "one quarantine");
        assertTrue(
          existsSync(resolve(quarantined, "owner.json")),
          "owner preserved",
        );
        assertTrue(
          existsSync(
            resolve(quarantined, "ownership-recovery-receipt.json"),
          ),
          "receipt preserved",
        );
        assertEqual(receipt.authorizesPilotResume, false, "no resume");
        assertEqual(receipt.authorizesRuntimeStart, false, "no start");
      }),
  ],
  [
    "exact replay after quarantine returns the original receipt",
    () =>
      withFixture((value) => {
        const assessment =
          inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
        const decision = authorize(assessment);
        const execute = () =>
          executeCollectionRunnerRuntimeOwnershipQuarantine({
            configuration: value.configuration,
            paths: value.paths,
            assessment,
            decision,
            executedAtUtc: NOW,
            reinspect: () => assessment,
          });
        const first = execute();
        const second = execute();
        assertEqual(second.fingerprint, first.fingerprint, "replay");
      }),
  ],
  [
    "exact replay clears an empty guard left after receipt verification",
    () =>
      withFixture((value) => {
        const assessment =
          inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
        const decision = authorize(assessment);
        const execute = () =>
          executeCollectionRunnerRuntimeOwnershipQuarantine({
            configuration: value.configuration,
            paths: value.paths,
            assessment,
            decision,
            executedAtUtc: NOW,
            reinspect: () => assessment,
          });
        const first = execute();
        const guard = `${value.paths.lockDirectory}.recovery-guard`;
        mkdirSync(guard);
        const replay = execute();
        assertEqual(replay.fingerprint, first.fingerprint, "receipt");
        assertEqual(existsSync(guard), false, "empty guard removed");
      }),
  ],
  [
    "replay completes an exact receipt written before quarantine rename",
    () =>
      withFixture((value) => {
        const assessment =
          inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
        const decision = authorize(assessment);
        const destination = quarantinePath(
          value,
          assessment,
          decision.fingerprint,
        );
        const receipt = engine.createReceipt(
          assessment,
          decision,
          fingerprintCollectionRunnerRuntimeOwnershipRecovery(
            destination.toLocaleLowerCase(),
          ),
          NOW,
        );
        writeFileSync(
          resolve(
            value.paths.lockDirectory,
            "ownership-recovery-receipt.json",
          ),
          canonicalize(receipt),
        );
        const completed =
          executeCollectionRunnerRuntimeOwnershipQuarantine({
            configuration: value.configuration,
            paths: value.paths,
            assessment,
            decision,
            executedAtUtc: NOW,
            reinspect: () =>
              inspectCollectionRunnerRuntimeOwnershipRecovery(value.options),
          });
        assertEqual(completed.fingerprint, receipt.fingerprint, "receipt replay");
        assertTrue(existsSync(destination), "quarantine completed");
      }),
  ],
  [
    "changed replay cannot reuse a completed quarantine",
    () =>
      withFixture((value) => {
        const assessment =
          inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
        const firstDecision = authorize(assessment);
        executeCollectionRunnerRuntimeOwnershipQuarantine({
          configuration: value.configuration,
          paths: value.paths,
          assessment,
          decision: firstDecision,
          executedAtUtc: NOW,
          reinspect: () => assessment,
        });
        const changedDecision = authorize(
          assessment,
          new FakeOwnerVerifier(),
          command(assessment, { commandId: "command:changed" }),
        );
        expectError(
          () =>
            executeCollectionRunnerRuntimeOwnershipQuarantine({
              configuration: value.configuration,
              paths: value.paths,
              assessment,
              decision: changedDecision,
              executedAtUtc: NOW,
              reinspect: () => assessment,
            }),
          CollectionRunnerRuntimeFoundationErrorCode.OwnershipRecoveryConflict,
          "changed replay",
        );
      }),
  ],
  [
    "evidence change after authorization preserves the lock",
    () =>
      withFixture((value) => {
        const assessment =
          inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
        const decision = authorize(assessment);
        const changed = engine.createAssessment({
          ...inspectionInput(assessment),
          inspectedAtUtc: "2026-07-25T16:00:01.000Z",
          expiresAtUtc: EXPIRES,
        });
        expectError(
          () =>
            executeCollectionRunnerRuntimeOwnershipQuarantine({
              configuration: value.configuration,
              paths: value.paths,
              assessment,
              decision,
              executedAtUtc: NOW,
              reinspect: () => changed,
            }),
          CollectionRunnerRuntimeFoundationErrorCode.OwnershipRecoveryConflict,
          "reinspection",
        );
        assertTrue(existsSync(value.paths.lockDirectory), "lock preserved");
      }),
  ],
  [
    "conflicting recovery guard fails closed",
    () =>
      withFixture((value) => {
        const assessment =
          inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
        const decision = authorize(assessment);
        const guard = `${value.paths.lockDirectory}.recovery-guard`;
        mkdirSync(guard);
        writeFileSync(resolve(guard, "guard.json"), canonicalize({
          schemaVersion: "1.0",
          assessmentFingerprint: SHA_A,
          decisionFingerprint: SHA_A,
          ownershipFingerprint: SHA_A,
          quarantineDirectoryIdentity: SHA_A,
          deterministic: true,
          fingerprint: SHA_A,
        }));
        expectError(
          () =>
            executeCollectionRunnerRuntimeOwnershipQuarantine({
              configuration: value.configuration,
              paths: value.paths,
              assessment,
              decision,
              executedAtUtc: NOW,
              reinspect: () => assessment,
            }),
          CollectionRunnerRuntimeFoundationErrorCode.OwnershipRecoveryConflict,
          "guard",
        );
        assertTrue(existsSync(value.paths.lockDirectory), "lock preserved");
      }),
  ],
  [
    "destination conflict with active ownership fails closed",
    () =>
      withFixture((value) => {
        const assessment =
          inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
        const decision = authorize(assessment);
        const quarantineRoot = resolve(
          value.paths.runtimeControlRoot,
          "ownership-quarantine",
        );
        mkdirSync(quarantineRoot);
        const destination = quarantinePath(
          value,
          assessment,
          decision.fingerprint,
        );
        mkdirSync(destination);
        expectError(
          () =>
            executeCollectionRunnerRuntimeOwnershipQuarantine({
              configuration: value.configuration,
              paths: value.paths,
              assessment,
              decision,
              executedAtUtc: NOW,
              reinspect: () => assessment,
            }),
          CollectionRunnerRuntimeFoundationErrorCode.OwnershipRecoveryConflict,
          "destination",
        );
      }),
  ],
  [
    "a fresh process can acquire ownership only after quarantine",
    () =>
      withFixture((value) => {
        const assessment =
          inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
        const decision = authorize(assessment);
        executeCollectionRunnerRuntimeOwnershipQuarantine({
          configuration: value.configuration,
          paths: value.paths,
          assessment,
          decision,
          executedAtUtc: NOW,
          reinspect: () => assessment,
        });
        const next = acquireCollectionRunnerRuntimeOwnership({
          configuration: value.configuration,
          paths: value.paths,
          bootIdentityPort: new FixedBootIdentityPort(),
          processNoncePort: {
            createNonce: () => SHA_B,
          },
          processId: 54_321,
          wallClock: {
            nowUtc: () => "2026-07-25T16:05:00.000Z",
          },
        });
        assertTrue(
          next.ownership.processSessionId !==
            assessment.ownership!.processSessionId,
          "fresh session",
        );
        next.releaseCleanly();
      }),
  ],
  [
    "an incomplete recovery guard blocks fresh ownership after rename ambiguity",
    () =>
      withFixture((value) => {
        const guard = `${value.paths.lockDirectory}.recovery-guard`;
        mkdirSync(guard);
        renameSync(
          value.paths.lockDirectory,
          `${value.paths.lockDirectory}.ambiguous`,
        );
        expectError(
          () =>
            acquireCollectionRunnerRuntimeOwnership({
              configuration: value.configuration,
              paths: value.paths,
              bootIdentityPort: new FixedBootIdentityPort(),
              processNoncePort: {
                createNonce: () => SHA_B,
              },
              processId: 54_321,
              wallClock: new FixedWallClock(),
            }),
          CollectionRunnerRuntimeFoundationErrorCode.DuplicateProcess,
          "guard blocks acquisition",
        );
      }),
  ],
  [
    "receipt identity is bound to the deterministic quarantine path",
    () =>
      withFixture((value) => {
        const assessment =
          inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
        const decision = authorize(assessment);
        const receipt = executeCollectionRunnerRuntimeOwnershipQuarantine({
          configuration: value.configuration,
          paths: value.paths,
          assessment,
          decision,
          executedAtUtc: NOW,
          reinspect: () => assessment,
        });
        const quarantineRoot = resolve(
          value.paths.runtimeControlRoot,
          "ownership-quarantine",
        );
        const path = quarantinePath(
          value,
          assessment,
          decision.fingerprint,
        );
        assertEqual(
          receipt.quarantineDirectoryIdentity,
          fingerprintCollectionRunnerRuntimeOwnershipRecovery(
            path.toLocaleLowerCase(),
          ),
          "path identity",
        );
      }),
  ],
  [
    "receipt is immutable and contains no secret",
    () =>
      withFixture((value) => {
        const assessment =
          inspectCollectionRunnerRuntimeOwnershipRecovery(value.options);
        const decision = authorize(assessment);
        const receipt = executeCollectionRunnerRuntimeOwnershipQuarantine({
          configuration: value.configuration,
          paths: value.paths,
          assessment,
          decision,
          executedAtUtc: NOW,
          reinspect: () => assessment,
        });
        assertTrue(Object.isFrozen(receipt), "frozen");
        assertEqual("secret" in receipt, false, "secret absent");
      }),
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
  `Event Contract Collection Runner Runtime Ownership Recovery tests passed: ${String(passed)}/${String(tests.length)}.`,
);
