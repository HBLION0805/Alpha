import {
  BROAD_MARKET_EVIDENCE_SCHEMA_VERSION,
  BroadMarketBenchmarkAvailability,
  BroadMarketBenchmarkClassification,
  BroadMarketBenchmarkRequirement,
  BroadMarketBenchmarkStatus,
  BroadMarketEvidenceIssueCode,
  BroadMarketEvidenceIssueSeverity,
  BroadMarketEvidenceQuality,
  BroadMarketEvidenceStrength,
  BroadMarketObservationQuality,
  BroadMarketTrendDirection,
  type BroadMarketAggregateFacts,
  type BroadMarketBenchmarkFeatureSet,
  type BroadMarketBenchmarkFeatureSummary,
  type BroadMarketBenchmarkObservation,
  type BroadMarketBenchmarkPolicyRequirement,
  type BroadMarketBenchmarkReference,
  type BroadMarketBenchmarkSeries,
  type BroadMarketEvidenceAssessment,
  type BroadMarketEvidenceAssessmentRequest,
  type BroadMarketEvidenceIssue,
  type BroadMarketEvidencePolicy,
  type BroadMarketEvidenceSnapshot,
  type BroadMarketEvidenceSnapshotInput,
  type BroadMarketEvidenceValidationResult,
} from "../../contracts/BroadMarketEvidence";
import { BarInterval, type BarDecimal } from "../../contracts/CanonicalBar";
import { InstrumentAssetClass } from "../../contracts/CanonicalInstrument";
import { isCanonicalInstrumentId } from "../canonical-instrument/CanonicalInstrument";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const INTEGER = /^\d+$/u;
const BAR_ID = /^bar:[a-f0-9]{16}$/u;
const BAR_FINGERPRINT = /^fnv1a64:[a-f0-9]{16}$/u;
const MAX_OBSERVATIONS = 10_000;
const MAX_BASIS_POINTS = 1_000_000;

export class BroadMarketEvidenceValidationError extends Error {
  public constructor(public readonly issues: readonly BroadMarketEvidenceIssue[]) {
    super("Broad market evidence validation failed.");
    this.name = "BroadMarketEvidenceValidationError";
  }
}

/** Creates a canonical immutable snapshot and excludes undeclared/provider-native fields. */
export function createBroadMarketEvidenceSnapshot(value: unknown): BroadMarketEvidenceSnapshot {
  const validation = validateBroadMarketEvidenceSnapshotInput(value);
  if (!validation.valid) throw new BroadMarketEvidenceValidationError(validation.issues);
  const input = canonicalSnapshotInput(value as BroadMarketEvidenceSnapshotInput);
  return deepFreeze({ ...input, fingerprint: createBroadMarketEvidenceSnapshotFingerprint(input) });
}

export function createBroadMarketEvidenceSnapshotFingerprint(value: BroadMarketEvidenceSnapshotInput): string {
  return `fnv1a64:${fnv1a64(canonicalize(canonicalSnapshotInput(value)))}`;
}

export function validateBroadMarketEvidenceSnapshotInput(value: unknown): BroadMarketEvidenceValidationResult {
  return frozenValidation(validateSnapshotInput(value));
}

export function validateBroadMarketEvidenceSnapshot(value: unknown): BroadMarketEvidenceValidationResult {
  const issues = validateSnapshotInput(value);
  if (issues.length === 0 && isRecord(value)) {
    const expected = createBroadMarketEvidenceSnapshotFingerprint(canonicalSnapshotInput(value as unknown as BroadMarketEvidenceSnapshotInput));
    if (value.fingerprint !== expected) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidIdentifier, "fingerprint", "Snapshot fingerprint does not match canonical snapshot content."));
  }
  return frozenValidation(issues);
}

