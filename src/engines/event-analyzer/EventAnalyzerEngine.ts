import {
  EVENT_ANALYZER_SCHEMA_VERSION,
  EVENT_ANALYZER_INSTRUMENT_ID,
  EVENT_ANALYZER_MAX_ATOMIC_DIGITS,
  EVENT_ANALYZER_MAX_DECIMAL_SCALE,
  EventAnalyzerAuthorizationStatus,
  EventAnalyzerCandleEvidenceQuality,
  EventAnalyzerContradictionFlag,
  EventAnalyzerDerivedMomentum,
  EventAnalyzerEventType,
  EventAnalyzerProfitabilityStatus,
  EventAnalyzerReasonCode,
  EventAnalyzerRecommendation,
  EventAnalyzerValidationIssueCode,
  EventAnalyzerVolumeConfirmation,
  EventContractSide,
  EventMarketPriceComparison,
  RecentMomentumClassification,
  type EventAnalyzerAssessment,
  type EventAnalyzerCandleAnalysis,
  type EventAnalyzerFixedDecimal,
  type EventAnalyzerInput,
  type EventAnalyzerPolicy,
  type EventAnalyzerValidationIssue,
} from "../../contracts/EventAnalyzer";
import { analyzeEventCandles, legacyCandleAnalysis } from "./EventAnalyzerCandleFeatures";

const INTEGER = /^-?(?:0|[1-9]\d*)$/u;
const IDENTIFIER = /^[a-z0-9][a-z0-9:._-]{2,127}$/u;

export const DEFAULT_EVENT_ANALYZER_POLICY: EventAnalyzerPolicy = deepFreeze({
  policyId: "event-analyzer:btc-15-minute:2",
  version: "2.0",
  ruleSetVersion: "2.0",
  eventDurationSeconds: 900,
  minimumSecondsForBuy: 60,
  maximumDistanceBasisPoints: 500,
  maximumDistanceContributionBasisPoints: 4_000,
  momentumAdjustmentBasisPoints: 500,
  probabilityFloorBasisPoints: 1_000,
  probabilityCeilingBasisPoints: 9_000,
  minimumBuyEdgeBasisPoints: 500,
  maximumBuyMarketPriceBasisPoints: 8_500,
  minimumCandleCount: 5,
  maximumCandleCount: 30,
  shortWindowCandles: 3,
  mediumWindowCandles: 5,
  trendThresholdBasisPoints: 5,
  strongTrendThresholdBasisPoints: 10,
  strongBodyPressureBasisPoints: 6_000,
  closeLocationHighBasisPoints: 6_500,
  closeLocationLowBasisPoints: 3_500,
  rangeExpansionRatioBasisPoints: 12_000,
  accelerationRatioBasisPoints: 12_000,
  relativeVolumeRatioBasisPoints: 11_000,
  strongMomentumContributionBasisPoints: 1_200,
  weakMomentumContributionBasisPoints: 500,
  reversalContributionBasisPoints: 1_500,
  volumeContributionBasisPoints: 200,
  maximumCandleContributionBasisPoints: 1_600,
});

export class EventAnalyzerValidationError extends Error {
  public readonly issues: readonly EventAnalyzerValidationIssue[];
  public constructor(issues: readonly EventAnalyzerValidationIssue[]) {
    super("Event Analyzer input or policy failed deterministic validation.");
    this.name = "EventAnalyzerValidationError";
    this.issues = deepFreeze(structuredClone([...issues].sort(compareIssues)));
  }
}

