import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  CollectionRunnerRehearsalOperationRootPurpose,
  type CollectionRunnerRehearsalOperationManifest,
  type CollectionRunnerRehearsalOperationPhaseCommand,
  type CollectionRunnerRehearsalOperationReadinessObservation,
  type CollectionRunnerRehearsalOperationRootRegistration,
} from "../../contracts";
import {
  CollectionRunnerRehearsalOperationRegistry,
} from "../event-contract-collection-runner-rehearsal-operation";
import type {
  CollectionRunnerRehearsalOperationReadinessPort,
} from "./EventContractCollectionRunnerRehearsalOperationControlEngine";

export interface CollectionRunnerRehearsalOperationResolvedRoots {
  readonly controlRoot: string;
  readonly workspaceRoot: string;
  readonly sqliteRoot: string;
  readonly backupRoot: string;
  readonly evidenceRoot: string;
  readonly alphaRepositoryRoot: string;
  readonly rootRegistryFingerprint: string;
}

export interface CollectionRunnerRehearsalOperationRootInspection {
  readonly canonicalPath: string;
  readonly filesystemIdentityFingerprint: string;
  readonly inspectionEvidenceFingerprint: string;
  readonly linkOrReparsePointDetected: boolean;
}

export interface CollectionRunnerRehearsalOperationRootInspectionPort {
  inspect(
    registration: CollectionRunnerRehearsalOperationRootRegistration,
  ): CollectionRunnerRehearsalOperationRootInspection;
}

export interface CollectionRunnerRehearsalOperationAlphaInspection {
  readonly alphaCommit: string;
  readonly trackedTreeClean: boolean;
  readonly packageFingerprint: string;
  readonly validationSuiteFingerprint: string;
  readonly registeredTestTotal: number;
}

export interface CollectionRunnerRehearsalOperationAlphaInspectionPort {
  inspect(repositoryRoot: string):
    CollectionRunnerRehearsalOperationAlphaInspection;
}

export class FixedLocalCollectionRunnerRehearsalOperationAlphaInspection
  implements CollectionRunnerRehearsalOperationAlphaInspectionPort {
  public constructor(private readonly registeredTestTotal: number) {
    if (
      !Number.isSafeInteger(registeredTestTotal) ||
      registeredTestTotal < 1
    ) {
      throw new Error("Registered Alpha test total is invalid.");
    }
  }

  public inspect(
    repositoryRoot: string,
  ): CollectionRunnerRehearsalOperationAlphaInspection {
    const options = {
      cwd: repositoryRoot,
      input: "",
      encoding: "utf8" as const,
      shell: false as const,
      timeout: 10_000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
      killSignal: "SIGTERM" as const,
    };
    const commit = spawnSync("git", ["rev-parse", "HEAD"], options);
    const tracked = spawnSync(
      "git",
      ["status", "--porcelain", "--untracked-files=no"],
      options,
    );
    if (
      commit.status !== 0 ||
      tracked.status !== 0 ||
      !/^[0-9a-f]{40}\r?\n?$/u.test(commit.stdout)
    ) {
      throw new Error("Alpha repository inspection failed closed.");
    }
    const packageBytes = readFileSync(join(repositoryRoot, "package.json"));
    const validationBytes = readFileSync(
      join(repositoryRoot, "scripts", "alpha-validate.mjs"),
    );
    const networkGuardBytes = readFileSync(
      join(repositoryRoot, "scripts", "network-disabled-bootstrap.cjs"),
    );
    const pythonNetworkGuardBytes = readFileSync(
      join(
        repositoryRoot,
        "scripts",
        "network-disabled-python",
        "sitecustomize.py",
      ),
    );
    const packageFingerprint =
      `sha256:${createHash("sha256").update(packageBytes).digest("hex")}`;
    const suiteHash = createHash("sha256");
    suiteHash.update(validationBytes);
    suiteHash.update(networkGuardBytes);
    suiteHash.update(pythonNetworkGuardBytes);
    suiteHash.update(packageBytes);
    return Object.freeze({
      alphaCommit: commit.stdout.trim(),
      trackedTreeClean: tracked.stdout.trim() === "",
      packageFingerprint,
      validationSuiteFingerprint: `sha256:${suiteHash.digest("hex")}`,
      registeredTestTotal: this.registeredTestTotal,
    });
  }
}

