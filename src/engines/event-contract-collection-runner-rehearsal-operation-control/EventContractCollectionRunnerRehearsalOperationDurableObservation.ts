import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";

import {
  CollectionRunnerRehearsalOperationPhase,
  CollectionRunnerRehearsalOperationResultDisposition,
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
import type {
  FixedOperationValidationReceiptJournal,
} from "./EventContractCollectionRunnerRehearsalOperationVerification";

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
  readonly #evidenceRoot: string | null;

  public constructor(
    rootDirectory: string,
    storeId: string,
    evidenceRoot?: string,
    private readonly validationJournal?:
      FixedOperationValidationReceiptJournal,
  ) {
    if (!STORE_ID.test(storeId)) {
      throw new Error("Registered rehearsal store identity is invalid.");
    }
    this.root = realpathSync(rootDirectory);
    this.storeId = storeId;
    this.#evidenceRoot = evidenceRoot === undefined
      ? null
      : realpathSync(evidenceRoot);
    this.fingerprint = sha({
      authority: "QUERY_ONLY_REHEARSAL_DURABLE_EVIDENCE_V2",
      root: this.root,
      storeId,
      evidenceRoot: this.#evidenceRoot,
      validationJournalRoot: validationJournal?.root ?? null,
    });
    Object.freeze(this);
  }

  public observe(
    manifest: CollectionRunnerRehearsalOperationManifest,
    command: CollectionRunnerRehearsalOperationPhaseCommand,
    authorization: CollectionRunnerRehearsalOperationAuthorizationReceipt,
    _claimedEvidence: CollectionRunnerRehearsalOperationPhaseEvidence,
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
        command.expectedLifecycleVersion > snapshot.registry.lifecycleVersion
      ) {
        throw new Error("Query-only durable rehearsal truth is not bound.");
      }
      const transitions = snapshot.transitions.filter((transition) =>
        transition.fromVersion >= command.expectedLifecycleVersion &&
        transition.toVersion <= snapshot.registry.lifecycleVersion
      );
      const priorFingerprint = sha({
        rehearsalId: snapshot.registry.rehearsalId,
        manifestFingerprint: snapshot.registry.manifestFingerprint,
        lifecycleVersion: command.expectedLifecycleVersion,
        recoveryFingerprint: command.expectedRecoveryFingerprint,
      });
      let authorityFingerprint: string | null;
      let startedAtUtc: string | null;
      let completedAtUtc: string | null;
      let durableSource: unknown;
      switch (command.phase) {
        case CollectionRunnerRehearsalOperationPhase.Prepare:
          authorityFingerprint = snapshot.registry.fingerprint;
          startedAtUtc = transitions[0]?.occurredAtUtc ?? null;
          completedAtUtc = transitions.at(-1)?.occurredAtUtc ?? null;
          durableSource = {
            registry: snapshot.registry,
            transitions,
          };
          break;
        case CollectionRunnerRehearsalOperationPhase.Step: {
          const claim = snapshot.claims.find(
            ({ phase, invocationOrdinal }) =>
              phase === "STEP" &&
              invocationOrdinal === command.expectedInvocationOrdinal,
          );
          const receipt = snapshot.invocationReceipts.find(
            ({ invocationOrdinal }) =>
              invocationOrdinal === command.expectedInvocationOrdinal,
          );
          authorityFingerprint = receipt?.fingerprint ?? null;
          startedAtUtc = claim?.claimedAtUtc ?? null;
          completedAtUtc = receipt?.observedAtUtc ?? null;
          durableSource = { claim, receipt, transitions };
          break;
        }
        case CollectionRunnerRehearsalOperationPhase.Validate: {
          const receipt = this.validationJournal?.read(
            authorization.authorizationId,
          );
          if (
            receipt === undefined ||
            receipt.operationId !== manifest.operationId ||
            receipt.rehearsalId !== manifest.proposal.rehearsalId ||
            receipt.manifestFingerprint !== manifest.fingerprint
          ) {
            throw new Error(
              "Durable operation validation receipt is unavailable.",
            );
          }
          authorityFingerprint = receipt.fingerprint;
          startedAtUtc = receipt.startedAtUtc;
          completedAtUtc = receipt.endedAtUtc;
          durableSource = receipt;
          break;
        }
        case CollectionRunnerRehearsalOperationPhase.Freeze: {
          const plan = snapshot.evidencePlan;
          const claim = plan === null
            ? undefined
            : snapshot.claims.find(({ claimId }) =>
              claimId === plan.freezeClaimId
            );
          authorityFingerprint = snapshot.evidencePlan?.fingerprint ?? null;
          startedAtUtc = claim?.claimedAtUtc ?? null;
          completedAtUtc = plan?.frozenAtUtc ?? null;
          durableSource = { claim, plan, transitions };
          break;
        }
        case CollectionRunnerRehearsalOperationPhase.Package: {
          if (this.#evidenceRoot === null) {
            throw new Error("Registered package evidence root is unavailable.");
          }
          const envelope = JSON.parse(readFileSync(join(
            this.#evidenceRoot,
            `rehearsal-${manifest.proposal.plannedEnvelopeId}-evidence`,
            "envelope-manifest.json",
          ), "utf8")) as {
            readonly rehearsalId: string;
            readonly manifestFingerprint: string;
            readonly publishedAtUtc: string;
            readonly deterministic: true;
            readonly fingerprint: string;
          };
          const {
            deterministic: _deterministic,
            fingerprint,
            ...envelopeBody
          } = envelope;
          if (
            envelope.rehearsalId !== manifest.proposal.rehearsalId ||
            envelope.manifestFingerprint !==
              manifest.proposal.rehearsalManifestFingerprint ||
            envelope.deterministic !== true ||
            envelope.fingerprint !== sha(envelopeBody)
          ) throw new Error("Published package evidence is invalid.");
          authorityFingerprint = fingerprint;
          startedAtUtc = envelope.publishedAtUtc;
          completedAtUtc = envelope.publishedAtUtc;
          durableSource = envelope;
          break;
        }
        default:
          authorityFingerprint = null;
          startedAtUtc = null;
          completedAtUtc = null;
          durableSource = null;
      }
      if (
        authorityFingerprint === null ||
        startedAtUtc === null ||
        completedAtUtc === null ||
        !FP.test(authorityFingerprint)
      ) {
        throw new Error("Phase authority is absent from query-only durable truth.");
      }
      const reconstructed = freeze({
        disposition:
          CollectionRunnerRehearsalOperationResultDisposition.Completed,
        priorLifecycleVersion: command.expectedLifecycleVersion,
        resultingLifecycleVersion: snapshot.registry.lifecycleVersion,
        priorLifecycleFingerprint: priorFingerprint,
        resultingLifecycleFingerprint: snapshot.registry.fingerprint,
        authorityEvidenceFingerprint: authorityFingerprint,
        sanitizedOutputDigest: sha({
          phase: command.phase,
          durableSource,
        }),
        startedAtUtc,
        completedAtUtc,
      });
      return reconstructed;
    } finally {
      store.close();
    }
  }
}
