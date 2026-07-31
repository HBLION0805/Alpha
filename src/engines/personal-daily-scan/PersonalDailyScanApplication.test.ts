import { PersonalCandidateStatus } from "../../contracts/PersonalCandidateScan";
import { PersonalCandidateValidationIssueCode } from "../../contracts/PersonalCandidateScan";
import { PersonalDecisionLiquidityStatus } from "../../contracts/PersonalDecision";
import { PersonalDailyScanEligibilityStatus, PersonalDailyScanInstrumentClassification, PersonalDailyScanIntent, PersonalDailyScanMode } from "../../contracts/PersonalDailyScan";
import { createPersonalDailyScanRunId, derivePersonalDailyScanCompletedSessionBarValidity, derivePersonalDailyScanQuoteFreshness, derivePersonalDailyScanLiquidityEvidenceStatus, runPersonalDailyScan, runPersonalDailyScanWithRuntimeForTest, evaluateDailyScanIntentGate } from "./PersonalDailyScanApplication";
import { composePersonalMarketData } from "../personal-market-data-composition/PersonalMarketDataCompositionEngine";
import { PersonalCandidateValidationError, scanPersonalCandidates } from "../personal-candidate-scan/PersonalCandidateScanEngine";
import { VerifiedMarketEvidenceStatus } from "../../contracts/VerifiedMarketSnapshot";
import { buildOfflinePersonalDailyScanFixture, buildOfflinePersonalDailyScanTemporalFixtureForTest, offlinePersonalDailyScanFixtureBuildCountForTest, resetOfflinePersonalDailyScanFixtureBuildCountForTest } from "./PersonalDailyScanFixture";
import { classifyPersonalWatchlistInstrument, classifyPersonalWatchlistVehicle, evaluatePersonalDailyScanEligibility, mapPersonalDailyScanProductDisplayStatus } from "./PersonalDailyScanEligibility";

type Test = readonly [string, () => void];
const tests: Test[] = [];
function test(name: string, run: Test[1]): void { tests.push([name, run]); }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

test("fixture completes the canonical observation to Owner output path deterministically", () => {
  const left = runPersonalDailyScan({ mode: PersonalDailyScanMode.Fixture });
  const right = runPersonalDailyScan({ mode: PersonalDailyScanMode.Fixture });
  assert(left.status === "COMPLETED" && left.snapshotStatus === "VERIFIED", "fixture must complete");
  assert(JSON.stringify(left) === JSON.stringify(right), "fixture output must replay identically");
  assert(left.candidates.some((candidate) => candidate.structuralStatus === "READY_FOR_DECISION"), "structural READY state missing");
  assert(left.candidates.every((candidate) => candidate.internalStatus === candidate.structuralStatus), "internal Candidate Scan status must remain intact");
  assert(left.candidates.every((candidate) => candidate.eligibilityStatus === "BLOCKED"), "fixture must visibly block every mapped leveraged vehicle when required evidence is unavailable");
  assert(left.candidates.every((candidate) => candidate.productDisplayStatus !== "READY"), "eligibility gate must prevent READY display for every fixture vehicle");
  assert(left.candidates.every((candidate) => candidate.blockingReasons.includes("LEVERAGED_MACRO_EVIDENCE_REQUIRED") && candidate.blockingReasons.includes("LEVERAGED_VOLATILITY_EVIDENCE_REQUIRED")), "Owner output must expose specific leverage-evidence blockers");
  assert(left.candidates.every((candidate) => ["READY", "WATCH_TRIGGER", "EXCLUDED"].includes(candidate.productDisplayStatus)), "fourth product state is forbidden");
  assert(left.volatilityEvidenceStatus === VerifiedMarketEvidenceStatus.Unavailable, "fixture must visibly report unavailable VIX/volatility evidence");
});

