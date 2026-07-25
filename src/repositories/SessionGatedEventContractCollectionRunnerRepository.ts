import {
  CollectionRunnerRepositoryError,
  CollectionRunnerRepositoryErrorCode,
  type EventContractCollectionRunnerRepository,
} from "./EventContractCollectionRunnerRepository";
import type {
  EventContractCollectionRunnerRecoveryControlRepository,
  ValidateRecoverySessionGateInput,
} from "./EventContractCollectionRunnerRecoveryControlRepository";

export interface CollectionRunnerProcessSessionIdentity {
  readonly sessionAuthorizationId: string;
  readonly authorizationFingerprint: string;
  readonly activationId: string;
  readonly bootIdentity: string;
  readonly processSessionId: string;
}

export class CollectionRunnerProcessStopBarrier {
  #tripped = false;
  #reasonCode: string | null = null;

  public trip(reasonCode: string): void {
    if (this.#tripped) return;
    if (!/^[A-Z][A-Z0-9_]{0,63}$/u.test(reasonCode)) {
      throw new CollectionRunnerRepositoryError(
        CollectionRunnerRepositoryErrorCode.InvalidInput,
        "Stop-barrier reason code is invalid.",
      );
    }
    this.#reasonCode = reasonCode;
    this.#tripped = true;
  }

  public isTripped(): boolean {
    return this.#tripped;
  }

  public getReasonCode(): string | null {
    return this.#reasonCode;
  }
}

export class SessionGatedEventContractCollectionRunnerRepository
  implements EventContractCollectionRunnerRepository
{
  readonly #session: CollectionRunnerProcessSessionIdentity;

  public constructor(
    private readonly repository: EventContractCollectionRunnerRepository,
    private readonly recoveryControl:
      EventContractCollectionRunnerRecoveryControlRepository,
    session: CollectionRunnerProcessSessionIdentity,
    private readonly stopBarrier: CollectionRunnerProcessStopBarrier,
  ) {
    this.#session = Object.freeze(structuredClone(session));
  }

  public registerRunnerDefinition(
    _transaction: Parameters<
      EventContractCollectionRunnerRepository["registerRunnerDefinition"]
    >[0],
  ): ReturnType<
    EventContractCollectionRunnerRepository["registerRunnerDefinition"]
  > {
    return this.#newAuthorityDenied();
  }

  public createPilotArtifact(
    _transaction: Parameters<
      EventContractCollectionRunnerRepository["createPilotArtifact"]
    >[0],
  ): ReturnType<
    EventContractCollectionRunnerRepository["createPilotArtifact"]
  > {
    return this.#newAuthorityDenied();
  }

  public materializeTasks(
    _transaction: Parameters<
      EventContractCollectionRunnerRepository["materializeTasks"]
    >[0],
  ): ReturnType<EventContractCollectionRunnerRepository["materializeTasks"]> {
    return this.#newAuthorityDenied();
  }

  public transitionPilot(
    transaction: Parameters<
      EventContractCollectionRunnerRepository["transitionPilot"]
    >[0],
  ): ReturnType<EventContractCollectionRunnerRepository["transitionPilot"]> {
    if (transaction.activationId !== this.#session.activationId) {
      return this.#authorityDenied("Pilot is outside the resumed activation.");
    }
    this.#assertGate(transaction.clock.observedAtUtc, null);
    return this.repository.transitionPilot(transaction);
  }

  public transitionTask(
    transaction: Parameters<
      EventContractCollectionRunnerRepository["transitionTask"]
    >[0],
  ): ReturnType<EventContractCollectionRunnerRepository["transitionTask"]> {
    this.#assertGate(transaction.clock.observedAtUtc, transaction.taskId);
    return this.repository.transitionTask(transaction);
  }

  public acquireTaskLease(
    transaction: Parameters<
      EventContractCollectionRunnerRepository["acquireTaskLease"]
    >[0],
  ): ReturnType<EventContractCollectionRunnerRepository["acquireTaskLease"]> {
    if (
      transaction.lease.bootIdentity !== this.#session.bootIdentity ||
      transaction.lease.processSessionId !== this.#session.processSessionId
    ) {
      return this.#authorityDenied(
        "Lease identity does not match the authorized process session.",
      );
    }
    this.#assertGate(transaction.clock.observedAtUtc, transaction.taskId);
    return this.repository.acquireTaskLease(transaction);
  }

