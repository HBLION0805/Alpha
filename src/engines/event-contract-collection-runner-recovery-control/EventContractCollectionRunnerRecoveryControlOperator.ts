import * as nodeCrypto from "node:crypto";

import {
  COLLECTION_RUNNER_RECOVERY_CONTROL_SCHEMA_VERSION,
  type CollectionRunnerLocalOwnerAuthorizationEvidence,
  type CollectionRunnerOwnerDecisionAction,
} from "../../contracts";
import type {
  CollectionRunnerControlExecutionReceipt,
  EventContractCollectionRunnerRecoveryControlRepository,
  ExecuteEmergencyStopTransaction,
} from "../../repositories/EventContractCollectionRunnerRecoveryControlRepository";
import type { CollectionRunnerProcessStopBarrier } from "../../repositories/SessionGatedEventContractCollectionRunnerRepository";
import { EventContractCollectionRunnerRecoveryControlEngine } from "./EventContractCollectionRunnerRecoveryControlEngine";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u;
const FINGERPRINT =
  /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const UTC_MILLISECOND =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const HEX = /^[0-9a-f]+$/u;

export enum CollectionRunnerLocalOwnerAuthenticationErrorCode {
  InvalidInput = "INVALID_INPUT",
  AuthenticationFailed = "AUTHENTICATION_FAILED",
  AuthorityMismatch = "AUTHORITY_MISMATCH",
}

export class CollectionRunnerLocalOwnerAuthenticationError extends Error {
  public constructor(
    public readonly code: CollectionRunnerLocalOwnerAuthenticationErrorCode,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = "CollectionRunnerLocalOwnerAuthenticationError";
  }
}

export interface CollectionRunnerLocalOwnerVerifierRecord {
  readonly schemaVersion: "1.0";
  readonly ownerId: string;
  readonly verifierId: string;
  readonly verifierVersion: string;
  readonly algorithm: "SCRYPT_SHA256";
  readonly saltHex: string;
  readonly derivedKeyHex: string;
  readonly cost: 16384;
  readonly blockSize: 8;
  readonly parallelization: 1;
  readonly keyLength: 32;
}

export interface VerifyCollectionRunnerLocalOwnerInput {
  readonly ownerId: string;
  readonly secret: string;
  readonly challengeFingerprint: string;
  readonly verifiedAtUtc: string;
  readonly expiresAtUtc: string;
}

export interface CollectionRunnerLocalOwnerVerifier {
  verify(
    input: VerifyCollectionRunnerLocalOwnerInput,
  ): CollectionRunnerLocalOwnerAuthorizationEvidence;
}

export interface ExecuteCollectionRunnerOwnerCommand {
  readonly schemaVersion: "1.0";
  readonly commandId: string;
  readonly assessmentId: string;
  readonly expectedAssessmentFingerprint: string;
  readonly decisionId: string;
  readonly expectedActivationAggregateVersion: number;
  readonly action: CollectionRunnerOwnerDecisionAction;
  readonly reasonCode: string;
  readonly proposedBootIdentity: string;
  readonly proposedProcessSessionId: string;
  readonly verifiedAtUtc: string;
  readonly authorizationExpiresAtUtc: string;
  readonly decidedAtUtc: string;
  readonly decisionExpiresAtUtc: string;
  readonly currentRecoveryReportFingerprint: string;
  readonly currentStorePathIdentity: string;
  readonly currentSchemaCatalogChecksum: string;
  readonly executedAtUtc: string;
}

const COMMAND_KEYS = [
  "schemaVersion",
  "commandId",
  "assessmentId",
  "expectedAssessmentFingerprint",
  "decisionId",
  "expectedActivationAggregateVersion",
  "action",
  "reasonCode",
  "proposedBootIdentity",
  "proposedProcessSessionId",
  "verifiedAtUtc",
  "authorizationExpiresAtUtc",
  "decidedAtUtc",
  "decisionExpiresAtUtc",
  "currentRecoveryReportFingerprint",
  "currentStorePathIdentity",
  "currentSchemaCatalogChecksum",
  "executedAtUtc",
] as const;
const VERIFIER_KEYS = [
  "schemaVersion",
  "ownerId",
  "verifierId",
  "verifierVersion",
  "algorithm",
  "saltHex",
  "derivedKeyHex",
  "cost",
  "blockSize",
  "parallelization",
  "keyLength",
] as const;

