import { createHash, randomBytes } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve, sep } from "node:path";
import { hrtime, kill, pid } from "node:process";

import {
  EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION,
  CollectionRunnerClockSynchronizationStatus,
  CollectionRunnerRuntimeFoundationErrorCode,
  CollectionRunnerRuntimeMode,
  type CollectionRunnerBootIdentity,
  type CollectionRunnerBootIdentityPort,
  type CollectionRunnerClockHealthObservation,
  type CollectionRunnerClockHealthObservationInput,
  type CollectionRunnerClockHealthProbe,
  type CollectionRunnerMonotonicClock,
  type CollectionRunnerProcessLivenessPort,
  type CollectionRunnerProcessNoncePort,
  type CollectionRunnerRuntimeClockSnapshot,
  type CollectionRunnerRuntimeConfiguration,
  type CollectionRunnerRuntimeConfigurationInput,
  type CollectionRunnerRuntimeOwnership,
  type CollectionRunnerRuntimePaths,
  type CollectionRunnerWallClock,
} from "../../contracts";

const CONFIGURATION_KEYS = [
  "schemaVersion",
  "runtimeId",
  "runtimeMode",
  "runtimeControlRoot",
  "sqliteRoot",
  "storeId",
  "activationId",
  "applicationBuildFingerprint",
  "runnerDefinitionFingerprint",
  "frozenPlanFingerprint",
  "fixtureProviderFingerprint",
  "maximumClockOffsetMilliseconds",
  "maximumClockHealthAgeMilliseconds",
] as const;

const OWNERSHIP_KEYS = [
  "schemaVersion",
  "lockId",
  "configurationFingerprint",
  "pathFingerprint",
  "storePathIdentity",
  "activationId",
  "bootIdentity",
  "bootIdentitySource",
  "bootIdentitySourceVersion",
  "processId",
  "processNonceFingerprint",
  "processSessionId",
  "acquiredAtUtc",
  "fingerprint",
] as const;

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const STORE_ID = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const FINGERPRINT = /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const SHA256_FINGERPRINT = /^sha256:[0-9a-f]{64}$/u;
const PROCESS_SESSION_ID = /^process:sha256:[0-9a-f]{64}$/u;
const UTC_MILLISECOND =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export class EventContractCollectionRunnerRuntimeFoundationError extends Error {
  public constructor(
    public readonly code: CollectionRunnerRuntimeFoundationErrorCode,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = "EventContractCollectionRunnerRuntimeFoundationError";
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string,
  code = CollectionRunnerRuntimeFoundationErrorCode.InvalidConfiguration,
): void {
  const allowed = new Set(keys);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key)).sort();
  if (unknown.length > 0) {
    fail(
      code === CollectionRunnerRuntimeFoundationErrorCode.InvalidConfiguration
        ? CollectionRunnerRuntimeFoundationErrorCode.UnknownField
        : code,
      `${label} contains unknown field ${unknown[0]}.`,
    );
  }
  const missing = keys.filter((key) => !(key in value));
  if (missing.length > 0) {
    fail(
      code,
      `${label} is missing field ${missing[0]}.`,
    );
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

function sha256(value: string | Uint8Array): string {
  const hash = createHash("sha256");
  if (typeof value === "string") hash.update(value, "utf8");
  else hash.update(value);
  return `sha256:${hash.digest("hex")}`;
}

function fingerprint(value: unknown): string {
  return sha256(canonicalize(value));
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

function assertIdentifier(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidConfiguration,
      `${field} must be a canonical identifier.`,
    );
  }
}

function assertFingerprint(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== "string" || !FINGERPRINT.test(value)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidConfiguration,
      `${field} must be a canonical fingerprint.`,
    );
  }
}

function assertPositiveSafeInteger(
  value: unknown,
  field: string,
  maximum: number,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > maximum
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidConfiguration,
      `${field} must be a positive safe integer no greater than ${String(maximum)}.`,
    );
  }
}

function assertCanonicalUtc(
  value: unknown,
  field: string,
  code = CollectionRunnerRuntimeFoundationErrorCode.InvalidClockEvidence,
): asserts value is string {
  if (typeof value !== "string" || !UTC_MILLISECOND.test(value)) {
    fail(code, `${field} must be canonical millisecond UTC.`);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    fail(code, `${field} must be a real canonical millisecond UTC timestamp.`);
  }
}

