export type Direction = 'UP' | 'DOWN' | 'UNKNOWN';
export type ReviewState = 'PASS' | 'FAIL' | 'UNKNOWN';
export interface Evidence {
  id: string; kind: 'FUNDAMENTAL' | 'NEWS' | 'TECHNICAL' | 'RISK' | 'STRUCTURE';
  source: string; publishedAt: string | null; receivedAt: string; reviewedAt: string;
}
export interface Facet {
  direction: Direction; status: 'SUPPORTED' | 'CONFLICT' | 'UNKNOWN';
  validFrom: string; validThrough: string; evidence: Evidence[];
  // Omitted preserves legacy all-required behavior. Unselected evidence remains background.
  requiredEvidenceIds?: string[];
}
export interface Candle {
  id: string; openAt: string; closeAt: string; receivedAt: string;
  open: number; high: number; low: number; close: number; volume: number | null;
  closed: boolean | null; interpolated: boolean | null;
}
export interface CandleSeries {
  symbol: string; exchange: string; provider: 'TRADINGVIEW' | 'ROBINHOOD' | 'OWNER_EXPORT';
  transport: 'SAVED_EXPORT' | 'MCP_SAVED_RECEIPT' | 'BROWSER_REFERENCE' | 'AUTOMATIC';
  sourceRef: string; timezone: string; intervalSeconds: number;
  session: 'REGULAR' | 'EXTENDED' | 'UNKNOWN';
  adjustment: 'UNADJUSTED' | 'SPLIT' | 'TOTAL_RETURN' | 'UNKNOWN';
  quality: 'REVIEWED' | 'UNKNOWN'; bars: Candle[];
}
export interface Anchor { barId: string; field: 'high' | 'low' | 'close'; }
export interface FibZone {
  role: 'SUPPORT' | 'RESISTANCE' | 'ENTRY' | 'CANCEL' | 'EXIT';
  method: 'RETRACEMENT' | 'CHANNEL'; fromRatio: number; toRatio: number;
}
export interface FibPlan {
  id: string; selectedAt: string; direction: 'UP' | 'DOWN'; scale: 'LINEAR' | 'LOG';
  selectionReason: string; retracement: [Anchor, Anchor]; channel: [Anchor, Anchor, Anchor];
  zones: FibZone[]; breakoutLevel: number; volumeBaselineBars: number; minimumVolumeRatio: number;
  maximumTriggerAgeSeconds: number;
}
export interface FrozenFibPlan {
  version: 'FROZEN_FIB_PLAN_V1'; plan: FibPlan; anchorSeries: CandleSeries;
  fingerprint: string;
}
export interface ControlReview { state: ReviewState; evidence: Evidence[]; }
export interface ObservedRetracementInput {
  symbol: string; asOf: string; receivedAt: string;
  evidenceCapturedAt: string | null; evidenceCapturePrecision: 'MINUTE' | 'SECOND' | 'UNKNOWN';
  anchorSelectedAt: string | null; sourceFrozenAt: string | null;
  source: { reference: string; feed: string; surface: string; timezone: string;
    priceScale: 'LINEAR' | 'LOG' | 'UNKNOWN'; regularSession: boolean | null;
    dividendAdjusted: boolean | null; splitAdjustment: 'VERIFIED' | 'UNKNOWN' | 'PLATFORM_DESCRIBED_NOT_INDEPENDENTLY_VERIFIED';
    splitAdjustmentSource?: string; timeframe?: '1h' | '1D';
    volumeScope: 'SOURCE_ONLY' | 'UNKNOWN' };
  anchors: { role: 'LOW' | 'HIGH'; barStartAt: string | null; barDate?: string; price: number;
    ohlc: { open: number; high: number; low: number; close: number };
    neighborValues: number[]; neighborBarsCompleted: boolean | null;
    neighborBarTimes: string[] | null }[];
  latestBar?: { start: string; end: string; close: number; volumeDisplay: string };
  latestDay?: { date: string; close: number; volumeDisplay: string; completed: boolean | null };
}
export interface ThreeFacetInput {
  version: 'THREE_FACET_INPUT_V1'; symbol: string; instrumentType: 'EQUITY' | 'ETF' | 'OPTION';
  asOf: string; holdingFrom: string; holdingThrough: string;
  fundamental?: (Facet & { basis: 'COMPANY' | 'ETF_COMPONENTS_VALUATION_MACRO';
    directionBasis: 'HOLDING_WINDOW_PRICE_THESIS' | 'OPERATING_TREND_ONLY' | 'UNKNOWN';
    directionRationale: string; operatingTrend?: Direction; reassessedNewsIds: string[] }) | null;
  news?: (Facet & {
    assumptionImpact: 'NONE' | 'MATERIAL' | 'UNKNOWN';
    materialChanges: { id: string; kind: 'EARNINGS' | 'ORDERS' | 'POLICY'; evidenceId: string }[];
    trigger: string; triggerState?: 'OBSERVED' | 'PENDING' | 'UNKNOWN'; eventAt?: string;
  }) | null;
  observedTechnical?: ObservedRetracementInput | null;
  // Original automatic source capture, consumed as descriptive evidence only.
  // Does not replace technical/frozen-plan, source quality or entry requirements.
  automaticBars?: { capture: unknown } | null;
  researchPlan?: {
    id: string; registeredAt: string; hypothesis: string; sourceIds: string[];
    triggerCondition: string; invalidationCondition: string; exitCondition: string;
  } | null;
  technical?: {
    facet: Facet; higher: CandleSeries; lower: CandleSeries; frozen: FrozenFibPlan;
  } | null;
  risk?: Partial<Record<'capital' | 'maximumLoss' | 'liquidity' | 'gap' | 'correlation' | 'exit', ControlReview>> | null;
  optionAlternatives?: {
    unhedged: ControlReview; alternative: ControlReview;
    alternativeKind: 'HEDGE' | 'DEFINED_RISK'; rationale: string; chosen: 'UNHEDGED' | 'ALTERNATIVE' | 'WAIT';
  } | null;
}
