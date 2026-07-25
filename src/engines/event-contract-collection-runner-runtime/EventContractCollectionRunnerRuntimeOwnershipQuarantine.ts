import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve, sep } from "node:path";
import { kill } from "node:process";

import {
  CollectionRunnerRuntimeFoundationErrorCode,
  CollectionRunnerRuntimeOwnershipLiveness,
  EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_OWNERSHIP_RECOVERY_SCHEMA_VERSION,
  type CollectionRunnerBootIdentityPort,
  type CollectionRunnerRuntimeConfiguration,
  type CollectionRunnerRuntimeOwnershipRecoveryAssessment,
  type CollectionRunnerRuntimeOwnershipRecoveryCommand,
  type CollectionRunnerRuntimeOwnershipRecoveryDecision,
  type CollectionRunnerRuntimeOwnershipRecoveryInspectionInput,
  type CollectionRunnerRuntimeOwnershipRecoveryReceipt,
  type CollectionRunnerRuntimeOwnershipRecoveryStoreEvidence,
  type CollectionRunnerRuntimePaths,
} from "../../contracts";
import type { CollectionRunnerLocalOwnerVerifier } from "../event-contract-collection-runner-recovery-control/EventContractCollectionRunnerRecoveryControlOperator";
import {
  EventContractCollectionRunnerRuntimeFoundationError,
  readCollectionRunnerRuntimeOwnership,
  resolveCollectionRunnerRuntimePaths,
  verifyCollectionRunnerBootIdentity,
} from "./EventContractCollectionRunnerRuntimeFoundation";
import {
  EventContractCollectionRunnerRuntimeOwnershipRecoveryEngine,
  fingerprintCollectionRunnerRuntimeOwnershipRecovery,
} from "./EventContractCollectionRunnerRuntimeOwnershipRecovery";

const RECEIPT_FILE_NAME = "ownership-recovery-receipt.json";
const GUARD_FILE_NAME = "guard.json";
const QUARANTINE_DIRECTORY_NAME = "ownership-quarantine";
const MAXIMUM_RECOVERY_FILE_BYTES = 65_536;

export interface CollectionRunnerRuntimeProcessLivenessObservationPort {
  observe(
    processId: number,
  ): CollectionRunnerRuntimeOwnershipLiveness;
}

export class NodeCollectionRunnerRuntimeProcessLivenessObservationPort
  implements CollectionRunnerRuntimeProcessLivenessObservationPort
{
  public constructor(
    private readonly probe: (processId: number) => void = (processId) =>
      kill(processId, 0),
  ) {}

  public observe(
    processId: number,
  ): CollectionRunnerRuntimeOwnershipLiveness {
    if (!Number.isSafeInteger(processId) || processId <= 0) {
      return CollectionRunnerRuntimeOwnershipLiveness.Unknown;
    }
    try {
      this.probe(processId);
      return CollectionRunnerRuntimeOwnershipLiveness.Live;
    } catch (error) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : null;
      if (code === "ESRCH") {
        return CollectionRunnerRuntimeOwnershipLiveness.NotLive;
      }
      if (code === "EPERM" || code === "EACCES") {
        return CollectionRunnerRuntimeOwnershipLiveness.Live;
      }
      return CollectionRunnerRuntimeOwnershipLiveness.Unknown;
    }
  }
}

export interface InspectCollectionRunnerRuntimeOwnershipRecoveryOptions {
  readonly configuration: CollectionRunnerRuntimeConfiguration;
  readonly paths: CollectionRunnerRuntimePaths;
  readonly bootIdentityPort: CollectionRunnerBootIdentityPort;
  readonly processLivenessPort: CollectionRunnerRuntimeProcessLivenessObservationPort;
  readonly storeEvidence: CollectionRunnerRuntimeOwnershipRecoveryStoreEvidence;
  readonly inspectedAtUtc: string;
  readonly expiresAtUtc: string;
  readonly policyVersion: string;
}

export interface AuthorizeCollectionRunnerRuntimeOwnershipRecoveryOptions {
  readonly assessment: CollectionRunnerRuntimeOwnershipRecoveryAssessment;
  readonly command: CollectionRunnerRuntimeOwnershipRecoveryCommand;
  readonly secret: string;
  readonly verifier: CollectionRunnerLocalOwnerVerifier;
}

export interface ExecuteCollectionRunnerRuntimeOwnershipQuarantineOptions {
  readonly configuration: CollectionRunnerRuntimeConfiguration;
  readonly paths: CollectionRunnerRuntimePaths;
  readonly assessment: CollectionRunnerRuntimeOwnershipRecoveryAssessment;
  readonly decision: CollectionRunnerRuntimeOwnershipRecoveryDecision;
  readonly executedAtUtc: string;
  readonly reinspect: () => CollectionRunnerRuntimeOwnershipRecoveryAssessment;
}