function isWindowsUnc(path: string): boolean {
  return path.startsWith("\\\\") || path.startsWith("//");
}

function assertSafeRoot(path: string, label: string): string {
  if (path.trim() === "" || path.includes("\0") || isWindowsUnc(path)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidPath,
      `${label} must be a non-empty local filesystem path.`,
    );
  }

  const requested = resolve(path);
  try {
    mkdirSync(requested, { recursive: true });
    const requestedEntry = lstatSync(requested);
    if (requestedEntry.isSymbolicLink() || !requestedEntry.isDirectory()) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.UnsafeFilesystemEntry,
        `${label} must be a real local directory, not a link or file.`,
      );
    }
    const canonical = realpathSync(requested);
    if (isWindowsUnc(canonical)) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidPath,
        `${label} may not resolve to a UNC path.`,
      );
    }
    if (canonical.toLocaleLowerCase() !== requested.toLocaleLowerCase()) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.UnsafeFilesystemEntry,
        `${label} may not resolve through a substituted filesystem path.`,
      );
    }
    return canonical;
  } catch (error) {
    if (error instanceof EventContractCollectionRunnerRuntimeFoundationError) {
      throw error;
    }
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidPath,
      `${label} could not be prepared safely.`,
      error,
    );
  }
}

function assertRegularFileIfPresent(path: string, label: string): void {
  if (!existsSync(path)) return;
  const entry = lstatSync(path);
  if (entry.isSymbolicLink() || !entry.isFile()) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.UnsafeFilesystemEntry,
      `${label} must be a regular non-symbolic-link file.`,
    );
  }
}

export function createCollectionRunnerRuntimeConfiguration(
  value: unknown,
): CollectionRunnerRuntimeConfiguration {
  if (!isRecord(value)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidConfiguration,
      "Runtime configuration must be an object.",
    );
  }
  assertExactKeys(value, CONFIGURATION_KEYS, "Runtime configuration");
  if (
    value.schemaVersion !==
    EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidConfiguration,
      "Runtime configuration schema version is unsupported.",
    );
  }
  assertIdentifier(value.runtimeId, "runtimeId");
  if (value.runtimeMode !== CollectionRunnerRuntimeMode.FixtureOnly) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidConfiguration,
      "T3B11-T2 permits FIXTURE_ONLY runtime mode.",
    );
  }
  if (
    typeof value.runtimeControlRoot !== "string" ||
    typeof value.sqliteRoot !== "string"
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidConfiguration,
      "Runtime roots must be strings.",
    );
  }
  if (typeof value.storeId !== "string" || !STORE_ID.test(value.storeId)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidConfiguration,
      "storeId must be a lowercase traversal-free identifier.",
    );
  }
  assertIdentifier(value.activationId, "activationId");
  assertFingerprint(
    value.applicationBuildFingerprint,
    "applicationBuildFingerprint",
  );
  assertFingerprint(
    value.runnerDefinitionFingerprint,
    "runnerDefinitionFingerprint",
  );
  assertFingerprint(value.frozenPlanFingerprint, "frozenPlanFingerprint");
  assertFingerprint(
    value.fixtureProviderFingerprint,
    "fixtureProviderFingerprint",
  );
  assertPositiveSafeInteger(
    value.maximumClockOffsetMilliseconds,
    "maximumClockOffsetMilliseconds",
    60_000,
  );
  assertPositiveSafeInteger(
    value.maximumClockHealthAgeMilliseconds,
    "maximumClockHealthAgeMilliseconds",
    300_000,
  );

  const input = structuredClone(value) as unknown as
    CollectionRunnerRuntimeConfigurationInput;
  const base = {
    ...input,
    deterministic: true as const,
    networkPermitted: false as const,
    continuousRunPermitted: false as const,
    maximumWorkers: 1 as const,
  };
  return deepFreeze({
    ...base,
    fingerprint: fingerprint(base),
  }) as CollectionRunnerRuntimeConfiguration;
}

