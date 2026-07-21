import {
  MARKET_REGIME_SCHEMA_VERSION,
  MarketRegimeCondition,
  MarketRegimeDataQualityStatus,
  MarketRegimeEvidenceStrength,
  MarketRegimePrimary,
  MarketRegimeReasonCode,
  MarketRegimeValidationIssueCode,
  MarketRegimeVolatilityMetric,
  RegimeBreadthSignal,
  RegimeBenchmarkScope,
  RegimeCanonicalIdentityStatus,
  RegimeObservationQualityStatus,
  RegimeSupplementalEvidenceStatus,
  RegimeVolumeSignal,
  type MarketRegimeAssessment,
  type MarketRegimeAssessmentRequest,
  type MarketRegimeFeatureSet,
  type MarketRegimePolicy,
  type MarketRegimeUnresolvedRequirement,
  type MarketRegimeValidationIssue,
  type MarketRegimeValidationResult,
  type RegimeBreadthEvidence,
  type RegimeInputSnapshot,
  type RegimeInputSnapshotInput,
  type RegimePriceObservation,
  type RegimeVolumeEvidence,
  type RegimeVolatilityIndexObservation,
} from "../../contracts/MarketRegime";
import type { BarDecimal } from "../../contracts/CanonicalBar";
import { InstrumentAssetClass } from "../../contracts/CanonicalInstrument";
import { isCanonicalInstrumentId } from "../canonical-instrument/CanonicalInstrument";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const INTEGER = /^\d+$/u;
const MAX_OBSERVATIONS = 10_000;
const MAX_BASIS_POINTS = 1_000_000;

const conditionValues = new Set<string>(Object.values(MarketRegimeCondition));
const dataQualityValues = new Set<string>(Object.values(MarketRegimeDataQualityStatus));
const identityValues = new Set<string>(Object.values(RegimeCanonicalIdentityStatus));
const observationQualityValues = new Set<string>(Object.values(RegimeObservationQualityStatus));
const supplementalStatusValues = new Set<string>(Object.values(RegimeSupplementalEvidenceStatus));
const volumeSignalValues = new Set<string>(Object.values(RegimeVolumeSignal));
const breadthSignalValues = new Set<string>(Object.values(RegimeBreadthSignal));

export class MarketRegimeValidationError extends Error {
  public constructor(public readonly issues: readonly MarketRegimeValidationIssue[]) {
    super("Market regime validation failed.");
    this.name = "MarketRegimeValidationError";
  }
}

/** Creates an immutable provider-independent snapshot and its deterministic content fingerprint. */
export function createRegimeInputSnapshot(value: unknown): RegimeInputSnapshot {
  const validation = validateRegimeInputSnapshotInput(value);
  if (!validation.valid) throw new MarketRegimeValidationError(validation.issues);
  const input = canonicalSnapshotInput(value as RegimeInputSnapshotInput);
  return deepFreeze({
    ...input,
    fingerprint: createRegimeInputSnapshotFingerprint(input),
  });
}

export function validateRegimeInputSnapshotInput(value: unknown): MarketRegimeValidationResult {
  return frozenValidation(validateSnapshotInput(value));
}

export function validateRegimeInputSnapshot(value: unknown): MarketRegimeValidationResult {
  const issues = validateSnapshotInput(value);
  if (!isRecord(value) || issues.length > 0) return frozenValidation(issues);
  const input = canonicalSnapshotInput(value as unknown as RegimeInputSnapshotInput);
  const expected = createRegimeInputSnapshotFingerprint(input);
  if (typeof value.fingerprint !== "string" || value.fingerprint !== expected) {
    issues.push(issue(MarketRegimeValidationIssueCode.InvalidIdentifier, "fingerprint", "Snapshot fingerprint does not match canonical snapshot content."));
  }
  return frozenValidation(issues);
}

export function validateMarketRegimePolicy(value: unknown): MarketRegimeValidationResult {
  const issues: MarketRegimeValidationIssue[] = [];
  if (!isRecord(value)) return frozenValidation([issue(MarketRegimeValidationIssueCode.InvalidRecord, "$", "Policy must be an object.")]);
  if (!validIdentifier(value.policyId)) issues.push(issue(MarketRegimeValidationIssueCode.InvalidPolicy, "policyId", "Policy ID is invalid."));
  if (!validVersion(value.version)) issues.push(issue(MarketRegimeValidationIssueCode.InvalidPolicy, "version", "Policy version is invalid."));
  if (!validVersion(value.ruleSetVersion)) issues.push(issue(MarketRegimeValidationIssueCode.InvalidPolicy, "ruleSetVersion", "Rule-set version is invalid."));

  const shortWindow = positiveSafeInteger(value.shortTrendWindow);
  const mediumWindow = positiveSafeInteger(value.mediumTrendWindow);
  const minimum = positiveSafeInteger(value.minimumRequiredObservations);
  const strongMinimum = positiveSafeInteger(value.strongEvidenceMinimumObservations);
  if (!shortWindow || (value.shortTrendWindow as number) < 2) issues.push(issue(MarketRegimeValidationIssueCode.InvalidThreshold, "shortTrendWindow", "Short trend window must be an integer of at least two observations."));
  if (!mediumWindow || (shortWindow && (value.mediumTrendWindow as number) <= (value.shortTrendWindow as number))) issues.push(issue(MarketRegimeValidationIssueCode.InvalidThreshold, "mediumTrendWindow", "Medium trend window must exceed the short trend window."));
  if (!minimum || (mediumWindow && (value.minimumRequiredObservations as number) < (value.mediumTrendWindow as number))) issues.push(issue(MarketRegimeValidationIssueCode.InvalidThreshold, "minimumRequiredObservations", "Minimum observations must cover the medium trend window."));
  if (!strongMinimum || (minimum && (value.strongEvidenceMinimumObservations as number) < (value.minimumRequiredObservations as number))) issues.push(issue(MarketRegimeValidationIssueCode.InvalidThreshold, "strongEvidenceMinimumObservations", "Strong-evidence observation minimum must not be below the required minimum."));

  for (const field of [
    "correctionDrawdownThresholdBasisPoints",
    "reliefRallyReboundThresholdBasisPoints",
    "highVolatilityThresholdBasisPoints",
    "rangeBoundThresholdBasisPoints",
  ] as const) {
    if (!boundedBasisPoints(value[field])) issues.push(issue(MarketRegimeValidationIssueCode.InvalidThreshold, field, `${field} must be a positive bounded basis-point integer.`));
  }
  if (!positiveSafeInteger(value.freshnessThresholdSeconds)) issues.push(issue(MarketRegimeValidationIssueCode.InvalidThreshold, "freshnessThresholdSeconds", "Freshness threshold must be a positive integer."));
  if (value.volatilityMetric !== MarketRegimeVolatilityMetric.MaximumAbsoluteReturnBasisPoints) {
    issues.push(issue(MarketRegimeValidationIssueCode.InvalidPolicy, "volatilityMetric", "Volatility metric is unsupported."));
  }
  return frozenValidation(issues);
}