for (const mapping of buildOfflinePersonalDailyScanFixture().mappingRegistry.mappings) {
  test(`authoritative mapping classifies ${mapping.tradeVehicle.displaySymbol} without ticker inference`, () => {
    const classification = classifyPersonalWatchlistVehicle(mapping);
    const expected = mapping.dailyTargetBasisPoints > 0
      ? PersonalDailyScanInstrumentClassification.LeveragedLong
      : PersonalDailyScanInstrumentClassification.LeveragedInverse;
    assert(classification === expected, "classification must follow signed target, asset class, reset, and holding metadata");
    const blocked = evaluatePersonalDailyScanEligibility({ classification, macroEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable, benchmarkEvidenceStatus: VerifiedMarketEvidenceStatus.Available, volatilityEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable });
    assert(blocked.status === PersonalDailyScanEligibilityStatus.Blocked, "every active leveraged or inverse vehicle must be blocked without required evidence");
    assert(mapPersonalDailyScanProductDisplayStatus(PersonalCandidateStatus.ReadyForDecision, blocked) !== "READY", "blocked leveraged or inverse vehicle must not display READY");
    const macroOnlyMissing = evaluatePersonalDailyScanEligibility({ classification, macroEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable, benchmarkEvidenceStatus: VerifiedMarketEvidenceStatus.Available, volatilityEvidenceStatus: VerifiedMarketEvidenceStatus.Available });
    const volatilityOnlyMissing = evaluatePersonalDailyScanEligibility({ classification, macroEvidenceStatus: VerifiedMarketEvidenceStatus.Available, benchmarkEvidenceStatus: VerifiedMarketEvidenceStatus.Available, volatilityEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable });
    assert(mapPersonalDailyScanProductDisplayStatus(PersonalCandidateStatus.ReadyForDecision, macroOnlyMissing) !== "READY", "macro absence alone must block leveraged READY");
    assert(mapPersonalDailyScanProductDisplayStatus(PersonalCandidateStatus.ReadyForDecision, volatilityOnlyMissing) !== "READY", "VIX/volatility absence alone must block leveraged READY");
  });
}

test("authoritative registry classifies all eleven active instruments without ticker inference", () => {
  const registry = buildOfflinePersonalDailyScanFixture().mappingRegistry;
  const classifications = new Map<string, PersonalDailyScanInstrumentClassification>();
  for (const mapping of registry.mappings) {
    classifications.set(mapping.analysisInstrument.instrumentId, classifyPersonalWatchlistInstrument(registry, mapping.analysisInstrument.instrumentId));
    classifications.set(mapping.tradeVehicle.instrumentId, classifyPersonalWatchlistInstrument(registry, mapping.tradeVehicle.instrumentId));
  }
  assert(classifications.size === 11, "the registry must account for all 11 active instruments");
  assert([...classifications.values()].filter((value) => value === PersonalDailyScanInstrumentClassification.AnalysisUnderlying).length === 4, "four analysis underlyings expected");
  assert([...classifications.values()].filter((value) => value === PersonalDailyScanInstrumentClassification.LeveragedLong).length === 4, "four leveraged long vehicles expected");
  assert([...classifications.values()].filter((value) => value === PersonalDailyScanInstrumentClassification.LeveragedInverse).length === 3, "three leveraged inverse vehicles expected");
});

test("ordinary structural candidates remain eligible when optional macro evidence is unavailable", () => {
  const eligibility = evaluatePersonalDailyScanEligibility({
    classification: PersonalDailyScanInstrumentClassification.Ordinary,
    macroEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable,
    benchmarkEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable,
    volatilityEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable,
  });
  assert(eligibility.status === PersonalDailyScanEligibilityStatus.Eligible, "optional macro absence must not block ordinary structural candidates");
  assert(mapPersonalDailyScanProductDisplayStatus(PersonalCandidateStatus.ReadyForDecision, eligibility) === "READY", "eligible structural READY must display READY");
});