export function resolveCollectionRunnerRuntimePaths(
  configuration: CollectionRunnerRuntimeConfiguration,
): CollectionRunnerRuntimePaths {
  const runtimeControlRoot = assertSafeRoot(
    configuration.runtimeControlRoot,
    "runtimeControlRoot",
  );
  const sqliteRoot = assertSafeRoot(configuration.sqliteRoot, "sqliteRoot");
  const storePath = resolve(sqliteRoot, `${configuration.storeId}.sqlite3`);
  if (!storePath.startsWith(`${sqliteRoot}${sep}`)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidPath,
      "Resolved SQLite store path escaped sqliteRoot.",
    );
  }
  assertRegularFileIfPresent(storePath, "SQLite store");
  assertRegularFileIfPresent(`${storePath}-wal`, "SQLite WAL");
  assertRegularFileIfPresent(`${storePath}-shm`, "SQLite shared-memory file");

  const storePathIdentity = sha256(storePath.toLocaleLowerCase());
  const lockId = fingerprint({
    activationId: configuration.activationId,
    storePathIdentity,
  });
  const lockDirectory = resolve(
    runtimeControlRoot,
    `owner-${lockId.slice("sha256:".length)}.lock`,
  );
  if (!lockDirectory.startsWith(`${runtimeControlRoot}${sep}`)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidPath,
      "Resolved ownership-lock path escaped runtimeControlRoot.",
    );
  }
  const lockOwnerRecordPath = resolve(lockDirectory, "owner.json");
  const pathBase = {
    runtimeControlRoot,
    sqliteRoot,
    storePath,
    storePathIdentity,
    lockDirectory,
    lockOwnerRecordPath,
  };
  return deepFreeze({
    ...pathBase,
    pathFingerprint: fingerprint(pathBase),
  }) as CollectionRunnerRuntimePaths;
}

export class NodeCollectionRunnerProcessNoncePort
  implements CollectionRunnerProcessNoncePort
{
  public createNonce(): string {
    return sha256(randomBytes(32));
  }
}

export class NodeCollectionRunnerProcessLivenessPort
  implements CollectionRunnerProcessLivenessPort
{
  public isProcessAlive(processId: number): boolean {
    if (!Number.isSafeInteger(processId) || processId <= 0) return false;
    try {
      kill(processId, 0);
      return true;
    } catch (error) {
      if (
        isRecord(error) &&
        (error.code === "EPERM" || error.code === "EACCES")
      ) {
        return true;
      }
      return false;
    }
  }
}

export class SystemCollectionRunnerWallClock implements CollectionRunnerWallClock {
  public nowUtc(): string {
    return new Date().toISOString();
  }
}

export class SystemCollectionRunnerMonotonicClock
  implements CollectionRunnerMonotonicClock
{
  public nowNanoseconds(): bigint {
    return hrtime.bigint();
  }
}

export class FailClosedCollectionRunnerClockHealthProbe
  implements CollectionRunnerClockHealthProbe
{
  public constructor(private readonly wallClock: CollectionRunnerWallClock) {}

  public observe(): CollectionRunnerClockHealthObservationInput {
    const observedAtUtc = this.wallClock.nowUtc();
    return Object.freeze({
      observedAtUtc,
      synchronizationStatus:
        CollectionRunnerClockSynchronizationStatus.Unknown,
      estimatedAbsoluteUtcOffsetMilliseconds: null,
      source: "LOCAL_SYSTEM_UNVERIFIED",
      policyVersion: "1.0",
      freshnessDeadlineUtc: observedAtUtc,
    });
  }
}

export function createCollectionRunnerClockHealthObservation(
  value: unknown,
): CollectionRunnerClockHealthObservation {
  if (!isRecord(value)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidClockEvidence,
      "Clock-health observation must be an object.",
    );
  }
  assertExactKeys(
    value,
    [
      "observedAtUtc",
      "synchronizationStatus",
      "estimatedAbsoluteUtcOffsetMilliseconds",
      "source",
      "policyVersion",
      "freshnessDeadlineUtc",
    ],
    "Clock-health observation",
    CollectionRunnerRuntimeFoundationErrorCode.InvalidClockEvidence,
  );
  assertCanonicalUtc(value.observedAtUtc, "observedAtUtc");
  assertCanonicalUtc(value.freshnessDeadlineUtc, "freshnessDeadlineUtc");
  if (
    value.synchronizationStatus !==
      CollectionRunnerClockSynchronizationStatus.Synchronized &&
    value.synchronizationStatus !==
      CollectionRunnerClockSynchronizationStatus.Unsynchronized &&
    value.synchronizationStatus !==
      CollectionRunnerClockSynchronizationStatus.Unknown
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidClockEvidence,
      "Clock synchronization status is invalid.",
    );
  }
  if (
    value.estimatedAbsoluteUtcOffsetMilliseconds !== null &&
    (typeof value.estimatedAbsoluteUtcOffsetMilliseconds !== "number" ||
      !Number.isSafeInteger(value.estimatedAbsoluteUtcOffsetMilliseconds) ||
      value.estimatedAbsoluteUtcOffsetMilliseconds < 0)
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidClockEvidence,
      "Clock offset must be null or a non-negative safe integer.",
    );
  }
  if (
    typeof value.source !== "string" ||
    !IDENTIFIER.test(value.source) ||
    typeof value.policyVersion !== "string" ||
    !VERSION.test(value.policyVersion)
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidClockEvidence,
      "Clock source and policy version must be canonical.",
    );
  }
  if (
    Date.parse(value.freshnessDeadlineUtc as string) <
    Date.parse(value.observedAtUtc as string)
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidClockEvidence,
      "Clock-health freshness deadline cannot precede observation.",
    );
  }
  const base = structuredClone(value) as unknown as
    CollectionRunnerClockHealthObservationInput;
  return deepFreeze({
    ...base,
    fingerprint: fingerprint(base),
  }) as CollectionRunnerClockHealthObservation;
}

