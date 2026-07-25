import {
  CollectionRunnerRuntimeHealthStatus,
  type CollectionRunnerPilotState,
  type CollectionRunnerTaskState,
  type CollectionRunnerRuntimeForegroundStepRequest,
  type CollectionRunnerRuntimeTerminalReport,
  type DurableFixtureRehearsalOperationClaim,
  type DurableFixtureRehearsalPhaseRequest,
  type DurableFixtureRehearsalStepEvidence,
} from "../../contracts";
import {
  createCollectionRunnerRuntimeTerminalReport,
} from "../event-contract-collection-runner-runtime";
import type {
  DurableFixtureRehearsalStepPort,
} from "./EventContractCollectionRunnerDurableFixtureRehearsalCoordinator";

export interface DurableFixtureRehearsalForegroundPort {
  run(
    request: CollectionRunnerRuntimeForegroundStepRequest,
  ): CollectionRunnerRuntimeTerminalReport;
}

export interface DurableFixtureRehearsalForegroundRequestResolver {
  resolve(
    request: DurableFixtureRehearsalPhaseRequest,
  ): CollectionRunnerRuntimeForegroundStepRequest;
}

export interface DurableFixtureRehearsalAfterStepObservation {
  readonly resultingPilotState: CollectionRunnerPilotState;
  readonly resultingTaskState: CollectionRunnerTaskState;
  readonly outboxChronologyFingerprint: string;
  readonly recoveryFingerprint: string;
}

export interface DurableFixtureRehearsalAfterStepObservationPort {
  read(
    request: DurableFixtureRehearsalPhaseRequest,
    report: CollectionRunnerRuntimeTerminalReport,
  ): DurableFixtureRehearsalAfterStepObservation;
}

function verifyReport(
  report: CollectionRunnerRuntimeTerminalReport,
): CollectionRunnerRuntimeTerminalReport {
  const { deterministic, fingerprint, ...input } = report;
  const verified = createCollectionRunnerRuntimeTerminalReport(input);
  if (deterministic !== true || verified.fingerprint !== fingerprint) {
    throw new Error("Foreground terminal report fingerprint is invalid.");
  }
  return verified;
}

export class EventContractCollectionRunnerDurableFixtureRehearsalStepAdapter
  implements DurableFixtureRehearsalStepPort {
  public constructor(
    private readonly foreground: DurableFixtureRehearsalForegroundPort,
    private readonly resolver:
      DurableFixtureRehearsalForegroundRequestResolver,
    private readonly observation:
      DurableFixtureRehearsalAfterStepObservationPort,
  ) {}

  public executeOne(
    request: DurableFixtureRehearsalPhaseRequest,
    claim: DurableFixtureRehearsalOperationClaim,
  ): DurableFixtureRehearsalStepEvidence {
    const foregroundRequest = this.resolver.resolve(request);
    if (foregroundRequest.invocationId !== request.invocationId) {
      throw new Error(
        "Registered foreground request changed the invocation identity.",
      );
    }
    const report = verifyReport(this.foreground.run(foregroundRequest));
    if (
      report.invocationId !== request.invocationId ||
      report.processSessionId !== claim.processSessionId ||
      report.bootIdentity !== claim.bootIdentity ||
      report.action === null ||
      report.healthStatus !== CollectionRunnerRuntimeHealthStatus.Healthy ||
      report.recoveryRequired ||
      report.ambiguityPreserved ||
      report.stopBarrierTripped
    ) {
      throw new Error(
        "Foreground terminal report cannot prove one clean fixture action.",
      );
    }
    const observed = this.observation.read(request, report);
    return {
      selectedAction: report.action,
      resultingPilotState: observed.resultingPilotState,
      resultingTaskState: observed.resultingTaskState,
      outcome: report.outcome,
      terminalReportFingerprint: report.fingerprint,
      durableTransitionFingerprint: report.durableReceiptFingerprint,
      outboxChronologyFingerprint:
        observed.outboxChronologyFingerprint,
      recoveryFingerprint: observed.recoveryFingerprint,
    };
  }
}