test("all required leverage evidence permits structural READY to display READY", () => {
  const eligibility = evaluatePersonalDailyScanEligibility({
    classification: PersonalDailyScanInstrumentClassification.LeveragedLong,
    macroEvidenceStatus: VerifiedMarketEvidenceStatus.Available,
    benchmarkEvidenceStatus: VerifiedMarketEvidenceStatus.Available,
    volatilityEvidenceStatus: VerifiedMarketEvidenceStatus.Available,
  });
  assert(eligibility.status === PersonalDailyScanEligibilityStatus.Eligible, "complete leverage evidence must satisfy the separate eligibility gate");
  assert(mapPersonalDailyScanProductDisplayStatus(PersonalCandidateStatus.ReadyForDecision, eligibility) === "READY", "READY mapping requires both structural READY and eligible evidence");
});

test("macro gate preserves structural scans but blocks event-sensitive and leveraged decisions without required evidence", () => {
  const structural = evaluateDailyScanIntentGate(PersonalDailyScanIntent.Structural, VerifiedMarketEvidenceStatus.Unavailable, VerifiedMarketEvidenceStatus.Available, VerifiedMarketEvidenceStatus.Unavailable);
  const event = evaluateDailyScanIntentGate(PersonalDailyScanIntent.EventSensitive, VerifiedMarketEvidenceStatus.Unavailable, VerifiedMarketEvidenceStatus.Available, VerifiedMarketEvidenceStatus.Unavailable);
  const leveraged = evaluateDailyScanIntentGate(PersonalDailyScanIntent.LeveragedDecision, VerifiedMarketEvidenceStatus.Unavailable, VerifiedMarketEvidenceStatus.Available, VerifiedMarketEvidenceStatus.Unavailable);
  assert(structural.allowed, "optional macro must not permanently block structural scan");
  assert(!event.allowed && event.blockers.includes("EVENT_CALENDAR_REQUIRED_UNAVAILABLE"), "event calendar must block event-sensitive scan");
  assert(!leveraged.allowed && leveraged.blockers.includes("LEVERAGED_VOLATILITY_EVIDENCE_REQUIRED"), "VIX/volatility absence must block leveraged decision");
});

test("live-readonly is fail-closed before any provider transport exists", () => {
  const output = runPersonalDailyScan({ mode: PersonalDailyScanMode.LiveReadonly });
  assert(output.status === "BLOCKED", "live mode must be blocked");
  assert(output.blockingReasons.includes("OWNER_NETWORK_AUTHORIZATION_REQUIRED"), "owner authorization blocker missing");
  assert(output.networkRequests === 0 && output.persistenceWrites === 0, "blocked live mode must have zero side effects");
  assert(output.volatilityEvidenceStatus === VerifiedMarketEvidenceStatus.Unavailable, "blocked live mode must report volatility independently");
});

test("dry-run plans only and never builds fixture observations", () => {
  resetOfflinePersonalDailyScanFixtureBuildCountForTest();
  const output = runPersonalDailyScan({ mode: PersonalDailyScanMode.DryRun });
  assert(output.status === "DRY_RUN" && output.snapshotStatus === "NOT_COMPOSED", "dry-run must not compose a snapshot");
  assert(offlinePersonalDailyScanFixtureBuildCountForTest() === 0, "dry-run must not call fixture normalizers or observation builder");
  assert(output.volatilityEvidenceStatus === VerifiedMarketEvidenceStatus.Unavailable, "dry-run must report volatility independently");
});

test("invalid snapshot becomes readable blocked Owner output without side effects", () => {
  const fixture = buildOfflinePersonalDailyScanFixture();
  const output = runPersonalDailyScan({ mode: PersonalDailyScanMode.Fixture, fixtureFactory: () => ({ ...fixture, snapshotInput: { ...fixture.snapshotInput, canonicalQuoteReferences: fixture.snapshotInput.canonicalQuoteReferences.slice(1) } }) });
  assert(output.status === "BLOCKED" && output.candidates.length === 0, "invalid snapshot must block before candidates");
  assert(output.blockingReasons.includes("COVERAGE_MISSING") || output.blockingReasons.includes("COMPOSITION_BINDING_MISMATCH"), "stable Snapshot issue code must be visible");
  assert(output.networkRequests === 0 && output.persistenceWrites === 0, "blocked validation must remain side-effect free");
  assert(output.volatilityEvidenceStatus === VerifiedMarketEvidenceStatus.Invalid, "invalid Snapshot must report invalid volatility context");
});

