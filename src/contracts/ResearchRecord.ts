export enum ConfidenceLevel {
  Low = "LOW",
  Medium = "MEDIUM",
  High = "HIGH",
}

export enum ResearchStatus {
  Draft = "DRAFT",
  InProgress = "IN_PROGRESS",
  Completed = "COMPLETED",
  Archived = "ARCHIVED",
}

export interface EvidenceItem {
  readonly statement: string;
  readonly source: string;
  readonly sourceTimestamp: string;
  readonly dataPeriod?: string;
  readonly confidence: ConfidenceLevel;
}

export interface EvidenceSnapshot {
  readonly verifiedFacts: ReadonlyArray<EvidenceItem>;
  readonly calculatedMetrics: ReadonlyArray<EvidenceItem>;
  readonly inferences: ReadonlyArray<string>;
  readonly assumptions: ReadonlyArray<string>;
  readonly unknowns: ReadonlyArray<string>;
}

export interface ResearchScope {
  included: ReadonlyArray<string>;
  excluded: ReadonlyArray<string>;
}

export interface ResearchRecord {
  researchId: string;
  strategyVersion: string;
  title: string;
  owner: string;
  objective: string;
  decisionSupported: string;
  scope: ResearchScope;
  timeHorizon: string;
  instrumentsCovered: ReadonlyArray<string>;
  dataTimestamp: string;
  createdAt: string;
  status: ResearchStatus;
  executiveSummary: string;
  evidence: EvidenceSnapshot;
}