  public startTaskAttempt(
    transaction: Parameters<
      EventContractCollectionRunnerRepository["startTaskAttempt"]
    >[0],
  ): ReturnType<EventContractCollectionRunnerRepository["startTaskAttempt"]> {
    this.#assertGate(transaction.clock.observedAtUtc, transaction.taskId);
    return this.repository.startTaskAttempt(transaction);
  }

  public markTaskValidating(
    transaction: Parameters<
      EventContractCollectionRunnerRepository["markTaskValidating"]
    >[0],
  ): ReturnType<
    EventContractCollectionRunnerRepository["markTaskValidating"]
  > {
    this.#assertGate(transaction.clock.observedAtUtc, transaction.taskId);
    return this.repository.markTaskValidating(transaction);
  }

  public finalizeTaskFailure(
    transaction: Parameters<
      EventContractCollectionRunnerRepository["finalizeTaskFailure"]
    >[0],
  ): ReturnType<
    EventContractCollectionRunnerRepository["finalizeTaskFailure"]
  > {
    this.#assertGate(transaction.evidence.occurredAtUtc, transaction.taskId);
    return this.repository.finalizeTaskFailure(transaction);
  }

  public commitTaskEvidence(
    transaction: Parameters<
      EventContractCollectionRunnerRepository["commitTaskEvidence"]
    >[0],
  ): ReturnType<
    EventContractCollectionRunnerRepository["commitTaskEvidence"]
  > {
    this.#assertGate(transaction.committedAtUtc, transaction.taskId);
    return this.repository.commitTaskEvidence(transaction);
  }

  public getRunnerDefinition(
    ...input: Parameters<
      EventContractCollectionRunnerRepository["getRunnerDefinition"]
    >
  ): ReturnType<
    EventContractCollectionRunnerRepository["getRunnerDefinition"]
  > {
    return this.repository.getRunnerDefinition(...input);
  }

  public getPilotState(
    ...input: Parameters<
      EventContractCollectionRunnerRepository["getPilotState"]
    >
  ): ReturnType<EventContractCollectionRunnerRepository["getPilotState"]> {
    return this.repository.getPilotState(...input);
  }

  public getTaskState(
    ...input: Parameters<
      EventContractCollectionRunnerRepository["getTaskState"]
    >
  ): ReturnType<EventContractCollectionRunnerRepository["getTaskState"]> {
    return this.repository.getTaskState(...input);
  }

  public getBudgetCounters(
    ...input: Parameters<
      EventContractCollectionRunnerRepository["getBudgetCounters"]
    >
  ): ReturnType<
    EventContractCollectionRunnerRepository["getBudgetCounters"]
  > {
    return this.repository.getBudgetCounters(...input);
  }

  public getEvidenceByTaskId(
    ...input: Parameters<
      EventContractCollectionRunnerRepository["getEvidenceByTaskId"]
    >
  ): ReturnType<
    EventContractCollectionRunnerRepository["getEvidenceByTaskId"]
  > {
    return this.repository.getEvidenceByTaskId(...input);
  }

  #assertGate(observedAtUtc: string, taskId: string | null): void {
    if (this.stopBarrier.isTripped()) {
      this.#authorityDenied("Process-local Emergency Stop barrier is active.");
    }
    const input: ValidateRecoverySessionGateInput = {
      ...this.#session,
      observedAtUtc,
      taskId,
    };
    try {
      this.recoveryControl.validateRecoverySessionGate(input);
    } catch (cause) {
      throw new CollectionRunnerRepositoryError(
        CollectionRunnerRepositoryErrorCode.AuthorityMismatch,
        "Recovery session gate rejected repository mutation.",
        { cause },
      );
    }
  }

  #newAuthorityDenied(): never {
    return this.#authorityDenied(
      "A recovery session cannot create definitions, Pilots, or new task authority.",
    );
  }

  #authorityDenied(message: string): never {
    throw new CollectionRunnerRepositoryError(
      CollectionRunnerRepositoryErrorCode.AuthorityMismatch,
      message,
    );
  }
}