test("premarket 08:30, intraday 10:00, and post-close preserve completed-session Bars while Quotes stay wall-clock current", () => {
  for (const scenario of [
    "PRE_MARKET_0830",
    "INTRADAY_1000",
    "POST_CLOSE",
  ] as const) {
    const output = runPersonalDailyScan({
      mode: PersonalDailyScanMode.Fixture,
      fixtureFactory: () =>
        buildOfflinePersonalDailyScanTemporalFixtureForTest(scenario),
    });
    assert(
      output.status === "COMPLETED" && output.snapshotStatus === "VERIFIED",
      `${scenario} must form a valid read-only scan`,
    );
    assert(
      output.candidates.every(
        (candidate) =>
          candidate.completedSessionBarValidity === "VALID" &&
          candidate.quoteFreshness === "CURRENT",
      ),
      `${scenario} must separate valid completed Bars from current Quotes`,
    );
    assert(
      output.networkRequests === 0 && output.persistenceWrites === 0,
      `${scenario} must remain side-effect free`,
    );
  }
});

test("weekend replay uses explicit Friday session and blocks stale wall-clock Quotes", () => {
  const output = runPersonalDailyScan({
    mode: PersonalDailyScanMode.Fixture,
    fixtureFactory: () =>
      buildOfflinePersonalDailyScanTemporalFixtureForTest("WEEKEND"),
  });
  assert(output.status === "BLOCKED", "weekend stale Quote must block");
  assert(
    output.blockingReasons.includes("STALE_OBSERVATION"),
    "weekend blocker must expose stable Quote freshness code",
  );
  assert(
    output.blockingReasons.join("|") ===
      [...output.blockingReasons].sort().join("|"),
    "weekend issue codes must be sorted",
  );
  assert(
    output.candidates.length === 0 &&
      output.networkRequests === 0 &&
      output.persistenceWrites === 0,
    "weekend failure must have zero candidates and side effects",
  );
});

