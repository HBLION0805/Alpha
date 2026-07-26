import type { EvidenceAssessmentStatus } from "./EvidenceEngine";

export const PERSONAL_DECISION_SCHEMA_VERSION = "1.0" as const;

export enum PersonalDecisionDirection {
  Long = "LONG",
  Short = "SHORT",
  NoTrade = "NO_TRADE",
}

export enum PersonalDecisionThesisDirection {
  Long = "LONG",
  Short = "SHORT",
}

export enum PersonalDecisionMarketDataStatus {
  Current = "CURRENT",
  Stale = "STALE",
  Unavailable = "UNAVAILABLE",
}

export enum PersonalDecisionLiquidityStatus {
  Sufficient = "SUFFICIENT",
  Insufficient = "INSUFFICIENT",
  Unknown = "UNKNOWN",
}

export enum PersonalDecisionCalibrationStatus {
  Calibrated = "CALIBRATED",
  Uncalibrated = "UNCALIBRATED",
  Unavailable = "UNAVAILABLE",
}

export enum PersonalDecisionRiskStatus {
  Approved = "APPROVED",
  Constrained = "CONSTRAINED",
  Blocked = "BLOCKED",
  Unavailable = "UNAVAILABLE",
}

export enum PersonalDecisionAuthorizationStatus {
  AdvisoryOnlyManualExecution = "ADVISORY_ONLY_MANUAL_EXECUTION",
}

export enum PersonalDecisionBlockerCode {
  EvidenceNotSufficient = "EVIDENCE_NOT_SUFFICIENT",
  EvidenceStale = "EVIDENCE_STALE",
  MarketDataNotCurrent = "MARKET_DATA_NOT_CURRENT",
  MarketDataStale = "MARKET_DATA_STALE",
  SpreadTooWide = "SPREAD_TOO_WIDE",
  LiquidityNotSufficient = "LIQUIDITY_NOT_SUFFICIENT",
  ProbabilityNotCalibrated = "PROBABILITY_NOT_CALIBRATED",
  CalibrationSampleTooSmall = "CALIBRATION_SAMPLE_TOO_SMALL",
  OutOfSampleValidationMissing = "OUT_OF_SAMPLE_VALIDATION_MISSING",
  ProbabilityBelowThreshold = "PROBABILITY_BELOW_THRESHOLD",
  RiskNotApproved = "RISK_NOT_APPROVED",
  ConstrainedRiskMissingConstraint = "CONSTRAINED_RISK_MISSING_CONSTRAINT",
  PlannedLossExceedsLimit = "PLANNED_LOSS_EXCEEDS_LIMIT",
  InvalidDirectionalPlan = "INVALID_DIRECTIONAL_PLAN",
  RewardToRiskBelowThreshold = "REWARD_TO_RISK_BELOW_THRESHOLD",
  HoldingDeadlineExpired = "HOLDING_DEADLINE_EXPIRED",
  EvidenceReferenceMissing = "EVIDENCE_REFERENCE_MISSING",
}

export enum PersonalDecisionReasonCode {
  EvidenceGatePassed = "EVIDENCE_GATE_PASSED",
  MarketDataGatePassed = "MARKET_DATA_GATE_PASSED",
  ProbabilityGatePassed = "PROBABILITY_GATE_PASSED",
  RiskGatePassed = "RISK_GATE_PASSED",
  TradePlanGatePassed = "TRADE_PLAN_GATE_PASSED",
  AllActionGatesPassed = "ALL_ACTION_GATES_PASSED",
  OneOrMoreActionGatesBlocked = "ONE_OR_MORE_ACTION_GATES_BLOCKED",
}

export interface PersonalDecisionDecimal {
  readonly atomicValue: string;
  readonly scale: number;
}

export interface PersonalDecisionInstrument {
  readonly instrumentId: string;
  readonly symbol: string;
  readonly assetClass: "EQUITY" | "ETF";
  readonly currency: string;
}

export interface PersonalDecisionEvidenceInput {
  readonly assessmentId: string;
  readonly status: EvidenceAssessmentStatus;
  readonly evaluatedAt: string;
  readonly policyVersion: string;
  readonly references: readonly string[];
}

