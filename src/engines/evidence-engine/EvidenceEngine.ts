import {
  EVIDENCE_ASSESSMENT_SCHEMA_VERSION,
  EvidenceAssessmentBlockerCode,
  EvidenceAssessmentErrorCode,
  EvidenceAssessmentStatus,
  EvidenceAssessmentWarningCode,
  EvidenceConflictReason,
  EvidenceDimension,
  EvidenceDimensionStatus,
  EvidenceItemResolutionStatus,
  EvidenceRequirement,
  type AssessedEvidenceItem,
  type EvidenceAssessment,
  type EvidenceAssessmentIssue,
  type EvidenceAssessmentPolicy,
  type EvidenceAssessmentRequest,
  type EvidenceConflictInput,
  type EvidenceDimensionAssessment,
  type EvidenceFreshnessRule,
} from "../../contracts/EvidenceEngine";
import {
  EvidenceEntityResolutionStatus,
  EvidenceEntityType,
  EvidenceLinkResolutionStatus,
  EvidenceRelationType,
  type EvidenceAuditMetadata,
  type EvidenceEntityResolution,
  type EvidenceReference,
  type ResolvedEvidenceLink,
} from "../../contracts/CrossSystemEvidenceLink";
import { ALLOWED_EVIDENCE_RELATIONS } from "../cross-system-evidence-linking/CrossSystemEvidenceLinkingSurface";

const MAX_EVIDENCE_ITEMS = 1000;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const FIELD_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/\[\]-]{0,159}$/u;
const entityTypes = new Set<string>(Object.values(EvidenceEntityType));
const relationTypes = new Set<string>(Object.values(EvidenceRelationType));
const entityResolutionStatuses = new Set<string>(Object.values(EvidenceEntityResolutionStatus));
const linkResolutionStatuses = new Set<string>(Object.values(EvidenceLinkResolutionStatus));
const requirements = new Set<string>(Object.values(EvidenceRequirement));
const conflictReasons = new Set<string>(Object.values(EvidenceConflictReason));
const allowedRelationPairings = new Set(ALLOWED_EVIDENCE_RELATIONS.map((value) => `${value.source}|${value.relation}|${value.target}`));

export class EvidenceAssessmentError extends Error {
  public constructor(
    public readonly code: EvidenceAssessmentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EvidenceAssessmentError";
  }
}

/** Pure deterministic assessment over an explicit Cross-System Evidence Linking result. */
export class EvidenceEngine {
  public assess(value: unknown): EvidenceAssessment {
    const request = validateRequest(value);
    const linkById = new Map(request.linkedEvidence.links.map((link) => [link.linkId, link]));
    const conflicts = request.conflicts
      .map(copyConflict)
      .sort((left, right) => left.conflictId.localeCompare(right.conflictId));
    const conflictIdsByItem = indexConflicts(conflicts);
    const policy = copyPolicy(request.policy);

    const itemStates = [...request.evidenceItems]
      .sort((left, right) => left.itemId.localeCompare(right.itemId))
      .map((input) => assessItem(
        input,
        requiredLink(linkById, input.linkId),
        policy,
        Date.parse(request.evaluatedAt),
        conflictIdsByItem.get(input.itemId) ?? [],
      ));

    const blockers = buildBlockers(itemStates, policy);
    const warnings = buildWarnings(itemStates);
    const acceptedRequired = itemStates.filter((item) => item.required && item.output.status === EvidenceItemResolutionStatus.Accepted).length;
    const acceptedOptional = itemStates.filter((item) => !item.required && item.output.status === EvidenceItemResolutionStatus.Accepted).length;
    const requiredCount = itemStates.filter((item) => item.required).length;
    const expectedRequiredCount = Math.max(requiredCount, policy.minimumRequiredEvidence);
    const overallStatus = determineOverallStatus(blockers);
    const evidenceItems = itemStates.map((item) => item.output);

    return deepFreeze({
      schemaVersion: EVIDENCE_ASSESSMENT_SCHEMA_VERSION,
      assessmentId: request.assessmentId,
      subject: copyReference(request.subject),
      evaluatedAt: request.evaluatedAt,
      overallStatus,
      policy,
      evidenceItems,
      acceptedEvidenceItemIds: idsWithStatus(evidenceItems, EvidenceItemResolutionStatus.Accepted),
      unresolvedEvidenceItemIds: itemStates.filter((item) => item.unresolved).map((item) => item.output.itemId),
      rejectedEvidenceItemIds: idsWithStatus(evidenceItems, EvidenceItemResolutionStatus.Rejected),
      unavailableEvidenceItemIds: itemStates.filter((item) => item.unavailable).map((item) => item.output.itemId),
      staleEvidenceItemIds: itemStates.filter((item) => item.stale).map((item) => item.output.itemId),
      conflictingEvidenceItemIds: itemStates.filter((item) => item.conflicting).map((item) => item.output.itemId),
      blockers,
      warnings,
      dimensions: buildDimensions(itemStates, policy),
      metrics: {
        totalEvidenceItems: itemStates.length,
        requiredEvidenceItems: requiredCount,
        optionalEvidenceItems: itemStates.length - requiredCount,
        acceptedRequiredEvidenceItems: acceptedRequired,
        acceptedOptionalEvidenceItems: acceptedOptional,
        requiredCompleteness: {
          numerator: acceptedRequired,
          denominator: expectedRequiredCount,
        },
      },
      conflicts,
      trace: mergeAudit(evidenceItems.flatMap((item) => [item.sourceProvenance, item.targetProvenance])),
      deterministic: true,
      readOnly: true,
    });
  }
}

