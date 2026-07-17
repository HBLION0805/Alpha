import type { ApprovedTradePlan, TradeDirection } from "./DecisionRecord";

export enum TradeStatus {
  Planned = "PLANNED",
  Open = "OPEN",
  PartiallyClosed = "PARTIALLY_CLOSED",
  Closed = "CLOSED",
  StoppedOut = "STOPPED_OUT",
  Invalidated = "INVALIDATED",
  Cancelled = "CANCELLED",
  Expired = "EXPIRED",
  Error = "ERROR",
  Archived = "ARCHIVED",
}

export enum ExecutionAction {
  Buy = "BUY",
  Sell = "SELL",
  SellShort = "SELL_SHORT",
  BuyToCover = "BUY_TO_COVER",
}

export interface ExecutionFill {
  executionId: string;
  action: ExecutionAction;
  timestamp: string;
  quantity: number;
  price: number;
  fees: number;
  spread?: number;
  slippage?: number;
}

export interface ActualExecution {
  instrumentSymbol: string;
  currency: string;
  direction: TradeDirection;
  fills: ReadonlyArray<ExecutionFill>;
  totalFees: number;
  financingCost?: number;
  notes: ReadonlyArray<string>;
}

export interface PlanAdherenceReview {
  entryFollowed: boolean;
  positionSizingFollowed: boolean;
  stopLossFollowed: boolean;
  takeProfitFollowed: boolean;
  partialExitsFollowed: boolean;
  maximumHoldingPeriodRespected: boolean;
  invalidationRespected: boolean;
  riskIncreasedAfterEntry: boolean;
  emotionalPlanChange: boolean;
  exceptionalRulesUsedCorrectly: boolean;
}

export interface InstrumentSuitabilityReview {
  instrumentAppropriate: boolean;
  leverageAppropriate: boolean;
  dailyResetRiskAcceptable: boolean;
  holdingPeriodSuitable: boolean;
  liquiditySufficient: boolean;
  spreadAcceptable: boolean;
  slippageAcceptable: boolean;
  simplerInstrumentPreferred: boolean;
  cashOrWaitSuperior: boolean;
  notes: ReadonlyArray<string>;
}

export interface TradeRiskReview {
  plannedRisk: number;
  actualRisk: number;
  portfolioConcentration: number;
  riskEngineLimitsViolated: boolean;
  riskControlsPreventedLargerLoss: boolean;
  notes: ReadonlyArray<string>;
}

export interface OutcomeAttribution {
  primaryDriver: string;
  contributingDrivers: ReadonlyArray<string>;
  supportingEvidence: ReadonlyArray<string>;
}

export interface TradeOutcome {
  grossResult: number;
  netResult: number;
  currency: string;
  returnPercentage: number;
  maximumFavorableExcursion?: number;
  maximumAdverseExcursion?: number;
  holdingPeriod: string;
  exitReason: string;
  planFollowed: boolean;
  predictionCorrect?: boolean;
  executionProfitable: boolean;
  stopLossTriggered: boolean;
  takeProfitTriggered: boolean;
  partialProfitRulesFollowed: boolean;
  maximumHoldingPeriodReached: boolean;
  invalidationConditionTriggered: boolean;
  planAdherenceReview: PlanAdherenceReview;
  instrumentSuitabilityReview: InstrumentSuitabilityReview;
  riskReview: TradeRiskReview;
  outcomeAttribution: OutcomeAttribution;
  lessonsLearned: ReadonlyArray<string>;
}

export interface TradeRecord {
  tradeId: string;
  researchId: string;
  opportunityId: string;
  predictionId: string;
  decisionId: string;
  strategyVersion: string;
  createdAt: string;
  status: TradeStatus;
  readonly plannedTrade: ApprovedTradePlan;
  actualExecution?: ActualExecution;
  outcome?: TradeOutcome;
  updatedAt: string;
}
