import {
  PERSONAL_DECISION_SCHEMA_VERSION,
  PersonalDecisionAuthorizationStatus,
  PersonalDecisionBlockerCode,
  PersonalDecisionCalibrationStatus,
  PersonalDecisionDirection,
  PersonalDecisionLiquidityStatus,
  PersonalDecisionMarketDataStatus,
  PersonalDecisionReasonCode,
  PersonalDecisionRiskStatus,
  PersonalDecisionThesisDirection,
  PersonalDecisionValidationIssueCode,
  type PersonalDecisionCard,
  type PersonalDecisionDecimal,
  type PersonalDecisionPolicy,
  type PersonalDecisionRequest,
  type PersonalDecisionValidationIssue,
} from "../../contracts/PersonalDecision";
import { EvidenceAssessmentStatus } from "../../contracts/EvidenceEngine";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:._-]{2,127}$/u;
const SYMBOL = /^[A-Z0-9][A-Z0-9.-]{0,14}$/u;
const CURRENCY = /^[A-Z]{3}$/u;
const INTEGER = /^(?:0|[1-9]\d*)$/u;
const MAX_ATOMIC_DIGITS = 24;
const MAX_DECIMAL_SCALE = 8;

export const DEFAULT_PERSONAL_DECISION_POLICY: PersonalDecisionPolicy = deepFreeze({
  policyId: "personal-decision:intraday:1",
  version: "1.0",
  maximumEvidenceAgeSeconds: 900,
  maximumMarketDataAgeSeconds: 120,
  maximumSpreadBasisPoints: 20,
  minimumProbabilityBasisPoints: 5_500,
  minimumCalibrationSampleSize: 100,
  minimumRewardToRiskBasisPoints: 15_000,
  maximumCapitalLossBasisPoints: 100,
});

export class PersonalDecisionValidationError extends Error {
  readonly issues: readonly PersonalDecisionValidationIssue[];

  constructor(issues: readonly PersonalDecisionValidationIssue[]) {
    super("Personal Decision request failed deterministic validation.");
    this.name = "PersonalDecisionValidationError";
    this.issues = deepFreeze([...issues]);
  }
}

const REQUEST_FIELDS = ["schemaVersion", "requestId", "evaluatedAt", "instrument", "evidence", "market", "probability", "tradePlan", "risk"] as const;
const INSTRUMENT_FIELDS = ["instrumentId", "symbol", "assetClass", "currency"] as const;
const EVIDENCE_FIELDS = ["assessmentId", "status", "evaluatedAt", "policyVersion", "references"] as const;
const MARKET_FIELDS = ["snapshotId", "observedAt", "status", "spreadBasisPoints", "liquidity"] as const;
const PROBABILITY_FIELDS = ["thesisId", "direction", "probabilityBasisPoints", "calibrationStatus", "calibrationPolicyVersion", "calibrationSampleSize", "outOfSampleValidated"] as const;
const PLAN_FIELDS = ["entryLower", "entryUpper", "stop", "targets", "maximumHoldingUntil"] as const;
const RISK_FIELDS = ["assessmentId", "status", "maximumCapitalLossBasisPoints", "constraints", "policyVersion"] as const;
const DECIMAL_FIELDS = ["atomicValue", "scale"] as const;

