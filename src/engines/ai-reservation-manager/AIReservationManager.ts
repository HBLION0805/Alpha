import {
  AIReservationErrorCategory,
  AIReservationLedgerInstructionType,
  AIReservationOperationType,
  AIReservationResultStatus,
  AIReservationState,
  AIReservationValidationStatus,
  BudgetReservationStatus,
  CostDecisionStatus,
  validateAIReservationRequest,
  type AIAcquireReservationRequest,
  type AICancelReservationRequest,
  type AICommitReservationRequest,
  type AIExpireReservationRequest,
  type AIRejectReservationRequest,
  type AIReleaseReservationRequest,
  type AIReservationAuditRecord,
  type AIReservationError,
  type AIReservationLedgerInstruction,
  type AIReservationManager,
  type AIReservationOperation,
  type AIReservationRecord,
  type AIReservationRepository,
  type AIReservationRequest,
  type AIReservationResult,
  type AIReservationValidationCheck,
  type BudgetReservation,
  type CostGovernorDecision,
  type MinorUnitAmount,
} from "../../contracts";

class ReservationFailure extends Error {
  constructor(
    readonly category: AIReservationErrorCategory,
    readonly checkName: string,
    message: string,
    readonly retryable = false,
    readonly currentVersion?: number,
  ) {
    super(message);
  }
}

interface TransitionResult {
  readonly record: AIReservationRecord;
  readonly stateBefore: AIReservationState;
  readonly versionBefore: number;
  readonly instructionType: AIReservationLedgerInstructionType;
  readonly instructionAmount: MinorUnitAmount;
  readonly executionId?: string;
  readonly reasons: ReadonlyArray<string>;
}

const APPROVED_COST_STATUSES = new Set<CostDecisionStatus>([
  CostDecisionStatus.Allowed,
  CostDecisionStatus.AllowedLowCostOnly,
  CostDecisionStatus.AllowedWithOverride,
]);

function clone<T>(value: T): T {
  return structuredClone(value);
}

function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (Number.isNaN(value)) return '"[NaN]"';
    if (value === Infinity) return '"[Infinity]"';
    if (value === -Infinity) return '"[-Infinity]"';
    return JSON.stringify(value);
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (value === undefined) return '"[Undefined]"';
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function validationCheck(
  name: string,
  passed: boolean,
  reason: string,
): AIReservationValidationCheck {
  return {
    name,
    status: passed
      ? AIReservationValidationStatus.Passed
      : AIReservationValidationStatus.Failed,
    reason,
  };
}

function assertCondition(
  checks: AIReservationValidationCheck[],
  condition: boolean,
  category: AIReservationErrorCategory,
  name: string,
  message: string,
  retryable = false,
  currentVersion?: number,
): asserts condition {
  checks.push(validationCheck(name, condition, message));
  if (!condition) {
    throw new ReservationFailure(
      category,
      name,
      message,
      retryable,
      currentVersion,
    );
  }
}

function validAmount(amount: MinorUnitAmount, allowZero: boolean): boolean {
  return (
    Number.isSafeInteger(amount.minorUnits) &&
    (allowZero ? amount.minorUnits >= 0 : amount.minorUnits > 0) &&
    typeof amount.currency === "string" &&
    amount.currency.trim().length > 0
  );
}

function amountEquals(left: MinorUnitAmount, right: MinorUnitAmount): boolean {
  return (
    left.minorUnits === right.minorUnits && left.currency === right.currency
  );
}

function terminalPlanningRequest(
  request: AICancelReservationRequest | AIRejectReservationRequest,
): request is AICancelReservationRequest {
  return request.operationType === AIReservationOperationType.Cancel;
}