export function validateBroadMarketEvidencePolicy(value: unknown): BroadMarketEvidenceValidationResult {
  const issues: BroadMarketEvidenceIssue[] = [];
  if (!isRecord(value)) return frozenValidation([blocker(BroadMarketEvidenceIssueCode.InvalidRecord, "$", "Policy must be an object.")]);
  if (!validIdentifier(value.policyId)) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidPolicy, "policyId", "Policy ID is invalid."));
  for (const field of ["version", "ruleSetVersion", "featureCalculationVersion"] as const) {
    if (!validVersion(value[field])) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidPolicy, field, `${field} is invalid.`));
  }
  if (!Object.values(BarInterval).includes(value.expectedInterval as BarInterval)) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidPolicy, "expectedInterval", "Expected interval is unsupported."));
  const numericFields = [
    "shortWindow", "mediumWindow", "minimumObservationsPerBenchmark", "freshnessThresholdSeconds",
    "positiveTrendThresholdBasisPoints", "negativeTrendThresholdBasisPoints", "drawdownThresholdBasisPoints",
    "reboundThresholdBasisPoints", "highVolatilityThresholdBasisPoints", "minimumRequiredBenchmarks",
    "contradictionMinimumOpposingCount", "moderateAgreementCount", "strongAgreementCount",
  ] as const;
  for (const field of numericFields) {
    if (!positiveSafeInteger(value[field])) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidPolicy, field, `${field} must be a positive safe integer.`));
  }
  for (const field of ["positiveTrendThresholdBasisPoints", "negativeTrendThresholdBasisPoints", "drawdownThresholdBasisPoints", "reboundThresholdBasisPoints", "highVolatilityThresholdBasisPoints"] as const) {
    if (positiveSafeInteger(value[field]) && value[field] > MAX_BASIS_POINTS) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidPolicy, field, `${field} exceeds the deterministic numeric boundary.`));
  }
  if (positiveSafeInteger(value.shortWindow) && positiveSafeInteger(value.mediumWindow) && value.shortWindow > value.mediumWindow) {
    issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidPolicy, "shortWindow", "Short window cannot exceed medium window."));
  }
  if (positiveSafeInteger(value.mediumWindow) && positiveSafeInteger(value.minimumObservationsPerBenchmark) && value.mediumWindow > value.minimumObservationsPerBenchmark) {
    issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidPolicy, "minimumObservationsPerBenchmark", "Minimum observations must cover the medium window."));
  }
  if (!Array.isArray(value.benchmarkRequirements) || value.benchmarkRequirements.length === 0) {
    issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidPolicy, "benchmarkRequirements", "At least one explicit benchmark requirement is required."));
  } else {
    const seen = new Set<string>();
    let requiredCount = 0;
    value.benchmarkRequirements.forEach((entry, index) => {
      if (!isRecord(entry)) {
        issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidPolicy, `benchmarkRequirements[${String(index)}]`, "Requirement must be an object."));
        return;
      }
      issues.push(...validateBenchmarkReference(entry.benchmark, `benchmarkRequirements[${String(index)}].benchmark`));
      if (!Object.values(BroadMarketBenchmarkRequirement).includes(entry.requirement as BroadMarketBenchmarkRequirement)) {
        issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidPolicy, `benchmarkRequirements[${String(index)}].requirement`, "Benchmark requirement is unsupported."));
      }
      if (entry.requirement === BroadMarketBenchmarkRequirement.Required) requiredCount += 1;
      if (isRecord(entry.benchmark) && typeof entry.benchmark.instrumentId === "string") {
        if (seen.has(entry.benchmark.instrumentId)) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidPolicy, `benchmarkRequirements[${String(index)}].benchmark.instrumentId`, "Benchmark requirements must be unique."));
        seen.add(entry.benchmark.instrumentId);
      }
    });
    if (positiveSafeInteger(value.minimumRequiredBenchmarks) && value.minimumRequiredBenchmarks > requiredCount) {
      issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidPolicy, "minimumRequiredBenchmarks", "Minimum required benchmarks cannot exceed the required benchmark count."));
    }
    if (positiveSafeInteger(value.strongAgreementCount) && value.strongAgreementCount > value.benchmarkRequirements.length) {
      issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidPolicy, "strongAgreementCount", "Strong agreement count exceeds configured benchmarks."));
    }
  }
  if (positiveSafeInteger(value.moderateAgreementCount) && positiveSafeInteger(value.strongAgreementCount) && value.moderateAgreementCount > value.strongAgreementCount) {
    issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidPolicy, "moderateAgreementCount", "Moderate agreement count cannot exceed strong agreement count."));
  }
  return frozenValidation(issues);
}

export class BroadMarketEvidenceEngine {
  public assess(value: unknown): BroadMarketEvidenceAssessment {
    const request = validateAssessmentRequest(value);
    const requirements = [...request.policy.benchmarkRequirements].sort(compareRequirement);
    const seriesById = new Map(request.snapshot.benchmarkSeries.map((entry) => [entry.benchmark.instrumentId, entry]));
    const summaries = requirements.map((requirement) => evaluateBenchmark(requirement, seriesById.get(requirement.benchmark.instrumentId), request));
    const aggregateFacts = aggregate(summaries, request.policy);
    const quality = determineQuality(summaries, aggregateFacts, request.policy);
    const compositionIssues = quality === BroadMarketEvidenceQuality.Contradictory
      ? [blocker(BroadMarketEvidenceIssueCode.StrongBenchmarkDisagreement, "aggregateFacts", "Configured positive and negative benchmark groups materially disagree.")]
      : [];
    const allIssues = sortIssues([...summaries.flatMap((entry) => entry.issues), ...compositionIssues]);
    const issues = allIssues.filter((entry) => entry.severity === BroadMarketEvidenceIssueSeverity.Blocker);
    const warnings = allIssues.filter((entry) => entry.severity === BroadMarketEvidenceIssueSeverity.Warning);
    const evidenceStrength = determineStrength(quality, aggregateFacts, request.policy);
    return deepFreeze({
      schemaVersion: BROAD_MARKET_EVIDENCE_SCHEMA_VERSION,
      assessmentId: request.assessmentId,
      assessedAt: request.assessedAt,
      createdAt: request.createdAt,
      asOf: request.snapshot.asOf,
      evidenceWindow: structuredClone(request.snapshot.evidenceWindow),
      interval: request.snapshot.interval,
      inputSnapshotId: request.snapshot.snapshotId,
      inputSnapshotFingerprint: request.snapshot.fingerprint,
      policyId: request.policy.policyId,
      policyVersion: request.policy.version,
      ruleSetVersion: request.policy.ruleSetVersion,
      featureCalculationVersion: request.policy.featureCalculationVersion,
      quality,
      evidenceStrength,
      benchmarkSummaries: summaries,
      aggregateFacts,
      issues,
      warnings,
      evidenceReferences: uniqueSorted(summaries.flatMap((entry) => entry.evidenceReferences)),
      trace: structuredClone(request.snapshot.trace),
      deterministic: true,
      readOnly: true,
    });
  }
}