export function createPersonalDecisionCard(
  rawRequest: unknown,
  policy: PersonalDecisionPolicy = DEFAULT_PERSONAL_DECISION_POLICY,
): PersonalDecisionCard {
  validatePolicy(policy);
  const issues = validateRequest(rawRequest);
  if (issues.length > 0) throw new PersonalDecisionValidationError(issues);
  const request = rawRequest as PersonalDecisionRequest;

  const blockers = new Set<PersonalDecisionBlockerCode>();
  const evaluatedAt = Date.parse(request.evaluatedAt);
  const evidenceAt = Date.parse(request.evidence.evaluatedAt);
  const marketAt = Date.parse(request.market.observedAt);

  if (request.evidence.status !== EvidenceAssessmentStatus.Sufficient) {
    blockers.add(PersonalDecisionBlockerCode.EvidenceNotSufficient);
  }
  if (evaluatedAt - evidenceAt > policy.maximumEvidenceAgeSeconds * 1_000) {
    blockers.add(PersonalDecisionBlockerCode.EvidenceStale);
  }
  if (request.evidence.references.length === 0) {
    blockers.add(PersonalDecisionBlockerCode.EvidenceReferenceMissing);
  }

  if (request.market.status !== PersonalDecisionMarketDataStatus.Current) {
    blockers.add(PersonalDecisionBlockerCode.MarketDataNotCurrent);
  }
  if (evaluatedAt - marketAt > policy.maximumMarketDataAgeSeconds * 1_000) {
    blockers.add(PersonalDecisionBlockerCode.MarketDataStale);
  }
  if (request.market.spreadBasisPoints > policy.maximumSpreadBasisPoints) {
    blockers.add(PersonalDecisionBlockerCode.SpreadTooWide);
  }
  if (request.market.liquidity !== PersonalDecisionLiquidityStatus.Sufficient) {
    blockers.add(PersonalDecisionBlockerCode.LiquidityNotSufficient);
  }

  if (request.probability.calibrationStatus !== PersonalDecisionCalibrationStatus.Calibrated) {
    blockers.add(PersonalDecisionBlockerCode.ProbabilityNotCalibrated);
  }
  if (request.probability.calibrationSampleSize < policy.minimumCalibrationSampleSize) {
    blockers.add(PersonalDecisionBlockerCode.CalibrationSampleTooSmall);
  }
  if (!request.probability.outOfSampleValidated) {
    blockers.add(PersonalDecisionBlockerCode.OutOfSampleValidationMissing);
  }
  if (request.probability.probabilityBasisPoints < policy.minimumProbabilityBasisPoints) {
    blockers.add(PersonalDecisionBlockerCode.ProbabilityBelowThreshold);
  }

  if (
    request.risk.status !== PersonalDecisionRiskStatus.Approved &&
    request.risk.status !== PersonalDecisionRiskStatus.Constrained
  ) {
    blockers.add(PersonalDecisionBlockerCode.RiskNotApproved);
  }
  if (
    request.risk.status === PersonalDecisionRiskStatus.Constrained &&
    request.risk.constraints.length === 0
  ) {
    blockers.add(PersonalDecisionBlockerCode.ConstrainedRiskMissingConstraint);
  }
  if (request.risk.maximumCapitalLossBasisPoints > policy.maximumCapitalLossBasisPoints) {
    blockers.add(PersonalDecisionBlockerCode.PlannedLossExceedsLimit);
  }

  if (Date.parse(request.tradePlan.maximumHoldingUntil) <= evaluatedAt) {
    blockers.add(PersonalDecisionBlockerCode.HoldingDeadlineExpired);
  }

  const rewardToRisk = calculateRewardToRisk(request);
  if (rewardToRisk === null) {
    blockers.add(PersonalDecisionBlockerCode.InvalidDirectionalPlan);
  } else if (rewardToRisk < policy.minimumRewardToRiskBasisPoints) {
    blockers.add(PersonalDecisionBlockerCode.RewardToRiskBelowThreshold);
  }

  const blockerCodes = [...blockers].sort();
  const decision = blockerCodes.length > 0
    ? PersonalDecisionDirection.NoTrade
    : request.probability.direction === PersonalDecisionThesisDirection.Long
      ? PersonalDecisionDirection.Long
      : PersonalDecisionDirection.Short;
  const reasonCodes = createReasonCodes(request, blockerCodes, rewardToRisk, policy);
  const canonicalInput = canonicalize({ request, policy });
  const inputFingerprint = `fnv1a64:${fnv1a64(canonicalInput)}`;

  return deepFreeze({
    schemaVersion: PERSONAL_DECISION_SCHEMA_VERSION,
    decisionId: `personal-decision:${fnv1a64(`${inputFingerprint}|${request.evaluatedAt}`)}`,
    requestId: request.requestId,
    inputFingerprint,
    createdAt: request.evaluatedAt,
    instrument: structuredClone(request.instrument),
    decision,
    probability: structuredClone(request.probability),
    tradePlan: structuredClone(request.tradePlan),
    worstEntryRewardToRiskBasisPoints: rewardToRisk,
    evidenceAssessmentId: request.evidence.assessmentId,
    riskAssessmentId: request.risk.assessmentId,
    blockerCodes,
    reasonCodes,
    policyId: policy.policyId,
    policyVersion: policy.version,
    authorizationStatus: PersonalDecisionAuthorizationStatus.AdvisoryOnlyManualExecution,
    automatedExecutionAllowed: false,
    deterministic: true,
    readOnly: true,
  });
}