export function sampleHealthyCollectionRunnerClocks(
  configuration: CollectionRunnerRuntimeConfiguration,
  wallClock: CollectionRunnerWallClock,
  monotonicClock: CollectionRunnerMonotonicClock,
  healthProbe: CollectionRunnerClockHealthProbe,
): CollectionRunnerRuntimeClockSnapshot {
  const wallClockUtc = wallClock.nowUtc();
  assertCanonicalUtc(wallClockUtc, "wallClockUtc");
  const monotonicNanoseconds = monotonicClock.nowNanoseconds();
  if (typeof monotonicNanoseconds !== "bigint" || monotonicNanoseconds < 0n) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidClockEvidence,
      "Monotonic time must be a non-negative bigint.",
    );
  }
  const health = createCollectionRunnerClockHealthObservation(
    healthProbe.observe(),
  );
  const wallMilliseconds = Date.parse(wallClockUtc);
  const observedMilliseconds = Date.parse(health.observedAtUtc);
  const freshnessMilliseconds = Date.parse(health.freshnessDeadlineUtc);
  const age = wallMilliseconds - observedMilliseconds;
  if (
    health.synchronizationStatus !==
      CollectionRunnerClockSynchronizationStatus.Synchronized ||
    health.estimatedAbsoluteUtcOffsetMilliseconds === null ||
    health.estimatedAbsoluteUtcOffsetMilliseconds >
      configuration.maximumClockOffsetMilliseconds ||
    age < 0 ||
    age > configuration.maximumClockHealthAgeMilliseconds ||
    wallMilliseconds > freshnessMilliseconds
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.ClockUnhealthy,
      "Clock-health evidence is unavailable, stale, unsynchronized, or outside policy.",
    );
  }
  return deepFreeze({
    wallClockUtc,
    monotonicNanoseconds,
    health,
    healthy: true as const,
  }) as CollectionRunnerRuntimeClockSnapshot;
}

function validateBootIdentity(value: unknown): CollectionRunnerBootIdentity {
  if (!isRecord(value)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidBootIdentity,
      "Boot identity must be an object.",
    );
  }
  assertExactKeys(
    value,
    ["bootIdentity", "source", "sourceVersion"],
    "Boot identity",
    CollectionRunnerRuntimeFoundationErrorCode.InvalidBootIdentity,
  );
  for (const field of ["bootIdentity", "source"] as const) {
    if (typeof value[field] !== "string" || !IDENTIFIER.test(value[field])) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidBootIdentity,
        `${field} must be a canonical identifier.`,
      );
    }
  }
  if (
    typeof value.sourceVersion !== "string" ||
    !VERSION.test(value.sourceVersion)
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidBootIdentity,
      "sourceVersion must be canonical.",
    );
  }
  return deepFreeze(structuredClone(value)) as unknown as
    CollectionRunnerBootIdentity;
}