export function validateEventAnalyzerInput(input: unknown): readonly EventAnalyzerValidationIssue[] {
  const issues: EventAnalyzerValidationIssue[] = [];
  if (!isRecord(input)) return deepFreeze([issue(EventAnalyzerValidationIssueCode.InvalidRecord, "input", "Input must be an object.")]);
  if (input.schemaVersion !== EVENT_ANALYZER_SCHEMA_VERSION) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidSchemaVersion, "schemaVersion", "Schema version is unsupported."));
  if (input.eventType !== EventAnalyzerEventType.BtcFifteenMinute) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidEventType, "eventType", "Only BTC_15_MINUTE is supported."));
  if (input.instrumentId !== EVENT_ANALYZER_INSTRUMENT_ID) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidObservationContext, "instrumentId", "Only the canonical BTC-USD instrument is supported."));
  if (typeof input.eventId !== "string" || !IDENTIFIER.test(input.eventId)) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidObservationContext, "eventId", "Event identity must be explicit and bounded."));
  if (!isTimestamp(input.observationTime)) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidCandleTimestamp, "observationTime", "Observation time must be canonical UTC."));
  if (typeof input.currentPriceSourceId !== "string" || !IDENTIFIER.test(input.currentPriceSourceId)) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidProvenance, "currentPriceSourceId", "Current-price source identity must be explicit and bounded."));
  if (typeof input.currentPriceSourceRecordId !== "string" || !IDENTIFIER.test(input.currentPriceSourceRecordId)) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidProvenance, "currentPriceSourceRecordId", "Current-price source-record identity must be explicit and bounded."));
  if (typeof input.currentPriceObservationId !== "string" || !IDENTIFIER.test(input.currentPriceObservationId)) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidProvenance, "currentPriceObservationId", "Current-price observation identity must be explicit and bounded."));
  if (!Object.values(EventContractSide).includes(input.contractSide as EventContractSide)) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidContractSide, "contractSide", "Contract side must be YES, NO, UP, or DOWN."));
  if (input.recentMomentum !== undefined && !Object.values(RecentMomentumClassification).includes(input.recentMomentum as RecentMomentumClassification)) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidMomentum, "recentMomentum", "Momentum must be UP, FLAT, or DOWN."));
  if (input.candleSeries === undefined && input.recentMomentum === undefined) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidMomentum, "recentMomentum", "Legacy analysis requires momentum when no candle series is supplied."));
  if (!isPositiveDecimal(input.targetPrice)) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidPrice, "targetPrice", "Target price must be a positive fixed decimal."));
  if (!isPositiveDecimal(input.currentPrice)) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidPrice, "currentPrice", "Current price must be a positive fixed decimal."));
  if (!Number.isSafeInteger(input.marketPriceBasisPoints) || (input.marketPriceBasisPoints as number) <= 0 || (input.marketPriceBasisPoints as number) >= 10_000) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidMarketPrice, "marketPriceBasisPoints", "Market contract price must be between 0 and 1, exclusive, in exact basis points."));
  if (!Number.isSafeInteger(input.remainingSeconds) || (input.remainingSeconds as number) <= 0) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidRemainingSeconds, "remainingSeconds", "Remaining seconds must be a positive integer."));
  return deepFreeze(issues.sort(compareIssues));
}

