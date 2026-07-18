import {
  AICostLedgerAppendStatus,
  AICostLedgerReconciliationIssueCode,
  AICostLedgerReconciliationStatus,
  AIAuditAppendStatus,
  AIAuditRecordType,
  AIAuditSourceSubsystem,
  AIAuditTraceStatus,
  AIExecutionCoordinatorStatus,
  AIReservationInstructionType,
  AIReservationOperationType,
  AIReservationResultStatus,
  AIReservationState,
  AIRetryAction,
  AIRuntimeAuditFailureMode,
  AIRuntimeCompensationAction,
  AIRuntimeWorkflowErrorCategory,
  AIRuntimeWorkflowStage,
  AIRuntimeWorkflowStageStatus,
  AIRuntimeWorkflowStatus,
  AIRuntimeWorkflowRetryDisposition,
  AIUsageSettlementInstructionType,
  BudgetReservationStatus,
  CostDecisionStatus,
  PrivacyLevel,
  canonicalizeAIAuditValue,
  validateAIRuntimeWorkflowRequest,
  validateAIRuntimeWorkflowTimestamp,
  workflowValidationError,
  type AIAuditRecordInput,
  type AIRuntimeCompensationResult,
  type AIRuntimeWorkflow,
  type AIRuntimeWorkflowAuditRecord,
  type AIRuntimeWorkflowDependencies,
  type AIRuntimeWorkflowError,
  type AIRuntimeWorkflowRequest,
  type AIRuntimeWorkflowResult,
  type AIRuntimeWorkflowSettlementResult,
  type AIRuntimeWorkflowStageResult,
  type AIRuntimeWorkflowTrace,
  type AICostLedgerAppendResult,
  type AICostLedgerAuditRecord,
  type AIExecutionCoordinatorResult,
  type AIReservationAuditRecord,
  type AIReservationPolicy,
  type AIReservationResult,
  type CostAuditRecord,
  type CostGovernorDecision,
  type RoutingAuditRecord,
  type RoutingDecision,
} from "../../contracts";
import { DeterministicAICostLedger, costLedgerEntryFromReservationInstruction } from "../ai-cost-ledger";
import {
  auditRecordFromCostGovernorAudit,
  auditRecordFromCostLedgerAudit,
  auditRecordFromExecutionAudit,
  auditRecordFromReservationAudit,
  auditRecordFromRoutingAudit,
} from "../ai-audit-repository";
import { createCostGovernorInputFromRouter, evaluateAICost } from "../ai-cost-governor";
import { DeterministicAIExecutionCoordinator } from "../ai-execution-coordinator";
import { DeterministicAIReservationManager } from "../ai-reservation-manager";
import { routeAIRequest } from "../ai-router";

interface WorkflowState {
  readonly stages: AIRuntimeWorkflowStageResult[];
  readonly routingDecisions: RoutingDecision[];
  readonly routingAuditRecords: RoutingAuditRecord[];
  readonly costDecisions: CostGovernorDecision[];
  readonly costAuditRecords: CostAuditRecord[];
  readonly reservationResults: AIReservationResult[];
  readonly ledgerResults: AICostLedgerAppendResult[];
  readonly compensations: AIRuntimeCompensationResult[];
  readonly sourceAuditReferences: string[];
  readonly unifiedAuditRecordIds: string[];
  readonly ledgerEntryIds: string[];
  lastCompletedStage: AIRuntimeWorkflowStage;
  auditOrdinal: number;
  lastUnifiedAuditRecordId?: string;
  executionResult?: AIExecutionCoordinatorResult;
  settlement?: AIRuntimeWorkflowSettlementResult;
  reconciliation?: ReturnType<DeterministicAICostLedger["reconcileReservation"]>;
  auditTrace?: AIRuntimeWorkflowTrace;
  postMonetaryAuditFailure: boolean;
}

const ALLOWED_COST_STATUSES = new Set<CostDecisionStatus>([
  CostDecisionStatus.Allowed,
  CostDecisionStatus.AllowedLowCostOnly,
  CostDecisionStatus.AllowedWithOverride,
]);

