import {
  AICostLedgerAppendStatus,
  AICostLedgerAuditOperationType,
  AICostLedgerBusinessOrderStatus,
  AICostLedgerEntryType,
  AICostLedgerErrorCategory,
  AICostLedgerReconciliationIssueCode,
  AICostLedgerReconciliationStatus,
  AICostLedgerSourceSubsystem,
  AICostLedgerValidationStatus,
  AIReservationLedgerInstructionType,
  AIReservationState,
  canonicalizeAICostLedgerValue,
  validateAICostLedgerEntryInput,
  validateAICostLedgerPolicy,
  validateAICostLedgerQuery,
  type AICostLedger,
  type AICostLedgerAppendRequest,
  type AICostLedgerAppendResult,
  type AICostLedgerAuditRecord,
  type AICostLedgerBalance,
  type AICostLedgerEntry,
  type AICostLedgerEntryInput,
  type AICostLedgerError,
  type AICostLedgerQuery,
  type AICostLedgerQueryResult,
  type AICostLedgerReconciliationIssue,
  type AICostLedgerReconciliationResult,
  type AICostLedgerRepository,
  type AICostLedgerReservationInstructionContext,
  type AICostLedgerUsageBucket,
  type AICostLedgerUsageSummary,
  type AICostLedgerValidationCheck,
  type AIReservationLedgerInstruction,
} from "../../contracts";

