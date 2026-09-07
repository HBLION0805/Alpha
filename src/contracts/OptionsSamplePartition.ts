export type OptionsSamplePartitionName = "TRAIN" | "VALIDATION" | "HOLDOUT";
export interface OptionsResearchSample {
  readonly sampleId: string;
  readonly symbol: "GLD" | "IBIT";
  readonly episodeId: string;
  readonly strategyVersion: string;
  readonly evidenceSha256: string;
  readonly observationKeys: readonly string[];
  readonly featureWindowStartAt: string | null;
  readonly decisionAt: string;
  readonly featuresKnownAt: string | null;
  readonly outcomeState: "CLOSED" | "NO_ENTRY" | "UNRESOLVED";
  readonly outcomeKnownAt: string | null;
}
export interface OptionsSamplePartitionInput {
  readonly version: "OPTIONS_SAMPLE_PARTITION_INPUT_V1";
  readonly datasetId: string;
  readonly origin: "SYNTHETIC_FIXTURE" | "UNVERIFIED_IMPORT";
  readonly protocol: { readonly reference: string; readonly sha256: string };
  readonly windows: Readonly<Record<OptionsSamplePartitionName, { readonly startAt: string; readonly endAt: string }>>;
  /** Elapsed-time separation, not a count of exchange sessions or an optimized parameter. */
  readonly minimumGapMs: number;
  readonly samples: readonly OptionsResearchSample[];
}