interface AssessedItemState {
  readonly output: AssessedEvidenceItem;
  readonly required: boolean;
  readonly unavailable: boolean;
  readonly unresolved: boolean;
  readonly stale: boolean;
  readonly freshnessUnknown: boolean;
  readonly provenanceMissing: boolean;
  readonly versionUnverifiable: boolean;
  readonly conflicting: boolean;
}

function assessItem(
  input: EvidenceAssessmentRequest["evidenceItems"][number],
  link: ResolvedEvidenceLink,
  policy: EvidenceAssessmentPolicy,
  evaluatedAtMilliseconds: number,
  conflictIds: ReadonlyArray<string>,
): AssessedItemState {
  const required = input.requirement === EvidenceRequirement.Required;
  const unavailable = endpointHasStatus(link, EvidenceEntityResolutionStatus.RepositoryUnavailable);
  const unresolved = !unavailable && link.status !== EvidenceLinkResolutionStatus.Resolved;
  const targetAudit = copyAudit(link.target.audit);
  const provenanceMissing = !hasAuditProvenance(targetAudit);
  const versionUnverifiable = endpointHasStatus(link, EvidenceEntityResolutionStatus.VersionMismatch)
    || endpointHasStatus(link, EvidenceEntityResolutionStatus.VersionUnavailable)
    || (required
      && policy.requireExplicitVersionForRequiredEvidence
      && (link.target.reference.version === undefined || link.target.resolvedVersion === undefined));
  const freshnessRule = policy.freshnessRules.find((rule) => rule.entityType === link.target.reference.entityType);
  const observedAtMilliseconds = input.observedAt === undefined ? undefined : Date.parse(input.observedAt);
  const ageSeconds = observedAtMilliseconds === undefined
    ? undefined
    : Math.floor((evaluatedAtMilliseconds - observedAtMilliseconds) / 1000);
  const freshnessUnknown = freshnessRule !== undefined && observedAtMilliseconds === undefined;
  const stale = freshnessRule !== undefined
    && ageSeconds !== undefined
    && ageSeconds > freshnessRule.maximumAgeSeconds;
  const conflicting = conflictIds.length > 0;
  const policyProvenanceFailure = required && policy.requireProvenanceForRequiredEvidence && provenanceMissing;
  const reasons = [
    ...(unavailable ? [EvidenceEntityResolutionStatus.RepositoryUnavailable] : []),
    ...(unresolved ? [link.source.status, link.target.status].filter((status) => status !== EvidenceEntityResolutionStatus.Resolved) : []),
    ...(versionUnverifiable ? ["VERSION_UNVERIFIABLE"] : []),
    ...(policyProvenanceFailure ? ["PROVENANCE_MISSING"] : []),
    ...(freshnessUnknown ? ["FRESHNESS_UNKNOWN"] : []),
    ...(stale ? ["EVIDENCE_STALE"] : []),
    ...conflictIds.map((conflictId) => `CONFLICT:${conflictId}`),
  ];
  const status = unavailable
    ? EvidenceItemResolutionStatus.Unavailable
    : conflicting
      ? EvidenceItemResolutionStatus.Conflicting
      : unresolved
        ? EvidenceItemResolutionStatus.Unresolved
        : stale
          ? EvidenceItemResolutionStatus.Stale
          : freshnessUnknown || versionUnverifiable || policyProvenanceFailure
            ? EvidenceItemResolutionStatus.Rejected
            : EvidenceItemResolutionStatus.Accepted;

  return {
    required,
    unavailable,
    unresolved,
    stale,
    freshnessUnknown,
    provenanceMissing,
    versionUnverifiable,
    conflicting,
    output: {
      itemId: input.itemId,
      linkId: link.linkId,
      requirement: input.requirement,
      relation: link.relation,
      source: copyReference(link.source.reference),
      target: copyReference(link.target.reference),
      sourceResolution: link.source.status,
      targetResolution: link.target.status,
      ...(link.source.resolvedVersion === undefined ? {} : { sourceResolvedVersion: link.source.resolvedVersion }),
      ...(link.target.resolvedVersion === undefined ? {} : { targetResolvedVersion: link.target.resolvedVersion }),
      status,
      ...(input.observedAt === undefined ? {} : { observedAt: input.observedAt }),
      ...(ageSeconds === undefined ? {} : { ageSeconds }),
      ...(freshnessRule === undefined ? {} : { freshnessThresholdSeconds: freshnessRule.maximumAgeSeconds }),
      sourceProvenance: copyAudit(link.source.audit),
      targetProvenance: targetAudit,
      reasonCodes: uniqueSorted(reasons),
    },
  };
}

