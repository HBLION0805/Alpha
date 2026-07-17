import type { ResearchRecord } from "../contracts";

export interface ResearchRepository {
  create(record: Readonly<ResearchRecord>): Promise<void>;
  getById(researchId: string): Promise<Readonly<ResearchRecord> | undefined>;
  update(record: Readonly<ResearchRecord>): Promise<void>;
  delete(researchId: string): Promise<boolean>;
  list(): Promise<ReadonlyArray<Readonly<ResearchRecord>>>;
  exists(researchId: string): Promise<boolean>;
}
