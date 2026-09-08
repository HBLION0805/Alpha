import type { GuidanceEquity, GuidanceEvent, GuidanceQuote, GuidanceSettings } from './OptionsDailyGuidance';

export interface EventResearchPlan {
  version: 'OPTIONS_EVENT_RESEARCH_PLAN_V1';
  id: string; title: string; createdAt: string;
  event: GuidanceEvent; selectionCapturePath: string;
  preContract: GuidanceQuote; postCall: GuidanceQuote; postPut: GuidanceQuote;
  settings: GuidanceSettings;
  preEntryAt: string; preExitAt: string; postEntryAt: string; postExitAt: string;
  minimumMoveBps: number;
}
export interface EventResearchFrame {
  path: string; recordedAt: string; capturedAt: string; origin: string;
  quotes: GuidanceQuote[]; equities: GuidanceEquity[];
}