function fail(
  code: CollectionRunnerLocalOwnerAuthenticationErrorCode,
  message: string,
  cause?: unknown,
): never {
  throw new CollectionRunnerLocalOwnerAuthenticationError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function utc(value: unknown, label: string): number {
  if (
    typeof value !== "string" ||
    !UTC_MILLISECOND.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(Date.parse(value)).toISOString() !== value
  ) {
    fail(
      CollectionRunnerLocalOwnerAuthenticationErrorCode.InvalidInput,
      `${label} must be canonical UTC.`,
    );
  }
  return Date.parse(value);
}

function identifier(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    fail(
      CollectionRunnerLocalOwnerAuthenticationErrorCode.InvalidInput,
      `${label} must be a bounded canonical identifier.`,
    );
  }
}

function fingerprintValue(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== "string" || !FINGERPRINT.test(value)) {
    fail(
      CollectionRunnerLocalOwnerAuthenticationErrorCode.InvalidInput,
      `${label} must be a canonical fingerprint.`,
    );
  }
}

function validateVerifierRecord(
  value: CollectionRunnerLocalOwnerVerifierRecord,
): void {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== VERIFIER_KEYS.length ||
    VERIFIER_KEYS.some((key) => !(key in value)) ||
    Object.keys(value).some(
      (key) => !(VERIFIER_KEYS as readonly string[]).includes(key),
    ) ||
    value.schemaVersion !== "1.0" ||
    value.algorithm !== "SCRYPT_SHA256" ||
    value.cost !== 16384 ||
    value.blockSize !== 8 ||
    value.parallelization !== 1 ||
    value.keyLength !== 32
  ) {
    fail(
      CollectionRunnerLocalOwnerAuthenticationErrorCode.InvalidInput,
      "Local owner verifier policy is unsupported.",
    );
  }
  identifier(value.ownerId, "verifier.ownerId");
  identifier(value.verifierId, "verifier.verifierId");
  identifier(value.verifierVersion, "verifier.verifierVersion");
  if (
    value.saltHex.length < 32 ||
    value.saltHex.length > 128 ||
    value.saltHex.length % 2 !== 0 ||
    !HEX.test(value.saltHex) ||
    value.derivedKeyHex.length !== value.keyLength * 2 ||
    !HEX.test(value.derivedKeyHex)
  ) {
    fail(
      CollectionRunnerLocalOwnerAuthenticationErrorCode.InvalidInput,
      "Local owner verifier material is malformed.",
    );
  }
}

const cryptoExtensions = nodeCrypto as unknown as {
  readonly scryptSync: (
    secret: string,
    salt: Uint8Array,
    keyLength: number,
    options: Readonly<{
      N: number;
      r: number;
      p: number;
      maxmem: number;
    }>,
  ) => Uint8Array;
  readonly timingSafeEqual: (
    left: Uint8Array,
    right: Uint8Array,
  ) => boolean;
};

function bytesFromHex(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(
      value.slice(index * 2, index * 2 + 2),
      16,
    );
  }
  return bytes;
}

function hexFromBytes(value: Uint8Array): string {
  let result = "";
  for (const byte of value) {
    result += byte.toString(16).padStart(2, "0");
  }
  return result;
}

function deriveSecret(
  secret: string,
  saltHex: string,
  keyLength: number,
): Uint8Array {
  return cryptoExtensions.scryptSync(
    secret,
    bytesFromHex(saltHex),
    keyLength,
    {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    },
  );
}

export function deriveCollectionRunnerLocalOwnerSecretForProvisioning(
  secret: string,
  saltHex: string,
): string {
  if (
    typeof secret !== "string" ||
    secret.length < 12 ||
    secret.length > 1024 ||
    saltHex.length < 32 ||
    saltHex.length > 128 ||
    saltHex.length % 2 !== 0 ||
    !HEX.test(saltHex)
  ) {
    fail(
      CollectionRunnerLocalOwnerAuthenticationErrorCode.InvalidInput,
      "Provisioning input is invalid.",
    );
  }
  return hexFromBytes(deriveSecret(secret, saltHex, 32));
}