function createOwnershipRecord(
  configuration: CollectionRunnerRuntimeConfiguration,
  paths: CollectionRunnerRuntimePaths,
  bootIdentity: CollectionRunnerBootIdentity,
  processId: number,
  processNonceFingerprint: string,
  acquiredAtUtc: string,
): CollectionRunnerRuntimeOwnership {
  if (!Number.isSafeInteger(processId) || processId <= 0) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidProcessIdentity,
      "Process ID must be a positive safe integer.",
    );
  }
  if (!SHA256_FINGERPRINT.test(processNonceFingerprint)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidProcessIdentity,
      "Process nonce must be an OS-CSPRNG-derived SHA-256 fingerprint.",
    );
  }
  assertCanonicalUtc(
    acquiredAtUtc,
    "acquiredAtUtc",
    CollectionRunnerRuntimeFoundationErrorCode.InvalidProcessIdentity,
  );
  const lockId = fingerprint({
    activationId: configuration.activationId,
    storePathIdentity: paths.storePathIdentity,
  });
  const processSessionId = `process:${fingerprint({
    activationId: configuration.activationId,
    applicationBuildFingerprint: configuration.applicationBuildFingerprint,
    bootIdentity: bootIdentity.bootIdentity,
    configurationFingerprint: configuration.fingerprint,
    pathFingerprint: paths.pathFingerprint,
    processId,
    processNonceFingerprint,
    storePathIdentity: paths.storePathIdentity,
  })}`;
  const base = {
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION,
    lockId,
    configurationFingerprint: configuration.fingerprint,
    pathFingerprint: paths.pathFingerprint,
    storePathIdentity: paths.storePathIdentity,
    activationId: configuration.activationId,
    bootIdentity: bootIdentity.bootIdentity,
    bootIdentitySource: bootIdentity.source,
    bootIdentitySourceVersion: bootIdentity.sourceVersion,
    processId,
    processNonceFingerprint,
    processSessionId,
    acquiredAtUtc,
  };
  return deepFreeze({
    ...base,
    fingerprint: fingerprint(base),
  }) as CollectionRunnerRuntimeOwnership;
}

function validateOwnershipRecord(
  value: unknown,
): CollectionRunnerRuntimeOwnership {
  if (!isRecord(value)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.OwnershipLost,
      "Ownership record must be an object.",
    );
  }
  assertExactKeys(
    value,
    OWNERSHIP_KEYS,
    "Ownership record",
    CollectionRunnerRuntimeFoundationErrorCode.OwnershipLost,
  );
  if (
    value.schemaVersion !==
      EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION ||
    typeof value.lockId !== "string" ||
    !SHA256_FINGERPRINT.test(value.lockId) ||
    typeof value.configurationFingerprint !== "string" ||
    !SHA256_FINGERPRINT.test(value.configurationFingerprint) ||
    typeof value.pathFingerprint !== "string" ||
    !SHA256_FINGERPRINT.test(value.pathFingerprint) ||
    typeof value.storePathIdentity !== "string" ||
    !SHA256_FINGERPRINT.test(value.storePathIdentity) ||
    typeof value.activationId !== "string" ||
    !IDENTIFIER.test(value.activationId) ||
    typeof value.bootIdentity !== "string" ||
    !IDENTIFIER.test(value.bootIdentity) ||
    typeof value.bootIdentitySource !== "string" ||
    !IDENTIFIER.test(value.bootIdentitySource) ||
    typeof value.bootIdentitySourceVersion !== "string" ||
    !VERSION.test(value.bootIdentitySourceVersion) ||
    typeof value.processId !== "number" ||
    !Number.isSafeInteger(value.processId) ||
    value.processId <= 0 ||
    typeof value.processNonceFingerprint !== "string" ||
    !SHA256_FINGERPRINT.test(value.processNonceFingerprint) ||
    typeof value.processSessionId !== "string" ||
    !PROCESS_SESSION_ID.test(value.processSessionId) ||
    typeof value.fingerprint !== "string" ||
    !SHA256_FINGERPRINT.test(value.fingerprint)
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.OwnershipLost,
      "Ownership record contains invalid identity evidence.",
    );
  }
  assertCanonicalUtc(
    value.acquiredAtUtc,
    "acquiredAtUtc",
    CollectionRunnerRuntimeFoundationErrorCode.OwnershipLost,
  );
  const { fingerprint: declaredFingerprint, ...base } = value;
  if (fingerprint(base) !== declaredFingerprint) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.OwnershipLost,
      "Ownership record fingerprint does not match its content.",
    );
  }
  return deepFreeze(structuredClone(value)) as unknown as
    CollectionRunnerRuntimeOwnership;
}

