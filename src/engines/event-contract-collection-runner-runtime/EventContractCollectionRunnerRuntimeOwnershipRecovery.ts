import { createHash } from "node:crypto";

import {
  CollectionRunnerPilotState,
  CollectionRunnerRuntimeFoundationErrorCode,
  CollectionRunnerRuntimeOwnershipLiveness,
  CollectionRunnerRuntimeOwnershipRecoveryAction,
  CollectionRunnerRuntimeOwnershipRecoveryDisposition,
  EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_OWNERSHIP_RECOVERY_SCHEMA_VERSION,
  type CollectionRunnerLocalOwnerAuthorizationEvidence,
  type CollectionRunnerRuntimeOwnership,
  type CollectionRunnerRuntimeOwnershipRecoveryAssessment,
  type CollectionRunnerRuntimeOwnershipRecoveryCommand,
  type CollectionRunnerRuntimeOwnershipRecoveryDecision,
  type CollectionRunnerRuntimeOwnershipRecoveryInspectionInput,
  type CollectionRunnerRuntimeOwnershipRecoveryReceipt,
  type CollectionRunnerRuntimeOwnershipRecoveryStoreEvidence,
} from "../../contracts";
import {
  EventContractCollectionRunnerRuntimeFoundationError,
  verifyCollectionRunnerRuntimeOwnership,
} from "./EventContractCollectionRunnerRuntimeFoundation";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u;
const REASON_CODE = /^[A-Z][A-Z0-9_]{0,63}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const FINGERPRINT =
  /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const UTC_MILLISECOND =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const MAXIMUM_AUTHORITY_MILLISECONDS = 5 * 60 * 1000;
const MAXIMUM_SUMMARY_COUNT = 10_000;

function fail(message: string): never {
  throw new EventContractCollectionRunnerRuntimeFoundationError(
    CollectionRunnerRuntimeFoundationErrorCode.InvalidOwnershipRecoveryInput,
    message,
  );
}

function blocked(message: string): never {
  throw new EventContractCollectionRunnerRuntimeFoundationError(
    CollectionRunnerRuntimeFoundationErrorCode.OwnershipRecoveryBlocked,
    message,
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
  if (!isRecord(value)) fail(`${label} must be an object.`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail(`${label} fields do not match the closed contract.`);
  }
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

export function fingerprintCollectionRunnerRuntimeOwnershipRecovery(
  value: unknown,
): string {
  return `sha256:${createHash("sha256")
    .update(canonicalize(value), "utf8")
    .digest("hex")}`;
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

function identifier(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    fail(`${field} must be a canonical identifier.`);
  }
}

function fingerprintValue(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== "string" || !FINGERPRINT.test(value)) {
    fail(`${field} must be a canonical fingerprint.`);
  }
}

function utc(value: unknown, field: string): number {
  if (typeof value !== "string" || !UTC_MILLISECOND.test(value)) {
    fail(`${field} must be canonical millisecond UTC.`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    fail(`${field} must be a real canonical UTC timestamp.`);
  }
  return parsed;
}

function count(value: unknown, field: string): asserts value is number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 0 ||
    (value as number) > MAXIMUM_SUMMARY_COUNT
  ) {
    fail(`${field} must be a bounded non-negative safe integer.`);
  }
}

function booleanValue(
  value: unknown,
  field: string,
): asserts value is boolean {
  if (typeof value !== "boolean") fail(`${field} must be boolean.`);
}

