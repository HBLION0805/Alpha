import type { HistoricalPattern } from "../../contracts/HistoricalPattern";
import type { HistoricalAnalogyRecord } from "../../contracts/HistoricalAnalogy";
import type { ReplaySession, ReplayTimeline } from "../../contracts/EventReplay";
import { HistoricalEvidenceProductSurface } from "./HistoricalEvidenceProductSurface";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

const pattern = {
  patternId: "historical-pattern:liquidity",
  recordVersion: "1.0",
  confidence: { score: 8400, rationale: "Frozen source evidence" },
  references: {
    strategies: [{ referenceId: "strategy:core", recordType: "STRATEGY", resolution: "RESOLVED", version: "3.0", frozenStatus: "APPROVED" }],
    predictions: [{ referenceId: "prediction:liquidity", recordType: "PREDICTION", resolution: "RESOLVED", version: "1.0", frozenStatus: "LOGGED" }],
  },
} as unknown as HistoricalPattern;

const analogy = {
  analogyId: "historical-analogy:liquidity",
  recordVersion: "1.0",
  confidence: { score: 7900, level: "MODERATE", policyVersion: "1.0", reasonCodes: ["FROZEN_EVIDENCE"] },
  strategyReferences: [{ strategyId: "strategy:hedge", strategyVersion: "2.0", frozenStatus: "APPROVED", limitationIds: [], regimeDifferenceIds: [] }],
  predictionReferences: [{ predictionId: "prediction:analogy", predictionVersion: "1.0", frozenStatus: "LOGGED", analogyScoreMethod: "WEIGHTED_DIMENSION_V1", weightProfileId: "profile:one", weightProfileVersion: "1.0", limitationIds: [] }],
} as unknown as HistoricalAnalogyRecord;

const timeline = {
  timelineId: "replay-timeline:liquidity",
  timelineVersion: "1.0",
  title: "Liquidity event replay",
  patternReferences: [],
  analogyReferences: [],
  supportingEvidenceReferences: [],
} as unknown as ReplayTimeline;

const session = {
  sessionId: "replay-session:liquidity",
  timelineReference: { timelineId: timeline.timelineId, timelineVersion: timeline.timelineVersion },
  references: [{ referenceId: "replay-reference:one", referenceType: "HISTORICAL_PATTERN", sourceId: pattern.patternId, sourceVersion: "1.0", resolved: true }],
} as unknown as ReplaySession;

function surface(options: { readonly includeTimeline?: boolean; readonly alternatePattern?: HistoricalPattern } = {}): HistoricalEvidenceProductSurface {
  const patterns = options.alternatePattern ? [pattern, options.alternatePattern] : [pattern];
  return new HistoricalEvidenceProductSurface({
    historicalPatterns: { queryPatterns: () => patterns },
    historicalAnalogies: { query: () => [analogy] },
    eventReplays: {
      query: () => [session],
      getTimelineById: (id) => options.includeTimeline === false || id !== timeline.timelineId ? undefined : timeline,
    },
  });
}

const tests: ReadonlyArray<{ readonly name: string; readonly run: () => void }> = [
  {
    name: "returns existing historical records with their recorded evidence references",
    run: () => {
      const result = surface().getEvidence();
      assertEqual(result.patterns[0], pattern, "pattern identity");
      assertEqual(result.analogies[0], analogy, "analogy identity");
      assertEqual(result.replays[0]?.session, session, "session identity");
      assertEqual(result.replays[0]?.timeline, timeline, "timeline identity");
      assertEqual(result.replays[0]?.references, session.references, "replay references");
      assertEqual(result.references.strategyVersions.length, 2, "strategy references");
      assertEqual(result.references.predictions.length, 2, "prediction references");
      assertEqual(result.deterministic, true, "deterministic");
      assertEqual(result.readOnly, true, "read only");
    },
  },
  {
    name: "filters only by caller-selected identifiers without ranking records",
    run: () => {
      const other = { ...pattern, patternId: "historical-pattern:other" } as HistoricalPattern;
      const result = surface({ alternatePattern: other }).getEvidence({ patternIds: [other.patternId] });
      assertDeepEqual(result.patterns.map((value) => value.patternId), [other.patternId], "selected patterns");
      assertEqual(result.analogies.length, 1, "unfiltered analogies");
      assertEqual(result.replays.length, 1, "unfiltered replays");
    },
  },
  {
    name: "preserves replay sessions when a referenced timeline is unavailable",
    run: () => {
      const result = surface({ includeTimeline: false }).getEvidence({ replaySessionIds: [session.sessionId] });
      assertEqual(result.replays[0]?.session, session, "preserved session");
      assertEqual(result.replays[0]?.timeline, undefined, "unavailable timeline");
      assertEqual(result.warnings.length, 1, "warning count");
    },
  },
  {
    name: "does not expose mutation operations through its source boundary",
    run: () => {
      const sources = (surface() as unknown as {
        readonly sources: {
          readonly historicalPatterns: object;
          readonly historicalAnalogies: object;
          readonly eventReplays: object;
        };
      }).sources;
      assertEqual("appendPattern" in sources.historicalPatterns, false, "pattern mutation");
      assertEqual("appendAnalogy" in sources.historicalAnalogies, false, "analogy mutation");
      assertEqual("appendSession" in sources.eventReplays, false, "replay mutation");
    },
  },
];

let passed = 0;
for (const test of tests) {
  test.run();
  passed += 1;
}

console.log(`Historical evidence product surface: ${passed}/${tests.length} tests passed`);
