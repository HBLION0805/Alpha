import { BarInterval, CanonicalBarStatus } from "../../contracts/CanonicalBar";
import { CanonicalQuoteStatus } from "../../contracts/CanonicalQuote";
import { deterministicFingerprint } from "../../contracts/DeterministicFingerprint";
import { PersonalDecisionLiquidityStatus } from "../../contracts/PersonalDecision";
import { PersonalCandidateValidationIssueCode } from "../../contracts/PersonalCandidateScan";
import type { PersonalMarketDataCandidateObservation } from "../../contracts/PersonalMarketDataComposition";
import {
  PERSONAL_DAILY_SCAN_SCHEMA_VERSION,
  PersonalDailyScanIntent,
  PersonalDailyScanMode,
  PersonalDailyScanRunStatus,
  type PersonalDailyScanOwnerOutput,
} from "../../contracts/PersonalDailyScan";
import type { PersonalWatchlistMapping } from "../../contracts/PersonalWatchlistMapping";
import {
  VerifiedMarketEvidenceStatus,
  VerifiedMarketSnapshotStatus,
} from "../../contracts/VerifiedMarketSnapshot";
import {
  composePersonalMarketData,
  PersonalMarketDataCompositionError,
} from "../personal-market-data-composition/PersonalMarketDataCompositionEngine";
import {
  PersonalCandidateValidationError,
  scanPersonalCandidates,
} from "../personal-candidate-scan/PersonalCandidateScanEngine";
import {
  composeVerifiedMarketSnapshot,
  validateVerifiedMarketSnapshotCompositionBinding,
  VerifiedMarketSnapshotValidationError,
} from "../verified-market-snapshot/VerifiedMarketSnapshotEngine";
import {
  buildOfflinePersonalDailyScanFixture,
  PERSONAL_DAILY_SCAN_EVIDENCE_POLICY_VERSION,
  PERSONAL_DAILY_SCAN_FIXTURE_AS_OF,
  PERSONAL_DAILY_SCAN_MAPPING_REGISTRY_VERSION,
  PERSONAL_DAILY_SCAN_PROFILE_ID,
  PERSONAL_DAILY_SCAN_PROFILE_VERSION,
  planOfflinePersonalDailyScanDryRun,
  type OfflinePersonalDailyScanFixture,
} from "./PersonalDailyScanFixture";
import {
  PERSONAL_DAILY_SCAN_ELIGIBILITY_POLICY_VERSION,
  classifyPersonalWatchlistVehicle,
  evaluatePersonalDailyScanEligibility,
  mapPersonalDailyScanProductDisplayStatus,
  type PersonalDailyScanEligibilityResult,
} from "./PersonalDailyScanEligibility";

export interface PersonalDailyScanApplicationRequest {
  readonly mode: PersonalDailyScanMode;
  readonly intent?: PersonalDailyScanIntent;
  readonly fixtureFactory?: () => OfflinePersonalDailyScanFixture;
}

interface IntentGate {
  readonly allowed: boolean;
  readonly macroStatus: VerifiedMarketEvidenceStatus;
  readonly blockers: readonly string[];
}
export interface PersonalDailyScanRunIdentityInput {
  readonly mode: PersonalDailyScanMode;
  readonly intent: PersonalDailyScanIntent;
  readonly asOf: string;
  readonly inputFingerprint: string;
  readonly mappingRegistryVersion: string;
  readonly profileId: string;
  readonly profileVersion: string;
  readonly evidencePolicyVersion: string;
  readonly macroEvidenceStatus: VerifiedMarketEvidenceStatus;
  readonly benchmarkEvidenceStatus: VerifiedMarketEvidenceStatus;
  readonly volatilityEvidenceStatus: VerifiedMarketEvidenceStatus;
  readonly issueCodes: readonly string[];
}
interface PersonalDailyScanRuntime {
  readonly compose: typeof composePersonalMarketData;
  readonly scan: typeof scanPersonalCandidates;
}
const PRODUCT_RUNTIME: PersonalDailyScanRuntime = {
  compose: composePersonalMarketData,
  scan: scanPersonalCandidates,
};

/** Application orchestration only: no credentials, transport, order, account, or persistence path exists here. */
export function runPersonalDailyScan(
  request: Readonly<PersonalDailyScanApplicationRequest>,
): PersonalDailyScanOwnerOutput {
  return runPersonalDailyScanWithRuntime(request, PRODUCT_RUNTIME);
}