function evaluateBenchmark(
  requirement: BroadMarketBenchmarkPolicyRequirement,
  series: BroadMarketBenchmarkSeries | undefined,
  request: BroadMarketEvidenceAssessmentRequest,
): BroadMarketBenchmarkFeatureSummary {
  const benchmarkId = requirement.benchmark.instrumentId;
  const issues: BroadMarketEvidenceIssue[] = [];
  if (series === undefined || series.availability === BroadMarketBenchmarkAvailability.Missing) {
    issues.push(withBenchmark(
      requirement.requirement === BroadMarketBenchmarkRequirement.Required ? BroadMarketEvidenceIssueCode.MissingRequiredBenchmark : BroadMarketEvidenceIssueCode.MissingOptionalBenchmark,
      requirement.requirement === BroadMarketBenchmarkRequirement.Required ? BroadMarketEvidenceIssueSeverity.Blocker : BroadMarketEvidenceIssueSeverity.Warning,
      benchmarkId,
      "benchmarkSeries",
      `${requirement.requirement === BroadMarketBenchmarkRequirement.Required ? "Required" : "Optional"} benchmark observations are missing.`,
    ));
    return deepFreeze({ benchmark: structuredClone(requirement.benchmark), requirement: requirement.requirement, status: BroadMarketBenchmarkStatus.Missing, observationReferences: [], evidenceReferences: [], issues: sortIssues(issues) });
  }
  const observationReferences = series.observations.map((entry) => entry.canonicalBarId).sort();
  const evidenceReferences = uniqueSorted(series.observations.flatMap((entry) => entry.evidenceReferences));
  const unavailableSeverity = requirement.requirement === BroadMarketBenchmarkRequirement.Required
    ? BroadMarketEvidenceIssueSeverity.Blocker
    : BroadMarketEvidenceIssueSeverity.Warning;
  const rejected = series.observations.find((entry) => entry.qualityStatus !== BroadMarketObservationQuality.Accepted);
  if (rejected !== undefined) {
    const code = rejected.qualityStatus === BroadMarketObservationQuality.Conflicting ? BroadMarketEvidenceIssueCode.DataQualityConflicting : BroadMarketEvidenceIssueCode.DataQualityRejected;
    issues.push(withBenchmark(code, unavailableSeverity, benchmarkId, "observations.qualityStatus", `Benchmark contains ${rejected.qualityStatus.toLowerCase()} canonical observation evidence.`));
    return deepFreeze({ benchmark: structuredClone(requirement.benchmark), requirement: requirement.requirement, status: BroadMarketBenchmarkStatus.Rejected, observationReferences, evidenceReferences, issues: sortIssues(issues) });
  }
  if (series.observations.length < request.policy.minimumObservationsPerBenchmark) {
    issues.push(withBenchmark(BroadMarketEvidenceIssueCode.InsufficientObservations, unavailableSeverity, benchmarkId, "observations", "Benchmark does not meet the configured minimum observation count."));
    return deepFreeze({ benchmark: structuredClone(requirement.benchmark), requirement: requirement.requirement, status: BroadMarketBenchmarkStatus.Insufficient, observationReferences, evidenceReferences, issues: sortIssues(issues) });
  }
  const features = calculateFeatures(series.observations, request.policy);
  const ageSeconds = Math.floor((Date.parse(request.assessedAt) - Date.parse(features.latestObservedAt)) / 1000);
  if (ageSeconds < 0 || ageSeconds > request.policy.freshnessThresholdSeconds) {
    issues.push(withBenchmark(BroadMarketEvidenceIssueCode.DataStale, unavailableSeverity, benchmarkId, "observations", "Latest benchmark observation is future-dated or exceeds the configured freshness threshold."));
    return deepFreeze({ benchmark: structuredClone(requirement.benchmark), requirement: requirement.requirement, status: BroadMarketBenchmarkStatus.Stale, features, observationReferences, evidenceReferences, issues: sortIssues(issues) });
  }
  return deepFreeze({
    benchmark: structuredClone(requirement.benchmark),
    requirement: requirement.requirement,
    status: BroadMarketBenchmarkStatus.Accepted,
    trendDirection: trendDirection(features.mediumReturnBasisPoints, request.policy),
    features,
    observationReferences,
    evidenceReferences,
    issues: [],
  });
}