function validateStoreEvidence(
  value: CollectionRunnerRuntimeOwnershipRecoveryStoreEvidence,
): void {
  exactKeys(
    value,
    [
      "durableEmergencyStopObserved",
      "integrityVerified",
      "openAttemptCount",
      "openLeaseCount",
      "pilotState",
      "recoveryReportFingerprint",
      "storeIdentityVerified",
      "storePathIdentity",
    ],
    "ownership recovery store evidence",
  );
  fingerprintValue(value.storePathIdentity, "storeEvidence.storePathIdentity");
  fingerprintValue(
    value.recoveryReportFingerprint,
    "storeEvidence.recoveryReportFingerprint",
  );
  booleanValue(
    value.storeIdentityVerified,
    "storeEvidence.storeIdentityVerified",
  );
  booleanValue(value.integrityVerified, "storeEvidence.integrityVerified");
  booleanValue(
    value.durableEmergencyStopObserved,
    "storeEvidence.durableEmergencyStopObserved",
  );
  count(value.openLeaseCount, "storeEvidence.openLeaseCount");
  count(value.openAttemptCount, "storeEvidence.openAttemptCount");
  if (
    value.pilotState !== null &&
    !Object.values(CollectionRunnerPilotState).includes(value.pilotState)
  ) {
    fail("storeEvidence.pilotState is invalid.");
  }
}

function classify(
  input: CollectionRunnerRuntimeOwnershipRecoveryInspectionInput,
): CollectionRunnerRuntimeOwnershipRecoveryDisposition {
  const ownership = input.ownership;
  if (
    ownership === null ||
    input.lockEvidenceFingerprint !== ownership.fingerprint
  ) {
    return CollectionRunnerRuntimeOwnershipRecoveryDisposition.LockEvidenceInvalid;
  }
  if (
    ownership.configurationFingerprint !== input.configurationFingerprint ||
    ownership.pathFingerprint !== input.pathFingerprint ||
    ownership.storePathIdentity !== input.storeEvidence.storePathIdentity
  ) {
    return CollectionRunnerRuntimeOwnershipRecoveryDisposition.LockEvidenceInvalid;
  }
  const sameBoot = ownership.bootIdentity === input.currentBootIdentity;
  if (
    sameBoot &&
    input.processLiveness === CollectionRunnerRuntimeOwnershipLiveness.Live
  ) {
    return CollectionRunnerRuntimeOwnershipRecoveryDisposition.OwnershipActive;
  }
  if (
    sameBoot &&
    input.processLiveness === CollectionRunnerRuntimeOwnershipLiveness.Unknown
  ) {
    return CollectionRunnerRuntimeOwnershipRecoveryDisposition.LivenessUncertain;
  }
  if (
    !input.storeEvidence.storeIdentityVerified ||
    !input.storeEvidence.integrityVerified
  ) {
    return CollectionRunnerRuntimeOwnershipRecoveryDisposition.StoreRecoveryBlocked;
  }
  if (
    input.storeEvidence.durableEmergencyStopObserved ||
    input.storeEvidence.pilotState === CollectionRunnerPilotState.StopRequested ||
    input.storeEvidence.pilotState === CollectionRunnerPilotState.Stopped
  ) {
    return CollectionRunnerRuntimeOwnershipRecoveryDisposition.StoppedRecoveryOnly;
  }
  if (!sameBoot) {
    return CollectionRunnerRuntimeOwnershipRecoveryDisposition.PriorBootStaleCandidate;
  }
  return CollectionRunnerRuntimeOwnershipRecoveryDisposition.StaleCandidate;
}