function calculateRewardToRisk(request: PersonalDecisionRequest): number | null {
  const lower = scaledAtomic(request.tradePlan.entryLower);
  const upper = scaledAtomic(request.tradePlan.entryUpper);
  const stop = scaledAtomic(request.tradePlan.stop);
  const target = scaledAtomic(request.tradePlan.targets[0] as PersonalDecisionDecimal);
  const scale = Math.max(lower.scale, upper.scale, stop.scale, target.scale);
  const entryLower = rescale(lower, scale);
  const entryUpper = rescale(upper, scale);
  const stopValue = rescale(stop, scale);
  const targetValue = rescale(target, scale);

  if (entryLower > entryUpper) return null;

  const isLong = request.probability.direction === PersonalDecisionThesisDirection.Long;
  const worstEntry = isLong ? entryUpper : entryLower;
  const risk = isLong ? worstEntry - stopValue : stopValue - worstEntry;
  const reward = isLong ? targetValue - worstEntry : worstEntry - targetValue;
  if (risk <= 0n || reward <= 0n) return null;

  const ratio = (reward * 10_000n) / risk;
  return ratio <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(ratio) : null;
}

function createReasonCodes(
  request: PersonalDecisionRequest,
  blockers: readonly PersonalDecisionBlockerCode[],
  rewardToRisk: number | null,
  policy: PersonalDecisionPolicy,
): readonly PersonalDecisionReasonCode[] {
  if (blockers.length > 0) {
    return [PersonalDecisionReasonCode.OneOrMoreActionGatesBlocked];
  }
  const reasons = [
    PersonalDecisionReasonCode.EvidenceGatePassed,
    PersonalDecisionReasonCode.MarketDataGatePassed,
    PersonalDecisionReasonCode.ProbabilityGatePassed,
    PersonalDecisionReasonCode.RiskGatePassed,
  ];
  if (rewardToRisk !== null && rewardToRisk >= policy.minimumRewardToRiskBasisPoints) {
    reasons.push(PersonalDecisionReasonCode.TradePlanGatePassed);
  }
  reasons.push(PersonalDecisionReasonCode.AllActionGatesPassed);
  return reasons;
}