const PRIVACY_RANK: Readonly<Record<PrivacyLevel, number>> = {
  [PrivacyLevel.Public]: 0,
  [PrivacyLevel.Internal]: 1,
  [PrivacyLevel.Sensitive]: 2,
  [PrivacyLevel.LocalOnly]: 3,
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function unique<T>(values: ReadonlyArray<T>): ReadonlyArray<T> {
  return [...new Set(values)];
}

function reasonCode(value: string, index = 0): string {
  const normalized = value.trim().replace(/[^A-Za-z0-9._:-]+/g, "_").slice(0, 180);
  return normalized.length > 0 ? normalized : `WORKFLOW_REASON_${index + 1}`;
}

function workflowError(
  category: AIRuntimeWorkflowErrorCategory,
  code: string,
  message: string,
  stage: AIRuntimeWorkflowStage,
  occurredAt: string,
  retryable = false,
): AIRuntimeWorkflowError {
  return { category, code, safeMessage: message, retryable, occurredAt, stage };
}

function isMonetaryApplied(state: WorkflowState): boolean {
  return state.reservationResults.some((result) => result.status === AIReservationResultStatus.Applied);
}

function lowCostConfiguration(request: AIRuntimeWorkflowRequest) {
  const configuration = clone(request.configuration.router);
  const suffix = `low-cost:${request.workflowId}`;
  return {
    ...configuration,
    configurationVersion: `${configuration.configurationVersion}:${suffix}`,
    routingPolicy: {
      ...configuration.routingPolicy,
      version: `${configuration.routingPolicy.version}:${suffix}`,
      taskPolicies: configuration.routingPolicy.taskPolicies.map((policy) =>
        policy.taskType === request.originalRequest.taskType
          ? { ...policy, costMode: "LOW_COST" as typeof policy.costMode }
          : policy,
      ),
    },
    budgetPolicy: {
      ...configuration.budgetPolicy,
      version: `${configuration.budgetPolicy.version}:${suffix}`,
      lowCostMode: true,
    },
  };
}

function reservationPolicyFor(
  base: Readonly<AIReservationPolicy>,
  version: string,
): AIReservationPolicy {
  return { ...clone(base), version };
}

export class DeterministicAIRuntimeWorkflow implements AIRuntimeWorkflow {
  constructor(private readonly dependencies: AIRuntimeWorkflowDependencies) {}

  async execute(input: Readonly<AIRuntimeWorkflowRequest>): Promise<AIRuntimeWorkflowResult> {
    const request = clone(input);
    const initialTimestamp = this.safeNow(request.originalRequest.requestedAt);
    const fingerprint = canonicalizeAIAuditValue(request);
    const replay = this.dependencies.workflowRepository.getByIdempotencyKey(request.idempotencyKey);
    if (replay !== undefined) {
      if (replay.requestFingerprint === fingerprint && replay.workflowId === request.workflowId) return clone(replay.result);
      return this.invalidResult(
        request,
        workflowError(
          AIRuntimeWorkflowErrorCategory.IdempotencyConflict,
          "WORKFLOW_IDEMPOTENCY_CONFLICT",
          "Workflow idempotency key was already used with different input.",
          AIRuntimeWorkflowStage.RequestValidation,
          initialTimestamp,
        ),
      );
    }
    if (this.dependencies.workflowRepository.getByWorkflowId(request.workflowId) !== undefined) {
      return this.invalidResult(
        request,
        workflowError(
          AIRuntimeWorkflowErrorCategory.IdempotencyConflict,
          "WORKFLOW_ID_CONFLICT",
          "Workflow ID was already used under another idempotency key.",
          AIRuntimeWorkflowStage.RequestValidation,
          initialTimestamp,
        ),
      );
    }

    const state: WorkflowState = {
      stages: [],
      routingDecisions: [],
      routingAuditRecords: [],
      costDecisions: [],
      costAuditRecords: [],
      reservationResults: [],
      ledgerResults: [],
      compensations: [],
      sourceAuditReferences: [],
      unifiedAuditRecordIds: [],
      ledgerEntryIds: [],
      lastCompletedStage: AIRuntimeWorkflowStage.RequestValidation,
      auditOrdinal: 0,
      postMonetaryAuditFailure: false,
    };

    try {
      validateAIRuntimeWorkflowTimestamp(initialTimestamp);
      validateAIRuntimeWorkflowRequest(request);
      if (
        PRIVACY_RANK[request.configuration.workflowPolicy.auditPrivacyLevel] <
        PRIVACY_RANK[request.originalRequest.constraints.privacyLevel]
      ) throw new Error("Workflow audit privacy cannot be lower than request privacy.");
      this.addStage(state, AIRuntimeWorkflowStage.RequestValidation, AIRuntimeWorkflowStageStatus.Succeeded, initialTimestamp, [request.workflowId, request.requestId], [request.traceId], ["WORKFLOW_REQUEST_VALID"], []);
    } catch (failure: unknown) {
      const error = workflowValidationError(failure instanceof Error ? failure.message : "Workflow request validation failed.", initialTimestamp);
      this.addStage(state, AIRuntimeWorkflowStage.RequestValidation, AIRuntimeWorkflowStageStatus.Failed, initialTimestamp, [request.workflowId], [], [error.code], [], error);
      return this.store(request, fingerprint, this.buildResult(request, state, AIRuntimeWorkflowStatus.InvalidRequest, [error.code], AIRuntimeWorkflowRetryDisposition.None, error));
    }

    const ledger = new DeterministicAICostLedger(this.dependencies.costLedgerRepository);
    const reservationManager = new DeterministicAIReservationManager(this.dependencies.reservationRepository);
    let activeRouterConfiguration = clone(request.configuration.router);
    let activeReservationPolicy = clone(request.configuration.reservationPolicy);

    const route = routeAIRequest(
      { request: request.originalRequest, configuration: activeRouterConfiguration, budgetUsage: request.configuration.budgetUsage },
      this.dependencies.clock,
    );
    state.routingDecisions.push(clone(route.decision));
    state.routingAuditRecords.push(clone(route.auditRecord));
    state.sourceAuditReferences.push(route.auditRecord.auditId);
    this.addStage(
      state,
      AIRuntimeWorkflowStage.Routing,
      route.success ? AIRuntimeWorkflowStageStatus.Succeeded : AIRuntimeWorkflowStageStatus.Failed,
      route.auditRecord.timestamp,
      [request.requestId],
      [route.decision.decisionId],
      route.success ? route.decision.routingReason.reasonCodes : route.decision.rejectionReasons,
      [route.auditRecord.auditId],
      route.success ? undefined : workflowError(AIRuntimeWorkflowErrorCategory.RoutingRejected, "WORKFLOW_ROUTING_REJECTED", route.error.safeMessage, AIRuntimeWorkflowStage.Routing, route.auditRecord.timestamp, route.error.retryable),
    );
    const routeAuditAppend = this.appendUnified(
      request,
      state,
      auditRecordFromRoutingAudit(route.auditRecord, this.translationContext(request, state, [])),
    );
    if (!routeAuditAppend) {
      return this.finalizeAndStore(request, fingerprint, state, AIRuntimeWorkflowStatus.RejectedAudit, ["ROUTING_AUDIT_APPEND_FAILED"], AIRuntimeWorkflowRetryDisposition.None, workflowError(AIRuntimeWorkflowErrorCategory.AuditAppendFailed, "ROUTING_AUDIT_APPEND_FAILED", "Router audit evidence could not be appended.", AIRuntimeWorkflowStage.PreExecutionAudit, this.safeNow(initialTimestamp)));
    }
    if (!route.success) {
      return this.finalizeAndStore(request, fingerprint, state, AIRuntimeWorkflowStatus.RejectedRouting, unique(["ROUTING_REJECTED", ...route.decision.rejectionReasons]), AIRuntimeWorkflowRetryDisposition.None, workflowError(AIRuntimeWorkflowErrorCategory.RoutingRejected, "WORKFLOW_ROUTING_REJECTED", route.error.safeMessage, AIRuntimeWorkflowStage.Routing, route.auditRecord.timestamp, route.error.retryable));
    }

    let selectedRoute = route;
    const initialBoundaryInput = createCostGovernorInputFromRouter({
      request: request.originalRequest,
      estimatedCost: selectedRoute.decision.estimatedCost,
      selectedProviderId: selectedRoute.decision.selectedProviderId,
      selectedModelId: selectedRoute.decision.selectedModelId,
      reservationId: request.identifiers.reservationId,
      configuration: activeRouterConfiguration,
      budgetUsage: request.configuration.budgetUsage,
    });
    let costInput = {
      request: initialBoundaryInput.request,
      policy: clone(request.configuration.costGovernorPolicy),
      budgetUsage: clone(request.configuration.costGovernorBudgetUsage),
    };
    let cost = evaluateAICost(costInput, this.dependencies.clock);
    this.recordCost(state, cost.decision, cost.auditRecord);
    this.addStage(
      state,
      AIRuntimeWorkflowStage.CostGovernance,
      cost.decision.status === CostDecisionStatus.DeferredBudgetUnavailable
        ? AIRuntimeWorkflowStageStatus.Deferred
        : ALLOWED_COST_STATUSES.has(cost.decision.status)
          ? AIRuntimeWorkflowStageStatus.Succeeded
          : AIRuntimeWorkflowStageStatus.Failed,
      cost.auditRecord.timestamp,
      [selectedRoute.decision.decisionId],
      [cost.decision.decisionId],
      cost.decision.reasons,
      [cost.auditRecord.auditId],
      cost.error === undefined ? undefined : workflowError(
        cost.decision.status === CostDecisionStatus.DeferredBudgetUnavailable ? AIRuntimeWorkflowErrorCategory.CostDeferred : AIRuntimeWorkflowErrorCategory.CostRejected,
        `WORKFLOW_${cost.decision.status}`,
        cost.error.safeMessage,
        AIRuntimeWorkflowStage.CostGovernance,
        cost.auditRecord.timestamp,
        cost.error.retryable,
      ),
    );
    const costAuditAppend = this.appendUnified(
      request,
      state,
      auditRecordFromCostGovernorAudit(cost.auditRecord, this.translationContext(request, state, state.lastUnifiedAuditRecordId === undefined ? [] : [state.lastUnifiedAuditRecordId])),
    );
    if (!costAuditAppend) {
      return this.finalizeAndStore(request, fingerprint, state, AIRuntimeWorkflowStatus.RejectedAudit, ["COST_AUDIT_APPEND_FAILED"], AIRuntimeWorkflowRetryDisposition.None, workflowError(AIRuntimeWorkflowErrorCategory.AuditAppendFailed, "COST_AUDIT_APPEND_FAILED", "Cost Governor audit evidence could not be appended.", AIRuntimeWorkflowStage.PreExecutionAudit, this.safeNow(initialTimestamp)));
    }
    if (cost.decision.status === CostDecisionStatus.DeferredBudgetUnavailable) {
      return this.finalizeAndStore(request, fingerprint, state, AIRuntimeWorkflowStatus.DeferredBudgetUnavailable, cost.decision.reasons, AIRuntimeWorkflowRetryDisposition.None, workflowError(AIRuntimeWorkflowErrorCategory.CostDeferred, "WORKFLOW_COST_DEFERRED", cost.error?.safeMessage ?? "Budget usage is unavailable.", AIRuntimeWorkflowStage.CostGovernance, cost.auditRecord.timestamp, true));
    }
    if (!ALLOWED_COST_STATUSES.has(cost.decision.status)) {
      return this.finalizeAndStore(request, fingerprint, state, AIRuntimeWorkflowStatus.RejectedCost, cost.decision.reasons, AIRuntimeWorkflowRetryDisposition.None, workflowError(AIRuntimeWorkflowErrorCategory.CostRejected, "WORKFLOW_COST_REJECTED", cost.error?.safeMessage ?? "Cost Governor rejected execution.", AIRuntimeWorkflowStage.CostGovernance, cost.auditRecord.timestamp));
    }

    if (cost.decision.status === CostDecisionStatus.AllowedLowCostOnly) {
      if (request.configuration.workflowPolicy.maximumLowCostReroutes !== 1) {
        return this.finalizeAndStore(request, fingerprint, state, AIRuntimeWorkflowStatus.RejectedCost, ["LOW_COST_REROUTE_NOT_PERMITTED"], AIRuntimeWorkflowRetryDisposition.None, workflowError(AIRuntimeWorkflowErrorCategory.LowCostRouteUnavailable, "LOW_COST_REROUTE_NOT_PERMITTED", "Cost policy requires low-cost routing but workflow policy does not permit it.", AIRuntimeWorkflowStage.LowCostRerouting, this.safeNow(initialTimestamp)));
      }
      const firstCost = selectedRoute.decision.estimatedCost.estimatedTotalCost;
      activeRouterConfiguration = lowCostConfiguration(request);
      const reroute = routeAIRequest(
        { request: request.originalRequest, configuration: activeRouterConfiguration, budgetUsage: request.configuration.budgetUsage },
        this.dependencies.clock,
      );
      state.routingDecisions.push(clone(reroute.decision));
      state.routingAuditRecords.push(clone(reroute.auditRecord));
      state.sourceAuditReferences.push(reroute.auditRecord.auditId);
      const compliant = reroute.success && (
        reroute.decision.estimatedCost.estimatedTotalCost < firstCost ||
        request.configuration.executionPolicy.lowCostEligibleModelIds.includes(reroute.decision.selectedModelId)
      );
      this.addStage(
        state,
        AIRuntimeWorkflowStage.LowCostRerouting,
        compliant ? AIRuntimeWorkflowStageStatus.Succeeded : AIRuntimeWorkflowStageStatus.Failed,
        reroute.auditRecord.timestamp,
        [selectedRoute.decision.decisionId, cost.decision.decisionId],
        [reroute.decision.decisionId],
        compliant ? ["LOW_COST_REROUTE_COMPLIANT"] : ["LOW_COST_ROUTE_UNAVAILABLE"],
        [reroute.auditRecord.auditId],
        compliant ? undefined : workflowError(AIRuntimeWorkflowErrorCategory.LowCostRouteUnavailable, "LOW_COST_ROUTE_UNAVAILABLE", "No compliant low-cost route was selected.", AIRuntimeWorkflowStage.LowCostRerouting, reroute.auditRecord.timestamp),
      );
      const rerouteAuditAppend = this.appendUnified(
        request,
        state,
        auditRecordFromRoutingAudit(reroute.auditRecord, this.translationContext(request, state, [], state.lastUnifiedAuditRecordId === undefined ? [] : [state.lastUnifiedAuditRecordId])),
      );
      if (!rerouteAuditAppend) {
        return this.finalizeAndStore(request, fingerprint, state, AIRuntimeWorkflowStatus.RejectedAudit, ["LOW_COST_ROUTING_AUDIT_FAILED"], AIRuntimeWorkflowRetryDisposition.None, workflowError(AIRuntimeWorkflowErrorCategory.AuditAppendFailed, "LOW_COST_ROUTING_AUDIT_FAILED", "Low-cost routing evidence could not be appended.", AIRuntimeWorkflowStage.PreExecutionAudit, this.safeNow(initialTimestamp)));
      }
      if (!reroute.success || !compliant) {
        return this.finalizeAndStore(request, fingerprint, state, AIRuntimeWorkflowStatus.RejectedCost, ["LOW_COST_ROUTE_UNAVAILABLE"], AIRuntimeWorkflowRetryDisposition.None, workflowError(AIRuntimeWorkflowErrorCategory.LowCostRouteUnavailable, "LOW_COST_ROUTE_UNAVAILABLE", "No compliant low-cost route exists.", AIRuntimeWorkflowStage.LowCostRerouting, reroute.auditRecord.timestamp));
      }
      selectedRoute = reroute;
      if (request.configuration.workflowPolicy.rerunCostGovernorAfterLowCostRoute) {
        const lowCostBoundaryInput = createCostGovernorInputFromRouter({
          request: request.originalRequest,
          estimatedCost: selectedRoute.decision.estimatedCost,
          selectedProviderId: selectedRoute.decision.selectedProviderId,
          selectedModelId: selectedRoute.decision.selectedModelId,
          reservationId: request.identifiers.reservationId,
          configuration: activeRouterConfiguration,
          budgetUsage: request.configuration.budgetUsage,
        });
        const lowCostPolicy = {
          ...clone(request.configuration.costGovernorPolicy),
          version: activeRouterConfiguration.budgetPolicy.version,
          limits: request.configuration.costGovernorPolicy.limits.map((limit) => ({
            ...clone(limit),
            policyVersion: activeRouterConfiguration.budgetPolicy.version,
          })),
        };
        costInput = {
          request: lowCostBoundaryInput.request,
          policy: lowCostPolicy,
          budgetUsage: clone(request.configuration.costGovernorBudgetUsage),
        };
        cost = evaluateAICost(costInput, this.dependencies.clock);
        this.recordCost(state, cost.decision, cost.auditRecord);
        const rerunCostAuditAppend = this.appendUnified(
          request,
          state,
          auditRecordFromCostGovernorAudit(cost.auditRecord, this.translationContext(request, state, state.lastUnifiedAuditRecordId === undefined ? [] : [state.lastUnifiedAuditRecordId])),
        );
        if (!rerunCostAuditAppend) {
          return this.finalizeAndStore(request, fingerprint, state, AIRuntimeWorkflowStatus.RejectedAudit, ["LOW_COST_COST_AUDIT_FAILED"], AIRuntimeWorkflowRetryDisposition.None, workflowError(AIRuntimeWorkflowErrorCategory.AuditAppendFailed, "LOW_COST_COST_AUDIT_FAILED", "Low-cost Cost Governor evidence could not be appended.", AIRuntimeWorkflowStage.PreExecutionAudit, this.safeNow(initialTimestamp)));
        }
        if (!ALLOWED_COST_STATUSES.has(cost.decision.status)) {
          const status = cost.decision.status === CostDecisionStatus.DeferredBudgetUnavailable
            ? AIRuntimeWorkflowStatus.DeferredBudgetUnavailable
            : AIRuntimeWorkflowStatus.RejectedCost;
          return this.finalizeAndStore(request, fingerprint, state, status, cost.decision.reasons, AIRuntimeWorkflowRetryDisposition.None, workflowError(status === AIRuntimeWorkflowStatus.DeferredBudgetUnavailable ? AIRuntimeWorkflowErrorCategory.CostDeferred : AIRuntimeWorkflowErrorCategory.CostRejected, "LOW_COST_GOVERNANCE_FAILED", cost.error?.safeMessage ?? "Low-cost route did not pass Cost Governor.", AIRuntimeWorkflowStage.CostGovernance, cost.auditRecord.timestamp, cost.error?.retryable ?? false));
        }
      }
      activeReservationPolicy = reservationPolicyFor(request.configuration.reservationPolicy, cost.decision.policyVersion);
    }

    if (cost.decision.reservation === undefined) {
      return this.finalizeAndStore(request, fingerprint, state, AIRuntimeWorkflowStatus.RejectedReservation, ["RESERVATION_PLAN_MISSING"], AIRuntimeWorkflowRetryDisposition.None, workflowError(AIRuntimeWorkflowErrorCategory.ReservationFailed, "RESERVATION_PLAN_MISSING", "Approved cost decision did not include a reservation plan.", AIRuntimeWorkflowStage.ReservationAcquisition, this.safeNow(initialTimestamp)));
    }

    const acquireTimestamp = this.safeNow(initialTimestamp);
    const acquire = reservationManager.process({
      operationId: request.identifiers.acquireOperationId,
      idempotencyKey: request.identifiers.acquireIdempotencyKey,
      operationType: AIReservationOperationType.Acquire,
      reservationId: request.identifiers.reservationId,
      requestId: request.requestId,
      timestamp: acquireTimestamp,
      expectedVersion: 0,
      policy: activeReservationPolicy,
      reason: "Acquire approved runtime workflow reservation before execution.",
      costDecision: cost.decision,
      reservationPlan: cost.decision.reservation,
    });
    state.reservationResults.push(clone(acquire));
    state.sourceAuditReferences.push(acquire.auditRecord.auditId);
    this.addStage(
      state,
      AIRuntimeWorkflowStage.ReservationAcquisition,
      acquire.status === AIReservationResultStatus.Applied && acquire.record?.state === AIReservationState.Reserved
        ? AIRuntimeWorkflowStageStatus.Succeeded
        : AIRuntimeWorkflowStageStatus.Failed,
      acquire.auditRecord.timestamp,
      [cost.decision.decisionId, request.identifiers.reservationId],
      acquire.record === undefined ? [] : [acquire.record.reservationId, String(acquire.record.version)],
      acquire.reasons,
      [acquire.auditRecord.auditId],
      acquire.error === undefined ? undefined : workflowError(AIRuntimeWorkflowErrorCategory.ReservationFailed, "RESERVATION_ACQUIRE_FAILED", acquire.error.safeMessage, AIRuntimeWorkflowStage.ReservationAcquisition, acquire.error.occurredAt, acquire.error.retryable),
    );
    const storedAcquisition = this.dependencies.reservationRepository.getById(request.identifiers.reservationId);
    const acquisitionVerified =
      acquire.status === AIReservationResultStatus.Applied &&
      acquire.record?.state === AIReservationState.Reserved &&
      acquire.ledgerInstruction !== undefined &&
      storedAcquisition !== undefined &&
      storedAcquisition.state === AIReservationState.Reserved &&
      storedAcquisition.requestId === request.requestId &&
      storedAcquisition.reservedAmount.minorUnits === cost.decision.estimatedCost.minorUnits &&
      storedAcquisition.reservedAmount.currency === cost.decision.estimatedCost.currency &&
      storedAcquisition.policyVersion === activeReservationPolicy.version;
    if (!acquisitionVerified) {
      return this.finalizeAndStore(request, fingerprint, state, AIRuntimeWorkflowStatus.RejectedReservation, unique(["RESERVATION_ACQUIRE_FAILED", ...acquire.reasons]), AIRuntimeWorkflowRetryDisposition.None, workflowError(AIRuntimeWorkflowErrorCategory.ReservationFailed, "RESERVATION_ACQUIRE_FAILED", acquire.error?.safeMessage ?? "Reservation acquisition did not reach RESERVED state.", AIRuntimeWorkflowStage.ReservationAcquisition, acquire.auditRecord.timestamp, acquire.error?.retryable ?? false));
    }

    if (!this.appendUnified(request, state, auditRecordFromReservationAudit(acquire.auditRecord, this.translationContext(request, state, state.lastUnifiedAuditRecordId === undefined ? [] : [state.lastUnifiedAuditRecordId])))) {
      await this.compensateRelease(request, state, reservationManager, ledger, activeReservationPolicy, "PRE_EXECUTION_RESERVATION_AUDIT_FAILED");
      return this.finalizeAndStore(request, fingerprint, state, AIRuntimeWorkflowStatus.RejectedAudit, ["PRE_EXECUTION_RESERVATION_AUDIT_FAILED"], AIRuntimeWorkflowRetryDisposition.ManualLedgerReplay, workflowError(AIRuntimeWorkflowErrorCategory.AuditAppendFailed, "PRE_EXECUTION_RESERVATION_AUDIT_FAILED", "Reservation acquisition audit could not be appended.", AIRuntimeWorkflowStage.PreExecutionAudit, this.safeNow(initialTimestamp)));
    }

    const acquisitionLedger = this.appendLedgerInstruction(
      request,
      state,
      ledger,
      acquire.ledgerInstruction,
      request.identifiers.acquisitionLedgerEntryId,
      acquire.auditRecord.auditId,
      selectedRoute.decision.selectedProviderId,
      selectedRoute.decision.selectedModelId,
    );
    this.addStage(
      state,
      AIRuntimeWorkflowStage.ReservationLedgerAppend,
      acquisitionLedger.status === AICostLedgerAppendStatus.Appended || acquisitionLedger.status === AICostLedgerAppendStatus.IdempotentReplay
        ? AIRuntimeWorkflowStageStatus.Succeeded
        : AIRuntimeWorkflowStageStatus.Failed,
      acquisitionLedger.auditRecord.timestamp,
      [acquire.ledgerInstruction.instructionId],
      acquisitionLedger.entry === undefined ? [] : [acquisitionLedger.entry.entryId, String(acquisitionLedger.entry.sequence)],
      acquisitionLedger.reasons,
      [acquisitionLedger.auditRecord.auditId],
      acquisitionLedger.error === undefined ? undefined : workflowError(AIRuntimeWorkflowErrorCategory.LedgerAppendFailed, "ACQUISITION_LEDGER_APPEND_FAILED", acquisitionLedger.error.safeMessage, AIRuntimeWorkflowStage.ReservationLedgerAppend, acquisitionLedger.error.occurredAt, acquisitionLedger.error.retryable),
    );
    if (acquisitionLedger.status === AICostLedgerAppendStatus.Rejected) {
      this.appendUnified(request, state, auditRecordFromCostLedgerAudit(acquisitionLedger.auditRecord, this.translationContext(request, state, state.lastUnifiedAuditRecordId === undefined ? [] : [state.lastUnifiedAuditRecordId])));
      await this.compensateRelease(request, state, reservationManager, ledger, activeReservationPolicy, "ACQUISITION_LEDGER_APPEND_FAILED");
      return this.finalizeAndStore(request, fingerprint, state, AIRuntimeWorkflowStatus.FailedLedger, ["ACQUISITION_LEDGER_APPEND_FAILED"], AIRuntimeWorkflowRetryDisposition.ManualLedgerReplay, workflowError(AIRuntimeWorkflowErrorCategory.LedgerAppendFailed, "ACQUISITION_LEDGER_APPEND_FAILED", acquisitionLedger.error?.safeMessage ?? "Reservation acquisition ledger entry failed.", AIRuntimeWorkflowStage.ReservationLedgerAppend, acquisitionLedger.auditRecord.timestamp, true));
    }
    if (!this.appendUnified(request, state, auditRecordFromCostLedgerAudit(acquisitionLedger.auditRecord, this.translationContext(request, state, state.lastUnifiedAuditRecordId === undefined ? [] : [state.lastUnifiedAuditRecordId])))) {
      await this.compensateRelease(request, state, reservationManager, ledger, activeReservationPolicy, "ACQUISITION_LEDGER_AUDIT_FAILED");
      return this.finalizeAndStore(request, fingerprint, state, AIRuntimeWorkflowStatus.RejectedAudit, ["ACQUISITION_LEDGER_AUDIT_FAILED"], AIRuntimeWorkflowRetryDisposition.ManualLedgerReplay, workflowError(AIRuntimeWorkflowErrorCategory.AuditAppendFailed, "ACQUISITION_LEDGER_AUDIT_FAILED", "Acquisition ledger audit could not be appended.", AIRuntimeWorkflowStage.PreExecutionAudit, this.safeNow(initialTimestamp)));
    }
    this.addStage(state, AIRuntimeWorkflowStage.PreExecutionAudit, AIRuntimeWorkflowStageStatus.Succeeded, this.safeNow(initialTimestamp), [route.auditRecord.auditId, cost.auditRecord.auditId, acquire.auditRecord.auditId, acquisitionLedger.auditRecord.auditId], clone(state.unifiedAuditRecordIds), ["PRE_EXECUTION_EVIDENCE_COMPLETE"], clone(state.sourceAuditReferences));

    const acquiredPlan = {
      ...clone(cost.decision.reservation),
      status: BudgetReservationStatus.Reserved,
    };
    const coordinator = new DeterministicAIExecutionCoordinator({
      clock: this.dependencies.clock,
      executionIdSource: { nextId: () => request.identifiers.executionId },
    });
    const execution = await coordinator.execute(
      {
        originalRequest: request.originalRequest,
        routingDecision: selectedRoute.decision,
        routingAuditRecord: selectedRoute.auditRecord,
        costDecision: cost.decision,
        costAuditRecord: cost.auditRecord,
        plannedReservation: acquiredPlan,
        executionInput: request.executionInput,
        timeoutPolicy: request.timeoutPolicy,
        cancellation: request.cancellation,
        attemptNumber: 1,
        traceId: request.traceId,
        correlationId: request.correlationId,
        policy: request.configuration.executionPolicy,
      },
      this.dependencies.adapterRegistry,
    );
    state.executionResult = clone(execution);
    state.sourceAuditReferences.push(execution.auditRecord.auditId);
    this.addStage(
      state,
      AIRuntimeWorkflowStage.ProviderExecution,
      execution.status === AIExecutionCoordinatorStatus.ExecutionSucceeded ? AIRuntimeWorkflowStageStatus.Succeeded : AIRuntimeWorkflowStageStatus.Failed,
      execution.auditRecord.timestamp,
      [selectedRoute.decision.decisionId, cost.decision.decisionId, request.identifiers.reservationId],
      [execution.executionId],
      execution.reasons,
      [execution.auditRecord.auditId],
      execution.error === undefined ? undefined : workflowError(AIRuntimeWorkflowErrorCategory.ExecutionFailed, `WORKFLOW_${execution.status}`, execution.error.safeMessage, AIRuntimeWorkflowStage.ProviderExecution, execution.error.occurredAt, execution.error.retryable),
    );
    if (!this.appendUnified(request, state, auditRecordFromExecutionAudit(execution.auditRecord, this.translationContext(request, state, state.lastUnifiedAuditRecordId === undefined ? [] : [state.lastUnifiedAuditRecordId])))) {
      state.postMonetaryAuditFailure = true;
    }

    const settlementOutcome = this.applySettlement(
      request,
      state,
      reservationManager,
      ledger,
      activeReservationPolicy,
      execution,
      selectedRoute.decision.selectedProviderId,
      selectedRoute.decision.selectedModelId,
    );
    state.settlement = settlementOutcome.settlement;
    if (settlementOutcome.error !== undefined) {
      state.compensations.push({
        action: settlementOutcome.ledgerFailure ? AIRuntimeCompensationAction.ReplayLedgerAppend : AIRuntimeCompensationAction.PreserveForManualReconciliation,
        status: "RECOMMENDED",
        timestamp: this.safeNow(initialTimestamp),
        sourceAuditReferences: clone(state.sourceAuditReferences),
        reasonCodes: [settlementOutcome.ledgerFailure ? "REPLAY_IDEMPOTENT_LEDGER_APPEND" : "MANUAL_RECONCILIATION_REQUIRED"],
      });
      const status = settlementOutcome.ledgerFailure ? AIRuntimeWorkflowStatus.FailedLedger : AIRuntimeWorkflowStatus.FailedSettlement;
      return this.finalizeAndStore(request, fingerprint, state, status, [settlementOutcome.error.code], settlementOutcome.ledgerFailure ? AIRuntimeWorkflowRetryDisposition.ManualLedgerReplay : AIRuntimeWorkflowRetryDisposition.ManualReconciliation, settlementOutcome.error);
    }

    const reconciliationTimestamp = this.safeNow(initialTimestamp);
    const reconciliation = ledger.reconcileReservation(
      request.identifiers.reservationId,
      request.identifiers.reconciliationOperationId,
      reconciliationTimestamp,
      request.configuration.costLedgerPolicy.version,
    );
    state.reconciliation = clone(reconciliation);
    state.sourceAuditReferences.push(reconciliation.auditRecord.auditId);
    const expectedOpenForRetry = settlementOutcome.settlement.retainedForRetry && reconciliation.issues.every((value) => value.code === AICostLedgerReconciliationIssueCode.MissingFinalSettlement);
    const reconciliationAccepted = reconciliation.status === AICostLedgerReconciliationStatus.Reconciled || expectedOpenForRetry;
    this.addStage(
      state,
      AIRuntimeWorkflowStage.LedgerReconciliation,
      reconciliationAccepted ? AIRuntimeWorkflowStageStatus.Succeeded : AIRuntimeWorkflowStageStatus.Failed,
      reconciliation.auditRecord.timestamp,
      [request.identifiers.reservationId],
      reconciliation.sourceEntryIds,
      reconciliationAccepted ? [expectedOpenForRetry ? "OPEN_RESERVATION_RETAINED_FOR_RETRY" : "LEDGER_RECONCILED"] : reconciliation.issues.map((value) => value.code),
      [reconciliation.auditRecord.auditId],
      reconciliationAccepted ? undefined : workflowError(AIRuntimeWorkflowErrorCategory.ReconciliationFailed, "LEDGER_RECONCILIATION_FAILED", "Cost Ledger reconciliation found inconsistent reservation history.", AIRuntimeWorkflowStage.LedgerReconciliation, reconciliation.auditRecord.timestamp),
    );
    if (!this.appendUnified(request, state, auditRecordFromCostLedgerAudit(reconciliation.auditRecord, this.translationContext(request, state, state.lastUnifiedAuditRecordId === undefined ? [] : [state.lastUnifiedAuditRecordId])))) {
      state.postMonetaryAuditFailure = true;
    }
    if (!reconciliationAccepted) {
      return this.finalizeAndStore(request, fingerprint, state, AIRuntimeWorkflowStatus.FailedReconciliation, reconciliation.issues.map((value) => value.code), AIRuntimeWorkflowRetryDisposition.ManualReconciliation, workflowError(AIRuntimeWorkflowErrorCategory.ReconciliationFailed, "LEDGER_RECONCILIATION_FAILED", "Reservation accounting history is inconsistent and was not repaired.", AIRuntimeWorkflowStage.LedgerReconciliation, reconciliation.auditRecord.timestamp));
    }

    let finalStatus: AIRuntimeWorkflowStatus;
    let disposition = AIRuntimeWorkflowRetryDisposition.None;
    if (execution.status === AIExecutionCoordinatorStatus.ExecutionSucceeded) {
      finalStatus = state.postMonetaryAuditFailure
        ? request.configuration.workflowPolicy.auditFailureMode === AIRuntimeAuditFailureMode.WarnAfterMonetarySuccess
          ? AIRuntimeWorkflowStatus.CompletedWithWarning
          : AIRuntimeWorkflowStatus.RejectedAudit
        : AIRuntimeWorkflowStatus.CompletedSuccess;
    } else if (execution.status === AIExecutionCoordinatorStatus.ExecutionRequiresReroute || execution.retryPlan.action === AIRetryAction.ReturnToRouterForFallback) {
      finalStatus = AIRuntimeWorkflowStatus.RequiresRouterFallback;
      disposition = AIRuntimeWorkflowRetryDisposition.ReturnToRouter;
    } else if (execution.status === AIExecutionCoordinatorStatus.ExecutionCancelled) {
      finalStatus = AIRuntimeWorkflowStatus.Cancelled;
    } else {
      finalStatus = AIRuntimeWorkflowStatus.FailedExecution;
      if (execution.retryPlan.action === AIRetryAction.RetrySameAdapter) disposition = AIRuntimeWorkflowRetryDisposition.RetrySameAdapterExplicitly;
    }
    const finalError = finalStatus === AIRuntimeWorkflowStatus.CompletedSuccess || finalStatus === AIRuntimeWorkflowStatus.CompletedWithWarning
      ? undefined
      : workflowError(
          finalStatus === AIRuntimeWorkflowStatus.RejectedAudit ? AIRuntimeWorkflowErrorCategory.AuditAppendFailed : AIRuntimeWorkflowErrorCategory.ExecutionFailed,
          finalStatus,
          finalStatus === AIRuntimeWorkflowStatus.RejectedAudit ? "Post-execution audit evidence could not be appended under fail-closed policy." : execution.error?.safeMessage ?? "Provider-neutral execution did not complete successfully.",
          state.postMonetaryAuditFailure ? AIRuntimeWorkflowStage.FinalAuditAppend : AIRuntimeWorkflowStage.ProviderExecution,
          this.safeNow(initialTimestamp),
          execution.error?.retryable ?? false,
        );
    return this.finalizeAndStore(request, fingerprint, state, finalStatus, unique([...execution.reasons, ...(state.postMonetaryAuditFailure ? ["POST_MONETARY_AUDIT_FAILURE"] : [])]), disposition, finalError);
  }

  private safeNow(fallback: string): string {
    const value = this.dependencies.clock.now();
    return Number.isFinite(Date.parse(value)) ? value : fallback;
  }

  private addStage(
    state: WorkflowState,
    stage: AIRuntimeWorkflowStage,
    status: AIRuntimeWorkflowStageStatus,
    timestamp: string,
    inputReferences: ReadonlyArray<string>,
    outputReferences: ReadonlyArray<string>,
    reasonCodes: ReadonlyArray<string>,
    sourceAuditReferences: ReadonlyArray<string>,
    error?: AIRuntimeWorkflowError,
  ): void {
    state.stages.push({
      stage,
      status,
      timestamp,
      inputReferences: clone(inputReferences),
      outputReferences: clone(outputReferences),
      reasonCodes: reasonCodes.map(reasonCode),
      sourceAuditReferences: clone(sourceAuditReferences),
      ...(error === undefined ? {} : { error: clone(error) }),
    });
    if (status !== AIRuntimeWorkflowStageStatus.Failed) state.lastCompletedStage = stage;
  }

  private recordCost(state: WorkflowState, decision: CostGovernorDecision, audit: CostAuditRecord): void {
    state.costDecisions.push(clone(decision));
    state.costAuditRecords.push(clone(audit));
    state.sourceAuditReferences.push(audit.auditId);
  }

  private translationContext(
    request: AIRuntimeWorkflowRequest,
    state: WorkflowState,
    parentAuditRecordIds: ReadonlyArray<string>,
    relatedAuditRecordIds: ReadonlyArray<string> = [],
  ) {
    state.auditOrdinal += 1;
    return {
      idempotencyKey: `${request.workflowId}:unified:${state.auditOrdinal}`,
      correlationId: request.correlationId,
      traceId: request.traceId,
      parentAuditRecordIds: clone(parentAuditRecordIds),
      relatedAuditRecordIds: clone(relatedAuditRecordIds),
      privacyLevel: request.configuration.workflowPolicy.auditPrivacyLevel,
      retention: request.configuration.workflowPolicy.auditRetention,
      actor: clone(request.configuration.workflowPolicy.auditActor),
      metadata: { workflow_id: request.workflowId },
      sourceRecordVersion: "1.0",
    } as const;
  }

  private appendUnified(
    request: AIRuntimeWorkflowRequest,
    state: WorkflowState,
    record: AIAuditRecordInput,
  ): boolean {
    const result = this.dependencies.auditRepository.append({ record, policy: request.configuration.auditPolicy });
    if (result.status !== AIAuditAppendStatus.Appended || result.record === undefined) return false;
    state.lastUnifiedAuditRecordId = result.record.recordId;
    state.unifiedAuditRecordIds.push(result.record.recordId);
    return true;
  }

  private appendLedgerInstruction(
    request: AIRuntimeWorkflowRequest,
    state: WorkflowState,
    ledger: DeterministicAICostLedger,
    instruction: NonNullable<AIReservationResult["ledgerInstruction"]>,
    entryId: string,
    sourceAuditRecordId: string,
    providerId?: string,
    modelId?: string,
  ): AICostLedgerAppendResult {
    const entry = costLedgerEntryFromReservationInstruction(instruction, {
      entryId,
      sourceAuditRecordId,
      correlationId: request.correlationId,
      traceId: request.traceId,
      ...(providerId === undefined ? {} : { providerId }),
      ...(modelId === undefined ? {} : { modelId }),
      taskType: request.originalRequest.taskType,
      metadata: { workflow_id: request.workflowId },
    });
    const result = ledger.append({ entry, policy: request.configuration.costLedgerPolicy });
    state.ledgerResults.push(clone(result));
    state.sourceAuditReferences.push(result.auditRecord.auditId);
    if (result.entry !== undefined && !state.ledgerEntryIds.includes(result.entry.entryId)) state.ledgerEntryIds.push(result.entry.entryId);
    return result;
  }

  private applySettlement(
    request: AIRuntimeWorkflowRequest,
    state: WorkflowState,
    manager: DeterministicAIReservationManager,
    ledger: DeterministicAICostLedger,
    reservationPolicy: AIReservationPolicy,
    execution: AIExecutionCoordinatorResult,
    providerId: string,
    modelId: string,
  ): {
    readonly settlement: AIRuntimeWorkflowSettlementResult;
    readonly error?: AIRuntimeWorkflowError;
    readonly ledgerFailure: boolean;
  } {
    const reservationResults: AIReservationResult[] = [];
    const ledgerResults: AICostLedgerAppendResult[] = [];
    let finalReservationAudit: AIReservationAuditRecord | undefined;
    let retainedForRetry = false;
    let commitApplied = false;
    const settle = (
      operationType: AIReservationOperationType.Commit | AIReservationOperationType.Release | AIReservationOperationType.Expire,
      operationId: string,
      idempotencyKey: string,
      ledgerEntryId: string,
      actualUsage?: { readonly minorUnits: number; readonly currency: string },
    ) => {
      const current = this.dependencies.reservationRepository.getById(request.identifiers.reservationId);
      if (current === undefined) return { error: workflowError(AIRuntimeWorkflowErrorCategory.SettlementFailed, "SETTLEMENT_RESERVATION_MISSING", "Reservation disappeared before settlement.", AIRuntimeWorkflowStage.ReservationSettlement, this.safeNow(request.originalRequest.requestedAt)), ledgerFailure: false };
      const timestamp = this.safeNow(request.originalRequest.requestedAt);
      const base = {
        operationId,
        idempotencyKey,
        operationType,
        reservationId: request.identifiers.reservationId,
        requestId: request.requestId,
        timestamp,
        expectedVersion: current.version,
        policy: reservationPolicy,
        reason: "Apply deterministic Execution Coordinator settlement instruction.",
      } as const;
      const result = operationType === AIReservationOperationType.Commit
        ? manager.process({ ...base, operationType, executionId: request.identifiers.executionId, actualUsage: actualUsage as { minorUnits: number; currency: string } })
        : operationType === AIReservationOperationType.Release
          ? manager.process({ ...base, operationType, ...(commitApplied ? { executionId: request.identifiers.executionId } : {}) })
          : manager.process({ ...base, operationType, administrative: true });
      reservationResults.push(clone(result));
      state.reservationResults.push(clone(result));
      state.sourceAuditReferences.push(result.auditRecord.auditId);
      finalReservationAudit = result.auditRecord;
      if (result.status !== AIReservationResultStatus.Applied || result.ledgerInstruction === undefined) {
        return { error: workflowError(AIRuntimeWorkflowErrorCategory.SettlementFailed, "RESERVATION_SETTLEMENT_FAILED", result.error?.safeMessage ?? "Reservation settlement operation failed.", AIRuntimeWorkflowStage.ReservationSettlement, result.auditRecord.timestamp, result.error?.retryable ?? false), ledgerFailure: false };
      }
      if (operationType === AIReservationOperationType.Commit) commitApplied = true;
      if (!this.appendUnified(request, state, auditRecordFromReservationAudit(result.auditRecord, this.translationContext(request, state, state.lastUnifiedAuditRecordId === undefined ? [] : [state.lastUnifiedAuditRecordId])))) state.postMonetaryAuditFailure = true;
      const ledgerResult = this.appendLedgerInstruction(request, state, ledger, result.ledgerInstruction, ledgerEntryId, result.auditRecord.auditId, providerId, modelId);
      ledgerResults.push(clone(ledgerResult));
      if (ledgerResult.status === AICostLedgerAppendStatus.Rejected) {
        return { error: workflowError(AIRuntimeWorkflowErrorCategory.LedgerAppendFailed, "SETTLEMENT_LEDGER_APPEND_FAILED", ledgerResult.error?.safeMessage ?? "Settlement ledger append failed after reservation mutation.", AIRuntimeWorkflowStage.SettlementLedgerAppend, ledgerResult.auditRecord.timestamp, true), ledgerFailure: true };
      }
      if (!this.appendUnified(request, state, auditRecordFromCostLedgerAudit(ledgerResult.auditRecord, this.translationContext(request, state, state.lastUnifiedAuditRecordId === undefined ? [] : [state.lastUnifiedAuditRecordId])))) state.postMonetaryAuditFailure = true;
      return {};
    };

    for (const instruction of execution.usageSettlementInstructions) {
      if (instruction.type !== AIUsageSettlementInstructionType.CommitUsage) continue;
      if (instruction.actualReportedAmount === undefined || instruction.actualReportedAmount.minorUnits <= 0) {
        const error = workflowError(AIRuntimeWorkflowErrorCategory.SettlementFailed, "ACTUAL_USAGE_MISSING", "Commit instruction did not contain positive actual usage.", AIRuntimeWorkflowStage.ReservationSettlement, this.safeNow(request.originalRequest.requestedAt));
        return { settlement: { reservationResults, ledgerResults, completed: false, retainedForRetry: false, reasonCodes: [error.code] }, error, ledgerFailure: false };
      }
      const outcome = settle(AIReservationOperationType.Commit, request.identifiers.commitOperationId, request.identifiers.commitIdempotencyKey, request.identifiers.commitLedgerEntryId, instruction.actualReportedAmount);
      if (outcome.error !== undefined) return { settlement: { reservationResults, ledgerResults, ...(finalReservationAudit === undefined ? {} : { finalReservationAudit }), completed: false, retainedForRetry: false, reasonCodes: [outcome.error.code] }, error: outcome.error, ledgerFailure: outcome.ledgerFailure };
    }
    for (const instruction of execution.reservationInstructions) {
      if (instruction.type === AIReservationInstructionType.RetainForRetry) {
        retainedForRetry = true;
        continue;
      }
      if (instruction.type === AIReservationInstructionType.NoAction) continue;
      const operationType = instruction.type === AIReservationInstructionType.ExpireReservation
        ? AIReservationOperationType.Expire
        : AIReservationOperationType.Release;
      const outcome = settle(operationType, request.identifiers.releaseOperationId, request.identifiers.releaseIdempotencyKey, request.identifiers.releaseLedgerEntryId);
      if (outcome.error !== undefined) return { settlement: { reservationResults, ledgerResults, ...(finalReservationAudit === undefined ? {} : { finalReservationAudit }), completed: false, retainedForRetry, reasonCodes: [outcome.error.code] }, error: outcome.error, ledgerFailure: outcome.ledgerFailure };
    }
    const completed = reservationResults.every((value) => value.status === AIReservationResultStatus.Applied);
    const reasonCodes = retainedForRetry
      ? ["RESERVATION_RETAINED_FOR_EXPLICIT_RETRY"]
      : reservationResults.length === 0
        ? ["NO_SETTLEMENT_MUTATION_REQUIRED"]
        : ["SETTLEMENT_APPLIED"];
    const settlement: AIRuntimeWorkflowSettlementResult = {
      reservationResults: clone(reservationResults),
      ledgerResults: clone(ledgerResults),
      ...(finalReservationAudit === undefined ? {} : { finalReservationAudit: clone(finalReservationAudit) }),
      completed,
      retainedForRetry,
      reasonCodes,
    };
    this.addStage(state, AIRuntimeWorkflowStage.ReservationSettlement, AIRuntimeWorkflowStageStatus.Succeeded, this.safeNow(request.originalRequest.requestedAt), [execution.executionId], reservationResults.map((value) => value.auditRecord.reservationId), reasonCodes, reservationResults.map((value) => value.auditRecord.auditId));
    this.addStage(state, AIRuntimeWorkflowStage.SettlementLedgerAppend, AIRuntimeWorkflowStageStatus.Succeeded, this.safeNow(request.originalRequest.requestedAt), reservationResults.map((value) => value.auditRecord.auditId), ledgerResults.flatMap((value) => value.entry === undefined ? [] : [value.entry.entryId]), ledgerResults.length === 0 ? ["NO_LEDGER_APPEND_REQUIRED"] : ["SETTLEMENT_LEDGER_APPENDED"], ledgerResults.map((value) => value.auditRecord.auditId));
    return { settlement, ledgerFailure: false };
  }

  private async compensateRelease(
    request: AIRuntimeWorkflowRequest,
    state: WorkflowState,
    manager: DeterministicAIReservationManager,
    ledger: DeterministicAICostLedger,
    policy: AIReservationPolicy,
    reason: string,
  ): Promise<void> {
    const current = this.dependencies.reservationRepository.getById(request.identifiers.reservationId);
    if (current === undefined || ![AIReservationState.Reserved, AIReservationState.PartiallyCommitted].includes(current.state)) {
      state.compensations.push({ action: AIRuntimeCompensationAction.ReleaseReservation, status: "NOT_REQUIRED", timestamp: this.safeNow(request.originalRequest.requestedAt), sourceAuditReferences: [], reasonCodes: ["NO_ACTIVE_RESERVATION"] });
      return;
    }
    const release = manager.process({
      operationId: request.identifiers.compensationReleaseOperationId,
      idempotencyKey: request.identifiers.compensationReleaseIdempotencyKey,
      operationType: AIReservationOperationType.Release,
      reservationId: request.identifiers.reservationId,
      requestId: request.requestId,
      timestamp: this.safeNow(request.originalRequest.requestedAt),
      expectedVersion: current.version,
      policy,
      reason: `Explicit workflow compensation: ${reason}`,
      ...(current.state === AIReservationState.PartiallyCommitted ? { executionId: request.identifiers.executionId } : {}),
    });
    state.reservationResults.push(clone(release));
    state.sourceAuditReferences.push(release.auditRecord.auditId);
    const applied = release.status === AIReservationResultStatus.Applied && release.ledgerInstruction !== undefined;
    state.compensations.push({
      action: AIRuntimeCompensationAction.ReleaseReservation,
      status: applied ? "APPLIED" : "FAILED",
      timestamp: release.auditRecord.timestamp,
      operationId: request.identifiers.compensationReleaseOperationId,
      sourceAuditReferences: [release.auditRecord.auditId],
      reasonCodes: [applied ? "COMPENSATION_RELEASE_APPLIED" : "COMPENSATION_RELEASE_FAILED"],
      ...(release.error === undefined ? {} : { error: workflowError(AIRuntimeWorkflowErrorCategory.CompensationFailed, "COMPENSATION_RELEASE_FAILED", release.error.safeMessage, AIRuntimeWorkflowStage.Compensation, release.error.occurredAt, release.error.retryable) }),
    });
    if (!applied || release.ledgerInstruction === undefined) return;
    this.appendUnified(request, state, auditRecordFromReservationAudit(release.auditRecord, this.translationContext(request, state, state.lastUnifiedAuditRecordId === undefined ? [] : [state.lastUnifiedAuditRecordId])));
    const ledgerResult = this.appendLedgerInstruction(request, state, ledger, release.ledgerInstruction, request.identifiers.compensationReleaseLedgerEntryId, release.auditRecord.auditId);
    const ledgerApplied = ledgerResult.status !== AICostLedgerAppendStatus.Rejected;
    state.compensations.push({
      action: AIRuntimeCompensationAction.AppendReleaseLedgerEntry,
      status: ledgerApplied ? "APPLIED" : "FAILED",
      timestamp: ledgerResult.auditRecord.timestamp,
      sourceAuditReferences: [ledgerResult.auditRecord.auditId],
      reasonCodes: [ledgerApplied ? "COMPENSATION_LEDGER_APPENDED" : "COMPENSATION_LEDGER_FAILED"],
      ...(ledgerResult.error === undefined ? {} : { error: workflowError(AIRuntimeWorkflowErrorCategory.CompensationFailed, "COMPENSATION_LEDGER_FAILED", ledgerResult.error.safeMessage, AIRuntimeWorkflowStage.Compensation, ledgerResult.error.occurredAt, true) }),
    });
    this.appendUnified(request, state, auditRecordFromCostLedgerAudit(ledgerResult.auditRecord, this.translationContext(request, state, state.lastUnifiedAuditRecordId === undefined ? [] : [state.lastUnifiedAuditRecordId])));
    this.addStage(state, AIRuntimeWorkflowStage.Compensation, ledgerApplied ? AIRuntimeWorkflowStageStatus.Compensated : AIRuntimeWorkflowStageStatus.Failed, ledgerResult.auditRecord.timestamp, [request.identifiers.reservationId], ledgerResult.entry === undefined ? [] : [ledgerResult.entry.entryId], [reason, ledgerApplied ? "COMPENSATION_COMPLETE" : "COMPENSATION_INCOMPLETE"], [release.auditRecord.auditId, ledgerResult.auditRecord.auditId]);
  }

  private async finalizeAndStore(
    request: AIRuntimeWorkflowRequest,
    fingerprint: string,
    state: WorkflowState,
    requestedStatus: AIRuntimeWorkflowStatus,
    reasons: ReadonlyArray<string>,
    disposition: AIRuntimeWorkflowRetryDisposition,
    error?: AIRuntimeWorkflowError,
  ): Promise<AIRuntimeWorkflowResult> {
    let status = requestedStatus;
    const timestamp = this.safeNow(request.originalRequest.requestedAt);
    const workflowAudit = this.workflowAuditRecord(request, state, status, reasons, timestamp);
    const selected = state.routingDecisions.at(-1);
    const selectedProvider = selected !== undefined && "selectedProviderId" in selected ? selected.selectedProviderId : undefined;
    const selectedModel = selected !== undefined && "selectedModelId" in selected ? selected.selectedModelId : undefined;
    const finalRecord: AIAuditRecordInput = {
      schemaVersion: "1.0",
      recordId: request.identifiers.finalAuditRecordId,
      idempotencyKey: request.identifiers.finalAuditIdempotencyKey,
      recordType: AIAuditRecordType.RuntimeWorkflowResult,
      sourceSubsystem: AIAuditSourceSubsystem.RuntimeWorkflow,
      sourceRecordId: request.workflowId,
      sourceRecordVersion: "1.0",
      timestamp,
      requestId: request.requestId,
      correlationId: request.correlationId,
      traceId: request.traceId,
      parentAuditRecordIds: state.lastUnifiedAuditRecordId === undefined ? [] : [state.lastUnifiedAuditRecordId],
      relatedAuditRecordIds: [],
      ledgerEntryIds: clone(state.ledgerEntryIds),
      ...(selectedProvider === undefined ? {} : { providerId: selectedProvider }),
      ...(selectedModel === undefined ? {} : { modelId: selectedModel }),
      taskType: request.originalRequest.taskType,
      policyVersions: { workflow: request.configuration.workflowPolicy.version },
      status,
      reasonCodes: unique(reasons.map(reasonCode)),
      ...(error === undefined ? {} : { error: { category: error.category, code: error.code, safeMessage: error.safeMessage, retryable: error.retryable, occurredAt: error.occurredAt } }),
      actor: clone(request.configuration.workflowPolicy.auditActor),
      privacyLevel: request.configuration.workflowPolicy.auditPrivacyLevel,
      retention: request.configuration.workflowPolicy.auditRetention,
      metadata: {
        workflow_id: request.workflowId,
        stage_count: state.stages.length,
        routing_attempt_count: state.routingDecisions.length,
        cost_decision_count: state.costDecisions.length,
        ledger_entry_count: state.ledgerEntryIds.length,
        compensation_count: state.compensations.length,
      },
      payloadIntegrityReference: `workflow:${request.workflowId}`,
      sourceAuditReferences: unique(state.sourceAuditReferences),
      finalOutcome: status,
    };
    const finalAppend = this.dependencies.auditRepository.append({ record: finalRecord, policy: request.configuration.auditPolicy });
    if (finalAppend.status === AIAuditAppendStatus.Appended && finalAppend.record !== undefined) {
      state.lastUnifiedAuditRecordId = finalAppend.record.recordId;
      state.unifiedAuditRecordIds.push(finalAppend.record.recordId);
      this.addStage(state, AIRuntimeWorkflowStage.FinalAuditAppend, AIRuntimeWorkflowStageStatus.Succeeded, timestamp, clone(state.sourceAuditReferences), [finalAppend.record.recordId], ["FINAL_WORKFLOW_AUDIT_APPENDED"], [workflowAudit.auditId]);
    } else {
      const monetary = isMonetaryApplied(state);
      if (monetary && request.configuration.workflowPolicy.auditFailureMode === AIRuntimeAuditFailureMode.WarnAfterMonetarySuccess && requestedStatus === AIRuntimeWorkflowStatus.CompletedSuccess) status = AIRuntimeWorkflowStatus.CompletedWithWarning;
      else status = AIRuntimeWorkflowStatus.RejectedAudit;
      this.addStage(state, AIRuntimeWorkflowStage.FinalAuditAppend, AIRuntimeWorkflowStageStatus.Failed, timestamp, clone(state.sourceAuditReferences), [], ["FINAL_WORKFLOW_AUDIT_FAILED"], [], workflowError(AIRuntimeWorkflowErrorCategory.AuditAppendFailed, "FINAL_WORKFLOW_AUDIT_FAILED", finalAppend.error?.safeMessage ?? "Final workflow audit could not be appended.", AIRuntimeWorkflowStage.FinalAuditAppend, timestamp));
    }

    try {
      const trace = this.dependencies.auditRepository.reconstructTrace({
        operationId: request.identifiers.traceOperationId,
        requestedAt: timestamp,
        policyVersion: request.configuration.auditPolicy.version,
        traceId: request.traceId,
      });
      const acceptable = request.configuration.workflowPolicy.acceptedFinalTraceStatuses.includes(trace.status);
      state.auditTrace = { trace: clone(trace), acceptable, finalOutcome: trace.finalOutcome };
      this.addStage(state, AIRuntimeWorkflowStage.TraceValidation, acceptable ? AIRuntimeWorkflowStageStatus.Succeeded : AIRuntimeWorkflowStageStatus.Failed, timestamp, [request.traceId], trace.nodes.map((node) => node.recordId), acceptable ? ["AUDIT_TRACE_ACCEPTED"] : trace.issues.map((value) => value.code), state.unifiedAuditRecordIds, acceptable ? undefined : workflowError(AIRuntimeWorkflowErrorCategory.TraceIntegrityFailed, "FINAL_TRACE_NOT_ACCEPTABLE", "Final audit trace status is not accepted by workflow policy.", AIRuntimeWorkflowStage.TraceValidation, timestamp));
      if (!acceptable && [AIRuntimeWorkflowStatus.CompletedSuccess, AIRuntimeWorkflowStatus.CompletedWithWarning].includes(status)) status = AIRuntimeWorkflowStatus.FailedTraceIntegrity;
    } catch {
      this.addStage(state, AIRuntimeWorkflowStage.TraceValidation, AIRuntimeWorkflowStageStatus.Failed, timestamp, [request.traceId], [], ["TRACE_RECONSTRUCTION_FAILED"], [], workflowError(AIRuntimeWorkflowErrorCategory.TraceIntegrityFailed, "TRACE_RECONSTRUCTION_FAILED", "Final audit trace could not be reconstructed.", AIRuntimeWorkflowStage.TraceValidation, timestamp));
      if ([AIRuntimeWorkflowStatus.CompletedSuccess, AIRuntimeWorkflowStatus.CompletedWithWarning].includes(status)) status = AIRuntimeWorkflowStatus.FailedTraceIntegrity;
    }
    this.addStage(state, status === AIRuntimeWorkflowStatus.DeferredBudgetUnavailable ? AIRuntimeWorkflowStage.Deferred : status === AIRuntimeWorkflowStatus.RequiresRouterFallback ? AIRuntimeWorkflowStage.RequiresReroute : [AIRuntimeWorkflowStatus.CompletedSuccess, AIRuntimeWorkflowStatus.CompletedWithWarning].includes(status) ? AIRuntimeWorkflowStage.Completed : AIRuntimeWorkflowStage.Failed, status === AIRuntimeWorkflowStatus.DeferredBudgetUnavailable ? AIRuntimeWorkflowStageStatus.Deferred : [AIRuntimeWorkflowStatus.CompletedSuccess, AIRuntimeWorkflowStatus.CompletedWithWarning].includes(status) ? AIRuntimeWorkflowStageStatus.Succeeded : AIRuntimeWorkflowStageStatus.Failed, timestamp, [request.workflowId], [status], reasons, clone(state.sourceAuditReferences), error);
    const result = this.buildResult(request, state, status, reasons, disposition, error);
    return this.store(request, fingerprint, result);
  }

  private workflowAuditRecord(
    request: AIRuntimeWorkflowRequest,
    state: WorkflowState,
    status: AIRuntimeWorkflowStatus,
    reasons: ReadonlyArray<string>,
    timestamp: string,
  ): AIRuntimeWorkflowAuditRecord {
    return {
      auditId: request.identifiers.finalAuditRecordId,
      workflowId: request.workflowId,
      requestId: request.requestId,
      correlationId: request.correlationId,
      traceId: request.traceId,
      timestamp,
      policyVersion: request.configuration.workflowPolicy.version,
      status,
      lastCompletedStage: state.lastCompletedStage,
      completedStages: state.stages.filter((value) => value.status !== AIRuntimeWorkflowStageStatus.Failed).map((value) => value.stage),
      routingDecisionIds: state.routingDecisions.map((value) => value.decisionId),
      costDecisionIds: state.costDecisions.map((value) => value.decisionId),
      reservationId: request.identifiers.reservationId,
      ...(state.executionResult === undefined ? {} : { executionId: state.executionResult.executionId }),
      ledgerEntryIds: clone(state.ledgerEntryIds),
      sourceAuditReferences: unique(state.sourceAuditReferences),
      reasonCodes: unique(reasons.map(reasonCode)),
      compensationActions: state.compensations.map((value) => value.action),
      finalResult: status,
    };
  }

  private buildResult(
    request: AIRuntimeWorkflowRequest,
    state: WorkflowState,
    status: AIRuntimeWorkflowStatus,
    reasons: ReadonlyArray<string>,
    disposition: AIRuntimeWorkflowRetryDisposition,
    error?: AIRuntimeWorkflowError,
  ): AIRuntimeWorkflowResult {
    return {
      workflowId: request.workflowId,
      requestId: request.requestId,
      correlationId: request.correlationId,
      traceId: request.traceId,
      status,
      lastCompletedStage: state.lastCompletedStage,
      stages: clone(state.stages),
      reasons: unique(reasons.map(reasonCode)),
      routingDecisions: clone(state.routingDecisions),
      routingAuditRecords: clone(state.routingAuditRecords),
      costDecisions: clone(state.costDecisions),
      costAuditRecords: clone(state.costAuditRecords),
      reservationResults: clone(state.reservationResults),
      ledgerResults: clone(state.ledgerResults),
      ...(state.executionResult === undefined ? {} : { executionResult: clone(state.executionResult) }),
      ...(state.settlement === undefined ? {} : { settlement: clone(state.settlement) }),
      ...(state.reconciliation === undefined ? {} : { reconciliation: clone(state.reconciliation) }),
      ...(state.auditTrace === undefined ? {} : { auditTrace: clone(state.auditTrace) }),
      compensations: clone(state.compensations),
      retryDisposition: disposition,
      workflowAuditRecord: this.workflowAuditRecord(request, state, status, reasons, this.safeNow(request.originalRequest.requestedAt)),
      ...(error === undefined ? {} : { error: clone(error) }),
    };
  }

  private store(request: AIRuntimeWorkflowRequest, fingerprint: string, result: AIRuntimeWorkflowResult): AIRuntimeWorkflowResult {
    const appended = this.dependencies.workflowRepository.append({ workflowId: request.workflowId, idempotencyKey: request.idempotencyKey, requestFingerprint: fingerprint, result });
    if (appended) return clone(result);
    const replay = this.dependencies.workflowRepository.getByIdempotencyKey(request.idempotencyKey);
    if (replay !== undefined && replay.requestFingerprint === fingerprint) return clone(replay.result);
    return clone(result);
  }

  private invalidResult(request: AIRuntimeWorkflowRequest, error: AIRuntimeWorkflowError): AIRuntimeWorkflowResult {
    const state: WorkflowState = {
      stages: [], routingDecisions: [], routingAuditRecords: [], costDecisions: [], costAuditRecords: [], reservationResults: [], ledgerResults: [], compensations: [], sourceAuditReferences: [], unifiedAuditRecordIds: [], ledgerEntryIds: [], lastCompletedStage: AIRuntimeWorkflowStage.RequestValidation, auditOrdinal: 0, postMonetaryAuditFailure: false,
    };
    this.addStage(state, AIRuntimeWorkflowStage.RequestValidation, AIRuntimeWorkflowStageStatus.Failed, error.occurredAt, [request.workflowId], [], [error.code], [], error);
    return this.buildResult(request, state, AIRuntimeWorkflowStatus.InvalidRequest, [error.code], AIRuntimeWorkflowRetryDisposition.None, error);
  }
}
