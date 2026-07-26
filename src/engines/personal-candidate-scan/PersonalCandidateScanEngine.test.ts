import {
  BarFreshnessStatus,
  BarInterval,
  CanonicalBarStatus,
  PERSONAL_CANDIDATE_SCAN_SCHEMA_VERSION,
  PersonalCandidateBlockerCode,
  PersonalCandidateExposure,
  PersonalCandidateMappingStatus,
  PersonalCandidateSession,
  PersonalCandidateStatus,
  PersonalCandidateStructure,
  PersonalCandidateValidationIssueCode,
  PersonalDecisionLiquidityStatus,
  PersonalDecisionMarketDataStatus,
  PersonalDecisionThesisDirection,
  type PersonalCandidateInput,
  type PersonalCandidateScanRequest,
  type PersonalCandidateTimeframeInput,
} from "../../contracts";
import {
  PersonalCandidateValidationError,
  scanPersonalCandidates,
} from "./PersonalCandidateScanEngine";

interface TestCase {
  readonly name: string;
  readonly run: () => void;
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function assertTrue(value: boolean, message: string): void {
  if (!value) throw new Error(message);
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message);
}

function expectValidationIssue(action: () => void, code: PersonalCandidateValidationIssueCode): void {
  try {
    action();
  } catch (error: unknown) {
    if (!(error instanceof PersonalCandidateValidationError)) {
      throw new Error("Expected PersonalCandidateValidationError.");
    }
    assertTrue(error.issues.some((item) => item.code === code), `Expected issue ${code}.`);
    return;
  }
  throw new Error(`Expected issue ${code}.`);
}

function endpoint(
  suffix: string,
  intervalEnd: string,
  closeAtomic: string,
): PersonalCandidateTimeframeInput["start"] {
  const fingerprintValue = [...suffix]
    .reduce((total, character) => total + character.charCodeAt(0), 0)
    .toString(16)
    .padStart(16, "0");
  return {
    barId: `canonical-bar:${suffix}`,
    fingerprint: `fnv1a64:${fingerprintValue}`,
    intervalEnd,
    close: { atomicValue: closeAtomic, scale: 2 },
  };
}

function timeframe(
  interval: BarInterval,
  suffix: string,
  startEnd: string,
  endEnd: string,
  startClose: string,
  endClose: string,
): PersonalCandidateTimeframeInput {
  return {
    interval,
    start: endpoint(`${suffix}1`, startEnd, startClose),
    end: endpoint(`${suffix}2`, endEnd, endClose),
    status: CanonicalBarStatus.Final,
    freshness: BarFreshnessStatus.Current,
    evidenceReferences: [`evidence:${suffix}`],
  };
}

function bullishTimeframes(): readonly PersonalCandidateTimeframeInput[] {
  return [
    timeframe(BarInterval.OneDay, "d", "2026-07-22T20:00:00.000Z", "2026-07-23T20:00:00.000Z", "10000", "10100"),
    timeframe(BarInterval.OneHour, "h", "2026-07-24T13:00:00.000Z", "2026-07-24T14:00:00.000Z", "10000", "10100"),
    timeframe(BarInterval.FifteenMinutes, "q", "2026-07-24T14:15:00.000Z", "2026-07-24T14:30:00.000Z", "10000", "10100"),
    timeframe(BarInterval.FiveMinutes, "f", "2026-07-24T14:30:00.000Z", "2026-07-24T14:35:00.000Z", "10000", "10100"),
  ];
}

function bearishTimeframes(): readonly PersonalCandidateTimeframeInput[] {
  return bullishTimeframes().map((item, index) => ({
    ...structuredClone(item),
    start: { ...item.start, close: { atomicValue: "10000", scale: 2 } },
    end: {
      ...item.end,
      barId: `${item.end.barId}:bear`,
      fingerprint: `fnv1a64:${String(index + 100).padStart(16, "0")}`,
      close: { atomicValue: "9900", scale: 2 },
    },
  }));
}

