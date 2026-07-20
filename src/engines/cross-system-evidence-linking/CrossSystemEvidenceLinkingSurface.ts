import {
  EvidenceEntityResolutionStatus,
  EvidenceEntityType,
  EvidenceLinkErrorCode,
  EvidenceLinkResolutionStatus,
  EvidenceLinkWarningCode,
  EvidenceRelationType,
  type CrossSystemEvidenceLinkRequest,
  type CrossSystemEvidenceLinkResult,
  type EvidenceAuditMetadata,
  type EvidenceEntityResolution,
  type EvidenceLink,
  type EvidenceLinkWarning,
  type EvidenceReference,
  type ResolvedEvidenceLink,
} from "../../contracts/CrossSystemEvidenceLink";
import {
  AlphaEvidenceEntityResolver,
  type CrossSystemEvidenceReadSources,
  type EvidenceEntityLookup,
} from "./CrossSystemEvidenceAdapters";

export interface AllowedEvidenceRelation {
  readonly relation: EvidenceRelationType;
  readonly source: EvidenceEntityType;
  readonly target: EvidenceEntityType;
}

export const ALLOWED_EVIDENCE_RELATIONS: ReadonlyArray<AllowedEvidenceRelation> = Object.freeze([
  relation(EvidenceRelationType.UsedStrategy, EvidenceEntityType.Prediction, EvidenceEntityType.StrategyVersion),
  relation(EvidenceRelationType.SupportedBy, EvidenceEntityType.Prediction, EvidenceEntityType.HistoricalPattern),
  relation(EvidenceRelationType.SupportedBy, EvidenceEntityType.Prediction, EvidenceEntityType.HistoricalAnalogy),
  relation(EvidenceRelationType.SupportedBy, EvidenceEntityType.StrategyVersion, EvidenceEntityType.HistoricalPattern),
  relation(EvidenceRelationType.SupportedBy, EvidenceEntityType.StrategyVersion, EvidenceEntityType.HistoricalAnalogy),
  relation(EvidenceRelationType.ComparedWith, EvidenceEntityType.HistoricalPattern, EvidenceEntityType.HistoricalAnalogy),
  relation(EvidenceRelationType.ReplayedBy, EvidenceEntityType.HistoricalPattern, EvidenceEntityType.EventReplay),
  relation(EvidenceRelationType.ReplayedBy, EvidenceEntityType.HistoricalAnalogy, EvidenceEntityType.EventReplay),
  relation(EvidenceRelationType.ResultedIn, EvidenceEntityType.Prediction, EvidenceEntityType.PredictionOutcome),
  relation(EvidenceRelationType.ResultedIn, EvidenceEntityType.EventReplay, EvidenceEntityType.PredictionOutcome),
  relation(EvidenceRelationType.DocumentedBy, EvidenceEntityType.Prediction, EvidenceEntityType.JournalEntry),
  relation(EvidenceRelationType.DocumentedBy, EvidenceEntityType.PredictionOutcome, EvidenceEntityType.JournalEntry),
  relation(EvidenceRelationType.DocumentedBy, EvidenceEntityType.EventReplay, EvidenceEntityType.JournalEntry),
  relation(EvidenceRelationType.LearnedFrom, EvidenceEntityType.StrategyVersion, EvidenceEntityType.PredictionOutcome),
  relation(EvidenceRelationType.LearnedFrom, EvidenceEntityType.StrategyVersion, EvidenceEntityType.JournalEntry),
]);

const MAX_LINKS_PER_REQUEST = 1000;
const allowedEntityTypes = new Set<string>(Object.values(EvidenceEntityType));
const allowedRelationTypes = new Set<string>(Object.values(EvidenceRelationType));
const allowedPairings = new Set(ALLOWED_EVIDENCE_RELATIONS.map((value) => pairingKey(value.source, value.relation, value.target)));

export class CrossSystemEvidenceLinkError extends Error {
  public constructor(
    public readonly code: EvidenceLinkErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CrossSystemEvidenceLinkError";
  }
}

/** Deterministic flat-link resolver over fixed, read-only repository ports. */
export class CrossSystemEvidenceLinkingSurface {
  private readonly resolver: AlphaEvidenceEntityResolver;

  public constructor(sources: CrossSystemEvidenceReadSources) {
    this.resolver = new AlphaEvidenceEntityResolver(sources);
  }

