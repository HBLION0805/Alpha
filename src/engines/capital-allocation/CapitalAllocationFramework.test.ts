import {
  CAPITAL_ALLOCATION_FRAMEWORK_VERSION,
  CAPITAL_ALLOCATION_SCHEMA_VERSION,
  AllocationAssetType,
  AllocationCandidateStatus,
  AllocationCashAction,
  AllocationCategory,
  AllocationConfidence,
  AllocationEvidenceQuality,
  AllocationHoldingPeriod,
  AllocationPortfolioState,
  AllocationPriority,
  AllocationRecommendedAction,
  AllocationRiskGateStatus,
  AllocationRiskLevel,
  AllocationSourceState,
  AllocationSourceType,
  CapitalAllocationAuthorizationStatus,
  CapitalAllocationValidationIssueCode,
  type AllocationCandidate,
  type AllocationEvidenceReference,
  type CapitalAllocationRecommendationRequest,
} from "../../contracts/CapitalAllocation";
import {
  EVIDENCE_FUSION_SCHEMA_VERSION,
  EvidenceFusionAssessmentStatus,
  EvidenceFusionCompleteness,
  EvidenceFusionFreshness,
  EvidenceFusionQuality,
} from "../../contracts/EvidenceFusion";
import {
  MARKET_REGIME_SCHEMA_VERSION,
  MarketRegimeDataQualityStatus,
  MarketRegimeEvidenceStrength,
  MarketRegimePrimary,
} from "../../contracts/MarketRegime";
import {
  CapitalAllocationFramework,
  CapitalAllocationValidationError,
  validateCapitalAllocationRecommendationRequest,
} from "./CapitalAllocationFramework";

function assertEqual<T>(actual: T, expected: T, label: string): void { if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`); }
function assertTrue(value: boolean, label: string): void { if (!value) throw new Error(`${label}: expected true.`); }
function assertDeepEqual(actual: unknown, expected: unknown, label: string): void { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: values differ.`); }

const framework = new CapitalAllocationFramework();

function evidenceReference(overrides: Partial<AllocationEvidenceReference> = {}): AllocationEvidenceReference {
  return {
    sourceType: AllocationSourceType.EvidenceFusion,
    recordId: "evidence-fusion:assessment:1",
    snapshotId: "evidence-fusion:snapshot:1",
    schemaVersion: "1.0",
    state: AllocationSourceState.Accepted,
    assessedAt: "2026-07-22T14:55:00.000Z",
    fingerprint: "fnv1a64:0123456789abcdef",
    policyVersion: "1.0",
    ruleSetVersion: "1.0",
    evidenceReferenceIds: ["evidence:broad-market:1"],
    ...overrides,
  };
}

function candidate(overrides: Partial<AllocationCandidate> = {}): AllocationCandidate {
  return {
    candidateId: "allocation-candidate:spy:1",
    canonicalInstrumentId: "instrument:us-etf:spy",
    ticker: "SPY",
    assetType: AllocationAssetType.Etf,
    category: AllocationCategory.Core,
    sector: "Broad Market",
    confidence: AllocationConfidence.StrongEvidence,
    evidenceQuality: AllocationEvidenceQuality.Sufficient,
    riskLevel: AllocationRiskLevel.Moderate,
    expectedHoldingPeriod: AllocationHoldingPeriod.MediumTerm,
    primaryCatalyst: "Reviewed broad-market alignment.",
    supportingEvidence: [evidenceReference()],
    recommendationReason: "Eligible for allocation review after evidence and risk gates.",
    priority: AllocationPriority.Unranked,
    status: AllocationCandidateStatus.EligibleForReview,
    ...overrides,
  };
}

function avoidCandidate(overrides: Partial<AllocationCandidate> = {}): AllocationCandidate {
  return candidate({
    candidateId: "allocation-candidate:btc:avoid:1",
    canonicalInstrumentId: "instrument:crypto:btc-usd",
    ticker: "BTC",
    assetType: AllocationAssetType.Crypto,
    category: AllocationCategory.Watchlist,
    confidence: AllocationConfidence.WeakEvidence,
    evidenceQuality: AllocationEvidenceQuality.Limited,
    riskLevel: AllocationRiskLevel.High,
    primaryCatalyst: "Evidence remains limited.",
    recommendationReason: "Avoid allocation pending stronger evidence.",
    status: AllocationCandidateStatus.Avoid,
    ...overrides,
  });
}