function assessmentBase(
  input: CollectionRunnerRuntimeOwnershipRecoveryInspectionInput,
): CollectionRunnerRuntimeOwnershipRecoveryInspectionInput {
  exactKeys(
    input,
    [
      "configurationFingerprint",
      "currentBootIdentity",
      "expiresAtUtc",
      "inspectedAtUtc",
      "lockEvidenceFingerprint",
      "lockDirectoryIdentity",
      "ownership",
      "pathFingerprint",
      "policyVersion",
      "processLiveness",
      "schemaVersion",
      "storeEvidence",
    ],
    "ownership recovery inspection",
  );
  if (
    input.schemaVersion !==
    EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_OWNERSHIP_RECOVERY_SCHEMA_VERSION
  ) {
    fail("Ownership recovery inspection schema is unsupported.");
  }
  fingerprintValue(
    input.configurationFingerprint,
    "inspection.configurationFingerprint",
  );
  fingerprintValue(input.pathFingerprint, "inspection.pathFingerprint");
  fingerprintValue(
    input.lockDirectoryIdentity,
    "inspection.lockDirectoryIdentity",
  );
  fingerprintValue(
    input.lockEvidenceFingerprint,
    "inspection.lockEvidenceFingerprint",
  );
  identifier(input.currentBootIdentity, "inspection.currentBootIdentity");
  if (
    !Object.values(CollectionRunnerRuntimeOwnershipLiveness).includes(
      input.processLiveness,
    )
  ) {
    fail("inspection.processLiveness is invalid.");
  }
  if (typeof input.policyVersion !== "string" || !VERSION.test(input.policyVersion)) {
    fail("inspection.policyVersion must be canonical.");
  }
  const inspected = utc(input.inspectedAtUtc, "inspection.inspectedAtUtc");
  const expires = utc(input.expiresAtUtc, "inspection.expiresAtUtc");
  if (
    inspected >= expires ||
    expires - inspected > MAXIMUM_AUTHORITY_MILLISECONDS
  ) {
    fail("Ownership recovery inspection lifetime is invalid.");
  }
  if (input.ownership !== null) {
    verifyCollectionRunnerRuntimeOwnership(input.ownership);
  }
  validateStoreEvidence(input.storeEvidence);
  return structuredClone(input);
}

export class EventContractCollectionRunnerRuntimeOwnershipRecoveryEngine {
  public createAssessment(
    input: CollectionRunnerRuntimeOwnershipRecoveryInspectionInput,
  ): CollectionRunnerRuntimeOwnershipRecoveryAssessment {
    const base = assessmentBase(input);
    const disposition = classify(base);
    const eligibleForOwnerReview =
      disposition ===
        CollectionRunnerRuntimeOwnershipRecoveryDisposition.StaleCandidate ||
      disposition ===
        CollectionRunnerRuntimeOwnershipRecoveryDisposition
          .PriorBootStaleCandidate;
    const record = {
      ...base,
      disposition,
      eligibleForOwnerReview,
      deterministic: true as const,
    };
    return deepFreeze({
      ...record,
      fingerprint: fingerprintCollectionRunnerRuntimeOwnershipRecovery(record),
    }) as CollectionRunnerRuntimeOwnershipRecoveryAssessment;
  }

  public verifyAssessment(
    value: CollectionRunnerRuntimeOwnershipRecoveryAssessment,
  ): CollectionRunnerRuntimeOwnershipRecoveryAssessment {
    exactKeys(
      value,
      [
        "configurationFingerprint",
        "currentBootIdentity",
        "deterministic",
        "disposition",
        "eligibleForOwnerReview",
        "expiresAtUtc",
        "fingerprint",
        "inspectedAtUtc",
        "lockEvidenceFingerprint",
        "lockDirectoryIdentity",
        "ownership",
        "pathFingerprint",
        "policyVersion",
        "processLiveness",
        "schemaVersion",
        "storeEvidence",
      ],
      "ownership recovery assessment",
    );
    fingerprintValue(value.fingerprint, "assessment.fingerprint");
    const expected = this.createAssessment({
      schemaVersion: value.schemaVersion,
      configurationFingerprint: value.configurationFingerprint,
      pathFingerprint: value.pathFingerprint,
      lockDirectoryIdentity: value.lockDirectoryIdentity,
      lockEvidenceFingerprint: value.lockEvidenceFingerprint,
      ownership: value.ownership,
      currentBootIdentity: value.currentBootIdentity,
      processLiveness: value.processLiveness,
      storeEvidence: value.storeEvidence,
      inspectedAtUtc: value.inspectedAtUtc,
      expiresAtUtc: value.expiresAtUtc,
      policyVersion: value.policyVersion,
    });
    if (
      value.deterministic !== true ||
      value.disposition !== expected.disposition ||
      value.eligibleForOwnerReview !== expected.eligibleForOwnerReview ||
      value.fingerprint !== expected.fingerprint
    ) {
      fail("Ownership recovery assessment does not match its evidence.");
    }
    return expected;
  }