test("timeframe binding failures return stable BLOCKED output with no candidates or side effects", () => {
  const cases: readonly [
    string,
    (
      fixture: ReturnType<typeof buildOfflinePersonalDailyScanFixture>,
    ) => ReturnType<typeof buildOfflinePersonalDailyScanFixture>,
    string,
  ][] = [
    [
      "single Bar reuse",
      (fixture) => {
        const [first, ...rest] =
          fixture.snapshotInput.compositionBinding.candidates;
        return {
          ...fixture,
          snapshotInput: {
            ...fixture.snapshotInput,
            compositionBinding: {
              ...fixture.snapshotInput.compositionBinding,
              candidates: [
                {
                  ...first!,
                  timeframes: first!.timeframes.map((timeframe) =>
                    timeframe.interval === "PT5M"
                      ? {
                          ...timeframe,
                          endBarId: timeframe.startBarId,
                          endBarFingerprint:
                            timeframe.startBarFingerprint,
                        }
                      : timeframe,
                  ),
                },
                ...rest,
              ],
            },
          },
        };
      },
      "TIMEFRAME_BAR_BINDING_INVALID",
    ],
    [
      "reversed Bars",
      (fixture) => {
        const [first, ...rest] =
          fixture.snapshotInput.compositionBinding.candidates;
        return {
          ...fixture,
          snapshotInput: {
            ...fixture.snapshotInput,
            compositionBinding: {
              ...fixture.snapshotInput.compositionBinding,
              candidates: [
                {
                  ...first!,
                  timeframes: first!.timeframes.map((timeframe) =>
                    timeframe.interval === "PT5M"
                      ? {
                          ...timeframe,
                          startBarId: timeframe.endBarId,
                          startBarFingerprint: timeframe.endBarFingerprint,
                          endBarId: timeframe.startBarId,
                          endBarFingerprint: timeframe.startBarFingerprint,
                        }
                      : timeframe,
                  ),
                },
                ...rest,
              ],
            },
          },
        };
      },
      "TIMEFRAME_BAR_BINDING_INVALID",
    ],
    [
      "cross-session Bars",
      (fixture) => {
        const candidate =
          fixture.snapshotInput.compositionBinding.candidates[0]!;
        const barId = candidate.timeframes.find(
          (timeframe) => timeframe.interval === "PT5M",
        )!.startBarId;
        return {
          ...fixture,
          snapshotInput: {
            ...fixture.snapshotInput,
            canonicalBarReferences:
              fixture.snapshotInput.canonicalBarReferences.map((bar) =>
                bar.canonicalBarId === barId
                  ? { ...bar, sessionDate: "2026-07-27" }
                  : bar,
              ),
          },
        };
      },
      "TIMEFRAME_BAR_BINDING_INVALID",
    ],
    [
      "extra Bar",
      (fixture) => {
        const candidate =
          fixture.snapshotInput.compositionBinding.candidates[0]!;
        const source = fixture.snapshotInput.canonicalBarReferences.find(
          (bar) =>
            bar.canonicalInstrumentId === candidate.analysisInstrumentId &&
            bar.interval === "PT5M",
        )!;
        return {
          ...fixture,
          snapshotInput: {
            ...fixture.snapshotInput,
            canonicalBarReferences: [
              ...fixture.snapshotInput.canonicalBarReferences,
              {
                ...source,
                canonicalBarId: `${source.canonicalBarId}:extra`,
                canonicalBarFingerprint: "fnv1a64:0000000000000001",
              },
            ],
          },
        };
      },
      "TIMEFRAME_BAR_COUNT_MISMATCH",
    ],
    [
      "missing Bar",
      (fixture) => {
        const candidate =
          fixture.snapshotInput.compositionBinding.candidates[0]!;
        const barId = candidate.timeframes.find(
          (timeframe) => timeframe.interval === "PT5M",
        )!.startBarId;
        return {
          ...fixture,
          snapshotInput: {
            ...fixture.snapshotInput,
            canonicalBarReferences:
              fixture.snapshotInput.canonicalBarReferences.filter(
                (bar) => bar.canonicalBarId !== barId,
              ),
          },
        };
      },
      "TIMEFRAME_BAR_COUNT_MISMATCH",
    ],
  ];
  for (const [name, mutate, expected] of cases) {
    const output = runPersonalDailyScan({
      mode: PersonalDailyScanMode.Fixture,
      fixtureFactory: () =>
        mutate(buildOfflinePersonalDailyScanFixture()),
    });
    assert(output.status === "BLOCKED", `${name} must block`);
    assert(
      output.blockingReasons.includes(expected),
      `${name} must expose ${expected}`,
    );
    assert(
      output.blockingReasons.join("|") ===
        [...output.blockingReasons].sort().join("|"),
      `${name} issue codes must be sorted`,
    );
    assert(
      output.candidates.length === 0 &&
        output.networkRequests === 0 &&
        output.persistenceWrites === 0,
      `${name} must have zero candidates and side effects`,
    );
  }
});

function assertStableBlocked(
  output: ReturnType<typeof runPersonalDailyScan>,
  expectedCode: string,
): void {
  assert(output.status === "BLOCKED", "failure must map to BLOCKED");
  assert(output.candidates.length === 0, "failure cannot emit partial candidates");
  assert(output.blockingReasons.includes(expectedCode), `missing stable issue code ${expectedCode}`);
  assert(output.networkRequests === 0 && output.persistenceWrites === 0, "failure path must have zero side effects");
  assert(output.volatilityEvidenceStatus === VerifiedMarketEvidenceStatus.Unavailable, "processing failure must preserve visible VIX unavailable status");
}