function buildBlockers(
  items: ReadonlyArray<AssessedItemState>,
  policy: EvidenceAssessmentPolicy,
): ReadonlyArray<EvidenceAssessmentIssue<EvidenceAssessmentBlockerCode>> {
  const blockers: Array<EvidenceAssessmentIssue<EvidenceAssessmentBlockerCode>> = [];
  if (items.length === 0) {
    blockers.push(issue(EvidenceAssessmentBlockerCode.NoEvidence, [], "No explicit evidence was supplied."));
  }
  for (const item of items.filter((value) => value.required)) {
    const itemIds = [item.output.itemId];
    if (item.unavailable) blockers.push(issue(EvidenceAssessmentBlockerCode.RequiredSourceUnavailable, itemIds, "A required evidence source is unavailable."));
    if (item.conflicting) blockers.push(issue(EvidenceAssessmentBlockerCode.RequiredEvidenceConflicting, itemIds, "Required evidence is part of an unresolved declared conflict."));
    if (item.unresolved) blockers.push(issue(EvidenceAssessmentBlockerCode.RequiredEvidenceUnresolved, itemIds, "A required evidence reference is unresolved."));
    if (item.stale) blockers.push(issue(EvidenceAssessmentBlockerCode.RequiredEvidenceStale, itemIds, "Required evidence exceeds its explicit freshness threshold."));
    if (item.freshnessUnknown) blockers.push(issue(EvidenceAssessmentBlockerCode.RequiredFreshnessUnknown, itemIds, "Required evidence has no observation time for its freshness rule."));
    if (policy.requireProvenanceForRequiredEvidence && item.provenanceMissing) blockers.push(issue(EvidenceAssessmentBlockerCode.RequiredProvenanceMissing, itemIds, "Required evidence has no authoritative audit provenance."));
    if (item.versionUnverifiable) blockers.push(issue(EvidenceAssessmentBlockerCode.RequiredVersionUnverifiable, itemIds, "The required evidence version cannot be verified under the policy."));
  }
  const acceptedRequired = items.filter((item) => item.required && item.output.status === EvidenceItemResolutionStatus.Accepted).length;
  if (acceptedRequired < policy.minimumRequiredEvidence) {
    blockers.push(issue(
      EvidenceAssessmentBlockerCode.MinimumRequiredEvidenceNotMet,
      items.filter((item) => item.required).map((item) => item.output.itemId),
      `Accepted required evidence count ${acceptedRequired} is below policy minimum ${policy.minimumRequiredEvidence}.`,
    ));
  }
  return sortIssues(blockers);
}