export function createRegimeInputSnapshotFingerprint(value: RegimeInputSnapshotInput): string {
  return `fnv1a64:${fnv1a64(canonicalize(canonicalSnapshotInput(value)))}`;
}

/** Pure deterministic classification over a validated, immutable snapshot and explicit policy. */
export class MarketRegimeEngine {
  public assess(value: unknown): MarketRegimeAssessment {
    const request = validateAssessmentRequest(value);
    const snapshot = request.snapshot;
    const policy = request.policy;
    const unresolved: MarketRegimeUnresolvedRequirement[] = [];
    const reasons = new Set<MarketRegimeReasonCode>();
    let outputQuality = snapshot.dataQualityStatus;

    if (snapshot.benchmark.status !== RegimeCanonicalIdentityStatus.Resolved || snapshot.benchmark.instrumentId === undefined) {
      addUnresolved(unresolved, reasons, MarketRegimeReasonCode.CanonicalIdentityUnresolved, "A resolved canonical benchmark identity is required.");
    }
    if (snapshot.observations.length < policy.minimumRequiredObservations || snapshot.observations.length < policy.mediumTrendWindow) {
      addUnresolved(unresolved, reasons, MarketRegimeReasonCode.RequiredObservationsMissing, "The observation series does not satisfy the configured minimum and medium windows.");
    }
    if (snapshot.evidenceReferences.length === 0) {
      addUnresolved(unresolved, reasons, MarketRegimeReasonCode.EvidenceReferencesMissing, "At least one traceable evidence reference is required.");
    }
    if (snapshot.dataQualityStatus === MarketRegimeDataQualityStatus.Stale) {
      outputQuality = MarketRegimeDataQualityStatus.Stale;
      addUnresolved(unresolved, reasons, MarketRegimeReasonCode.DataStale, "The input snapshot is explicitly stale.");
    } else if (snapshot.dataQualityStatus === MarketRegimeDataQualityStatus.Conflicting) {
      outputQuality = MarketRegimeDataQualityStatus.Conflicting;
      addUnresolved(unresolved, reasons, MarketRegimeReasonCode.DataQualityConflicting, "The input snapshot has conflicting data quality.");
    } else if ([MarketRegimeDataQualityStatus.Rejected, MarketRegimeDataQualityStatus.Unavailable].includes(snapshot.dataQualityStatus)) {
      outputQuality = snapshot.dataQualityStatus;
      addUnresolved(unresolved, reasons, MarketRegimeReasonCode.DataQualityRejected, "The input snapshot quality is rejected or unavailable.");
    }

    const chronology = inspectChronology(snapshot);
    if (!chronology.ordered) addUnresolved(unresolved, reasons, MarketRegimeReasonCode.ObservationOrderingInvalid, "Observations must be strictly chronological and inside the declared window.");
    if (chronology.contradictory) addUnresolved(unresolved, reasons, MarketRegimeReasonCode.ContradictoryInputs, "Conflicting observations share a timestamp or contradict the declared window.");
    if (snapshot.observations.some((observation) => observation.qualityStatus !== RegimeObservationQualityStatus.Accepted)) {
      addUnresolved(unresolved, reasons, MarketRegimeReasonCode.DataQualityRejected, "Every required price observation must have accepted quality.");
    }

    const latestObservation = snapshot.observations.at(-1);
    if (latestObservation !== undefined) {
      const ageSeconds = Math.floor((Date.parse(request.assessedAt) - Date.parse(latestObservation.observedAt)) / 1000);
      if (ageSeconds < 0) addUnresolved(unresolved, reasons, MarketRegimeReasonCode.ContradictoryInputs, "The latest observation occurs after the assessment timestamp.");
      if (ageSeconds > policy.freshnessThresholdSeconds) {
        outputQuality = MarketRegimeDataQualityStatus.Stale;
        addUnresolved(unresolved, reasons, MarketRegimeReasonCode.DataStale, "The latest observation exceeds the configured freshness threshold.");
      }
    }

    if (hasCoreBlocker(unresolved)) {
      return assessmentResult(request, {
        primary: MarketRegimePrimary.InsufficientEvidence,
        conditions: [],
        strength: MarketRegimeEvidenceStrength.Insufficient,
        reasons,
        unresolved,
        dataQuality: outputQuality,
      });
    }

    const features = calculateFeatures(snapshot.observations, policy);
    addTrendReasons(features, reasons);
    const primary = classifyPrimary(features, policy, reasons);
    if (primary === MarketRegimePrimary.InsufficientEvidence) {
      addUnresolved(unresolved, reasons, MarketRegimeReasonCode.DirectionalStructureUnresolved, "No configured deterministic primary-regime rule matched the price structure.");
    }

    const conditions: MarketRegimeCondition[] = [];
    if (features.maximumAbsoluteReturnBasisPoints >= policy.highVolatilityThresholdBasisPoints) {
      conditions.push(MarketRegimeCondition.HighVolatility);
      reasons.add(MarketRegimeReasonCode.VolatilityThresholdExceeded);
    }
    evaluateSupplementalConditions(snapshot, request.assessedAt, policy, conditions, reasons, unresolved);
    if (unresolved.length > 0 && outputQuality === MarketRegimeDataQualityStatus.Accepted) outputQuality = MarketRegimeDataQualityStatus.Limited;

    const strength = primary === MarketRegimePrimary.InsufficientEvidence
      ? MarketRegimeEvidenceStrength.Insufficient
      : determineStrength(snapshot.observations.length, policy, unresolved.length);

    return assessmentResult(request, {
      primary,
      conditions,
      strength,
      reasons,
      unresolved,
      dataQuality: outputQuality,
      features,
    });
  }
}