/** Direct-file test seam. It is intentionally not re-exported from the product barrel. */
export function runPersonalDailyScanWithRuntimeForTest(
  request: Readonly<PersonalDailyScanApplicationRequest>,
  runtime: PersonalDailyScanRuntime,
): PersonalDailyScanOwnerOutput {
  return runPersonalDailyScanWithRuntime(request, runtime);
}

function runPersonalDailyScanWithRuntime(
  request: Readonly<PersonalDailyScanApplicationRequest>,
  runtime: PersonalDailyScanRuntime,
): PersonalDailyScanOwnerOutput {
  const intent = request.intent ?? PersonalDailyScanIntent.Structural;
  if (request.mode === PersonalDailyScanMode.LiveReadonly)
    return blockedLiveReadonly(intent);
  if (request.mode === PersonalDailyScanMode.DryRun) {
    const plan = planOfflinePersonalDailyScanDryRun();
    const issueCodes = ["DRY_RUN_NO_MARKET_OBSERVATIONS_COMPOSED"];
    return deepFreeze({
      schemaVersion: PERSONAL_DAILY_SCAN_SCHEMA_VERSION,
      runId: createPersonalDailyScanRunId({
        mode: request.mode,
        intent,
        asOf: PERSONAL_DAILY_SCAN_FIXTURE_AS_OF,
        inputFingerprint: deterministicFingerprint(plan),
        mappingRegistryVersion:
          PERSONAL_DAILY_SCAN_MAPPING_REGISTRY_VERSION,
        profileId: PERSONAL_DAILY_SCAN_PROFILE_ID,
        profileVersion: PERSONAL_DAILY_SCAN_PROFILE_VERSION,
        evidencePolicyVersion: PERSONAL_DAILY_SCAN_EVIDENCE_POLICY_VERSION,
        macroEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable,
        benchmarkEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable,
        volatilityEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable,
        issueCodes,
      }),
      asOf: PERSONAL_DAILY_SCAN_FIXTURE_AS_OF,
      mode: PersonalDailyScanMode.DryRun,
      intent,
      status: PersonalDailyScanRunStatus.DryRun,
      dataHealth: "DRY_RUN",
      snapshotStatus: "NOT_COMPOSED",
      providerProvenanceStatus: VerifiedMarketEvidenceStatus.Unavailable,
      benchmarkStatus: VerifiedMarketEvidenceStatus.Unavailable,
      macroEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable,
      volatilityEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable,
      blockingReasons: issueCodes,
      candidates: [],
      networkRequests: 0 as const,
      persistenceWrites: 0 as const,
      automatedExecutionAllowed: false as const,
      deterministic: true as const,
      readOnly: true as const,
    });
  }
  const fixture =
    request.fixtureFactory?.() ?? buildOfflinePersonalDailyScanFixture();
  let snapshot;
  try {
    snapshot = composeVerifiedMarketSnapshot(fixture.snapshotInput);
  } catch (error) {
    return blockedInvalidSnapshot(intent, fixture, error);
  }
  const binding = validateVerifiedMarketSnapshotCompositionBinding(
    snapshot,
    fixture.compositionRequest,
  );
  if (!binding.valid)
    return blockedOutput(
      intent,
      fixture.asOf,
      snapshot.snapshotFingerprint,
      fixture,
      binding.issues.map((entry) => entry.code),
    );
  const gate = evaluateDailyScanIntentGate(
    intent,
    fixture.macroEvidenceStatus,
    fixture.benchmarkEvidenceStatus,
    fixture.volatilityEvidenceStatus,
  );
  if (
    snapshot.status !== VerifiedMarketSnapshotStatus.Verified ||
    !gate.allowed
  )
    return blockedOutput(
      intent,
      fixture.asOf,
      snapshot.snapshotFingerprint,
      fixture,
      [...snapshot.blockingReasons, ...gate.blockers],
    );
  try {
    const composition = runtime.compose(fixture.compositionRequest);
    const scan = runtime.scan(composition.scanRequest);
    const candidates = scan.candidates.map((candidate) => {
        const mapping = fixture.mappingRegistry.mappings.find(
          (entry) =>
            entry.tradeVehicle.instrumentId ===
            candidate.tradeVehicle.instrumentId,
        );
        if (mapping === undefined)
          throw new PersonalCandidateValidationError([
            {
              code: PersonalCandidateValidationIssueCode.InvalidRequest,
              field: "candidates",
              message: `Candidate ${candidate.candidateId} is not bound to the approved registry.`,
            },
          ]);
        const eligibility = evaluatePersonalDailyScanEligibility({
          classification: classifyPersonalWatchlistVehicle(mapping),
          macroEvidenceStatus: fixture.macroEvidenceStatus,
          benchmarkEvidenceStatus: fixture.benchmarkEvidenceStatus,
          volatilityEvidenceStatus: fixture.volatilityEvidenceStatus,
        });
        const observation = fixture.compositionRequest.candidates.find(
          (entry) => entry.candidateId === candidate.candidateId,
        );
        return candidateOutput(candidate, mapping, eligibility, observation);
      });
    return deepFreeze({
      schemaVersion: PERSONAL_DAILY_SCAN_SCHEMA_VERSION,
      runId: createPersonalDailyScanRunId(
        runIdentity(fixture, intent, snapshot.snapshotFingerprint, []),
      ),
      asOf: fixture.asOf,
      mode: PersonalDailyScanMode.Fixture,
      intent,
      status: PersonalDailyScanRunStatus.Completed,
      dataHealth: "HEALTHY",
      snapshotStatus: snapshot.status,
      providerProvenanceStatus: snapshot.requiredEvidenceStatus.provenance,
      benchmarkStatus: fixture.benchmarkEvidenceStatus,
      macroEvidenceStatus: gate.macroStatus,
      volatilityEvidenceStatus: fixture.volatilityEvidenceStatus,
      blockingReasons: [],
      candidates,
      networkRequests: 0 as const,
      persistenceWrites: 0 as const,
      automatedExecutionAllowed: false as const,
      deterministic: true as const,
      readOnly: true as const,
    });
  } catch (error) {
    return blockedProcessing(
      intent,
      fixture,
      snapshot.snapshotFingerprint,
      error,
    );
  }
}