function buildWarnings(items: ReadonlyArray<AssessedItemState>): ReadonlyArray<EvidenceAssessmentIssue<EvidenceAssessmentWarningCode>> {
  const warnings: Array<EvidenceAssessmentIssue<EvidenceAssessmentWarningCode>> = [];
  for (const item of items.filter((value) => !value.required)) {
    const itemIds = [item.output.itemId];
    if (item.unavailable) warnings.push(issue(EvidenceAssessmentWarningCode.OptionalSourceUnavailable, itemIds, "An optional evidence source is unavailable."));
    if (item.conflicting) warnings.push(issue(EvidenceAssessmentWarningCode.OptionalEvidenceConflicting, itemIds, "Optional evidence is part of an unresolved declared conflict."));
    if (item.unresolved) warnings.push(issue(EvidenceAssessmentWarningCode.OptionalEvidenceUnresolved, itemIds, "An optional evidence reference is unresolved."));
    if (item.stale) warnings.push(issue(EvidenceAssessmentWarningCode.OptionalEvidenceStale, itemIds, "Optional evidence exceeds its explicit freshness threshold."));
    if (item.freshnessUnknown) warnings.push(issue(EvidenceAssessmentWarningCode.OptionalFreshnessUnknown, itemIds, "Optional evidence has no observation time for its freshness rule."));
    if (item.provenanceMissing) warnings.push(issue(EvidenceAssessmentWarningCode.OptionalProvenanceMissing, itemIds, "Optional evidence has no authoritative audit provenance."));
    if (item.versionUnverifiable) warnings.push(issue(EvidenceAssessmentWarningCode.OptionalVersionUnverifiable, itemIds, "The optional evidence version cannot be verified."));
  }
  return sortIssues(warnings);
}

function buildDimensions(
  items: ReadonlyArray<AssessedItemState>,
  policy: EvidenceAssessmentPolicy,
): ReadonlyArray<EvidenceDimensionAssessment> {
  const required = items.filter((item) => item.required);
  const availabilityRequired = required.filter((item) => item.unavailable || item.unresolved);
  const availabilityOptional = items.filter((item) => !item.required && (item.unavailable || item.unresolved));
  const versionRequired = required.filter((item) => item.versionUnverifiable);
  const versionOptional = items.filter((item) => !item.required && item.versionUnverifiable);
  const provenanceRequired = required.filter((item) => policy.requireProvenanceForRequiredEvidence && item.provenanceMissing);
  const provenanceOptional = items.filter((item) => item.provenanceMissing && !provenanceRequired.includes(item));
  const freshnessRequired = required.filter((item) => item.stale || item.freshnessUnknown);
  const freshnessOptional = items.filter((item) => !item.required && (item.stale || item.freshnessUnknown));
  const consistencyRequired = required.filter((item) => item.conflicting);
  const consistencyOptional = items.filter((item) => !item.required && item.conflicting);
  const incompleteRequired = required.filter((item) => item.output.status !== EvidenceItemResolutionStatus.Accepted);
  const incompleteOptional = items.filter((item) => !item.required && item.output.status !== EvidenceItemResolutionStatus.Accepted);
  const acceptedRequired = required.length - incompleteRequired.length;
  const versionAssessed = policy.requireExplicitVersionForRequiredEvidence
    || items.some((item) => item.output.source.version !== undefined || item.output.target.version !== undefined || item.versionUnverifiable);

  return [
    dimension(EvidenceDimension.Availability, items.length === 0 ? EvidenceDimensionStatus.Failed : dimensionState(availabilityRequired, availabilityOptional), [...availabilityRequired, ...availabilityOptional], ["LINK_RESOLUTION"]),
    dimension(
      EvidenceDimension.Completeness,
      acceptedRequired < policy.minimumRequiredEvidence || incompleteRequired.length > 0
        ? EvidenceDimensionStatus.Failed
        : incompleteOptional.length > 0 ? EvidenceDimensionStatus.Partial : EvidenceDimensionStatus.Satisfied,
      [...incompleteRequired, ...incompleteOptional],
      ["EXPLICIT_REQUIRED_EVIDENCE_COUNT"],
    ),
    dimension(
      EvidenceDimension.Freshness,
      policy.freshnessRules.length === 0 ? EvidenceDimensionStatus.NotAssessed : dimensionState(freshnessRequired, freshnessOptional),
      [...freshnessRequired, ...freshnessOptional],
      policy.freshnessRules.length === 0 ? ["NO_FRESHNESS_RULE"] : ["OBSERVATION_AGE_THRESHOLD"],
    ),
    dimension(
      EvidenceDimension.Provenance,
      items.length === 0 ? EvidenceDimensionStatus.NotAssessed : dimensionState(provenanceRequired, provenanceOptional),
      [...provenanceRequired, ...provenanceOptional],
      ["TARGET_AUDIT_METADATA"],
    ),
    dimension(
      EvidenceDimension.Consistency,
      items.length === 0 ? EvidenceDimensionStatus.NotAssessed : dimensionState(consistencyRequired, consistencyOptional),
      [...consistencyRequired, ...consistencyOptional],
      ["EXPLICIT_CONFLICT_DECLARATIONS"],
    ),
    dimension(
      EvidenceDimension.VersionCompatibility,
      !versionAssessed ? EvidenceDimensionStatus.NotAssessed : dimensionState(versionRequired, versionOptional),
      [...versionRequired, ...versionOptional],
      ["REQUESTED_AND_RESOLVED_VERSION"],
    ),
  ];
}

