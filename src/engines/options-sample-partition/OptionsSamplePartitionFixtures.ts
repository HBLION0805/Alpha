import type { OptionsSamplePartitionInput, OptionsResearchSample } from "../../contracts/OptionsSamplePartition";
import { readinessFingerprint } from "../options-readiness/OptionsReadinessEngine";

export function samplePartitionFixture(): OptionsSamplePartitionInput {
  const samples: OptionsResearchSample[] = [8, 9, 15, 16, 22, 23].map((day, index) => {
    const date = `2026-09-${day.toString().padStart(2, "0")}`, sampleId = `synthetic-sample-${index + 1}`;
    return { sampleId, symbol: index % 2 ? "IBIT" : "GLD", episodeId: sampleId + ":episode", strategyVersion: "declared-v1",
      evidenceSha256: readinessFingerprint({ sampleId }), observationKeys: [sampleId + ":quote"],
      featureWindowStartAt: date + "T13:30:00.000Z", decisionAt: date + "T14:00:00.000Z", featuresKnownAt: date + "T13:59:00.000Z",
      outcomeState: index === 3 ? "NO_ENTRY" : "CLOSED", outcomeKnownAt: date + "T15:00:00.000Z" };
  });
  return { version: "OPTIONS_SAMPLE_PARTITION_INPUT_V1", datasetId: "synthetic-sample-partitions", origin: "SYNTHETIC_FIXTURE",
    protocol: { reference: "synthetic-protocol-v1", sha256: readinessFingerprint({ protocol: "synthetic-v1" }) }, minimumGapMs: 86400000,
    windows: { TRAIN: { startAt: "2026-09-08T00:00:00.000Z", endAt: "2026-09-11T00:00:00.000Z" },
      VALIDATION: { startAt: "2026-09-15T00:00:00.000Z", endAt: "2026-09-18T00:00:00.000Z" },
      HOLDOUT: { startAt: "2026-09-22T00:00:00.000Z", endAt: "2026-09-25T00:00:00.000Z" } }, samples };
}
export function samplePartitionDemo(): OptionsSamplePartitionInput[] {
  const clean = samplePartitionFixture(), base = samplePartitionFixture();
  const samples = base.samples.map(s => ({ ...s }));
  samples[0]!.observationKeys = samples[4]!.observationKeys;
  samples[1]!.outcomeKnownAt = base.windows.TRAIN.endAt;
  samples[2]!.featuresKnownAt = "2026-09-15T14:01:00.000Z";
  samples[5]!.outcomeState = "UNRESOLVED"; samples[5]!.outcomeKnownAt = null;
  return [clean, { ...base, datasetId: "synthetic-overlap-and-unknown", samples }];
}