export function createPersonalDailyScanRunId(
  input: PersonalDailyScanRunIdentityInput,
): string {
  return `personal-daily-scan:${deterministicFingerprint({
    schemaVersion: PERSONAL_DAILY_SCAN_SCHEMA_VERSION,
    applicationVersion: PERSONAL_DAILY_SCAN_SCHEMA_VERSION,
    ...input,
    issueCodes: uniqueSorted(input.issueCodes),
    eligibilityPolicyVersion:
      PERSONAL_DAILY_SCAN_ELIGIBILITY_POLICY_VERSION,
  }).slice(-16)}`;
}

/** Macro/news is deliberately not fetched in Phase 1A; this is a visible policy gate, not a research engine. */
export function evaluateDailyScanIntentGate(
  intent: PersonalDailyScanIntent,
  macro: VerifiedMarketEvidenceStatus,
  benchmark: VerifiedMarketEvidenceStatus,
  volatility: VerifiedMarketEvidenceStatus,
): IntentGate {
  if (intent === PersonalDailyScanIntent.Structural)
    return deepFreeze({ allowed: true, macroStatus: macro, blockers: [] });
  if (intent === PersonalDailyScanIntent.EventSensitive)
    return deepFreeze({
      allowed: macro === VerifiedMarketEvidenceStatus.Available,
      macroStatus: macro,
      blockers:
        macro === VerifiedMarketEvidenceStatus.Available
          ? []
          : ["EVENT_CALENDAR_REQUIRED_UNAVAILABLE"],
    });
  const blockers = [
    ...(macro === VerifiedMarketEvidenceStatus.Available
      ? []
      : ["LEVERAGED_MACRO_EVIDENCE_REQUIRED"]),
    ...(benchmark === VerifiedMarketEvidenceStatus.Available
      ? []
      : ["LEVERAGED_QQQ_SMH_BENCHMARK_REQUIRED"]),
    ...(volatility === VerifiedMarketEvidenceStatus.Available
      ? []
      : ["LEVERAGED_VOLATILITY_EVIDENCE_REQUIRED"]),
  ];
  return deepFreeze({
    allowed: blockers.length === 0,
    macroStatus: macro,
    blockers,
  });
}

