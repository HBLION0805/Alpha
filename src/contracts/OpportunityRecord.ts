import type {
  ConfidenceLevel,
  EvidenceSnapshot,
} from "./ResearchRecord";

export enum OpportunityCategory {
  Market = "MARKET",
  Macro = "MACRO",
  Sector = "SECTOR",
  Company = "COMPANY",
  Etf = "ETF",
  EventDriven = "EVENT_DRIVEN",
  Rebound = "REBOUND",
  Breakdown = "BREAKDOWN",
  MomentumContinuation = "MOMENTUM_CONTINUATION",
  DefensiveAllocation = "DEFENSIVE_ALLOCATION",
  Watchlist = "WATCHLIST",
  NoOpportunity = "NO_OPPORTUNITY",
}

export enum OpportunityState {
  New = "NEW",
  NeedsResearch = "NEEDS_RESEARCH",
  UnderReview = "UNDER_REVIEW",
  Watch = "WATCH",
  Actionable = "ACTIONABLE",
  Wait = "WAIT",
  Rejected = "REJECTED",
  Archived = "ARCHIVED",
  Reopened = "REOPENED",
}

export enum OpportunityDecision {
  AdvanceToResearch = "ADVANCE_TO_RESEARCH",
  ContinueResearch = "CONTINUE_RESEARCH",
  AdvanceToPrediction = "ADVANCE_TO_PREDICTION",
  AdvanceToInstrumentRanking = "ADVANCE_TO_INSTRUMENT_RANKING",
  Watch = "WATCH",
  Wait = "WAIT",
  Reject = "REJECT",
  Archive = "ARCHIVE",
  Reopen = "REOPEN",
  Cash = "CASH",
}

export interface OpportunityEvaluation {
  evidenceQuality: string;
  thesisClarity: string;
  timingRelevance: string;
  marketAlignment: string;
  sectorAlignment: string;
  relativeStrength: string;
  catalystQuality: string;
  riskContext: string;
  scenarioBalance: string;
}

export interface OpportunityRecord {
  opportunityId: string;
  researchId: string;
  strategyVersion: string;
  createdAt: string;
  updatedAt: string;
  category: OpportunityCategory;
  state: OpportunityState;
  subject: string;
  thesis: string;
  timeHorizon: string;
  evidence: EvidenceSnapshot;
  evaluation: OpportunityEvaluation;
  researchConfidence: ConfidenceLevel;
  predictionConfidence: ConfidenceLevel;
  opportunityConfidence: ConfidenceLevel;
  decision: OpportunityDecision;
  decisionReason: string;
}
