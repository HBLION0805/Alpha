export interface FocusedHeadline {
  sourceId: string;
  itemId: string;
  link: string;
  headline: string;
  publishedAt: string | null;
  observedAt: string;
  origin: "PUBLIC_FEED" | "MANUAL_SCENARIO";
}

export interface FocusedNewsHealth {
  id: string;
  label: string;
  kind: "PRIMARY_PUBLISHER" | "NEWS_REPORTING";
  status: string;
  observedAt: string | null;
  diagnostic: string | null;
  partial: boolean;
}
