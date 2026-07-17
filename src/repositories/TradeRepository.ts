import type {
  ActualExecution,
  TradeOutcome,
  TradeRecord,
  TradeStatus,
} from "../contracts";

export interface TradeRepository {
  create(record: Readonly<TradeRecord>): Promise<void>;
  getById(tradeId: string): Promise<Readonly<TradeRecord> | undefined>;
  delete(tradeId: string): Promise<boolean>;
  list(): Promise<ReadonlyArray<Readonly<TradeRecord>>>;
  exists(tradeId: string): Promise<boolean>;
  getByStatus(
    status: TradeStatus,
  ): Promise<ReadonlyArray<Readonly<TradeRecord>>>;
  getByResearchId(
    researchId: string,
  ): Promise<ReadonlyArray<Readonly<TradeRecord>>>;
  getByOpportunityId(
    opportunityId: string,
  ): Promise<ReadonlyArray<Readonly<TradeRecord>>>;
  getByPredictionId(
    predictionId: string,
  ): Promise<ReadonlyArray<Readonly<TradeRecord>>>;
  getByDecisionId(
    decisionId: string,
  ): Promise<ReadonlyArray<Readonly<TradeRecord>>>;
  updateStatus(tradeId: string, status: TradeStatus): Promise<void>;
  recordExecution(
    tradeId: string,
    execution: Readonly<ActualExecution>,
  ): Promise<void>;
  recordOutcome(
    tradeId: string,
    outcome: Readonly<TradeOutcome>,
  ): Promise<void>;
}
