import type {
  PredictionAmendment,
  PredictionRecord,
  PredictionResolution,
  PredictionStatus,
} from "../contracts";

export interface PredictionRepository {
  create(record: Readonly<PredictionRecord>): Promise<void>;
  getById(
    predictionId: string,
  ): Promise<Readonly<PredictionRecord> | undefined>;
  delete(predictionId: string): Promise<boolean>;
  list(): Promise<ReadonlyArray<Readonly<PredictionRecord>>>;
  exists(predictionId: string): Promise<boolean>;
  getByResearchId(
    researchId: string,
  ): Promise<ReadonlyArray<Readonly<PredictionRecord>>>;
  getByOpportunityId(
    opportunityId: string,
  ): Promise<ReadonlyArray<Readonly<PredictionRecord>>>;
  getByStatus(
    status: PredictionStatus,
  ): Promise<ReadonlyArray<Readonly<PredictionRecord>>>;
  updateStatus(predictionId: string, status: PredictionStatus): Promise<void>;
  recordAmendment(
    predictionId: string,
    amendment: Readonly<PredictionAmendment>,
  ): Promise<void>;
  recordResolution(
    predictionId: string,
    resolution: Readonly<PredictionResolution>,
  ): Promise<void>;
}
