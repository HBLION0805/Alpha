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

export interface CollectionRunnerRehearsalOperationComposedPhaseAdapter
  extends CollectionRunnerRehearsalOperationPhasePort,
    CollectionRunnerRehearsalOperationDurableTruthPort {}

export type CollectionRunnerRehearsalOperationComposedPhaseSet = Readonly<
  Record<
    (typeof COMPOSED_PHASES)[number],
    CollectionRunnerRehearsalOperationComposedPhaseAdapter
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

export class ClosedCollectionRunnerRehearsalOperationPhaseComposition
  implements
    CollectionRunnerRehearsalOperationPhasePort,
    CollectionRunnerRehearsalOperationDurableTruthPort
{
  public readonly policy =
    COLLECTION_RUNNER_REHEARSAL_OPERATION_COMPOSITION_POLICY;
  public readonly fingerprint: string;
  readonly #phases: CollectionRunnerRehearsalOperationComposedPhaseSet;

  public constructor(phases: CollectionRunnerRehearsalOperationComposedPhaseSet) {
    const actual = Object.keys(phases).sort();
    const expected = [...COMPOSED_PHASES].sort();
    if (
      actual.length !== expected.length ||
      actual.some((value, index) => value !== expected[index])
    ) throw new Error("Operation phase composition is not the exact closed set.");
    for (const phase of COMPOSED_PHASES) {
      const adapter = phases[phase];
      if (
        typeof adapter?.invokeOne !== "function" ||
        typeof adapter.observe !== "function"
      ) throw new Error(`Operation ${phase} adapter is incomplete.`);
    }
    this.#phases = Object.freeze({ ...phases });
    this.fingerprint = sha({
      policy: this.policy,
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

  #adapter(
    phase: CollectionRunnerRehearsalOperationPhase,
  ): CollectionRunnerRehearsalOperationComposedPhaseAdapter {
    if (!COMPOSED_PHASES.includes(
      phase as (typeof COMPOSED_PHASES)[number],
    )) throw new Error("Phase is outside the closed operation composition.");
    return this.#phases[phase as (typeof COMPOSED_PHASES)[number]];
  }
}

export class FixedCollectionRunnerRehearsalOperationCapabilityInspection
  implements CollectionRunnerRehearsalOperationCapabilityInspectionPort {
  public constructor(
    private readonly composition:
      ClosedCollectionRunnerRehearsalOperationPhaseComposition,
  ) {
    if (
      composition.policy !==
        COLLECTION_RUNNER_REHEARSAL_OPERATION_COMPOSITION_POLICY
    ) throw new Error("Operation composition policy is not exact.");
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
