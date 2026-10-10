import type { ThreeFacetInput } from './OptionsThreeFacet';
import type { SnapshotQuote } from '../engines/options-robinhood-data/RobinhoodSnapshotPaper';
export type TechSymbol = 'AAPL' | 'TSM' | 'QQQ';
export type TechSnapshotQuote = Omit<SnapshotQuote, 'symbol'> & {symbol: TechSymbol};
export type TechEvidenceKind = 'CONTRACT' | 'DATA_ENTITLEMENT' | 'PRODUCT_PERMISSION' | 'ACCOUNT_FUNDS' | 'RISK_LIMITS' | 'QUOTE';
export interface TechEvidenceRecord {
  kind: TechEvidenceKind; origin: 'OWNER_DOCUMENT' | 'PROVIDER_DOCUMENT' | 'SYNTHETIC_FIXTURE';
  source: string; observedAt: string; receivedAt: string; reviewedAt: string;
  validThrough: string; reviewedBy: string; verdict: 'PASS' | 'FAIL' | 'UNKNOWN';
  rawJson: string; sha256: string;
}
export interface TechPaperEvidence {
  version: 'TECH_PAPER_EVIDENCE_V1'; symbol: TechSymbol; accountId: string;
  quantity: number; decisionAt: string; entryDeadlineAt: string; timeExitAt: string;
  costsFrozenAt: string; entryFeeCents: number | null; exitFeeCents: number | null;
  exitSlippageCents: number | null; entryLimitCents: number; maxSpreadCents: number;
  records: TechEvidenceRecord[];
}
export interface TechPaperRequest {
  research: ThreeFacetInput; evidence?: TechPaperEvidence | null; at: string;
}
