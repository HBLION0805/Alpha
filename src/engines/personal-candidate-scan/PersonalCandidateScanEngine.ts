import {
  BarFreshnessStatus,
  BarInterval,
  CanonicalBarStatus,
} from "../../contracts/CanonicalBar";
import {
  PERSONAL_CANDIDATE_SCAN_SCHEMA_VERSION,
  PersonalCandidateBlockerCode,
  PersonalCandidateExposure,
  PersonalCandidateMappingStatus,
  PersonalCandidateReasonCode,
  PersonalCandidateSession,
  PersonalCandidateStatus,
  PersonalCandidateStructure,
  PersonalCandidateTimeframeDirection,
  PersonalCandidateValidationIssueCode,
  type PersonalCandidateBarEndpoint,
  type PersonalCandidateInput,
  type PersonalCandidateResult,
  type PersonalCandidateScanPolicy,
  type PersonalCandidateScanRequest,
  type PersonalCandidateScanResult,
  type PersonalCandidateTimeframeAssessment,
  type PersonalCandidateTimeframeInput,
  type PersonalCandidateValidationIssue,
} from "../../contracts/PersonalCandidateScan";
import {
  PersonalDecisionLiquidityStatus,
  PersonalDecisionMarketDataStatus,
  PersonalDecisionThesisDirection,
  type PersonalDecisionDecimal,
} from "../../contracts/PersonalDecision";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:._-]{2,127}$/u;
const SYMBOL = /^[A-Z0-9][A-Z0-9.-]{0,14}$/u;
const CURRENCY = /^[A-Z]{3}$/u;
const INTEGER = /^(?:0|[1-9]\d*)$/u;
const FINGERPRINT = /^fnv1a64:[a-f0-9]{16}$/u;
const REQUIRED_INTERVALS = [
  BarInterval.OneDay,
  BarInterval.OneHour,
  BarInterval.FifteenMinutes,
  BarInterval.FiveMinutes,
] as const;
const MAX_ATOMIC_DIGITS = 24;
const MAX_DECIMAL_SCALE = 8;

export const DEFAULT_PERSONAL_CANDIDATE_SCAN_POLICY: PersonalCandidateScanPolicy = deepFreeze({
  policyId: "personal-candidate-scan:intraday:1",
  version: "1.0",
  maximumCandidates: 32,
  maximumMarketDataAgeSeconds: 120,
  maximumSpreadBasisPoints: 20,
  timeframePolicies: [
    { interval: BarInterval.OneDay, flatThresholdBasisPoints: 20, maximumObservationAgeSeconds: 345_600 },
    { interval: BarInterval.OneHour, flatThresholdBasisPoints: 10, maximumObservationAgeSeconds: 7_200 },
    { interval: BarInterval.FifteenMinutes, flatThresholdBasisPoints: 5, maximumObservationAgeSeconds: 1_800 },
    { interval: BarInterval.FiveMinutes, flatThresholdBasisPoints: 3, maximumObservationAgeSeconds: 600 },
  ],
});

export class PersonalCandidateValidationError extends Error {
  readonly issues: readonly PersonalCandidateValidationIssue[];

  constructor(issues: readonly PersonalCandidateValidationIssue[]) {
    super("Personal Candidate Scan request failed deterministic validation.");
    this.name = "PersonalCandidateValidationError";
    this.issues = deepFreeze([...issues]);
  }
}

const REQUEST_FIELDS = ["schemaVersion", "scanId", "profileId", "profileVersion", "evaluatedAt", "session", "candidates"] as const;
const CANDIDATE_FIELDS = ["candidateId", "themeId", "analysisInstrument", "tradeVehicle", "mapping", "timeframes", "quote"] as const;
const ANALYSIS_INSTRUMENT_FIELDS = ["instrumentId", "symbol", "assetClass", "currency"] as const;
const TRADE_VEHICLE_FIELDS = ["instrumentId", "symbol", "assetClass", "currency"] as const;
const MAPPING_FIELDS = ["mappingId", "version", "status", "exposure", "evidenceReferences"] as const;
const TIMEFRAME_FIELDS = ["interval", "start", "end", "status", "freshness", "evidenceReferences"] as const;
const ENDPOINT_FIELDS = ["barId", "fingerprint", "intervalEnd", "close"] as const;
const DECIMAL_FIELDS = ["atomicValue", "scale"] as const;
const QUOTE_FIELDS = ["snapshotId", "observedAt", "status", "spreadBasisPoints", "liquidity"] as const;