function calculateFeatures(observations: readonly BroadMarketBenchmarkObservation[], policy: BroadMarketEvidencePolicy): BroadMarketBenchmarkFeatureSet {
  const medium = observations.slice(-policy.mediumWindow);
  const short = observations.slice(-policy.shortWindow);
  const current = last(medium).close;
  const maximum = medium.reduce((best, entry) => compareDecimal(entry.close, best) > 0 ? entry.close : best, medium[0]!.close);
  const minimum = medium.reduce((best, entry) => compareDecimal(entry.close, best) < 0 ? entry.close : best, medium[0]!.close);
  let maximumAbsoluteReturn = 0;
  for (let index = 1; index < medium.length; index += 1) {
    maximumAbsoluteReturn = Math.max(maximumAbsoluteReturn, Math.abs(changeBasisPoints(medium[index - 1]!.close, medium[index]!.close)));
  }
  return deepFreeze({
    shortReturnBasisPoints: changeBasisPoints(short[0]!.close, last(short).close),
    mediumReturnBasisPoints: changeBasisPoints(medium[0]!.close, current),
    drawdownFromWindowHighBasisPoints: Math.max(0, -changeBasisPoints(maximum, current)),
    reboundFromWindowLowBasisPoints: Math.max(0, changeBasisPoints(minimum, current)),
    maximumAbsoluteReturnBasisPoints: maximumAbsoluteReturn,
    windowRangeBasisPoints: Math.max(0, changeBasisPoints(minimum, maximum)),
    recoveryPercentageBasisPoints: recoveryPercentage(minimum, maximum, current),
    observationCount: observations.length,
    latestObservedAt: last(observations).observedAt,
  });
}

function recoveryPercentage(low: BarDecimal, high: BarDecimal, current: BarDecimal): number {
  const scale = Math.max(low.scale, high.scale, current.scale);
  const lowValue = scaledAtomic(low, scale);
  const highValue = scaledAtomic(high, scale);
  const currentValue = scaledAtomic(current, scale);
  if (highValue === lowValue) return 0;
  return safeNumber(((currentValue - lowValue) * 10_000n) / (highValue - lowValue));
}

function aggregate(summaries: readonly BroadMarketBenchmarkFeatureSummary[], policy: BroadMarketEvidencePolicy): BroadMarketAggregateFacts {
  const accepted = summaries.filter((entry) => entry.status === BroadMarketBenchmarkStatus.Accepted);
  const count = (direction: BroadMarketTrendDirection) => accepted.filter((entry) => entry.trendDirection === direction).length;
  const positive = count(BroadMarketTrendDirection.Positive);
  const negative = count(BroadMarketTrendDirection.Negative);
  const neutral = count(BroadMarketTrendDirection.Neutral);
  const agreement = Math.max(positive, negative, neutral);
  return deepFreeze({
    totalBenchmarkCount: summaries.length,
    requiredBenchmarkCount: summaries.filter((entry) => entry.requirement === BroadMarketBenchmarkRequirement.Required).length,
    optionalBenchmarkCount: summaries.filter((entry) => entry.requirement === BroadMarketBenchmarkRequirement.Optional).length,
    acceptedBenchmarkCount: accepted.length,
    agreementCount: agreement,
    disagreementCount: accepted.length - agreement,
    positiveTrendCount: positive,
    negativeTrendCount: negative,
    neutralTrendCount: neutral,
    reboundCount: accepted.filter((entry) => (entry.features?.reboundFromWindowLowBasisPoints ?? 0) >= policy.reboundThresholdBasisPoints).length,
    drawdownCount: accepted.filter((entry) => (entry.features?.drawdownFromWindowHighBasisPoints ?? 0) >= policy.drawdownThresholdBasisPoints).length,
    highVolatilityCount: accepted.filter((entry) => (entry.features?.maximumAbsoluteReturnBasisPoints ?? 0) >= policy.highVolatilityThresholdBasisPoints).length,
    staleBenchmarkCount: summaries.filter((entry) => entry.status === BroadMarketBenchmarkStatus.Stale).length,
    missingBenchmarkCount: summaries.filter((entry) => entry.status === BroadMarketBenchmarkStatus.Missing).length,
  });
}

function determineQuality(
  summaries: readonly BroadMarketBenchmarkFeatureSummary[],
  facts: BroadMarketAggregateFacts,
  policy: BroadMarketEvidencePolicy,
): BroadMarketEvidenceQuality {
  const required = summaries.filter((entry) => entry.requirement === BroadMarketBenchmarkRequirement.Required);
  const acceptedRequired = required.filter((entry) => entry.status === BroadMarketBenchmarkStatus.Accepted).length;
  if (required.length > 0 && required.every((entry) => entry.status === BroadMarketBenchmarkStatus.Stale)) return BroadMarketEvidenceQuality.Stale;
  if (acceptedRequired < policy.minimumRequiredBenchmarks) return BroadMarketEvidenceQuality.Insufficient;
  if (facts.positiveTrendCount >= policy.contradictionMinimumOpposingCount && facts.negativeTrendCount >= policy.contradictionMinimumOpposingCount) return BroadMarketEvidenceQuality.Contradictory;
  if (required.some((entry) => entry.status !== BroadMarketBenchmarkStatus.Accepted)) return BroadMarketEvidenceQuality.Partial;
  return BroadMarketEvidenceQuality.Complete;
}