export interface PersonalDecisionMarketInput {
  readonly snapshotId: string;
  readonly observedAt: string;
  readonly status: PersonalDecisionMarketDataStatus;
  readonly spreadBasisPoints: number;
  readonly liquidity: PersonalDecisionLiquidityStatus;
}

export interface PersonalDecisionProbabilityInput {
  readonly thesisId: string;
  readonly direction: PersonalDecisionThesisDirection;
  readonly probabilityBasisPoints: number;
  readonly calibrationStatus: PersonalDecisionCalibrationStatus;
  readonly calibrationPolicyVersion: string;
  readonly calibrationSampleSize: number;
  readonly outOfSampleValidated: boolean;
}

export interface PersonalDecisionTradePlanInput {
  readonly entryLower: PersonalDecisionDecimal;
  readonly entryUpper: PersonalDecisionDecimal;
  readonly stop: PersonalDecisionDecimal;
  readonly targets: readonly PersonalDecisionDecimal[];
  readonly maximumHoldingUntil: string;
}

export interface PersonalDecisionRiskInput {
  readonly assessmentId: string;
  readonly status: PersonalDecisionRiskStatus;
  /** Maximum planned loss as basis points of total personal trading capital. */
  readonly maximumCapitalLossBasisPoints: number;
  readonly constraints: readonly string[];
  readonly policyVersion: string;
}

export interface PersonalDecisionRequest {
  readonly schemaVersion: typeof PERSONAL_DECISION_SCHEMA_VERSION;
  readonly requestId: string;
  readonly evaluatedAt: string;
  readonly instrument: PersonalDecisionInstrument;
  readonly evidence: PersonalDecisionEvidenceInput;
  readonly market: PersonalDecisionMarketInput;
  readonly probability: PersonalDecisionProbabilityInput;
  readonly tradePlan: PersonalDecisionTradePlanInput;
  readonly risk: PersonalDecisionRiskInput;
}

export interface PersonalDecisionPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly maximumEvidenceAgeSeconds: number;
  readonly maximumMarketDataAgeSeconds: number;
  readonly maximumSpreadBasisPoints: number;
  readonly minimumProbabilityBasisPoints: number;
  readonly minimumCalibrationSampleSize: number;
  readonly minimumRewardToRiskBasisPoints: number;
  readonly maximumCapitalLossBasisPoints: number;
}

export interface PersonalDecisionCard {
  readonly schemaVersion: typeof PERSONAL_DECISION_SCHEMA_VERSION;
  readonly decisionId: string;
  readonly requestId: string;
  readonly inputFingerprint: string;
  readonly createdAt: string;
  readonly instrument: PersonalDecisionInstrument;
  readonly decision: PersonalDecisionDirection;
  readonly probability: PersonalDecisionProbabilityInput;
  readonly tradePlan: PersonalDecisionTradePlanInput;
  /** 10_000 means 1.00 reward units per 1.00 risk unit. */
  readonly worstEntryRewardToRiskBasisPoints: number | null;
  readonly evidenceAssessmentId: string;
  readonly riskAssessmentId: string;
  readonly blockerCodes: readonly PersonalDecisionBlockerCode[];
  readonly reasonCodes: readonly PersonalDecisionReasonCode[];
  readonly policyId: string;
  readonly policyVersion: string;
  readonly authorizationStatus: PersonalDecisionAuthorizationStatus.AdvisoryOnlyManualExecution;
  readonly automatedExecutionAllowed: false;
  readonly deterministic: true;
  readonly readOnly: true;
}

export enum PersonalDecisionValidationIssueCode {
  InvalidRequest = "INVALID_REQUEST",
  UndeclaredField = "UNDECLARED_FIELD",
  InvalidIdentifier = "INVALID_IDENTIFIER",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  InvalidEnum = "INVALID_ENUM",
  InvalidDecimal = "INVALID_DECIMAL",
  InvalidBasisPoints = "INVALID_BASIS_POINTS",
  InvalidArray = "INVALID_ARRAY",
  InvalidPolicy = "INVALID_POLICY",
}

export interface PersonalDecisionValidationIssue {
  readonly code: PersonalDecisionValidationIssueCode;
  readonly field: string;
  readonly message: string;
}