interface AssessmentParts {
  readonly primary: MarketRegimePrimary;
  readonly conditions: readonly MarketRegimeCondition[];
  readonly strength: MarketRegimeEvidenceStrength;
  readonly reasons: ReadonlySet<MarketRegimeReasonCode>;
  readonly unresolved: readonly MarketRegimeUnresolvedRequirement[];
  readonly dataQuality: MarketRegimeDataQualityStatus;
  readonly features?: MarketRegimeFeatureSet;
}

function assessmentResult(request: MarketRegimeAssessmentRequest, parts: AssessmentParts): MarketRegimeAssessment {
  const evidenceReferences = collectEvidenceReferences(request.snapshot);
  return deepFreeze({
    schemaVersion: MARKET_REGIME_SCHEMA_VERSION,
    assessmentId: request.assessmentId,
    assessedAt: request.assessedAt,
    createdAt: request.createdAt,
    observationWindow: { ...request.snapshot.observationWindow },
    ...(request.snapshot.benchmark.instrumentId === undefined ? {} : { benchmarkInstrumentId: request.snapshot.benchmark.instrumentId }),
    primaryRegime: parts.primary,
    secondaryConditions: uniqueSorted(parts.conditions),
    evidenceStrength: parts.strength,
    reasonCodes: uniqueSorted([...parts.reasons]),
    inputSnapshotId: request.snapshot.snapshotId,
    inputSnapshotFingerprint: request.snapshot.fingerprint,
    policyId: request.policy.policyId,
    policyVersion: request.policy.version,
    ruleSetVersion: request.policy.ruleSetVersion,
    ...(parts.features === undefined ? {} : { features: { ...parts.features } }),
    evidenceReferences,
    dataQualityStatus: parts.dataQuality,
    unresolvedRequirements: [...parts.unresolved]
      .map((entry) => ({ ...entry }))
      .sort((left, right) => `${left.code}|${left.message}`.localeCompare(`${right.code}|${right.message}`)),
    trace: {
      correlationId: request.snapshot.trace.correlationId,
      traceId: request.snapshot.trace.traceId,
      auditReferenceIds: uniqueSorted(request.snapshot.trace.auditReferenceIds),
    },
    deterministic: true,
    readOnly: true,
  });
}

function classifyPrimary(
  features: MarketRegimeFeatureSet,
  policy: MarketRegimePolicy,
  reasons: Set<MarketRegimeReasonCode>,
): MarketRegimePrimary {
  if (features.mediumTrendBasisPoints >= 0
    && features.shortTrendBasisPoints < 0
    && features.currentDrawdownBasisPoints >= policy.correctionDrawdownThresholdBasisPoints) {
    reasons.add(MarketRegimeReasonCode.DrawdownThresholdExceeded);
    return MarketRegimePrimary.Correction;
  }
  if (features.mediumTrendBasisPoints < 0
    && features.shortTrendBasisPoints > 0
    && features.reboundFromWindowLowBasisPoints >= policy.reliefRallyReboundThresholdBasisPoints) {
    reasons.add(MarketRegimeReasonCode.ReboundAfterDecline);
    return MarketRegimePrimary.ReliefRally;
  }
  if (Math.abs(features.shortTrendBasisPoints) <= policy.rangeBoundThresholdBasisPoints
    && Math.abs(features.mediumTrendBasisPoints) <= policy.rangeBoundThresholdBasisPoints
    && features.windowRangeBasisPoints <= policy.rangeBoundThresholdBasisPoints) {
    reasons.add(MarketRegimeReasonCode.DirectionalStrengthLow);
    return MarketRegimePrimary.RangeBound;
  }
  if (features.shortTrendBasisPoints > 0 && features.mediumTrendBasisPoints > 0) return MarketRegimePrimary.BullTrend;
  if (features.shortTrendBasisPoints < 0
    && features.mediumTrendBasisPoints < -policy.rangeBoundThresholdBasisPoints) return MarketRegimePrimary.BearTrend;
  return MarketRegimePrimary.InsufficientEvidence;
}

