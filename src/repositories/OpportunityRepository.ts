import type { OpportunityRecord, OpportunityState } from "../contracts";

export interface OpportunityRepository {
  create(record: Readonly<OpportunityRecord>): Promise<void>;
  getById(
    opportunityId: string,
  ): Promise<Readonly<OpportunityRecord> | undefined>;
  update(record: Readonly<OpportunityRecord>): Promise<void>;
  delete(opportunityId: string): Promise<boolean>;
  list(): Promise<ReadonlyArray<Readonly<OpportunityRecord>>>;
  exists(opportunityId: string): Promise<boolean>;
  getByResearchId(
    researchId: string,
  ): Promise<ReadonlyArray<Readonly<OpportunityRecord>>>;
  getByState(
    state: OpportunityState,
  ): Promise<ReadonlyArray<Readonly<OpportunityRecord>>>;
}
