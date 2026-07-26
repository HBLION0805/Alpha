import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";

import {
  CollectionRunnerRehearsalOperationPhase,
  type CollectionRunnerRehearsalOperationAuthorizationReceipt,
  type CollectionRunnerRehearsalOperationManifest,
  type CollectionRunnerRehearsalOperationPhaseCommand,
  type CollectionRunnerRehearsalOperationPhaseEvidence,
} from "../../contracts";
import {
  EventContractCollectionRunnerFixtureRehearsalSqliteStore,
} from "../../repositories/EventContractCollectionRunnerFixtureRehearsalSqliteStore";
import type {
  CollectionRunnerRehearsalOperationDurableTruthPort,
} from "./EventContractCollectionRunnerRehearsalOperationControlEngine";

const FP = /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const STORE_ID = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;

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

function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) freeze(nested);
  }
  return value;
}

/**
 * Independent operation evidence observer.
 *
 * Every observation opens the registered rehearsal database again in SQLite
 * read-only/query-only mode, reconstructs the verified rehearsal snapshot,
 * and closes the handle before returning. It never receives a mutable
 * repository or trusts the mutation adapter's object graph.
 */
export class FixedQueryOnlyRehearsalOperationDurableTruth
  implements CollectionRunnerRehearsalOperationDurableTruthPort {
  public readonly root: string;
  public readonly storeId: string;
  public readonly fingerprint: string;

  public constructor(rootDirectory: string, storeId: string) {
    if (!STORE_ID.test(storeId)) {
      throw new Error("Registered rehearsal store identity is invalid.");
    }
    this.root = realpathSync(rootDirectory);
    this.storeId = storeId;
    this.fingerprint = sha({
      authority: "QUERY_ONLY_REHEARSAL_SQLITE_V1",
      root: this.root,
      storeId,
    });
    Object.freeze(this);
  }

  public observe(
    manifest: CollectionRunnerRehearsalOperationManifest,
    command: CollectionRunnerRehearsalOperationPhaseCommand,
    authorization: CollectionRunnerRehearsalOperationAuthorizationReceipt,
    claimedEvidence: CollectionRunnerRehearsalOperationPhaseEvidence,
  ): CollectionRunnerRehearsalOperationPhaseEvidence {
    if (
      command.operationId !== manifest.operationId ||
      command.manifestFingerprint !== manifest.fingerprint ||
      authorization.commandFingerprint !== command.fingerprint ||
      authorization.manifestFingerprint !== manifest.fingerprint
    ) {
      throw new Error("Durable observation authority binding is invalid.");
    }
    const store = EventContractCollectionRunnerFixtureRehearsalSqliteStore
      .openReadOnly({ rootDirectory: this.root, storeId: this.storeId });
    try {
      const repository = store.createReadOnlyDurableRehearsalRepository();
      const snapshot = repository.readSnapshot(manifest.proposal.rehearsalId);
      if (
        snapshot === null ||
        snapshot.registry.rehearsalId !== manifest.proposal.rehearsalId ||
        snapshot.registry.manifestFingerprint !== manifest.proposal
          .rehearsalManifestFingerprint ||
        snapshot.registry.lifecycleVersion !==
          claimedEvidence.resultingLifecycleVersion ||
        claimedEvidence.priorLifecycleVersion >
          claimedEvidence.resultingLifecycleVersion
      ) {
        throw new Error("Query-only durable rehearsal truth is not bound.");
      }
      const transitions = snapshot.transitions.filter((transition) =>
        transition.fromVersion >= claimedEvidence.priorLifecycleVersion &&
        transition.toVersion <= claimedEvidence.resultingLifecycleVersion
      );
      const priorFingerprint = transitions[0]?.fingerprint ??
        snapshot.registry.fingerprint;
      let authorityFingerprint: string | null;
      switch (command.phase) {
        case CollectionRunnerRehearsalOperationPhase.Prepare:
          authorityFingerprint = snapshot.registry.fingerprint;
          break;
        case CollectionRunnerRehearsalOperationPhase.Step:
          authorityFingerprint = snapshot.invocationReceipts.find(
            ({ invocationOrdinal }) =>
              invocationOrdinal === command.expectedInvocationOrdinal,
          )?.fingerprint ?? null;
          break;
        case CollectionRunnerRehearsalOperationPhase.Validate:
          authorityFingerprint = FP.test(
            claimedEvidence.authorityEvidenceFingerprint,
          )
            ? claimedEvidence.authorityEvidenceFingerprint
            : null;
          break;
        case CollectionRunnerRehearsalOperationPhase.Freeze:
          authorityFingerprint = snapshot.evidencePlan?.fingerprint ?? null;
          break;
        case CollectionRunnerRehearsalOperationPhase.Package:
          authorityFingerprint =
            snapshot.registry.executionPackageFingerprint;
          break;
        default:
          authorityFingerprint = null;
      }
      if (authorityFingerprint === null) {
        throw new Error("Phase authority is absent from query-only durable truth.");
      }
      const reconstructed = freeze({
        ...claimedEvidence,
        priorLifecycleFingerprint: priorFingerprint,
        resultingLifecycleFingerprint: snapshot.registry.fingerprint,
        authorityEvidenceFingerprint: authorityFingerprint,
      });
      if (canonical(reconstructed) !== canonical(claimedEvidence)) {
        throw new Error("Claimed phase evidence conflicts with durable truth.");
      }
      return reconstructed;
    } finally {
      store.close();
    }
  }
}