function validateRequest(value: unknown): PersonalDecisionValidationIssue[] {
  const issues: PersonalDecisionValidationIssue[] = [];
  if (!isRecord(value)) {
    return [issue(PersonalDecisionValidationIssueCode.InvalidRequest, "$", "Request must be an object.")];
  }

  allowOnly(value, REQUEST_FIELDS, "$", issues);
  if (value.schemaVersion !== PERSONAL_DECISION_SCHEMA_VERSION) add(issues, PersonalDecisionValidationIssueCode.InvalidRequest, "schemaVersion", "Unsupported schema version.");
  identifier(value.requestId, "requestId", issues);
  timestamp(value.evaluatedAt, "evaluatedAt", issues);

  validateInstrument(value.instrument, issues);
  validateEvidence(value.evidence, issues);
  validateMarket(value.market, issues);
  validateProbability(value.probability, issues);
  validatePlan(value.tradePlan, issues);
  validateRisk(value.risk, issues);
  if (
    isCanonicalTimestamp(value.evaluatedAt) &&
    isRecord(value.evidence) &&
    isCanonicalTimestamp(value.evidence.evaluatedAt) &&
    Date.parse(value.evidence.evaluatedAt) > Date.parse(value.evaluatedAt)
  ) {
    add(issues, PersonalDecisionValidationIssueCode.InvalidTimestamp, "evidence.evaluatedAt", "Evidence cannot be evaluated after the decision.");
  }
  if (
    isCanonicalTimestamp(value.evaluatedAt) &&
    isRecord(value.market) &&
    isCanonicalTimestamp(value.market.observedAt) &&
    Date.parse(value.market.observedAt) > Date.parse(value.evaluatedAt)
  ) {
    add(issues, PersonalDecisionValidationIssueCode.InvalidTimestamp, "market.observedAt", "Market data cannot be observed after the decision.");
  }
  return issues.sort(compareIssues);
}

function validateInstrument(value: unknown, issues: PersonalDecisionValidationIssue[]): void {
  if (!recordAt(value, "instrument", issues)) return;
  allowOnly(value, INSTRUMENT_FIELDS, "instrument", issues);
  identifier(value.instrumentId, "instrument.instrumentId", issues);
  if (typeof value.symbol !== "string" || !SYMBOL.test(value.symbol)) add(issues, PersonalDecisionValidationIssueCode.InvalidIdentifier, "instrument.symbol", "Symbol must be an uppercase canonical symbol.");
  if (value.assetClass !== "EQUITY" && value.assetClass !== "ETF") add(issues, PersonalDecisionValidationIssueCode.InvalidEnum, "instrument.assetClass", "Asset class must be EQUITY or ETF.");
  if (typeof value.currency !== "string" || !CURRENCY.test(value.currency)) add(issues, PersonalDecisionValidationIssueCode.InvalidIdentifier, "instrument.currency", "Currency must be a three-letter uppercase code.");
}

function validateEvidence(value: unknown, issues: PersonalDecisionValidationIssue[]): void {
  if (!recordAt(value, "evidence", issues)) return;
  allowOnly(value, EVIDENCE_FIELDS, "evidence", issues);
  identifier(value.assessmentId, "evidence.assessmentId", issues);
  enumValue(value.status, EvidenceAssessmentStatus, "evidence.status", issues);
  timestamp(value.evaluatedAt, "evidence.evaluatedAt", issues);
  identifier(value.policyVersion, "evidence.policyVersion", issues);
  stringArray(value.references, "evidence.references", issues);
}

function validateMarket(value: unknown, issues: PersonalDecisionValidationIssue[]): void {
  if (!recordAt(value, "market", issues)) return;
  allowOnly(value, MARKET_FIELDS, "market", issues);
  identifier(value.snapshotId, "market.snapshotId", issues);
  timestamp(value.observedAt, "market.observedAt", issues);
  enumValue(value.status, PersonalDecisionMarketDataStatus, "market.status", issues);
  basisPoints(value.spreadBasisPoints, "market.spreadBasisPoints", 10_000, issues);
  enumValue(value.liquidity, PersonalDecisionLiquidityStatus, "market.liquidity", issues);
}

function validateProbability(value: unknown, issues: PersonalDecisionValidationIssue[]): void {
  if (!recordAt(value, "probability", issues)) return;
  allowOnly(value, PROBABILITY_FIELDS, "probability", issues);
  identifier(value.thesisId, "probability.thesisId", issues);
  enumValue(value.direction, PersonalDecisionThesisDirection, "probability.direction", issues);
  basisPoints(value.probabilityBasisPoints, "probability.probabilityBasisPoints", 10_000, issues);
  enumValue(value.calibrationStatus, PersonalDecisionCalibrationStatus, "probability.calibrationStatus", issues);
  identifier(value.calibrationPolicyVersion, "probability.calibrationPolicyVersion", issues);
  nonNegativeInteger(value.calibrationSampleSize, "probability.calibrationSampleSize", issues);
  if (typeof value.outOfSampleValidated !== "boolean") add(issues, PersonalDecisionValidationIssueCode.InvalidRequest, "probability.outOfSampleValidated", "Value must be boolean.");
}