export function scanPersonalCandidates(
  rawRequest: unknown,
  policy: PersonalCandidateScanPolicy = DEFAULT_PERSONAL_CANDIDATE_SCAN_POLICY,
): PersonalCandidateScanResult {
  validatePolicy(policy);
  const issues = validateRequest(rawRequest, policy);
  if (issues.length > 0) throw new PersonalCandidateValidationError(issues);
  const request = rawRequest as PersonalCandidateScanRequest;

  const candidates = request.candidates
    .map((candidate) => evaluateCandidate(candidate, request, policy))
    .sort(compareCandidateResults);
  const canonicalInput = canonicalize({ request, policy });
  const inputFingerprint = `fnv1a64:${fnv1a64(canonicalInput)}`;

  return deepFreeze({
    schemaVersion: PERSONAL_CANDIDATE_SCAN_SCHEMA_VERSION,
    scanId: request.scanId,
    resultId: `personal-candidate-scan:${fnv1a64(`${inputFingerprint}|${request.evaluatedAt}`)}`,
    inputFingerprint,
    evaluatedAt: request.evaluatedAt,
    session: request.session,
    candidates,
    readyCount: candidates.filter(({ status }) => status === PersonalCandidateStatus.ReadyForDecision).length,
    watchCount: candidates.filter(({ status }) => status === PersonalCandidateStatus.WatchTrigger).length,
    excludedCount: candidates.filter(({ status }) => status === PersonalCandidateStatus.Excluded).length,
    policyId: policy.policyId,
    policyVersion: policy.version,
    unranked: true,
    advisoryOnly: true,
    automatedExecutionAllowed: false,
    deterministic: true,
    readOnly: true,
  });
}