class LedgerFailure extends Error {
  constructor(
    readonly category: AICostLedgerErrorCategory,
    readonly checkName: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function check(
  name: string,
  passed: boolean,
  reason: string,
): AICostLedgerValidationCheck {
  return {
    name,
    status: passed
      ? AICostLedgerValidationStatus.Passed
      : AICostLedgerValidationStatus.Failed,
    reason,
  };
}

function assertCondition(
  checks: AICostLedgerValidationCheck[],
  condition: boolean,
  category: AICostLedgerErrorCategory,
  name: string,
  message: string,
  retryable = false,
): asserts condition {
  checks.push(check(name, condition, message));
  if (!condition) throw new LedgerFailure(category, name, message, retryable);
}

function checkedAdd(left: number, right: number): number {
  const value = left + right;
  if (!Number.isSafeInteger(value)) {
    throw new Error("Cost Ledger aggregation exceeded safe integer range.");
  }
  return value;
}

function isUsage(type: AICostLedgerEntryType): boolean {
  return [
    AICostLedgerEntryType.UsagePartiallyCommitted,
    AICostLedgerEntryType.UsageCommitted,
  ].includes(type);
}

function isReservationLifecycle(type: AICostLedgerEntryType): boolean {
  return ![
    AICostLedgerEntryType.CriticalOverrideUsed,
    AICostLedgerEntryType.ManualAdjustment,
  ].includes(type);
}

function isTerminalState(state: AIReservationState | undefined): boolean {
  return (
    state !== undefined &&
    [
      AIReservationState.Committed,
      AIReservationState.Released,
      AIReservationState.Expired,
      AIReservationState.Cancelled,
      AIReservationState.Rejected,
    ].includes(state)
  );
}

function balanceTemplate(currency: string): AICostLedgerBalance {
  return {
    currency,
    acquiredMinorUnits: 0,
    committedMinorUnits: 0,
    releasedMinorUnits: 0,
    expiredMinorUnits: 0,
    cancelledMinorUnits: 0,
    rejectedMinorUnits: 0,
    overrideMinorUnits: 0,
    manualAdjustmentMinorUnits: 0,
  };
}

function balancesForEntries(
  entries: ReadonlyArray<AICostLedgerEntry>,
): ReadonlyArray<AICostLedgerBalance> {
  const balances = new Map<string, AICostLedgerBalance>();
  for (const entry of entries) {
    const current = balances.get(entry.amount.currency) ??
      balanceTemplate(entry.amount.currency);
    const amount = entry.amount.minorUnits;
    let next = current;
    switch (entry.entryType) {
      case AICostLedgerEntryType.ReservationAcquired:
        next = {
          ...current,
          acquiredMinorUnits: checkedAdd(current.acquiredMinorUnits, amount),
        };
        break;
      case AICostLedgerEntryType.UsagePartiallyCommitted:
      case AICostLedgerEntryType.UsageCommitted:
        next = {
          ...current,
          committedMinorUnits: checkedAdd(current.committedMinorUnits, amount),
        };
        break;
      case AICostLedgerEntryType.ReservationReleased:
        next = {
          ...current,
          releasedMinorUnits: checkedAdd(current.releasedMinorUnits, amount),
        };
        break;
      case AICostLedgerEntryType.ReservationExpired:
        next = {
          ...current,
          expiredMinorUnits: checkedAdd(current.expiredMinorUnits, amount),
        };
        break;
      case AICostLedgerEntryType.ReservationCancelled:
        next = {
          ...current,
          cancelledMinorUnits: checkedAdd(current.cancelledMinorUnits, amount),
        };
        break;
      case AICostLedgerEntryType.ReservationRejected:
        next = {
          ...current,
          rejectedMinorUnits: checkedAdd(current.rejectedMinorUnits, amount),
        };
        break;
      case AICostLedgerEntryType.CriticalOverrideUsed:
        next = {
          ...current,
          overrideMinorUnits: checkedAdd(current.overrideMinorUnits, amount),
        };
        break;
      case AICostLedgerEntryType.ManualAdjustment:
        next = {
          ...current,
          manualAdjustmentMinorUnits: checkedAdd(
            current.manualAdjustmentMinorUnits,
            entry.manualAdjustment?.deltaMinorUnits ?? 0,
          ),
        };
        break;
    }
    balances.set(entry.amount.currency, next);
  }
  return [...balances.values()].sort((left, right) =>
    left.currency.localeCompare(right.currency),
  );
}

function bucketize(
  entries: ReadonlyArray<AICostLedgerEntry>,
  key: (entry: AICostLedgerEntry) => string | undefined,
): ReadonlyArray<AICostLedgerUsageBucket> {
  const buckets = new Map<string, AICostLedgerUsageBucket>();
  for (const entry of entries.filter((candidate) => isUsage(candidate.entryType))) {
    const value = key(entry);
    if (value === undefined) continue;
    const mapKey = `${value}\u0000${entry.amount.currency}`;
    const current = buckets.get(mapKey);
    buckets.set(mapKey, {
      key: value,
      currency: entry.amount.currency,
      committedMinorUnits: checkedAdd(
        current?.committedMinorUnits ?? 0,
        entry.amount.minorUnits,
      ),
    });
  }
  return [...buckets.values()].sort(
    (left, right) =>
      left.key.localeCompare(right.key) ||
      left.currency.localeCompare(right.currency),
  );
}

export class DeterministicAICostLedger implements AICostLedger {
  constructor(private readonly repository: AICostLedgerRepository) {}

  append(request: Readonly<AICostLedgerAppendRequest>): AICostLedgerAppendResult {
    const checks: AICostLedgerValidationCheck[] = [];
    const fingerprint = canonicalizeAICostLedgerValue(request);

    try {
      validateAICostLedgerPolicy(request.policy);
      checks.push(check("POLICY", true, "Cost Ledger policy is valid."));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      checks.push(check("POLICY", false, message));
      return this.rejected(
        request,
        new LedgerFailure(
          AICostLedgerErrorCategory.InvalidPolicy,
          "POLICY",
          message,
        ),
        checks,
      );
    }

    try {
      validateAICostLedgerEntryInput(request.entry, request.policy);
      checks.push(check("ENTRY_CONTRACT", true, "Ledger entry contract is valid."));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      checks.push(check("ENTRY_CONTRACT", false, message));
      const category = message.includes("manualAdjustment")
        ? AICostLedgerErrorCategory.ManualAdjustmentNotAllowed
        : message.includes("amount")
          ? AICostLedgerErrorCategory.InvalidAmount
          : AICostLedgerErrorCategory.InvalidRequest;
      return this.rejected(
        request,
        new LedgerFailure(category, "ENTRY_CONTRACT", message),
        checks,
      );
    }

    const replay = this.repository.getByIdempotencyKey(
      request.entry.idempotencyKey,
    );
    if (replay !== undefined) {
      if (replay.payloadFingerprint === fingerprint) {
        return this.replayed(request, replay, checks);
      }
      return this.rejected(
        request,
        new LedgerFailure(
          AICostLedgerErrorCategory.IdempotencyConflict,
          "IDEMPOTENCY",
          "Idempotency key was already used with a different append payload.",
        ),
        [
          ...checks,
          check("IDEMPOTENCY", false, "Idempotency payload conflict."),
        ],
        "CONFLICT",
      );
    }

    try {
      assertCondition(
        checks,
        this.repository.getById(request.entry.entryId) === undefined,
        AICostLedgerErrorCategory.DuplicateEntry,
        "ENTRY_ID_UNIQUENESS",
        "Ledger entry ID already exists.",
      );
      assertCondition(
        checks,
        this.repository.getBySourceOperationId(request.entry.operationId) ===
          undefined,
        AICostLedgerErrorCategory.DuplicateOperation,
        "OPERATION_ID_UNIQUENESS",
        "Source operation ID already exists.",
      );
      if (
        isUsage(request.entry.entryType) &&
        request.entry.executionId !== undefined
      ) {
        assertCondition(
          checks,
          this.repository.listByExecutionId(request.entry.executionId).every(
            (entry) => !isUsage(entry.entryType),
          ),
          AICostLedgerErrorCategory.DuplicateExecutionSettlement,
          "EXECUTION_SETTLEMENT_UNIQUENESS",
          "Execution usage was already recorded.",
        );
      }

      const reservationEntries =
        request.entry.reservationId === undefined
          ? []
          : this.repository.listByReservationId(request.entry.reservationId);
      const existingCurrency = reservationEntries[0]?.amount.currency;
      assertCondition(
        checks,
        existingCurrency === undefined ||
          existingCurrency === request.entry.amount.currency,
        AICostLedgerErrorCategory.CurrencyMismatch,
        "RESERVATION_CURRENCY",
        "Reservation ledger entries must use one currency.",
      );
      const latestReservationEntry = reservationEntries.at(-1);
      assertCondition(
        checks,
        !isReservationLifecycle(request.entry.entryType) ||
          !isTerminalState(latestReservationEntry?.reservationStateAfter),
        AICostLedgerErrorCategory.DuplicateReservationSettlement,
        "RESERVATION_TERMINAL_UNIQUENESS",
        "Reservation already has a terminal settlement entry.",
      );
      const outOfOrder =
        latestReservationEntry !== undefined &&
        Date.parse(request.entry.timestamp) <
          Date.parse(latestReservationEntry.timestamp);
      assertCondition(
        checks,
        !outOfOrder || request.policy.allowOutOfOrderEvents,
        AICostLedgerErrorCategory.OutOfOrderEvent,
        "BUSINESS_EVENT_ORDER",
        "Business event timestamp is older than the latest reservation event.",
      );
      const businessOrderStatus = outOfOrder
        ? AICostLedgerBusinessOrderStatus.OutOfOrderAllowed
        : AICostLedgerBusinessOrderStatus.InOrder;

      const append = this.repository.appendAtomically({
        entry: request.entry,
        businessOrderStatus,
        payloadFingerprint: fingerprint,
      });
      if (!append.appended || append.entry === undefined) {
        return this.rejected(
          request,
          new LedgerFailure(
            append.conflictCategory ??
              AICostLedgerErrorCategory.RepositoryConflict,
            "ATOMIC_APPEND",
            "Repository rejected the atomic ledger append.",
            true,
          ),
          [
            ...checks,
            check("ATOMIC_APPEND", false, "Atomic append conflicted."),
          ],
        );
      }
      checks.push(check("ATOMIC_APPEND", true, "Entry appended atomically."));
      return this.appended(request, append.entry, checks);
    } catch (error: unknown) {
      const failure =
        error instanceof LedgerFailure
          ? error
          : new LedgerFailure(
              AICostLedgerErrorCategory.Unknown,
              "UNEXPECTED_ERROR",
              "Cost Ledger append failed unexpectedly.",
            );
      return this.rejected(request, failure, checks);
    }
  }

  query(query: Readonly<AICostLedgerQuery> = {}): AICostLedgerQueryResult {
    validateAICostLedgerQuery(query);
    const entries = this.repository.allEntries().filter((entry) => {
      if (query.fromSequence !== undefined && entry.sequence < query.fromSequence) return false;
      if (query.toSequence !== undefined && entry.sequence > query.toSequence) return false;
      if (query.requestId !== undefined && entry.requestId !== query.requestId) return false;
      if (query.reservationId !== undefined && entry.reservationId !== query.reservationId) return false;
      if (query.executionId !== undefined && entry.executionId !== query.executionId) return false;
      if (query.fromTimestamp !== undefined && Date.parse(entry.timestamp) < Date.parse(query.fromTimestamp)) return false;
      if (query.toTimestamp !== undefined && Date.parse(entry.timestamp) > Date.parse(query.toTimestamp)) return false;
      if (query.providerId !== undefined && entry.providerId !== query.providerId) return false;
      if (query.modelId !== undefined && entry.modelId !== query.modelId) return false;
      if (query.taskType !== undefined && entry.taskType !== query.taskType) return false;
      if (query.currency !== undefined && entry.amount.currency !== query.currency) return false;
      if (query.entryTypes !== undefined && !query.entryTypes.includes(entry.entryType)) return false;
      return true;
    });
    return {
      entries: clone(entries),
      count: entries.length,
      latestSequence: this.repository.latestSequence(),
    };
  }

  summarize(query: Readonly<AICostLedgerQuery> = {}): AICostLedgerUsageSummary {
    const entries = this.query(query).entries;
    return {
      balances: balancesForEntries(entries),
      byDay: bucketize(entries, (entry) => entry.timestamp.slice(0, 10)),
      byMonth: bucketize(entries, (entry) => entry.timestamp.slice(0, 7)),
      byTaskType: bucketize(entries, (entry) => entry.taskType),
      byProvider: bucketize(entries, (entry) => entry.providerId),
      byModel: bucketize(entries, (entry) => entry.modelId),
      byRequest: bucketize(entries, (entry) => entry.requestId),
      byReservation: bucketize(entries, (entry) => entry.reservationId),
      byExecution: bucketize(entries, (entry) => entry.executionId),
    };
  }

  listUnresolvedReservationIds(
    query: Readonly<AICostLedgerQuery> = {},
  ): ReadonlyArray<string> {
    const ids = new Set(
      this.query(query).entries
        .map((entry) => entry.reservationId)
        .filter((value): value is string => value !== undefined),
    );
    return [...ids]
      .filter((reservationId) => {
        const entries = this.repository.listByReservationId(reservationId);
        return !isTerminalState(entries.at(-1)?.reservationStateAfter);
      })
      .sort((left, right) => left.localeCompare(right));
  }

  reconcileReservation(
    reservationId: string,
    operationId: string,
    timestamp: string,
    policyVersion: string,
  ): AICostLedgerReconciliationResult {
    const entries = this.repository.listByReservationId(reservationId);
    const issues: AICostLedgerReconciliationIssue[] = [];
    let requestId: string | undefined;
    let currency: string | undefined;
    let governingPolicyVersion: string | undefined;
    let reserved = 0;
    let committed = 0;
    let released = 0;
    let state: AIReservationState | undefined;
    let acquired = false;
    let previousSequence = 0;
    const executionIds = new Set<string>();

    const issue = (
      code: AICostLedgerReconciliationIssueCode,
      entry: AICostLedgerEntry | undefined,
      reason: string,
    ): void => {
      issues.push({
        code,
        sequence: entry?.sequence ?? null,
        ...(entry === undefined ? {} : { entryId: entry.entryId }),
        reason,
      });
    };

    for (const entry of entries) {
      if (entry.sequence <= previousSequence) {
        issue(
          AICostLedgerReconciliationIssueCode.SequenceInconsistency,
          entry,
          "Reservation entries are not in strictly increasing ledger sequence.",
        );
      }
      previousSequence = entry.sequence;
      if (requestId === undefined) requestId = entry.requestId;
      else if (requestId !== entry.requestId) {
        issue(
          AICostLedgerReconciliationIssueCode.RequestMismatch,
          entry,
          "Reservation history contains conflicting request IDs.",
        );
      }
      if (currency === undefined) currency = entry.amount.currency;
      else if (currency !== entry.amount.currency) {
        issue(
          AICostLedgerReconciliationIssueCode.CurrencyMismatch,
          entry,
          "Reservation history contains multiple currencies.",
        );
      }
      if (governingPolicyVersion === undefined) governingPolicyVersion = entry.policyVersion;
      else if (governingPolicyVersion !== entry.policyVersion) {
        issue(
          AICostLedgerReconciliationIssueCode.PolicyVersionConflict,
          entry,
          "Reservation history contains conflicting policy versions.",
        );
      }
      if (
        state !== undefined &&
        entry.reservationStateBefore !== undefined &&
        state !== entry.reservationStateBefore
      ) {
        issue(
          AICostLedgerReconciliationIssueCode.InvalidTransitionOrder,
          entry,
          "Recorded state-before does not match the prior state-after.",
        );
      }

      switch (entry.entryType) {
        case AICostLedgerEntryType.ReservationAcquired:
          if (acquired) {
            issue(
              AICostLedgerReconciliationIssueCode.DuplicateAcquisition,
              entry,
              "Reservation was acquired more than once.",
            );
          }
          if (isTerminalState(state)) {
            issue(
              AICostLedgerReconciliationIssueCode.InvalidTransitionOrder,
              entry,
              "Terminal reservation cannot be acquired again.",
            );
          }
          acquired = true;
          reserved = checkedAdd(reserved, entry.amount.minorUnits);
          break;
        case AICostLedgerEntryType.UsagePartiallyCommitted:
        case AICostLedgerEntryType.UsageCommitted:
          if (!acquired) {
            issue(
              AICostLedgerReconciliationIssueCode.CommitWithoutAcquisition,
              entry,
              "Usage was committed without reservation acquisition.",
            );
          }
          if (isTerminalState(state)) {
            issue(
              AICostLedgerReconciliationIssueCode.DuplicateFullSettlement,
              entry,
              "Usage was recorded after terminal settlement.",
            );
          }
          if (entry.executionId !== undefined) {
            if (executionIds.has(entry.executionId)) {
              issue(
                AICostLedgerReconciliationIssueCode.DuplicateExecutionSettlement,
                entry,
                "Execution usage appears more than once.",
              );
            }
            executionIds.add(entry.executionId);
          }
          committed = checkedAdd(committed, entry.amount.minorUnits);
          if (committed > reserved) {
            issue(
              AICostLedgerReconciliationIssueCode.CommittedExceedsReserved,
              entry,
              "Committed usage exceeds acquired reservation.",
            );
          }
          break;
        case AICostLedgerEntryType.ReservationReleased:
          if (!acquired || ![
            AIReservationState.Reserved,
            AIReservationState.PartiallyCommitted,
          ].includes(state ?? AIReservationState.Planned)) {
            issue(
              AICostLedgerReconciliationIssueCode.ReleaseWithoutActiveReservation,
              entry,
              "Release does not follow an active acquired reservation.",
            );
          }
          if (isTerminalState(state)) {
            issue(
              AICostLedgerReconciliationIssueCode.DuplicateFullSettlement,
              entry,
              "Release follows terminal settlement.",
            );
          }
          released = checkedAdd(released, entry.amount.minorUnits);
          break;
        case AICostLedgerEntryType.ReservationExpired:
          if (!acquired) {
            issue(
              AICostLedgerReconciliationIssueCode.ExpirationWithoutAcquisition,
              entry,
              "Expiration does not follow acquisition.",
            );
          }
          if (isTerminalState(state)) {
            issue(
              AICostLedgerReconciliationIssueCode.DuplicateFullSettlement,
              entry,
              "Expiration follows terminal settlement.",
            );
          }
          released = checkedAdd(released, entry.amount.minorUnits);
          break;
        case AICostLedgerEntryType.ReservationCancelled:
        case AICostLedgerEntryType.ReservationRejected:
          if (acquired || state !== undefined) {
            issue(
              AICostLedgerReconciliationIssueCode.InvalidTransitionOrder,
              entry,
              "Planning terminal outcome follows an existing reservation state.",
            );
          }
          reserved = checkedAdd(reserved, entry.amount.minorUnits);
          released = checkedAdd(released, entry.amount.minorUnits);
          break;
        case AICostLedgerEntryType.CriticalOverrideUsed:
        case AICostLedgerEntryType.ManualAdjustment:
          break;
      }
      if (committed + released > reserved) {
        issue(
          AICostLedgerReconciliationIssueCode.SettlementExceedsReserved,
          entry,
          "Committed plus released amount exceeds acquired reservation.",
        );
      }
      if (entry.reservationStateAfter !== undefined) {
        state = entry.reservationStateAfter;
      }
    }

    if (
      entries.length > 0 &&
      [
        AIReservationState.Reserved,
        AIReservationState.PartiallyCommitted,
      ].includes(state ?? AIReservationState.Planned)
    ) {
      issue(
        AICostLedgerReconciliationIssueCode.MissingFinalSettlement,
        entries.at(-1),
        "Active reservation has no terminal settlement entry.",
      );
    }
    const remaining = Math.max(0, reserved - committed - released);
    const status =
      entries.length === 0
        ? AICostLedgerReconciliationStatus.NoEntries
        : issues.length === 0
          ? AICostLedgerReconciliationStatus.Reconciled
          : AICostLedgerReconciliationStatus.IssuesDetected;
    const audit: AICostLedgerAuditRecord = {
      auditId: `${operationId}:audit`,
      operationType: AICostLedgerAuditOperationType.Reconcile,
      operationId,
      timestamp,
      sourceSubsystem: AICostLedgerSourceSubsystem.ReservationManager,
      policyVersion,
      reservationId,
      validationChecks: [
        check(
          "RECONCILIATION",
          issues.length === 0,
          issues.length === 0
            ? "Reservation accounting reconciled without issues."
            : "Reservation accounting issues were detected.",
        ),
      ],
      idempotencyOutcome: "NOT_APPLICABLE",
      repositoryType: this.repository.repositoryType,
      resultingBalances: balancesForEntries(entries),
      reconciliationIssues: clone(issues),
      sourceAuditReferences: entries.map((entry) => entry.sourceAuditRecordId),
      finalResult: issues.length === 0 ? "RECONCILED" : "ISSUES",
    };
    return {
      status,
      reservationId,
      ...(requestId === undefined ? {} : { requestId }),
      ...(currency === undefined ? {} : { currency }),
      reservedMinorUnits: reserved,
      committedMinorUnits: committed,
      releasedMinorUnits: released,
      remainingMinorUnits: remaining,
      ...(state !== undefined && isTerminalState(state)
        ? { terminalState: state }
        : {}),
      issues,
      sourceEntryIds: entries.map((entry) => entry.entryId),
      auditRecord: audit,
    };
  }

  private appended(
    request: Readonly<AICostLedgerAppendRequest>,
    entry: AICostLedgerEntry,
    checks: ReadonlyArray<AICostLedgerValidationCheck>,
  ): AICostLedgerAppendResult {
    return {
      status: AICostLedgerAppendStatus.Appended,
      reasons: ["Ledger entry appended with a new monotonic sequence."],
      entry: clone(entry),
      auditRecord: this.appendAudit(request, entry),
    };
  }

  private replayed(
    request: Readonly<AICostLedgerAppendRequest>,
    entry: AICostLedgerEntry,
    checks: ReadonlyArray<AICostLedgerValidationCheck>,
  ): AICostLedgerAppendResult {
    return this.appended(request, entry, checks);
  }

  private appendAudit(
    request: Readonly<AICostLedgerAppendRequest>,
    entry: AICostLedgerEntry,
  ): AICostLedgerAuditRecord {
    const balances = balancesForEntries(
      this.repository.listBySequenceRange(1, entry.sequence),
    );
    return {
      auditId: `${entry.operationId}:cost-ledger:audit`,
      operationType: AICostLedgerAuditOperationType.Append,
      operationId: entry.operationId,
      timestamp: entry.timestamp,
      sourceSubsystem: entry.sourceSubsystem,
      policyVersion: request.policy.version,
      requestedEntryId: entry.entryId,
      ...(entry.reservationId === undefined
        ? {}
        : { reservationId: entry.reservationId }),
      validationChecks: [
        check("POLICY", true, "Cost Ledger policy is valid."),
        check("ENTRY_CONTRACT", true, "Ledger entry contract is valid."),
        check("IMMUTABLE_IDENTITIES", true, "Immutable identities were unique."),
        check("RESERVATION_CURRENCY", true, "Reservation currency was consistent."),
        check("BUSINESS_EVENT_ORDER", true, "Business event order satisfied policy."),
        check("ATOMIC_APPEND", true, "Entry appended atomically."),
      ],
      idempotencyOutcome: "NEW",
      assignedSequence: entry.sequence,
      appendStatus: AICostLedgerAppendStatus.Appended,
      repositoryType: this.repository.repositoryType,
      resultingBalances: balances,
      reconciliationIssues: [],
      sourceAuditReferences: [entry.sourceAuditRecordId],
      finalResult: "APPLIED",
    };
  }

  private rejected(
    request: Readonly<AICostLedgerAppendRequest>,
    failure: LedgerFailure,
    checks: ReadonlyArray<AICostLedgerValidationCheck>,
    outcome: "CONFLICT" | "NEW" = "NEW",
  ): AICostLedgerAppendResult {
    const error: AICostLedgerError = {
      category: failure.category,
      code: failure.category,
      safeMessage: failure.message,
      retryable: failure.retryable,
      occurredAt: request.entry.timestamp,
    };
    const finalChecks = checks.some(
      (candidate) =>
        candidate.name === failure.checkName &&
        candidate.status === AICostLedgerValidationStatus.Failed,
    )
      ? checks
      : [...checks, check(failure.checkName, false, failure.message)];
    return {
      status: AICostLedgerAppendStatus.Rejected,
      reasons: [failure.message],
      auditRecord: {
        auditId: `${request.entry.operationId}:cost-ledger:audit`,
        operationType: AICostLedgerAuditOperationType.Append,
        operationId: request.entry.operationId,
        timestamp: request.entry.timestamp,
        sourceSubsystem: request.entry.sourceSubsystem,
        policyVersion: request.policy.version,
        requestedEntryId: request.entry.entryId,
        ...(request.entry.reservationId === undefined
          ? {}
          : { reservationId: request.entry.reservationId }),
        validationChecks: clone(finalChecks),
        idempotencyOutcome: outcome,
        appendStatus: AICostLedgerAppendStatus.Rejected,
        repositoryType: this.repository.repositoryType,
        resultingBalances: balancesForEntries(this.repository.allEntries()),
        reconciliationIssues: [],
        sourceAuditReferences: [request.entry.sourceAuditRecordId],
        error,
        finalResult: "REJECTED",
      },
      error,
    };
  }
}

const INSTRUCTION_TYPE_MAP: Readonly<
  Record<AIReservationLedgerInstructionType, AICostLedgerEntryType>
> = {
  [AIReservationLedgerInstructionType.ReservationAcquired]:
    AICostLedgerEntryType.ReservationAcquired,
  [AIReservationLedgerInstructionType.UsagePartiallyCommitted]:
    AICostLedgerEntryType.UsagePartiallyCommitted,
  [AIReservationLedgerInstructionType.UsageCommitted]:
    AICostLedgerEntryType.UsageCommitted,
  [AIReservationLedgerInstructionType.ReservationReleased]:
    AICostLedgerEntryType.ReservationReleased,
  [AIReservationLedgerInstructionType.ReservationExpired]:
    AICostLedgerEntryType.ReservationExpired,
  [AIReservationLedgerInstructionType.ReservationCancelled]:
    AICostLedgerEntryType.ReservationCancelled,
  [AIReservationLedgerInstructionType.ReservationRejected]:
    AICostLedgerEntryType.ReservationRejected,
};

export function costLedgerEntryFromReservationInstruction(
  instruction: Readonly<AIReservationLedgerInstruction>,
  context: Readonly<AICostLedgerReservationInstructionContext>,
): AICostLedgerEntryInput {
  return {
    schemaVersion: "1.0",
    integrityVersion: "1.0",
    entryId: context.entryId,
    requestId: instruction.requestId,
    reservationId: instruction.reservationId,
    ...(instruction.executionId === undefined
      ? {}
      : { executionId: instruction.executionId }),
    operationId: instruction.operationId,
    idempotencyKey: instruction.idempotencyKey,
    entryType: INSTRUCTION_TYPE_MAP[instruction.type],
    amount: clone(instruction.amount),
    timestamp: instruction.timestamp,
    policyVersion: instruction.policyVersion,
    reservationStateBefore: instruction.stateBefore,
    reservationStateAfter: instruction.stateAfter,
    reservationVersion: instruction.resultingVersion,
    ...(context.providerId === undefined ? {} : { providerId: context.providerId }),
    ...(context.modelId === undefined ? {} : { modelId: context.modelId }),
    ...(context.taskType === undefined ? {} : { taskType: context.taskType }),
    reasonCode: instruction.type,
    sourceSubsystem: AICostLedgerSourceSubsystem.ReservationManager,
    sourceAuditRecordId: context.sourceAuditRecordId,
    correlationId: context.correlationId,
    ...(context.traceId === undefined ? {} : { traceId: context.traceId }),
    metadata: clone(context.metadata ?? {}),
  };
}