test("Composition liquidity failures map to stable readable BLOCKED outputs", () => {
  const cases: readonly [string, (fixture: ReturnType<typeof buildOfflinePersonalDailyScanFixture>) => ReturnType<typeof buildOfflinePersonalDailyScanFixture>, string][] = [
    ["missing", (fixture) => {
      const [first, ...rest] = fixture.compositionRequest.candidates;
      const { liquidity: _liquidity, ...withoutLiquidity } = first!;
      return { ...fixture, compositionRequest: { ...fixture.compositionRequest, candidates: [withoutLiquidity as never, ...rest] } };
    }, "COMPOSITION_INVALID_LIQUIDITY_ASSESSMENT"],
    ["expired", (fixture) => {
      const [first, ...rest] = fixture.compositionRequest.candidates;
      return { ...fixture, compositionRequest: { ...fixture.compositionRequest, candidates: [{ ...first!, liquidity: { ...first!.liquidity, evaluatedAt: "2026-07-28T19:59:00.000Z" } }, ...rest] } };
    }, "COMPOSITION_INVALID_LIQUIDITY_ASSESSMENT"],
    ["wrong quote binding", (fixture) => {
      const [first, ...rest] = fixture.compositionRequest.candidates;
      return { ...fixture, compositionRequest: { ...fixture.compositionRequest, candidates: [{ ...first!, liquidity: { ...first!.liquidity, quoteFingerprint: "fnv1a64:0000000000000000" } }, ...rest] } };
    }, "COMPOSITION_LIQUIDITY_BINDING_MISMATCH"],
    ["duplicated assessment", (fixture) => {
      const [first, second, ...rest] = fixture.compositionRequest.candidates;
      return { ...fixture, compositionRequest: { ...fixture.compositionRequest, candidates: [first!, { ...second!, liquidity: { ...second!.liquidity, assessmentId: first!.liquidity.assessmentId } }, ...rest] } };
    }, "COMPOSITION_INVALID_LIQUIDITY_ASSESSMENT"],
  ];
  for (const [, mutate, expected] of cases) {
    const output = runPersonalDailyScan({
      mode: PersonalDailyScanMode.Fixture,
      fixtureFactory: () => mutate(buildOfflinePersonalDailyScanFixture()),
    });
    assertStableBlocked(output, expected);
  }
});

test("wrong candidate binding is blocked before Composition without partial output", () => {
  const fixture = buildOfflinePersonalDailyScanFixture();
  const [first, ...rest] = fixture.compositionRequest.candidates;
  const output = runPersonalDailyScan({
    mode: PersonalDailyScanMode.Fixture,
    fixtureFactory: () => ({
      ...fixture,
      compositionRequest: {
        ...fixture.compositionRequest,
        candidates: [{ ...first!, candidateId: `${first!.candidateId}:wrong` }, ...rest],
      },
    }),
  });
  assertStableBlocked(output, "COMPOSITION_BINDING_MISMATCH");
});

test("Candidate Scan typed validation failures map to stable BLOCKED output", () => {
  const output = runPersonalDailyScanWithRuntimeForTest(
    { mode: PersonalDailyScanMode.Fixture },
    {
      compose: composePersonalMarketData,
      scan: () => {
        throw new PersonalCandidateValidationError([
          {
            code: PersonalCandidateValidationIssueCode.InvalidRequest,
            field: "$",
            message: "Injected typed validation failure.",
          },
        ]);
      },
    },
  );
  assertStableBlocked(output, "CANDIDATE_INVALID_REQUEST");
});

test("Composition failure replay is deterministic and blocker ordering is stable", () => {
  const fixture = buildOfflinePersonalDailyScanFixture();
  const [first, ...rest] = fixture.compositionRequest.candidates;
  const broken = {
    ...fixture,
    compositionRequest: {
      ...fixture.compositionRequest,
      candidates: [{ ...first!, liquidity: { ...first!.liquidity, quoteId: "quote:wrong", quoteFingerprint: "fnv1a64:0000000000000000" } }, ...rest],
    },
  };
  const left = runPersonalDailyScan({ mode: PersonalDailyScanMode.Fixture, fixtureFactory: () => broken });
  const right = runPersonalDailyScan({ mode: PersonalDailyScanMode.Fixture, fixtureFactory: () => broken });
  assert(JSON.stringify(left) === JSON.stringify(right), "blocked processing replay must be deterministic");
  assert(left.blockingReasons.join("|") === [...left.blockingReasons].sort().join("|"), "blocking issue codes must be stable sorted");
});