function evaluateCandidate(
  candidate: PersonalCandidateInput,
  request: PersonalCandidateScanRequest,
  policy: PersonalCandidateScanPolicy,
): PersonalCandidateResult {
  const blockers = new Set<PersonalCandidateBlockerCode>();
  const reasonCodes = new Set<PersonalCandidateReasonCode>();
  const evaluatedAt = Date.parse(request.evaluatedAt);

  if (candidate.mapping.status !== PersonalCandidateMappingStatus.Reviewed) {
    blockers.add(PersonalCandidateBlockerCode.MappingNotReviewed);
  }
  if (candidate.mapping.evidenceReferences.length === 0) {
    blockers.add(PersonalCandidateBlockerCode.MappingEvidenceMissing);
  }
  if (
    candidate.mapping.status === PersonalCandidateMappingStatus.Reviewed &&
    candidate.mapping.evidenceReferences.length > 0
  ) {
    reasonCodes.add(PersonalCandidateReasonCode.MappingGatePassed);
  }

  const assessments = candidate.timeframes
    .map((timeframe) => assessTimeframe(timeframe, policy))
    .sort((left, right) => intervalOrder(left.interval) - intervalOrder(right.interval));
  for (const timeframe of candidate.timeframes) {
    const intervalPolicy = policy.timeframePolicies.find(({ interval }) => interval === timeframe.interval);
    if (timeframe.freshness !== BarFreshnessStatus.Current) {
      blockers.add(PersonalCandidateBlockerCode.TimeframeDataStale);
    }
    if (
      intervalPolicy !== undefined &&
      evaluatedAt - Date.parse(timeframe.end.intervalEnd) > intervalPolicy.maximumObservationAgeSeconds * 1_000
    ) {
      blockers.add(PersonalCandidateBlockerCode.TimeframeObservationTooOld);
    }
    if (timeframe.status !== CanonicalBarStatus.Final) {
      blockers.add(PersonalCandidateBlockerCode.PartialBarNotAllowed);
    }
    if (timeframe.evidenceReferences.length === 0) {
      blockers.add(PersonalCandidateBlockerCode.TimeframeEvidenceMissing);
    }
  }
  if (
    !hasAny(blockers, [
      PersonalCandidateBlockerCode.TimeframeDataStale,
      PersonalCandidateBlockerCode.TimeframeObservationTooOld,
      PersonalCandidateBlockerCode.PartialBarNotAllowed,
      PersonalCandidateBlockerCode.TimeframeEvidenceMissing,
    ])
  ) {
    reasonCodes.add(PersonalCandidateReasonCode.TimeframeDataGatePassed);
  }

  const structure = deriveStructure(assessments);
  if (structure === PersonalCandidateStructure.Mixed) {
    blockers.add(PersonalCandidateBlockerCode.TimeframeStructureMixed);
  } else {
    reasonCodes.add(PersonalCandidateReasonCode.ContextAndSetupAligned);
  }
  if (
    structure === PersonalCandidateStructure.BullishAwaitingTrigger ||
    structure === PersonalCandidateStructure.BearishAwaitingTrigger
  ) {
    blockers.add(PersonalCandidateBlockerCode.TriggerNotConfirmed);
    reasonCodes.add(PersonalCandidateReasonCode.TriggerPending);
  } else if (
    structure === PersonalCandidateStructure.AlignedBullish ||
    structure === PersonalCandidateStructure.AlignedBearish
  ) {
    reasonCodes.add(PersonalCandidateReasonCode.TriggerConfirmed);
  }

  if (!exposureMatches(candidate.mapping.exposure, structure)) {
    blockers.add(PersonalCandidateBlockerCode.ExposureMismatch);
  } else {
    reasonCodes.add(PersonalCandidateReasonCode.ExposureMatched);
  }

  if (candidate.quote.status !== PersonalDecisionMarketDataStatus.Current) {
    blockers.add(PersonalCandidateBlockerCode.MarketDataNotCurrent);
  }
  if (evaluatedAt - Date.parse(candidate.quote.observedAt) > policy.maximumMarketDataAgeSeconds * 1_000) {
    blockers.add(PersonalCandidateBlockerCode.MarketDataTooOld);
  }
  if (candidate.quote.spreadBasisPoints > policy.maximumSpreadBasisPoints) {
    blockers.add(PersonalCandidateBlockerCode.SpreadTooWide);
  }
  if (candidate.quote.liquidity !== PersonalDecisionLiquidityStatus.Sufficient) {
    blockers.add(PersonalCandidateBlockerCode.LiquidityNotSufficient);
  }
  if (
    !hasAny(blockers, [
      PersonalCandidateBlockerCode.MarketDataNotCurrent,
      PersonalCandidateBlockerCode.MarketDataTooOld,
      PersonalCandidateBlockerCode.SpreadTooWide,
      PersonalCandidateBlockerCode.LiquidityNotSufficient,
    ])
  ) {
    reasonCodes.add(PersonalCandidateReasonCode.MarketGatePassed);
  }

  const blockerCodes = [...blockers].sort();
  const status =
    blockerCodes.length === 0
      ? PersonalCandidateStatus.ReadyForDecision
      : blockerCodes.length === 1 && blockerCodes[0] === PersonalCandidateBlockerCode.TriggerNotConfirmed
        ? PersonalCandidateStatus.WatchTrigger
        : PersonalCandidateStatus.Excluded;

  if (status === PersonalCandidateStatus.ReadyForDecision) {
    reasonCodes.add(PersonalCandidateReasonCode.ReadyForFullDecisionEvaluation);
  }

  const common = {
    candidateId: candidate.candidateId,
    themeId: candidate.themeId,
    analysisInstrument: structuredClone(candidate.analysisInstrument),
    tradeVehicle: structuredClone(candidate.tradeVehicle),
    exposure: candidate.mapping.exposure,
    structure,
    status,
    timeframeAssessments: assessments,
    blockerCodes,
    reasonCodes: [...reasonCodes].sort(),
  };

  if (status !== PersonalCandidateStatus.ReadyForDecision) return common;

  return {
    ...common,
    decisionSeed: {
      instrument: structuredClone(candidate.tradeVehicle),
      market: {
        snapshotId: candidate.quote.snapshotId,
        observedAt: candidate.quote.observedAt,
        status: candidate.quote.status,
        spreadBasisPoints: candidate.quote.spreadBasisPoints,
        liquidity: candidate.quote.liquidity,
      },
      direction: PersonalDecisionThesisDirection.Long,
      sourceScanId: request.scanId,
      sourceCandidateId: candidate.candidateId,
    },
  };
}

