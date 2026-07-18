import type { AITaskType, ReasoningLevel } from "./AIRouter";

export enum BudgetScope {
  PerRequest = "PER_REQUEST",
  Daily = "DAILY",
  Monthly = "MONTHLY",
  TaskCategory = "TASK_CATEGORY",
  Provider = "PROVIDER",
  Model = "MODEL",
}

export enum CostDecisionStatus {
  Allowed = "ALLOWED",
  AllowedLowCostOnly = "ALLOWED_LOW_COST_ONLY",
  AllowedWithOverride = "ALLOWED_WITH_OVERRIDE",
  RejectedBudgetExceeded = "REJECTED_BUDGET_EXCEEDED",
  RejectedInvalidCost = "REJECTED_INVALID_COST",
  RejectedCurrencyMismatch = "REJECTED_CURRENCY_MISMATCH",
  RejectedOverrideInvalid = "REJECTED_OVERRIDE_INVALID",
  RejectedInvalidRequest = "REJECTED_INVALID_REQUEST",
  RejectedInvalidPolicy = "REJECTED_INVALID_POLICY",
  DeferredBudgetUnavailable = "DEFERRED_BUDGET_UNAVAILABLE",
}

export enum BudgetStatus {
  Available = "AVAILABLE",
  SoftLimitExceeded = "SOFT_LIMIT_EXCEEDED",
  HardLimitExceeded = "HARD_LIMIT_EXCEEDED",
  Unlimited = "UNLIMITED",
  Disabled = "DISABLED",
}

export enum CostDecisionReason {
  AllHardLimitsSatisfied = "ALL_HARD_LIMITS_SATISFIED",
  SoftThresholdExceeded = "SOFT_THRESHOLD_EXCEEDED",
  LowCostModeRequired = "LOW_COST_MODE_REQUIRED",
  HardLimitExceeded = "HARD_LIMIT_EXCEEDED",
  ExactHardLimitAllowed = "EXACT_HARD_LIMIT_ALLOWED",
  UnlimitedScope = "UNLIMITED_SCOPE",
  DisabledScopeIgnored = "DISABLED_SCOPE_IGNORED",
  BudgetUsageUnavailable = "BUDGET_USAGE_UNAVAILABLE",
  InvalidEstimatedCost = "INVALID_ESTIMATED_COST",
  InvalidRequest = "INVALID_REQUEST",
  InvalidPolicy = "INVALID_POLICY",
  InvalidUsage = "INVALID_USAGE",
  CurrencyMismatch = "CURRENCY_MISMATCH",
  OverrideApplied = "OVERRIDE_APPLIED",
  OverrideMissing = "OVERRIDE_MISSING",
  OverrideExpired = "OVERRIDE_EXPIRED",
  OverrideAmountInsufficient = "OVERRIDE_AMOUNT_INSUFFICIENT",
  OverrideTaskUnauthorized = "OVERRIDE_TASK_UNAUTHORIZED",
  OverrideScopeUnauthorized = "OVERRIDE_SCOPE_UNAUTHORIZED",
  OverrideDisabled = "OVERRIDE_DISABLED",
  OverrideMetadataInvalid = "OVERRIDE_METADATA_INVALID",
}

export enum BudgetReservationStatus {
  Planned = "PLANNED",
  Reserved = "RESERVED",
  Committed = "COMMITTED",
  Released = "RELEASED",
  Expired = "EXPIRED",
}

export enum CostLedgerEntryType {
  ReservationCreated = "RESERVATION_CREATED",
  ReservationReleased = "RESERVATION_RELEASED",
  UsageCommitted = "USAGE_COMMITTED",
  ReservationExpired = "RESERVATION_EXPIRED",
  ManualAdjustment = "MANUAL_ADJUSTMENT",
  OverrideUsed = "OVERRIDE_USED",
}

export enum CostGovernorErrorCategory {
  InvalidRequest = "INVALID_REQUEST",
  InvalidPolicy = "INVALID_POLICY",
  InvalidUsage = "INVALID_USAGE",
  InvalidCost = "INVALID_COST",
  CurrencyMismatch = "CURRENCY_MISMATCH",
  BudgetExceeded = "BUDGET_EXCEEDED",
  BudgetUnavailable = "BUDGET_UNAVAILABLE",
  OverrideInvalid = "OVERRIDE_INVALID",
}

export interface MinorUnitAmount {
  readonly minorUnits: number;
  readonly currency: string;
}

export interface BudgetScopeReference {
  readonly scope: BudgetScope;
  readonly scopeId?: string;
}

export interface BudgetLimit extends BudgetScopeReference {
  readonly enabled: boolean;
  readonly currency: string;
  readonly softLimitMinorUnits?: number;
  readonly hardLimitMinorUnits: number | null;
  readonly policyVersion: string;
}

export interface BudgetScopeUsage extends BudgetScopeReference {
  readonly committedMinorUnits: number;
  readonly reservedMinorUnits: number;
}