function request(overrides: Partial<CapitalAllocationRecommendationRequest> = {}): CapitalAllocationRecommendationRequest {
  return {
    schemaVersion: CAPITAL_ALLOCATION_SCHEMA_VERSION,
    frameworkVersion: CAPITAL_ALLOCATION_FRAMEWORK_VERSION,
    recommendationId: "capital-allocation:recommendation:1",
    timestamp: "2026-07-22T15:00:00.000Z",
    createdAt: "2026-07-22T15:00:00.000Z",
    portfolio: {
      snapshotId: "portfolio:snapshot:1",
      schemaVersion: "1.0",
      asOfTime: "2026-07-22T14:58:00.000Z",
      state: AllocationPortfolioState.Current,
      evidenceReferenceIds: ["portfolio:evidence:1"],
    },
    evidenceFusion: {
      assessmentId: "evidence-fusion:assessment:1",
      snapshotId: "evidence-fusion:snapshot:1",
      snapshotFingerprint: "fnv1a64:0123456789abcdef",
      status: EvidenceFusionAssessmentStatus.Ready,
      completeness: EvidenceFusionCompleteness.Complete,
      freshness: EvidenceFusionFreshness.Current,
      quality: EvidenceFusionQuality.Accepted,
      evaluatedAt: "2026-07-22T14:55:00.000Z",
      schemaVersion: EVIDENCE_FUSION_SCHEMA_VERSION,
      policyVersion: "1.0",
      ruleSetVersion: "1.0",
      evidenceReferenceIds: ["evidence:broad-market:1"],
    },
    marketRegime: {
      assessmentId: "market-regime:assessment:1",
      schemaVersion: MARKET_REGIME_SCHEMA_VERSION,
      assessedAt: "2026-07-22T14:56:00.000Z",
      primaryRegime: MarketRegimePrimary.RangeBound,
      evidenceStrength: MarketRegimeEvidenceStrength.Strong,
      dataQualityStatus: MarketRegimeDataQualityStatus.Accepted,
      policyVersion: "1.0",
      ruleSetVersion: "1.0",
      evidenceReferenceIds: ["market-regime:evidence:1"],
    },
    overallRisk: {
      assessmentId: "risk:assessment:1",
      schemaVersion: "1.0",
      evaluatedAt: "2026-07-22T14:59:00.000Z",
      status: AllocationRiskGateStatus.Constrained,
      riskLevel: AllocationRiskLevel.Moderate,
      policyVersion: "1.0",
      constraints: ["Preserve the configured cash reserve."],
      evidenceReferenceIds: ["risk:evidence:1"],
    },
    recommendedAction: AllocationRecommendedAction.ReviewCandidates,
    topCandidates: [candidate()],
    avoidList: [avoidCandidate()],
    cashRecommendation: {
      action: AllocationCashAction.Maintain,
      reason: "Retain the risk-required reserve.",
      suggestedWeight: { basisPoints: 2_000 },
    },
    notes: ["Foundation recommendation only."],
    extensionEvidence: [],
    trace: {
      correlationId: "correlation:capital-allocation:1",
      traceId: "trace:capital-allocation:1",
      auditReferenceIds: ["audit:risk:1", "audit:fusion:1"],
    },
    ...overrides,
  };
}

function changed(update: (draft: Record<string, unknown>) => void): unknown {
  const draft = JSON.parse(JSON.stringify(request())) as Record<string, unknown>;
  update(draft);
  return draft;
}

function expectIssue(value: unknown, code: CapitalAllocationValidationIssueCode): void {
  const validation = validateCapitalAllocationRecommendationRequest(value);
  if (!validation.issues.some((entry) => entry.code === code)) throw new Error(`Expected ${code}, received ${validation.issues.map((entry) => entry.code).join(", ")}.`);
}