function assessTimeframe(
  timeframe: PersonalCandidateTimeframeInput,
  policy: PersonalCandidateScanPolicy,
): PersonalCandidateTimeframeAssessment {
  const intervalPolicy = policy.timeframePolicies.find(({ interval }) => interval === timeframe.interval);
  if (intervalPolicy === undefined) throw new Error("Validated timeframe policy is missing.");
  const returnBasisPoints = decimalChangeBasisPoints(timeframe.start.close, timeframe.end.close);
  const direction =
    returnBasisPoints > intervalPolicy.flatThresholdBasisPoints
      ? PersonalCandidateTimeframeDirection.Up
      : returnBasisPoints < -intervalPolicy.flatThresholdBasisPoints
        ? PersonalCandidateTimeframeDirection.Down
        : PersonalCandidateTimeframeDirection.Flat;
  return deepFreeze({
    interval: timeframe.interval,
    startBarId: timeframe.start.barId,
    endBarId: timeframe.end.barId,
    returnBasisPoints,
    direction,
    evidenceReferences: [...new Set(timeframe.evidenceReferences)].sort(),
  });
}

function deriveStructure(
  assessments: readonly PersonalCandidateTimeframeAssessment[],
): PersonalCandidateStructure {
  const direction = (interval: BarInterval): PersonalCandidateTimeframeDirection =>
    (assessments.find((item) => item.interval === interval) as PersonalCandidateTimeframeAssessment).direction;
  const daily = direction(BarInterval.OneDay);
  const hourly = direction(BarInterval.OneHour);
  const setup = direction(BarInterval.FifteenMinutes);
  const trigger = direction(BarInterval.FiveMinutes);

  if (
    hourly === PersonalCandidateTimeframeDirection.Up &&
    setup === PersonalCandidateTimeframeDirection.Up &&
    daily !== PersonalCandidateTimeframeDirection.Down
  ) {
    return trigger === PersonalCandidateTimeframeDirection.Up
      ? PersonalCandidateStructure.AlignedBullish
      : PersonalCandidateStructure.BullishAwaitingTrigger;
  }
  if (
    hourly === PersonalCandidateTimeframeDirection.Down &&
    setup === PersonalCandidateTimeframeDirection.Down &&
    daily !== PersonalCandidateTimeframeDirection.Up
  ) {
    return trigger === PersonalCandidateTimeframeDirection.Down
      ? PersonalCandidateStructure.AlignedBearish
      : PersonalCandidateStructure.BearishAwaitingTrigger;
  }
  return PersonalCandidateStructure.Mixed;
}

function exposureMatches(
  exposure: PersonalCandidateExposure,
  structure: PersonalCandidateStructure,
): boolean {
  return exposure === PersonalCandidateExposure.Bullish
    ? structure === PersonalCandidateStructure.AlignedBullish ||
        structure === PersonalCandidateStructure.BullishAwaitingTrigger
    : structure === PersonalCandidateStructure.AlignedBearish ||
        structure === PersonalCandidateStructure.BearishAwaitingTrigger;
}