function evaluateSupplementalConditions(
  snapshot: RegimeInputSnapshot,
  assessedAt: string,
  policy: MarketRegimePolicy,
  conditions: MarketRegimeCondition[],
  reasons: Set<MarketRegimeReasonCode>,
  unresolved: MarketRegimeUnresolvedRequirement[],
): void {
  const requested = new Set(snapshot.requestedSecondaryConditions);
  if (requested.has(MarketRegimeCondition.DistributionRisk)) {
    const ready = supplementalReady(snapshot.volumeEvidence, snapshot.breadthEvidence, assessedAt, policy, unresolved, reasons);
    if (ready && snapshot.volumeEvidence?.signal === RegimeVolumeSignal.Distribution
      && snapshot.breadthEvidence?.signal === RegimeBreadthSignal.Negative) {
      conditions.push(MarketRegimeCondition.DistributionRisk);
      reasons.add(MarketRegimeReasonCode.DistributionEvidenceSatisfied);
    } else if (ready) {
      addUnresolved(unresolved, reasons, MarketRegimeReasonCode.ContradictoryInputs, "Verified volume and breadth do not support DISTRIBUTION_RISK together.");
    }
  }
  if (requested.has(MarketRegimeCondition.AccumulationCandidate)) {
    const ready = supplementalReady(snapshot.volumeEvidence, snapshot.breadthEvidence, assessedAt, policy, unresolved, reasons);
    if (ready && snapshot.volumeEvidence?.signal === RegimeVolumeSignal.Accumulation
      && snapshot.breadthEvidence?.signal === RegimeBreadthSignal.Positive) {
      conditions.push(MarketRegimeCondition.AccumulationCandidate);
      reasons.add(MarketRegimeReasonCode.AccumulationEvidenceSatisfied);
    } else if (ready) {
      addUnresolved(unresolved, reasons, MarketRegimeReasonCode.ContradictoryInputs, "Verified volume and breadth do not support ACCUMULATION_CANDIDATE together.");
    }
  }
}

function supplementalReady(
  volume: RegimeVolumeEvidence | undefined,
  breadth: RegimeBreadthEvidence | undefined,
  assessedAt: string,
  policy: MarketRegimePolicy,
  unresolved: MarketRegimeUnresolvedRequirement[],
  reasons: Set<MarketRegimeReasonCode>,
): boolean {
  let ready = true;
  if (volume?.status !== RegimeSupplementalEvidenceStatus.Verified) {
    ready = false;
    addUnresolved(unresolved, reasons, MarketRegimeReasonCode.VolumeEvidenceUnavailable, "Verified volume evidence is required for this condition.");
  } else if (volume.unitSemanticsVersion === undefined) {
    ready = false;
    addUnresolved(unresolved, reasons, MarketRegimeReasonCode.VolumeSemanticsUnverified, "Verified volume-unit semantics are required for this condition.");
  }
  if (breadth?.status !== RegimeSupplementalEvidenceStatus.Verified) {
    ready = false;
    addUnresolved(unresolved, reasons, MarketRegimeReasonCode.BreadthEvidenceUnavailable, "Verified breadth evidence is required for this condition.");
  }
  for (const [name, observedAt] of [["volume", volume?.observedAt], ["breadth", breadth?.observedAt]] as const) {
    if (observedAt === undefined) continue;
    const ageSeconds = Math.floor((Date.parse(assessedAt) - Date.parse(observedAt)) / 1000);
    if (ageSeconds < 0 || ageSeconds > policy.freshnessThresholdSeconds) {
      ready = false;
      addUnresolved(unresolved, reasons, MarketRegimeReasonCode.DataStale, `${name} evidence is future-dated or exceeds the configured freshness threshold.`);
    }
  }
  return ready;
}

function calculateFeatures(observations: readonly RegimePriceObservation[], policy: MarketRegimePolicy): MarketRegimeFeatureSet {
  const medium = observations.slice(-policy.mediumTrendWindow);
  const short = observations.slice(-policy.shortTrendWindow);
  const current = requiredLast(medium).close;
  const maximum = medium.reduce((best, entry) => compareDecimal(entry.close, best) > 0 ? entry.close : best, medium[0]!.close);
  const minimum = medium.reduce((best, entry) => compareDecimal(entry.close, best) < 0 ? entry.close : best, medium[0]!.close);
  let maximumAbsoluteReturn = 0;
  for (let index = 1; index < medium.length; index += 1) {
    maximumAbsoluteReturn = Math.max(maximumAbsoluteReturn, Math.abs(changeBasisPoints(medium[index - 1]!.close, medium[index]!.close)));
  }
  return {
    shortTrendBasisPoints: changeBasisPoints(short[0]!.close, requiredLast(short).close),
    mediumTrendBasisPoints: changeBasisPoints(medium[0]!.close, current),
    currentDrawdownBasisPoints: Math.max(0, -changeBasisPoints(maximum, current)),
    reboundFromWindowLowBasisPoints: Math.max(0, changeBasisPoints(minimum, current)),
    maximumAbsoluteReturnBasisPoints: maximumAbsoluteReturn,
    windowRangeBasisPoints: Math.max(0, changeBasisPoints(minimum, maximum)),
    observationCount: observations.length,
  };
}

function addTrendReasons(features: MarketRegimeFeatureSet, reasons: Set<MarketRegimeReasonCode>): void {
  if (features.shortTrendBasisPoints > 0) reasons.add(MarketRegimeReasonCode.ShortTrendPositive);
  if (features.shortTrendBasisPoints < 0) reasons.add(MarketRegimeReasonCode.ShortTrendNegative);
  if (features.mediumTrendBasisPoints > 0) reasons.add(MarketRegimeReasonCode.MediumTrendPositive);
  if (features.mediumTrendBasisPoints < 0) reasons.add(MarketRegimeReasonCode.MediumTrendNegative);
}

