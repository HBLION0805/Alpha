import type { OptionsPlanningFeasibilityInput, OptionsTradeBudget } from "./OptionsTradeBudget";
export type GuidanceSymbol = "GLD" | "IBIT";
export interface GuidanceQuote {
  id: string; symbol: GuidanceSymbol; expiry: string; type: "call" | "put";
  strike: string; multiplier: number; bidCents: number | null; askCents: number | null;
  tickCents: number | null; bidSize: number | null; askSize: number | null;
  delta: number | null; updatedAt: string | null; receivedAt: string;
}
export interface GuidanceEquity {
  symbol: GuidanceSymbol; price: string | null; sourceAt: string | null;
  close: { date: string; price: string } | null;
}
export interface GuidanceEvent {
  title: string; source: string; startDate: string; endDate: string;
  scheduledAt: string | null;
}
export interface GuidanceSettings {
  currentEquityCents: number; settledCashCents: number;
  roundTripFeesCents: number | null; slippageReserveCents: number | null;
  stopLossBps: number; rewardMultipleMilliR: number;
  tradeBudget?: OptionsTradeBudget;
}
export interface GuidanceInput {
  version: "OPTIONS_DAILY_GUIDANCE_INPUT_V1"; at: string;
  captureAt: string | null; captureOrigin: string | null; captureComplete: boolean;
  quotes: GuidanceQuote[]; equities: GuidanceEquity[];
  closeHistory: { symbol: GuidanceSymbol; date: string; price: string }[];
  events: GuidanceEvent[]; calendarAvailable: boolean; headlinesAvailable: boolean;
  sourceHealth: { id: string; status: string; receivedAt: string | null }[];
  headlines: { title: string; url: string; publishedAt: string | null; receivedAt: string }[];
  context: { treasury: unknown; btc: unknown };
  settings: GuidanceSettings;
  /** Optional for the first saved pre-analysis smoke; present in current issued views. */
  analyst?: { assessedAt: string; assets: { symbol: GuidanceSymbol; bias: string; summary: string; sources: { url: string; retrievedAt: string }[] }[] } | null;
}
export type GuidanceScenario = OptionsPlanningFeasibilityInput;