interface OwnershipRecoveryGuardRecord {
  readonly schemaVersion: "1.0";
  readonly assessmentFingerprint: string;
  readonly decisionFingerprint: string;
  readonly ownershipFingerprint: string;
  readonly quarantineDirectoryIdentity: string;
  readonly deterministic: true;
  readonly fingerprint: string;
}

function fail(
  code: CollectionRunnerRuntimeFoundationErrorCode,
  message: string,
  cause?: unknown,
): never {
  throw new EventContractCollectionRunnerRuntimeFoundationError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function isFoundationError(
  value: unknown,
): value is EventContractCollectionRunnerRuntimeFoundationError {
  return value instanceof EventContractCollectionRunnerRuntimeFoundationError;
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

function safeDirectory(path: string, label: string): void {
  try {
    const entry = lstatSync(path);
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode
          .OwnershipRecoveryFilesystemFailure,
        `${label} is not a safe regular directory.`,
      );
    }
  } catch (error) {
    if (isFoundationError(error)) throw error;
    fail(
      CollectionRunnerRuntimeFoundationErrorCode
        .OwnershipRecoveryFilesystemFailure,
      `${label} is missing or unreadable.`,
      error,
    );
  }
}

function safeRegularFile(path: string, label: string): void {
  try {
    const entry = lstatSync(path);
    if (
      entry.isSymbolicLink() ||
      !entry.isFile() ||
      entry.size > MAXIMUM_RECOVERY_FILE_BYTES
    ) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode
          .OwnershipRecoveryFilesystemFailure,
        `${label} is not a safe bounded regular file.`,
      );
    }
  } catch (error) {
    if (isFoundationError(error)) throw error;
    fail(
      CollectionRunnerRuntimeFoundationErrorCode
        .OwnershipRecoveryFilesystemFailure,
      `${label} is missing or unreadable.`,
      error,
    );
  }
}

function writeCanonicalExclusive(path: string, value: unknown): void {
  let descriptor: number;
  try {
    descriptor = openSync(path, "wx");
  } catch (error) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.OwnershipRecoveryConflict,
      "Recovery evidence already exists or cannot be created exclusively.",
      error,
    );
  }
  try {
    writeFileSync(descriptor, canonicalize(value), { encoding: "utf8" });
    fsyncSync(descriptor);
  } catch (error) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode
        .OwnershipRecoveryFilesystemFailure,
      "Recovery evidence could not be written and flushed.",
      error,
    );
  } finally {
    closeSync(descriptor);
  }
}

function readCanonical(path: string, label: string): unknown {
  safeRegularFile(path, label);
  try {
    const serialized = readFileSync(path, "utf8");
    const parsed = JSON.parse(serialized) as unknown;
    if (canonicalize(parsed) !== serialized) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode
          .OwnershipRecoveryFilesystemFailure,
        `${label} is not canonical.`,
      );
    }
    return parsed;
  } catch (error) {
    if (isFoundationError(error)) throw error;
    fail(
      CollectionRunnerRuntimeFoundationErrorCode
        .OwnershipRecoveryFilesystemFailure,
      `${label} is unreadable or malformed.`,
      error,
    );
  }
}

function validateExactPaths(
  configuration: CollectionRunnerRuntimeConfiguration,
  paths: CollectionRunnerRuntimePaths,
): void {
  const expected = resolveCollectionRunnerRuntimePaths(configuration);
  if (
    paths.pathFingerprint !== expected.pathFingerprint ||
    paths.lockDirectory !== expected.lockDirectory ||
    paths.runtimeControlRoot !== expected.runtimeControlRoot
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode
        .InvalidOwnershipRecoveryInput,
      "Ownership recovery paths do not match immutable configuration.",
    );
  }
}

