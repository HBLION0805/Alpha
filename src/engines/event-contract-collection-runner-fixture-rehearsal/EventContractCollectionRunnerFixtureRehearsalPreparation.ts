import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, sep } from "node:path";
import { env } from "node:process";

import {
  CollectionRunnerPilotState,
  CollectionRunnerRehearsalLifecycleState,
  CollectionRunnerRuntimeMode,
  EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION,
  type CollectionRunnerRehearsalFixtureCatalogEntry,
  type CollectionRunnerRehearsalPreparationRequest,
  type CollectionRunnerRehearsalPreparationResult,
  type CollectionRunnerRehearsalWorkspace,
} from "../../contracts";
import { EventContractCollectionRunnerEngine } from "../event-contract-collection-runner/EventContractCollectionRunnerEngine";
import { EventContractSourceEngine } from "../event-contract-source/EventContractSourceEngine";
import {
  createCollectionRunnerRuntimeConfiguration,
  resolveCollectionRunnerRuntimePaths,
} from "../event-contract-collection-runner-runtime/EventContractCollectionRunnerRuntimeFoundation";
import {
  EventContractCollectionRunnerSqliteStore,
  type OpenEventContractCollectionRunnerSqliteStoreOptions,
} from "../../repositories/EventContractCollectionRunnerSqliteStore";
import type {
  EventContractCollectionRunnerRepository,
} from "../../repositories/EventContractCollectionRunnerRepository";
import {
  createCollectionRunnerRehearsalLifecycleTransition,
  createCollectionRunnerRehearsalPreparationReceipt,
  verifyCollectionRunnerRehearsalManifest,
} from "./EventContractCollectionRunnerFixtureRehearsalEngine";

const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const FP = /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const RECORD_NAME = "preparation.json";

export enum CollectionRunnerRehearsalPreparationErrorCode {
  InvalidRequest = "INVALID_REQUEST",
  CatalogMismatch = "CATALOG_MISMATCH",
  UnsafeRoot = "UNSAFE_ROOT",
  WorkspaceConflict = "WORKSPACE_CONFLICT",
  PreparationFailed = "PREPARATION_FAILED",
  ReplayConflict = "REPLAY_CONFLICT",
}

export class CollectionRunnerRehearsalPreparationError extends Error {
  public constructor(
    public readonly code: CollectionRunnerRehearsalPreparationErrorCode,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = "CollectionRunnerRehearsalPreparationError";
  }
}

export interface CollectionRunnerRehearsalAllowedRoot {
  readonly allowedRootId: string;
  readonly path: string;
}

export interface CollectionRunnerRehearsalPreparationStorePort {
  createRunnerRepository(): EventContractCollectionRunnerRepository;
  getReadiness(): {
    readonly schemaCatalogChecksum: string;
  };
  close(): void;
}

export interface CollectionRunnerRehearsalPreparationDependencies {
  readonly repositoryRoot: string;
  readonly allowedRoots: readonly CollectionRunnerRehearsalAllowedRoot[];
  readonly catalog: readonly CollectionRunnerRehearsalFixtureCatalogEntry[];
  readonly openStore?: (
    options: OpenEventContractCollectionRunnerSqliteStoreOptions,
  ) => CollectionRunnerRehearsalPreparationStorePort;
}

interface PreparationRecord {
  readonly manifestFingerprint: string;
  readonly catalogEntryFingerprint: string;
  readonly workspaceFingerprint: string;
  readonly runtimeConfigurationFingerprint: string;
  readonly runtimePathFingerprint: string;
  readonly lifecycleTransitionFingerprint: string;
  readonly preparationReceiptFingerprint: string;
  readonly preparedAtUtc: string;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
    .join(",")}}`;
}

function sha(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonical(value), "utf8").digest("hex")}`;
}

function freeze<T>(value: T): Readonly<T> {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) freeze(nested);
  }
  return value;
}

