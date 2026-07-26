import { createHash } from "node:crypto";

import {
  CollectionRunnerRehearsalOperationPhase,
  type CollectionRunnerRehearsalOperationAuthorizationReceipt,
  type CollectionRunnerRehearsalOperationManifest,
  type CollectionRunnerRehearsalOperationPhaseCommand,
  type CollectionRunnerRehearsalOperationPhaseEvidence,
} from "../../contracts";
import type {
  CollectionRunnerRehearsalOperationDurableTruthPort,
  CollectionRunnerRehearsalOperationPhasePort,
} from "./EventContractCollectionRunnerRehearsalOperationControlEngine";
import type {
  CollectionRunnerRehearsalOperationCapabilityInspectionPort,
  CollectionRunnerRehearsalOperationResolvedRoots,
} from "./EventContractCollectionRunnerRehearsalOperationPreflight";

export const COLLECTION_RUNNER_REHEARSAL_OPERATION_COMPOSITION_POLICY =
  "OWNER_GATED_NETWORK_FREE_COMPOSITION_V1" as const;

const COMPOSED_PHASES = Object.freeze([
  CollectionRunnerRehearsalOperationPhase.Prepare,
  CollectionRunnerRehearsalOperationPhase.Step,
  CollectionRunnerRehearsalOperationPhase.Validate,
  CollectionRunnerRehearsalOperationPhase.Freeze,
  CollectionRunnerRehearsalOperationPhase.Package,
] as const);

export type CollectionRunnerRehearsalOperationMutationPhaseSet = Readonly<
  Record<
    (typeof COMPOSED_PHASES)[number],
    CollectionRunnerRehearsalOperationPhasePort
  >
>;

export type CollectionRunnerRehearsalOperationDurableObservationPhaseSet =
  Readonly<
  Record<
    (typeof COMPOSED_PHASES)[number],
    CollectionRunnerRehearsalOperationDurableTruthPort
  >
>;

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

function assertExactPhaseSet(
  phases: Readonly<Record<string, unknown>>,
  method: "invokeOne" | "observe",
  label: string,
): void {
  const actual = Object.keys(phases).sort();
  const expected = [...COMPOSED_PHASES].sort();
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) throw new Error(`${label} is not the exact closed set.`);
  for (const phase of COMPOSED_PHASES) {
    if (
      typeof (phases[phase] as Record<string, unknown> | undefined)?.[method] !==
      "function"
    ) throw new Error(`${label} ${phase} adapter is incomplete.`);
  }
}

export class ClosedCollectionRunnerRehearsalOperationMutationComposition
  implements CollectionRunnerRehearsalOperationPhasePort {
  public readonly policy =
    COLLECTION_RUNNER_REHEARSAL_OPERATION_COMPOSITION_POLICY;
  public readonly fingerprint: string;
  readonly #phases: CollectionRunnerRehearsalOperationMutationPhaseSet;

  public constructor(phases: CollectionRunnerRehearsalOperationMutationPhaseSet) {
    assertExactPhaseSet(phases, "invokeOne", "Operation mutation composition");
    this.#phases = Object.freeze({ ...phases });
    this.fingerprint = sha({
      policy: this.policy,
      authority: "MUTATION",
      phases: COMPOSED_PHASES,
      networkPermitted: false,
      credentialAccessPermitted: false,
      callerSelectedTransportPermitted: false,
    });
    Object.freeze(this);
  }

  public invokeOne(
    manifest: CollectionRunnerRehearsalOperationManifest,
    command: CollectionRunnerRehearsalOperationPhaseCommand,
    authorization: CollectionRunnerRehearsalOperationAuthorizationReceipt,
  ): CollectionRunnerRehearsalOperationPhaseEvidence {
    return this.#adapter(command.phase).invokeOne(
      manifest,
      command,
      authorization,
    );
  }

  public adapterIdentity(
    phase: CollectionRunnerRehearsalOperationPhase,
  ): object {
    return this.#adapter(phase);
  }

  #adapter(
    phase: CollectionRunnerRehearsalOperationPhase,
  ): CollectionRunnerRehearsalOperationPhasePort {
    if (!COMPOSED_PHASES.includes(
      phase as (typeof COMPOSED_PHASES)[number],
    )) throw new Error("Phase is outside the closed mutation composition.");
    return this.#phases[phase as (typeof COMPOSED_PHASES)[number]];
  }
}

