import type { LearningRecord } from "../contracts";

export interface LearningRepository {
  create(record: Readonly<LearningRecord>): Promise<void>;
  getById(learningId: string): Promise<Readonly<LearningRecord> | undefined>;
  update(record: Readonly<LearningRecord>): Promise<void>;
  delete(learningId: string): Promise<boolean>;
  list(): Promise<ReadonlyArray<Readonly<LearningRecord>>>;
  exists(learningId: string): Promise<boolean>;
  getByTradeId(
    tradeId: string,
  ): Promise<ReadonlyArray<Readonly<LearningRecord>>>;
  getByStrategyVersion(
    strategyVersion: string,
  ): Promise<ReadonlyArray<Readonly<LearningRecord>>>;
}
