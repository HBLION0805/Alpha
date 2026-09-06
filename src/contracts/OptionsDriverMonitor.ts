export interface OptionsDriverSource {
  readonly id: string;
  readonly label: string;
  readonly url: string;
  readonly maxHeadlineAgeHours: number;
}
export interface OptionsDriverObservation {
  readonly schemaVersion: "1.0";
  readonly sourceId: string;
  readonly sourceUrl: string;
  readonly itemId: string;
  readonly link: string;
  readonly headline: string;
  readonly publishedAt: string | null;
  readonly observedAt: string;
  readonly origin: "PUBLIC_FEED" | "MANUAL_SCENARIO";
  readonly contentFingerprint: string;
  readonly fingerprint: string;
}
export interface OptionsDriverSourceHealth {
  readonly sourceId: string;
  readonly status: "OK" | "EMPTY" | "FAILED" | "NOT_REFRESHED";
  readonly observedAt: string | null;
  readonly itemsReceived: number;
  readonly truncated: boolean;
  readonly diagnostic: string | null;
}