function validatePlan(value: unknown, issues: PersonalDecisionValidationIssue[]): void {
  if (!recordAt(value, "tradePlan", issues)) return;
  allowOnly(value, PLAN_FIELDS, "tradePlan", issues);
  decimal(value.entryLower, "tradePlan.entryLower", issues);
  decimal(value.entryUpper, "tradePlan.entryUpper", issues);
  decimal(value.stop, "tradePlan.stop", issues);
  if (!Array.isArray(value.targets) || value.targets.length === 0 || value.targets.length > 5) {
    add(issues, PersonalDecisionValidationIssueCode.InvalidArray, "tradePlan.targets", "One to five targets are required.");
  } else {
    value.targets.forEach((target, index) => decimal(target, `tradePlan.targets[${String(index)}]`, issues));
  }
  timestamp(value.maximumHoldingUntil, "tradePlan.maximumHoldingUntil", issues);
}

function validateRisk(value: unknown, issues: PersonalDecisionValidationIssue[]): void {
  if (!recordAt(value, "risk", issues)) return;
  allowOnly(value, RISK_FIELDS, "risk", issues);
  identifier(value.assessmentId, "risk.assessmentId", issues);
  enumValue(value.status, PersonalDecisionRiskStatus, "risk.status", issues);
  basisPoints(value.maximumCapitalLossBasisPoints, "risk.maximumCapitalLossBasisPoints", 10_000, issues);
  stringArray(value.constraints, "risk.constraints", issues);
  identifier(value.policyVersion, "risk.policyVersion", issues);
}

function validatePolicy(policy: PersonalDecisionPolicy): void {
  const invalid =
    !IDENTIFIER.test(policy.policyId) ||
    !IDENTIFIER.test(policy.version) ||
    !Number.isSafeInteger(policy.maximumEvidenceAgeSeconds) ||
    policy.maximumEvidenceAgeSeconds <= 0 ||
    !Number.isSafeInteger(policy.maximumMarketDataAgeSeconds) ||
    policy.maximumMarketDataAgeSeconds <= 0 ||
    !Number.isSafeInteger(policy.maximumSpreadBasisPoints) ||
    policy.maximumSpreadBasisPoints < 0 ||
    !Number.isSafeInteger(policy.minimumProbabilityBasisPoints) ||
    policy.minimumProbabilityBasisPoints <= 5_000 ||
    policy.minimumProbabilityBasisPoints > 10_000 ||
    !Number.isSafeInteger(policy.minimumCalibrationSampleSize) ||
    policy.minimumCalibrationSampleSize <= 0 ||
    !Number.isSafeInteger(policy.minimumRewardToRiskBasisPoints) ||
    policy.minimumRewardToRiskBasisPoints <= 0 ||
    !Number.isSafeInteger(policy.maximumCapitalLossBasisPoints) ||
    policy.maximumCapitalLossBasisPoints <= 0 ||
    policy.maximumCapitalLossBasisPoints > 10_000;
  if (invalid) {
    throw new PersonalDecisionValidationError([
      issue(PersonalDecisionValidationIssueCode.InvalidPolicy, "policy", "Policy contains an invalid deterministic boundary."),
    ]);
  }
}

