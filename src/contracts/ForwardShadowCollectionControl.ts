import type { EventContractShadowHistory } from "./EventContractShadowLedger";
import type { ResearchDatasetCollectionPlan } from "./ResearchDatasetQualification";

export const FORWARD_SHADOW_COLLECTION_CONTROL_SCHEMA_VERSION = "1.0" as const;

export enum ForwardShadowCollectionEventStatus {
  Upcoming = "UPCOMING",
  OverdueMissing = "OVERDUE_MISSING",
  CapturedUnsettled = "CAPTURED_UNSETTLED",
  SettledCandidate = "SETTLED_CANDIDATE",
}

export enum ForwardShadowCollectionProgressStatus {
  InProgress = "IN_PROGRESS",
  ReadyForBinding = "READY_FOR_BINDING",
  Blocked = "BLOCKED",
}

export enum ForwardShadowCollectionAuthorizationStatus {
  ResearchOnly = "FORWARD_COLLECTION_RESEARCH_ONLY_NOT_MODEL_OR_TRADE_AUTHORITY",
}

export enum ForwardShadowCollectionIssueCode {
  InvalidRecord = "INVALID_RECORD",
  InvalidSchemaVersion = "INVALID_SCHEMA_VERSION",
  InvalidIdentifier = "INVALID_IDENTIFIER",
  InvalidVersion = "INVALID_VERSION",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  InvalidEventCount = "INVALID_EVENT_COUNT",
  InvalidCutoffAlignment = "INVALID_CUTOFF_ALIGNMENT",
  PlanFrozenTooLate = "PLAN_FROZEN_TOO_LATE",
  InvalidPlan = "INVALID_PLAN",
  DuplicateObservation = "DUPLICATE_OBSERVATION",
  InvalidObservation = "INVALID_OBSERVATION",
  InvalidSettlement = "INVALID_SETTLEMENT",
  ObservationAfterAudit = "OBSERVATION_AFTER_AUDIT",
  SettlementAfterAudit = "SETTLEMENT_AFTER_AUDIT",
}

export interface ForwardShadowCollectionPlanRequest {
  readonly schemaVersion: typeof FORWARD_SHADOW_COLLECTION_CONTROL_SCHEMA_VERSION;
  readonly planId: string;
  readonly planVersion: string;
  readonly createdAt: string;
  readonly firstCutoffAt: string;
  readonly eventCount: number;
}

export interface FrozenForwardShadowCollectionPlan {
  readonly schemaVersion: typeof FORWARD_SHADOW_COLLECTION_CONTROL_SCHEMA_VERSION;
  readonly createdAt: string;
  readonly collectionPlan: ResearchDatasetCollectionPlan;
  readonly planFingerprint: string;
  readonly authorizationStatus: ForwardShadowCollectionAuthorizationStatus.ResearchOnly;
  readonly deterministic: true;
  readonly readOnly: true;
  readonly fingerprint: string;
}

export interface ForwardShadowCollectionProgressInput {
  readonly schemaVersion: typeof FORWARD_SHADOW_COLLECTION_CONTROL_SCHEMA_VERSION;
  readonly auditId: string;
  readonly asOfTime: string;
  readonly collectionPlan: ResearchDatasetCollectionPlan;
  readonly histories: readonly EventContractShadowHistory[];
}

export interface ForwardShadowCollectionEventProgress {
  readonly eventId: string;
  readonly cutoffAt: string;
  readonly status: ForwardShadowCollectionEventStatus;
  readonly observationIds: readonly string[];
  readonly settledObservationIds: readonly string[];
}

export interface ForwardShadowCollectionProgressMetrics {
  readonly plannedCount: number;
  readonly upcomingCount: number;
  readonly missingCount: number;
  readonly capturedCount: number;
  readonly settledCandidateCount: number;
  readonly unplannedObservationCount: number;
  readonly coverageBasisPoints: number;
  readonly settlementCoverageBasisPoints: number;
}

export interface ForwardShadowCollectionIssue {
  readonly code: ForwardShadowCollectionIssueCode;
  readonly field: string;
  readonly recordId: string | null;
  readonly message: string;
}

export interface ForwardShadowCollectionProgressResult {
  readonly schemaVersion: typeof FORWARD_SHADOW_COLLECTION_CONTROL_SCHEMA_VERSION;
  readonly auditId: string;
  readonly asOfTime: string;
  readonly planId: string;
  readonly planVersion: string;
  readonly planFingerprint: string;
  readonly ledgerSnapshotFingerprint: string;
  readonly status: ForwardShadowCollectionProgressStatus;
  readonly metrics: ForwardShadowCollectionProgressMetrics;
  readonly events: readonly ForwardShadowCollectionEventProgress[];
  readonly issues: readonly ForwardShadowCollectionIssue[];
  readonly authorizationStatus: ForwardShadowCollectionAuthorizationStatus.ResearchOnly;
  readonly deterministic: true;
  readonly readOnly: true;
  readonly fingerprint: string;
}