export interface BudgetUsageSnapshot {
  readonly snapshotId: string;
  readonly capturedAt: string;
  readonly currency: string;
  readonly usages: ReadonlyArray<BudgetScopeUsage>;
}

export interface CriticalOverrideAuthorization {
  readonly authorizationId: string;
  readonly approvedBy: string;
  readonly allowedTaskTypes: ReadonlyArray<AITaskType>;
  readonly authorizedScopes: ReadonlyArray<BudgetScopeReference>;
  readonly maximumOverrideMinorUnits: number;
  readonly expiresAt: string;
  readonly reason: string;
}

export interface CostGovernorRequest {
  readonly contractVersion: "1.0";
  readonly requestId: string;
  readonly requestedAt: string;
  readonly taskType: AITaskType;
  readonly reasoningLevel: ReasoningLevel;
  readonly providerId?: string;
  readonly modelId?: string;
  readonly estimatedCost: MinorUnitAmount;
  readonly reservationId: string;
  readonly overrideAuthorization?: CriticalOverrideAuthorization;
}

export interface CostGovernorPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly currency: string;
  readonly minorUnitScale: number;
  readonly limits: ReadonlyArray<BudgetLimit>;
  readonly lowCostModeEnabled: boolean;
  readonly criticalOverrideFeatureEnabled: boolean;
  readonly criticalOverrideAllowed: boolean;
  readonly criticalTaskTypes: ReadonlyArray<AITaskType>;
  readonly criticalReasoningLevels: ReadonlyArray<ReasoningLevel>;
  readonly reservationTtlMs?: number;
}

export interface BudgetScopeEvaluation extends BudgetScopeReference {
  readonly enabled: boolean;
  readonly status: BudgetStatus;
  readonly currency: string;
  readonly policyVersion: string;
  readonly softLimitMinorUnits?: number;
  readonly hardLimitMinorUnits: number | null;
  readonly committedMinorUnits: number;
  readonly reservedMinorUnits: number;
  readonly estimatedNewMinorUnits: number;
  readonly projectedMinorUnits: number;
  readonly remainingMinorUnits: number | null;
  readonly softThresholdExceeded: boolean;
  readonly hardLimitExceeded: boolean;
}

export interface BudgetReservation {
  readonly reservationId: string;
  readonly requestId: string;
  readonly amount: MinorUnitAmount;
  readonly applicableScopes: ReadonlyArray<BudgetScopeReference>;
  readonly createdAt: string;
  readonly expiresAt?: string;
  readonly status: BudgetReservationStatus;
  readonly policyVersion: string;
}

export interface CostGovernorDecision {
  readonly decisionId: string;
  readonly requestId: string;
  readonly timestamp: string;
  readonly policyVersion: string;
  readonly status: CostDecisionStatus;
  readonly reasons: ReadonlyArray<CostDecisionReason>;
  readonly estimatedCost: MinorUnitAmount;
  readonly scopeEvaluations: ReadonlyArray<BudgetScopeEvaluation>;
  readonly unavailableScopes: ReadonlyArray<BudgetScopeReference>;
  readonly lowCostRequired: boolean;
  readonly requiredOverrideMinorUnits: number;
  readonly overrideAuthorizationId?: string;
  readonly reservation?: BudgetReservation;
}

export type CostDecision = CostGovernorDecision;

export interface CostGovernorError {
  readonly category: CostGovernorErrorCategory;
  readonly code: string;
  readonly safeMessage: string;
  readonly retryable: boolean;
  readonly occurredAt: string;
}

export interface CostAuditRecord {
  readonly auditId: string;
  readonly decisionId: string;
  readonly requestId: string;
  readonly timestamp: string;
  readonly policyVersion: string;
  readonly estimatedCost: MinorUnitAmount;
  readonly scopeEvaluations: ReadonlyArray<BudgetScopeEvaluation>;
  readonly unavailableScopes: ReadonlyArray<BudgetScopeReference>;
  readonly decisionStatus: CostDecisionStatus;
  readonly decisionReasons: ReadonlyArray<CostDecisionReason>;
  readonly lowCostRequired: boolean;
  readonly overrideAuthorizationId?: string;
  readonly reservation?: BudgetReservation;
  readonly finalResult: "ALLOWED" | "REJECTED" | "DEFERRED";
  readonly error?: CostGovernorError;
}

export interface CostLedgerEntry {
  readonly entryId: string;
  readonly requestId: string;
  readonly reservationId?: string;
  readonly timestamp: string;
  readonly type: CostLedgerEntryType;
  readonly deltaMinorUnits: number;
  readonly currency: string;
  readonly scope: BudgetScopeReference;
  readonly policyVersion: string;
  readonly note?: string;
}

export interface CostLedgerRepository {
  append(entry: Readonly<CostLedgerEntry>): Promise<void>;
  listByRequestId(
    requestId: string,
  ): Promise<ReadonlyArray<Readonly<CostLedgerEntry>>>;
  listByReservationId(
    reservationId: string,
  ): Promise<ReadonlyArray<Readonly<CostLedgerEntry>>>;
}