  public resolve(request: unknown): CrossSystemEvidenceLinkResult {
    const validated = validateRequest(request);
    const links = [...validated.links]
      .sort(compareLinks)
      .map((link) => this.resolveLink(link));
    const warnings = links.flatMap((link) => link.warnings);

    return Object.freeze({
      links: Object.freeze(links),
      warnings: Object.freeze(warnings),
      deterministic: true,
      readOnly: true,
    });
  }

  private resolveLink(link: EvidenceLink): ResolvedEvidenceLink {
    const source = resolveEndpoint(this.resolver.resolve(link.source), link.source, "SOURCE");
    const target = resolveEndpoint(this.resolver.resolve(link.target), link.target, "TARGET");
    const warnings = Object.freeze([...source.warnings, ...target.warnings]);

    return Object.freeze({
      linkId: link.linkId,
      source,
      relation: link.relation,
      target,
      status: source.status === EvidenceEntityResolutionStatus.Resolved
        && target.status === EvidenceEntityResolutionStatus.Resolved
        ? EvidenceLinkResolutionStatus.Resolved
        : EvidenceLinkResolutionStatus.Unresolved,
      warnings,
    });
  }
}

function resolveEndpoint(
  lookup: EvidenceEntityLookup,
  reference: EvidenceReference,
  endpoint: "SOURCE" | "TARGET",
): EvidenceEntityResolution {
  const stableReference = freezeReference(reference);
  if (lookup.availability === "REPOSITORY_UNAVAILABLE") {
    return unresolvedEntity(
      stableReference,
      EvidenceEntityResolutionStatus.RepositoryUnavailable,
      warning(EvidenceLinkWarningCode.RepositoryUnavailable, endpoint, reference, `Repository unavailable for ${reference.entityType}.`),
    );
  }
  if (lookup.availability === "NOT_FOUND") {
    return unresolvedEntity(
      stableReference,
      EvidenceEntityResolutionStatus.Unresolved,
      warning(EvidenceLinkWarningCode.EntityNotFound, endpoint, reference, `Entity '${reference.entityId}' was not found.`),
    );
  }

  const requestedVersion = reference.version;
  if (requestedVersion !== undefined && lookup.version === undefined) {
    return unresolvedEntity(
      stableReference,
      EvidenceEntityResolutionStatus.VersionUnavailable,
      warning(EvidenceLinkWarningCode.VersionUnavailable, endpoint, reference, `Entity '${reference.entityId}' does not expose a resolvable version.`),
      lookup,
    );
  }
  if (requestedVersion !== undefined && lookup.version !== requestedVersion) {
    return unresolvedEntity(
      stableReference,
      EvidenceEntityResolutionStatus.VersionMismatch,
      warning(EvidenceLinkWarningCode.VersionMismatch, endpoint, reference, `Requested version '${requestedVersion}' does not match resolved version '${lookup.version}'.`),
      lookup,
    );
  }

  return Object.freeze({
    reference: stableReference,
    status: EvidenceEntityResolutionStatus.Resolved,
    ...(lookup.version === undefined ? {} : { resolvedVersion: lookup.version }),
    ...(lookup.recordStatus === undefined ? {} : { recordStatus: lookup.recordStatus }),
    audit: freezeAudit(lookup.audit),
    warnings: Object.freeze([]),
  });
}

function unresolvedEntity(
  reference: EvidenceReference,
  status: EvidenceEntityResolutionStatus,
  value: EvidenceLinkWarning,
  lookup?: Extract<EvidenceEntityLookup, { readonly availability: "FOUND" }>,
): EvidenceEntityResolution {
  return Object.freeze({
    reference,
    status,
    ...(lookup?.version === undefined ? {} : { resolvedVersion: lookup.version }),
    ...(lookup?.recordStatus === undefined ? {} : { recordStatus: lookup.recordStatus }),
    audit: lookup ? freezeAudit(lookup.audit) : emptyAudit(),
    warnings: Object.freeze([value]),
  });
}

function validateRequest(value: unknown): CrossSystemEvidenceLinkRequest {
  if (!isRecord(value) || !Array.isArray(value.links) || value.links.length > MAX_LINKS_PER_REQUEST) {
    throw new CrossSystemEvidenceLinkError(EvidenceLinkErrorCode.MalformedRequest, "Request must contain at most 1000 explicit links.");
  }

  const linkIds = new Set<string>();
  const links = value.links.map((candidate, index) => validateLink(candidate, index, linkIds));
  return { links };
}

