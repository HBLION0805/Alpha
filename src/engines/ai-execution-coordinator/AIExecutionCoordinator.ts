import {
  AIExecutionAttemptStatus,
  AIExecutionCoordinatorErrorCategory,
  AIExecutionCoordinatorStatus,
  AIExecutionPreconditionStatus,
  AIExecutionStatus,
  AIProviderAdapterErrorCategory,
  AIProviderHealthStatus,
  AIReservationInstructionType,
  AIRetryAction,
  AIUsageSettlementInstructionType,
  BudgetReservationStatus,
  CostDecisionStatus,
  RoutingDecisionStatus,
  type AIExecutionAttempt,
  type AIExecutionAuditRecord,
  type AIExecutionCoordinator,
  type AIExecutionCoordinatorError,
  type AIExecutionCoordinatorRequest,
  type AIExecutionCoordinatorResult,
  type AIExecutionPlan,
  type AIExecutionPreconditionCheck,
  type AIExecutionRequest,
  type AIExecutionResponse,
  type AIFallbackExecutionPlan,
  type AIProviderAdapter,
  type AIProviderAdapterDescriptor,
  type AIProviderAdapterRegistry,
  type AIProviderHealth,
  type AIReservationInstruction,
  type AIRetryPlan,
  type AIUsageRecord,
  type AIUsageSettlementInstruction,
  validateAIAdapterCompatibility,
  validateAIExecutionCoordinatorRequest,
  validateAIExecutionResponse,
  validateAIProviderAdapterDescriptor,
  validateAIProviderHealth,
} from "../../contracts";
import { evaluateAdapterCompatibility } from "../ai-provider-adapter";

export interface AIExecutionCoordinatorClock {
  now(): string;
}

export interface AIExecutionIdSource {
  nextId(requestId: string): string;
}

export interface AIExecutionCoordinatorDependencies {
  readonly clock: AIExecutionCoordinatorClock;
  readonly executionIdSource: AIExecutionIdSource;
}

interface OutcomeOptions {
  readonly request: AIExecutionCoordinatorRequest;
  readonly executionId: string;
  readonly timestamp: string;
  readonly status: AIExecutionCoordinatorStatus;
  readonly reasons: ReadonlyArray<string>;
  readonly checks: ReadonlyArray<AIExecutionPreconditionCheck>;
  readonly retryPlan: AIRetryPlan;
  readonly reservationInstructions: ReadonlyArray<AIReservationInstruction>;
  readonly usageSettlementInstructions: ReadonlyArray<AIUsageSettlementInstruction>;
  readonly executionPlan?: AIExecutionPlan;
  readonly response?: AIExecutionResponse;
  readonly attempts?: ReadonlyArray<AIExecutionAttempt>;
  readonly fallbackPlan?: AIFallbackExecutionPlan;
  readonly adapterDescriptor?: Readonly<AIProviderAdapterDescriptor>;
  readonly providerHealth?: Readonly<AIProviderHealth>;
  readonly error?: AIExecutionCoordinatorError;
}

const PERMITTED_COST_STATUSES: ReadonlyArray<CostDecisionStatus> = [
  CostDecisionStatus.Allowed,
  CostDecisionStatus.AllowedLowCostOnly,
  CostDecisionStatus.AllowedWithOverride,
];