function determineOverallStatus(
  blockers: ReadonlyArray<EvidenceAssessmentIssue<EvidenceAssessmentBlockerCode>>,
): EvidenceAssessmentStatus {
  if (blockers.some((blocker) => blocker.code === EvidenceAssessmentBlockerCode.RequiredSourceUnavailable)) {
    return EvidenceAssessmentStatus.Unavailable;
  }
  if (blockers.some((blocker) => blocker.code === EvidenceAssessmentBlockerCode.RequiredEvidenceConflicting)) {
    return EvidenceAssessmentStatus.Conflicting;
  }
  return blockers.length > 0 ? EvidenceAssessmentStatus.Insufficient : EvidenceAssessmentStatus.Sufficient;
}

function validateRequest(value: unknown): EvidenceAssessmentRequest {
  if (!isRecord(value)
    || value.schemaVersion !== EVIDENCE_ASSESSMENT_SCHEMA_VERSION
    || !validIdentifier(value.assessmentId)
    || !validTimestamp(value.evaluatedAt)) {
    throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.MalformedRequest, "Assessment identity, schema version, or evaluation timestamp is invalid.");
  }
  const subject = validateReference(value.subject, "subject");
  const policy = validatePolicy(value.policy);
  const links = validateLinkedEvidence(value.linkedEvidence);
  if (links.length > 0 && !links.some((link) => referenceMatches(subject, link.source.reference) || referenceMatches(subject, link.target.reference))) {
    throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.SubjectNotLinked, "The assessment subject does not appear in the explicit linked-evidence view.");
  }
  if (!Array.isArray(value.evidenceItems) || value.evidenceItems.length > MAX_EVIDENCE_ITEMS) {
    throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.MalformedRequest, "evidenceItems must contain at most 1000 entries.");
  }
  const linkIds = new Set(links.map((link) => link.linkId));
  const itemIds = new Set<string>();
  const mappedLinkIds = new Set<string>();
  const evaluatedAt = Date.parse(value.evaluatedAt);
  const evidenceItems = value.evidenceItems.map((candidate, index) => {
    if (!isRecord(candidate) || !validIdentifier(candidate.itemId) || !validIdentifier(candidate.linkId)) {
      throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.MalformedEvidenceReference, `evidenceItems[${index}] is malformed.`);
    }
    if (itemIds.has(candidate.itemId) || mappedLinkIds.has(candidate.linkId)) {
      throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.DuplicateEvidenceItem, `Evidence item or link mapping at index ${index} is duplicated.`);
    }
    if (!linkIds.has(candidate.linkId)) {
      throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.MalformedEvidenceReference, `Evidence item '${candidate.itemId}' references unknown link '${candidate.linkId}'.`);
    }
    if (typeof candidate.requirement !== "string" || !requirements.has(candidate.requirement)) {
      throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.MalformedEvidenceReference, `Evidence item '${candidate.itemId}' has an invalid requirement.`);
    }
    if (candidate.observedAt !== undefined) {
      if (!validTimestamp(candidate.observedAt) || Date.parse(candidate.observedAt) > evaluatedAt) {
        throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.InvalidTimestamp, `Evidence item '${candidate.itemId}' has an invalid or future observation time.`);
      }
    }
    itemIds.add(candidate.itemId);
    mappedLinkIds.add(candidate.linkId);
    return {
      itemId: candidate.itemId,
      linkId: candidate.linkId,
      requirement: candidate.requirement as EvidenceRequirement,
      ...(candidate.observedAt === undefined ? {} : { observedAt: candidate.observedAt }),
    };
  });
  if (mappedLinkIds.size !== linkIds.size) {
    throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.UnmappedEvidenceLink, "Every linked-evidence entry must have exactly one explicit assessment item.");
  }
  const conflicts = validateConflicts(value.conflicts, itemIds);

  return {
    schemaVersion: EVIDENCE_ASSESSMENT_SCHEMA_VERSION,
    assessmentId: value.assessmentId,
    subject,
    evaluatedAt: value.evaluatedAt,
    policy,
    linkedEvidence: value.linkedEvidence as EvidenceAssessmentRequest["linkedEvidence"],
    evidenceItems,
    conflicts,
  };
}

