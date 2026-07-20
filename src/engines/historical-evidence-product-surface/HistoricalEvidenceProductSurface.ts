import type {
  HistoricalPattern,
  HistoricalPatternRepository,
  HistoricalPredictionReference,
  HistoricalStrategyReference,
} from "../../contracts/HistoricalPattern";
import type {
  AnalogyPredictionReference,
  AnalogyStrategyReference,
  HistoricalAnalogyRecord,
  HistoricalAnalogyRepository,
} from "../../contracts/HistoricalAnalogy";
import type {
  EventReplayRepository,
  ReplayReference,
  ReplaySession,
  ReplayTimeline,
} from "../../contracts/EventReplay";

/**
 * Read-only repository methods needed to compose the historical evidence
 * product surface. Historical engines and their repositories remain the
 * authoritative owners of every returned record.
 */
export interface HistoricalEvidenceProductSurfaceSources {
  readonly historicalPatterns: Pick<HistoricalPatternRepository, "queryPatterns">;
  readonly historicalAnalogies: Pick<HistoricalAnalogyRepository, "query">;
  readonly eventReplays: Pick<EventReplayRepository, "query" | "getTimelineById">;
}

/** Optional explicit identifiers narrow the surface without creating rankings. */
export interface HistoricalEvidenceProductSurfaceRequest {
  readonly patternIds?: ReadonlyArray<string>;
  readonly analogyIds?: ReadonlyArray<string>;
  readonly replaySessionIds?: ReadonlyArray<string>;
}

export interface HistoricalEvidenceReplay {
  readonly session: ReplaySession;
  readonly timeline?: ReplayTimeline;
  readonly references: ReadonlyArray<ReplayReference>;
}

export interface HistoricalEvidenceProductReferences {
  readonly strategyVersions: ReadonlyArray<HistoricalStrategyReference | AnalogyStrategyReference>;
  readonly predictions: ReadonlyArray<HistoricalPredictionReference | AnalogyPredictionReference>;
}

/**
 * A stable, read-only response that presents existing historical records and
 * their already-recorded provenance. It intentionally adds no interpretation,
 * ranking, prediction, or historical calculation.
 */
export interface HistoricalEvidenceProductSurfaceResponse {
  readonly patterns: ReadonlyArray<HistoricalPattern>;
  readonly analogies: ReadonlyArray<HistoricalAnalogyRecord>;
  readonly replays: ReadonlyArray<HistoricalEvidenceReplay>;
  readonly references: HistoricalEvidenceProductReferences;
  readonly warnings: ReadonlyArray<string>;
  readonly deterministic: true;
  readonly readOnly: true;
}

export class HistoricalEvidenceProductSurface {
  public constructor(private readonly sources: HistoricalEvidenceProductSurfaceSources) {}

  public getEvidence(
    request: HistoricalEvidenceProductSurfaceRequest = {},
  ): HistoricalEvidenceProductSurfaceResponse {
    const patterns = selectById(
      this.sources.historicalPatterns.queryPatterns(),
      request.patternIds,
      (value) => value.patternId,
    );
    const analogies = selectById(
      this.sources.historicalAnalogies.query(),
      request.analogyIds,
      (value) => value.analogyId,
    );
    const sessions = selectById(
      this.sources.eventReplays.query(),
      request.replaySessionIds,
      (value) => value.sessionId,
    );
    const warnings: string[] = [];
    const replays = sessions.map((session) => {
      const timeline = this.sources.eventReplays.getTimelineById(session.timelineReference.timelineId);
      if (!timeline) {
        warnings.push(`Replay session '${session.sessionId}' references an unavailable timeline '${session.timelineReference.timelineId}'.`);
        return {
          session,
          references: session.references,
        };
      }

      return {
        session,
        timeline,
        references: session.references,
      };
    });

    return {
      patterns,
      analogies,
      replays,
      references: {
        strategyVersions: [
          ...patterns.flatMap((pattern) => pattern.references.strategies),
          ...analogies.flatMap((analogy) => analogy.strategyReferences),
        ],
        predictions: [
          ...patterns.flatMap((pattern) => pattern.references.predictions),
          ...analogies.flatMap((analogy) => analogy.predictionReferences),
        ],
      },
      warnings,
      deterministic: true,
      readOnly: true,
    };
  }
}

function selectById<T>(
  values: ReadonlyArray<T>,
  requestedIds: ReadonlyArray<string> | undefined,
  idOf: (value: T) => string,
): ReadonlyArray<T> {
  if (!requestedIds) {
    return values;
  }

  const requested = new Set(requestedIds);
  return values.filter((value) => requested.has(idOf(value)));
}