function determineStrength(observationCount: number, policy: MarketRegimePolicy, unresolvedCount: number): MarketRegimeEvidenceStrength {
  if (unresolvedCount > 0 || observationCount === policy.minimumRequiredObservations) return MarketRegimeEvidenceStrength.Weak;
  if (observationCount >= policy.strongEvidenceMinimumObservations) return MarketRegimeEvidenceStrength.Strong;
  return MarketRegimeEvidenceStrength.Moderate;
}

function inspectChronology(snapshot: RegimeInputSnapshot): { readonly ordered: boolean; readonly contradictory: boolean } {
  const windowStart = Date.parse(snapshot.observationWindow.start);
  const windowEnd = Date.parse(snapshot.observationWindow.end);
  let previous = Number.NEGATIVE_INFINITY;
  let ordered = true;
  let contradictory = false;
  const seen = new Map<number, string>();
  for (const observation of snapshot.observations) {
    const current = Date.parse(observation.observedAt);
    if (current <= previous || current < windowStart || current > windowEnd) ordered = false;
    const canonicalClose = canonicalize(observation.close);
    const existing = seen.get(current);
    if (existing !== undefined && existing !== canonicalClose) contradictory = true;
    if (existing !== undefined) ordered = false;
    seen.set(current, canonicalClose);
    previous = current;
  }
  return { ordered, contradictory };
}

function hasCoreBlocker(values: readonly MarketRegimeUnresolvedRequirement[]): boolean {
  const supplementalOnly = new Set<MarketRegimeReasonCode>([
    MarketRegimeReasonCode.VolumeEvidenceUnavailable,
    MarketRegimeReasonCode.VolumeSemanticsUnverified,
    MarketRegimeReasonCode.BreadthEvidenceUnavailable,
  ]);
  return values.some((entry) => !supplementalOnly.has(entry.code));
}

function addUnresolved(
  unresolved: MarketRegimeUnresolvedRequirement[],
  reasons: Set<MarketRegimeReasonCode>,
  code: MarketRegimeReasonCode,
  message: string,
): void {
  reasons.add(code);
  if (!unresolved.some((entry) => entry.code === code && entry.message === message)) unresolved.push({ code, message });
}

function validateAssessmentRequest(value: unknown): MarketRegimeAssessmentRequest {
  const issues: MarketRegimeValidationIssue[] = [];
  if (!isRecord(value)) throw new MarketRegimeValidationError([issue(MarketRegimeValidationIssueCode.InvalidRecord, "$", "Assessment request must be an object.")]);
  if (value.schemaVersion !== MARKET_REGIME_SCHEMA_VERSION) issues.push(issue(MarketRegimeValidationIssueCode.InvalidSchemaVersion, "schemaVersion", "Schema version is unsupported."));
  if (!validIdentifier(value.assessmentId)) issues.push(issue(MarketRegimeValidationIssueCode.InvalidIdentifier, "assessmentId", "Assessment ID is invalid."));
  if (!isTimestamp(value.assessedAt)) issues.push(issue(MarketRegimeValidationIssueCode.InvalidTimestamp, "assessedAt", "Assessment timestamp must be canonical UTC."));
  if (!isTimestamp(value.createdAt)) issues.push(issue(MarketRegimeValidationIssueCode.InvalidTimestamp, "createdAt", "Creation timestamp must be canonical UTC."));
  if (isTimestamp(value.assessedAt) && isTimestamp(value.createdAt) && Date.parse(value.createdAt) < Date.parse(value.assessedAt)) {
    issues.push(issue(MarketRegimeValidationIssueCode.InvalidTimestamp, "createdAt", "Creation timestamp cannot precede assessment time."));
  }
  const snapshotValidation = validateRegimeInputSnapshot(value.snapshot);
  issues.push(...snapshotValidation.issues.map((entry) => ({ ...entry, field: `snapshot.${entry.field}` })));
  const policyValidation = validateMarketRegimePolicy(value.policy);
  issues.push(...policyValidation.issues.map((entry) => ({ ...entry, field: `policy.${entry.field}` })));
  if (isRecord(value.snapshot) && isTimestamp(value.assessedAt) && isTimestamp(value.snapshot.createdAt)
    && Date.parse(value.snapshot.createdAt) > Date.parse(value.assessedAt)) {
    issues.push(issue(MarketRegimeValidationIssueCode.InvalidTimestamp, "snapshot.createdAt", "Snapshot creation time cannot follow assessment time."));
  }
  if (issues.length > 0) throw new MarketRegimeValidationError(sortIssues(issues));
  const request = value as unknown as MarketRegimeAssessmentRequest;
  return {
    schemaVersion: MARKET_REGIME_SCHEMA_VERSION,
    assessmentId: request.assessmentId,
    assessedAt: request.assessedAt,
    createdAt: request.createdAt,
    snapshot: createRegimeInputSnapshot(request.snapshot),
    policy: canonicalPolicy(request.policy),
  };
}