test("liquidity, Quote freshness, and completed-session Bar validity remain separate", () => {
  const observation = buildOfflinePersonalDailyScanFixture().compositionRequest.candidates[0]!;
  assert(derivePersonalDailyScanLiquidityEvidenceStatus({ ...observation, liquidity: { ...observation.liquidity, status: PersonalDecisionLiquidityStatus.Insufficient } }) === "INSUFFICIENT", "CURRENT quote must not upgrade insufficient liquidity");
  assert(derivePersonalDailyScanLiquidityEvidenceStatus(undefined) === "UNAVAILABLE", "missing assessment must remain unavailable");
  assert(derivePersonalDailyScanCompletedSessionBarValidity(undefined) === "UNAVAILABLE", "empty Bar evidence must never be valid");
  assert(derivePersonalDailyScanCompletedSessionBarValidity({ ...observation, timeframes: observation.timeframes.slice(1) }) === "UNAVAILABLE", "missing required interval must never be valid");
  assert(derivePersonalDailyScanQuoteFreshness(observation) === "CURRENT", "fixture Quote must be current independently of Bar validity");
});

test("run identity binds all decision-relevant application inputs deterministically", () => {
  const base = { mode: PersonalDailyScanMode.Fixture, intent: PersonalDailyScanIntent.Structural, asOf: "2026-07-28T20:00:10.000Z", inputFingerprint: "fnv1a64:1111111111111111", mappingRegistryVersion: "1.1", profileId: "profile:offline", profileVersion: "1.0", evidencePolicyVersion: "1.0", macroEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable, benchmarkEvidenceStatus: VerifiedMarketEvidenceStatus.Available, volatilityEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable, issueCodes: [] };
  const baseline = createPersonalDailyScanRunId(base);
  assert(baseline === createPersonalDailyScanRunId(base), "identical inputs must replay to one run ID");
  for (const changed of [{ ...base, mode: PersonalDailyScanMode.DryRun }, { ...base, intent: PersonalDailyScanIntent.EventSensitive }, { ...base, inputFingerprint: "fnv1a64:2222222222222222" }, { ...base, asOf: "2026-07-28T20:00:11.000Z" }, { ...base, mappingRegistryVersion: "1.2" }, { ...base, profileId: "profile:other" }, { ...base, profileVersion: "2.0" }, { ...base, evidencePolicyVersion: "2.0" }, { ...base, macroEvidenceStatus: VerifiedMarketEvidenceStatus.Available }, { ...base, benchmarkEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable }, { ...base, volatilityEvidenceStatus: VerifiedMarketEvidenceStatus.Available }, { ...base, issueCodes: ["ISSUE"] }]) assert(createPersonalDailyScanRunId(changed) !== baseline, "every decision-relevant input must change run ID");
  assert(createPersonalDailyScanRunId({ ...base, issueCodes: ["B", "A"] }) === createPersonalDailyScanRunId({ ...base, issueCodes: ["A", "B"] }), "issue ordering must not change run ID");
  assert(runPersonalDailyScan({ mode: PersonalDailyScanMode.LiveReadonly, intent: PersonalDailyScanIntent.Structural }).runId !== runPersonalDailyScan({ mode: PersonalDailyScanMode.LiveReadonly, intent: PersonalDailyScanIntent.EventSensitive }).runId, "blocked modes must bind intent rather than use a fixed run ID");
});

let passed = 0;
for (const [name, run] of tests) { try { run(); passed += 1; console.log(`PASS ${name}`); } catch (error) { console.error(`FAIL ${name}`); throw error; } }
console.log(`Personal Daily Scan application: ${passed}/${tests.length} tests passed.`);