  public createChallengeFingerprint(
    command: CollectionRunnerRuntimeOwnershipRecoveryCommand,
    assessmentValue: CollectionRunnerRuntimeOwnershipRecoveryAssessment,
  ): string {
    const assessment = this.verifyAssessment(assessmentValue);
    validateCommand(command);
    if (command.expectedAssessmentFingerprint !== assessment.fingerprint) {
      fail("Ownership recovery command does not bind the exact assessment.");
    }
    if (assessment.ownership === null) {
      blocked("Invalid lock evidence cannot reach Owner recovery authority.");
    }
    return fingerprintCollectionRunnerRuntimeOwnershipRecovery({
      command,
      assessmentFingerprint: assessment.fingerprint,
      ownershipFingerprint: assessment.ownership.fingerprint,
      disposition: assessment.disposition,
    });
  }

  public createDecision(
    command: CollectionRunnerRuntimeOwnershipRecoveryCommand,
    assessmentValue: CollectionRunnerRuntimeOwnershipRecoveryAssessment,
    ownerAuthorization: CollectionRunnerLocalOwnerAuthorizationEvidence,
  ): CollectionRunnerRuntimeOwnershipRecoveryDecision {
    const assessment = this.verifyAssessment(assessmentValue);
    const challenge = this.createChallengeFingerprint(command, assessment);
    validateOwnerAuthorization(ownerAuthorization);
    const decided = utc(command.decidedAtUtc, "command.decidedAtUtc");
    const expires = utc(command.expiresAtUtc, "command.expiresAtUtc");
    if (
      !assessment.eligibleForOwnerReview ||
      assessment.ownership === null ||
      decided > Date.parse(assessment.expiresAtUtc) ||
      expires > Date.parse(assessment.expiresAtUtc)
    ) {
      blocked("Ownership evidence is not eligible or current for Owner review.");
    }
    if (
      ownerAuthorization.ownerId !== command.ownerId ||
      ownerAuthorization.challengeFingerprint !== challenge ||
      decided < Date.parse(ownerAuthorization.verifiedAtUtc) ||
      decided > Date.parse(ownerAuthorization.expiresAtUtc) ||
      expires > Date.parse(ownerAuthorization.expiresAtUtc)
    ) {
      blocked("Local Owner authorization does not bind the exact command.");
    }
    const record = {
      schemaVersion:
        EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_OWNERSHIP_RECOVERY_SCHEMA_VERSION,
      commandId: command.commandId,
      assessmentFingerprint: assessment.fingerprint,
      ownershipFingerprint: assessment.ownership.fingerprint,
      action: command.action,
      reasonCode: command.reasonCode,
      ownerAuthorization: structuredClone(ownerAuthorization),
      decidedAtUtc: command.decidedAtUtc,
      expiresAtUtc: command.expiresAtUtc,
      deterministic: true as const,
    };
    return deepFreeze({
      ...record,
      fingerprint: fingerprintCollectionRunnerRuntimeOwnershipRecovery(record),
    }) as CollectionRunnerRuntimeOwnershipRecoveryDecision;
  }