function validateSnapshotInput(value: unknown): MarketRegimeValidationIssue[] {
  const issues: MarketRegimeValidationIssue[] = [];
  if (!isRecord(value)) return [issue(MarketRegimeValidationIssueCode.InvalidRecord, "$", "Snapshot must be an object.")];
  if (value.schemaVersion !== MARKET_REGIME_SCHEMA_VERSION) issues.push(issue(MarketRegimeValidationIssueCode.InvalidSchemaVersion, "schemaVersion", "Schema version is unsupported."));
  if (!validIdentifier(value.snapshotId)) issues.push(issue(MarketRegimeValidationIssueCode.InvalidIdentifier, "snapshotId", "Snapshot ID is invalid."));
  validateBenchmark(value.benchmark, issues);
  validateWindow(value.observationWindow, issues);
  if (!Array.isArray(value.observations) || value.observations.length > MAX_OBSERVATIONS) {
    issues.push(issue(MarketRegimeValidationIssueCode.InvalidObservation, "observations", "Observations must be a bounded array."));
  } else {
    value.observations.forEach((entry, index) => validateObservation(entry, `observations[${String(index)}]`, issues));
  }
  if (!dataQualityValues.has(String(value.dataQualityStatus))) issues.push(issue(MarketRegimeValidationIssueCode.InvalidQualityStatus, "dataQualityStatus", "Data quality status is invalid."));
  validateConditions(value.requestedSecondaryConditions, issues);
  if (value.volumeEvidence !== undefined) validateVolumeEvidence(value.volumeEvidence, issues);
  if (value.breadthEvidence !== undefined) validateBreadthEvidence(value.breadthEvidence, issues);
  if (value.volatilityIndexObservation !== undefined) validateVolatilityIndex(value.volatilityIndexObservation, issues);
  validateReferences(value.evidenceReferences, "evidenceReferences", true, issues);
  validateTrace(value.trace, issues);
  if (!isTimestamp(value.createdAt)) issues.push(issue(MarketRegimeValidationIssueCode.InvalidTimestamp, "createdAt", "Snapshot creation time must be canonical UTC."));
  if (isRecord(value.observationWindow) && isTimestamp(value.observationWindow.end) && isTimestamp(value.createdAt)
    && Date.parse(value.observationWindow.end) > Date.parse(value.createdAt)) {
    issues.push(issue(MarketRegimeValidationIssueCode.InvalidTimestamp, "createdAt", "Snapshot creation time cannot precede its observation-window end."));
  }
  return issues;
}

function validateBenchmark(value: unknown, issues: MarketRegimeValidationIssue[]): void {
  if (!isRecord(value) || !identityValues.has(String(value.status))) {
    issues.push(issue(MarketRegimeValidationIssueCode.InvalidCanonicalIdentity, "benchmark", "Benchmark identity status is invalid."));
    return;
  }
  if (value.status === RegimeCanonicalIdentityStatus.Resolved && !isCanonicalInstrumentId(value.instrumentId)) {
    issues.push(issue(MarketRegimeValidationIssueCode.InvalidCanonicalIdentity, "benchmark.instrumentId", "Resolved benchmark requires a canonical instrument ID."));
  }
  if (value.status === RegimeCanonicalIdentityStatus.Resolved
    && ![InstrumentAssetClass.Etf, InstrumentAssetClass.Index].includes(value.assetClass as InstrumentAssetClass)) {
    issues.push(issue(MarketRegimeValidationIssueCode.InvalidCanonicalIdentity, "benchmark.assetClass", "Market-wide regime assessment requires a reviewed broad-market ETF or index benchmark."));
  }
  if (value.status === RegimeCanonicalIdentityStatus.Resolved && value.scope !== RegimeBenchmarkScope.BroadMarket) {
    issues.push(issue(MarketRegimeValidationIssueCode.InvalidCanonicalIdentity, "benchmark.scope", "Resolved benchmark scope must be BROAD_MARKET."));
  }
  if (value.status === RegimeCanonicalIdentityStatus.Unresolved
    && (value.instrumentId !== undefined || value.assetClass !== undefined || value.scope !== undefined)) {
    issues.push(issue(MarketRegimeValidationIssueCode.InvalidCanonicalIdentity, "benchmark", "Unresolved benchmark must not claim canonical identity metadata."));
  }
}

function validateWindow(value: unknown, issues: MarketRegimeValidationIssue[]): void {
  if (!isRecord(value) || !isTimestamp(value.start) || !isTimestamp(value.end) || Date.parse(String(value.end)) <= Date.parse(String(value.start))) {
    issues.push(issue(MarketRegimeValidationIssueCode.InvalidObservationWindow, "observationWindow", "Observation window requires ordered canonical UTC timestamps."));
  }
}

function validateObservation(value: unknown, field: string, issues: MarketRegimeValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue(MarketRegimeValidationIssueCode.InvalidObservation, field, "Observation must be an object."));
    return;
  }
  if (!validIdentifier(value.observationId)) issues.push(issue(MarketRegimeValidationIssueCode.InvalidIdentifier, `${field}.observationId`, "Observation ID is invalid."));
  if (!isTimestamp(value.observedAt)) issues.push(issue(MarketRegimeValidationIssueCode.InvalidTimestamp, `${field}.observedAt`, "Observation time must be canonical UTC."));
  if (!validPositiveDecimal(value.close)) issues.push(issue(MarketRegimeValidationIssueCode.InvalidDecimal, `${field}.close`, "Close must be a positive fixed decimal."));
  if (!observationQualityValues.has(String(value.qualityStatus))) issues.push(issue(MarketRegimeValidationIssueCode.InvalidQualityStatus, `${field}.qualityStatus`, "Observation quality status is invalid."));
  validateReferences(value.evidenceReferences, `${field}.evidenceReferences`, true, issues);
}

function validateConditions(value: unknown, issues: MarketRegimeValidationIssue[]): void {
  if (!Array.isArray(value)) {
    issues.push(issue(MarketRegimeValidationIssueCode.InvalidRequestedCondition, "requestedSecondaryConditions", "Requested conditions must be an array."));
    return;
  }
  const seen = new Set<string>();
  for (const entry of value) {
    if (!conditionValues.has(String(entry)) || entry === MarketRegimeCondition.HighVolatility) {
      issues.push(issue(MarketRegimeValidationIssueCode.InvalidRequestedCondition, "requestedSecondaryConditions", "Only evidence-dependent conditions may be requested explicitly."));
    }
    if (seen.has(String(entry))) issues.push(issue(MarketRegimeValidationIssueCode.InvalidRequestedCondition, "requestedSecondaryConditions", "Requested conditions must be unique."));
    seen.add(String(entry));
  }
}