function validatePolicy(value: unknown): EvidenceAssessmentPolicy {
  if (!isRecord(value)
    || !validIdentifier(value.policyId)
    || !validIdentifier(value.version)
    || !Number.isSafeInteger(value.minimumRequiredEvidence)
    || (value.minimumRequiredEvidence as number) < 1
    || typeof value.requireProvenanceForRequiredEvidence !== "boolean"
    || typeof value.requireExplicitVersionForRequiredEvidence !== "boolean"
    || !Array.isArray(value.freshnessRules)) {
    throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.InvalidPolicy, "Evidence assessment policy is invalid.");
  }
  const seen = new Set<EvidenceEntityType>();
  const freshnessRules = value.freshnessRules.map((candidate, index) => {
    if (!isRecord(candidate)
      || typeof candidate.entityType !== "string"
      || !entityTypes.has(candidate.entityType)
      || !Number.isSafeInteger(candidate.maximumAgeSeconds)
      || (candidate.maximumAgeSeconds as number) < 0) {
      throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.InvalidPolicy, `freshnessRules[${index}] is invalid.`);
    }
    const entityType = candidate.entityType as EvidenceEntityType;
    if (seen.has(entityType)) {
      throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.InvalidPolicy, `Freshness rule for '${entityType}' is duplicated.`);
    }
    seen.add(entityType);
    return { entityType, maximumAgeSeconds: candidate.maximumAgeSeconds as number };
  });
  return {
    policyId: value.policyId,
    version: value.version,
    minimumRequiredEvidence: value.minimumRequiredEvidence as number,
    requireProvenanceForRequiredEvidence: value.requireProvenanceForRequiredEvidence,
    requireExplicitVersionForRequiredEvidence: value.requireExplicitVersionForRequiredEvidence,
    freshnessRules,
  };
}

function validateLinkedEvidence(value: unknown): ReadonlyArray<ResolvedEvidenceLink> {
  if (!isRecord(value)
    || value.deterministic !== true
    || value.readOnly !== true
    || !Array.isArray(value.links)
    || value.links.length > MAX_EVIDENCE_ITEMS
    || !Array.isArray(value.warnings)) {
    throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.MalformedLinkedEvidence, "linkedEvidence must be a deterministic read-only link result.");
  }
  const linkIds = new Set<string>();
  return value.links.map((candidate, index) => {
    if (!isRecord(candidate)
      || !validIdentifier(candidate.linkId)
      || typeof candidate.relation !== "string"
      || !relationTypes.has(candidate.relation)
      || typeof candidate.status !== "string"
      || !linkResolutionStatuses.has(candidate.status)
      || !Array.isArray(candidate.warnings)) {
      throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.MalformedLinkedEvidence, `Linked evidence at index ${index} is malformed.`);
    }
    if (linkIds.has(candidate.linkId)) {
      throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.MalformedLinkedEvidence, `Duplicate linked-evidence ID '${candidate.linkId}'.`);
    }
    linkIds.add(candidate.linkId);
    const source = validateResolution(candidate.source, `links[${index}].source`);
    const target = validateResolution(candidate.target, `links[${index}].target`);
    if (!allowedRelationPairings.has(`${source.reference.entityType}|${candidate.relation}|${target.reference.entityType}`)) {
      throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.MalformedLinkedEvidence, `Linked evidence '${candidate.linkId}' has an invalid relation pairing.`);
    }
    const resolved = source.status === EvidenceEntityResolutionStatus.Resolved && target.status === EvidenceEntityResolutionStatus.Resolved;
    if ((candidate.status === EvidenceLinkResolutionStatus.Resolved) !== resolved) {
      throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.MalformedLinkedEvidence, `Linked evidence '${candidate.linkId}' has inconsistent resolution state.`);
    }
    return candidate as unknown as ResolvedEvidenceLink;
  });
}

