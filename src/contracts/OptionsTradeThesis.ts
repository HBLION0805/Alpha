import type { ManualTradePlan, ManualOptionIdentity } from './OptionsManualLedger';
import type { EtfResearchBars } from './OptionsEtfSetup';
import type {ExpectationSnapshotReference,ExpectationDifference} from './OptionsMarketExpectation';

export interface ThesisCondition {
  id: string;
  kind: 'PRICE' | 'EVENT_NUMERIC' | 'OWNER_CONFIRMED';
  basis: string; checkAt: string; missingAction: string;
  // Empty draft fields never acquire defaults during confirmation.
  target: string; comparator: string; threshold: string; warningThreshold: string;
  confirmation: string; confirmationMinutes: string; confirmationCount: string; bufferUsd: string;
  eventKey: string; metric: string; period: string; unit: string; releaseVersion: string;
  releaseAt: string; expectationRef: string; expectationValue: string; source: string;
  invalidation: string;
}
export interface TradeThesis {
  version: 'OPTIONS_TRADE_THESIS_V1'; template: 'CUSTOM' | 'CLOSE_ENTRY_OPEN_REVIEW';
  decisionId: string; tradeDate: string; realizationStartAt: string; realizationEndAt: string;
  nextCheckAt: string; holdThroughEvent: 'YES' | 'NO' | 'NOT_APPLICABLE' | '';
  manualFallback: string; conditions: ThesisCondition[];
  /** Optional entry-only confirmation. Absent on historical plans; never inferred as permission. */
  eventEntry?: EventEntryConfirmation;
  expectationSnapshot?: ExpectationSnapshotReference;
}
export interface EventEntryConfirmation {
  phase: '' | 'PRE_EVENT' | 'POST_EVENT'; conditionId: string;
  calendarVerifiedAt: string; calendarSource: string;
  expectationStatus: '' | 'AVAILABLE' | 'UNAVAILABLE'; expectationBasis: string;
  differenceBasis: string; supportingScenario: string; neutralScenario: string;
  reverseScenario: string; counterexample: string; reviewer: string;
  gapRiskAccepted: boolean; closedMarketRiskAccepted: boolean;
}
export interface EventEntryContext {
  key: string; version: string; kind: 'DRAFT' | 'FROZEN'; symbol: string;
  plan: ThesisPlan; contract: ManualOptionIdentity | null; registeredAt: string; openedAt: string | null;
  calendar: {key: string; title: string; source: string; scheduledAt: string | null; receivedAt: string | null}[];
  expectation?: {status:string;rows:ExpectationDifference[];blockers:string[];[key:string]:unknown};
}
export interface ThesisOwnerEvidence {
  conditionId: string; source: string; sourceAt: string; receivedAt: string;
  savedAt: string; confirmation: 'OWNER_CONFIRMED';
  eventKey: string; metric: string; period: string; unit: string; releaseVersion: string;
  value: string; judgment: 'SUPPORTED' | 'WARNING' | 'INVALIDATED' | '';
  explanation: string; comparisonRef: string;
}
export interface ThesisMarketEvidence {
  price: null | {symbol: string; price: string | null; sourceAt: string | null; receivedAt: string | null;
    recordedAt: string; path: string; fingerprint: string; origin: string};
  bars: null | {value: EtfResearchBars | null; qualified: boolean; conflicted: boolean;
    recordedAt: string; path: string; fingerprint: string; origin: string};
  gaps: string[];
}
export interface ThesisDraft {
  fields: Record<string, string | boolean>;
  thesis: TradeThesis;
}
export type ThesisPlan = ManualTradePlan & { invalidation?: TradeThesis };
export type ThesisPlanContext = { plan: ThesisPlan; contract: ManualOptionIdentity; registeredAt: string; openedAt: string | null };