  public verifyDecision(
    value: CollectionRunnerRuntimeOwnershipRecoveryDecision,
    assessmentValue: CollectionRunnerRuntimeOwnershipRecoveryAssessment,
  ): CollectionRunnerRuntimeOwnershipRecoveryDecision {
    exactKeys(
      value,
      [
        "action",
        "assessmentFingerprint",
        "commandId",
        "decidedAtUtc",
        "deterministic",
        "expiresAtUtc",
        "fingerprint",
        "ownerAuthorization",
        "ownershipFingerprint",
        "reasonCode",
        "schemaVersion",
      ],
      "ownership recovery decision",
    );
    const assessment = this.verifyAssessment(assessmentValue);
    if (assessment.ownership === null) {
      blocked("Invalid lock evidence cannot create a recovery receipt.");
    }
    fingerprintValue(value.fingerprint, "decision.fingerprint");
    const command: CollectionRunnerRuntimeOwnershipRecoveryCommand = {
      schemaVersion: value.schemaVersion,
      commandId: value.commandId,
      ownerId: value.ownerAuthorization.ownerId,
      expectedAssessmentFingerprint: value.assessmentFingerprint,
      action: value.action,
      reasonCode: value.reasonCode,
      decidedAtUtc: value.decidedAtUtc,
      expiresAtUtc: value.expiresAtUtc,
    };
    const expected = this.createDecision(
      command,
      assessment,
      value.ownerAuthorization,
    );
    if (
      value.deterministic !== true ||
      value.ownershipFingerprint !== assessment.ownership.fingerprint ||
      value.fingerprint !== expected.fingerprint
    ) {
      fail("Ownership recovery decision does not match its authority.");
    }
    return expected;
  }

  public createReceipt(
    assessmentValue: CollectionRunnerRuntimeOwnershipRecoveryAssessment,
    decisionValue: CollectionRunnerRuntimeOwnershipRecoveryDecision,
    quarantineDirectoryIdentity: string,
    quarantinedAtUtc: string,
  ): CollectionRunnerRuntimeOwnershipRecoveryReceipt {
    const assessment = this.verifyAssessment(assessmentValue);
    const decision = this.verifyDecision(decisionValue, assessment);
    if (assessment.ownership === null) {
      blocked("Invalid lock evidence cannot create a recovery receipt.");
    }
    fingerprintValue(
      quarantineDirectoryIdentity,
      "receipt.quarantineDirectoryIdentity",
    );
    const quarantined = utc(quarantinedAtUtc, "receipt.quarantinedAtUtc");
    if (
      quarantined < Date.parse(decision.decidedAtUtc) ||
      quarantined > Date.parse(decision.expiresAtUtc)
    ) {
      blocked("Ownership quarantine time is outside exact Owner authority.");
    }
    const receiptId = `receipt:${fingerprintCollectionRunnerRuntimeOwnershipRecovery({
      commandId: decision.commandId,
      assessmentFingerprint: assessment.fingerprint,
      decisionFingerprint: decision.fingerprint,
      ownershipFingerprint: assessment.ownership.fingerprint,
    })}`;
    const record = {
      schemaVersion:
        EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_OWNERSHIP_RECOVERY_SCHEMA_VERSION,
      receiptId,
      commandId: decision.commandId,
      assessmentFingerprint: assessment.fingerprint,
      decisionFingerprint: decision.fingerprint,
      ownershipFingerprint: assessment.ownership.fingerprint,
      lockDirectoryIdentity: assessment.lockDirectoryIdentity,
      quarantineDirectoryIdentity,
      ownerAuthorizationReference:
        decision.ownerAuthorization.authorizationReference,
      action:
        CollectionRunnerRuntimeOwnershipRecoveryAction.QuarantineStaleOwnership,
      quarantinedAtUtc,
      preservesOwnerRecord: true as const,
      preservesRecoveryReceipt: true as const,
      authorizesPilotResume: false as const,
      authorizesRuntimeStart: false as const,
      deterministic: true as const,
    };
    return deepFreeze({
      ...record,
      fingerprint: fingerprintCollectionRunnerRuntimeOwnershipRecovery(record),
    }) as CollectionRunnerRuntimeOwnershipRecoveryReceipt;
  }

