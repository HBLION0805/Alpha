import type {
  DecisionRecord,
  OwnerApprovalStatus,
} from "../contracts";

export interface DecisionApprovalUpdate {
  readonly ownerApprovalStatus: OwnerApprovalStatus;
  readonly approvalTimestamp?: string;
  readonly approvalNote?: string;
  readonly rejectionReason?: string;
}

export interface DecisionRepository {
  create(record: Readonly<DecisionRecord>): Promise<void>;
  getById(decisionId: string): Promise<Readonly<DecisionRecord> | undefined>;
  delete(decisionId: string): Promise<boolean>;
  list(): Promise<ReadonlyArray<Readonly<DecisionRecord>>>;
  exists(decisionId: string): Promise<boolean>;
  getByOpportunityId(
    opportunityId: string,
  ): Promise<ReadonlyArray<Readonly<DecisionRecord>>>;
  getByPredictionId(
    predictionId: string,
  ): Promise<ReadonlyArray<Readonly<DecisionRecord>>>;
  updateApproval(
    decisionId: string,
    approval: Readonly<DecisionApprovalUpdate>,
  ): Promise<void>;
}