function fail(
  code: CollectionRunnerRehearsalPreparationErrorCode,
  message: string,
  cause?: unknown,
): never {
  throw new CollectionRunnerRehearsalPreparationError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function isContained(parent: string, child: string): boolean {
  const normalizedParent = parent.toLocaleLowerCase();
  const normalizedChild = child.toLocaleLowerCase();
  return normalizedChild.startsWith(`${normalizedParent}${sep.toLocaleLowerCase()}`);
}

function canonicalExistingDirectory(path: string, label: string): string {
  if (path.trim() === "" || path.includes("\0") || path.startsWith("\\\\") || path.startsWith("//")) {
    fail(CollectionRunnerRehearsalPreparationErrorCode.UnsafeRoot, `${label} is not a safe local directory.`);
  }
  const requested = resolve(path);
  if (!existsSync(requested)) fail(CollectionRunnerRehearsalPreparationErrorCode.UnsafeRoot, `${label} must already exist.`);
  const entry = lstatSync(requested);
  if (!entry.isDirectory() || entry.isSymbolicLink()) fail(CollectionRunnerRehearsalPreparationErrorCode.UnsafeRoot, `${label} must be a real directory.`);
  const canonicalPath = realpathSync(requested);
  if (canonicalPath.toLocaleLowerCase() !== requested.toLocaleLowerCase()) fail(CollectionRunnerRehearsalPreparationErrorCode.UnsafeRoot, `${label} may not traverse a substituted path.`);
  const userProfile = env.USERPROFILE ?? env.HOME;
  if (
    dirname(canonicalPath).toLocaleLowerCase() === canonicalPath.toLocaleLowerCase() ||
    (typeof userProfile === "string" &&
      canonicalPath.toLocaleLowerCase() === resolve(userProfile).toLocaleLowerCase())
  ) fail(CollectionRunnerRehearsalPreparationErrorCode.UnsafeRoot, `${label} is too broad.`);
  return canonicalPath;
}

function writeCanonicalExclusive(path: string, value: unknown): void {
  const descriptor = openSync(path, "wx");
  try {
    writeFileSync(descriptor, `${canonical(value)}\n`, { encoding: "utf8" });
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function validateCatalogEntry(entry: CollectionRunnerRehearsalFixtureCatalogEntry): void {
  if (
    !VERSION.test(entry.catalogVersion) ||
    !ID.test(entry.catalogEntryId) ||
    !FP.test(entry.catalogFingerprint) ||
    !FP.test(entry.fixturePackageFingerprint) ||
    !ID.test(entry.fixtureAdapterIdentity) ||
    !VERSION.test(entry.fixtureAdapterVersion) ||
    !ID.test(entry.sourceRecordId) ||
    !FP.test(entry.payloadFingerprint) ||
    !Number.isSafeInteger(entry.rawPayloadBytes) ||
    entry.rawPayloadBytes < 0 ||
    !Number.isSafeInteger(entry.recordCount) ||
    entry.recordCount < 1 ||
    entry.scheduledTasks.length !== 1 ||
    entry.deterministic !== true
  ) fail(CollectionRunnerRehearsalPreparationErrorCode.CatalogMismatch, "Fixture catalog entry is malformed.");
  const { fingerprint, ...body } = entry;
  if (fingerprint !== sha(body)) fail(CollectionRunnerRehearsalPreparationErrorCode.CatalogMismatch, "Fixture catalog entry fingerprint is invalid.");
  const runnerEngine = new EventContractCollectionRunnerEngine();
  new EventContractSourceEngine().verifySnapshot(entry.sourceSnapshot);
  const runner = runnerEngine.verifyRunnerDefinition(entry.runnerDefinition);
  const activation = runnerEngine.createPilotActivation({
    schemaVersion: entry.pilotActivation.schemaVersion,
    activationId: entry.pilotActivation.activationId,
    ownerId: entry.pilotActivation.ownerId,
    approvedAt: entry.pilotActivation.approvedAt,
    startsAt: entry.pilotActivation.startsAt,
    stopsAt: entry.pilotActivation.stopsAt,
    frozenPlanId: entry.pilotActivation.frozenPlanId,
    frozenPlanFingerprint: entry.pilotActivation.frozenPlanFingerprint,
    runnerDefinition: entry.pilotActivation.runnerDefinition,
    admittedProviderFingerprints: entry.pilotActivation.admittedProviderFingerprints,
    admittedMappingFingerprints: entry.pilotActivation.admittedMappingFingerprints,
    maximumEvents: entry.pilotActivation.maximumEvents,
    maximumRequests: entry.pilotActivation.maximumRequests,
  });
  if (
    runner.fingerprint !== entry.pilotActivation.runnerDefinition.fingerprint ||
    activation.fingerprint !== entry.pilotActivation.fingerprint
  ) {
    fail(CollectionRunnerRehearsalPreparationErrorCode.CatalogMismatch, "Catalog Pilot does not bind the runner definition.");
  }
  entry.scheduledTasks.forEach((task) => {
    const verified = runnerEngine.createScheduledTask({
      schemaVersion: task.schemaVersion,
      taskId: task.taskId,
      observationSlot: task.observationSlot,
      scheduledAt: task.scheduledAt,
      deadlineAt: task.deadlineAt,
      runnerDefinitionVersion: task.runnerDefinitionVersion,
      admission: task.admission,
    },
    entry.pilotActivation,
    );
    if (verified.fingerprint !== task.fingerprint) {
      fail(CollectionRunnerRehearsalPreparationErrorCode.CatalogMismatch, "Catalog task fingerprint is invalid.");
    }
  });
}

export function createCollectionRunnerRehearsalFixtureCatalogEntry(
  input: Omit<CollectionRunnerRehearsalFixtureCatalogEntry, "deterministic" | "fingerprint">,
): CollectionRunnerRehearsalFixtureCatalogEntry {
  const body = {
    ...structuredClone(input),
    deterministic: true as const,
  };
  const entry = freeze({ ...body, fingerprint: sha(body) }) as CollectionRunnerRehearsalFixtureCatalogEntry;
  validateCatalogEntry(entry);
  return entry;
}

export function createCollectionRunnerRehearsalRuntimeTemplateFingerprint(
  entry: CollectionRunnerRehearsalFixtureCatalogEntry,
): string {
  return sha({
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION,
    runtimeMode: CollectionRunnerRuntimeMode.FixtureOnly,
    storeId: `rehearsal-${entry.catalogEntryId.replace(/[^a-z0-9]/gu, "-").toLocaleLowerCase().slice(-40)}`,
    activationId: entry.pilotActivation.activationId,
    runnerDefinitionFingerprint: entry.runnerDefinition.fingerprint,
    frozenPlanFingerprint: entry.pilotActivation.frozenPlanFingerprint,
    fixtureProviderFingerprint: entry.sourceSnapshot.providerFingerprint,
    maximumClockOffsetMilliseconds: 1000,
    maximumClockHealthAgeMilliseconds: 60_000,
    networkPermitted: false,
    continuousRunPermitted: false,
  });
}

export class EventContractCollectionRunnerFixtureRehearsalPreparation {
  readonly #repositoryRoot: string;
  readonly #roots: ReadonlyMap<string, string>;
  readonly #catalog: ReadonlyMap<string, CollectionRunnerRehearsalFixtureCatalogEntry>;
  readonly #openStore: (
    options: OpenEventContractCollectionRunnerSqliteStoreOptions,
  ) => CollectionRunnerRehearsalPreparationStorePort;

  public constructor(dependencies: CollectionRunnerRehearsalPreparationDependencies) {
    this.#repositoryRoot = canonicalExistingDirectory(dependencies.repositoryRoot, "repositoryRoot");
    const roots = new Map<string, string>();
    for (const root of dependencies.allowedRoots) {
      if (!ID.test(root.allowedRootId) || roots.has(root.allowedRootId)) fail(CollectionRunnerRehearsalPreparationErrorCode.InvalidRequest, "Allowed-root identities must be unique.");
      const canonicalRoot = canonicalExistingDirectory(root.path, "allowedRoot");
      if (
        canonicalRoot.toLocaleLowerCase() === this.#repositoryRoot.toLocaleLowerCase() ||
        isContained(this.#repositoryRoot, canonicalRoot) ||
        isContained(canonicalRoot, this.#repositoryRoot)
      ) fail(CollectionRunnerRehearsalPreparationErrorCode.UnsafeRoot, "Rehearsal roots may not overlap the source repository.");
      roots.set(root.allowedRootId, canonicalRoot);
    }
    const catalog = new Map<string, CollectionRunnerRehearsalFixtureCatalogEntry>();
    dependencies.catalog.forEach((entry) => {
      validateCatalogEntry(entry);
      if (catalog.has(entry.catalogEntryId)) fail(CollectionRunnerRehearsalPreparationErrorCode.CatalogMismatch, "Catalog entry identities must be unique.");
      catalog.set(entry.catalogEntryId, entry);
    });
    this.#roots = roots;
    this.#catalog = catalog;
    this.#openStore = dependencies.openStore ?? EventContractCollectionRunnerSqliteStore.open;
  }

  public prepare(request: CollectionRunnerRehearsalPreparationRequest): CollectionRunnerRehearsalPreparationResult {
    if (!verifyCollectionRunnerRehearsalManifest(request.manifest) || !ID.test(request.catalogEntryId) || !ID.test(request.allowedRootId) || !UTC.test(request.preparedAtUtc)) {
      fail(CollectionRunnerRehearsalPreparationErrorCode.InvalidRequest, "Preparation request is invalid.");
    }
    const entry = this.#catalog.get(request.catalogEntryId);
    const allowedRoot = this.#roots.get(request.allowedRootId);
    if (entry === undefined || allowedRoot === undefined) fail(CollectionRunnerRehearsalPreparationErrorCode.InvalidRequest, "Preparation references an unregistered catalog entry or root.");
    this.#verifyBindings(request, entry);

    const suffix = request.manifest.fingerprint.split(":")[1]!;
    const workspaceRoot = resolve(allowedRoot, `rehearsal-${suffix}`);
    if (!isContained(allowedRoot, workspaceRoot)) fail(CollectionRunnerRehearsalPreparationErrorCode.UnsafeRoot, "Derived workspace escaped the allowed root.");
    const runtimeControlRoot = resolve(workspaceRoot, "control");
    const sqliteRoot = resolve(workspaceRoot, "sqlite");
    const workspaceBody = {
      allowedRootId: request.allowedRootId,
      workspaceRoot,
      runtimeControlRoot,
      sqliteRoot,
      workspaceIdentity: `workspace:${sha({ allowedRootId: request.allowedRootId, manifestFingerprint: request.manifest.fingerprint }).slice(7)}`,
      deterministic: true as const,
    };
    const workspace = freeze({ ...workspaceBody, fingerprint: sha(workspaceBody) }) as CollectionRunnerRehearsalWorkspace;
    const configuration = createCollectionRunnerRuntimeConfiguration({
      schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION,
      runtimeId: `runtime:${request.manifest.rehearsalId}`,
      runtimeMode: CollectionRunnerRuntimeMode.FixtureOnly,
      runtimeControlRoot,
      sqliteRoot,
      storeId: `rehearsal-${entry.catalogEntryId.replace(/[^a-z0-9]/gu, "-").toLocaleLowerCase().slice(-40)}`,
      activationId: entry.pilotActivation.activationId,
      applicationBuildFingerprint: request.manifest.buildFingerprint,
      runnerDefinitionFingerprint: entry.runnerDefinition.fingerprint,
      frozenPlanFingerprint: entry.pilotActivation.frozenPlanFingerprint,
      fixtureProviderFingerprint: entry.sourceSnapshot.providerFingerprint,
      maximumClockOffsetMilliseconds: 1000,
      maximumClockHealthAgeMilliseconds: 60_000,
    });
    const workspaceExisted = existsSync(workspaceRoot);
    if (workspaceExisted) {
      for (const path of [workspaceRoot, runtimeControlRoot, sqliteRoot]) {
        if (!existsSync(path) || !lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink()) {
          fail(CollectionRunnerRehearsalPreparationErrorCode.WorkspaceConflict, "Existing workspace structure is incomplete or unsafe.");
        }
      }
    } else {
      try {
        mkdirSync(workspaceRoot);
        mkdirSync(runtimeControlRoot);
        mkdirSync(sqliteRoot);
      } catch (error) {
        fail(CollectionRunnerRehearsalPreparationErrorCode.PreparationFailed, "Isolated workspace could not be created.", error);
      }
    }
    const paths = resolveCollectionRunnerRuntimePaths(configuration);
    const transition = createCollectionRunnerRehearsalLifecycleTransition({
      rehearsalId: request.manifest.rehearsalId,
      manifestFingerprint: request.manifest.fingerprint,
      ordinal: 1,
      fromState: CollectionRunnerRehearsalLifecycleState.Planned,
      fromVersion: 1,
      toState: CollectionRunnerRehearsalLifecycleState.Prepared,
      reasonCode: "FIXTURE_STORE_PREPARED",
    });
    const recordPath = resolve(workspaceRoot, RECORD_NAME);
    if (workspaceExisted) {
      return this.#replay(request, entry, workspace, configuration, paths, transition, recordPath);
    }

    try {
      const store = this.#openStore({
        rootDirectory: sqliteRoot,
        storeId: configuration.storeId,
        applicationBuildFingerprint: request.manifest.buildFingerprint,
        appliedAtUtc: request.preparedAtUtc,
      });
      let receipt;
      try {
        const repository = store.createRunnerRepository();
        repository.registerRunnerDefinition({
          definition: entry.runnerDefinition,
          evidence: { occurredAtUtc: request.preparedAtUtc, reasonCode: "REHEARSAL_PREPARATION" },
        });
        repository.createPilotArtifact({
          activation: entry.pilotActivation,
          evidence: { occurredAtUtc: request.preparedAtUtc, reasonCode: "REHEARSAL_PREPARATION" },
        });
        repository.materializeTasks({
          activationId: entry.pilotActivation.activationId,
          expectedBudgetVersion: 1,
          tasks: entry.scheduledTasks,
          evidence: { occurredAtUtc: request.preparedAtUtc, reasonCode: "REHEARSAL_PREPARATION" },
        });
        repository.transitionPilot({
          activationId: entry.pilotActivation.activationId,
          expectedAggregateVersion: 1,
          nextState: CollectionRunnerPilotState.Active,
          clock: { observedAtUtc: request.preparedAtUtc, absoluteOffsetMilliseconds: 0, healthy: true },
          recoveryBlockerCount: 0,
          evidence: { occurredAtUtc: request.preparedAtUtc, reasonCode: "REHEARSAL_READY" },
        });
        if (
          repository.getRunnerDefinition(entry.runnerDefinition.runnerDefinitionId, entry.runnerDefinition.version)?.fingerprint !== entry.runnerDefinition.fingerprint ||
          repository.getPilotState(entry.pilotActivation.activationId)?.state !== CollectionRunnerPilotState.Active ||
          repository.getTaskState(entry.scheduledTasks[0]!.taskId)?.state !== entry.scheduledTasks[0]!.state
        ) fail(CollectionRunnerRehearsalPreparationErrorCode.PreparationFailed, "Seeded store verification failed.");
        const readiness = store.getReadiness();
        const seededStoreFingerprint = sha({
          runnerDefinitionFingerprint: entry.runnerDefinition.fingerprint,
          pilotActivationFingerprint: entry.pilotActivation.fingerprint,
          taskFingerprints: entry.scheduledTasks.map((task) => task.fingerprint),
          schemaCatalogChecksum: readiness.schemaCatalogChecksum,
        });
        receipt = createCollectionRunnerRehearsalPreparationReceipt(request.manifest, {
          rehearsalId: request.manifest.rehearsalId,
          manifestFingerprint: request.manifest.fingerprint,
          fixtureCatalogEntryFingerprint: entry.fingerprint,
          runtimeConfigurationFingerprint: configuration.fingerprint,
          seededStoreFingerprint,
          preparationTransitionFingerprint: transition.fingerprint,
          workspaceIdentity: workspace.workspaceIdentity,
          storePathIdentity: paths.storePathIdentity,
          schemaCatalogFingerprint: readiness.schemaCatalogChecksum,
        });
      } finally {
        store.close();
      }
      const result = this.#result(request, entry, workspace, configuration, paths, transition, receipt, false);
      const record: PreparationRecord = {
        manifestFingerprint: request.manifest.fingerprint,
        catalogEntryFingerprint: entry.fingerprint,
        workspaceFingerprint: workspace.fingerprint,
        runtimeConfigurationFingerprint: configuration.fingerprint,
        runtimePathFingerprint: paths.pathFingerprint,
        lifecycleTransitionFingerprint: transition.fingerprint,
        preparationReceiptFingerprint: receipt.fingerprint,
        preparedAtUtc: request.preparedAtUtc,
      };
      writeCanonicalExclusive(recordPath, record);
      return result;
    } catch (error) {
      const quarantine = `${workspaceRoot}.blocked-${Date.now().toString(10)}`;
      try {
        if (existsSync(workspaceRoot)) renameSync(workspaceRoot, quarantine);
      } catch {
        // Preserve the original error and leave evidence in place.
      }
      if (error instanceof CollectionRunnerRehearsalPreparationError) throw error;
      fail(CollectionRunnerRehearsalPreparationErrorCode.PreparationFailed, "Fixture rehearsal preparation failed closed.", error);
    }
  }

  #verifyBindings(
    request: CollectionRunnerRehearsalPreparationRequest,
    entry: CollectionRunnerRehearsalFixtureCatalogEntry,
  ): void {
    const manifest = request.manifest;
    const task = entry.scheduledTasks[0]!;
    if (
      manifest.fixtureCatalogFingerprint !== entry.catalogFingerprint ||
      manifest.fixturePackageFingerprint !== entry.fixturePackageFingerprint ||
      manifest.buildFingerprint !== entry.runnerDefinition.buildFingerprint ||
      manifest.runnerFingerprint !== entry.runnerDefinition.fingerprint ||
      manifest.frozenPlanFingerprint !== entry.pilotActivation.frozenPlanFingerprint ||
      manifest.providerFingerprint !== entry.sourceSnapshot.providerFingerprint ||
      manifest.mappingFingerprint !== entry.sourceSnapshot.mappingFingerprint ||
      manifest.syntheticActivationFingerprint !== entry.pilotActivation.fingerprint ||
      manifest.syntheticTaskFingerprint !== task.fingerprint ||
      manifest.runtimeConfigurationTemplateFingerprint !== createCollectionRunnerRehearsalRuntimeTemplateFingerprint(entry)
    ) fail(CollectionRunnerRehearsalPreparationErrorCode.CatalogMismatch, "Manifest does not exactly bind the allow-listed fixture entry.");
  }

  #replay(
    request: CollectionRunnerRehearsalPreparationRequest,
    entry: CollectionRunnerRehearsalFixtureCatalogEntry,
    workspace: CollectionRunnerRehearsalWorkspace,
    configuration: ReturnType<typeof createCollectionRunnerRuntimeConfiguration>,
    paths: ReturnType<typeof resolveCollectionRunnerRuntimePaths>,
    transition: ReturnType<typeof createCollectionRunnerRehearsalLifecycleTransition>,
    recordPath: string,
  ): CollectionRunnerRehearsalPreparationResult {
    if (!existsSync(recordPath) || lstatSync(recordPath).isSymbolicLink() || !lstatSync(recordPath).isFile()) {
      fail(CollectionRunnerRehearsalPreparationErrorCode.WorkspaceConflict, "Existing workspace has no valid immutable preparation record.");
    }
    let record: PreparationRecord;
    try {
      record = JSON.parse(readFileSync(recordPath, "utf8")) as PreparationRecord;
    } catch (error) {
      fail(CollectionRunnerRehearsalPreparationErrorCode.ReplayConflict, "Preparation replay record is unreadable.", error);
    }
    if (
      record.manifestFingerprint !== request.manifest.fingerprint ||
      record.catalogEntryFingerprint !== entry.fingerprint ||
      record.workspaceFingerprint !== workspace.fingerprint ||
      record.runtimeConfigurationFingerprint !== configuration.fingerprint ||
      record.runtimePathFingerprint !== paths.pathFingerprint ||
      record.lifecycleTransitionFingerprint !== transition.fingerprint ||
      record.preparedAtUtc !== request.preparedAtUtc
    ) fail(CollectionRunnerRehearsalPreparationErrorCode.ReplayConflict, "Changed preparation replay is forbidden.");
    const store = this.#openStore({
      rootDirectory: configuration.sqliteRoot,
      storeId: configuration.storeId,
      applicationBuildFingerprint: request.manifest.buildFingerprint,
      appliedAtUtc: request.preparedAtUtc,
      recoveryInspectedAtUtc: request.preparedAtUtc,
    });
    let receipt;
    try {
      const readiness = store.getReadiness();
      const seededStoreFingerprint = sha({
        runnerDefinitionFingerprint: entry.runnerDefinition.fingerprint,
        pilotActivationFingerprint: entry.pilotActivation.fingerprint,
        taskFingerprints: entry.scheduledTasks.map((task) => task.fingerprint),
        schemaCatalogChecksum: readiness.schemaCatalogChecksum,
      });
      receipt = createCollectionRunnerRehearsalPreparationReceipt(request.manifest, {
        rehearsalId: request.manifest.rehearsalId,
        manifestFingerprint: request.manifest.fingerprint,
        fixtureCatalogEntryFingerprint: entry.fingerprint,
        runtimeConfigurationFingerprint: configuration.fingerprint,
        seededStoreFingerprint,
        preparationTransitionFingerprint: transition.fingerprint,
        workspaceIdentity: workspace.workspaceIdentity,
        storePathIdentity: paths.storePathIdentity,
        schemaCatalogFingerprint: readiness.schemaCatalogChecksum,
      });
    } finally {
      store.close();
    }
    if (receipt.fingerprint !== record.preparationReceiptFingerprint) {
      fail(CollectionRunnerRehearsalPreparationErrorCode.ReplayConflict, "Preparation receipt replay changed.");
    }
    return this.#result(request, entry, workspace, configuration, paths, transition, receipt, true);
  }

  #result(
    request: CollectionRunnerRehearsalPreparationRequest,
    entry: CollectionRunnerRehearsalFixtureCatalogEntry,
    workspace: CollectionRunnerRehearsalWorkspace,
    configuration: ReturnType<typeof createCollectionRunnerRuntimeConfiguration>,
    paths: ReturnType<typeof resolveCollectionRunnerRuntimePaths>,
    transition: ReturnType<typeof createCollectionRunnerRehearsalLifecycleTransition>,
    receipt: ReturnType<typeof createCollectionRunnerRehearsalPreparationReceipt>,
    replayed: boolean,
  ): CollectionRunnerRehearsalPreparationResult {
    const body = {
      manifest: request.manifest,
      catalogEntry: entry,
      workspace,
      runtimeConfiguration: configuration,
      runtimePaths: paths,
      lifecycleTransition: transition,
      preparationReceipt: receipt,
      replayed,
      deterministic: true as const,
    };
    return freeze({ ...body, fingerprint: sha(body) }) as CollectionRunnerRehearsalPreparationResult;
  }
}

export const COLLECTION_RUNNER_REHEARSAL_DEFAULT_TEMP_ROOT = resolve(
  tmpdir(),
  "alpha-fixture-rehearsals",
);