export function inspectCollectionRunnerRuntimeOwnershipRecovery(
  options: InspectCollectionRunnerRuntimeOwnershipRecoveryOptions,
): CollectionRunnerRuntimeOwnershipRecoveryAssessment {
  validateExactPaths(options.configuration, options.paths);
  let ownership;
  let lockEvidenceFingerprint: string;
  try {
    ownership = readCollectionRunnerRuntimeOwnership(options.paths);
    lockEvidenceFingerprint = ownership.fingerprint;
  } catch {
    ownership = null;
    lockEvidenceFingerprint = fingerprintUnsafeLockEvidence(options.paths);
  }
  const currentBoot = verifyCollectionRunnerBootIdentity(
    options.bootIdentityPort.readBootIdentity(),
  );
  const processLiveness =
    ownership === null
      ? CollectionRunnerRuntimeOwnershipLiveness.Unknown
      : options.processLivenessPort.observe(ownership.processId);
  const lockDirectoryIdentity =
    fingerprintCollectionRunnerRuntimeOwnershipRecovery(
      options.paths.lockDirectory.toLocaleLowerCase(),
    );
  const input: CollectionRunnerRuntimeOwnershipRecoveryInspectionInput = {
    schemaVersion:
      EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_OWNERSHIP_RECOVERY_SCHEMA_VERSION,
    configurationFingerprint: options.configuration.fingerprint,
    pathFingerprint: options.paths.pathFingerprint,
    lockDirectoryIdentity,
    lockEvidenceFingerprint,
    ownership,
    currentBootIdentity: currentBoot.bootIdentity,
    processLiveness,
    storeEvidence: options.storeEvidence,
    inspectedAtUtc: options.inspectedAtUtc,
    expiresAtUtc: options.expiresAtUtc,
    policyVersion: options.policyVersion,
  };
  return new EventContractCollectionRunnerRuntimeOwnershipRecoveryEngine()
    .createAssessment(input);
}

function fingerprintUnsafeLockEvidence(
  paths: CollectionRunnerRuntimePaths,
): string {
  try {
    const lock = lstatSync(paths.lockDirectory);
    const owner = lstatSync(paths.lockOwnerRecordPath);
    if (
      lock.isSymbolicLink() ||
      !lock.isDirectory() ||
      owner.isSymbolicLink() ||
      !owner.isFile() ||
      owner.size > MAXIMUM_RECOVERY_FILE_BYTES
    ) {
      return fingerprintCollectionRunnerRuntimeOwnershipRecovery({
        lockDirectoryIdentity:
          fingerprintCollectionRunnerRuntimeOwnershipRecovery(
            paths.lockDirectory.toLocaleLowerCase(),
          ),
        status: "UNSAFE_LOCK_EVIDENCE",
      });
    }
    return fingerprintCollectionRunnerRuntimeOwnershipRecovery(
      readFileSync(paths.lockOwnerRecordPath, "utf8"),
    );
  } catch {
    return fingerprintCollectionRunnerRuntimeOwnershipRecovery({
      lockDirectoryIdentity:
        fingerprintCollectionRunnerRuntimeOwnershipRecovery(
          paths.lockDirectory.toLocaleLowerCase(),
        ),
      status: "MISSING_OR_UNREADABLE_LOCK_EVIDENCE",
    });
  }
}

export function authorizeCollectionRunnerRuntimeOwnershipRecovery(
  options: AuthorizeCollectionRunnerRuntimeOwnershipRecoveryOptions,
): CollectionRunnerRuntimeOwnershipRecoveryDecision {
  const engine =
    new EventContractCollectionRunnerRuntimeOwnershipRecoveryEngine();
  const challengeFingerprint = engine.createChallengeFingerprint(
    options.command,
    options.assessment,
  );
  const ownerAuthorization = options.verifier.verify({
    ownerId: options.command.ownerId,
    secret: options.secret,
    challengeFingerprint,
    verifiedAtUtc: options.command.decidedAtUtc,
    expiresAtUtc: options.command.expiresAtUtc,
  });
  return engine.createDecision(
    options.command,
    options.assessment,
    ownerAuthorization,
  );
}

function createGuard(
  assessment: CollectionRunnerRuntimeOwnershipRecoveryAssessment,
  decision: CollectionRunnerRuntimeOwnershipRecoveryDecision,
  quarantineDirectoryIdentity: string,
): OwnershipRecoveryGuardRecord {
  if (assessment.ownership === null) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.OwnershipRecoveryBlocked,
      "Invalid ownership evidence cannot create a recovery guard.",
    );
  }
  const base = {
    schemaVersion: "1.0" as const,
    assessmentFingerprint: assessment.fingerprint,
    decisionFingerprint: decision.fingerprint,
    ownershipFingerprint: assessment.ownership.fingerprint,
    quarantineDirectoryIdentity,
    deterministic: true as const,
  };
  return Object.freeze({
    ...base,
    fingerprint: fingerprintCollectionRunnerRuntimeOwnershipRecovery(base),
  });
}