export class ClosedCollectionRunnerRehearsalOperationDurableTruthComposition
  implements CollectionRunnerRehearsalOperationDurableTruthPort {
  public readonly policy =
    COLLECTION_RUNNER_REHEARSAL_OPERATION_COMPOSITION_POLICY;
  public readonly fingerprint: string;
  readonly #phases: CollectionRunnerRehearsalOperationDurableObservationPhaseSet;

  public constructor(
    phases: CollectionRunnerRehearsalOperationDurableObservationPhaseSet,
  ) {
    assertExactPhaseSet(
      phases,
      "observe",
      "Operation durable-observation composition",
    );
    this.#phases = Object.freeze({ ...phases });
    this.fingerprint = sha({
      policy: this.policy,
      authority: "INDEPENDENT_READ_ONLY_DURABLE_OBSERVATION",
      phases: COMPOSED_PHASES,
      networkPermitted: false,
      credentialAccessPermitted: false,
      callerSelectedTransportPermitted: false,
    });
    Object.freeze(this);
  }

  public observe(
    manifest: CollectionRunnerRehearsalOperationManifest,
    command: CollectionRunnerRehearsalOperationPhaseCommand,
    authorization: CollectionRunnerRehearsalOperationAuthorizationReceipt,
    claimedEvidence: CollectionRunnerRehearsalOperationPhaseEvidence,
  ): CollectionRunnerRehearsalOperationPhaseEvidence {
    return this.#adapter(command.phase).observe(
      manifest,
      command,
      authorization,
      claimedEvidence,
    );
  }

  public adapterIdentity(
    phase: CollectionRunnerRehearsalOperationPhase,
  ): object {
    return this.#adapter(phase);
  }

  #adapter(
    phase: CollectionRunnerRehearsalOperationPhase,
  ): CollectionRunnerRehearsalOperationDurableTruthPort {
    if (!COMPOSED_PHASES.includes(
      phase as (typeof COMPOSED_PHASES)[number],
    )) throw new Error(
      "Phase is outside the closed durable-observation composition.",
    );
    return this.#phases[phase as (typeof COMPOSED_PHASES)[number]];
  }
}

export class FixedCollectionRunnerRehearsalOperationCapabilityInspection
  implements CollectionRunnerRehearsalOperationCapabilityInspectionPort {
  public constructor(
    private readonly mutation:
      ClosedCollectionRunnerRehearsalOperationMutationComposition,
    private readonly durableTruth:
      ClosedCollectionRunnerRehearsalOperationDurableTruthComposition,
  ) {
    if (
      mutation.policy !==
        COLLECTION_RUNNER_REHEARSAL_OPERATION_COMPOSITION_POLICY ||
      durableTruth.policy !==
        COLLECTION_RUNNER_REHEARSAL_OPERATION_COMPOSITION_POLICY
    ) throw new Error("Operation composition policy is not exact.");
    for (const phase of COMPOSED_PHASES) {
      if (
        mutation.adapterIdentity(phase) ===
        durableTruth.adapterIdentity(phase)
      ) {
        throw new Error(
          `Operation ${phase} mutation and durable observation are not independent.`,
        );
      }
    }
    Object.freeze(this);
  }

  public inspect(
    _manifest: CollectionRunnerRehearsalOperationManifest,
    command: CollectionRunnerRehearsalOperationPhaseCommand,
    _roots: CollectionRunnerRehearsalOperationResolvedRoots,
  ): {
    readonly networkCapabilityAbsent: boolean;
    readonly credentialCapabilityAbsent: boolean;
  } {
    const composed = COMPOSED_PHASES.includes(
      command.phase as (typeof COMPOSED_PHASES)[number],
    );
    return Object.freeze({
      networkCapabilityAbsent: composed,
      credentialCapabilityAbsent: composed,
    });
  }
}