function determineStrength(quality: BroadMarketEvidenceQuality, facts: BroadMarketAggregateFacts, policy: BroadMarketEvidencePolicy): BroadMarketEvidenceStrength {
  if (quality === BroadMarketEvidenceQuality.Insufficient || quality === BroadMarketEvidenceQuality.Stale) return BroadMarketEvidenceStrength.Insufficient;
  if (quality === BroadMarketEvidenceQuality.Partial || quality === BroadMarketEvidenceQuality.Contradictory) return BroadMarketEvidenceStrength.Weak;
  if (facts.agreementCount >= policy.strongAgreementCount) return BroadMarketEvidenceStrength.Strong;
  if (facts.agreementCount >= policy.moderateAgreementCount) return BroadMarketEvidenceStrength.Moderate;
  return BroadMarketEvidenceStrength.Weak;
}

function trendDirection(value: number, policy: BroadMarketEvidencePolicy): BroadMarketTrendDirection {
  if (value >= policy.positiveTrendThresholdBasisPoints) return BroadMarketTrendDirection.Positive;
  if (value <= -policy.negativeTrendThresholdBasisPoints) return BroadMarketTrendDirection.Negative;
  return BroadMarketTrendDirection.Neutral;
}

function validateAssessmentRequest(value: unknown): BroadMarketEvidenceAssessmentRequest {
  const issues: BroadMarketEvidenceIssue[] = [];
  if (!isRecord(value)) throw new BroadMarketEvidenceValidationError([blocker(BroadMarketEvidenceIssueCode.InvalidRecord, "$", "Assessment request must be an object.")]);
  if (value.schemaVersion !== BROAD_MARKET_EVIDENCE_SCHEMA_VERSION) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidSchemaVersion, "schemaVersion", "Schema version is unsupported."));
  if (!validIdentifier(value.assessmentId)) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidIdentifier, "assessmentId", "Assessment ID is invalid."));
  for (const field of ["assessedAt", "createdAt"] as const) if (!isTimestamp(value[field])) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidTimestamp, field, `${field} must be canonical UTC.`));
  issues.push(...validateBroadMarketEvidenceSnapshot(value.snapshot).issues.map((entry) => ({ ...entry, field: `snapshot.${entry.field}` })));
  issues.push(...validateBroadMarketEvidencePolicy(value.policy).issues.map((entry) => ({ ...entry, field: `policy.${entry.field}` })));
  if (isRecord(value.snapshot) && isRecord(value.policy)) {
    if (value.snapshot.interval !== value.policy.expectedInterval) issues.push(blocker(BroadMarketEvidenceIssueCode.PolicyBenchmarkMismatch, "snapshot.interval", "Snapshot interval does not match policy."));
    if (Array.isArray(value.snapshot.benchmarkSeries) && Array.isArray(value.policy.benchmarkRequirements)) {
      const snapshotIds = value.snapshot.benchmarkSeries.filter(isRecord).map((entry) => String(entry.benchmark && isRecord(entry.benchmark) ? entry.benchmark.instrumentId : "")).sort();
      const policyIds = value.policy.benchmarkRequirements.filter(isRecord).map((entry) => String(entry.benchmark && isRecord(entry.benchmark) ? entry.benchmark.instrumentId : "")).sort();
      if (JSON.stringify(snapshotIds) !== JSON.stringify(policyIds)) issues.push(blocker(BroadMarketEvidenceIssueCode.PolicyBenchmarkMismatch, "snapshot.benchmarkSeries", "Snapshot membership must exactly match the explicit policy benchmark membership."));
    }
  }
  if (isTimestamp(value.assessedAt) && isTimestamp(value.createdAt) && Date.parse(value.createdAt) < Date.parse(value.assessedAt)) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidTimestamp, "createdAt", "Creation timestamp cannot precede assessment time."));
  if (issues.length > 0) throw new BroadMarketEvidenceValidationError(sortIssues(issues));
  return value as unknown as BroadMarketEvidenceAssessmentRequest;
}