function validateLink(value: unknown, index: number, linkIds: Set<string>): EvidenceLink {
  if (!isRecord(value) || !validIdentifier(value.linkId)) {
    throw new CrossSystemEvidenceLinkError(EvidenceLinkErrorCode.MalformedRequest, `Link at index ${index} has an invalid linkId.`);
  }
  if (linkIds.has(value.linkId)) {
    throw new CrossSystemEvidenceLinkError(EvidenceLinkErrorCode.DuplicateLinkId, `Duplicate linkId '${value.linkId}'.`);
  }
  linkIds.add(value.linkId);

  const source = validateReference(value.source, `links[${index}].source`);
  const target = validateReference(value.target, `links[${index}].target`);
  if (typeof value.relation !== "string" || !allowedRelationTypes.has(value.relation)) {
    throw new CrossSystemEvidenceLinkError(EvidenceLinkErrorCode.UnsupportedRelationType, `Unsupported relation type '${String(value.relation)}'.`);
  }
  const relationType = value.relation as EvidenceRelationType;
  if (!allowedPairings.has(pairingKey(source.entityType, relationType, target.entityType))) {
    throw new CrossSystemEvidenceLinkError(
      EvidenceLinkErrorCode.InvalidRelationPairing,
      `${source.entityType} cannot relate to ${target.entityType} with ${relationType}.`,
    );
  }

  return Object.freeze({ linkId: value.linkId, source, relation: relationType, target });
}

function validateReference(value: unknown, path: string): EvidenceReference {
  if (!isRecord(value)) {
    throw new CrossSystemEvidenceLinkError(EvidenceLinkErrorCode.MalformedReference, `${path} must be an evidence reference.`);
  }
  if (typeof value.entityType !== "string" || !allowedEntityTypes.has(value.entityType)) {
    throw new CrossSystemEvidenceLinkError(EvidenceLinkErrorCode.UnsupportedEntityType, `Unsupported entity type '${String(value.entityType)}'.`);
  }
  if (!validIdentifier(value.entityId) || (value.version !== undefined && !validIdentifier(value.version))) {
    throw new CrossSystemEvidenceLinkError(EvidenceLinkErrorCode.MalformedReference, `${path} contains an invalid identifier or version.`);
  }

  return freezeReference({
    entityType: value.entityType as EvidenceEntityType,
    entityId: value.entityId,
    ...(value.version === undefined ? {} : { version: value.version }),
  });
}

function compareLinks(left: EvidenceLink, right: EvidenceLink): number {
  return left.linkId.localeCompare(right.linkId)
    || left.source.entityType.localeCompare(right.source.entityType)
    || left.source.entityId.localeCompare(right.source.entityId)
    || left.relation.localeCompare(right.relation)
    || left.target.entityType.localeCompare(right.target.entityType)
    || left.target.entityId.localeCompare(right.target.entityId);
}

function relation(relationType: EvidenceRelationType, source: EvidenceEntityType, target: EvidenceEntityType): AllowedEvidenceRelation {
  return Object.freeze({ relation: relationType, source, target });
}

function pairingKey(source: EvidenceEntityType, relationType: EvidenceRelationType, target: EvidenceEntityType): string {
  return `${source}|${relationType}|${target}`;
}

function warning(
  code: EvidenceLinkWarningCode,
  endpoint: "SOURCE" | "TARGET",
  reference: EvidenceReference,
  message: string,
): EvidenceLinkWarning {
  return Object.freeze({ code, endpoint, entityType: reference.entityType, entityId: reference.entityId, message });
}

function freezeReference(reference: EvidenceReference): EvidenceReference {
  return Object.freeze({
    entityType: reference.entityType,
    entityId: reference.entityId,
    ...(reference.version === undefined ? {} : { version: reference.version }),
  });
}

function freezeAudit(value: EvidenceAuditMetadata): EvidenceAuditMetadata {
  return Object.freeze({
    correlationIds: Object.freeze([...value.correlationIds]),
    traceIds: Object.freeze([...value.traceIds]),
    auditReferenceIds: Object.freeze([...value.auditReferenceIds]),
  });
}

function emptyAudit(): EvidenceAuditMetadata {
  return freezeAudit({ correlationIds: [], traceIds: [], auditReferenceIds: [] });
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256 && value.trim() === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