function validateRequest(
  value: unknown,
  policy: PersonalCandidateScanPolicy,
): PersonalCandidateValidationIssue[] {
  const issues: PersonalCandidateValidationIssue[] = [];
  if (!isRecord(value)) {
    return [issue(PersonalCandidateValidationIssueCode.InvalidRequest, "$", "Request must be an object.")];
  }
  allowOnly(value, REQUEST_FIELDS, "$", issues);
  if (value.schemaVersion !== PERSONAL_CANDIDATE_SCAN_SCHEMA_VERSION) add(issues, PersonalCandidateValidationIssueCode.InvalidRequest, "schemaVersion", "Unsupported schema version.");
  identifier(value.scanId, "scanId", issues);
  identifier(value.profileId, "profileId", issues);
  identifier(value.profileVersion, "profileVersion", issues);
  timestamp(value.evaluatedAt, "evaluatedAt", issues);
  enumValue(value.session, PersonalCandidateSession, "session", issues);
  if (!Array.isArray(value.candidates) || value.candidates.length === 0 || value.candidates.length > policy.maximumCandidates) {
    add(issues, PersonalCandidateValidationIssueCode.InvalidArray, "candidates", `One to ${String(policy.maximumCandidates)} candidates are required.`);
  } else {
    const ids = new Set<string>();
    const vehicleIds = new Set<string>();
    value.candidates.forEach((candidate, index) => {
      validateCandidate(candidate, index, value.evaluatedAt, issues);
      if (isRecord(candidate) && typeof candidate.candidateId === "string") {
        if (ids.has(candidate.candidateId)) add(issues, PersonalCandidateValidationIssueCode.DuplicateCandidate, `candidates[${String(index)}].candidateId`, "Candidate IDs must be unique.");
        ids.add(candidate.candidateId);
      }
      if (isRecord(candidate) && isRecord(candidate.tradeVehicle) && typeof candidate.tradeVehicle.instrumentId === "string") {
        if (vehicleIds.has(candidate.tradeVehicle.instrumentId)) add(issues, PersonalCandidateValidationIssueCode.DuplicateCandidate, `candidates[${String(index)}].tradeVehicle.instrumentId`, "Trade vehicles may appear only once per scan.");
        vehicleIds.add(candidate.tradeVehicle.instrumentId);
      }
    });
  }
  return issues.sort(compareIssues);
}

function validateCandidate(
  value: unknown,
  index: number,
  evaluatedAt: unknown,
  issues: PersonalCandidateValidationIssue[],
): void {
  const path = `candidates[${String(index)}]`;
  if (!recordAt(value, path, issues)) return;
  allowOnly(value, CANDIDATE_FIELDS, path, issues);
  identifier(value.candidateId, `${path}.candidateId`, issues);
  identifier(value.themeId, `${path}.themeId`, issues);
  validateInstrument(value.analysisInstrument, `${path}.analysisInstrument`, ANALYSIS_INSTRUMENT_FIELDS, true, issues);
  validateInstrument(value.tradeVehicle, `${path}.tradeVehicle`, TRADE_VEHICLE_FIELDS, false, issues);
  validateMapping(value.mapping, `${path}.mapping`, issues);
  validateTimeframes(value.timeframes, `${path}.timeframes`, evaluatedAt, issues);
  validateQuote(value.quote, `${path}.quote`, evaluatedAt, issues);
}