function verifyGuard(
  value: unknown,
  expected: OwnershipRecoveryGuardRecord,
): void {
  if (canonicalize(value) !== canonicalize(expected)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.OwnershipRecoveryConflict,
      "Recovery guard belongs to a different decision.",
    );
  }
}

function ensureQuarantineRoot(runtimeControlRoot: string): string {
  const quarantineRoot = resolve(
    runtimeControlRoot,
    QUARANTINE_DIRECTORY_NAME,
  );
  if (!quarantineRoot.startsWith(`${runtimeControlRoot}${sep}`)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode
        .OwnershipRecoveryFilesystemFailure,
      "Ownership quarantine path escaped runtime control root.",
    );
  }
  if (!existsSync(quarantineRoot)) {
    try {
      mkdirSync(quarantineRoot);
    } catch (error) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode
          .OwnershipRecoveryFilesystemFailure,
        "Ownership quarantine root could not be created.",
        error,
      );
    }
  }
  safeDirectory(quarantineRoot, "Ownership quarantine root");
  return quarantineRoot;
}

function verifyQuarantinedEvidence(
  quarantineDirectory: string,
  expectedOwnershipFingerprint: string,
  expectedReceipt: CollectionRunnerRuntimeOwnershipRecoveryReceipt,
  engine: EventContractCollectionRunnerRuntimeOwnershipRecoveryEngine,
  assessment: CollectionRunnerRuntimeOwnershipRecoveryAssessment,
  decision: CollectionRunnerRuntimeOwnershipRecoveryDecision,
): CollectionRunnerRuntimeOwnershipRecoveryReceipt {
  safeDirectory(quarantineDirectory, "Ownership quarantine directory");
  const owner = readCanonical(
    resolve(quarantineDirectory, "owner.json"),
    "Quarantined ownership record",
  ) as { readonly fingerprint?: unknown };
  if (owner.fingerprint !== expectedOwnershipFingerprint) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.OwnershipRecoveryConflict,
      "Quarantined ownership does not match the exact stale owner.",
    );
  }
  const receipt = readCanonical(
    resolve(quarantineDirectory, RECEIPT_FILE_NAME),
    "Ownership recovery receipt",
  ) as CollectionRunnerRuntimeOwnershipRecoveryReceipt;
  const verifiedReceipt = engine.verifyReceipt(
    receipt,
    assessment,
    decision,
  );
  if (canonicalize(receipt) !== canonicalize(expectedReceipt)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.OwnershipRecoveryConflict,
      "Quarantined receipt conflicts with exact replay.",
    );
  }
  return verifiedReceipt;
}

function releaseExactGuard(
  guardDirectory: string,
  expected: OwnershipRecoveryGuardRecord,
): void {
  if (!existsSync(guardDirectory)) return;
  safeDirectory(guardDirectory, "Ownership recovery guard");
  const guardPath = resolve(guardDirectory, GUARD_FILE_NAME);
  if (!existsSync(guardPath)) {
    try {
      rmdirSync(guardDirectory);
      return;
    } catch (error) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode
          .OwnershipRecoveryFilesystemFailure,
        "Incomplete recovery guard is not safely empty.",
        error,
      );
    }
  }
  verifyGuard(readCanonical(guardPath, "Ownership recovery guard"), expected);
  try {
    unlinkSync(guardPath);
    rmdirSync(guardDirectory);
  } catch (error) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode
        .OwnershipRecoveryFilesystemFailure,
      "Verified recovery guard could not be released.",
      error,
    );
  }
}

