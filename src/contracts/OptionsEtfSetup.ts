import type { GuidanceInput, GuidanceSymbol } from './OptionsDailyGuidance';

export interface EtfResearchBar {
  start: string; end: string;
  open: string; high: string; low: string; close: string; volume: number;
  complete: boolean; interpolated: boolean | null;
}
export interface EtfResearchBars {
  version: 'OPTIONS_ETF_BARS_V1'; symbol: GuidanceSymbol;
  intervalMinutes: 5; currency: 'USD'; session: 'REGULAR'; adjustment: 'RAW';
  volumeUnit: 'SHARES'; source: string; receivedAt: string;
  windowStart: string; windowEnd: string; bars: EtfResearchBar[];
}
export interface EtfSetupPlan {
  version: 'OPTIONS_ETF_SETUP_PLAN_V1'; id: string; symbol: GuidanceSymbol;
  side: 'BULLISH' | 'BEARISH'; setup: 'BREAKOUT' | 'PULLBACK' | 'KEY_LEVEL';
  activeFrom: string; timeExit: string;
  lower: string; upper: string; invalidation: string;
  fastBars: number; slowBars: number; bufferBps: number; chaseBps: number;
  volumeRatioBps: number; expiryBufferDays: number; targetDeltaBps: number;
}
export interface EtfSetupAssessmentInput {
  at: string; bars: EtfResearchBars | null;
  plan: { registeredAt: string; value: EtfSetupPlan } | null;
  guidance: GuidanceInput;
}
