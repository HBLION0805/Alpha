import { InstrumentAssetClass } from "../../contracts/CanonicalInstrument";
import { PersonalCandidateExposure } from "../../contracts/PersonalCandidateScan";
import { PersonalCandidateStatus } from "../../contracts/PersonalCandidateScan";
import {
  PersonalDailyScanDisplayStatus,
  PersonalDailyScanEligibilityStatus,
  PersonalDailyScanInstrumentClassification,
} from "../../contracts/PersonalDailyScan";
import { VerifiedMarketEvidenceStatus } from "../../contracts/VerifiedMarketSnapshot";
import {
  PersonalWatchlistHoldingBoundary,
  PersonalWatchlistResetPolicy,
  type PersonalWatchlistMapping,
  type PersonalWatchlistMappingRegistry,
} from "../../contracts/PersonalWatchlistMapping";

export const PERSONAL_DAILY_SCAN_ELIGIBILITY_POLICY_VERSION = "1.0" as const;

export interface PersonalDailyScanEligibilityResult {
  readonly status: PersonalDailyScanEligibilityStatus;
  readonly blockingReasons: readonly string[];
  readonly waitingForEvidence: boolean;
}

/**
 * Classification is metadata-derived. This MVP registry validates every mapped
 * vehicle as an ETF with an exact signed +/-2x daily target and intraday hold
 * boundary, so no ticker convention can alter the resulting category.
 */
export function classifyPersonalWatchlistVehicle(mapping: PersonalWatchlistMapping): PersonalDailyScanInstrumentClassification {
  if (mapping.tradeVehicle.assetClass !== InstrumentAssetClass.Etf
    || mapping.resetPolicy !== PersonalWatchlistResetPolicy.Daily
    || mapping.holdingBoundary !== PersonalWatchlistHoldingBoundary.IntradayOnly) {
    throw new Error(`Mapping ${mapping.mappingId} does not establish a supported daily ETF vehicle classification.`);
  }
  if (mapping.exposure === PersonalCandidateExposure.Bullish && mapping.dailyTargetBasisPoints > 10_000) {
    return PersonalDailyScanInstrumentClassification.LeveragedLong;
  }
  if (mapping.exposure === PersonalCandidateExposure.Bearish && mapping.dailyTargetBasisPoints < -10_000) {
    return PersonalDailyScanInstrumentClassification.LeveragedInverse;
  }
  throw new Error(`Mapping ${mapping.mappingId} has unsupported vehicle target metadata.`);
}

/** Resolves a known personal-watchlist instrument from registry identity and vehicle metadata only. */
export function classifyPersonalWatchlistInstrument(
  registry: PersonalWatchlistMappingRegistry,
  instrumentId: string,
): PersonalDailyScanInstrumentClassification {
  const vehicleMapping = registry.mappings.find((mapping) => mapping.tradeVehicle.instrumentId === instrumentId);
  if (vehicleMapping !== undefined) return classifyPersonalWatchlistVehicle(vehicleMapping);
  if (registry.mappings.some((mapping) => mapping.analysisInstrument.instrumentId === instrumentId)) {
    return PersonalDailyScanInstrumentClassification.AnalysisUnderlying;
  }
  throw new Error(`Instrument ${instrumentId} is not in the approved personal watchlist registry.`);
}

export function evaluatePersonalDailyScanEligibility(input: {
  readonly classification: PersonalDailyScanInstrumentClassification;
  readonly macroEvidenceStatus: VerifiedMarketEvidenceStatus;
  readonly benchmarkEvidenceStatus: VerifiedMarketEvidenceStatus;
  readonly volatilityEvidenceStatus: VerifiedMarketEvidenceStatus;
}): PersonalDailyScanEligibilityResult {
  const requiresLeverageEvidence = input.classification === PersonalDailyScanInstrumentClassification.LeveragedLong
    || input.classification === PersonalDailyScanInstrumentClassification.LeveragedInverse
    || input.classification === PersonalDailyScanInstrumentClassification.Inverse;
  if (!requiresLeverageEvidence) return freeze({ status: PersonalDailyScanEligibilityStatus.Eligible, blockingReasons: [], waitingForEvidence: false });
  const blockingReasons = [
    ...(input.macroEvidenceStatus === VerifiedMarketEvidenceStatus.Available ? [] : ["LEVERAGED_MACRO_EVIDENCE_REQUIRED"]),
    ...(input.benchmarkEvidenceStatus === VerifiedMarketEvidenceStatus.Available ? [] : ["LEVERAGED_QQQ_SMH_BENCHMARK_REQUIRED"]),
    ...(input.volatilityEvidenceStatus === VerifiedMarketEvidenceStatus.Available ? [] : ["LEVERAGED_VOLATILITY_EVIDENCE_REQUIRED"]),
  ];
  return freeze({ status: blockingReasons.length === 0 ? PersonalDailyScanEligibilityStatus.Eligible : PersonalDailyScanEligibilityStatus.Blocked, blockingReasons, waitingForEvidence: blockingReasons.length > 0 });
}

/** Product presentation is a pure intersection of structural signal and separate eligibility gate. */
export function mapPersonalDailyScanProductDisplayStatus(
  structuralStatus: PersonalCandidateStatus,
  eligibility: PersonalDailyScanEligibilityResult,
): PersonalDailyScanDisplayStatus {
  if (structuralStatus === PersonalCandidateStatus.Excluded) return PersonalDailyScanDisplayStatus.Excluded;
  if (structuralStatus === PersonalCandidateStatus.WatchTrigger) return PersonalDailyScanDisplayStatus.WatchTrigger;
  if (eligibility.status === PersonalDailyScanEligibilityStatus.Eligible) return PersonalDailyScanDisplayStatus.Ready;
  return eligibility.waitingForEvidence ? PersonalDailyScanDisplayStatus.WatchTrigger : PersonalDailyScanDisplayStatus.Excluded;
}

function freeze<T>(value: T): T { return Object.freeze(value); }
