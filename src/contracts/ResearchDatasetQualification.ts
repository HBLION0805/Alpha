import type { ResearchIntegrityAudit } from "./ResearchIntegrity";

export const RESEARCH_DATASET_QUALIFICATION_SCHEMA_VERSION = "1.0" as const;

export enum ResearchDatasetEventType {
  BtcFifteenMinute = "BTC_15_MINUTE",
}

export enum ResearchDatasetOutcomeLabel {
  Up = "UP",
  Down = "DOWN",
}

export enum ResearchDatasetQualificationStatus {
  Qualified = "QUALIFIED",
  Blocked = "BLOCKED",
}

export enum ResearchDatasetAuthorizationStatus {
  ResearchOnly = "DATASET_RESEARCH_ONLY_NOT_MODEL_OR_TRADE_AUTHORITY",
}

export enum ResearchDatasetIssueCode {
  InvalidRecord = "INVALID_RECORD",
  InvalidSchemaVersion = "INVALID_SCHEMA_VERSION",
  InvalidIdentifier = "INVALID_IDENTIFIER",
  InvalidVersion = "INVALID_VERSION",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  InvalidFingerprint = "INVALID_FINGERPRINT",
  InvalidEnum = "INVALID_ENUM",
  InvalidPolicy = "INVALID_POLICY",
  InvalidPlan = "INVALID_PLAN",
  PlanFrozenTooLate = "PLAN_FROZEN_TOO_LATE",
  DuplicateIdentity = "DUPLICATE_IDENTITY",
  UnplannedEvent = "UNPLANNED_EVENT",
  EventCutoffMismatch = "EVENT_CUTOFF_MISMATCH",
  InsufficientSamples = "INSUFFICIENT_SAMPLES",
  InsufficientDateCoverage = "INSUFFICIENT_DATE_COVERAGE",
  InsufficientPlanCoverage = "INSUFFICIENT_PLAN_COVERAGE",
  InsufficientOutcomeCoverage = "INSUFFICIENT_OUTCOME_COVERAGE",
  OutcomeImbalance = "OUTCOME_IMBALANCE",
  InvalidOutcomeChronology = "INVALID_OUTCOME_CHRONOLOGY",
  OutcomeDelayExceeded = "OUTCOME_DELAY_EXCEEDED",
  IntegrityAuditBlocked = "INTEGRITY_AUDIT_BLOCKED",
  IntegrityAuditMismatch = "INTEGRITY_AUDIT_MISMATCH",
  IntegrityPolicyMismatch = "INTEGRITY_POLICY_MISMATCH",
  FeatureVersionMismatch = "FEATURE_VERSION_MISMATCH",
  InsufficientPartitionSize = "INSUFFICIENT_PARTITION_SIZE",
  PartitionLabelOverlap = "PARTITION_LABEL_OVERLAP",
}

export interface ResearchDatasetIssue {
  readonly code: ResearchDatasetIssueCode;
  readonly field: string;
  readonly sampleId: string | null;
  readonly message: string;
}

export interface ResearchDatasetPlannedEvent {
  readonly eventId: string;
  readonly cutoffAt: string;
}

export interface ResearchDatasetCollectionPlan {
  readonly planId: string;
  readonly planVersion: string;
  readonly frozenAt: string;
  readonly instrumentId: "instrument:crypto:btc-usd";
  readonly eventType: ResearchDatasetEventType.BtcFifteenMinute;
  readonly intervalSeconds: 900;
  readonly plannedEvents: readonly ResearchDatasetPlannedEvent[];
}

export type ResearchIntegrityAuditReference = ResearchIntegrityAudit;

export interface ResearchDatasetSample {
  readonly sampleId: string;
  readonly eventId: string;
  readonly observationId: string;
  readonly observationFingerprint: string;
  readonly cutoffAt: string;
  readonly outcomeId: string;
  readonly outcomeFingerprint: string;
  readonly outcomeKnownAt: string;
  readonly label: ResearchDatasetOutcomeLabel;
  readonly featureSchemaVersion: string;
  readonly featureSetVersion: string;
  readonly integrityAudit: ResearchIntegrityAuditReference;
}

export interface ResearchDatasetQualificationInput {
  readonly schemaVersion: typeof RESEARCH_DATASET_QUALIFICATION_SCHEMA_VERSION;
  readonly qualificationId: string;
  readonly researchId: string;
  readonly createdAt: string;
  readonly collectionPlan: ResearchDatasetCollectionPlan;
  readonly samples: readonly ResearchDatasetSample[];
}

export interface ResearchDatasetQualificationPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly ruleSetVersion: string;
  readonly minimumCompletedSamples: number;
  readonly minimumDistinctUtcDays: number;
  readonly minimumCoverageBasisPoints: number;
  readonly minimumUpSamples: number;
  readonly minimumDownSamples: number;
  readonly maximumDominantOutcomeBasisPoints: number;
  readonly maximumOutcomeDelaySeconds: number;
  readonly trainBasisPoints: number;
  readonly calibrationBasisPoints: number;
  readonly testBasisPoints: number;
  readonly embargoSampleCount: number;
  readonly maximumSamples: number;
}

export interface ResearchDatasetMetrics {
  readonly plannedCount: number;
  readonly completedCount: number;
  readonly missingCount: number;
  readonly coverageBasisPoints: number;
  readonly distinctUtcDays: number;
  readonly upCount: number;
  readonly downCount: number;
  readonly dominantOutcomeBasisPoints: number;
  readonly firstCutoffAt: string | null;
  readonly lastCutoffAt: string | null;
  readonly featureSchemaVersion: string | null;
  readonly featureSetVersion: string | null;
}

export interface ResearchDatasetPartition {
  readonly name: "TRAIN" | "CALIBRATION" | "TEST";
  readonly sampleIds: readonly string[];
  readonly count: number;
  readonly startsAt: string;
  readonly endsAt: string;
}

export interface ResearchDatasetTemporalSplit {
  readonly train: ResearchDatasetPartition;
  readonly calibration: ResearchDatasetPartition;
  readonly test: ResearchDatasetPartition;
  readonly embargoedSampleIds: readonly string[];
  readonly fingerprint: string;
}

export interface ResearchDatasetQualificationResult {
  readonly schemaVersion: typeof RESEARCH_DATASET_QUALIFICATION_SCHEMA_VERSION;
  readonly qualificationId: string;
  readonly researchId: string;
  readonly createdAt: string;
  readonly planId: string;
  readonly planVersion: string;
  readonly planFingerprint: string;
  readonly datasetFingerprint: string;
  readonly status: ResearchDatasetQualificationStatus;
  readonly metrics: ResearchDatasetMetrics;
  readonly issues: readonly ResearchDatasetIssue[];
  readonly split: ResearchDatasetTemporalSplit | null;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly ruleSetVersion: string;
  readonly authorizationStatus: ResearchDatasetAuthorizationStatus.ResearchOnly;
  readonly deterministic: true;
  readonly readOnly: true;
  readonly fingerprint: string;
}

export interface ResearchDatasetValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ResearchDatasetIssue[];
}
