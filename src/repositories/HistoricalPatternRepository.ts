import {
  HistoricalEventStatus, HistoricalPatternStatus,
  type HistoricalEvent, type HistoricalEventAmendment, type HistoricalEventHistory,
  type HistoricalEventReview, type HistoricalPattern, type HistoricalPatternAmendment,
  type HistoricalPatternHistoryEntry, type HistoricalPatternQuery, type HistoricalPatternReview,
  type HistoricalPatternSupersession,
} from "../contracts";

export type HistoricalRepositoryEvent =
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "HISTORICAL_EVENT_FINALIZED"; readonly acceptedAt: string; readonly record: HistoricalEvent }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "HISTORICAL_PATTERN_FINALIZED"; readonly acceptedAt: string; readonly record: HistoricalPattern }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "EVENT_AMENDMENT_APPENDED"; readonly acceptedAt: string; readonly amendment: HistoricalEventAmendment }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "PATTERN_AMENDMENT_APPENDED"; readonly acceptedAt: string; readonly amendment: HistoricalPatternAmendment }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "EVENT_REVIEW_APPENDED"; readonly acceptedAt: string; readonly review: HistoricalEventReview; readonly history: HistoricalEventHistory }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "PATTERN_REVIEW_APPENDED"; readonly acceptedAt: string; readonly review: HistoricalPatternReview; readonly history: HistoricalPatternHistoryEntry }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "PATTERN_SUPERSESSION_APPENDED"; readonly acceptedAt: string; readonly supersession: HistoricalPatternSupersession; readonly history: HistoricalPatternHistoryEntry }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "EVENT_ARCHIVED"; readonly acceptedAt: string; readonly history: HistoricalEventHistory }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "PATTERN_ARCHIVED"; readonly acceptedAt: string; readonly history: HistoricalPatternHistoryEntry };

function dateFloor(value: HistoricalEvent["start"]): number | undefined {
  if (value.precision === "UNKNOWN") return undefined; if (value.precision === "BOUNDED_RANGE") return value.earliest === undefined ? undefined : Date.parse(value.earliest); if (value.value === undefined) return undefined;
  if (value.precision === "YEAR") return Date.parse(`${value.value}-01-01T00:00:00.000Z`); if (value.precision === "QUARTER") { const [year, quarter] = value.value.split("-Q"); return Date.UTC(Number(year), (Number(quarter) - 1) * 3, 1); } if (value.precision === "MONTH") return Date.parse(`${value.value}-01T00:00:00.000Z`); return Date.parse(value.precision === "EXACT_DATE" ? `${value.value}T00:00:00.000Z` : value.value);
}
function hasReference(values: ReadonlyArray<{ readonly referenceId: string }>, id?: string): boolean { return id === undefined || values.some((value) => value.referenceId === id); }

export function matchesHistoricalEventQuery(record: HistoricalEvent, query: HistoricalPatternQuery = {}): boolean {
  const filter = query.filter; if (filter === undefined) return true; const start = dateFloor(record.start);
  return (filter.recordKinds === undefined || filter.recordKinds.includes("EVENT" as never))
    && (filter.eventCategories === undefined || filter.eventCategories.some((value) => record.eventCategories.includes(value)))
    && (filter.statuses === undefined || filter.statuses.includes(record.status))
    && (filter.currentOnly !== true || ![HistoricalEventStatus.Superseded, HistoricalEventStatus.Archived].includes(record.status))
    && (filter.fromDate === undefined || start === undefined || start >= Date.parse(filter.fromDate))
    && (filter.toDate === undefined || start === undefined || start <= Date.parse(filter.toDate))
    && (filter.geography === undefined || record.geography.includes(filter.geography))
    && (filter.market === undefined || record.affectedMarkets.includes(filter.market))
    && (filter.assetClass === undefined || record.affectedAssetClasses.includes(filter.assetClass))
    && (filter.regimeDimension === undefined || record.marketRegime.dimensions.some((value) => value.dimension === filter.regimeDimension && (filter.regimeValue === undefined || value.value === filter.regimeValue)))
    && hasReference(record.references.research, filter.researchId) && hasReference(record.references.strategies, filter.strategyId)
    && (filter.tags === undefined || filter.tags.every((tag) => record.tags.includes(tag)));
}

export function matchesHistoricalPatternQuery(record: HistoricalPattern, query: HistoricalPatternQuery = {}): boolean {
  const filter = query.filter; if (filter === undefined) return true;
  return (filter.recordKinds === undefined || filter.recordKinds.includes("PATTERN" as never))
    && (filter.patternTypes === undefined || filter.patternTypes.includes(record.patternType))
    && (filter.statuses === undefined || filter.statuses.includes(record.status))
    && (filter.currentOnly !== true || ![HistoricalPatternStatus.Superseded, HistoricalPatternStatus.Archived].includes(record.status))
    && (filter.sourceEventId === undefined || record.sourceEventIds.includes(filter.sourceEventId))
    && (filter.regimeDimension === undefined || record.regimeDependencies.some((value) => value.dimension === filter.regimeDimension && (filter.regimeValue === undefined || value.value === filter.regimeValue)))
    && hasReference(record.references.research, filter.researchId) && hasReference(record.references.strategies, filter.strategyId)
    && (filter.tags === undefined || filter.tags.every((tag) => record.tags.includes(tag)));
}