function validateSnapshotInput(value: unknown): BroadMarketEvidenceIssue[] {
  const issues: BroadMarketEvidenceIssue[] = [];
  if (!isRecord(value)) return [blocker(BroadMarketEvidenceIssueCode.InvalidRecord, "$", "Snapshot must be an object.")];
  if (value.schemaVersion !== BROAD_MARKET_EVIDENCE_SCHEMA_VERSION) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidSchemaVersion, "schemaVersion", "Schema version is unsupported."));
  if (!validIdentifier(value.snapshotId)) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidIdentifier, "snapshotId", "Snapshot ID is invalid."));
  for (const field of ["asOf", "createdAt"] as const) if (!isTimestamp(value[field])) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidTimestamp, field, `${field} must be canonical UTC.`));
  if (!Object.values(BarInterval).includes(value.interval as BarInterval)) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidWindow, "interval", "Interval is unsupported."));
  if (!isRecord(value.evidenceWindow) || !isTimestamp(value.evidenceWindow.start) || !isTimestamp(value.evidenceWindow.end) || Date.parse(String(value.evidenceWindow.end)) <= Date.parse(String(value.evidenceWindow.start))) {
    issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidWindow, "evidenceWindow", "Evidence window requires increasing canonical UTC timestamps."));
  }
  if (!isRecord(value.trace) || !validIdentifier(value.trace.correlationId) || !validIdentifier(value.trace.traceId) || !validStringArray(value.trace.auditReferenceIds)) {
    issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidIdentifier, "trace", "Trace metadata is invalid."));
  }
  if (!Array.isArray(value.benchmarkSeries) || value.benchmarkSeries.length === 0) {
    issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidBenchmark, "benchmarkSeries", "At least one explicit benchmark membership record is required."));
    return issues;
  }
  const seenBenchmarks = new Set<string>();
  value.benchmarkSeries.forEach((entry, index) => {
    const field = `benchmarkSeries[${String(index)}]`;
    if (!isRecord(entry)) { issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidRecord, field, "Benchmark series must be an object.")); return; }
    issues.push(...validateBenchmarkReference(entry.benchmark, `${field}.benchmark`));
    const benchmarkId = isRecord(entry.benchmark) && typeof entry.benchmark.instrumentId === "string" ? entry.benchmark.instrumentId : undefined;
    if (benchmarkId !== undefined) {
      if (seenBenchmarks.has(benchmarkId)) issues.push(withBenchmark(BroadMarketEvidenceIssueCode.InvalidBenchmark, BroadMarketEvidenceIssueSeverity.Blocker, benchmarkId, `${field}.benchmark.instrumentId`, "Benchmark membership must be unique."));
      seenBenchmarks.add(benchmarkId);
    }
    if (!Object.values(BroadMarketBenchmarkAvailability).includes(entry.availability as BroadMarketBenchmarkAvailability)) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidBenchmark, `${field}.availability`, "Availability is unsupported."));
    if (!Array.isArray(entry.observations)) { issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidRecord, `${field}.observations`, "Observations must be an array.")); return; }
    if (entry.observations.length > MAX_OBSERVATIONS) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidRecord, `${field}.observations`, "Observation count exceeds the bounded foundation limit."));
    if (entry.availability === BroadMarketBenchmarkAvailability.Missing && entry.observations.length > 0) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidBenchmark, `${field}.observations`, "Missing benchmark membership cannot contain observations."));
    let previous = Number.NEGATIVE_INFINITY;
    const seenTimes = new Set<number>();
    entry.observations.forEach((observation, observationIndex) => {
      const observationField = `${field}.observations[${String(observationIndex)}]`;
      issues.push(...validateObservation(observation, benchmarkId, observationField));
      if (isRecord(observation) && isTimestamp(observation.observedAt)) {
        const current = Date.parse(observation.observedAt);
        if (seenTimes.has(current)) issues.push(withOptionalBenchmark(BroadMarketEvidenceIssueCode.DuplicateTimestamp, benchmarkId, observationField, "Duplicate observation timestamp is prohibited."));
        else if (current <= previous) issues.push(withOptionalBenchmark(BroadMarketEvidenceIssueCode.InvalidChronology, benchmarkId, observationField, "Observations must be strictly chronological."));
        if (isRecord(value.evidenceWindow) && isTimestamp(value.evidenceWindow.start) && isTimestamp(value.evidenceWindow.end) && (current < Date.parse(value.evidenceWindow.start) || current > Date.parse(value.evidenceWindow.end))) issues.push(withOptionalBenchmark(BroadMarketEvidenceIssueCode.ObservationOutsideWindow, benchmarkId, observationField, "Observation is outside the declared evidence window."));
        seenTimes.add(current); previous = current;
      }
    });
  });
  if (isTimestamp(value.asOf) && isRecord(value.evidenceWindow) && isTimestamp(value.evidenceWindow.end) && Date.parse(value.asOf) < Date.parse(value.evidenceWindow.end)) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidTimestamp, "asOf", "As-of time cannot precede the evidence-window end."));
  return issues;
}