function validateInstrument(
  value: unknown,
  path: string,
  fields: readonly string[],
  allowIndex: boolean,
  issues: PersonalCandidateValidationIssue[],
): void {
  if (!recordAt(value, path, issues)) return;
  allowOnly(value, fields, path, issues);
  identifier(value.instrumentId, `${path}.instrumentId`, issues);
  if (typeof value.symbol !== "string" || !SYMBOL.test(value.symbol)) add(issues, PersonalCandidateValidationIssueCode.InvalidIdentifier, `${path}.symbol`, "Symbol must be an uppercase canonical symbol.");
  const allowed = allowIndex ? ["EQUITY", "ETF", "INDEX"] : ["EQUITY", "ETF"];
  if (typeof value.assetClass !== "string" || !allowed.includes(value.assetClass)) add(issues, PersonalCandidateValidationIssueCode.InvalidEnum, `${path}.assetClass`, "Asset class is not supported.");
  if (typeof value.currency !== "string" || !CURRENCY.test(value.currency)) add(issues, PersonalCandidateValidationIssueCode.InvalidIdentifier, `${path}.currency`, "Currency must be a three-letter uppercase code.");
}

function validateMapping(value: unknown, path: string, issues: PersonalCandidateValidationIssue[]): void {
  if (!recordAt(value, path, issues)) return;
  allowOnly(value, MAPPING_FIELDS, path, issues);
  identifier(value.mappingId, `${path}.mappingId`, issues);
  identifier(value.version, `${path}.version`, issues);
  enumValue(value.status, PersonalCandidateMappingStatus, `${path}.status`, issues);
  enumValue(value.exposure, PersonalCandidateExposure, `${path}.exposure`, issues);
  stringArray(value.evidenceReferences, `${path}.evidenceReferences`, issues);
}

function validateTimeframes(
  value: unknown,
  path: string,
  evaluatedAt: unknown,
  issues: PersonalCandidateValidationIssue[],
): void {
  if (!Array.isArray(value) || value.length !== REQUIRED_INTERVALS.length) {
    add(issues, PersonalCandidateValidationIssueCode.InvalidTimeframeSet, path, "Exactly P1D, PT1H, PT15M, and PT5M are required.");
    return;
  }
  const intervals = new Set<unknown>();
  value.forEach((timeframe, index) => {
    const itemPath = `${path}[${String(index)}]`;
    if (!recordAt(timeframe, itemPath, issues)) return;
    allowOnly(timeframe, TIMEFRAME_FIELDS, itemPath, issues);
    enumValue(timeframe.interval, BarInterval, `${itemPath}.interval`, issues);
    intervals.add(timeframe.interval);
    validateEndpoint(timeframe.start, `${itemPath}.start`, evaluatedAt, issues);
    validateEndpoint(timeframe.end, `${itemPath}.end`, evaluatedAt, issues);
    if (
      isRecord(timeframe.start) &&
      isRecord(timeframe.end) &&
      isCanonicalTimestamp(timeframe.start.intervalEnd) &&
      isCanonicalTimestamp(timeframe.end.intervalEnd) &&
      Date.parse(timeframe.start.intervalEnd) >= Date.parse(timeframe.end.intervalEnd)
    ) {
      add(issues, PersonalCandidateValidationIssueCode.InvalidTimestamp, `${itemPath}.end.intervalEnd`, "End observation must follow start observation.");
    }
    enumValue(timeframe.status, CanonicalBarStatus, `${itemPath}.status`, issues);
    enumValue(timeframe.freshness, BarFreshnessStatus, `${itemPath}.freshness`, issues);
    stringArray(timeframe.evidenceReferences, `${itemPath}.evidenceReferences`, issues);
  });
  if (REQUIRED_INTERVALS.some((interval) => !intervals.has(interval)) || intervals.size !== REQUIRED_INTERVALS.length) {
    add(issues, PersonalCandidateValidationIssueCode.InvalidTimeframeSet, path, "Required timeframe set is missing or duplicated.");
  }
}

