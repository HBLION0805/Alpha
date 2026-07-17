import type { ConfidenceLevel, EvidenceSnapshot } from "./ResearchRecord";

export enum LearningRootCause {
  Prediction = "PREDICTION",
  Research = "RESEARCH",
  Execution = "EXECUTION",
  InstrumentSelection = "INSTRUMENT_SELECTION",
  RiskManagement = "RISK_MANAGEMENT",
  MarketRegime = "MARKET_REGIME",
  UnexpectedEvent = "UNEXPECTED_EVENT",
  Behavior = "BEHAVIOR",
  Luck = "LUCK",
}

export enum ImprovementArea {
  Research = "RESEARCH",
  Risk = "RISK",
  TradingPlan = "TRADING_PLAN",
  InstrumentRanking = "INSTRUMENT_RANKING",
  Decision = "DECISION",
  Dashboard = "DASHBOARD",
  Learning = "LEARNING",
  AiRouter = "AI_ROUTER",
}

export enum LearningValidationStatus {
  NotStarted = "NOT_STARTED",
  InReview = "IN_REVIEW",
  Validated = "VALIDATED",
  Rejected = "REJECTED",
  Approved = "APPROVED",
}

export enum LearningDecision {
  Monitor = "MONITOR",
  ResearchFurther = "RESEARCH_FURTHER",
  ProposeStrategyUpdate = "PROPOSE_STRATEGY_UPDATE",
  Reject = "REJECT",
  Archive = "ARCHIVE",
}

export interface ImprovementCandidate {
  area: ImprovementArea;
  problem: string;
  supportingEvidence: EvidenceSnapshot;
  expectedBenefit: string;
  cost: string;
  risk: string;
  recommendation: string;
}

export interface LearningRecord {
  learningId: string;
  tradeId: string;
  researchId: string;
  opportunityId: string;
  predictionId: string;
  decisionId: string;
  strategyVersion: string;
  createdAt: string;
  evidence: EvidenceSnapshot;
  observedPatterns: ReadonlyArray<string>;
  rootCauses: ReadonlyArray<LearningRootCause>;
  supportingRecordIds: ReadonlyArray<string>;
  confidence: ConfidenceLevel;
  candidateImprovement?: ImprovementCandidate;
  validationStatus: LearningValidationStatus;
  decision: LearningDecision;
  recommendedNextStep: string;
}
