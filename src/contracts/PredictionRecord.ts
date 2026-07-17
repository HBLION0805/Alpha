import type {
  ConfidenceLevel,
  EvidenceSnapshot,
} from "./ResearchRecord";

export enum PredictionSubjectType {
  Market = "MARKET",
  Macro = "MACRO",
  Sector = "SECTOR",
  Company = "COMPANY",
  Etf = "ETF",
  Event = "EVENT",
}

export enum PredictionDirection {
  Up = "UP",
  Down = "DOWN",
  Neutral = "NEUTRAL",
  RangeBound = "RANGE_BOUND",
}

export enum PredictionStatus {
  Draft = "DRAFT",
  Active = "ACTIVE",
  Confirmed = "CONFIRMED",
  Invalidated = "INVALIDATED",
  Expired = "EXPIRED",
  Resolved = "RESOLVED",
  Cancelled = "CANCELLED",
  Amended = "AMENDED",
  Archived = "ARCHIVED",
}

export interface PredictionScenario {
  readonly name: string;
  readonly confidence: ConfidenceLevel;
  readonly expectedMove: string;
  readonly expectedDuration: string;
  readonly supportingEvidence: ReadonlyArray<string>;
  readonly failureConditions: ReadonlyArray<string>;
}

export interface PredictionAmendment {
  readonly amendmentId: string;
  readonly createdAt: string;
  readonly reason: string;
  readonly description: string;
}

export interface PredictionResolution {
  readonly resolvedAt: string;
  readonly actualDirection: PredictionDirection;
  readonly actualMagnitude: string;
  readonly actualDuration: string;
  readonly benchmarkResult: string;
  readonly predictedScenarioOccurred: boolean;
  readonly directionCorrect: boolean;
  readonly timingCorrect: boolean;
  readonly magnitudeCorrect: boolean;
  readonly invalidationOccurred: boolean;
  readonly resolutionEvidence: ReadonlyArray<string>;
  readonly notes: string;
}

export interface PredictionRecord {
  readonly predictionId: string;
  readonly researchId: string;
  readonly opportunityId: string;
  readonly strategyVersion: string;
  readonly owner: string;
  readonly createdAt: string;
  readonly frozenAt: string;
  readonly dataTimestamp: string;
  readonly subjectType: PredictionSubjectType;
  readonly subject: string;
  readonly question: string;
  readonly timeHorizon: string;
  readonly expectedDirection: PredictionDirection;
  readonly expectedMagnitude: string;
  readonly expectedDuration: string;
  readonly benchmark?: string;
  readonly relatedInstruments: ReadonlyArray<string>;
  readonly outOfScope: ReadonlyArray<string>;
  readonly evidence: EvidenceSnapshot;
  readonly bullCase: PredictionScenario;
  readonly baseCase: PredictionScenario;
  readonly bearCase: PredictionScenario;
  readonly researchConfidence: ConfidenceLevel;
  readonly predictionConfidence: ConfidenceLevel;
  readonly opportunityConfidence: ConfidenceLevel;
  readonly invalidationConditions: ReadonlyArray<string>;

  status: PredictionStatus;
  amendmentHistory: ReadonlyArray<PredictionAmendment>;
  resolution?: PredictionResolution;
}