export function executeCollectionRunnerRuntimeOwnershipQuarantine(
  options: ExecuteCollectionRunnerRuntimeOwnershipQuarantineOptions,
): CollectionRunnerRuntimeOwnershipRecoveryReceipt {
  validateExactPaths(options.configuration, options.paths);
  const engine =
    new EventContractCollectionRunnerRuntimeOwnershipRecoveryEngine();
  const assessment = engine.verifyAssessment(options.assessment);
  const decision = engine.verifyDecision(options.decision, assessment);
  if (assessment.ownership === null) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.OwnershipRecoveryBlocked,
      "Invalid ownership evidence cannot be quarantined.",
    );
  }
  const quarantineRoot = ensureQuarantineRoot(
    options.paths.runtimeControlRoot,
  );
  const suffix = decision.fingerprint.slice("sha256:".length);
  const quarantineDirectory = resolve(
    quarantineRoot,
    `${assessment.ownership.lockId.slice("sha256:".length)}-${suffix}.quarantine`,
  );
  if (!quarantineDirectory.startsWith(`${quarantineRoot}${sep}`)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode
        .OwnershipRecoveryFilesystemFailure,
      "Resolved quarantine destination escaped the reviewed root.",
    );
  }
  const quarantineDirectoryIdentity =
    fingerprintCollectionRunnerRuntimeOwnershipRecovery(
      quarantineDirectory.toLocaleLowerCase(),
    );
  const receipt = engine.createReceipt(
    assessment,
    decision,
    quarantineDirectoryIdentity,
    options.executedAtUtc,
  );
  const guard = createGuard(
    assessment,
    decision,
    quarantineDirectoryIdentity,
  );
  const guardDirectory = `${options.paths.lockDirectory}.recovery-guard`;
  const guardPath = resolve(guardDirectory, GUARD_FILE_NAME);

  if (existsSync(quarantineDirectory)) {
    if (existsSync(options.paths.lockDirectory)) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.OwnershipRecoveryConflict,
        "Both active and quarantined ownership evidence exist.",
      );
    }
    const replay = verifyQuarantinedEvidence(
      quarantineDirectory,
      assessment.ownership.fingerprint,
      receipt,
      engine,
      assessment,
      decision,
    );
    releaseExactGuard(guardDirectory, guard);
    return replay;
  }
  if (!existsSync(options.paths.lockDirectory)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.OwnershipRecoveryConflict,
      "Exact active or quarantined ownership evidence is absent.",
    );
  }
  try {
    safeDirectory(options.paths.lockDirectory, "Ownership lock directory");
    safeDirectory(quarantineRoot, "Ownership quarantine root");
    const lockDevice = statSync(options.paths.lockDirectory, {
      bigint: true,
    }).dev;
    const quarantineDevice = statSync(quarantineRoot, {
      bigint: true,
    }).dev;
    if (lockDevice !== quarantineDevice) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode
          .OwnershipRecoveryFilesystemFailure,
        "Ownership lock and quarantine root are not on the same filesystem.",
      );
    }
  } catch (error) {
    if (isFoundationError(error)) throw error;
    fail(
      CollectionRunnerRuntimeFoundationErrorCode
        .OwnershipRecoveryFilesystemFailure,
      "Ownership quarantine filesystem identity could not be verified.",
      error,
    );
  }

  if (!existsSync(guardDirectory)) {
    try {
      mkdirSync(guardDirectory);
      writeCanonicalExclusive(guardPath, guard);
    } catch (error) {
      if (isFoundationError(error)) throw error;
      fail(
        CollectionRunnerRuntimeFoundationErrorCode
          .OwnershipRecoveryFilesystemFailure,
        "Ownership recovery guard could not be acquired.",
        error,
      );
    }
  } else {
    safeDirectory(guardDirectory, "Ownership recovery guard");
    verifyGuard(readCanonical(guardPath, "Ownership recovery guard"), guard);
  }

  const currentAssessment = engine.verifyAssessment(options.reinspect());
  if (
    currentAssessment.fingerprint !== assessment.fingerprint ||
    currentAssessment.ownership === null ||
    currentAssessment.ownership.fingerprint !==
      assessment.ownership.fingerprint ||
    !currentAssessment.eligibleForOwnerReview
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.OwnershipRecoveryConflict,
      "Ownership recovery evidence changed after Owner authorization.",
    );
  }
  const currentOwnership = readCollectionRunnerRuntimeOwnership(options.paths);
  if (currentOwnership.fingerprint !== assessment.ownership.fingerprint) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.OwnershipRecoveryConflict,
      "Ownership record changed before quarantine.",
    );
  }

  const receiptPath = resolve(
    options.paths.lockDirectory,
    RECEIPT_FILE_NAME,
  );
  if (existsSync(receiptPath)) {
    const existing = readCanonical(
      receiptPath,
      "Ownership recovery receipt",
    ) as CollectionRunnerRuntimeOwnershipRecoveryReceipt;
    engine.verifyReceipt(existing, assessment, decision);
    if (canonicalize(existing) !== canonicalize(receipt)) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.OwnershipRecoveryConflict,
        "Existing ownership recovery receipt conflicts with replay.",
      );
    }
  } else {
    writeCanonicalExclusive(receiptPath, receipt);
  }

  try {
    renameSync(options.paths.lockDirectory, quarantineDirectory);
  } catch (error) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode
        .OwnershipRecoveryFilesystemFailure,
      "Ownership quarantine rename did not complete.",
      error,
    );
  }
  const verified = verifyQuarantinedEvidence(
    quarantineDirectory,
    assessment.ownership.fingerprint,
    receipt,
    engine,
    assessment,
    decision,
  );
  releaseExactGuard(guardDirectory, guard);
  return verified;
}
