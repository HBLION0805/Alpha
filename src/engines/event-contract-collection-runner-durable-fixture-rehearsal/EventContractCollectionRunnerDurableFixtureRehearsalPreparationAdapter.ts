import { createHash } from "node:crypto";

import {
  DurableFixtureRehearsalLifecycleState,
  EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_SCHEMA_VERSION,
  type CollectionRunnerRehearsalPreparationRequest,
  type DurableFixtureRehearsalPhaseRequest,
  type DurableFixtureRehearsalPreparationEvidence,
  type DurableFixtureRehearsalProcessContext,
} from "../../contracts";
import {
  EventContractCollectionRunnerFixtureRehearsalPreparation,
} from "../event-contract-collection-runner-fixture-rehearsal/EventContractCollectionRunnerFixtureRehearsalPreparation";
import type {
  DurableFixtureRehearsalPreparationPort,
} from "./EventContractCollectionRunnerDurableFixtureRehearsalCoordinator";

export interface DurableFixtureRehearsalPreparationRequestResolver {
  resolve(
    registeredManifestId: string,
    rehearsalId: string,
    manifestFingerprint: string,
    preparedAtUtc: string,
  ): CollectionRunnerRehearsalPreparationRequest;
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

export class EventContractCollectionRunnerDurableFixtureRehearsalPreparationAdapter
  implements DurableFixtureRehearsalPreparationPort {
  public constructor(
    private readonly preparation:
      EventContractCollectionRunnerFixtureRehearsalPreparation,
    private readonly resolver:
      DurableFixtureRehearsalPreparationRequestResolver,
  ) {}

  public prepare(
    request: DurableFixtureRehearsalPhaseRequest,
    context: DurableFixtureRehearsalProcessContext,
  ): DurableFixtureRehearsalPreparationEvidence {
    const resolved = this.resolver.resolve(
      request.registeredManifestId,
      request.rehearsalId,
      request.manifestFingerprint,
      context.observedAtUtc,
    );
    if (
      resolved.manifest.rehearsalId !== request.rehearsalId ||
      resolved.manifest.fingerprint !== request.manifestFingerprint ||
      resolved.preparedAtUtc !== context.observedAtUtc
    ) {
      throw new Error(
        "Registered preparation resolution does not match the phase request.",
      );
    }
    const prepared = this.preparation.prepare(resolved);
    return {
      registry: {
        schemaVersion:
          EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_SCHEMA_VERSION,
        rehearsalId: prepared.manifest.rehearsalId,
        manifestFingerprint: prepared.manifest.fingerprint,
        buildFingerprint: prepared.manifest.buildFingerprint,
        runnerFingerprint: prepared.manifest.runnerFingerprint,
        frozenPlanFingerprint: prepared.manifest.frozenPlanFingerprint,
        catalogFingerprint: prepared.manifest.fixtureCatalogFingerprint,
        providerFingerprint: prepared.manifest.providerFingerprint,
        mappingFingerprint: prepared.manifest.mappingFingerprint,
        activationId: prepared.catalogEntry.pilotActivation.activationId,
        taskSetFingerprint: sha(
          prepared.catalogEntry.scheduledTasks.map(
            ({ fingerprint }) => fingerprint,
          ),
        ),
        workspaceIdentity: prepared.workspace.workspaceIdentity,
        storeIdentity: prepared.runtimePaths.storePathIdentity,
        lifecycleState: DurableFixtureRehearsalLifecycleState.Prepared,
        lifecycleVersion: 3,
        nextInvocationOrdinal: 1,
        recoveryFingerprint:
          prepared.preparationReceipt.seededStoreFingerprint,
        maximumInvocations: prepared.manifest.expectedInvocations.length,
        scenarioResultFingerprint: null,
        executionPackageFingerprint: null,
        nonAuthorityDeclaration:
          prepared.manifest.nonAuthorityDeclaration,
        createdAtUtc: context.observedAtUtc,
      },
      preparingReasonCode: "PREPARATION_STARTED",
      preparedReasonCode: "FIXTURE_STORE_PREPARED",
    };
  }
}