function validateEndpoint(
  value: unknown,
  path: string,
  evaluatedAt: unknown,
  issues: PersonalCandidateValidationIssue[],
): void {
  if (!recordAt(value, path, issues)) return;
  allowOnly(value, ENDPOINT_FIELDS, path, issues);
  identifier(value.barId, `${path}.barId`, issues);
  if (typeof value.fingerprint !== "string" || !FINGERPRINT.test(value.fingerprint)) add(issues, PersonalCandidateValidationIssueCode.InvalidIdentifier, `${path}.fingerprint`, "Fingerprint must be canonical FNV-1a.");
  timestamp(value.intervalEnd, `${path}.intervalEnd`, issues);
  if (isCanonicalTimestamp(evaluatedAt) && isCanonicalTimestamp(value.intervalEnd) && Date.parse(value.intervalEnd) > Date.parse(evaluatedAt)) {
    add(issues, PersonalCandidateValidationIssueCode.InvalidTimestamp, `${path}.intervalEnd`, "Future bar observations fail closed.");
  }
  decimal(value.close, `${path}.close`, issues);
}

function validateQuote(
  value: unknown,
  path: string,
  evaluatedAt: unknown,
  issues: PersonalCandidateValidationIssue[],
): void {
  if (!recordAt(value, path, issues)) return;
  allowOnly(value, QUOTE_FIELDS, path, issues);
  identifier(value.snapshotId, `${path}.snapshotId`, issues);
  timestamp(value.observedAt, `${path}.observedAt`, issues);
  if (isCanonicalTimestamp(evaluatedAt) && isCanonicalTimestamp(value.observedAt) && Date.parse(value.observedAt) > Date.parse(evaluatedAt)) {
    add(issues, PersonalCandidateValidationIssueCode.InvalidTimestamp, `${path}.observedAt`, "Future market observations fail closed.");
  }
  enumValue(value.status, PersonalDecisionMarketDataStatus, `${path}.status`, issues);
  basisPoints(value.spreadBasisPoints, `${path}.spreadBasisPoints`, issues);
  enumValue(value.liquidity, PersonalDecisionLiquidityStatus, `${path}.liquidity`, issues);
}

function validatePolicy(policy: PersonalCandidateScanPolicy): void {
  const intervals = new Set(policy.timeframePolicies.map(({ interval }) => interval));
  const invalid =
    !IDENTIFIER.test(policy.policyId) ||
    !IDENTIFIER.test(policy.version) ||
    !Number.isSafeInteger(policy.maximumCandidates) ||
    policy.maximumCandidates <= 0 ||
    policy.maximumCandidates > 100 ||
    !Number.isSafeInteger(policy.maximumMarketDataAgeSeconds) ||
    policy.maximumMarketDataAgeSeconds <= 0 ||
    !Number.isSafeInteger(policy.maximumSpreadBasisPoints) ||
    policy.maximumSpreadBasisPoints < 0 ||
    policy.timeframePolicies.length !== REQUIRED_INTERVALS.length ||
    intervals.size !== REQUIRED_INTERVALS.length ||
    REQUIRED_INTERVALS.some((interval) => !intervals.has(interval)) ||
    policy.timeframePolicies.some(
      (item) =>
        !Number.isSafeInteger(item.flatThresholdBasisPoints) ||
        item.flatThresholdBasisPoints < 0 ||
        item.flatThresholdBasisPoints > 1_000 ||
        !Number.isSafeInteger(item.maximumObservationAgeSeconds) ||
        item.maximumObservationAgeSeconds <= 0,
    );
  if (invalid) {
    throw new PersonalCandidateValidationError([
      issue(PersonalCandidateValidationIssueCode.InvalidPolicy, "policy", "Policy contains an invalid deterministic boundary."),
    ]);
  }
}

function decimalChangeBasisPoints(from: PersonalDecisionDecimal, to: PersonalDecisionDecimal): number {
  const scale = Math.max(from.scale, to.scale);
  const fromAtomic = BigInt(from.atomicValue) * 10n ** BigInt(scale - from.scale);
  const toAtomic = BigInt(to.atomicValue) * 10n ** BigInt(scale - to.scale);
  const result = ((toAtomic - fromAtomic) * 10_000n) / fromAtomic;
  if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new PersonalCandidateValidationError([
      issue(PersonalCandidateValidationIssueCode.InvalidDecimal, "timeframes.close", "Return exceeds the safe deterministic integer domain."),
    ]);
  }
  return Number(result);
}