function blockedLiveReadonly(
  intent: PersonalDailyScanIntent,
): PersonalDailyScanOwnerOutput {
  const issueCodes = ["OWNER_NETWORK_AUTHORIZATION_REQUIRED"];
  const asOf = PERSONAL_DAILY_SCAN_FIXTURE_AS_OF;
  return deepFreeze({
    schemaVersion: PERSONAL_DAILY_SCAN_SCHEMA_VERSION,
    runId: createPersonalDailyScanRunId({
      mode: PersonalDailyScanMode.LiveReadonly,
      intent,
      asOf,
      inputFingerprint: deterministicFingerprint({
        authority: "NETWORK_CLOSED",
        mode: PersonalDailyScanMode.LiveReadonly,
      }),
      mappingRegistryVersion: PERSONAL_DAILY_SCAN_MAPPING_REGISTRY_VERSION,
      profileId: PERSONAL_DAILY_SCAN_PROFILE_ID,
      profileVersion: PERSONAL_DAILY_SCAN_PROFILE_VERSION,
      evidencePolicyVersion: PERSONAL_DAILY_SCAN_EVIDENCE_POLICY_VERSION,
      macroEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable,
      benchmarkEvidenceStatus: VerifiedMarketEvidenceStatus.Blocked,
      volatilityEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable,
      issueCodes,
    }),
    asOf,
    mode: PersonalDailyScanMode.LiveReadonly,
    intent,
    status: PersonalDailyScanRunStatus.Blocked,
    dataHealth: "BLOCKED",
    snapshotStatus: "NOT_COMPOSED",
    providerProvenanceStatus: VerifiedMarketEvidenceStatus.Blocked,
    benchmarkStatus: VerifiedMarketEvidenceStatus.Blocked,
    macroEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable,
    volatilityEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable,
    blockingReasons: issueCodes,
    candidates: [],
    networkRequests: 0 as const,
    persistenceWrites: 0 as const,
    automatedExecutionAllowed: false as const,
    deterministic: true as const,
    readOnly: true as const,
  });
}

function blockedInvalidSnapshot(
  intent: PersonalDailyScanIntent,
  fixture: OfflinePersonalDailyScanFixture,
  error: unknown,
): PersonalDailyScanOwnerOutput {
  const reasons =
    error instanceof VerifiedMarketSnapshotValidationError
      ? error.issues.map((entry) => entry.code)
      : ["INVALID_MARKET_SNAPSHOT"];
  const issueCodes = uniqueSorted(reasons);
  return deepFreeze({
    schemaVersion: PERSONAL_DAILY_SCAN_SCHEMA_VERSION,
    runId: createPersonalDailyScanRunId(
      runIdentity(
        fixture,
        intent,
        deterministicFingerprint(fixture.snapshotInput),
        issueCodes,
        VerifiedMarketEvidenceStatus.Invalid,
      ),
    ),
    asOf: fixture.asOf,
    mode: PersonalDailyScanMode.Fixture,
    intent,
    status: PersonalDailyScanRunStatus.Blocked,
    dataHealth: "BLOCKED",
    snapshotStatus: "NOT_COMPOSED",
    providerProvenanceStatus: VerifiedMarketEvidenceStatus.Blocked,
    benchmarkStatus: VerifiedMarketEvidenceStatus.Blocked,
    macroEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable,
    volatilityEvidenceStatus: VerifiedMarketEvidenceStatus.Invalid,
    blockingReasons: issueCodes,
    candidates: [],
    networkRequests: 0 as const,
    persistenceWrites: 0 as const,
    automatedExecutionAllowed: false as const,
    deterministic: true as const,
    readOnly: true as const,
  });
}
function blockedOutput(
  intent: PersonalDailyScanIntent,
  asOf: string,
  snapshotFingerprint: string,
  fixture: OfflinePersonalDailyScanFixture,
  reasons: readonly string[],
): PersonalDailyScanOwnerOutput {
  const issueCodes = uniqueSorted(reasons);
  return deepFreeze({
    schemaVersion: PERSONAL_DAILY_SCAN_SCHEMA_VERSION,
    runId: createPersonalDailyScanRunId(
      runIdentity(fixture, intent, snapshotFingerprint, issueCodes),
    ),
    asOf,
    mode: PersonalDailyScanMode.Fixture,
    intent,
    status: PersonalDailyScanRunStatus.Blocked,
    dataHealth: "BLOCKED",
    snapshotStatus: VerifiedMarketSnapshotStatus.Blocked,
    providerProvenanceStatus: VerifiedMarketEvidenceStatus.Blocked,
    benchmarkStatus: fixture.benchmarkEvidenceStatus,
    macroEvidenceStatus: fixture.macroEvidenceStatus,
    volatilityEvidenceStatus: fixture.volatilityEvidenceStatus,
    blockingReasons: issueCodes,
    candidates: [],
    networkRequests: 0 as const,
    persistenceWrites: 0 as const,
    automatedExecutionAllowed: false as const,
    deterministic: true as const,
    readOnly: true as const,
  });
}