function validateBenchmarkReference(value: unknown, field: string): BroadMarketEvidenceIssue[] {
  const issues: BroadMarketEvidenceIssue[] = [];
  if (!isRecord(value)) return [blocker(BroadMarketEvidenceIssueCode.InvalidBenchmark, field, "Benchmark reference must be an object.")];
  if (!isCanonicalInstrumentId(value.instrumentId)) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidBenchmark, `${field}.instrumentId`, "Benchmark requires a canonical instrument ID."));
  if (value.assetClass !== InstrumentAssetClass.Etf && value.assetClass !== InstrumentAssetClass.Index) issues.push(blocker(BroadMarketEvidenceIssueCode.UnsupportedBenchmarkAssetClass, `${field}.assetClass`, "Only reviewed ETF or index identities may be broad-market benchmarks."));
  if (!Object.values(BroadMarketBenchmarkClassification).includes(value.classification as BroadMarketBenchmarkClassification)) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidBenchmark, `${field}.classification`, "Benchmark classification is unsupported."));
  if (!validVersion(value.metadataVersion)) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidBenchmark, `${field}.metadataVersion`, "Benchmark metadata version is invalid."));
  if (!validIdentifier(value.reviewReference)) issues.push(blocker(BroadMarketEvidenceIssueCode.InvalidBenchmark, `${field}.reviewReference`, "Benchmark review reference is required."));
  return issues;
}

function validateObservation(value: unknown, benchmarkId: string | undefined, field: string): BroadMarketEvidenceIssue[] {
  const issues: BroadMarketEvidenceIssue[] = [];
  if (!isRecord(value)) return [withOptionalBenchmark(BroadMarketEvidenceIssueCode.InvalidRecord, benchmarkId, field, "Observation must be an object.")];
  if (!validIdentifier(value.observationId)) issues.push(withOptionalBenchmark(BroadMarketEvidenceIssueCode.InvalidIdentifier, benchmarkId, `${field}.observationId`, "Observation ID is invalid."));
  if (typeof value.canonicalBarId !== "string" || !BAR_ID.test(value.canonicalBarId)) issues.push(withOptionalBenchmark(BroadMarketEvidenceIssueCode.InvalidIdentifier, benchmarkId, `${field}.canonicalBarId`, "Canonical Bar ID is invalid."));
  if (typeof value.canonicalBarFingerprint !== "string" || !BAR_FINGERPRINT.test(value.canonicalBarFingerprint)) issues.push(withOptionalBenchmark(BroadMarketEvidenceIssueCode.InvalidIdentifier, benchmarkId, `${field}.canonicalBarFingerprint`, "Canonical Bar fingerprint is invalid."));
  if (value.instrumentId !== benchmarkId) issues.push(withOptionalBenchmark(BroadMarketEvidenceIssueCode.InvalidBenchmark, benchmarkId, `${field}.instrumentId`, "Observation instrument must match benchmark membership."));
  if (!isTimestamp(value.observedAt)) issues.push(withOptionalBenchmark(BroadMarketEvidenceIssueCode.InvalidTimestamp, benchmarkId, `${field}.observedAt`, "Observation time must be canonical UTC."));
  if (!validPositiveDecimal(value.close)) issues.push(withOptionalBenchmark(BroadMarketEvidenceIssueCode.InvalidDecimal, benchmarkId, `${field}.close`, "Close must be a positive fixed decimal."));
  if (!Object.values(BroadMarketObservationQuality).includes(value.qualityStatus as BroadMarketObservationQuality)) issues.push(withOptionalBenchmark(BroadMarketEvidenceIssueCode.DataQualityRejected, benchmarkId, `${field}.qualityStatus`, "Observation quality is unsupported."));
  if (!validStringArray(value.evidenceReferences)) issues.push(withOptionalBenchmark(BroadMarketEvidenceIssueCode.InvalidIdentifier, benchmarkId, `${field}.evidenceReferences`, "Evidence references must be valid unique identifiers."));
  return issues;
}

function canonicalSnapshotInput(value: BroadMarketEvidenceSnapshotInput): BroadMarketEvidenceSnapshotInput {
  return deepFreeze({
    schemaVersion: BROAD_MARKET_EVIDENCE_SCHEMA_VERSION,
    snapshotId: value.snapshotId,
    asOf: value.asOf,
    evidenceWindow: { start: value.evidenceWindow.start, end: value.evidenceWindow.end },
    interval: value.interval,
    benchmarkSeries: [...value.benchmarkSeries].sort((a, b) => a.benchmark.instrumentId.localeCompare(b.benchmark.instrumentId)).map((series) => ({
      benchmark: canonicalBenchmark(series.benchmark),
      availability: series.availability,
      observations: series.observations.map((observation) => ({
        observationId: observation.observationId,
        canonicalBarId: observation.canonicalBarId,
        canonicalBarFingerprint: observation.canonicalBarFingerprint,
        instrumentId: observation.instrumentId,
        observedAt: observation.observedAt,
        close: { atomicValue: observation.close.atomicValue, scale: observation.close.scale },
        qualityStatus: observation.qualityStatus,
        evidenceReferences: uniqueSorted(observation.evidenceReferences),
      })),
    })),
    trace: { correlationId: value.trace.correlationId, traceId: value.trace.traceId, auditReferenceIds: uniqueSorted(value.trace.auditReferenceIds) },
    createdAt: value.createdAt,
  });
}