function decimal(value: unknown, field: string, issues: PersonalCandidateValidationIssue[]): void {
  if (!isRecord(value)) {
    add(issues, PersonalCandidateValidationIssueCode.InvalidDecimal, field, "Price must be a fixed-decimal object.");
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
    add(issues, PersonalCandidateValidationIssueCode.InvalidDecimal, field, "Price must be positive with at most 24 atomic digits and scale 0-8.");
  }
}

function compareCandidateResults(left: PersonalCandidateResult, right: PersonalCandidateResult): number {
  const order = {
    [PersonalCandidateStatus.ReadyForDecision]: 0,
    [PersonalCandidateStatus.WatchTrigger]: 1,
    [PersonalCandidateStatus.Excluded]: 2,
  };
  return order[left.status] - order[right.status] || left.candidateId.localeCompare(right.candidateId);
}

function intervalOrder(interval: BarInterval): number {
  return REQUIRED_INTERVALS.indexOf(interval as (typeof REQUIRED_INTERVALS)[number]);
}

function hasAny<T>(set: ReadonlySet<T>, values: readonly T[]): boolean {
  return values.some((value) => set.has(value));
}

function allowOnly(record: Record<string, unknown>, fields: readonly string[], path: string, issues: PersonalCandidateValidationIssue[]): void {
  const allowed = new Set(fields);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) add(issues, PersonalCandidateValidationIssueCode.UndeclaredField, `${path}.${key}`, "Undeclared fields fail closed.");
  }
}

function recordAt(value: unknown, field: string, issues: PersonalCandidateValidationIssue[]): value is Record<string, unknown> {
  if (isRecord(value)) return true;
  add(issues, PersonalCandidateValidationIssueCode.InvalidRequest, field, "Value must be an object.");
  return false;
}

function identifier(value: unknown, field: string, issues: PersonalCandidateValidationIssue[]): void {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) add(issues, PersonalCandidateValidationIssueCode.InvalidIdentifier, field, "Value must be a bounded identifier.");
}

function timestamp(value: unknown, field: string, issues: PersonalCandidateValidationIssue[]): void {
  if (!isCanonicalTimestamp(value)) add(issues, PersonalCandidateValidationIssueCode.InvalidTimestamp, field, "Value must be a canonical UTC timestamp.");
}

function isCanonicalTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString() === value;
}

function basisPoints(value: unknown, field: string, issues: PersonalCandidateValidationIssue[]): void {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 10_000) add(issues, PersonalCandidateValidationIssueCode.InvalidBasisPoints, field, "Value must be an integer from 0 to 10000.");
}

function stringArray(value: unknown, field: string, issues: PersonalCandidateValidationIssue[]): void {
  if (!Array.isArray(value) || value.length > 32 || value.some((item) => typeof item !== "string" || item.trim().length === 0 || item.length > 256)) {
    add(issues, PersonalCandidateValidationIssueCode.InvalidArray, field, "Value must be a bounded array of non-empty strings.");
  }
}

function enumValue(value: unknown, enumeration: Record<string, string>, field: string, issues: PersonalCandidateValidationIssue[]): void {
  if (typeof value !== "string" || !Object.values(enumeration).includes(value)) add(issues, PersonalCandidateValidationIssueCode.InvalidEnum, field, "Value is not an allowed enum member.");
}

function issue(code: PersonalCandidateValidationIssueCode, field: string, message: string): PersonalCandidateValidationIssue {
  return { code, field, message };
}

function add(issues: PersonalCandidateValidationIssue[], code: PersonalCandidateValidationIssueCode, field: string, message: string): void {
  issues.push(issue(code, field, message));
}

function compareIssues(left: PersonalCandidateValidationIssue, right: PersonalCandidateValidationIssue): number {
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
