import type { ConfidenceLevel } from "./ResearchRecord";

export enum DecisionOutcome {
  StrongBuy = "STRONG_BUY",
  Buy = "BUY",
  SmallPosition = "SMALL_POSITION",
  Hold = "HOLD",
  Wait = "WAIT",
  Reduce = "REDUCE",
  Exit = "EXIT",
  Short = "SHORT",
  Cash = "CASH",
  NoTrade = "NO_TRADE",
}

export enum ExecutionInstrumentType {
  CommonStock = "COMMON_STOCK",
  SectorEtf = "SECTOR_ETF",
  LeveragedLongEtf = "LEVERAGED_LONG_ETF",
  InverseEtf = "INVERSE_ETF",
  LeveragedInverseEtf = "LEVERAGED_INVERSE_ETF",
  FractionalShares = "FRACTIONAL_SHARES",
  Cash = "CASH",
}

export enum TradeDirection {
  Long = "LONG",
  Short = "SHORT",
  Neutral = "NEUTRAL",
}

export enum PositionSizeUnit {
  Shares = "SHARES",
  Contracts = "CONTRACTS",
  Currency = "CURRENCY",
  PortfolioPercent = "PORTFOLIO_PERCENT",
}

export enum OwnerApprovalStatus {
  Pending = "PENDING",
  Approved = "APPROVED",
  Rejected = "REJECTED",
}

export interface EntryRange {
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly currency: string;
}

export interface PositionSize {
  readonly value: number;
  readonly unit: PositionSizeUnit;
}

export interface ApprovedTradePlan {
  readonly instrumentType: ExecutionInstrumentType;
  readonly instrumentSymbol?: string;
  readonly direction: TradeDirection;
  readonly entryCondition: string;
  readonly entryRange?: EntryRange;
  readonly positionSize: PositionSize;
  readonly stopLoss: string;
  readonly takeProfit: string;
  readonly partialProfitRules: ReadonlyArray<string>;
  readonly maximumHoldingPeriod: string;
  readonly invalidationCondition: string;
  readonly exitRules: ReadonlyArray<string>;
  readonly expectedReward?: number;
  readonly expectedRisk?: number;
  readonly rewardToRiskRatio?: number;
  readonly frozenAt: string;
}

export interface DecisionRecord {
  readonly decisionId: string;
  readonly researchId: string;
  readonly opportunityId: string;
  readonly predictionId: string;
  readonly strategyVersion: string;
  readonly createdAt: string;
  readonly outcome: DecisionOutcome;
  readonly rationale: string;
  readonly supportingEvidence: ReadonlyArray<string>;
  readonly riskConstraints: ReadonlyArray<string>;
  readonly riskApproved: boolean;
  readonly researchConfidence: ConfidenceLevel;
  readonly predictionConfidence: ConfidenceLevel;
  readonly opportunityConfidence: ConfidenceLevel;
  readonly executionConfidence?: ConfidenceLevel;
  readonly approvedTradePlan?: ApprovedTradePlan;
  ownerApprovalStatus: OwnerApprovalStatus;
  approvalTimestamp?: string;
  approvalNote?: string;
  rejectionReason?: string;
}