export interface CollectionRunnerRehearsalOperationStoreInspection {
  readonly storeState: "ABSENT" | "EXACT" | "MISSING" | "INVALID";
  readonly lifecycleState: string | null;
  readonly lifecycleVersion: number | null;
  readonly nextInvocationOrdinal: number | null;
  readonly recoveryFingerprint: string;
  readonly unresolvedClaim: boolean;
  readonly ownershipAvailable: boolean;
  readonly fixtureBindingsVerified: boolean;
  readonly blockerCodes: readonly string[];
  readonly incompleteCodes: readonly string[];
}

export interface CollectionRunnerRehearsalOperationStoreInspectionPort {
  inspect(
    manifest: CollectionRunnerRehearsalOperationManifest,
    command: CollectionRunnerRehearsalOperationPhaseCommand,
    roots: CollectionRunnerRehearsalOperationResolvedRoots,
  ): CollectionRunnerRehearsalOperationStoreInspection;
}

export interface CollectionRunnerRehearsalOperationStopInspectionPort {
  inspect(operationId: string): {
    readonly processStopTripped: boolean;
    readonly durableStopTripped: boolean;
  };
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
  return `sha256:${createHash("sha256")
    .update(canonical(value), "utf8")
    .digest("hex")}`;
}

export class LocalCollectionRunnerRehearsalOperationRootInspection
  implements CollectionRunnerRehearsalOperationRootInspectionPort {
  public inspect(
    registration: CollectionRunnerRehearsalOperationRootRegistration,
  ): CollectionRunnerRehearsalOperationRootInspection {
    const status = lstatSync(registration.canonicalPath);
    const canonicalPath = realpathSync(registration.canonicalPath);
    const evidence = {
      canonicalPath,
      directory: status.isDirectory(),
      symbolicLink: status.isSymbolicLink(),
    };
    return Object.freeze({
      canonicalPath,
      filesystemIdentityFingerprint: sha({
        canonicalPath,
        directory: evidence.directory,
        symbolicLink: evidence.symbolicLink,
      }),
      inspectionEvidenceFingerprint: sha(evidence),
      linkOrReparsePointDetected: status.isSymbolicLink(),
    });
  }
}

function folded(path: string): string {
  return resolve(path).toLocaleLowerCase();
}

export class CollectionRunnerRehearsalOperationFixedRootResolver {
  public constructor(
    private readonly registry: CollectionRunnerRehearsalOperationRegistry,
    private readonly inspection:
      CollectionRunnerRehearsalOperationRootInspectionPort,
  ) {}

  public resolve(
    manifest: CollectionRunnerRehearsalOperationManifest,
  ): CollectionRunnerRehearsalOperationResolvedRoots {
    const roots = new Map<
      CollectionRunnerRehearsalOperationRootPurpose,
      string
    >();
    for (const binding of manifest.proposal.rootBindings) {
      const registration = this.registry.getRoot(binding.rootId);
      if (
        registration === null ||
        registration.purpose !== binding.purpose ||
        registration.fingerprint !== binding.rootFingerprint
      ) {
        throw new Error("Manifest root binding is not registered.");
      }
      const current = this.inspection.inspect(registration);
      if (
        folded(current.canonicalPath) !== folded(registration.canonicalPath) ||
        current.filesystemIdentityFingerprint !==
          registration.filesystemIdentityFingerprint ||
        current.inspectionEvidenceFingerprint !==
          registration.inspectionEvidenceFingerprint ||
        current.linkOrReparsePointDetected
      ) {
        throw new Error("Registered root identity changed or became unsafe.");
      }
      roots.set(binding.purpose, registration.canonicalPath);
    }
    const requireRoot = (
      purpose: CollectionRunnerRehearsalOperationRootPurpose,
    ): string => {
      const value = roots.get(purpose);
      if (value === undefined) throw new Error(`Missing registered ${purpose}.`);
      return value;
    };
    return Object.freeze({
      controlRoot: requireRoot(CollectionRunnerRehearsalOperationRootPurpose.Control),
      workspaceRoot: requireRoot(CollectionRunnerRehearsalOperationRootPurpose.Workspace),
      sqliteRoot: requireRoot(CollectionRunnerRehearsalOperationRootPurpose.Sqlite),
      backupRoot: requireRoot(CollectionRunnerRehearsalOperationRootPurpose.Backup),
      evidenceRoot: requireRoot(CollectionRunnerRehearsalOperationRootPurpose.Evidence),
      alphaRepositoryRoot: requireRoot(
        CollectionRunnerRehearsalOperationRootPurpose.AlphaRepository,
      ),
      rootRegistryFingerprint: manifest.proposal.rootRegistryFingerprint,
    });
  }
}