function candidate(
  candidateId = "candidate:tsla:tsll",
  exposure = PersonalCandidateExposure.Bullish,
  timeframes = bullishTimeframes(),
): PersonalCandidateInput {
  return {
    candidateId,
    themeId: "theme:tsla",
    analysisInstrument: {
      instrumentId: "instrument:equity:tsla",
      symbol: "TSLA",
      assetClass: "EQUITY",
      currency: "USD",
    },
    tradeVehicle: {
      instrumentId: exposure === PersonalCandidateExposure.Bullish
        ? "instrument:etf:tsll"
        : "instrument:etf:tslq",
      symbol: exposure === PersonalCandidateExposure.Bullish ? "TSLL" : "TSLQ",
      assetClass: "ETF",
      currency: "USD",
    },
    mapping: {
      mappingId: exposure === PersonalCandidateExposure.Bullish
        ? "mapping:tsla:tsll"
        : "mapping:tsla:tslq",
      version: "1.0",
      status: PersonalCandidateMappingStatus.Reviewed,
      exposure,
      evidenceReferences: ["mapping-evidence:fixture-only"],
    },
    timeframes,
    quote: {
      snapshotId: `quote:${candidateId}`,
      observedAt: "2026-07-24T14:34:30.000Z",
      status: PersonalDecisionMarketDataStatus.Current,
      spreadBasisPoints: 8,
      liquidity: PersonalDecisionLiquidityStatus.Sufficient,
    },
  };
}

function request(candidates: readonly PersonalCandidateInput[] = [candidate()]): PersonalCandidateScanRequest {
  return {
    schemaVersion: PERSONAL_CANDIDATE_SCAN_SCHEMA_VERSION,
    scanId: "personal-scan:2026-07-24:1435",
    profileId: "personal-watchlist:primary",
    profileVersion: "1.0",
    evaluatedAt: "2026-07-24T14:35:00.000Z",
    session: PersonalCandidateSession.Intraday,
    candidates,
  };
}

function onlyResult(scanRequest: PersonalCandidateScanRequest = request()) {
  const result = scanPersonalCandidates(scanRequest);
  const item = result.candidates[0];
  if (item === undefined) throw new Error("Expected one candidate.");
  return item;
}