function decimal(value: unknown, field: string, issues: PersonalDecisionValidationIssue[]): void {
  if (!isRecord(value)) {
    add(issues, PersonalDecisionValidationIssueCode.InvalidDecimal, field, "Price must be a fixed-decimal object.");
    return;
  }
  allowOnly(value, DECIMAL_FIELDS, field, issues);
  if (
    typeof value.atomicValue !== "string" ||
    !INTEGER.test(value.atomicValue) ||
    value.atomicValue.length > MAX_ATOMIC_DIGITS ||
    BigInt(value.atomicValue) <= 0n ||
    !Number.isSafeInteger(value.scale) ||
    (value.scale as number) < 0 ||
    (value.scale as number) > MAX_DECIMAL_SCALE
  ) {
    add(issues, PersonalDecisionValidationIssueCode.InvalidDecimal, field, "Price must be positive with at most 24 atomic digits and scale 0-8.");
  }
}

function allowOnly(record: Record<string, unknown>, fields: readonly string[], path: string, issues: PersonalDecisionValidationIssue[]): void {
  const allowed = new Set(fields);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) add(issues, PersonalDecisionValidationIssueCode.UndeclaredField, `${path}.${key}`, "Undeclared fields fail closed.");
  }
}

function recordAt(value: unknown, field: string, issues: PersonalDecisionValidationIssue[]): value is Record<string, unknown> {
  if (isRecord(value)) return true;
  add(issues, PersonalDecisionValidationIssueCode.InvalidRequest, field, "Value must be an object.");
  return false;
}

function identifier(value: unknown, field: string, issues: PersonalDecisionValidationIssue[]): void {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) add(issues, PersonalDecisionValidationIssueCode.InvalidIdentifier, field, "Value must be a bounded identifier.");
}

function timestamp(value: unknown, field: string, issues: PersonalDecisionValidationIssue[]): void {
  if (!isCanonicalTimestamp(value)) {
    add(issues, PersonalDecisionValidationIssueCode.InvalidTimestamp, field, "Value must be a canonical UTC timestamp.");
  }
}

function isCanonicalTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString() === value;
}

function basisPoints(value: unknown, field: string, maximum: number, issues: PersonalDecisionValidationIssue[]): void {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    add(issues, PersonalDecisionValidationIssueCode.InvalidBasisPoints, field, `Value must be an integer from 0 to ${String(maximum)}.`);
  }
}

function nonNegativeInteger(value: unknown, field: string, issues: PersonalDecisionValidationIssue[]): void {
  if (!Number.isSafeInteger(value) || (value as number) < 0) add(issues, PersonalDecisionValidationIssueCode.InvalidRequest, field, "Value must be a non-negative safe integer.");
}

function stringArray(value: unknown, field: string, issues: PersonalDecisionValidationIssue[]): void {
  if (!Array.isArray(value) || value.length > 32 || value.some((item) => typeof item !== "string" || item.trim().length === 0 || item.length > 256)) {
    add(issues, PersonalDecisionValidationIssueCode.InvalidArray, field, "Value must be a bounded array of non-empty strings.");
  }
}

function enumValue(value: unknown, enumeration: Record<string, string>, field: string, issues: PersonalDecisionValidationIssue[]): void {
  if (typeof value !== "string" || !Object.values(enumeration).includes(value)) add(issues, PersonalDecisionValidationIssueCode.InvalidEnum, field, "Value is not an allowed enum member.");
}

function scaledAtomic(value: PersonalDecisionDecimal): { atomic: bigint; scale: number } {
  return { atomic: BigInt(value.atomicValue), scale: value.scale };
}

function rescale(value: { atomic: bigint; scale: number }, scale: number): bigint {
  return value.atomic * 10n ** BigInt(scale - value.scale);
}

function issue(code: PersonalDecisionValidationIssueCode, field: string, message: string): PersonalDecisionValidationIssue {
  return { code, field, message };
}

function add(issues: PersonalDecisionValidationIssue[], code: PersonalDecisionValidationIssueCode, field: string, message: string): void {
  issues.push(issue(code, field, message));
}

function compareIssues(left: PersonalDecisionValidationIssue, right: PersonalDecisionValidationIssue): number {
  return left.code.localeCompare(right.code) || left.field.localeCompare(right.field) || left.message.localeCompare(right.message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