function expectError(value: unknown, code: CapitalAllocationValidationIssueCode): void {
  try { framework.recommend(value); } catch (error) {
    if (error instanceof CapitalAllocationValidationError && error.issues.some((entry) => entry.code === code)) return;
    throw error;
  }
  throw new Error(`Expected ${code}.`);
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["valid reviewed inputs construct a recommendation", () => { const output = framework.recommend(request()); assertEqual(output.recommendationId, request().recommendationId, "recommendation"); }],
  ["schema and framework versions are preserved", () => { const output = framework.recommend(request()); assertEqual(output.schemaVersion, "1.0", "schema"); assertEqual(output.frameworkVersion, "1.0", "framework"); }],
  ["output is explicitly non-executable", () => assertEqual(framework.recommend(request()).authorizationStatus, CapitalAllocationAuthorizationStatus.FrameworkOnly, "authorization")],
  ["Portfolio state must be current", () => expectIssue(changed((draft) => { (draft["portfolio"] as Record<string, unknown>)["state"] = AllocationPortfolioState.Stale; }), CapitalAllocationValidationIssueCode.InvalidPortfolio)],
  ["blocked Evidence Fusion fails closed", () => expectError(changed((draft) => { (draft["evidenceFusion"] as Record<string, unknown>)["status"] = EvidenceFusionAssessmentStatus.Blocked; }), CapitalAllocationValidationIssueCode.EvidenceGateBlocked)],
  ["incomplete Evidence Fusion fails closed", () => expectIssue(changed((draft) => { (draft["evidenceFusion"] as Record<string, unknown>)["completeness"] = EvidenceFusionCompleteness.Incomplete; }), CapitalAllocationValidationIssueCode.EvidenceGateBlocked)],
  ["stale Evidence Fusion fails closed", () => expectIssue(changed((draft) => { (draft["evidenceFusion"] as Record<string, unknown>)["freshness"] = EvidenceFusionFreshness.Stale; }), CapitalAllocationValidationIssueCode.EvidenceGateBlocked)],
  ["contradictory Evidence Fusion fails closed", () => expectIssue(changed((draft) => { (draft["evidenceFusion"] as Record<string, unknown>)["quality"] = EvidenceFusionQuality.Contradictory; }), CapitalAllocationValidationIssueCode.EvidenceGateBlocked)],
  ["insufficient Market Regime fails closed", () => expectIssue(changed((draft) => { (draft["marketRegime"] as Record<string, unknown>)["primaryRegime"] = MarketRegimePrimary.InsufficientEvidence; }), CapitalAllocationValidationIssueCode.MarketRegimeRejected)],
  ["insufficient Market Regime evidence strength fails closed", () => expectIssue(changed((draft) => { (draft["marketRegime"] as Record<string, unknown>)["evidenceStrength"] = MarketRegimeEvidenceStrength.Insufficient; }), CapitalAllocationValidationIssueCode.MarketRegimeRejected)],
  ["rejected Market Regime quality fails closed", () => expectIssue(changed((draft) => { (draft["marketRegime"] as Record<string, unknown>)["dataQualityStatus"] = MarketRegimeDataQualityStatus.Rejected; }), CapitalAllocationValidationIssueCode.MarketRegimeRejected)],
  ["blocked Risk fails closed", () => expectError(changed((draft) => { (draft["overallRisk"] as Record<string, unknown>)["status"] = AllocationRiskGateStatus.Blocked; }), CapitalAllocationValidationIssueCode.RiskGateBlocked)],
  ["unavailable Risk fails closed", () => expectIssue(changed((draft) => { (draft["overallRisk"] as Record<string, unknown>)["status"] = AllocationRiskGateStatus.Unavailable; }), CapitalAllocationValidationIssueCode.RiskGateBlocked)],
  ["Risk constraints remain authoritative in output", () => assertDeepEqual(framework.recommend(request()).overallRisk.constraints, ["Preserve the configured cash reserve."], "constraints")],
  ["CONSTRAINED Risk requires at least one constraint", () => expectIssue(changed((draft) => { (draft["overallRisk"] as Record<string, unknown>)["constraints"] = []; }), CapitalAllocationValidationIssueCode.InvalidText)],
  ["Risk constraints must be unique", () => expectIssue(changed((draft) => { (draft["overallRisk"] as Record<string, unknown>)["constraints"] = ["Limit exposure.", "Limit exposure."]; }), CapitalAllocationValidationIssueCode.InvalidText)],
  ["malformed Risk constraints fail closed", () => expectIssue(changed((draft) => { (draft["overallRisk"] as Record<string, unknown>)["constraints"] = [""]; }), CapitalAllocationValidationIssueCode.InvalidText)],
  ["CLEARED Risk may have no constraints", () => { const value = changed((draft) => { const risk = draft["overallRisk"] as Record<string, unknown>; risk["status"] = AllocationRiskGateStatus.Cleared; risk["constraints"] = []; }); assertTrue(validateCapitalAllocationRecommendationRequest(value).valid, "cleared"); }],
  ["Risk may share the Fusion and Regime timestamp", () => { const value = changed((draft) => { const risk = draft["overallRisk"] as Record<string, unknown>; risk["evaluatedAt"] = "2026-07-22T14:56:00.000Z"; }); assertTrue(validateCapitalAllocationRecommendationRequest(value).valid, "equal timestamp"); }],
  ["Risk cannot predate Fusion", () => expectIssue(changed((draft) => { (draft["overallRisk"] as Record<string, unknown>)["evaluatedAt"] = "2026-07-22T14:54:00.000Z"; }), CapitalAllocationValidationIssueCode.RiskGateBlocked)],
  ["Risk cannot predate Market Regime", () => expectIssue(changed((draft) => { (draft["overallRisk"] as Record<string, unknown>)["evaluatedAt"] = "2026-07-22T14:55:00.000Z"; }), CapitalAllocationValidationIssueCode.RiskGateBlocked)],
  ["future-dated upstream inputs fail closed", () => expectIssue(changed((draft) => { (draft["overallRisk"] as Record<string, unknown>)["evaluatedAt"] = "2026-07-22T15:01:00.000Z"; }), CapitalAllocationValidationIssueCode.InvalidTimestamp)],
  ["top candidates require sufficient evidence", () => expectIssue(request({ topCandidates: [candidate({ evidenceQuality: AllocationEvidenceQuality.Limited })] }), CapitalAllocationValidationIssueCode.CandidateEvidenceInsufficient)],
  ["top candidates reject prohibited risk", () => expectIssue(request({ topCandidates: [candidate({ riskLevel: AllocationRiskLevel.Prohibited })] }), CapitalAllocationValidationIssueCode.CandidateRiskProhibited)],
  ["top candidates must be eligible for review", () => expectIssue(request({ topCandidates: [candidate({ status: AllocationCandidateStatus.Watch })] }), CapitalAllocationValidationIssueCode.InvalidCandidate)],
  ["avoid list requires avoid or blocked status", () => expectIssue(request({ avoidList: [avoidCandidate({ status: AllocationCandidateStatus.Watch })] }), CapitalAllocationValidationIssueCode.InvalidCandidate)],
  ["duplicate candidate IDs are rejected", () => expectIssue(request({ avoidList: [avoidCandidate({ candidateId: candidate().candidateId })] }), CapitalAllocationValidationIssueCode.DuplicateCandidate)],
  ["duplicate canonical instruments are rejected", () => expectIssue(request({ avoidList: [avoidCandidate({ canonicalInstrumentId: candidate().canonicalInstrumentId })] }), CapitalAllocationValidationIssueCode.DuplicateInstrument)],
  ["ticker remains display metadata beside canonical identity", () => { const output = framework.recommend(request()); assertEqual(output.topCandidates[0]?.ticker, "SPY", "ticker"); assertEqual(output.topCandidates[0]?.canonicalInstrumentId, "instrument:us-etf:spy", "identity"); }],
  ["v1 rejects candidate ranking", () => expectIssue(request({ topCandidates: [{ ...candidate(), priority: "HIGH" as AllocationPriority.Unranked }] }), CapitalAllocationValidationIssueCode.RankingNotSupported)],
  ["optional candidate weight is accepted as basis points", () => assertEqual(framework.recommend(request({ topCandidates: [candidate({ suggestedWeight: { basisPoints: 2_500 } })] })).topCandidates[0]?.suggestedWeight?.basisPoints, 2_500, "weight")],
  ["invalid candidate weight fails closed", () => expectIssue(request({ topCandidates: [candidate({ suggestedWeight: { basisPoints: 10_001 } })] }), CapitalAllocationValidationIssueCode.InvalidWeight)],
  ["total supplied candidate weights cannot exceed 100 percent", () => expectIssue(request({ topCandidates: [candidate({ suggestedWeight: { basisPoints: 6_000 } }), candidate({ candidateId: "allocation-candidate:qqq:1", canonicalInstrumentId: "instrument:us-etf:qqq", ticker: "QQQ", suggestedWeight: { basisPoints: 5_000 } })] }), CapitalAllocationValidationIssueCode.WeightLimitExceeded)],
  ["review action requires an eligible candidate", () => expectIssue(request({ topCandidates: [] }), CapitalAllocationValidationIssueCode.InvalidAction)],
  ["no-allocation action cannot hide top candidates", () => expectIssue(request({ recommendedAction: AllocationRecommendedAction.NoAllocation }), CapitalAllocationValidationIssueCode.InvalidAction)],
  ["no-allocation action is valid with no top candidates", () => { const output = framework.recommend(request({ recommendedAction: AllocationRecommendedAction.NoAllocation, topCandidates: [] })); assertEqual(output.recommendedAction, AllocationRecommendedAction.NoAllocation, "action"); }],
  ["unevaluated cash cannot contain a weight", () => expectIssue(request({ cashRecommendation: { action: AllocationCashAction.NotEvaluated, reason: "Cash not evaluated.", suggestedWeight: { basisPoints: 2_000 } } }), CapitalAllocationValidationIssueCode.InvalidCashRecommendation)],
  ["future Earnings Research reference is an explicit extension", () => { const extension = evidenceReference({ sourceType: AllocationSourceType.EarningsResearch, recordId: "earnings:research:1" }); const output = framework.recommend(request({ extensionEvidence: [extension] })); assertEqual(output.extensionEvidence[0]?.sourceType, AllocationSourceType.EarningsResearch, "extension"); }],
  ["Event Analyzer cannot become an upstream extension authority", () => expectIssue(request({ extensionEvidence: [evidenceReference({ sourceType: AllocationSourceType.EventAnalyzer })] }), CapitalAllocationValidationIssueCode.InvalidExtension)],
  ["Event Analyzer may be limited supplemental candidate context", () => { const supplemental = evidenceReference({ sourceType: AllocationSourceType.EventAnalyzer, recordId: "event-analyzer:assessment:1", state: AllocationSourceState.Limited }); const output = framework.recommend(request({ topCandidates: [candidate({ supportingEvidence: [evidenceReference(), supplemental] })] })); assertEqual(output.topCandidates[0]?.supportingEvidence[0]?.sourceType, AllocationSourceType.EventAnalyzer, "supplemental ordering"); }],
  ["Event Analyzer cannot be treated as accepted candidate authority", () => expectIssue(request({ topCandidates: [candidate({ supportingEvidence: [evidenceReference({ sourceType: AllocationSourceType.EventAnalyzer, recordId: "event-analyzer:assessment:1" })] })] }), CapitalAllocationValidationIssueCode.InvalidEvidenceReference)],
  ["eligible candidate cannot omit accepted Fusion support", () => expectIssue(request({ topCandidates: [candidate({ supportingEvidence: [evidenceReference({ sourceType: AllocationSourceType.EventAnalyzer, recordId: "event-analyzer:assessment:1", state: AllocationSourceState.Limited })] })] }), CapitalAllocationValidationIssueCode.CandidateEvidenceInsufficient)],
  ["eligible candidate rejects a fabricated Fusion assessment", () => expectIssue(request({ topCandidates: [candidate({ supportingEvidence: [evidenceReference({ recordId: "evidence-fusion:assessment:fake" })] })] }), CapitalAllocationValidationIssueCode.CandidateEvidenceInsufficient)],
  ["eligible candidate rejects a mismatched Fusion snapshot", () => expectIssue(request({ topCandidates: [candidate({ supportingEvidence: [evidenceReference({ snapshotId: "evidence-fusion:snapshot:other" })] })] }), CapitalAllocationValidationIssueCode.CandidateEvidenceInsufficient)],
  ["eligible candidate rejects a mismatched Fusion fingerprint", () => expectIssue(request({ topCandidates: [candidate({ supportingEvidence: [evidenceReference({ fingerprint: "fnv1a64:fedcba9876543210" })] })] }), CapitalAllocationValidationIssueCode.CandidateEvidenceInsufficient)],
  ["eligible candidate rejects partially matching Fusion versions", () => expectIssue(request({ topCandidates: [candidate({ supportingEvidence: [evidenceReference({ ruleSetVersion: "2.0" })] })] }), CapitalAllocationValidationIssueCode.CandidateEvidenceInsufficient)],
  ["eligible candidate rejects stale Fusion reference time", () => expectIssue(request({ topCandidates: [candidate({ supportingEvidence: [evidenceReference({ assessedAt: "2026-07-22T14:54:00.000Z" })] })] }), CapitalAllocationValidationIssueCode.CandidateEvidenceInsufficient)],
  ["eligible candidate rejects mismatched authoritative Fusion evidence", () => expectIssue(request({ topCandidates: [candidate({ supportingEvidence: [evidenceReference({ evidenceReferenceIds: ["evidence:broad-market:other"] })] })] }), CapitalAllocationValidationIssueCode.CandidateEvidenceInsufficient)],
  ["eligible candidate rejects duplicate Fusion references", () => expectIssue(request({ topCandidates: [candidate({ supportingEvidence: [evidenceReference(), evidenceReference()] })] }), CapitalAllocationValidationIssueCode.InvalidEvidenceReference)],
  ["future evidence sources are rejected from candidate support", () => expectIssue(request({ topCandidates: [candidate({ supportingEvidence: [evidenceReference(), evidenceReference({ sourceType: AllocationSourceType.EarningsResearch, recordId: "earnings:research:1" })] })] }), CapitalAllocationValidationIssueCode.InvalidExtension)],
  ["future-dated candidate evidence fails closed", () => expectIssue(request({ topCandidates: [candidate({ supportingEvidence: [evidenceReference({ assessedAt: "2026-07-22T15:01:00.000Z" })] })] }), CapitalAllocationValidationIssueCode.InvalidTimestamp)],
  ["blocked extension evidence fails closed", () => expectIssue(request({ extensionEvidence: [evidenceReference({ sourceType: AllocationSourceType.CapitalRotation, state: AllocationSourceState.Blocked })] }), CapitalAllocationValidationIssueCode.InvalidEvidenceReference)],
  ["candidate and avoid ordering is deterministic", () => { const first = candidate(); const second = candidate({ candidateId: "allocation-candidate:aaa:1", canonicalInstrumentId: "instrument:us-etf:aaa", ticker: "AAA" }); const output = framework.recommend(request({ topCandidates: [first, second] })); assertDeepEqual(output.topCandidates.map((entry) => entry.candidateId), [second.candidateId, first.candidateId], "ordering"); }],
  ["evidence references are unique and ordered", () => { const output = framework.recommend(request()); assertDeepEqual(output.evidenceReferences, [...output.evidenceReferences].sort(), "ordering"); assertEqual(new Set(output.evidenceReferences).size, output.evidenceReferences.length, "unique"); }],
  ["duplicate trace audit references fail closed", () => expectIssue(request({ trace: { correlationId: "correlation:capital-allocation:1", traceId: "trace:capital-allocation:1", auditReferenceIds: ["audit:risk:1", "audit:fusion:1", "audit:risk:1"] } }), CapitalAllocationValidationIssueCode.InvalidEvidenceReference)],
  ["trace audit references are deterministically ordered", () => { const output = framework.recommend(request()); assertDeepEqual(output.trace.auditReferenceIds, ["audit:fusion:1", "audit:risk:1"], "trace"); }],
  ["recommendation is deeply immutable", () => { const output = framework.recommend(request()); assertTrue(Object.isFrozen(output) && Object.isFrozen(output.topCandidates) && Object.isFrozen(output.topCandidates[0]) && Object.isFrozen(output.overallRisk.constraints), "frozen"); }],
  ["source request remains unchanged", () => { const source = request(); const before = JSON.stringify(source); framework.recommend(source); assertEqual(JSON.stringify(source), before, "source"); }],
  ["identical input produces identical output and fingerprint", () => { const source = request(); const first = framework.recommend(source); const second = framework.recommend(source); assertDeepEqual(first, second, "output"); assertEqual(first.fingerprint, second.fingerprint, "fingerprint"); }],
  ["recommendation is serializable", () => assertTrue(JSON.stringify(framework.recommend(request())).includes("capital-allocation:recommendation:1"), "serialized")],
  ["confidence is evidence strength and contains no probability", () => { const serialized = JSON.stringify(framework.recommend(request())); assertTrue(serialized.includes("STRONG_EVIDENCE") && !serialized.includes("probability"), "confidence"); }],
  ["output contains no provider-native payload or credential", () => { const serialized = JSON.stringify(framework.recommend(request())); for (const forbidden of ["providerPayload", "apiKey", "secret", "rawResponse"]) assertTrue(!serialized.includes(forbidden), `${forbidden} absent`); }],
  ["framework exposes no score leverage trade or execution methods", () => { assertDeepEqual(Object.getOwnPropertyNames(CapitalAllocationFramework.prototype), ["constructor", "recommend"], "methods"); const serialized = JSON.stringify(framework.recommend(request())); for (const forbidden of ["opportunityScore", "leverageRatio", "executeTrade", "brokerOrder", "positionSize"]) assertTrue(!serialized.includes(forbidden), `${forbidden} absent`); }],
  ["unknown request field is rejected", () => expectIssue(changed((draft) => { draft["leverageRatio"] = 2; }), CapitalAllocationValidationIssueCode.InvalidRecord)],
  ["unknown Portfolio field is rejected", () => expectIssue(changed((draft) => { (draft["portfolio"] as Record<string, unknown>)["providerPayload"] = { raw: true }; }), CapitalAllocationValidationIssueCode.InvalidPortfolio)],
  ["unknown Fusion field is rejected", () => expectIssue(changed((draft) => { (draft["evidenceFusion"] as Record<string, unknown>)["aiPayload"] = "hidden"; }), CapitalAllocationValidationIssueCode.EvidenceGateBlocked)],
  ["unknown Regime field is rejected", () => expectIssue(changed((draft) => { (draft["marketRegime"] as Record<string, unknown>)["rank"] = 1; }), CapitalAllocationValidationIssueCode.MarketRegimeRejected)],
  ["unknown Risk field is rejected", () => expectIssue(changed((draft) => { (draft["overallRisk"] as Record<string, unknown>)["positionSize"] = 100; }), CapitalAllocationValidationIssueCode.RiskGateBlocked)],
  ["unknown candidate field is rejected", () => expectIssue(changed((draft) => { ((draft["topCandidates"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["targetWeight"] = 4_000; }), CapitalAllocationValidationIssueCode.InvalidCandidate)],
  ["unknown nested evidence field is rejected", () => expectIssue(changed((draft) => { const candidateValue = (draft["topCandidates"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>; ((candidateValue["supportingEvidence"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["brokerOrder"] = {}; }), CapitalAllocationValidationIssueCode.InvalidEvidenceReference)],
  ["unknown weight field is rejected", () => expectIssue(request({ topCandidates: [candidate({ suggestedWeight: { basisPoints: 2_000, ...({ leverageRatio: 2 } as object) } })] }), CapitalAllocationValidationIssueCode.InvalidWeight)],
  ["unknown cash field is rejected", () => expectIssue(changed((draft) => { (draft["cashRecommendation"] as Record<string, unknown>)["credential"] = "hidden"; }), CapitalAllocationValidationIssueCode.InvalidCashRecommendation)],
  ["unknown trace field is rejected", () => expectIssue(changed((draft) => { (draft["trace"] as Record<string, unknown>)["providerPayload"] = {}; }), CapitalAllocationValidationIssueCode.InvalidTrace)],
  ["constructed output contains only declared nested keys", () => { const output = framework.recommend(request()); assertDeepEqual(Object.keys(output.topCandidates[0] ?? {}).sort(), ["assetType", "candidateId", "canonicalInstrumentId", "category", "confidence", "evidenceQuality", "expectedHoldingPeriod", "primaryCatalyst", "priority", "recommendationReason", "riskLevel", "sector", "status", "supportingEvidence", "ticker"].sort(), "candidate keys"); assertDeepEqual(Object.keys(output.overallRisk).sort(), ["assessmentId", "constraints", "evaluatedAt", "evidenceReferenceIds", "policyVersion", "riskLevel", "schemaVersion", "status"].sort(), "risk keys"); }],
  ["validation issue ordering is stable", () => { const validation = validateCapitalAllocationRecommendationRequest({}); const ordered = [...validation.issues].sort((a, b) => a.code.localeCompare(b.code) || a.field.localeCompare(b.field) || a.message.localeCompare(b.message)); assertDeepEqual(validation.issues, ordered, "issues"); }],
];

let passed = 0;
for (const [name, run] of tests) {
  try { run(); passed += 1; console.log(`PASS ${name}`); }
  catch (error: unknown) { console.error(`FAIL ${name}`); throw error; }
}
console.log(`Capital Allocation Framework tests passed: ${String(passed)}/${String(tests.length)}.`);