const tests: readonly TestCase[] = [
  {
    name: "aligned bullish vehicle is ready for full Decision evaluation",
    run: () => {
      const scan = scanPersonalCandidates(request());
      const item = scan.candidates[0];
      if (item === undefined) throw new Error("Expected candidate.");
      assertEqual(item.status, PersonalCandidateStatus.ReadyForDecision, "status");
      assertEqual(item.structure, PersonalCandidateStructure.AlignedBullish, "structure");
      assertEqual(item.decisionSeed?.direction, PersonalDecisionThesisDirection.Long, "vehicle direction");
      assertEqual(item.decisionSeed?.instrument.symbol, "TSLL", "trade vehicle");
      assertEqual(scan.readyCount, 1, "ready count");
      assertEqual(scan.unranked, true, "ranking authority");
      assertEqual(scan.automatedExecutionAllowed, false, "automatic execution");
    },
  },
  {
    name: "aligned bearish structure selects a reviewed inverse vehicle as LONG",
    run: () => {
      const item = onlyResult(request([
        candidate("candidate:tsla:tslq", PersonalCandidateExposure.Bearish, bearishTimeframes()),
      ]));
      assertEqual(item.status, PersonalCandidateStatus.ReadyForDecision, "status");
      assertEqual(item.structure, PersonalCandidateStructure.AlignedBearish, "structure");
      assertEqual(item.decisionSeed?.instrument.symbol, "TSLQ", "trade vehicle");
      assertEqual(item.decisionSeed?.direction, PersonalDecisionThesisDirection.Long, "vehicle direction");
    },
  },
  {
    name: "opposed five-minute trigger produces WATCH_TRIGGER",
    run: () => {
      const frames = bullishTimeframes().map((item) =>
        item.interval === BarInterval.FiveMinutes
          ? { ...item, end: { ...item.end, close: { atomicValue: "9900", scale: 2 } } }
          : item,
      );
      const item = onlyResult(request([candidate("candidate:watch:001", PersonalCandidateExposure.Bullish, frames)]));
      assertEqual(item.status, PersonalCandidateStatus.WatchTrigger, "status");
      assertEqual(item.structure, PersonalCandidateStructure.BullishAwaitingTrigger, "structure");
      assertTrue(item.blockerCodes.includes(PersonalCandidateBlockerCode.TriggerNotConfirmed), "trigger blocker");
      assertEqual(item.decisionSeed, undefined, "decision seed");
    },
  },
  {
    name: "daily direction opposing intraday context excludes the candidate",
    run: () => {
      const frames = bullishTimeframes().map((item) =>
        item.interval === BarInterval.OneDay
          ? { ...item, end: { ...item.end, close: { atomicValue: "9900", scale: 2 } } }
          : item,
      );
      const item = onlyResult(request([candidate("candidate:mixed:001", PersonalCandidateExposure.Bullish, frames)]));
      assertEqual(item.status, PersonalCandidateStatus.Excluded, "status");
      assertTrue(item.blockerCodes.includes(PersonalCandidateBlockerCode.TimeframeStructureMixed), "structure blocker");
    },
  },
  {
    name: "vehicle exposure mismatch excludes the candidate",
    run: () => {
      const item = onlyResult(request([
        candidate("candidate:mismatch:001", PersonalCandidateExposure.Bearish, bullishTimeframes()),
      ]));
      assertEqual(item.status, PersonalCandidateStatus.Excluded, "status");
      assertTrue(item.blockerCodes.includes(PersonalCandidateBlockerCode.ExposureMismatch), "exposure blocker");
    },
  },
  {
    name: "pending mapping excludes the candidate",
    run: () => {
      const value = candidate();
      const item = onlyResult(request([{
        ...value,
        mapping: { ...value.mapping, status: PersonalCandidateMappingStatus.Pending },
      }]));
      assertTrue(item.blockerCodes.includes(PersonalCandidateBlockerCode.MappingNotReviewed), "mapping blocker");
    },
  },
  {
    name: "missing mapping evidence excludes the candidate",
    run: () => {
      const value = candidate();
      const item = onlyResult(request([{
        ...value,
        mapping: { ...value.mapping, evidenceReferences: [] },
      }]));
      assertTrue(item.blockerCodes.includes(PersonalCandidateBlockerCode.MappingEvidenceMissing), "mapping evidence blocker");
    },
  },
  {
    name: "stale timeframe excludes the candidate",
    run: () => {
      const value = candidate();
      const frames = value.timeframes.map((item) =>
        item.interval === BarInterval.FiveMinutes
          ? { ...item, freshness: BarFreshnessStatus.Stale }
          : item,
      );
      const item = onlyResult(request([{ ...value, timeframes: frames }]));
      assertTrue(item.blockerCodes.includes(PersonalCandidateBlockerCode.TimeframeDataStale), "freshness blocker");
    },
  },
  {
    name: "partial timeframe excludes the candidate",
    run: () => {
      const value = candidate();
      const frames = value.timeframes.map((item) =>
        item.interval === BarInterval.FiveMinutes
          ? { ...item, status: CanonicalBarStatus.Partial }
          : item,
      );
      const item = onlyResult(request([{ ...value, timeframes: frames }]));
      assertTrue(item.blockerCodes.includes(PersonalCandidateBlockerCode.PartialBarNotAllowed), "partial blocker");
    },
  },
  {
    name: "old five-minute observation excludes the candidate",
    run: () => {
      const value = candidate();
      const frames = value.timeframes.map((item) =>
        item.interval === BarInterval.FiveMinutes
          ? { ...item, end: { ...item.end, intervalEnd: "2026-07-24T14:20:00.000Z" }, start: { ...item.start, intervalEnd: "2026-07-24T14:15:00.000Z" } }
          : item,
      );
      const item = onlyResult(request([{ ...value, timeframes: frames }]));
      assertTrue(item.blockerCodes.includes(PersonalCandidateBlockerCode.TimeframeObservationTooOld), "age blocker");
    },
  },
  {
    name: "wide quote spread excludes the candidate",
    run: () => {
      const value = candidate();
      const item = onlyResult(request([{ ...value, quote: { ...value.quote, spreadBasisPoints: 21 } }]));
      assertTrue(item.blockerCodes.includes(PersonalCandidateBlockerCode.SpreadTooWide), "spread blocker");
    },
  },
  {
    name: "unknown liquidity excludes the candidate",
    run: () => {
      const value = candidate();
      const item = onlyResult(request([{
        ...value,
        quote: { ...value.quote, liquidity: PersonalDecisionLiquidityStatus.Unknown },
      }]));
      assertTrue(item.blockerCodes.includes(PersonalCandidateBlockerCode.LiquidityNotSufficient), "liquidity blocker");
    },
  },
  {
    name: "future quote fails structural validation",
    run: () => {
      const value = candidate();
      expectValidationIssue(
        () => scanPersonalCandidates(request([{
          ...value,
          quote: { ...value.quote, observedAt: "2026-07-24T14:36:00.000Z" },
        }])),
        PersonalCandidateValidationIssueCode.InvalidTimestamp,
      );
    },
  },
  {
    name: "missing required timeframe fails structural validation",
    run: () => {
      const value = candidate();
      expectValidationIssue(
        () => scanPersonalCandidates(request([{ ...value, timeframes: value.timeframes.slice(1) }])),
        PersonalCandidateValidationIssueCode.InvalidTimeframeSet,
      );
    },
  },
  {
    name: "duplicate timeframe fails structural validation",
    run: () => {
      const value = candidate();
      const duplicate = [
        value.timeframes[0],
        value.timeframes[1],
        value.timeframes[2],
        value.timeframes[2],
      ];
      expectValidationIssue(
        () => scanPersonalCandidates(request([{ ...value, timeframes: duplicate as readonly PersonalCandidateTimeframeInput[] }])),
        PersonalCandidateValidationIssueCode.InvalidTimeframeSet,
      );
    },
  },
  {
    name: "duplicate trade vehicle fails structural validation",
    run: () => {
      const first = candidate("candidate:duplicate:001");
      const second = { ...candidate("candidate:duplicate:002"), tradeVehicle: first.tradeVehicle };
      expectValidationIssue(
        () => scanPersonalCandidates(request([first, second])),
        PersonalCandidateValidationIssueCode.DuplicateCandidate,
      );
    },
  },
  {
    name: "undeclared order field fails closed",
    run: () => {
      const injected = structuredClone(request()) as unknown as {
        candidates: Array<Record<string, unknown>>;
      };
      injected.candidates[0]!.order = { type: "MARKET" };
      expectValidationIssue(
        () => scanPersonalCandidates(injected),
        PersonalCandidateValidationIssueCode.UndeclaredField,
      );
    },
  },
  {
    name: "result is deterministic, immutable, and contains no probability",
    run: () => {
      const first = scanPersonalCandidates(request());
      const second = scanPersonalCandidates(request());
      assertDeepEqual(first, second, "results must be deterministic");
      assertTrue(Object.isFrozen(first) && Object.isFrozen(first.candidates[0]), "result must be deeply frozen");
      const serialized = JSON.stringify(first);
      assertTrue(!serialized.includes("probability"), "scanner must not claim probability");
      assertTrue(!serialized.includes("\"order\""), "scanner must not create an order");
    },
  },
  {
    name: "ready watch and excluded candidates are grouped without ranking",
    run: () => {
      const ready = candidate("candidate:a:ready");
      const watchFrames = bullishTimeframes().map((item) =>
        item.interval === BarInterval.FiveMinutes
          ? { ...item, end: { ...item.end, close: { atomicValue: "10000", scale: 2 } } }
          : item,
      );
      const watchBase = candidate("candidate:b:watch", PersonalCandidateExposure.Bullish, watchFrames);
      const watch = {
        ...watchBase,
        tradeVehicle: {
          ...watchBase.tradeVehicle,
          instrumentId: "instrument:etf:tsl2",
          symbol: "TSL2",
        },
      };
      const excludedValue = candidate("candidate:c:excluded", PersonalCandidateExposure.Bearish, bullishTimeframes());
      const scan = scanPersonalCandidates(request([excludedValue, watch, ready]));
      assertEqual(scan.readyCount, 1, "ready count");
      assertEqual(scan.watchCount, 1, "watch count");
      assertEqual(scan.excludedCount, 1, "excluded count");
      assertDeepEqual(
        scan.candidates.map(({ status }) => status),
        [PersonalCandidateStatus.ReadyForDecision, PersonalCandidateStatus.WatchTrigger, PersonalCandidateStatus.Excluded],
        "display grouping",
      );
      assertEqual(scan.unranked, true, "unranked");
    },
  },
];

let passed = 0;
for (const test of tests) {
  try {
    test.run();
    passed += 1;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL: ${test.name}: ${message}`);
    throw error;
  }
}

console.log(`Personal Candidate Scan: ${String(passed)}/${String(tests.length)} tests passed.`);