function readOwnershipRecord(
  paths: CollectionRunnerRuntimePaths,
): CollectionRunnerRuntimeOwnership {
  try {
    const lockEntry = lstatSync(paths.lockDirectory);
    const ownerEntry = lstatSync(paths.lockOwnerRecordPath);
    if (
      lockEntry.isSymbolicLink() ||
      !lockEntry.isDirectory() ||
      ownerEntry.isSymbolicLink() ||
      !ownerEntry.isFile() ||
      ownerEntry.size > 16_384
    ) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.OwnershipLost,
        "Ownership filesystem evidence is unsafe.",
      );
    }
    const serialized = readFileSync(paths.lockOwnerRecordPath, "utf8");
    const parsed = JSON.parse(serialized) as unknown;
    if (canonicalize(parsed) !== serialized) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.OwnershipLost,
        "Ownership record is not canonical.",
      );
    }
    return validateOwnershipRecord(parsed);
  } catch (error) {
    if (error instanceof EventContractCollectionRunnerRuntimeFoundationError) {
      throw error;
    }
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.OwnershipLost,
      "Ownership record is missing, unreadable, or malformed.",
      error,
    );
  }
}

export class CollectionRunnerRuntimeOwnershipHandle {
  #released = false;

  public constructor(
    private readonly paths: CollectionRunnerRuntimePaths,
    public readonly ownership: CollectionRunnerRuntimeOwnership,
  ) {}

  public verify(): CollectionRunnerRuntimeOwnership {
    if (this.#released) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.OwnershipLost,
        "Released ownership cannot be verified.",
      );
    }
    const current = readOwnershipRecord(this.paths);
    if (
      current.fingerprint !== this.ownership.fingerprint ||
      current.processSessionId !== this.ownership.processSessionId
    ) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.OwnershipLost,
        "Runtime ownership changed after acquisition.",
      );
    }
    return current;
  }

  public releaseCleanly(): void {
    this.verify();
    try {
      unlinkSync(this.paths.lockOwnerRecordPath);
      rmdirSync(this.paths.lockDirectory);
      this.#released = true;
    } catch (error) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.OwnershipLost,
        "Runtime ownership could not be released cleanly.",
        error,
      );
    }
  }
}

export interface AcquireCollectionRunnerRuntimeOwnershipOptions {
  readonly configuration: CollectionRunnerRuntimeConfiguration;
  readonly paths: CollectionRunnerRuntimePaths;
  readonly bootIdentityPort: CollectionRunnerBootIdentityPort;
  readonly processNoncePort?: CollectionRunnerProcessNoncePort;
  readonly processId?: number;
  readonly wallClock: CollectionRunnerWallClock;
}

export function acquireCollectionRunnerRuntimeOwnership(
  options: AcquireCollectionRunnerRuntimeOwnershipOptions,
): CollectionRunnerRuntimeOwnershipHandle {
  if (
    options.paths.pathFingerprint !==
    resolveCollectionRunnerRuntimePaths(options.configuration).pathFingerprint
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidPath,
      "Runtime paths do not match the immutable configuration.",
    );
  }
  try {
    mkdirSync(options.paths.lockDirectory);
  } catch (error) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.DuplicateProcess,
      "Runtime ownership is already held or requires explicit stale-lock recovery.",
      error,
    );
  }

  try {
    const bootIdentity = validateBootIdentity(
      options.bootIdentityPort.readBootIdentity(),
    );
    const processNonceFingerprint = (
      options.processNoncePort ?? new NodeCollectionRunnerProcessNoncePort()
    ).createNonce();
    const acquiredAtUtc = options.wallClock.nowUtc();
    const ownership = createOwnershipRecord(
      options.configuration,
      options.paths,
      bootIdentity,
      options.processId ?? pid,
      processNonceFingerprint,
      acquiredAtUtc,
    );
    const descriptor = openSync(options.paths.lockOwnerRecordPath, "wx");
    try {
      writeFileSync(descriptor, canonicalize(ownership), {
        encoding: "utf8",
      });
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    return new CollectionRunnerRuntimeOwnershipHandle(
      options.paths,
      ownership,
    );
  } catch (error) {
    if (error instanceof EventContractCollectionRunnerRuntimeFoundationError) {
      throw error;
    }
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.OwnershipInitializationFailed,
      "Runtime ownership initialization failed; the lock remains fail closed.",
      error,
    );
  }
}
