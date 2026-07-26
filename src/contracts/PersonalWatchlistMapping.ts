import type { CanonicalInstrument } from "./CanonicalInstrument";
import type {
  PersonalCandidateExposure,
  PersonalCandidateMapping,
} from "./PersonalCandidateScan";

export const PERSONAL_WATCHLIST_MAPPING_SCHEMA_VERSION = "1.0" as const;

export enum PersonalWatchlistResearchStatus {
  AuthorityVerified = "AUTHORITY_VERIFIED",
  EvidencePending = "EVIDENCE_PENDING",
}

export enum PersonalWatchlistOwnerStatus {
  Pending = "PENDING",
  Approved = "APPROVED",
  Rejected = "REJECTED",
}

export enum PersonalWatchlistResetPolicy {
  Daily = "DAILY",
}

export enum PersonalWatchlistHoldingBoundary {
  IntradayOnly = "INTRADAY_ONLY",
}

export interface PersonalWatchlistAuthorityEvidence {
  readonly evidenceId: string;
  readonly authority: "ISSUER" | "SEC" | "EXCHANGE";
  readonly url: string;
  readonly assertion: string;
  readonly retrievedAt: string;
}

export interface PersonalWatchlistOwnerDecision {
  readonly status: PersonalWatchlistOwnerStatus;
  readonly decidedBy?: string;
  readonly decidedAt?: string;
  readonly decisionReference?: string;
}

/**
 * An immutable proposed relationship between an analysis instrument and one
 * exchange-traded vehicle. Research verification never substitutes for Owner
 * approval.
 */
export interface PersonalWatchlistMapping {
  readonly schemaVersion: typeof PERSONAL_WATCHLIST_MAPPING_SCHEMA_VERSION;
  readonly mappingId: string;
  readonly version: string;
  readonly themeId: string;
  readonly analysisInstrument: CanonicalInstrument;
  readonly tradeVehicle: CanonicalInstrument;
  readonly exposure: PersonalCandidateExposure;
  /** Signed daily target in basis points: +20000 = +2x, -20000 = -2x. */
  readonly dailyTargetBasisPoints: number;
  readonly resetPolicy: PersonalWatchlistResetPolicy.Daily;
  readonly holdingBoundary: PersonalWatchlistHoldingBoundary.IntradayOnly;
  readonly researchStatus: PersonalWatchlistResearchStatus;
  readonly authorityEvidence: readonly PersonalWatchlistAuthorityEvidence[];
  readonly ownerDecision: PersonalWatchlistOwnerDecision;
}

export interface PersonalWatchlistMappingRegistry {
  readonly schemaVersion: typeof PERSONAL_WATCHLIST_MAPPING_SCHEMA_VERSION;
  readonly registryId: string;
  readonly version: string;
  readonly createdAt: string;
  readonly mappings: readonly PersonalWatchlistMapping[];
  readonly advisoryOnly: true;
  readonly automatedExecutionAllowed: false;
}

export interface PersonalWatchlistOwnerApprovalCommand {
  readonly mappingIds: readonly string[];
  readonly decidedBy: string;
  readonly decidedAt: string;
  readonly decisionReference: string;
}

export enum PersonalWatchlistMappingIssueCode {
  InvalidRecord = "INVALID_RECORD",
  UndeclaredField = "UNDECLARED_FIELD",
  InvalidIdentifier = "INVALID_IDENTIFIER",
  InvalidVersion = "INVALID_VERSION",
  InvalidInstrument = "INVALID_INSTRUMENT",
  SameInstrument = "SAME_INSTRUMENT",
  InvalidExposure = "INVALID_EXPOSURE",
  InvalidDailyTarget = "INVALID_DAILY_TARGET",
  EvidenceMissing = "EVIDENCE_MISSING",
  InvalidEvidence = "INVALID_EVIDENCE",
  InvalidOwnerDecision = "INVALID_OWNER_DECISION",
  DuplicateMapping = "DUPLICATE_MAPPING",
  DuplicateVehicle = "DUPLICATE_VEHICLE",
}

export interface PersonalWatchlistMappingIssue {
  readonly code: PersonalWatchlistMappingIssueCode;
  readonly field: string;
  readonly message: string;
}

export interface PersonalWatchlistMappingValidation {
  readonly valid: boolean;
  readonly issues: readonly PersonalWatchlistMappingIssue[];
}

export interface PersonalWatchlistActivationResult {
  readonly active: boolean;
  readonly mapping?: PersonalCandidateMapping;
  readonly blockers: readonly PersonalWatchlistMappingIssue[];
}
