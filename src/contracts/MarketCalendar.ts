import type { BarInterval } from "./CanonicalBar";

export enum MarketDataOrigin {
  Fixture = "FIXTURE",
  Network = "NETWORK",
}

export enum MarketCalendarSessionStatus {
  Completed = "COMPLETED_TRADING_SESSION",
  Scheduled = "SCHEDULED_TRADING_SESSION",
  HolidayClosed = "MARKET_HOLIDAY",
}

export interface MarketSessionIdentity {
  readonly calendarId: string;
  readonly sessionId: string;
  readonly sessionDate: string;
  readonly sessionType: "REGULAR" | "EXTENDED";
  readonly timezone: string;
}

export interface MarketCalendarSessionEvidence
  extends MarketSessionIdentity {
  readonly calendarEvidenceId: string;
  readonly calendarEvidenceFingerprint: string;
  readonly marketOpen: string;
  readonly marketClose: string;
  readonly closureBufferSeconds: number;
  readonly status: MarketCalendarSessionStatus;
  readonly provenanceReference: string;
  readonly dataOrigin: MarketDataOrigin;
}

export interface CanonicalBarReference {
  readonly canonicalBarId: string;
  readonly canonicalBarFingerprint: string;
  readonly canonicalInstrumentId: string;
  readonly interval: BarInterval;
  readonly intervalStart: string;
  readonly intervalEnd: string;
  readonly observationTime: string;
  readonly sessionDate: string;
  readonly status: "FINAL";
  readonly freshness: "CURRENT" | "STALE";
  readonly provenanceReference: string;
}

export interface MarketCalendarIssue {
  readonly code: MarketCalendarIssueCode;
  readonly field: string;
  readonly message: string;
}

export interface MarketCalendarValidationResult {
  readonly valid: boolean;
  readonly issues: readonly MarketCalendarIssue[];
}

export enum MarketCalendarIssueCode {
  UndeclaredField = "UNDECLARED_FIELD",
  InvalidSessionEvidence = "INVALID_SESSION_EVIDENCE",
}
