/** Attributed pre-release observations. No actual, outcome or price direction. */
export type ExpectationType = 'CONSENSUS' | 'SINGLE_FORECAST' | 'MODEL_ESTIMATE' | 'MARKET_IMPLIED' | 'OWNER_EXPECTATION' | 'UNKNOWN';
export interface ExpectationIdentity {
  eventKey: string; metric: string; period: string; unit: string;
  adjustment: string; releaseVersion: string; valueMeaning: string;
}
export interface ExpectationValue extends ExpectationIdentity {
  id: string; type: ExpectationType; value: string | null;
  source: string; url: string; reference: string; locator: string;
  publishedAt: string | null; receivedAt: string;
  coverage: string; methodology: string; consensusBasis: 'SOURCE_SURVEY' | 'NOT_CONSENSUS';
}
export interface ExpectationRow {
  id: string; subject: ExpectationIdentity; forecasts: ExpectationValue[];
  /** An explicit source selection; conflicting forecasts are never averaged. */
  selectedConsensusId: string;
  alpha: ExpectationIdentity & {value: string | null; qualitative: 'WEAKER_THAN_CONSENSUS' | 'IN_LINE' | 'STRONGER_THAN_CONSENSUS' | 'UNKNOWN'; attribution: 'HOST_AI' | 'OWNER'; basis: string};
}
export interface ExpectationDifference {
  id: string; subject: ExpectationIdentity; market: ExpectationValue | null;
  forecasts: ExpectationValue[]; alpha: ExpectationRow['alpha'];
  numericDifference: string | null; qualitative: string; issues: string[]; meaning: string;
}
export interface ExpectationRequest {
  id: string; stage: 'RESEARCH' | 'FINAL_PRE_ENTRY'; supersedes: string;
  planKey: string; planVersion: string; comparisonPath: string; comparisonFingerprint: string;
  eventKey: string; releaseAt: string; rows: ExpectationRow[]; note: string;
  ownerConfirmed: boolean;
}
export interface ExpectationSnapshotReference {path: string; fingerprint: string; frozenAt: string}
export interface ExpectationSnapshot {
  version: 'OPTIONS_MARKET_EXPECTATION_V1'; ledgerId: string; request: ExpectationRequest;
  frozenAt: string; receivedAt: string; thesisFingerprint: string;
  ownerConfirmedAt: string | null; attribution: 'OWNER_CONFIRMED' | 'HOST_OR_OWNER_RESEARCH';
}