function canonicalBenchmark(value: BroadMarketBenchmarkReference): BroadMarketBenchmarkReference {
  return { instrumentId: value.instrumentId, assetClass: value.assetClass, classification: value.classification, metadataVersion: value.metadataVersion, reviewReference: value.reviewReference };
}

function compareRequirement(left: BroadMarketBenchmarkPolicyRequirement, right: BroadMarketBenchmarkPolicyRequirement): number { return left.benchmark.instrumentId.localeCompare(right.benchmark.instrumentId); }
function changeBasisPoints(from: BarDecimal, to: BarDecimal): number { return safeNumber(((scaledAtomic(to, Math.max(from.scale, to.scale)) - scaledAtomic(from, Math.max(from.scale, to.scale))) * 10_000n) / scaledAtomic(from, Math.max(from.scale, to.scale))); }
function compareDecimal(left: BarDecimal, right: BarDecimal): number { const scale = Math.max(left.scale, right.scale); const a = scaledAtomic(left, scale); const b = scaledAtomic(right, scale); return a < b ? -1 : a > b ? 1 : 0; }
function scaledAtomic(value: BarDecimal, scale: number): bigint { return BigInt(value.atomicValue) * (10n ** BigInt(scale - value.scale)); }
function safeNumber(value: bigint): number { if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) throw new BroadMarketEvidenceValidationError([blocker(BroadMarketEvidenceIssueCode.InvalidDecimal, "observations", "Calculated fixed-decimal result exceeds the deterministic numeric boundary.")]); return Number(value); }
function last<T>(values: readonly T[]): T { const value = values.at(-1); if (value === undefined) throw new BroadMarketEvidenceValidationError([blocker(BroadMarketEvidenceIssueCode.InsufficientObservations, "observations", "Required observation window is empty.")]); return value; }
function validPositiveDecimal(value: unknown): value is BarDecimal { return isRecord(value) && typeof value.atomicValue === "string" && INTEGER.test(value.atomicValue) && BigInt(value.atomicValue) > 0n && Number.isSafeInteger(value.scale) && (value.scale as number) >= 0 && (value.scale as number) <= 18; }
function validIdentifier(value: unknown): value is string { return typeof value === "string" && IDENTIFIER.test(value); }
function validVersion(value: unknown): value is string { return typeof value === "string" && VERSION.test(value); }
function positiveSafeInteger(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) > 0; }
function isTimestamp(value: unknown): value is string { if (typeof value !== "string") return false; const parsed = Date.parse(value); return Number.isFinite(parsed) && new Date(parsed).toISOString() === value; }
function validStringArray(value: unknown): value is string[] { return Array.isArray(value) && value.every(validIdentifier) && new Set(value).size === value.length; }
function blocker(code: BroadMarketEvidenceIssueCode, field: string, message: string): BroadMarketEvidenceIssue { return { code, severity: BroadMarketEvidenceIssueSeverity.Blocker, field, message }; }
function withOptionalBenchmark(code: BroadMarketEvidenceIssueCode, benchmarkInstrumentId: string | undefined, field: string, message: string): BroadMarketEvidenceIssue { return benchmarkInstrumentId === undefined ? blocker(code, field, message) : withBenchmark(code, BroadMarketEvidenceIssueSeverity.Blocker, benchmarkInstrumentId, field, message); }
function withBenchmark(code: BroadMarketEvidenceIssueCode, severity: BroadMarketEvidenceIssueSeverity, benchmarkInstrumentId: string, field: string, message: string): BroadMarketEvidenceIssue { return { code, severity, benchmarkInstrumentId, field, message }; }
function frozenValidation(values: readonly BroadMarketEvidenceIssue[]): BroadMarketEvidenceValidationResult { const issues = sortIssues(values); return deepFreeze({ valid: issues.length === 0, issues }); }
function sortIssues(values: readonly BroadMarketEvidenceIssue[]): BroadMarketEvidenceIssue[] { return values.map((entry) => ({ ...entry })).sort((a, b) => `${a.code}|${a.benchmarkInstrumentId ?? ""}|${a.field}|${a.message}`.localeCompare(`${b.code}|${b.benchmarkInstrumentId ?? ""}|${b.field}|${b.message}`)); }
function uniqueSorted(values: readonly string[]): string[] { return [...new Set(values)].sort((a, b) => a.localeCompare(b)); }
function fnv1a64(value: string): string { let hash = 0xcbf29ce484222325n; for (let index = 0; index < value.length; index += 1) { hash ^= BigInt(value.charCodeAt(index)); hash = BigInt.asUintN(64, hash * 0x100000001b3n); } return hash.toString(16).padStart(16, "0"); }
function canonicalize(value: unknown): string { if (value === null || typeof value !== "object") return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`; return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`).join(",")}}`; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function deepFreeze<T>(value: T): T { if (typeof value === "object" && value !== null && !Object.isFrozen(value)) { Object.freeze(value); for (const nested of Object.values(value)) deepFreeze(nested); } return value; }