export class ScryptCollectionRunnerLocalOwnerVerifier
  implements CollectionRunnerLocalOwnerVerifier
{
  readonly #record: CollectionRunnerLocalOwnerVerifierRecord;

  public constructor(
    record: CollectionRunnerLocalOwnerVerifierRecord,
  ) {
    validateVerifierRecord(record);
    this.#record = Object.freeze(structuredClone(record));
  }

  public verify(
    input: VerifyCollectionRunnerLocalOwnerInput,
  ): CollectionRunnerLocalOwnerAuthorizationEvidence {
    identifier(input.ownerId, "ownerId");
    fingerprintValue(input.challengeFingerprint, "challengeFingerprint");
    const verifiedAt = utc(input.verifiedAtUtc, "verifiedAtUtc");
    const expiresAt = utc(input.expiresAtUtc, "expiresAtUtc");
    if (
      input.ownerId !== this.#record.ownerId ||
      typeof input.secret !== "string" ||
      input.secret.length < 12 ||
      input.secret.length > 1024 ||
      verifiedAt >= expiresAt ||
      expiresAt - verifiedAt > 5 * 60 * 1000
    ) {
      fail(
        CollectionRunnerLocalOwnerAuthenticationErrorCode.AuthenticationFailed,
        "Local owner authentication failed.",
      );
    }
    let derived: Uint8Array;
    try {
      derived = deriveSecret(
        input.secret,
        this.#record.saltHex,
        this.#record.keyLength,
      );
    } catch (cause) {
      return fail(
        CollectionRunnerLocalOwnerAuthenticationErrorCode.AuthenticationFailed,
        "Local owner authentication failed.",
        cause,
      );
    }
    const expected = bytesFromHex(this.#record.derivedKeyHex);
    if (
      derived.length !== expected.length ||
      !cryptoExtensions.timingSafeEqual(derived, expected)
    ) {
      fail(
        CollectionRunnerLocalOwnerAuthenticationErrorCode.AuthenticationFailed,
        "Local owner authentication failed.",
      );
    }
    const authorizationReference = fingerprint({
      ownerId: input.ownerId,
      verifierId: this.#record.verifierId,
      verifierVersion: this.#record.verifierVersion,
      challengeFingerprint: input.challengeFingerprint,
      verifiedAtUtc: input.verifiedAtUtc,
      expiresAtUtc: input.expiresAtUtc,
    });
    return Object.freeze({
      authorityKind: "LOCAL_OWNER_VERIFIED" as const,
      ownerId: input.ownerId,
      verifierId: this.#record.verifierId,
      verifierVersion: this.#record.verifierVersion,
      authorizationReference,
      challengeFingerprint: input.challengeFingerprint,
      verifiedAtUtc: input.verifiedAtUtc,
      expiresAtUtc: input.expiresAtUtc,
    });
  }
}

function validateCommand(
  value: unknown,
): asserts value is ExecuteCollectionRunnerOwnerCommand {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== COMMAND_KEYS.length ||
    COMMAND_KEYS.some((key) => !(key in value)) ||
    Object.keys(value).some(
      (key) => !(COMMAND_KEYS as readonly string[]).includes(key),
    )
  ) {
    fail(
      CollectionRunnerLocalOwnerAuthenticationErrorCode.InvalidInput,
      "Owner command contains missing or unknown fields.",
    );
  }
  if (value.schemaVersion !== "1.0") {
    fail(
      CollectionRunnerLocalOwnerAuthenticationErrorCode.InvalidInput,
      "Owner command schema is unsupported.",
    );
  }
  for (const key of [
    "commandId",
    "assessmentId",
    "decisionId",
    "reasonCode",
    "proposedBootIdentity",
    "proposedProcessSessionId",
  ] as const) {
    identifier(value[key], key);
  }
  for (const key of [
    "expectedAssessmentFingerprint",
    "currentRecoveryReportFingerprint",
    "currentStorePathIdentity",
    "currentSchemaCatalogChecksum",
  ] as const) {
    fingerprintValue(value[key], key);
  }
  if (
    typeof value.expectedActivationAggregateVersion !== "number" ||
    !Number.isSafeInteger(value.expectedActivationAggregateVersion) ||
    value.expectedActivationAggregateVersion < 1
  ) {
    fail(
      CollectionRunnerLocalOwnerAuthenticationErrorCode.InvalidInput,
      "Expected activation version must be a positive safe integer.",
    );
  }
  for (const key of [
    "verifiedAtUtc",
    "authorizationExpiresAtUtc",
    "decidedAtUtc",
    "decisionExpiresAtUtc",
    "executedAtUtc",
  ] as const) {
    utc(value[key], key);
  }
}