export function validateEventAnalyzerPolicy(policy: unknown): readonly EventAnalyzerValidationIssue[] {
  const issues: EventAnalyzerValidationIssue[] = [];
  if (!isRecord(policy)) return deepFreeze([issue(EventAnalyzerValidationIssueCode.InvalidPolicy, "policy", "Policy must be an object.")]);
  if (typeof policy.policyId !== "string" || !IDENTIFIER.test(policy.policyId) || typeof policy.version !== "string" || policy.version.trim() === "" || typeof policy.ruleSetVersion !== "string" || policy.ruleSetVersion.trim() === "") issues.push(issue(EventAnalyzerValidationIssueCode.InvalidPolicy, "policy.identity", "Policy identity and versions must be explicit."));
  const positiveIntegers = ["eventDurationSeconds", "minimumSecondsForBuy", "maximumDistanceBasisPoints", "maximumDistanceContributionBasisPoints", "momentumAdjustmentBasisPoints", "probabilityFloorBasisPoints", "probabilityCeilingBasisPoints", "minimumBuyEdgeBasisPoints", "maximumBuyMarketPriceBasisPoints", "minimumCandleCount", "maximumCandleCount", "shortWindowCandles", "mediumWindowCandles", "trendThresholdBasisPoints", "strongTrendThresholdBasisPoints", "strongBodyPressureBasisPoints", "closeLocationHighBasisPoints", "closeLocationLowBasisPoints", "rangeExpansionRatioBasisPoints", "accelerationRatioBasisPoints", "relativeVolumeRatioBasisPoints", "strongMomentumContributionBasisPoints", "weakMomentumContributionBasisPoints", "reversalContributionBasisPoints", "volumeContributionBasisPoints", "maximumCandleContributionBasisPoints"] as const;
  for (const field of positiveIntegers) if (!Number.isSafeInteger(policy[field]) || (policy[field] as number) <= 0) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidPolicy, `policy.${field}`, `${field} must be a positive safe integer.`));
  if (policy.eventDurationSeconds !== 900) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidPolicy, "policy.eventDurationSeconds", "BTC_15_MINUTE policy duration must equal 900 seconds."));
  if (Number.isSafeInteger(policy.minimumSecondsForBuy) && Number.isSafeInteger(policy.eventDurationSeconds) && (policy.minimumSecondsForBuy as number) > (policy.eventDurationSeconds as number)) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidPolicy, "policy.minimumSecondsForBuy", "Minimum buy time cannot exceed event duration."));
  if (Number.isSafeInteger(policy.probabilityFloorBasisPoints) && Number.isSafeInteger(policy.probabilityCeilingBasisPoints) && ((policy.probabilityFloorBasisPoints as number) >= (policy.probabilityCeilingBasisPoints as number) || (policy.probabilityCeilingBasisPoints as number) >= 10_000)) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidPolicy, "policy.probabilityBounds", "Probability bounds must be ordered strictly inside 0..10000."));
  if (Number.isSafeInteger(policy.minimumCandleCount) && Number.isSafeInteger(policy.maximumCandleCount) && ((policy.minimumCandleCount as number) < 5 || (policy.minimumCandleCount as number) > (policy.maximumCandleCount as number) || (policy.maximumCandleCount as number) > 30)) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidPolicy, "policy.candleCount", "Candle bounds must remain within 5..30 and be ordered."));
  if (Number.isSafeInteger(policy.shortWindowCandles) && Number.isSafeInteger(policy.mediumWindowCandles) && Number.isSafeInteger(policy.minimumCandleCount) && ((policy.shortWindowCandles as number) > (policy.mediumWindowCandles as number) || (policy.mediumWindowCandles as number) > (policy.minimumCandleCount as number))) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidPolicy, "policy.windows", "Short and medium windows must be ordered within the minimum candle count."));
  if (Number.isSafeInteger(policy.closeLocationLowBasisPoints) && Number.isSafeInteger(policy.closeLocationHighBasisPoints) && ((policy.closeLocationLowBasisPoints as number) >= (policy.closeLocationHighBasisPoints as number) || (policy.closeLocationHighBasisPoints as number) >= 10_000)) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidPolicy, "policy.closeLocation", "Close-location thresholds must be ordered inside 0..10000."));
  if (Number.isSafeInteger(policy.maximumCandleContributionBasisPoints) && Number.isSafeInteger(policy.reversalContributionBasisPoints) && (policy.reversalContributionBasisPoints as number) > (policy.maximumCandleContributionBasisPoints as number)) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidPolicy, "policy.maximumCandleContributionBasisPoints", "Candle contribution bound must cover the largest single classified contribution."));
  return deepFreeze(issues.sort(compareIssues));
}

