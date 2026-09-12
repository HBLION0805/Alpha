export interface ReactionEvent {
  key: string;
  title: string;
  source: "BLS" | "FOMC";
  startDate: string;
  endDate: string;
  scheduledAt: string | null;
  status: string;
  calendarReceivedAt: string;
}
export interface ReactionFrame {
  path: string;
  recordedAt: string;
  capturedAt: string;
  equityReceivedAt: string | null;
  origin: string;
  equities: readonly { symbol: "GLD" | "IBIT"; price: string | null; sourceAt: string | null }[];
}
export interface ReactionNote {
  path: string;
  recordedAt: string;
  assessedAt: string;
  assets: readonly { symbol: string; bias: string; summary: string;
    sources: readonly { retrievedAt: string }[] }[];
}
export interface EventReactionInput {
  at: string;
  events: readonly ReactionEvent[];
  frames: readonly ReactionFrame[];
  notes: readonly ReactionNote[];
  origin: "HOST_MARKET_TOOL_RESPONSES" | "SYNTHETIC_FIXTURE";
}