export class EventContractCollectionRunnerRecoveryControlOperator {
  readonly #engine =
    new EventContractCollectionRunnerRecoveryControlEngine();

  public constructor(
    private readonly repository:
      EventContractCollectionRunnerRecoveryControlRepository,
    private readonly verifier: CollectionRunnerLocalOwnerVerifier,
  ) {}

  public executeOwnerCommand(
    commandValue: unknown,
    secret: string,
  ): CollectionRunnerControlExecutionReceipt {
    validateCommand(commandValue);
    const command = structuredClone(commandValue);
    const assessment = this.repository.getRecoveryAssessment(
      command.assessmentId,
    );
    if (
      assessment === null ||
      assessment.fingerprint !== command.expectedAssessmentFingerprint ||
      assessment.activation === null ||
      assessment.activation.aggregateVersion !==
        command.expectedActivationAggregateVersion
    ) {
      fail(
        CollectionRunnerLocalOwnerAuthenticationErrorCode.AuthorityMismatch,
        "Owner command does not bind the exact persisted recovery assessment.",
      );
    }
    const challengeFingerprint = fingerprint(command);
    const ownerAuthorization = this.verifier.verify({
      ownerId: assessment.activation.ownerId,
      secret,
      challengeFingerprint,
      verifiedAtUtc: command.verifiedAtUtc,
      expiresAtUtc: command.authorizationExpiresAtUtc,
    });
    const decision = this.#engine.createOwnerRecoveryDecision({
      schemaVersion: COLLECTION_RUNNER_RECOVERY_CONTROL_SCHEMA_VERSION,
      decisionId: command.decisionId,
      assessment,
      expectedActivationAggregateVersion:
        command.expectedActivationAggregateVersion,
      ownerAuthorization,
      action: command.action,
      reasonCode: command.reasonCode,
      decidedAtUtc: command.decidedAtUtc,
      expiresAtUtc: command.decisionExpiresAtUtc,
      proposedBootIdentity: command.proposedBootIdentity,
      proposedProcessSessionId: command.proposedProcessSessionId,
      emergencyStopObserved: false,
    });
    this.repository.persistOwnerRecoveryDecision({
      decision,
      recordedAtUtc: command.decidedAtUtc,
    });
    return this.repository.executeOwnerRecoveryDecision({
      decisionId: decision.decisionId,
      expectedDecisionFingerprint: decision.fingerprint,
      currentRecoveryReportFingerprint:
        command.currentRecoveryReportFingerprint,
      currentStorePathIdentity: command.currentStorePathIdentity,
      currentSchemaCatalogChecksum: command.currentSchemaCatalogChecksum,
      executedAtUtc: command.executedAtUtc,
    });
  }

  public tripStopBarrier(
    barrier: CollectionRunnerProcessStopBarrier,
    reasonCode: string,
  ): void {
    barrier.trip(reasonCode);
  }

  public executeEmergencyStop(
    transaction: ExecuteEmergencyStopTransaction,
    barrier: CollectionRunnerProcessStopBarrier,
  ): CollectionRunnerControlExecutionReceipt {
    barrier.trip("EMERGENCY_STOP");
    return this.repository.executeEmergencyStop(transaction);
  }
}