function validateResolution(value: unknown, path: string): EvidenceEntityResolution {
  if (!isRecord(value)
    || typeof value.status !== "string"
    || !entityResolutionStatuses.has(value.status)
    || !isRecord(value.audit)
    || !validStringArray(value.audit.correlationIds)
    || !validStringArray(value.audit.traceIds)
    || !validStringArray(value.audit.auditReferenceIds)
    || !Array.isArray(value.warnings)) {
    throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.MalformedLinkedEvidence, `${path} is malformed.`);
  }
  validateReference(value.reference, `${path}.reference`);
  if (value.resolvedVersion !== undefined && !validIdentifier(value.resolvedVersion)) {
    throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.MalformedLinkedEvidence, `${path}.resolvedVersion is invalid.`);
  }
  return value as unknown as EvidenceEntityResolution;
}

function validateReference(value: unknown, path: string): EvidenceReference {
  if (!isRecord(value)) {
    throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.MalformedEvidenceReference, `${path} must be an evidence reference.`);
  }
  if (typeof value.entityType !== "string" || !entityTypes.has(value.entityType)) {
    throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.UnsupportedEvidenceType, `${path} has unsupported entity type '${String(value.entityType)}'.`);
  }
  if (!validIdentifier(value.entityId) || (value.version !== undefined && !validIdentifier(value.version))) {
    throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.MalformedEvidenceReference, `${path} has an invalid identifier or version.`);
  }
  return {
    entityType: value.entityType as EvidenceEntityType,
    entityId: value.entityId,
    ...(value.version === undefined ? {} : { version: value.version }),
  };
}

function validateConflicts(value: unknown, itemIds: ReadonlySet<string>): ReadonlyArray<EvidenceConflictInput> {
  if (!Array.isArray(value)) {
    throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.InvalidConflict, "conflicts must be an array.");
  }
  const conflictIds = new Set<string>();
  return value.map((candidate, index) => {
    if (!isRecord(candidate)
      || !validIdentifier(candidate.conflictId)
      || typeof candidate.field !== "string"
      || !FIELD_REFERENCE.test(candidate.field)
      || typeof candidate.reason !== "string"
      || !conflictReasons.has(candidate.reason)
      || !Array.isArray(candidate.itemIds)
      || candidate.itemIds.length < 2
      || !candidate.itemIds.every((itemId) => validIdentifier(itemId) && itemIds.has(itemId))) {
      throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.InvalidConflict, `Conflict at index ${index} is invalid.`);
    }
    if (conflictIds.has(candidate.conflictId)) {
      throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.DuplicateConflict, `Duplicate conflict ID '${candidate.conflictId}'.`);
    }
    const uniqueItemIds = uniqueSorted(candidate.itemIds as ReadonlyArray<string>);
    if (uniqueItemIds.length !== candidate.itemIds.length) {
      throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.InvalidConflict, `Conflict '${candidate.conflictId}' repeats an evidence item.`);
    }
    conflictIds.add(candidate.conflictId);
    return {
      conflictId: candidate.conflictId,
      itemIds: uniqueItemIds,
      field: candidate.field as string,
      reason: candidate.reason as EvidenceConflictReason,
    };
  });
}

function endpointHasStatus(link: ResolvedEvidenceLink, status: EvidenceEntityResolutionStatus): boolean {
  return link.source.status === status || link.target.status === status;
}

function requiredLink(links: ReadonlyMap<string, ResolvedEvidenceLink>, linkId: string): ResolvedEvidenceLink {
  const link = links.get(linkId);
  if (!link) throw new EvidenceAssessmentError(EvidenceAssessmentErrorCode.MalformedEvidenceReference, `Unknown evidence link '${linkId}'.`);
  return link;
}

function issue<TCode extends string>(code: TCode, itemIds: ReadonlyArray<string>, message: string): EvidenceAssessmentIssue<TCode> {
  return { code, itemIds: uniqueSorted(itemIds), message };
}

function sortIssues<TCode extends string>(issues: ReadonlyArray<EvidenceAssessmentIssue<TCode>>): ReadonlyArray<EvidenceAssessmentIssue<TCode>> {
  return [...issues].sort((left, right) => left.code.localeCompare(right.code) || left.itemIds.join("|").localeCompare(right.itemIds.join("|")));
}