function nonEmpty(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function addCheck(
  checks: AIExecutionPreconditionCheck[],
  name: string,
  passed: boolean,
  reason: string,
): boolean {
  checks.push({
    name,
    status: passed
      ? AIExecutionPreconditionStatus.Passed
      : AIExecutionPreconditionStatus.Failed,
    reason,
  });
  return passed;
}

function noRetry(
  request: AIExecutionCoordinatorRequest,
  reason: string,
): AIRetryPlan {
  return {
    action: AIRetryAction.NoRetry,
    reason,
    currentAttempt: request.attemptNumber,
    remainingAttempts: Math.max(
      request.policy.maximumAttempts - request.attemptNumber,
      0,
    ),
    retryable: false,
  };
}

function createRetryPlan(
  request: AIExecutionCoordinatorRequest,
  category: AIProviderAdapterErrorCategory,
  providerRetryable: boolean,
): AIRetryPlan {
  const remainingAttempts = Math.max(
    request.policy.maximumAttempts - request.attemptNumber,
    0,
  );
  if (
    providerRetryable &&
    remainingAttempts > 0 &&
    request.policy.retrySameAdapterOn.includes(category)
  ) {
    return {
      action: AIRetryAction.RetrySameAdapter,
      reason: `Policy permits one future same-adapter attempt for ${category}.`,
      currentAttempt: request.attemptNumber,
      remainingAttempts,
      retryable: true,
      nextAttemptNumber: request.attemptNumber + 1,
    };
  }
  if (request.policy.returnToRouterOn.includes(category)) {
    return {
      action: AIRetryAction.ReturnToRouterForFallback,
      reason: `Policy returns ${category} to the Router for a new decision.`,
      currentAttempt: request.attemptNumber,
      remainingAttempts,
      retryable: false,
    };
  }
  return {
    action: AIRetryAction.RejectFinal,
    reason: `Policy does not permit another attempt for ${category}.`,
    currentAttempt: request.attemptNumber,
    remainingAttempts,
    retryable: false,
  };
}

function createFallbackPlan(
  request: AIExecutionCoordinatorRequest,
  providerId: string,
  modelId: string,
  retryPlan: AIRetryPlan,
): AIFallbackExecutionPlan | undefined {
  if (retryPlan.action !== AIRetryAction.ReturnToRouterForFallback) {
    return undefined;
  }
  return {
    returnToRouter: true,
    routingDecisionId: request.routingDecision.decisionId,
    excludedProviderId: providerId,
    excludedModelId: modelId,
    reason: retryPlan.reason,
  };
}

function createCoordinatorError(
  category: AIExecutionCoordinatorErrorCategory,
  message: string,
  retryable: boolean,
  timestamp: string,
): AIExecutionCoordinatorError {
  return {
    category,
    code: category,
    safeMessage: message,
    retryable,
    occurredAt: timestamp,
  };
}

function instructionBase(
  request: AIExecutionCoordinatorRequest,
  executionId: string,
  timestamp: string,
  reason: string,
  actualReportedAmount?: AIUsageRecord["reportedCost"],
) {
  const reservation = request.plannedReservation;
  if (reservation === undefined) {
    return undefined;
  }
  return {
    reservationId: reservation.reservationId,
    requestId: request.originalRequest.requestId,
    estimatedReservedAmount: reservation.amount,
    ...(actualReportedAmount === undefined ? {} : { actualReportedAmount }),
    reason,
    timestamp,
    executionId,
    policyVersion: request.policy.version,
  };
}

function failureInstructions(
  request: AIExecutionCoordinatorRequest,
  executionId: string,
  timestamp: string,
  retryPlan: AIRetryPlan,
): {
  readonly reservation: ReadonlyArray<AIReservationInstruction>;
  readonly usage: ReadonlyArray<AIUsageSettlementInstruction>;
} {
  const retain =
    retryPlan.action === AIRetryAction.RetrySameAdapter &&
    request.policy.retainReservationForRetry;
  const base = instructionBase(
    request,
    executionId,
    timestamp,
    retain
      ? "Retain the reservation for the explicitly planned future retry."
      : "Release the reservation because this coordinator invocation did not succeed.",
  );
  if (base === undefined) {
    return { reservation: [], usage: [] };
  }
  return {
    reservation: [
      {
        ...base,
        type: retain
          ? AIReservationInstructionType.RetainForRetry
          : AIReservationInstructionType.ReleaseReservation,
      },
    ],
    usage: [
      {
        ...base,
        type: AIUsageSettlementInstructionType.NoAction,
        reason: "No successful usage is available to commit.",
      },
    ],
  };
}

function successInstructions(
  request: AIExecutionCoordinatorRequest,
  executionId: string,
  timestamp: string,
  usage: AIUsageRecord,
): {
  readonly reservation: ReadonlyArray<AIReservationInstruction>;
  readonly usage: ReadonlyArray<AIUsageSettlementInstruction>;
  readonly overrun: boolean;
} {
  const base = instructionBase(
    request,
    executionId,
    timestamp,
    "Settle the completed provider-neutral execution.",
    usage.reportedCost,
  );
  if (base === undefined) {
    return { reservation: [], usage: [], overrun: false };
  }
  const reported = usage.reportedCost;
  const overrun =
    reported !== undefined &&
    reported.minorUnits > base.estimatedReservedAmount.minorUnits;
  const unused =
    reported !== undefined &&
    reported.minorUnits < base.estimatedReservedAmount.minorUnits;
  const usageInstruction: AIUsageSettlementInstruction = {
    ...base,
    type:
      reported === undefined
        ? AIUsageSettlementInstructionType.NoAction
        : AIUsageSettlementInstructionType.CommitUsage,
    reason:
      reported === undefined
        ? "Provider-reported cost is unavailable; no cost commit is instructed."
        : "Commit the validated provider-reported usage through the future ledger service.",
  };
  const reservationInstruction: AIReservationInstruction = {
    ...base,
    type:
      unused && request.policy.releaseUnusedReservation
        ? AIReservationInstructionType.ReleaseUnusedReservation
        : AIReservationInstructionType.NoAction,
    reason:
      unused && request.policy.releaseUnusedReservation
        ? "Release the unused portion after actual usage is committed."
        : overrun
          ? "Actual reported cost exceeded the reservation; preserve this condition for review."
          : "No separate reservation release is required.",
  };
  return {
    reservation: [reservationInstruction],
    usage: [usageInstruction],
    overrun,
  };
}

function finalResultForStatus(
  status: AIExecutionCoordinatorStatus,
): AIExecutionAuditRecord["finalResult"] {
  switch (status) {
    case AIExecutionCoordinatorStatus.ExecutionSucceeded:
      return "SUCCEEDED";
    case AIExecutionCoordinatorStatus.ExecutionRejectedPrecondition:
      return "REJECTED";
    case AIExecutionCoordinatorStatus.ExecutionCancelled:
      return "CANCELLED";
    case AIExecutionCoordinatorStatus.ExecutionTimedOut:
      return "TIMED_OUT";
    case AIExecutionCoordinatorStatus.ExecutionDeferred:
      return "DEFERRED";
    case AIExecutionCoordinatorStatus.ExecutionRequiresReroute:
      return "REROUTE";
    case AIExecutionCoordinatorStatus.ExecutionInvalidResponse:
      return "INVALID_RESPONSE";
    default:
      return "FAILED";
  }
}

function createOutcome(options: OutcomeOptions): AIExecutionCoordinatorResult {
  const request = options.request;
  const selected =
    request.routingDecision.status === RoutingDecisionStatus.AiSelected
      ? request.routingDecision
      : undefined;
  const attempts = options.attempts ?? [];
  const usage =
    options.response?.status === AIExecutionStatus.Completed
      ? options.response.usage
      : options.response?.usage;
  const auditRecord: AIExecutionAuditRecord = {
    auditId: `${options.executionId}:audit`,
    executionId: options.executionId,
    requestId: request.originalRequest.requestId,
    traceId: request.traceId,
    ...(request.correlationId === undefined
      ? {}
      : { correlationId: request.correlationId }),
    timestamp: options.timestamp,
    routingDecisionId: request.routingDecision.decisionId,
    ...(selected === undefined
      ? {}
      : {
          selectedProviderId: selected.selectedProviderId,
          selectedModelId: selected.selectedModelId,
        }),
    routingPolicyVersion: request.routingDecision.policyVersion,
    costGovernorDecisionId: request.costDecision.decisionId,
    costGovernorStatus: request.costDecision.status,
    budgetPolicyVersion: request.costDecision.policyVersion,
    ...(request.plannedReservation === undefined
      ? {}
      : { reservationId: request.plannedReservation.reservationId }),
    ...(options.adapterDescriptor === undefined
      ? {}
      : { adapterDescriptor: options.adapterDescriptor }),
    ...(options.providerHealth === undefined
      ? {}
      : { providerHealth: options.providerHealth }),
    preconditionChecks: options.checks,
    ...(options.executionPlan === undefined
      ? {}
      : { executionPlan: options.executionPlan }),
    attempts,
    outputStatus: options.status,
    ...(usage === undefined ? {} : { usage }),
    ...(options.response === undefined
      ? {}
      : { latencyMs: options.response.metadata.latencyMs }),
    ...(usage?.reportedCost === undefined
      ? {}
      : { reportedCost: usage.reportedCost }),
    retryPlan: options.retryPlan,
    ...(options.fallbackPlan === undefined
      ? {}
      : { fallbackPlan: options.fallbackPlan }),
    reservationInstructions: options.reservationInstructions,
    usageSettlementInstructions: options.usageSettlementInstructions,
    ...(options.error === undefined ? {} : { error: options.error }),
    finalResult: finalResultForStatus(options.status),
  };
  return {
    executionId: options.executionId,
    status: options.status,
    reasons: options.reasons,
    ...(options.executionPlan === undefined
      ? {}
      : { executionPlan: options.executionPlan }),
    ...(options.response === undefined ? {} : { response: options.response }),
    attempts,
    retryPlan: options.retryPlan,
    ...(options.fallbackPlan === undefined
      ? {}
      : { fallbackPlan: options.fallbackPlan }),
    reservationInstructions: options.reservationInstructions,
    usageSettlementInstructions: options.usageSettlementInstructions,
    auditRecord,
    ...(options.error === undefined ? {} : { error: options.error }),
  };
}

function mapAdapterError(
  category: AIProviderAdapterErrorCategory,
): AIExecutionCoordinatorErrorCategory {
  switch (category) {
    case AIProviderAdapterErrorCategory.Cancelled:
      return AIExecutionCoordinatorErrorCategory.Cancelled;
    case AIProviderAdapterErrorCategory.Timeout:
      return AIExecutionCoordinatorErrorCategory.Timeout;
    case AIProviderAdapterErrorCategory.ProviderUnavailable:
    case AIProviderAdapterErrorCategory.RateLimited:
      return AIExecutionCoordinatorErrorCategory.ProviderUnavailable;
    default:
      return AIExecutionCoordinatorErrorCategory.ProviderExecutionFailed;
  }
}

function statusForAdapterFailure(
  response: Exclude<AIExecutionResponse, { status: AIExecutionStatus.Completed }>,
  retryPlan: AIRetryPlan,
): AIExecutionCoordinatorStatus {
  if (response.status === AIExecutionStatus.Cancelled) {
    return AIExecutionCoordinatorStatus.ExecutionCancelled;
  }
  if (response.status === AIExecutionStatus.TimedOut) {
    return AIExecutionCoordinatorStatus.ExecutionTimedOut;
  }
  if (retryPlan.action === AIRetryAction.ReturnToRouterForFallback) {
    return AIExecutionCoordinatorStatus.ExecutionRequiresReroute;
  }
  return AIExecutionCoordinatorStatus.ExecutionFailedAdapter;
}

export class DeterministicAIExecutionCoordinator
  implements AIExecutionCoordinator
{
  constructor(
    private readonly dependencies: AIExecutionCoordinatorDependencies,
  ) {}

  async execute(
    request: Readonly<AIExecutionCoordinatorRequest>,
    adapterRegistry: AIProviderAdapterRegistry,
  ): Promise<AIExecutionCoordinatorResult> {
    const timestamp = this.dependencies.clock.now();
    const executionId = this.dependencies.executionIdSource.nextId(
      request.originalRequest.requestId,
    );
    const checks: AIExecutionPreconditionCheck[] = [];

    if (!nonEmpty(executionId) || !Number.isFinite(Date.parse(timestamp))) {
      return this.preconditionFailure(
        request,
        executionId.trim().length === 0 ? "INVALID_EXECUTION_ID" : executionId,
        timestamp,
        checks,
        AIExecutionCoordinatorErrorCategory.InvalidCoordinatorRequest,
        "Injected execution identity or timestamp is invalid.",
      );
    }

    try {
      validateAIExecutionCoordinatorRequest(request);
      addCheck(checks, "COORDINATOR_REQUEST_VALID", true, "Coordinator request is structurally valid.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      addCheck(checks, "COORDINATOR_REQUEST_VALID", false, message);
      return this.preconditionFailure(
        request,
        executionId,
        timestamp,
        checks,
        AIExecutionCoordinatorErrorCategory.InvalidCoordinatorRequest,
        `Coordinator request validation failed: ${message}`,
      );
    }

    if (
      !addCheck(
        checks,
        "ROUTING_APPROVED",
        request.routingDecision.status === RoutingDecisionStatus.AiSelected,
        request.routingDecision.status === RoutingDecisionStatus.AiSelected
          ? "Router selected an AI provider and model."
          : "Routing decision did not approve AI execution.",
      )
    ) {
      return this.preconditionFailure(
        request,
        executionId,
        timestamp,
        checks,
        AIExecutionCoordinatorErrorCategory.RoutingNotApproved,
        "Routing did not produce an approved provider/model selection.",
      );
    }

    const routingDecision = request.routingDecision;
    if (routingDecision.status !== RoutingDecisionStatus.AiSelected) {
      throw new Error("Unreachable routing state.");
    }
    const routingReferencesMatch =
      routingDecision.requestId === request.originalRequest.requestId &&
      request.routingAuditRecord.requestId === request.originalRequest.requestId &&
      request.routingAuditRecord.decisionId === routingDecision.decisionId &&
      request.routingAuditRecord.selectedProviderId ===
        routingDecision.selectedProviderId &&
      request.routingAuditRecord.selectedModelId === routingDecision.selectedModelId &&
      request.routingAuditRecord.policyVersion === routingDecision.policyVersion;
    if (
      !addCheck(
        checks,
        "ROUTING_REFERENCES_MATCH",
        routingReferencesMatch,
        routingReferencesMatch
          ? "Routing request, audit, policy, provider, and model references match."
          : "Routing references are inconsistent.",
      )
    ) {
      return this.preconditionFailure(
        request,
        executionId,
        timestamp,
        checks,
        AIExecutionCoordinatorErrorCategory.InternalReferenceMismatch,
        "Routing references do not match the original request and audit.",
      );
    }

    const costPermitted = PERMITTED_COST_STATUSES.includes(
      request.costDecision.status,
    );
    if (
      !addCheck(
        checks,
        "COST_APPROVED",
        costPermitted,
        costPermitted
          ? "Cost Governor permits execution."
          : "Cost Governor did not permit execution.",
      )
    ) {
      return this.preconditionFailure(
        request,
        executionId,
        timestamp,
        checks,
        AIExecutionCoordinatorErrorCategory.CostNotApproved,
        "Cost Governor decision does not permit execution.",
      );
    }

    const costReferencesMatch =
      request.costDecision.requestId === request.originalRequest.requestId &&
      request.costAuditRecord.requestId === request.originalRequest.requestId &&
      request.costAuditRecord.decisionId === request.costDecision.decisionId &&
      request.costAuditRecord.decisionStatus === request.costDecision.status &&
      request.costAuditRecord.policyVersion === request.costDecision.policyVersion &&
      request.costAuditRecord.estimatedCost.minorUnits ===
        request.costDecision.estimatedCost.minorUnits &&
      request.costAuditRecord.estimatedCost.currency ===
        request.costDecision.estimatedCost.currency;
    if (
      !addCheck(
        checks,
        "COST_REFERENCES_MATCH",
        costReferencesMatch,
        costReferencesMatch
          ? "Cost decision and audit references match."
          : "Cost decision and audit references are inconsistent.",
      )
    ) {
      return this.preconditionFailure(
        request,
        executionId,
        timestamp,
        checks,
        AIExecutionCoordinatorErrorCategory.InternalReferenceMismatch,
        "Cost Governor references are inconsistent.",
      );
    }

    const lowCostSatisfied =
      !request.costDecision.lowCostRequired ||
      request.policy.lowCostEligibleModelIds.includes(
        routingDecision.selectedModelId,
      );
    if (
      !addCheck(
        checks,
        "LOW_COST_CONSTRAINT_SATISFIED",
        lowCostSatisfied,
        lowCostSatisfied
          ? "Any Cost Governor low-cost constraint is satisfied."
          : "Selected model is not approved for low-cost-only execution.",
      )
    ) {
      return this.preconditionFailure(
        request,
        executionId,
        timestamp,
        checks,
        AIExecutionCoordinatorErrorCategory.LowCostConstraintViolated,
        "Low-cost-only execution requires an eligible selected model.",
      );
    }

    const overridePreserved =
      request.costDecision.status !== CostDecisionStatus.AllowedWithOverride ||
      (request.costDecision.overrideAuthorizationId !== undefined &&
        request.costAuditRecord.overrideAuthorizationId ===
          request.costDecision.overrideAuthorizationId &&
        request.originalRequest.criticalOverride?.authorizationId ===
          request.costDecision.overrideAuthorizationId);
    if (
      !addCheck(
        checks,
        "OVERRIDE_REFERENCE_PRESERVED",
        overridePreserved,
        overridePreserved
          ? "Critical override reference is preserved when applicable."
          : "Critical override references are inconsistent.",
      )
    ) {
      return this.preconditionFailure(
        request,
        executionId,
        timestamp,
        checks,
        AIExecutionCoordinatorErrorCategory.InternalReferenceMismatch,
        "Critical override authorization reference was not preserved.",
      );
    }

    const reservation = request.plannedReservation;
    const reservationPresent =
      reservation !== undefined || !request.policy.reservationRequired;
    if (
      !addCheck(
        checks,
        "RESERVATION_PRESENT",
        reservationPresent,
        reservationPresent
          ? "Required reservation reference is present or explicitly not required."
          : "Required reservation is missing.",
      )
    ) {
      return this.preconditionFailure(
        request,
        executionId,
        timestamp,
        checks,
        AIExecutionCoordinatorErrorCategory.ReservationMissing,
        "Execution policy requires a reservation.",
      );
    }

    if (reservation !== undefined) {
      const reservationMatches =
        reservation.requestId === request.originalRequest.requestId &&
        reservation.reservationId === request.costDecision.reservation?.reservationId &&
        reservation.amount.minorUnits ===
          request.costDecision.estimatedCost.minorUnits &&
        reservation.amount.currency === request.costDecision.estimatedCost.currency &&
        reservation.policyVersion === request.costDecision.policyVersion &&
        [BudgetReservationStatus.Planned, BudgetReservationStatus.Reserved].includes(
          reservation.status,
        );
      if (
        !addCheck(
          checks,
          "RESERVATION_MATCHES_APPROVAL",
          reservationMatches,
          reservationMatches
            ? "Reservation matches request, cost, currency, status, and policy."
            : "Reservation does not match the approved cost boundary.",
        )
      ) {
        const currencyMismatch =
          reservation.amount.currency !== request.costDecision.estimatedCost.currency;
        return this.preconditionFailure(
          request,
          executionId,
          timestamp,
          checks,
          currencyMismatch
            ? AIExecutionCoordinatorErrorCategory.CurrencyMismatch
            : AIExecutionCoordinatorErrorCategory.ReservationMismatch,
          currencyMismatch
            ? "Reservation currency does not match approved cost currency."
            : "Reservation does not match the approved request and cost decision.",
        );
      }
    }

    if (
      !addCheck(
        checks,
        "NOT_PRE_CANCELLED",
        !request.cancellation.requested,
        request.cancellation.requested
          ? "Cancellation was requested before adapter execution."
          : "No pre-execution cancellation is pending.",
      )
    ) {
      return this.preconditionFailure(
        request,
        executionId,
        timestamp,
        checks,
        AIExecutionCoordinatorErrorCategory.Cancelled,
        "Execution was cancelled before adapter invocation.",
        AIExecutionCoordinatorStatus.ExecutionCancelled,
      );
    }

    const reservationId =
      reservation?.reservationId ??
      request.costDecision.reservation?.reservationId ??
      `NO_RESERVATION:${request.originalRequest.requestId}`;
    const executionRequest: AIExecutionRequest = {
      contractVersion: "1.0",
      requestId: request.originalRequest.requestId,
      providerId: routingDecision.selectedProviderId,
      modelId: routingDecision.selectedModelId,
      taskType: request.originalRequest.taskType,
      input: request.executionInput,
      expectedOutputType: request.originalRequest.constraints.expectedOutputType,
      requiredCapabilities: request.originalRequest.requiredCapabilities,
      reasoningLevel: request.originalRequest.reasoningLevel,
      privacyLevel: request.originalRequest.constraints.privacyLevel,
      contextTokenLimit:
        request.originalRequest.constraints.estimatedInputTokens +
        request.originalRequest.constraints.reservedOutputTokens,
      maximumOutputTokens:
        request.originalRequest.constraints.reservedOutputTokens,
      timeoutPolicy: request.timeoutPolicy,
      cancellationId: request.cancellation.cancellationId,
      routingDecisionId: routingDecision.decisionId,
      costGovernorDecisionId: request.costDecision.decisionId,
      reservationId,
      requestedAt: request.originalRequest.requestedAt,
      traceId: request.traceId,
      ...(request.correlationId === undefined
        ? {}
        : { correlationId: request.correlationId }),
    };

    let adapter: AIProviderAdapter | undefined;
    try {
      adapter = adapterRegistry.getByProviderId(routingDecision.selectedProviderId);
    } catch {
      adapter = undefined;
    }
    if (
      !addCheck(
        checks,
        "ADAPTER_RESOLVED",
        adapter !== undefined,
        adapter === undefined
          ? "No adapter is registered for the selected provider."
          : "Exact selected provider adapter was resolved.",
      )
    ) {
      return this.preconditionFailure(
        request,
        executionId,
        timestamp,
        checks,
        AIExecutionCoordinatorErrorCategory.AdapterNotFound,
        "Selected provider adapter is not registered.",
      );
    }
    if (adapter === undefined) {
      throw new Error("Unreachable adapter state.");
    }

    const descriptor = adapter.getDescriptor();
    let compatible = false;
    let compatibilityReason = "Adapter compatibility was not evaluated.";
    try {
      validateAIProviderAdapterDescriptor(descriptor);
      const boundaryCompatibility = evaluateAdapterCompatibility(
        descriptor,
        executionRequest,
      );
      const adapterCompatibility = adapter.supports(executionRequest);
      validateAIAdapterCompatibility(adapterCompatibility);
      compatible =
        boundaryCompatibility.compatible && adapterCompatibility.compatible;
      compatibilityReason = compatible
        ? "Adapter supports the selected provider/model and all execution constraints."
        : [...boundaryCompatibility.reasons, ...adapterCompatibility.reasons].join(
            ", ",
          );
    } catch (error: unknown) {
      compatibilityReason = error instanceof Error ? error.message : String(error);
    }
    if (
      !addCheck(
        checks,
        "ADAPTER_COMPATIBLE",
        compatible,
        compatibilityReason,
      )
    ) {
      return this.preconditionFailure(
        request,
        executionId,
        timestamp,
        checks,
        AIExecutionCoordinatorErrorCategory.AdapterIncompatible,
        "Selected adapter is incompatible with the approved execution request.",
        AIExecutionCoordinatorStatus.ExecutionRejectedPrecondition,
        descriptor,
      );
    }

    const health = adapter.getHealth();
    let healthAccepted = false;
    let healthReason: string;
    try {
      validateAIProviderHealth(health);
      const fresh =
        health.expiresAt === undefined ||
        Date.parse(health.expiresAt) >= Date.parse(timestamp);
      healthAccepted =
        health.providerId === routingDecision.selectedProviderId &&
        request.policy.acceptedHealthStatuses.includes(health.status) &&
        fresh;
      healthReason = healthAccepted
        ? "Provider health is fresh and accepted by execution policy."
        : "Provider health is stale, mismatched, or not accepted by execution policy.";
    } catch (error: unknown) {
      healthReason = error instanceof Error ? error.message : String(error);
    }
    if (
      !addCheck(
        checks,
        "PROVIDER_HEALTH_ACCEPTED",
        healthAccepted,
        healthReason,
      )
    ) {
      const healthCategory =
        health.status === AIProviderHealthStatus.RateLimited
          ? AIProviderAdapterErrorCategory.RateLimited
          : AIProviderAdapterErrorCategory.ProviderUnavailable;
      const retryPlan = createRetryPlan(request, healthCategory, true);
      const fallbackPlan = createFallbackPlan(
        request,
        routingDecision.selectedProviderId,
        routingDecision.selectedModelId,
        retryPlan,
      );
      const instructions = failureInstructions(
        request,
        executionId,
        timestamp,
        retryPlan,
      );
      const error = createCoordinatorError(
        AIExecutionCoordinatorErrorCategory.ProviderUnavailable,
        "Selected provider health is not acceptable for execution.",
        true,
        timestamp,
      );
      return createOutcome({
        request,
        executionId,
        timestamp,
        status:
          retryPlan.action === AIRetryAction.ReturnToRouterForFallback
            ? AIExecutionCoordinatorStatus.ExecutionRequiresReroute
            : AIExecutionCoordinatorStatus.ExecutionDeferred,
        reasons: ["PROVIDER_HEALTH_NOT_ACCEPTED"],
        checks,
        retryPlan,
        ...(fallbackPlan === undefined ? {} : { fallbackPlan }),
        reservationInstructions: instructions.reservation,
        usageSettlementInstructions: instructions.usage,
        adapterDescriptor: descriptor,
        providerHealth: health,
        error,
      });
    }

    const plan: AIExecutionPlan = {
      executionId,
      createdAt: timestamp,
      providerId: routingDecision.selectedProviderId,
      modelId: routingDecision.selectedModelId,
      adapterId: descriptor.adapterId,
      adapterVersion: descriptor.version,
      executionRequest,
    };
    const executionContext = {
      attemptNumber: request.attemptNumber,
      invokedAt: timestamp,
      timeoutPolicy: request.timeoutPolicy,
      cancellation: request.cancellation,
    };

    let response: AIExecutionResponse;
    try {
      response = await adapter.execute(executionRequest, executionContext);
    } catch (rawError: unknown) {
      let normalized;
      try {
        normalized = adapter.normalizeError(
          rawError,
          executionRequest,
          executionContext,
        );
      } catch {
        normalized = {
          category: AIProviderAdapterErrorCategory.Unknown,
          code: "ADAPTER_THROWN_ERROR",
          safeMessage: "Adapter execution failed without a valid normalized error.",
          retryable: false,
          occurredAt: timestamp,
          providerId: executionRequest.providerId,
          modelId: executionRequest.modelId,
        };
      }
      const retryPlan = createRetryPlan(
        request,
        normalized.category,
        normalized.retryable,
      );
      const fallbackPlan = createFallbackPlan(
        request,
        executionRequest.providerId,
        executionRequest.modelId,
        retryPlan,
      );
      const instructions = failureInstructions(
        request,
        executionId,
        timestamp,
        retryPlan,
      );
      const error = createCoordinatorError(
        mapAdapterError(normalized.category),
        normalized.safeMessage,
        normalized.retryable,
        timestamp,
      );
      const attempt: AIExecutionAttempt = {
        executionId,
        attemptNumber: request.attemptNumber,
        providerId: executionRequest.providerId,
        modelId: executionRequest.modelId,
        adapterId: descriptor.adapterId,
        status: AIExecutionAttemptStatus.Failed,
        startedAt: timestamp,
        completedAt: timestamp,
        latencyMs: 0,
        adapterErrorCategory: normalized.category,
      };
      return createOutcome({
        request,
        executionId,
        timestamp,
        status:
          retryPlan.action === AIRetryAction.ReturnToRouterForFallback
            ? AIExecutionCoordinatorStatus.ExecutionRequiresReroute
            : AIExecutionCoordinatorStatus.ExecutionFailedAdapter,
        reasons: ["ADAPTER_THROWN_ERROR"],
        checks,
        retryPlan,
        ...(fallbackPlan === undefined ? {} : { fallbackPlan }),
        reservationInstructions: instructions.reservation,
        usageSettlementInstructions: instructions.usage,
        executionPlan: plan,
        attempts: [attempt],
        adapterDescriptor: descriptor,
        providerHealth: health,
        error,
      });
    }

    try {
      validateAIExecutionResponse(response, executionRequest);
    } catch (validationError: unknown) {
      const message =
        validationError instanceof Error
          ? validationError.message
          : String(validationError);
      const providerModelMismatch =
        message.includes("response.providerId") ||
        message.includes("response.modelId");
      const usageInvalid =
        message.includes("usage.") || message.includes("metadata.latencyMs");
      const category = providerModelMismatch
        ? AIExecutionCoordinatorErrorCategory.ProviderModelMismatch
        : usageInvalid
          ? AIExecutionCoordinatorErrorCategory.UsageMetadataInvalid
          : AIExecutionCoordinatorErrorCategory.MalformedProviderResponse;
      const retryPlan = noRetry(
        request,
        "Malformed provider-neutral responses are never retried automatically.",
      );
      const instructions = failureInstructions(
        request,
        executionId,
        timestamp,
        retryPlan,
      );
      const unsafeResponse = response as unknown as {
        readonly metadata?: {
          readonly startedAt?: unknown;
          readonly completedAt?: unknown;
          readonly latencyMs?: unknown;
        };
      };
      const unsafeMetadata = unsafeResponse?.metadata;
      const safeStartedAt =
        typeof unsafeMetadata?.startedAt === "string" &&
        Number.isFinite(Date.parse(unsafeMetadata.startedAt))
          ? unsafeMetadata.startedAt
          : timestamp;
      const safeCompletedAt =
        typeof unsafeMetadata?.completedAt === "string" &&
        Number.isFinite(Date.parse(unsafeMetadata.completedAt))
          ? unsafeMetadata.completedAt
          : timestamp;
      const safeLatencyMs =
        typeof unsafeMetadata?.latencyMs === "number" &&
        Number.isFinite(unsafeMetadata.latencyMs) &&
        unsafeMetadata.latencyMs >= 0
          ? unsafeMetadata.latencyMs
          : 0;
      const attempt: AIExecutionAttempt = {
        executionId,
        attemptNumber: request.attemptNumber,
        providerId: executionRequest.providerId,
        modelId: executionRequest.modelId,
        adapterId: descriptor.adapterId,
        status: AIExecutionAttemptStatus.InvalidResponse,
        startedAt: safeStartedAt,
        completedAt: safeCompletedAt,
        latencyMs: safeLatencyMs,
      };
      const error = createCoordinatorError(
        category,
        `Provider response validation failed: ${message}`,
        false,
        timestamp,
      );
      return createOutcome({
        request,
        executionId,
        timestamp,
        status: AIExecutionCoordinatorStatus.ExecutionInvalidResponse,
        reasons: [category],
        checks,
        retryPlan,
        reservationInstructions: instructions.reservation,
        usageSettlementInstructions: instructions.usage,
        executionPlan: plan,
        attempts: [attempt],
        adapterDescriptor: descriptor,
        providerHealth: health,
        error,
      });
    }

    if (
      response.status === AIExecutionStatus.Completed &&
      response.usage.reportedCost !== undefined &&
      reservation !== undefined &&
      response.usage.reportedCost.currency !== reservation.amount.currency
    ) {
      const retryPlan = noRetry(
        request,
        "Reported cost currency mismatch cannot be retried automatically.",
      );
      const instructions = failureInstructions(
        request,
        executionId,
        timestamp,
        retryPlan,
      );
      const attempt = this.attemptFromResponse(
        executionId,
        descriptor.adapterId,
        response,
        AIExecutionAttemptStatus.InvalidResponse,
      );
      const error = createCoordinatorError(
        AIExecutionCoordinatorErrorCategory.CurrencyMismatch,
        "Provider-reported cost currency does not match the reservation.",
        false,
        timestamp,
      );
      return createOutcome({
        request,
        executionId,
        timestamp,
        status: AIExecutionCoordinatorStatus.ExecutionInvalidResponse,
        reasons: [AIExecutionCoordinatorErrorCategory.CurrencyMismatch],
        checks,
        retryPlan,
        reservationInstructions: instructions.reservation,
        usageSettlementInstructions: instructions.usage,
        executionPlan: plan,
        response,
        attempts: [attempt],
        adapterDescriptor: descriptor,
        providerHealth: health,
        error,
      });
    }

    if (response.status === AIExecutionStatus.Completed) {
      const instructions = successInstructions(
        request,
        executionId,
        timestamp,
        response.usage,
      );
      const retryPlan = noRetry(
        request,
        "Execution completed; no retry is allowed.",
      );
      const attempt = this.attemptFromResponse(
        executionId,
        descriptor.adapterId,
        response,
        AIExecutionAttemptStatus.Succeeded,
      );
      return createOutcome({
        request,
        executionId,
        timestamp,
        status: AIExecutionCoordinatorStatus.ExecutionSucceeded,
        reasons: [
          "EXECUTION_COMPLETED",
          "SETTLEMENT_INSTRUCTIONS_CREATED",
          ...(instructions.overrun
            ? ["ACTUAL_COST_EXCEEDED_RESERVATION"]
            : []),
        ],
        checks,
        retryPlan,
        reservationInstructions: instructions.reservation,
        usageSettlementInstructions: instructions.usage,
        executionPlan: plan,
        response,
        attempts: [attempt],
        adapterDescriptor: descriptor,
        providerHealth: health,
      });
    }

    const retryPlan = createRetryPlan(
      request,
      response.error.category,
      response.error.retryable,
    );
    const fallbackPlan = createFallbackPlan(
      request,
      response.providerId,
      response.modelId,
      retryPlan,
    );
    const instructions = failureInstructions(
      request,
      executionId,
      timestamp,
      retryPlan,
    );
    const status = statusForAdapterFailure(response, retryPlan);
    const attemptStatus =
      response.status === AIExecutionStatus.Cancelled
        ? AIExecutionAttemptStatus.Cancelled
        : response.status === AIExecutionStatus.TimedOut
          ? AIExecutionAttemptStatus.TimedOut
          : AIExecutionAttemptStatus.Failed;
    const attempt = this.attemptFromResponse(
      executionId,
      descriptor.adapterId,
      response,
      attemptStatus,
    );
    const error = createCoordinatorError(
      mapAdapterError(response.error.category),
      response.error.safeMessage,
      response.error.retryable,
      timestamp,
    );
    return createOutcome({
      request,
      executionId,
      timestamp,
      status,
      reasons: [response.error.category, retryPlan.action],
      checks,
      retryPlan,
      ...(fallbackPlan === undefined ? {} : { fallbackPlan }),
      reservationInstructions: instructions.reservation,
      usageSettlementInstructions: instructions.usage,
      executionPlan: plan,
      response,
      attempts: [attempt],
      adapterDescriptor: descriptor,
      providerHealth: health,
      error,
    });
  }

  private preconditionFailure(
    request: Readonly<AIExecutionCoordinatorRequest>,
    executionId: string,
    timestamp: string,
    checks: ReadonlyArray<AIExecutionPreconditionCheck>,
    category: AIExecutionCoordinatorErrorCategory,
    message: string,
    status = AIExecutionCoordinatorStatus.ExecutionRejectedPrecondition,
    descriptor?: Readonly<AIProviderAdapterDescriptor>,
  ): AIExecutionCoordinatorResult {
    const retryPlan = noRetry(request, "Precondition failures are not retried.");
    const instructions = failureInstructions(
      request,
      executionId,
      timestamp,
      retryPlan,
    );
    const error = createCoordinatorError(
      category,
      message,
      false,
      timestamp,
    );
    return createOutcome({
      request,
      executionId,
      timestamp,
      status,
      reasons: [category],
      checks,
      retryPlan,
      reservationInstructions: instructions.reservation,
      usageSettlementInstructions: instructions.usage,
      ...(descriptor === undefined ? {} : { adapterDescriptor: descriptor }),
      error,
    });
  }

  private attemptFromResponse(
    executionId: string,
    adapterId: string,
    response: AIExecutionResponse,
    status: AIExecutionAttemptStatus,
  ): AIExecutionAttempt {
    return {
      executionId,
      attemptNumber: response.metadata.attemptNumber,
      providerId: response.providerId,
      modelId: response.modelId,
      adapterId,
      status,
      startedAt: response.metadata.startedAt,
      completedAt: response.metadata.completedAt,
      latencyMs: response.metadata.latencyMs,
      ...(response.status === AIExecutionStatus.Completed
        ? {}
        : { adapterErrorCategory: response.error.category }),
    };
  }
}