function validateVolumeEvidence(value: unknown, issues: MarketRegimeValidationIssue[]): void {
  if (!isRecord(value) || !supplementalStatusValues.has(String(value.status))) {
    issues.push(issue(MarketRegimeValidationIssueCode.InvalidSupplementalEvidence, "volumeEvidence", "Volume evidence status is invalid."));
    return;
  }
  if (value.signal !== undefined && !volumeSignalValues.has(String(value.signal))) issues.push(issue(MarketRegimeValidationIssueCode.InvalidSupplementalEvidence, "volumeEvidence.signal", "Volume signal is invalid."));
  if (value.status === RegimeSupplementalEvidenceStatus.Verified && (value.signal === undefined || !validVersion(value.unitSemanticsVersion) || !isTimestamp(value.observedAt))) {
    issues.push(issue(MarketRegimeValidationIssueCode.InvalidSupplementalEvidence, "volumeEvidence", "Verified volume evidence requires signal, unit semantics version, and observation time."));
  }
  validateReferences(value.evidenceReferences, "volumeEvidence.evidenceReferences", value.status === RegimeSupplementalEvidenceStatus.Verified, issues);
}

function validateBreadthEvidence(value: unknown, issues: MarketRegimeValidationIssue[]): void {
  if (!isRecord(value) || !supplementalStatusValues.has(String(value.status))) {
    issues.push(issue(MarketRegimeValidationIssueCode.InvalidSupplementalEvidence, "breadthEvidence", "Breadth evidence status is invalid."));
    return;
  }
  if (value.signal !== undefined && !breadthSignalValues.has(String(value.signal))) issues.push(issue(MarketRegimeValidationIssueCode.InvalidSupplementalEvidence, "breadthEvidence.signal", "Breadth signal is invalid."));
  if (value.status === RegimeSupplementalEvidenceStatus.Verified && (value.signal === undefined || !isTimestamp(value.observedAt))) {
    issues.push(issue(MarketRegimeValidationIssueCode.InvalidSupplementalEvidence, "breadthEvidence", "Verified breadth evidence requires signal and observation time."));
  }
  validateReferences(value.evidenceReferences, "breadthEvidence.evidenceReferences", value.status === RegimeSupplementalEvidenceStatus.Verified, issues);
}

function validateVolatilityIndex(value: unknown, issues: MarketRegimeValidationIssue[]): void {
  if (!isRecord(value) || !isCanonicalInstrumentId(value.instrumentId) || !isTimestamp(value.observedAt)
    || !validPositiveDecimal(value.value) || !observationQualityValues.has(String(value.qualityStatus))) {
    issues.push(issue(MarketRegimeValidationIssueCode.InvalidSupplementalEvidence, "volatilityIndexObservation", "Volatility-index observation is invalid."));
    return;
  }
  validateReferences(value.evidenceReferences, "volatilityIndexObservation.evidenceReferences", true, issues);
}

function validateTrace(value: unknown, issues: MarketRegimeValidationIssue[]): void {
  if (!isRecord(value) || !validIdentifier(value.correlationId) || !validIdentifier(value.traceId)) {
    issues.push(issue(MarketRegimeValidationIssueCode.InvalidIdentifier, "trace", "Trace metadata requires valid correlation and trace IDs."));
    return;
  }
  validateReferences(value.auditReferenceIds, "trace.auditReferenceIds", false, issues);
}

function validateReferences(value: unknown, field: string, required: boolean, issues: MarketRegimeValidationIssue[]): void {
  if (!Array.isArray(value) || (required && value.length === 0) || value.some((entry) => !validIdentifier(entry)) || new Set(value).size !== value.length) {
    issues.push(issue(MarketRegimeValidationIssueCode.InvalidEvidenceReference, field, "Evidence references must be unique valid identifiers."));
  }
}

function canonicalSnapshotInput(value: RegimeInputSnapshotInput): RegimeInputSnapshotInput {
  return {
    schemaVersion: MARKET_REGIME_SCHEMA_VERSION,
    snapshotId: value.snapshotId,
    benchmark: {
      status: value.benchmark.status,
      ...(value.benchmark.instrumentId === undefined ? {} : { instrumentId: value.benchmark.instrumentId }),
      ...(value.benchmark.assetClass === undefined ? {} : { assetClass: value.benchmark.assetClass }),
      ...(value.benchmark.scope === undefined ? {} : { scope: value.benchmark.scope }),
    },
    observationWindow: { ...value.observationWindow },
    observations: value.observations.map((entry) => ({
      observationId: entry.observationId,
      observedAt: entry.observedAt,
      close: { ...entry.close },
      qualityStatus: entry.qualityStatus,
      evidenceReferences: uniqueSorted(entry.evidenceReferences),
    })),
    dataQualityStatus: value.dataQualityStatus,
    requestedSecondaryConditions: uniqueSorted(value.requestedSecondaryConditions),
    ...(value.volumeEvidence === undefined ? {} : { volumeEvidence: canonicalVolume(value.volumeEvidence) }),
    ...(value.breadthEvidence === undefined ? {} : { breadthEvidence: canonicalBreadth(value.breadthEvidence) }),
    ...(value.volatilityIndexObservation === undefined ? {} : { volatilityIndexObservation: canonicalVolatilityIndex(value.volatilityIndexObservation) }),
    evidenceReferences: uniqueSorted(value.evidenceReferences),
    trace: {
      correlationId: value.trace.correlationId,
      traceId: value.trace.traceId,
      auditReferenceIds: uniqueSorted(value.trace.auditReferenceIds),
    },
    createdAt: value.createdAt,
  };
}