export class DeterministicAIReservationManager
  implements AIReservationManager
{
  constructor(private readonly repository: AIReservationRepository) {}

  process(request: Readonly<AIReservationRequest>): AIReservationResult {
    const fingerprint = canonicalize(request);
    const commonChecks: AIReservationValidationCheck[] = [];

    try {
      validateAIReservationRequest(request as AIReservationRequest);
      commonChecks.push(
        validationCheck(
          "REQUEST_CONTRACT",
          true,
          "Reservation operation contract is structurally valid.",
        ),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      commonChecks.push(validationCheck("REQUEST_CONTRACT", false, message));
      return this.rejection(
        request,
        new ReservationFailure(
          AIReservationErrorCategory.InvalidRequest,
          "REQUEST_CONTRACT",
          message,
        ),
        commonChecks,
      );
    }

    const replay = this.repository.getOperationByIdempotencyKey(
      request.idempotencyKey,
    );
    if (replay !== undefined) {
      if (
        replay.payloadFingerprint === fingerprint &&
        replay.operationType === request.operationType
      ) {
        return clone(replay.result);
      }
      return this.rejection(
        request,
        new ReservationFailure(
          AIReservationErrorCategory.IdempotencyConflict,
          "IDEMPOTENCY_KEY",
          "Idempotency key was already used with a different operation payload.",
        ),
        [
          ...commonChecks,
          validationCheck(
            "IDEMPOTENCY_KEY",
            false,
            "Idempotency key conflicts with an earlier operation.",
          ),
        ],
      );
    }

    if (this.repository.getOperationById(request.operationId) !== undefined) {
      return this.rejection(
        request,
        new ReservationFailure(
          AIReservationErrorCategory.RepositoryConflict,
          "OPERATION_ID",
          "Operation ID was already used.",
        ),
        [
          ...commonChecks,
          validationCheck(
            "OPERATION_ID",
            false,
            "Operation ID must be unique.",
          ),
        ],
      );
    }

    let result: AIReservationResult;
    try {
      const transition = this.transition(request, commonChecks);
      result = this.applied(request, transition, commonChecks);
    } catch (error: unknown) {
      const failure =
        error instanceof ReservationFailure
          ? error
          : new ReservationFailure(
              AIReservationErrorCategory.Unknown,
              "UNEXPECTED_ERROR",
              "Reservation operation failed unexpectedly.",
            );
      result = this.rejection(request, failure, commonChecks);
    }

    const operation: AIReservationOperation = {
      operationId: request.operationId,
      idempotencyKey: request.idempotencyKey,
      operationType: request.operationType,
      reservationId: request.reservationId,
      requestId: request.requestId,
      timestamp: request.timestamp,
      payloadFingerprint: fingerprint,
      result,
    };
    if (!this.repository.appendOperation(operation)) {
      return this.rejection(
        request,
        new ReservationFailure(
          AIReservationErrorCategory.RepositoryConflict,
          "OPERATION_APPEND",
          "Operation history could not be appended.",
          true,
        ),
        [
          ...commonChecks,
          validationCheck(
            "OPERATION_APPEND",
            false,
            "Operation history append conflicted.",
          ),
        ],
      );
    }
    return clone(result);
  }

  private transition(
    request: Readonly<AIReservationRequest>,
    checks: AIReservationValidationCheck[],
  ): TransitionResult {
    switch (request.operationType) {
      case AIReservationOperationType.Acquire:
        return this.acquire(request, checks);
      case AIReservationOperationType.Commit:
        return this.commit(request, checks);
      case AIReservationOperationType.Release:
        return this.release(request, checks);
      case AIReservationOperationType.Expire:
        return this.expire(request, checks);
      case AIReservationOperationType.Cancel:
      case AIReservationOperationType.Reject:
        return this.finalizePlan(request, checks);
    }
  }

  private validatePlan(
    request:
      | AIAcquireReservationRequest
      | AICancelReservationRequest
      | AIRejectReservationRequest,
    checks: AIReservationValidationCheck[],
  ): void {
    const { costDecision, reservationPlan: plan } = request;
    assertCondition(
      checks,
      request.expectedVersion === 0,
      AIReservationErrorCategory.VersionConflict,
      "EXPECTED_VERSION",
      "Planning operations require expectedVersion 0.",
      false,
      0,
    );
    assertCondition(
      checks,
      APPROVED_COST_STATUSES.has(costDecision.status),
      AIReservationErrorCategory.CostNotApproved,
      "COST_DECISION_STATUS",
      "Cost Governor decision must authorize execution.",
    );
    assertCondition(
      checks,
      costDecision.reservation !== undefined,
      AIReservationErrorCategory.ReservationMissing,
      "COST_RESERVATION",
      "Approved Cost Governor decision must contain a reservation plan.",
    );
    assertCondition(
      checks,
      validAmount(plan.amount, false),
      AIReservationErrorCategory.AmountInvalid,
      "RESERVATION_AMOUNT",
      "Reservation amount must be a positive safe integer in minor units.",
    );
    assertCondition(
      checks,
      plan.status === BudgetReservationStatus.Planned,
      AIReservationErrorCategory.ReservationMismatch,
      "RESERVATION_PLAN_STATE",
      "Cost Governor reservation must be in PLANNED state.",
    );
    assertCondition(
      checks,
      plan.reservationId === request.reservationId &&
        plan.requestId === request.requestId &&
        costDecision.requestId === request.requestId,
      AIReservationErrorCategory.ReservationMismatch,
      "RESERVATION_IDENTITY",
      "Reservation, request, and Cost Governor identities must match.",
    );
    assertCondition(
      checks,
      plan.policyVersion === request.policy.version &&
        costDecision.policyVersion === request.policy.version,
      AIReservationErrorCategory.ReservationMismatch,
      "POLICY_VERSION",
      "Reservation and Cost Governor policy versions must match the operation policy.",
    );
    assertCondition(
      checks,
      plan.amount.currency === costDecision.estimatedCost.currency &&
        plan.amount.currency === costDecision.reservation!.amount.currency,
      AIReservationErrorCategory.CurrencyMismatch,
      "COST_CURRENCY",
      "Reservation plan currency must match the approved cost currency.",
    );
    assertCondition(
      checks,
      plan.amount.minorUnits === costDecision.estimatedCost.minorUnits &&
        plan.amount.minorUnits === costDecision.reservation!.amount.minorUnits,
      AIReservationErrorCategory.ReservationMismatch,
      "COST_AMOUNT",
      "Reservation plan amount must match the approved cost estimate.",
    );
    assertCondition(
      checks,
      canonicalize(plan) === canonicalize(costDecision.reservation),
      AIReservationErrorCategory.ReservationMismatch,
      "COST_RESERVATION_MATCH",
      "Supplied reservation plan must exactly match the Cost Governor plan.",
    );
    assertCondition(
      checks,
      Number.isFinite(Date.parse(plan.createdAt)) &&
        (plan.expiresAt === undefined ||
          (Number.isFinite(Date.parse(plan.expiresAt)) &&
            Date.parse(plan.expiresAt) > Date.parse(plan.createdAt))),
      AIReservationErrorCategory.InvalidRequest,
      "RESERVATION_TIMESTAMPS",
      "Reservation timestamps must be valid and expiration must follow creation.",
    );
  }

  private acquire(
    request: Readonly<AIAcquireReservationRequest>,
    checks: AIReservationValidationCheck[],
  ): TransitionResult {
    this.validatePlan(request, checks);
    assertCondition(
      checks,
      this.repository.getById(request.reservationId) === undefined,
      AIReservationErrorCategory.DuplicateReservation,
      "RESERVATION_UNIQUENESS",
      "Reservation ID already exists.",
    );
    assertCondition(
      checks,
      this.repository.getByRequestId(request.requestId).length === 0,
      AIReservationErrorCategory.DuplicateReservation,
      "REQUEST_RESERVATION_UNIQUENESS",
      "Request already has a reservation record.",
    );
    const plan = request.reservationPlan;
    const record: AIReservationRecord = {
      reservationId: request.reservationId,
      requestId: request.requestId,
      costGovernorDecisionId: request.costDecision.decisionId,
      state: AIReservationState.Reserved,
      version: 1,
      reservedAmount: clone(plan.amount),
      committedAmount: { minorUnits: 0, currency: plan.amount.currency },
      releasedAmount: { minorUnits: 0, currency: plan.amount.currency },
      remainingAmount: clone(plan.amount),
      createdAt: plan.createdAt,
      updatedAt: request.timestamp,
      ...(plan.expiresAt === undefined ? {} : { expiresAt: plan.expiresAt }),
      policyVersion: request.policy.version,
      committedExecutionIds: [],
    };
    assertCondition(
      checks,
      this.repository.create(record),
      AIReservationErrorCategory.RepositoryConflict,
      "REPOSITORY_CREATE",
      "Reservation record could not be created atomically.",
      true,
    );
    return {
      record,
      stateBefore: AIReservationState.Planned,
      versionBefore: 0,
      instructionType: AIReservationLedgerInstructionType.ReservationAcquired,
      instructionAmount: clone(plan.amount),
      reasons: ["Approved Cost Governor plan was reserved exactly once."],
    };
  }

  private finalizePlan(
    request: Readonly<AICancelReservationRequest | AIRejectReservationRequest>,
    checks: AIReservationValidationCheck[],
  ): TransitionResult {
    this.validatePlan(request, checks);
    assertCondition(
      checks,
      this.repository.getById(request.reservationId) === undefined &&
        this.repository.getByRequestId(request.requestId).length === 0,
      AIReservationErrorCategory.DuplicateReservation,
      "PLANNING_RECORD_UNIQUENESS",
      "Planning outcome cannot replace an existing reservation record.",
    );
    const cancelled = terminalPlanningRequest(request);
    const state = cancelled
      ? AIReservationState.Cancelled
      : AIReservationState.Rejected;
    const instructionType = cancelled
      ? AIReservationLedgerInstructionType.ReservationCancelled
      : AIReservationLedgerInstructionType.ReservationRejected;
    const plan = request.reservationPlan;
    const record: AIReservationRecord = {
      reservationId: request.reservationId,
      requestId: request.requestId,
      costGovernorDecisionId: request.costDecision.decisionId,
      state,
      version: 1,
      reservedAmount: clone(plan.amount),
      committedAmount: { minorUnits: 0, currency: plan.amount.currency },
      releasedAmount: clone(plan.amount),
      remainingAmount: { minorUnits: 0, currency: plan.amount.currency },
      createdAt: plan.createdAt,
      updatedAt: request.timestamp,
      ...(plan.expiresAt === undefined ? {} : { expiresAt: plan.expiresAt }),
      policyVersion: request.policy.version,
      committedExecutionIds: [],
    };
    assertCondition(
      checks,
      this.repository.create(record),
      AIReservationErrorCategory.RepositoryConflict,
      "REPOSITORY_CREATE",
      "Planning outcome record could not be created atomically.",
      true,
    );
    return {
      record,
      stateBefore: AIReservationState.Planned,
      versionBefore: 0,
      instructionType,
      instructionAmount: clone(plan.amount),
      reasons: [
        cancelled
          ? "Reservation plan was cancelled before acquisition."
          : "Reservation plan was explicitly rejected before acquisition.",
      ],
    };
  }

  private activeRecord(
    request:
      | AICommitReservationRequest
      | AIReleaseReservationRequest
      | AIExpireReservationRequest,
    checks: AIReservationValidationCheck[],
  ): AIReservationRecord {
    const record = this.repository.getById(request.reservationId);
    assertCondition(
      checks,
      record !== undefined,
      AIReservationErrorCategory.ReservationNotFound,
      "RESERVATION_EXISTS",
      "Reservation record was not found.",
    );
    assertCondition(
      checks,
      record.requestId === request.requestId,
      AIReservationErrorCategory.ReservationMismatch,
      "REQUEST_IDENTITY",
      "Operation request ID does not match the reservation record.",
    );
    assertCondition(
      checks,
      record.policyVersion === request.policy.version,
      AIReservationErrorCategory.ReservationMismatch,
      "POLICY_VERSION",
      "Operation policy version does not match the reservation record.",
    );
    assertCondition(
      checks,
      record.version === request.expectedVersion,
      AIReservationErrorCategory.VersionConflict,
      "EXPECTED_VERSION",
      "Expected reservation version does not match the current version.",
      true,
      record.version,
    );
    assertCondition(
      checks,
      record.state === AIReservationState.Reserved ||
        record.state === AIReservationState.PartiallyCommitted,
      AIReservationErrorCategory.InvalidStateTransition,
      "ACTIVE_STATE",
      "Operation requires a RESERVED or PARTIALLY_COMMITTED reservation.",
    );
    return record;
  }

  private commit(
    request: Readonly<AICommitReservationRequest>,
    checks: AIReservationValidationCheck[],
  ): TransitionResult {
    const record = this.activeRecord(request, checks);
    assertCondition(
      checks,
      validAmount(request.actualUsage, false),
      AIReservationErrorCategory.AmountInvalid,
      "ACTUAL_USAGE_AMOUNT",
      "Actual usage must be a positive safe integer in minor units.",
    );
    assertCondition(
      checks,
      request.actualUsage.currency === record.reservedAmount.currency,
      AIReservationErrorCategory.CurrencyMismatch,
      "ACTUAL_USAGE_CURRENCY",
      "Actual usage currency must match the reservation currency.",
    );
    assertCondition(
      checks,
      record.expiresAt === undefined ||
        Date.parse(request.timestamp) < Date.parse(record.expiresAt) ||
        request.policy.expiration.allowCommitAfterExpiration,
      AIReservationErrorCategory.ReservationExpired,
      "COMMIT_EXPIRATION",
      "Expired reservation cannot accept usage under the active policy.",
    );
    assertCondition(
      checks,
      request.actualUsage.minorUnits <= record.remainingAmount.minorUnits,
      AIReservationErrorCategory.AmountExceedsReservation,
      "REMAINING_AMOUNT",
      "Actual usage cannot exceed the uncommitted reservation amount.",
    );
    const isPartial =
      request.actualUsage.minorUnits < record.remainingAmount.minorUnits;
    assertCondition(
      checks,
      !isPartial || request.policy.allowPartialCommit,
      AIReservationErrorCategory.InvalidStateTransition,
      "PARTIAL_COMMIT_POLICY",
      "Partial commit is disabled by policy.",
    );
    assertCondition(
      checks,
      !record.committedExecutionIds.includes(request.executionId),
      AIReservationErrorCategory.ExecutionReferenceMismatch,
      "EXECUTION_REFERENCE",
      "Execution ID has already committed usage for this reservation.",
    );
    const committedMinorUnits =
      record.committedAmount.minorUnits + request.actualUsage.minorUnits;
    const remainingMinorUnits =
      record.remainingAmount.minorUnits - request.actualUsage.minorUnits;
    assertCondition(
      checks,
      Number.isSafeInteger(committedMinorUnits) &&
        Number.isSafeInteger(remainingMinorUnits),
      AIReservationErrorCategory.AmountInvalid,
      "SAFE_INTEGER_ARITHMETIC",
      "Reservation arithmetic must remain within safe integer range.",
    );
    const next: AIReservationRecord = {
      ...record,
      state:
        remainingMinorUnits === 0
          ? AIReservationState.Committed
          : AIReservationState.PartiallyCommitted,
      version: record.version + 1,
      committedAmount: {
        minorUnits: committedMinorUnits,
        currency: record.reservedAmount.currency,
      },
      remainingAmount: {
        minorUnits: remainingMinorUnits,
        currency: record.reservedAmount.currency,
      },
      updatedAt: request.timestamp,
      committedExecutionIds: [
        ...record.committedExecutionIds,
        request.executionId,
      ],
    };
    this.cas(request, record, next, checks);
    return {
      record: next,
      stateBefore: record.state,
      versionBefore: record.version,
      instructionType:
        next.state === AIReservationState.Committed
          ? AIReservationLedgerInstructionType.UsageCommitted
          : AIReservationLedgerInstructionType.UsagePartiallyCommitted,
      instructionAmount: clone(request.actualUsage),
      executionId: request.executionId,
      reasons: [
        next.state === AIReservationState.Committed
          ? "Actual usage fully consumed the remaining reservation."
          : "Actual usage was committed and unused budget remains reserved.",
      ],
    };
  }

  private release(
    request: Readonly<AIReleaseReservationRequest>,
    checks: AIReservationValidationCheck[],
  ): TransitionResult {
    const record = this.activeRecord(request, checks);
    assertCondition(
      checks,
      record.state !== AIReservationState.PartiallyCommitted ||
        (request.executionId !== undefined &&
          record.committedExecutionIds.includes(request.executionId)),
      AIReservationErrorCategory.ExecutionReferenceMismatch,
      "EXECUTION_REFERENCE",
      "Releasing a partially committed reservation requires its execution ID.",
    );
    const releasedMinorUnits =
      record.releasedAmount.minorUnits + record.remainingAmount.minorUnits;
    assertCondition(
      checks,
      Number.isSafeInteger(releasedMinorUnits),
      AIReservationErrorCategory.AmountInvalid,
      "SAFE_INTEGER_ARITHMETIC",
      "Reservation arithmetic must remain within safe integer range.",
    );
    const releasedNow = clone(record.remainingAmount);
    const next: AIReservationRecord = {
      ...record,
      state: AIReservationState.Released,
      version: record.version + 1,
      releasedAmount: {
        minorUnits: releasedMinorUnits,
        currency: record.reservedAmount.currency,
      },
      remainingAmount: {
        minorUnits: 0,
        currency: record.reservedAmount.currency,
      },
      updatedAt: request.timestamp,
    };
    this.cas(request, record, next, checks);
    return {
      record: next,
      stateBefore: record.state,
      versionBefore: record.version,
      instructionType: AIReservationLedgerInstructionType.ReservationReleased,
      instructionAmount: releasedNow,
      ...(request.executionId === undefined
        ? {}
        : { executionId: request.executionId }),
      reasons: ["All unused reserved budget was released."],
    };
  }

  private expire(
    request: Readonly<AIExpireReservationRequest>,
    checks: AIReservationValidationCheck[],
  ): TransitionResult {
    const record = this.activeRecord(request, checks);
    const naturallyExpired =
      record.expiresAt !== undefined &&
      Date.parse(request.timestamp) >= Date.parse(record.expiresAt);
    assertCondition(
      checks,
      naturallyExpired ||
        (request.administrative &&
          request.policy.expiration.allowAdministrativeEarlyExpiration),
      AIReservationErrorCategory.NotExpired,
      "EXPIRATION_ELIGIBILITY",
      "Reservation is not expired and administrative early expiration is not allowed.",
    );
    const releasedMinorUnits =
      record.releasedAmount.minorUnits + record.remainingAmount.minorUnits;
    const expiredNow = clone(record.remainingAmount);
    const next: AIReservationRecord = {
      ...record,
      state: AIReservationState.Expired,
      version: record.version + 1,
      releasedAmount: {
        minorUnits: releasedMinorUnits,
        currency: record.reservedAmount.currency,
      },
      remainingAmount: {
        minorUnits: 0,
        currency: record.reservedAmount.currency,
      },
      updatedAt: request.timestamp,
    };
    this.cas(request, record, next, checks);
    return {
      record: next,
      stateBefore: record.state,
      versionBefore: record.version,
      instructionType: AIReservationLedgerInstructionType.ReservationExpired,
      instructionAmount: expiredNow,
      reasons: ["Expired reservation released all unused budget."],
    };
  }

  private cas(
    request: Readonly<AIReservationRequest>,
    current: AIReservationRecord,
    next: AIReservationRecord,
    checks: AIReservationValidationCheck[],
  ): void {
    const result = this.repository.compareAndSet(
      request.reservationId,
      request.expectedVersion,
      next,
    );
    assertCondition(
      checks,
      result.updated,
      AIReservationErrorCategory.VersionConflict,
      "COMPARE_AND_SET",
      "Reservation changed before the operation could be applied.",
      true,
      result.current?.version ?? current.version,
    );
  }

  private applied(
    request: Readonly<AIReservationRequest>,
    transition: TransitionResult,
    checks: ReadonlyArray<AIReservationValidationCheck>,
  ): AIReservationResult {
    const instruction: AIReservationLedgerInstruction = {
      instructionId: `${request.operationId}:ledger`,
      type: transition.instructionType,
      reservationId: request.reservationId,
      requestId: request.requestId,
      ...(transition.executionId === undefined
        ? {}
        : { executionId: transition.executionId }),
      operationId: request.operationId,
      idempotencyKey: request.idempotencyKey,
      amount: clone(transition.instructionAmount),
      stateBefore: transition.stateBefore,
      stateAfter: transition.record.state,
      timestamp: request.timestamp,
      policyVersion: request.policy.version,
      reason: request.reason,
      resultingVersion: transition.record.version,
    };
    const audit = this.audit(
      request,
      transition.record,
      transition.stateBefore,
      transition.versionBefore,
      checks,
      transition.reasons,
      undefined,
      instruction.instructionId,
    );
    return {
      status: AIReservationResultStatus.Applied,
      operationId: request.operationId,
      reservationId: request.reservationId,
      reasons: transition.reasons,
      record: clone(transition.record),
      ledgerInstruction: instruction,
      auditRecord: audit,
    };
  }

  private rejection(
    request: Readonly<AIReservationRequest>,
    failure: ReservationFailure,
    checks: ReadonlyArray<AIReservationValidationCheck>,
  ): AIReservationResult {
    const current = this.repository.getById(request.reservationId);
    const error: AIReservationError = {
      category: failure.category,
      code: failure.category,
      safeMessage: failure.message,
      retryable: failure.retryable,
      occurredAt: request.timestamp,
      ...(failure.currentVersion === undefined
        ? {}
        : { currentVersion: failure.currentVersion }),
    };
    const completeChecks = checks.some(
      (check) =>
        check.name === failure.checkName &&
        check.status === AIReservationValidationStatus.Failed,
    )
      ? checks
      : [
          ...checks,
          validationCheck(failure.checkName, false, failure.message),
        ];
    const audit = this.audit(
      request,
      current,
      current?.state ?? null,
      current?.version ?? null,
      completeChecks,
      [failure.message],
      error,
    );
    return {
      status: AIReservationResultStatus.Rejected,
      operationId: request.operationId,
      reservationId: request.reservationId,
      reasons: [failure.message],
      ...(current === undefined ? {} : { record: current }),
      auditRecord: audit,
      error,
    };
  }

  private audit(
    request: Readonly<AIReservationRequest>,
    record: AIReservationRecord | undefined,
    stateBefore: AIReservationState | null,
    versionBefore: number | null,
    checks: ReadonlyArray<AIReservationValidationCheck>,
    reasons: ReadonlyArray<string>,
    error?: AIReservationError,
    ledgerInstructionId?: string,
  ): AIReservationAuditRecord {
    const plan =
      request.operationType === AIReservationOperationType.Acquire ||
      request.operationType === AIReservationOperationType.Cancel ||
      request.operationType === AIReservationOperationType.Reject
        ? request.reservationPlan
        : undefined;
    const currency = record?.reservedAmount.currency ?? plan?.amount.currency ?? "UNKNOWN";
    const reserved = record?.reservedAmount.minorUnits ?? plan?.amount.minorUnits ?? 0;
    const expiresAt = record?.expiresAt ?? plan?.expiresAt;
    return {
      auditId: `${request.operationId}:audit`,
      reservationId: request.reservationId,
      requestId: request.requestId,
      operationId: request.operationId,
      operationType: request.operationType,
      timestamp: request.timestamp,
      idempotencyKey: request.idempotencyKey,
      policyVersion: request.policy.version,
      stateBefore,
      stateAfter: record?.state ?? null,
      versionBefore,
      versionAfter: record?.version ?? null,
      reservedAmount: record?.reservedAmount ?? {
        minorUnits: Number.isSafeInteger(reserved) ? reserved : 0,
        currency,
      },
      committedAmount: record?.committedAmount ?? { minorUnits: 0, currency },
      releasedAmount: record?.releasedAmount ?? { minorUnits: 0, currency },
      remainingAmount: record?.remainingAmount ?? {
        minorUnits: Number.isSafeInteger(reserved) ? reserved : 0,
        currency,
      },
      ...(expiresAt === undefined ? {} : { expiresAt }),
      validationChecks: clone(checks),
      decisionReasons: clone(reasons),
      ...(error === undefined ? {} : { error }),
      ...(ledgerInstructionId === undefined ? {} : { ledgerInstructionId }),
      finalResult:
        error === undefined
          ? AIReservationResultStatus.Applied
          : AIReservationResultStatus.Rejected,
    };
  }
}
