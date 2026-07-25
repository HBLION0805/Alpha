import type {
  EventContractFixedDecimal,
  EventContractSourceProvider,
} from "../../../contracts";

export const KALSHI_EVENT_CONTRACT_FIXTURE_SCHEMA_VERSION = "1.0" as const;
export const KALSHI_EVENT_CONTRACT_PROVIDER_ID = "provider:kalshi:public-api" as const;
export const KALSHI_EVENT_CONTRACT_EXCHANGE_ID = "exchange:kalshi-ex" as const;
export const KALSHI_BTC_FIFTEEN_MINUTE_SERIES_TICKER = "KXBTC15M" as const;

export enum KalshiEventContractFixtureStatus {
  NormalizedPendingMapping = "NORMALIZED_PENDING_MAPPING",
  Rejected = "REJECTED",
}

export enum KalshiEventContractFixtureIssueCode {
  MalformedJson = "MALFORMED_JSON",
  PayloadTooLarge = "PAYLOAD_TOO_LARGE",
  InvalidPayload = "INVALID_PAYLOAD",
  UnknownField = "UNKNOWN_FIELD",
  IdentityMismatch = "IDENTITY_MISMATCH",
  InvalidTerms = "INVALID_TERMS",
  InvalidChronology = "INVALID_CHRONOLOGY",
}

export enum KalshiRobinhoodMappingBlockerCode {
  MissingDeclaredExchangeIdentity = "MISSING_ROBINHOOD_DECLARED_EXCHANGE_IDENTITY",
  MissingPlatformMarketIdentity = "MISSING_ROBINHOOD_PLATFORM_MARKET_IDENTITY",
  MissingPlatformContractIdentity = "MISSING_ROBINHOOD_PLATFORM_CONTRACT_IDENTITY",
  MissingPlatformTermsIdentity = "MISSING_ROBINHOOD_PLATFORM_TERMS_IDENTITY",
  MissingPlatformTermsVersion = "MISSING_ROBINHOOD_PLATFORM_TERMS_VERSION",
  MissingExactTitleAndRuleEvidence = "MISSING_ROBINHOOD_EXACT_TITLE_AND_RULE_EVIDENCE",
}

export interface KalshiEventContractFixtureIssue {
  readonly code: KalshiEventContractFixtureIssueCode;
  readonly field: string;
  readonly message: string;
}

export interface KalshiExternalMarketIdentity {
  readonly providerId: typeof KALSHI_EVENT_CONTRACT_PROVIDER_ID;
  readonly exchangeId: typeof KALSHI_EVENT_CONTRACT_EXCHANGE_ID;
  readonly seriesTicker: typeof KALSHI_BTC_FIFTEEN_MINUTE_SERIES_TICKER;
  readonly eventTicker: string;
  readonly marketTicker: string;
}

export interface KalshiExternalTermsCandidate {
  readonly title: string;
  readonly termsVersion: null;
  readonly instrumentId: "instrument:crypto:btc-usd";
  readonly outcomePair: "UP_DOWN";
  readonly windowStartsAt: string;
  readonly tradingClosesAt: string;
  readonly evaluatesAt: string;
  readonly evaluationMethod: "AT_SCHEDULED_TIME";
  readonly thresholdOperator: "AT_OR_ABOVE";
  readonly targetPrice: EventContractFixedDecimal;
  readonly settlementSourceId: "source:cme-cf-brti";
  readonly contractTermsUrl: string;
  readonly contractCertificationUrl: string;
  readonly seriesLastUpdatedAt: string;
  readonly ruleFingerprint: string;
}

export interface KalshiSettlementFact {
  readonly status: "FINALIZED";
  readonly result: "UP" | "DOWN";
  readonly settlementValueBasisPoints: number;
  readonly settledAt: string;
  readonly expirationValue: EventContractFixedDecimal;
}

export interface KalshiRobinhoodMappingAssessment {
  readonly reviewStatus: "PENDING";
  readonly eligibleForCollection: false;
  readonly matchingDisplayedFacts: readonly [
    "BTC_15_MINUTE_WINDOW",
    "TARGET_PRICE",
    "BRTI_SETTLEMENT_SOURCE",
  ];
  readonly blockerCodes: readonly KalshiRobinhoodMappingBlockerCode[];
  readonly evidenceIds: readonly string[];
}

export interface KalshiEventContractFixtureProvenance {
  readonly marketEndpoint: string;
  readonly seriesEndpoint: string;
  readonly marketPayloadFingerprint: string;
  readonly seriesPayloadFingerprint: string;
  readonly observedAt: string;
  readonly receivedAt: string;
  readonly normalizedAt: string;
  readonly rawPayloadBytes: number;
  readonly recordCount: 2;
}

export interface KalshiNormalizedEventContractFixture {
  readonly schemaVersion: typeof KALSHI_EVENT_CONTRACT_FIXTURE_SCHEMA_VERSION;
  readonly status: KalshiEventContractFixtureStatus.NormalizedPendingMapping;
  readonly provider: EventContractSourceProvider;
  readonly externalIdentity: KalshiExternalMarketIdentity;
  readonly externalTerms: KalshiExternalTermsCandidate;
  readonly settlement: KalshiSettlementFact;
  readonly mappingAssessment: KalshiRobinhoodMappingAssessment;
  readonly provenance: KalshiEventContractFixtureProvenance;
  readonly eligibleForSourceSnapshot: false;
  readonly sourceSnapshot: null;
  readonly authorizationStatus: "RESEARCH_FIXTURE_ONLY_NOT_OBSERVATION_OR_TRADE_AUTHORITY";
  readonly deterministic: true;
  readonly readOnly: true;
  readonly fingerprint: string;
}

export interface KalshiRejectedEventContractFixture {
  readonly schemaVersion: typeof KALSHI_EVENT_CONTRACT_FIXTURE_SCHEMA_VERSION;
  readonly status: KalshiEventContractFixtureStatus.Rejected;
  readonly blockers: readonly KalshiEventContractFixtureIssue[];
  readonly eligibleForSourceSnapshot: false;
  readonly sourceSnapshot: null;
}

export type KalshiEventContractFixtureResult =
  | KalshiNormalizedEventContractFixture
  | KalshiRejectedEventContractFixture;

export interface KalshiEventContractFixtureInput {
  readonly marketBody: string;
  readonly seriesBody: string;
  readonly observedAt: string;
  readonly receivedAt: string;
  readonly normalizedAt: string;
}