function dimensionState(requiredFailures: ReadonlyArray<unknown>, optionalFailures: ReadonlyArray<unknown>): EvidenceDimensionStatus {
  if (requiredFailures.length > 0) return EvidenceDimensionStatus.Failed;
  if (optionalFailures.length > 0) return EvidenceDimensionStatus.Partial;
  return EvidenceDimensionStatus.Satisfied;
}

function dimension(
  value: EvidenceDimension,
  status: EvidenceDimensionStatus,
  items: ReadonlyArray<AssessedItemState>,
  reasonCodes: ReadonlyArray<string>,
): EvidenceDimensionAssessment {
  return {
    dimension: value,
    status,
    affectedItemIds: uniqueSorted(items.map((item) => item.output.itemId)),
    reasonCodes: uniqueSorted(reasonCodes),
  };
}

function idsWithStatus(items: ReadonlyArray<AssessedEvidenceItem>, ...statuses: ReadonlyArray<EvidenceItemResolutionStatus>): ReadonlyArray<string> {
  const selected = new Set(statuses);
  return items.filter((item) => selected.has(item.status)).map((item) => item.itemId);
}

function indexConflicts(conflicts: ReadonlyArray<EvidenceConflictInput>): ReadonlyMap<string, ReadonlyArray<string>> {
  const index = new Map<string, string[]>();
  for (const conflict of conflicts) {
    for (const itemId of conflict.itemIds) {
      index.set(itemId, [...(index.get(itemId) ?? []), conflict.conflictId]);
    }
  }
  return index;
}

function copyConflict(conflict: EvidenceConflictInput): EvidenceConflictInput {
  return { conflictId: conflict.conflictId, itemIds: uniqueSorted(conflict.itemIds), field: conflict.field, reason: conflict.reason };
}

function copyPolicy(policy: EvidenceAssessmentPolicy): EvidenceAssessmentPolicy {
  return {
    policyId: policy.policyId,
    version: policy.version,
    minimumRequiredEvidence: policy.minimumRequiredEvidence,
    requireProvenanceForRequiredEvidence: policy.requireProvenanceForRequiredEvidence,
    requireExplicitVersionForRequiredEvidence: policy.requireExplicitVersionForRequiredEvidence,
    freshnessRules: [...policy.freshnessRules]
      .sort((left, right) => left.entityType.localeCompare(right.entityType))
      .map(copyFreshnessRule),
  };
}

function copyFreshnessRule(rule: EvidenceFreshnessRule): EvidenceFreshnessRule {
  return { entityType: rule.entityType, maximumAgeSeconds: rule.maximumAgeSeconds };
}

function copyReference(reference: EvidenceReference): EvidenceReference {
  return {
    entityType: reference.entityType,
    entityId: reference.entityId,
    ...(reference.version === undefined ? {} : { version: reference.version }),
  };
}

function referenceMatches(left: EvidenceReference, right: EvidenceReference): boolean {
  return left.entityType === right.entityType
    && left.entityId === right.entityId
    && (left.version === undefined || right.version === undefined || left.version === right.version);
}

function copyAudit(audit: EvidenceAuditMetadata): EvidenceAuditMetadata {
  return {
    correlationIds: uniqueSorted(audit.correlationIds),
    traceIds: uniqueSorted(audit.traceIds),
    auditReferenceIds: uniqueSorted(audit.auditReferenceIds),
  };
}

function mergeAudit(values: ReadonlyArray<EvidenceAuditMetadata>): EvidenceAuditMetadata {
  return {
    correlationIds: uniqueSorted(values.flatMap((value) => value.correlationIds)),
    traceIds: uniqueSorted(values.flatMap((value) => value.traceIds)),
    auditReferenceIds: uniqueSorted(values.flatMap((value) => value.auditReferenceIds)),
  };
}

function hasAuditProvenance(audit: EvidenceAuditMetadata): boolean {
  return audit.correlationIds.length > 0 || audit.traceIds.length > 0 || audit.auditReferenceIds.length > 0;
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER.test(value);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u.test(value)
    && Number.isFinite(Date.parse(value));
}

function validStringArray(value: unknown): value is ReadonlyArray<string> {
  return Array.isArray(value) && value.every(validIdentifier);
}

function uniqueSorted(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}