  public verifyReceipt(
    value: CollectionRunnerRuntimeOwnershipRecoveryReceipt,
    assessmentValue: CollectionRunnerRuntimeOwnershipRecoveryAssessment,
    decisionValue: CollectionRunnerRuntimeOwnershipRecoveryDecision,
  ): CollectionRunnerRuntimeOwnershipRecoveryReceipt {
    exactKeys(
      value,
      [
        "action",
        "assessmentFingerprint",
        "authorizesPilotResume",
        "authorizesRuntimeStart",
        "commandId",
        "decisionFingerprint",
        "deterministic",
        "fingerprint",
        "lockDirectoryIdentity",
        "ownerAuthorizationReference",
        "ownershipFingerprint",
        "preservesOwnerRecord",
        "preservesRecoveryReceipt",
        "quarantineDirectoryIdentity",
        "quarantinedAtUtc",
        "receiptId",
        "schemaVersion",
      ],
      "ownership recovery receipt",
    );
    fingerprintValue(value.fingerprint, "receipt.fingerprint");
    const expected = this.createReceipt(
      assessmentValue,
      decisionValue,
      value.quarantineDirectoryIdentity,
      value.quarantinedAtUtc,
    );
    if (canonicalize(value) !== canonicalize(expected)) {
      fail("Ownership recovery receipt does not match the exact decision.");
    }
    return expected;
  }
}

function validateCommand(
  value: CollectionRunnerRuntimeOwnershipRecoveryCommand,
): void {
  exactKeys(
    value,
    [
      "action",
      "commandId",
      "decidedAtUtc",
      "expectedAssessmentFingerprint",
      "expiresAtUtc",
      "ownerId",
      "reasonCode",
      "schemaVersion",
    ],
    "ownership recovery command",
  );
  if (
    value.schemaVersion !==
      EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_OWNERSHIP_RECOVERY_SCHEMA_VERSION ||
    value.action !==
      CollectionRunnerRuntimeOwnershipRecoveryAction.QuarantineStaleOwnership
  ) {
    fail("Ownership recovery command schema or action is unsupported.");
  }
  identifier(value.commandId, "command.commandId");
  identifier(value.ownerId, "command.ownerId");
  fingerprintValue(
    value.expectedAssessmentFingerprint,
    "command.expectedAssessmentFingerprint",
  );
  if (!REASON_CODE.test(value.reasonCode)) {
    fail("command.reasonCode must be canonical.");
  }
  const decided = utc(value.decidedAtUtc, "command.decidedAtUtc");
  const expires = utc(value.expiresAtUtc, "command.expiresAtUtc");
  if (
    decided >= expires ||
    expires - decided > MAXIMUM_AUTHORITY_MILLISECONDS
  ) {
    fail("Ownership recovery command lifetime is invalid.");
  }
}

function validateOwnerAuthorization(
  value: CollectionRunnerLocalOwnerAuthorizationEvidence,
): void {
  exactKeys(
    value,
    [
      "authorityKind",
      "authorizationReference",
      "challengeFingerprint",
      "expiresAtUtc",
      "ownerId",
      "verifiedAtUtc",
      "verifierId",
      "verifierVersion",
    ],
    "local Owner authorization",
  );
  if (value.authorityKind !== "LOCAL_OWNER_VERIFIED") {
    fail("Local Owner authorization kind is invalid.");
  }
  for (const [field, entry] of [
    ["ownerId", value.ownerId],
    ["verifierId", value.verifierId],
  ] as const) {
    identifier(entry, `ownerAuthorization.${field}`);
  }
  if (!VERSION.test(value.verifierVersion)) {
    fail("ownerAuthorization.verifierVersion must be canonical.");
  }
  fingerprintValue(
    value.authorizationReference,
    "ownerAuthorization.authorizationReference",
  );
  fingerprintValue(
    value.challengeFingerprint,
    "ownerAuthorization.challengeFingerprint",
  );
  const verified = utc(
    value.verifiedAtUtc,
    "ownerAuthorization.verifiedAtUtc",
  );
  const expires = utc(value.expiresAtUtc, "ownerAuthorization.expiresAtUtc");
  if (
    verified >= expires ||
    expires - verified > MAXIMUM_AUTHORITY_MILLISECONDS
  ) {
    fail("Local Owner authorization lifetime is invalid.");
  }
}