export class EventAnalyzerEngine {
  readonly #policy: EventAnalyzerPolicy;
  public constructor(policy: Readonly<EventAnalyzerPolicy> = DEFAULT_EVENT_ANALYZER_POLICY) { const issues = validateEventAnalyzerPolicy(policy); if (issues.length > 0) throw new EventAnalyzerValidationError(issues); this.#policy = deepFreeze(structuredClone(policy)); }

  public analyze(input: Readonly<EventAnalyzerInput>): EventAnalyzerAssessment {
    const issues = validateEventAnalyzerInput(input);
    if (issues.length > 0) throw new EventAnalyzerValidationError(issues);
    if (input.remainingSeconds > this.#policy.eventDurationSeconds) throw new EventAnalyzerValidationError([issue(EventAnalyzerValidationIssueCode.InvalidRemainingSeconds, "remainingSeconds", "Remaining seconds cannot exceed the 15-minute event duration.")]);

    const distanceBasisPoints = decimalChangeBasisPoints(input.targetPrice, input.currentPrice);
    const candleBase = input.candleSeries === undefined ? legacyCandleAnalysis(this.#policy.ruleSetVersion) : analyzeEventCandles(input.candleSeries, input, this.#policy);
    const candleAnalysis = addContextualContradictions(candleBase, distanceBasisPoints);
    const boundedDistance = clamp(distanceBasisPoints, -this.#policy.maximumDistanceBasisPoints, this.#policy.maximumDistanceBasisPoints);
    const elapsedSeconds = this.#policy.eventDurationSeconds - input.remainingSeconds;
    const urgencyBasisPoints = 5_000 + Math.trunc((elapsedSeconds * 5_000) / this.#policy.eventDurationSeconds);
    const distanceContribution = safeBigIntToNumber((BigInt(boundedDistance) * BigInt(this.#policy.maximumDistanceContributionBasisPoints) * BigInt(urgencyBasisPoints)) / BigInt(this.#policy.maximumDistanceBasisPoints) / 10_000n, "distance contribution");
    const momentumContribution = candleAnalysis.evidenceQuality === EventAnalyzerCandleEvidenceQuality.Sufficient
      ? candleContribution(candleAnalysis, this.#policy)
      : candleAnalysis.evidenceQuality === EventAnalyzerCandleEvidenceQuality.LegacyCoarse
        ? coarseContribution(input.recentMomentum, this.#policy)
        : 0;
    const upProbability = clamp(5_000 + distanceContribution + momentumContribution, this.#policy.probabilityFloorBasisPoints, this.#policy.probabilityCeilingBasisPoints);
    const selectedProbability = isPositiveSide(input.contractSide) ? upProbability : 10_000 - upProbability;
    const edgeBasisPoints = selectedProbability - input.marketPriceBasisPoints;
    const comparison = edgeBasisPoints > 0 ? EventMarketPriceComparison.Underpriced : edgeBasisPoints < 0 ? EventMarketPriceComparison.Overpriced : EventMarketPriceComparison.Fair;
    const severeContradiction = hasSevereContradiction(input.contractSide, candleAnalysis);
    const reasonCodes = createReasonCodes(distanceBasisPoints, input.recentMomentum, edgeBasisPoints, input.remainingSeconds, input.marketPriceBasisPoints, candleAnalysis, severeContradiction, this.#policy);
    const recommendation = selectRecommendation(edgeBasisPoints, input.remainingSeconds, input.marketPriceBasisPoints, candleAnalysis, severeContradiction, this.#policy);
    const canonicalInput = canonicalize({ input: canonicalInputValue(input), policy: this.#policy });
    const inputFingerprint = `fnv1a64:${fnv1a64(canonicalInput)}`;

    return deepFreeze({
      analysisId: `event-analysis:${fnv1a64(`${inputFingerprint}|${this.#policy.version}|${this.#policy.ruleSetVersion}`)}`,
      schemaVersion: EVENT_ANALYZER_SCHEMA_VERSION,
      inputFingerprint,
      eventType: input.eventType,
      contractSide: input.contractSide,
      remainingSeconds: input.remainingSeconds,
      recentMomentum: input.recentMomentum ?? "NOT_SUPPLIED",
      distanceFromTargetBasisPoints: distanceBasisPoints,
      upProbabilityBasisPoints: upProbability,
      probabilityEstimate: { contractSide: input.contractSide, basisPoints: selectedProbability, percent: formatPercent(selectedProbability), calibrated: false, method: "DETERMINISTIC_HEURISTIC_V2" },
      valueComparison: { fairValueBasisPoints: selectedProbability, fairValueContractPrice: formatContractPrice(selectedProbability), marketPriceBasisPoints: input.marketPriceBasisPoints, marketContractPrice: formatContractPrice(input.marketPriceBasisPoints), comparison },
      edge: { basisPoints: edgeBasisPoints, percentagePoints: formatSignedPercent(edgeBasisPoints) },
      candleAnalysis,
      recommendation,
      reasonCodes,
      riskExplanation: [
        "A purchased event contract can lose 100% of the premium paid.",
        "The probability estimate is an uncalibrated deterministic heuristic; prediction accuracy does not establish trading profitability.",
        "Candle features describe recent structure only and cannot prove the final event outcome.",
        "Relative volume confirmation makes no claim about absolute provider volume units; unavailable volume creates no confirmation.",
        "The edge excludes fees, spread, slippage, liquidity, execution quality, position sizing, and portfolio constraints.",
        "BUY is only a prototype analytical candidate and still requires a sufficient Evidence Fusion snapshot, Decision evaluation, Risk evaluation, owner approval, and separate execution controls.",
      ],
      profitabilityStatus: EventAnalyzerProfitabilityStatus.NotEvaluated,
      authorizationStatus: EventAnalyzerAuthorizationStatus.PrototypeOnly,
      policyId: this.#policy.policyId,
      policyVersion: this.#policy.version,
      ruleSetVersion: this.#policy.ruleSetVersion,
      deterministic: true,
      readOnly: true,
    });
  }
}

function candleContribution(analysis: EventAnalyzerCandleAnalysis, policy: EventAnalyzerPolicy): number {
  const momentum = analysis.derivedMomentum === EventAnalyzerDerivedMomentum.StrongUp ? policy.strongMomentumContributionBasisPoints
    : analysis.derivedMomentum === EventAnalyzerDerivedMomentum.WeakUp ? policy.weakMomentumContributionBasisPoints
      : analysis.derivedMomentum === EventAnalyzerDerivedMomentum.StrongDown ? -policy.strongMomentumContributionBasisPoints
        : analysis.derivedMomentum === EventAnalyzerDerivedMomentum.WeakDown ? -policy.weakMomentumContributionBasisPoints
          : analysis.derivedMomentum === EventAnalyzerDerivedMomentum.ReversalRiskUpToDown ? -policy.reversalContributionBasisPoints
            : analysis.derivedMomentum === EventAnalyzerDerivedMomentum.ReversalRiskDownToUp ? policy.reversalContributionBasisPoints : 0;
  const volume = analysis.volumeConfirmation === EventAnalyzerVolumeConfirmation.Bullish ? policy.volumeContributionBasisPoints : analysis.volumeConfirmation === EventAnalyzerVolumeConfirmation.Bearish ? -policy.volumeContributionBasisPoints : 0;
  return clamp(momentum + volume, -policy.maximumCandleContributionBasisPoints, policy.maximumCandleContributionBasisPoints);
}

function coarseContribution(momentum: RecentMomentumClassification | undefined, policy: EventAnalyzerPolicy): number { return momentum === RecentMomentumClassification.Up ? policy.momentumAdjustmentBasisPoints : momentum === RecentMomentumClassification.Down ? -policy.momentumAdjustmentBasisPoints : 0; }

function addContextualContradictions(analysis: EventAnalyzerCandleAnalysis, distance: number): EventAnalyzerCandleAnalysis {
  if (analysis.evidenceQuality !== EventAnalyzerCandleEvidenceQuality.Sufficient || analysis.averageAbsoluteReturnBasisPoints === null) return analysis;
  const unstable = Math.abs(distance) < analysis.averageAbsoluteReturnBasisPoints && (analysis.derivedMomentum === EventAnalyzerDerivedMomentum.Neutral || analysis.contradictionFlags.length > 0);
  if (!unstable) return analysis;
  return deepFreeze({ ...structuredClone(analysis), contradictionFlags: [...new Set([...analysis.contradictionFlags, EventAnalyzerContradictionFlag.TargetDistanceSmallRelativeToVolatility])].sort() });
}

function hasSevereContradiction(side: EventContractSide, analysis: EventAnalyzerCandleAnalysis): boolean {
  const flags = new Set(analysis.contradictionFlags);
  if (flags.has(EventAnalyzerContradictionFlag.TargetDistanceSmallRelativeToVolatility)) return true;
  return isPositiveSide(side)
    ? flags.has(EventAnalyzerContradictionFlag.StrongBearishStructure) || flags.has(EventAnalyzerContradictionFlag.UpToDownReversal)
    : flags.has(EventAnalyzerContradictionFlag.StrongBullishStructure) || flags.has(EventAnalyzerContradictionFlag.DownToUpReversal);
}

function selectRecommendation(edge: number, remaining: number, marketPrice: number, candles: EventAnalyzerCandleAnalysis, severeContradiction: boolean, policy: EventAnalyzerPolicy): EventAnalyzerRecommendation {
  if (candles.evidenceQuality !== EventAnalyzerCandleEvidenceQuality.Sufficient || severeContradiction || remaining < policy.minimumSecondsForBuy || marketPrice > policy.maximumBuyMarketPriceBasisPoints || edge <= 0) return EventAnalyzerRecommendation.NoTrade;
  if (edge < policy.minimumBuyEdgeBasisPoints) return EventAnalyzerRecommendation.Hold;
  return EventAnalyzerRecommendation.Buy;
}

function createReasonCodes(distance: number, momentum: RecentMomentumClassification | undefined, edge: number, remaining: number, marketPrice: number, candles: EventAnalyzerCandleAnalysis, severeContradiction: boolean, policy: EventAnalyzerPolicy): readonly EventAnalyzerReasonCode[] {
  const values: EventAnalyzerReasonCode[] = [
    distance > 0 ? EventAnalyzerReasonCode.PositiveDistance : distance < 0 ? EventAnalyzerReasonCode.NegativeDistance : EventAnalyzerReasonCode.AtTarget,
    momentum === RecentMomentumClassification.Up ? EventAnalyzerReasonCode.MomentumUp : momentum === RecentMomentumClassification.Down ? EventAnalyzerReasonCode.MomentumDown : EventAnalyzerReasonCode.MomentumFlat,
    edge >= policy.minimumBuyEdgeBasisPoints ? EventAnalyzerReasonCode.PositiveEdgeMeetsThreshold : edge > 0 ? EventAnalyzerReasonCode.PositiveEdgeBelowThreshold : EventAnalyzerReasonCode.NoPositiveEdge,
  ];
  if (candles.evidenceQuality === EventAnalyzerCandleEvidenceQuality.Sufficient) values.push(EventAnalyzerReasonCode.CandleEvidenceSufficient, EventAnalyzerReasonCode.CandleMomentumOverridesCoarse);
  if (candles.evidenceQuality === EventAnalyzerCandleEvidenceQuality.LegacyCoarse) values.push(EventAnalyzerReasonCode.LegacyCoarseEvidence);
  if (candles.evidenceQuality === EventAnalyzerCandleEvidenceQuality.Insufficient) values.push(EventAnalyzerReasonCode.CandleEvidenceInsufficient);
  if (candles.evidenceQuality === EventAnalyzerCandleEvidenceQuality.Invalid) values.push(EventAnalyzerReasonCode.CandleEvidenceInvalid);
  if (severeContradiction) values.push(EventAnalyzerReasonCode.SevereCandleContradiction);
  if (candles.contradictionFlags.includes(EventAnalyzerContradictionFlag.TargetDistanceSmallRelativeToVolatility)) values.push(EventAnalyzerReasonCode.UnstableDirection);
  if (remaining < policy.minimumSecondsForBuy) values.push(EventAnalyzerReasonCode.TooLittleTimeRemaining);
  if (marketPrice > policy.maximumBuyMarketPriceBasisPoints) values.push(EventAnalyzerReasonCode.MarketPriceAbovePolicy);
  return deepFreeze([...new Set(values)].sort());
}

function decimalChangeBasisPoints(from: EventAnalyzerFixedDecimal, to: EventAnalyzerFixedDecimal): number { const scale = Math.max(from.scale, to.scale); const result = ((scaledAtomic(to, scale) - scaledAtomic(from, scale)) * 10_000n) / scaledAtomic(from, scale); if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) throw new EventAnalyzerValidationError([issue(EventAnalyzerValidationIssueCode.InvalidPrice, "prices", "Fixed-decimal change exceeds the deterministic numeric boundary.")]); return Number(result); }
function scaledAtomic(value: EventAnalyzerFixedDecimal, scale: number): bigint { return BigInt(value.atomicValue) * (10n ** BigInt(scale - value.scale)); }
function isPositiveSide(side: EventContractSide): boolean { return side === EventContractSide.Yes || side === EventContractSide.Up; }
function clamp(value: number, low: number, high: number): number { return Math.max(low, Math.min(high, value)); }
function formatPercent(value: number): string { return `${formatBasisPoints(value)}%`; }
function formatSignedPercent(value: number): string { return `${value >= 0 ? "+" : "-"}${formatBasisPoints(Math.abs(value))}pp`; }
function formatBasisPoints(value: number): string { return `${String(Math.trunc(value / 100))}.${String(value % 100).padStart(2, "0")}`; }
function formatContractPrice(value: number): string { return `${String(Math.trunc(value / 10_000))}.${String(value % 10_000).padStart(4, "0")}`; }
function isPositiveDecimal(value: unknown): value is EventAnalyzerFixedDecimal { return isRecord(value) && typeof value.atomicValue === "string" && INTEGER.test(value.atomicValue) && value.atomicValue.replace("-", "").length <= EVENT_ANALYZER_MAX_ATOMIC_DIGITS && BigInt(value.atomicValue) > 0n && Number.isSafeInteger(value.scale) && (value.scale as number) >= 0 && (value.scale as number) <= EVENT_ANALYZER_MAX_DECIMAL_SCALE; }
function canonicalInputValue(input: EventAnalyzerInput): unknown { return { schemaVersion: input.schemaVersion, eventType: input.eventType, eventId: input.eventId, instrumentId: input.instrumentId, observationTime: input.observationTime, currentPriceSourceId: input.currentPriceSourceId, currentPriceSourceRecordId: input.currentPriceSourceRecordId, currentPriceObservationId: input.currentPriceObservationId, contractSide: input.contractSide, targetPrice: structuredClone(input.targetPrice), currentPrice: structuredClone(input.currentPrice), marketPriceBasisPoints: input.marketPriceBasisPoints, remainingSeconds: input.remainingSeconds, recentMomentum: input.recentMomentum ?? null, candleSeries: input.candleSeries === undefined ? null : structuredClone(input.candleSeries) }; }
function issue(code: EventAnalyzerValidationIssueCode, field: string, message: string): EventAnalyzerValidationIssue { return { code, field, message }; }
function compareIssues(a: EventAnalyzerValidationIssue, b: EventAnalyzerValidationIssue): number { return a.code.localeCompare(b.code) || a.field.localeCompare(b.field) || a.message.localeCompare(b.message); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function canonicalize(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`; if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`; return JSON.stringify(value); }
function fnv1a64(value: string): string { let hash = 0xcbf29ce484222325n; for (let index = 0; index < value.length; index += 1) { hash ^= BigInt(value.charCodeAt(index)); hash = BigInt.asUintN(64, hash * 0x100000001b3n); } return hash.toString(16).padStart(16, "0"); }
function deepFreeze<T>(value: T): T { if (typeof value === "object" && value !== null && !Object.isFrozen(value)) { Object.freeze(value); for (const nested of Object.values(value)) deepFreeze(nested); } return value; }
function isTimestamp(value: unknown): value is string { if (typeof value !== "string") return false; const parsed = Date.parse(value); return Number.isFinite(parsed) && new Date(parsed).toISOString() === value; }
function safeBigIntToNumber(value: bigint, label: string): number { if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) throw new EventAnalyzerValidationError([issue(EventAnalyzerValidationIssueCode.UnsafeNumericValue, label, "Calculation exceeds the bounded deterministic integer domain.")]); return Number(value); }
