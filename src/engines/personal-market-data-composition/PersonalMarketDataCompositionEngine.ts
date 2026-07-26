import {
  BarFreshnessStatus,
  BarInterval,
  CanonicalBarStatus,
  type BarDecimal,
  type CanonicalBar,
} from "../../contracts/CanonicalBar";
import {
  CanonicalQuoteStatus,
  type CanonicalQuote,
  type QuoteDecimal,
} from "../../contracts/CanonicalQuote";
import {
  PERSONAL_CANDIDATE_SCAN_SCHEMA_VERSION,
  PersonalCandidateSession,
  type PersonalCandidateInput,
  type PersonalCandidateScanRequest,
  type PersonalCandidateTimeframeInput,
} from "../../contracts/PersonalCandidateScan";
import {
  PERSONAL_MARKET_DATA_COMPOSITION_SCHEMA_VERSION,
  PersonalMarketDataCompositionIssueCode,
  type PersonalMarketDataCandidateObservation,
  type PersonalMarketDataCompositionIssue,
  type PersonalMarketDataCompositionRequest,
  type PersonalMarketDataCompositionResult,
  type PersonalMarketDataTimeframeBinding,
} from "../../contracts/PersonalMarketDataComposition";
import {
  PersonalDecisionLiquidityStatus,
  PersonalDecisionMarketDataStatus,
} from "../../contracts/PersonalDecision";
import type { PersonalWatchlistMapping } from "../../contracts/PersonalWatchlistMapping";
import { validateCanonicalBar } from "../canonical-bar/CanonicalBar";
import { validateCanonicalQuote } from "../canonical-quote/CanonicalQuote";
import {
  activatePersonalWatchlistMapping,
  createPersonalWatchlistMappingRegistry,
} from "../personal-watchlist-mapping/PersonalWatchlistMappingRegistry";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:._/-]{2,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const REQUIRED_INTERVALS = [
  BarInterval.OneDay,
  BarInterval.OneHour,
  BarInterval.FifteenMinutes,
  BarInterval.FiveMinutes,
] as const;

export class PersonalMarketDataCompositionError extends Error {
  public constructor(public readonly issues: readonly PersonalMarketDataCompositionIssue[]) {
    super("Personal market-data composition failed.");
    this.name = "PersonalMarketDataCompositionError";
  }
}

export function composePersonalMarketData(
  rawRequest: unknown,
): PersonalMarketDataCompositionResult {
  const issues = validateRequest(rawRequest);
  if (issues.length > 0) throw new PersonalMarketDataCompositionError(issues);
  const request = rawRequest as PersonalMarketDataCompositionRequest;

  const candidates = request.candidates.map((candidate) => composeCandidate(candidate));
  const scanRequest: PersonalCandidateScanRequest = deepFreeze({
    schemaVersion: PERSONAL_CANDIDATE_SCAN_SCHEMA_VERSION,
    scanId: request.scanId,
    profileId: request.profileId,
    profileVersion: request.profileVersion,
    evaluatedAt: request.evaluatedAt,
    session: request.session,
    candidates,
  });
  const evidenceReferences = uniqueSorted(request.candidates.flatMap(candidateEvidence));
  const inputFingerprint = `fnv1a64:${fnv1a64(canonicalize({
    scanId: request.scanId,
    registryId: request.mappingRegistry.registryId,
    registryVersion: request.mappingRegistry.version,
    candidates: request.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      mappingId: candidate.mapping.mappingId,
      bars: candidate.timeframes.flatMap((timeframe) => [
        timeframe.start.fingerprint,
        timeframe.end.fingerprint,
      ]),
      quote: candidate.quote.fingerprint,
      liquidity: candidate.liquidity,
    })),
  }))}`;
  return deepFreeze({
    schemaVersion: PERSONAL_MARKET_DATA_COMPOSITION_SCHEMA_VERSION,
    compositionId: `personal-market-composition:${fnv1a64(`${inputFingerprint}|${request.evaluatedAt}`)}`,
    inputFingerprint,
    mappingRegistryId: request.mappingRegistry.registryId,
    mappingRegistryVersion: request.mappingRegistry.version,
    scanRequest,
    evidenceReferences,
    advisoryOnly: true,
    automatedExecutionAllowed: false,
    deterministic: true,
    readOnly: true,
  });
}

function validateRequest(value: unknown): PersonalMarketDataCompositionIssue[] {
  const issues: PersonalMarketDataCompositionIssue[] = [];
  if (!isRecord(value)) {
    return [issue(PersonalMarketDataCompositionIssueCode.InvalidRequest, "$", "Request must be an object.")];
  }
  rejectUnknown(value, [
    "schemaVersion", "scanId", "profileId", "profileVersion", "evaluatedAt",
    "session", "mappingRegistry", "candidates",
  ], "$", issues);
  if (value.schemaVersion !== PERSONAL_MARKET_DATA_COMPOSITION_SCHEMA_VERSION
    || typeof value.scanId !== "string" || !IDENTIFIER.test(value.scanId)
    || typeof value.profileId !== "string" || !IDENTIFIER.test(value.profileId)
    || typeof value.profileVersion !== "string" || !VERSION.test(value.profileVersion)
    || !isTimestamp(value.evaluatedAt)
    || !Object.values(PersonalCandidateSession).includes(value.session as PersonalCandidateSession)
    || !Array.isArray(value.candidates) || value.candidates.length === 0 || value.candidates.length > 32) {
    issues.push(issue(PersonalMarketDataCompositionIssueCode.InvalidRequest, "$", "Request identity, time, session, or candidate count is invalid."));
    return sortIssues(issues);
  }
  try {
    if (!isRecord(value.mappingRegistry)) throw new Error("invalid");
    createPersonalWatchlistMappingRegistry({
      registryId: String(value.mappingRegistry.registryId),
      version: String(value.mappingRegistry.version),
      createdAt: String(value.mappingRegistry.createdAt),
      mappings: Array.isArray(value.mappingRegistry.mappings) ? value.mappingRegistry.mappings : [],
    });
  } catch {
    issues.push(issue(PersonalMarketDataCompositionIssueCode.InvalidMappingRegistry, "mappingRegistry", "Mapping registry is invalid."));
    return sortIssues(issues);
  }
  const registry = value.mappingRegistry as unknown as PersonalMarketDataCompositionRequest["mappingRegistry"];
  const candidateIds = new Set<string>();
  for (const [index, candidate] of value.candidates.entries()) {
    validateCandidate(candidate, registry.mappings, String(value.evaluatedAt), `candidates[${index}]`, issues);
    if (isRecord(candidate) && typeof candidate.candidateId === "string") {
      if (candidateIds.has(candidate.candidateId)) {
        issues.push(issue(PersonalMarketDataCompositionIssueCode.InvalidRequest, `candidates[${index}].candidateId`, "Candidate ID is duplicated."));
      }
      candidateIds.add(candidate.candidateId);
    }
  }
  return sortIssues(issues);
}

function validateCandidate(
  value: unknown,
  registryMappings: readonly PersonalWatchlistMapping[],
  evaluatedAt: string,
  field: string,
  issues: PersonalMarketDataCompositionIssue[],
): void {
  if (!isRecord(value)) {
    issues.push(issue(PersonalMarketDataCompositionIssueCode.InvalidRequest, field, "Candidate must be an object."));
    return;
  }
  rejectUnknown(value, ["candidateId", "mapping", "timeframes", "quote", "liquidity"], field, issues);
  if (typeof value.candidateId !== "string" || !IDENTIFIER.test(value.candidateId) || !isRecord(value.mapping)) {
    issues.push(issue(PersonalMarketDataCompositionIssueCode.InvalidRequest, field, "Candidate identity or mapping is invalid."));
    return;
  }
  const mapping = value.mapping as unknown as PersonalWatchlistMapping;
  const registered = registryMappings.find((entry) => entry.mappingId === mapping.mappingId);
  if (registered === undefined || canonicalize(registered) !== canonicalize(mapping)) {
    issues.push(issue(PersonalMarketDataCompositionIssueCode.MappingNotRegistered, `${field}.mapping`, "Candidate mapping must exactly match the registry."));
  }
  if (!activatePersonalWatchlistMapping(mapping).active) {
    issues.push(issue(PersonalMarketDataCompositionIssueCode.MappingNotApproved, `${field}.mapping`, "Candidate mapping is not authority-verified and Owner-approved."));
  }
  if (!Array.isArray(value.timeframes)) {
    issues.push(issue(PersonalMarketDataCompositionIssueCode.InvalidTimeframeSet, `${field}.timeframes`, "Timeframes must be an array."));
  } else {
    const intervals = value.timeframes.map((entry) => isRecord(entry) ? entry.interval : undefined);
    if (value.timeframes.length !== REQUIRED_INTERVALS.length
      || new Set(intervals).size !== REQUIRED_INTERVALS.length
      || !REQUIRED_INTERVALS.every((interval) => intervals.includes(interval))) {
      issues.push(issue(PersonalMarketDataCompositionIssueCode.InvalidTimeframeSet, `${field}.timeframes`, "Exact P1D, PT1H, PT15M, and PT5M bindings are required."));
    }
    value.timeframes.forEach((entry, index) => validateTimeframe(entry, mapping, evaluatedAt, `${field}.timeframes[${index}]`, issues));
  }
  validateQuote(value.quote, mapping, evaluatedAt, `${field}.quote`, issues);
  validateLiquidity(value.liquidity, value.quote, evaluatedAt, `${field}.liquidity`, issues);
}

function validateTimeframe(
  value: unknown,
  mapping: PersonalWatchlistMapping,
  evaluatedAt: string,
  field: string,
  issues: PersonalMarketDataCompositionIssue[],
): void {
  if (!isRecord(value)) {
    issues.push(issue(PersonalMarketDataCompositionIssueCode.InvalidTimeframeSet, field, "Timeframe binding must be an object."));
    return;
  }
  rejectUnknown(value, ["interval", "start", "end"], field, issues);
  const start = value.start as CanonicalBar;
  const end = value.end as CanonicalBar;
  if (!validateCanonicalBar(start).valid || !validateCanonicalBar(end).valid) {
    issues.push(issue(PersonalMarketDataCompositionIssueCode.InvalidCanonicalBar, field, "Both canonical bars must validate."));
    return;
  }
  if (value.interval !== start.interval || value.interval !== end.interval) {
    issues.push(issue(PersonalMarketDataCompositionIssueCode.BarIntervalMismatch, field, "Declared and canonical intervals must match."));
  }
  if (start.instrument.instrumentId !== mapping.analysisInstrument.instrumentId
    || end.instrument.instrumentId !== mapping.analysisInstrument.instrumentId) {
    issues.push(issue(PersonalMarketDataCompositionIssueCode.BarInstrumentMismatch, field, "Bars must belong to the mapped analysis instrument."));
  }
  if (Date.parse(start.intervalEnd) >= Date.parse(end.intervalEnd)) {
    issues.push(issue(PersonalMarketDataCompositionIssueCode.BarChronologyInvalid, field, "Start endpoint must precede end endpoint."));
  }
  if (start.status !== CanonicalBarStatus.Final || end.status !== CanonicalBarStatus.Final
    || Date.parse(end.intervalEnd) > Date.parse(evaluatedAt)) {
    issues.push(issue(PersonalMarketDataCompositionIssueCode.BarChronologyInvalid, field, "Both endpoints must be completed before evaluation."));
  }
}

function validateQuote(
  value: unknown,
  mapping: PersonalWatchlistMapping,
  evaluatedAt: string,
  field: string,
  issues: PersonalMarketDataCompositionIssue[],
): void {
  if (!validateCanonicalQuote(value).valid) {
    issues.push(issue(PersonalMarketDataCompositionIssueCode.InvalidCanonicalQuote, field, "Canonical quote must validate."));
    return;
  }
  const quote = value as CanonicalQuote;
  if (quote.instrument.instrumentId !== mapping.tradeVehicle.instrumentId) {
    issues.push(issue(PersonalMarketDataCompositionIssueCode.QuoteInstrumentMismatch, field, "Quote must belong to the mapped ETF vehicle."));
  }
  if (Date.parse(quote.observationTime) > Date.parse(evaluatedAt)) {
    issues.push(issue(PersonalMarketDataCompositionIssueCode.InvalidCanonicalQuote, field, "Quote observation cannot follow scan evaluation."));
  }
}

function validateLiquidity(
  value: unknown,
  quoteValue: unknown,
  evaluatedAt: string,
  field: string,
  issues: PersonalMarketDataCompositionIssue[],
): void {
  if (!isRecord(value)) {
    issues.push(issue(PersonalMarketDataCompositionIssueCode.InvalidLiquidityAssessment, field, "Liquidity assessment must be an object."));
    return;
  }
  rejectUnknown(value, [
    "assessmentId", "quoteId", "quoteFingerprint", "status", "evaluatedAt",
    "policyId", "policyVersion", "evidenceReferences",
  ], field, issues);
  if (typeof value.assessmentId !== "string" || !IDENTIFIER.test(value.assessmentId)
    || !Object.values(PersonalDecisionLiquidityStatus).includes(value.status as PersonalDecisionLiquidityStatus)
    || !isTimestamp(value.evaluatedAt)
    || typeof value.policyId !== "string" || !IDENTIFIER.test(value.policyId)
    || typeof value.policyVersion !== "string" || !VERSION.test(value.policyVersion)
    || !Array.isArray(value.evidenceReferences)
    || value.evidenceReferences.length === 0
    || !value.evidenceReferences.every((entry) => typeof entry === "string" && IDENTIFIER.test(entry))) {
    issues.push(issue(PersonalMarketDataCompositionIssueCode.InvalidLiquidityAssessment, field, "Liquidity assessment identity, status, policy, or evidence is invalid."));
  }
  if (isRecord(quoteValue)
    && (value.quoteId !== quoteValue.quoteId || value.quoteFingerprint !== quoteValue.fingerprint)) {
    issues.push(issue(PersonalMarketDataCompositionIssueCode.LiquidityBindingMismatch, field, "Liquidity assessment must bind the exact quote ID and fingerprint."));
  }
  if (isRecord(quoteValue) && isTimestamp(quoteValue.observationTime) && isTimestamp(value.evaluatedAt)
    && (Date.parse(value.evaluatedAt) < Date.parse(quoteValue.observationTime)
      || Date.parse(value.evaluatedAt) > Date.parse(evaluatedAt))) {
    issues.push(issue(PersonalMarketDataCompositionIssueCode.InvalidLiquidityAssessment, field, "Liquidity evaluation must be between quote observation and scan evaluation."));
  }
}

function composeCandidate(candidate: PersonalMarketDataCandidateObservation): PersonalCandidateInput {
  const activation = activatePersonalWatchlistMapping(candidate.mapping);
  if (!activation.active || activation.mapping === undefined) {
    throw new PersonalMarketDataCompositionError([
      issue(PersonalMarketDataCompositionIssueCode.MappingNotApproved, "mapping", "Mapping activation failed."),
    ]);
  }
  const timeframes = candidate.timeframes
    .map(composeTimeframe)
    .sort((left, right) => REQUIRED_INTERVALS.indexOf(left.interval as typeof REQUIRED_INTERVALS[number])
      - REQUIRED_INTERVALS.indexOf(right.interval as typeof REQUIRED_INTERVALS[number]));
  return deepFreeze({
    candidateId: candidate.candidateId,
    themeId: candidate.mapping.themeId,
    analysisInstrument: {
      instrumentId: candidate.mapping.analysisInstrument.instrumentId,
      symbol: candidate.mapping.analysisInstrument.displaySymbol,
      assetClass: "EQUITY",
      currency: candidate.mapping.analysisInstrument.currency,
    },
    tradeVehicle: {
      instrumentId: candidate.mapping.tradeVehicle.instrumentId,
      symbol: candidate.mapping.tradeVehicle.displaySymbol,
      assetClass: "ETF",
      currency: candidate.mapping.tradeVehicle.currency,
    },
    mapping: activation.mapping,
    timeframes,
    quote: {
      snapshotId: candidate.quote.quoteId,
      observedAt: candidate.quote.observationTime,
      status: candidate.quote.status === CanonicalQuoteStatus.Current
        ? PersonalDecisionMarketDataStatus.Current
        : PersonalDecisionMarketDataStatus.Stale,
      spreadBasisPoints: conservativeSpreadBasisPoints(candidate.quote.value.bidPrice, candidate.quote.value.askPrice),
      liquidity: candidate.liquidity.status,
    },
  });
}

function composeTimeframe(binding: PersonalMarketDataTimeframeBinding): PersonalCandidateTimeframeInput {
  return {
    interval: binding.interval,
    start: endpoint(binding.start),
    end: endpoint(binding.end),
    status: binding.end.status,
    freshness: binding.end.quality.freshness,
    evidenceReferences: uniqueSorted([
      binding.start.barId,
      binding.start.fingerprint,
      binding.start.source.sourceReference,
      binding.start.source.contentIntegrityReference,
      binding.end.barId,
      binding.end.fingerprint,
      binding.end.source.sourceReference,
      binding.end.source.contentIntegrityReference,
    ]),
  };
}

function endpoint(bar: CanonicalBar) {
  return {
    barId: bar.barId,
    fingerprint: bar.fingerprint,
    intervalEnd: bar.intervalEnd,
    close: decimal(bar.value.close),
  };
}

function decimal(value: BarDecimal) {
  return { atomicValue: value.atomicValue, scale: value.scale };
}

function conservativeSpreadBasisPoints(bid: QuoteDecimal, ask: QuoteDecimal): number {
  const scale = Math.max(bid.scale, ask.scale);
  const bidAtomic = BigInt(bid.atomicValue) * 10n ** BigInt(scale - bid.scale);
  const askAtomic = BigInt(ask.atomicValue) * 10n ** BigInt(scale - ask.scale);
  const numerator = (askAtomic - bidAtomic) * 20_000n;
  const denominator = askAtomic + bidAtomic;
  return Number((numerator + denominator - 1n) / denominator);
}

function candidateEvidence(candidate: PersonalMarketDataCandidateObservation): string[] {
  return [
    ...candidate.mapping.authorityEvidence.map((entry) => entry.evidenceId),
    ...candidate.timeframes.flatMap((binding) => [
      binding.start.barId,
      binding.start.fingerprint,
      binding.end.barId,
      binding.end.fingerprint,
    ]),
    candidate.quote.quoteId,
    candidate.quote.fingerprint,
    ...candidate.liquidity.evidenceReferences,
  ];
}

function rejectUnknown(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string,
  issues: PersonalMarketDataCompositionIssue[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      issues.push(issue(PersonalMarketDataCompositionIssueCode.UndeclaredField, `${field}.${key}`, "Undeclared field is not allowed."));
    }
  }
}

function issue(
  code: PersonalMarketDataCompositionIssueCode,
  field: string,
  message: string,
): PersonalMarketDataCompositionIssue {
  return { code, field, message };
}

function sortIssues(values: readonly PersonalMarketDataCompositionIssue[]): PersonalMarketDataCompositionIssue[] {
  return values.map((value) => ({ ...value }))
    .sort((left, right) => `${left.code}|${left.field}|${left.message}`.localeCompare(`${right.code}|${right.field}|${right.message}`));
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`).join(",")}}`;
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