export class LocalCollectionRunnerRehearsalOperationReadiness
  implements CollectionRunnerRehearsalOperationReadinessPort {
  public constructor(
    private readonly roots:
      CollectionRunnerRehearsalOperationFixedRootResolver,
    private readonly alpha:
      CollectionRunnerRehearsalOperationAlphaInspectionPort,
    private readonly store:
      CollectionRunnerRehearsalOperationStoreInspectionPort,
    private readonly stop:
      CollectionRunnerRehearsalOperationStopInspectionPort,
    private readonly now: () => string,
  ) {}

  public inspect(
    manifest: CollectionRunnerRehearsalOperationManifest,
    command: CollectionRunnerRehearsalOperationPhaseCommand,
  ): CollectionRunnerRehearsalOperationReadinessObservation {
    const observedAtUtc = this.now();
    const blockers: string[] = [];
    let resolved: CollectionRunnerRehearsalOperationResolvedRoots;
    try {
      resolved = this.roots.resolve(manifest);
    } catch {
      return Object.freeze({
        operationId: manifest.operationId,
        manifestFingerprint: manifest.fingerprint,
        observedAtUtc,
        alphaCommit: command.alphaCommit,
        trackedTreeClean: false,
        packageFingerprint: "sha256:" + "0".repeat(64),
        validationSuiteFingerprint: "sha256:" + "0".repeat(64),
        registeredTestTotal: 0,
        rootRegistryFingerprint: command.rootRegistryFingerprint,
        rootsVerified: false,
        fixtureBindingsVerified: false,
        networkCapabilityAbsent: true,
        credentialCapabilityAbsent: true,
        approvalValid: false,
        storeState: "INVALID",
        lifecycleState: null,
        lifecycleVersion: null,
        nextInvocationOrdinal: null,
        recoveryFingerprint: command.expectedRecoveryFingerprint,
        unresolvedClaim: false,
        ownershipAvailable: false,
        processStopTripped: false,
        durableStopTripped: false,
        blockerCodes: Object.freeze(["ROOT_RESOLUTION_FAILED"]),
        incompleteCodes: Object.freeze([]),
      });
    }
    const alpha = this.alpha.inspect(resolved.alphaRepositoryRoot);
    const store = this.store.inspect(manifest, command, resolved);
    const stop = this.stop.inspect(manifest.operationId);
    if (Date.parse(observedAtUtc) >= Date.parse(manifest.ownerApproval.expiresAtUtc)) {
      blockers.push("APPROVAL_EXPIRED");
    }
    return Object.freeze({
      operationId: manifest.operationId,
      manifestFingerprint: manifest.fingerprint,
      observedAtUtc,
      alphaCommit: alpha.alphaCommit,
      trackedTreeClean: alpha.trackedTreeClean,
      packageFingerprint: alpha.packageFingerprint,
      validationSuiteFingerprint: alpha.validationSuiteFingerprint,
      registeredTestTotal: alpha.registeredTestTotal,
      rootRegistryFingerprint: resolved.rootRegistryFingerprint,
      rootsVerified: true,
      fixtureBindingsVerified: store.fixtureBindingsVerified,
      networkCapabilityAbsent: true,
      credentialCapabilityAbsent: true,
      approvalValid: blockers.length === 0,
      storeState: store.storeState,
      lifecycleState: store.lifecycleState,
      lifecycleVersion: store.lifecycleVersion,
      nextInvocationOrdinal: store.nextInvocationOrdinal,
      recoveryFingerprint: store.recoveryFingerprint,
      unresolvedClaim: store.unresolvedClaim,
      ownershipAvailable: store.ownershipAvailable,
      processStopTripped: stop.processStopTripped,
      durableStopTripped: stop.durableStopTripped,
      blockerCodes: Object.freeze([...blockers, ...store.blockerCodes].sort()),
      incompleteCodes: Object.freeze([...store.incompleteCodes].sort()),
    });
  }
}