function canonicalVolume(value: RegimeVolumeEvidence): RegimeVolumeEvidence {
  return {
    status: value.status,
    ...(value.signal === undefined ? {} : { signal: value.signal }),
    ...(value.unitSemanticsVersion === undefined ? {} : { unitSemanticsVersion: value.unitSemanticsVersion }),
    ...(value.observedAt === undefined ? {} : { observedAt: value.observedAt }),
    evidenceReferences: uniqueSorted(value.evidenceReferences),
  };
}

function canonicalBreadth(value: RegimeBreadthEvidence): RegimeBreadthEvidence {
  return {
    status: value.status,
    ...(value.signal === undefined ? {} : { signal: value.signal }),
    ...(value.observedAt === undefined ? {} : { observedAt: value.observedAt }),
    evidenceReferences: uniqueSorted(value.evidenceReferences),
  };
}

function canonicalVolatilityIndex(value: RegimeVolatilityIndexObservation): RegimeVolatilityIndexObservation {
  return {
    instrumentId: value.instrumentId,
    observedAt: value.observedAt,
    value: { ...value.value },
    qualityStatus: value.qualityStatus,
    evidenceReferences: uniqueSorted(value.evidenceReferences),
  };
}

function canonicalPolicy(value: MarketRegimePolicy): MarketRegimePolicy {
  return {
    policyId: value.policyId,
    version: value.version,
    ruleSetVersion: value.ruleSetVersion,
    shortTrendWindow: value.shortTrendWindow,
    mediumTrendWindow: value.mediumTrendWindow,
    correctionDrawdownThresholdBasisPoints: value.correctionDrawdownThresholdBasisPoints,
    reliefRallyReboundThresholdBasisPoints: value.reliefRallyReboundThresholdBasisPoints,
    highVolatilityThresholdBasisPoints: value.highVolatilityThresholdBasisPoints,
    rangeBoundThresholdBasisPoints: value.rangeBoundThresholdBasisPoints,
    freshnessThresholdSeconds: value.freshnessThresholdSeconds,
    minimumRequiredObservations: value.minimumRequiredObservations,
    strongEvidenceMinimumObservations: value.strongEvidenceMinimumObservations,
    volatilityMetric: value.volatilityMetric,
  };
}

function collectEvidenceReferences(snapshot: RegimeInputSnapshot): string[] {
  return uniqueSorted([
    ...snapshot.evidenceReferences,
    ...snapshot.observations.flatMap((entry) => entry.evidenceReferences),
    ...(snapshot.volumeEvidence?.evidenceReferences ?? []),
    ...(snapshot.breadthEvidence?.evidenceReferences ?? []),
    ...(snapshot.volatilityIndexObservation?.evidenceReferences ?? []),
  ]);
}

function changeBasisPoints(from: BarDecimal, to: BarDecimal): number {
  const scale = Math.max(from.scale, to.scale);
  const fromAtomic = BigInt(from.atomicValue) * (10n ** BigInt(scale - from.scale));
  const toAtomic = BigInt(to.atomicValue) * (10n ** BigInt(scale - to.scale));
  const result = ((toAtomic - fromAtomic) * 10_000n) / fromAtomic;
  if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) throw new MarketRegimeValidationError([
    issue(MarketRegimeValidationIssueCode.InvalidDecimal, "observations", "Calculated basis-point value exceeds the deterministic numeric boundary."),
  ]);
  return Number(result);
}

function compareDecimal(left: BarDecimal, right: BarDecimal): number {
  const scale = Math.max(left.scale, right.scale);
  const leftAtomic = BigInt(left.atomicValue) * (10n ** BigInt(scale - left.scale));
  const rightAtomic = BigInt(right.atomicValue) * (10n ** BigInt(scale - right.scale));
  return leftAtomic < rightAtomic ? -1 : leftAtomic > rightAtomic ? 1 : 0;
}

function validPositiveDecimal(value: unknown): value is BarDecimal {
  return isRecord(value) && typeof value.atomicValue === "string" && INTEGER.test(value.atomicValue)
    && BigInt(value.atomicValue) > 0n && Number.isSafeInteger(value.scale) && (value.scale as number) >= 0 && (value.scale as number) <= 18;
}

function requiredLast<T>(values: readonly T[]): T {
  const value = values.at(-1);
  if (value === undefined) throw new MarketRegimeValidationError([issue(MarketRegimeValidationIssueCode.InvalidObservation, "observations", "Required observation window is empty.")]);
  return value;
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER.test(value);
}

function validVersion(value: unknown): value is string {
  return typeof value === "string" && VERSION.test(value);
}

function positiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function boundedBasisPoints(value: unknown): value is number {
  return positiveSafeInteger(value) && (value as number) <= MAX_BASIS_POINTS;
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function issue(code: MarketRegimeValidationIssueCode, field: string, message: string): MarketRegimeValidationIssue {
  return { code, field, message };
}

function frozenValidation(values: readonly MarketRegimeValidationIssue[]): MarketRegimeValidationResult {
  const issues = sortIssues(values);
  return deepFreeze({ valid: issues.length === 0, issues });
}

function sortIssues(values: readonly MarketRegimeValidationIssue[]): MarketRegimeValidationIssue[] {
  return values.map((entry) => ({ ...entry }))
    .sort((left, right) => `${left.code}|${left.field}|${left.message}`.localeCompare(`${right.code}|${right.field}|${right.message}`));
}

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
