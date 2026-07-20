import {
  EvidenceEntityType,
  type EvidenceAuditMetadata,
  type EvidenceReference,
} from "../../contracts/CrossSystemEvidenceLink";
import type { EventReplayRepository } from "../../contracts/EventReplay";
import type { HistoricalAnalogyRepository } from "../../contracts/HistoricalAnalogy";
import type { HistoricalPatternRepository } from "../../contracts/HistoricalPattern";
import type { AlphaJournalRepository } from "../../repositories/AlphaJournalRepository";
import type { PredictionLogRepository } from "../../repositories/PredictionRepository";
import type { StrategyRepository } from "../../repositories/StrategyVersionRepository";

export interface CrossSystemEvidenceReadSources {
  readonly predictions?: Pick<PredictionLogRepository, "getById" | "allOutcomes">;
  readonly strategies?: Pick<StrategyRepository, "getVersion">;
  readonly historicalPatterns?: Pick<HistoricalPatternRepository, "getPatternById">;
  readonly historicalAnalogies?: Pick<HistoricalAnalogyRepository, "getAnalogyById">;
  readonly eventReplays?: Pick<EventReplayRepository, "getSessionById">;
  readonly journal?: Pick<AlphaJournalRepository, "getById">;
}

export type EvidenceEntityLookup =
  | { readonly availability: "FOUND"; readonly version?: string; readonly recordStatus?: string; readonly audit: EvidenceAuditMetadata }
  | { readonly availability: "NOT_FOUND" }
  | { readonly availability: "REPOSITORY_UNAVAILABLE" };

export interface EvidenceEntityResolver {
  resolve(reference: EvidenceReference): EvidenceEntityLookup;
}

/** Fixed adapter over existing read ports; it cannot invoke arbitrary repositories. */
export class AlphaEvidenceEntityResolver implements EvidenceEntityResolver {
  public constructor(private readonly sources: CrossSystemEvidenceReadSources) {}

  public resolve(reference: EvidenceReference): EvidenceEntityLookup {
    switch (reference.entityType) {
      case EvidenceEntityType.Prediction: {
        const repository = this.sources.predictions;
        if (!repository) return unavailable();
        const record = repository.getById(reference.entityId);
        return record
          ? found(record.version.predictionVersion, record.status, audit(
              [],
              record.evidence.auditReferences.flatMap((value) => value.traceId ? [value.traceId] : []),
              record.evidence.auditReferences.map((value) => value.auditId),
            ))
          : notFound();
      }
      case EvidenceEntityType.PredictionOutcome: {
        const repository = this.sources.predictions;
        if (!repository) return unavailable();
        const record = repository.allOutcomes().find((value) => value.outcomeId === reference.entityId);
        return record
          ? found(undefined, undefined, audit(
              [],
              record.evidenceReferences.flatMap((value) => value.traceId ? [value.traceId] : []),
              record.evidenceReferences.map((value) => value.auditId),
            ))
          : notFound();
      }
      case EvidenceEntityType.StrategyVersion: {
        const repository = this.sources.strategies;
        if (!repository) return unavailable();
        const record = repository.getVersion(reference.entityId);
        return record
          ? found(record.semanticVersion, record.status, audit(
              [record.correlationId],
              [record.traceId],
              record.references.audits.map((value) => value.referenceId),
            ))
          : notFound();
      }
      case EvidenceEntityType.HistoricalPattern: {
        const repository = this.sources.historicalPatterns;
        if (!repository) return unavailable();
        const record = repository.getPatternById(reference.entityId);
        return record
          ? found(record.recordVersion, record.status, audit(
              [record.correlationId],
              [record.traceId],
              record.references.audits.map((value) => value.referenceId),
            ))
          : notFound();
      }
      case EvidenceEntityType.HistoricalAnalogy: {
        const repository = this.sources.historicalAnalogies;
        if (!repository) return unavailable();
        const record = repository.getAnalogyById(reference.entityId);
        return record
          ? found(record.recordVersion, record.status, audit(
              [record.correlationId],
              [record.traceId],
              record.auditReference ? [record.auditReference.auditId] : [],
            ))
          : notFound();
      }
      case EvidenceEntityType.EventReplay: {
        const repository = this.sources.eventReplays;
        if (!repository) return unavailable();
        const record = repository.getSessionById(reference.entityId);
        return record
          ? found(record.sessionVersion, record.status, audit([record.correlationId], [record.traceId], []))
          : notFound();
      }
      case EvidenceEntityType.JournalEntry: {
        const repository = this.sources.journal;
        if (!repository) return unavailable();
        const record = repository.getById(reference.entityId);
        return record
          ? found(undefined, record.status, audit(
              [record.correlationId],
              [record.traceId],
              record.evidence.audits.map((value) => value.referenceId),
            ))
          : notFound();
      }
    }
  }
}

function found(
  version: string | undefined,
  recordStatus: string | undefined,
  value: EvidenceAuditMetadata,
): EvidenceEntityLookup {
  return {
    availability: "FOUND",
    ...(version === undefined ? {} : { version }),
    ...(recordStatus === undefined ? {} : { recordStatus }),
    audit: value,
  };
}

function notFound(): EvidenceEntityLookup {
  return { availability: "NOT_FOUND" };
}

function unavailable(): EvidenceEntityLookup {
  return { availability: "REPOSITORY_UNAVAILABLE" };
}

function audit(
  correlationIds: ReadonlyArray<string>,
  traceIds: ReadonlyArray<string>,
  auditReferenceIds: ReadonlyArray<string>,
): EvidenceAuditMetadata {
  return {
    correlationIds: orderedUnique(correlationIds),
    traceIds: orderedUnique(traceIds),
    auditReferenceIds: orderedUnique(auditReferenceIds),
  };
}

function orderedUnique(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