function blockedProcessing(
  intent: PersonalDailyScanIntent,
  fixture: OfflinePersonalDailyScanFixture,
  snapshotFingerprint: string,
  error: unknown,
): PersonalDailyScanOwnerOutput {
  const reasons =
    error instanceof PersonalMarketDataCompositionError
      ? error.issues.map((entry) => `COMPOSITION_${entry.code}`)
      : error instanceof PersonalCandidateValidationError
        ? error.issues.map((entry) => `CANDIDATE_${entry.code}`)
        : ["PERSONAL_DAILY_SCAN_PROCESSING_ERROR"];
  return blockedOutput(
    intent,
    fixture.asOf,
    snapshotFingerprint,
    fixture,
    reasons,
  );
}

function runIdentity(
  fixture: OfflinePersonalDailyScanFixture,
  intent: PersonalDailyScanIntent,
  inputFingerprint: string,
  issueCodes: readonly string[],
  volatilityEvidenceStatus = fixture.volatilityEvidenceStatus,
): PersonalDailyScanRunIdentityInput {
  return {
    mode: PersonalDailyScanMode.Fixture,
    intent,
    asOf: fixture.asOf,
    inputFingerprint,
    mappingRegistryVersion: fixture.mappingRegistry.version,
    profileId: fixture.compositionRequest.profileId,
    profileVersion: fixture.compositionRequest.profileVersion,
    evidencePolicyVersion:
      fixture.snapshotInput.freshnessQualityPolicy.version,
    macroEvidenceStatus: fixture.macroEvidenceStatus,
    benchmarkEvidenceStatus: fixture.benchmarkEvidenceStatus,
    volatilityEvidenceStatus,
    issueCodes,
  };
}

function candidateOutput(
  candidate: ReturnType<typeof scanPersonalCandidates>["candidates"][number],
  mapping: PersonalWatchlistMapping,
  eligibility: PersonalDailyScanEligibilityResult,
  observation: PersonalMarketDataCandidateObservation | undefined,
) {
  return deepFreeze({
    candidateId: candidate.candidateId,
    analysisInstrument: candidate.analysisInstrument.symbol,
    tradeVehicle: candidate.tradeVehicle.symbol,
    tradeVehicleClassification: classifyPersonalWatchlistVehicle(mapping),
    internalStatus: candidate.status,
    structuralStatus: candidate.status,
    eligibilityStatus: eligibility.status,
    productDisplayStatus: mapPersonalDailyScanProductDisplayStatus(
      candidate.status,
      eligibility,
    ),
    blockingReasons: uniqueSorted([
      ...candidate.blockerCodes,
      ...eligibility.blockingReasons,
    ]),
    reasons: [...candidate.reasonCodes],
    completedSessionBarValidity:
      derivePersonalDailyScanCompletedSessionBarValidity(observation),
    quoteFreshness: derivePersonalDailyScanQuoteFreshness(observation),
    liquidityEvidenceStatus:
      derivePersonalDailyScanLiquidityEvidenceStatus(observation),
  });
}
export function derivePersonalDailyScanCompletedSessionBarValidity(
  observation: PersonalMarketDataCandidateObservation | undefined,
): "VALID" | "UNAVAILABLE" {
  const exactIntervals = [BarInterval.OneDay, BarInterval.OneHour, BarInterval.FifteenMinutes, BarInterval.FiveMinutes];
  return observation !== undefined && observation.timeframes.length === exactIntervals.length && exactIntervals.every((interval) => observation.timeframes.some((timeframe) => timeframe.interval === interval && timeframe.start.status === CanonicalBarStatus.Final && timeframe.end.status === CanonicalBarStatus.Final && timeframe.start.barId !== timeframe.end.barId && timeframe.start.fingerprint !== timeframe.end.fingerprint && timeframe.start.intervalEnd < timeframe.end.intervalEnd)) ? "VALID" : "UNAVAILABLE";
}
export function derivePersonalDailyScanQuoteFreshness(
  observation: PersonalMarketDataCandidateObservation | undefined,
): "CURRENT" | "STALE" | "UNAVAILABLE" {
  if (observation === undefined) return "UNAVAILABLE";
  return observation.quote.status === CanonicalQuoteStatus.Current
    ? "CURRENT"
    : "STALE";
}
export function derivePersonalDailyScanLiquidityEvidenceStatus(
  observation: PersonalMarketDataCandidateObservation | undefined,
): "SUFFICIENT" | "INSUFFICIENT" | "UNAVAILABLE" {
  if (observation === undefined) return "UNAVAILABLE";
  return observation.liquidity.status === PersonalDecisionLiquidityStatus.Sufficient ? "SUFFICIENT" : observation.liquidity.status === PersonalDecisionLiquidityStatus.Insufficient ? "INSUFFICIENT" : "UNAVAILABLE";
}
function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value as Record<string, unknown>))
      deepFreeze(item);
  }
  return value;
}
